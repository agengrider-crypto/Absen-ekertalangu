# E-KERTALANGU — PRD

## Original Problem Statement
Web app absensi pengajian. Fase 1: fondasi autentikasi — Login fleksibel (HP/Email/Username), Pendaftaran & Aktivasi via QR, Role/Dashboard page. Gaya: modern minimalis, putih bersih, aksen hijau tua (#0D5C3A), ramah lansia, mobile-first. Stack: React + FastAPI + MongoDB, JWT auth.

## Architecture
- Backend FastAPI (`/app/backend/server.py`), routes prefixed `/api`. JWT in httpOnly cookies (access 15m + refresh 7d), bcrypt, brute-force lockout, MongoDB.
- QR generated server-side (`qrcode`) and cached in `app_settings` collection (stable across refresh/restart).
- Frontend React (JSX) + Tailwind + shadcn/ui + sonner. AuthContext, protected routes.

## User Personas
- Admin: kelola pengguna, QR publik, (nanti) jadwal & laporan.
- Pengurus: (nanti) buka sesi absen, verifikasi, rekap.
- Peserta/Jamaah: daftar via QR, (nanti) absen, jadwal, riwayat.

## Core Requirements (static)
- Flexible login (email/username/phone) + password show/hide toggle.
- Self-service reset khusus Peserta murni (dob + phone terdaftar).
- QR publik → form daftar → akun aktif role Peserta; terpantau admin.
- QR aktivasi (kode) untuk akun buatan admin.
- Role dashboard hanya menampilkan role yang dimiliki; multi-role didukung.

## Implemented (2026-09-02)
- Auth: login/logout/me/refresh, register(QR), activate, self-reset. JWT cookies, bcrypt, lockout.
- Self-reset dibatasi hanya akun ber-role tunggal `peserta` (cegah takeover admin/pengurus).
- QR publik cached; endpoint `/qr/public`.
- Admin: list users, delete (spam control, tak bisa hapus diri sendiri), patch roles.
- Seed accounts: admin (ageng.rider@gmail.com), pengurus, peserta.
- Frontend: Login (+reset dialog), Register (QR + form), Activate, RoleDashboard (3 kartu, Ganti Akun, avatar+nama), RoleArea (Admin panel + placeholder Pengurus/Peserta).
- Tested: backend 25/27 pass; critical account-takeover + 500s fixed & verified.

## Backlog (next phases)
- P0: Sistem absensi (buka sesi, scan QR kehadiran, verifikasi, rekap harian).
- P1: Manajemen jadwal pengajian; laporan presensi; admin buat akun + generate kode aktivasi/QR per user.
- P2: Reset via OTP WhatsApp/SMS; rate-limit tambahan pendaftaran; role editor UI; input validation kuat (email/phone/password).

## Next Tasks
- Bangun modul sesi absensi Pengurus + presensi QR Peserta.
- UI admin untuk membuat akun & generate QR aktivasi.

## Fase 2 — Tahap A (Backend, 2026-09-03) — SELESAI & TERUJI (18/18)
- Kegiatan: CRUD + recurring 4 minggu; jenis rutin/khusus/asad; waktu WITA (UTC+8) HH:MM.
- Absensi: Hadir/Izin/Alpha (upsert), arrival_time WITA; rekap (counts+gender+rows, default alpha); close/reopen; scheduler auto-close per-kegiatan tiap 60s saat jam selesai WITA lewat.
- QR kegiatan (server-side PNG) + Share link rekap publik `/rekap/{token}` kadaluarsa 7 hari (410 bila expired, 404 invalid).
- Dashboard stats (total peserta L/P, akun aktif/nonaktif, kegiatan bulan ini, rasio kehadiran, donut, tren 6 bulan, upcoming/recent).
- Laporan (summary hadir/izin/alpha+ratio, gender_hadir, per_kegiatan, top_rajin/top_alpha) + export Excel (openpyxl) & PDF (reportlab).
- Koleksi baru: `kegiatans`, `absensis`. Password admin sementara masa percobaan: jokam354.

## API Contracts untuk Frontend (Tahap B)
- Kegiatan: POST/GET `/api/admin/kegiatan` (GET ?month=YYYY-MM | ?date_from&date_to; item punya `counts`), GET/PATCH/DELETE `/api/admin/kegiatan/{id}`, POST `/close`,`/reopen`.
- Absensi: POST `/api/admin/kegiatan/{id}/absen` {user_id,status}, GET `/api/admin/kegiatan/{id}/rekap`.
- QR/Share: POST `/api/admin/kegiatan/{id}/share`, GET `/api/admin/kegiatan/{id}/qr`, publik GET `/api/rekap/{token}`.
- Dashboard: GET `/api/admin/dashboard`. Laporan: GET `/api/admin/laporan?date_from&date_to`, export GET `/api/admin/laporan/export?format=excel|pdf&date_from&date_to` (blob).
- Peserta/User/Kelompok/Logs sudah ada dari Fase 1 (lihat daftar route admin).

## Update (Fitur Tambahan + Fase 3A)
- Foto profil peserta: upload sendiri via menu Profil (resize 320px), thumbnail di tabel Peserta.
- Menu profil pojok kanan (semua area): Profil, Ganti Peran (disembunyikan utk role tunggal), Keluar.
- Pindah sambung: konfirmasi Ya/Tidak + keterangan (tercatat di Log).
- QR Absen Mandiri per kegiatan (/absen/{token}): peserta cari nama sendiri -> Konfirmasi Hadir (hanya saat kegiatan buka). Keterangan panduan di bawah barcode.
- Kotak Pesan / Saran: input di halaman scan (di balik tombol, terpisah dari alur absen); admin baca via kartu Kegiatan > Opsi > Kotak Pesan/Saran. Ucapan sukses: "Alhamdulillah, jazakumullahu khoiro".
- Kartu Kegiatan: menu Opsi (Share, Edit Kegiatan, Rekap Absen, Kotak Pesan/Saran) + Edit Kegiatan (PATCH).
- Fase 3A: role Pengurus dapat akses area (require_staff) dgn sidebar Dashboard/Peserta/Kegiatan/Laporan; admin-only: hapus user, ubah role, kelola kelompok, hapus massal.

## Keputusan Fase 3/4 (disetujui user)
- Delegasi absensi otomatis dicabut saat kegiatan Selesai/ditutup.
- QR pribadi peserta: rotating (berbasis durasi waktu).
- Maks pengumuman di-pin: 3.
- Tech: tetap React JSX (tidak migrasi TS).

## Fase 3 (Pengurus) & Fase 4 (Peserta) — SELESAI & TERUJI backend (41/41)
### Fase 3 (require_staff; admin+pengurus)
- Musyawarah: kategori 4S/Tim 7, auto-save PATCH, PDF (reportlab), Share WA (wa.me), riwayat per tanggal. Endpoints /api/staff/musyawarah[...] + /pdf.
- Pengumuman: CRUD, Penting/Non-penting, Pin ke role (maks 3 global), feed dashboard via GET /api/me/announcements?role=. Endpoints /api/staff/pengumuman[...].
- Pengingat WA: GET /api/staff/kegiatan/{id}/reminder -> text + recipients (wa 62...). Frontend build link wa.me, tap kirim per chat (jalur gratis).
- Delegasi Absensi: POST /api/staff/kegiatan/{id}/delegate (reason wajib, audit log), /delegations, /delegation/{id}/revoke. AUTO-REVOKE saat kegiatan close/auto-close. Peserta terdelegasi: GET /api/me/delegations, GET/POST /api/delegate/kegiatan/{id}[/absen].
- Kegiatan card (Opsi): + Pengingat WA, Scan QR Peserta, Delegasi Absen.
### Fase 4 (Peserta, mobile-first, bottom-nav)
- Dashboard: sapaan + pengumuman ter-pin + jadwal mendatang + ring % kehadiran. GET /api/me/dashboard.
- Kegiatan: lihat detail saja (my_status, tanpa rekap orang lain). GET /api/me/kegiatan[/{id}].
- Scan Barcode Mandiri: kamera (html5-qrcode) baca QR kegiatan -> /absen/{token}.
- QR Pribadi rotating: GET /api/me/qr (EKP:<token> hmac, window 60s, grace 2 window); staff scan via POST /api/staff/kegiatan/{id}/scan-personal. Bisa download.
- Profil: GET/PATCH /api/me/profile + foto /api/me/photo.
- Koleksi baru: musyawarahs, pengumumans, delegations. Dep frontend: html5-qrcode, qrcode.react.

## Fase 3.1 — Perbaikan & Tambahan (SELESAI, backend 4/4 & frontend PASS)
- FIX BUG scan QR runtime error (html5-qrcode + React StrictMode removeChild) -> QrScanner ditulis ulang: delayed-start guard + reader div tanpa child React. Terverifikasi tidak crash.
- FIX pengingat WA (path salah /admin -> /staff/kegiatan/{id}/reminder).
- Delegasi: catatan alasan jadi OPSIONAL (backend & UI).
- Sidebar Pengurus/Admin: tambah menu "Penjaga Absen" (PenjagaAbsenView) untuk kelola delegasi terpusat.
- Dashboard: komposisi jenis kelamin kini tampilkan angka + persentase (Tooltip + legend gender-legend).
- Laporan: tombol "Share WA" (button-share-wa) dgn salam otomatis (harian: kegiatan hari ini; bulanan: rekap sebulan) + penutup "Alhamdulillah jazakumullahu khoiro".
- Musyawarah: Ekspor PDF gabungan per periode (GET /api/staff/musyawarah-export-pdf).
- Peserta Beranda: kartu Riwayat Kehadiran (grafik batang 6 bulan hadir/izin/alpha) via GET /api/me/attendance-history + lonceng notifikasi pengumuman penting (red dot, localStorage lastSeen).
- Responsif: Admin & Pengurus pakai drawer/hamburger di mobile (sudah responsif); Peserta mobile-first bottom-nav.

## Tambahan — QR Aktivasi Akun + Pintasan Dashboard (SELESAI, terverifikasi)
- QR Aktivasi Akun (publik): GET /api/staff/activation-qr (require_staff) -> {url: FRONTEND_URL/activate, image PNG}. Peserta scan -> halaman /activate (Activate.jsx, pencarian nama sudah ada) -> aktivasi akun sendiri. Bisa di-Download & Salin Link dari modal di dashboard. Akses: staff 200, peserta 403, no-auth 401.
- Pintasan Cepat di dashboard Admin & Pengurus (DashboardView, data-testid dashboard-shortcuts): Peserta, Kegiatan, Pengumuman, Penjaga Absen, Laporan, QR Aktivasi. Navigasi via onGoto(setActive).

## Fase 5 — Migrasi Deployment: 1 Project Vercel + MongoDB Atlas (SELESAI)

Tujuan: frontend & backend TIDAK dipisah — satu repo, satu project Vercel, satu domain.
Infrastruktur hanya **Vercel + MongoDB Atlas** (tanpa server/VPS/worker terpisah).

### Struktur baru
- `vercel.json` (root): `builds` = `frontend/package.json` (@vercel/static-build, distDir `build`)
  + `api/index.py` (@vercel/python, includeFiles `backend/**`). `routes`: `/api/*` → function,
  `handle: filesystem` → static, sisanya → `/index.html` (SPA). `crons`: `/api/cron/auto-close` harian.
- `api/index.py`: entrypoint serverless, menambah `backend/` ke sys.path lalu `from server import app`.
  Kode FastAPI tetap di `backend/server.py` agar bisa dijalankan uvicorn di sandbox.
- `requirements.txt` (root) + `api/requirements.txt`: dependency Python MINIMAL untuk lambda.
- `.vercelignore`: exclude node_modules, test, memory, .env.
- `DEPLOY_VERCEL.md` + `vercel-env.example.md`: panduan deploy & daftar env.
- Vercel setup: **Root Directory `./`**, **Framework Preset `Other`**, Build/Output default (diatur vercel.json).

### Perubahan backend (serverless-safe)
- Mongo client: `maxPoolSize=5` saat serverless, `tlsCAFile=certifi.where()` untuk Atlas SRV,
  timeout eksplisit; `MONGO_URL` fallback `MONGODB_URI`; `DB_NAME` default `ekertalangu`.
- `IS_SERVERLESS` dideteksi dari env `VERCEL`/`AWS_LAMBDA_FUNCTION_NAME`.
- Hapus ketergantungan `@app.on_event("startup")`: index+seed dipindah ke `_run_init()` dan
  dipanggil `ensure_init()` (idempoten, satu kali per proses) lewat HTTP middleware
  `bootstrap_middleware`. Ditandai di `app_settings.__init__` dengan `INIT_VERSION` (=3)
  supaya cold start tidak mengulang kerja berat. Naikkan INIT_VERSION bila perlu re-index.
- Scheduler `auto_close_loop()` (while True + sleep 60) HANYA jalan di server persisten
  (`not IS_SERVERLESS and RUN_SCHEDULER != "0"`). Di Vercel diganti:
  - `maybe_auto_close()` — lazy, dipicu tiap request `/api/*`, throttle 60s in-process +
    klaim slot lewat `app_settings.__auto_close__` (aman untuk banyak instance paralel).
  - `GET /api/cron/auto-close` — dipanggil Vercel Cron, diproteksi `CRON_SECRET`
    (header `Authorization: Bearer` atau `X-Cron-Secret`). Tanpa secret → 401.
- `GET /api/health` — status server + ping DB + nama DB + flag serverless (untuk verifikasi deploy).
- `get_jwt_secret()` tidak lagi KeyError saat import; error 500 dengan pesan jelas.
- CORS: `FRONTEND_URL` + `localhost:3000` + `EXTRA_CORS_ORIGINS` (dipisah koma).

### Perubahan frontend
- `src/lib/api.js`: `BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "")` → bila kosong,
  base menjadi relatif `/api` (satu domain, TANPA CORS). Di Vercel `REACT_APP_BACKEND_URL`
  sengaja TIDAK diset.
- `package.json`: tambah script `vercel-build` = `CI=false craco build` (warning ESLint tidak
  menggagalkan build di Vercel). `frontend/yarn.lock` di-commit agar build reproducible.
- Hapus `frontend/vercel (1).json` (konfigurasi lama, sudah digantikan vercel.json root).

### Env produksi (Vercel)
WAJIB: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `FRONTEND_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
OPSIONAL: `CRON_SECRET`, `EXTRA_CORS_ORIGINS`.
JANGAN diset: `REACT_APP_BACKEND_URL` (harus kosong), `RUN_SCHEDULER`.

### Status verifikasi
- Sandbox sudah dialihkan ke MongoDB Atlas (db `ekertalangu`), seed otomatis jalan,
  login admin + dashboard + kegiatan OK di live preview.
- Simulasi serverless (`uvicorn api/index.py --lifespan off`, VERCEL=1) LULUS:
  `/api/health` ok, login 200 (seed via middleware tanpa lifespan), `/api/admin/dashboard` 200,
  `/api/cron/auto-close` 401 tanpa secret & 200 dengan secret.
- `CI=false yarn build` (CRA) sukses: 426 kB gz main.js.
- Catatan serverless: tidak ada tulis ke disk — foto profil & QR disimpan base64 di MongoDB,
  export Excel/PDF di-stream langsung dari memori.

### Hasil pengujian regresi (testing agent, iteration_4)
- Backend 48/53 LULUS. `regression_check: PASSED` — refactor serverless tidak merusak
  endpoint mana pun (auth fleksibel email/username/HP, guard 403/401, CRUD user &
  kegiatan + recurring, absensi upsert, rekap, QR/share + rekap publik, activation-qr,
  laporan + export Excel/PDF valid, reminder WA 200 bukan 404, close/reopen,
  absen mandiri open/closed, seluruh endpoint area peserta).
- Endpoint baru LULUS: `/api/health` 200; `/api/cron/auto-close` 401 tanpa secret,
  200 dengan `Authorization: Bearer` maupun `X-Cron-Secret`.
- FIX: `GET /api/me/profile` sebelumnya 405 (hanya PATCH) → ditambahkan.
- False negative pada laporan agent (API sudah benar, hanya beda nama field yang
  diharapkan agent): `tren` (bukan `tren_6_bulan`), `url` (bukan `link`),
  `per_kegiatan` (bukan `kegiatans`), `announcements` (bukan `recent`).
- False negative frontend "Masuk sebagai Admin tidak navigasi": diverifikasi manual —
  navigasi ke `/area/admin` berhasil dan **10/10 menu sidebar** (Dashboard, Peserta,
  Kegiatan, Penjaga Absen, Musyawarah, Pengumuman, Laporan, Log Aktivitas, Hak Akses,
  Ganti Peran) tampil & bisa diklik tanpa red-screen. Error konsol 401 pada
  `/api/auth/me` + `/api/auth/refresh` adalah perilaku NORMAL saat halaman dibuka
  sebelum login (pengecekan sesi anonim).
- Data uji buatan testing agent sudah dibersihkan dari Atlas; tersisa 3 akun seed
  + 3 kelompok default.

## Fase 6 — Fix base URL QR + Dokumentasi Lengkap (SELESAI)

### Bug: QR pendaftaran mengarah ke domain preview, bukan produksi
Gejala (dilaporkan user): "REGIST QR MASIH MENGARAH KE PREVIEW EMERGENT?"

Penyebab: `get_or_create_public_qr()` menyimpan `link` + `image` PERMANEN di
`app_settings._id="public_qr"`. Sandbox dan produksi memakai database Atlas yang SAMA,
sehingga QR yang pertama kali dibuat di sandbox (domain preview Emergent) terus
disajikan di produksi Vercel. Dibuktikan: dokumen berisi
`link: "https://event-recap-filter.preview.emergentagent.com/register?token=..."`.

Perbaikan:
- `app_settings.public_qr` sekarang menyimpan **hanya `token`** + `created_at`.
  `link` dan gambar QR dihitung ULANG setiap request (membuat PNG QR sangat murah).
  Token tetap stabil sehingga QR yang sudah dicetak tetap sah.
- Helper baru `resolve_base_url(request)` dengan prioritas:
  1. env `FRONTEND_URL` bila diset (produksi)
  2. host request: `x-forwarded-proto` + `x-forwarded-host` (jaring pengaman kalau env
     lupa diisi / custom domain)
  3. `http://localhost:3000`
  `FRONTEND_URL_ENV` string kosong diperlakukan sebagai TIDAK diset.
- SEMUA endpoint penghasil URL kini menerima `request: Request` dan memakai
  `resolve_base_url()`: `/qr/public`, `/staff/activation-qr`,
  `/admin/kegiatan/{id}/qr`, `/admin/kegiatan/{id}/share`,
  `/admin/kegiatan/{id}/absen-qr` (via `ensure_share` & `ensure_absen_token`).
- Cache lama `link`/`image`/`base_url` di Atlas sudah dibersihkan (`$unset`).

ATURAN BARU (masuk AGENTS.md): JANGAN pernah menyimpan URL absolut ke database.

### Verifikasi (testing agent, iteration_5) — 100% LULUS, 0 ISU
- Backend 28/28. `app_settings.public_qr` terbukti hanya menyimpan `token`+`created_at`.
- Prioritas 1: semua endpoint QR memakai `FRONTEND_URL`.
- Prioritas 2: dengan `FRONTEND_URL=` kosong, base URL mengikuti `x-forwarded-host`
  (diuji `absen-ekertalangu.vercel.app` dan `absen.contoh-domain.id`).
- Tautan hasil generate tetap fungsional: `/api/rekap/{token}` 200,
  `/api/absen/{token}` 200, token invalid 404, register token salah 400.
- Regresi aman meski signature endpoint berubah: login email/username/HP, guard
  401/403, dashboard (`tren`), laporan (`per_kegiatan`), export Excel 5.525 B &
  PDF 223.428 B, `/api/health`, `/api/me/profile`, `/api/cron/auto-close`.
- Frontend: kartu QR Pendaftaran & modal QR Aktivasi menampilkan gambar dengan benar,
  tombol Download & Salin Link ada, tanpa error JS.

### Dokumentasi lengkap ditambahkan
`README.md` (overview, tech stack, struktur folder, data flow, coding conventions),
`AGENTS.md` (kontrak kerja AI agent: 12 aturan utama, urutan seksi server.py,
batasan serverless, 11 antipattern nyata, definisi selesai, format commit),
`docs/README.md` (indeks), `docs/ARCHITECTURE.md` (keputusan + alasan + utang teknis),
`docs/API.md` (80 endpoint + guard + nama field), `docs/DATABASE.md` (10 collection +
index), `docs/AUTH.md`, `docs/FEATURES.md`, `docs/TESTING.md`, `docs/TROUBLESHOOTING.md`,
`CHANGELOG.md`.

## Status Workspace (2026-09-13)
- Workspace dipulihkan ke commit Fase 7 (`0ba72e4`) dari PR #5 (PR ditutup tanpa merge di GitHub, kodenya diambil langsung ke branch `main` lokal via fast-forward).
- Fase 7 aktif & terverifikasi live: kode akses absensi 6 digit (`/absen-kode` -> `/absensi/{token}`), halaman absensi publik (Absen Manual + Scan Barcode), menu admin Kelompok Sambung, barcode/QR kegiatan.
- Services: mongodb, backend (8001), frontend (3000) RUNNING. DB schema init v4.
- Perubahan lokal sebelum restore disimpan di `git stash` ("pre-fase7-local").

## Implemented — FASE 8 (2026-09-13)
Revisi & update sesuai permintaan user (8 poin):
1. **Detail absen kegiatan** — modal absensi diganti HALAMAN PENUH `KegiatanDetail.jsx` dengan
   NAVIGASI BAR HORIZONTAL (bisa digeser di HP): Ringkasan, Absen Manual, Scan Barcode,
   Tamu (khusus kegiatan publik), Tidak Hadir Kemarin, Kode Akses, Pesan/Saran.
2. **Filter jenis kelamin kegiatan** — field `gender_filter` (semua|L|P). Daftar absen,
   halaman absensi publik, jadwal peserta, dan laporan otomatis mengikuti filter ini.
   Blok "Pengelompokan Lanjutan — SEGERA HADIR" (sudah/belum menikah, kelompok usia) tampil
   sebagai penanda rencana berikutnya (tombol non-aktif).
3. **Bug fix kotak pesan** — penyebab: komponen `Shell` didefinisikan DI DALAM `SelfAbsen`
   (dan `Avatar` di dalam `ProfileMenu`) sehingga tiap ketikan me-remount subtree → input
   kehilangan fokus/keyboard HP menutup setiap 1 huruf. Kedua komponen dipindah ke level modul.
   Ditambah tombol **Kirim Tanpa Nama (Anonim)** (`button-send-feedback-anonim`).
4. **Mode offline** — `src/lib/offline.js` (antrean localStorage + `useOnline`/`useOfflineQueue`),
   `OfflineBanner.jsx`, dan endpoint batch `POST /api/absensi/{token}/mark-batch` &
   `POST /api/admin/kegiatan/{id}/absen-batch`. Absen saat offline tersimpan di HP, ditandai
   "menunggu dikirim", lalu OTOMATIS tersinkron saat internet kembali (waktu diseragamkan ke WITA).
5. **Koneksi lebih stabil** — axios timeout 25s + retry otomatis 2x untuk GET yang gagal karena
   jaringan, GZip middleware, dan penghapusan N+1 query pada daftar kegiatan (3 query saja) +
   index baru (`guest_absens`, `follow_ups`, `kegiatans.date+start_time`, `access_code`).
6. **Urutan daftar kegiatan** — `phase` dihitung server (`akan_datang|berlangsung|selesai`);
   UI admin & peserta mengelompokkan: Akan Datang (atas) → Berlangsung (tengah) → Selesai (bawah).
7. **Tipe peserta kegiatan** — field `audience`: `reguler` (hanya akun aktivasi) vs
   `publik` (termasuk belum aktivasi + TAMU bebas nama). Endpoint tamu:
   `POST/DELETE /api/admin/kegiatan/{id}/guest`, `POST/DELETE /api/absensi/{token}/guest`
   (khusus publik; kegiatan reguler → 400). Tamu terhitung hadir pada rekap & laporan.
8. **Rekap tidak hadir + janji hadir** — `GET/POST /api/staff/kegiatan/{id}/tindak-lanjut`
   (koleksi `follow_ups`): daftar jamaah yang tidak hadir pada kegiatan SEBELUMNYA, tombol
   WhatsApp/Telepon, catatan, dan status `akan_hadir|tidak_bisa|sudah_dihubungi` ditandai
   oleh pengurus/admin.

Teruji: backend 7/8 skenario agen uji (1 sisanya hanya urutan test, bukan bug) + verifikasi
manual: detail view & tab, bug ketik (14 & 33 karakter penuh, fokus bertahan), kirim anonim,
tamu publik, mode offline (banner + auto-sync), laporan, jadwal peserta.

## Revisi Tambahan (2026-09-15)
1. **Dashboard admin cepat** — `/api/admin/dashboard` dihitung dengan ~6 query saja
   (sebelumnya 3 query PER kegiatan × 6 bulan → timeout/"gagal memuat").
   Rasio & tren dihitung in-memory dari 1x ambil peserta + absensi + tamu.
2. **Daftar kegiatan bersih** — kartu kegiatan hanya menampilkan info kegiatan dan bisa
   diklik. SEMUA fitur (absen manual, scan, tamu, barcode publik, tindak lanjut, kode akses,
   pesan) + tombol "Aksi Kegiatan" (selesai/buka, QR absen mandiri, bagikan rekap, pengingat
   WA, edit, hapus) berada DI DALAM halaman detail. Tab "Ringkasan" dihapus.
3. **Penjaga absen disembunyikan** — menu admin/pengurus, pintasan dashboard, tab peserta,
   dan aksi delegasi tidak lagi ditampilkan (kode & endpoint tetap ada bila ingin diaktifkan).
4. **Filter jenis kelamin ditegakkan** — helper `assert_gender_eligible()` memblokir total
   absen peserta yang tidak sesuai (`/admin/.../absen`, absen-batch, scan-personal staff,
   delegasi, kode akses, absen QR publik). Rekap publik `/api/rekap/{token}` & halaman
   `/api/absen/{token}` kini juga mengikuti filter + menghitung tamu (SUMBER BUG: dua endpoint
   ini sebelumnya memakai SELURUH peserta).
5. **Scan langsung sukses** — halaman `/absen/{token}` otomatis mencatat hadir saat dibuka
   (tanpa tombol "Saya Hadir"; tombol hanya muncul sebagai ulangi bila gagal).
6. **Barcode publik kegiatan terbuka** — `publik_token` + endpoint
   `GET /api/admin/kegiatan/{id}/publik-qr`, `GET/POST /api/hadir/{token}`, halaman
   `/hadir/:token` (`PublicHadir.jsx`): cukup isi NAMA, tanpa login/kode akses.
   Nama yang cocok dengan peserta terdaftar → absen peserta; lainnya → dicatat sebagai tamu.
   Nama peserta yang tidak sesuai filter gender ditolak.

Catatan: atas permintaan user, revisi ini TIDAK diuji oleh testing agent (uji manual sendiri).
Verifikasi yang sudah dilakukan: curl endpoint baru + screenshot alur admin, /hadir, dan
auto-hadir /absen.
