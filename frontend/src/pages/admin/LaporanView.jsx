import { useCallback, useEffect, useState } from "react";
import {
  FileBarChart2, Loader2, FileSpreadsheet, FileText, TrendingUp, Award, AlertTriangle, Send,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalSingkat, TYPE_LABEL } from "./kegiatanUtils";

const inp = "h-11 px-3.5 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A] bg-white";

function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function firstOfMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function LaporanView() {
  const [tab, setTab] = useState("bulanan");
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(todayYmd());
  const [data, setData] = useState(null);
  const [exporting, setExporting] = useState("");

  const load = useCallback(() => {
    setData(null);
    api.get(`/admin/laporan?date_from=${from}&date_to=${to}`)
      .then(({ data: d }) => setData(d))
      .catch((e) => { setData(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const setPreset = (t) => {
    setTab(t);
    if (t === "harian") { setFrom(todayYmd()); setTo(todayYmd()); }
    else if (t === "bulanan") { setFrom(firstOfMonth()); setTo(todayYmd()); }
  };

  const doExport = async (format) => {
    setExporting(format);
    try {
      const res = await api.get(`/admin/laporan/export?format=${format}&date_from=${from}&date_to=${to}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `laporan_${from}_${to}.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengekspor laporan");
    } finally { setExporting(""); }
  };

  const shareWa = () => {
    if (!data || !data.summary) { toast.error("Data belum siap"); return; }
    const s2 = data.summary || {};
    const lines = [];
    if (tab === "harian") {
      const tgl = tanggalSingkat(to);
      lines.push("Assalamualaikum");
      lines.push(`Berikut laporan kehadiran hari ini (${tgl}):`);
      lines.push("");
      (data.per_kegiatan || []).forEach((r) => {
        lines.push(`• ${r.name}: Hadir ${r.hadir}, Izin ${r.izin}, Alpha ${r.alpha} (${r.ratio}%)`);
      });
      if (!(data.per_kegiatan || []).length) lines.push("(Belum ada kegiatan hari ini)");
      lines.push("");
      lines.push(`Total: Hadir ${s2.hadir}, Izin ${s2.izin}, Alpha ${s2.alpha} — Rasio ${s2.ratio}%`);
    } else {
      const monthName = new Date(from + "T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
      lines.push("Assalamualaikum");
      lines.push(`Berikut laporan total kehadiran bulan ${monthName}:`);
      lines.push("");
      lines.push(`Total Hadir: ${s2.hadir}`);
      lines.push(`Total Izin: ${s2.izin}`);
      lines.push(`Total Alpha: ${s2.alpha}`);
      lines.push(`Rasio Kehadiran: ${s2.ratio}%`);
      lines.push(`Jumlah Kegiatan: ${data.total_kegiatan}`);
    }
    lines.push("");
    lines.push("Alhamdulillah jazakumullahu khoiro");
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");
  };

  const s = data?.summary || {};

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-[#0D5C3A] font-bold text-lg">
          <FileBarChart2 size={20} /> Laporan Kehadiran
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="button-share-wa" onClick={shareWa}
            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-[#25D366] text-white font-semibold text-sm hover:brightness-95">
            <Send size={16} /> Share WA
          </button>
          <button data-testid="button-export-excel" onClick={() => doExport("excel")} disabled={!!exporting}
            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE] disabled:opacity-50">
            {exporting === "excel" ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />} Excel
          </button>
          <button data-testid="button-export-pdf" onClick={() => doExport("pdf")} disabled={!!exporting}
            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm hover:bg-[#094229] disabled:opacity-50">
            {exporting === "pdf" ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />} PDF
          </button>
        </div>
      </div>

      {/* Tabs + range */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mb-5">
        <div className="flex items-center gap-1 bg-[#F2F5F2] rounded-xl p-1 w-fit mb-3">
          {[["harian", "Harian"], ["bulanan", "Bulanan"], ["custom", "Rentang"]].map(([v, l]) => (
            <button key={v} data-testid={`tab-${v}`} onClick={() => setPreset(v)}
              className={`h-9 px-4 rounded-lg text-sm font-semibold ${tab === v ? "bg-white text-[#0D5C3A] shadow-sm" : "text-[#6B7280]"}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1">Dari</label>
            <input data-testid="laporan-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setTab("custom"); }} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#6B7280] mb-1">Sampai</label>
            <input data-testid="laporan-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setTab("custom"); }} className={inp} />
          </div>
        </div>
      </div>

      {data === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={30} /></div>
      ) : data === false ? (
        <div className="p-10 text-center text-[#6B7280]">Gagal memuat laporan.</div>
      ) : (
        <div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-5">
            <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]"><div className="text-2xl font-bold text-[#0D5C3A]">{s.ratio}%</div><div className="text-sm text-[#6B7280] mt-1">Kehadiran</div></div>
            <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]"><div className="text-2xl font-bold text-[#065F46]">{s.hadir}</div><div className="text-sm text-[#6B7280] mt-1">Total Hadir</div></div>
            <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]"><div className="text-2xl font-bold text-[#92400E]">{s.izin}</div><div className="text-sm text-[#6B7280] mt-1">Total Izin</div></div>
            <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]"><div className="text-2xl font-bold text-[#991B1B]">{s.alpha}</div><div className="text-sm text-[#6B7280] mt-1">Total Alpha</div></div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 mb-5">
            <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB]">
              <div className="text-sm font-semibold text-[#111827] mb-1">Kehadiran per Jenis Kelamin</div>
              <div className="flex gap-4 text-sm text-[#4B5563]">
                <span>Laki-laki: <b className="text-[#0D5C3A]">{data.gender_hadir?.L ?? 0}</b></span>
                <span>Perempuan: <b className="text-[#D97706]">{data.gender_hadir?.P ?? 0}</b></span>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB]">
              <div className="text-sm text-[#6B7280]">Periode <b className="text-[#111827]">{tanggalSingkat(data.date_from)}</b> s/d <b className="text-[#111827]">{tanggalSingkat(data.date_to)}</b> · {data.total_kegiatan} kegiatan · {data.total_peserta} peserta</div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2 mb-5">
            <TopList title="Paling Rajin" icon={Award} color="#0D5C3A" rows={data.top_rajin} field="hadir" suffix="hadir" />
            <TopList title="Paling Sering Alpha" icon={AlertTriangle} color="#DC2626" rows={data.top_alpha} field="alpha" suffix="alpha" />
          </div>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden" data-testid="laporan-table">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center gap-2 font-bold text-[#111827]"><TrendingUp size={17} /> Rincian per Kegiatan</div>
            {(!data.per_kegiatan || data.per_kegiatan.length === 0) ? (
              <div className="p-8 text-center text-[#6B7280] text-sm">Tidak ada kegiatan pada periode ini.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F8FAF8] text-[#6B7280] text-left">
                      <th className="px-4 py-3 font-semibold">Tanggal</th>
                      <th className="px-4 py-3 font-semibold">Kegiatan</th>
                      <th className="px-4 py-3 font-semibold text-center">Hadir</th>
                      <th className="px-4 py-3 font-semibold text-center">Izin</th>
                      <th className="px-4 py-3 font-semibold text-center">Alpha</th>
                      <th className="px-4 py-3 font-semibold text-center">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {data.per_kegiatan.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 text-[#4B5563] whitespace-nowrap">{tanggalSingkat(r.date)}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#111827]">{r.name}</div>
                          <div className="text-xs text-[#9CA3AF]">{TYPE_LABEL[r.type]}</div>
                        </td>
                        <td className="px-4 py-3 text-center text-[#065F46] font-semibold">{r.hadir}</td>
                        <td className="px-4 py-3 text-center text-[#92400E]">{r.izin}</td>
                        <td className="px-4 py-3 text-center text-[#991B1B]">{r.alpha}</td>
                        <td className="px-4 py-3 text-center font-bold text-[#0D5C3A]">{r.ratio}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TopList({ title, icon: Icon, color, rows, field, suffix }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]">
      <div className="flex items-center gap-2 font-bold text-[#111827] mb-3"><Icon size={17} style={{ color }} /> {title}</div>
      {(!rows || rows.length === 0) ? (
        <p className="text-sm text-[#6B7280]">Belum ada data.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="h-6 w-6 rounded-full bg-[#F2F5F2] text-[#4B5563] text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span className="font-medium text-[#111827] truncate">{r.name}</span>
              </span>
              <span className="text-sm font-semibold shrink-0" style={{ color }}>{r[field]} {suffix}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
