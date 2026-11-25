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

        r = await c.post("/api/auth/login",
                         json={"identifier": "adminuji", "password": "rahasia123"})
        cek("login staff", r.status_code == 200, r.text[:200])

        # --- buat kegiatan: bawaan ----------------------------------------
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
        cek("bawaan wajib konfirmasi", keg.get("wajib_konfirmasi") is True)
        cek("bawaan nomor HP wajib", keg.get("hp_wajib") is True, keg.get("hp_wajib"))
        cek("bawaan kegiatan umum mati", keg.get("kegiatan_umum") is False,
            keg.get("kegiatan_umum"))
        cek("bawaan logo tampil", keg.get("tampilkan_logo") is True,
            keg.get("tampilkan_logo"))
        cek("total mulai dari 0", keg.get("total") == 0, keg.get("total"))

        # --- info publik ---------------------------------------------------
        r = await c.get(f"/api/publik/daftar/{keg['token']}")
        cek("info publik", r.status_code == 200, r.text[:200])
        info = r.json()
        cek("alasan publik", info.get("alasan") == list(server.PENDAFTARAN_ALASAN))
        cek("info publik memuat hp_wajib", info.get("hp_wajib") is True)
        cek("info publik memuat tampilkan_logo", info.get("tampilkan_logo") is True)

        # --- konfirmasi hadir peserta terdaftar ----------------------------
        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "Ahmad Fauzi", "nomor_hp": "081200000002", "kehadiran": "hadir",
        })
        cek("konfirmasi hadir", r.status_code == 200, r.text[:300])

        # --- satu nomor satu jawaban ---------------------------------------
        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "Ahmad Fauzi", "nomor_hp": "6281200000002",
            "kehadiran": "tidak_hadir", "alasan": "Sakit",
        })
        cek("nomor sama memperbarui jawaban",
            r.status_code == 200 and r.json().get("diperbarui") is True, r.text[:200])

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

        # --- kegiatan umum: nomor HP opsional, tanpa pencocokan ------------
        r = await c.post("/api/staff/pendaftaran", json={
            "nama": "Lomba 17 Agustus", "tanggal": "2026-12-20",
            "lokasi": "Lapangan Desa", "penyelenggara": "Karang Taruna Desa X",
            "kegiatan_umum": True, "hp_wajib": False, "tampilkan_logo": False,
        })
        cek("buat kegiatan umum", r.status_code == 200, r.text[:300])
        umum = r.json()
        cek("kegiatan umum tersimpan", umum.get("kegiatan_umum") is True)
        cek("nomor HP opsional tersimpan", umum.get("hp_wajib") is False)
        cek("logo disembunyikan tersimpan", umum.get("tampilkan_logo") is False)
        cek("penyelenggara tersimpan", umum.get("penyelenggara") == "Karang Taruna Desa X",
            umum.get("penyelenggara"))

        r = await c.get(f"/api/publik/daftar/{umum['token']}")
        cek("info publik kegiatan umum", r.status_code == 200, r.text[:200])
        iu = r.json()
        cek("publik: hp opsional", iu.get("hp_wajib") is False)
        cek("publik: tanpa logo", iu.get("tampilkan_logo") is False)
        cek("publik: penyelenggara", iu.get("penyelenggara") == "Karang Taruna Desa X")

        r = await c.post(f"/api/publik/daftar/{umum['token']}", json={
            "nama": "Warga Luar", "kehadiran": "hadir",
        })
        cek("konfirmasi tanpa nomor HP", r.status_code == 200, r.text[:300])

        # --- duplikat nama saat nomor HP kosong ----------------------------
        r = await c.post(f"/api/publik/daftar/{umum['token']}", json={
            "nama": "  WARGA   luar ", "kehadiran": "hadir",
        })
        cek("nama sama tanpa nomor ditolak", r.status_code == 409, r.text[:200])
        cek("pesan duplikat nama jelas",
            "sudah mendaftar" in r.text, r.text[:200])

        r = await c.post(f"/api/publik/daftar/{umum['token']}", json={
            "nama": "Warga Luar Sekali", "kehadiran": "hadir",
        })
        cek("nama berbeda diterima", r.status_code == 200, r.text[:200])

        # --- kegiatan umum: semua ikut jadi tamu ---------------------------
        r = await c.post(f"/api/staff/pendaftaran/{umum['id']}/buat-kegiatan")
        cek("buat kegiatan berabsen (umum)", r.status_code == 200, r.text[:300])
        hasil = r.json()
        cek("kegiatan umum tanpa peserta terpasang", hasil.get("peserta") == 0, hasil)
        cek("kegiatan umum semua tamu", hasil.get("tamu") == 2, hasil)

        # --- kegiatan biasa: pencocokan peserta tetap ----------------------
        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "Ahmad Fauzi", "nomor_hp": "081200000002", "kehadiran": "hadir",
        })
        cek("kembali memilih ikut", r.status_code == 200, r.text[:200])
        r = await c.post(f"/api/staff/pendaftaran/{keg['id']}/buat-kegiatan")
        cek("buat kegiatan berabsen", r.status_code == 200, r.text[:300])
        hasil = r.json()
        cek("peserta terpasang", hasil.get("peserta") == 1, hasil)
        r = await c.post(f"/api/staff/pendaftaran/{keg['id']}/buat-kegiatan")
        cek("tidak membuat kegiatan ganda",
            r.status_code == 200 and r.json().get("dibuat") is False, r.text[:200])

        # --- detail --------------------------------------------------------
        r = await c.get(f"/api/staff/pendaftaran/{keg['id']}")
        cek("detail kegiatan", r.status_code == 200, r.text[:200])
        d = r.json()
        cek("detail memuat penyelenggara", "penyelenggara" in d)
        cek("detail memuat hp_wajib", d.get("hp_wajib") is True)
        cek("detail memuat kegiatan_umum", d.get("kegiatan_umum") is False)
        cek("detail memuat tampilkan_logo", d.get("tampilkan_logo") is True)

        # --- endpoint ekspor sudah dihapus ---------------------------------
        r = await c.get(f"/api/staff/pendaftaran/{keg['id']}/export?format=excel")
        cek("ekspor kegiatan dihapus", r.status_code in (404, 405), r.status_code)
        r = await c.get("/api/staff/pendaftaran/rekap")
        cek("rekap dihapus", r.status_code in (404, 405, 410), r.status_code)
        r = await c.get("/api/staff/pendaftaran/rekap/export?format=excel")
        cek("ekspor rekap dihapus", r.status_code in (404, 405), r.status_code)

        # --- arsip ---------------------------------------------------------
        r = await c.post(f"/api/staff/pendaftaran/{keg['id']}/status",
                         json={"status": "arsip"})
        cek("arsipkan", r.status_code == 200 and r.json()["status_tampil"] == "arsip",
            r.text[:200])
        r = await c.get(f"/api/publik/daftar/{keg['token']}")
        cek("tautan arsip ditutup",
            r.status_code == 200 and r.json().get("jadwal_status") == "ditutup",
            r.text[:200])
        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "Nama Uji", "nomor_hp": "081900000011", "kehadiran": "hadir",
        })
        cek("konfirmasi ke arsip ditolak", r.status_code == 410, r.status_code)
        r = await c.get("/api/staff/pendaftaran?status=arsip")
        cek("daftar arsip", r.status_code == 200 and len(r.json()["items"]) == 1, r.text[:200])

        # --- hapus permanen -------------------------------------------------
        r = await c.delete(f"/api/staff/pendaftaran/{keg['id']}")
        cek("hapus permanen", r.status_code == 200, r.text[:200])
        r = await c.get(f"/api/staff/pendaftaran/{keg['id']}")
        cek("kegiatan terhapus", r.status_code == 410, r.status_code)

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
