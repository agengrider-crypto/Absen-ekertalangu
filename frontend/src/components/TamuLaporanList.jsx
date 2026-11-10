import { useState } from "react";
import { UserPlus } from "lucide-react";
import { tanggalSingkat, hhmm } from "@/pages/admin/kegiatanUtils";

/** Daftar TAMU (bukan peserta terdaftar) — ditampilkan terpisah pada laporan. */
export default function TamuLaporanList({ rows = [] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden mt-5" data-testid="laporan-tamu">
      <button
        data-testid="laporan-tamu-toggle"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F6F4EE]"
      >
        <span className="flex items-center gap-2 font-bold text-[#14201A]">
          <UserPlus size={17} className="text-[#5F6B63]" /> Daftar Tamu (bukan peserta terdaftar)
          <span className="text-xs font-medium text-[#5F6B63]">({rows.length})</span>
        </span>
        <span className="text-sm font-semibold text-[#0E4E31]">{open ? "Tutup" : "Lihat"}</span>
      </button>
      {open && (
        <div className="border-t border-[#E7E3D8] overflow-x-auto max-h-[52vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-[#FBF1D6] text-[#8A5A00] text-left text-[11px] uppercase tracking-wide">
                <th className="px-4 py-2.5 font-bold">Tanggal</th>
                <th className="px-4 py-2.5 font-bold">Kegiatan</th>
                <th className="px-4 py-2.5 font-bold">Nama Tamu</th>
                <th className="px-4 py-2.5 font-bold text-right w-24">Jam Hadir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7E3D8]">
              {rows.map((g, i) => (
                <tr key={i} data-testid={`laporan-tamu-row-${i}`}>
                  <td className="px-4 py-2.5 text-[#5F6B63] whitespace-nowrap">{g.date ? tanggalSingkat(g.date) : "-"}</td>
                  <td className="px-4 py-2.5 text-[#14201A]">{g.kegiatan || "-"}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[#14201A]">{g.name}</div>
                    <div className="text-[11px] font-semibold text-[#8A5A00]">Tamu</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-[#5F6B63]">
                    {g.arrival_time ? hhmm(g.arrival_time) : "-"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-[#5F6B63]">Belum ada tamu pada periode ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
