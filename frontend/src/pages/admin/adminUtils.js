// Shared helpers & constants for the Admin area (Fase 2)

export const EDUCATION_OPTIONS = ["TK", "SD", "SMP", "SMA", "D1", "D2", "D3", "D4", "S1", "S2", "S3"];
export const MUBALIGH_OPTIONS = ["belum", "sudah"];
// Status pernikahan peserta
export const MARITAL_OPTIONS = [
  { value: "belum_menikah", label: "Belum Menikah" },
  { value: "sudah_menikah", label: "Sudah Menikah" },
];
export function maritalLabel(v) {
  return MARITAL_OPTIONS.find((o) => o.value === v)?.label || "-";
}

/**
 * Kategori peserta untuk kartu nama (absensi hanya muda-mudi & orang tua).
 * Generus/Caberawit tidak dihitung, jadi umur tidak dipakai.
 * Status pernikahan / jenis kelamin kosong → tanpa kategori (jangan menebak).
 */
export function golonganPeserta(peserta) {
  const marital = peserta?.marital;
  if (!marital) return "";
  if (marital === "belum_menikah") return "Muda-mudi";
  if (marital !== "sudah_menikah") return "";
  const gender = peserta?.gender;
  if (gender === "L") return "Bapak-bapak";
  if (gender === "P") return "Ibu-ibu";
  return "";
}

// Label jenjang peserta (id sama dengan Program Pembelajaran).
export const JENJANG_LABEL = {
  paud: "PAUD",
  cabe1: "Cabe Rawit 1", cabe2: "Cabe Rawit 2", cabe3: "Cabe Rawit 3",
  cabe4: "Cabe Rawit 4", cabe5: "Cabe Rawit 5", cabe6: "Cabe Rawit 6",
  pra_remaja: "Pra Remaja", remaja: "Remaja",
  pra_nikah1: "Pra Nikah 1", pra_nikah2: "Pra Nikah 2",
  pra_nikah3: "Pra Nikah 3", pra_nikah4: "Pra Nikah 4",
};

export function jenjangLabel(v) {
  return JENJANG_LABEL[v] || "-";
}

/** Umur per 1 Juli tahun ajaran berjalan (Juli–Juni). */
export function umurPerJuli(dob, ref = new Date()) {
  const p = String(dob || "").slice(0, 10).split("-");
  if (p.length !== 3) return null;
  const [y, m, d] = p.map(Number);
  if (!y || !m || !d) return null;
  const startYear = ref.getMonth() + 1 >= 7 ? ref.getFullYear() : ref.getFullYear() - 1;
  const refDate = new Date(startYear, 6, 1);
  const born = new Date(y, m - 1, d);
  let age = refDate.getFullYear() - born.getFullYear();
  if (refDate.getMonth() < born.getMonth()
    || (refDate.getMonth() === born.getMonth() && refDate.getDate() < born.getDate())) {
    age -= 1;
  }
  return age;
}

/** Rentang jenjang generus: PAUD (3) sampai Pra Nikah 4 (22 ke atas). */
export const GENERUS_UMUR_MIN = 3;

/** Generus = jenjang PAUD, Cabe Rawit 1-6, Pra Remaja, Remaja, Pra Nikah 1-4. */
export const GENERUS_JENJANG = [
  "paud", "cabe1", "cabe2", "cabe3", "cabe4", "cabe5", "cabe6",
  "pra_remaja", "remaja", "pra_nikah1", "pra_nikah2", "pra_nikah3", "pra_nikah4",
];

/** Jenjang efektif: jenjang tersimpan, atau saran dari umur per 1 Juli. */
export function jenjangEfektif(user) {
  if (user?.jenjang) return user.jenjang;
  const age = umurPerJuli(user?.dob);
  if (age === null) return null;
  if (age >= 3 && age <= 6) return "paud";
  if (age >= 7 && age <= 12) return `cabe${age - 6}`;
  if (age >= 13 && age <= 15) return "pra_remaja";
  if (age >= 16 && age <= 18) return "remaja";
  if (age >= 19 && age <= 22) return `pra_nikah${age - 18}`;
  if (age >= 23) return "pra_nikah4";
  return null;
}

/** Generus = peserta berjenjang PAUD … Pra Nikah 4. */
export function isGenerus(user) {
  return GENERUS_JENJANG.includes(jenjangEfektif(user));
}

/**
 * Satu sumber kebenaran kategori peserta.
 * Belum menikah = Generus; Sudah/Pernah menikah = Dewasa.
 * Nilai kosong/tidak dikenal = null (jangan diubah).
 */
export function kategoriDariStatus(status) {
  const s = String(status || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!s) return null;
  if (s === "belum_menikah" || s === "belum menikah") return "generus";
  if (s === "sudah_menikah" || s === "sudah menikah"
    || s === "pernah_menikah" || s === "pernah menikah") return "dewasa";
  return null;
}

/** Kategori efektif peserta: dari status pernikahan, atau kategori tersimpan. */
export function kategoriPeserta(user) {
  return kategoriDariStatus(user?.marital) || user?.kategori || null;
}

/** True bila peserta termasuk Generus menurut status pernikahan. */
export function isGenerusKategori(user) {
  return kategoriPeserta(user) === "generus";
}

/**
 * Pesan penolakan Scan Presensi sesuai alasan dari server.
 * Mengembalikan { pesan, nama } atau null bila bukan penolakan scan.
 */
export function pesanPenolakanScan(error) {
  const detail = error?.response?.data?.detail;
  if (detail && typeof detail === "object" && detail.kode) {
    return { pesan: detail.pesan || "Kartu tidak dikenali", nama: detail.nama || null };
  }
  const teks = typeof detail === "string" ? detail : "";
  if (/nonaktif/i.test(teks)) return { pesan: "Peserta nonaktif", nama: null };
  if (/belum dimulai/i.test(teks)) return { pesan: teks, nama: null };
  if (/sudah berakhir|di luar jam/i.test(teks)) return { pesan: teks, nama: null };
  if (/tidak dikenali|kadaluarsa/i.test(teks)) return { pesan: "Kartu tidak dikenali", nama: null };
  if (error?.response?.status === 400) return { pesan: "Kartu tidak dikenali", nama: null };
  return null;
}

/** Tampilkan Jenjang & Nomor WA wali hanya bila berpotensi generus. */
export function potensiGenerus({ dob, marital }) {
  if (marital === "sudah_menikah") return false;
  if (!String(dob || "").trim()) return true;
  const age = umurPerJuli(dob);
  if (age === null) return true;
  return age >= GENERUS_UMUR_MIN;
}

export const GREEN = "#14201A";
export const GREEN_DARK = "#000000";

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
  if (status === "pending") return { label: "Belum Aktivasi", cls: "bg-[#FBF1D6] text-[#6B4500]" };
  if (status === "nonaktif") return { label: "Nonaktif Sementara", cls: "bg-[#F0EEE6] text-[#5F6B63]" };
  if (status === "calon") return { label: "Calon Peserta", cls: "bg-[#E3EEFB] text-[#1D4F91]" };
  if (status === "pindah") return { label: "Pindah", cls: "bg-[#D9F2F4] text-[#1D4F91]" };
  if (needsCompletion) return { label: "Perlu Dilengkapi", cls: "bg-[#FBF1D6] text-[#6B4500]" };
  return { label: "Aktif", cls: "bg-[#E3F3EA] text-[#0E4E31]" };
}

/** Emoji penanda status peserta (🟢 aktif, ⚪ nonaktif sementara, lainnya netral). */
export function statusEmoji(status) {
  if (status === "active") return "🟢";
  if (status === "nonaktif") return "⚪";
  if (status === "calon") return "🔵";
  return "🟡";
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
  buat_kegiatan: "Buat Kegiatan",
  ubah_kegiatan: "Ubah Kegiatan",
  hapus_kegiatan: "Hapus Kegiatan",
  selesaikan_kegiatan: "Selesaikan Kegiatan",
  buka_kegiatan: "Buka Kegiatan",
  selesai_kegiatan: "Selesaikan Kegiatan",
};

export function todayIndo() {
  return new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}
