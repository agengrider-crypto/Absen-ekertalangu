"""Uji status peserta (Aktif / Nonaktif Sementara / Belum Aktivasi / Calon Peserta).

Memakai mongomock-motor + httpx ASGITransport. Tidak menyentuh database produksi.

    pip install mongomock-motor httpx
    python tests/status_peserta_check.py
"""
import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("DB_NAME", "ekertalangu_status_test")

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
    print(("  OK   " if kondisi else "  GAGAL ") + nama + ("" if kondisi else f"  {info}"))
    if not kondisi:
        GAGAL.append(nama)


async def main():
    transport = httpx.ASGITransport(app=server.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        await server.db.users.insert_one({
            "_id": server.ObjectId(), "name": "Admin Uji", "username": "adminuji",
            "email": "adminuji@example.com", "phone": "6281100000001",
            "password_hash": server.hash_password("rahasia123"),
            "roles": ["admin", "pengurus", "peserta"], "status": "active",
            "token_version": 0, "is_system": True,
        })
        peserta_id = server.ObjectId()
        await server.db.users.insert_one({
            "_id": peserta_id, "name": "Ahmad Fauzi", "username": "ahmad",
            "email": "ahmad@example.com", "phone": "6281200000002",
            "password_hash": server.hash_password("rahasia123"),
            "roles": ["peserta"], "status": "active", "token_version": 0,
        })
        # Riwayat absensi & kegiatan yang harus tetap aman.
        await server.db.kegiatans.insert_one({
            "_id": "keg-riwayat", "name": "Pengajian Lama", "date": "2026-10-04",
            "start_time": "08:00", "end_time": "10:00", "status": "closed",
        })
        await server.db.absensis.insert_one({
            "_id": "abs-1", "kegiatan_id": "keg-riwayat", "user_id": str(peserta_id),
            "status": "hadir", "updated_at": server.now_wita().isoformat(),
        })

        r = await c.post("/api/auth/login",
                         json={"identifier": "adminuji", "password": "rahasia123"})
        cek("login admin", r.status_code == 200, r.text[:200])

        # --- status awal ---------------------------------------------------
        r = await c.get(f"/api/admin/users/{peserta_id}")
        cek("detail awal aktif", r.status_code == 200 and r.json()["status"] == "active",
            r.text[:200])
        # Baseline: seed demo juga berperan peserta, jadi hitung relatif.
        baseline = await server.db.users.count_documents(server.PESERTA_QUERY)
        cek("baseline peserta aktif terhitung", baseline >= 1, baseline)

        # --- nonaktifkan sementara -----------------------------------------
        r = await c.patch(f"/api/admin/users/{peserta_id}", json={"status": "nonaktif"})
        cek("nonaktif sementara", r.status_code == 200 and r.json()["status"] == "nonaktif",
            r.text[:300])

        # --- data & riwayat tetap ada --------------------------------------
        u = await server.db.users.find_one({"_id": peserta_id})
        cek("data peserta tetap ada", u is not None and u.get("name") == "Ahmad Fauzi")
        cek("password_hash tidak hilang", bool(u.get("password_hash")))
        n_abs = await server.db.absensis.count_documents({"user_id": str(peserta_id)})
        cek("riwayat absensi tetap ada", n_abs == 1, n_abs)
        n_keg = await server.db.kegiatans.count_documents({"_id": "keg-riwayat"})
        cek("riwayat kegiatan tetap ada", n_keg == 1, n_keg)

        # --- tidak tampil sebagai peserta aktif default --------------------
        aktif = await server.db.users.count_documents(server.PESERTA_QUERY)
        cek("tidak masuk PESERTA_QUERY (default aktif)", aktif == baseline - 1,
            f"{aktif} vs {baseline - 1}")
        q_reguler = server.peserta_query_for({"audience": "reguler"})
        n_reg = await server.db.users.count_documents(q_reguler)
        cek("tidak masuk daftar peserta kegiatan reguler", n_reg == baseline - 1,
            f"{n_reg} vs {baseline - 1}")

        # --- tetap dapat dicari admin --------------------------------------
        r = await c.get("/api/admin/users")
        cek("tetap tampil di daftar admin", r.status_code == 200 and
            any(x["id"] == str(peserta_id) for x in r.json()), r.text[:200])

        # --- tidak bisa login ----------------------------------------------
        await c.post("/api/auth/logout")
        r = await c.post("/api/auth/login",
                         json={"identifier": "ahmad@example.com", "password": "rahasia123"})
        cek("nonaktif tidak bisa login", r.status_code == 403, r.status_code)

        # --- aktifkan kembali ----------------------------------------------
        await c.post("/api/auth/login",
                     json={"identifier": "adminuji", "password": "rahasia123"})
        r = await c.patch(f"/api/admin/users/{peserta_id}", json={"status": "active"})
        cek("aktifkan kembali", r.status_code == 200 and r.json()["status"] == "active",
            r.text[:300])
        aktif = await server.db.users.count_documents(server.PESERTA_QUERY)
        cek("kembali masuk daftar peserta aktif", aktif == baseline, f"{aktif} vs {baseline}")
        n_abs = await server.db.absensis.count_documents({"user_id": str(peserta_id)})
        cek("riwayat absensi utuh setelah dipulihkan", n_abs == 1, n_abs)

        # --- status calon peserta ------------------------------------------
        r = await c.patch(f"/api/admin/users/{peserta_id}", json={"status": "calon"})
        cek("status calon diterima", r.status_code == 200 and r.json()["status"] == "calon",
            r.text[:300])
        r = await c.patch(f"/api/admin/users/{peserta_id}", json={"status": "ngawur"})
        cek("status tidak valid ditolak", r.status_code == 400, r.status_code)

        # --- status pindah tetap berfungsi (fitur lama) ---------------------
        r = await c.patch(f"/api/admin/users/{peserta_id}", json={"status": "pindah"})
        cek("status pindah tetap berfungsi", r.status_code == 200 and
            r.json()["status"] == "pindah", r.text[:200])

        # --- pencocokan pendaftaran mengenali calon -------------------------
        await server.db.users.update_one({"_id": peserta_id},
                                         {"$set": {"status": "calon"}})
        pid, akun = await server._pendaftaran_cocok("Ahmad Fauzi", "6281200000002")
        cek("pendaftaran mengenali status calon", akun == "calon", akun)

    print()
    if GAGAL:
        print(f"GAGAL: {len(GAGAL)} pemeriksaan -> {GAGAL}")
        return 1
    print("SEMUA PEMERIKSAAN LULUS")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
