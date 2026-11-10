import { useEffect, useMemo, useState } from "react";
import { Loader2, CalendarDays, Clock, MapPin, User, BookOpen, X, Users } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import {
  TYPE_LABEL, TYPE_COLOR, tanggalPanjang, groupKegiatan,
  AUDIENCE_LABEL, GENDER_FILTER_LABEL,
} from "@/pages/admin/kegiatanUtils";

const STATUS_STYLE = {
  hadir: { label: "Hadir", cls: "bg-[#E3F3EA] text-[#0E4E31]" },
  izin: { label: "Izin", cls: "bg-[#FBF1D6] text-[#6B4500]" },
  sakit: { label: "Sakit", cls: "bg-[#E3EEFB] text-[#1D4F91]" },
  alpha: { label: "Alpha", cls: "bg-[#FBE5E3] text-[#A32A2A]" },
  belum_diabsen: { label: "Belum diabsen", cls: "bg-[#F0EEE6] text-[#5F6B63]" },
};

function DetailModal({ k, onClose }) {
  const st = STATUS_STYLE[k.my_status] || STATUS_STYLE.belum_diabsen;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(20,32,26,0.5)]" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl" data-testid="peserta-kegiatan-detail">
        <div className="px-5 py-4 flex items-center justify-between border-b border-[#E7E3D8]">
          <h3 className="font-heading font-bold text-[#14201A]">Detail Kegiatan</h3>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6]"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>{TYPE_LABEL[k.type]}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
            {(k.filter_labels && k.filter_labels.length
              ? k.filter_labels
              : (k.gender_filter && k.gender_filter !== "semua" ? [GENDER_FILTER_LABEL[k.gender_filter]] : [])
            ).map((l) => (
              <span key={l} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FBE5E3] text-[#A32A2A]">{l}</span>
            ))}
            {(k.session_total || 1) > 1 && k.session_label && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FBF1D6] text-[#6B4500]">Sesi {k.session_label}</span>
            )}
          </div>
          <h2 className="font-heading text-xl font-bold text-[#14201A]">{k.name}</h2>
          <div className="text-sm text-[#5F6B63] space-y-2">
            <div className="flex items-center gap-2"><CalendarDays size={16} className="text-[#0E4E31]" /> {tanggalPanjang(k.date)}</div>
            <div className="flex items-center gap-2"><Clock size={16} className="text-[#0E4E31]" /> {k.start_time}–{k.end_time} WITA</div>
            {k.location && <div className="flex items-center gap-2"><MapPin size={16} className="text-[#0E4E31]" /> {k.location}</div>}
            {k.teacher && <div className="flex items-center gap-2"><User size={16} className="text-[#0E4E31]" /> {k.teacher}</div>}
            {k.material && <div className="flex items-start gap-2"><BookOpen size={16} className="text-[#0E4E31] mt-0.5" /> {k.material}</div>}
            <div className="flex items-center gap-2"><Users size={16} className="text-[#0E4E31]" /> {AUDIENCE_LABEL[k.audience] || "Reguler"}</div>
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

  const groups = useMemo(() => groupKegiatan(items || []), [items]);

  const shift = (d) => {
    const [y, m] = month.split("-").map(Number);
    const nd = new Date(y, m - 1 + d, 1);
    setMonth(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`);
  };
  const monthLabel = new Date(month + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-[#14201A]">Kegiatan</h1>
      <div className="flex items-center justify-between bg-white rounded-xl border border-[#E7E3D8] p-2">
        <button onClick={() => shift(-1)} className="h-9 px-3 rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6] font-semibold">‹</button>
        <span className="text-sm font-semibold text-[#14201A]">{monthLabel}</span>
        <button onClick={() => shift(1)} className="h-9 px-3 rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6] font-semibold">›</button>
      </div>

      {items === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={30} /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-8 text-center text-[#5F6B63] text-sm">Tidak ada kegiatan bulan ini.</div>
      ) : (
        <div className="space-y-5">
          {groups.filter((g) => g.items.length > 0).map((g) => (
            <section key={g.key} data-testid={`peserta-group-${g.key}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${g.cls}`}>{g.label}</span>
                <span className="text-xs text-[#5F6B63]">{g.items.length} kegiatan</span>
              </div>
              <div className="space-y-2">
                {g.items.map((k) => {
                  const st = STATUS_STYLE[k.my_status] || STATUS_STYLE.belum_diabsen;
                  return (
                    <button key={k.id} data-testid={`peserta-keg-${k.id}`} onClick={() => setDetail(k)} className="w-full text-left bg-white rounded-2xl border border-[#E7E3D8] p-4 hover:border-[#14633F] transition-colors">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>{TYPE_LABEL[k.type]}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </div>
                      <h3 className="font-heading font-bold text-[#14201A] mt-1.5">{k.name}</h3>
                      <div className="text-sm text-[#5F6B63] mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {tanggalPanjang(k.date)}</span>
                        <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {k.start_time}–{k.end_time} WITA</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {detail && <DetailModal k={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
