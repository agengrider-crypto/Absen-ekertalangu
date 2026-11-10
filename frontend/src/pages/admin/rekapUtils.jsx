// FASE 17 — Palet khusus halaman REKAP (tetap berwarna, beda dari tema monokrom aplikasi).
export const REKAP = {
  hadir: "#14633F",
  hadirSoft: "#E3F3EA",
  hadirInk: "#0E4E31",
  izin: "#8A5A00",
  izinSoft: "#FBF1D6",
  izinInk: "#6B4500",
  alpha: "#A32A2A",
  alphaSoft: "#FBE5E3",
  alphaInk: "#A32A2A",
  main: "#0A5961",
  mainSoft: "#D9F2F4",
  mainInk: "#0A5961",
  lk: "#14633F",
  pr: "#8A1F4B",
};

/** Warna persen kehadiran: hijau (rajin) → kuning (cukup) → merah (jarang). */
export function ratioColor(ratio) {
  if (ratio >= 80) return REKAP.hadir;
  if (ratio >= 50) return REKAP.izin;
  return REKAP.alpha;
}

export function ratioChipCls(ratio) {
  if (ratio >= 80) return "bg-[#E3F3EA] text-[#0E4E31]";
  if (ratio >= 50) return "bg-[#FBF1D6] text-[#6B4500]";
  return "bg-[#FBE5E3] text-[#A32A2A]";
}

/** Keterangan hitungan: H/I/A dalam kali + persen masing-masing yang totalnya 100%. */
export function keteranganHitungan({
  hadir = 0, izin = 0, sakit = 0, alpha = 0, belum_diabsen = 0,
  total = 0, satuan = "pertemuan",
}) {
  if (!total) return `Belum ada ${satuan} yang wajib diikuti`;
  const pct = (n) => `${Math.round((n / total) * 1000) / 10}%`;
  return `Hadir ${hadir}× (${pct(hadir)}) + Izin ${izin}× (${pct(izin)}) + Sakit ${sakit}× (${pct(sakit)}) + Alpha ${alpha}× (${pct(alpha)}) + Belum diabsen ${belum_diabsen}× (${pct(belum_diabsen)}) = 100% dari ${total} ${satuan}`;
}

/** Chip persen ringkas (dipakai menggantikan bar batangan di daftar peserta). */
export function PersenRingkas({ value, testid, sub }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <span data-testid={testid} className={`inline-flex items-baseline gap-1 px-2.5 py-1 rounded-full font-bold tabular-nums text-sm ${ratioChipCls(v)}`}>
      {v}%{sub ? <span className="text-[11px] font-semibold opacity-70">{sub}</span> : null}
    </span>
  );
}
