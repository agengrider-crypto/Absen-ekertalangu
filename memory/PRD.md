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
