# Teks siap-pakai untuk Pull Request (FASE 8)

> Cara push: tombol **Save** di chat → **Save to GitHub** → pilih repo
> `agengrider-crypto/Absen-ekertalangu` → **create a new branch** (mis.
> `fase-8-detail-absen-offline`) → lalu buka GitHub.com dan klik **Compare & pull request**
> ke `main`. Agent tidak diizinkan melakukan git push / membuat PR sendiri.

## Judul PR
FASE 8 — Detail absen + navigasi horizontal, filter jenis kelamin, kegiatan publik & tamu, mode offline

## Deskripsi PR (copy-paste)

Branch ini berisi commit FASE 7 (yang sebelumnya tertutup di PR #5 tanpa merge) **dan** revisi FASE 8 berikut:

1. **Detail absen kegiatan + navigasi bar horizontal** — modal absensi diganti halaman penuh
   (`frontend/src/pages/admin/KegiatanDetail.jsx`) dengan 7 tab yang bisa digeser di HP:
   Ringkasan, Absen Manual, Scan Barcode, Tamu, Tidak Hadir Kemarin, Kode Akses, Pesan/Saran.
2. **Filter jenis kelamin pada tambah kegiatan** — `gender_filter` (semua / khusus laki-laki /
   khusus perempuan) memengaruhi daftar absen, halaman absensi publik, jadwal jamaah, dan laporan.
   Blok **"Pengelompokan Lanjutan — SEGERA HADIR"** (sudah/belum menikah, kelompok usia) sebagai penanda rencana.
3. **Bug fix kotak pesan/kontak** — input hanya menerima 1 huruf lalu kehilangan fokus (keyboard HP
   menutup). Penyebab: komponen `Shell` (SelfAbsen) & `Avatar` (ProfileMenu) didefinisikan di dalam
   komponen induk sehingga remount setiap ketikan. Keduanya dipindah ke level modul.
   Ditambah tombol **Kirim Tanpa Nama (Anonim)**.
4. **Mode offline** — absen yang ditandai saat tanpa internet disimpan di perangkat
   (`frontend/src/lib/offline.js`), ditandai "menunggu dikirim", dan **otomatis tersinkron**
   saat internet kembali lewat endpoint batch (`/api/absensi/{token}/mark-batch`,
   `/api/admin/kegiatan/{id}/absen-batch`).
5. **Koneksi lebih stabil** — axios timeout 25s + retry otomatis untuk GET yang gagal karena
   jaringan, GZip middleware, daftar kegiatan bebas N+1 query, dan index MongoDB baru.
6. **Urutan daftar kegiatan** — Akan Datang (atas) → Berlangsung (tengah) → Selesai (bawah),
   berlaku di panel admin/pengurus maupun jadwal jamaah.
7. **Tipe peserta kegiatan** — `reguler` (hanya akun sudah aktivasi) vs `terbuka/publik`
   (termasuk belum aktivasi + **tamu** cukup dengan nama). Tamu terhitung hadir pada rekap & laporan.
8. **Rekap tidak hadir + janji hadir** — daftar jamaah yang tidak hadir pada kegiatan sebelumnya,
   tombol WhatsApp/Telepon, catatan, dan penandaan **Akan Hadir / Tidak Bisa / Sudah Dihubungi**
   oleh pengurus/admin (koleksi `follow_ups`).

### Pengujian
- Backend: 7/8 skenario agen uji lulus (1 sisanya hanya urutan test, bukan bug). Uji manual endpoint
  tamu (reguler → 400), tindak lanjut (status invalid → 400), batch offline, laporan → 200.
- Frontend: verifikasi manual detail view + semua tab, bug ketik (teks penuh masuk & fokus bertahan),
  kirim anonim, tamu kegiatan publik, mode offline (banner + auto-sync), jadwal jamaah berkelompok.
