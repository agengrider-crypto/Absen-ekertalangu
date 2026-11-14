/**
 * DESIGN TOKEN — E-KERTALANGU
 * Sumber tunggal warna aplikasi. Ubah di sini, seluruh UI ikut berubah.
 *
 * Penamaan sengaja TIDAK memakai nama umum untuk status. Gunakan:
 * status-hadir, status-izin, status-sakit, status-alpa, status-akan,
 * status-terlaksana, status-selesai, aksi-hapus, pesan-gagal.
 *
 * Catatan QR/Barcode: pola QR SELALU hitam di atas putih (lihat QR_FOREGROUND /
 * QR_BACKGROUND). Warna tema hanya untuk elemen UI di sekitarnya.
 */

/** Warna dasar. */
export const BASE = {
  brand: "#14633F",
  brandDark: "#0E4E31",
  mint: "#E3F3EA",
  paper: "#F6F4EE",
  surface: "#FFFFFF",
  line: "#E7E3D8",
  tile: "#F0EEE6",
  ink: "#14201A",
  muted: "#5F6B63",
  fieldLine: "#8A948D",
  handle: "#D9D4C5",
  overlay: "rgba(20,32,26,0.5)",
};

/** Status: latar muda + teks tua; `solid` untuk blok/tombol penuh. */
export const STATUS = {
  hadir: { bg: "#E3F3EA", text: "#0E4E31", solid: "#14633F", label: "Hadir" },
  izin: { bg: "#FBF1D6", text: "#6B4500", solid: "#8A5A00", border: "#EAD596", label: "Izin" },
  sakit: { bg: "#E3EEFB", text: "#1D4F91", solid: "#1D4F91", label: "Sakit" },
  alpa: { bg: "#FBE5E3", text: "#A32A2A", solid: "#A32A2A", label: "Alpa" },
  akan: { bg: "#E3EEFB", text: "#1D4F91", solid: "#1D4F91", label: "Akan datang" },
  terlaksana: { bg: "#E3F3EA", text: "#0E4E31", solid: "#14633F", label: "Terlaksana" },
  selesai: { bg: "#E7E3D8", text: "#4A5650", solid: "#4A5650", label: "Selesai" },
  khususPerempuan: { bg: "#FBE3EC", text: "#8A1F4B", label: "Khusus Perempuan" },
};

/** Jenis kegiatan — hanya chip dan titik kecil. */
export const JENIS = {
  rutin: { bg: "#D9F2F4", text: "#0A5961", dot: "#0F7C86", label: "Pengajian Rutin" },
  khusus: { bg: "#ECE4FB", text: "#4C2A9B", dot: "#6D3FC8", label: "Pengajian Khusus" },
  lain: { bg: "#FFE8DB", text: "#8F3008", dot: "#C2410C", label: "Jenis lain" },
};

/** Area — HANYA dipakai di sheet Ganti Peran. */
export const AREA = {
  admin: { utama: "#14633F", muda: "#E3F3EA", aktif: "#E3F3EA", teks: "#0E4E31", label: "Administrator" },
  guru: { utama: "#0A5961", muda: "#D9F2F4", aktif: "#D9F2F4", teks: "#0A5961", label: "Guru / Pengajar" },
  pengurus: { utama: "#1D4F91", muda: "#E3EEFB", aktif: "#E3EEFB", teks: "#1D4F91", label: "Pengurus" },
  peserta: { utama: "#4A5650", muda: "#E7E3D8", aktif: "#F0EEE6", teks: "#3A4540", label: "Peserta" },
};

/** Warna khusus blok (bukan teks) — hanya untuk blok/batang yang memuat angka. */
export const BLOCK = {
  izinStrip: "#B7791F",
  alpaStrip: "#C0392B",
  rataSemua: "#9AA59E",
  riwayatBatang: "#C9D8CF",
  barisNonaktif: "#FAF9F5",
  pesanSiapKirim: "#E9F5EE",
};

/** Aksi & pesan. */
export const ACTION = {
  hapus: "#A32A2A",
  gagal: "#A32A2A",
};

/** Toast. */
export const TOAST = {
  bg: "#14201A",
  text: "#FFFFFF",
  sukses: "#6FD39B",
  info: "#8CB8F0",
  peringatan: "#F2C14E",
  gagal: "#FF9B92",
};

/** Pemindai QR. */
export const SCANNER = {
  bg: "#0B1410",
  frame: "#6FD39B",
  success: "#14633F",
};

/** Warna QR/Barcode — selalu hitam di atas putih. */
export const QR_FOREGROUND = "#000000";
export const QR_BACKGROUND = "#FFFFFF";

/** Fokus keyboard. */
export const FOCUS_RING = { color: "#1D4F91", width: 3, offset: 2 };

/** Peran pengguna (badge). */
export const ROLE_COLORS = {
  admin: { bg: AREA.admin.muda, text: AREA.admin.teks, label: "Administrator" },
  pengurus: { bg: AREA.pengurus.muda, text: AREA.pengurus.teks, label: "Pengurus" },
  peserta: { bg: AREA.peserta.muda, text: AREA.peserta.teks, label: "Peserta" },
  guru: { bg: JENIS.rutin.bg, text: JENIS.rutin.text, label: "Guru / Pengajar" },
};

/** Status kehadiran. */
export const ATTENDANCE_COLORS = {
  hadir: { bg: STATUS.hadir.bg, text: STATUS.hadir.text, solid: STATUS.hadir.solid, label: "Hadir" },
  izin: { bg: STATUS.izin.bg, text: STATUS.izin.text, solid: STATUS.izin.solid, label: "Izin" },
  sakit: { bg: STATUS.sakit.bg, text: STATUS.sakit.text, solid: STATUS.sakit.solid, label: "Sakit" },
  alpha: { bg: STATUS.alpa.bg, text: STATUS.alpa.text, solid: STATUS.alpa.solid, label: "Alpa" },
  belum_diabsen: { bg: BASE.tile, text: BASE.muted, solid: BASE.fieldLine, label: "Belum diabsen" },
};

/** Status akun. */
export const ACCOUNT_COLORS = {
  active: { bg: STATUS.hadir.bg, text: STATUS.hadir.text, label: "Aktif" },
  pending: { bg: STATUS.izin.bg, text: STATUS.izin.text, label: "Belum Aktivasi" },
  nonaktif: { bg: STATUS.selesai.bg, text: STATUS.selesai.text, label: "Nonaktif" },
  incomplete: { bg: STATUS.izin.bg, text: STATUS.izin.text, label: "Perlu Dilengkapi" },
};

/** Status kegiatan. */
export const ACTIVITY_COLORS = {
  open: { bg: STATUS.terlaksana.bg, text: STATUS.terlaksana.text, label: "Terbuka" },
  closed: { bg: STATUS.selesai.bg, text: STATUS.selesai.text, label: "Selesai" },
  akan_datang: { bg: STATUS.akan.bg, text: STATUS.akan.text, label: "Akan Datang" },
  berlangsung: { bg: STATUS.terlaksana.bg, text: STATUS.terlaksana.text, label: "Berlangsung" },
};

/** Kelas Tailwind siap pakai (dipakai di JSX). */
export const UI = {
  bgApp: "bg-paper",
  bgCard: "bg-surface",
  border: "border-line",
  borderSoft: "border-line",
  textPrimary: "text-ink",
  textSecondary: "text-mutedink",
  textMuted: "text-fieldline",
  primaryBtn: "bg-brand text-white hover:bg-brand-dark",
  primarySoft: "bg-mint text-brand-dark",
  successBtn: "bg-brand text-white hover:bg-brand-dark",
  hapusBtn: "bg-white border-[1.5px] border-alpa text-alpa hover:bg-alpa-soft",
  neutralBtn: "bg-tile text-ink hover:bg-line",
};

/** Alias lama agar impor yang sudah ada tetap jalan. */
export const COLORS = {
  primary: { 50: "#E3F3EA", 100: "#E3F3EA", 200: "#C9D8CF", 500: "#14633F", 600: "#14633F", 700: "#0E4E31", 800: "#0E4E31" },
  success: { 50: "#E3F3EA", 100: "#E3F3EA", 200: "#C9D8CF", 500: "#14633F", 600: "#14633F", 700: "#0E4E31", 800: "#0E4E31" },
  info: { 50: "#E3EEFB", 100: "#E3EEFB", 200: "#C9D8CF", 500: "#1D4F91", 600: "#1D4F91", 700: "#1D4F91", 800: "#1D4F91" },
  warning: { 50: "#FBF1D6", 100: "#FBF1D6", 200: "#EAD596", 500: "#8A5A00", 600: "#8A5A00", 700: "#6B4500", 800: "#6B4500" },
  alpa: { 50: "#FBE5E3", 100: "#FBE5E3", 200: "#FBE5E3", 500: "#A32A2A", 600: "#A32A2A", 700: "#A32A2A", 800: "#A32A2A" },
  neutral: {
    0: "#FFFFFF", 25: "#FAF9F5", 50: "#F6F4EE", 100: "#F0EEE6", 150: "#F0EEE6",
    200: "#E7E3D8", 250: "#E7E3D8", 300: "#D9D4C5", 400: "#8A948D", 500: "#5F6B63",
    600: "#4A5650", 700: "#3A4540", 800: "#14201A", 900: "#14201A", 950: "#14201A",
  },
};
