// FASE 18 — Kalender Kegiatan (lebar penuh, tanpa panel samping).
// Klik tanggal: 1 kegiatan → langsung Absensi; >1 sesi → modal daftar sesi;
// tanggal kosong → modal kecil "Tambah kegiatan".
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarRange, ChevronLeft, ChevronRight, Loader2, Clock, MapPin, User,
  Layers, CalendarPlus, ClipboardList, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import Modal from "@/components/Modal";
import KegiatanQuickAddModal from "./KegiatanQuickAddModal";
import {
  MONTH_SHORT, tanggalPanjang, typeLabel, typeColor, phaseMeta, phaseOf,
} from "./kegiatanUtils";

const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export default function KalenderView({ onOpenKegiatan }) {
  const [month, setMonth] = useState(() => todayYmd().slice(0, 7));
  const [items, setItems] = useState(null);
  const [pick, setPick] = useState(null);
  const [tambah, setTambah] = useState(null);

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

  const dayItems = pick ? (byDate[pick] || []) : [];
  const totalBulan = (items || []).length;

  const klikTanggal = (ymd) => {
    const list = byDate[ymd] || [];
    if (list.length === 1) {
      // Tunggal: langsung ke halaman Absensi kegiatan itu.
      window.location.assign(`/absensi/${list[0].akses_token || ""}`);
      return;
    }
    setPick(ymd);
  };

  return (
    <div data-testid="kalender-view">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#0E4E31] font-bold text-lg">
            <CalendarRange size={20} /> Kalender Kegiatan
          </div>
          <p className="text-sm text-[#5F6B63] mt-0.5">
            Tap tanggal untuk membuka absensi atau daftar sesi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="kalender-prev" onClick={() => shift(-1)}
            className="h-10 w-10 flex items-center justify-center rounded-xl border border-[#E7E3D8] bg-white hover:border-[#14633F]"><ChevronLeft size={18} /></button>
          <div className="font-semibold text-[#14201A] min-w-[140px] text-center">{MONTH_SHORT[m - 1]} {y}</div>
          <button data-testid="kalender-next" onClick={() => shift(1)}
            className="h-10 w-10 flex items-center justify-center rounded-xl border border-[#E7E3D8] bg-white hover:border-[#14633F]"><ChevronRight size={18} /></button>
        </div>
      </div>

      {items === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={30} /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-3 sm:p-4" data-testid="kalender-grid">
          <div className="grid grid-cols-7 gap-1 text-center text-[12px] font-bold uppercase tracking-wide text-[#5F6B63] mb-1">
            {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((ymd, i) => {
              if (!ymd) return <div key={`e${i}`} />;
              const list = byDate[ymd] || [];
              const isToday = ymd === todayYmd();
              return (
                <button
                  key={ymd}
                  data-testid={`kalender-day-${ymd}`}
                  onClick={() => klikTanggal(ymd)}
                  className={`flex min-h-[54px] flex-col items-center justify-start gap-0.5 rounded-xl border-2 px-0.5 pb-1 pt-1.5 transition-colors sm:min-h-[88px] ${
                    list.length ? "border-transparent bg-[#F6F4EE] text-[#0E4E31] hover:border-[#14633F]"
                      : "border-transparent text-[#5F6B63] hover:bg-[#F6F4EE]"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[14px] leading-none ${
                      isToday ? "bg-[#14633F] font-bold text-white" : "font-semibold"
                    }`}
                  >
                    {parseInt(ymd.slice(-2), 10)}
                  </span>
                  {list.length > 0 && (
                    <>
                      <span className="flex gap-0.5 sm:hidden">
                        {list.slice(0, 3).map((k) => (
                          <i key={k.id} className="h-1.5 w-1.5 rounded-full bg-[#14633F]" />
                        ))}
                      </span>
                      <span className="hidden w-full flex-col gap-0.5 px-0.5 sm:flex">
                        {list.slice(0, 2).map((k) => (
                          <span
                            key={k.id}
                            title={`${k.name} · ${k.start_time}–${k.end_time}`}
                            className="block w-full truncate rounded bg-white px-1 py-0.5 text-left text-[11.5px] font-semibold leading-tight text-[#0E4E31]"
                          >
                            {k.start_time} {k.session_label || k.name}
                          </span>
                        ))}
                        {list.length > 2 && (
                          <span className="text-[11px] font-bold text-[#5F6B63]">+{list.length - 2}</span>
                        )}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-[#5F6B63] mt-3">
            Total <b className="text-[#0E4E31]">{totalBulan}</b> jadwal pada {MONTH_SHORT[m - 1]} {y}.
          </p>
        </div>
      )}

      {pick && (
        <Modal
          open
          onClose={() => setPick(null)}
          title={tanggalPanjang(pick)}
          subtitle={dayItems.length ? `${dayItems.length} sesi` : "Belum ada kegiatan"}
          testid="kalender-sesi-modal"
          maxWidth={560}
        >
          {dayItems.length === 0 ? (
            <div className="space-y-3 p-1">
              <p className="text-sm text-[#5F6B63]">Tidak ada kegiatan pada tanggal ini.</p>
              <button type="button" data-testid="kalender-tambah-kegiatan"
                onClick={() => { setTambah(pick); setPick(null); }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]">
                <CalendarPlus size={16} /> Tambah kegiatan
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {dayItems.map((k) => {
                const meta = phaseMeta(phaseOf(k));
                return (
                  <div key={k.id} data-testid={`kalender-item-${k.id}`}
                    className="rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${typeColor(k.type)}1a`, color: typeColor(k.type) }}>
                        {typeLabel(k.type)}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>
                        {meta.badge}
                      </span>
                      {(k.session_total || 1) > 1 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FBF1D6] text-[#6B4500] inline-flex items-center gap-1">
                          <Layers size={11} /> {k.session_label}
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-[#14201A] text-sm mt-1.5">{k.name}</div>
                    <div className="text-xs text-[#5F6B63] mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1"><Clock size={12} /> {k.start_time}–{k.end_time} WITA</span>
                      {k.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {k.location}</span>}
                      {k.teacher && <span className="inline-flex items-center gap-1"><User size={12} /> {k.teacher}</span>}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <a
                        href={`/absensi/${k.akses_token || ""}`}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#0B6B52] px-3.5 text-sm font-semibold text-white hover:brightness-110"
                      >
                        <ClipboardList size={15} /> Absensi
                      </a>
                      <button type="button"
                        onClick={() => { setPick(null); onOpenKegiatan?.(k.id); }}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border-2 border-[#14633F] px-3.5 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA]">
                        <Pencil size={15} /> Detail dan edit
                      </button>
                    </div>
                  </div>
                );
              })}
              <button type="button" data-testid="kalender-tambah-kegiatan"
                onClick={() => { setTambah(pick); setPick(null); }}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-4 text-sm font-semibold text-[#14201A] hover:border-[#14633F]">
                <CalendarPlus size={16} /> Tambah kegiatan
              </button>
            </div>
          )}
        </Modal>
      )}

      {tambah && (
        <KegiatanQuickAddModal
          initialDate={tambah}
          onClose={() => setTambah(null)}
          onFullForm={() => { setTambah(null); onOpenKegiatan?.(null); }}
        />
      )}
    </div>
  );
}
