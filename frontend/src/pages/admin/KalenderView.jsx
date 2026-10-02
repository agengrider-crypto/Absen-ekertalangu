// FASE 18 — Kalender Kegiatan (menu sidebar sendiri).
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarRange, ChevronLeft, ChevronRight, Loader2, Clock, MapPin, User, Layers, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import KegiatanFormModal from "./KegiatanFormModal";
import {
  MONTH_SHORT, tanggalPanjang, TYPE_LABEL, TYPE_COLOR, PHASE_META, phaseOf,
} from "./kegiatanUtils";

const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export default function KalenderView() {
  const [month, setMonth] = useState(() => todayYmd().slice(0, 7));
  const [items, setItems] = useState(null);
  const [pick, setPick] = useState(todayYmd());
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setItems(null);
    api.get(`/admin/kegiatan?month=${month}`)
      .then(({ data }) => setItems(data || []))
      .catch((e) => { setItems([]); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const [y, m] = month.split("-").map((x) => parseInt(x, 10));
  const shift = (d) => {
    let ny = y; let nm = m + d;
    while (nm > 12) { nm -= 12; ny += 1; }
    while (nm < 1) { nm += 12; ny -= 1; }
    setMonth(`${ny}-${String(nm).padStart(2, "0")}`);
  };

  const byDate = useMemo(() => {
    const map = {};
    (items || []).forEach((k) => { (map[k.date] = map[k.date] || []).push(k); });
    return map;
  }, [items]);

  const cells = useMemo(() => {
    const first = new Date(y, m - 1, 1);
    const days = new Date(y, m, 0).getDate();
    const out = [];
    for (let i = 0; i < first.getDay(); i += 1) out.push(null);
    for (let d = 1; d <= days; d += 1) out.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    return out;
  }, [y, m]);

  const dayItems = byDate[pick] || [];
  const totalBulan = (items || []).length;

  return (
    <div data-testid="kalender-view">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#111114] font-bold text-lg">
            <CalendarRange size={20} /> Kalender Kegiatan
          </div>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Lihat seluruh jadwal pengajian dalam satu bulan, lalu tap tanggal untuk rinciannya.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="kalender-prev" onClick={() => shift(-1)}
            className="h-10 w-10 flex items-center justify-center rounded-xl border border-[#E8E8E4] bg-white hover:border-[#111114]"><ChevronLeft size={18} /></button>
          <div className="font-semibold text-[#111827] min-w-[140px] text-center">{MONTH_SHORT[m - 1]} {y}</div>
          <button data-testid="kalender-next" onClick={() => shift(1)}
            className="h-10 w-10 flex items-center justify-center rounded-xl border border-[#E8E8E4] bg-white hover:border-[#111114]"><ChevronRight size={18} /></button>
        </div>
      </div>

      {items === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={30} /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr] items-start">
          <div className="bg-white rounded-2xl border border-[#E8E8E4] p-3 sm:p-4" data-testid="kalender-grid">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] mb-1">
              {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((ymd, i) => {
                if (!ymd) return <div key={`e${i}`} />;
                const list = byDate[ymd] || [];
                const on = pick === ymd;
                const isToday = ymd === todayYmd();
                return (
                  <button
                    key={ymd}
                    data-testid={`kalender-day-${ymd}`}
                    onClick={() => setPick(ymd)}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm transition-colors border-2 ${
                      on ? "bg-[#111114] text-white border-transparent"
                        : list.length ? "bg-[#F1F1EE] text-[#111114] font-semibold border-transparent hover:border-[#111114]"
                        : `text-[#6B7280] border-transparent hover:bg-[#F7F7F5] ${isToday ? "ring-2 ring-[#111114]/20" : ""}`
                    }`}
                  >
                    {parseInt(ymd.slice(-2), 10)}
                    {list.length > 0 && (
                      <span className={`text-[10px] font-bold ${on ? "text-white/85" : "text-[#4B5563]"}`}>
                        {list.length} keg
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-3">
              Total <b className="text-[#111114]">{totalBulan}</b> jadwal pada {MONTH_SHORT[m - 1]} {y}.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E8E8E4] p-4" data-testid="kalender-detail">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="font-bold text-[#111827]">{tanggalPanjang(pick)}</div>
              <button data-testid="kalender-tambah-kegiatan" onClick={() => setShowForm(true)}
                className="h-10 px-3.5 rounded-xl bg-[#111114] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-black">
                <Plus size={16} /> Buat Kegiatan
              </button>
            </div>
            {dayItems.length === 0 ? (
              <p className="text-sm text-[#6B7280] mt-2">
                Tidak ada kegiatan pada tanggal ini — tekan <b>Buat Kegiatan</b> untuk menambah langsung di tanggal ini.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {dayItems.map((k) => (
                  <div key={k.id} data-testid={`kalender-item-${k.id}`}
                    className="rounded-xl border-2 border-[#E8E8E4] bg-[#FAFAF8] p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>
                        {TYPE_LABEL[k.type]}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${PHASE_META[phaseOf(k)].cls}`}>
                        {PHASE_META[phaseOf(k)].badge}
                      </span>
                      {(k.session_total || 1) > 1 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] inline-flex items-center gap-1">
                          <Layers size={11} /> {k.session_label}
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-[#111827] text-sm mt-1.5">{k.name}</div>
                    <div className="text-xs text-[#6B7280] mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1"><Clock size={12} /> {k.start_time}–{k.end_time} WITA</span>
                      {k.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {k.location}</span>}
                      {k.teacher && <span className="inline-flex items-center gap-1"><User size={12} /> {k.teacher}</span>}
                    </div>
                    <div className="text-xs text-[#4B5563] mt-1.5">
                      Hadir <b className="text-[#047857]">{k.counts?.hadir ?? 0}</b> ·
                      Izin <b className="text-[#92400E]"> {k.counts?.izin ?? 0}</b> ·
                      Alpha <b className="text-[#991B1B]"> {k.counts?.alpha ?? 0}</b> ·
                      <b className="text-[#111114]"> {k.counts?.ratio ?? 0}%</b>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <KegiatanFormModal
          initial={{ date: pick }}
          onClose={() => setShowForm(false)}
          onDone={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}
