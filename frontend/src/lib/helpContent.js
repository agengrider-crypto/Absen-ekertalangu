// Isi Pusat Bantuan per peran. Tutorial video dikelola admin lewat halaman
// Tutorial video (koleksi `tutorial_video`) â€” tidak ada data contoh di sini.
// Bantuan Guru belum dibuat.

export const HELP_ROLES = [
  { key: "admin", label: "Administrator" },
  { key: "pengurus", label: "Pengurus" },
  { key: "peserta", label: "Peserta" },
];

export const HELP_CONTENT = {
  admin: {
    label: "Administrator",
    steps: [
      { title: "Kelola peserta", desc: "Menu User untuk menambah, mengubah, dan menonaktifkan akun. Lengkapi tanggal lahir dan jenis kelamin agar penyaringan kegiatan akurat." },
      { title: "Buat kegiatan", desc: "Daftar Kegiatan â†’ Tambah Kegiatan. Pilih riwayat kegiatan yang sering dibuat, atau Mulai dari kosong lalu tentukan Waktu dan Sesi." },
      { title: "Atur hak akses", desc: "Menu Hak Akses memberi peran Pengurus atau Guru, serta mengatur ulang kata sandi peserta." },
      { title: "Pantau kehadiran", desc: "Rekap Harian dan Rekap Bulanan menampilkan persentase serta status kehadiran tiap peserta." },
      { title: "Bagikan rekap", desc: "Tombol Bagikan ke WhatsApp atau Salin tautan membuat tautan baru yang berlaku 7 hari." },
    ],
    faq: [
      { q: "Kenapa tautan rekap sudah tidak bisa dibuka?", a: "Tautan rekap bulanan hanya berlaku 7 hari sejak dibuat. Buat tautan baru dari halaman Rekap Bulanan." },
      { q: "Bagaimana menutup absensi yang terlupa?", a: "Buka tautan absensi kegiatan (dibagikan lewat WhatsApp), lalu tekan Tutup Absensi. Peserta yang belum diabsen otomatis menjadi Alpha." },
      { q: "Bisakah menghapus kegiatan yang sudah ada absensinya?", a: "Bisa, tetapi seluruh data absensinya ikut terhapus. Sistem meminta Anda mengetik HAPUS sebagai konfirmasi." },
    ],
  },
  pengurus: {
    label: "Pengurus",
    steps: [
      { title: "Buat kegiatan", desc: "Daftar Kegiatan â†’ Tambah Kegiatan. Isi nama, tanggal, dan jam; pilih beberapa sesi bila sehari ada pagi dan malam." },
      { title: "Catat kehadiran", desc: "Buka kegiatan â†’ tab Absen Manual, atau bagikan kode akses agar petugas di lokasi bisa mengabsen sendiri." },
      { title: "Scan barcode peserta", desc: "Tab Scan Barcode memindai QR peserta dan langsung mencatat kehadiran pada sesi yang dibuka." },
      { title: "Bagikan rekap", desc: "Rekap harian dan bulanan menyediakan tautan WhatsApp untuk dibagikan ke peserta." },
    ],
    faq: [
      { q: "Peserta tidak muncul di daftar absen?", a: "Periksa filter kegiatan: jenis kelamin, status pernikahan, kelompok usia, atau daftar peserta terpilih." },
      { q: "Kode akses salah terus?", a: "Minta admin memperbarui kode akses dari menu Kode Akses, lalu bagikan kode yang baru." },
    ],
  },
  peserta: {
    label: "Peserta",
    steps: [
      { title: "Masuk ke aplikasi", desc: "Isi email, username, atau nomor HP beserta kata sandi. Sandi awal = tanggal lahir format HHBBTTTT." },
      { title: "Tunjukkan QR Saya", desc: "Buka tab QR Saya lalu tunjukkan ke petugas absen. QR ini tetap dan aman disimpan." },
      { title: "Lihat jadwal", desc: "Tab Kegiatan memuat jadwal yang sesuai data Anda, termasuk undangan penting." },
      { title: "Ajukan izin", desc: "Beri tahu pengurus sebelum kegiatan dimulai agar status Anda dicatat sebagai Izin, bukan Alpha." },
    ],
    faq: [
      { q: "Saya lupa kata sandi", a: "Gunakan tautan Lupa Sandi di halaman masuk, atau minta pengurus mengatur ulang sandi Anda." },
      { q: "Kenapa persen kehadiran saya kecil?", a: "Persen dihitung dari sesi wajib yang Anda ikuti. Hadir di sesi pagi tidak otomatis terhitung di sesi malam." },
    ],
  },
};

// Tutorial video dikelola admin lewat halaman Tutorial video (koleksi
// `tutorial_video`). Tidak ada data contoh di file ini.
