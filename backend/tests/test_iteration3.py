"""Iteration 3 backend tests: Excel/CSV import, DOB normalization, activation second factor."""
import io
import os
import time

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"identifier": "ageng.rider@gmail.com", "password": "Admin#2026"}

TRACK = []  # user ids created by tests


@pytest.fixture(scope="session")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"admin login failed {r.status_code} {r.text[:300]}"
    assert "admin" in r.json()["roles"]
    return s


@pytest.fixture(scope="session", autouse=True)
def cleanup(admin):
    yield
    r = admin.get(f"{API}/admin/users", timeout=30)
    if r.status_code != 200:
        return
    keywords = ("test", "uji", "import", "budi")
    for u in r.json():
        name = (u.get("name") or "").lower()
        if u.get("source") == "seed":
            continue
        if any(k in name for k in keywords) or u["id"] in TRACK:
            admin.delete(f"{API}/admin/users/{u['id']}", timeout=30)


def _pending(admin, name, dob=None):
    r = admin.post(f"{API}/admin/users/pending", json={"entries": [{"name": name, "dob": dob}]}, timeout=30)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    if data["created"]:
        TRACK.append(data["created"][0]["id"])
        return data["created"][0]
    return None


# ---------------------------------------------------------------- import CSV
class TestImportCSV:
    def test_csv_import_creates_pending_and_normalizes_dob(self, admin):
        csv_text = "Nama,Tanggal Lahir\nBudi Test Import,17-08-1970\nSiti Test NoDob\n"
        files = {"file": ("peserta.csv", csv_text.encode("utf-8"), "text/csv")}
        r = admin.post(f"{API}/admin/users/import", files=files, timeout=60)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert set(["count", "skipped", "created_names"]).issubset(data.keys())
        assert data["count"] == 2, data
        assert "Budi Test Import" in data["created_names"]
        assert "Siti Test NoDob" in data["created_names"]
        assert "Nama" not in data["created_names"]  # header skipped

        users = admin.get(f"{API}/admin/users", timeout=30).json()
        budi = next(u for u in users if u["name"] == "Budi Test Import")
        siti = next(u for u in users if u["name"] == "Siti Test NoDob")
        TRACK.extend([budi["id"], siti["id"]])
        assert budi["dob"] == "1970-08-17", budi
        assert budi["status"] == "pending"
        assert budi["roles"] == ["peserta"]
        assert siti["dob"] is None, siti
        assert "_id" not in budi

    def test_csv_reimport_dedupes(self, admin):
        csv_text = "Nama,Tanggal Lahir\nBudi Test Import,17-08-1970\n"
        files = {"file": ("peserta.csv", csv_text.encode("utf-8"), "text/csv")}
        r = admin.post(f"{API}/admin/users/import", files=files, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 0, data
        assert "Budi Test Import" in data["skipped"], data

    def test_xlsx_import(self, admin):
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["Nama", "Tanggal Lahir"])
        ws.append(["Excel Test Satu", "02-05-1965"])
        ws.append(["Excel Test Dua", None])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        files = {"file": ("peserta.xlsx", buf.read(),
                          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
        r = admin.post(f"{API}/admin/users/import", files=files, timeout=60)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert data["count"] == 2, data
        users = admin.get(f"{API}/admin/users", timeout=30).json()
        one = next(u for u in users if u["name"] == "Excel Test Satu")
        TRACK.append(one["id"])
        assert one["dob"] == "1965-05-02", one
        two = next(u for u in users if u["name"] == "Excel Test Dua")
        TRACK.append(two["id"])
        assert two["dob"] is None

    def test_xlsx_real_date_cell(self, admin):
        import openpyxl
        from datetime import datetime as dt
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["Nama", "Tanggal Lahir"])
        ws.append(["Tanggal Test Cell", dt(1972, 3, 9)])
        buf = io.BytesIO()
        wb.save(buf)
        buf.seek(0)
        files = {"file": ("d.xlsx", buf.read(), "application/octet-stream")}
        r = admin.post(f"{API}/admin/users/import", files=files, timeout=60)
        assert r.status_code == 200, r.text[:300]
        users = admin.get(f"{API}/admin/users", timeout=30).json()
        u = next(x for x in users if x["name"] == "Tanggal Test Cell")
        TRACK.append(u["id"])
        assert u["dob"] == "1972-03-09", u

    def test_unsupported_extension_400(self, admin):
        files = {"file": ("data.pdf", b"%PDF-1.4 dummy", "application/pdf")}
        r = admin.post(f"{API}/admin/users/import", files=files, timeout=30)
        assert r.status_code == 400, r.text[:300]
        detail = r.json().get("detail", "")
        assert "xlsx" in detail.lower() or "didukung" in detail.lower(), detail

    def test_import_requires_admin(self, admin):
        anon = requests.Session()
        files = {"file": ("x.csv", b"Nama\nAnon Test\n", "text/csv")}
        r = anon.post(f"{API}/admin/users/import", files=files, timeout=30)
        assert r.status_code == 401, r.status_code


# ---------------------------------------------------------------- pending entries
class TestPendingEntries:
    def test_entries_with_dob(self, admin):
        r = admin.post(f"{API}/admin/users/pending", json={"entries": [
            {"name": "Uji Entri Test", "dob": "02-05-1965"},
            {"name": "  ", "dob": None},
        ]}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["count"] == 1, data
        created = data["created"][0]
        TRACK.append(created["id"])
        assert created["dob"] == "1965-05-02", created
        assert created["status"] == "pending"

    def test_entries_duplicate_skipped(self, admin):
        r = admin.post(f"{API}/admin/users/pending",
                       json={"entries": [{"name": "Uji Entri Test", "dob": None}]}, timeout=30)
        assert r.status_code == 200
        assert r.json()["skipped"] == ["Uji Entri Test"], r.json()

    def test_old_names_payload_rejected(self, admin):
        r = admin.post(f"{API}/admin/users/pending", json={"names": ["Legacy Test"]}, timeout=30)
        assert r.status_code == 422, r.status_code


# ---------------------------------------------------------------- search flag
class TestActivationSearch:
    def test_requires_dob_flag(self, admin):
        with_dob = _pending(admin, "Cari Test Berdob", "1970-08-17")
        without = _pending(admin, "Cari Test Tanpadob", None)
        assert with_dob and without
        r = requests.get(f"{API}/activation/search", params={"q": "Cari Test"}, timeout=30)
        assert r.status_code == 200
        items = r.json()
        m = {i["name"]: i for i in items}
        assert m["Cari Test Berdob"]["requires_dob"] is True, m
        assert m["Cari Test Tanpadob"]["requires_dob"] is False, m
        assert set(m["Cari Test Berdob"].keys()) == {"id", "name", "requires_dob"}

    def test_short_query_returns_empty(self):
        r = requests.get(f"{API}/activation/search", params={"q": "a"}, timeout=30)
        assert r.status_code == 200
        assert r.json() == []


# ---------------------------------------------------------------- second factor
class TestActivationSecondFactor:
    def test_wrong_dob_rejected_then_correct_dob_activates(self, admin):
        u = _pending(admin, "Aktivasi Test Dob", "1970-08-17")
        assert u and u["dob"] == "1970-08-17"
        ts = str(int(time.time()))
        payload = {
            "user_id": u["id"], "phone": f"0899{ts[-7:]}",
            "email": f"akt.test.{ts}@example.test", "dob": "1980-01-01",
            "address": "Jl Test", "password": "Uji#2026",
        }
        s = requests.Session()
        r = s.post(f"{API}/activation/complete", json=payload, timeout=30)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text[:300]}"
        assert "Tanggal lahir tidak sesuai" in r.json().get("detail", ""), r.json()

        # still pending
        r = requests.get(f"{API}/activation/search", params={"q": "Aktivasi Test Dob"}, timeout=30)
        assert any(i["id"] == u["id"] for i in r.json())

        payload["dob"] = "17-08-1970"  # DD-MM-YYYY should normalize and match
        r = s.post(f"{API}/activation/complete", json=payload, timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert data["status"] == "active"
        assert data["dob"] == "1970-08-17", data
        assert "access_token" in s.cookies, dict(s.cookies)
        me = s.get(f"{API}/auth/me", timeout=30)
        assert me.status_code == 200 and me.json()["id"] == u["id"]

    def test_no_dob_pending_activates_with_any_dob(self, admin):
        u = _pending(admin, "Aktivasi Test Bebas", None)
        ts = str(int(time.time()))
        s = requests.Session()
        r = s.post(f"{API}/activation/complete", json={
            "user_id": u["id"], "phone": f"0898{ts[-7:]}",
            "email": f"bebas.test.{ts}@example.test", "dob": "1999-12-31",
            "address": "Jl Test", "password": "Uji#2026"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert r.json()["dob"] == "1999-12-31"

    def test_activation_invalid_user_id(self):
        r = requests.post(f"{API}/activation/complete", json={
            "user_id": "not-an-oid", "phone": "0811", "email": "x@y.test",
            "dob": "1990-01-01", "address": "a", "password": "Uji#2026"}, timeout=30)
        assert r.status_code == 400, r.status_code


# ---------------------------------------------------------------- regression
class TestRegression:
    @pytest.mark.parametrize("ident,pwd,roles", [
        ("ageng.rider@gmail.com", "Admin#2026", ["admin", "pengurus", "peserta"]),
        ("pengurus@ekertalangu.id", "Pengurus#2026", ["pengurus", "peserta"]),
        ("peserta@ekertalangu.id", "Peserta#2026", ["peserta"]),
    ])
    def test_seeded_logins(self, ident, pwd, roles):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"identifier": ident, "password": pwd}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert sorted(r.json()["roles"]) == sorted(roles)
        assert "access_token" in s.cookies and "refresh_token" in s.cookies

    def test_bcrypt_hash_format(self):
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        env = dotenv_values("/app/backend/.env")

        async def _check():
            cl = AsyncIOMotorClient(env["MONGO_URL"])
            u = await cl[env["DB_NAME"]].users.find_one({"email": "ageng.rider@gmail.com"})
            cl.close()
            return u
        u = asyncio.get_event_loop().run_until_complete(_check()) if False else asyncio.run(_check())
        assert u["password_hash"].startswith("$2b$"), u["password_hash"][:10]

    def test_pending_account_login_401(self, admin):
        u = _pending(admin, "Pending Test Login", None)
        r = requests.post(f"{API}/auth/login",
                          json={"identifier": "pending.test.login@example.test", "password": "x"}, timeout=30)
        assert r.status_code == 401, r.status_code
        assert r.json()["detail"] == "Akun atau kata sandi salah"

    def test_cors_credentials(self):
        # Preflight through the public edge is answered by the ingress/CDN, so assert the
        # app-level CORS config directly against the internal service port.
        r = requests.options("http://localhost:8001/api/auth/login", headers={
            "Origin": BASE_URL, "Access-Control-Request-Method": "POST"}, timeout=30)
        assert r.headers.get("access-control-allow-credentials") == "true", dict(r.headers)
        assert r.headers.get("access-control-allow-origin") == BASE_URL, dict(r.headers)

    def test_self_reset_and_restore(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/self-reset", json={
            "phone": "081300000003", "dob": "1970-08-17", "new_password": "Sementara#2026"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        r = s.post(f"{API}/auth/login",
                   json={"identifier": "081300000003", "password": "Sementara#2026"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        # restore
        r = s.post(f"{API}/auth/self-reset", json={
            "phone": "081300000003", "dob": "1970-08-17", "new_password": "Peserta#2026"}, timeout=30)
        assert r.status_code == 200
        r = requests.post(f"{API}/auth/login",
                          json={"identifier": "peserta@ekertalangu.id", "password": "Peserta#2026"}, timeout=30)
        assert r.status_code == 200

    def test_self_reset_blocked_for_multirole(self):
        r = requests.post(f"{API}/auth/self-reset", json={
            "phone": "081200000002", "dob": "1985-05-10", "new_password": "Hack#2026"}, timeout=30)
        assert r.status_code == 403, r.status_code


# ---------------------------------------------------------------- brute force (last)
class TestBruteForce:
    def test_lockout_after_5_failures_and_cleared_by_reset(self):
        ident = "081300000003"
        codes = []
        for _ in range(6):
            r = requests.post(f"{API}/auth/login",
                              json={"identifier": ident, "password": "Salah#0000"}, timeout=30)
            codes.append(r.status_code)
        assert codes[-1] == 429, codes
        # self-reset should clear lockout per playbook
        r = requests.post(f"{API}/auth/self-reset", json={
            "phone": ident, "dob": "1970-08-17", "new_password": "Peserta#2026"}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        r = requests.post(f"{API}/auth/login",
                          json={"identifier": ident, "password": "Peserta#2026"}, timeout=30)
        assert r.status_code == 200, (
            f"lockout not cleared after self-reset: {r.status_code} {r.text[:200]}")
