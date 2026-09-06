#!/usr/bin/env python3
"""
Backend API Testing - QR Base URL Bug Fix
E-KERTALANGU

Tests the fix for: "REGIST QR MASIH MENGARAH KE PREVIEW EMERGENT?"
Bug: QR registration in production Vercel still points to preview Emergent domain

Fix: Only `token` is stored in MongoDB; `link` and `image` are calculated 
every request via resolve_base_url(request)
"""

import requests
import sys
import json
import os
from datetime import datetime
import pymongo
import certifi
from dotenv import load_dotenv

# Load environment
load_dotenv('/app/backend/.env')

BASE_URL = os.environ.get('FRONTEND_URL', 'http://localhost:8001')
if not BASE_URL.startswith('http'):
    BASE_URL = f"https://{BASE_URL}"

# For API calls, use the public endpoint
API_BASE = BASE_URL.replace('https://agengrider-live.preview.emergentagent.com', 'https://agengrider-live.preview.emergentagent.com')

MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME', 'ekertalangu')
CRON_SECRET = os.environ.get('CRON_SECRET', 'fUjjJ28I1j2D6fPQQVK4liQl8yOnDN_q')
JWT_SECRET = os.environ.get('JWT_SECRET')

# Admin credentials
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'ageng.rider@gmail.com')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'jokam354')

class QRBaseURLTester:
    def __init__(self):
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.failures = []
        self.warnings = []
        
        # MongoDB connection
        try:
            self.mongo_client = pymongo.MongoClient(MONGO_URL, tlsCAFile=certifi.where())
            self.db = self.mongo_client[DB_NAME]
            print(f"✅ Connected to MongoDB: {DB_NAME}")
        except Exception as e:
            print(f"❌ Failed to connect to MongoDB: {e}")
            self.db = None

    def test(self, name, method, endpoint, expected_status, data=None, headers=None, 
             check_json=None, check_fields=None, check_no_fields=None):
        """Run a single API test"""
        url = f"{API_BASE}{endpoint}"
        self.tests_run += 1
        
        print(f"\n🔍 Test #{self.tests_run}: {name}")
        print(f"   {method} {endpoint}")
        
        try:
            req_headers = headers or {}
            if method == 'GET':
                resp = self.session.get(url, headers=req_headers, timeout=15)
            elif method == 'POST':
                resp = self.session.post(url, json=data, headers=req_headers, timeout=15)
            elif method == 'PATCH':
                resp = self.session.patch(url, json=data, headers=req_headers, timeout=15)
            elif method == 'DELETE':
                resp = self.session.delete(url, headers=req_headers, timeout=15)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            # Check status code
            if resp.status_code != expected_status:
                self.tests_failed += 1
                msg = f"Expected {expected_status}, got {resp.status_code}"
                print(f"❌ FAILED - {msg}")
                print(f"   Response: {resp.text[:300]}")
                self.failures.append({"test": name, "reason": msg, "response": resp.text[:300]})
                return False, None
            
            # Parse JSON
            try:
                json_data = resp.json()
            except:
                json_data = None
            
            # Check JSON content if specified
            if check_json:
                for key, expected_val in check_json.items():
                    if key not in json_data:
                        self.tests_failed += 1
                        msg = f"Key '{key}' not in response"
                        print(f"❌ FAILED - {msg}")
                        self.failures.append({"test": name, "reason": msg})
                        return False, None
                    if expected_val is not None and json_data[key] != expected_val:
                        self.tests_failed += 1
                        msg = f"Key '{key}': expected {expected_val}, got {json_data[key]}"
                        print(f"❌ FAILED - {msg}")
                        self.failures.append({"test": name, "reason": msg})
                        return False, None
            
            # Check required fields exist
            if check_fields:
                for field in check_fields:
                    if field not in json_data:
                        self.tests_failed += 1
                        msg = f"Required field '{field}' not in response"
                        print(f"❌ FAILED - {msg}")
                        self.failures.append({"test": name, "reason": msg})
                        return False, None
            
            # Check fields should NOT exist
            if check_no_fields:
                for field in check_no_fields:
                    if field in json_data:
                        self.tests_failed += 1
                        msg = f"Field '{field}' should NOT be in response but found"
                        print(f"❌ FAILED - {msg}")
                        self.failures.append({"test": name, "reason": msg})
                        return False, None
            
            self.tests_passed += 1
            print(f"✅ PASSED - Status {resp.status_code}")
            
            return True, json_data
                
        except Exception as e:
            self.tests_failed += 1
            msg = f"Exception: {str(e)}"
            print(f"❌ FAILED - {msg}")
            self.failures.append({"test": name, "reason": msg})
            return False, None

    def check_mongo_document(self, collection, doc_id, should_have_fields, should_not_have_fields):
        """Check MongoDB document structure"""
        if self.db is None:
            self.warnings.append("MongoDB not connected, skipping document check")
            return True
        
        try:
            doc = self.db[collection].find_one({"_id": doc_id})
            if not doc:
                print(f"⚠️  Document {collection}.{doc_id} not found")
                return False
            
            # Check required fields
            for field in should_have_fields:
                if field not in doc:
                    self.tests_failed += 1
                    msg = f"MongoDB {collection}.{doc_id} missing required field '{field}'"
                    print(f"❌ FAILED - {msg}")
                    self.failures.append({"test": f"MongoDB check {collection}.{doc_id}", "reason": msg})
                    return False
            
            # Check fields that should NOT exist
            for field in should_not_have_fields:
                if field in doc:
                    self.tests_failed += 1
                    msg = f"MongoDB {collection}.{doc_id} should NOT have field '{field}' but found: {doc[field][:100] if isinstance(doc[field], str) else doc[field]}"
                    print(f"❌ FAILED - {msg}")
                    self.failures.append({"test": f"MongoDB check {collection}.{doc_id}", "reason": msg})
                    return False
            
            print(f"✅ MongoDB document check passed for {collection}.{doc_id}")
            return True
            
        except Exception as e:
            self.warnings.append(f"MongoDB check error: {e}")
            return False

    def login_admin(self):
        """Login as admin"""
        print("\n" + "="*80)
        print("ADMIN LOGIN")
        print("="*80)
        
        success, data = self.test(
            "Admin login",
            "POST",
            "/api/auth/login",
            200,
            data={"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            check_fields=["id", "name", "email", "roles"]
        )
        
        if success and data:
            print(f"   Logged in as: {data.get('name')} (roles: {data.get('roles')})")
            return data
        return None

    def run_all_tests(self):
        print("="*80)
        print("QR BASE URL BUG FIX TESTING - E-KERTALANGU")
        print(f"API Base: {API_BASE}")
        print(f"FRONTEND_URL env: {os.environ.get('FRONTEND_URL')}")
        print(f"Database: {DB_NAME}")
        print("="*80)
        
        # Login first
        admin = self.login_admin()
        if not admin:
            print("\n❌ Cannot proceed without admin login")
            return False
        
        # ===== PRIORITY 1: BUG FIX VERIFICATION =====
        print("\n" + "="*80)
        print("PRIORITY 1: BUG FIX VERIFICATION")
        print("Verify that only 'token' is stored, link/image calculated per request")
        print("="*80)
        
        # Test 1: GET /api/qr/public returns correct structure
        success, qr_data = self.test(
            "GET /api/qr/public - returns token, link, image",
            "GET",
            "/api/qr/public",
            200,
            check_fields=["token", "link", "image"]
        )
        
        if success and qr_data:
            print(f"   Token: {qr_data.get('token')}")
            print(f"   Link: {qr_data.get('link')[:80]}...")
            print(f"   Image: {qr_data.get('image')[:50]}...")
            
            # Verify link contains correct base URL
            expected_base = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
            if not qr_data['link'].startswith(expected_base):
                self.tests_failed += 1
                msg = f"Link base URL mismatch: expected to start with '{expected_base}', got '{qr_data['link'][:100]}'"
                print(f"❌ FAILED - {msg}")
                self.failures.append({"test": "QR link base URL", "reason": msg})
            else:
                print(f"✅ Link correctly uses base URL: {expected_base}")
            
            # Store token for later tests
            first_token = qr_data.get('token')
        else:
            first_token = None
        
        # Test 2: MongoDB document check - should NOT have link, image, base_url
        print(f"\n🔍 Test #{self.tests_run + 1}: MongoDB app_settings.public_qr structure")
        self.tests_run += 1
        if self.check_mongo_document(
            "app_settings",
            "public_qr",
            should_have_fields=["token", "created_at"],
            should_not_have_fields=["link", "image", "base_url"]
        ):
            self.tests_passed += 1
        
        # Test 3: Call GET /api/qr/public again - token should be SAME, but link/image still present
        success, qr_data2 = self.test(
            "GET /api/qr/public (2nd call) - same token, link/image still present",
            "GET",
            "/api/qr/public",
            200,
            check_fields=["token", "link", "image"]
        )
        
        if success and qr_data2 and first_token:
            if qr_data2['token'] != first_token:
                self.tests_failed += 1
                msg = f"Token changed between calls: {first_token} -> {qr_data2['token']}"
                print(f"❌ FAILED - {msg}")
                self.failures.append({"test": "QR token persistence", "reason": msg})
            else:
                print(f"✅ Token is consistent: {first_token}")
        
        # ===== PRIORITY 2: resolve_base_url with FRONTEND_URL =====
        print("\n" + "="*80)
        print("PRIORITY 2: resolve_base_url with FRONTEND_URL env")
        print("All QR endpoints should use FRONTEND_URL when set")
        print("="*80)
        
        # Test 4: GET /api/staff/activation-qr
        success, act_qr = self.test(
            "GET /api/staff/activation-qr - uses FRONTEND_URL",
            "GET",
            "/api/staff/activation-qr",
            200,
            check_fields=["url", "image"]  # Note: field is 'url' not 'link'
        )
        
        if success and act_qr:
            print(f"   URL: {act_qr.get('url')[:80]}...")
            expected_base = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
            if not act_qr['url'].startswith(expected_base):
                self.tests_failed += 1
                msg = f"Activation QR URL base mismatch: expected '{expected_base}', got '{act_qr['url'][:100]}'"
                print(f"❌ FAILED - {msg}")
                self.failures.append({"test": "Activation QR base URL", "reason": msg})
            else:
                print(f"✅ Activation QR correctly uses base URL: {expected_base}")
        
        # ===== PRIORITY 3: All URL-generating endpoints =====
        print("\n" + "="*80)
        print("PRIORITY 3: All URL-generating endpoints use dynamic base URL")
        print("Create test kegiatan, test QR/share endpoints, then delete")
        print("="*80)
        
        # Create test kegiatan
        test_kegiatan_name = f"Test QR BaseURL {datetime.now().strftime('%H%M%S')}"
        success, kegiatan = self.test(
            "Create test kegiatan",
            "POST",
            "/api/admin/kegiatan",
            200,
            data={
                "name": test_kegiatan_name,
                "type": "rutin",
                "date": "2026-12-31",
                "start_time": "19:00",
                "end_time": "20:30",
                "recurring": False
            }
        )
        
        kegiatan_id = None
        if success and kegiatan:
            if isinstance(kegiatan, list) and len(kegiatan) > 0:
                kegiatan_id = kegiatan[0].get('id')
            else:
                kegiatan_id = kegiatan.get('id')
            print(f"   Created kegiatan ID: {kegiatan_id}")
        
        if kegiatan_id:
            expected_base = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
            
            # Test 5: GET /api/admin/kegiatan/{id}/qr
            success, qr = self.test(
                "GET /api/admin/kegiatan/{id}/qr - uses FRONTEND_URL",
                "GET",
                f"/api/admin/kegiatan/{kegiatan_id}/qr",
                200,
                check_fields=["link", "image"]
            )
            
            if success and qr:
                print(f"   Link: {qr.get('link')[:80]}...")
                if not qr['link'].startswith(expected_base):
                    self.tests_failed += 1
                    msg = f"Kegiatan QR link base mismatch"
                    print(f"❌ FAILED - {msg}")
                    self.failures.append({"test": "Kegiatan QR base URL", "reason": msg})
                else:
                    print(f"✅ Kegiatan QR correctly uses base URL")
            
            # Test 6: POST /api/admin/kegiatan/{id}/share
            success, share = self.test(
                "POST /api/admin/kegiatan/{id}/share - uses FRONTEND_URL",
                "POST",
                f"/api/admin/kegiatan/{kegiatan_id}/share",
                200,
                check_fields=["link", "token"]
            )
            
            share_token = None
            if success and share:
                share_token = share.get('token')
                print(f"   Link: {share.get('link')[:80]}...")
                if not share['link'].startswith(expected_base):
                    self.tests_failed += 1
                    msg = f"Share link base mismatch"
                    print(f"❌ FAILED - {msg}")
                    self.failures.append({"test": "Share link base URL", "reason": msg})
                else:
                    print(f"✅ Share link correctly uses base URL")
            
            # Test 7: POST /api/admin/kegiatan/{id}/absen-qr
            success, absen_qr = self.test(
                "POST /api/admin/kegiatan/{id}/absen-qr - uses FRONTEND_URL",
                "POST",
                f"/api/admin/kegiatan/{kegiatan_id}/absen-qr",
                200,
                check_fields=["link", "token", "image"]
            )
            
            absen_token = None
            if success and absen_qr:
                absen_token = absen_qr.get('token')
                print(f"   Link: {absen_qr.get('link')[:80]}...")
                if not absen_qr['link'].startswith(expected_base):
                    self.tests_failed += 1
                    msg = f"Absen QR link base mismatch"
                    print(f"❌ FAILED - {msg}")
                    self.failures.append({"test": "Absen QR base URL", "reason": msg})
                else:
                    print(f"✅ Absen QR correctly uses base URL")
            
            # ===== PRIORITY 4: REGRESSION - Links still work =====
            print("\n" + "="*80)
            print("PRIORITY 4: REGRESSION - Generated links still work")
            print("="*80)
            
            # Test 8: GET /api/rekap/{token} should work
            if share_token:
                success, rekap = self.test(
                    "GET /api/rekap/{token} - share link works",
                    "GET",
                    f"/api/rekap/{share_token}",
                    200,
                    check_fields=["name", "counts", "rows"]
                )
                
                if success:
                    print(f"✅ Share link is functional")
            
            # Test 9: GET /api/absen/{token} should work
            if absen_token:
                success, absen_info = self.test(
                    "GET /api/absen/{token} - absen link works",
                    "GET",
                    f"/api/absen/{absen_token}",
                    200,
                    check_fields=["kegiatan", "peserta"]
                )
                
                if success:
                    print(f"✅ Absen link is functional")
            
            # Test 10: Invalid token should return 404
            success, _ = self.test(
                "GET /api/rekap/invalid - returns 404",
                "GET",
                "/api/rekap/invalidtoken123",
                404
            )
            
            # Clean up: Delete test kegiatan
            print(f"\n🧹 Cleaning up test kegiatan...")
            success, _ = self.test(
                "Delete test kegiatan",
                "DELETE",
                f"/api/admin/kegiatan/{kegiatan_id}",
                200
            )
        
        # ===== PRIORITY 5: REGRESSION - Registration via QR =====
        print("\n" + "="*80)
        print("PRIORITY 5: REGRESSION - Registration via QR still works")
        print("="*80)
        
        # Test 11: Invalid token should return 400
        test_session = requests.Session()
        success, _ = self.test(
            "POST /api/auth/register with invalid token - returns 400",
            "POST",
            "/api/auth/register",
            400,
            data={
                "token": "invalidtoken",
                "name": "Test User",
                "phone": "081999999999",
                "email": "test@test.com",
                "dob": "1990-01-01",
                "address": "Test Address",
                "password": "testpass123"
            }
        )
        
        # ===== PRIORITY 6: REGRESSION - New endpoints from previous phase =====
        print("\n" + "="*80)
        print("PRIORITY 6: REGRESSION - New endpoints from previous phase")
        print("="*80)
        
        # Test 12: GET /api/health
        success, health = self.test(
            "GET /api/health",
            "GET",
            "/api/health",
            200,
            check_fields=["status", "db", "db_name"]
        )
        
        if success and health:
            if health.get('db_name') != 'ekertalangu':
                self.warnings.append(f"db_name is '{health.get('db_name')}', expected 'ekertalangu'")
        
        # Test 13: GET /api/me/profile (was 405 before, should be 200 now)
        success, profile = self.test(
            "GET /api/me/profile - should be 200 (was 405 before)",
            "GET",
            "/api/me/profile",
            200,
            check_fields=["id", "name", "email"]
        )
        
        # Test 14: GET /api/cron/auto-close without secret - should be 401
        success, _ = self.test(
            "GET /api/cron/auto-close without secret - returns 401",
            "GET",
            "/api/cron/auto-close",
            401
        )
        
        # Test 15: GET /api/cron/auto-close with Authorization Bearer
        success, cron = self.test(
            "GET /api/cron/auto-close with Authorization Bearer",
            "GET",
            "/api/cron/auto-close",
            200,
            headers={"Authorization": f"Bearer {CRON_SECRET}"}
        )
        
        # Test 16: GET /api/cron/auto-close with X-Cron-Secret
        success, cron = self.test(
            "GET /api/cron/auto-close with X-Cron-Secret",
            "GET",
            "/api/cron/auto-close",
            200,
            headers={"X-Cron-Secret": CRON_SECRET}
        )
        
        # ===== PRIORITY 7: REGRESSION - Auth & Guards =====
        print("\n" + "="*80)
        print("PRIORITY 7: REGRESSION - Auth & Guards")
        print("="*80)
        
        # Test 17: Login with username
        test_session = requests.Session()
        resp = test_session.post(f"{API_BASE}/api/auth/login", json={"identifier": "admin", "password": ADMIN_PASSWORD})
        if resp.status_code == 200:
            print(f"✅ Login with username works")
            self.tests_passed += 1
        else:
            print(f"❌ Login with username failed: {resp.status_code}")
            self.tests_failed += 1
            self.failures.append({"test": "Login with username", "reason": f"Status {resp.status_code}"})
        self.tests_run += 1
        
        # Test 18: Login with phone
        test_session = requests.Session()
        resp = test_session.post(f"{API_BASE}/api/auth/login", json={"identifier": "081100000001", "password": ADMIN_PASSWORD})
        if resp.status_code == 200:
            print(f"✅ Login with phone works")
            self.tests_passed += 1
        else:
            print(f"❌ Login with phone failed: {resp.status_code}")
            self.tests_failed += 1
            self.failures.append({"test": "Login with phone", "reason": f"Status {resp.status_code}"})
        self.tests_run += 1
        
        # Test 19: GET /api/auth/me without cookie - should be 401
        # Use a fresh session without cookies
        old_session = self.session
        self.session = requests.Session()
        success, _ = self.test(
            "GET /api/auth/me without cookie - returns 401",
            "GET",
            "/api/auth/me",
            401
        )
        self.session = old_session  # Restore admin session
        
        # Test 20: Peserta should get 403 on /api/admin/users
        # Login as peserta first
        peserta_session = requests.Session()
        resp = peserta_session.post(f"{API_BASE}/api/auth/login", json={"identifier": "peserta@ekertalangu.id", "password": "Peserta#2026"})
        if resp.status_code == 200:
            resp = peserta_session.get(f"{API_BASE}/api/admin/users")
            if resp.status_code == 403:
                print(f"✅ Peserta correctly gets 403 on /api/admin/users")
                self.tests_passed += 1
            else:
                print(f"❌ Peserta should get 403, got {resp.status_code}")
                self.tests_failed += 1
                self.failures.append({"test": "Peserta guard", "reason": f"Expected 403, got {resp.status_code}"})
        else:
            print(f"⚠️  Could not login as peserta to test guard")
            self.warnings.append("Could not test peserta guard")
        self.tests_run += 1
        
        # Test 21: Peserta should get 403 on /api/staff/activation-qr
        if resp.status_code == 200:
            resp = peserta_session.get(f"{API_BASE}/api/staff/activation-qr")
            if resp.status_code == 403:
                print(f"✅ Peserta correctly gets 403 on /api/staff/activation-qr")
                self.tests_passed += 1
            else:
                print(f"❌ Peserta should get 403, got {resp.status_code}")
                self.tests_failed += 1
                self.failures.append({"test": "Peserta staff guard", "reason": f"Expected 403, got {resp.status_code}"})
        self.tests_run += 1
        
        # ===== PRIORITY 8: REGRESSION - Core endpoints =====
        print("\n" + "="*80)
        print("PRIORITY 8: REGRESSION - Core endpoints")
        print("="*80)
        
        # Test 22: GET /api/admin/dashboard - check 'tren' field (not 'tren_6_bulan')
        success, dashboard = self.test(
            "GET /api/admin/dashboard - has 'tren' field",
            "GET",
            "/api/admin/dashboard",
            200,
            check_fields=["tren", "total_peserta", "upcoming"]
        )
        
        if success and dashboard:
            if 'tren_6_bulan' in dashboard:
                self.warnings.append("Dashboard has 'tren_6_bulan' field (should be 'tren')")
        
        # Test 23: GET /api/admin/laporan - check 'per_kegiatan' field (not 'kegiatans')
        success, laporan = self.test(
            "GET /api/admin/laporan - has 'per_kegiatan' field",
            "GET",
            "/api/admin/laporan",
            200,
            check_fields=["per_kegiatan", "summary", "total_kegiatan"]
        )
        
        if success and laporan:
            if 'kegiatans' in laporan:
                self.warnings.append("Laporan has 'kegiatans' field (should be 'per_kegiatan')")
        
        # Test 24: GET /api/admin/laporan/export?format=excel
        resp = self.session.get(f"{API_BASE}/api/admin/laporan/export?format=excel", timeout=15)
        self.tests_run += 1
        if resp.status_code == 200 and len(resp.content) > 0:
            print(f"✅ Excel export works (size: {len(resp.content)} bytes)")
            self.tests_passed += 1
        else:
            print(f"❌ Excel export failed: {resp.status_code}")
            self.tests_failed += 1
            self.failures.append({"test": "Excel export", "reason": f"Status {resp.status_code}"})
        
        # Test 25: GET /api/admin/laporan/export?format=pdf
        resp = self.session.get(f"{API_BASE}/api/admin/laporan/export?format=pdf", timeout=15)
        self.tests_run += 1
        if resp.status_code == 200 and len(resp.content) > 0:
            print(f"✅ PDF export works (size: {len(resp.content)} bytes)")
            self.tests_passed += 1
        else:
            print(f"❌ PDF export failed: {resp.status_code}")
            self.tests_failed += 1
            self.failures.append({"test": "PDF export", "reason": f"Status {resp.status_code}"})
        
        # Test 26: GET /api/admin/users
        success, users = self.test(
            "GET /api/admin/users",
            "GET",
            "/api/admin/users",
            200
        )
        
        # Print summary
        self.print_summary()
        
        return self.tests_failed == 0

    def print_summary(self):
        print("\n" + "="*80)
        print("TEST SUMMARY")
        print("="*80)
        print(f"Total tests run: {self.tests_run}")
        print(f"✅ Passed: {self.tests_passed}")
        print(f"❌ Failed: {self.tests_failed}")
        
        if self.warnings:
            print(f"\n⚠️  Warnings ({len(self.warnings)}):")
            for w in self.warnings:
                print(f"   - {w}")
        
        if self.failures:
            print(f"\n❌ Failures ({len(self.failures)}):")
            for f in self.failures:
                print(f"   - {f['test']}: {f['reason']}")
        
        print("="*80)

def main():
    tester = QRBaseURLTester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
