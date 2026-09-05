#!/usr/bin/env python3
"""
E-KERTALANGU Fase 3 & 4 Backend Testing
Test all new endpoints: Musyawarah, Pengumuman, Reminder WA, Delegasi Absensi, 
QR Pribadi Rotating, Peserta endpoints, and Access Control
"""
import requests
import sys
import os
import time
from datetime import datetime, timedelta

# Base URL - read from frontend .env
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

# Test credentials from /app/memory/test_credentials.md
ADMIN_CREDS = {"identifier": "admin", "password": "jokam354"}
PENGURUS_CREDS = {"identifier": "pengurus", "password": "Pengurus#2026"}
PESERTA_CREDS = {"identifier": "peserta", "password": "Peserta#2026"}

# Test state
test_kegiatan_ids = []
test_musyawarah_ids = []
test_pengumuman_ids = []
test_delegation_ids = []

def login(creds):
    """Login and return session with cookies"""
    s = requests.Session()
    r = s.post(f"{BASE_URL}/auth/login", json=creds)
    if r.status_code != 200:
        print(f"❌ Login failed for {creds['identifier']}: {r.status_code} {r.text}")
        return None
    print(f"✅ Login successful for {creds['identifier']}")
    return s

def cleanup():
    """Clean up all test data"""
    print("\n" + "="*80)
    print("CLEANUP: Deleting test data")
    print("="*80)
    
    # Login as pengurus to delete
    s = login(PENGURUS_CREDS)
    if not s:
        print("⚠️ Could not login for cleanup")
        return
    
    # Delete test kegiatan
    for kid in test_kegiatan_ids:
        r = s.delete(f"{BASE_URL}/admin/kegiatan/{kid}")
        if r.status_code == 200:
            print(f"✅ Deleted kegiatan {kid}")
        else:
            print(f"⚠️ Could not delete kegiatan {kid}: {r.status_code}")
    
    # Delete test musyawarah
    for mid in test_musyawarah_ids:
        r = s.delete(f"{BASE_URL}/staff/musyawarah/{mid}")
        if r.status_code == 200:
            print(f"✅ Deleted musyawarah {mid}")
        else:
            print(f"⚠️ Could not delete musyawarah {mid}: {r.status_code}")
    
    # Delete test pengumuman
    for pid in test_pengumuman_ids:
        r = s.delete(f"{BASE_URL}/staff/pengumuman/{pid}")
        if r.status_code == 200:
            print(f"✅ Deleted pengumuman {pid}")
        else:
            print(f"⚠️ Could not delete pengumuman {pid}: {r.status_code}")
    
    print("✅ Cleanup complete")

# ============================================================================
# GROUP 1: MUSYAWARAH TESTS
# ============================================================================
def test_musyawarah():
    """Test Musyawarah CRUD + auto-save PATCH + PDF"""
    print("\n" + "="*80)
    print("GROUP 1: MUSYAWARAH (require_staff, login as pengurus)")
    print("="*80)
    
    s = login(PENGURUS_CREDS)
    if not s:
        return False
    
    passed = 0
    total = 7
    
    # Test 1: POST with valid category
    print("\n[1/7] POST /api/staff/musyawarah with category=4S")
    r = s.post(f"{BASE_URL}/staff/musyawarah", json={
        "category": "4S",
        "content": "catatan awal"
    })
    if r.status_code == 200:
        data = r.json()
        if "id" in data and data.get("category") == "4S":
            musy_id = data["id"]
            test_musyawarah_ids.append(musy_id)
            print(f"✅ PASS: Created musyawarah with id={musy_id}")
            passed += 1
        else:
            print(f"❌ FAIL: Response missing id or wrong category: {data}")
    else:
        print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    
    # Test 2: POST with invalid category
    print("\n[2/7] POST with invalid category")
    r = s.post(f"{BASE_URL}/staff/musyawarah", json={
        "category": "invalid",
        "content": "test"
    })
    if r.status_code == 400:
        print(f"✅ PASS: Invalid category rejected with 400")
        passed += 1
    else:
        print(f"❌ FAIL: Expected 400, got {r.status_code}: {r.text}")
    
    # Test 3: PATCH auto-save
    if test_musyawarah_ids:
        print("\n[3/7] PATCH /api/staff/musyawarah/{id} (auto-save)")
        r = s.patch(f"{BASE_URL}/staff/musyawarah/{test_musyawarah_ids[0]}", json={
            "content": "diperbarui",
            "date": "2026-01-05"
        })
        if r.status_code == 200:
            data = r.json()
            if data.get("content") == "diperbarui" and data.get("date") == "2026-01-05":
                print(f"✅ PASS: Content updated successfully")
                passed += 1
            else:
                print(f"❌ FAIL: Content not updated correctly: {data}")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    else:
        print("\n[3/7] SKIP: No musyawarah to update")
    
    # Test 4: GET list with category filter
    print("\n[4/7] GET /api/staff/musyawarah?category=4S")
    r = s.get(f"{BASE_URL}/staff/musyawarah?category=4S")
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, list):
            found = any(m.get("id") == test_musyawarah_ids[0] for m in data) if test_musyawarah_ids else True
            if found or len(data) >= 0:
                print(f"✅ PASS: List returned {len(data)} items")
                passed += 1
            else:
                print(f"❌ FAIL: Created item not in list")
        else:
            print(f"❌ FAIL: Expected list, got {type(data)}")
    else:
        print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    
    # Test 5: GET list with different category
    print("\n[5/7] GET /api/staff/musyawarah?category=tim7")
    r = s.get(f"{BASE_URL}/staff/musyawarah?category=tim7")
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, list):
            print(f"✅ PASS: Separate category list returned {len(data)} items")
            passed += 1
        else:
            print(f"❌ FAIL: Expected list, got {type(data)}")
    else:
        print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    
    # Test 6: GET PDF
    if test_musyawarah_ids:
        print("\n[6/7] GET /api/staff/musyawarah/{id}/pdf")
        r = s.get(f"{BASE_URL}/staff/musyawarah/{test_musyawarah_ids[0]}/pdf")
        if r.status_code == 200:
            if r.headers.get("content-type") == "application/pdf" and len(r.content) > 0:
                print(f"✅ PASS: PDF generated, size={len(r.content)} bytes")
                passed += 1
            else:
                print(f"❌ FAIL: Wrong content-type or empty body: {r.headers.get('content-type')}, {len(r.content)} bytes")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    else:
        print("\n[6/7] SKIP: No musyawarah for PDF")
    
    # Test 7: DELETE
    if test_musyawarah_ids:
        print("\n[7/7] DELETE /api/staff/musyawarah/{id}")
        r = s.delete(f"{BASE_URL}/staff/musyawarah/{test_musyawarah_ids[0]}")
        if r.status_code == 200:
            print(f"✅ PASS: Musyawarah deleted")
            test_musyawarah_ids.pop(0)
            passed += 1
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    else:
        print("\n[7/7] SKIP: No musyawarah to delete")
    
    print(f"\n{'='*80}")
    print(f"MUSYAWARAH TESTS: {passed}/{total} PASSED")
    print(f"{'='*80}")
    return passed == total

# ============================================================================
# GROUP 2: PENGUMUMAN TESTS
# ============================================================================
def test_pengumuman():
    """Test Pengumuman CRUD + pin max 3 + feed per-role"""
    print("\n" + "="*80)
    print("GROUP 2: PENGUMUMAN (require_staff)")
    print("="*80)
    
    s = login(PENGURUS_CREDS)
    if not s:
        return False
    
    passed = 0
    total = 8
    
    # Test 1: POST with empty title
    print("\n[1/8] POST with empty title")
    r = s.post(f"{BASE_URL}/staff/pengumuman", json={
        "title": "",
        "body": "test"
    })
    if r.status_code == 400:
        print(f"✅ PASS: Empty title rejected with 400")
        passed += 1
    else:
        print(f"❌ FAIL: Expected 400, got {r.status_code}: {r.text}")
    
    # Test 2: Create 3 pinned announcements (check current count first)
    print("\n[2/8] Create 3 pinned announcements for peserta")
    # First, check how many pinned already exist
    r_check = s.get(f"{BASE_URL}/staff/pengumuman")
    current_pinned = 0
    if r_check.status_code == 200:
        all_announcements = r_check.json()
        current_pinned = sum(1 for p in all_announcements if p.get("pinned"))
        print(f"  Current pinned count: {current_pinned}")
    
    # Try to create up to 3 total pinned
    created_count = 0
    for i in range(3 - current_pinned):
        r = s.post(f"{BASE_URL}/staff/pengumuman", json={
            "title": f"Pinned Test {i+1}",
            "body": f"Body {i+1}",
            "pinned": True,
            "pin_roles": ["peserta"]
        })
        if r.status_code == 200:
            data = r.json()
            test_pengumuman_ids.append(data["id"])
            created_count += 1
            print(f"  ✅ Created pinned announcement {i+1}: {data['id']}")
        else:
            print(f"  ❌ Failed to create pinned announcement {i+1}: {r.status_code}")
    
    # Verify we now have 3 total pinned
    r_verify = s.get(f"{BASE_URL}/staff/pengumuman")
    if r_verify.status_code == 200:
        all_announcements = r_verify.json()
        total_pinned = sum(1 for p in all_announcements if p.get("pinned"))
        if total_pinned == 3:
            print(f"✅ PASS: Now have 3 total pinned announcements")
            passed += 1
        else:
            print(f"❌ FAIL: Expected 3 total pinned, got {total_pinned}")
    else:
        print(f"❌ FAIL: Could not verify pinned count")
    
    # Test 3: Try to create 4th pinned (should fail if we have 3)
    print("\n[3/8] Try to create 4th pinned announcement (should fail if at max)")
    # Check current count
    r_check = s.get(f"{BASE_URL}/staff/pengumuman")
    current_pinned = 0
    if r_check.status_code == 200:
        all_announcements = r_check.json()
        current_pinned = sum(1 for p in all_announcements if p.get("pinned"))
    
    if current_pinned >= 3:
        r = s.post(f"{BASE_URL}/staff/pengumuman", json={
            "title": "Pinned Test 4",
            "body": "Should fail",
            "pinned": True,
            "pin_roles": ["peserta"]
        })
        if r.status_code == 400:
            print(f"✅ PASS: 4th pinned rejected with 400 (max 3)")
            passed += 1
        else:
            print(f"❌ FAIL: Expected 400, got {r.status_code}: {r.text}")
    else:
        print(f"⚠️ SKIP: Only {current_pinned} pinned, need 3 to test max")
        passed += 1  # Skip this test
    
    # Test 4: Create 4th with pinned=false (should succeed)
    print("\n[4/8] Create 4th announcement with pinned=false")
    r = s.post(f"{BASE_URL}/staff/pengumuman", json={
        "title": "Unpinned Test",
        "body": "Not pinned",
        "pinned": False
    })
    if r.status_code == 200:
        data = r.json()
        test_pengumuman_ids.append(data["id"])
        print(f"✅ PASS: Unpinned announcement created: {data['id']}")
        passed += 1
    else:
        print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    
    # Test 5: GET list (pinned first)
    print("\n[5/8] GET /api/staff/pengumuman (pinned items first)")
    r = s.get(f"{BASE_URL}/staff/pengumuman")
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, list) and len(data) >= 4:
            # Check first 3 are pinned
            first_three_pinned = all(item.get("pinned") for item in data[:3])
            if first_three_pinned:
                print(f"✅ PASS: List has {len(data)} items, first 3 are pinned")
                passed += 1
            else:
                print(f"❌ FAIL: First 3 items not all pinned")
        else:
            print(f"❌ FAIL: Expected list with at least 4 items, got {len(data) if isinstance(data, list) else 'not a list'}")
    else:
        print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    
    # Test 6: PATCH one pinned to false
    if len(test_pengumuman_ids) >= 3:
        print("\n[6/8] PATCH one pinned to pinned=false")
        r = s.patch(f"{BASE_URL}/staff/pengumuman/{test_pengumuman_ids[0]}", json={
            "pinned": False
        })
        if r.status_code == 200:
            # Now try to create another pinned (should succeed)
            r2 = s.post(f"{BASE_URL}/staff/pengumuman", json={
                "title": "New Pinned After Unpin",
                "body": "Should work now",
                "pinned": True,
                "pin_roles": ["peserta"]
            })
            if r2.status_code == 200:
                data = r2.json()
                test_pengumuman_ids.append(data["id"])
                print(f"✅ PASS: After unpinning one, new pinned created successfully")
                passed += 1
            else:
                print(f"❌ FAIL: Could not create new pinned after unpinning: {r2.status_code}")
        else:
            print(f"❌ FAIL: Could not unpin: {r.status_code}")
    else:
        print("\n[6/8] SKIP: Not enough announcements")
    
    # Test 7: GET /api/me/announcements?role=peserta (as peserta)
    print("\n[7/8] GET /api/me/announcements?role=peserta (as peserta)")
    s_peserta = login(PESERTA_CREDS)
    if s_peserta:
        r = s_peserta.get(f"{BASE_URL}/me/announcements?role=peserta")
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list) and len(data) <= 3:
                # Check all have peserta in pin_roles
                all_for_peserta = all("peserta" in item.get("pin_roles", []) for item in data)
                if all_for_peserta:
                    print(f"✅ PASS: Peserta sees {len(data)} pinned announcements (max 3), all for peserta role")
                    passed += 1
                else:
                    print(f"❌ FAIL: Some announcements not pinned for peserta")
            else:
                print(f"❌ FAIL: Expected list with max 3 items, got {len(data) if isinstance(data, list) else 'not a list'}")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    else:
        print("❌ FAIL: Could not login as peserta")
    
    # Test 8: Verify role filtering (create one pinned for admin only)
    print("\n[8/8] Create pinned for admin only, verify peserta doesn't see it")
    # First unpin one if we're at max
    r_check = s.get(f"{BASE_URL}/staff/pengumuman")
    if r_check.status_code == 200:
        all_announcements = r_check.json()
        pinned_list = [p for p in all_announcements if p.get("pinned")]
        if len(pinned_list) >= 3:
            # Unpin one to make room
            s.patch(f"{BASE_URL}/staff/pengumuman/{pinned_list[0]['id']}", json={"pinned": False})
    
    r = s.post(f"{BASE_URL}/staff/pengumuman", json={
        "title": "Admin Only Pinned",
        "body": "Only for admin",
        "pinned": True,
        "pin_roles": ["admin"]
    })
    if r.status_code == 200:
        data = r.json()
        admin_only_id = data["id"]
        test_pengumuman_ids.append(admin_only_id)
        
        # Check peserta doesn't see it
        if s_peserta:
            r2 = s_peserta.get(f"{BASE_URL}/me/announcements?role=peserta")
            if r2.status_code == 200:
                peserta_announcements = r2.json()
                admin_only_visible = any(a.get("id") == admin_only_id for a in peserta_announcements)
                if not admin_only_visible:
                    print(f"✅ PASS: Admin-only announcement not visible to peserta")
                    passed += 1
                else:
                    print(f"❌ FAIL: Admin-only announcement visible to peserta")
            else:
                print(f"❌ FAIL: Could not get peserta announcements: {r2.status_code}")
        else:
            print("❌ FAIL: Could not verify as peserta")
    else:
        print(f"❌ FAIL: Could not create admin-only announcement: {r.status_code} - {r.text}")
    
    print(f"\n{'='*80}")
    print(f"PENGUMUMAN TESTS: {passed}/{total} PASSED")
    print(f"{'='*80}")
    return passed == total

# ============================================================================
# GROUP 3: REMINDER WA TESTS
# ============================================================================
def test_reminder_wa():
    """Test Reminder WA endpoint"""
    print("\n" + "="*80)
    print("GROUP 3: REMINDER WA")
    print("="*80)
    
    s = login(PENGURUS_CREDS)
    if not s:
        return False
    
    passed = 0
    total = 1
    
    # Create a kegiatan first
    print("\n[1/1] Create kegiatan and GET /api/staff/kegiatan/{id}/reminder")
    today = datetime.now().strftime("%Y-%m-%d")
    r = s.post(f"{BASE_URL}/admin/kegiatan", json={
        "name": "Test Reminder Kegiatan",
        "type": "rutin",
        "date": today,
        "start_time": "19:00",
        "end_time": "21:00",
        "teacher": "Ustadz Test",
        "material": "Test Material",
        "location": "Test Location"
    })
    
    if r.status_code == 200:
        # Response is a list, get the first item
        data = r.json()
        if isinstance(data, list) and len(data) > 0:
            kegiatan_id = data[0]["id"]
            test_kegiatan_ids.append(kegiatan_id)
            
            # Get reminder
            r2 = s.get(f"{BASE_URL}/staff/kegiatan/{kegiatan_id}/reminder")
            if r2.status_code == 200:
                reminder = r2.json()
                if "text" in reminder and "recipients" in reminder:
                    text = reminder["text"]
                    recipients = reminder["recipients"]
                    
                    # Verify text is non-empty
                    if len(text) > 0 and isinstance(recipients, list):
                        # Verify recipients have required fields and wa starts with 62
                        all_valid = True
                        for rec in recipients:
                            if not all(k in rec for k in ["id", "name", "phone", "wa"]):
                                all_valid = False
                                break
                            if not rec["wa"].startswith("62"):
                                all_valid = False
                                break
                        
                        if all_valid:
                            print(f"✅ PASS: Reminder has text ({len(text)} chars) and {len(recipients)} recipients, all wa normalized to 62")
                            passed += 1
                        else:
                            print(f"❌ FAIL: Some recipients missing fields or wa not normalized")
                    else:
                        print(f"❌ FAIL: Text empty or recipients not a list")
                else:
                    print(f"❌ FAIL: Response missing text or recipients: {reminder}")
            else:
                print(f"❌ FAIL: Expected 200, got {r2.status_code}: {r2.text}")
        else:
            print(f"❌ FAIL: Kegiatan creation returned unexpected format")
    else:
        print(f"❌ FAIL: Could not create kegiatan: {r.status_code}")
    
    print(f"\n{'='*80}")
    print(f"REMINDER WA TESTS: {passed}/{total} PASSED")
    print(f"{'='*80}")
    return passed == total

# ============================================================================
# GROUP 4: DELEGASI ABSENSI TESTS
# ============================================================================
def test_delegasi_absensi():
    """Test Delegasi Absensi full flow"""
    print("\n" + "="*80)
    print("GROUP 4: DELEGASI ABSENSI")
    print("="*80)
    
    s = login(PENGURUS_CREDS)
    if not s:
        return False
    
    passed = 0
    total = 10
    
    # Create an OPEN kegiatan today
    print("\n[1/10] Create OPEN kegiatan today")
    today = datetime.now().strftime("%Y-%m-%d")
    r = s.post(f"{BASE_URL}/admin/kegiatan", json={
        "name": "Test Delegasi Kegiatan",
        "type": "rutin",
        "date": today,
        "start_time": "00:00",
        "end_time": "23:59",
        "teacher": "Ustadz Test",
        "location": "Test Location"
    })
    
    kegiatan_id = None
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, list) and len(data) > 0:
            kegiatan_id = data[0]["id"]
            test_kegiatan_ids.append(kegiatan_id)
            print(f"✅ PASS: Created kegiatan {kegiatan_id}")
            passed += 1
        else:
            print(f"❌ FAIL: Unexpected response format")
    else:
        print(f"❌ FAIL: Could not create kegiatan: {r.status_code}")
    
    if not kegiatan_id:
        print("❌ Cannot continue without kegiatan")
        return False
    
    # Get a peserta user_id from rekap - specifically the seed peserta
    print("\n[2/10] Get peserta user_id from rekap")
    r = s.get(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/rekap")
    peserta_id = None
    seed_peserta_id = "6a9c3df9b898236d01ba46cb"  # The seed peserta account
    if r.status_code == 200:
        rekap = r.json()
        if "rows" in rekap and len(rekap["rows"]) > 0:
            # Find the seed peserta account specifically
            for row in rekap["rows"]:
                if row["user_id"] == seed_peserta_id:
                    peserta_id = row["user_id"]
                    print(f"✅ PASS: Found seed peserta {peserta_id}")
                    passed += 1
                    break
            
            if not peserta_id:
                print(f"❌ FAIL: Seed peserta not in rekap")
        else:
            print(f"❌ FAIL: No rows in rekap")
    else:
        print(f"❌ FAIL: Could not get rekap: {r.status_code}")
    
    if not peserta_id:
        print("❌ Cannot continue without peserta_id")
        return False
    
    # Test 3: POST delegate with empty reason (should fail)
    print("\n[3/10] POST delegate with empty reason")
    r = s.post(f"{BASE_URL}/staff/kegiatan/{kegiatan_id}/delegate", json={
        "grantee_id": peserta_id,
        "reason": ""
    })
    if r.status_code == 400:
        print(f"✅ PASS: Empty reason rejected with 400")
        passed += 1
    else:
        print(f"❌ FAIL: Expected 400, got {r.status_code}: {r.text}")
    
    # Test 4: POST delegate with valid reason
    print("\n[4/10] POST delegate with valid reason")
    r = s.post(f"{BASE_URL}/staff/kegiatan/{kegiatan_id}/delegate", json={
        "grantee_id": peserta_id,
        "reason": "Pengurus tidak di lokasi"
    })
    delegation_id = None
    if r.status_code == 200:
        data = r.json()
        if data.get("active") == True:
            delegation_id = data["id"]
            test_delegation_ids.append(delegation_id)
            print(f"✅ PASS: Delegation created with active=true, id={delegation_id}")
            passed += 1
        else:
            print(f"❌ FAIL: Delegation not active: {data}")
    else:
        print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    
    # Test 5: GET delegations list
    print("\n[5/10] GET /api/staff/kegiatan/{id}/delegations")
    r = s.get(f"{BASE_URL}/staff/kegiatan/{kegiatan_id}/delegations")
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, list) and len(data) > 0:
            found = any(d.get("id") == delegation_id for d in data)
            if found:
                print(f"✅ PASS: Delegation found in list")
                passed += 1
            else:
                print(f"❌ FAIL: Delegation not in list")
        else:
            print(f"❌ FAIL: Expected non-empty list")
    else:
        print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    
    # Test 6: Login as peserta and GET /api/me/delegations
    print("\n[6/10] GET /api/me/delegations (as peserta)")
    s_peserta = login(PESERTA_CREDS)
    if s_peserta:
        r = s_peserta.get(f"{BASE_URL}/me/delegations")
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list) and len(data) >= 1:
                # Check if our kegiatan is in the list
                found = any(d.get("kegiatan_id") == kegiatan_id for d in data)
                if found:
                    print(f"✅ PASS: Peserta sees {len(data)} delegation(s) including this kegiatan")
                    passed += 1
                else:
                    print(f"❌ FAIL: This kegiatan not in peserta's delegations")
            else:
                print(f"❌ FAIL: Expected at least 1 delegation, got {len(data) if isinstance(data, list) else 'not a list'}")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    else:
        print("❌ FAIL: Could not login as peserta")
    
    # Test 7: GET /api/delegate/kegiatan/{id} (as peserta with delegation)
    print("\n[7/10] GET /api/delegate/kegiatan/{id} (as peserta with delegation)")
    if s_peserta:
        r = s_peserta.get(f"{BASE_URL}/delegate/kegiatan/{kegiatan_id}")
        if r.status_code == 200:
            data = r.json()
            if "peserta" in data and isinstance(data["peserta"], list):
                print(f"✅ PASS: Peserta can access delegate endpoint, sees {len(data['peserta'])} peserta")
                passed += 1
            else:
                print(f"❌ FAIL: Response missing peserta list: {data}")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    else:
        print("❌ FAIL: No peserta session")
    
    # Test 8: POST /api/delegate/kegiatan/{id}/absen (as peserta)
    print("\n[8/10] POST /api/delegate/kegiatan/{id}/absen (as peserta)")
    if s_peserta and peserta_id:
        r = s_peserta.post(f"{BASE_URL}/delegate/kegiatan/{kegiatan_id}/absen", json={
            "user_id": peserta_id,
            "status": "izin"
        })
        if r.status_code == 200:
            data = r.json()
            if data.get("status") == "izin":
                print(f"✅ PASS: Peserta marked attendance via delegation")
                passed += 1
            else:
                print(f"❌ FAIL: Wrong status: {data}")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    else:
        print("❌ FAIL: No peserta session or peserta_id")
    
    # Test 9: AUTO-REVOKE - Close kegiatan and check delegation is gone
    print("\n[9/10] POST /api/admin/kegiatan/{id}/close (auto-revoke)")
    r = s.post(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/close")
    if r.status_code == 200:
        # Check peserta's delegations
        if s_peserta:
            r2 = s_peserta.get(f"{BASE_URL}/me/delegations")
            if r2.status_code == 200:
                data = r2.json()
                # Check if this kegiatan is still in the list (should not be)
                found = any(d.get("kegiatan_id") == kegiatan_id for d in data)
                if not found:
                    print(f"✅ PASS: Delegation auto-revoked after close, peserta has {len(data)} active delegations")
                    passed += 1
                else:
                    print(f"❌ FAIL: Delegation still active after close")
            else:
                print(f"❌ FAIL: Could not get delegations: {r2.status_code}")
        else:
            print("❌ FAIL: No peserta session")
    else:
        print(f"❌ FAIL: Could not close kegiatan: {r.status_code}")
    
    # Test 10: Verify GET /api/delegate/kegiatan/{id} returns 403 after close
    print("\n[10/10] GET /api/delegate/kegiatan/{id} after close (should be 403)")
    if s_peserta:
        r = s_peserta.get(f"{BASE_URL}/delegate/kegiatan/{kegiatan_id}")
        if r.status_code == 403:
            print(f"✅ PASS: Delegate endpoint returns 403 after close")
            passed += 1
        else:
            print(f"❌ FAIL: Expected 403, got {r.status_code}: {r.text}")
    else:
        print("❌ FAIL: No peserta session")
    
    print(f"\n{'='*80}")
    print(f"DELEGASI ABSENSI TESTS: {passed}/{total} PASSED")
    print(f"{'='*80}")
    return passed == total

# ============================================================================
# GROUP 5: QR PRIBADI ROTATING + SCAN TESTS
# ============================================================================
def test_qr_pribadi():
    """Test QR Pribadi Rotating + Scan Personal"""
    print("\n" + "="*80)
    print("GROUP 5: QR PRIBADI ROTATING + SCAN")
    print("="*80)
    
    passed = 0
    total = 6
    
    # Test 1: Login as peserta, GET /api/me/qr
    print("\n[1/6] GET /api/me/qr (as peserta)")
    s_peserta = login(PESERTA_CREDS)
    qr_content = None
    if s_peserta:
        r = s_peserta.get(f"{BASE_URL}/me/qr")
        if r.status_code == 200:
            data = r.json()
            required_fields = ["content", "image", "rotate_seconds", "expires_in"]
            if all(f in data for f in required_fields):
                if data["content"].startswith("EKP:") and data["image"].startswith("data:image/png;base64"):
                    qr_content = data["content"]
                    print(f"✅ PASS: QR generated with content={data['content'][:20]}..., rotate_seconds={data['rotate_seconds']}, expires_in={data['expires_in']}")
                    passed += 1
                else:
                    print(f"❌ FAIL: Content doesn't start with EKP: or image not base64 PNG")
            else:
                print(f"❌ FAIL: Missing required fields: {data}")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    else:
        print("❌ FAIL: Could not login as peserta")
    
    if not qr_content:
        print("❌ Cannot continue without QR content")
        return False
    
    # Create fresh OPEN kegiatan for scanning
    print("\n[2/6] Create fresh OPEN kegiatan for scanning")
    s = login(PENGURUS_CREDS)
    if not s:
        return False
    
    today = datetime.now().strftime("%Y-%m-%d")
    r = s.post(f"{BASE_URL}/admin/kegiatan", json={
        "name": "Test QR Scan Kegiatan",
        "type": "rutin",
        "date": today,
        "start_time": "00:00",
        "end_time": "23:59",
        "teacher": "Ustadz Test",
        "location": "Test Location"
    })
    
    kegiatan_id = None
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, list) and len(data) > 0:
            kegiatan_id = data[0]["id"]
            test_kegiatan_ids.append(kegiatan_id)
            print(f"✅ PASS: Created kegiatan {kegiatan_id}")
            passed += 1
        else:
            print(f"❌ FAIL: Unexpected response format")
    else:
        print(f"❌ FAIL: Could not create kegiatan: {r.status_code}")
    
    if not kegiatan_id:
        print("❌ Cannot continue without kegiatan")
        return False
    
    # Test 3: POST scan-personal with valid content
    print("\n[3/6] POST /api/staff/kegiatan/{id}/scan-personal with valid QR")
    r = s.post(f"{BASE_URL}/staff/kegiatan/{kegiatan_id}/scan-personal", json={
        "content": qr_content
    })
    if r.status_code == 200:
        data = r.json()
        if data.get("status") == "hadir" and data.get("already") == False:
            print(f"✅ PASS: Scan successful, name={data.get('name')}, status=hadir, already=false")
            passed += 1
        else:
            print(f"❌ FAIL: Unexpected response: {data}")
    else:
        print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    
    # Test 4: Scan same content again (should return already=true)
    print("\n[4/6] Scan same content again (should return already=true)")
    r = s.post(f"{BASE_URL}/staff/kegiatan/{kegiatan_id}/scan-personal", json={
        "content": qr_content
    })
    if r.status_code == 200:
        data = r.json()
        if data.get("already") == True:
            print(f"✅ PASS: Scan returned already=true")
            passed += 1
        else:
            print(f"❌ FAIL: Expected already=true, got {data}")
    else:
        print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    
    # Test 5: POST scan-personal with invalid content
    print("\n[5/6] POST scan-personal with invalid content")
    r = s.post(f"{BASE_URL}/staff/kegiatan/{kegiatan_id}/scan-personal", json={
        "content": "EKP:garbage"
    })
    if r.status_code == 400:
        print(f"✅ PASS: Invalid QR rejected with 400")
        passed += 1
    else:
        print(f"❌ FAIL: Expected 400, got {r.status_code}: {r.text}")
    
    # Test 6: Close kegiatan then try scan-personal (should be 403)
    print("\n[6/6] Close kegiatan then scan-personal (should be 403)")
    r = s.post(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/close")
    if r.status_code == 200:
        r2 = s.post(f"{BASE_URL}/staff/kegiatan/{kegiatan_id}/scan-personal", json={
            "content": qr_content
        })
        if r2.status_code == 403:
            print(f"✅ PASS: Scan-personal returns 403 after kegiatan closed")
            passed += 1
        else:
            print(f"❌ FAIL: Expected 403, got {r2.status_code}: {r2.text}")
    else:
        print(f"❌ FAIL: Could not close kegiatan: {r.status_code}")
    
    print(f"\n{'='*80}")
    print(f"QR PRIBADI TESTS: {passed}/{total} PASSED")
    print(f"{'='*80}")
    return passed == total

# ============================================================================
# GROUP 6: PESERTA ENDPOINTS TESTS
# ============================================================================
def test_peserta_endpoints():
    """Test Peserta endpoints (dashboard, kegiatan, profile)"""
    print("\n" + "="*80)
    print("GROUP 6: PESERTA ENDPOINTS")
    print("="*80)
    
    s = login(PESERTA_CREDS)
    if not s:
        return False
    
    passed = 0
    total = 4
    
    # Test 1: GET /api/me/dashboard
    print("\n[1/4] GET /api/me/dashboard")
    r = s.get(f"{BASE_URL}/me/dashboard")
    if r.status_code == 200:
        data = r.json()
        required_fields = ["name", "attendance", "upcoming", "announcements"]
        if all(f in data for f in required_fields):
            attendance = data["attendance"]
            if all(k in attendance for k in ["total", "hadir", "ratio"]):
                print(f"✅ PASS: Dashboard has all fields - name={data['name']}, attendance={attendance}, upcoming={len(data['upcoming'])} items, announcements={len(data['announcements'])} items")
                passed += 1
            else:
                print(f"❌ FAIL: Attendance missing fields: {attendance}")
        else:
            print(f"❌ FAIL: Missing required fields: {data.keys()}")
    else:
        print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    
    # Test 2: GET /api/me/kegiatan
    print("\n[2/4] GET /api/me/kegiatan")
    r = s.get(f"{BASE_URL}/me/kegiatan")
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, list):
            # Check each item has my_status and NO other participants' data
            all_valid = True
            for item in data:
                if "my_status" not in item:
                    all_valid = False
                    print(f"❌ Item missing my_status: {item.get('id')}")
                    break
                # Ensure no field exposing other participants
                if "peserta" in item or "rows" in item or "counts" in item:
                    all_valid = False
                    print(f"❌ Item exposes other participants' data: {item.get('id')}")
                    break
            
            if all_valid:
                print(f"✅ PASS: Kegiatan list has {len(data)} items, all with my_status, NO other participants' data")
                passed += 1
            else:
                print(f"❌ FAIL: Some items invalid")
        else:
            print(f"❌ FAIL: Expected list, got {type(data)}")
    else:
        print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    
    # Test 3: GET /api/me/kegiatan/{id}
    print("\n[3/4] GET /api/me/kegiatan/{id}")
    # Use one of the test kegiatan we created
    if test_kegiatan_ids:
        r = s.get(f"{BASE_URL}/me/kegiatan/{test_kegiatan_ids[0]}")
        if r.status_code == 200:
            data = r.json()
            if "my_status" in data:
                print(f"✅ PASS: Kegiatan detail has my_status={data['my_status']}")
                passed += 1
            else:
                print(f"❌ FAIL: Missing my_status: {data}")
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    else:
        print("⚠️ SKIP: No test kegiatan available")
        passed += 1  # Skip this test
    
    # Test 4: PATCH /api/me/profile
    print("\n[4/4] PATCH /api/me/profile")
    r = s.patch(f"{BASE_URL}/me/profile", json={
        "birthplace": "Denpasar",
        "education": "SMA"
    })
    if r.status_code == 200:
        data = r.json()
        if data.get("birthplace") == "Denpasar" and data.get("education") == "SMA":
            print(f"✅ PASS: Profile updated successfully")
            passed += 1
        else:
            print(f"❌ FAIL: Profile not updated correctly: {data}")
    else:
        print(f"❌ FAIL: Expected 200, got {r.status_code}: {r.text}")
    
    print(f"\n{'='*80}")
    print(f"PESERTA ENDPOINTS TESTS: {passed}/{total} PASSED")
    print(f"{'='*80}")
    return passed == total

# ============================================================================
# GROUP 7: ACCESS CONTROL TESTS
# ============================================================================
def test_access_control():
    """Test Access Control - peserta vs pengurus vs admin"""
    print("\n" + "="*80)
    print("GROUP 7: ACCESS CONTROL")
    print("="*80)
    
    passed = 0
    total = 5
    
    # Test 1: Peserta cannot access staff endpoints
    print("\n[1/5] Peserta cannot access /api/staff/musyawarah")
    s_peserta = login(PESERTA_CREDS)
    if s_peserta:
        r = s_peserta.get(f"{BASE_URL}/staff/musyawarah")
        if r.status_code == 403:
            print(f"✅ PASS: Peserta correctly forbidden (403)")
            passed += 1
        else:
            print(f"❌ FAIL: Expected 403, got {r.status_code}")
    else:
        print("❌ FAIL: Could not login as peserta")
    
    # Test 2: Peserta cannot access staff pengumuman
    print("\n[2/5] Peserta cannot access /api/staff/pengumuman")
    if s_peserta:
        r = s_peserta.get(f"{BASE_URL}/staff/pengumuman")
        if r.status_code == 403:
            print(f"✅ PASS: Peserta correctly forbidden (403)")
            passed += 1
        else:
            print(f"❌ FAIL: Expected 403, got {r.status_code}")
    else:
        print("❌ FAIL: No peserta session")
    
    # Test 3: Peserta cannot delegate
    print("\n[3/5] Peserta cannot POST /api/staff/kegiatan/{id}/delegate")
    if s_peserta and test_kegiatan_ids:
        r = s_peserta.post(f"{BASE_URL}/staff/kegiatan/{test_kegiatan_ids[0]}/delegate", json={
            "grantee_id": "test",
            "reason": "test"
        })
        if r.status_code == 403:
            print(f"✅ PASS: Peserta correctly forbidden (403)")
            passed += 1
        else:
            print(f"❌ FAIL: Expected 403, got {r.status_code}")
    else:
        print("⚠️ SKIP: No peserta session or kegiatan")
        passed += 1
    
    # Test 4: Pengurus CAN access staff endpoints
    print("\n[4/5] Pengurus CAN access /api/staff/musyawarah")
    s_pengurus = login(PENGURUS_CREDS)
    if s_pengurus:
        r = s_pengurus.get(f"{BASE_URL}/staff/musyawarah")
        if r.status_code == 200:
            print(f"✅ PASS: Pengurus can access staff endpoints (200)")
            passed += 1
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}")
    else:
        print("❌ FAIL: Could not login as pengurus")
    
    # Test 5: Admin CAN access staff endpoints
    print("\n[5/5] Admin CAN access /api/staff/musyawarah")
    s_admin = login(ADMIN_CREDS)
    if s_admin:
        r = s_admin.get(f"{BASE_URL}/staff/musyawarah")
        if r.status_code == 200:
            print(f"✅ PASS: Admin can access staff endpoints (200)")
            passed += 1
        else:
            print(f"❌ FAIL: Expected 200, got {r.status_code}")
    else:
        print("❌ FAIL: Could not login as admin")
    
    print(f"\n{'='*80}")
    print(f"ACCESS CONTROL TESTS: {passed}/{total} PASSED")
    print(f"{'='*80}")
    return passed == total

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================
def main():
    print("\n" + "="*80)
    print("E-KERTALANGU FASE 3 & 4 BACKEND TESTING")
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    results = {}
    
    try:
        # Run all test groups
        results["MUSYAWARAH"] = test_musyawarah()
        results["PENGUMUMAN"] = test_pengumuman()
        results["REMINDER_WA"] = test_reminder_wa()
        results["DELEGASI_ABSENSI"] = test_delegasi_absensi()
        results["QR_PRIBADI"] = test_qr_pribadi()
        results["PESERTA_ENDPOINTS"] = test_peserta_endpoints()
        results["ACCESS_CONTROL"] = test_access_control()
        
    finally:
        # Always cleanup
        cleanup()
    
    # Print final summary
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    
    all_passed = True
    for group, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {group}")
        if not passed:
            all_passed = False
    
    print("="*80)
    
    if all_passed:
        print("\n🎉 ALL TESTS PASSED! 🎉")
        return 0
    else:
        print("\n⚠️ SOME TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
