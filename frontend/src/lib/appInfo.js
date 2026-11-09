// Sumber tunggal data "Update Terbaru" (changelog) aplikasi.
// Dipakai oleh pop-up catatan rilis (ReleaseNotes) dan halaman Tentang Aplikasi.
// Tambahkan entri baru di PALING ATAS setiap rilis.

export const APP_INFO = {
  name: "E-KERTALANGU",
  tagline: "Absensi Pengajian",
  version: "1.5.0",
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
