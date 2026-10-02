// FASE 17 — Palet khusus halaman REKAP (tetap berwarna, beda dari tema monokrom aplikasi).
export const REKAP = {
  hadir: "#15803D",
  hadirSoft: "#DCFCE7",
  hadirInk: "#166534",
  izin: "#D97706",
  izinSoft: "#FEF3C7",
  izinInk: "#92400E",
  alpha: "#DC2626",
  alphaSoft: "#FEE2E2",
  alphaInk: "#991B1B",
  main: "#0F766E",
  mainSoft: "#CCFBF1",
  mainInk: "#115E59",
  lk: "#2563EB",
  pr: "#DB2777",
};

/** Warna persen kehadiran: hijau (rajin) → kuning (cukup) → merah (jarang). */
export function ratioColor(ratio) {
  if (ratio >= 80) return REKAP.hadir;
  if (ratio >= 50) return REKAP.izin;
  return REKAP.alpha;
}

export function ratioChipCls(ratio) {
  if (ratio >= 80) return "bg-[#DCFCE7] text-[#166534]";
  if (ratio >= 50) return "bg-[#FEF3C7] text-[#92400E]";
  return "bg-[#FEE2E2] text-[#991B1B]";
}

/** Keterangan hitungan: H/I/A dalam kali + persen masing-masing yang totalnya 100%. */
export function keteranganHitungan({ hadir = 0, izin = 0, alpha = 0, total = 0, satuan = "pertemuan" }) {
  if (!total) return `Belum ada ${satuan} yang wajib diikuti`;
  const pct = (n) => `${Math.round((n / total) * 1000) / 10}%`;
  return `Hadir ${hadir}× (${pct(hadir)}) + Izin ${izin}× (${pct(izin)}) + Alpha ${alpha}× (${pct(alpha)}) = 100% dari ${total} ${satuan}`;
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
