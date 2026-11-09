// Sumber tunggal data "Update Terbaru" (changelog) aplikasi.
// Dipakai oleh pop-up catatan rilis (ReleaseNotes) dan halaman Tentang Aplikasi.
// Tambahkan entri baru di PALING ATAS setiap rilis.

export const APP_INFO = {
  name: "E-KERTALANGU",
  tagline: "Absensi Pengajian",
  version: "1.8.0",
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
