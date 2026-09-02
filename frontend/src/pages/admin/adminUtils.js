// Shared helpers & constants for the Admin area (Fase 2)

export const EDUCATION_OPTIONS = ["TK", "SD", "SMP", "SMA", "D1", "D2", "D3", "D4", "S1", "S2", "S3"];
export const MUBALIGH_OPTIONS = ["belum", "sudah"];

export const GREEN = "#0D5C3A";
export const GREEN_DARK = "#094229";

export function formatTanggal(iso) {
  if (!iso) return "-";
  const parts = String(iso).slice(0, 10).split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  return `${d}-${m}-${y}`;
}

export function formatDateTime(iso) {
  if (!iso) return "-";
  try {
    const dt = new Date(iso);
    return dt.toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function genderLabel(g) {
  if (g === "L") return "Laki-laki";
  if (g === "P") return "Perempuan";
  return "-";
}

export function mubalighLabel(m) {
  if (m === "sudah") return "Sudah";
  if (m === "belum") return "Belum";
  return "-";
}

export function statusBadge(status, needsCompletion) {
  if (status === "pending") return { label: "Menunggu Aktivasi", cls: "bg-[#FEF3C7] text-[#92400E]" };
  if (status === "nonaktif") return { label: "Nonaktif", cls: "bg-[#FEE2E2] text-[#991B1B]" };
  if (needsCompletion) return { label: "Perlu Dilengkapi", cls: "bg-[#FEF3C7] text-[#92400E]" };
  return { label: "Aktif", cls: "bg-[#E8F5EE] text-[#065F46]" };
}

export const ACTION_LABELS = {
  login: "Login",
  aktivasi_akun: "Aktivasi Akun",
  buat_akun: "Buat Akun",
  hapus_akun: "Hapus Akun",
  ubah_peserta: "Ubah Data",
  reset_sandi: "Reset Sandi",
  pindah_sambung: "Pindah Sambung",
  tambah_bulk: "Tambah Massal",
  hapus_massal: "Hapus Massal",
  impor_peserta: "Impor Peserta",
  buat_kelompok: "Buat Kelompok",
  hapus_kelompok: "Hapus Kelompok",
  selesai_kegiatan: "Selesaikan Kegiatan",
};

export function todayIndo() {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
