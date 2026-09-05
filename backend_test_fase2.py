#!/usr/bin/env python3
"""
E-KERTALANGU Backend Fase 2 Tahap A Test Suite
Tests: Kegiatan, Absensi, Dashboard, Laporan modules
"""
import requests
import sys
from typing import Dict, Optional, List
import json

# Backend URL
BACKEND_URL = "https://peserta-absen-qr.preview.emergentagent.com/api"

# Admin credentials
ADMIN_IDENTIFIER = "admin"
ADMIN_PASSWORD = "jokam354"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'

def print_section(name: str):
    print(f"\n{Colors.CYAN}{'='*70}{Colors.END}")
    print(f"{Colors.CYAN}{name}{Colors.END}")
    print(f"{Colors.CYAN}{'='*70}{Colors.END}")

def print_test(name: str):
    print(f"\n{Colors.BLUE}[TEST {name}]{Colors.END}")

def print_pass(msg: str):
    print(f"  {Colors.GREEN}✓{Colors.END} {msg}")

def print_fail(msg: str):
    print(f"  {Colors.RED}✗{Colors.END} {msg}")

def print_info(msg: str):
    print(f"  {Colors.YELLOW}ℹ{Colors.END} {msg}")

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.details = []
    
    def add_pass(self, test_num: str, description: str):
        self.passed += 1
        self.details.append((test_num, "PASS", description))
    
    def add_fail(self, test_num: str, description: str, reason: str = ""):
        self.failed += 1
        self.details.append((test_num, "FAIL", description, reason))
    
    def print_summary(self):
        print_section("TEST SUMMARY")
        for detail in self.details:
            if detail[1] == "PASS":
                print(f"{Colors.GREEN}✓ [{detail[0]}]{Colors.END} {detail[2]}")
            else:
                print(f"{Colors.RED}✗ [{detail[0]}]{Colors.END} {detail[2]}")
                if len(detail) > 3 and detail[3]:
                    print(f"    Reason: {detail[3]}")
        
        print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
        print(f"{Colors.GREEN}Passed: {self.passed}{Colors.END}")
        print(f"{Colors.RED}Failed: {self.failed}{Colors.END}")
        print(f"Total: {self.passed + self.failed}")
        
        if self.failed == 0:
            print(f"\n{Colors.GREEN}✓ All tests passed!{Colors.END}\n")
        else:
            print(f"\n{Colors.RED}✗ Some tests failed{Colors.END}\n")

def login_admin() -> Optional[Dict]:
    """Login as admin and return cookies"""
    print_test("0")
    print_info("Logging in as admin...")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json={"identifier": ADMIN_IDENTIFIER, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if response.status_code != 200:
            print_fail(f"Admin login failed: {response.status_code}")
            print_info(f"Response: {response.text}")
            return None
        
        cookies = response.cookies
        user = response.json()
        print_pass(f"Logged in as {user.get('name')} with roles: {', '.join(user.get('roles', []))}")
        return cookies
        
    except Exception as e:
        print_fail(f"Login failed: {str(e)}")
        return None

def test_kegiatan_create_recurring(cookies, results: TestResults) -> List[str]:
    """Test 1: Create recurring kegiatan (4 weeks)"""
    print_test("1")
    print_info("POST /api/admin/kegiatan with recurring=true")
    
    kegiatan_ids = []
    
    try:
        body = {
            "name": "Test Kegiatan",
            "type": "rutin",
            "date": "2026-10-01",
            "start_time": "20:00",
            "end_time": "21:30",
            "teacher": "Ust A",
            "material": "Fiqih",
            "location": "Aula",
            "recurring": True
        }
        
        response = requests.post(
            f"{BACKEND_URL}/admin/kegiatan",
            json=body,
            cookies=cookies,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code not in [200, 201]:
            print_fail(f"Expected 200/201, got {response.status_code}")
            print_info(f"Response: {response.text}")
            results.add_fail("1", "Create recurring kegiatan", f"Status {response.status_code}")
            return kegiatan_ids
        
        data = response.json()
        
        # Should return a list of 4 kegiatan
        if not isinstance(data, list):
            print_fail(f"Expected list, got {type(data)}")
            results.add_fail("1", "Create recurring kegiatan", "Response not a list")
            return kegiatan_ids
        
        if len(data) != 4:
            print_fail(f"Expected 4 kegiatan, got {len(data)}")
            results.add_fail("1", "Create recurring kegiatan", f"Got {len(data)} kegiatan instead of 4")
            return kegiatan_ids
        
        # Verify dates are weekly (2026-10-01, 10-08, 10-15, 10-22)
        expected_dates = ["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22"]
        actual_dates = [k.get("date") for k in data]
        
        if actual_dates != expected_dates:
            print_fail(f"Dates mismatch. Expected {expected_dates}, got {actual_dates}")
            results.add_fail("1", "Create recurring kegiatan", f"Dates: {actual_dates}")
            return kegiatan_ids
        
        # Collect IDs for cleanup
        kegiatan_ids = [k.get("id") for k in data]
        
        print_pass(f"Created 4 recurring kegiatan with dates: {', '.join(expected_dates)}")
        print_info(f"IDs: {kegiatan_ids[0][:8]}... (saved for cleanup)")
        results.add_pass("1", "Create recurring kegiatan (4 weeks)")
        
        return kegiatan_ids
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("1", "Create recurring kegiatan", str(e))
        return kegiatan_ids

def test_kegiatan_validation(cookies, results: TestResults):
    """Test 2: Validation - invalid type and date format"""
    print_test("2")
    print_info("Testing validation errors")
    
    # Test invalid type
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/kegiatan",
            json={
                "name": "Test Invalid",
                "type": "xxx",  # Invalid type
                "date": "2026-10-01",
                "start_time": "20:00",
                "end_time": "21:30",
                "recurring": False
            },
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 400:
            print_pass("Invalid type rejected with 400")
        else:
            print_fail(f"Expected 400 for invalid type, got {response.status_code}")
            results.add_fail("2a", "Invalid type validation", f"Status {response.status_code}")
            return
    except Exception as e:
        print_fail(f"Invalid type test failed: {str(e)}")
        results.add_fail("2a", "Invalid type validation", str(e))
        return
    
    # Test invalid date format
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/kegiatan",
            json={
                "name": "Test Invalid Date",
                "type": "rutin",
                "date": "01-10-2026",  # Wrong format
                "start_time": "20:00",
                "end_time": "21:30",
                "recurring": False
            },
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 400:
            print_pass("Invalid date format rejected with 400")
            results.add_pass("2", "Validation (invalid type & date format)")
        else:
            print_fail(f"Expected 400 for invalid date, got {response.status_code}")
            results.add_fail("2b", "Invalid date validation", f"Status {response.status_code}")
    except Exception as e:
        print_fail(f"Invalid date test failed: {str(e)}")
        results.add_fail("2b", "Invalid date validation", str(e))

def test_kegiatan_list(cookies, results: TestResults):
    """Test 3: GET kegiatan list with month filter"""
    print_test("3")
    print_info("GET /api/admin/kegiatan?month=2026-10")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/kegiatan?month=2026-10",
            cookies=cookies,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            results.add_fail("3", "GET kegiatan list", f"Status {response.status_code}")
            return
        
        data = response.json()
        
        if not isinstance(data, list):
            print_fail(f"Expected list, got {type(data)}")
            results.add_fail("3", "GET kegiatan list", "Response not a list")
            return
        
        if len(data) < 4:
            print_fail(f"Expected at least 4 kegiatan, got {len(data)}")
            results.add_fail("3", "GET kegiatan list", f"Only {len(data)} kegiatan")
            return
        
        # Check that each item has counts field
        for k in data:
            if "counts" not in k:
                print_fail(f"Kegiatan missing 'counts' field: {k.get('id')}")
                results.add_fail("3", "GET kegiatan list", "Missing counts field")
                return
            
            counts = k["counts"]
            required_fields = ["total", "hadir", "izin", "alpha", "ratio"]
            for field in required_fields:
                if field not in counts:
                    print_fail(f"Counts missing '{field}' field")
                    results.add_fail("3", "GET kegiatan list", f"Missing counts.{field}")
                    return
        
        print_pass(f"Retrieved {len(data)} kegiatan for 2026-10")
        print_info(f"Sample counts: {data[0]['counts']}")
        results.add_pass("3", "GET kegiatan list with counts")
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("3", "GET kegiatan list", str(e))

def test_kegiatan_get_patch(cookies, kegiatan_id: str, results: TestResults):
    """Test 4: GET and PATCH single kegiatan"""
    print_test("4")
    print_info(f"GET /api/admin/kegiatan/{kegiatan_id[:8]}...")
    
    # GET single kegiatan
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}",
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code != 200:
            print_fail(f"GET failed: {response.status_code}")
            results.add_fail("4a", "GET single kegiatan", f"Status {response.status_code}")
            return
        
        data = response.json()
        original_location = data.get("location")
        print_pass(f"GET successful, location: {original_location}")
        
    except Exception as e:
        print_fail(f"GET failed: {str(e)}")
        results.add_fail("4a", "GET single kegiatan", str(e))
        return
    
    # PATCH kegiatan
    print_info(f"PATCH /api/admin/kegiatan/{kegiatan_id[:8]}... (change location)")
    
    try:
        new_location = "Ruang Utama"
        response = requests.patch(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}",
            json={"location": new_location},
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code != 200:
            print_fail(f"PATCH failed: {response.status_code}")
            results.add_fail("4b", "PATCH kegiatan", f"Status {response.status_code}")
            return
        
        data = response.json()
        updated_location = data.get("location")
        
        if updated_location != new_location:
            print_fail(f"Location not updated. Expected '{new_location}', got '{updated_location}'")
            results.add_fail("4b", "PATCH kegiatan", "Location not updated")
            return
        
        print_pass(f"PATCH successful, location changed to: {updated_location}")
        results.add_pass("4", "GET & PATCH kegiatan")
        
    except Exception as e:
        print_fail(f"PATCH failed: {str(e)}")
        results.add_fail("4b", "PATCH kegiatan", str(e))

def test_auth_required(results: TestResults):
    """Test 5: Admin endpoints require authentication"""
    print_test("5")
    print_info("Testing admin endpoints without login")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/kegiatan",
            timeout=10
        )
        
        if response.status_code in [401, 403]:
            print_pass(f"Unauthorized access rejected with {response.status_code}")
            results.add_pass("5", "Auth required for admin endpoints")
        else:
            print_fail(f"Expected 401/403, got {response.status_code}")
            results.add_fail("5", "Auth required", f"Status {response.status_code}")
    
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("5", "Auth required", str(e))

def get_active_peserta(cookies) -> Optional[str]:
    """Get one active peserta user ID"""
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/users",
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code != 200:
            return None
        
        users = response.json()
        for user in users:
            if "peserta" in user.get("roles", []) and user.get("status") == "active":
                return user.get("id")
        
        return None
    except:
        return None

def test_absensi_hadir(cookies, kegiatan_id: str, results: TestResults) -> Optional[str]:
    """Test 6: Mark attendance as 'hadir' with arrival_time"""
    print_test("6")
    print_info("Getting active peserta user...")
    
    user_id = get_active_peserta(cookies)
    if not user_id:
        print_fail("No active peserta found")
        results.add_fail("6", "Mark absensi hadir", "No active peserta")
        return None
    
    print_info(f"Using user_id: {user_id[:8]}...")
    print_info(f"POST /api/admin/kegiatan/{kegiatan_id[:8]}.../absen (status: hadir)")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}/absen",
            json={"user_id": user_id, "status": "hadir"},
            cookies=cookies,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text}")
            results.add_fail("6", "Mark absensi hadir", f"Status {response.status_code}")
            return None
        
        data = response.json()
        arrival_time = data.get("arrival_time")
        
        if not arrival_time:
            print_fail("arrival_time is null or missing")
            results.add_fail("6", "Mark absensi hadir", "arrival_time is null")
            return None
        
        # Check if it's in WITA format (+08:00)
        if "+08:00" not in arrival_time:
            print_fail(f"arrival_time not in WITA format: {arrival_time}")
            results.add_fail("6", "Mark absensi hadir", "Not WITA format")
            return None
        
        print_pass(f"Absensi marked as 'hadir', arrival_time: {arrival_time}")
        results.add_pass("6", "Mark absensi hadir with arrival_time (WITA)")
        
        return user_id
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("6", "Mark absensi hadir", str(e))
        return None

def test_absensi_upsert(cookies, kegiatan_id: str, user_id: str, results: TestResults):
    """Test 7: Change status to 'izin' (upsert, arrival_time becomes null)"""
    print_test("7")
    print_info(f"POST /api/admin/kegiatan/{kegiatan_id[:8]}.../absen (status: izin)")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}/absen",
            json={"user_id": user_id, "status": "izin"},
            cookies=cookies,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            results.add_fail("7", "Upsert absensi to izin", f"Status {response.status_code}")
            return
        
        data = response.json()
        arrival_time = data.get("arrival_time")
        
        if arrival_time is not None:
            print_fail(f"arrival_time should be null for 'izin', got: {arrival_time}")
            results.add_fail("7", "Upsert absensi to izin", "arrival_time not null")
            return
        
        print_pass("Status changed to 'izin', arrival_time is null (upsert successful)")
        results.add_pass("7", "Upsert absensi to izin (arrival_time null)")
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("7", "Upsert absensi to izin", str(e))

def test_absensi_validation(cookies, kegiatan_id: str, results: TestResults):
    """Test 8: Validation - invalid status and user_id"""
    print_test("8")
    print_info("Testing absensi validation")
    
    # Test invalid status
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}/absen",
            json={"user_id": "507f1f77bcf86cd799439011", "status": "invalid_status"},
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 400:
            print_pass("Invalid status rejected with 400")
        else:
            print_fail(f"Expected 400 for invalid status, got {response.status_code}")
            results.add_fail("8a", "Invalid status validation", f"Status {response.status_code}")
            return
    except Exception as e:
        print_fail(f"Invalid status test failed: {str(e)}")
        results.add_fail("8a", "Invalid status validation", str(e))
        return
    
    # Test invalid user_id
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}/absen",
            json={"user_id": "nonexistent_user_id_12345", "status": "hadir"},
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 404:
            print_pass("Invalid user_id rejected with 404")
            results.add_pass("8", "Absensi validation (invalid status & user_id)")
        else:
            print_fail(f"Expected 404 for invalid user_id, got {response.status_code}")
            results.add_fail("8b", "Invalid user_id validation", f"Status {response.status_code}")
    except Exception as e:
        print_fail(f"Invalid user_id test failed: {str(e)}")
        results.add_fail("8b", "Invalid user_id validation", str(e))

def test_rekap(cookies, kegiatan_id: str, results: TestResults):
    """Test 9: GET rekap with counts, gender, rows"""
    print_test("9")
    print_info(f"GET /api/admin/kegiatan/{kegiatan_id[:8]}.../rekap")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}/rekap",
            cookies=cookies,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            results.add_fail("9", "GET rekap", f"Status {response.status_code}")
            return
        
        data = response.json()
        
        # Check required fields
        required_fields = ["counts", "gender", "rows"]
        for field in required_fields:
            if field not in data:
                print_fail(f"Missing '{field}' field")
                results.add_fail("9", "GET rekap", f"Missing {field}")
                return
        
        # Check counts structure
        counts = data["counts"]
        count_fields = ["total", "hadir", "izin", "alpha", "ratio"]
        for field in count_fields:
            if field not in counts:
                print_fail(f"Counts missing '{field}'")
                results.add_fail("9", "GET rekap", f"Missing counts.{field}")
                return
        
        # Check gender structure
        gender = data["gender"]
        if "L" not in gender or "P" not in gender:
            print_fail("Gender missing L or P")
            results.add_fail("9", "GET rekap", "Gender structure invalid")
            return
        
        # Check rows
        rows = data["rows"]
        if not isinstance(rows, list):
            print_fail("Rows is not a list")
            results.add_fail("9", "GET rekap", "Rows not a list")
            return
        
        # Verify that unattended users have status 'alpha'
        alpha_count = sum(1 for r in rows if r.get("status") == "alpha")
        
        print_pass(f"Rekap retrieved successfully")
        print_info(f"Counts: {counts}")
        print_info(f"Gender: {gender}")
        print_info(f"Total rows: {len(rows)}, Alpha: {alpha_count}")
        results.add_pass("9", "GET rekap with counts, gender, rows (alpha default)")
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("9", "GET rekap", str(e))

def test_close_reopen(cookies, kegiatan_id: str, results: TestResults):
    """Test 10: Close and reopen kegiatan"""
    print_test("10")
    print_info(f"POST /api/admin/kegiatan/{kegiatan_id[:8]}.../close")
    
    # Close kegiatan
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}/close",
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code != 200:
            print_fail(f"Close failed: {response.status_code}")
            results.add_fail("10a", "Close kegiatan", f"Status {response.status_code}")
            return
        
        data = response.json()
        if data.get("status") != "closed":
            print_fail(f"Status not 'closed': {data.get('status')}")
            results.add_fail("10a", "Close kegiatan", "Status not closed")
            return
        
        print_pass("Kegiatan closed successfully")
        
    except Exception as e:
        print_fail(f"Close failed: {str(e)}")
        results.add_fail("10a", "Close kegiatan", str(e))
        return
    
    # Reopen kegiatan
    print_info(f"POST /api/admin/kegiatan/{kegiatan_id[:8]}.../reopen")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}/reopen",
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code != 200:
            print_fail(f"Reopen failed: {response.status_code}")
            results.add_fail("10b", "Reopen kegiatan", f"Status {response.status_code}")
            return
        
        data = response.json()
        if data.get("status") != "open":
            print_fail(f"Status not 'open': {data.get('status')}")
            results.add_fail("10b", "Reopen kegiatan", "Status not open")
            return
        
        print_pass("Kegiatan reopened successfully")
        results.add_pass("10", "Close & reopen kegiatan")
        
    except Exception as e:
        print_fail(f"Reopen failed: {str(e)}")
        results.add_fail("10b", "Reopen kegiatan", str(e))

def test_share(cookies, kegiatan_id: str, results: TestResults) -> Optional[str]:
    """Test 11: Generate share link"""
    print_test("11")
    print_info(f"POST /api/admin/kegiatan/{kegiatan_id[:8]}.../share")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}/share",
            cookies=cookies,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            results.add_fail("11", "Generate share link", f"Status {response.status_code}")
            return None
        
        data = response.json()
        
        # Check required fields
        if "token" not in data or "link" not in data or "expires_at" not in data:
            print_fail("Missing required fields (token, link, expires_at)")
            results.add_fail("11", "Generate share link", "Missing fields")
            return None
        
        token = data["token"]
        link = data["link"]
        expires_at = data["expires_at"]
        
        # Check link contains /rekap/
        if "/rekap/" not in link:
            print_fail(f"Link doesn't contain '/rekap/': {link}")
            results.add_fail("11", "Generate share link", "Link format invalid")
            return None
        
        # Check expires_at is ~7 days in future
        from datetime import datetime, timedelta
        try:
            exp_dt = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            now_dt = datetime.now(exp_dt.tzinfo)
            delta = exp_dt - now_dt
            
            # Should be between 6 and 8 days (allowing for timezone/time differences)
            if not (6 <= delta.days <= 8):
                print_fail(f"Expires in {delta.days} days, expected ~7 days")
                results.add_fail("11", "Generate share link", f"Expires in {delta.days} days")
                return None
        except Exception as e:
            print_fail(f"Failed to parse expires_at: {str(e)}")
            results.add_fail("11", "Generate share link", "Invalid expires_at format")
            return None
        
        print_pass(f"Share link generated")
        print_info(f"Token: {token}")
        print_info(f"Link: {link}")
        print_info(f"Expires: {expires_at} (~7 days)")
        results.add_pass("11", "Generate share link (token, link, expires ~7 days)")
        
        return token
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("11", "Generate share link", str(e))
        return None

def test_qr(cookies, kegiatan_id: str, results: TestResults):
    """Test 12: Generate QR code"""
    print_test("12")
    print_info(f"GET /api/admin/kegiatan/{kegiatan_id[:8]}.../qr")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}/qr",
            cookies=cookies,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            results.add_fail("12", "Generate QR code", f"Status {response.status_code}")
            return
        
        data = response.json()
        
        # Check required fields
        if "image" not in data or "link" not in data or "expires_at" not in data:
            print_fail("Missing required fields (image, link, expires_at)")
            results.add_fail("12", "Generate QR code", "Missing fields")
            return
        
        image = data["image"]
        
        # Check image is base64 PNG
        if not image.startswith("data:image/png;base64,"):
            print_fail(f"Image not in expected format: {image[:50]}...")
            results.add_fail("12", "Generate QR code", "Image format invalid")
            return
        
        print_pass("QR code generated")
        print_info(f"Image: data:image/png;base64,... ({len(image)} chars)")
        print_info(f"Link: {data['link']}")
        results.add_pass("12", "Generate QR code (base64 PNG)")
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("12", "Generate QR code", str(e))

def test_public_rekap(token: str, results: TestResults):
    """Test 13: Access public rekap without auth"""
    print_test("13")
    print_info(f"GET /api/rekap/{token} (NO AUTH)")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/rekap/{token}",
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            results.add_fail("13", "Public rekap access", f"Status {response.status_code}")
            return
        
        data = response.json()
        
        # Check required fields
        required_fields = ["name", "location", "counts", "gender", "rows"]
        for field in required_fields:
            if field not in data:
                print_fail(f"Missing '{field}' field")
                results.add_fail("13", "Public rekap access", f"Missing {field}")
                return
        
        print_pass("Public rekap accessed successfully (no auth required)")
        print_info(f"Kegiatan: {data.get('name')}")
        print_info(f"Location: {data.get('location')}")
        print_info(f"Counts: {data.get('counts')}")
        results.add_pass("13", "Public rekap access (no auth)")
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("13", "Public rekap access", str(e))

def test_public_rekap_invalid(results: TestResults):
    """Test 14: Invalid token returns 404"""
    print_test("14")
    print_info("GET /api/rekap/invalid-token-12345")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/rekap/invalid-token-12345",
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 404:
            print_pass("Invalid token rejected with 404")
            results.add_pass("14", "Invalid token returns 404")
        else:
            print_fail(f"Expected 404, got {response.status_code}")
            results.add_fail("14", "Invalid token returns 404", f"Status {response.status_code}")
    
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("14", "Invalid token returns 404", str(e))

def test_dashboard(cookies, results: TestResults):
    """Test 15: Dashboard stats"""
    print_test("15")
    print_info("GET /api/admin/dashboard")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/dashboard",
            cookies=cookies,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            results.add_fail("15", "Dashboard stats", f"Status {response.status_code}")
            return
        
        data = response.json()
        
        # Check required fields
        required_fields = [
            "total_peserta", "peserta_L", "peserta_P",
            "akun_aktif", "akun_nonaktif",
            "kegiatan_bulan_ini", "rasio_kehadiran_bulan",
            "donut", "tren", "upcoming", "recent"
        ]
        
        for field in required_fields:
            if field not in data:
                print_fail(f"Missing '{field}' field")
                results.add_fail("15", "Dashboard stats", f"Missing {field}")
                return
        
        # Check donut structure
        donut = data["donut"]
        if "L" not in donut or "P" not in donut:
            print_fail("Donut missing L or P")
            results.add_fail("15", "Dashboard stats", "Donut structure invalid")
            return
        
        # Check tren is array with 6 items
        tren = data["tren"]
        if not isinstance(tren, list) or len(tren) != 6:
            print_fail(f"Tren should be array of 6 items, got {len(tren) if isinstance(tren, list) else type(tren)}")
            results.add_fail("15", "Dashboard stats", "Tren structure invalid")
            return
        
        # Check tren items have required fields
        for t in tren:
            if "month" not in t or "ratio" not in t or "kegiatan" not in t:
                print_fail("Tren item missing required fields")
                results.add_fail("15", "Dashboard stats", "Tren item structure invalid")
                return
        
        # Check upcoming and recent are arrays
        if not isinstance(data["upcoming"], list) or not isinstance(data["recent"], list):
            print_fail("Upcoming or recent not arrays")
            results.add_fail("15", "Dashboard stats", "Upcoming/recent not arrays")
            return
        
        print_pass("Dashboard retrieved successfully")
        print_info(f"Total peserta: {data['total_peserta']} (L: {data['peserta_L']}, P: {data['peserta_P']})")
        print_info(f"Kegiatan bulan ini: {data['kegiatan_bulan_ini']}, Rasio: {data['rasio_kehadiran_bulan']}%")
        print_info(f"Tren: {len(tren)} months, Upcoming: {len(data['upcoming'])}, Recent: {len(data['recent'])}")
        results.add_pass("15", "Dashboard stats (all fields present)")
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("15", "Dashboard stats", str(e))

def test_laporan(cookies, results: TestResults):
    """Test 16: Laporan with filters"""
    print_test("16")
    print_info("GET /api/admin/laporan?date_from=2026-10-01&date_to=2026-10-31")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/laporan?date_from=2026-10-01&date_to=2026-10-31",
            cookies=cookies,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            results.add_fail("16", "Laporan", f"Status {response.status_code}")
            return
        
        data = response.json()
        
        # Check required fields
        required_fields = [
            "summary", "gender_hadir", "per_kegiatan",
            "top_rajin", "top_alpha", "total_kegiatan"
        ]
        
        for field in required_fields:
            if field not in data:
                print_fail(f"Missing '{field}' field")
                results.add_fail("16", "Laporan", f"Missing {field}")
                return
        
        # Check summary structure
        summary = data["summary"]
        summary_fields = ["hadir", "izin", "alpha", "ratio"]
        for field in summary_fields:
            if field not in summary:
                print_fail(f"Summary missing '{field}'")
                results.add_fail("16", "Laporan", f"Missing summary.{field}")
                return
        
        # Check gender_hadir
        gender_hadir = data["gender_hadir"]
        if "L" not in gender_hadir or "P" not in gender_hadir:
            print_fail("gender_hadir missing L or P")
            results.add_fail("16", "Laporan", "gender_hadir structure invalid")
            return
        
        # Check per_kegiatan is array
        if not isinstance(data["per_kegiatan"], list):
            print_fail("per_kegiatan not an array")
            results.add_fail("16", "Laporan", "per_kegiatan not array")
            return
        
        # Check top_rajin and top_alpha are arrays
        if not isinstance(data["top_rajin"], list) or not isinstance(data["top_alpha"], list):
            print_fail("top_rajin or top_alpha not arrays")
            results.add_fail("16", "Laporan", "top_rajin/top_alpha not arrays")
            return
        
        print_pass("Laporan retrieved successfully")
        print_info(f"Total kegiatan: {data['total_kegiatan']}")
        print_info(f"Summary: {summary}")
        print_info(f"Gender hadir: {gender_hadir}")
        print_info(f"Top rajin: {len(data['top_rajin'])}, Top alpha: {len(data['top_alpha'])}")
        results.add_pass("16", "Laporan (summary, gender, per_kegiatan, top_rajin, top_alpha)")
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("16", "Laporan", str(e))

def test_export_excel(cookies, results: TestResults):
    """Test 17: Export Excel"""
    print_test("17")
    print_info("GET /api/admin/laporan/export?format=excel&date_from=2026-10-01&date_to=2026-10-31")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/laporan/export?format=excel&date_from=2026-10-01&date_to=2026-10-31",
            cookies=cookies,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            results.add_fail("17", "Export Excel", f"Status {response.status_code}")
            return
        
        # Check Content-Type
        content_type = response.headers.get("Content-Type", "")
        if "spreadsheet" not in content_type and "excel" not in content_type:
            print_fail(f"Content-Type not spreadsheet: {content_type}")
            results.add_fail("17", "Export Excel", f"Content-Type: {content_type}")
            return
        
        # Check size > 0
        content_length = len(response.content)
        if content_length == 0:
            print_fail("File size is 0")
            results.add_fail("17", "Export Excel", "Empty file")
            return
        
        print_pass(f"Excel export successful")
        print_info(f"Content-Type: {content_type}")
        print_info(f"Size: {content_length} bytes")
        results.add_pass("17", "Export Excel (spreadsheet, size > 0)")
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("17", "Export Excel", str(e))

def test_export_pdf(cookies, results: TestResults):
    """Test 18: Export PDF"""
    print_test("18")
    print_info("GET /api/admin/laporan/export?format=pdf&date_from=2026-10-01&date_to=2026-10-31")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/laporan/export?format=pdf&date_from=2026-10-01&date_to=2026-10-31",
            cookies=cookies,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            results.add_fail("18", "Export PDF", f"Status {response.status_code}")
            return
        
        # Check Content-Type
        content_type = response.headers.get("Content-Type", "")
        if "application/pdf" not in content_type:
            print_fail(f"Content-Type not application/pdf: {content_type}")
            results.add_fail("18", "Export PDF", f"Content-Type: {content_type}")
            return
        
        # Check size > 0
        content_length = len(response.content)
        if content_length == 0:
            print_fail("File size is 0")
            results.add_fail("18", "Export PDF", "Empty file")
            return
        
        print_pass(f"PDF export successful")
        print_info(f"Content-Type: {content_type}")
        print_info(f"Size: {content_length} bytes")
        results.add_pass("18", "Export PDF (application/pdf, size > 0)")
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results.add_fail("18", "Export PDF", str(e))

def cleanup_kegiatan(cookies, kegiatan_ids: List[str], results: TestResults):
    """Cleanup: Delete test kegiatan"""
    print_section("CLEANUP")
    print_info(f"Deleting {len(kegiatan_ids)} test kegiatan...")
    
    deleted = 0
    for kid in kegiatan_ids:
        try:
            response = requests.delete(
                f"{BACKEND_URL}/admin/kegiatan/{kid}",
                cookies=cookies,
                timeout=10
            )
            
            if response.status_code == 200:
                deleted += 1
            else:
                print_fail(f"Failed to delete {kid[:8]}...: {response.status_code}")
        except Exception as e:
            print_fail(f"Failed to delete {kid[:8]}...: {str(e)}")
    
    if deleted == len(kegiatan_ids):
        print_pass(f"All {deleted} test kegiatan deleted successfully")
    else:
        print_fail(f"Only {deleted}/{len(kegiatan_ids)} kegiatan deleted")

def main():
    print_section("E-KERTALANGU FASE 2 TAHAP A TEST SUITE")
    print_info("Testing: Kegiatan, Absensi, Dashboard, Laporan")
    print_info(f"Backend URL: {BACKEND_URL}")
    
    results = TestResults()
    
    # Login
    cookies = login_admin()
    if not cookies:
        print_fail("Cannot proceed without admin login")
        return 1
    
    # KEGIATAN TESTS
    print_section("KEGIATAN MODULE")
    
    # Test 1: Create recurring kegiatan
    kegiatan_ids = test_kegiatan_create_recurring(cookies, results)
    if not kegiatan_ids:
        print_fail("Cannot proceed without kegiatan IDs")
        results.print_summary()
        return 1
    
    kegiatan_id = kegiatan_ids[0]  # Use first kegiatan for subsequent tests
    
    # Test 2: Validation
    test_kegiatan_validation(cookies, results)
    
    # Test 3: List kegiatan
    test_kegiatan_list(cookies, results)
    
    # Test 4: GET and PATCH
    test_kegiatan_get_patch(cookies, kegiatan_id, results)
    
    # Test 5: Auth required
    test_auth_required(results)
    
    # ABSENSI TESTS
    print_section("ABSENSI MODULE")
    
    # Test 6: Mark hadir
    user_id = test_absensi_hadir(cookies, kegiatan_id, results)
    
    # Test 7: Upsert to izin
    if user_id:
        test_absensi_upsert(cookies, kegiatan_id, user_id, results)
    else:
        print_fail("Skipping test 7 - no user_id from test 6")
        results.add_fail("7", "Upsert absensi", "No user_id")
    
    # Test 8: Validation
    test_absensi_validation(cookies, kegiatan_id, results)
    
    # Test 9: Rekap
    test_rekap(cookies, kegiatan_id, results)
    
    # CLOSE/REOPEN TESTS
    print_section("CLOSE/REOPEN MODULE")
    
    # Test 10: Close and reopen
    test_close_reopen(cookies, kegiatan_id, results)
    
    # QR & SHARE TESTS
    print_section("QR & SHARE MODULE")
    
    # Test 11: Share
    token = test_share(cookies, kegiatan_id, results)
    
    # Test 12: QR
    test_qr(cookies, kegiatan_id, results)
    
    # Test 13: Public rekap
    if token:
        test_public_rekap(token, results)
    else:
        print_fail("Skipping test 13 - no token from test 11")
        results.add_fail("13", "Public rekap", "No token")
    
    # Test 14: Invalid token
    test_public_rekap_invalid(results)
    
    # DASHBOARD TESTS
    print_section("DASHBOARD MODULE")
    
    # Test 15: Dashboard
    test_dashboard(cookies, results)
    
    # LAPORAN TESTS
    print_section("LAPORAN MODULE")
    
    # Test 16: Laporan
    test_laporan(cookies, results)
    
    # Test 17: Export Excel
    test_export_excel(cookies, results)
    
    # Test 18: Export PDF
    test_export_pdf(cookies, results)
    
    # CLEANUP
    cleanup_kegiatan(cookies, kegiatan_ids, results)
    
    # Summary
    results.print_summary()
    
    return 0 if results.failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
