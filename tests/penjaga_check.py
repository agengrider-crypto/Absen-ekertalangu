"""Uji Penjaga Absen (tahap 1): penunjukan, absen, batal, scan, tamu, laporan,
alpha otomatis, dan ringkasan live admin.

Tanpa data asli (mongomock-motor + httpx).

    pip install mongomock-motor httpx
    python tests/penjaga_check.py
"""
import asyncio
import os
import sys
from datetime import timedelta
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
        # ---------------- data dasar ----------------
        await server.db.users.insert_one({
            "_id": server.ObjectId(), "name": "Admin Uji", "username": "adminuji",
            "email": "adminuji@example.com", "phone": "6281100000001",
            "password_hash": server.hash_password("rahasia123"),
            "roles": ["admin", "pengurus", "peserta"], "status": "active",
            "token_version": 0, "is_system": True,
        })
        await server.db.users.insert_one({
            "_id": server.ObjectId(), "name": "Pengurus Uji", "username": "pengurusuji",
            "email": "pengurusuji@example.com", "phone": "6281100000002",
            "password_hash": server.hash_password("rahasia123"),
            "roles": ["pengurus", "peserta"], "status": "active",
            "token_version": 0,
        })
        peserta = {}
        for nama, uname, hp in [
            ("Ahmad Fauzi", "ahmad", "6281200000002"),
            ("Budi Santoso", "budi", "6281300000004"),
            ("Citra Dewi", "citra", "6281400000005"),
        ]:
            oid = server.ObjectId()
            peserta[nama] = str(oid)
            await server.db.users.insert_one({
                "_id": oid, "name": nama, "username": uname,
                "email": f"{uname}@example.com", "phone": hp,
                "password_hash": server.hash_password("rahasia123"),
                "roles": ["peserta"], "status": "active", "token_version": 0,
            })
        # Penjaga absen = peserta "Ahmad Fauzi"; peserta lain bukan penjaga.
        penjaga_id = peserta["Ahmad Fauzi"]

        r = await c.post("/api/auth/login",
                         json={"identifier": "adminuji", "password": "rahasia123"})
        cek("login admin", r.status_code == 200, r.text[:200])

        # ---------------- buat kegiatan hari ini ----------------
        hari_ini = server.now_wita().strftime("%Y-%m-%d")
        r = await c.post("/api/admin/kegiatan", json={
            "name": "Kajian Uji", "type": "rutin", "date": hari_ini,
            "start_time": "08:00", "end_time": "23:59", "location": "Masjid",
            "audience": "publik",
        })
        cek("buat kegiatan", r.status_code == 200, r.text[:300])
        keg = r.json()[0]
        kid = keg["id"]

        # ---------------- A. penunjukan penjaga ----------------
        r = await c.post(f"/api/staff/kegiatan/{kid}/delegate",
                         json={"grantee_id": penjaga_id, "reason": "Pengurus di luar kota"})
        cek("tunjuk penjaga absen", r.status_code == 200, r.text[:300])
        deleg_id = r.json()["id"]

        r = await c.get(f"/api/staff/kegiatan/{kid}/delegations")
        cek("daftar delegasi berisi 1 aktif",
            r.status_code == 200 and len([d for d in r.json() if d["active"]]) == 1,
            r.text[:200])

        # kartu kegiatan menampilkan jumlah penjaga
        r = await c.get("/api/admin/kegiatan")
        kartu = next((k for k in r.json() if k["id"] == kid), {})
        cek("kartu kegiatan memuat penjaga",
            kartu.get("penjaga") == ["Ahmad Fauzi"], kartu.get("penjaga"))

        # ---------------- B. penjaga melihat menu ----------------
        r = await c.post("/api/auth/login",
                         json={"identifier": "ahmad", "password": "rahasia123"})
        cek("login penjaga", r.status_code == 200, r.text[:200])
        r = await c.get("/api/me/delegations")
        cek("penjaga melihat delegasi", r.status_code == 200 and len(r.json()) == 1,
            r.text[:200])
        cek("delegasi memuat kegiatan", bool(r.json()[0].get("kegiatan")))

        # bukan penjaga → tidak ada delegasi
        r = await c.post("/api/auth/login",
                         json={"identifier": "budi", "password": "rahasia123"})
        cek("login peserta lain", r.status_code == 200, r.text[:200])
        r = await c.get("/api/me/delegations")
        cek("peserta lain tidak melihat menu penjaga", r.json() == [], r.text[:200])
        r = await c.get(f"/api/delegate/kegiatan/{kid}")
        cek("peserta lain ditolak 403", r.status_code == 403, r.status_code)

        # ---------------- C. penjaga mengabsen ----------------
        r = await c.post("/api/auth/login",
                         json={"identifier": "ahmad", "password": "rahasia123"})
        r = await c.get(f"/api/delegate/kegiatan/{kid}")
        cek("penjaga membuka kegiatan", r.status_code == 200, r.text[:200])
        body = r.json()
        cek("daftar peserta tanpa nomor HP",
            all("phone" not in p for p in body["peserta"]), body["peserta"][:1])
        cek("peserta punya can_cancel", "can_cancel" in body["peserta"][0])

        r = await c.post(f"/api/delegate/kegiatan/{kid}/absen",
                         json={"user_id": peserta["Budi Santoso"], "status": "hadir"})
        cek("penjaga menandai hadir", r.status_code == 200, r.text[:300])
        cek("marked_by atas nama penjaga",
            "Penjaga Absen: Ahmad Fauzi" in r.text, r.text[:200])

        row = await server.db.absensis.find_one(
            {"kegiatan_id": kid, "user_id": peserta["Budi Santoso"]})
        cek("marked_by_id terisi", row.get("marked_by_id") == penjaga_id, row.get("marked_by_id"))

        log = await server.db.activity_logs.find_one(
            {"action": "penjaga_hadir", "target": peserta["Budi Santoso"]})
        cek("log aktivitas penjaga_hadir", bool(log), log)
        cek("log atas nama penjaga", (log or {}).get("actor_name") == "Ahmad Fauzi",
            (log or {}).get("actor_name"))

        # izin dengan alasan
        r = await c.post(f"/api/delegate/kegiatan/{kid}/absen",
                         json={"user_id": peserta["Citra Dewi"], "status": "izin",
                               "reason": "Kerja", "note": "Shift pagi"})
        cek("penjaga menandai izin", r.status_code == 200, r.text[:300])
        row = await server.db.absensis.find_one(
            {"kegiatan_id": kid, "user_id": peserta["Citra Dewi"]})
        cek("alasan izin tersimpan", row.get("reason") == "Kerja", row.get("reason"))

        # ---------------- D. batalkan catatan sendiri ----------------
        r = await c.delete(f"/api/delegate/kegiatan/{kid}/absen/{peserta['Budi Santoso']}")
        cek("penjaga membatalkan catatan sendiri", r.status_code == 200, r.text[:300])
        n = await server.db.absensis.count_documents(
            {"kegiatan_id": kid, "user_id": peserta["Budi Santoso"]})
        cek("catatan terhapus", n == 0, n)
        log = await server.db.activity_logs.find_one({"action": "penjaga_batal"})
        cek("log aktivitas penjaga_batal", bool(log))

        # catatan milik admin tidak boleh dibatalkan penjaga
        await c.post("/api/auth/login",
                     json={"identifier": "adminuji", "password": "rahasia123"})
        await c.post(f"/api/admin/kegiatan/{kid}/absen",
                     json={"user_id": peserta["Budi Santoso"], "status": "hadir"})
        await c.post("/api/auth/login",
                     json={"identifier": "ahmad", "password": "rahasia123"})
        r = await c.delete(f"/api/delegate/kegiatan/{kid}/absen/{peserta['Budi Santoso']}")
        cek("catatan petugas lain tidak bisa dibatalkan", r.status_code == 403, r.status_code)

        # ---------------- E. scan QR pribadi ----------------
        token = server.make_personal_token(peserta["Citra Dewi"], server._current_window())
        r = await c.post(f"/api/delegate/kegiatan/{kid}/scan-personal",
                         json={"content": f"EKP:{token}"})
        cek("scan QR pribadi", r.status_code == 200, r.text[:300])
        cek("scan menandai hadir", r.json().get("status") == "hadir", r.text[:200])
        log = await server.db.activity_logs.find_one({"action": "penjaga_scan"})
        cek("log aktivitas penjaga_scan", bool(log))

        r = await c.post(f"/api/delegate/kegiatan/{kid}/scan-personal",
                         json={"content": "EKP:ngawur"})
        cek("QR ngawur ditolak 400", r.status_code == 400, r.status_code)

        # ---------------- F. tamu ----------------
        r = await c.post(f"/api/delegate/kegiatan/{kid}/guest", json={"name": "Tamu Undangan"})
        cek("penjaga menambah tamu", r.status_code == 200, r.text[:300])
        guest_id = r.json()["id"]
        r = await c.delete(f"/api/delegate/kegiatan/{kid}/guest/{guest_id}")
        cek("penjaga menghapus tamu", r.status_code == 200, r.text[:300])

        # ---------------- G. laporan ----------------
        r = await c.get(f"/api/delegate/kegiatan/{kid}/rekap")
        cek("penjaga membuka laporan", r.status_code == 200, r.text[:300])
        lap = r.json()
        cek("laporan memuat counts", "counts" in lap and "groups" in lap)
        cek("laporan tanpa nomor HP", "phone" not in r.text and "6281" not in r.text,
            r.text[:200])
        cek("laporan memuat waktu pembaruan", bool(lap.get("diperbarui")))

        r = await c.post(f"/api/delegate/kegiatan/{kid}/share")
        cek("penjaga membagikan rekap", r.status_code == 200, r.text[:300])
        cek("tautan rekap ada", "/rekap/" in r.json().get("link", ""), r.text[:200])
        log = await server.db.activity_logs.find_one({"action": "penjaga_bagikan"})
        cek("log aktivitas penjaga_bagikan", bool(log))

        # ---------------- H. ringkasan live admin ----------------
        await c.post("/api/auth/login",
                     json={"identifier": "adminuji", "password": "rahasia123"})
        r = await c.get(f"/api/admin/kegiatan/{kid}/ringkasan")
        cek("admin membuka ringkasan", r.status_code == 200, r.text[:300])
        etag = r.headers.get("etag")
        cek("ringkasan punya ETag", bool(etag), etag)
        cek("ringkasan tanpa nama peserta",
            "Ahmad Fauzi" not in r.text and "6281" not in r.text, r.text[:200])
        r2 = await c.get(f"/api/admin/kegiatan/{kid}/ringkasan",
                         headers={"If-None-Match": etag or ""})
        cek("ETag sama → 304", r2.status_code == 304, r2.status_code)

        # pengurus (bukan admin) ditolak
        await c.post("/api/auth/login",
                     json={"identifier": "pengurusuji", "password": "rahasia123"})
        r = await c.get(f"/api/admin/kegiatan/{kid}/ringkasan")
        cek("ringkasan khusus admin (pengurus 403)", r.status_code == 403, r.status_code)

        # ---------------- I. cabut delegasi ----------------
        await c.post("/api/auth/login",
                     json={"identifier": "adminuji", "password": "rahasia123"})
        r = await c.post(f"/api/staff/delegation/{deleg_id}/revoke")
        cek("cabut delegasi", r.status_code == 200, r.text[:300])
        await c.post("/api/auth/login",
                     json={"identifier": "ahmad", "password": "rahasia123"})
        r = await c.get(f"/api/delegate/kegiatan/{kid}")
        cek("setelah dicabut ditolak 403", r.status_code == 403, r.status_code)
        r = await c.get("/api/me/delegations")
        cek("menu penjaga hilang", r.json() == [], r.text[:200])

        # ---------------- J. alpha otomatis (lazy) ----------------
        await c.post("/api/auth/login",
                     json={"identifier": "adminuji", "password": "rahasia123"})
        kemarin = (server.now_wita() - timedelta(days=1)).strftime("%Y-%m-%d")
        r = await c.post("/api/admin/kegiatan", json={
            "name": "Kajian Lewat", "type": "rutin", "date": kemarin,
            "start_time": "08:00", "end_time": "09:00", "location": "Masjid",
        })
        lewat_id = r.json()[0]["id"]
        # paksa status masih open (seolah cron belum jalan)
        await server.db.kegiatans.update_one(
            {"_id": lewat_id}, {"$set": {"status": "open", "closed_at": None}})

        r = await c.get(f"/api/admin/kegiatan/{lewat_id}")
        cek("kegiatan lewat otomatis selesai", r.json().get("status") == "closed",
            r.json().get("status"))
        cek("ditandai auto_closed", r.json().get("auto_closed") is True)

        alpha1 = await server.db.absensis.count_documents(
            {"kegiatan_id": lewat_id, "status": "alpha"})
        cek("alpha otomatis terisi", alpha1 > 0, alpha1)

        # panggil ulang → tidak menambah alpha ganda
        await c.get(f"/api/admin/kegiatan/{lewat_id}")
        await c.get(f"/api/admin/kegiatan/{lewat_id}/rekap")
        alpha2 = await server.db.absensis.count_documents(
            {"kegiatan_id": lewat_id, "status": "alpha"})
        cek("tidak ada alpha ganda", alpha1 == alpha2, f"{alpha1} vs {alpha2}")

        # ---------------- K. Kode Akses sudah dicabut ----------------
        r = await c.get(f"/api/admin/kegiatan/{kid}")
        cek("access_code tidak lagi dikirim", "access_code" not in r.json(), list(r.json())[:5])
        cek("akses_token tidak lagi dikirim", "akses_token" not in r.json())
        r = await c.post("/api/absensi/verify-code", json={"code": "123456"})
        cek("endpoint kode akses sudah hilang", r.status_code in (404, 405), r.status_code)
        r = await c.get("/api/staff/kode-akses")
        cek("endpoint daftar kode akses hilang", r.status_code in (404, 405), r.status_code)

        # ---------------- L. Penjaga mengirim kesan & pesan ----------------
        # Delegasi dicabut di bagian I → berikan ulang untuk menguji kesan & pesan.
        await c.post("/api/auth/login",
                     json={"identifier": "adminuji", "password": "rahasia123"})
        await c.post(f"/api/staff/kegiatan/{kid}/delegate",
                     json={"grantee_id": penjaga_id, "reason": "Uji kesan & pesan"})
        await c.post("/api/auth/login",
                     json={"identifier": "ahmad", "password": "rahasia123"})
        r = await c.post("/api/me/kesan-pesan", json={
            "kegiatan_id": kid, "sentiment": "suka",
            "message": "Kegiatan berjalan lancar dan tertib."})
        cek("penjaga bisa kirim kesan & pesan", r.status_code == 200, r.text[:300])
        f = await server.db.feedbacks.find_one({"kegiatan_id": kid})
        cek("kesan tersimpan ke kegiatan yang benar", bool(f), f)
        cek("kesan ditandai sumber penjaga", (f or {}).get("sumber") == "penjaga",
            (f or {}).get("sumber"))
        log = await server.db.activity_logs.find_one({"action": "penjaga_kesan"})
        cek("log aktivitas penjaga_kesan", bool(log))

        # Peserta lain yang TIDAK hadir dan BUKAN penjaga tetap ditolak.
        oid = server.ObjectId()
        await server.db.users.insert_one({
            "_id": oid, "name": "Peserta Luar", "username": "luar",
            "email": "luar@example.com", "phone": "6281999999999",
            "password_hash": server.hash_password("rahasia123"),
            "roles": ["peserta"], "status": "active", "token_version": 0,
        })
        await c.post("/api/auth/login",
                     json={"identifier": "luar", "password": "rahasia123"})
        r = await c.post("/api/me/kesan-pesan", json={
            "kegiatan_id": kid, "sentiment": "suka", "message": "Pesan dari bukan peserta."})
        cek("bukan penjaga/hadir tetap ditolak 403", r.status_code == 403, r.status_code)

        # ---------------- M. Sasaran peserta di kartu penjaga ----------------
        await c.post("/api/auth/login",
                     json={"identifier": "ahmad", "password": "rahasia123"})
        r = await c.get("/api/me/delegations")
        cek("kartu penjaga memuat sasaran",
            "sasaran" in (r.json()[0].get("kegiatan") or {}), r.text[:200])

    print()
    if GAGAL:
        print(f"{len(GAGAL)} uji GAGAL: {', '.join(GAGAL)}")
        return 1
    print("Semua uji penjaga absen LULUS.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
