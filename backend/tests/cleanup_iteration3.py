"""Cleanup: remove iteration-3 test users, restore seeded Peserta password, verify final state."""
import os
import requests
from dotenv import dotenv_values

BASE = (os.environ.get("REACT_APP_BACKEND_URL")
        or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE}/api"

s = requests.Session()
r = s.post(f"{API}/auth/login", json={"identifier": "ageng.rider@gmail.com", "password": "Admin#2026"}, timeout=30)
print("admin login:", r.status_code)

# restore peserta password
r = s.post(f"{API}/auth/self-reset", json={"phone": "081300000003", "dob": "1970-08-17",
                                           "new_password": "Peserta#2026"}, timeout=30)
print("peserta password restore:", r.status_code)

KEYS = ("test", "uji", "impor", "import", "budi", "excel", "tanggal", "cari", "aktivasi", "pending")
users = s.get(f"{API}/admin/users", timeout=30).json()
deleted = []
for u in users:
    name = (u.get("name") or "").lower()
    if u.get("source") == "seed":
        continue
    if any(k in name for k in KEYS):
        d = s.delete(f"{API}/admin/users/{u['id']}", timeout=30)
        deleted.append((u["name"], d.status_code))
print("deleted:", deleted)

users = s.get(f"{API}/admin/users", timeout=30).json()
print("remaining users:", [(u["name"], u["status"], u["source"]) for u in users])

for ident, pwd in [("ageng.rider@gmail.com", "Admin#2026"),
                   ("pengurus@ekertalangu.id", "Pengurus#2026"),
                   ("peserta@ekertalangu.id", "Peserta#2026")]:
    rr = requests.post(f"{API}/auth/login", json={"identifier": ident, "password": pwd}, timeout=30)
    print(f"login {ident}: {rr.status_code}")
