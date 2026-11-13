import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Clock, MapPin, User, Loader2, Layers } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import ReportHeader from "@/components/ReportHeader";
import StatusGroups from "@/components/StatusGroups";
import { TYPE_LABEL, tanggalPanjang, hhmm } from "./admin/kegiatanUtils";

const ST = {
  hadir: { t: "H", cls: "bg-[#14633F] text-white", title: "Hadir" },
  izin: { t: "I", cls: "bg-[#5F6B63] text-white", title: "Izin" },
  sakit: { t: "S", cls: "bg-[#E3EEFB] text-[#1D4F91]", title: "Sakit" },
  alpha: { t: "A", cls: "bg-[#FBE5E3] text-[#A32A2A]", title: "Alpha" },
  belum_diabsen: { t: "—", cls: "bg-[#FBF1D6] text-[#6B4500]", title: "Belum diabsen" },
  exempt: { t: "✓", cls: "bg-[#F0EEE6] text-[#5F6B63]", title: "Sudah hadir di sesi sebelumnya — tidak dihitung" },
  optional: { t: "·", cls: "bg-[#D9F2F4] text-[#6D3FC8]", title: "Sesi opsional — tidak wajib, tidak dihitung" },
};

// Rekap tetap berwarna: bar hijau sebagai warna dasar kehadiran.
export function PercentBar({ label, value, sub, color = "#14633F", testid }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div data-testid={testid}>
      <div className="flex items-end justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold text-[#5F6B63]">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{v}%{sub ? <span className="ml-1 text-[11px] font-medium text-[#5F6B63]">{sub}</span> : null}</span>
      </div>
      <div className="h-2.5 rounded-full bg-[#F0EEE6] overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${v}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function PublicRekapGabungan() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [sessionIdx, setSessionIdx] = useState(0);
  const [view, setView] = useState("status"); // status | peserta

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
      <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center px-4 text-center">
        <Logo size={48} />
        <p className="text-[#A32A2A] font-semibold mt-6" data-testid="rekap-gabungan-public-error">{err}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-[#F6F4EE] pb-14" data-testid="rekap-gabungan-public">
      <ReportHeader
        title="Rekap Gabungan"
        subtitle={`${tanggalPanjang(data.date)} · ${data.sessions.length} sesi`}
        showUserIcon
        testid="rekap-gabungan-header"
      />

      <main className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E3F3EA] text-[#0E4E31]">{TYPE_LABEL[data.type] || data.type}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FBF1D6] text-[#6B4500] inline-flex items-center gap-1"><Layers size={12} /> {data.sessions.length} Sesi</span>
            {(data.filter_labels || []).map((l) => <span key={l} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FBE5E3] text-[#A32A2A]">{l}</span>)}
          </div>
          <h1 className="font-heading text-xl font-bold text-[#14201A] mt-2">{data.base_name}</h1>
          <div className="text-sm text-[#5F6B63] mt-2 space-y-1">
            <div className="flex items-center gap-2"><CalendarDays size={15} /> {tanggalPanjang(data.date)}</div>
            {data.location && <div className="flex items-center gap-2"><MapPin size={15} /> {data.location}</div>}
            {data.teacher && <div className="flex items-center gap-2"><User size={15} /> {data.teacher}</div>}
          </div>
        </div>

        {/* Rekap per sesi: pemilih sesi + pembagian per status */}
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5 mt-4 space-y-3" data-testid="gabungan-public-sesi">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-[#14201A]">Kehadiran per Sesi</div>
            <div className="flex gap-1 rounded-xl bg-[#F0EEE6] p-1" data-testid="gabungan-view-toggle">
              {[["status", "Per status"], ["peserta", "Per peserta"]].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  aria-pressed={view === key}
                  className={`h-8 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
                    view === key ? "bg-white text-[#0E4E31] shadow-sm" : "text-[#5F6B63]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {view === "status" ? (
            <>
              <div className="flex gap-1 overflow-x-auto rounded-xl bg-[#F0EEE6] p-1 no-scrollbar" data-testid="gabungan-session-picker">
                {data.sessions.map((x, i) => (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => setSessionIdx(i)}
                    aria-pressed={sessionIdx === i}
                    className={`h-9 shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors ${
                      sessionIdx === i ? "bg-white text-[#0E4E31] shadow-sm" : "text-[#5F6B63]"
                    }`}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
              {(() => {
                const s = data.sessions[sessionIdx] || data.sessions[0];
                if (!s) return null;
                const idx = data.sessions.indexOf(s);
                const rows = (data.rows || [])
                  .map((r) => ({ ...r, cell: r.sessions?.[idx] }))
                  .filter((r) => r.cell)
                  .map((r) => ({
                    name: r.name,
                    status: r.cell.status,
                    reason: r.cell.reason || r.cell.note,
                  }));
                return (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="font-heading text-base font-bold text-[#14201A]">{s.label}</div>
                      <div className="text-xs font-semibold text-[#5F6B63]">
                        {s.start_time}–{s.end_time} WITA{s.required === false ? " · opsional" : ""}
                      </div>
                    </div>
                    <StatusGroups
                      counts={s.counts}
                      rows={rows}
                      showBelum={(s.counts.belum_diabsen || 0) > 0}
                      testid={`gabungan-status-${s.id}`}
                    />
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="space-y-3">
              {data.sessions.map((x) => (
                <div key={x.id}>
                  <PercentBar
                    label={`${x.label} · ${x.start_time}–${x.end_time} WITA${x.required === false ? " · Opsional" : ""}`}
                    value={x.counts.ratio}
                    sub={`${x.counts.hadir}/${x.counts.total}`}
                    testid={`bar-sesi-${x.id}`}
                  />
                  <div className="text-[11px] text-[#5F6B63] mt-1 flex flex-wrap gap-x-3">
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
          )}
        </div>

        {/* Tabel peserta × sesi */}
        <div className="bg-white rounded-2xl border border-[#E7E3D8] mt-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E7E3D8] font-semibold text-sm text-[#14201A] flex items-center gap-2"><Clock size={15} className="text-[#0E4E31]" /> Daftar Peserta per Sesi</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="gabungan-public-table">
              <thead className="bg-[#F6F4EE] text-[#5F6B63] text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Nama</th>
                  {data.sessions.map((x) => <th key={x.id} className="px-2 py-2 font-semibold text-center whitespace-nowrap">{x.label}{x.required === false ? <span className="block text-[9px] font-bold text-[#6D3FC8]">opsional</span> : null}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E3D8]">
                {data.rows.map((r) => (
                  <tr key={r.user_id}>
                    <td className="px-3 py-2 font-semibold text-[#14201A]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{r.name}</span>
                      </div>
                    </td>
                    {r.sessions.map((c, i) => (
                      <td key={i} className="px-2 py-2 text-center">
                        {c === null ? <span className="text-[#D9D4C5]">—</span> : (
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

        <p className="text-center text-xs text-[#5F6B63] mt-6">© 2026 E-KERTALANGU · Absensi Pengajian</p>
      </main>
    </div>
  );
}
