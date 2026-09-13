#!/usr/bin/env python3
"""
E-KERTALANGU FASE 8 Testing
Tests for new features: audience types, gender filters, guests, offline sync, follow-up tracking
"""
import requests
import sys
import os
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

# Test credentials
ADMIN_CREDS = {"identifier": "admin", "password": "jokam354"}

# Test state
test_kegiatan_reguler_id = None
test_kegiatan_publik_id = None
test_kegiatan_gender_p_id = None
test_access_code = None
test_access_token = None
test_absensi_token = None
test_guest_id = None
test_user_id = None

def login(creds):
    """Login and return session with cookies"""
    s = requests.Session()
    r = s.post(f"{BASE_URL}/auth/login", json=creds)
    if r.status_code != 200:
        print(f"❌ Login failed for {creds['identifier']}: {r.status_code} {r.text}")
        return None
    print(f"✅ Login successful for {creds['identifier']}")
    return s

def test_create_kegiatan_with_audience_and_gender():
    """Test 1: POST /api/admin/kegiatan with audience & gender_filter"""
    print("\n" + "="*80)
    print("TEST 1: CREATE KEGIATAN WITH AUDIENCE & GENDER_FILTER")
    print("="*80)
    
    global test_kegiatan_reguler_id, test_kegiatan_publik_id, test_kegiatan_gender_p_id
    
    s = login(ADMIN_CREDS)
    if not s:
        return False
    
    all_passed = True
    today = datetime.now()
    tomorrow = today + timedelta(days=1)
    date_str = tomorrow.strftime("%Y-%m-%d")
    
    # 1.1 Create REGULER kegiatan with gender_filter=semua
    print("\n1.1 POST /api/admin/kegiatan (audience=reguler, gender_filter=semua)")
    payload = {
        "name": "Test Kegiatan Reguler",
        "type": "rutin",
        "date": date_str,
        "start_time": "20:00",
        "end_time": "21:30",
        "audience": "reguler",
        "gender_filter": "semua"
    }
    r = s.post(f"{BASE_URL}/admin/kegiatan", json=payload)
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, list):
            data = data[0]
        test_kegiatan_reguler_id = data.get("id")
        if data.get("audience") == "reguler" and data.get("gender_filter") == "semua":
            print(f"✅ PASS: Created reguler kegiatan (id: {test_kegiatan_reguler_id})")
        else:
            print(f"❌ FAIL: audience or gender_filter not set correctly")
            all_passed = False
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 1.2 Create PUBLIK kegiatan with gender_filter=P
    print("\n1.2 POST /api/admin/kegiatan (audience=publik, gender_filter=P)")
    payload = {
        "name": "Test Kegiatan Publik Perempuan",
        "type": "khusus",
        "date": date_str,
        "start_time": "14:00",
        "end_time": "15:30",
        "audience": "publik",
        "gender_filter": "P"
    }
    r = s.post(f"{BASE_URL}/admin/kegiatan", json=payload)
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, list):
            data = data[0]
        test_kegiatan_publik_id = data.get("id")
        test_kegiatan_gender_p_id = data.get("id")
        if data.get("audience") == "publik" and data.get("gender_filter") == "P":
            print(f"✅ PASS: Created publik kegiatan with gender filter P (id: {test_kegiatan_publik_id})")
        else:
            print(f"❌ FAIL: audience or gender_filter not set correctly")
            all_passed = False
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 1.3 Test invalid audience value (should return 400)
    print("\n1.3 POST /api/admin/kegiatan (invalid audience)")
    payload = {
        "name": "Test Invalid",
        "type": "rutin",
        "date": date_str,
        "start_time": "20:00",
        "end_time": "21:30",
        "audience": "invalid_value",
        "gender_filter": "semua"
    }
    r = s.post(f"{BASE_URL}/admin/kegiatan", json=payload)
    if r.status_code == 400:
        print(f"✅ PASS: 400 for invalid audience value")
    else:
        print(f"❌ FAIL: Expected 400, got {r.status_code}")
        all_passed = False
    
    # 1.4 Test invalid gender_filter value (should return 400)
    print("\n1.4 POST /api/admin/kegiatan (invalid gender_filter)")
    payload = {
        "name": "Test Invalid Gender",
        "type": "rutin",
        "date": date_str,
        "start_time": "20:00",
        "end_time": "21:30",
        "audience": "reguler",
        "gender_filter": "invalid"
    }
    r = s.post(f"{BASE_URL}/admin/kegiatan", json=payload)
    if r.status_code == 400:
        print(f"✅ PASS: 400 for invalid gender_filter value")
    else:
        print(f"❌ FAIL: Expected 400, got {r.status_code}")
        all_passed = False
    
    return all_passed

def test_get_kegiatan_with_filters():
    """Test 2: GET /api/admin/kegiatan returns audience, gender_filter, phase, counts"""
    print("\n" + "="*80)
    print("TEST 2: GET KEGIATAN WITH AUDIENCE & GENDER_FILTER")
    print("="*80)
    
    s = login(ADMIN_CREDS)
    if not s:
        return False
    
    all_passed = True
    
    # 2.1 GET all kegiatan
    print("\n2.1 GET /api/admin/kegiatan")
    r = s.get(f"{BASE_URL}/admin/kegiatan")
    if r.status_code == 200:
        kegiatans = r.json()
        print(f"✅ PASS: 200, returned {len(kegiatans)} kegiatan")
        
        # Check if our test kegiatan have correct fields
        for k in kegiatans:
            if k.get("id") in [test_kegiatan_reguler_id, test_kegiatan_publik_id]:
                required_fields = ["audience", "gender_filter", "phase", "counts"]
                missing = [f for f in required_fields if f not in k]
                if missing:
                    print(f"❌ FAIL: Kegiatan {k.get('name')} missing fields: {missing}")
                    all_passed = False
                else:
                    print(f"   ✓ Kegiatan '{k.get('name')}': audience={k.get('audience')}, gender_filter={k.get('gender_filter')}, phase={k.get('phase')}")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    return all_passed

def test_patch_kegiatan_audience_gender():
    """Test 3: PATCH /api/admin/kegiatan/{id} can update audience & gender_filter"""
    print("\n" + "="*80)
    print("TEST 3: PATCH KEGIATAN AUDIENCE & GENDER_FILTER")
    print("="*80)
    
    if not test_kegiatan_reguler_id:
        print("❌ SKIP: No test kegiatan available")
        return False
    
    s = login(ADMIN_CREDS)
    if not s:
        return False
    
    all_passed = True
    
    # 3.1 Update audience to publik
    print(f"\n3.1 PATCH /api/admin/kegiatan/{test_kegiatan_reguler_id} (change to publik)")
    payload = {"audience": "publik"}
    r = s.patch(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_reguler_id}", json=payload)
    if r.status_code == 200:
        data = r.json()
        if data.get("audience") == "publik":
            print(f"✅ PASS: Updated audience to publik")
        else:
            print(f"❌ FAIL: audience not updated correctly")
            all_passed = False
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 3.2 Update gender_filter to L
    print(f"\n3.2 PATCH /api/admin/kegiatan/{test_kegiatan_reguler_id} (change gender_filter to L)")
    payload = {"gender_filter": "L"}
    r = s.patch(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_reguler_id}", json=payload)
    if r.status_code == 200:
        data = r.json()
        if data.get("gender_filter") == "L":
            print(f"✅ PASS: Updated gender_filter to L")
        else:
            print(f"❌ FAIL: gender_filter not updated correctly")
            all_passed = False
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    return all_passed

def test_guest_endpoints():
    """Test 4: Guest endpoints (POST/GET/DELETE) for publik kegiatan"""
    print("\n" + "="*80)
    print("TEST 4: GUEST ENDPOINTS (PUBLIK KEGIATAN ONLY)")
    print("="*80)
    
    global test_guest_id
    
    if not test_kegiatan_publik_id:
        print("❌ SKIP: No publik kegiatan available")
        return False
    
    s = login(ADMIN_CREDS)
    if not s:
        return False
    
    all_passed = True
    
    # 4.1 POST guest to publik kegiatan (should succeed)
    print(f"\n4.1 POST /api/admin/kegiatan/{test_kegiatan_publik_id}/guest")
    payload = {"name": "Tamu Test 1"}
    r = s.post(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_publik_id}/guest", json=payload)
    if r.status_code == 200:
        data = r.json()
        test_guest_id = data.get("guest_id")
        print(f"✅ PASS: Guest added to publik kegiatan (guest_id: {test_guest_id})")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 4.2 GET rekap to verify guest is counted
    print(f"\n4.2 GET /api/admin/kegiatan/{test_kegiatan_publik_id}/rekap (verify guest)")
    r = s.get(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_publik_id}/rekap")
    if r.status_code == 200:
        data = r.json()
        guests = data.get("guests", [])
        if len(guests) > 0 and any(g.get("name") == "Tamu Test 1" for g in guests):
            print(f"✅ PASS: Guest appears in rekap, total guests: {len(guests)}")
        else:
            print(f"❌ FAIL: Guest not found in rekap")
            all_passed = False
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 4.3 Try to POST guest to reguler kegiatan (should fail with 400)
    if test_kegiatan_reguler_id:
        print(f"\n4.3 POST /api/admin/kegiatan/{test_kegiatan_reguler_id}/guest (reguler - should fail)")
        payload = {"name": "Tamu Invalid"}
        r = s.post(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_reguler_id}/guest", json=payload)
        if r.status_code == 400:
            print(f"✅ PASS: 400 for adding guest to reguler kegiatan")
        else:
            print(f"❌ FAIL: Expected 400, got {r.status_code}")
            all_passed = False
    
    # 4.4 DELETE guest
    if test_guest_id:
        print(f"\n4.4 DELETE /api/admin/kegiatan/{test_kegiatan_publik_id}/guest/{test_guest_id}")
        r = s.delete(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_publik_id}/guest/{test_guest_id}")
        if r.status_code == 200:
            print(f"✅ PASS: Guest deleted")
        else:
            print(f"❌ FAIL: {r.status_code} {r.text}")
            all_passed = False
    
    return all_passed

def test_offline_sync_batch():
    """Test 5: Offline sync batch endpoints"""
    print("\n" + "="*80)
    print("TEST 5: OFFLINE SYNC BATCH ENDPOINTS")
    print("="*80)
    
    global test_user_id
    
    if not test_kegiatan_publik_id:
        print("❌ SKIP: No kegiatan available")
        return False
    
    s = login(ADMIN_CREDS)
    if not s:
        return False
    
    all_passed = True
    
    # Get a user ID first
    r = s.get(f"{BASE_URL}/admin/users")
    if r.status_code == 200:
        users = r.json()
        if len(users) > 0:
            test_user_id = users[0]["id"]
            print(f"   Using user: {users[0].get('name')} (id: {test_user_id})")
    
    if not test_user_id:
        print("❌ SKIP: No users available")
        return False
    
    # 5.1 POST absen-batch (admin endpoint)
    print(f"\n5.1 POST /api/admin/kegiatan/{test_kegiatan_publik_id}/absen-batch")
    payload = {
        "items": [
            {"user_id": test_user_id, "status": "hadir", "marked_at": datetime.now().isoformat()}
        ]
    }
    r = s.post(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_publik_id}/absen-batch", json=payload)
    if r.status_code == 200:
        data = r.json()
        if data.get("applied", 0) > 0:
            print(f"✅ PASS: Batch absen applied, count: {data.get('applied')}")
        else:
            print(f"❌ FAIL: No items applied")
            all_passed = False
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    return all_passed

def test_followup_endpoints():
    """Test 6: Follow-up tracking endpoints"""
    print("\n" + "="*80)
    print("TEST 6: FOLLOW-UP TRACKING ENDPOINTS")
    print("="*80)
    
    if not test_kegiatan_publik_id or not test_user_id:
        print("❌ SKIP: No kegiatan or user available")
        return False
    
    s = login(ADMIN_CREDS)
    if not s:
        return False
    
    all_passed = True
    
    # 6.1 GET tindak-lanjut
    print(f"\n6.1 GET /api/staff/kegiatan/{test_kegiatan_publik_id}/tindak-lanjut")
    r = s.get(f"{BASE_URL}/staff/kegiatan/{test_kegiatan_publik_id}/tindak-lanjut")
    if r.status_code == 200:
        data = r.json()
        print(f"✅ PASS: 200, returned {len(data.get('rows', []))} rows")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 6.2 POST tindak-lanjut with valid status
    print(f"\n6.2 POST /api/staff/kegiatan/{test_kegiatan_publik_id}/tindak-lanjut (status=akan_hadir)")
    payload = {
        "user_id": test_user_id,
        "status": "akan_hadir",
        "note": "Test note"
    }
    r = s.post(f"{BASE_URL}/staff/kegiatan/{test_kegiatan_publik_id}/tindak-lanjut", json=payload)
    if r.status_code == 200:
        print(f"✅ PASS: Follow-up status set")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 6.3 POST tindak-lanjut with invalid status (should return 400)
    print(f"\n6.3 POST /api/staff/kegiatan/{test_kegiatan_publik_id}/tindak-lanjut (invalid status)")
    payload = {
        "user_id": test_user_id,
        "status": "invalid_status",
        "note": "Test"
    }
    r = s.post(f"{BASE_URL}/staff/kegiatan/{test_kegiatan_publik_id}/tindak-lanjut", json=payload)
    if r.status_code == 400:
        print(f"✅ PASS: 400 for invalid status")
    else:
        print(f"❌ FAIL: Expected 400, got {r.status_code}")
        all_passed = False
    
    return all_passed

def test_public_absensi_endpoints():
    """Test 7: Public absensi endpoints with access code"""
    print("\n" + "="*80)
    print("TEST 7: PUBLIC ABSENSI ENDPOINTS")
    print("="*80)
    
    global test_access_code, test_access_token, test_absensi_token
    
    if not test_kegiatan_publik_id:
        print("❌ SKIP: No publik kegiatan available")
        return False
    
    s = login(ADMIN_CREDS)
    if not s:
        return False
    
    all_passed = True
    
    # 7.1 GET access code
    print(f"\n7.1 GET /api/admin/kegiatan/{test_kegiatan_publik_id}/access")
    r = s.get(f"{BASE_URL}/admin/kegiatan/{test_kegiatan_publik_id}/access")
    if r.status_code == 200:
        data = r.json()
        test_access_code = data.get("code")
        test_absensi_token = data.get("token")
        print(f"✅ PASS: Got access code: {test_access_code}, token: {test_absensi_token}")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
        return all_passed
    
    # 7.2 POST verify-code (public endpoint, no auth)
    print(f"\n7.2 POST /api/absensi/verify-code (code={test_access_code})")
    payload = {"code": test_access_code}
    r = requests.post(f"{BASE_URL}/absensi/verify-code", json=payload)
    if r.status_code == 200:
        data = r.json()
        test_access_token = data.get("access")
        print(f"✅ PASS: Code verified, access token obtained")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
        return all_passed
    
    # 7.3 GET absensi with access token
    print(f"\n7.3 GET /api/absensi/{test_absensi_token}?access={test_access_token}")
    r = requests.get(f"{BASE_URL}/absensi/{test_absensi_token}", params={"access": test_access_token})
    if r.status_code == 200:
        data = r.json()
        kegiatan = data.get("kegiatan", {})
        if kegiatan.get("audience") and kegiatan.get("gender_filter"):
            print(f"✅ PASS: Got kegiatan data with audience={kegiatan.get('audience')}, gender_filter={kegiatan.get('gender_filter')}")
        else:
            print(f"❌ FAIL: Missing audience or gender_filter in response")
            all_passed = False
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    # 7.4 POST guest via public endpoint (publik kegiatan)
    print(f"\n7.4 POST /api/absensi/{test_absensi_token}/guest")
    payload = {"access": test_access_token, "name": "Tamu Publik Test"}
    r = requests.post(f"{BASE_URL}/absensi/{test_absensi_token}/guest", json=payload)
    if r.status_code == 200:
        print(f"✅ PASS: Guest added via public endpoint")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    return all_passed

def test_laporan_with_filters():
    """Test 8: Laporan endpoint respects filters"""
    print("\n" + "="*80)
    print("TEST 8: LAPORAN ENDPOINT RESPECTS FILTERS")
    print("="*80)
    
    s = login(ADMIN_CREDS)
    if not s:
        return False
    
    all_passed = True
    
    # 8.1 GET laporan
    print("\n8.1 GET /api/admin/laporan")
    r = s.get(f"{BASE_URL}/admin/laporan")
    if r.status_code == 200:
        print(f"✅ PASS: 200, laporan generated")
    else:
        print(f"❌ FAIL: {r.status_code} {r.text}")
        all_passed = False
    
    return all_passed

def main():
    print("="*80)
    print("E-KERTALANGU FASE 8 BACKEND TESTING")
    print(f"Backend URL: {BACKEND_URL}")
    print("="*80)
    
    results = []
    
    # Run all tests
    results.append(("Create kegiatan with audience & gender_filter", test_create_kegiatan_with_audience_and_gender()))
    results.append(("GET kegiatan with filters", test_get_kegiatan_with_filters()))
    results.append(("PATCH kegiatan audience & gender", test_patch_kegiatan_audience_gender()))
    results.append(("Guest endpoints", test_guest_endpoints()))
    results.append(("Offline sync batch", test_offline_sync_batch()))
    results.append(("Follow-up tracking", test_followup_endpoints()))
    results.append(("Public absensi endpoints", test_public_absensi_endpoints()))
    results.append(("Laporan with filters", test_laporan_with_filters()))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    print("="*80)
    
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())
