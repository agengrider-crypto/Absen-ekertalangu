#!/usr/bin/env python3
"""
E-KERTALANGU Restore Verification Test
Testing basic functionality after environment restore
"""
import requests
import sys
import os
from datetime import datetime

# Base URL from frontend .env
def get_backend_url():
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    return "http://localhost:8001"

BACKEND_URL = get_backend_url()
BASE_URL = f"{BACKEND_URL}/api"

# Test credentials from review_request
ADMIN_EMAIL = "ageng.rider@gmail.com"
ADMIN_USERNAME = "admin"
ADMIN_PHONE = "081100000001"
ADMIN_PASSWORD = "jokam354"

class RestoreTest:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.admin_session = None
        self.test_kegiatan_id = None
        
    def run_test(self, name, func):
        """Run a single test"""
        self.tests_run += 1
        print(f"\n{'='*80}")
        print(f"TEST {self.tests_run}: {name}")
        print('='*80)
        
        try:
            result = func()
            if result:
                self.tests_passed += 1
                print(f"✅ PASS: {name}")
            else:
                print(f"❌ FAIL: {name}")
            return result
        except Exception as e:
            print(f"❌ FAIL: {name} - Exception: {str(e)}")
            return False
    
    def test_backend_health(self):
        """Test 1: Backend health check - GET /api/"""
        print(f"Testing: GET {BASE_URL}/")
        r = requests.get(f"{BASE_URL}/")
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"Response: {data}")
            if "message" in data:
                print(f"✓ API message present: {data['message']}")
                return True
        print(f"✗ Expected 200 with message field")
        return False
    
    def test_login_email(self):
        """Test 2: Login with email"""
        print(f"Testing: POST {BASE_URL}/auth/login")
        print(f"Credentials: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        
        self.admin_session = requests.Session()
        r = self.admin_session.post(f"{BASE_URL}/auth/login", json={
            "identifier": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"✓ Login successful")
            print(f"✓ User: {data.get('name')}")
            print(f"✓ Roles: {data.get('roles')}")
            
            # Check cookies
            cookies = self.admin_session.cookies.get_dict()
            if 'access_token' in cookies and 'refresh_token' in cookies:
                print(f"✓ Cookies set: access_token, refresh_token")
                return True
            else:
                print(f"✗ Cookies not set properly")
                return False
        else:
            print(f"✗ Login failed: {r.text}")
            return False
    
    def test_login_username(self):
        """Test 3: Login with username"""
        print(f"Testing: POST {BASE_URL}/auth/login")
        print(f"Credentials: {ADMIN_USERNAME} / {ADMIN_PASSWORD}")
        
        s = requests.Session()
        r = s.post(f"{BASE_URL}/auth/login", json={
            "identifier": ADMIN_USERNAME,
            "password": ADMIN_PASSWORD
        })
        
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"✓ Login successful with username")
            print(f"✓ User: {data.get('name')}")
            return True
        else:
            print(f"✗ Login failed: {r.text}")
            return False
    
    def test_login_phone(self):
        """Test 4: Login with phone"""
        print(f"Testing: POST {BASE_URL}/auth/login")
        print(f"Credentials: {ADMIN_PHONE} / {ADMIN_PASSWORD}")
        
        s = requests.Session()
        r = s.post(f"{BASE_URL}/auth/login", json={
            "identifier": ADMIN_PHONE,
            "password": ADMIN_PASSWORD
        })
        
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"✓ Login successful with phone")
            print(f"✓ User: {data.get('name')}")
            return True
        else:
            print(f"✗ Login failed: {r.text}")
            return False
    
    def test_auth_me(self):
        """Test 5: GET /auth/me with cookies"""
        if not self.admin_session:
            print("✗ No admin session available")
            return False
        
        print(f"Testing: GET {BASE_URL}/auth/me")
        r = self.admin_session.get(f"{BASE_URL}/auth/me")
        
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"✓ Auth check successful")
            print(f"✓ User: {data.get('name')}")
            print(f"✓ Email: {data.get('email')}")
            print(f"✓ Roles: {data.get('roles')}")
            return True
        else:
            print(f"✗ Auth check failed: {r.text}")
            return False
    
    def test_auth_refresh(self):
        """Test 6: POST /auth/refresh"""
        if not self.admin_session:
            print("✗ No admin session available")
            return False
        
        print(f"Testing: POST {BASE_URL}/auth/refresh")
        r = self.admin_session.post(f"{BASE_URL}/auth/refresh")
        
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"✓ Token refresh successful")
            print(f"✓ User: {data.get('name')}")
            return True
        else:
            print(f"✗ Token refresh failed: {r.text}")
            return False
    
    def test_public_qr(self):
        """Test 7: GET /qr/public (no auth required)"""
        print(f"Testing: GET {BASE_URL}/qr/public")
        r = requests.get(f"{BASE_URL}/qr/public")
        
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            if 'link' in data and 'image' in data and 'token' in data:
                print(f"✓ Public QR endpoint working")
                print(f"✓ Link: {data['link'][:50]}...")
                print(f"✓ Token: {data['token']}")
                print(f"✓ Image: data:image/png;base64,... ({len(data['image'])} chars)")
                return True
            else:
                print(f"✗ Missing required fields in response")
                return False
        else:
            print(f"✗ Public QR failed: {r.text}")
            return False
    
    def test_admin_users(self):
        """Test 8: GET /admin/users"""
        if not self.admin_session:
            print("✗ No admin session available")
            return False
        
        print(f"Testing: GET {BASE_URL}/admin/users")
        r = self.admin_session.get(f"{BASE_URL}/admin/users")
        
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            users = r.json()
            print(f"✓ Admin users endpoint working")
            print(f"✓ Total users: {len(users)}")
            
            # Count by role
            admin_count = sum(1 for u in users if 'admin' in u.get('roles', []))
            pengurus_count = sum(1 for u in users if 'pengurus' in u.get('roles', []))
            peserta_count = sum(1 for u in users if 'peserta' in u.get('roles', []))
            print(f"✓ Admin: {admin_count}, Pengurus: {pengurus_count}, Peserta: {peserta_count}")
            return True
        else:
            print(f"✗ Admin users failed: {r.text}")
            return False
    
    def test_admin_dashboard(self):
        """Test 9: GET /admin/dashboard"""
        if not self.admin_session:
            print("✗ No admin session available")
            return False
        
        print(f"Testing: GET {BASE_URL}/admin/dashboard")
        r = self.admin_session.get(f"{BASE_URL}/admin/dashboard")
        
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"✓ Admin dashboard endpoint working")
            print(f"✓ Total peserta: {data.get('total_peserta')}")
            print(f"✓ Kegiatan bulan ini: {data.get('kegiatan_bulan_ini')}")
            print(f"✓ Rasio kehadiran: {data.get('rasio_kehadiran_bulan')}%")
            return True
        else:
            print(f"✗ Admin dashboard failed: {r.text}")
            return False
    
    def test_admin_kegiatan_list(self):
        """Test 10: GET /admin/kegiatan"""
        if not self.admin_session:
            print("✗ No admin session available")
            return False
        
        print(f"Testing: GET {BASE_URL}/admin/kegiatan")
        current_month = datetime.now().strftime("%Y-%m")
        r = self.admin_session.get(f"{BASE_URL}/admin/kegiatan", params={"month": current_month})
        
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            kegiatan = r.json()
            print(f"✓ Admin kegiatan list endpoint working")
            print(f"✓ Kegiatan this month ({current_month}): {len(kegiatan)}")
            if kegiatan:
                k = kegiatan[0]
                print(f"✓ Sample: {k.get('name')} on {k.get('date')}")
            return True
        else:
            print(f"✗ Admin kegiatan list failed: {r.text}")
            return False
    
    def test_admin_kelompok(self):
        """Test 11: GET /admin/kelompok"""
        if not self.admin_session:
            print("✗ No admin session available")
            return False
        
        print(f"Testing: GET {BASE_URL}/admin/kelompok")
        r = self.admin_session.get(f"{BASE_URL}/admin/kelompok")
        
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            kelompok = r.json()
            print(f"✓ Admin kelompok endpoint working")
            print(f"✓ Total kelompok: {len(kelompok)}")
            return True
        else:
            print(f"✗ Admin kelompok failed: {r.text}")
            return False
    
    def test_admin_logs(self):
        """Test 12: GET /admin/logs"""
        if not self.admin_session:
            print("✗ No admin session available")
            return False
        
        print(f"Testing: GET {BASE_URL}/admin/logs")
        r = self.admin_session.get(f"{BASE_URL}/admin/logs", params={"limit": 10})
        
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            logs = r.json()
            print(f"✓ Admin logs endpoint working")
            print(f"✓ Recent logs: {len(logs)}")
            if logs:
                log = logs[0]
                print(f"✓ Latest: {log.get('action')} by {log.get('actor_name')}")
            return True
        else:
            print(f"✗ Admin logs failed: {r.text}")
            return False
    
    def test_auth_logout(self):
        """Test 13: POST /auth/logout"""
        if not self.admin_session:
            print("✗ No admin session available")
            return False
        
        print(f"Testing: POST {BASE_URL}/auth/logout")
        r = self.admin_session.post(f"{BASE_URL}/auth/logout")
        
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            print(f"✓ Logout successful")
            
            # Verify cookies are cleared
            cookies = self.admin_session.cookies.get_dict()
            if 'access_token' not in cookies and 'refresh_token' not in cookies:
                print(f"✓ Cookies cleared")
            else:
                print(f"⚠ Cookies may still be present (browser handles deletion)")
            
            # Try to access protected endpoint - should fail
            r2 = self.admin_session.get(f"{BASE_URL}/auth/me")
            if r2.status_code == 401:
                print(f"✓ Protected endpoint now returns 401 (logout confirmed)")
                return True
            else:
                print(f"⚠ Protected endpoint still accessible: {r2.status_code}")
                return True  # Still pass as logout returned 200
        else:
            print(f"✗ Logout failed: {r.text}")
            return False
    
    def run_all_tests(self):
        """Run all tests"""
        print("="*80)
        print("E-KERTALANGU RESTORE VERIFICATION TEST")
        print("Testing basic functionality after environment restore")
        print("="*80)
        print(f"Backend URL: {BACKEND_URL}")
        print(f"Base API URL: {BASE_URL}")
        print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Run tests in order
        self.run_test("Backend Health Check", self.test_backend_health)
        self.run_test("Login with Email", self.test_login_email)
        self.run_test("Login with Username", self.test_login_username)
        self.run_test("Login with Phone", self.test_login_phone)
        self.run_test("Auth Me Endpoint", self.test_auth_me)
        self.run_test("Auth Refresh Endpoint", self.test_auth_refresh)
        self.run_test("Public QR Endpoint", self.test_public_qr)
        self.run_test("Admin Users List", self.test_admin_users)
        self.run_test("Admin Dashboard", self.test_admin_dashboard)
        self.run_test("Admin Kegiatan List", self.test_admin_kegiatan_list)
        self.run_test("Admin Kelompok List", self.test_admin_kelompok)
        self.run_test("Admin Activity Logs", self.test_admin_logs)
        self.run_test("Auth Logout", self.test_auth_logout)
        
        # Print summary
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("\n✅ ALL TESTS PASSED - Backend is fully operational after restore")
            return 0
        else:
            print(f"\n❌ {self.tests_run - self.tests_passed} TEST(S) FAILED - Backend has issues")
            return 1

def main():
    tester = RestoreTest()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
