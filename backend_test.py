#!/usr/bin/env python3
"""
E-KERTALANGU Backend Authentication Test Suite
Tests authentication flows after backend recovery
"""
import requests
import sys
from typing import Dict, Optional

# Read backend URL from frontend/.env
BACKEND_URL = "https://lanjutan-next.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_EMAIL = "ageng.rider@gmail.com"
ADMIN_USERNAME = "admin"
ADMIN_PHONE = "081100000001"
ADMIN_PASSWORD = "jokam354"

PENGURUS_EMAIL = "pengurus@ekertalangu.id"
PENGURUS_PASSWORD = "Pengurus#2026"

PESERTA_EMAIL = "peserta@ekertalangu.id"
PESERTA_PASSWORD = "Peserta#2026"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(name: str):
    print(f"\n{Colors.BLUE}[TEST]{Colors.END} {name}")

def print_pass(msg: str):
    print(f"  {Colors.GREEN}✓{Colors.END} {msg}")

def print_fail(msg: str):
    print(f"  {Colors.RED}✗{Colors.END} {msg}")

def print_info(msg: str):
    print(f"  {Colors.YELLOW}ℹ{Colors.END} {msg}")

def test_login(identifier: str, password: str, expected_status: int = 200, 
               description: str = "") -> Optional[Dict]:
    """Test login endpoint"""
    print_test(f"Login: {description or identifier}")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json={"identifier": identifier, "password": password},
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != expected_status:
            print_fail(f"Expected {expected_status}, got {response.status_code}")
            print_info(f"Response: {response.text}")
            return None
        
        if expected_status == 200:
            # Check response structure
            data = response.json()
            
            # Verify user data returned
            if "name" not in data:
                print_fail("Response missing 'name' field")
                return None
            
            if "roles" not in data:
                print_fail("Response missing 'roles' field")
                return None
            
            # Verify cookies are set
            cookies = response.cookies
            if "access_token" not in cookies:
                print_fail("access_token cookie not set")
                return None
            
            if "refresh_token" not in cookies:
                print_fail("refresh_token cookie not set")
                return None
            
            print_pass(f"Login successful for {data.get('name')}")
            print_info(f"Roles: {', '.join(data.get('roles', []))}")
            print_pass("Cookies set: access_token, refresh_token")
            
            return {"cookies": cookies, "user": data}
        
        elif expected_status == 401:
            # Check error message
            data = response.json()
            detail = data.get("detail", "")
            
            if detail == "Akun atau kata sandi salah":
                print_pass(f"Correct error message: '{detail}'")
            else:
                print_fail(f"Unexpected error message: '{detail}'")
                print_info(f"Expected: 'Akun atau kata sandi salah'")
            
            return None
        
        else:
            print_pass(f"Got expected status {expected_status}")
            return None
            
    except requests.exceptions.RequestException as e:
        print_fail(f"Request failed: {str(e)}")
        return None
    except Exception as e:
        print_fail(f"Unexpected error: {str(e)}")
        return None

def test_auth_me(cookies) -> bool:
    """Test /auth/me endpoint with cookies"""
    print_test("GET /auth/me with valid cookies")
    
    try:
        response = requests.get(
            f"{BACKEND_URL}/auth/me",
            cookies=cookies,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
        
        data = response.json()
        
        if "name" not in data or "roles" not in data:
            print_fail("Response missing required fields")
            return False
        
        print_pass(f"User data retrieved: {data.get('name')}")
        print_info(f"Roles: {', '.join(data.get('roles', []))}")
        return True
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        return False

def test_logout(cookies) -> bool:
    """Test /auth/logout endpoint"""
    print_test("POST /auth/logout")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/logout",
            cookies=cookies,
            timeout=10
        )
        
        print_info(f"Status: {response.status_code}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text}")
            return False
        
        data = response.json()
        print_pass(f"Logout successful: {data.get('message', '')}")
        return True
        
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}E-KERTALANGU Authentication Test Suite{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"Backend URL: {BACKEND_URL}")
    
    results = {
        "passed": 0,
        "failed": 0
    }
    
    # Test 1: Admin login via email
    result = test_login(ADMIN_EMAIL, ADMIN_PASSWORD, 200, "Admin via email")
    if result:
        results["passed"] += 1
        admin_cookies = result["cookies"]
    else:
        results["failed"] += 1
        admin_cookies = None
    
    # Test 2: Admin login via username
    result = test_login(ADMIN_USERNAME, ADMIN_PASSWORD, 200, "Admin via username")
    if result:
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 3: Admin login via phone
    result = test_login(ADMIN_PHONE, ADMIN_PASSWORD, 200, "Admin via phone")
    if result:
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 4: Login with wrong password
    result = test_login(ADMIN_EMAIL, "wrongpassword123", 401, "Admin with wrong password")
    if result is None:  # None means test passed (401 received)
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 5: /auth/me with valid cookies
    if admin_cookies:
        if test_auth_me(admin_cookies):
            results["passed"] += 1
        else:
            results["failed"] += 1
    else:
        print_fail("Skipping /auth/me test - no valid cookies from admin login")
        results["failed"] += 1
    
    # Test 6: /auth/logout
    if admin_cookies:
        if test_logout(admin_cookies):
            results["passed"] += 1
        else:
            results["failed"] += 1
    else:
        print_fail("Skipping /auth/logout test - no valid cookies")
        results["failed"] += 1
    
    # Test 7: Pengurus login
    result = test_login(PENGURUS_EMAIL, PENGURUS_PASSWORD, 200, "Pengurus login")
    if result:
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 8: Peserta login
    result = test_login(PESERTA_EMAIL, PESERTA_PASSWORD, 200, "Peserta login")
    if result:
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}Test Summary{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.GREEN}Passed: {results['passed']}{Colors.END}")
    print(f"{Colors.RED}Failed: {results['failed']}{Colors.END}")
    print(f"Total: {results['passed'] + results['failed']}")
    
    if results['failed'] == 0:
        print(f"\n{Colors.GREEN}✓ All tests passed!{Colors.END}\n")
        return 0
    else:
        print(f"\n{Colors.RED}✗ Some tests failed{Colors.END}\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
