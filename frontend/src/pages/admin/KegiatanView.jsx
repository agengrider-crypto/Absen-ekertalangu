import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Plus, List, Grid3x3, ChevronLeft, ChevronRight, Loader2, X,
  Share2, CheckCircle2, RotateCcw, Trash2, Search, Copy, Download,
  Clock, MapPin, User, ScanLine, MessageSquareText,
  MoreHorizontal, Pencil, FileBarChart2, ChevronDown, AlertTriangle,
  KeyRound, RefreshCw, Send, Layers, SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import {
  KEGIATAN_TYPES, TYPE_LABEL, TYPE_COLOR, timeOptions,
  tanggalPanjang, tanggalSingkat, hhmm, MONTH_SHORT,
  AUDIENCE_OPTIONS, GENDER_FILTER_OPTIONS, AUDIENCE_LABEL,
  PHASE_META, phaseOf, groupKegiatan,
  MARITAL_FILTER_OPTIONS, AGE_GROUP_OPTIONS, SESSION_LABEL_PRESETS,
  SESSION_DEFAULT_TIME, groupSessions,
} from "./kegiatanUtils";
import KegiatanDetail from "./KegiatanDetail";
import KegiatanFormModal from "./KegiatanFormModal";
import { ReminderModal, DelegasiModal, ScanPesertaModal } from "./KegiatanExtras";
import { RekapGabunganModal, SalinJadwalModal } from "./SesiExtras";
import ActionModal from "@/components/ActionModal";
import { Send as SendIcon, ShieldCheck as ShieldIcon, ScanLine as ScanIcon } from "lucide-react";

const inp = "w-full h-[46px] px-3.5 rounded-xl border-2 border-[#E8E8E4] text-base outline-none focus:border-[#111114] bg-white";
const TIMES = timeOptions();

function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export default function KegiatanView() {
  const [month, setMonth] = useState(() => todayYmd().slice(0, 7));
  const [items, setItems] = useState(null);
  const [view, setView] = useState("list");
  const [dayFilter, setDayFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [qrModal, setQrModal] = useState(null);
  const [absenQr, setAbsenQr] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [reminderItem, setReminderItem] = useState(null);
  const [detailKey, setDetailKey] = useState(0);
  // FASE 10 — rekap gabungan 1 hari & salin jadwal sesi
  const [gabunganId, setGabunganId] = useState(null);
  const [salinGroup, setSalinGroup] = useState(null);

  const load = useCallback(() => {
    setItems(null);
    api.get(`/admin/kegiatan?month=${month}`)
      .then(({ data }) => setItems(data))
      .catch((e) => { setItems([]); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const [y, m] = month.split("-").map((x) => parseInt(x, 10));
  const shiftMonth = (delta) => {
    let ny = y;
    let nm = m + delta;
    while (nm > 12) { nm -= 12; ny += 1; }
    while (nm < 1) { nm += 12; ny -= 1; }
    setDayFilter("");
    setMonth(`${ny}-${String(nm).padStart(2, "0")}`);
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    return dayFilter ? items.filter((k) => k.date === dayFilter) : items;
  }, [items, dayFilter]);

  const daysWithEvent = useMemo(() => {
    const s = {};
    (items || []).forEach((k) => { s[k.date] = (s[k.date] || 0) + 1; });
    return s;
  }, [items]);

  const groups = useMemo(() => groupKegiatan(filtered), [filtered]);

  const openShareRekap = async (k) => {
    try {
      const { data } = await api.get(`/admin/kegiatan/${k.id}/qr`);
      setQrModal({ ...data, name: k.name });
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const openAbsenQr = async (k) => {
    try {
      const { data } = await api.post(`/admin/kegiatan/${k.id}/absen-qr`);
      setAbsenQr({ ...data, name: k.name });
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const toggleStatus = async (k) => {
    try {
      await api.post(`/admin/kegiatan/${k.id}/${k.status === "open" ? "close" : "reopen"}`);
      toast.success(k.status === "open" ? "Kegiatan diselesaikan" : "Kegiatan dibuka kembali");
      load();
      setDetailKey((v) => v + 1);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const removeKegiatan = async (k) => {
    if (!window.confirm(`Hapus kegiatan "${k.name}"?`)) return;
    try {
      await api.delete(`/admin/kegiatan/${k.id}`);
      toast.success("Kegiatan dihapus");
      setDetailId(null);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  // Semua fitur kegiatan berada DI DALAM halaman detail (klik kegiatan di daftar)
  if (detailId) {
    return (
      <>
        <KegiatanDetail
          key={detailKey}
          kegiatanId={detailId}
          onBack={() => { setDetailId(null); load(); }}
          onChanged={load}
          onEdit={(k) => setEditItem(k)}
          onShareRekap={openShareRekap}
          onAbsenQr={openAbsenQr}
          onReminder={(k) => setReminderItem(k)}
          onToggleStatus={toggleStatus}
          onDelete={removeKegiatan}
          onRekapGabungan={(k) => setGabunganId(k.id)}
          onSalinJadwal={(k) => {
            const grp = (items || []).filter((x) => k.session_group_id && x.session_group_id === k.session_group_id);
            const list = grp.length ? grp.sort((a, b) => (a.session_index ?? 0) - (b.session_index ?? 0)) : [k];
            setSalinGroup({ items: list });
          }}
        />
        {editItem && (
          <KegiatanFormModal
            initial={editItem}
            onClose={() => setEditItem(null)}
            onDone={() => { setEditItem(null); load(); setDetailKey((v) => v + 1); }}
          />
        )}
        {qrModal && <QrModal data={qrModal} onClose={() => setQrModal(null)} />}
        {absenQr && <AbsenQrModal data={absenQr} onClose={() => setAbsenQr(null)} />}
        {reminderItem && <ReminderModal kegiatan={reminderItem} onClose={() => setReminderItem(null)} />}
        {gabunganId && <RekapGabunganModal kegiatanId={gabunganId} onClose={() => setGabunganId(null)} />}
        {salinGroup && (
          <SalinJadwalModal group={salinGroup} onClose={() => setSalinGroup(null)}
            onDone={() => { setSalinGroup(null); load(); }} />
        )}
      </>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-[#111114] font-bold text-lg">
          <CalendarDays size={20} /> Kegiatan
        </div>
        <button data-testid="button-add-kegiatan" onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#111114] text-white font-semibold text-sm hover:bg-[#000000]">
          <Plus size={17} /> Tambah Kegiatan
        </button>
      </div>

      {/* Month nav + view toggle */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button data-testid="button-prev-month" onClick={() => shiftMonth(-1)} className="h-10 w-10 flex items-center justify-center rounded-xl border border-[#E8E8E4] bg-white hover:border-[#111114]"><ChevronLeft size={18} /></button>
          <div className="font-semibold text-[#111827] min-w-[150px] text-center">{MONTH_SHORT[m - 1]} {y}</div>
          <button data-testid="button-next-month" onClick={() => shiftMonth(1)} className="h-10 w-10 flex items-center justify-center rounded-xl border border-[#E8E8E4] bg-white hover:border-[#111114]"><ChevronRight size={18} /></button>
        </div>
        <div className="flex items-center gap-1 bg-white border border-[#E8E8E4] rounded-xl p-1">
          <button data-testid="view-list" onClick={() => setView("list")} className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold ${view === "list" ? "bg-[#F1F1EE] text-[#111114]" : "text-[#6B7280]"}`}><List size={16} /> List</button>
          <button data-testid="view-calendar" onClick={() => setView("calendar")} className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold ${view === "calendar" ? "bg-[#F1F1EE] text-[#111114]" : "text-[#6B7280]"}`}><Grid3x3 size={16} /> Kalender</button>
        </div>
      </div>

      {view === "calendar" && (
        <CalendarMonth year={y} month={m} daysWithEvent={daysWithEvent} dayFilter={dayFilter} onPick={setDayFilter} />
      )}

      {dayFilter && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-[#6B7280]">Menampilkan:</span>
          <span className="font-semibold text-[#111114]">{tanggalPanjang(dayFilter)}</span>
          <button onClick={() => setDayFilter("")} className="text-[#DC2626] font-semibold hover:underline">Tampilkan semua</button>
        </div>
      )}

      {/* List */}
      {items === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={30} /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-10 text-center text-[#6B7280]">Belum ada kegiatan pada periode ini.</div>
      ) : (
        <div className="space-y-6">
          {groups.filter((g) => g.items.length > 0).map((g) => (
            <section key={g.key} data-testid={`kegiatan-group-${g.key}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${g.cls}`}>{g.label}</span>
                <span className="text-xs text-[#9CA3AF]">{g.items.length} kegiatan</span>
              </div>
              <div className="grid gap-3">
                {groupSessions(g.items).map((grp) => (
                  grp.single
                    ? <KegiatanCard key={grp.key} k={grp.k} onOpen={() => setDetailId(grp.k.id)} onSalin={() => setSalinGroup({ items: [grp.k] })} />
                    : <SessionGroupCard key={grp.key} group={grp} onOpen={setDetailId}
                        onRekapGabungan={() => setGabunganId(grp.items[0].id)}
                        onSalin={() => setSalinGroup(grp)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {showAdd && <KegiatanFormModal onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} />}
      {gabunganId && <RekapGabunganModal kegiatanId={gabunganId} onClose={() => setGabunganId(null)} />}
      {salinGroup && (
        <SalinJadwalModal group={salinGroup} onClose={() => setSalinGroup(null)}
          onDone={(res) => {
            setSalinGroup(null);
            const d = res?.dates?.[0];
            if (d && d.slice(0, 7) !== month) { setDayFilter(""); setMonth(d.slice(0, 7)); } else load();
          }} />
      )}
    </div>
  );
}

function FilterBadges({ k }) {
  const labels = k.filter_labels || [];
  if (!labels.length) return null;
  return (
    <>
      {labels.map((l) => (
        <span key={l} data-testid="keg-filter-badge"
          className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FDF2F8] text-[#9D174D]">{l}</span>
      ))}
    </>
  );
}

function KegiatanCard({ k, onOpen, onSalin }) {
  const c = k.counts || {};
  return (
    <div
      className="w-full text-left bg-white rounded-2xl border border-[#E8E8E4] p-4 hover:border-[#111114] hover:bg-[#FAFCFA] transition-colors"
      data-testid={`kegiatan-card-${k.id}`}
    >
      <button type="button" onClick={onOpen} className="w-full text-left" data-testid={`kegiatan-card-open-${k.id}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>{TYPE_LABEL[k.type]}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PHASE_META[phaseOf(k)].cls}`}>{PHASE_META[phaseOf(k)].badge}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#111114]">{AUDIENCE_LABEL[k.audience] || "Reguler"}</span>
              <FilterBadges k={k} />
              {k.auto_closed && <span className="text-xs text-[#9CA3AF]">(auto)</span>}
            </div>
            <h3 className="font-heading font-bold text-[#111827] mt-1.5 truncate">{k.name}</h3>
            <div className="text-sm text-[#6B7280] mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> {tanggalSingkat(k.date)}</span>
              <span className="inline-flex items-center gap-1"><Clock size={14} /> {k.start_time}–{k.end_time} WITA</span>
              {k.location && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {k.location}</span>}
              {k.teacher && <span className="inline-flex items-center gap-1"><User size={14} /> {k.teacher}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-[#111114] leading-none">{c.ratio ?? 0}%</div>
            <div className="text-xs text-[#6B7280] mt-1">H {c.hadir ?? 0} · I {c.izin ?? 0} · A {c.alpha ?? 0}</div>
          </div>
        </div>
      </button>
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <button type="button" onClick={onOpen} className="text-sm font-semibold text-[#111114] inline-flex items-center gap-1.5 hover:underline">
          Buka kegiatan ini <ChevronRight size={16} />
        </button>
        {onSalin && (
          <button type="button" data-testid={`kegiatan-salin-${k.id}`} onClick={onSalin}
            className="h-9 px-3 rounded-lg border border-[#E8E8E4] bg-white text-xs font-semibold text-[#4B5563] inline-flex items-center gap-1.5 hover:border-[#111114] hover:text-[#111114]">
            <Copy size={13} /> Salin ke tanggal lain
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * FASE 9 — Kartu kegiatan 1 hari BEBERAPA WAKTU/SESI (pagi/sore/malam).
 *
 * Setiap sesi punya absensi, rekap, kode akses & barcode SENDIRI, sehingga
 * peserta yang hadir sesi pagi tidak otomatis terhitung hadir di sesi lain.
 * FASE 10 — tombol Rekap Gabungan 1 Hari & Salin Jadwal ke tanggal lain.
 */
function SessionGroupCard({ group, onOpen, onRekapGabungan, onSalin }) {
  const first = group.items[0];
  // Ringkasan cepat: hadir per sesi
  const totalHadir = group.items.reduce((n, k) => n + (k.counts?.hadir || 0), 0);
  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E4] p-4" data-testid={`kegiatan-sesi-group-${first.session_group_id}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[first.type]}1a`, color: TYPE_COLOR[first.type] }}>{TYPE_LABEL[first.type]}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] inline-flex items-center gap-1">
          <Layers size={12} /> {group.items.length} Waktu / Sesi
        </span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#111114]">{AUDIENCE_LABEL[first.audience] || "Reguler"}</span>
        <FilterBadges k={first} />
      </div>
      <h3 className="font-heading font-bold text-[#111827] mt-1.5">{first.base_name || first.name}</h3>
      <div className="text-sm text-[#6B7280] mt-1 flex flex-wrap gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> {tanggalSingkat(first.date)}</span>
        {first.location && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {first.location}</span>}
        {first.teacher && <span className="inline-flex items-center gap-1"><User size={14} /> {first.teacher}</span>}
      </div>

      <div className="mt-3 grid gap-2">
        {group.items.map((k) => {
          const c = k.counts || {};
          const meta = PHASE_META[phaseOf(k)];
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => onOpen(k.id)}
              data-testid={`kegiatan-card-${k.id}`}
              className="w-full text-left rounded-xl border-2 border-[#E8E8E4] bg-[#FAFAF8] px-3.5 py-3 hover:border-[#111114] hover:bg-[#FAFAF8] transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#111114]">{k.session_label || "Sesi"}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.badge}</span>
                  </div>
                  <div className="text-xs text-[#6B7280] mt-0.5 inline-flex items-center gap-1">
                    <Clock size={12} /> {k.start_time}–{k.end_time} WITA
                  </div>
                  {(k.teacher || k.material || k.location) && (
                    <div className="text-[11px] text-[#9CA3AF] mt-0.5 flex flex-wrap gap-x-2.5">
                      {k.teacher && <span className="inline-flex items-center gap-1"><User size={11} /> {k.teacher}</span>}
                      {k.location && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {k.location}</span>}
                      {k.material && <span className="truncate max-w-[160px]">{k.material}</span>}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-[#111114] leading-none">{c.ratio ?? 0}%</div>
                  <div className="text-[11px] text-[#6B7280] mt-0.5">H {c.hadir ?? 0} · I {c.izin ?? 0} · A {c.alpha ?? 0}</div>
                </div>
                <ChevronRight size={16} className="text-[#111114] shrink-0" />
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-[#9CA3AF] mt-2 leading-relaxed">
        Absensi, rekap, kode akses &amp; barcode <b>terpisah untuk setiap waktu/sesi</b>.
        Hadir di sesi pagi tidak dihitung sebagai hadir di sesi sore/malam.
      </p>
      {/* FASE 10 — aksi grup sesi */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" data-testid={`sesi-rekap-gabungan-${first.session_group_id}`} onClick={onRekapGabungan}
          className="h-11 rounded-xl bg-[#111114] text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#000000]">
          <FileBarChart2 size={15} /> Rekap Gabungan 1 Hari
          <span className="hidden sm:inline text-[11px] font-medium text-white/80">· {totalHadir} hadir</span>
        </button>
        <button type="button" data-testid={`sesi-salin-jadwal-${first.session_group_id}`} onClick={onSalin}
          className="h-11 rounded-xl border-2 border-[#111114] text-[#111114] font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#F1F1EE]">
          <Copy size={15} /> Salin ke Tanggal Lain
        </button>
      </div>
    </div>
  );
}

function CalendarMonth({ year, month, daysWithEvent, dayFilter, onPick }) {
  const first = new Date(year, month - 1, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  const pad = (d) => `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E4] p-4 mb-4" data-testid="calendar-month">
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[#9CA3AF] mb-1">
        {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map((h) => <div key={h} className="py-1">{h}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const ymd = pad(d);
          const count = daysWithEvent[ymd] || 0;
          const active = dayFilter === ymd;
          return (
            <button
              key={ymd}
              data-testid={`cal-day-${ymd}`}
              onClick={() => onPick(active ? "" : ymd)}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm relative transition-colors ${
                active ? "bg-[#111114] text-white" : count ? "bg-[#F1F1EE] text-[#111114] font-semibold hover:bg-[#d6efe0]" : "text-[#4B5563] hover:bg-[#F4F4F1]"
              }`}
            >
              {d}
              {count > 0 && <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-[#111114]"}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ModalShell({ title, children, onClose, testid, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className={`bg-[#FAFAF8] w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl`} onClick={(e) => e.stopPropagation()} data-testid={testid}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E8E8E4] px-5 py-3.5 flex items-center justify-between z-10">
          <h2 className="font-heading font-bold text-[#111827]">{title}</h2>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F4F4F1]"><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}


const STATUS_BTN = {
  hadir: { label: "Hadir", on: "bg-[#111114] text-white", off: "text-[#111114]" },
  izin: { label: "Izin", on: "bg-[#9CA3AF] text-white", off: "text-[#92400E]" },
  alpha: { label: "Alpha", on: "bg-[#DC2626] text-white", off: "text-[#991B1B]" },
};

export function AbsensiModal({ kegiatanId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [openManual, setOpenManual] = useState(true);

  const load = useCallback(() => {
    api.get(`/admin/kegiatan/${kegiatanId}/rekap`)
      .then(({ data: d }) => setData(d))
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  const mark = async (userId, status) => {
    setBusy(userId + status);
    try {
      const { data: res } = await api.post(`/admin/kegiatan/${kegiatanId}/absen`, { user_id: userId, status });
      // Fase 7: notifikasi HANYA untuk status "hadir" (izin & alpha tanpa notifikasi).
      if (res?.message) toast.success(res.message);
      await load();
      if (onChanged) onChanged();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(null); }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    return t ? data.rows.filter((r) => (r.name || "").toLowerCase().includes(t)) : data.rows;
  }, [data, q]);

  const k = data?.kegiatan;
  const c = data?.counts || {};

  return (
    <ModalShell title={k ? k.name : "Absensi"} onClose={onClose} testid="modal-absensi" wide>
      {!data ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={28} /></div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-xl bg-[#F4F4F1] p-3 text-center"><div className="text-xl font-bold text-[#111827]">{c.total}</div><div className="text-xs text-[#6B7280]">Total</div></div>
            <div className="rounded-xl bg-[#F1F1EE] p-3 text-center"><div className="text-xl font-bold text-[#111114]">{c.hadir}</div><div className="text-xs text-[#6B7280]">Hadir</div></div>
            <div className="rounded-xl bg-[#FEF3C7] p-3 text-center"><div className="text-xl font-bold text-[#92400E]">{c.izin}</div><div className="text-xs text-[#6B7280]">Izin</div></div>
            <div className="rounded-xl bg-[#FEE2E2] p-3 text-center"><div className="text-xl font-bold text-[#991B1B]">{c.alpha}</div><div className="text-xs text-[#6B7280]">Alpha</div></div>
          </div>

          {/* Absen manual — bisa dibuka/tutup */}
          <div className="bg-white rounded-2xl border border-[#E8E8E4] overflow-hidden" data-testid="absen-manual-section">
            <button
              data-testid="absen-manual-toggle"
              onClick={() => setOpenManual((v) => !v)}
              className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#FAFAF8]"
            >
              <span className="flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-xl bg-[#F1F1EE] text-[#111114] flex items-center justify-center"><CheckCircle2 size={18} /></span>
                <span>
                  <span className="block font-bold text-[#111827] text-[15px]">Absen Manual</span>
                  <span className="block text-xs text-[#6B7280]">Tandai Hadir / Izin / Alpha per peserta</span>
                </span>
              </span>
              <ChevronDown size={20} className={`text-[#6B7280] transition-transform ${openManual ? "rotate-180" : ""}`} />
            </button>

            {openManual && (
              <div className="border-t border-[#E8E8E4]">
                <div className="p-3 bg-[#FAFAF8]">
                  <div className="relative">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                    <input data-testid="absensi-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama peserta..." className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-[#E8E8E4] outline-none focus:border-[#111114] bg-white" />
                  </div>
                </div>
                <div className="divide-y divide-[#ECECE8] max-h-[46vh] overflow-y-auto">
                  {rows.length === 0 ? (
                    <div className="p-8 text-center text-[#6B7280] text-sm">Tidak ada peserta.</div>
                  ) : rows.map((r) => (
                    <div key={r.user_id} data-testid={`absensi-row-${r.user_id}`} className="px-4 py-3 grid grid-cols-[1fr_auto_auto] items-center gap-4">
                      <div className="min-w-0">
                        <div className="font-semibold text-[#111827] text-sm truncate">{r.name}</div>
                        <div className="text-xs text-[#9CA3AF] flex items-center gap-1.5">
                          {r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : "—"}
                          {r.account_status === "pending" && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#92400E]">
                              <AlertTriangle size={11} /> Belum aktivasi
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-14 text-center font-mono text-[13px] tabular-nums text-[#4B5563]">
                        {r.status === "hadir" && r.arrival_time ? hhmm(r.arrival_time) : "—"}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {["hadir", "izin", "alpha"].map((s) => {
                          const active = r.status === s;
                          const cfg = STATUS_BTN[s];
                          return (
                            <button
                              key={s}
                              data-testid={`btn-${s}-${r.user_id}`}
                              disabled={busy === r.user_id + s}
                              onClick={() => mark(r.user_id, s)}
                              className={`h-8 px-2.5 rounded-lg text-xs font-bold border-2 transition-colors ${active ? `${cfg.on} border-transparent` : `bg-white ${cfg.off} border-[#E8E8E4] hover:border-current`}`}
                            >
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function FeedbackModal({ kegiatan, onClose }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.get(`/admin/kegiatan/${kegiatan.id}/feedback`)
      .then(({ data }) => setItems(data || []))
      .catch((e) => { toast.error(formatApiErrorDetail(e.response?.data?.detail)); setItems([]); });
  }, [kegiatan.id]);

  return (
    <ModalShell title="Kotak Pesan / Saran" onClose={onClose} testid="modal-feedback">
      <div className="text-sm text-[#6B7280] mb-3">
        Pesan &amp; saran dari peserta untuk <b className="text-[#111827]">{kegiatan.name}</b>.
      </div>
      {items === null ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={28} /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E8E8E4] bg-[#FAFAF8] p-8 text-center text-sm text-[#9CA3AF]">
          Belum ada pesan / saran dari peserta.
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E8E8E4] bg-white divide-y divide-[#ECECE8] max-h-[60vh] overflow-y-auto" data-testid="feedback-list">
          {items.map((f) => (
            <div key={f.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-[#111827] text-sm">{f.name}</div>
                <div className="text-xs text-[#9CA3AF]">{f.created_at ? hhmm(f.created_at) : ""}</div>
              </div>
              <p className="text-sm text-[#4B5563] mt-0.5 whitespace-pre-wrap break-words">{f.message}</p>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}

function QrModal({ data, onClose }) {
  const download = () => {
    const a = document.createElement("a");
    a.href = data.image;
    a.download = `qr_${(data.name || "kegiatan").replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const copy = () => { navigator.clipboard.writeText(data.link); toast.success("Link disalin"); };
  const shareWa = () => {
    const text = data.wa_text || `Assalamu'alaikum warahmatullahi wabarakatuh\n\nBerikut laporan ${data.name || "kegiatan"}\n${data.link}\n\nAlhamdulillah, jazakumullahu khoiro.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };
  return (
    <ModalShell title="QR Rekap Kegiatan" onClose={onClose} testid="modal-qr">
      <div className="text-center">
        <img src={data.image} alt="QR Kegiatan" className="mx-auto w-56 h-56 rounded-xl border border-[#E8E8E4] p-2" data-testid="qr-image" />
        <p className="text-sm text-[#6B7280] mt-3 break-all px-2">{data.link}</p>
        <p className="text-xs text-[#9CA3AF] mt-1">Tautan rekap berlaku 7 hari.</p>
        <div className="flex gap-2 mt-4">
          <button onClick={copy} className="flex-1 h-11 rounded-xl border-2 border-[#111114] text-[#111114] font-semibold flex items-center justify-center gap-2 hover:bg-[#F1F1EE]"><Copy size={16} /> Salin Link</button>
          <button onClick={download} className="flex-1 h-11 rounded-xl bg-[#111114] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#000000]"><Download size={16} /> Unduh QR</button>
        </div>
        <button data-testid="qr-share-wa" onClick={shareWa} className="mt-2 w-full h-11 rounded-xl bg-[#25D366] text-white font-semibold flex items-center justify-center gap-2 hover:brightness-95"><Send size={16} /> Bagikan lewat WhatsApp</button>
      </div>
    </ModalShell>
  );
}

function AbsenQrModal({ data, onClose }) {
  const download = () => {
    const a = document.createElement("a");
    a.href = data.image;
    a.download = `absen_${(data.name || "kegiatan").replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const copy = () => { navigator.clipboard.writeText(data.link); toast.success("Link absen disalin"); };
  return (
    <ModalShell title="QR Absen Mandiri" onClose={onClose} testid="modal-absen-qr">
      <div className="text-center">
        <img src={data.image} alt="QR Absen" className="mx-auto w-56 h-56 rounded-xl border border-[#E8E8E4] p-2" data-testid="absen-qr-image" />
        <div className="mt-3 bg-[#FAFAF8] border border-[#E8E8E4] rounded-xl p-3 text-left">
          <p className="text-sm font-semibold text-[#111114] flex items-center gap-1.5"><ScanLine size={15} /> Cara absen mandiri</p>
          <p className="text-xs text-[#4B5563] mt-1 leading-relaxed">
            Peserta scan QR ini dengan kamera HP lalu <b>masuk dengan akunnya sendiri</b>.
            Halaman absen hanya menampilkan <b>nama peserta itu sendiri</b> dengan tombol
            <b> Saya Hadir</b> — sehingga tidak bisa menitipkan absen orang lain.
            QR kegiatan ini <b>berlaku 1 hari</b>{data.expires_at ? <> (hanya untuk tanggal {tanggalSingkat(String(data.expires_at).slice(0, 10))})</> : null}
            {data.sessions > 1 ? <>, dan <b>1 QR dipakai semua sesi</b> hari itu — halaman absen otomatis mengarah ke sesi yang sedang berjalan.</> : "."}
          </p>
        </div>
        <p className="text-xs text-[#9CA3AF] mt-2 break-all px-2">{data.link}</p>
        <div className="flex gap-2 mt-4">
          <button onClick={copy} className="flex-1 h-11 rounded-xl border-2 border-[#111114] text-[#111114] font-semibold flex items-center justify-center gap-2 hover:bg-[#F1F1EE]"><Copy size={16} /> Salin Link</button>
          <button onClick={download} className="flex-1 h-11 rounded-xl bg-[#111114] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#000000]"><Download size={16} /> Unduh QR</button>
        </div>
      </div>
    </ModalShell>
  );
}

/**
 * FASE 7 — Bagikan Kegiatan + Kode Akses Absensi (6 digit).
 *
 * Pemegang tautan memasukkan kode akses lalu langsung melihat daftar peserta
 * (aktif maupun belum aktivasi) untuk diabsen manual / scan barcode.
 * Kode berlaku sampai kegiatan ditutup/selesai dan bisa diperbarui kapan pun.
 */
function ShareAbsensiModal({ data, onClose }) {
  const [info, setInfo] = useState(data);
  const [busy, setBusy] = useState(false);

  const copyLink = () => { navigator.clipboard.writeText(info.link); toast.success("Tautan absensi disalin"); };
  const copyCode = () => { navigator.clipboard.writeText(info.code); toast.success("Kode akses disalin"); };
  const download = () => {
    const a = document.createElement("a");
    a.href = info.image;
    a.download = `absensi_${(info.kegiatan_name || "kegiatan").replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const shareWa = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(info.wa_text || info.link)}`, "_blank");
  };
  const regenerate = async () => {
    setBusy(true);
    try {
      const { data: d } = await api.post(`/admin/kegiatan/${info.kegiatan_id}/access/regenerate`);
      setInfo({ ...d, kegiatan_id: info.kegiatan_id });
      toast.success("Kode akses baru dibuat. Kode lama sudah tidak berlaku.");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(false); }
  };

  return (
    <ModalShell title="Bagikan Kegiatan + Kode Akses" onClose={onClose} testid="modal-akses">
      <div className="text-center">
        <img src={info.image} alt="QR Absensi Kegiatan" className="mx-auto w-52 h-52 rounded-xl border border-[#E8E8E4] p-2" data-testid="akses-qr-image" />

        <div className="mt-4 rounded-2xl border-2 border-dashed border-[#111114] bg-[#FAFAF8] p-4">
          <div className="text-xs font-semibold text-[#111114] flex items-center justify-center gap-1.5">
            <KeyRound size={14} /> KODE AKSES ABSENSI
          </div>
          <div className="mt-1 text-3xl font-bold tracking-[0.35em] text-[#111114]" data-testid="akses-code">{info.code}</div>
          <div className="text-xs text-[#4B5563] mt-1">
            Berlaku sampai kegiatan <b>ditutup/selesai</b>
            {info.valid_until ? <> · jadwal selesai {tanggalSingkat(String(info.valid_until).slice(0, 10))} {String(info.valid_until).slice(11, 16)} WITA</> : null}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={copyCode} data-testid="akses-copy-code" className="flex-1 h-10 rounded-xl border-2 border-[#111114] text-[#111114] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#F1F1EE]"><Copy size={15} /> Salin Kode</button>
            <button onClick={regenerate} disabled={busy} data-testid="akses-regenerate" className="flex-1 h-10 rounded-xl bg-[#111114] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#000000] disabled:opacity-60">
              {busy ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />} Perbarui Kode
            </button>
          </div>
        </div>

        <div className="mt-3 bg-white border border-[#E8E8E4] rounded-xl p-3 text-left">
          <p className="text-xs text-[#4B5563] leading-relaxed">
            Penerima tautan memasukkan kode akses ini, lalu langsung melihat <b>daftar peserta</b> —
            termasuk peserta yang <b>belum aktivasi</b> — untuk diabsen <b>manual</b> atau lewat
            <b> scan barcode</b> QR pribadi peserta.
          </p>
        </div>

        <p className="text-xs text-[#9CA3AF] mt-2 break-all px-2">{info.link}</p>

        <div className="flex gap-2 mt-3">
          <button onClick={copyLink} data-testid="akses-copy-link" className="flex-1 h-11 rounded-xl border-2 border-[#111114] text-[#111114] font-semibold flex items-center justify-center gap-2 hover:bg-[#F1F1EE]"><Copy size={16} /> Salin Link</button>
          <button onClick={download} data-testid="akses-download" className="flex-1 h-11 rounded-xl border-2 border-[#E8E8E4] text-[#4B5563] font-semibold flex items-center justify-center gap-2 hover:border-[#111114] hover:text-[#111114]"><Download size={16} /> Unduh QR</button>
        </div>
        <button onClick={shareWa} data-testid="akses-share-wa" className="mt-2 w-full h-11 rounded-xl bg-[#25D366] text-white font-semibold flex items-center justify-center gap-2 hover:brightness-95"><Send size={16} /> Bagikan lewat WhatsApp</button>
      </div>
    </ModalShell>
  );
}
