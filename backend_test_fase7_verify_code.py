#!/usr/bin/env python3
"""
FASE 7 E-KERTALANGU — Test POST /api/absensi/verify-code (Absen dengan Kode)

Endpoint publik baru untuk mencari kegiatan dari 6 digit kode akses tanpa perlu login.
PENTING: Rate limit 10 percobaan GAGAL / 15 menit / IP -> JANGAN coba kode salah > 3x.
"""
import os
import sys
import requests
from datetime import datetime, timezone, timedelta

# Base URL dari frontend/.env
BASE_URL = "https://github-absen-preview.preview.emergentagent.com/api"

# Kredensial admin
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "jokam354"

# Session untuk menyimpan cookies
admin_session = requests.Session()

def log(msg):
    print(f"[TEST] {msg}")

def get_wita_today():
    """Dapatkan tanggal hari ini dalam WITA (UTC+8)"""
    wita_tz = timezone(timedelta(hours=8))
    now_wita = datetime.now(wita_tz)
    return now_wita.strftime("%Y-%m-%d")

def test_admin_login():
    """Test 1: Login admin untuk membuat kegiatan uji"""
    log("Test 1: Login admin...")
    resp = admin_session.post(f"{BASE_URL}/auth/login", json={
        "identifier": ADMIN_IDENTIFIER,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Login gagal: {resp.status_code} {resp.text}"
    data = resp.json()
    assert "name" in data, "Response tidak memuat name"
    log(f"✅ Login admin berhasil: {data.get('name')}")
    return data

def test_create_kegiatan():
    """Test 2: Buat kegiatan dengan tanggal WITA hari ini (05:00-23:30) agar tetap open"""
    log("Test 2: Membuat kegiatan uji dengan tanggal WITA hari ini...")
    today_wita = get_wita_today()
    log(f"   Tanggal WITA hari ini: {today_wita}")
    
    resp = admin_session.post(f"{BASE_URL}/admin/kegiatan", json={
        "name": "Uji Kode Fase 7",
        "type": "rutin",
        "date": today_wita,
        "start_time": "05:00",
        "end_time": "23:30",
        "teacher": "Pengajar Uji",
        "material": "Materi Uji",
        "location": "Lokasi Uji",
        "recurring": False
    })
    assert resp.status_code == 200, f"Buat kegiatan gagal: {resp.status_code} {resp.text}"
    data = resp.json()
    
    # Response bisa berupa list (recurring) atau single object
    if isinstance(data, list):
        kegiatan = data[0]
    else:
        kegiatan = data
    
    kegiatan_id = kegiatan.get("id")
    access_code = kegiatan.get("access_code")
    
    assert kegiatan_id, "Kegiatan tidak memiliki id"
    assert access_code, "Kegiatan tidak memiliki access_code"
    assert len(str(access_code)) == 6, f"access_code bukan 6 digit: {access_code}"
    assert str(access_code).isdigit(), f"access_code bukan angka: {access_code}"
    
    log(f"✅ Kegiatan dibuat: id={kegiatan_id}, access_code={access_code}")
    return kegiatan_id, access_code

def test_verify_code_success(access_code):
    """Test 3: POST /api/absensi/verify-code dengan kode benar (TANPA login) -> 200"""
    log(f"Test 3: Verify code dengan kode benar '{access_code}' (tanpa login)...")
    
    # Gunakan session baru tanpa cookies untuk memastikan endpoint publik
    public_session = requests.Session()
    resp = public_session.post(f"{BASE_URL}/absensi/verify-code", json={
        "code": access_code
    })
    
    assert resp.status_code == 200, f"Verify code gagal: {resp.status_code} {resp.text}"
    data = resp.json()
    
    # Validasi struktur response
    assert "token" in data, "Response tidak memuat token"
    assert "access" in data, "Response tidak memuat access (JWT)"
    assert "link" in data, "Response tidak memuat link"
    assert "kegiatan" in data, "Response tidak memuat kegiatan"
    assert "counts" in data, "Response tidak memuat counts"
    assert "rows" in data, "Response tidak memuat rows"
    
    # Validasi link berakhiran /absensi/{token}
    token = data["token"]
    assert data["link"].endswith(f"/absensi/{token}"), f"Link tidak berakhiran /absensi/{token}"
    
    # Validasi kegiatan
    kegiatan = data["kegiatan"]
    assert kegiatan.get("name") == "Uji Kode Fase 7", f"Nama kegiatan tidak sesuai: {kegiatan.get('name')}"
    
    # Validasi rows TIDAK memuat akun admin (is_system=True)
    rows = data["rows"]
    admin_email = "ageng.rider@gmail.com"
    admin_in_rows = any(row.get("email") == admin_email for row in rows)
    assert not admin_in_rows, f"Akun admin ({admin_email}) masih ada di rows (seharusnya tidak ada)"
    
    log(f"✅ Verify code berhasil: token={token[:20]}..., access={data['access'][:30]}..., rows={len(rows)} peserta (tanpa admin)")
    return token, data["access"], rows

def test_get_absensi_with_access(token, access):
    """Test 4: GET /api/absensi/{token}?access=... -> 200"""
    log(f"Test 4: GET /api/absensi/{token} dengan access JWT...")
    
    public_session = requests.Session()
    resp = public_session.get(f"{BASE_URL}/absensi/{token}", params={"access": access})
    
    assert resp.status_code == 200, f"GET absensi gagal: {resp.status_code} {resp.text}"
    data = resp.json()
    
    assert "kegiatan" in data, "Response tidak memuat kegiatan"
    assert "counts" in data, "Response tidak memuat counts"
    assert "rows" in data, "Response tidak memuat rows"
    
    log(f"✅ GET absensi berhasil: {len(data['rows'])} peserta")
    return data

def test_mark_absensi_hadir(token, access, rows):
    """Test 5: POST /api/absensi/{token}/mark dengan status 'hadir' -> message berisi 'Absen berhasil...'"""
    log(f"Test 5: Mark absensi dengan status 'hadir'...")
    
    if not rows:
        log("⚠️  Tidak ada peserta untuk diabsen, skip test")
        return
    
    user_id = rows[0].get("user_id")
    assert user_id, "Peserta pertama tidak memiliki user_id"
    
    public_session = requests.Session()
    resp = public_session.post(f"{BASE_URL}/absensi/{token}/mark", json={
        "access": access,
        "user_id": user_id,
        "status": "hadir"
    })
    
    assert resp.status_code == 200, f"Mark absensi gagal: {resp.status_code} {resp.text}"
    data = resp.json()
    
    assert "message" in data, "Response tidak memuat message"
    message = data.get("message")
    assert message is not None, "Message untuk status 'hadir' seharusnya tidak null"
    assert "Absen berhasil, alhamdulillah jazakumullahu khoiro." in message, f"Message tidak sesuai: {message}"
    
    log(f"✅ Mark hadir berhasil: user_id={user_id}, message='{message}'")
    return user_id

def test_mark_absensi_izin(token, access, rows):
    """Test 6: POST /api/absensi/{token}/mark dengan status 'izin' -> message null"""
    log(f"Test 6: Mark absensi dengan status 'izin'...")
    
    if len(rows) < 2:
        log("⚠️  Tidak cukup peserta untuk test izin, skip")
        return
    
    user_id = rows[1].get("user_id")
    assert user_id, "Peserta kedua tidak memiliki user_id"
    
    public_session = requests.Session()
    resp = public_session.post(f"{BASE_URL}/absensi/{token}/mark", json={
        "access": access,
        "user_id": user_id,
        "status": "izin"
    })
    
    assert resp.status_code == 200, f"Mark absensi gagal: {resp.status_code} {resp.text}"
    data = resp.json()
    
    assert "message" in data, "Response tidak memuat message"
    message = data.get("message")
    assert message is None, f"Message untuk status 'izin' seharusnya null, dapat: {message}"
    
    log(f"✅ Mark izin berhasil: user_id={user_id}, message=null")

def test_verify_code_invalid_length():
    """Test 7: POST verify-code dengan kode kurang dari 6 digit -> 400"""
    log("Test 7: Verify code dengan kode '12345' (kurang dari 6 digit)...")
    
    public_session = requests.Session()
    resp = public_session.post(f"{BASE_URL}/absensi/verify-code", json={
        "code": "12345"
    })
    
    assert resp.status_code == 400, f"Expected 400, got {resp.status_code}"
    data = resp.json()
    detail = data.get("detail", "")
    assert "Kode akses harus 6 digit angka" in detail, f"Pesan error tidak sesuai: {detail}"
    
    log(f"✅ Validasi panjang kode berhasil: 400 dengan pesan '{detail}'")

def test_verify_code_not_found():
    """Test 8: POST verify-code dengan kode acak yang tidak ada -> 404 (MAKSIMAL 2x)"""
    log("Test 8: Verify code dengan kode acak '111111' (tidak ada) - MAKSIMAL 2x...")
    
    public_session = requests.Session()
    
    # Percobaan 1
    resp = public_session.post(f"{BASE_URL}/absensi/verify-code", json={
        "code": "111111"
    })
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
    data = resp.json()
    detail = data.get("detail", "")
    assert "tidak ditemukan" in detail or "ditutup" in detail, f"Pesan error tidak sesuai: {detail}"
    log(f"   Percobaan 1: 404 dengan pesan '{detail}'")
    
    # Percobaan 2 (untuk memastikan konsistensi)
    resp = public_session.post(f"{BASE_URL}/absensi/verify-code", json={
        "code": "111111"
    })
    assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
    log(f"   Percobaan 2: 404 (konsisten)")
    
    log(f"✅ Validasi kode tidak ada berhasil: 404 dengan pesan Indonesia")

def test_verify_code_after_close(kegiatan_id, access_code):
    """Test 9: Close kegiatan lalu verify-code -> 404 (1x saja)"""
    log(f"Test 9: Close kegiatan lalu verify code dengan kode yang sama...")
    
    # Close kegiatan
    resp = admin_session.post(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/close")
    assert resp.status_code == 200, f"Close kegiatan gagal: {resp.status_code} {resp.text}"
    log(f"   Kegiatan ditutup")
    
    # Verify code setelah close
    public_session = requests.Session()
    resp = public_session.post(f"{BASE_URL}/absensi/verify-code", json={
        "code": access_code
    })
    
    assert resp.status_code == 404, f"Expected 404 setelah close, got {resp.status_code}"
    data = resp.json()
    detail = data.get("detail", "")
    assert "tidak ditemukan" in detail or "ditutup" in detail, f"Pesan error tidak sesuai: {detail}"
    
    log(f"✅ Verify code setelah close: 404 dengan pesan '{detail}'")

def test_regenerate_and_verify(kegiatan_id, old_code):
    """Test 10: Regenerate kode, reopen, verify dengan kode baru -> 200, kode lama -> 404"""
    log(f"Test 10: Regenerate kode akses...")
    
    # Regenerate
    resp = admin_session.post(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/access/regenerate")
    assert resp.status_code == 200, f"Regenerate gagal: {resp.status_code} {resp.text}"
    data = resp.json()
    new_code = data.get("code")
    assert new_code, "Response tidak memuat code baru"
    assert new_code != old_code, f"Kode baru sama dengan kode lama: {new_code}"
    log(f"   Kode baru: {new_code} (kode lama: {old_code})")
    
    # Reopen kegiatan
    resp = admin_session.post(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/reopen")
    assert resp.status_code == 200, f"Reopen gagal: {resp.status_code} {resp.text}"
    log(f"   Kegiatan dibuka kembali")
    
    # Verify dengan kode BARU -> 200
    public_session = requests.Session()
    resp = public_session.post(f"{BASE_URL}/absensi/verify-code", json={
        "code": new_code
    })
    assert resp.status_code == 200, f"Verify dengan kode baru gagal: {resp.status_code} {resp.text}"
    log(f"   ✓ Verify dengan kode BARU berhasil: 200")
    
    # Verify dengan kode LAMA -> 404 (1x saja)
    resp = public_session.post(f"{BASE_URL}/absensi/verify-code", json={
        "code": old_code
    })
    assert resp.status_code == 404, f"Expected 404 untuk kode lama, got {resp.status_code}"
    log(f"   ✓ Verify dengan kode LAMA: 404 (kode lama tidak berlaku)")
    
    log(f"✅ Regenerate dan verify berhasil")
    return new_code

def test_regression_fase7_endpoints(kegiatan_id):
    """Test 11: REGRESI - endpoint FASE 7 lain masih normal"""
    log("Test 11: REGRESI - Test endpoint FASE 7 lainnya...")
    
    # GET /api/admin/kegiatan/{id}/access
    resp = admin_session.get(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/access")
    assert resp.status_code == 200, f"GET access gagal: {resp.status_code} {resp.text}"
    data = resp.json()
    assert "token" in data and "code" in data and "link" in data, "GET access response tidak lengkap"
    log(f"   ✓ GET /admin/kegiatan/{kegiatan_id}/access: 200")
    
    # POST /api/admin/kegiatan/{id}/absen-qr
    resp = admin_session.post(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/absen-qr")
    assert resp.status_code == 200, f"POST absen-qr gagal: {resp.status_code} {resp.text}"
    data = resp.json()
    assert "expires_days" in data, "Response tidak memuat expires_days"
    assert data["expires_days"] == 30, f"expires_days bukan 30: {data['expires_days']}"
    log(f"   ✓ POST /admin/kegiatan/{kegiatan_id}/absen-qr: 200, expires_days=30")
    
    # GET /api/admin/laporan
    resp = admin_session.get(f"{BASE_URL}/admin/laporan")
    assert resp.status_code == 200, f"GET laporan gagal: {resp.status_code} {resp.text}"
    data = resp.json()
    assert "top_rajin" not in data, "Laporan masih memuat top_rajin (seharusnya dihapus)"
    assert "top_alpha" not in data, "Laporan masih memuat top_alpha (seharusnya dihapus)"
    log(f"   ✓ GET /admin/laporan: 200, tanpa top_rajin/top_alpha")
    
    # GET /api/admin/users
    resp = admin_session.get(f"{BASE_URL}/admin/users")
    assert resp.status_code == 200, f"GET users gagal: {resp.status_code} {resp.text}"
    data = resp.json()
    admin_email = "ageng.rider@gmail.com"
    admin_in_list = any(u.get("email") == admin_email for u in data)
    assert not admin_in_list, f"Akun admin masih ada di daftar users (seharusnya hidden)"
    log(f"   ✓ GET /admin/users: 200, akun admin tidak ada (hidden)")
    
    # GET /api/admin/kelompok
    resp = admin_session.get(f"{BASE_URL}/admin/kelompok")
    assert resp.status_code == 200, f"GET kelompok gagal: {resp.status_code} {resp.text}"
    data = resp.json()
    kelompok_names = [k.get("name") for k in data]
    assert "Bali" in kelompok_names, "Kelompok 'Bali' tidak ada"
    assert "Luar Bali" in kelompok_names, "Kelompok 'Luar Bali' tidak ada"
    log(f"   ✓ GET /admin/kelompok: 200, ada 'Bali' & 'Luar Bali'")
    
    # Login pengurus
    pengurus_session = requests.Session()
    resp = pengurus_session.post(f"{BASE_URL}/auth/login", json={
        "identifier": "pengurus@ekertalangu.id",
        "password": "Pengurus#2026"
    })
    assert resp.status_code == 200, f"Login pengurus gagal: {resp.status_code} {resp.text}"
    log(f"   ✓ Login pengurus: 200")
    
    # Login peserta
    peserta_session = requests.Session()
    resp = peserta_session.post(f"{BASE_URL}/auth/login", json={
        "identifier": "peserta@ekertalangu.id",
        "password": "Peserta#2026"
    })
    assert resp.status_code == 200, f"Login peserta gagal: {resp.status_code} {resp.text}"
    log(f"   ✓ Login peserta: 200")
    
    log(f"✅ REGRESI berhasil: semua endpoint FASE 7 lain masih normal")

def test_cleanup(kegiatan_id):
    """Test 12: Hapus kegiatan uji"""
    log(f"Test 12: Hapus kegiatan uji...")
    
    resp = admin_session.delete(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}")
    assert resp.status_code == 200, f"Hapus kegiatan gagal: {resp.status_code} {resp.text}"
    
    log(f"✅ Kegiatan uji dihapus")

def main():
    log("=" * 80)
    log("FASE 7 E-KERTALANGU — Test POST /api/absensi/verify-code")
    log("=" * 80)
    
    try:
        # Test 1-2: Login dan buat kegiatan
        test_admin_login()
        kegiatan_id, access_code = test_create_kegiatan()
        
        # Test 3-6: Verify code dan mark absensi
        token, access, rows = test_verify_code_success(access_code)
        test_get_absensi_with_access(token, access)
        test_mark_absensi_hadir(token, access, rows)
        test_mark_absensi_izin(token, access, rows)
        
        # Test 7-8: Validasi error
        test_verify_code_invalid_length()
        test_verify_code_not_found()
        
        # Test 9: Close dan verify
        test_verify_code_after_close(kegiatan_id, access_code)
        
        # Test 10: Regenerate dan verify
        new_code = test_regenerate_and_verify(kegiatan_id, access_code)
        
        # Test 11: Regresi
        test_regression_fase7_endpoints(kegiatan_id)
        
        # Test 12: Cleanup
        test_cleanup(kegiatan_id)
        
        log("=" * 80)
        log("✅✅✅ SEMUA TEST BERHASIL (12/12)")
        log("=" * 80)
        return 0
        
    except AssertionError as e:
        log(f"❌ TEST GAGAL: {e}")
        return 1
    except Exception as e:
        log(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
