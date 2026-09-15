import { useState } from "react";
import { UserPlus } from "lucide-react";
import { tanggalSingkat, hhmm } from "@/pages/admin/kegiatanUtils";

/** Daftar TAMU (bukan jamaah terdaftar) — ditampilkan terpisah pada laporan. */
export default function TamuLaporanList({ rows = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden mt-5" data-testid="laporan-tamu">
      <button
        data-testid="laporan-tamu-toggle"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#FAFBF9]"
      >
        <span className="flex items-center gap-2 font-bold text-[#111827]">
          <UserPlus size={17} className="text-[#D97706]" /> Daftar Tamu (bukan jamaah terdaftar)
          <span className="text-xs font-medium text-[#6B7280]">({rows.length})</span>
        </span>
        <span className="text-sm font-semibold text-[#0D5C3A]">{open ? "Tutup" : "Lihat"}</span>
      </button>
      {open && (
        <div className="border-t border-[#E5E7EB] overflow-x-auto max-h-[52vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-[#FEF7EC] text-[#9A6412] text-left text-[11px] uppercase tracking-wide">
                <th className="px-4 py-2.5 font-bold">Tanggal</th>
                <th className="px-4 py-2.5 font-bold">Kegiatan</th>
                <th className="px-4 py-2.5 font-bold">Nama Tamu</th>
                <th className="px-4 py-2.5 font-bold text-right w-24">Jam Hadir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F2F0]">
              {rows.map((g, i) => (
                <tr key={i} data-testid={`laporan-tamu-row-${i}`}>
                  <td className="px-4 py-2.5 text-[#4B5563] whitespace-nowrap">{g.date ? tanggalSingkat(g.date) : "-"}</td>
                  <td className="px-4 py-2.5 text-[#111827]">{g.kegiatan || "-"}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[#111827]">{g.name}</div>
                    <div className="text-[11px] font-semibold text-[#B45309]">Tamu</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#4B5563]">
                    {g.arrival_time ? hhmm(g.arrival_time) : "-"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-[#9CA3AF]">Belum ada tamu pada periode ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
