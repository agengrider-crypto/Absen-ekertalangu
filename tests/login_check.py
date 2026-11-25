"""Uji login: format DDMMYY/DDMMYYYY, tanggal lahir kosong, nomor HP,
nama dengan spasi ganda, reset yang tersimpan, dan batas percobaan.

Tanpa data asli (mongomock-motor + httpx).

    pip install mongomock-motor httpx
    python tests/login_check.py
"""
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("DB_NAME", "ekertalangu_test")

try:
    import mongomock_motor  # noqa: E402
    import httpx  # noqa: E402
except ImportError as exc:  # pragma: no cover
    print(f"Paket uji belum terpasang ({exc.name}). Jalankan:\n"
          "    pip install mongomock-motor httpx")
    raise SystemExit(2)

import server  # noqa: E402

_mock = mongomock_motor.AsyncMongoMockClient()
server.client = _mock
server._db_real = _mock[server._DB_NAME]
server._db_demo = _mock[f"{server._DB_NAME}_demo"]

GAGAL = []


def cek(nama, kondisi, info=""):
    if kondisi:
        print(f"  OK   {nama}")
    else:
        print(f"  GAGAL {nama} {info}")
        GAGAL.append(nama)


async def main():
    transport = httpx.ASGITransport(app=server.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        # --- helper murni -------------------------------------------------
        cek("DDMMYY dari 1994-11-23", server._sandi_default_dari_dob("1994-11-23")
            == ("231194", "23111994"))
        cek("tanggal lahir kosong", server._sandi_default_dari_dob("") is None)
        cek("tanggal lahir rusak", server._sandi_default_dari_dob("bukan-tanggal") is None)
        cek("cocok DDMMYY", server._cocok_sandi_default("231194", "1994-11-23"))
        cek("cocok DDMMYYYY", server._cocok_sandi_default("23111994", "1994-11-23"))
        cek("tidak cocok", not server._cocok_sandi_default("salah", "1994-11-23"))
        cek("HP 08 jadi 62", server._norm_hp_login("0812-3456-7890") == "6281234567890")
        cek("HP 628 tetap", server._norm_hp_login("6281234567890") == "6281234567890")
        cek("HP +628 jadi 62", server._norm_hp_login("+62 812 3456 7890") == "6281234567890")
        cek("nama spasi ganda", server._norm_nama("  Budi   Santoso ") == "budi santoso")

        # --- akun uji -----------------------------------------------------
        await server.db.users.insert_one({
            "_id": server.ObjectId(), "name": "Admin Uji", "username": "adminuji",
            "email": "adminuji@example.com", "phone": "6281100000001",
            "password_hash": server.hash_password("rahasia123"),
            "roles": ["admin", "pengurus", "peserta"], "status": "active",
            "token_version": 0, "is_system": True,
        })
        oid = server.ObjectId()
        await server.db.users.insert_one({
            "_id": oid, "name": "Budi  Santoso", "username": "budi",
            "email": "budi@example.com", "phone": "6281234567890",
            "dob": "1994-11-23", "password_hash": server.hash_password("231194"),
            "roles": ["peserta"], "status": "active", "token_version": 0,
        })
        await server.db.users.insert_one({
            "_id": server.ObjectId(), "name": "Tanpa Lahir", "username": "tanpalahir",
            "email": "tl@example.com", "phone": "6281200000009",
            "password_hash": server.hash_password("apapun123"),
            "roles": ["peserta"], "status": "active", "token_version": 0,
        })

        # --- login dengan DDMMYY dan DDMMYYYY -----------------------------
        r = await c.post("/api/auth/login", json={"identifier": "budi", "password": "231194"})
        cek("login DDMMYY", r.status_code == 200, r.text[:200])
        r = await c.post("/api/auth/login", json={"identifier": "budi", "password": "23111994"})
        cek("login DDMMYYYY", r.status_code == 200, r.text[:200])
        r = await c.post("/api/auth/login",
                         json={"identifier": "  BUDI   SANTOSO ", "password": "231194"})
        cek("login nama spasi ganda & huruf besar", r.status_code == 200, r.text[:200])
        r = await c.post("/api/auth/login",
                         json={"identifier": "0812-3456-7890", "password": "231194"})
        cek("login nomor HP format 08", r.status_code == 200, r.text[:200])

        # --- reset benar-benar tersimpan ----------------------------------
        await server.db.users.update_one({"_id": oid},
                                         {"$set": {"password_hash": server.hash_password("lain123")}})
        r = await c.post("/api/auth/reset-dob", json={"identifier": "budi"})
        cek("reset membalas pesan jelas", r.status_code == 200
            and "DDMMYY" in r.text, r.text[:200])
        u = await server.db.users.find_one({"_id": oid})
        cek("reset tersimpan (DDMMYY berlaku)",
            server.verify_password("231194", u.get("password_hash") or ""))
        cek("reset mengaktifkan wajib ganti", bool(u.get("must_change_password")))
        r = await c.post("/api/auth/login", json={"identifier": "budi", "password": "231194"})
        cek("login setelah reset", r.status_code == 200, r.text[:200])

        # --- tanggal lahir kosong -----------------------------------------
        r = await c.post("/api/auth/reset-dob", json={"identifier": "tanpalahir"})
        cek("reset tanpa tanggal lahir, pesan jelas",
            r.status_code == 200 and "Tanggal lahir belum diisi" in r.text, r.text[:200])

        # --- batas percobaan tidak mengunci permanen ----------------------
        for _ in range(server.LOGIN_AKUN_MAKS):
            await c.post("/api/auth/login", json={"identifier": "budi", "password": "salah"})
        r = await c.post("/api/auth/login", json={"identifier": "budi", "password": "231194"})
        cek("terkunci sementara setelah batas", r.status_code == 429, r.status_code)
        cek("pesan terkunci jelas", "15 menit" in r.text, r.text[:200])
        await server.db.login_attempts.delete_many({"identifier": str(oid)})
        r = await c.post("/api/auth/login", json={"identifier": "budi", "password": "231194"})
        cek("tidak terkunci permanen", r.status_code == 200, r.text[:200])

    print()
    if GAGAL:
        print(f"GAGAL: {len(GAGAL)} pemeriksaan -> {GAGAL}")
        return 1
    print("SEMUA PEMERIKSAAN LULUS")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
