import { useCallback, useEffect, useState } from "react";
import {
  FileBarChart2, Loader2, FileSpreadsheet, FileText, TrendingUp, Award, AlertTriangle,
  Link as LinkIcon, Copy, Download, X, ExternalLink, Send, Users,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalSingkat, TYPE_LABEL } from "./kegiatanUtils";
import TamuLaporanList from "@/components/TamuLaporanList";

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

  const [shareData, setShareData] = useState(null);
  const [sharing, setSharing] = useState(false);

  const buatLink = async () => {
    setSharing(true);
    try {
      const { data: d } = await api.post("/admin/laporan/share", {
        date_from: from, date_to: to, mode: tab,
      });
      setShareData(d);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSharing(false);
    }
  };

  const s = data?.summary || {};

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-[#0D5C3A] font-bold text-lg">
          <FileBarChart2 size={20} /> Laporan Kehadiran
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="button-buat-link-laporan" onClick={buatLink} disabled={sharing}
            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm hover:bg-[#094229] disabled:opacity-60">
            {sharing ? <Loader2 className="animate-spin" size={16} /> : <LinkIcon size={16} />} Buat Link Laporan
          </button>
          <button data-testid="button-export-excel" onClick={() => doExport("excel")} disabled={!!exporting}
            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE] disabled:opacity-50">
            {exporting === "excel" ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />} Excel
          </button>
          <button data-testid="button-export-pdf" onClick={() => doExport("pdf")} disabled={!!exporting}
            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE] disabled:opacity-50">
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
              <div className="text-sm text-[#6B7280]">Periode <b className="text-[#111827]">{tanggalSingkat(data.date_from)}</b> s/d <b className="text-[#111827]">{tanggalSingkat(data.date_to)}</b> · {data.total_kegiatan} kegiatan · {data.total_peserta} peserta · <b className="text-[#B45309]">{data.total_tamu ?? 0} tamu</b></div>
            </div>
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

          {/* Rekap per peserta (dropdown) */}
          <PesertaLaporanList rows={data.per_peserta || []} />

          {/* Daftar tamu TERPISAH dari jamaah terdaftar */}
          <TamuLaporanList rows={data.tamu || []} />
        </div>
      )}

      {shareData && <LaporanLinkModal data={shareData} onClose={() => setShareData(null)} />}
    </div>
  );
}

function PesertaLaporanList({ rows }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden mt-5" data-testid="laporan-per-peserta">
      <button
        data-testid="laporan-peserta-toggle"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#FAFBF9]"
      >
        <span className="flex items-center gap-2 font-bold text-[#111827]">
          <Users size={17} className="text-[#0D5C3A]" /> Rekap per Peserta
          <span className="text-xs font-medium text-[#6B7280]">({rows.length})</span>
        </span>
        <span className="text-sm font-semibold text-[#0D5C3A]">{open ? "Tutup" : "Lihat"}</span>
      </button>
      {open && (
        <div className="border-t border-[#E5E7EB] overflow-x-auto max-h-[52vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0">
              <tr className="bg-[#F8FAF8] text-[#9CA3AF] text-left text-[11px] uppercase tracking-wide">
                <th className="px-4 py-2.5 font-bold">Nama</th>
                <th className="px-4 py-2.5 font-bold text-center w-20">Hadir</th>
                <th className="px-4 py-2.5 font-bold text-center w-20">Izin</th>
                <th className="px-4 py-2.5 font-bold text-center w-20">Alpha</th>
                <th className="px-4 py-2.5 font-bold text-right w-20">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F2F0]">
              {rows.map((p, i) => (
                <tr key={i} data-testid={`laporan-peserta-row-${i}`}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-[#111827]">{p.name}</div>
                    {p.account_status === "pending" && (
                      <div className="text-[11px] font-semibold text-[#92400E] inline-flex items-center gap-1 mt-0.5">
                        <AlertTriangle size={11} /> Belum aktivasi
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono tabular-nums text-[#065F46] font-semibold">{p.hadir}</td>
                  <td className="px-4 py-2.5 text-center font-mono tabular-nums text-[#92400E]">{p.izin}</td>
                  <td className="px-4 py-2.5 text-center font-mono tabular-nums text-[#991B1B]">{p.alpha}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-[#0D5C3A]">{p.ratio}%</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#9CA3AF]">Belum ada data peserta.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LaporanLinkModal({ data, onClose }) {
  const copy = () => { navigator.clipboard.writeText(data.link); toast.success("Tautan laporan disalin"); };
  const download = () => {
    const a = document.createElement("a");
    a.href = data.image;
    a.download = `qr_laporan_${data.date_from}_${data.date_to}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const shareWa = () => {
    // Fase 7: template WhatsApp BAKU dikirim dari backend (wa_text).
    const judul = (data.title || "Laporan Kehadiran").replace(/^laporan\s+/i, "").toLowerCase();
    const text = data.wa_text
      || `Assalamu'alaikum warahmatullahi wabarakatuh\n\nBerikut laporan ${judul}\n${data.link}\n\nAlhamdulillah, jazakumullahu khoiro.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto" data-testid="modal-laporan-link">
        <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-5 py-4 flex items-center justify-between">
          <h3 className="font-heading font-bold text-[#111827]">Tautan Laporan Publik</h3>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F2F5F2]"><X size={20} /></button>
        </div>
        <div className="p-5 text-center">
          <img src={data.image} alt="QR Laporan" className="mx-auto w-52 h-52 rounded-xl border border-[#E5E7EB] p-2" data-testid="laporan-qr-image" />
          <div className="mt-3 bg-[#F0FAF4] border border-[#CDEBD9] rounded-xl p-3 text-left">
            <p className="text-sm font-semibold text-[#065F46]">{data.title}</p>
            <p className="text-xs text-[#4B5563] mt-1 leading-relaxed">
              Siapa pun yang membuka tautan ini <b>langsung melihat laporannya tanpa perlu login</b>.
              Tautan bersifat <b>permanen</b> untuk periode {tanggalSingkat(data.date_from)} s/d {tanggalSingkat(data.date_to)}.
            </p>
          </div>
          <a
            href={data.link}
            target="_blank"
            rel="noreferrer"
            data-testid="laporan-link-open"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D5C3A] hover:underline break-all"
          >
            <ExternalLink size={14} className="shrink-0" /> {data.link}
          </a>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button data-testid="laporan-link-copy" onClick={copy} className="h-11 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#E8F5EE]"><Copy size={16} /> Salin Link</button>
            <button data-testid="laporan-link-qr" onClick={download} className="h-11 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#E8F5EE]"><Download size={16} /> Unduh QR</button>
          </div>
          <button data-testid="laporan-link-wa" onClick={shareWa} className="mt-2 w-full h-12 rounded-xl bg-[#25D366] text-white font-bold flex items-center justify-center gap-2 hover:brightness-95">
            <Send size={18} /> Bagikan Link via WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

