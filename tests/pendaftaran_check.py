"""Uji modul Pendaftaran Kegiatan (tanpa MongoDB sungguhan).

Memakai mongomock-motor sebagai pengganti Motor, lalu memanggil endpoint
lewat httpx ASGITransport. Tidak menyentuh database produksi.

Butuh paket tambahan (tidak dipakai produksi):

    pip install mongomock-motor httpx

Jalankan dari root repo:

    python tests/pendaftaran_check.py
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

# Ganti client Motor dengan mongomock sebelum database dipakai.
_mock_client = mongomock_motor.AsyncMongoMockClient()
server.client = _mock_client
server._db_real = _mock_client[server._DB_NAME]
server._db_demo = _mock_client[f"{server._DB_NAME}_demo"]

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
        # --- siapkan akun staff & peserta ---------------------------------
        await server.db.users.insert_one({
            "_id": server.ObjectId(), "name": "Admin Uji", "username": "adminuji",
            "email": "adminuji@example.com", "phone": "6281100000001",
            "password_hash": server.hash_password("rahasia123"),
            "roles": ["admin", "pengurus", "peserta"], "status": "active",
            "token_version": 0, "is_system": True,
        })
        await server.db.users.insert_one({
            "_id": server.ObjectId(), "name": "Ahmad Fauzi", "username": "ahmad",
            "email": "ahmad@example.com", "phone": "6281200000002",
            "password_hash": server.hash_password("rahasia123"),
            "roles": ["peserta"], "status": "active", "token_version": 0,
        })
        await server.db.users.insert_one({
            "_id": server.ObjectId(), "name": "Budi Santoso", "username": "budi",
            "email": "budi@example.com", "phone": "6281300000003",
            "password_hash": None, "roles": ["peserta"], "status": "pending",
            "token_version": 0,
        })

        r = await c.post("/api/auth/login",
                         json={"identifier": "adminuji", "password": "rahasia123"})
        cek("login staff", r.status_code == 200, r.text[:200])

        # --- buat kegiatan -------------------------------------------------
        r = await c.post("/api/staff/pendaftaran", json={
            "nama": "Pengajian Rutin Ahad Pagi", "tanggal": "2026-12-06",
            "lokasi": "Masjid Kertalangu", "catatan": "Bawa kartu peserta",
        })
        cek("buat kegiatan", r.status_code == 200, r.text[:300])
        keg = r.json()
        cek("token dibuat", bool(keg.get("token")))
        cek("link publik", (keg.get("link") or "").endswith(f"/daftar/{keg['token']}"),
            keg.get("link"))
        cek("status aktif", keg.get("status_tampil") == "aktif", keg.get("status_tampil"))
        terdaftar = await server.db.users.count_documents(server.PESERTA_QUERY)
        cek("total peserta = jumlah peserta terdaftar",
            keg.get("total_peserta") == terdaftar,
            f"{keg.get('total_peserta')} vs {terdaftar}")

        # --- daftar --------------------------------------------------------
        r = await c.get("/api/staff/pendaftaran")
        cek("daftar kegiatan", r.status_code == 200 and len(r.json()["items"]) == 1, r.text[:200])

        # --- info publik ---------------------------------------------------
        r = await c.get(f"/api/publik/daftar/{keg['token']}")
        cek("info publik", r.status_code == 200, r.text[:200])
        cek("alasan publik", r.json().get("alasan") == list(server.PENDAFTARAN_ALASAN),
            r.json().get("alasan"))

        # --- konfirmasi HADIR peserta terdaftar ----------------------------
        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "Ahmad Fauzi", "nomor_hp": "081200000002", "kehadiran": "hadir",
        })
        cek("konfirmasi hadir", r.status_code == 200, r.text[:300])
        body = r.json()
        cek("peserta ditemukan", body.get("ditemukan") is True, body)
        cek("status akun aktif", body.get("status_akun") == "aktif", body.get("status_akun"))
        cek("pesan ditemukan", body.get("pesan") == "Peserta terdaftar ditemukan", body.get("pesan"))

        # --- konfirmasi TIDAK HADIR peserta belum aktivasi -----------------
        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "Budi Santoso", "nomor_hp": "081300000003",
            "kehadiran": "tidak_hadir", "alasan": "Kerja", "keterangan": "Shift pagi",
        })
        cek("konfirmasi tidak hadir", r.status_code == 200, r.text[:300])
        body = r.json()
        cek("status belum aktivasi", body.get("status_akun") == "belum_aktivasi",
            body.get("status_akun"))

        # --- konfirmasi calon peserta (tidak terdaftar) --------------------
        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "Citra Dewi", "nomor_hp": "081900000009",
            "kehadiran": "tidak_hadir", "alasan": "Lainnya", "alasan_lain": "Acara keluarga",
        })
        cek("konfirmasi calon", r.status_code == 200, r.text[:300])
        body = r.json()
        cek("calon tidak ditemukan", body.get("ditemukan") is False, body)
        cek("status calon", body.get("status_akun") == "calon", body.get("status_akun"))

        # --- validasi ------------------------------------------------------
        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "X", "nomor_hp": "081900000009", "kehadiran": "hadir",
        })
        cek("nama terlalu pendek ditolak", r.status_code == 400, r.text[:200])

        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "Nama Uji", "nomor_hp": "abc", "kehadiran": "hadir",
        })
        cek("nomor HP tidak valid ditolak", r.status_code == 400, r.text[:200])

        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "Nama Uji", "nomor_hp": "081900000010", "kehadiran": "tidak_hadir",
        })
        cek("alasan wajib saat tidak hadir", r.status_code == 400, r.text[:200])

        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "Nama Uji", "nomor_hp": "081900000010",
            "kehadiran": "tidak_hadir", "alasan": "Lainnya", "alasan_lain": "ab",
        })
        cek("alasan lainnya minimal 3 huruf", r.status_code == 400, r.text[:200])

        # --- konfirmasi ulang menimpa baris yang sama ----------------------
        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "Ahmad Fauzi", "nomor_hp": "081200000002",
            "kehadiran": "tidak_hadir", "alasan": "Sakit",
        })
        cek("konfirmasi ulang", r.status_code == 200 and r.json().get("diperbarui") is True,
            r.text[:200])

        # --- detail --------------------------------------------------------
        r = await c.get(f"/api/staff/pendaftaran/{keg['id']}")
        cek("detail kegiatan", r.status_code == 200, r.text[:200])
        d = r.json()
        cek("3 konfirmasi", len(d["peserta"]) == 3, len(d["peserta"]))
        cek("hadir 0", d["hadir"] == 0, d["hadir"])
        cek("tidak hadir 3", d["tidak_hadir"] == 3, d["tidak_hadir"])
        cek("belum konfirmasi = terdaftar - 2 cocok",
            d["belum_konfirmasi"] == terdaftar - 2,
            f"{d['belum_konfirmasi']} vs {terdaftar - 2}")
        cek("alasan kerja 1", d["alasan_ringkas"]["Kerja"] == 1, d["alasan_ringkas"])
        cek("alasan sakit 1", d["alasan_ringkas"]["Sakit"] == 1, d["alasan_ringkas"])
        cek("alasan lainnya 1", d["alasan_ringkas"]["Lainnya"] == 1, d["alasan_ringkas"])
        cek("persentase 0%", d["persentase_hadiran"] == 0, d["persentase_hadiran"])

        # --- rekap ---------------------------------------------------------
        r = await c.get("/api/staff/pendaftaran/rekap")
        cek("rekap", r.status_code == 200, r.text[:200])
        rk = r.json()
        cek("ringkasan kegiatan 1", rk["ringkasan"]["kegiatan"] == 1, rk["ringkasan"])
        cek("ringkasan tidak hadir 3", rk["ringkasan"]["tidak_hadir"] == 3, rk["ringkasan"])

        r = await c.get("/api/staff/pendaftaran/rekap?kehadiran=hadir")
        cek("filter kehadiran hadir", r.status_code == 200 and
            all(p["kehadiran"] == "hadir" for i in r.json()["items"] for p in i["peserta"]),
            r.text[:200])

        r = await c.get("/api/staff/pendaftaran/rekap?date_from=2027-01-01")
        cek("filter periode kosong", r.status_code == 200 and r.json()["items"] == [],
            r.text[:200])

        # --- ekspor --------------------------------------------------------
        r = await c.get(f"/api/staff/pendaftaran/{keg['id']}/export?format=excel")
        cek("ekspor excel", r.status_code == 200 and len(r.content) > 1000,
            f"{r.status_code} {len(r.content)}")
        r = await c.get(f"/api/staff/pendaftaran/{keg['id']}/export?format=pdf")
        cek("ekspor pdf", r.status_code == 200 and r.content[:4] == b"%PDF",
            f"{r.status_code} {r.content[:8]}")
        r = await c.get("/api/staff/pendaftaran/rekap/export?format=excel")
        cek("ekspor rekap excel", r.status_code == 200 and len(r.content) > 1000,
            f"{r.status_code} {len(r.content)}")
        r = await c.get("/api/staff/pendaftaran/rekap/export?format=pdf")
        cek("ekspor rekap pdf", r.status_code == 200 and r.content[:4] == b"%PDF",
            f"{r.status_code} {r.content[:8]}")

        # --- arsip ---------------------------------------------------------
        r = await c.post(f"/api/staff/pendaftaran/{keg['id']}/status", json={"status": "arsip"})
        cek("arsipkan", r.status_code == 200 and r.json()["status_tampil"] == "arsip",
            r.text[:200])
        r = await c.get(f"/api/publik/daftar/{keg['token']}")
        cek("tautan arsip ditutup", r.status_code == 410, r.status_code)
        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "Nama Uji", "nomor_hp": "081900000011", "kehadiran": "hadir",
        })
        cek("konfirmasi ke arsip ditolak", r.status_code == 410, r.status_code)

        r = await c.get("/api/staff/pendaftaran?status=arsip")
        cek("daftar arsip", r.status_code == 200 and len(r.json()["items"]) == 1, r.text[:200])

        # --- aktifkan lagi -------------------------------------------------
        r = await c.post(f"/api/staff/pendaftaran/{keg['id']}/status", json={"status": "aktif"})
        cek("aktifkan lagi", r.status_code == 200 and r.json()["status_tampil"] == "aktif",
            r.text[:200])

        # --- buat ulang tautan ---------------------------------------------
        token_lama = keg["token"]
        r = await c.post(f"/api/staff/pendaftaran/{keg['id']}/tautan")
        cek("buat ulang tautan", r.status_code == 200 and r.json()["token"] != token_lama,
            r.text[:200])
        r = await c.get(f"/api/publik/daftar/{token_lama}")
        cek("token lama mati", r.status_code == 404, r.status_code)

        # --- hapus permanen -------------------------------------------------
        r = await c.delete(f"/api/staff/pendaftaran/{keg['id']}")
        cek("hapus permanen", r.status_code == 200, r.text[:200])
        r = await c.get(f"/api/staff/pendaftaran/{keg['id']}")
        cek("kegiatan terhapus", r.status_code == 404, r.status_code)
        sisa = await server.db.pendaftaran_konfirmasi.count_documents({})
        cek("konfirmasi ikut terhapus", sisa == 0, sisa)

        # --- guard ----------------------------------------------------------
        await c.post("/api/auth/logout")
        r = await c.get("/api/staff/pendaftaran")
        cek("tanpa login ditolak", r.status_code == 401, r.status_code)

    print()
    if GAGAL:
        print(f"GAGAL: {len(GAGAL)} pemeriksaan -> {GAGAL}")
        return 1
    print("SEMUA PEMERIKSAAN LULUS")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
