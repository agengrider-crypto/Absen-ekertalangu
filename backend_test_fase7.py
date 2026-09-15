#!/usr/bin/env python3
"""
FASE 7 Backend Testing - E-KERTALANGU
Tests all 6 FASE 7 features with comprehensive scenarios A-G
"""
import requests
import json
import time
from datetime import datetime, timedelta

# Base URL from frontend/.env
BASE_URL = "https://event-recap-filter.preview.emergentagent.com/api"

# Test credentials
ADMIN_CREDS = {"identifier": "admin", "password": "jokam354"}
PENGURUS_CREDS = {"identifier": "pengurus@ekertalangu.id", "password": "Pengurus#2026"}
PESERTA_CREDS = {"identifier": "peserta@ekertalangu.id", "password": "Peserta#2026"}

# Session storage
sessions = {}

def login(role: str, creds: dict) -> requests.Session:
    """Login and return session with cookies"""
    s = requests.Session()
    resp = s.post(f"{BASE_URL}/auth/login", json=creds)
    if resp.status_code != 200:
        raise Exception(f"Login {role} failed: {resp.status_code} {resp.text}")
    print(f"✅ Login {role} successful")
    sessions[role] = s
    return s

def test_a_share_kegiatan_kode_akses():
    """A. SHARE KEGIATAN + KODE AKSES 6 DIGIT"""
    print("\n" + "="*80)
    print("TEST A: SHARE KEGIATAN + KODE AKSES 6 DIGIT")
    print("="*80)
    
    admin = sessions.get("admin") or login("admin", ADMIN_CREDS)
    
    # A1. Create kegiatan with access_code
    today = datetime.now().strftime("%Y-%m-%d")
    kegiatan_data = {
        "name": "Uji Fase 7",
        "type": "rutin",
        "date": today,
        "start_time": "05:00",
        "end_time": "23:00"
    }
    resp = admin.post(f"{BASE_URL}/admin/kegiatan", json=kegiatan_data)
    assert resp.status_code == 200, f"A1 FAIL: Create kegiatan returned {resp.status_code}"
    kegiatan_list = resp.json()
    kegiatan = kegiatan_list[0] if isinstance(kegiatan_list, list) else kegiatan_list
    kegiatan_id = kegiatan["id"]
    
    # Check for access_code and akses_token
    assert "access_code" in kegiatan, "A1 FAIL: No access_code in response"
    assert "akses_token" in kegiatan, "A1 FAIL: No akses_token in response"
    access_code = kegiatan["access_code"]
    akses_token = kegiatan["akses_token"]
    assert len(access_code) == 6, f"A1 FAIL: access_code not 6 digits: {access_code}"
    assert access_code.isdigit(), f"A1 FAIL: access_code not numeric: {access_code}"
    print(f"✅ A1: Created kegiatan with access_code={access_code}, akses_token={akses_token}")
    
    # A2. GET /api/admin/kegiatan/{id}/access
    resp = admin.get(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/access")
    assert resp.status_code == 200, f"A2 FAIL: GET access returned {resp.status_code}"
    access_data = resp.json()
    assert "token" in access_data, "A2 FAIL: No token in response"
    assert "code" in access_data, "A2 FAIL: No code in response"
    assert "link" in access_data, "A2 FAIL: No link in response"
    assert "image" in access_data, "A2 FAIL: No image in response"
    assert "wa_text" in access_data, "A2 FAIL: No wa_text in response"
    assert "valid_until" in access_data, "A2 FAIL: No valid_until in response"
    assert "kegiatan_status" in access_data, "A2 FAIL: No kegiatan_status in response"
    assert len(access_data["code"]) == 6, f"A2 FAIL: code not 6 digits: {access_data['code']}"
    assert "/absensi/" in access_data["link"], f"A2 FAIL: link doesn't contain /absensi/: {access_data['link']}"
    assert access_data["image"].startswith("data:image/png;base64,"), "A2 FAIL: image not PNG data URL"
    print(f"✅ A2: GET access returned all required fields")
    
    # A3. POST /api/absensi/{token}/verify with wrong code
    verify_url = f"{BASE_URL}/absensi/{akses_token}/verify"
    resp = requests.post(verify_url, json={"code": "000000"})
    assert resp.status_code == 401, f"A3 FAIL: Wrong code should return 401, got {resp.status_code}"
    error_msg = resp.json().get("detail", "")
    assert "kode" in error_msg.lower() or "salah" in error_msg.lower(), f"A3 FAIL: Error message not in Indonesian: {error_msg}"
    print(f"✅ A3: Wrong code returns 401 with Indonesian error message")
    
    # A4. POST /api/absensi/{token}/verify with correct code
    resp = requests.post(verify_url, json={"code": access_code})
    assert resp.status_code == 200, f"A4 FAIL: Correct code should return 200, got {resp.status_code}: {resp.text}"
    verify_data = resp.json()
    assert "access" in verify_data, "A4 FAIL: No access (JWT) in response"
    assert "kegiatan" in verify_data, "A4 FAIL: No kegiatan in response"
    assert "counts" in verify_data, "A4 FAIL: No counts in response"
    assert "rows" in verify_data, "A4 FAIL: No rows in response"
    
    # Check rows for pending users and no admin
    rows = verify_data["rows"]
    assert len(rows) > 0, "A4 FAIL: No rows returned"
    
    # Create a pending user to test
    pending_data = {"entries": [{"name": "Peserta Pending Uji", "dob": "2000-01-01"}]}
    resp_pending = admin.post(f"{BASE_URL}/admin/users/pending", json=pending_data)
    assert resp_pending.status_code == 200, f"A4 FAIL: Create pending user failed: {resp_pending.status_code}"
    
    # Verify again to get updated rows
    resp = requests.post(verify_url, json={"code": access_code})
    assert resp.status_code == 200, f"A4 FAIL: Re-verify failed: {resp.status_code}"
    verify_data = resp.json()
    rows = verify_data["rows"]
    
    # Check for pending user
    has_pending = any(r.get("account_status") == "pending" for r in rows)
    assert has_pending, "A4 FAIL: No pending user in rows"
    
    # Check admin is NOT in rows
    admin_in_rows = any(r.get("email") == "ageng.rider@gmail.com" or r.get("name") == "Admin" for r in rows)
    assert not admin_in_rows, "A4 FAIL: Admin account found in rows (should be excluded)"
    
    access_jwt = verify_data["access"]
    print(f"✅ A4: Correct code returns 200 with access JWT, rows include pending users, admin excluded")
    
    # A5. GET /api/absensi/{token} with and without access
    resp = requests.get(f"{BASE_URL}/absensi/{akses_token}")
    assert resp.status_code == 401, f"A5 FAIL: GET without access should return 401, got {resp.status_code}"
    
    resp = requests.get(f"{BASE_URL}/absensi/{akses_token}", params={"access": access_jwt})
    assert resp.status_code == 200, f"A5 FAIL: GET with access should return 200, got {resp.status_code}"
    get_data = resp.json()
    assert len(get_data["rows"]) == len(rows), "A5 FAIL: Row count mismatch"
    print(f"✅ A5: GET without access=401, with access=200")
    
    # A6. POST /api/absensi/{token}/mark with different statuses
    user_id = rows[0]["user_id"]
    
    # Test hadir - should have message
    resp = requests.post(f"{BASE_URL}/absensi/{akses_token}/mark", 
                        json={"access": access_jwt, "user_id": user_id, "status": "hadir"})
    assert resp.status_code == 200, f"A6 FAIL: Mark hadir failed: {resp.status_code}"
    mark_data = resp.json()
    assert "message" in mark_data, "A6 FAIL: No message field in response"
    assert mark_data["message"] == "Absen berhasil, alhamdulillah jazakumullahu khoiro.", \
        f"A6 FAIL: Wrong message for hadir: {mark_data.get('message')}"
    print(f"✅ A6a: Mark hadir returns correct message")
    
    # Test izin - message should be null
    resp = requests.post(f"{BASE_URL}/absensi/{akses_token}/mark",
                        json={"access": access_jwt, "user_id": user_id, "status": "izin"})
    assert resp.status_code == 200, f"A6 FAIL: Mark izin failed: {resp.status_code}"
    mark_data = resp.json()
    assert mark_data.get("message") is None, f"A6 FAIL: Message should be null for izin, got: {mark_data.get('message')}"
    print(f"✅ A6b: Mark izin returns message=null")
    
    # Test alpha - message should be null
    resp = requests.post(f"{BASE_URL}/absensi/{akses_token}/mark",
                        json={"access": access_jwt, "user_id": user_id, "status": "alpha"})
    assert resp.status_code == 200, f"A6 FAIL: Mark alpha failed: {resp.status_code}"
    mark_data = resp.json()
    assert mark_data.get("message") is None, f"A6 FAIL: Message should be null for alpha, got: {mark_data.get('message')}"
    print(f"✅ A6c: Mark alpha returns message=null")
    
    # Test invalid status
    resp = requests.post(f"{BASE_URL}/absensi/{akses_token}/mark",
                        json={"access": access_jwt, "user_id": user_id, "status": "xxx"})
    assert resp.status_code == 400, f"A6 FAIL: Invalid status should return 400, got {resp.status_code}"
    print(f"✅ A6d: Invalid status returns 400")
    
    # A7. POST /api/absensi/{token}/scan-personal
    # Test with invalid content
    resp = requests.post(f"{BASE_URL}/absensi/{akses_token}/scan-personal",
                        json={"access": access_jwt, "content": "EKP:sampah"})
    assert resp.status_code == 400, f"A7 FAIL: Invalid QR should return 400, got {resp.status_code}"
    error_msg = resp.json().get("detail", "")
    assert len(error_msg) > 0, "A7 FAIL: No error message for invalid QR"
    print(f"✅ A7: Invalid personal QR returns 400 with Indonesian error")
    
    # A8. POST /api/admin/kegiatan/{id}/access/regenerate
    resp = admin.post(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/access/regenerate")
    assert resp.status_code == 200, f"A8 FAIL: Regenerate failed: {resp.status_code}"
    regen_data = resp.json()
    new_code = regen_data["code"]
    assert new_code != access_code, f"A8 FAIL: New code same as old: {new_code}"
    assert len(new_code) == 6 and new_code.isdigit(), f"A8 FAIL: New code invalid: {new_code}"
    print(f"✅ A8a: Regenerate returns new code: {new_code}")
    
    # Verify old code doesn't work
    resp = requests.post(verify_url, json={"code": access_code})
    assert resp.status_code == 401, f"A8 FAIL: Old code should return 401, got {resp.status_code}"
    print(f"✅ A8b: Old code returns 401")
    
    # Verify new code works
    resp = requests.post(verify_url, json={"code": new_code})
    assert resp.status_code == 200, f"A8 FAIL: New code should return 200, got {resp.status_code}"
    print(f"✅ A8c: New code returns 200")
    
    # A9. POST /api/admin/kegiatan/{id}/close and verify
    resp = admin.post(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/close")
    assert resp.status_code == 200, f"A9 FAIL: Close failed: {resp.status_code}"
    print(f"✅ A9a: Close kegiatan successful")
    
    # Verify with closed kegiatan
    resp = requests.post(verify_url, json={"code": new_code})
    assert resp.status_code == 403, f"A9 FAIL: Verify closed kegiatan should return 403, got {resp.status_code}"
    error_msg = resp.json().get("detail", "")
    assert "tutup" in error_msg.lower() or "closed" in error_msg.lower(), \
        f"A9 FAIL: Error message doesn't mention closed: {error_msg}"
    print(f"✅ A9b: Verify closed kegiatan returns 403")
    
    # Reopen for further tests
    resp = admin.post(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/reopen")
    assert resp.status_code == 200, f"A9 FAIL: Reopen failed: {resp.status_code}"
    print(f"✅ A9c: Reopen kegiatan successful")
    
    # A10. Check access control - peserta should get 403, pengurus should get 200
    peserta = sessions.get("peserta") or login("peserta", PESERTA_CREDS)
    resp = peserta.get(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/access")
    assert resp.status_code == 403, f"A10 FAIL: Peserta should get 403, got {resp.status_code}"
    print(f"✅ A10a: Peserta access returns 403")
    
    pengurus = sessions.get("pengurus") or login("pengurus", PENGURUS_CREDS)
    resp = pengurus.get(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/access")
    assert resp.status_code == 200, f"A10 FAIL: Pengurus should get 200, got {resp.status_code}"
    print(f"✅ A10b: Pengurus access returns 200")
    
    return kegiatan_id

def test_b_barcode_1_month():
    """B. BARCODE KEGIATAN BERLAKU 1 BULAN"""
    print("\n" + "="*80)
    print("TEST B: BARCODE KEGIATAN BERLAKU 1 BULAN")
    print("="*80)
    
    admin = sessions["admin"]
    
    # Create kegiatan for barcode test
    today = datetime.now().strftime("%Y-%m-%d")
    kegiatan_data = {
        "name": "Uji Barcode 1 Bulan",
        "type": "rutin",
        "date": today,
        "start_time": "08:00",
        "end_time": "10:00"
    }
    resp = admin.post(f"{BASE_URL}/admin/kegiatan", json=kegiatan_data)
    assert resp.status_code == 200, f"B FAIL: Create kegiatan failed: {resp.status_code}"
    kegiatan_list = resp.json()
    kegiatan = kegiatan_list[0] if isinstance(kegiatan_list, list) else kegiatan_list
    kegiatan_id = kegiatan["id"]
    
    # B11. POST /api/admin/kegiatan/{id}/absen-qr
    resp = admin.post(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/absen-qr")
    assert resp.status_code == 200, f"B11 FAIL: Generate absen-qr failed: {resp.status_code}"
    qr_data = resp.json()
    assert "link" in qr_data, "B11 FAIL: No link in response"
    assert "image" in qr_data, "B11 FAIL: No image in response"
    assert "expires_days" in qr_data, "B11 FAIL: No expires_days in response"
    assert "expires_at" in qr_data, "B11 FAIL: No expires_at in response"
    assert qr_data["expires_days"] == 30, f"B11 FAIL: expires_days should be 30, got {qr_data['expires_days']}"
    assert "/absen/" in qr_data["link"], f"B11 FAIL: link doesn't contain /absen/: {qr_data['link']}"
    
    # Validate expires_at is approximately 30 days after end time
    expires_at = datetime.fromisoformat(qr_data["expires_at"].replace("Z", "+00:00"))
    kegiatan_end = datetime.strptime(f"{today} 10:00", "%Y-%m-%d %H:%M")
    expected_expires = kegiatan_end + timedelta(days=30)
    days_diff = abs((expires_at.replace(tzinfo=None) - expected_expires).days)
    assert days_diff <= 1, f"B11 FAIL: expires_at not ~30 days after end time, diff={days_diff} days"
    print(f"✅ B11: absen-qr returns expires_days=30, expires_at ~30 days after end time")
    
    # B12. GET /api/absen/{token} - should work (not expired)
    absen_token = qr_data["link"].split("/absen/")[1]
    resp = requests.get(f"{BASE_URL}/absen/{absen_token}")
    assert resp.status_code == 200, f"B12 FAIL: GET absen should return 200, got {resp.status_code}"
    print(f"✅ B12a: GET absen/{absen_token} returns 200 (not expired)")
    
    # Note: To test expiration, we would need to manually update MongoDB
    # This is documented in the test plan
    print(f"⚠️  B12b: Expiration test requires manual MongoDB update (see test plan)")
    
    # Cleanup
    resp = admin.delete(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}")
    print(f"✅ B: Cleanup completed")
    
    return True

def test_c_absen_manual_notif():
    """C. ABSEN MANUAL (STAFF) — NOTIF HANYA HADIR"""
    print("\n" + "="*80)
    print("TEST C: ABSEN MANUAL - NOTIF HANYA HADIR")
    print("="*80)
    
    admin = sessions["admin"]
    
    # Create kegiatan
    today = datetime.now().strftime("%Y-%m-%d")
    kegiatan_data = {
        "name": "Uji Absen Manual",
        "type": "rutin",
        "date": today,
        "start_time": "08:00",
        "end_time": "10:00"
    }
    resp = admin.post(f"{BASE_URL}/admin/kegiatan", json=kegiatan_data)
    assert resp.status_code == 200, f"C FAIL: Create kegiatan failed: {resp.status_code}"
    kegiatan_list = resp.json()
    kegiatan = kegiatan_list[0] if isinstance(kegiatan_list, list) else kegiatan_list
    kegiatan_id = kegiatan["id"]
    
    # Get a peserta user_id
    resp = admin.get(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/rekap")
    assert resp.status_code == 200, f"C FAIL: Get rekap failed: {resp.status_code}"
    rekap = resp.json()
    user_id = rekap["rows"][0]["user_id"]
    
    # C13. Test hadir - should have message
    resp = admin.post(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/absen",
                     json={"user_id": user_id, "status": "hadir"})
    assert resp.status_code == 200, f"C13 FAIL: Mark hadir failed: {resp.status_code}"
    data = resp.json()
    assert "message" in data, "C13 FAIL: No message field"
    assert data["message"] is not None and len(data["message"]) > 0, \
        f"C13 FAIL: Message should be filled for hadir, got: {data.get('message')}"
    print(f"✅ C13a: Hadir returns message: {data['message']}")
    
    # Test izin - message should be null
    resp = admin.post(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/absen",
                     json={"user_id": user_id, "status": "izin"})
    assert resp.status_code == 200, f"C13 FAIL: Mark izin failed: {resp.status_code}"
    data = resp.json()
    assert data.get("message") is None, f"C13 FAIL: Message should be null for izin, got: {data.get('message')}"
    print(f"✅ C13b: Izin returns message=null")
    
    # Test alpha - message should be null
    resp = admin.post(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/absen",
                     json={"user_id": user_id, "status": "alpha"})
    assert resp.status_code == 200, f"C13 FAIL: Mark alpha failed: {resp.status_code}"
    data = resp.json()
    assert data.get("message") is None, f"C13 FAIL: Message should be null for alpha, got: {data.get('message')}"
    print(f"✅ C13c: Alpha returns message=null")
    
    # Cleanup
    resp = admin.delete(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}")
    print(f"✅ C: Cleanup completed")
    
    return True

def test_d_laporan_no_top():
    """D. LAPORAN TANPA TOP RAJIN/ALPHA + TEMPLATE WA"""
    print("\n" + "="*80)
    print("TEST D: LAPORAN TANPA TOP RAJIN/ALPHA + TEMPLATE WA")
    print("="*80)
    
    admin = sessions["admin"]
    
    # D14. GET /api/admin/laporan
    today = datetime.now()
    date_from = (today - timedelta(days=7)).strftime("%Y-%m-%d")
    date_to = today.strftime("%Y-%m-%d")
    
    resp = admin.get(f"{BASE_URL}/admin/laporan", params={"date_from": date_from, "date_to": date_to})
    assert resp.status_code == 200, f"D14 FAIL: GET laporan failed: {resp.status_code}"
    laporan = resp.json()
    
    # Check that top_rajin and top_alpha are NOT present
    assert "top_rajin" not in laporan, f"D14 FAIL: top_rajin should not be in response"
    assert "top_alpha" not in laporan, f"D14 FAIL: top_alpha should not be in response"
    
    # Check required fields are present
    assert "summary" in laporan, "D14 FAIL: No summary in response"
    assert "per_kegiatan" in laporan, "D14 FAIL: No per_kegiatan in response"
    assert "per_peserta" in laporan, "D14 FAIL: No per_peserta in response"
    assert "gender_hadir" in laporan, "D14 FAIL: No gender_hadir in response"
    print(f"✅ D14: GET laporan has no top_rajin/top_alpha, has required fields")
    
    # D15. POST /api/admin/laporan/share
    resp = admin.post(f"{BASE_URL}/admin/laporan/share",
                     json={"date_from": date_from, "date_to": date_to, "mode": "harian"})
    assert resp.status_code == 200, f"D15 FAIL: Share laporan failed: {resp.status_code}"
    share_data = resp.json()
    assert "wa_text" in share_data, "D15 FAIL: No wa_text in response"
    
    # Check exact format
    wa_text = share_data["wa_text"]
    expected_start = "Assalamu'alaikum warahmatullahi wabarakatuh\n\nBerikut laporan kehadiran harian\n"
    expected_end = "\n\nAlhamdulillah, jazakumullahu khoiro."
    assert wa_text.startswith(expected_start), \
        f"D15 FAIL: wa_text doesn't start correctly. Got: {wa_text[:100]}"
    assert wa_text.endswith(expected_end), \
        f"D15 FAIL: wa_text doesn't end correctly. Got: {wa_text[-100:]}"
    # Check no duplicate "laporan laporan"
    assert "laporan laporan" not in wa_text.lower(), \
        f"D15 FAIL: wa_text contains duplicate 'laporan laporan'"
    print(f"✅ D15a: Share laporan returns correct wa_text format")
    
    # Get token and verify public laporan also has no top_rajin/top_alpha
    token = share_data.get("token")
    if token:
        resp = requests.get(f"{BASE_URL}/laporan/{token}")
        assert resp.status_code == 200, f"D15 FAIL: GET public laporan failed: {resp.status_code}"
        public_laporan = resp.json()
        assert "top_rajin" not in public_laporan, f"D15 FAIL: Public laporan has top_rajin"
        assert "top_alpha" not in public_laporan, f"D15 FAIL: Public laporan has top_alpha"
        print(f"✅ D15b: Public laporan also has no top_rajin/top_alpha")
    
    # D16. GET /api/admin/kegiatan/{id}/qr - check wa_text exists
    # Create a kegiatan first
    today_str = datetime.now().strftime("%Y-%m-%d")
    kegiatan_data = {
        "name": "Uji WA Text",
        "type": "rutin",
        "date": today_str,
        "start_time": "08:00",
        "end_time": "10:00"
    }
    resp = admin.post(f"{BASE_URL}/admin/kegiatan", json=kegiatan_data)
    assert resp.status_code == 200, f"D16 FAIL: Create kegiatan failed: {resp.status_code}"
    kegiatan_list = resp.json()
    kegiatan = kegiatan_list[0] if isinstance(kegiatan_list, list) else kegiatan_list
    kegiatan_id = kegiatan["id"]
    
    resp = admin.get(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/qr")
    assert resp.status_code == 200, f"D16 FAIL: GET qr failed: {resp.status_code}"
    qr_data = resp.json()
    assert "wa_text" in qr_data, "D16 FAIL: No wa_text in qr response"
    print(f"✅ D16: GET kegiatan qr has wa_text")
    
    # Cleanup
    resp = admin.delete(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}")
    print(f"✅ D: Cleanup completed")
    
    return True

def test_e_admin_is_system():
    """E. AKUN ADMIN = AKUN SISTEM"""
    print("\n" + "="*80)
    print("TEST E: AKUN ADMIN = AKUN SISTEM")
    print("="*80)
    
    admin = sessions["admin"]
    
    # E17. GET /api/admin/users - should NOT include admin
    resp = admin.get(f"{BASE_URL}/admin/users")
    assert resp.status_code == 200, f"E17 FAIL: GET users failed: {resp.status_code}"
    users = resp.json()
    
    # Check admin is not in list
    admin_in_list = any(u.get("email") == "ageng.rider@gmail.com" for u in users)
    assert not admin_in_list, "E17 FAIL: Admin found in default user list"
    print(f"✅ E17a: GET users (default) does not include admin")
    
    # GET with include_system=true - should include admin
    resp = admin.get(f"{BASE_URL}/admin/users", params={"include_system": "true"})
    assert resp.status_code == 200, f"E17 FAIL: GET users with include_system failed: {resp.status_code}"
    users_with_system = resp.json()
    
    admin_user = next((u for u in users_with_system if u.get("email") == "ageng.rider@gmail.com"), None)
    assert admin_user is not None, "E17 FAIL: Admin not found with include_system=true"
    assert admin_user.get("is_system") == True, f"E17 FAIL: Admin is_system should be True, got {admin_user.get('is_system')}"
    print(f"✅ E17b: GET users with include_system=true includes admin with is_system=true")
    
    # E18. GET /api/admin/kegiatan/{id}/rekap - admin should not be in rows
    # Create kegiatan
    today = datetime.now().strftime("%Y-%m-%d")
    kegiatan_data = {
        "name": "Uji System Account",
        "type": "rutin",
        "date": today,
        "start_time": "08:00",
        "end_time": "10:00"
    }
    resp = admin.post(f"{BASE_URL}/admin/kegiatan", json=kegiatan_data)
    assert resp.status_code == 200, f"E18 FAIL: Create kegiatan failed: {resp.status_code}"
    kegiatan_list = resp.json()
    kegiatan = kegiatan_list[0] if isinstance(kegiatan_list, list) else kegiatan_list
    kegiatan_id = kegiatan["id"]
    
    resp = admin.get(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/rekap")
    assert resp.status_code == 200, f"E18 FAIL: GET rekap failed: {resp.status_code}"
    rekap = resp.json()
    
    # Check admin not in rows
    admin_in_rows = any(r.get("email") == "ageng.rider@gmail.com" for r in rekap["rows"])
    assert not admin_in_rows, "E18 FAIL: Admin found in rekap rows"
    
    # Check counts.total matches non-system peserta count
    total_peserta = len([u for u in users if "peserta" in u.get("roles", [])])
    assert rekap["counts"]["total"] == total_peserta, \
        f"E18 FAIL: counts.total ({rekap['counts']['total']}) != non-system peserta count ({total_peserta})"
    print(f"✅ E18: GET rekap does not include admin, counts.total matches non-system peserta")
    
    # E19. GET /api/staff/kegiatan/{id}/reminder - admin should not be in recipients
    resp = admin.get(f"{BASE_URL}/staff/kegiatan/{kegiatan_id}/reminder")
    assert resp.status_code == 200, f"E19 FAIL: GET reminder failed: {resp.status_code}"
    reminder = resp.json()
    
    admin_in_recipients = any(r.get("email") == "ageng.rider@gmail.com" for r in reminder.get("recipients", []))
    assert not admin_in_recipients, "E19 FAIL: Admin found in reminder recipients"
    print(f"✅ E19: GET reminder does not include admin in recipients")
    
    # E20. GET /api/admin/dashboard - should not error
    resp = admin.get(f"{BASE_URL}/admin/dashboard")
    assert resp.status_code == 200, f"E20 FAIL: GET dashboard failed: {resp.status_code}"
    dashboard = resp.json()
    assert "total_peserta" in dashboard, "E20 FAIL: No total_peserta in dashboard"
    print(f"✅ E20: GET dashboard returns 200 with total_peserta")
    
    # Cleanup
    resp = admin.delete(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}")
    print(f"✅ E: Cleanup completed")
    
    return True

def test_f_kelompok_bali():
    """F. KELOMPOK SAMBUNG BALI & LUAR BALI"""
    print("\n" + "="*80)
    print("TEST F: KELOMPOK SAMBUNG BALI & LUAR BALI")
    print("="*80)
    
    admin = sessions["admin"]
    
    # F21. GET /api/admin/kelompok - should have Bali and Luar Bali
    resp = admin.get(f"{BASE_URL}/admin/kelompok")
    assert resp.status_code == 200, f"F21 FAIL: GET kelompok failed: {resp.status_code}"
    kelompok_list = resp.json()
    
    kelompok_names = [k["name"] for k in kelompok_list]
    assert "Bali" in kelompok_names, f"F21 FAIL: 'Bali' not found in kelompok list: {kelompok_names}"
    assert "Luar Bali" in kelompok_names, f"F21 FAIL: 'Luar Bali' not found in kelompok list: {kelompok_names}"
    
    # Check old kelompok are gone
    old_names = ["Majelis Pusat", "Kelompok Timur", "Kelompok Barat", "Kelompok Selatan"]
    for old_name in old_names:
        assert old_name not in kelompok_names, f"F21 FAIL: Old kelompok '{old_name}' still exists"
    print(f"✅ F21: Kelompok list has 'Bali' and 'Luar Bali', old kelompok removed")
    
    # F22. Create and delete kelompok with keterangan
    resp = admin.post(f"{BASE_URL}/admin/kelompok", json={"name": "Uji Hapus"})
    assert resp.status_code == 200, f"F22 FAIL: Create kelompok failed: {resp.status_code}"
    new_kelompok = resp.json()
    kelompok_id = new_kelompok["id"]
    print(f"✅ F22a: Created test kelompok")
    
    # Delete with keterangan
    resp = admin.delete(f"{BASE_URL}/admin/kelompok/{kelompok_id}",
                       params={"keterangan": "uji fase 7"})
    assert resp.status_code == 200, f"F22 FAIL: Delete kelompok failed: {resp.status_code}"
    delete_data = resp.json()
    assert "message" in delete_data, "F22 FAIL: No message in delete response"
    assert "affected" in delete_data, "F22 FAIL: No affected in delete response"
    assert "keterangan" in delete_data, "F22 FAIL: No keterangan in delete response"
    assert delete_data["keterangan"] == "uji fase 7", \
        f"F22 FAIL: Wrong keterangan: {delete_data['keterangan']}"
    print(f"✅ F22b: Delete kelompok returns message, affected, keterangan")
    
    # Verify kelompok is gone
    resp = admin.get(f"{BASE_URL}/admin/kelompok")
    assert resp.status_code == 200, f"F22 FAIL: GET kelompok failed: {resp.status_code}"
    kelompok_list = resp.json()
    deleted_exists = any(k["id"] == kelompok_id for k in kelompok_list)
    assert not deleted_exists, "F22 FAIL: Deleted kelompok still exists"
    print(f"✅ F22c: Deleted kelompok no longer in list")
    
    # F23. Test pengurus cannot delete kelompok
    # Create another test kelompok
    resp = admin.post(f"{BASE_URL}/admin/kelompok", json={"name": "Uji Pengurus"})
    assert resp.status_code == 200, f"F23 FAIL: Create kelompok failed: {resp.status_code}"
    test_kelompok = resp.json()
    test_id = test_kelompok["id"]
    
    pengurus = sessions.get("pengurus") or login("pengurus", PENGURUS_CREDS)
    resp = pengurus.delete(f"{BASE_URL}/admin/kelompok/{test_id}",
                          params={"keterangan": "test"})
    assert resp.status_code == 403, f"F23 FAIL: Pengurus should get 403, got {resp.status_code}"
    print(f"✅ F23: Pengurus cannot delete kelompok (403)")
    
    # Cleanup - admin deletes test kelompok
    resp = admin.delete(f"{BASE_URL}/admin/kelompok/{test_id}",
                       params={"keterangan": "cleanup"})
    print(f"✅ F: Cleanup completed")
    
    return True

def test_g_regression():
    """G. REGRESI SINGKAT"""
    print("\n" + "="*80)
    print("TEST G: REGRESI SINGKAT")
    print("="*80)
    
    # G24. Test login and basic endpoints for all roles
    # Admin
    admin = sessions.get("admin")
    if not admin:
        admin = login("admin", ADMIN_CREDS)
    
    resp = admin.get(f"{BASE_URL}/auth/me")
    assert resp.status_code == 200, f"G24 FAIL: Admin /auth/me failed: {resp.status_code}"
    print(f"✅ G24a: Admin /auth/me returns 200")
    
    resp = admin.get(f"{BASE_URL}/admin/kegiatan")
    assert resp.status_code == 200, f"G24 FAIL: Admin /admin/kegiatan failed: {resp.status_code}"
    print(f"✅ G24b: Admin /admin/kegiatan returns 200")
    
    # Pengurus
    pengurus = sessions.get("pengurus")
    if not pengurus:
        pengurus = login("pengurus", PENGURUS_CREDS)
    
    resp = pengurus.get(f"{BASE_URL}/auth/me")
    assert resp.status_code == 200, f"G24 FAIL: Pengurus /auth/me failed: {resp.status_code}"
    print(f"✅ G24c: Pengurus /auth/me returns 200")
    
    # Peserta
    peserta = sessions.get("peserta")
    if not peserta:
        peserta = login("peserta", PESERTA_CREDS)
    
    resp = peserta.get(f"{BASE_URL}/auth/me")
    assert resp.status_code == 200, f"G24 FAIL: Peserta /auth/me failed: {resp.status_code}"
    print(f"✅ G24d: Peserta /auth/me returns 200")
    
    resp = peserta.get(f"{BASE_URL}/me/dashboard")
    assert resp.status_code == 200, f"G24 FAIL: Peserta /me/dashboard failed: {resp.status_code}"
    print(f"✅ G24e: Peserta /me/dashboard returns 200")
    
    resp = peserta.get(f"{BASE_URL}/me/kegiatan")
    assert resp.status_code == 200, f"G24 FAIL: Peserta /me/kegiatan failed: {resp.status_code}"
    print(f"✅ G24f: Peserta /me/kegiatan returns 200")
    
    return True

def cleanup_test_data():
    """Clean up all test data"""
    print("\n" + "="*80)
    print("CLEANUP: Removing test data")
    print("="*80)
    
    admin = sessions["admin"]
    
    # Delete test kegiatan
    resp = admin.get(f"{BASE_URL}/admin/kegiatan")
    if resp.status_code == 200:
        kegiatan_list = resp.json()
        test_names = ["Uji Fase 7", "Uji Barcode 1 Bulan", "Uji Absen Manual", 
                     "Uji WA Text", "Uji System Account"]
        for k in kegiatan_list:
            if k.get("name") in test_names:
                resp = admin.delete(f"{BASE_URL}/admin/kegiatan/{k['id']}")
                if resp.status_code == 200:
                    print(f"✅ Deleted kegiatan: {k['name']}")
    
    # Delete pending test users
    resp = admin.get(f"{BASE_URL}/admin/users", params={"include_system": "true"})
    if resp.status_code == 200:
        users = resp.json()
        for u in users:
            if u.get("name") == "Peserta Pending Uji" and u.get("status") == "pending":
                resp = admin.delete(f"{BASE_URL}/admin/users/{u['id']}")
                if resp.status_code == 200:
                    print(f"✅ Deleted pending user: {u['name']}")
    
    print(f"✅ Cleanup completed")

def main():
    """Run all FASE 7 tests"""
    print("\n" + "="*80)
    print("FASE 7 BACKEND TESTING - E-KERTALANGU")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Testing with HTTPS preview URL for secure cookies")
    print("="*80)
    
    try:
        # Login all roles
        login("admin", ADMIN_CREDS)
        login("pengurus", PENGURUS_CREDS)
        login("peserta", PESERTA_CREDS)
        
        # Run tests
        test_a_share_kegiatan_kode_akses()
        test_b_barcode_1_month()
        test_c_absen_manual_notif()
        test_d_laporan_no_top()
        test_e_admin_is_system()
        test_f_kelompok_bali()
        test_g_regression()
        
        # Cleanup
        cleanup_test_data()
        
        print("\n" + "="*80)
        print("✅✅✅ ALL FASE 7 TESTS PASSED ✅✅✅")
        print("="*80)
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        raise
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        raise

if __name__ == "__main__":
    main()
