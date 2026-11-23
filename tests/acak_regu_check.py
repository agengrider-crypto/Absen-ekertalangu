"""Uji acak regu & nomor undian dengan data campuran (tanpa MongoDB sungguhan).

Kasus: jenis kelamin kosong, kategori kosong, nama sama, dan jumlah regu
lebih besar dari jumlah peserta.

    pip install mongomock-motor httpx
    python tests/acak_regu_check.py
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
        await server.db.users.insert_one({
            "_id": server.ObjectId(), "name": "Admin Uji", "username": "adminuji",
            "email": "adminuji@example.com", "phone": "6281100000001",
            "password_hash": server.hash_password("rahasia123"),
            "roles": ["admin", "pengurus", "peserta"], "status": "active",
            "token_version": 0, "is_system": True,
        })
        # Data campuran: gender kosong, kategori kosong, nama sama.
        orang = [
            ("Budi", "L", "belum_menikah"),
            ("Budi", None, None),
            ("Siti", "P", None),
            ("Agus", None, "sudah_menikah"),
            ("Rina", "P", "belum_menikah"),
            ("Joko", "L", None),
        ]
        for nama, gender, marital in orang:
            doc = {"_id": server.ObjectId(), "name": nama, "username": f"u{server.uuid.uuid4().hex[:6]}",
                   "phone": f"62812{server.uuid.uuid4().int % 100000000:08d}",
                   "password_hash": server.hash_password("rahasia123"),
                   "roles": ["peserta"], "status": "active", "token_version": 0}
            if gender:
                doc["gender"] = gender
            if marital:
                doc["marital"] = marital
            await server.db.users.insert_one(doc)

        r = await c.post("/api/auth/login",
                         json={"identifier": "adminuji", "password": "rahasia123"})
        cek("login staff", r.status_code == 200, r.text[:200])

        r = await c.post("/api/admin/kegiatan", json={
            "name": "Kegiatan Uji Acak", "type": "rutin",
            "date": server.now_wita().strftime("%Y-%m-%d"),
            "start_time": "05:00", "end_time": "23:30",
            "audience": "publik", "gender_filter": "semua",
        })
        cek("buat kegiatan", r.status_code == 200, r.text[:300])
        body = r.json()
        keg = body[0] if isinstance(body, list) else body

        # 1. Seimbang + kategori/gender kosong (penyebab error 500 sebelumnya).
        r = await c.post(f"/api/staff/kegiatan/{keg['id']}/acak-regu", json={
            "sumber": "terdaftar", "mode": "jumlah_regu", "nilai": 4, "seimbang": True,
        })
        cek("acak regu seimbang dengan data kosong", r.status_code == 200, r.text[:300])
        if r.status_code == 200:
            regu = r.json()["regu"]
            cek("jumlah regu sesuai", len(regu) == 4, len(regu))
            total = sum(len(x["anggota"]) for x in regu)
            cek("semua peserta terbagi", total == r.json()["jumlah_peserta"], total)

        # 2. Tanpa seimbang.
        r = await c.post(f"/api/staff/kegiatan/{keg['id']}/acak-regu", json={
            "sumber": "terdaftar", "mode": "anggota_per_regu", "nilai": 2, "seimbang": False,
        })
        cek("acak regu tanpa seimbang", r.status_code == 200, r.text[:200])

        # 3. Jumlah regu melebihi peserta.
        r = await c.post(f"/api/staff/kegiatan/{keg['id']}/acak-regu", json={
            "sumber": "terdaftar", "mode": "jumlah_regu", "nilai": 999, "seimbang": True,
        })
        cek("jumlah regu melebihi peserta ditolak",
            r.status_code == 400 and "melebihi" in r.text, r.text[:200])

        # 4. Sumber kosong (belum ada yang hadir).
        r = await c.post(f"/api/staff/kegiatan/{keg['id']}/acak-regu", json={
            "sumber": "hadir", "mode": "jumlah_regu", "nilai": 2, "seimbang": True,
        })
        cek("belum ada yang hadir ditolak",
            r.status_code == 400 and "hadir" in r.text.lower(), r.text[:200])

        # 5. Nomor undian unik.
        r = await c.post(f"/api/staff/kegiatan/{keg['id']}/acak-undian",
                         json={"sumber": "terdaftar"})
        cek("acak nomor undian", r.status_code == 200, r.text[:200])
        if r.status_code == 200:
            nomor = [u["nomor"] for u in r.json()["undian"]]
            cek("nomor unik", len(nomor) == len(set(nomor)), nomor)

        # 6. Sumber tidak valid.
        r = await c.post(f"/api/staff/kegiatan/{keg['id']}/acak-undian",
                         json={"sumber": "ngawur"})
        cek("sumber tidak valid ditolak", r.status_code == 400, r.text[:200])

    print()
    if GAGAL:
        print(f"GAGAL: {len(GAGAL)} pemeriksaan -> {GAGAL}")
        return 1
    print("SEMUA PEMERIKSAAN LULUS")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
