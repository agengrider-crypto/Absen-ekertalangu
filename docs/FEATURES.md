# Fitur — Sudut Pandang Pengguna

Dokumen ini menjelaskan apa yang dilihat dan dilakukan pengguna, beserta endpoint dan
file yang menanganinya.

---

## 1. Masuk & memilih peran

| Langkah | Halaman | Endpoint |
|---|---|---|
| Isi HP/email/username + kata sandi | `Login.jsx` | `POST /api/auth/login` |
| Pilih peran (kartu yang dimiliki saja) | `RoleDashboard.jsx` | — |
| Masuk area | `RoleArea.jsx` → `admin/AdminLayout.jsx` atau `PesertaArea.jsx` | — |

Menu pojok kanan (`ProfileMenu.jsx`) tersedia di semua area: **Profil**,
**Ganti Peran** (disembunyikan bila peran tunggal), **Keluar**.

---

## 2. Area Admin & Pengurus

Sidebar (berubah menjadi drawer + hamburger di layar kecil):

| Menu | File | Isi |
|---|---|---|
| Dashboard | `DashboardView.jsx` | Pintasan cepat, statistik, donut jenis kelamin, tren 6 bulan, kegiatan mendatang, QR pendaftaran |
| Peserta | `Peserta.jsx` | Tabel + tab **Semua / Belum Aktivasi / Sudah Aktif**, Tambah, Bulk Data, Impor Excel, Template |
| Kegiatan | `KegiatanView.jsx` + `KegiatanExtras.jsx` | List/Kalender, form, rekap, QR, pengingat WA, delegasi |
| Penjaga Absen | `PenjagaAbsenView.jsx` | Kelola delegasi terpusat per bulan |
| Musyawarah | `MusyawarahView.jsx` | Catatan 4S / Tim 7 + ekspor PDF |
| Pengumuman | `PengumumanView.jsx` | CRUD + pin per peran |
| Laporan | `LaporanView.jsx` | Harian/Bulanan/Rentang + Excel/PDF/Share WA |
| Log Aktivitas | `LogAktivitas.jsx` | Jejak audit |
| Hak Akses | `HakAkses.jsx` | Editor peran (admin) |

### Pintasan Cepat

Grid tombol di dashboard: Peserta, Kegiatan, Pengumuman, Penjaga Absen, Laporan,
QR Aktivasi. Sekali klik langsung menuju menu terkait.

---

## 3. Mengelola kegiatan

```
Tambah Kegiatan → nama, jenis (Rutin/Khusus/Asad), tanggal,
                  jam mulai & selesai (WITA), pengajar, materi, lokasi
                  ☑ Kegiatan berulang (4 minggu, mingguan)
```

`recurring: true` membuat **4 kegiatan** sekaligus dengan jarak satu minggu, ditandai
`group_id` yang sama.

Menu **Opsi** pada setiap kartu kegiatan:

| Aksi | Endpoint |
|---|---|
| Rekap kehadiran | `GET /api/admin/kegiatan/{id}/rekap` |
| QR kegiatan | `GET /api/admin/kegiatan/{id}/qr` |
| QR absen mandiri | `POST /api/admin/kegiatan/{id}/absen-qr` |
| Bagikan rekap (7 hari) | `POST /api/admin/kegiatan/{id}/share` |
| Pengingat WA | `GET /api/staff/kegiatan/{id}/reminder` |
| Scan QR peserta | `POST /api/staff/kegiatan/{id}/scan-personal` |
| Delegasi absen | `POST /api/staff/kegiatan/{id}/delegate` |
| Tutup / Buka kembali | `POST .../close` · `.../reopen` |

**Penutupan otomatis:** kegiatan `open` tertutup sendiri setelah `end_time` (WITA)
terlewat, ditandai `auto_closed: true`, dan seluruh delegasinya dicabut.

---

## 4. Tiga cara mencatat kehadiran

### A. Pengurus menandai manual

Buka rekap → tandai **Hadir** / **Izin** per peserta. Yang tidak ditandai otomatis
**alpha**. `POST /api/admin/kegiatan/{id}/absen` — bersifat upsert, jadi bisa diubah.

### B. Pengurus memindai QR pribadi jamaah

Jamaah membuka tab **QR Saya** (`peserta/QrSaya.jsx`, `GET /api/me/qr`). QR berputar
tiap 60 detik sehingga tidak bisa dititipkan. Pengurus memindainya
(`QrScanner.jsx` → `POST /api/staff/kegiatan/{id}/scan-personal`).

### C. Jamaah absen mandiri dari QR kegiatan — **terfokus 1 peserta**

Pengurus mencetak QR absen dan menempelnya di lokasi. Jamaah scan → `/absen/{token}`
(`SelfAbsen.jsx`).

Sejak Fase 6 alurnya **wajib login**:

```
Scan QR kegiatan
  ↓ belum login → kartu "Mohon masuk terlebih dahulu" → /login?next=/absen/<token>
  ↓ sudah login → HANYA nama sendiri + tombol "Saya Hadir"
```

Halaman ini **tidak menampilkan daftar peserta lain**, sehingga **titip absen tidak
mungkin dilakukan**. Endpoint: `GET /api/me/absen/{token}` dan
`POST /api/me/absen/{token}/mark`.

Penolakan dibalas dengan pesan Bahasa Indonesia yang sopan, mis.:

- kegiatan sudah ditutup → *"Mohon maaf, kegiatan ini sudah ditutup sehingga absen
  mandiri tidak dapat diproses. Silakan menghubungi pengurus untuk absen susulan."*
- bukan peserta → *"Mohon maaf, akun Anda belum terdaftar sebagai peserta pengajian."*
- profil belum lengkap → *"Mohon lengkapi data profil Anda terlebih dahulu sebelum
  melakukan absen. Jazakumullahu khoiro."*
- sukses → *"Alhamdulillah, kehadiran Anda pada kegiatan … berhasil dicatat.
  Jazakumullahu khoiro."*

Kolom pesan/kesan tetap tersedia (`POST /api/absen/{token}/feedback`).

> **Absen untuk banyak orang hanya lewat cara A (manual) atau B (scan QR pribadi)**
> yang dilakukan pengurus / penjaga absen.

Ketiganya menulis ke collection `absensis` yang sama dengan index unik
`(kegiatan_id, user_id)` — tidak ada duplikasi.

### Peserta yang belum aktivasi ikut terdaftar

Peserta hasil impor Excel (status `pending`) **muncul di daftar absen** dengan label
**"Belum aktivasi"** dan **bisa ditandai hadir secara manual** oleh pengurus/penjaga
absen. Mereka juga **ikut dihitung** pada rekap dan laporan. Karena belum punya akun,
mereka tidak bisa login sehingga tidak bisa absen mandiri/scan.

---

## 5. Penjaga Absen (delegasi)

Untuk saat pengurus tidak bisa hadir:

```
Pengurus → pilih kegiatan → pilih jamaah → (catatan alasan OPSIONAL)
         → jamaah tersebut mendapat hak mengisi absen kegiatan ITU SAJA
         → hak OTOMATIS DICABUT saat kegiatan ditutup
```

Jamaah terdelegasi melihatnya lewat `GET /api/me/delegations`. Di Area Peserta muncul
tab **Penjaga** (hanya bila ada delegasi aktif) dengan **dua cara mengabsen**:

| Mode | Endpoint | Keterangan |
|---|---|---|
| **Absen Manual** | `POST /api/delegate/kegiatan/{id}/absen` | Daftar nama + tombol Hadir / Izin / Alpha, termasuk peserta "Belum aktivasi" |
| **Scan Barcode** | `POST /api/delegate/kegiatan/{id}/scan-personal` | Memindai QR pribadi peserta (`EKP:<token>`) |

Sisi pengurus (`PenjagaAbsenView.jsx`) juga menyediakan tombol **Absen Manual** dan
**Scan Barcode** langsung per kegiatan, plus "Aksi Lain" untuk mengelola delegasi.

Catatan absensinya ditandai `marked_by: "Penjaga Absen: <nama>"` (manual lewat delegasi
tetap `"Delegasi: <nama>"`). Semua aksi tercatat di `activity_logs`.

---

## 6. Laporan

Tiga mode: **Harian**, **Bulanan**, **Rentang**.

Isi laporan: rasio kehadiran, total hadir/izin/alpha, kehadiran per jenis kelamin,
**Paling Rajin** (5 teratas), **Paling Sering Alpha** (5 teratas), rincian per kegiatan.

Rincian **per peserta** tersedia dalam bentuk dropdown "Rekap per Peserta"
(nama, hadir, izin, alpha, persentase).

| Tombol | Hasil |
|---|---|
| **Buat Link Laporan** | Tautan publik **permanen** + QR (`/laporan/{token}`). Siapa pun yang membukanya **langsung melihat laporan tanpa login**. Tersedia Salin Link, Unduh QR, dan Bagikan Link via WhatsApp |
| **Excel** | `.xlsx` — sheet "Per Kegiatan" + "Ringkasan" |
| **PDF** | `.pdf` — tabel berformat |

> Sejak Fase 6, tombol **Share WA** yang menyusun teks template panjang **diganti**
> tombol **Buat Link Laporan**. Yang dibagikan ke WhatsApp sekarang cukup **satu tautan**,
> dan angka di dalamnya selalu dihitung ulang saat dibuka (mengikuti koreksi absen terbaru).

---

## 7. Musyawarah & pengumuman

**Musyawarah** — catatan hasil musyawarah kategori **4S** dan **Tim 7**, dengan tanggal
dan isi. Bisa diekspor PDF per catatan maupun **PDF gabungan per periode**.

**Pengumuman** — judul, isi, opsional terkait kegiatan/pengajar. Bisa ditandai
`important` dan `pinned` untuk peran tertentu (`pin_roles`). Yang `important` memicu
**lonceng dengan titik merah** di area peserta (penanda "sudah dibaca" disimpan di
`localStorage`).

---

## 8. Area Peserta (mobile-first, bottom-nav)

| Tab | File | Isi |
|---|---|---|
| **Beranda** | `peserta/Beranda.jsx` | Sapaan, lonceng notifikasi, pengumuman ter-pin, jadwal mendatang, ring % kehadiran, kartu Riwayat Kehadiran (grafik batang 6 bulan hadir/izin/alpha) |
| **Kegiatan** | `peserta/KegiatanList.jsx` | Jadwal + status kehadiran saya (tanpa data orang lain) |
| **Scan** | `peserta/ScanTab.jsx` | Pindai QR kegiatan dengan kamera |
| **QR Saya** | `peserta/QrSaya.jsx` | QR pribadi berputar 60 detik, bisa diunduh |
| **Profil** | `peserta/ProfilTab.jsx` | Ubah data + unggah foto (di-resize 320px di browser) |

Peserta **tidak** bisa melihat rekap kehadiran orang lain.

---

## 9. Alur pendaftaran & aktivasi

### Pendaftaran mandiri

```
Pengurus cetak QR Pendaftaran (dashboard)
  → jamaah scan → /register?token=...
  → isi nama, HP, email, tanggal lahir, alamat, kata sandi
  → akun langsung aktif sebagai Peserta, otomatis login
  → terpantau pengurus di menu Peserta (source: qr_public)
```

### Aktivasi akun yang didaftarkan pengurus

```
Pengurus input daftar nama (status "pending")
Pengurus cetak QR Aktivasi (tombol "QR Aktivasi" di dashboard,
                            ada Download PNG & Salin Link)
  → jamaah scan → /activate → cari nama sendiri
  → isi HP, tanggal lahir, jenis kelamin, kata sandi
  → tanggal lahir WAJIB cocok data pengurus (mencegah klaim nama orang lain)
  → akun aktif, otomatis login
```

### Lupa kata sandi

Dialog di halaman login: nomor HP + tanggal lahir terdaftar. **Hanya untuk akun berperan
tunggal Peserta** — pemilik peran lain harus menghubungi administrator.

---

## 10. Pindah kelompok

Menu Peserta → Detail → Pindah Sambung. Konfirmasi Ya/Tidak + keterangan.
Tercatat di Log Aktivitas.

---

## 11. Impor peserta dari Excel

```
Menu Peserta → Template  (GET /api/admin/import-template)
            → isi di Excel
            → Impor Excel (POST /api/admin/users/import, multipart)
```

Ada juga **Bulk Data** untuk menempel banyak nama sekaligus
(`POST /api/admin/users/bulk`) dan **Daftar Nama Menunggu Aktivasi**
(`POST /api/admin/users/pending`).
