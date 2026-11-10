# Changelog

Format: perubahan dikelompokkan per rilis/fase. Bahasa Indonesia.

---

## Pembaruan 9 November 2026 (Standar Warna & Maintenance)

- **Design token terpusat**: `frontend/src/lib/theme.js` (COLORS, ROLE_COLORS, ATTENDANCE_COLORS,
  ACCOUNT_COLORS, ACTIVITY_COLORS, UI) + CSS variable di `index.css`. Ubah satu tempat, seluruh UI ikut.
- **Palet standar diterapkan** ke 81 file: Primary biru `#2563EB`, Success hijau `#16A34A`,
  Info cyan `#0891B2`, Warning amber `#D97706`, Sakit biru muda `#2563EB`, Danger merah `#DC2626`,
  Netral abu-abu. Background `#FAFAF8`, card putih, border `#E8E8E4`.
- **Badge status diselaraskan**: Aktif = hijau, Belum Aktivasi = amber, Nonaktif = abu-abu,
  Hadir = hijau, Izin = amber, Sakit = biru, Alpha = merah.
- **QR Code & Barcode** dipaksa hitam `#000000` di atas putih `#FFFFFF` (backend `make_qr_data_url`
  dan `QRCodeSVG` di frontend) agar kontras & kecepatan pindai optimal.
- **Halaman Maintenance** baru (`/maintenance`, atau `?maintenance=1`) dengan ikon Wrench,
  pesan ramah, jam pengecekan, dan tombol Coba Lagi.

## Pembaruan 9 November 2026 (Profil & Pesan WA)

- **Pembaruan Terbaru** kini berbentuk kartu (judul + ringkasan + tombol **Coba Sekarang**)
  sesuai desain; tombol langsung membuka fitur terkait.
- **Ganti Peran** dipindah keluar dari menu profil, menjadi tombol kecil di samping avatar.
- **Tentang Aplikasi** hanya berisi identitas aplikasi + Tour Panduan; daftar perubahan
  dipusatkan di menu Update Terbaru.
- **Teks WhatsApp** (laporan, rekap bulanan/harian, musyawarah, undangan, QR kegiatan)
  dibuat singkat: tanpa salam pembuka dan tanpa penutup syukur.
- Pop-up catatan rilis lama (`ReleaseNotes`) dihapus agar tidak dobel dengan Update Terbaru.

## Pembaruan 9 November 2026 (Filter Status ke FAB)

- Baris **filter status** di atas daftar User dihapus; filter kini hanya lewat tombol **Filter**
  di bottom bar (chip: Semua / Belum Aktivasi / Sudah Aktif / Data Belum Lengkap).
- **Tab status kegiatan** (Semua / Hari ini / Akan datang / Selesai) dihapus dari atas;
  filter yang sama tersedia di bottom bar.
- `data-testid` lama (`status-filter`, `filter-*`, `kegiatan-phase-filter`, `kegiatan-phase-*`)
  dipindahkan ke chip di FAB agar pengujian otomatis tetap berjalan.

## Pembaruan 9 November 2026 (Header Rapi)

- Tombol **Tambah Peserta** dihapus dari header halaman User — cukup lewat FAB `+` di bottom bar.
- Tombol **Tambah Kegiatan** dihapus dari header halaman Kegiatan — cukup lewat FAB `+`.
- **Animasi Panduan**, **Daftar**, dan **Kalender** dipindah ke bottom bar pada tampilan mobile
  (tetap tersedia di header pada desktop).
- Semua tombol bottom bar disejajarkan rata dalam satu baris: Cari · Filter · Prev/Next · Panduan · Daftar · Kalender.

## Pembaruan 9 November 2026 (Bottom Action Bar)

- **Mobile Bottom Action Bar** menempel di bawah layar pada tampilan mobile (User & Kegiatan):
  tombol **Cari**, **Filter**, **Previous/Next**, dan **indikator halaman** (`1 / 18`).
- **FAB hijau "+"** menonjol di tengah bar sebagai tombol tambah data.
- Memakai `env(safe-area-inset-bottom)` agar tidak tertutup gesture navigation Android/iPhone,
  serta diposisikan di atas bottom-nav agar tidak saling menutupi.
- Tombol Previous/Next otomatis nonaktif di halaman pertama/terakhir.
- Panel **notifikasi** disederhanakan: satu baris judul + keterangan singkat, tanpa ikon kategori.
- **Tour panduan hanya muncul sekali**; update berikutnya hanya menampilkan pop-up Update Terbaru.

## Pembaruan 9 November 2026 (FAB)

- **Floating Action Button (FAB)** melayang di tengah bawah pada daftar **User** dan **Kegiatan**.
  Satu tombol membuka panel berisi pencarian, filter status (chip), dan tombol tambah data.
- Navigasi **halaman sebelumnya/berikutnya** ada di FAB, menampilkan rentang data
  (mis. `1–12 / 15`). Daftar User dibagi 20 per halaman, Kegiatan 12 per halaman.
- Pencarian & filter di FAB tersinkron dua arah dengan kontrol yang sudah ada di halaman.
- Tombol **Salin Tautan** pada QR Aktivasi dihapus karena QR sudah memuat tautannya.

## Pembaruan 9 November 2026 (lanjutan)

- **QR Aktivasi Akun** kini tersedia di Dashboard: kartu ringkas dengan QR, tombol **Buka**,
  pembesar QR sekali ketuk, **Salin Tautan**, dan **Cetak QR**.
- **Aktivasi manual** dari Dashboard: cari nama peserta yang belum aktivasi lalu tekan
  **Aktifkan**, atau ketik nama baru (+ tanggal lahir) untuk membuat akun yang langsung aktif.
- Tombol **Coba Sekarang** pada Update Terbaru kini langsung membuka fitur yang dimaksud
  lewat `/area/admin?tab=<fitur>` (sebelumnya selalu kembali ke Dashboard).
- Memperbaiki sisa konflik rebase pada Rekap Bulanan (variabel `hideInactive` yang tidak ada).

## Pembaruan 9 November 2026

- Menambahkan menu **Tentang Aplikasi** (dari menu Profil dan tab Profil peserta) berisi logo,
  nama aplikasi, versi, pengembang (BrodyCorp), tahun rilis, hak cipta, dan deskripsi singkat.
- **Update Terbaru** kini punya tombol **Lihat Perubahan** yang membuka daftar changelog
  dalam accordion. Sumber data changelog dipusatkan di `src/lib/appInfo.js`.
- **Tour Panduan** dipisah dari Update Terbaru dengan tombol **Mulai Tour** yang memandu
  5 langkah: Dashboard → User → Daftar Kegiatan → Rekap & Laporan → Profil.
- Tour tetap muncul otomatis sekali per versi untuk Admin & Pengurus, dan bisa diulang
  kapan saja dari Tentang Aplikasi.

## Pembaruan 6 November 2026

- Merapikan tombol Hadir/Izin/Sakit/Alpha agar rata kanan dengan area tekan lebih besar.
- Menambahkan pop-up catatan rilis bertanggal yang tampil sekali per akun dan dapat dibuka kembali dari Profil Saya; tombol Coba Sekarang mengarah ke area fitur terkait.
- Menambahkan tombol Tutup Absen pada Kode Akses; peserta wajib yang belum memiliki status otomatis ditandai Alpha.
- Menambahkan pengaturan sembunyikan/tampilkan peserta pada Rekap Bulanan selama tiga bulan di perangkat, tanpa mengubah hitungan atau tautan publik.
- Menambahkan tindakan Hadirkan Semua untuk peserta wajib yang belum tercatat Hadir; status sebelumnya dikonfirmasi akan diganti.
- Mengubah pilihan jenis kegiatan menjadi tombol mendatar yang menyesuaikan ukuran layar.
- Menambahkan laporan Tidak Bisa Hadir dengan alasan wajib dan keterangan opsional; status disimpan sebagai Izin dan keterangannya terlihat oleh pengurus.

## Pembaruan 5 November 2026

- Dashboard kini menampilkan jumlah peserta belum pernah hadir, jarang hadir, dan cukup
  aktif; setiap pilihan membuka Rekap Bulanan dengan filter kategori tersebut.
- Menghapus rincian hitungan panjang dari setiap baris peserta Rekap Bulanan; daftar nama
  per pertemuan menampilkan warna sesuai status absensi.
- Menampilkan label sesi di samping nama peserta pada daftar absensi Rekap Bulanan.
- Merapikan Rekap Bulanan: ringkasan gender hanya menampilkan persen, sesi diringkas
  dalam kartu mendatar, dan rincian sesi per pertemuan hanya menampilkan nama serta jam.
  Baris pertemuan kini punya tooltip persentase dan dropdown nama/status peserta, diikuti
  keterangan hitungan yang lebih singkat. Tampilan tautan publik diselaraskan.
- Menghapus layar pembuka "Memuat aplikasi" dan indikator loading global; pemuatan data
  tetap memiliki indikator pada halaman yang membutuhkannya.
- Memperbarui formulir Tambah Peserta dengan bagian Data Utama dan Kontak/Kelompok,
  keterangan aktivasi, serta tombol aksi yang mudah dijangkau di ponsel.
- Rekap beberapa sesi ditampilkan mendatar dengan persentase kehadiran dan grafik
  batang beranimasi.
- Peserta yang sudah hadir pada kegiatan dalam rangkaian berulang tidak dihitung lagi
  pada tanggal berikutnya dalam rekap bulanan, termasuk lintas bulan.
- Laporan Kehadiran dihapus dari navigasi; pintasan menuju Rekap Bulanan, dan navigasi
  ponsel menyediakan tombol Rekap. Tautan lama tetap berfungsi tanpa QR.
- Hapus kegiatan terpilih kini meminta konfirmasi lewat modal berisi nama kegiatan.
  Tambah Peserta disusun sebagai langkah Data Utama, Kontak, dan Tinjau.
- Petunjuk sandi sementara dipindahkan ke Aktivasi Akun dan teks berbagi kode akses
  disederhanakan.
- Saat kegiatan ditutup manual atau otomatis, peserta wajib yang belum memiliki status
  otomatis dicatat Alpha; peserta di luar daftar wajib tetap tidak diubah.
- Rekap kegiatan menampilkan daftar khusus peserta Izin, Sakit, dan Alpha.
- Menyempurnakan Laporan per Peserta: pencarian nama saja, urutan kehadiran tertinggi/
  terendah, pilihan periode bulan sebelumnya, dan tampilan tanpa nomor HP/email.
- Tautan laporan peserta kini publik dengan masa berlaku 30 hari; halaman publik
  menampilkan ringkasan dan kegiatan, sementara pesan WhatsApp hanya berisi nama,
  periode laporan, dan tautan.

---

## Penyempurnaan jadwal dan rekap kegiatan

- Simpan kegiatan hanya tersedia setelah informasi ditinjau dan pengguna mencentang
  konfirmasi; pengiriman formulir dengan tombol Enter tidak melewati langkah tinjau.
- Pengajar, materi, lokasi, dan alamat Maps memberi saran dari jadwal sebelumnya; teks
  contoh pada kolom isian dihilangkan. Salin jadwal menampilkan rincian pola per sesi
  sebelum dibuat di tanggal tujuan.
- Rekap multi-sesi hanya menampilkan kehadiran per sesi. Halaman absensi memiliki tab
  Rekap/Laporan dengan status peserta dan tautan laporan yang dapat dibagikan.
- Formulir jadwal mendukung durasi 30 menit, 1 jam, 1,5 jam, 2 jam, atau jam selesai
  manual; jadwal rutin dapat dibuat bulanan untuk 1, 2, 3, 6, atau 12 bulan.
- Lokasi dapat ditautkan ke Google Maps dari detail kegiatan tanpa menyimpan URL Maps
  di database. Detail menampilkan breadcrumb dan navigasi mengambang; tanggal diringkas
  menjadi angka hari.
- Peserta wajib dapat dipilih untuk kegiatan tunggal maupun tiap sesi. Peserta lain tetap
  tampak di daftar dan tidak otomatis menjadi Alpha.
- Absensi mendukung Hadir, Izin, Sakit, dan Alpha. Alpha baru dapat dicatat setelah
  waktu kegiatan berakhir atau kegiatan ditutup; status kosong tetap Belum diabsen.
- Rekap kegiatan dan gabungan sesi menampilkan status yang konsisten, termasuk peserta
  yang belum diabsen, serta grafik batang beranimasi.

## Penyederhanaan masuk dan QR presensi

- Peran terakhir yang dipilih disimpan di browser agar akun yang masih masuk langsung
  membuka area tersebut saat situs dibuka kembali. Pemilihan peran tetap tersedia saat
  masuk pertama kali dan peran tersimpan diperbarui saat berpindah area; keluar akun
  menghapus pilihan tersebut.
- Halaman Kode Akses hanya menyediakan Bagikan ke WhatsApp dan Perbarui Kode sebagai
  tindakan; tombol salin tautan, salin kode, dan tampilan QR dihapus.
- QR pada halaman Scan Presensi dapat diketuk untuk membuka pratinjau besar. Aksi salin
  tautan dan unduh QR dihapus.

## Pembaruan daftar dan detail kegiatan

- Halaman Kegiatan menyediakan animasi panduan pembuatan kegiatan dengan narasi
  suara Bahasa Indonesia (memprioritaskan suara laki-laki yang tersedia di perangkat),
  teks tersinkron, kontrol putar/jeda, dan navigasi langkah. Jika suara Indonesia tidak
  tersedia, narasi mencoba suara bawaan perangkat; bila TTS gagal di ponsel, animasi tetap
  berjalan otomatis tanpa suara. Panel dapat ditutup dengan tombol X atau Escape.
- Daftar kegiatan mendukung pencarian, filter jenis, status Hari Ini/Akan Datang/Selesai,
  pemilihan kegiatan atau sesi, dan hapus massal dengan laporan bila sebagian gagal.
- Tanggal dan waktu tampil di sisi kiri kartu; beberapa sesi diringkas dalam baris yang
  lebih padat. Tab status memuat kegiatan sesuai status, sementara tampilan Semua mengikuti
  bulan yang dipilih.
- Formulir kegiatan dibagi menjadi langkah Kegiatan, Jadwal, Peserta, dan Tinjau dengan
  navigasi tetap terlihat.
- Scan barcode tersedia di samping Aksi Kegiatan. Tab undangan dan QR Absen Mandiri tidak
  ditampilkan pada detail.
- Rekap menampilkan jumlah hadir laki-laki/perempuan, daftar peserta, serta tautan yang
  dapat disalin atau dibagikan lewat WhatsApp; QR rekap tidak ditampilkan.
- Kartu Nama dipindahkan ke halaman khusus sidebar dengan pratinjau cetak.

## Pembaruan pengelolaan peserta

- Daftar akun kini memiliki tab Semua, Peserta, Pengurus, Admin, dan Guru, serta filter
  status aktivasi dan pencarian nama/nama pengguna/nomor HP.
- Pengurus dapat memilih akun peserta yang belum aktivasi untuk diaktifkan massal.
  Nama dipakai sebagai nama pengguna dan tanggal lahir `DDMMYYYY` menjadi sandi
  sementara; hanya akun berperan tunggal Peserta yang diproses, lalu peserta wajib
  mengganti sandi dan melengkapi profil saat login pertama.
- Formulir Tambah Peserta ditata ulang dan diberi label/keterangan yang lebih jelas.
- Kartu nama peserta menampilkan nama dan QR ID permanen, bisa dicari, difilter menurut
  kelompok/status, dipilih, lalu dicetak vertikal atau horizontal. QR ini tidak dipakai
  untuk presensi; QR presensi tetap berputar. Menu Kartu Nama tersedia di sidebar dan
  menyediakan pratinjau kartu terpilih sebelum dicetak.
- Pemilihan massal menandai hanya peserta tunggal yang masih pending dan memiliki
  tanggal lahir valid; jumlahnya ditampilkan pada kotak centang dan tombol aktivasi.

## Penyederhanaan dashboard Admin & Pengurus

- Sapaan dashboard hanya menampilkan nama pengguna, tanpa label peran.
- Pintasan dibatasi ke Tambah Peserta, Tambah Kegiatan, dan Laporan; dua formulir
  tambah dapat dibuka langsung dari dashboard.
- Statistik jenis kelamin, rasio kehadiran, dan kartu statistik lain dihapus;
  dashboard hanya menampilkan total peserta.
- Tren kehadiran diubah menjadi grafik batang horizontal.
- Kegiatan mendatang ditampilkan dalam tabel; nama kegiatan dapat dipilih untuk
  membuka detailnya.

## Perubahan navigasi Admin & Pengurus

- Sidebar desktop kini dapat diciutkan/dibuka; tampilan menu lebih ringkas dan label
  kategori tidak menggunakan huruf kapital berjarak.
- Navigasi dikelompokkan menjadi Peserta, Kegiatan, Laporan, dan Pengaturan admin.
  Musyawarah dan pesan Ruang Teduh masuk ke kategori Laporan dengan label "Laporan Masuk".
- Program Pembelajaran tidak lagi tampil di sidebar admin karena tersedia di area Guru.
- Menu Pengurus tetap menyediakan Bantuan, tanpa kategori Pengaturan admin.
- Menu ponsel kini memakai Bottom Navigation Bar dengan tombol Beranda, Peserta,
  Kegiatan, Laporan, dan Menu. Menu membuka bottom sheet berisi kisi empat kolom
  untuk fitur tambahan; ikon dan label menu disusun dalam kolom dengan tinggi seragam
  agar teks dua baris tidak menggeser label fitur lain.
- Tampilan mobile dimulai pada skala 100% dan tetap mendukung zoom/pinch; viewport
  tidak membatasi skala maksimum.
- QR pribadi untuk presensi tetap berubah berkala dan tidak digunakan sebagai QR
  identitas pada kartu nama.

## Perbaikan backend Vercel gagal dimuat

- Menambahkan `requests` ke `requirements.txt` root dan `api/requirements.txt`.
  `backend/server.py` mengimpor paket ini, tetapi sebelumnya paket tersebut hanya
  tercantum di `backend/requirements.txt`, sehingga function Vercel dapat gagal saat
  mengimpor entrypoint.

## Perubahan halaman login

- Menghapus tombol "Absen dengan Kode (6 Digit)", "Daftar Baru (Scan QR)", dan
  "Coba Mode Demo", termasuk informasi akun demo, dari halaman login.
- Alur aktivasi akun tetap tersedia. Route pendaftaran dan absen kode tidak dihapus
  agar tautan atau QR yang sudah dibagikan tidak rusak.

## Fase 8 — Detail absen, filter jenis kelamin, tipe publik/tamu, mode offline

### Backend (`backend/server.py`)
- Kegiatan: field baru `audience` (reguler|publik) & `gender_filter` (semua|L|P) + `phase` pada respons.
- Peserta kegiatan disaring per kegiatan (`peserta_for_kegiatan`, `match_gender_filter`).
- Tamu kegiatan publik: koleksi `guest_absens` + endpoint staff & kode-akses (tambah/hapus), ikut dihitung hadir.
- Sinkronisasi absen offline: `POST /api/admin/kegiatan/{id}/absen-batch`, `POST /api/absensi/{token}/mark-batch` (waktu dinormalkan ke WITA).
- Tindak lanjut tidak hadir: koleksi `follow_ups` + `GET/POST /api/staff/kegiatan/{id}/tindak-lanjut`.
- Laporan & rekap menghormati filter peserta + tamu; `/me/kegiatan` & `/me/dashboard` menyembunyikan kegiatan yang tidak sesuai jenis kelamin.
- Performa: GZip middleware, daftar kegiatan tanpa N+1 query, index baru.

### Frontend
- `pages/admin/KegiatanDetail.jsx` (BARU): halaman detail absen dengan navigasi bar horizontal (7 tab).
- `pages/admin/KegiatanView.jsx`: daftar dikelompokkan Akan Datang → Berlangsung → Selesai, badge tipe peserta & jenis kelamin, form kegiatan + pilihan tipe peserta, filter jenis kelamin, blok "Segera Hadir".
- `lib/offline.js` + `components/OfflineBanner.jsx` (BARU): antrean absen offline & auto-sync.
- `lib/api.js`: timeout 25s + retry GET otomatis (stabilitas Vercel).
- `pages/PublicAbsensi.jsx`: badge tipe/filter, tab Tamu, mode offline.
- `pages/SelfAbsen.jsx` & `components/ProfileMenu.jsx`: FIX input kehilangan fokus tiap 1 huruf (komponen dipindah ke level modul) + tombol kirim pesan anonim.
- `pages/peserta/KegiatanList.jsx`: pengelompokan & urutan yang sama untuk jamaah.

## Fase 6 — 8 Revisi UX: Link Laporan, Action Modal, Verifikasi Akun, Absen Terfokus

Menjawab 8 permintaan revisi: laporan berbasis tautan, penggantian dropdown dengan action
modal, verifikasi kelengkapan akun saat login, absen scan yang terfokus 1 peserta,
rekap peserta berbentuk dropdown, penjaga absen dengan 2 cara absen, peserta hasil import
Excel bisa diabsen manual, serta profil untuk semua peran.

### Ditambahkan

- **Tautan laporan publik (permanen)** — `POST /api/admin/laporan/share`
  (body `{date_from, date_to, mode: harian|bulanan|custom}`) membuat token **permanen**
  dan **idempoten** (rentang + mode yang sama memakai token yang sama, sehingga tautan
  yang sudah dibagikan tidak pernah basi). `GET /api/laporan/{token}` dapat dibuka
  **tanpa login**. Koleksi baru: `laporan_links`.
- Halaman publik `PublicLaporan.jsx` di route `/laporan/:token` — ringkasan, kehadiran per
  jenis kelamin, tabel "Rincian per Kegiatan", dropdown "Rekap per Peserta", top rajin/alpha.
- **Absen mandiri terfokus** — `GET /api/me/absen/{token}` dan
  `POST /api/me/absen/{token}/mark` (keduanya **wajib login**). Endpoint hanya
  mengembalikan/menandai data **diri sendiri**; tidak ada daftar peserta lain sehingga
  titip absen tidak mungkin dilakukan.
- **Penjaga absen scan barcode** — `POST /api/delegate/kegiatan/{id}/scan-personal`
  untuk penerima delegasi (sebelumnya hanya staf yang punya endpoint scan).
- `profile_complete` (bool) + `missing_fields` (list label) pada seluruh respons user
  (`public_user`), dengan konstanta `REQUIRED_PROFILE_FIELDS` dan helper
  `profile_missing_fields()`. Field wajib: Nama Lengkap, Jenis Kelamin, Tanggal Lahir,
  No. HP, Alamat (foto profil opsional).
- Field `account_status` pada baris rekap/absen (`/admin/kegiatan/{id}/rekap`,
  `/absen/{token}`, `/delegate/kegiatan/{id}`) dan `per_peserta` pada `/admin/laporan`
  + `/laporan/{token}` — dipakai UI untuk label "Belum aktivasi".
- Komponen `components/ActionModal.jsx` — action sheet serbaguna (bottom-sheet di HP,
  dialog di desktop), dirender lewat `createPortal` ke `document.body`.
- Komponen `components/PesertaRekapList.jsx` — daftar peserta berbentuk dropdown
  (accordion) dengan kolom berjarak `Nama | Jam | Status`, pencarian, dan filter
  Semua/Hadir/Izin/Alpha.
- Halaman `pages/CompleteProfile.jsx` + route `/lengkapi-akun` — gerbang verifikasi akun.
- Halaman `pages/SelfAbsen.jsx` — pengganti `PublicAbsen.jsx`.
- Halaman `pages/peserta/PenjagaAbsen.jsx` — area penjaga absen bagi penerima delegasi,
  dengan mode **Absen Manual** dan **Scan Barcode**.
- `backend/tests/test_smoke_iteration4.py` — smoke/regression test iterasi ini
  (kredensial admin dibaca dari env `ADMIN_EMAIL`/`ADMIN_PASSWORD`).

### Diubah

- **`PESERTA_QUERY` kini mencakup `status: "pending"`** (sebelumnya hanya `active`).
  Peserta hasil import Excel yang belum aktivasi otomatis muncul di daftar absen dan
  **ikut dihitung** pada rekap/laporan. Mereka tetap tidak bisa login/absen mandiri.
- Menu dropdown "Opsi" pada kartu kegiatan diganti **action modal** berisi 8 aksi
  (Rekap Absen, Bagikan Rekap, Pengingat WhatsApp, Scan QR Peserta, Penjaga Absen,
  Edit Kegiatan, Kotak Pesan/Saran, Hapus Kegiatan) — tombol hapus terpisah dihapus.
- `ProfileMenu` tidak lagi memakai dropdown, melainkan action modal; menampilkan foto
  profil asli dan penanda bila data profil belum lengkap.
- `ProfileModal` kini **bisa mengedit** profil (sebelumnya hanya menampilkan) dan
  tersedia untuk **semua peran** (admin, pengurus, peserta).
- `RoleDashboard` memakai foto profil pengguna (sebelumnya foto stok Unsplash
  berdasarkan `avatar_gender`), plus banner peringatan bila data profil belum lengkap.
- `PesertaArea` menampilkan tab **Penjaga** secara dinamis bila pengguna memiliki
  delegasi absen aktif (jumlah kolom bottom-nav ikut menyesuaikan).
- Laporan: tombol "Share WA" (yang menyusun teks template WhatsApp) diganti
  **"Buat Link Laporan"** yang memunculkan modal berisi QR, tautan, Salin Link,
  Unduh QR, dan Bagikan Link via WhatsApp.
- `PublicRekap` dan modal Absensi memakai `PesertaRekapList`; modal Absensi kini punya
  dua bagian yang bisa dibuka/tutup: "Rekap Kehadiran" dan "Absen Manual".
- `PenjagaAbsenView` (sisi pengurus) menyediakan tombol **Absen Manual** dan
  **Scan Barcode** langsung per kegiatan, serta "Aksi Lain" berisi Kelola Delegasi.
- `ScanTab` mengarahkan hasil scan ke `/absen/{token}` dan menegaskan absen hanya untuk
  diri sendiri.
- `AbsensiModal` diekspor dari `KegiatanView` agar bisa dipakai ulang `PenjagaAbsenView`.
- Seluruh pesan sukses/gagal absen ditulis ulang dalam **Bahasa Indonesia yang sopan**
  (mis. "Mohon maaf, kegiatan ini sudah ditutup sehingga absen mandiri tidak dapat
  diproses. Silakan menghubungi pengurus untuk absen susulan.",
  "Alhamdulillah, kehadiran Anda ... berhasil dicatat. Jazakumullahu khoiro.").
- Kelengkapan jenis kelamin dinilai dari field `gender` **mentah**, bukan turunan
  `avatar_gender`, agar pengguna benar-benar memilih sendiri.

### Diperbaiki

- **Modal terpotong** — `ActionModal`/`ProfileModal` sempat terpotong karena elemen
  induk memakai `backdrop-blur`, yang membentuk *containing block* bagi
  `position: fixed`. Diperbaiki dengan `createPortal` ke `document.body`.
- **Kembali ke halaman absen setelah login** — `PublicOnly` langsung melempar pengguna
  ke `/roles` sebelum tujuan `?next=` diproses. `PublicOnly` kini menghormati `?next=`,
  sehingga alur "scan QR → login → absen" kembali ke halaman absen yang benar.
- `POST /api/delegate/kegiatan/{id}/scan-personal` membalas `422` saat body kosong;
  `content` dibuat opsional sehingga pemeriksaan hak akses (`403`) dan pesan Bahasa
  Indonesia yang sopan (`400`) berjalan lebih dulu.

### Dihapus

- `frontend/src/pages/PublicAbsen.jsx` — digantikan `SelfAbsen.jsx`. Halaman lama
  menampilkan seluruh daftar peserta sehingga memungkinkan titip absen.

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
