#!/usr/bin/env python3
"""
E-KERTALANGU Fase 3A Testing
Test require_staff (admin OR pengurus) vs admin-only endpoints + feedback wording
"""
import requests
import sys
import os

# Base URL - read from frontend .env or use localhost
def get_backend_url():
    # Try to read from frontend .env
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    return "http://localhost:8001"

BACKEND_URL = get_backend_url()
BASE_URL = f"{BACKEND_URL}/api"

# Test credentials
ADMIN_CREDS = {"identifier": "admin", "password": "jokam354"}
PENGURUS_CREDS = {"identifier": "pengurus", "password": "Pengurus#2026"}
PESERTA_CREDS = {"identifier": "peserta", "password": "Peserta#2026"}

# Test state
test_kegiatan_id = None
test_absen_token = None
test_peserta_id = None

def login(creds):
    """Login and return session with cookies"""
    s = requests.Session()
    r = s.post(f"{BASE_URL}/auth/login", json=creds)
    if r.status_code != 200:
        print(f"❌ Login failed for {creds['identifier']}: {r.status_code} {r.text}")
        return None
    print(f"✅ Login successful for {creds['identifier']}")
    return s

def test_pengurus_can_access():
    """Test 1: PENGURUS can access staff endpoints (should return 200)"""
    print("\n" + "="*80)
    print("TEST 1: PENGURUS CAN ACCESS STAFF ENDPOINTS")
    print("="*80)
    
    global test_kegiatan_id, test_absen_token, test_peserta_id
    
    s = login(PENGURUS_CREDS)
    if not s:
        return False
    
    all_passed = True
    
    # 1.1 GET /admin/dashboard
    print("\n1.1 GET /admin/dashboard")
    r = s.get(f"{BASE_URL}/admin/dashboard")
    if r.status_code == 200:
        data = r.json()
        required_fields = ["total_peserta", "peserta_L", "peserta_P", "akun_aktif", 
                          "akun_nonaktif", "kegiatan_bulan_ini", "rasio_kehadiran_bulan"]
        missing = [f for f in required_fields if f not in data]
        if missing:
            print(f"❌ FAIL: Missing fields: {missing}")
            all_passed = False
        else:
            print(f"✅ PASS: 200, all stats fields present")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 1.2 GET /admin/kegiatan?month=YYYY-MM
    print("\n1.2 GET /admin/kegiatan?month=YYYY-MM")
    from datetime import datetime
    current_month = datetime.now().strftime("%Y-%m")
    r = s.get(f"{BASE_URL}/admin/kegiatan", params={"month": current_month})
    if r.status_code == 200:
        print(f"✅ PASS: 200, returned {len(r.json())} kegiatan")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 1.3 GET /admin/users
    print("\n1.3 GET /admin/users")
    r = s.get(f"{BASE_URL}/admin/users")
    if r.status_code == 200:
        users = r.json()
        print(f"✅ PASS: 200, returned {len(users)} users")
        # Find a peserta for later tests
        for u in users:
            if "peserta" in u.get("roles", []):
                test_peserta_id = u["id"]
                print(f"   Found peserta: {u['name']} (id: {test_peserta_id})")
                break
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 1.4 GET /admin/laporan
    print("\n1.4 GET /admin/laporan")
    r = s.get(f"{BASE_URL}/admin/laporan")
    if r.status_code == 200:
        print(f"✅ PASS: 200")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 1.5 GET /admin/kelompok
    print("\n1.5 GET /admin/kelompok")
    r = s.get(f"{BASE_URL}/admin/kelompok")
    if r.status_code == 200:
        print(f"✅ PASS: 200, returned {len(r.json())} kelompok")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 1.6 POST /admin/kegiatan (create test kegiatan)
    print("\n1.6 POST /admin/kegiatan")
    kegiatan_data = {
        "name": "Uji Pengurus",
        "type": "rutin",
        "date": "2026-12-05",
        "start_time": "19:00",
        "end_time": "20:30",
        "teacher": "Ust. Test",
        "material": "Materi Uji",
        "location": "Masjid",
        "recurring": False
    }
    r = s.post(f"{BASE_URL}/admin/kegiatan", json=kegiatan_data)
    if r.status_code == 200:
        result = r.json()
        # POST returns a list, even for single kegiatan
        if isinstance(result, list) and len(result) > 0:
            test_kegiatan_id = result[0]["id"]
            print(f"✅ PASS: 200, created kegiatan id: {test_kegiatan_id}")
        else:
            print(f"❌ FAIL: Unexpected response format: {result}")
            all_passed = False
            return all_passed
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
        return all_passed
    
    # 1.7 POST /admin/kegiatan/{id}/absen (mark attendance)
    if test_peserta_id and test_kegiatan_id:
        print("\n1.7 POST /admin/kegiatan/{id}/absen")
        absen_data = {"user_id": test_peserta_id, "status": "hadir"}
        r = s.post(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_id}/absen", json=absen_data)
        if r.status_code == 200:
            print(f"✅ PASS: 200, marked attendance for peserta")
        else:
            print(f"❌ FAIL: {r.status_code} {r.text}")
            all_passed = False
    
    # 1.8 GET /admin/kegiatan/{id}/rekap
    if test_kegiatan_id:
        print("\n1.8 GET /admin/kegiatan/{id}/rekap")
        r = s.get(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_id}/rekap")
        if r.status_code == 200:
            print(f"✅ PASS: 200")
        else:
            print(f"❌ FAIL: {r.status_code} {r.text}")
            all_passed = False
    
    # 1.9 POST /admin/kegiatan/{id}/absen-qr
    if test_kegiatan_id:
        print("\n1.9 POST /admin/kegiatan/{id}/absen-qr")
        r = s.post(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_id}/absen-qr")
        if r.status_code == 200:
            data = r.json()
            test_absen_token = data.get("token")
            print(f"✅ PASS: 200, token: {test_absen_token}")
        else:
            print(f"❌ FAIL: {r.status_code} {r.text}")
            all_passed = False
    
    # 1.10 GET /admin/kegiatan/{id}/feedback
    if test_kegiatan_id:
        print("\n1.10 GET /admin/kegiatan/{id}/feedback")
        r = s.get(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_id}/feedback")
        if r.status_code == 200:
            print(f"✅ PASS: 200")
        else:
            print(f"❌ FAIL: {r.status_code} {r.text}")
            all_passed = False
    
    # 1.11 POST /admin/users/{id}/move
    if test_peserta_id:
        print("\n1.11 POST /admin/users/{id}/move")
        move_data = {"kelompok_id": None, "keterangan": "uji pengurus"}
        r = s.post(f"{BASE_URL}/admin/users/{test_peserta_id}/move", json=move_data)
        if r.status_code == 200:
            print(f"✅ PASS: 200")
        else:
            print(f"❌ FAIL: {r.status_code} {r.text}")
            all_passed = False
    
    return all_passed

def test_pengurus_forbidden():
    """Test 2: PENGURUS forbidden from admin-only endpoints (should return 403)"""
    print("\n" + "="*80)
    print("TEST 2: PENGURUS FORBIDDEN FROM ADMIN-ONLY ENDPOINTS")
    print("="*80)
    
    s = login(PENGURUS_CREDS)
    if not s:
        return False
    
    all_passed = True
    
    # Get a user ID for testing (use test_peserta_id if available)
    if not test_peserta_id:
        r = s.get(f"{BASE_URL}/admin/users")
        if r.status_code == 200:
            users = r.json()
            if users:
                test_user_id = users[0]["id"]
            else:
                print("❌ No users found for testing")
                return False
        else:
            print(f"❌ Cannot get users: {r.status_code}")
            return False
    else:
        test_user_id = test_peserta_id
    
    # 2.1 DELETE /admin/users/{id}
    print("\n2.1 DELETE /admin/users/{id}")
    r = s.delete(f"{BASE_URL}/admin/users/{test_user_id}")
    if r.status_code == 403:
        print(f"✅ PASS: 403 (correctly forbidden)")
    else:
        print(f"❌ FAIL: Expected 403, got {r.status_code} {r.text}")
        all_passed = False
    
    # 2.2 PATCH /admin/users/{id}/roles
    print("\n2.2 PATCH /admin/users/{id}/roles")
    r = s.patch(f"{BASE_URL}/admin/users/{test_user_id}/roles", json={"roles": ["peserta"]})
    if r.status_code == 403:
        print(f"✅ PASS: 403 (correctly forbidden)")
    else:
        print(f"❌ FAIL: Expected 403, got {r.status_code} {r.text}")
        all_passed = False
    
    # 2.3 POST /admin/kelompok
    print("\n2.3 POST /admin/kelompok")
    r = s.post(f"{BASE_URL}/admin/kelompok", json={"name": "Kelompok Terlarang Pengurus"})
    if r.status_code == 403:
        print(f"✅ PASS: 403 (correctly forbidden)")
    else:
        print(f"❌ FAIL: Expected 403, got {r.status_code} {r.text}")
        all_passed = False
    
    # 2.4 POST /admin/users/bulk-delete
    print("\n2.4 POST /admin/users/bulk-delete")
    r = s.post(f"{BASE_URL}/admin/users/bulk-delete", json={"ids": ["dummy-id"]})
    if r.status_code == 403:
        print(f"✅ PASS: 403 (correctly forbidden)")
    else:
        print(f"❌ FAIL: Expected 403, got {r.status_code} {r.text}")
        all_passed = False
    
    return all_passed

def test_admin_regression():
    """Test 3: ADMIN can still access everything (regression test)"""
    print("\n" + "="*80)
    print("TEST 3: ADMIN REGRESSION (should still have full access)")
    print("="*80)
    
    s = login(ADMIN_CREDS)
    if not s:
        return False
    
    all_passed = True
    
    # 3.1 GET /admin/dashboard
    print("\n3.1 GET /admin/dashboard")
    r = s.get(f"{BASE_URL}/admin/dashboard")
    if r.status_code == 200:
        print(f"✅ PASS: 200")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 3.2 GET /admin/users
    print("\n3.2 GET /admin/users")
    r = s.get(f"{BASE_URL}/admin/users")
    if r.status_code == 200:
        print(f"✅ PASS: 200")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 3.3 POST /admin/kelompok (admin-only endpoint)
    print("\n3.3 POST /admin/kelompok")
    r = s.post(f"{BASE_URL}/admin/kelompok", json={"name": "Kelompok Admin Uji"})
    if r.status_code == 200:
        kelompok_id = r.json()["id"]
        print(f"✅ PASS: 200, created kelompok id: {kelompok_id}")
        # Note: Not deleting as per instructions (boleh diabaikan / tidak wajib hapus)
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    return all_passed

def test_peserta_forbidden():
    """Test 4: PESERTA forbidden from all admin endpoints (should return 403)"""
    print("\n" + "="*80)
    print("TEST 4: PESERTA FORBIDDEN FROM ALL ADMIN ENDPOINTS")
    print("="*80)
    
    s = login(PESERTA_CREDS)
    if not s:
        return False
    
    all_passed = True
    
    # 4.1 GET /admin/dashboard
    print("\n4.1 GET /admin/dashboard")
    r = s.get(f"{BASE_URL}/admin/dashboard")
    if r.status_code == 403:
        print(f"✅ PASS: 403 (correctly forbidden)")
    else:
        print(f"❌ FAIL: Expected 403, got {r.status_code} {r.text}")
        all_passed = False
    
    # 4.2 GET /admin/kegiatan
    print("\n4.2 GET /admin/kegiatan")
    r = s.get(f"{BASE_URL}/admin/kegiatan")
    if r.status_code == 403:
        print(f"✅ PASS: 403 (correctly forbidden)")
    else:
        print(f"❌ FAIL: Expected 403, got {r.status_code} {r.text}")
        all_passed = False
    
    # 4.3 GET /admin/users
    print("\n4.3 GET /admin/users")
    r = s.get(f"{BASE_URL}/admin/users")
    if r.status_code == 403:
        print(f"✅ PASS: 403 (correctly forbidden)")
    else:
        print(f"❌ FAIL: Expected 403, got {r.status_code} {r.text}")
        all_passed = False
    
    return all_passed

def test_feedback_wording():
    """Test 5: Feedback wording verification"""
    print("\n" + "="*80)
    print("TEST 5: FEEDBACK WORDING VERIFICATION")
    print("="*80)
    
    if not test_absen_token:
        print("❌ SKIP: No absen token available (test 1 may have failed)")
        return False
    
    all_passed = True
    
    # 5.1 GET /absen/{token} (public, verify token works)
    print("\n5.1 GET /absen/{token} (public verification)")
    r = requests.get(f"{BASE_URL}/absen/{test_absen_token}")
    if r.status_code == 200:
        print(f"✅ PASS: 200, public absen endpoint accessible")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 5.2 POST /absen/{token}/feedback
    print("\n5.2 POST /absen/{token}/feedback")
    feedback_data = {"message": "mantap"}
    r = requests.post(f"{BASE_URL}/absen/{test_absen_token}/feedback", json=feedback_data)
    if r.status_code == 200:
        response_msg = r.json().get("message", "")
        expected_msg = "Alhamdulillah, jazakumullahu khoiro."
        if response_msg == expected_msg:
            print(f"✅ PASS: 200, correct wording: '{response_msg}'")
        else:
            print(f"❌ FAIL: Wrong message. Expected: '{expected_msg}', Got: '{response_msg}'")
            all_passed = False
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    return all_passed

def test_cleanup():
    """Test 6: Cleanup - delete test kegiatan"""
    print("\n" + "="*80)
    print("TEST 6: CLEANUP")
    print("="*80)
    
    if not test_kegiatan_id:
        print("ℹ️  No test kegiatan to cleanup")
        return True
    
    # Try with pengurus first (should work with require_staff)
    print("\n6.1 DELETE /admin/kegiatan/{id} (using pengurus)")
    s = login(PENGURUS_CREDS)
    if s:
        r = s.delete(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_id}")
        if r.status_code == 200:
            print(f"✅ PASS: 200, deleted kegiatan 'Uji Pengurus'")
            return True
        else:
            print(f"⚠️  Pengurus delete failed: {r.status_code}, trying with admin...")
    
    # Fallback to admin
    print("\n6.2 DELETE /admin/kegiatan/{id} (using admin)")
    s = login(ADMIN_CREDS)
    if s:
        r = s.delete(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_id}")
        if r.status_code == 200:
            print(f"✅ PASS: 200, deleted kegiatan 'Uji Pengurus'")
            return True
        else:
            print(f"❌ FAIL: {r.status_code} {r.text}")
            return False
    
    return False

def main():
    print("="*80)
    print("E-KERTALANGU FASE 3A TESTING")
    print("Testing require_staff (admin OR pengurus) vs admin-only endpoints")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    
    results = {
        "Test 1: Pengurus Can Access": test_pengurus_can_access(),
        "Test 2: Pengurus Forbidden": test_pengurus_forbidden(),
        "Test 3: Admin Regression": test_admin_regression(),
        "Test 4: Peserta Forbidden": test_peserta_forbidden(),
        "Test 5: Feedback Wording": test_feedback_wording(),
        "Test 6: Cleanup": test_cleanup(),
    }
    
    print("\n" + "="*80)
    print("FINAL RESULTS")
    print("="*80)
    
    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    all_passed = all(results.values())
    print("\n" + "="*80)
    if all_passed:
        print("✅ ALL TESTS PASSED")
        print("="*80)
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        print("="*80)
        return 1

if __name__ == "__main__":
    sys.exit(main())
