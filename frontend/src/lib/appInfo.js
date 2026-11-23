// Sumber tunggal data "Update Terbaru" (changelog) aplikasi.
// Dipakai oleh pop-up catatan rilis (ReleaseNotes) dan halaman Tentang Aplikasi.
// Tambahkan entri baru di PALING ATAS setiap rilis.

export const APP_INFO = {
  name: "E-KERTALANGU",
  tagline: "Absensi Pengajian",
  version: "2.2.0",
  build: "2026.11.09",
  releaseYear: 2026,
  developer: "BrodyCorp",
  developerNote: "Dikembangkan untuk Majelis / Kelompok Kertalangu",
  copyright: "© 2026 BrodyCorp. Seluruh hak cipta dilindungi.",
  description:
    "Aplikasi absensi pengajian untuk Majelis/Kelompok Kertalangu. Mencatat kehadiran lewat " +
    "absen manual, QR pribadi, dan QR kegiatan, lalu menyajikan rekap harian, bulanan, serta " +
    "laporan per peserta — ringkas, ramah lansia, dan bisa dipakai dari HP.",
};

export const CHANGELOG = [
  {
    id: "2026-11-23-ganti-password",
    date: "2026-11-23",
    jenis: "fitur",
    title: "Ganti password saat login pertama",
    keterangan: "Password awal wajib diganti agar akun lebih aman.",
    items: ["Password awal wajib diganti agar akun lebih aman."],
  },
  {
    id: "2026-11-23-cadangan-data",
    date: "2026-11-23",
    jenis: "fitur",
    tujuan: "/area/admin/cadangan",
    title: "Cadangan data",
    keterangan: "Unduh salinan data peserta, kegiatan, absensi, dan pendaftaran dari menu Pengaturan.",
    items: ["Unduh salinan data peserta, kegiatan, absensi, dan pendaftaran dari menu Pengaturan."],
  },
  {
    id: "2026-11-23-rekap-bulanan-info",
    date: "2026-11-23",
    jenis: "fitur",
    tujuan: "/area/admin/rekap-bulanan",
    title: "Rekap bulanan lebih informatif",
    keterangan: "Tooltip rincian kehadiran, nama peserta bisa diklik untuk riwayat, tombol sembunyikan berfungsi.",
    items: ["Tooltip rincian kehadiran, nama peserta bisa diklik untuk riwayat, tombol sembunyikan berfungsi."],
  },
  {
    id: "2026-11-23-modal-daftar",
    date: "2026-11-23",
    jenis: "perbaikan",
    title: "Modal pembaruan berbentuk daftar",
    keterangan: "Ada label, tanggal, dan tombol Coba sekarang.",
    items: ["Ada label, tanggal, dan tombol Coba sekarang."],
  },
  {
    id: "2026-11-23-scan-pesan",
    date: "2026-11-23",
    jenis: "perbaikan",
    tujuan: "/area/admin/kegiatan",
    title: "Pesan penolakan Scan Presensi lebih jelas",
    keterangan: "Scan Presensi: pesan penolakan lebih jelas, misalnya di luar jam kegiatan.",
    items: ["Scan Presensi: pesan penolakan lebih jelas, misalnya di luar jam kegiatan."],
  },
  {
    id: "2026-11-23-kategori-generus",
    date: "2026-11-23",
    jenis: "perbaikan",
    tujuan: "/area/admin/peserta",
    title: "Tab Generus/Dewasa mengikuti status pernikahan",
    keterangan: "Tab Generus/Dewasa langsung mengikuti status pernikahan; jenjang hanya untuk Generus.",
    items: ["Perbaikan: tab Generus/Dewasa langsung mengikuti status pernikahan; jenjang hanya untuk Generus."],
  },
  {
    id: "2026-11-23-modal-pembaruan",
    date: "2026-11-23",
    title: "Modal Pembaruan terbaru lebih sederhana",
    keterangan: "Modal Pembaruan terbaru lebih sederhana, dengan tombol WhatsApp ke admin.",
    items: ["Modal Pembaruan terbaru lebih sederhana, dengan tombol WhatsApp ke admin."],
  },
  {
    id: "2026-11-23-kalender-lebar",
    date: "2026-11-23",
    jenis: "fitur",
    tujuan: "/area/admin/kalender",
    title: "Kalender kegiatan lebih lebar",
    keterangan: "Kalender kegiatan lebih lebar; klik tanggal langsung ke Absensi atau jendela sesi.",
    items: ["Kalender kegiatan lebih lebar; klik tanggal langsung ke Absensi atau jendela sesi."],
  },
  {
    id: "2026-11-23-dashboard-ringkas",
    date: "2026-11-23",
    jenis: "fitur",
    tujuan: "/area/admin",
    title: "Dashboard lebih sederhana",
    keterangan: "Dashboard lebih sederhana dan ringkas.",
    items: ["Dashboard lebih sederhana dan ringkas."],
  },
  {
    id: "2026-11-23-halaman-user",
    date: "2026-11-23",
    jenis: "fitur",
    tujuan: "/area/admin/peserta",
    title: "Halaman User lebih sederhana",
    keterangan: "Daftar nama, filter status, mode Pilih, dan kategori otomatis dari status pernikahan.",
    items: [
      "Halaman User lebih sederhana: daftar nama, filter status, mode Pilih, dan kategori otomatis dari status pernikahan.",
    ],
  },
  {
    id: "2026-11-23-perbaikan-notifikasi",
    date: "2026-11-23",
    jenis: "perbaikan",
    title: "Perbaikan notifikasi dan tanggal lahir",
    keterangan: "Notifikasi, undangan, dan pemeriksa maintenance tidak lagi error; tanggal lahir bisa dipilih lewat kalender.",
    items: [
      "Perbaikan: notifikasi, undangan, dan pemeriksa maintenance tidak lagi error; tanggal lahir bisa dipilih lewat kalender.",
    ],
  },
  {
    id: "2026-11-19-masuk-akun",
    date: "2026-11-19",
    jenis: "fitur",
    title: "Masuk akun lebih ringkas",
    keterangan: "Bisa masuk dengan nomor HP, email, username, atau nama.",
    items: [
      "Masuk akun:",
      "Halaman masuk lebih ringkas. Bisa masuk dengan nomor HP, email, username, atau nama.",
      "Lupa kata sandi? Ketuk satu kali, kata sandi kembali ke tanggal lahir (DDMMYY).",
      "Rekap dan laporan:",
      "Rekap dibuat per kegiatan. Peserta yang sudah hadir di kegiatan sebelumnya pada hari yang sama tidak dihitung lagi sebagai Alpha.",
      "Rekap gabungan tersedia bila dipilih, dengan persen kehadiran.",
      "Kartu angka di rekap bisa diketuk untuk menyaring daftar.",
      "Tautan rekap publik berlaku 7 hari. Jam kehadiran bisa ditampilkan atau disembunyikan lewat saklar saat membagikan.",
      "Pesan WhatsApp rekap lebih singkat: nama kegiatan, tanggal, dan tautan.",
      "Kegiatan:",
      "Tambah Kegiatan lebih ringkas, langkah Peserta disederhanakan.",
      "Pengajar bisa ditandai di data peserta, dan pengajar yang tidak wajib absen dipilih per nama di tiap kegiatan.",
      "Absen sebelumnya kini berupa daftar kegiatan lama: bisa dicari, diisi absennya, atau disalin jadi kegiatan baru.",
      "Tombol X dan Batal di Tambah Kegiatan langsung kembali ke Daftar Kegiatan.",
      "Pos Scan dan tautan kartu tanpa login tersedia untuk pengurus.",
      "Izin dan notifikasi:",
      "Izin lewat HP langsung tercatat Izin di absen manual dan bisa disetujui atau dibatalkan pengurus.",
      "Notifikasi hadir, izin, sakit, dan alpha aktif kembali.",
      "Teks halaman izin diperbarui.",
      "Aplikasi lebih cepat dibuka dan lebih ringan, terutama di daftar yang panjang.",
    ],
  },
  {
    id: "2026-11-18-rekap-rapi",
    date: "2026-11-18",
    jenis: "fitur",
    tujuan: "/area/admin/rekap-bulanan",
    title: "Rekap lebih rapi, tautan lebih aman",
    keterangan: "Tiap tautan rekap kini menampilkan satu kegiatan saja.",
    peran: ["admin", "pengurus"],
    items: [
      "Tiap tautan rekap kini menampilkan satu kegiatan saja. Ketuk Hadir, Izin, Sakit, atau Alpha untuk melihat namanya, dan saring dengan L atau P.",
      "Rekap gabungan dibuat sendiri dari Daftar Kegiatan, dan satu orang dihitung sekali dalam sehari.",
      "Laporan harian tidak lagi memakai angka sesi. Persen hanya ada di total gabungan.",
      "Tombol Bagikan rekap kini di samping Scan kamera. Jam kehadiran bisa ditampilkan atau disembunyikan, dan tautan bisa dinonaktifkan atau dihapus.",
      "Tautan rekap berlaku 7 hari.",
    ],
  },
  {
    id: "2026-11-18-pendataan",
    date: "2026-11-18",
    jenis: "fitur",
    tujuan: "/area/admin/pendataan",
    title: "Pendataan peserta",
    keterangan: "Pengurus bisa membuat tautan agar peserta melengkapi datanya sendiri.",
    peran: ["admin", "pengurus"],
    items: [
      "Pengurus bisa membuat tautan agar peserta melengkapi datanya sendiri.",
      "Isian peserta masuk ke tinjauan lebih dulu dan tidak langsung mengubah data.",
    ],
  },
  {
    id: "2026-11-18-kartu-kategori",
    date: "2026-11-18",
    jenis: "fitur",
    tujuan: "/area/admin/kartu-nama",
    title: "Kartu Nama dengan kategori",
    keterangan: "Kartu menampilkan kategori dan kode QR tetap untuk presensi.",
    peran: ["admin", "pengurus"],
    items: [
      "Kartu menampilkan kategori Bapak-bapak, Ibu-ibu, atau Muda-mudi dan kode QR tetap untuk presensi.",
      "Scan kartu di kegiatan tidak mengharuskan peserta login.",
    ],
  },
  {
    id: "2026-11-18-alamat-baru",
    date: "2026-11-18",
    title: "Alamat baru aplikasi",
    keterangan: "Alamat aplikasi sekarang ekertalangu.vercel.app.",
    items: [
      "Alamat aplikasi sekarang ekertalangu.vercel.app. Alamat lama tetap bisa dibuka dan dialihkan otomatis.",
    ],
  },
  {
    id: "2026-11-16-kartu-nama",
    date: "2026-11-16",
    jenis: "fitur",
    tujuan: "/area/admin/kartu-nama",
    title: "Kartu nama diperbarui",
    keterangan: "Tombol cetak menempel di bawah saat daftar digulir.",
    tujuan: "kartu-nama",
    peran: ["admin", "pengurus"],
    items: ["Tombol cetak menempel di bawah saat daftar digulir."],
  },
  {
    id: "2026-11-16-presensi-kartu",
    date: "2026-11-16",
    jenis: "fitur",
    tujuan: "/area/admin/scan-presensi",
    title: "Presensi dengan kartu",
    keterangan: "Peserta cukup menunjukkan kartu ke kamera di kegiatan yang berlangsung. Kamera dibuat lebih besar dan hasilnya tampil jelas.",
    tujuan: "kegiatan",
    peran: ["admin", "pengurus"],
    items: ["Peserta cukup menunjukkan kartu ke kamera di kegiatan yang berlangsung."],
  },
  {
    id: "2026-11-16-rekap-bulanan",
    date: "2026-11-16",
    jenis: "fitur",
    tujuan: "/area/admin/rekap-bulanan",
    title: "Rekap bulanan baru",
    keterangan: "Hanya kegiatan yang sudah berlangsung yang dihitung.",
    tujuan: "rekap-bulanan",
    peran: ["admin", "pengurus"],
    items: ["Hanya kegiatan yang sudah berlangsung yang dihitung."],
  },
  {
    id: "2026-11-16-laporan-masuk",
    date: "2026-11-16",
    jenis: "fitur",
    tujuan: "/area/admin/pengaduan",
    title: "Laporan masuk",
    keterangan: "Ada status dan catatan pengurus.",
    tujuan: "pengaduan",
    peran: ["admin", "pengurus"],
    items: ["Ada status dan catatan pengurus."],
  },
  {
    id: "2026-11-16-peserta",
    date: "2026-11-16",
    jenis: "fitur",
    tujuan: "/area/admin/peserta",
    title: "Jenjang dan nomor WA wali",
    keterangan: "Ada di data peserta.",
    tujuan: "peserta",
    peran: ["admin", "pengurus"],
    items: ["Ada di data peserta."],
  },
  {
    id: "2026-11-16-menu-hp",
    date: "2026-11-16",
    title: "Menu bawah di HP",
    keterangan: "Beranda, Peserta, Kegiatan, Rekap, Lainnya.",
    peran: ["admin", "pengurus"],
    items: ["Beranda, Peserta, Kegiatan, Rekap, Lainnya."],
  },
  {
    id: "2026-11-16-laporan-peserta",
    date: "2026-11-16",
    title: "Laporan per peserta",
    keterangan: "Hitungan hanya kegiatan yang sudah berlangsung, dan ada mode pilih untuk membagikan banyak tautan sekaligus.",
    tujuan: "laporan-peserta",
    peran: ["admin", "pengurus"],
    items: ["Hitungan hanya kegiatan yang sudah berlangsung."],
  },
  {
    id: "2026-11-16-kalender",
    date: "2026-11-16",
    title: "Kalender kegiatan lebih lega",
    keterangan: "Sel hari lebih besar dan tulisan kegiatan mudah dibaca.",
    tujuan: "kalender",
    peran: ["admin", "pengurus"],
    items: ["Sel hari lebih besar dan tulisan kegiatan mudah dibaca."],
  },
  {
    id: "2026-11-16-tambah-kegiatan",
    date: "2026-11-16",
    title: "Tambah kegiatan jadi halaman",
    keterangan: "Empat cara memulai: absen cepat, absen sebelumnya, kegiatan terjadwal, dan kegiatan multi-sesi.",
    tujuan: "kegiatan",
    peran: ["admin", "pengurus"],
    items: ["Empat cara memulai kegiatan dalam satu halaman."],
  },
  {
    id: "2026-11-16-ruang-teduh",
    date: "2026-11-16",
    title: "Ruang Teduh baru",
    keterangan: "Tampilan lebih sederhana, dan cerita bisa dikirim tanpa nama.",
    peran: ["peserta"],
    items: ["Tampilan lebih sederhana, dan cerita bisa dikirim tanpa nama."],
  },
  {
    id: "2026-11-16-anak-saya",
    date: "2026-11-16",
    title: "Anak saya",
    keterangan: "Orang tua bisa melihat kehadiran dan tugas anaknya di Beranda.",
    peran: ["peserta"],
    items: ["Orang tua bisa melihat kehadiran dan tugas anaknya."],
  },
  {
    id: "2026-11-11-logo",
    date: "2026-11-11",
    title: "Logo Baru K1",
    items: [
      "Seluruh logo lama diganti logo K1 (SVG) dengan wordmark E-Kertalangu dan tagline Absensi Digitalisasi Pengajian.",
      "Logo tampil di login, sidebar admin, menu geser HP, dan header laporan peserta (versi latar gelap).",
      "Favicon, ikon PWA 192/512, dan maskable diperbarui; splash screen dan prompt pemasangan PWA memakai logo K1.",
    ],
  },
  {
    id: "2026-11-09-tema",
    date: "2026-11-09",
    title: "Standar Warna Baru & Halaman Maintenance",
    items: [
      "Seluruh aplikasi memakai satu palet warna: biru (utama), hijau (hadir/aktif), cyan (info), amber (izin), merah (alpha/hapus), abu-abu (netral).",
      "Design token terpusat di src/lib/theme.js dan CSS variable, mudah diubah di masa depan.",
      "QR Code & Barcode tetap hitam di atas putih agar pemindaian tetap cepat.",
      "Halaman Maintenance baru dengan pesan ramah dan tombol Coba Lagi.",
    ],
  },
  {
    id: "2026-11-09-profil",
    date: "2026-11-09",
    title: "Profil & Pesan WhatsApp Lebih Ringkas",
    items: [
      "Pembaruan Terbaru tampil sebagai kartu dengan tombol Coba Sekarang yang langsung membuka fiturnya.",
      "Tombol Ganti Peran dipindah ke luar, di samping profil, dengan ukuran lebih kecil.",
      "Tentang Aplikasi kini fokus pada identitas aplikasi dan Tour Panduan saja.",
      "Teks pesan WhatsApp (laporan, rekap, undangan) dibuat singkat tanpa salam pembuka dan penutup.",
    ],
  },
  {
    id: "2026-11-09-filter-fab",
    date: "2026-11-09",
    title: "Filter Status Pindah ke FAB",
    items: [
      "Baris filter status di atas daftar User dihapus — cukup lewat tombol Filter di bottom bar.",
      "Tab status kegiatan (Semua/Hari ini/Akan datang/Selesai) dihapus dari atas — ada di bottom bar.",
      "Halaman jadi lebih ringkas: judul, pencarian, lalu langsung daftar data.",
    ],
  },
  {
    id: "2026-11-09-rapi",
    date: "2026-11-09",
    title: "Header Rapi, Aksi Pindah ke Bottom Bar",
    items: [
      "Tombol Tambah Peserta dihapus dari header — cukup lewat FAB \"+\" di bottom bar.",
      "Tombol Tambah Kegiatan dihapus dari header — cukup lewat FAB \"+\" di bottom bar.",
      "Animasi Panduan, Daftar, dan Kalender dipindah ke bottom bar pada tampilan mobile.",
      "Semua tombol bottom bar disejajarkan rata dalam satu baris.",
    ],
  },
  {
    id: "2026-11-09-bottom-bar",
    date: "2026-11-09",
    title: "Bottom Action Bar di Ponsel",
    items: [
      "Bar aksi menempel di bawah layar pada tampilan mobile: Cari, Filter, Previous/Next, dan indikator halaman.",
      "FAB hijau \"+\" menonjol di tengah bar untuk menambah data.",
      "Aman dari gesture navigation Android/iPhone (safe area) dan tidak menutupi menu bawah.",
      "Tombol Previous/Next otomatis nonaktif di halaman pertama atau terakhir.",
      "Panel notifikasi dibuat lebih sederhana: satu baris judul + keterangan singkat.",
      "Tour panduan hanya muncul sekali; update berikutnya cukup menampilkan Update Terbaru.",
    ],
  },
  {
    id: "2026-11-09-fab",
    date: "2026-11-09",
    title: "Tombol Melayang di User & Kegiatan",
    items: [
      "Floating Action Button (FAB) melayang di tengah bawah pada daftar User dan Kegiatan.",
      "Satu tombol membuka pencarian, filter status, dan tombol tambah data.",
      "Navigasi halaman sebelumnya/berikutnya langsung dari FAB, lengkap dengan jumlah data.",
      "Daftar User dan Kegiatan kini dibagi per halaman agar lebih ringan di ponsel.",
      "Tombol Salin Tautan pada QR Aktivasi dihapus karena QR sudah memuat tautannya.",
    ],
  },
  {
    id: "2026-11-09-aktivasi",
    date: "2026-11-09",
    title: "QR Aktivasi Akun di Dashboard",
    items: [
      "Kartu QR Aktivasi Akun di Dashboard: jamaah memindai lalu mengaktifkan akunnya sendiri.",
      "Pembesar QR sekali ketuk, plus tombol Salin Tautan dan Cetak QR.",
      "Aktivasi manual: cari nama peserta yang belum aktivasi lalu tekan Aktifkan.",
      "Buat & aktifkan akun baru langsung dari Dashboard dengan mengetik nama dan tanggal lahir.",
      "Tombol Coba Sekarang pada Update Terbaru kini langsung membuka fitur yang dimaksud.",
    ],
  },
  {
    id: "2026-11-09-tentang",
    date: "2026-11-09",
    title: "Tentang Aplikasi & Tour Panduan",
    items: [
      "Menu Tentang Aplikasi: logo, versi, pengembang, tahun rilis, dan hak cipta.",
      "Update Terbaru dengan tombol Lihat Perubahan berisi daftar changelog.",
      "Tour Panduan terpisah: Dashboard → User → Daftar Kegiatan → Rekap & Laporan → Profil.",
    ],
  },
  {
    id: "2026-11-08-user",
    date: "2026-11-08",
    title: "Halaman User lebih rapi",
    items: [
      "Daftar user berupa kartu ringkas: nama, kontak, peran, dan status.",
      "Seluruh baris bisa diketuk untuk membuka detail bertab.",
      "Detail user dibagi menjadi tab Profil, Kehadiran, QR, dan Riwayat.",
      "Semua aksi (ubah data, pindah sambung, reset sandi, nonaktifkan) ada di tombol ⋯.",
    ],
  },
  {
    id: "2026-11-07-absensi",
    date: "2026-11-07",
    title: "Absensi lebih cepat & lengkap",
    items: [
      "Tombol Hadirkan Semua Peserta untuk menandai seluruh peserta wajib sekaligus.",
      "Tutup Absen di Kode Akses — peserta yang belum diabsen otomatis Alpha.",
      "Izin/Sakit meminta alasan dan keterangan opsional.",
      "Posisi tombol Hadir/Izin/Sakit/Alpha dirapikan rata kanan agar mudah dibaca.",
    ],
  },
  {
    id: "2026-11-06-rekap",
    date: "2026-11-06",
    title: "Rekap & laporan",
    items: [
      "Rekap Bulanan bisa menyembunyikan peserta selama tiga bulan di perangkat.",
      "Laporan Tidak Bisa Hadir dengan alasan wajib dan keterangan opsional.",
      "Jenis kegiatan dipilih mendatar, menyesuaikan lebar layar.",
      "Laporan per peserta bisa dibagikan lewat tautan publik.",
    ],
  },
];

export const LATEST_CHANGELOG = CHANGELOG[0];

export function formatChangelogDate(iso) {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Tanggal ringkas "23 Nov 2026" (WITA). */
export function formatChangelogDateShort(iso) {
  try {
    return new Date(`${iso}T00:00:00+08:00`).toLocaleDateString("id-ID", {
      timeZone: "Asia/Makassar", day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Jenis entri: "fitur" atau "perbaikan" (entri lama ditebak dari judul). */
export function jenisEntri(u) {
  if (u?.jenis === "fitur" || u?.jenis === "perbaikan") return u.jenis;
  return /^perbaikan\b/i.test(String(u?.title || "")) ? "perbaikan" : "fitur";
}
