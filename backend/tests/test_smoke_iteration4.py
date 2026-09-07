"""
E-KERTALANGU Smoke/Regression Test (Iteration 4)
Tests the restored app runs correctly on live preview after dependency install and env setup.
Focus: Does the user's app RUN correctly end-to-end?
"""
import os
import time
import uuid
import requests
from dotenv import dotenv_values

# Get base URL from frontend .env
frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE = base_url.rstrip("/") + "/api"

# Credentials from test_credentials.md
ADMIN_CREDS = {
    "identifier": os.environ.get("ADMIN_EMAIL", "ageng.rider@gmail.com"),
    "password": os.environ.get("ADMIN_PASSWORD", ""),
}

print(f"\n{'='*80}")
print(f"E-KERTALANGU SMOKE TEST - Iteration 4")
print(f"Base URL: {BASE}")
print(f"{'='*80}\n")

def new_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

class TestResults:
    def __init__(self):
        self.total = 0
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def test(self, name, func):
        self.total += 1
        try:
            func()
            self.passed += 1
            print(f"✅ PASS: {name}")
            return True
        except AssertionError as e:
            self.failed += 1
            error_msg = f"❌ FAIL: {name} - {str(e)}"
            print(error_msg)
            self.errors.append(error_msg)
            return False
        except Exception as e:
            self.failed += 1
            error_msg = f"❌ ERROR: {name} - {str(e)}"
            print(error_msg)
            self.errors.append(error_msg)
            return False
    
    def summary(self):
        print(f"\n{'='*80}")
        print(f"TEST SUMMARY")
        print(f"{'='*80}")
        print(f"Total: {self.total}")
        print(f"Passed: {self.passed} ({self.passed/self.total*100:.1f}%)")
        print(f"Failed: {self.failed}")
        if self.errors:
            print(f"\nFailed Tests:")
            for err in self.errors:
                print(f"  {err}")
        print(f"{'='*80}\n")
        return self.passed, self.total

results = TestResults()

# ============================================================================
# 1. HEALTH CHECK
# ============================================================================
print("\n--- 1. HEALTH CHECK ---")

def test_health():
    r = requests.get(f"{BASE}/health")
    assert r.status_code == 200, f"Health check failed: {r.status_code}"
    data = r.json()
    assert data.get("status") == "ok", f"Status not ok: {data}"
    assert data.get("db") == "connected", f"DB not connected: {data}"
    assert data.get("jwt_secret_set") == True, f"JWT secret not set: {data}"
    assert data.get("db_name") == "ekertalangu", f"Wrong DB name: {data}"

results.test("GET /api/health", test_health)

# ============================================================================
# 2. AUTHENTICATION
# ============================================================================
print("\n--- 2. AUTHENTICATION ---")

admin_session = new_session()

def test_admin_login():
    r = admin_session.post(f"{BASE}/auth/login", json=ADMIN_CREDS)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert data["email"] == "ageng.rider@gmail.com", f"Wrong email: {data}"
    assert set(data["roles"]) == {"admin", "pengurus", "peserta"}, f"Wrong roles: {data['roles']}"
    # Check httpOnly cookies
    assert "access_token" in [c.name for c in admin_session.cookies], "No access_token cookie"
    assert "refresh_token" in [c.name for c in admin_session.cookies], "No refresh_token cookie"

results.test("POST /api/auth/login (admin with identifier field)", test_admin_login)

def test_auth_me():
    r = admin_session.get(f"{BASE}/auth/me")
    assert r.status_code == 200, f"GET /auth/me failed: {r.status_code}"
    data = r.json()
    assert data["email"] == "ageng.rider@gmail.com"

results.test("GET /api/auth/me", test_auth_me)

def test_me_profile():
    r = admin_session.get(f"{BASE}/me/profile")
    assert r.status_code == 200, f"GET /me/profile failed: {r.status_code}"

results.test("GET /api/me/profile", test_me_profile)

# ============================================================================
# 3. ADMIN ENDPOINTS - LIST OPERATIONS
# ============================================================================
print("\n--- 3. ADMIN ENDPOINTS ---")

def test_admin_users():
    r = admin_session.get(f"{BASE}/admin/users")
    assert r.status_code == 200, f"GET /admin/users failed: {r.status_code}"
    users = r.json()
    assert isinstance(users, list), f"Users not a list: {type(users)}"

results.test("GET /api/admin/users", test_admin_users)

def test_admin_kelompok():
    r = admin_session.get(f"{BASE}/admin/kelompok")
    assert r.status_code == 200, f"GET /admin/kelompok failed: {r.status_code}"
    kelompok = r.json()
    assert isinstance(kelompok, list), f"Kelompok not a list: {type(kelompok)}"

results.test("GET /api/admin/kelompok", test_admin_kelompok)

def test_admin_kegiatan():
    r = admin_session.get(f"{BASE}/admin/kegiatan")
    assert r.status_code == 200, f"GET /admin/kegiatan failed: {r.status_code}"
    kegiatan = r.json()
    assert isinstance(kegiatan, list), f"Kegiatan not a list: {type(kegiatan)}"

results.test("GET /api/admin/kegiatan", test_admin_kegiatan)

def test_admin_logs():
    r = admin_session.get(f"{BASE}/admin/logs")
    assert r.status_code == 200, f"GET /admin/logs failed: {r.status_code}"
    logs = r.json()
    assert isinstance(logs, list), f"Logs not a list: {type(logs)}"

results.test("GET /api/admin/logs", test_admin_logs)

# ============================================================================
# 4. CREATE TEST DATA - KELOMPOK, USER, KEGIATAN
# ============================================================================
print("\n--- 4. CREATE TEST DATA ---")

test_kelompok_id = None
test_user_id = None
test_kegiatan_id = None

def test_create_kelompok():
    global test_kelompok_id
    uid = uuid.uuid4().hex[:8]
    r = admin_session.post(f"{BASE}/admin/kelompok", json={
        "name": f"TEST_KELOMPOK_{uid}",
        "description": "Test kelompok for smoke test"
    })
    assert r.status_code == 200, f"Create kelompok failed: {r.status_code} {r.text[:200]}"
    test_kelompok_id = r.json()["id"]
    assert test_kelompok_id, "No kelompok ID returned"

results.test("POST /api/admin/kelompok (create test kelompok)", test_create_kelompok)

def test_create_user():
    global test_user_id
    uid = uuid.uuid4().hex[:8]
    r = admin_session.post(f"{BASE}/admin/users", json={
        "name": f"TEST_USER_{uid}",
        "phone": f"0899{uid[:8]}",
        "email": f"test_{uid}@smoke.test",
        "dob": "2000-01-01",
        "gender": "L",
        "kelompok_id": test_kelompok_id,
        "roles": ["peserta"],
        "status": "active"
    })
    assert r.status_code == 200, f"Create user failed: {r.status_code} {r.text[:200]}"
    test_user_id = r.json()["id"]
    assert test_user_id, "No user ID returned"

results.test("POST /api/admin/users (create test peserta)", test_create_user)

def test_create_kegiatan():
    global test_kegiatan_id
    from datetime import datetime, timedelta
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    r = admin_session.post(f"{BASE}/admin/kegiatan", json={
        "name": "TEST_KEGIATAN_SMOKE",
        "type": "rutin",
        "date": tomorrow,
        "start_time": "19:00",
        "end_time": "20:30",
        "recurring": False
    })
    assert r.status_code == 200, f"Create kegiatan failed: {r.status_code} {r.text[:200]}"
    result = r.json()
    # Handle both single kegiatan and list of kegiatan (recurring creates multiple)
    if isinstance(result, list):
        test_kegiatan_id = result[0]["id"]
    else:
        test_kegiatan_id = result["id"]
    assert test_kegiatan_id, "No kegiatan ID returned"

results.test("POST /api/admin/kegiatan (create test kegiatan)", test_create_kegiatan)

# ============================================================================
# 5. QR GENERATION - CRITICAL: Must use preview domain, not old hardcoded domain
# ============================================================================
print("\n--- 5. QR GENERATION (Base URL Check) ---")

EXPECTED_BASE = (os.environ.get("FRONTEND_URL") or base_url).rstrip("/")

def test_qr_public_base_url():
    r = requests.get(f"{BASE}/qr/public")
    assert r.status_code == 200, f"GET /qr/public failed: {r.status_code}"
    data = r.json()
    assert "link" in data, f"No link in response: {data}"
    assert "image" in data, f"No image in response: {data}"
    assert "token" in data, f"No token in response: {data}"
    assert data["link"].startswith(EXPECTED_BASE), f"QR public link uses wrong base URL: {data['link']}"
    print(f"   ✓ Public QR link: {data['link']}")

results.test("GET /api/qr/public (base URL check)", test_qr_public_base_url)

def test_activation_qr_base_url():
    r = admin_session.get(f"{BASE}/staff/activation-qr")
    assert r.status_code == 200, f"GET /staff/activation-qr failed: {r.status_code}"
    data = r.json()
    assert "url" in data, f"No url in response: {data}"
    assert "image" in data, f"No image in response: {data}"
    assert data["url"].startswith(EXPECTED_BASE), f"Activation QR uses wrong base URL: {data['url']}"
    print(f"   ✓ Activation QR url: {data['url']}")

results.test("GET /api/staff/activation-qr (base URL check)", test_activation_qr_base_url)

def test_kegiatan_qr_base_url():
    if not test_kegiatan_id:
        print("   ⚠ Skipping (no test kegiatan)")
        return
    r = admin_session.get(f"{BASE}/admin/kegiatan/{test_kegiatan_id}/qr")
    assert r.status_code == 200, f"GET kegiatan QR failed: {r.status_code}"
    data = r.json()
    assert "link" in data, f"No link in response: {data}"
    assert data["link"].startswith(EXPECTED_BASE), f"Kegiatan QR uses wrong base URL: {data['link']}"
    print(f"   ✓ Kegiatan QR link: {data['link']}")

results.test("GET /api/admin/kegiatan/{id}/qr (base URL check)", test_kegiatan_qr_base_url)

# ============================================================================
# 6. KEGIATAN OPERATIONS - SHARE, ABSEN-QR, REKAP
# ============================================================================
print("\n--- 6. KEGIATAN OPERATIONS ---")

share_token = None
absen_token = None

def test_kegiatan_share():
    global share_token
    if not test_kegiatan_id:
        print("   ⚠ Skipping (no test kegiatan)")
        return
    r = admin_session.post(f"{BASE}/admin/kegiatan/{test_kegiatan_id}/share")
    assert r.status_code == 200, f"POST kegiatan share failed: {r.status_code}"
    data = r.json()
    assert "token" in data, f"No token in response: {data}"
    assert "link" in data, f"No link in response: {data}"
    assert data["link"].startswith(EXPECTED_BASE), f"Share link uses wrong base URL: {data['link']}"
    share_token = data["token"]
    print(f"   ✓ Share link: {data['link']}")

results.test("POST /api/admin/kegiatan/{id}/share (base URL check)", test_kegiatan_share)

def test_kegiatan_absen_qr():
    global absen_token
    if not test_kegiatan_id:
        print("   ⚠ Skipping (no test kegiatan)")
        return
    r = admin_session.post(f"{BASE}/admin/kegiatan/{test_kegiatan_id}/absen-qr")
    assert r.status_code == 200, f"POST kegiatan absen-qr failed: {r.status_code}"
    data = r.json()
    assert "token" in data, f"No token in response: {data}"
    assert "link" in data, f"No link in response: {data}"
    assert data["link"].startswith(EXPECTED_BASE), f"Absen QR link uses wrong base URL: {data['link']}"
    absen_token = data["token"]
    print(f"   ✓ Absen QR link: {data['link']}")

results.test("POST /api/admin/kegiatan/{id}/absen-qr (base URL check)", test_kegiatan_absen_qr)

def test_kegiatan_rekap():
    if not test_kegiatan_id:
        print("   ⚠ Skipping (no test kegiatan)")
        return
    r = admin_session.get(f"{BASE}/admin/kegiatan/{test_kegiatan_id}/rekap")
    assert r.status_code == 200, f"GET kegiatan rekap failed: {r.status_code}"
    data = r.json()
    assert "counts" in data, f"No counts in response: {data}"
    assert "rows" in data, f"No rows in response: {data}"

results.test("GET /api/admin/kegiatan/{id}/rekap", test_kegiatan_rekap)

# ============================================================================
# 7. PUBLIC ENDPOINTS - REKAP & ABSEN
# ============================================================================
print("\n--- 7. PUBLIC ENDPOINTS ---")

def test_public_rekap():
    if not share_token:
        print("   ⚠ Skipping (no share token)")
        return
    r = requests.get(f"{BASE}/rekap/{share_token}")
    assert r.status_code == 200, f"GET /rekap/{{token}} failed: {r.status_code}"
    data = r.json()
    # Response contains kegiatan data directly (name, type, date, counts, rows)
    assert "name" in data, f"No name in response: {data}"
    assert "counts" in data, f"No counts in response: {data}"

results.test("GET /api/rekap/{token} (public rekap)", test_public_rekap)

def test_public_absen():
    if not absen_token:
        print("   ⚠ Skipping (no absen token)")
        return
    r = requests.get(f"{BASE}/absen/{absen_token}")
    assert r.status_code == 200, f"GET /absen/{{token}} failed: {r.status_code}"
    data = r.json()
    assert "kegiatan" in data, f"No kegiatan in response: {data}"
    assert "peserta" in data, f"No peserta in response: {data}"

results.test("GET /api/absen/{token} (public absen page)", test_public_absen)

# ============================================================================
# 8. STAFF ENDPOINTS - MUSYAWARAH, PENGUMUMAN, REMINDER
# ============================================================================
print("\n--- 8. STAFF ENDPOINTS ---")

def test_staff_musyawarah():
    r = admin_session.get(f"{BASE}/staff/musyawarah")
    assert r.status_code == 200, f"GET /staff/musyawarah failed: {r.status_code}"
    data = r.json()
    assert isinstance(data, list), f"Musyawarah not a list: {type(data)}"

results.test("GET /api/staff/musyawarah", test_staff_musyawarah)

def test_staff_pengumuman():
    r = admin_session.get(f"{BASE}/staff/pengumuman")
    assert r.status_code == 200, f"GET /staff/pengumuman failed: {r.status_code}"
    data = r.json()
    assert isinstance(data, list), f"Pengumuman not a list: {type(data)}"

results.test("GET /api/staff/pengumuman", test_staff_pengumuman)

def test_staff_reminder():
    if not test_kegiatan_id:
        print("   ⚠ Skipping (no test kegiatan)")
        return
    r = admin_session.get(f"{BASE}/staff/kegiatan/{test_kegiatan_id}/reminder")
    assert r.status_code == 200, f"GET /staff/kegiatan/{{id}}/reminder failed: {r.status_code}"
    data = r.json()
    assert "text" in data, f"No text in response: {data}"
    assert "recipients" in data, f"No recipients in response: {data}"

results.test("GET /api/staff/kegiatan/{id}/reminder", test_staff_reminder)

# ============================================================================
# 9. PESERTA ENDPOINTS (/me/*)
# ============================================================================
print("\n--- 9. PESERTA ENDPOINTS ---")

def test_me_qr():
    r = admin_session.get(f"{BASE}/me/qr")
    assert r.status_code == 200, f"GET /me/qr failed: {r.status_code}"
    data = r.json()
    assert "content" in data, f"No content in response: {data}"
    assert "image" in data, f"No image in response: {data}"

results.test("GET /api/me/qr (personal rotating QR)", test_me_qr)

def test_me_announcements():
    r = admin_session.get(f"{BASE}/me/announcements")
    assert r.status_code == 200, f"GET /me/announcements failed: {r.status_code}"
    data = r.json()
    assert isinstance(data, list), f"Announcements not a list: {type(data)}"

results.test("GET /api/me/announcements", test_me_announcements)

def test_me_attendance_history():
    r = admin_session.get(f"{BASE}/me/attendance-history")
    assert r.status_code == 200, f"GET /me/attendance-history failed: {r.status_code}"
    data = r.json()
    # API returns dict with months data, not a list
    assert isinstance(data, (list, dict)), f"Attendance history unexpected type: {type(data)}"

results.test("GET /api/me/attendance-history", test_me_attendance_history)

def test_me_delegations():
    r = admin_session.get(f"{BASE}/me/delegations")
    assert r.status_code == 200, f"GET /me/delegations failed: {r.status_code}"
    data = r.json()
    assert isinstance(data, list), f"Delegations not a list: {type(data)}"

results.test("GET /api/me/delegations", test_me_delegations)

# ============================================================================
# 10. CLEANUP TEST DATA
# ============================================================================
print("\n--- 10. CLEANUP ---")

def cleanup_kegiatan():
    if test_kegiatan_id:
        r = admin_session.delete(f"{BASE}/admin/kegiatan/{test_kegiatan_id}")
        assert r.status_code == 200, f"Delete kegiatan failed: {r.status_code}"

results.test("DELETE test kegiatan", cleanup_kegiatan)

def cleanup_user():
    if test_user_id:
        r = admin_session.delete(f"{BASE}/admin/users/{test_user_id}")
        assert r.status_code == 200, f"Delete user failed: {r.status_code}"

results.test("DELETE test user", cleanup_user)

def cleanup_kelompok():
    if test_kelompok_id:
        r = admin_session.delete(f"{BASE}/admin/kelompok/{test_kelompok_id}")
        assert r.status_code == 200, f"Delete kelompok failed: {r.status_code}"

results.test("DELETE test kelompok", cleanup_kelompok)

# ============================================================================
# SUMMARY
# ============================================================================
passed, total = results.summary()

# Exit with appropriate code
import sys
sys.exit(0 if passed == total else 1)
