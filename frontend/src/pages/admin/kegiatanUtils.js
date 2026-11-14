// Helpers khusus modul Kegiatan (Fase 2 Tahap B, diperluas Fase 8)

export const KEGIATAN_TYPES = [
  { value: "rutin", label: "Pengajian Rutin" },
  { value: "khusus", label: "Pengajian Khusus" },
  { value: "asad", label: "Asad" },
  { value: "pembelajaran", label: "Pembelajaran" },
];

export const TYPE_LABEL = {
  rutin: "Pengajian Rutin",
  khusus: "Pengajian Khusus",
  asad: "Asad",
  pembelajaran: "Pembelajaran",
};

export const TYPE_COLOR = {
  rutin: "#0A5961",
  khusus: "#4C2A9B",
  asad: "#8F3008",
  pembelajaran: "#14633F",
};

/** Jenis kegiatan → token chip (Layar 29). */
export const JENIS_CHIP = {
  rutin: { bg: "#D9F2F4", text: "#0A5961", dot: "#0F7C86" },
  khusus: { bg: "#ECE4FB", text: "#4C2A9B", dot: "#6D3FC8" },
  lain: { bg: "#FFE8DB", text: "#8F3008", dot: "#C2410C" },
  pembelajaran: { bg: "#E3F3EA", text: "#0E4E31", dot: "#14633F" },
};

// Cadangan bila server mengirim jenis kegiatan yang tidak dikenal / kosong.
export const DEFAULT_TYPE_LABEL = "Kegiatan";
export const DEFAULT_TYPE_COLOR = "#6B7280";

export function typeLabel(type) {
  return TYPE_LABEL[type] || (type ? String(type) : DEFAULT_TYPE_LABEL);
}

export function typeColor(type) {
  return TYPE_COLOR[type] || DEFAULT_TYPE_COLOR;
}

/* ------------------------- FASE 8 ------------------------- */

// Tipe peserta kegiatan
export const AUDIENCE_OPTIONS = [
  {
    value: "reguler",
    label: "Reguler (hanya akun yang sudah aktivasi)",
    short: "Reguler",
    desc: "Hanya peserta yang akunnya sudah diaktivasi yang masuk daftar absen.",
  },
  {
    value: "publik",
    label: "Terbuka / Publik (termasuk yang belum aktivasi & tamu)",
    short: "Terbuka / Publik",
    desc: "Semua peserta masuk daftar absen, dan petugas boleh menambah tamu cukup dengan nama.",
  },
];

export const AUDIENCE_LABEL = {
  reguler: "Reguler",
  publik: "Terbuka / Publik",
};

// Penyaringan peserta berdasarkan jenis kelamin
export const GENDER_FILTER_OPTIONS = [
  { value: "semua", label: "Semua peserta (laki-laki & perempuan)", short: "Semua Peserta" },
  { value: "L", label: "Khusus laki-laki", short: "Khusus Laki-laki" },
  { value: "P", label: "Khusus perempuan", short: "Khusus Perempuan" },
];

export const GENDER_FILTER_LABEL = {
  semua: "Semua Peserta",
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
// Layar 29: kelompok Terlaksana → Akan datang → Selesai.
export const PHASE_META = {
  terlaksana: {
    label: "Terlaksana",
    badge: "Terlaksana",
    cls: "bg-[#E3F3EA] text-[#0E4E31]",
    solid: "#14633F",
    iconColor: "#14633F",
    iconBg: "#E3F3EA",
    icon: "check",
  },
  akan_datang: {
    label: "Akan datang",
    badge: "Akan datang",
    cls: "bg-[#E3EEFB] text-[#1D4F91]",
    solid: "#1D4F91",
    iconColor: "#1D4F91",
    iconBg: "#E3EEFB",
    icon: "clock",
  },
  selesai: {
    label: "Selesai",
    badge: "Selesai",
    cls: "bg-[#E7E3D8] text-[#4A5650]",
    solid: "#4A5650",
    iconColor: "#4A5650",
    iconBg: "#E7E3D8",
    icon: "lock",
  },
  berlangsung: {
    label: "Berlangsung",
    badge: "Berlangsung",
    cls: "bg-[#E3F3EA] text-[#0E4E31]",
    solid: "#14633F",
    iconColor: "#14633F",
    iconBg: "#E3F3EA",
    icon: "check",
  },
  dibatalkan: {
    label: "Dibatalkan",
    badge: "Dibatalkan",
    cls: "bg-[#FBE3E3] text-[#8F1D1D]",
    solid: "#8F1D1D",
    iconColor: "#8F1D1D",
    iconBg: "#FBE3E3",
    icon: "lock",
  },
  ditunda: {
    label: "Ditunda",
    badge: "Ditunda",
    cls: "bg-[#FBF1D6] text-[#6B4500]",
    solid: "#6B4500",
    iconColor: "#6B4500",
    iconBg: "#FBF1D6",
    icon: "clock",
  },
  draft: {
    label: "Draf",
    badge: "Draf",
    cls: "bg-[#ECE4FB] text-[#4C2A9B]",
    solid: "#4C2A9B",
    iconColor: "#4C2A9B",
    iconBg: "#ECE4FB",
    icon: "clock",
  },
};

// Cadangan bila fase tidak dikenal / kosong — jangan sampai layar putih.
export const DEFAULT_PHASE_META = {
  label: "Tidak diketahui",
  badge: "Tidak diketahui",
  cls: "bg-[#F0EEE6] text-[#5F6B63]",
  solid: "#5F6B63",
  iconColor: "#5F6B63",
  iconBg: "#F0EEE6",
  icon: "clock",
};

export function phaseMeta(phase) {
  return PHASE_META[phase] || DEFAULT_PHASE_META;
}

/** Fase kegiatan → kunci kelompok Layar 29 ("terlaksana" | "akan_datang" | "selesai"). */
export function phaseGroup(k) {
  const p = phaseOf(k);
  if (p === "selesai") return "selesai";
  if (p === "akan_datang") return "akan_datang";
  return "terlaksana";
}

/** Jenis kegiatan → token chip (Layar 29). */
export function jenisOf(type) {
  if (type === "rutin") return "rutin";
  if (type === "khusus") return "khusus";
  return "lain";
}

export function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/** Tanggal & jam "sekarang" menurut WITA (Asia/Makassar), bukan zona perangkat. */
export function nowWita() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value || "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` };
}

/** Jam selesai aman: sekarang + 3 jam, dibatasi 23:59 pada hari yang sama. */
export function safeEndTime(startTime) {
  const [h, m] = String(startTime || "00:00").split(":").map(Number);
  const total = Math.min(h * 60 + m + 180, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Hitung fase kegiatan bila server tidak mengirimkannya. */
export function phaseOf(k) {
  const raw = k?.phase;
  if (raw && PHASE_META[raw]) return raw;
  if ((k?.status || "open") !== "open") return "selesai";
  const today = todayYmd();
  if ((k?.date || today) > today) return "akan_datang";
  return "berlangsung";
}

/**
 * Layar 29 — Urutan daftar kegiatan:
 *   1. TERLAKSANA  (sudah lewat / sedang berjalan, terbaru dulu)
 *   2. AKAN DATANG (tanggal terdekat dulu)
 *   3. SELESAI     (paling bawah, terbaru dulu)
 */
export function groupKegiatan(items) {
  const terlaksana = [];
  const akan = [];
  const selesai = [];
  (items || []).forEach((k) => {
    const g = phaseGroup(k);
    if (g === "akan_datang") akan.push(k);
    else if (g === "selesai") selesai.push(k);
    else terlaksana.push(k);
  });
  const byDateAsc = (a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`);
  const byDateDesc = (a, b) => `${b.date}${b.start_time}`.localeCompare(`${a.date}${a.start_time}`);
  akan.sort(byDateAsc);
  terlaksana.sort(byDateDesc);
  selesai.sort(byDateDesc);
  return [
    { key: "terlaksana", ...PHASE_META.terlaksana, items: terlaksana },
    { key: "akan_datang", ...PHASE_META.akan_datang, items: akan },
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
