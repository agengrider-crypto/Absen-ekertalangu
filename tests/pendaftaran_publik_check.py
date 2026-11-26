"""Uji gabungan: pendaftaran publik, pencarian nama, izin, dan rekap publik.

Tanpa data asli (mongomock-motor + httpx).

    pip install mongomock-motor httpx
    python tests/pendaftaran_publik_check.py
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
        peserta_ids = {}
        for nama, uname, hp in [
            ("Ahmad Fauzi", "ahmad", "6281200000002"),
            ("Ahmad Fauzan", "fauzan", "6281200000003"),
            ("Budi Santoso", "budi", "6281300000004"),
            ("Citra Dewi", "citra", "6281400000005"),
            ("Dewi Lestari", "dewi", "6281500000006"),
            ("Eka Putri", "eka", "6281600000007"),
            ("Fajar Nugroho", "fajar", "6281700000008"),
        ]:
            oid = server.ObjectId()
            peserta_ids[nama] = str(oid)
            await server.db.users.insert_one({
                "_id": oid, "name": nama, "username": uname,
                "email": f"{uname}@example.com", "phone": hp,
                "password_hash": server.hash_password("rahasia123"),
                "roles": ["peserta"], "status": "active", "token_version": 0,
            })
        # Peserta belum aktivasi: tidak boleh muncul di pencarian.
        await server.db.users.insert_one({
            "_id": server.ObjectId(), "name": "Ahmad Belum", "username": "ahmadbelum",
            "email": "ahmadbelum@example.com", "phone": "6281900000009",
            "password_hash": None, "roles": ["peserta"], "status": "pending",
            "token_version": 0,
        })

        r = await c.post("/api/auth/login",
                         json={"identifier": "adminuji", "password": "rahasia123"})
        cek("login staff", r.status_code == 200, r.text[:200])

        # ================= UJI 5: endpoint pencarian =====================
        r = await c.get("/api/publik/peserta/cari", params={"q": "a"})
        cek("pencarian 1 huruf kosong", r.status_code == 200 and r.json()["items"] == [],
            r.text[:200])
        r = await c.get("/api/publik/peserta/cari", params={"q": "ahmad"})
        cek("pencarian 2+ huruf", r.status_code == 200, r.text[:200])
        items = r.json()["items"]
        cek("maksimal 5 hasil", len(items) <= 5, len(items))
        cek("hanya id dan nama",
            all(set(i.keys()) == {"id", "nama"} for i in items), items[:1])
        cek("peserta belum aktivasi tidak muncul",
            all(i["nama"] != "Ahmad Belum" for i in items), items)
        r = await c.get("/api/publik/peserta/cari", params={"q": "a"})
        cek("pencarian 1 huruf tetap kosong", r.json()["items"] == [])

        # pembatasan per IP
        await server.db.pendaftaran_cari_laju.delete_many({})
        for _ in range(server.PENDAFTARAN_CARI_LAJU):
            await c.get("/api/publik/peserta/cari", params={"q": "ahmad"})
        r = await c.get("/api/publik/peserta/cari", params={"q": "ahmad"})
        cek("pencarian kena pembatasan per IP", r.status_code == 429, r.status_code)
        await server.db.pendaftaran_cari_laju.delete_many({})

        # ================= UJI 1: HP kosong tidak 500 ====================
        r = await c.post("/api/staff/pendaftaran", json={
            "nama": "Lomba Desa", "tanggal": "2026-12-20", "lokasi": "Lapangan",
            "kegiatan_umum": True, "hp_wajib": False, "tampilkan_logo": False,
        })
        cek("buat kegiatan umum", r.status_code == 200, r.text[:300])
        umum = r.json()

        r = await c.post(f"/api/publik/daftar/{umum['token']}", json={
            "nama": "Tamu Satu", "kehadiran": "hadir"})
        cek("daftar HP kosong sukses", r.status_code == 200, r.text[:300])
        r = await c.post(f"/api/publik/daftar/{umum['token']}", json={
            "nama": "Tamu Dua", "kehadiran": "hadir"})
        cek("daftar HP kosong kedua sukses", r.status_code == 200, r.text[:300])
        r = await c.post(f"/api/publik/daftar/{umum['token']}", json={
            "nama": "Tamu Tiga", "kehadiran": "tidak_hadir", "alasan": "Sakit"})
        cek("daftar HP kosong ketiga sukses", r.status_code == 200, r.text[:300])
        n = await server.db.pendaftaran_konfirmasi.count_documents(
            {"kegiatan_id": umum["id"]})
        cek("tiga baris tersimpan tanpa bentrok", n == 3, n)

        # ================= UJI 2: daftar dua kali → 409 ==================
        r = await c.post(f"/api/publik/daftar/{umum['token']}", json={
            "nama": "  tamu   satu ", "kehadiran": "hadir"})
        cek("nama sama tanpa HP ditolak 409", r.status_code == 409, r.status_code)
        cek("pesan ramah", "sudah mendaftar" in r.text, r.text[:200])
        n = await server.db.pendaftaran_konfirmasi.count_documents(
            {"kegiatan_id": umum["id"]})
        cek("tidak ada data ganda", n == 3, n)

        # ================= UJI 3: pilih peserta lewat pencarian ==========
        jumlah_awal = await server.db.users.count_documents({})
        r = await c.post(f"/api/publik/daftar/{umum['token']}", json={
            "nama": "Ahmad Fauzi", "peserta_id": peserta_ids["Ahmad Fauzi"],
            "kehadiran": "hadir"})
        cek("daftar dengan peserta_id", r.status_code == 200, r.text[:300])
        row = await server.db.pendaftaran_konfirmasi.find_one(
            {"kegiatan_id": umum["id"], "peserta_id": peserta_ids["Ahmad Fauzi"]})
        cek("peserta_id tersimpan", bool(row), row)
        cek("status akun aktif", (row or {}).get("status_akun") == "aktif",
            (row or {}).get("status_akun"))
        jumlah_user = await server.db.users.count_documents({})
        cek("tidak ada peserta baru", jumlah_user == jumlah_awal,
            f"{jumlah_user} vs {jumlah_awal}")

        # peserta_id tidak valid
        r = await c.post(f"/api/publik/daftar/{umum['token']}", json={
            "nama": "Nama Apa", "peserta_id": "bukan-objectid", "kehadiran": "hadir"})
        cek("peserta_id tidak valid ditolak", r.status_code == 400, r.status_code)

        # ================= UJI 4: nama tidak ketemu → tamu ===============
        r = await c.post(f"/api/publik/daftar/{umum['token']}", json={
            "nama": "Orang Baru Sekali", "kehadiran": "hadir"})
        cek("nama tidak ketemu bisa daftar tamu", r.status_code == 200, r.text[:300])
        row = await server.db.pendaftaran_konfirmasi.find_one(
            {"kegiatan_id": umum["id"], "nama": "Orang Baru Sekali"})
        cek("tamu tanpa peserta_id", (row or {}).get("peserta_id") is None, row)

        # ================= UJI 6: formulir izin ==========================
        r = await c.post("/api/staff/pendaftaran", json={
            "nama": "Pengajian Uji", "tanggal": "2026-12-06", "lokasi": "Masjid"})
        cek("buat kegiatan pendaftaran biasa", r.status_code == 200, r.text[:300])
        keg = r.json()

        kid = str(server.ObjectId())
        await server.db.kegiatans.insert_one({
            "_id": kid, "name": "Pengajian Uji", "type": "rutin",
            "date": server.now_wita().strftime("%Y-%m-%d"),
            "start_time": "08:00", "end_time": "23:59",
            "location": "Masjid", "audience": "publik", "gender_filter": "semua",
            "status": "open", "izin_token": "izin-token-uji",
            "created_at": server.now_wita().isoformat(),
        })
        r = await c.get("/api/publik/izin/izin-token-uji")
        cek("info izin publik", r.status_code == 200, r.text[:200])
        cek("info izin tanpa daftar peserta", "peserta" not in r.json(), r.json().keys())
        r = await c.post("/api/publik/izin/izin-token-uji", json={
            "peserta_id": peserta_ids["Budi Santoso"], "alasan": "Sakit"})
        cek("kirim izin dengan id peserta", r.status_code == 200, r.text[:300])
        izin = await server.db.izin_kegiatan.find_one(
            {"kegiatan_id": kid, "peserta_id": peserta_ids["Budi Santoso"]})
        cek("izin tersimpan dengan id benar", bool(izin), izin)
        absen = await server.db.absensis.find_one(
            {"kegiatan_id": kid, "user_id": peserta_ids["Budi Santoso"]})
        cek("absen izin tercatat", (absen or {}).get("status") == "izin", absen)
        r = await c.post("/api/publik/izin/izin-token-uji", json={
            "peserta_id": "bukan-id", "alasan": "Sakit"})
        cek("izin id tidak valid ditolak", r.status_code == 400, r.status_code)

        # ================= UJI 7: rekap publik ===========================
        r = await c.get(f"/api/publik/rekap-pendaftaran/token-apa-saja")
        cek("rekap saklar mati 404", r.status_code == 404, r.status_code)
        cek("pesan seragam", "Tautan tidak tersedia" in r.text, r.text[:200])

        r = await c.post(f"/api/staff/pendaftaran/{umum['id']}/rekap-publik",
                         json={"aktif": True})
        cek("nyalakan rekap publik", r.status_code == 200, r.text[:300])
        rk = r.json()
        cek("token rekap dibuat", bool(rk.get("rekap_token")), rk)
        cek("token rekap beda dari token pendaftaran",
            rk["rekap_token"] != umum["token"], rk)
        cek("link rekap", (rk.get("link") or "").endswith(
            f"/rekap-pendaftaran/{rk['rekap_token']}"), rk.get("link"))

        r = await c.get(f"/api/publik/rekap-pendaftaran/{rk['rekap_token']}")
        cek("rekap publik terbuka", r.status_code == 200, r.text[:300])
        d = r.json()
        cek("rekap: total", d.get("total") == 5, d.get("total"))
        cek("rekap: ikut", d.get("ikut") == 4, d.get("ikut"))
        cek("rekap: tidak ikut", d.get("tidak_ikut") == 1, d.get("tidak_ikut"))
        cek("rekap: nama ikut urut abjad",
            d.get("nama_ikut") == sorted(d.get("nama_ikut") or [], key=str.lower),
            d.get("nama_ikut"))
        cek("rekap: tanpa nomor HP", "nomor_hp" not in r.text, r.text[:200])
        cek("rekap: tanpa keterangan", "keterangan" not in r.text)
        cek("rekap: tanpa kelompok", "kelompok" not in r.text)
        cek("rekap: tanpa _id", "_id" not in r.text)
        cek("rekap: tanpa alasan", "alasan" not in r.text)
        cek("rekap: logo mengikuti saklar", d.get("tampilkan_logo") is False,
            d.get("tampilkan_logo"))

        # ================= UJI 8: token salah / arsip ====================
        r = await c.get(f"/api/publik/rekap-pendaftaran/{umum['token']}")
        cek("token pendaftaran tidak bisa buka rekap", r.status_code == 404,
            r.status_code)
        r = await c.get("/api/publik/rekap-pendaftaran/token-acak-123")
        cek("token acak 404 sama", r.status_code == 404, r.status_code)

        r = await c.post(f"/api/staff/pendaftaran/{umum['id']}/status",
                         json={"status": "arsip"})
        cek("arsipkan kegiatan", r.status_code == 200, r.text[:200])
        r = await c.get(f"/api/publik/rekap-pendaftaran/{rk['rekap_token']}")
        cek("rekap mati setelah arsip", r.status_code == 404, r.status_code)
        await c.post(f"/api/staff/pendaftaran/{umum['id']}/status",
                     json={"status": "aktif"})

        # saklar dimatikan
        r = await c.post(f"/api/staff/pendaftaran/{umum['id']}/rekap-publik",
                         json={"aktif": False})
        cek("matikan rekap publik", r.status_code == 200 and
            r.json().get("rekap_publik") is False, r.text[:200])
        r = await c.get(f"/api/publik/rekap-pendaftaran/{rk['rekap_token']}")
        cek("rekap mati setelah saklar off", r.status_code == 404, r.status_code)

        # token tetap sama saat dinyalakan lagi
        r = await c.post(f"/api/staff/pendaftaran/{umum['id']}/rekap-publik",
                         json={"aktif": True})
        cek("token rekap stabil", r.json().get("rekap_token") == rk["rekap_token"],
            r.json().get("rekap_token"))

        # ================= UJI 10: pendaftaran lama tetap normal =========
        r = await c.get(f"/api/publik/daftar/{keg['token']}")
        cek("pendaftaran lama tetap normal", r.status_code == 200, r.text[:200])
        cek("pendaftaran lama tanpa rekap", r.json().get("tampilkan_logo") is True)
        r = await c.post(f"/api/publik/daftar/{keg['token']}", json={
            "nama": "Citra Dewi", "nomor_hp": "081400000005", "kehadiran": "hadir"})
        cek("pendaftaran lama masih menerima jawaban", r.status_code == 200,
            r.text[:300])

        # ================= UJI 9: pesan WA hanya angka dan tautan ========
        r = await c.get(f"/api/staff/pendaftaran/{umum['id']}")
        cek("detail kegiatan", r.status_code == 200, r.text[:200])
        det = r.json()
        cek("detail memuat rekap_link", bool(det.get("rekap_link")), det.get("rekap_link"))
        cek("detail tidak membocorkan penanda tanpa HP",
            all(not str(p.get("nomor_hp") or "").startswith("tanpa-hp:")
                for p in det.get("peserta") or []),
            [p.get("nomor_hp") for p in det.get("peserta") or []])

        # ============ UJI 11: alasan tidak ikut di rekap publik ==========
        # Saklar alasan bawaan MATI.
        cek("saklar alasan bawaan mati", det.get("rekap_alasan_publik") is False,
            det.get("rekap_alasan_publik"))
        r = await c.get(f"/api/publik/rekap-pendaftaran/{rk['rekap_token']}")
        d = r.json()
        cek("rekap: nama_tidak_ikut ada", isinstance(d.get("nama_tidak_ikut"), list),
            d.get("nama_tidak_ikut"))
        cek("rekap: field alasan tidak ada sama sekali", "alasan" not in r.text,
            r.text[:300])
        cek("rekap: nama tidak ikut urut abjad",
            [x["nama"] for x in d.get("nama_tidak_ikut") or []]
            == sorted([x["nama"] for x in d.get("nama_tidak_ikut") or []], key=str.lower),
            d.get("nama_tidak_ikut"))

        # Nyalakan saklar alasan.
        r = await c.post(f"/api/staff/pendaftaran/{umum['id']}/rekap-alasan",
                         json={"aktif": True})
        cek("nyalakan saklar alasan", r.status_code == 200 and
            r.json().get("rekap_alasan_publik") is True, r.text[:300])
        r = await c.get(f"/api/publik/rekap-pendaftaran/{rk['rekap_token']}")
        d = r.json()
        cek("rekap: alasan muncul", "alasan" in r.text, r.text[:300])
        cek("rekap: alasan terisi", all(x.get("alasan") for x in
                                        d.get("nama_tidak_ikut") or []),
            d.get("nama_tidak_ikut"))
        cek("rekap: tetap tanpa nomor HP", "nomor_hp" not in r.text)
        cek("rekap: tetap tanpa _id", "_id" not in r.text)
        cek("rekap: tetap tanpa keterangan", "keterangan" not in r.text)

        # Log aktivitas tercatat.
        log = await server.db.activity_logs.find_one(
            {"action": "pendaftaran_rekap_alasan"})
        cek("log aktivitas saklar alasan", bool(log), log)

        # Matikan lagi → alasan hilang dari respons.
        r = await c.post(f"/api/staff/pendaftaran/{umum['id']}/rekap-alasan",
                         json={"aktif": False})
        cek("matikan saklar alasan", r.status_code == 200 and
            r.json().get("rekap_alasan_publik") is False, r.text[:200])
        r = await c.get(f"/api/publik/rekap-pendaftaran/{rk['rekap_token']}")
        cek("alasan hilang dari respons", "alasan" not in r.text, r.text[:300])

        # Saklar alasan tidak bisa dinyalakan bila rekap publik mati.
        await c.post(f"/api/staff/pendaftaran/{umum['id']}/rekap-publik",
                     json={"aktif": False})
        r = await c.post(f"/api/staff/pendaftaran/{umum['id']}/rekap-alasan",
                         json={"aktif": True})
        cek("alasan ditolak bila rekap publik mati", r.status_code == 400,
            r.status_code)

        # Nyalakan rekap lagi + alasan, lalu matikan rekap → alasan ikut mati.
        await c.post(f"/api/staff/pendaftaran/{umum['id']}/rekap-publik",
                     json={"aktif": True})
        await c.post(f"/api/staff/pendaftaran/{umum['id']}/rekap-alasan",
                     json={"aktif": True})
        r = await c.post(f"/api/staff/pendaftaran/{umum['id']}/rekap-publik",
                         json={"aktif": False})
        cek("matikan rekap ikut mematikan alasan",
            r.json().get("rekap_alasan_publik") is False, r.text[:200])
        kdoc = await server.db.pendaftaran_kegiatan.find_one({"_id": umum["id"]})
        cek("alasan tersimpan mati di database",
            kdoc.get("rekap_alasan_publik") is False,
            kdoc.get("rekap_alasan_publik"))

        # ============ UJI 12: admin melihat alasan selalu ================
        r = await c.get(f"/api/staff/pendaftaran/{umum['id']}")
        det = r.json()
        tidak = [p for p in det.get("peserta") or []
                 if p.get("kehadiran") == "tidak_hadir"]
        cek("admin: daftar tidak ikut ada", len(tidak) >= 1, len(tidak))
        cek("admin: alasan selalu terlihat walau saklar mati",
            all("alasan" in p for p in tidak), tidak[:1])

        # ============ UJI 13: peran tanpa hak ditolak ====================
        await c.post("/api/auth/logout")
        r = await c.get(f"/api/staff/pendaftaran/{umum['id']}")
        cek("tanpa login ditolak", r.status_code in (401, 403), r.status_code)
        r = await c.post(f"/api/staff/pendaftaran/{umum['id']}/rekap-alasan",
                         json={"aktif": True})
        cek("saklar alasan tanpa login ditolak", r.status_code in (401, 403),
            r.status_code)

        # Peserta biasa (bukan staf) juga ditolak.
        await c.post("/api/auth/login",
                     json={"identifier": "budi", "password": "rahasia123"})
        r = await c.get(f"/api/staff/pendaftaran/{umum['id']}")
        cek("peserta ditolak endpoint admin", r.status_code == 403, r.status_code)
        r = await c.post(f"/api/staff/pendaftaran/{umum['id']}/rekap-alasan",
                         json={"aktif": True})
        cek("peserta ditolak saklar alasan", r.status_code == 403, r.status_code)

    print()
    if GAGAL:
        print(f"GAGAL: {len(GAGAL)} pemeriksaan -> {GAGAL}")
        return 1
    print("SEMUA PEMERIKSAAN LULUS")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
