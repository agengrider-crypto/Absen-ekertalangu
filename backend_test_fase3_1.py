#!/usr/bin/env python3
"""
Backend Testing for Fase 3.1 - E-KERTALANGU
Tests:
1. DELEGASI reason NOW OPTIONAL (empty reason should return 200)
2. MUSYAWARAH combined PDF export (new route /api/staff/musyawarah-export-pdf)
3. PESERTA attendance-history (new endpoint /api/me/attendance-history?months=6)
4. ACCESS control (peserta should get 403 on /api/staff/musyawarah-export-pdf)
"""

import requests
from datetime import datetime, timedelta

# Base URL from frontend/.env
BASE_URL = "https://peserta-absen-qr.preview.emergentagent.com/api"

# Test credentials from /app/memory/test_credentials.md
ADMIN_CREDS = {"identifier": "admin", "password": "jokam354"}
PENGURUS_CREDS = {"identifier": "pengurus", "password": "Pengurus#2026"}
PESERTA_CREDS = {"identifier": "peserta", "password": "Peserta#2026"}

# Track created resources for cleanup
created_kegiatan_ids = []
created_musyawarah_ids = []

def login(credentials):
    """Login and return session with cookies"""
    session = requests.Session()
    resp = session.post(f"{BASE_URL}/auth/login", json=credentials)
    if resp.status_code != 200:
        raise Exception(f"Login failed: {resp.status_code} {resp.text}")
    return session

def get_today_date():
    """Get today's date in YYYY-MM-DD format"""
    return datetime.now().strftime("%Y-%m-%d")

def cleanup():
    """Clean up all created test data"""
    print("\n" + "="*80)
    print("CLEANUP: Deleting test data...")
    print("="*80)
    
    pengurus_session = login(PENGURUS_CREDS)
    
    # Delete kegiatan
    for kid in created_kegiatan_ids:
        resp = pengurus_session.delete(f"{BASE_URL}/admin/kegiatan/{kid}")
        print(f"  DELETE kegiatan {kid}: {resp.status_code}")
    
    # Delete musyawarah notes
    for mid in created_musyawarah_ids:
        resp = pengurus_session.delete(f"{BASE_URL}/staff/musyawarah/{mid}")
        print(f"  DELETE musyawarah {mid}: {resp.status_code}")
    
    print("Cleanup complete.\n")

def test_1_delegasi_reason_optional():
    """
    TEST 1: DELEGASI reason NOW OPTIONAL
    - Create OPEN kegiatan today
    - Get peserta user_id from rekap
    - POST delegate with empty reason -> EXPECT 200 (previously 400)
    - POST delegate with reason -> 200
    - GET delegations -> 200
    """
    print("\n" + "="*80)
    print("TEST 1: DELEGASI REASON NOW OPTIONAL")
    print("="*80)
    
    pengurus_session = login(PENGURUS_CREDS)
    
    # Step 1: Create OPEN kegiatan today
    print("\n[1.1] Creating OPEN kegiatan today...")
    today = get_today_date()
    kegiatan_data = {
        "name": "Test Delegasi Reason Optional",
        "type": "rutin",
        "date": today,
        "start_time": "00:00",
        "end_time": "23:59",
        "location": "Masjid"
    }
    resp = pengurus_session.post(f"{BASE_URL}/admin/kegiatan", json=kegiatan_data)
    print(f"  POST /admin/kegiatan: {resp.status_code}")
    assert resp.status_code == 200, f"Failed to create kegiatan: {resp.text}"
    
    # Extract kegiatan_id from response (could be single object or list)
    resp_data = resp.json()
    if isinstance(resp_data, list):
        kegiatan_id = resp_data[0]["id"]
    else:
        kegiatan_id = resp_data["id"]
    created_kegiatan_ids.append(kegiatan_id)
    print(f"  ✓ Created kegiatan: {kegiatan_id}")
    
    # Step 2: Get peserta user_id from rekap
    print("\n[1.2] Getting peserta user_id from rekap...")
    resp = pengurus_session.get(f"{BASE_URL}/admin/kegiatan/{kegiatan_id}/rekap")
    print(f"  GET /admin/kegiatan/{kegiatan_id}/rekap: {resp.status_code}")
    assert resp.status_code == 200, f"Failed to get rekap: {resp.text}"
    
    rekap = resp.json()
    assert "rows" in rekap and len(rekap["rows"]) > 0, "No peserta in rekap"
    peserta_id = rekap["rows"][0]["user_id"]
    print(f"  ✓ Found peserta: {peserta_id}")
    
    # Step 3: POST delegate with EMPTY reason -> EXPECT 200 (previously 400)
    print("\n[1.3] POST delegate with EMPTY reason (should return 200)...")
    delegate_data = {
        "grantee_id": peserta_id,
        "reason": ""
    }
    resp = pengurus_session.post(f"{BASE_URL}/staff/kegiatan/{kegiatan_id}/delegate", json=delegate_data)
    print(f"  POST /staff/kegiatan/{kegiatan_id}/delegate (empty reason): {resp.status_code}")
    print(f"  Response: {resp.json()}")
    assert resp.status_code == 200, f"FAILED: Empty reason should return 200, got {resp.status_code}: {resp.text}"
    
    delegation = resp.json()
    assert delegation["active"] == True, "Delegation should be active"
    print(f"  ✓ PASS: Empty reason accepted (200), delegation active: {delegation['active']}")
    
    # Step 4: POST delegate with reason -> 200
    print("\n[1.4] POST delegate with valid reason...")
    delegate_data = {
        "grantee_id": peserta_id,
        "reason": "punya alasan"
    }
    resp = pengurus_session.post(f"{BASE_URL}/staff/kegiatan/{kegiatan_id}/delegate", json=delegate_data)
    print(f"  POST /staff/kegiatan/{kegiatan_id}/delegate (with reason): {resp.status_code}")
    assert resp.status_code == 200, f"Failed to delegate with reason: {resp.text}"
    print(f"  ✓ PASS: Delegation with reason successful")
    
    # Step 5: GET delegations -> 200
    print("\n[1.5] GET delegations list...")
    resp = pengurus_session.get(f"{BASE_URL}/staff/kegiatan/{kegiatan_id}/delegations")
    print(f"  GET /staff/kegiatan/{kegiatan_id}/delegations: {resp.status_code}")
    assert resp.status_code == 200, f"Failed to get delegations: {resp.text}"
    
    delegations = resp.json()
    assert len(delegations) >= 1, "Should have at least 1 delegation"
    print(f"  ✓ PASS: Found {len(delegations)} delegation(s)")
    
    print("\n✅ TEST 1 PASSED: Delegasi reason is now OPTIONAL")

def test_2_musyawarah_combined_pdf():
    """
    TEST 2: MUSYAWARAH combined PDF export
    - Create 2 musyawarah notes category "4S" with distinct dates
    - GET /api/staff/musyawarah-export-pdf?category=4S&date_from=...&date_to=... -> 200, application/pdf
    - GET /api/staff/musyawarah-export-pdf (no params) -> 200, application/pdf
    - REGRESSION: GET /api/staff/musyawarah/{id}/pdf (single note) -> 200, application/pdf
    """
    print("\n" + "="*80)
    print("TEST 2: MUSYAWARAH COMBINED PDF EXPORT")
    print("="*80)
    
    pengurus_session = login(PENGURUS_CREDS)
    
    # Step 1: Create 2 musyawarah notes with distinct dates
    print("\n[2.1] Creating 2 musyawarah notes (category 4S)...")
    
    note1_data = {
        "category": "4S",
        "date": "2026-01-05",
        "content": "catatan A"
    }
    resp = pengurus_session.post(f"{BASE_URL}/staff/musyawarah", json=note1_data)
    print(f"  POST /staff/musyawarah (note 1): {resp.status_code}")
    assert resp.status_code == 200, f"Failed to create note 1: {resp.text}"
    note1_id = resp.json()["id"]
    created_musyawarah_ids.append(note1_id)
    print(f"  ✓ Created note 1: {note1_id}")
    
    note2_data = {
        "category": "4S",
        "date": "2026-01-20",
        "content": "catatan B"
    }
    resp = pengurus_session.post(f"{BASE_URL}/staff/musyawarah", json=note2_data)
    print(f"  POST /staff/musyawarah (note 2): {resp.status_code}")
    assert resp.status_code == 200, f"Failed to create note 2: {resp.text}"
    note2_id = resp.json()["id"]
    created_musyawarah_ids.append(note2_id)
    print(f"  ✓ Created note 2: {note2_id}")
    
    # Step 2: GET combined PDF with filters
    print("\n[2.2] GET combined PDF with category and date filters...")
    params = {
        "category": "4S",
        "date_from": "2026-01-01",
        "date_to": "2026-01-31"
    }
    resp = pengurus_session.get(f"{BASE_URL}/staff/musyawarah-export-pdf", params=params)
    print(f"  GET /staff/musyawarah-export-pdf?category=4S&date_from=2026-01-01&date_to=2026-01-31: {resp.status_code}")
    assert resp.status_code == 200, f"Failed to get combined PDF: {resp.text}"
    assert resp.headers.get("Content-Type") == "application/pdf", f"Wrong content type: {resp.headers.get('Content-Type')}"
    assert len(resp.content) > 0, "PDF content is empty"
    print(f"  ✓ PASS: Combined PDF returned, Content-Type: application/pdf, Size: {len(resp.content)} bytes")
    
    # Step 3: GET combined PDF without params (all categories)
    print("\n[2.3] GET combined PDF without params (all categories)...")
    resp = pengurus_session.get(f"{BASE_URL}/staff/musyawarah-export-pdf")
    print(f"  GET /staff/musyawarah-export-pdf (no params): {resp.status_code}")
    assert resp.status_code == 200, f"Failed to get combined PDF: {resp.text}"
    assert resp.headers.get("Content-Type") == "application/pdf", f"Wrong content type: {resp.headers.get('Content-Type')}"
    assert len(resp.content) > 0, "PDF content is empty"
    print(f"  ✓ PASS: Combined PDF (all categories) returned, Size: {len(resp.content)} bytes")
    
    # Step 4: REGRESSION - Single note PDF should still work
    print("\n[2.4] REGRESSION: GET single note PDF (existing route)...")
    resp = pengurus_session.get(f"{BASE_URL}/staff/musyawarah/{note1_id}/pdf")
    print(f"  GET /staff/musyawarah/{note1_id}/pdf: {resp.status_code}")
    assert resp.status_code == 200, f"REGRESSION FAILED: Single note PDF broken: {resp.text}"
    assert resp.headers.get("Content-Type") == "application/pdf", f"Wrong content type: {resp.headers.get('Content-Type')}"
    assert len(resp.content) > 0, "PDF content is empty"
    print(f"  ✓ PASS: Single note PDF still works, Size: {len(resp.content)} bytes")
    
    print("\n✅ TEST 2 PASSED: Musyawarah combined PDF export working, single PDF route not broken")

def test_3_peserta_attendance_history():
    """
    TEST 3: PESERTA attendance-history
    - Login as peserta
    - GET /api/me/attendance-history?months=6 -> 200 with correct structure
    - Verify months array length 6, chronological order
    - Verify current month data
    - Verify hadir+izin+alpha <= total
    - GET with months=3 -> length 3
    - GET with months=99 -> clamped to 12
    """
    print("\n" + "="*80)
    print("TEST 3: PESERTA ATTENDANCE-HISTORY")
    print("="*80)
    
    peserta_session = login(PESERTA_CREDS)
    
    # Step 1: GET attendance-history with months=6
    print("\n[3.1] GET /api/me/attendance-history?months=6...")
    resp = peserta_session.get(f"{BASE_URL}/me/attendance-history", params={"months": 6})
    print(f"  GET /me/attendance-history?months=6: {resp.status_code}")
    assert resp.status_code == 200, f"Failed to get attendance history: {resp.text}"
    
    data = resp.json()
    print(f"  Response keys: {list(data.keys())}")
    
    # Verify structure
    assert "months" in data, "Missing 'months' field"
    assert "current" in data, "Missing 'current' field"
    
    months = data["months"]
    current = data["current"]
    
    print(f"  ✓ Structure correct: months (array), current (object)")
    
    # Verify months array length
    assert len(months) == 6, f"Expected 6 months, got {len(months)}"
    print(f"  ✓ Months array length: {len(months)}")
    
    # Verify each month has required fields
    print("\n[3.2] Verifying month data structure...")
    for i, month in enumerate(months):
        assert "month" in month, f"Month {i} missing 'month' field"
        assert "label" in month, f"Month {i} missing 'label' field"
        assert "hadir" in month, f"Month {i} missing 'hadir' field"
        assert "izin" in month, f"Month {i} missing 'izin' field"
        assert "alpha" in month, f"Month {i} missing 'alpha' field"
        assert "total" in month, f"Month {i} missing 'total' field"
        
        # Verify hadir+izin+alpha <= total
        hadir = month["hadir"]
        izin = month["izin"]
        alpha = month["alpha"]
        total = month["total"]
        assert hadir + izin + alpha <= total, f"Month {i}: hadir({hadir})+izin({izin})+alpha({alpha}) > total({total})"
        assert alpha >= 0, f"Month {i}: alpha should be non-negative, got {alpha}"
        
        print(f"  Month {i+1}: {month['month']} ({month['label']}) - hadir:{hadir}, izin:{izin}, alpha:{alpha}, total:{total}")
    
    print(f"  ✓ All months have correct structure and valid data")
    
    # Verify chronological order (oldest first)
    print("\n[3.3] Verifying chronological order (oldest first)...")
    for i in range(len(months) - 1):
        assert months[i]["month"] < months[i+1]["month"], f"Months not in chronological order: {months[i]['month']} >= {months[i+1]['month']}"
    print(f"  ✓ Months are chronological: {months[0]['month']} -> {months[-1]['month']}")
    
    # Verify last month corresponds to current month
    print("\n[3.4] Verifying current month data...")
    now = datetime.now()
    current_month_str = now.strftime("%Y-%m")
    last_month = months[-1]
    assert last_month["month"] == current_month_str, f"Last month {last_month['month']} != current month {current_month_str}"
    print(f"  ✓ Last month matches current month: {current_month_str}")
    
    # Verify current object
    assert "hadir" in current, "Current missing 'hadir'"
    assert "izin" in current, "Current missing 'izin'"
    assert "alpha" in current, "Current missing 'alpha'"
    assert "total" in current, "Current missing 'total'"
    print(f"  ✓ Current data: hadir:{current['hadir']}, izin:{current['izin']}, alpha:{current['alpha']}, total:{current['total']}")
    
    # Step 2: GET with months=3
    print("\n[3.5] GET /api/me/attendance-history?months=3...")
    resp = peserta_session.get(f"{BASE_URL}/me/attendance-history", params={"months": 3})
    print(f"  GET /me/attendance-history?months=3: {resp.status_code}")
    assert resp.status_code == 200, f"Failed: {resp.text}"
    data = resp.json()
    assert len(data["months"]) == 3, f"Expected 3 months, got {len(data['months'])}"
    print(f"  ✓ PASS: months=3 returns 3 months")
    
    # Step 3: GET with months=99 (should be clamped to 12)
    print("\n[3.6] GET /api/me/attendance-history?months=99 (should clamp to 12)...")
    resp = peserta_session.get(f"{BASE_URL}/me/attendance-history", params={"months": 99})
    print(f"  GET /me/attendance-history?months=99: {resp.status_code}")
    assert resp.status_code == 200, f"Failed: {resp.text}"
    data = resp.json()
    assert len(data["months"]) == 12, f"Expected 12 months (clamped), got {len(data['months'])}"
    print(f"  ✓ PASS: months=99 clamped to 12")
    
    print("\n✅ TEST 3 PASSED: Peserta attendance-history working correctly")

def test_4_access_control():
    """
    TEST 4: ACCESS CONTROL
    - Login as peserta
    - GET /api/staff/musyawarah-export-pdf -> 403
    """
    print("\n" + "="*80)
    print("TEST 4: ACCESS CONTROL")
    print("="*80)
    
    peserta_session = login(PESERTA_CREDS)
    
    print("\n[4.1] Peserta accessing /api/staff/musyawarah-export-pdf (should be 403)...")
    resp = peserta_session.get(f"{BASE_URL}/staff/musyawarah-export-pdf")
    print(f"  GET /staff/musyawarah-export-pdf (as peserta): {resp.status_code}")
    assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"
    print(f"  ✓ PASS: Peserta correctly forbidden (403)")
    
    print("\n✅ TEST 4 PASSED: Access control working correctly")

def main():
    print("="*80)
    print("BACKEND TESTING - FASE 3.1")
    print("E-KERTALANGU - Regression + New Endpoint Testing")
    print("="*80)
    
    try:
        # Run all tests
        test_1_delegasi_reason_optional()
        test_2_musyawarah_combined_pdf()
        test_3_peserta_attendance_history()
        test_4_access_control()
        
        # Cleanup
        cleanup()
        
        # Summary
        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED (4/4)")
        print("="*80)
        print("1. ✅ Delegasi reason NOW OPTIONAL (empty reason returns 200)")
        print("2. ✅ Musyawarah combined PDF export working (new route + regression)")
        print("3. ✅ Peserta attendance-history working (structure, validation, clamping)")
        print("4. ✅ Access control working (peserta 403 on staff endpoints)")
        print("="*80)
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        cleanup()
        raise
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        cleanup()
        raise

if __name__ == "__main__":
    main()
