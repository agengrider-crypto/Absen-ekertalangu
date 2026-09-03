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
