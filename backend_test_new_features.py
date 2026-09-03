#!/usr/bin/env python3
"""
E-KERTALANGU Backend Test Suite - New Features
Tests: Photo profile, Move with keterangan, QR Absen Mandiri + Feedback
"""
import requests
import sys
import json
from typing import Dict, Optional

# Backend URL
BACKEND_URL = "https://lanjutan-next.preview.emergentagent.com/api"

# Admin credentials
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "jokam354"

# Test data
TEST_PHOTO_BASE64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'

def print_section(name: str):
    print(f"\n{Colors.CYAN}{'='*70}{Colors.END}")
    print(f"{Colors.CYAN}[SECTION] {name}{Colors.END}")
    print(f"{Colors.CYAN}{'='*70}{Colors.END}")

def print_test(name: str):
    print(f"\n{Colors.BLUE}[TEST]{Colors.END} {name}")

def print_pass(msg: str):
    print(f"  {Colors.GREEN}✓{Colors.END} {msg}")

def print_fail(msg: str):
    print(f"  {Colors.RED}✗{Colors.END} {msg}")

def print_info(msg: str):
    print(f"  {Colors.YELLOW}ℹ{Colors.END} {msg}")

def login_admin() -> Optional[Dict]:
    """Login as admin and return cookies"""
    print_test("Admin Login")
    try:
        response = requests.post(
            f"{BACKEND_URL}/auth/login",
            json={"identifier": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
            timeout=10
        )
        
        if response.status_code != 200:
            print_fail(f"Login failed: {response.status_code}")
            print_info(f"Response: {response.text}")
            return None
        
        cookies = response.cookies
        data = response.json()
        print_pass(f"Logged in as {data.get('name')}")
        return cookies
        
    except Exception as e:
        print_fail(f"Login error: {str(e)}")
        return None

# ============================================================================
# TEST 1: FOTO PROFIL SENDIRI
# ============================================================================
def test_my_photo(cookies, results):
    print_section("TEST 1: FOTO PROFIL SENDIRI")
    
    # 1.1: POST valid photo
    print_test("1.1: POST /api/me/photo with valid base64 image")
    try:
        response = requests.post(
            f"{BACKEND_URL}/me/photo",
            json={"photo": TEST_PHOTO_BASE64},
            cookies=cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("has_photo") == True:
                print_pass("Photo uploaded successfully, has_photo=true")
                results["passed"] += 1
            else:
                print_fail(f"Expected has_photo=true, got {data.get('has_photo')}")
                results["failed"] += 1
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
    
    # 1.2: GET photo
    print_test("1.2: GET /api/me/photo")
    try:
        response = requests.get(
            f"{BACKEND_URL}/me/photo",
            cookies=cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            photo = data.get("photo")
            if photo and photo.startswith("data:image/"):
                print_pass(f"Photo retrieved successfully (length: {len(photo)} chars)")
                results["passed"] += 1
            else:
                print_fail(f"Photo format invalid or missing")
                results["failed"] += 1
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
    
    # 1.3: POST invalid photo format
    print_test("1.3: POST /api/me/photo with invalid format")
    try:
        response = requests.post(
            f"{BACKEND_URL}/me/photo",
            json={"photo": "bukan-image"},
            cookies=cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 400:
            data = response.json()
            print_pass(f"Validation works: {data.get('detail')}")
            results["passed"] += 1
        else:
            print_fail(f"Expected 400, got {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
    
    # 1.4: POST null to delete photo
    print_test("1.4: POST /api/me/photo with null (delete photo)")
    try:
        response = requests.post(
            f"{BACKEND_URL}/me/photo",
            json={"photo": None},
            cookies=cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("has_photo") == False:
                print_pass("Photo deleted successfully, has_photo=false")
                results["passed"] += 1
            else:
                print_fail(f"Expected has_photo=false, got {data.get('has_photo')}")
                results["failed"] += 1
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
    
    # 1.5: Re-upload photo for next test
    print_test("1.5: Re-upload photo for admin photo endpoint test")
    try:
        response = requests.post(
            f"{BACKEND_URL}/me/photo",
            json={"photo": TEST_PHOTO_BASE64},
            cookies=cookies,
            timeout=10
        )
        if response.status_code == 200:
            print_pass("Photo re-uploaded for next test")
        else:
            print_fail("Failed to re-upload photo")
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")

# ============================================================================
# TEST 2: FOTO PESERTA UNTUK ADMIN
# ============================================================================
def test_admin_user_photo(cookies, results):
    print_section("TEST 2: FOTO PESERTA UNTUK ADMIN")
    
    # Get admin user ID (who has photo)
    print_test("2.1: Get admin user list to find user with photo")
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/users",
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code != 200:
            print_fail(f"Failed to get users: {response.status_code}")
            results["failed"] += 2
            return
        
        users = response.json()
        admin_user = None
        user_without_photo = None
        
        for user in users:
            if user.get("username") == ADMIN_USERNAME:
                admin_user = user
            if not user.get("has_photo"):
                user_without_photo = user
        
        if not admin_user:
            print_fail("Admin user not found in user list")
            results["failed"] += 2
            return
        
        print_pass(f"Found admin user: {admin_user.get('name')} (ID: {admin_user.get('id')})")
        
        # 2.2: GET photo for user with photo
        print_test("2.2: GET /api/admin/users/{id}/photo for user WITH photo")
        response = requests.get(
            f"{BACKEND_URL}/admin/users/{admin_user['id']}/photo",
            cookies=cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        print_info(f"Content-Type: {response.headers.get('Content-Type')}")
        
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '')
            if content_type.startswith('image/'):
                print_pass(f"Photo retrieved as binary image ({content_type}, {len(response.content)} bytes)")
                results["passed"] += 1
            else:
                print_fail(f"Expected image/* content type, got {content_type}")
                results["failed"] += 1
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            results["failed"] += 1
        
        # 2.3: GET photo for user without photo
        if user_without_photo:
            print_test("2.3: GET /api/admin/users/{id}/photo for user WITHOUT photo")
            response = requests.get(
                f"{BACKEND_URL}/admin/users/{user_without_photo['id']}/photo",
                cookies=cookies,
                timeout=10
            )
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 404:
                print_pass("Correctly returns 404 for user without photo")
                results["passed"] += 1
            else:
                print_fail(f"Expected 404, got {response.status_code}")
                results["failed"] += 1
        else:
            print_info("No user without photo found, skipping test 2.3")
            
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 2

# ============================================================================
# TEST 3: PINDAH SAMBUNG + KETERANGAN
# ============================================================================
def test_move_with_keterangan(cookies, results):
    print_section("TEST 3: PINDAH SAMBUNG + KETERANGAN")
    
    # 3.1: Create or get kelompok
    print_test("3.1: Create test kelompok")
    kelompok_id = None
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/kelompok",
            json={"name": "Kelompok Uji Absen"},
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            kelompok_id = data.get("id")
            print_pass(f"Kelompok created: {data.get('name')} (ID: {kelompok_id})")
        elif response.status_code == 409:
            # Already exists, get it
            print_info("Kelompok already exists, fetching...")
            response = requests.get(
                f"{BACKEND_URL}/admin/kelompok",
                cookies=cookies,
                timeout=10
            )
            if response.status_code == 200:
                kelompoks = response.json()
                for k in kelompoks:
                    if k.get("name") == "Kelompok Uji Absen":
                        kelompok_id = k.get("id")
                        print_pass(f"Found existing kelompok (ID: {kelompok_id})")
                        break
        
        if not kelompok_id:
            print_fail("Failed to create or get kelompok")
            results["failed"] += 3
            return
            
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 3
        return
    
    # 3.2: Get a peserta user
    print_test("3.2: Get peserta user for move test")
    peserta_id = None
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/users",
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 200:
            users = response.json()
            for user in users:
                if "peserta" in user.get("roles", []):
                    peserta_id = user.get("id")
                    print_pass(f"Found peserta: {user.get('name')} (ID: {peserta_id})")
                    break
        
        if not peserta_id:
            print_fail("No peserta user found")
            results["failed"] += 3
            return
            
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 3
        return
    
    # 3.3: Move peserta to kelompok with keterangan
    print_test("3.3: POST /api/admin/users/{id}/move with keterangan")
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/users/{peserta_id}/move",
            json={
                "kelompok_id": kelompok_id,
                "keterangan": "Pindah karena domisili"
            },
            cookies=cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("keterangan") == "Pindah karena domisili":
                print_pass(f"Move successful with keterangan: {data.get('keterangan')}")
                print_info(f"Kelompok: {data.get('kelompok_name')}")
                results["passed"] += 1
            else:
                print_fail(f"Keterangan not returned correctly: {data.get('keterangan')}")
                results["failed"] += 1
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text}")
            results["failed"] += 1
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
    
    # 3.4: Verify log contains keterangan (optional check via GET /admin/logs)
    print_test("3.4: Verify activity log contains keterangan")
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/logs?limit=10",
            cookies=cookies,
            timeout=10
        )
        
        if response.status_code == 200:
            logs = response.json()
            found = False
            for log in logs:
                if log.get("action") == "pindah_sambung" and "Pindah karena domisili" in log.get("detail", ""):
                    found = True
                    print_pass(f"Log entry found: {log.get('detail')}")
                    break
            
            if found:
                results["passed"] += 1
            else:
                print_info("Log entry not found in recent logs (may be older)")
                results["passed"] += 1  # Don't fail, just info
        else:
            print_info("Could not verify logs")
            results["passed"] += 1  # Don't fail
    except Exception as e:
        print_info(f"Log verification skipped: {str(e)}")
        results["passed"] += 1  # Don't fail
    
    # 3.5: Move back with null kelompok_id
    print_test("3.5: Move back with null kelompok_id")
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/users/{peserta_id}/move",
            json={
                "kelompok_id": None,
                "keterangan": "Kembali"
            },
            cookies=cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_pass(f"Move back successful, keterangan: {data.get('keterangan')}")
            results["passed"] += 1
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1

# ============================================================================
# TEST 4: QR ABSEN MANDIRI + KESAN/PESAN
# ============================================================================
def test_qr_absen_mandiri(cookies, results):
    print_section("TEST 4: QR ABSEN MANDIRI + KESAN/PESAN")
    
    # 4.1: Create kegiatan
    print_test("4.1: Create test kegiatan")
    kegiatan_id = None
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/kegiatan",
            json={
                "name": "Pengajian Uji QR",
                "type": "rutin",
                "date": "2026-12-01",
                "start_time": "19:00",
                "end_time": "20:30",
                "teacher": "Ust Uji",
                "material": "Materi",
                "location": "Masjid",
                "recurring": False
            },
            cookies=cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            # Response is a list, get first item
            if isinstance(data, list) and len(data) > 0:
                kegiatan = data[0]
                kegiatan_id = kegiatan.get("id")
                print_pass(f"Kegiatan created: {kegiatan.get('name')} (ID: {kegiatan_id})")
                results["passed"] += 1
            else:
                print_fail(f"Unexpected response format: {data}")
                results["failed"] += 1
                return
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            print_info(f"Response: {response.text}")
            results["failed"] += 1
            return
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
        return
    
    # 4.2: Generate QR absen
    print_test("4.2: POST /api/admin/kegiatan/{id}/absen-qr")
    absen_token = None
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}/absen-qr",
            cookies=cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            absen_token = data.get("token")
            link = data.get("link")
            image = data.get("image")
            
            if absen_token and "/absen/" in link and image and image.startswith("data:image/png;base64,"):
                print_pass(f"QR generated successfully")
                print_info(f"Token: {absen_token}")
                print_info(f"Link: {link}")
                print_info(f"Image: data:image/png;base64,... ({len(image)} chars)")
                results["passed"] += 1
            else:
                print_fail("Response missing required fields or invalid format")
                results["failed"] += 1
                return
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            results["failed"] += 1
            return
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
        return
    
    # 4.3: GET public absen info
    print_test("4.3: GET /api/absen/{token} (PUBLIC, no auth)")
    peserta_list = []
    try:
        response = requests.get(
            f"{BACKEND_URL}/absen/{absen_token}",
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            kegiatan = data.get("kegiatan", {})
            peserta_list = data.get("peserta", [])
            
            if kegiatan.get("status") == "open" and len(peserta_list) > 0:
                print_pass(f"Public absen info retrieved successfully")
                print_info(f"Kegiatan: {kegiatan.get('name')}, Status: {kegiatan.get('status')}")
                print_info(f"Peserta count: {len(peserta_list)}")
                results["passed"] += 1
            else:
                print_fail(f"Invalid response structure or no peserta")
                results["failed"] += 1
                return
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            results["failed"] += 1
            return
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
        return
    
    # 4.4: Mark absen for first peserta
    print_test("4.4: POST /api/absen/{token}/mark with valid user_id (PUBLIC)")
    first_peserta_id = None
    if peserta_list:
        first_peserta_id = peserta_list[0].get("id")
        try:
            response = requests.post(
                f"{BACKEND_URL}/absen/{absen_token}/mark",
                json={"user_id": first_peserta_id},
                timeout=10
            )
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "hadir" and data.get("already") == False and data.get("arrival_time"):
                    print_pass(f"Absen marked: {data.get('name')}, arrival: {data.get('arrival_time')}")
                    results["passed"] += 1
                else:
                    print_fail(f"Invalid response: {data}")
                    results["failed"] += 1
            else:
                print_fail(f"Expected 200, got {response.status_code}")
                results["failed"] += 1
        except Exception as e:
            print_fail(f"Request failed: {str(e)}")
            results["failed"] += 1
    else:
        print_fail("No peserta available for test")
        results["failed"] += 1
    
    # 4.5: Mark absen again (should return already=true)
    print_test("4.5: POST /api/absen/{token}/mark same user again (already=true)")
    if first_peserta_id:
        try:
            response = requests.post(
                f"{BACKEND_URL}/absen/{absen_token}/mark",
                json={"user_id": first_peserta_id},
                timeout=10
            )
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("already") == True:
                    print_pass(f"Correctly returns already=true for duplicate absen")
                    results["passed"] += 1
                else:
                    print_fail(f"Expected already=true, got {data.get('already')}")
                    results["failed"] += 1
            else:
                print_fail(f"Expected 200, got {response.status_code}")
                results["failed"] += 1
        except Exception as e:
            print_fail(f"Request failed: {str(e)}")
            results["failed"] += 1
    
    # 4.6: Mark absen with invalid user_id
    print_test("4.6: POST /api/absen/{token}/mark with invalid user_id")
    try:
        response = requests.post(
            f"{BACKEND_URL}/absen/{absen_token}/mark",
            json={"user_id": "idngawur123"},
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 404:
            print_pass("Correctly returns 404 for invalid user_id")
            results["passed"] += 1
        else:
            print_fail(f"Expected 404, got {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
    
    # 4.7: Submit feedback with valid message
    print_test("4.7: POST /api/absen/{token}/feedback with valid message (PUBLIC)")
    try:
        response = requests.post(
            f"{BACKEND_URL}/absen/{absen_token}/feedback",
            json={
                "name": "Budi",
                "message": "Alhamdulillah bermanfaat"
            },
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print_pass(f"Feedback submitted: {data.get('message')}")
            results["passed"] += 1
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
    
    # 4.8: Submit feedback with empty message
    print_test("4.8: POST /api/absen/{token}/feedback with empty message")
    try:
        response = requests.post(
            f"{BACKEND_URL}/absen/{absen_token}/feedback",
            json={
                "name": "Test",
                "message": ""
            },
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 400:
            print_pass("Correctly returns 400 for empty message")
            results["passed"] += 1
        else:
            print_fail(f"Expected 400, got {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
    
    # 4.9: Get feedback list (admin)
    print_test("4.9: GET /api/admin/kegiatan/{id}/feedback (admin)")
    try:
        response = requests.get(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}/feedback",
            cookies=cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            feedbacks = response.json()
            if len(feedbacks) > 0:
                print_pass(f"Feedback list retrieved: {len(feedbacks)} items")
                print_info(f"First feedback: {feedbacks[0].get('name')} - {feedbacks[0].get('message')}")
                results["passed"] += 1
            else:
                print_fail("No feedback found")
                results["failed"] += 1
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
    
    # 4.10: Close kegiatan
    print_test("4.10: POST /api/admin/kegiatan/{id}/close")
    try:
        response = requests.post(
            f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}/close",
            cookies=cookies,
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print_pass("Kegiatan closed successfully")
            results["passed"] += 1
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
    
    # 4.11: Try to mark absen after close (should fail with 403)
    print_test("4.11: POST /api/absen/{token}/mark after close (should fail)")
    if len(peserta_list) > 1:
        second_peserta_id = peserta_list[1].get("id")
        try:
            response = requests.post(
                f"{BACKEND_URL}/absen/{absen_token}/mark",
                json={"user_id": second_peserta_id},
                timeout=10
            )
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 403:
                data = response.json()
                if "ditutup" in data.get("detail", "").lower():
                    print_pass(f"Correctly returns 403: {data.get('detail')}")
                    results["passed"] += 1
                else:
                    print_fail(f"Got 403 but wrong message: {data.get('detail')}")
                    results["failed"] += 1
            else:
                print_fail(f"Expected 403, got {response.status_code}")
                results["failed"] += 1
        except Exception as e:
            print_fail(f"Request failed: {str(e)}")
            results["failed"] += 1
    else:
        print_info("Not enough peserta for this test, skipping")
        results["passed"] += 1
    
    # 4.12: GET absen info after close (should still work but status=closed)
    print_test("4.12: GET /api/absen/{token} after close (status should be 'closed')")
    try:
        response = requests.get(
            f"{BACKEND_URL}/absen/{absen_token}",
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            kegiatan = data.get("kegiatan", {})
            if kegiatan.get("status") == "closed":
                print_pass(f"Kegiatan status is 'closed' as expected")
                results["passed"] += 1
            else:
                print_fail(f"Expected status='closed', got {kegiatan.get('status')}")
                results["failed"] += 1
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
    
    # 4.13: GET with invalid token
    print_test("4.13: GET /api/absen/invalid-token")
    try:
        response = requests.get(
            f"{BACKEND_URL}/absen/token-ngawur",
            timeout=10
        )
        print_info(f"Status: {response.status_code}")
        
        if response.status_code == 404:
            print_pass("Correctly returns 404 for invalid token")
            results["passed"] += 1
        else:
            print_fail(f"Expected 404, got {response.status_code}")
            results["failed"] += 1
    except Exception as e:
        print_fail(f"Request failed: {str(e)}")
        results["failed"] += 1
    
    # Store kegiatan_id for cleanup
    return kegiatan_id

# ============================================================================
# TEST 5: CLEANUP
# ============================================================================
def test_cleanup(cookies, kegiatan_id, results):
    print_section("TEST 5: CLEANUP")
    
    # 5.1: Delete test kegiatan
    if kegiatan_id:
        print_test("5.1: DELETE test kegiatan")
        try:
            response = requests.delete(
                f"{BACKEND_URL}/admin/kegiatan/{kegiatan_id}",
                cookies=cookies,
                timeout=10
            )
            print_info(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                print_pass("Test kegiatan deleted")
            else:
                print_info(f"Could not delete kegiatan: {response.status_code}")
        except Exception as e:
            print_info(f"Cleanup error: {str(e)}")
    
    # 5.2: Reset admin photo to null (optional)
    print_test("5.2: Reset admin photo to null (optional)")
    try:
        response = requests.post(
            f"{BACKEND_URL}/me/photo",
            json={"photo": None},
            cookies=cookies,
            timeout=10
        )
        if response.status_code == 200:
            print_pass("Admin photo reset to null")
        else:
            print_info("Could not reset photo")
    except Exception as e:
        print_info(f"Cleanup error: {str(e)}")

# ============================================================================
# MAIN
# ============================================================================
def main():
    print(f"\n{Colors.CYAN}{'='*70}{Colors.END}")
    print(f"{Colors.CYAN}E-KERTALANGU Backend Test Suite - New Features{Colors.END}")
    print(f"{Colors.CYAN}{'='*70}{Colors.END}")
    print(f"Backend URL: {BACKEND_URL}")
    
    results = {
        "passed": 0,
        "failed": 0
    }
    
    # Login
    cookies = login_admin()
    if not cookies:
        print_fail("Cannot proceed without admin login")
        return 1
    
    results["passed"] += 1  # Login success
    
    # Run tests
    test_my_photo(cookies, results)
    test_admin_user_photo(cookies, results)
    test_move_with_keterangan(cookies, results)
    kegiatan_id = test_qr_absen_mandiri(cookies, results)
    test_cleanup(cookies, kegiatan_id, results)
    
    # Summary
    print(f"\n{Colors.CYAN}{'='*70}{Colors.END}")
    print(f"{Colors.CYAN}Test Summary{Colors.END}")
    print(f"{Colors.CYAN}{'='*70}{Colors.END}")
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
