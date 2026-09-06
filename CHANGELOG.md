# Changelog

Format: perubahan dikelompokkan per rilis/fase. Bahasa Indonesia.

---

## Fase 5 — Deployment: 1 Project Vercel + MongoDB Atlas

### Ditambahkan

- **Deployment 1 project Vercel** — frontend + backend satu domain, tanpa CORS.
  `vercel.json` memakai `buildCommand` + `outputDirectory` + `functions` + `rewrites`.
- `api/index.py` — entrypoint serverless yang me-re-export FastAPI app dari
  `backend/server.py` (kode backend tetap bisa dijalankan uvicorn di lokal).
- `requirements.txt` (root) + `api/requirements.txt` — dependency Python minimal untuk
  menekan ukuran lambda.
- `.vercelignore`, `.python-version` (3.12).
- `GET /api/health` — status server, ping DB, nama DB, flag serverless.
- `GET /api/cron/auto-close` — dipanggil Vercel Cron, diproteksi `CRON_SECRET`
  (`Authorization: Bearer` atau `X-Cron-Secret`).
- `GET /api/me/profile` — sebelumnya hanya `PATCH` yang terdaftar sehingga `GET` balas 405.
- `resolve_base_url(request)` — base URL untuk QR/tautan: env `FRONTEND_URL` → host
  request (`x-forwarded-*`) → localhost.
- `EXTRA_CORS_ORIGINS` — origin tambahan (dipisah koma).
- `tests/vercel_sim.py` — simulator urutan routing Vercel untuk uji lokal tanpa deploy.
- Dokumentasi: `README.md`, `AGENTS.md`, `docs/` (ARCHITECTURE, API, DATABASE, AUTH,
  FEATURES, TESTING, TROUBLESHOOTING), `DEPLOY_VERCEL.md`, `vercel-env.example.md`,
  `CHANGELOG.md`.
- `frontend/yarn.lock` di-commit agar build Vercel reproducible.
- Script `vercel-build` = `CI=false craco build`.

### Diubah

- **Database dipindah ke MongoDB Atlas** (`DB_NAME=ekertalangu`).
- Mongo client: `maxPoolSize` kecil saat serverless, `tlsCAFile=certifi.where()` untuk
  Atlas SRV, timeout eksplisit, fallback `MONGODB_URI`, `DB_NAME` default `ekertalangu`.
- Index + seed dipindah dari event `startup` ke `_run_init()` yang dipanggil
  `ensure_init()` lewat HTTP middleware, ditandai `app_settings.__init__` (`INIT_VERSION`)
  — cold start tidak mengulang kerja berat.
- Scheduler `while True` diganti `maybe_auto_close()` (lazy per request, throttle 60
  detik, klaim slot lewat `app_settings.__auto_close__`). Loop lama hanya aktif di server
  persisten (`not IS_SERVERLESS and RUN_SCHEDULER != "0"`).
- `get_jwt_secret()` membaca env saat dipakai, bukan saat import — error 500 dengan pesan
  jelas alih-alih modul gagal di-import.
- `frontend/src/lib/api.js` — base URL menjadi relatif (`/api`) bila
  `REACT_APP_BACKEND_URL` kosong.
- Endpoint penghasil URL (`/qr/public`, `/staff/activation-qr`, QR kegiatan, share rekap,
  absen mandiri) sekarang menerima `request` dan memakai `resolve_base_url()`.

### Diperbaiki

- **`/` membalas 404 NOT_FOUND di produksi meski build sukses.** Penyebab: `vercel.json`
  memakai legacy `builds` + `routes`, sehingga output build bersarang dan tidak berada di
  root deployment; aturan `/static/(.*)` → 404 ikut mematikan seluruh JS/CSS.
  Diganti konfigurasi modern dengan `outputDirectory`.
- **QR pendaftaran mengarah ke domain preview, bukan domain produksi.** Penyebab: `link`
  dan gambar QR ikut disimpan di `app_settings.public_qr`, sementara sandbox dan produksi
  memakai database Atlas yang sama. Sekarang hanya token yang disimpan; link dan gambar
  dihitung setiap request.
- `GET /api/me/profile` → 405 Method Not Allowed.

### Dihapus

- `frontend/vercel (1).json` — digantikan `vercel.json` di root.

### Catatan operasional

- Vercel: Root Directory `./`, Framework Preset `Other`, Build & Output Settings default.
- Env wajib: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `FRONTEND_URL`, `ADMIN_EMAIL`,
  `ADMIN_PASSWORD`. Opsional: `CRON_SECRET`, `EXTRA_CORS_ORIGINS`.
- **`REACT_APP_BACKEND_URL` tidak boleh diset di Vercel.**
- MongoDB Atlas Network Access wajib `0.0.0.0/0` (IP Vercel dinamis).

---

## Fase 3.1 — Perbaikan & tambahan

### Diperbaiki

- Runtime error scan QR (konflik `html5-qrcode` dengan React StrictMode `removeChild`).
  `QrScanner.jsx` ditulis ulang dengan delayed-start guard dan div reader bebas anak React.
- Pengingat WA 404 — path salah `/admin/...`, seharusnya
  `/api/staff/kegiatan/{id}/reminder`.

### Ditambahkan

- Menu sidebar **Penjaga Absen** untuk kelola delegasi terpusat.
- Komposisi jenis kelamin menampilkan angka + persentase.
- Laporan: tombol **Share WA** dengan salam otomatis (harian/bulanan) ditutup
  "Alhamdulillah jazakumullahu khoiro".
- Musyawarah: ekspor PDF gabungan per periode.
- Peserta: kartu Riwayat Kehadiran (grafik batang 6 bulan) + lonceng notifikasi
  pengumuman penting.
- **QR Aktivasi Akun** — `GET /api/staff/activation-qr`, modal dengan Download PNG &
  Salin Link.
- **Pintasan Cepat** di dashboard Admin & Pengurus.

### Diubah

- Catatan alasan pada delegasi menjadi **opsional**.
- Area Admin & Pengurus responsif (drawer + hamburger di layar kecil).

---

## Fase 3–4 — Pengurus & Peserta

- Area Pengurus: kegiatan, absensi, rekap, musyawarah, pengumuman, delegasi, pengingat WA.
- Area Peserta mobile-first bottom-nav: Beranda, Kegiatan, Scan, QR Saya, Profil.
- QR pribadi rotating (HMAC, jendela 60 detik + grace 1 window).
- QR absen mandiri per kegiatan (`/absen/{token}`) + kolom pesan/kesan.
- Collection baru: `musyawarahs`, `pengumumans`, `delegations`.
- Foto profil peserta (resize 320px di browser, disimpan base64).
- Menu profil pojok kanan di semua area; pindah kelompok dengan konfirmasi + keterangan.

---

## Fase 2 — Kegiatan, absensi, laporan

- CRUD kegiatan + recurring 4 minggu; jenis `rutin`/`khusus`/`asad`; waktu WITA.
- Absensi hadir/izin/alpha (upsert) + rekap; close/reopen; auto-close per kegiatan.
- QR kegiatan + share link rekap publik (kedaluwarsa 7 hari, 410/404).
- Dashboard statistik (total peserta L/P, akun aktif, kegiatan bulan ini, rasio,
  donut, tren 6 bulan, upcoming/recent).
- Laporan + export Excel (openpyxl) & PDF (reportlab).
- Collection baru: `kegiatans`, `absensis`.

---

## Fase 1 — Fondasi autentikasi

- Login fleksibel (email/username/nomor HP) + toggle lihat kata sandi.
- JWT di httpOnly cookie, bcrypt, lockout brute-force (5 gagal / 15 menit).
- Pendaftaran via QR publik; aktivasi akun via pencarian nama + verifikasi tanggal lahir.
- Reset mandiri **dibatasi** akun berperan tunggal `peserta` (mencegah takeover
  admin/pengurus).
- Halaman Pilih Peran; dukungan multi-peran.
- Admin: daftar pengguna, hapus, ubah peran.
- Collection: `users`, `kelompoks`, `activity_logs`, `login_attempts`, `app_settings`.
