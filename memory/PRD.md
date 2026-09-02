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
