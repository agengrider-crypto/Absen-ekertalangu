import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Clock, MapPin, User, Loader2, Layers } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { TYPE_LABEL, tanggalPanjang, hhmm } from "./admin/kegiatanUtils";

const ST = {
  hadir: { t: "H", cls: "bg-[#2563EB] text-white", title: "Hadir" },
  izin: { t: "I", cls: "bg-[#9CA3AF] text-white", title: "Izin" },
  sakit: { t: "S", cls: "bg-[#DBEAFE] text-[#1D4ED8]", title: "Sakit" },
  alpha: { t: "A", cls: "bg-[#FEE2E2] text-[#991B1B]", title: "Alpha" },
  belum_diabsen: { t: "—", cls: "bg-[#FEF3C7] text-[#92400E]", title: "Belum diabsen" },
  exempt: { t: "✓", cls: "bg-[#F3F4F6] text-[#9CA3AF]", title: "Sudah hadir di sesi sebelumnya — tidak dihitung" },
  optional: { t: "·", cls: "bg-[#ECFEFF] text-[#6366F1]", title: "Sesi opsional — tidak wajib, tidak dihitung" },
};

// Rekap tetap berwarna: bar hijau sebagai warna dasar kehadiran.
export function PercentBar({ label, value, sub, color = "#15803D", testid }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div data-testid={testid}>
      <div className="flex items-end justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold text-[#4B5563]">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{v}%{sub ? <span className="ml-1 text-[11px] font-medium text-[#9CA3AF]">{sub}</span> : null}</span>
      </div>
      <div className="h-2.5 rounded-full bg-[#EDF1ED] overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${v}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function PublicRekapGabungan() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get(`/rekap-gabungan/${token}`)
      .then(({ data: d }) => setData(d))
      .catch((e) => {
        if (e.response?.status === 410) setErr("Tautan rekap per sesi sudah kedaluwarsa (berlaku 7 hari).");
        else setErr("Tautan rekap per sesi tidak ditemukan.");
      });
  }, [token]);

  if (err) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-4 text-center">
        <Logo size={48} />
        <p className="text-[#991B1B] font-semibold mt-6" data-testid="rekap-gabungan-public-error">{err}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center"><Loader2 className="animate-spin text-[#1D4ED8]" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-14" data-testid="rekap-gabungan-public">
      <header className="bg-[#2563EB] text-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden p-0.5"><img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" /></div>
          <div className="leading-tight">
            <div className="font-bold font-heading">E-KERTALANGU</div>
            <div className="text-white/70 text-xs">Rekap Kehadiran per Sesi</div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 -mt-3">
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8]">{TYPE_LABEL[data.type] || data.type}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] inline-flex items-center gap-1"><Layers size={12} /> {data.sessions.length} Sesi</span>
            {(data.filter_labels || []).map((l) => <span key={l} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#B91C1C]">{l}</span>)}
          </div>
          <h1 className="font-heading text-xl font-bold text-[#111827] mt-2">{data.base_name}</h1>
          <div className="text-sm text-[#6B7280] mt-2 space-y-1">
            <div className="flex items-center gap-2"><CalendarDays size={15} /> {tanggalPanjang(data.date)}</div>
            {data.location && <div className="flex items-center gap-2"><MapPin size={15} /> {data.location}</div>}
            {data.teacher && <div className="flex items-center gap-2"><User size={15} /> {data.teacher}</div>}
          </div>
        </div>

        {/* Rekap dipisahkan per sesi */}
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5 mt-4 space-y-4" data-testid="gabungan-public-sesi">
          <div className="font-semibold text-[#111827] text-sm">Kehadiran per Sesi</div>
          {data.sessions.map((x) => (
            <div key={x.id}>
              <PercentBar
                label={`${x.label} · ${x.start_time}–${x.end_time} WITA${x.required === false ? " · Opsional" : ""}`}
                value={x.counts.ratio}
                sub={`${x.counts.hadir}/${x.counts.total}`}
                testid={`bar-sesi-${x.id}`}
              />
              <div className="text-[11px] text-[#9CA3AF] mt-1 flex flex-wrap gap-x-3">
                <span>Hadir {x.counts.hadir}</span><span>Izin {x.counts.izin}</span>
                <span>Sakit {x.counts.sakit || 0}</span><span>Alpha {x.counts.alpha}</span>
                <span>Belum diabsen {x.counts.belum_diabsen || 0}</span>
                {x.counts.sudah_sesi_lain > 0 && <span>Sudah hadir sesi lain {x.counts.sudah_sesi_lain}</span>}
                {x.teacher && <span className="inline-flex items-center gap-1"><User size={11} /> {x.teacher}</span>}
                {x.location && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {x.location}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Tabel peserta × sesi */}
        <div className="bg-white rounded-2xl border border-[#E8E8E4] mt-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E8E8E4] font-semibold text-sm text-[#111827] flex items-center gap-2"><Clock size={15} className="text-[#1D4ED8]" /> Daftar Peserta per Sesi</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="gabungan-public-table">
              <thead className="bg-[#FAFAF8] text-[#6B7280] text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Nama</th>
                  {data.sessions.map((x) => <th key={x.id} className="px-2 py-2 font-semibold text-center whitespace-nowrap">{x.label}{x.required === false ? <span className="block text-[9px] font-bold text-[#6366F1]">opsional</span> : null}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECECE8]">
                {data.rows.map((r) => (
                  <tr key={r.user_id}>
                    <td className="px-3 py-2 font-semibold text-[#111827]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{r.name}</span>
                      </div>
                    </td>
                    {r.sessions.map((c, i) => (
                      <td key={i} className="px-2 py-2 text-center">
                        {c === null ? <span className="text-[#D1D5DB]">—</span> : (
                          <span title={ST[c.status]?.title} className={`inline-flex flex-col items-center justify-center min-w-[30px] h-7 px-1.5 rounded-lg text-[11px] font-bold ${ST[c.status]?.cls || ""}`}>
                            {ST[c.status]?.t}
                            {c.status === "hadir" && c.arrival_time && <span className="text-[9px] font-medium leading-none">{hhmm(c.arrival_time)}</span>}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-xs text-[#9CA3AF] mt-6">© 2026 E-KERTALANGU · Absensi Pengajian</p>
      </main>
    </div>
  );
}
