"""E-KERTALANGU Fase 1 backend tests (auth, qr, register, admin)."""
import os
import time
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
PENGURUS_PW = "Pengurus#2026"
PESERTA_PW = "Peserta#2026"


def new_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def admin_session():
    s = new_session()
    r = s.post(f"{BASE}/auth/login", json=ADMIN)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    return s


# --- health ---
def test_root():
    r = requests.get(f"{BASE}/")
    assert r.status_code == 200
    assert "message" in r.json()


# --- login module ---
def test_login_admin_cookies_and_roles():
    s = new_session()
    r = s.post(f"{BASE}/auth/login", json=ADMIN)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == "ageng.rider@gmail.com"
    assert set(data["roles"]) == {"admin", "pengurus", "peserta"}
    assert "_id" not in data and isinstance(data["id"], str)
    # httpOnly cookies
    names = {c.name: c for c in s.cookies}
    assert "access_token" in names and "refresh_token" in names
    raw = r.headers.get("set-cookie", "")
    assert "HttpOnly" in raw or "httponly" in raw


@pytest.mark.parametrize("ident", ["peserta", "081300000003", "peserta@ekertalangu.id"])
def test_login_with_username_phone_email(ident):
    s = new_session()
    r = s.post(f"{BASE}/auth/login", json={"identifier": ident, "password": PESERTA_PW})
    assert r.status_code == 200, f"{ident} -> {r.status_code} {r.text[:200]}"
    assert r.json()["roles"] == ["peserta"]


def test_login_pengurus_roles():
    s = new_session()
    r = s.post(f"{BASE}/auth/login", json={"identifier": "pengurus", "password": PENGURUS_PW})
    assert r.status_code == 200, r.text
    assert set(r.json()["roles"]) == {"pengurus", "peserta"}
    assert "admin" not in r.json()["roles"]


def test_login_wrong_password_401_then_lockout_429():
    ident = "pengurus@ekertalangu.id"
    s = new_session()
    codes = []
    for _ in range(6):
        r = s.post(f"{BASE}/auth/login", json={"identifier": ident, "password": "Wrong#1234"})
        codes.append(r.status_code)
    assert codes[0] == 401, codes
    assert 429 in codes, f"expected lockout, got {codes}"
    # correct password while locked should still be blocked
    r = s.post(f"{BASE}/auth/login", json={"identifier": ident, "password": PENGURUS_PW})
    assert r.status_code == 429, r.status_code


def test_me_and_logout(admin_session):
    r = admin_session.get(f"{BASE}/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN["identifier"]


def test_me_unauthenticated_401():
    r = requests.get(f"{BASE}/auth/me")
    assert r.status_code == 401


def test_logout_clears_session():
    s = new_session()
    assert s.post(f"{BASE}/auth/login", json={"identifier": "peserta", "password": PESERTA_PW}).status_code == 200
    r = s.post(f"{BASE}/auth/logout")
    assert r.status_code == 200
    assert s.post(f"{BASE}/auth/refresh").status_code in (200, 401)
    r2 = s.get(f"{BASE}/auth/me")
    assert r2.status_code == 401, f"session still alive: {r2.status_code}"


def test_refresh_issues_new_access_token():
    s = new_session()
    s.post(f"{BASE}/auth/login", json={"identifier": "peserta", "password": PESERTA_PW})
    r = s.post(f"{BASE}/auth/refresh")
    assert r.status_code == 200, r.text
    assert r.json()["email"] == "peserta@ekertalangu.id"


# --- bcrypt hash format ---
def test_bcrypt_hash_format():
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import dotenv_values as dv
    env = dv("/app/backend/.env")

    async def check():
        c = AsyncIOMotorClient(env["MONGO_URL"])
        u = await c[env["DB_NAME"]].users.find_one({"email": "ageng.rider@gmail.com"})
        c.close()
        return u
    u = asyncio.get_event_loop().run_until_complete(check()) if False else asyncio.run(check())
    assert u is not None
    assert u["password_hash"].startswith("$2b$"), u["password_hash"][:10]


# --- QR module ---
def test_public_qr_stable_token():
    r1 = requests.get(f"{BASE}/qr/public")
    r2 = requests.get(f"{BASE}/qr/public")
    assert r1.status_code == 200 and r2.status_code == 200
    d1, d2 = r1.json(), r2.json()
    assert d1["token"] == d2["token"]
    assert d1["image"].startswith("data:image/png;base64,")
    assert f"/register?token={d1['token']}" in d1["link"]


# --- registration module ---
@pytest.fixture(scope="module")
def qr_token():
    return requests.get(f"{BASE}/qr/public").json()["token"]


@pytest.fixture(scope="module")
def created_user_ids():
    return []


def test_register_creates_active_peserta(qr_token, created_user_ids, admin_session):
    uid = uuid.uuid4().hex[:8]
    payload = {"token": qr_token, "name": f"TEST_{uid}",
               "phone": f"0899{uid[:8]}", "email": f"test_{uid}@example.test",
               "dob": "1995-03-02", "address": "TEST Address", "password": "Test#2026"}
    s = new_session()
    r = s.post(f"{BASE}/auth/register", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    created_user_ids.append(d["id"])
    assert d["roles"] == ["peserta"]
    assert d["status"] == "active"
    assert d["source"] == "qr_public"
    # cookies set -> logged in
    me = s.get(f"{BASE}/auth/me")
    assert me.status_code == 200 and me.json()["id"] == d["id"]
    # login with new creds
    s2 = new_session()
    assert s2.post(f"{BASE}/auth/login", json={"identifier": payload["email"], "password": "Test#2026"}).status_code == 200
    # duplicate email
    dup = new_session().post(f"{BASE}/auth/register", json=payload)
    assert dup.status_code == 409, dup.status_code
    # duplicate phone (different email)
    p2 = dict(payload, email=f"other_{uid}@example.test")
    dup2 = new_session().post(f"{BASE}/auth/register", json=p2)
    assert dup2.status_code == 409, dup2.status_code


def test_register_invalid_token_400(qr_token):
    r = new_session().post(f"{BASE}/auth/register", json={
        "token": "invalid-token", "name": "TEST_x", "phone": "0898000111",
        "email": "test_bad@example.test", "dob": "1990-01-01",
        "address": "x", "password": "Test#2026"})
    assert r.status_code == 400, r.status_code


def test_register_missing_fields_422(qr_token):
    r = new_session().post(f"{BASE}/auth/register", json={"token": qr_token, "name": "x"})
    assert r.status_code == 422


# --- activation ---
# NOTE (iteration 2): /auth/activate (code-based) was removed. The new name-search
# activation flow is covered in tests/test_iteration2.py.


# --- self reset (peserta) ---
def test_self_reset_flow_and_restore():
    new_pw = "Baru#2026"
    r = new_session().post(f"{BASE}/auth/self-reset", json={
        "phone": "081300000003", "dob": "1970-08-17", "new_password": new_pw})
    assert r.status_code == 200, r.text
    s = new_session()
    lr = s.post(f"{BASE}/auth/login", json={"identifier": "peserta", "password": new_pw})
    assert lr.status_code == 200, lr.text
    # old password no longer works
    old = new_session().post(f"{BASE}/auth/login", json={"identifier": "peserta", "password": PESERTA_PW})
    assert old.status_code == 401
    # restore
    rr = new_session().post(f"{BASE}/auth/self-reset", json={
        "phone": "081300000003", "dob": "1970-08-17", "new_password": PESERTA_PW})
    assert rr.status_code == 200
    time.sleep(0.3)
    back = new_session().post(f"{BASE}/auth/login", json={"identifier": "peserta", "password": PESERTA_PW})
    assert back.status_code == 200, back.text


def test_self_reset_wrong_dob_404():
    r = new_session().post(f"{BASE}/auth/self-reset", json={
        "phone": "081300000003", "dob": "2000-01-01", "new_password": "X#12345"})
    assert r.status_code == 404


def test_self_reset_cannot_target_admin_account():
    """SECURITY: self-reset must not allow resetting the admin account password.
    Seeded admin has roles [admin, pengurus, peserta] so the 'peserta in roles'
    check passes -> anyone knowing admin phone+dob can take over the admin account."""
    r = new_session().post(f"{BASE}/auth/self-reset", json={
        "phone": "081100000001", "dob": "1990-01-01", "new_password": "Xtemp#12345"})
    try:
        assert r.status_code == 403, (
            f"SECURITY HOLE: admin password reset via self-reset (status {r.status_code})")
    finally:
        if r.status_code == 200:
            # restore admin password so remaining tests / seeded creds keep working
            new_session().post(f"{BASE}/auth/self-reset", json={
                "phone": "081100000001", "dob": "1990-01-01",
                "new_password": ADMIN["password"]})


def test_self_reset_clears_lockout():
    # lock peserta out via wrong passwords
    s = new_session()
    for _ in range(6):
        s.post(f"{BASE}/auth/login", json={"identifier": "peserta@ekertalangu.id", "password": "Wrong#1234"})
    locked = s.post(f"{BASE}/auth/login", json={"identifier": "peserta@ekertalangu.id", "password": PESERTA_PW})
    assert locked.status_code == 429
    rr = s.post(f"{BASE}/auth/self-reset", json={
        "phone": "081300000003", "dob": "1970-08-17", "new_password": PESERTA_PW})
    assert rr.status_code == 200
    after = s.post(f"{BASE}/auth/login", json={"identifier": "peserta@ekertalangu.id", "password": PESERTA_PW})
    assert after.status_code == 200, f"lockout not cleared after reset: {after.status_code}"


# --- admin module ---
def test_admin_users_list(admin_session):
    r = admin_session.get(f"{BASE}/admin/users")
    assert r.status_code == 200, r.text
    users = r.json()
    assert isinstance(users, list) and len(users) >= 3
    assert all("_id" not in u and "password_hash" not in u for u in users)
    emails = [u["email"] for u in users]
    assert "peserta@ekertalangu.id" in emails


def test_admin_users_requires_admin():
    s = new_session()
    s.post(f"{BASE}/auth/login", json={"identifier": "peserta", "password": PESERTA_PW})
    r = s.get(f"{BASE}/admin/users")
    assert r.status_code == 403, r.status_code
    r2 = requests.get(f"{BASE}/admin/users")
    assert r2.status_code == 401


def test_admin_cannot_delete_self(admin_session):
    me = admin_session.get(f"{BASE}/auth/me").json()
    r = admin_session.delete(f"{BASE}/admin/users/{me['id']}")
    assert r.status_code == 400, r.status_code


def test_admin_delete_user_and_verify(admin_session, qr_token):
    uid = uuid.uuid4().hex[:8]
    reg = new_session().post(f"{BASE}/auth/register", json={
        "token": qr_token, "name": f"TEST_del_{uid}", "phone": f"0897{uid[:8]}",
        "email": f"test_del_{uid}@example.test", "dob": "1999-09-09",
        "address": "TEST", "password": "Test#2026"})
    assert reg.status_code == 200, reg.text
    target = reg.json()["id"]
    d = admin_session.delete(f"{BASE}/admin/users/{target}")
    assert d.status_code == 200, d.text
    users = admin_session.get(f"{BASE}/admin/users").json()
    assert target not in [u["id"] for u in users]
    again = admin_session.delete(f"{BASE}/admin/users/{target}")
    assert again.status_code == 404, again.status_code


def test_admin_delete_invalid_objectid(admin_session):
    r = admin_session.delete(f"{BASE}/admin/users/not-an-objectid")
    assert r.status_code in (400, 404, 422), f"got {r.status_code}: {r.text[:200]}"


def test_admin_update_roles(admin_session, qr_token):
    uid = uuid.uuid4().hex[:8]
    reg = new_session().post(f"{BASE}/auth/register", json={
        "token": qr_token, "name": f"TEST_role_{uid}", "phone": f"0896{uid[:8]}",
        "email": f"test_role_{uid}@example.test", "dob": "1991-01-01",
        "address": "TEST", "password": "Test#2026"})
    target = reg.json()["id"]
    try:
        r = admin_session.patch(f"{BASE}/admin/users/{target}/roles", json={"roles": ["pengurus", "peserta"]})
        assert r.status_code == 200, r.text
        assert set(r.json()["roles"]) == {"pengurus", "peserta"}
        bad = admin_session.patch(f"{BASE}/admin/users/{target}/roles", json={"roles": ["hacker"]})
        assert bad.status_code == 400
    finally:
        admin_session.delete(f"{BASE}/admin/users/{target}")


# --- cleanup ---
@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    s = new_session()
    if s.post(f"{BASE}/auth/login", json=ADMIN).status_code != 200:
        return
    users = s.get(f"{BASE}/admin/users").json()
    for u in users:
        if (u.get("email") or "").endswith("@example.test") or (u.get("name") or "").startswith("TEST_"):
            s.delete(f"{BASE}/admin/users/{u['id']}")
