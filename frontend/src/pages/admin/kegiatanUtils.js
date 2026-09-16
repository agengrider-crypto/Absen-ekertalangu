// Helpers khusus modul Kegiatan (Fase 2 Tahap B, diperluas Fase 8)

export const KEGIATAN_TYPES = [
  { value: "rutin", label: "Pengajian Rutin" },
  { value: "khusus", label: "Pengajian Khusus" },
  { value: "asad", label: "Asad" },
];

export const TYPE_LABEL = {
  rutin: "Pengajian Rutin",
  khusus: "Pengajian Khusus",
  asad: "Asad",
};

export const TYPE_COLOR = {
  rutin: "#0D5C3A",
  khusus: "#0284C7",
  asad: "#D97706",
};

/* ------------------------- FASE 8 ------------------------- */

// Tipe peserta kegiatan
export const AUDIENCE_OPTIONS = [
  {
    value: "reguler",
    label: "Reguler (hanya akun yang sudah aktivasi)",
    short: "Reguler",
    desc: "Hanya jamaah yang akunnya sudah diaktivasi yang masuk daftar absen.",
  },
  {
    value: "publik",
    label: "Terbuka / Publik (termasuk yang belum aktivasi & tamu)",
    short: "Terbuka / Publik",
    desc: "Semua jamaah masuk daftar absen, dan petugas boleh menambah tamu cukup dengan nama.",
  },
];

export const AUDIENCE_LABEL = {
  reguler: "Reguler",
  publik: "Terbuka / Publik",
};

// Penyaringan peserta berdasarkan jenis kelamin
export const GENDER_FILTER_OPTIONS = [
  { value: "semua", label: "Semua jamaah (laki-laki & perempuan)", short: "Semua Jamaah" },
  { value: "L", label: "Khusus laki-laki", short: "Khusus Laki-laki" },
  { value: "P", label: "Khusus perempuan", short: "Khusus Perempuan" },
];

export const GENDER_FILTER_LABEL = {
  semua: "Semua Jamaah",
  L: "Khusus Laki-laki",
  P: "Khusus Perempuan",
};

/* ------------------------- FASE 9 -------------------------
 * Pengelompokan Lanjutan (status pernikahan + kelompok usia) & sesi kegiatan.
 */

export const MARITAL_FILTER_OPTIONS = [
  { value: "semua", label: "Semua status pernikahan", short: "Semua" },
  { value: "belum_menikah", label: "Khusus belum menikah", short: "Belum Menikah" },
  { value: "sudah_menikah", label: "Khusus sudah menikah", short: "Sudah Menikah" },
];

export const MARITAL_FILTER_LABEL = {
  semua: "Semua Status",
  belum_menikah: "Khusus Belum Menikah",
  sudah_menikah: "Khusus Sudah Menikah",
};

// Kelompok usia otomatis dihitung dari tanggal lahir peserta.
export const AGE_GROUP_OPTIONS = [
  { value: "anak", label: "Anak-anak", range: "0–12 th" },
  { value: "remaja", label: "Remaja", range: "13–19 th" },
  { value: "muda", label: "Usia Muda", range: "20–35 th" },
  { value: "dewasa", label: "Dewasa", range: "36–55 th" },
  { value: "lansia", label: "Lansia", range: "56 th +" },
];

export const AGE_GROUP_LABEL = AGE_GROUP_OPTIONS.reduce(
  (acc, g) => ({ ...acc, [g.value]: g.label }), {},
);

// Pilihan cepat nama sesi (boleh diubah manual)
export const SESSION_LABEL_PRESETS = ["Pagi", "Siang", "Sore", "Malam"];

export const SESSION_DEFAULT_TIME = {
  Pagi: ["08:00", "10:00"],
  Siang: ["13:00", "14:30"],
  Sore: ["16:00", "17:30"],
  Malam: ["20:00", "21:30"],
};

/** Gabungkan kegiatan 1 hari beberapa sesi menjadi 1 kartu. */
export function groupSessions(items) {
  const out = [];
  const idx = {};
  (items || []).forEach((k) => {
    const gid = k.session_group_id;
    if (!gid || (k.session_total || 1) <= 1) {
      out.push({ key: `single-${k.id}`, single: true, k, items: [k] });
      return;
    }
    if (idx[gid] === undefined) {
      idx[gid] = out.length;
      out.push({ key: `grp-${gid}`, single: false, k, items: [k] });
    } else {
      out[idx[gid]].items.push(k);
    }
  });
  out.forEach((g) => {
    if (!g.single) {
      g.items.sort((a, b) => (a.session_index ?? 0) - (b.session_index ?? 0));
    }
  });
  return out;
}

// Fase waktu kegiatan → dipakai untuk urutan daftar
export const PHASE_META = {
  akan_datang: { label: "Akan Datang", badge: "Akan Datang", cls: "bg-[#E0F2FE] text-[#075985]" },
  berlangsung: { label: "Berlangsung", badge: "Berlangsung", cls: "bg-[#E8F5EE] text-[#065F46]" },
  selesai: { label: "Selesai", badge: "Selesai", cls: "bg-[#F3F4F6] text-[#4B5563]" },
};

export function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** Hitung fase kegiatan bila server tidak mengirimkannya. */
export function phaseOf(k) {
  if (k?.phase) return k.phase;
  if ((k?.status || "open") !== "open") return "selesai";
  const today = todayYmd();
  if ((k?.date || today) > today) return "akan_datang";
  return "berlangsung";
}

/**
 * FASE 8 — Urutan daftar kegiatan sesuai permintaan:
 *   1. AKAN DATANG  (paling atas, tanggal terdekat dulu)
 *   2. BERLANGSUNG  (hari ini / masih terbuka)
 *   3. SELESAI      (paling bawah, terbaru dulu)
 */
export function groupKegiatan(items) {
  const akan = [];
  const kini = [];
  const selesai = [];
  (items || []).forEach((k) => {
    const p = phaseOf(k);
    if (p === "akan_datang") akan.push(k);
    else if (p === "selesai") selesai.push(k);
    else kini.push(k);
  });
  const byDateAsc = (a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`);
  const byDateDesc = (a, b) => `${b.date}${b.start_time}`.localeCompare(`${a.date}${a.start_time}`);
  akan.sort(byDateAsc);
  kini.sort(byDateAsc);
  selesai.sort(byDateDesc);
  return [
    { key: "akan_datang", ...PHASE_META.akan_datang, items: akan },
    { key: "berlangsung", ...PHASE_META.berlangsung, items: kini },
    { key: "selesai", ...PHASE_META.selesai, items: selesai },
  ];
}

// Opsi waktu WITA interval 10 menit: "00:00" .. "23:50"
export function timeOptions() {
  const out = [];
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += 10) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}

// Ambil HH:MM dari ISO WITA (mis "2026-09-03T21:05:00+08:00")
export function hhmm(iso) {
  if (!iso) return "-";
  const s = String(iso);
  const t = s.indexOf("T");
  if (t >= 0 && s.length >= t + 6) return s.slice(t + 1, t + 6);
  return s;
}

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function tanggalPanjang(ymd) {
  if (!ymd) return "-";
  const p = String(ymd).slice(0, 10).split("-");
  if (p.length !== 3) return ymd;
  const [y, m, d] = p.map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  return `${HARI[dt.getDay()]}, ${d} ${BULAN[m - 1]} ${y}`;
}

export function tanggalSingkat(ymd) {
  if (!ymd) return "-";
  const p = String(ymd).slice(0, 10).split("-");
  if (p.length !== 3) return ymd;
  const [y, m, d] = p.map((x) => parseInt(x, 10));
  return `${d} ${BULAN[m - 1].slice(0, 3)} ${y}`;
}

export const MONTH_SHORT = BULAN.map((b) => b.slice(0, 3));
