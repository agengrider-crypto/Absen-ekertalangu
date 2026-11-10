/**
 * DESIGN TOKEN — E-KERTALANGU
 * Sumber tunggal warna aplikasi. Ubah di sini, seluruh UI ikut berubah.
 *
 * Standar:
 *   Primary  : Biru
 *   Success  : Hijau   (Hadir / Aktif)
 *   Info     : Cyan
 *   Warning  : Amber   (Izin / Belum Aktivasi)
 *   Sakit    : Biru muda
 *   Danger   : Merah   (Alpha / Error / Hapus)
 *   Netral   : Abu-abu (Peserta / Nonaktif / Selesai)
 *
 * Catatan QR/Barcode: pola QR SELALU hitam di atas putih (lihat QR_FOREGROUND /
 * QR_BACKGROUND). Warna tema hanya untuk elemen UI di sekitarnya.
 */

export const COLORS = {
  primary: {
    50: "#EFF6FF",
    100: "#DBEAFE",
    200: "#BFDBFE",
    500: "#3B82F6",
    600: "#2563EB",
    700: "#1D4ED8",
    800: "#1E40AF",
  },
  success: {
    50: "#F0FDF4",
    100: "#DCFCE7",
    200: "#BBF7D0",
    500: "#22C55E",
    600: "#16A34A",
    700: "#15803D",
    800: "#166534",
  },
  info: {
    50: "#ECFEFF",
    100: "#CFFAFE",
    200: "#A5F3FC",
    500: "#06B6D4",
    600: "#0891B2",
    700: "#0E7490",
    800: "#155E75",
  },
  warning: {
    50: "#FFFBEB",
    100: "#FEF3C7",
    200: "#FDE68A",
    500: "#F59E0B",
    600: "#D97706",
    700: "#B45309",
    800: "#92400E",
  },
  danger: {
    50: "#FEF2F2",
    100: "#FEE2E2",
    200: "#FECACA",
    500: "#EF4444",
    600: "#DC2626",
    700: "#B91C1C",
    800: "#991B1B",
  },
  neutral: {
    0: "#FFFFFF",
    25: "#FAFAF8",
    50: "#F7F7F5",
    100: "#F3F4F6",
    150: "#F1F1EE",
    200: "#E8E8E4",
    250: "#ECECE8",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#111827",
    950: "#111114",
  },
};

/** Warna QR/Barcode — selalu hitam di atas putih. */
export const QR_FOREGROUND = "#000000";
export const QR_BACKGROUND = "#FFFFFF";

/** Peran pengguna. */
export const ROLE_COLORS = {
  admin: { bg: COLORS.primary[100], text: COLORS.primary[700], label: "Adminator" },
  pengurus: { bg: COLORS.info[100], text: COLORS.info[700], label: "Pengurus" },
  peserta: { bg: COLORS.neutral[150], text: COLORS.neutral[700], label: "Peserta" },
  guru: { bg: COLORS.info[50], text: COLORS.info[800], label: "Guru / Pengajar" },
};

/** Status kehadiran. */
export const ATTENDANCE_COLORS = {
  hadir: { bg: COLORS.success[100], text: COLORS.success[800], solid: COLORS.success[600], label: "Hadir" },
  izin: { bg: COLORS.warning[100], text: COLORS.warning[800], solid: COLORS.warning[600], label: "Izin" },
  sakit: { bg: COLORS.primary[100], text: COLORS.primary[700], solid: COLORS.primary[600], label: "Sakit" },
  alpha: { bg: COLORS.danger[100], text: COLORS.danger[800], solid: COLORS.danger[600], label: "Alpha" },
  belum_diabsen: { bg: COLORS.neutral[100], text: COLORS.neutral[500], solid: COLORS.neutral[400], label: "Belum diabsen" },
};

/** Status akun. */
export const ACCOUNT_COLORS = {
  active: { bg: COLORS.success[100], text: COLORS.success[800], label: "Aktif" },
  pending: { bg: COLORS.warning[100], text: COLORS.warning[800], label: "Belum Aktivasi" },
  nonaktif: { bg: COLORS.neutral[100], text: COLORS.neutral[600], label: "Nonaktif" },
  incomplete: { bg: COLORS.warning[50], text: COLORS.warning[800], label: "Perlu Dilengkapi" },
};

/** Status kegiatan. */
export const ACTIVITY_COLORS = {
  open: { bg: COLORS.success[100], text: COLORS.success[800], label: "Terbuka" },
  closed: { bg: COLORS.neutral[100], text: COLORS.neutral[600], label: "Selesai" },
  akan_datang: { bg: COLORS.primary[100], text: COLORS.primary[700], label: "Akan Datang" },
  berlangsung: { bg: COLORS.info[100], text: COLORS.info[800], label: "Berlangsung" },
};

/** Kelas Tailwind siap pakai (dipakai di JSX). */
export const UI = {
  bgApp: "bg-[#FAFAF8]",
  bgCard: "bg-white",
  border: "border-[#E8E8E4]",
  borderSoft: "border-[#ECECE8]",
  textPrimary: "text-[#111827]",
  textSecondary: "text-[#6B7280]",
  textMuted: "text-[#9CA3AF]",
  primaryBtn: "bg-[#2563EB] text-white hover:bg-[#1D4ED8]",
  primarySoft: "bg-[#EFF6FF] text-[#1D4ED8]",
  successBtn: "bg-[#16A34A] text-white hover:bg-[#15803D]",
  dangerBtn: "bg-[#DC2626] text-white hover:bg-[#B91C1C]",
  neutralBtn: "bg-[#F1F1EE] text-[#374151] hover:bg-[#E8E8E4]",
};
