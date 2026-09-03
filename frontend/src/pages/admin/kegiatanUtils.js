// Helpers khusus modul Kegiatan (Fase 2 Tahap B)

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
