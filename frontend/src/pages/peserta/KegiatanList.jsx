import { useEffect, useState } from "react";
import { Loader2, CalendarDays, Clock, MapPin, User, BookOpen, X } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { TYPE_LABEL, TYPE_COLOR, tanggalPanjang } from "@/pages/admin/kegiatanUtils";

const STATUS_STYLE = {
  hadir: { label: "Hadir", cls: "bg-[#E8F5EE] text-[#065F46]" },
  izin: { label: "Izin", cls: "bg-[#FEF3C7] text-[#92400E]" },
  alpha: { label: "Belum hadir", cls: "bg-[#F3F4F6] text-[#6B7280]" },
};

function DetailModal({ k, onClose }) {
  const st = STATUS_STYLE[k.my_status] || STATUS_STYLE.alpha;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl" data-testid="peserta-kegiatan-detail">
        <div className="px-5 py-4 flex items-center justify-between border-b border-[#E5E7EB]">
          <h3 className="font-heading font-bold text-[#111827]">Detail Kegiatan</h3>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>{TYPE_LABEL[k.type]}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
          </div>
          <h2 className="font-heading text-xl font-bold text-[#111827]">{k.name}</h2>
          <div className="text-sm text-[#4B5563] space-y-2">
            <div className="flex items-center gap-2"><CalendarDays size={16} className="text-[#0D5C3A]" /> {tanggalPanjang(k.date)}</div>
            <div className="flex items-center gap-2"><Clock size={16} className="text-[#0D5C3A]" /> {k.start_time}–{k.end_time} WITA</div>
            {k.location && <div className="flex items-center gap-2"><MapPin size={16} className="text-[#0D5C3A]" /> {k.location}</div>}
            {k.teacher && <div className="flex items-center gap-2"><User size={16} className="text-[#0D5C3A]" /> {k.teacher}</div>}
            {k.material && <div className="flex items-start gap-2"><BookOpen size={16} className="text-[#0D5C3A] mt-0.5" /> {k.material}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KegiatanList() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setItems(null);
    api.get(`/me/kegiatan?month=${month}`)
      .then(({ data }) => setItems(data))
      .catch((e) => { toast.error(formatApiErrorDetail(e.response?.data?.detail)); setItems([]); });
  }, [month]);

  const shift = (d) => {
    const [y, m] = month.split("-").map(Number);
    const nd = new Date(y, m - 1 + d, 1);
    setMonth(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`);
  };
  const monthLabel = new Date(month + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-[#111827]">Kegiatan</h1>
      <div className="flex items-center justify-between bg-white rounded-xl border border-[#E5E7EB] p-2">
        <button onClick={() => shift(-1)} className="h-9 px-3 rounded-lg text-[#4B5563] hover:bg-[#F3F4F6] font-semibold">‹</button>
        <span className="text-sm font-semibold text-[#111827]">{monthLabel}</span>
        <button onClick={() => shift(1)} className="h-9 px-3 rounded-lg text-[#4B5563] hover:bg-[#F3F4F6] font-semibold">›</button>
      </div>

      {items === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={30} /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center text-[#6B7280] text-sm">Tidak ada kegiatan bulan ini.</div>
      ) : (
        <div className="space-y-2">
          {items.map((k) => {
            const st = STATUS_STYLE[k.my_status] || STATUS_STYLE.alpha;
            return (
              <button key={k.id} data-testid={`peserta-keg-${k.id}`} onClick={() => setDetail(k)} className="w-full text-left bg-white rounded-2xl border border-[#E5E7EB] p-4 hover:border-[#0D5C3A] transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>{TYPE_LABEL[k.type]}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                </div>
                <h3 className="font-heading font-bold text-[#111827] mt-1.5">{k.name}</h3>
                <div className="text-sm text-[#6B7280] mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {tanggalPanjang(k.date)}</span>
                  <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {k.start_time}–{k.end_time} WITA</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {detail && <DetailModal k={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
