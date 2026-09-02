"""E-KERTALANGU iteration 2 backend tests: admin account creation, pending names,
name-search based activation flow, and regressions."""
import os
import uuid

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE = base_url.rstrip("/") + "/api"

ADMIN = {"identifier": "ageng.rider@gmail.com", "password": "Admin#2026"}
PESERTA_PW = "Peserta#2026"
PENGURUS_PW = "Pengurus#2026"


def new_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_session():
    s = new_session()
    r = s.post(f"{BASE}/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    return s


@pytest.fixture(scope="module")
def created_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(created_ids):
    yield
    s = new_session()
    if s.post(f"{BASE}/auth/login", json=ADMIN).status_code != 200:
        return
    users = s.get(f"{BASE}/admin/users").json()
    for u in users:
        name = u.get("name") or ""
        email = u.get("email") or ""
        if name.startswith("TEST_") or name.startswith("Test Peserta") or email.endswith("@example.test"):
            s.delete(f"{BASE}/admin/users/{u['id']}")


# --- module: POST /admin/users/pending ---
class TestPendingNames:
    def test_create_pending_names_and_verify_in_list(self, admin_session, created_ids):
        uid = uuid.uuid4().hex[:6]
        names = [f"TEST_Pending A {uid}", f"TEST_Pending B {uid}", "   "]
        r = admin_session.post(f"{BASE}/admin/users/pending", json={"names": names})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["count"] == 2, data
        assert len(data["created"]) == 2
        for u in data["created"]:
            created_ids.append(u["id"])
            assert u["status"] == "pending"
            assert u["roles"] == ["peserta"]
            assert u["email"] is None and u["phone"] is None
            assert "_id" not in u and "password_hash" not in u
        # GET verify persistence
        users = admin_session.get(f"{BASE}/admin/users").json()
        by_id = {u["id"]: u for u in users}
        for u in data["created"]:
            assert u["id"] in by_id
            assert by_id[u["id"]]["status"] == "pending"
            assert by_id[u["id"]]["source"] == "admin_import"

    def test_many_pending_null_emails_no_duplicate_key_error(self, admin_session, created_ids):
        """Regression: partial unique index must allow many null email/username."""
        uid = uuid.uuid4().hex[:6]
        names = [f"TEST_Bulk {uid} {i}" for i in range(5)]
        r = admin_session.post(f"{BASE}/admin/users/pending", json={"names": names})
        assert r.status_code == 200, r.text
        assert r.json()["count"] == 5
        for u in r.json()["created"]:
            created_ids.append(u["id"])

    def test_pending_requires_admin(self):
        s = new_session()
        s.post(f"{BASE}/auth/login", json={"identifier": "peserta", "password": PESERTA_PW})
        r = s.post(f"{BASE}/admin/users/pending", json={"names": ["TEST_x"]})
        assert r.status_code == 403, r.status_code
        assert requests.post(f"{BASE}/admin/users/pending", json={"names": ["TEST_x"]}).status_code == 401


# --- module: GET /activation/search ---
class TestActivationSearch:
    def test_search_finds_only_pending(self, admin_session, created_ids):
        uid = uuid.uuid4().hex[:6]
        pending_name = f"TEST_Search {uid}"
        r = admin_session.post(f"{BASE}/admin/users/pending", json={"names": [pending_name]})
        pid = r.json()["created"][0]["id"]
        created_ids.append(pid)
        # search full name
        s = requests.get(f"{BASE}/activation/search", params={"q": pending_name})
        assert s.status_code == 200, s.text
        ids = [x["id"] for x in s.json()]
        assert pid in ids
        assert all(set(x.keys()) == {"id", "name"} for x in s.json())
        # case-insensitive
        s2 = requests.get(f"{BASE}/activation/search", params={"q": pending_name.lower()})
        assert pid in [x["id"] for x in s2.json()]
        # active seeded user must not be returned
        s3 = requests.get(f"{BASE}/activation/search", params={"q": "Ibu Jamaah"})
        assert s3.status_code == 200
        assert s3.json() == [], s3.json()

    @pytest.mark.parametrize("q", ["", "a", " a "])
    def test_search_short_query_returns_empty(self, q):
        r = requests.get(f"{BASE}/activation/search", params={"q": q})
        assert r.status_code == 200
        assert r.json() == []

    def test_search_no_match(self):
        r = requests.get(f"{BASE}/activation/search", params={"q": "zzz-nonexistent-name-zzz"})
        assert r.status_code == 200 and r.json() == []

    def test_search_regex_metachar_not_500(self):
        """User-supplied query is injected into $regex; metachars must not 500."""
        r = requests.get(f"{BASE}/activation/search", params={"q": "(("})
        assert r.status_code == 200, f"regex injection -> {r.status_code}: {r.text[:200]}"


# --- module: POST /activation/complete ---
class TestActivationComplete:
    def test_complete_activates_and_logs_in(self, admin_session, created_ids):
        uid = uuid.uuid4().hex[:6]
        name = f"TEST_Activate {uid}"
        pid = admin_session.post(f"{BASE}/admin/users/pending", json={"names": [name]}).json()["created"][0]["id"]
        created_ids.append(pid)
        payload = {"user_id": pid, "phone": f"0895{uid}00", "email": f"act_{uid}@example.test",
                   "dob": "1992-02-02", "address": "TEST Alamat", "password": "Aktif#2026"}
        s = new_session()
        r = s.post(f"{BASE}/activation/complete", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"] == pid
        assert d["status"] == "active"
        assert d["email"] == payload["email"]
        assert d["phone"] == payload["phone"]
        assert d["dob"] == payload["dob"]
        assert d["roles"] == ["peserta"]
        # logged in via cookies
        me = s.get(f"{BASE}/auth/me")
        assert me.status_code == 200 and me.json()["id"] == pid
        # can login with new password
        s2 = new_session()
        lr = s2.post(f"{BASE}/auth/login", json={"identifier": payload["email"], "password": "Aktif#2026"})
        assert lr.status_code == 200, lr.text
        # no longer in activation search
        assert requests.get(f"{BASE}/activation/search", params={"q": name}).json() == []
        # second attempt -> 404
        again = new_session().post(f"{BASE}/activation/complete", json=payload)
        assert again.status_code == 404, again.status_code

    def test_complete_duplicate_email_409(self, admin_session, created_ids):
        uid = uuid.uuid4().hex[:6]
        pid = admin_session.post(f"{BASE}/admin/users/pending",
                                 json={"names": [f"TEST_Dup {uid}"]}).json()["created"][0]["id"]
        created_ids.append(pid)
        r = new_session().post(f"{BASE}/activation/complete", json={
            "user_id": pid, "phone": f"0894{uid}00", "email": "peserta@ekertalangu.id",
            "dob": "1993-03-03", "address": "TEST", "password": "Aktif#2026"})
        assert r.status_code == 409, f"{r.status_code}: {r.text[:200]}"
        # duplicate phone
        r2 = new_session().post(f"{BASE}/activation/complete", json={
            "user_id": pid, "phone": "081300000003", "email": f"dup_{uid}@example.test",
            "dob": "1993-03-03", "address": "TEST", "password": "Aktif#2026"})
        assert r2.status_code == 409, f"{r2.status_code}: {r2.text[:200]}"
        # still pending
        users = admin_session.get(f"{BASE}/admin/users").json()
        assert [u for u in users if u["id"] == pid][0]["status"] == "pending"

    def test_complete_bad_user_id_400(self):
        r = new_session().post(f"{BASE}/activation/complete", json={
            "user_id": "not-an-objectid", "phone": "0890000000", "email": "x@example.test",
            "dob": "1990-01-01", "address": "x", "password": "Aktif#2026"})
        assert r.status_code in (400, 404), f"{r.status_code}: {r.text[:200]}"

    def test_complete_on_active_user_404(self, admin_session):
        me = admin_session.get(f"{BASE}/auth/me").json()
        r = new_session().post(f"{BASE}/activation/complete", json={
            "user_id": me["id"], "phone": "0890000001", "email": "hack@example.test",
            "dob": "1990-01-01", "address": "x", "password": "Hacked#2026"})
        assert r.status_code == 404, f"active account hijack via activation: {r.status_code}"


# --- module: POST /admin/users ---
class TestAdminCreateUser:
    def test_create_active_account_with_roles(self, admin_session, created_ids):
        uid = uuid.uuid4().hex[:6]
        payload = {"name": f"TEST_Full {uid}", "phone": f"0893{uid}00",
                   "email": f"full_{uid}@example.test", "dob": "1988-08-08",
                   "address": "TEST Jalan", "roles": ["pengurus", "peserta"], "password": "Buat#2026"}
        r = admin_session.post(f"{BASE}/admin/users", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        created_ids.append(d["id"])
        assert d["status"] == "active"
        assert set(d["roles"]) == {"pengurus", "peserta"}
        assert d["email"] == payload["email"]
        # GET verify
        users = admin_session.get(f"{BASE}/admin/users").json()
        got = [u for u in users if u["id"] == d["id"]][0]
        assert got["status"] == "active" and got["address"] == "TEST Jalan"
        # login works
        lr = new_session().post(f"{BASE}/auth/login", json={"identifier": payload["email"], "password": "Buat#2026"})
        assert lr.status_code == 200, lr.text
        # duplicate email -> 409
        dup = admin_session.post(f"{BASE}/admin/users", json=dict(payload, phone=f"0892{uid}00"))
        assert dup.status_code == 409, dup.status_code
        # duplicate phone -> 409
        dup2 = admin_session.post(f"{BASE}/admin/users", json=dict(payload, email=f"o_{uid}@example.test"))
        assert dup2.status_code == 409, dup2.status_code

    def test_create_without_password_is_pending(self, admin_session, created_ids):
        uid = uuid.uuid4().hex[:6]
        r = admin_session.post(f"{BASE}/admin/users", json={"name": f"TEST_NoPw {uid}", "roles": ["peserta"]})
        assert r.status_code == 200, r.text
        d = r.json()
        created_ids.append(d["id"])
        assert d["status"] == "pending"
        # searchable in activation
        assert d["id"] in [x["id"] for x in requests.get(
            f"{BASE}/activation/search", params={"q": f"TEST_NoPw {uid}"}).json()]

    def test_create_blank_name_400(self, admin_session):
        r = admin_session.post(f"{BASE}/admin/users", json={"name": "   ", "password": "X#123456"})
        assert r.status_code == 400, r.status_code

    def test_create_requires_admin(self):
        s = new_session()
        s.post(f"{BASE}/auth/login", json={"identifier": "peserta", "password": PESERTA_PW})
        assert s.post(f"{BASE}/admin/users", json={"name": "TEST_x"}).status_code == 403
        assert requests.post(f"{BASE}/admin/users", json={"name": "TEST_x"}).status_code == 401

    def test_pending_account_cannot_login(self, admin_session, created_ids):
        uid = uuid.uuid4().hex[:6]
        d = admin_session.post(f"{BASE}/admin/users", json={
            "name": f"TEST_NoLogin {uid}", "email": f"nologin_{uid}@example.test",
            "roles": ["peserta"]}).json()
        created_ids.append(d["id"])
        r = new_session().post(f"{BASE}/auth/login", json={
            "identifier": f"nologin_{uid}@example.test", "password": "whatever"})
        assert r.status_code in (401, 403, 500), r.status_code
        assert r.status_code != 500, f"login against password_hash=None crashes: {r.text[:200]}"


# --- module: delete ---
class TestAdminDelete:
    def test_delete_pending_and_active(self, admin_session):
        uid = uuid.uuid4().hex[:6]
        pid = admin_session.post(f"{BASE}/admin/users/pending",
                                 json={"names": [f"TEST_Del {uid}"]}).json()["created"][0]["id"]
        aid = admin_session.post(f"{BASE}/admin/users", json={
            "name": f"TEST_DelA {uid}", "email": f"dela_{uid}@example.test",
            "password": "Del#2026", "roles": ["peserta"]}).json()["id"]
        for target in (pid, aid):
            assert admin_session.delete(f"{BASE}/admin/users/{target}").status_code == 200
        users = [u["id"] for u in admin_session.get(f"{BASE}/admin/users").json()]
        assert pid not in users and aid not in users
        assert admin_session.delete(f"{BASE}/admin/users/{pid}").status_code == 404

    def test_cannot_delete_self(self, admin_session):
        me = admin_session.get(f"{BASE}/auth/me").json()
        assert admin_session.delete(f"{BASE}/admin/users/{me['id']}").status_code == 400

    def test_delete_invalid_objectid(self, admin_session):
        r = admin_session.delete(f"{BASE}/admin/users/not-an-objectid")
        assert r.status_code in (400, 404, 422), f"{r.status_code}: {r.text[:200]}"


# --- regressions ---
class TestRegressions:
    @pytest.mark.parametrize("ident,pw,roles", [
        ("ageng.rider@gmail.com", "Admin#2026", {"admin", "pengurus", "peserta"}),
        ("pengurus@ekertalangu.id", PENGURUS_PW, {"pengurus", "peserta"}),
        ("peserta@ekertalangu.id", PESERTA_PW, {"peserta"}),
    ])
    def test_seeded_logins(self, ident, pw, roles):
        r = new_session().post(f"{BASE}/auth/login", json={"identifier": ident, "password": pw})
        assert r.status_code == 200, f"{ident} -> {r.status_code} {r.text[:200]}"
        assert set(r.json()["roles"]) == roles

    def test_self_reset_blocked_for_admin(self):
        r = new_session().post(f"{BASE}/auth/self-reset", json={
            "phone": "081100000001", "dob": "1990-01-01", "new_password": "Xtemp#12345"})
        assert r.status_code == 403, f"SECURITY: admin self-reset allowed ({r.status_code})"

    def test_self_reset_peserta_and_restore(self):
        r = new_session().post(f"{BASE}/auth/self-reset", json={
            "phone": "081300000003", "dob": "1970-08-17", "new_password": "Baru#2026"})
        assert r.status_code == 200, r.text
        try:
            assert new_session().post(f"{BASE}/auth/login", json={
                "identifier": "peserta", "password": "Baru#2026"}).status_code == 200
        finally:
            rr = new_session().post(f"{BASE}/auth/self-reset", json={
                "phone": "081300000003", "dob": "1970-08-17", "new_password": PESERTA_PW})
            assert rr.status_code == 200
        assert new_session().post(f"{BASE}/auth/login", json={
            "identifier": "peserta", "password": PESERTA_PW}).status_code == 200

    def test_no_mongo_id_leak_in_admin_list(self, admin_session):
        users = admin_session.get(f"{BASE}/admin/users").json()
        assert all("_id" not in u and "password_hash" not in u for u in users)

    def test_logout_without_valid_token(self):
        r = requests.post(f"{BASE}/auth/logout")
        assert r.status_code == 200, r.status_code
