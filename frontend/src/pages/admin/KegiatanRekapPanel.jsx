// FASE 18 — Panel Rekap / Laporan kegiatan: tautan publik + bagikan WhatsApp.
import { useCallback, useEffect, useState } from "react";
import { Loader2, Copy, Download, Send, FileBarChart2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

export default function KegiatanRekapPanel({ kegiatanId }) {
  const [info, setInfo] = useState(null);

  const load = useCallback(() => {
    api.get(`/admin/kegiatan/${kegiatanId}/qr`)
      .then(({ data }) => setInfo(data))
      .catch((e) => { setInfo(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  if (info === null) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={28} /></div>;
  if (info === false) return <div className="p-8 text-center text-sm text-[#6B7280]">Gagal memuat tautan rekap.</div>;

  const download = () => {
    const a = document.createElement("a");
    a.href = info.image;
    a.download = "qr_rekap_kegiatan.png";
    document.body.appendChild(a); a.click(); a.remove();
  };
  const shareWa = () => {
    const text = info.wa_text
      || `Assalamu'alaikum warahmatullahi wabarakatuh\n\nBerikut rekap kehadiran kegiatan\n${info.link}\n\nJazakumullahu khoiro.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5 text-center" data-testid="detail-rekap-panel">
      <div className="font-bold text-[#111827] inline-flex items-center gap-2 mb-3">
        <FileBarChart2 size={17} /> Rekap / Laporan Kegiatan
      </div>
      <img src={info.image} alt="QR Rekap Kegiatan" className="mx-auto w-48 h-48 rounded-xl border border-[#E8E8E4] p-2" data-testid="detail-rekap-qr" />
      <p className="text-xs text-[#4B5563] mt-3 leading-relaxed max-w-md mx-auto">
        Penerima tautan langsung melihat <b>rekap kehadiran kegiatan ini tanpa login</b>.
        Tautan rekap berlaku 7 hari dan bisa dibuat ulang kapan saja.
      </p>
      <a href={info.link} target="_blank" rel="noreferrer" data-testid="detail-rekap-link"
        className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#111114] hover:underline break-all">
        <ExternalLink size={14} className="shrink-0" /> {info.link}
      </a>
      <div className="grid sm:grid-cols-2 gap-2 mt-4">
        <button data-testid="detail-rekap-copy"
          onClick={() => { navigator.clipboard.writeText(info.link); toast.success("Tautan rekap disalin"); }}
          className="h-11 rounded-xl border-2 border-[#111114] text-[#111114] font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#F1F1EE]">
          <Copy size={16} /> Salin Tautan
        </button>
        <button data-testid="detail-rekap-download" onClick={download}
          className="h-11 rounded-xl border-2 border-[#E8E8E4] text-[#4B5563] font-semibold inline-flex items-center justify-center gap-2 hover:border-[#111114] hover:text-[#111114]">
          <Download size={16} /> Unduh QR
        </button>
      </div>
      <button data-testid="detail-rekap-wa" onClick={shareWa}
        className="mt-2 w-full h-11 rounded-xl bg-[#25D366] text-white font-semibold inline-flex items-center justify-center gap-2 hover:brightness-95">
        <Send size={16} /> Bagikan lewat WhatsApp
      </button>
    </div>
  );
}
