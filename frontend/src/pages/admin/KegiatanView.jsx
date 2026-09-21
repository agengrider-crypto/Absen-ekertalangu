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
import { ReminderModal, DelegasiModal, ScanPesertaModal } from "./KegiatanExtras";
import { RekapGabunganModal, SalinJadwalModal } from "./SesiExtras";
import ActionModal from "@/components/ActionModal";
import { Send as SendIcon, ShieldCheck as ShieldIcon, ScanLine as ScanIcon } from "lucide-react";

const inp = "w-full h-[46px] px-3.5 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A] bg-white";
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
        <div className="flex items-center gap-2 text-[#0D5C3A] font-bold text-lg">
          <CalendarDays size={20} /> Kegiatan
        </div>
        <button data-testid="button-add-kegiatan" onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm hover:bg-[#094229]">
          <Plus size={17} /> Tambah Kegiatan
        </button>
      </div>

      {/* Month nav + view toggle */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button data-testid="button-prev-month" onClick={() => shiftMonth(-1)} className="h-10 w-10 flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white hover:border-[#0D5C3A]"><ChevronLeft size={18} /></button>
          <div className="font-semibold text-[#111827] min-w-[150px] text-center">{MONTH_SHORT[m - 1]} {y}</div>
          <button data-testid="button-next-month" onClick={() => shiftMonth(1)} className="h-10 w-10 flex items-center justify-center rounded-xl border border-[#E5E7EB] bg-white hover:border-[#0D5C3A]"><ChevronRight size={18} /></button>
        </div>
        <div className="flex items-center gap-1 bg-white border border-[#E5E7EB] rounded-xl p-1">
          <button data-testid="view-list" onClick={() => setView("list")} className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold ${view === "list" ? "bg-[#E8F5EE] text-[#065F46]" : "text-[#6B7280]"}`}><List size={16} /> List</button>
          <button data-testid="view-calendar" onClick={() => setView("calendar")} className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold ${view === "calendar" ? "bg-[#E8F5EE] text-[#065F46]" : "text-[#6B7280]"}`}><Grid3x3 size={16} /> Kalender</button>
        </div>
      </div>

      {view === "calendar" && (
        <CalendarMonth year={y} month={m} daysWithEvent={daysWithEvent} dayFilter={dayFilter} onPick={setDayFilter} />
      )}

      {dayFilter && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-[#6B7280]">Menampilkan:</span>
          <span className="font-semibold text-[#0D5C3A]">{tanggalPanjang(dayFilter)}</span>
          <button onClick={() => setDayFilter("")} className="text-[#DC2626] font-semibold hover:underline">Tampilkan semua</button>
        </div>
      )}

      {/* List */}
      {items === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={30} /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center text-[#6B7280]">Belum ada kegiatan pada periode ini.</div>
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
      className="w-full text-left bg-white rounded-2xl border border-[#E5E7EB] p-4 hover:border-[#0D5C3A] hover:bg-[#FAFCFA] transition-colors"
      data-testid={`kegiatan-card-${k.id}`}
    >
      <button type="button" onClick={onOpen} className="w-full text-left" data-testid={`kegiatan-card-open-${k.id}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>{TYPE_LABEL[k.type]}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PHASE_META[phaseOf(k)].cls}`}>{PHASE_META[phaseOf(k)].badge}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#3730A3]">{AUDIENCE_LABEL[k.audience] || "Reguler"}</span>
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
            <div className="text-2xl font-bold text-[#0D5C3A] leading-none">{c.ratio ?? 0}%</div>
            <div className="text-xs text-[#6B7280] mt-1">H {c.hadir ?? 0} · I {c.izin ?? 0} · A {c.alpha ?? 0}</div>
          </div>
        </div>
      </button>
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <button type="button" onClick={onOpen} className="text-sm font-semibold text-[#0D5C3A] inline-flex items-center gap-1.5 hover:underline">
          Buka kegiatan ini <ChevronRight size={16} />
        </button>
        {onSalin && (
          <button type="button" data-testid={`kegiatan-salin-${k.id}`} onClick={onSalin}
            className="h-9 px-3 rounded-lg border border-[#E5E7EB] bg-white text-xs font-semibold text-[#4B5563] inline-flex items-center gap-1.5 hover:border-[#0D5C3A] hover:text-[#0D5C3A]">
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
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4" data-testid={`kegiatan-sesi-group-${first.session_group_id}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[first.type]}1a`, color: TYPE_COLOR[first.type] }}>{TYPE_LABEL[first.type]}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] inline-flex items-center gap-1">
          <Layers size={12} /> {group.items.length} Waktu / Sesi
        </span>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#3730A3]">{AUDIENCE_LABEL[first.audience] || "Reguler"}</span>
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
              className="w-full text-left rounded-xl border-2 border-[#E5E7EB] bg-[#FAFBF9] px-3.5 py-3 hover:border-[#0D5C3A] hover:bg-[#F0FAF4] transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#0D5C3A]">{k.session_label || "Sesi"}</span>
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
                  <div className="text-lg font-bold text-[#0D5C3A] leading-none">{c.ratio ?? 0}%</div>
                  <div className="text-[11px] text-[#6B7280] mt-0.5">H {c.hadir ?? 0} · I {c.izin ?? 0} · A {c.alpha ?? 0}</div>
                </div>
                <ChevronRight size={16} className="text-[#0D5C3A] shrink-0" />
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
          className="h-11 rounded-xl bg-[#0D5C3A] text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#094229]">
          <FileBarChart2 size={15} /> Rekap Gabungan 1 Hari
          <span className="hidden sm:inline text-[11px] font-medium text-white/80">· {totalHadir} hadir</span>
        </button>
        <button type="button" data-testid={`sesi-salin-jadwal-${first.session_group_id}`} onClick={onSalin}
          className="h-11 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#E8F5EE]">
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
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mb-4" data-testid="calendar-month">
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
                active ? "bg-[#0D5C3A] text-white" : count ? "bg-[#E8F5EE] text-[#065F46] font-semibold hover:bg-[#d6efe0]" : "text-[#4B5563] hover:bg-[#F2F5F2]"
              }`}
            >
              {d}
              {count > 0 && <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-[#0D5C3A]"}`} />}
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
      <div className={`bg-[#FAFBF9] w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"} sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl`} onClick={(e) => e.stopPropagation()} data-testid={testid}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E5E7EB] px-5 py-3.5 flex items-center justify-between z-10">
          <h2 className="font-heading font-bold text-[#111827]">{title}</h2>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F2F5F2]"><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function KegiatanFormModal({ onClose, onDone, initial }) {
  const editing = Boolean(initial?.id);
  const [f, setF] = useState({
    name: initial?.name || "", type: initial?.type || "rutin",
    date: initial?.date || todayYmd(), start_time: initial?.start_time || "20:00",
    end_time: initial?.end_time || "21:30", teacher: initial?.teacher || "",
    material: initial?.material || "", location: initial?.location || "", recurring: false,
    audience: initial?.audience || "reguler",
    gender_filter: initial?.gender_filter || "semua",
    // FASE 9 — pengelompokan lanjutan
    marital_filter: initial?.marital_filter || "semua",
    age_filter: initial?.age_filter || [],
  });
  // FASE 9 — beberapa waktu/sesi dalam 1 hari
  const [multi, setMulti] = useState(false);
  const [sessions, setSessions] = useState([
    { label: "Pagi", start_time: "08:00", end_time: "10:00", teacher: "", material: "", location: "", required: true },
    { label: "Sore", start_time: "16:00", end_time: "17:30", teacher: "", material: "", location: "", required: true },
  ]);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const toggleAge = (val) => setF((p) => {
    const cur = p.age_filter || [];
    return { ...p, age_filter: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] };
  });

  const setSession = (i, key, val) => setSessions((p) => p.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)));
  const addSession = () => setSessions((p) => {
    const used = p.map((s) => s.label);
    const next = SESSION_LABEL_PRESETS.find((l) => !used.includes(l)) || `Sesi ${p.length + 1}`;
    const [st, en] = SESSION_DEFAULT_TIME[next] || ["08:00", "10:00"];
    return [...p, { label: next, start_time: st, end_time: en, teacher: "", material: "", location: "", required: true }];
  });
  const removeSession = (i) => setSessions((p) => p.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) { toast.error("Nama kegiatan wajib diisi"); return; }
    if (!editing && multi) {
      if (sessions.length < 2) { toast.error("Minimal 2 waktu/sesi bila memakai beberapa waktu"); return; }
      if (sessions.some((s) => !String(s.label).trim())) { toast.error("Nama setiap waktu/sesi wajib diisi"); return; }
    }
    setSaving(true);
    try {
      if (editing) {
        const { recurring, ...payload } = f;
        await api.patch(`/admin/kegiatan/${initial.id}`, payload);
        toast.success("Kegiatan diperbarui.");
      } else {
        const payload = { ...f, sessions: multi ? sessions : [] };
        const { data } = await api.post("/admin/kegiatan", payload);
        const parts = [];
        if (multi) parts.push(`${sessions.length} waktu/sesi`);
        if (f.recurring) parts.push("berulang 4 minggu");
        toast.success(`Kegiatan dibuat${parts.length ? ` (${parts.join(", ")}, total ${data.length} jadwal)` : ""}.`);
      }
      onDone();
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title={editing ? "Edit Kegiatan" : "Tambah Kegiatan"} onClose={onClose} testid={editing ? "modal-edit-kegiatan" : "modal-add-kegiatan"}>
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
        <input data-testid="keg-name" required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama Kegiatan *" className={`${inp} sm:col-span-2`} />
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Jenis</label>
          <select data-testid="keg-type" value={f.type} onChange={(e) => set("type", e.target.value)} className={inp}>
            {KEGIATAN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Tanggal</label>
          <input data-testid="keg-date" type="date" required value={f.date} onChange={(e) => set("date", e.target.value)} className={inp} />
        </div>
        {!editing && multi ? (
          <div className="rounded-xl border-2 border-[#CDEBD9] bg-[#F0FAF4] px-3.5 py-3 text-xs text-[#065F46] leading-relaxed flex items-center">
            Jam kegiatan diatur pada daftar <b className="mx-1">Waktu / Sesi</b> di bawah.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-semibold text-[#111827] mb-1.5">Mulai (WITA)</label>
              <select data-testid="keg-start" value={f.start_time} onChange={(e) => set("start_time", e.target.value)} className={inp}>
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#111827] mb-1.5">Selesai (WITA)</label>
              <select data-testid="keg-end" value={f.end_time} onChange={(e) => set("end_time", e.target.value)} className={inp}>
                {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* FASE 9 — 1 hari beberapa waktu/sesi (pengajian pagi / sore / malam) */}
        {!editing && (
          <div className="sm:col-span-2 rounded-xl border-2 border-[#E5E7EB] bg-white p-3.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input data-testid="keg-multi-session" type="checkbox" className="accent-[#0D5C3A] w-4 h-4 mt-0.5"
                checked={multi} onChange={(e) => setMulti(e.target.checked)} />
              <span>
                <span className="block text-sm font-bold text-[#111827] inline-flex items-center gap-1.5">
                  <Layers size={15} className="text-[#0D5C3A]" /> Beberapa waktu dalam 1 hari (pagi / sore / malam)
                </span>
                <span className="block text-xs text-[#6B7280] mt-1 leading-relaxed">
                  Setiap waktu menjadi <b>sesi tersendiri</b>: absensi, rekap, kode akses, dan barcode
                  <b> terpisah</b>. Jamaah yang hadir sesi pagi <b>tidak</b> otomatis terhitung hadir di
                  sesi sore/malam, dan jamaah lain tetap tampil pada rekap sesi berikutnya.
                </span>
              </span>
            </label>

            {multi && (
              <div className="mt-3 space-y-2" data-testid="keg-session-list">
                {sessions.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.1fr_1fr_1fr_auto] gap-2 items-end rounded-xl bg-[#FAFBF9] border border-[#E5E7EB] p-2.5" data-testid={`keg-session-row-${i}`}>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Nama waktu</label>
                      <input data-testid={`keg-session-label-${i}`} list="session-presets" value={s.label}
                        onChange={(e) => setSession(i, "label", e.target.value)}
                        placeholder="Pagi / Sore / Malam"
                        className="w-full h-11 px-3 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] bg-white" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Mulai</label>
                      <select data-testid={`keg-session-start-${i}`} value={s.start_time} onChange={(e) => setSession(i, "start_time", e.target.value)}
                        className="w-full h-11 px-2 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] bg-white">
                        {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Selesai</label>
                      <select data-testid={`keg-session-end-${i}`} value={s.end_time} onChange={(e) => setSession(i, "end_time", e.target.value)}
                        className="w-full h-11 px-2 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] bg-white">
                        {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <button type="button" data-testid={`keg-session-remove-${i}`} onClick={() => removeSession(i)}
                      disabled={sessions.length <= 2}
                      className="h-11 w-11 flex items-center justify-center rounded-xl border-2 border-[#E5E7EB] text-[#DC2626] hover:border-[#DC2626] disabled:opacity-40 disabled:cursor-not-allowed bg-white">
                      <Trash2 size={16} />
                    </button>
                    {/* FASE 12 — pengajar / materi / lokasi per sesi */}
                    <div className="col-span-2 sm:col-span-4 grid sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Pengajar sesi ini</label>
                        <input data-testid={`keg-session-teacher-${i}`} value={s.teacher || ""}
                          onChange={(e) => setSession(i, "teacher", e.target.value)} placeholder="cth: Ust. Ahmad"
                          className="w-full h-11 px-3 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] bg-white" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Materi sesi ini</label>
                        <input data-testid={`keg-session-material-${i}`} value={s.material || ""}
                          onChange={(e) => setSession(i, "material", e.target.value)} placeholder="cth: Tafsir Al-Baqarah"
                          className="w-full h-11 px-3 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] bg-white" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Lokasi sesi ini</label>
                        <input data-testid={`keg-session-location-${i}`} value={s.location || ""}
                          onChange={(e) => setSession(i, "location", e.target.value)} placeholder="cth: Masjid Kertalangu"
                          className="w-full h-11 px-3 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] bg-white" />
                      </div>
                      <p className="sm:col-span-3 text-[11px] text-[#9CA3AF] leading-relaxed">
                        Dikosongkan = memakai pengajar / materi / lokasi kegiatan di bawah.
                      </p>
                      <label className="sm:col-span-3 flex items-start gap-2.5 rounded-xl border-2 border-[#E5E7EB] bg-white px-3 py-2.5 cursor-pointer hover:border-[#0D5C3A]">
                        <input type="checkbox" data-testid={`keg-session-required-${i}`}
                          checked={s.required !== false}
                          onChange={(e) => setSession(i, "required", e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-[#0D5C3A]" />
                        <span className="leading-snug">
                          <span className="block text-xs font-bold text-[#111827]">Sesi ini WAJIB dihadiri</span>
                          <span className="block text-[11px] text-[#6B7280]">
                            Dicentang = jamaah wajib hadir (muncul tanda “Wajib {s.label || "sesi"}” di rekap gabungan).
                            Dilepas = sesi opsional/tambahan, tidak dihitung Alpha.
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
                <datalist id="session-presets">
                  {SESSION_LABEL_PRESETS.map((l) => <option key={l} value={l} />)}
                </datalist>
                <button type="button" data-testid="keg-session-add" onClick={addSession} disabled={sessions.length >= 6}
                  className="w-full h-11 rounded-xl border-2 border-dashed border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#E8F5EE] disabled:opacity-40">
                  <Plus size={16} /> Tambah Waktu / Sesi
                </button>
              </div>
            )}
          </div>
        )}
        <input data-testid="keg-teacher" value={f.teacher} onChange={(e) => set("teacher", e.target.value)} placeholder="Pengajar" className={inp} />
        <input data-testid="keg-material" value={f.material} onChange={(e) => set("material", e.target.value)} placeholder="Materi" className={inp} />
        <input data-testid="keg-location" value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Lokasi" className={`${inp} sm:col-span-2`} />

        {/* FASE 8 — Tipe peserta kegiatan */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Tipe Peserta Kegiatan</label>
          <select data-testid="keg-audience" value={f.audience} onChange={(e) => set("audience", e.target.value)} className={inp}>
            {AUDIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
            {AUDIENCE_OPTIONS.find((o) => o.value === f.audience)?.desc}
          </p>
        </div>

        {/* FASE 8 — Penyaringan jenis kelamin */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Khusus Jenis Kelamin</label>
          <div className="grid grid-cols-3 gap-2">
            {GENDER_FILTER_OPTIONS.map((o) => {
              const on = f.gender_filter === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  data-testid={`keg-gender-${o.value}`}
                  onClick={() => set("gender_filter", o.value)}
                  className={`h-11 rounded-xl border-2 font-semibold text-xs sm:text-sm transition-colors ${
                    on ? "bg-[#0D5C3A] text-white border-transparent" : "bg-white text-[#4B5563] border-[#E5E7EB] hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
                  }`}
                >
                  {o.short}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
            Bila dipilih khusus laki-laki / perempuan, maka daftar absen, halaman
            absensi, dan laporan kegiatan ini hanya berisi jamaah sesuai pilihan tersebut.
          </p>
        </div>

        {/* FASE 9 — PENGELOMPOKAN LANJUTAN (aktif) */}
        <div className="sm:col-span-2 rounded-xl border-2 border-[#CDEBD9] bg-[#F0FAF4] p-3.5" data-testid="keg-advanced-group">
          <div className="flex items-center gap-2 text-sm font-bold text-[#065F46]">
            <SlidersHorizontal size={15} /> Pengelompokan Lanjutan
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#0D5C3A] text-white">AKTIF</span>
          </div>
          <p className="text-xs text-[#4B5563] mt-1.5 leading-relaxed">
            Khususkan kegiatan menurut <b>status pernikahan</b> dan/atau <b>kelompok usia</b>.
            Daftar absen, halaman absensi, jadwal peserta, dan laporan otomatis hanya
            berisi jamaah yang sesuai.
          </p>

          {/* Status pernikahan */}
          <div className="mt-3">
            <label className="block text-xs font-bold text-[#111827] mb-1.5">Status Pernikahan</label>
            <div className="grid grid-cols-3 gap-2">
              {MARITAL_FILTER_OPTIONS.map((o) => {
                const on = f.marital_filter === o.value;
                return (
                  <button key={o.value} type="button" data-testid={`keg-marital-${o.value}`}
                    onClick={() => set("marital_filter", o.value)}
                    className={`h-11 rounded-xl border-2 font-semibold text-xs transition-colors ${
                      on ? "bg-[#0D5C3A] text-white border-transparent" : "bg-white text-[#4B5563] border-[#E5E7EB] hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
                    }`}>
                    {o.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kelompok usia */}
          <div className="mt-3">
            <label className="block text-xs font-bold text-[#111827] mb-1.5">
              Kelompok Usia <span className="font-normal text-[#6B7280]">(boleh pilih lebih dari satu · tidak dipilih = semua usia)</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AGE_GROUP_OPTIONS.map((o) => {
                const on = (f.age_filter || []).includes(o.value);
                return (
                  <button key={o.value} type="button" data-testid={`keg-age-${o.value}`}
                    onClick={() => toggleAge(o.value)}
                    className={`h-12 rounded-xl border-2 font-semibold text-xs transition-colors flex flex-col items-center justify-center leading-tight ${
                      on ? "bg-[#0D5C3A] text-white border-transparent" : "bg-white text-[#4B5563] border-[#E5E7EB] hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
                    }`}>
                    <span>{o.label}</span>
                    <span className={`text-[10px] font-medium ${on ? "text-white/80" : "text-[#9CA3AF]"}`}>{o.range}</span>
                  </button>
                );
              })}
              {(f.age_filter || []).length > 0 && (
                <button type="button" data-testid="keg-age-reset" onClick={() => set("age_filter", [])}
                  className="h-12 rounded-xl border-2 border-dashed border-[#9CA3AF] text-[#6B7280] font-semibold text-xs hover:border-[#DC2626] hover:text-[#DC2626] bg-white">
                  Semua Usia
                </button>
              )}
            </div>
            <p className="text-[11px] text-[#92400E] mt-2 leading-relaxed bg-[#FEF3C7] rounded-lg px-2.5 py-2 inline-flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>
                Usia dihitung otomatis dari <b>tanggal lahir</b>, dan status pernikahan dari data
                profil jamaah. Jamaah yang datanya <b>belum diisi</b> tidak masuk daftar kegiatan
                khusus ini — lengkapi dulu di menu Peserta.
              </span>
            </p>
          </div>
        </div>
        {!editing && (
          <label className="sm:col-span-2 flex items-center gap-2.5 px-3.5 h-12 rounded-xl border-2 border-[#E5E7EB] cursor-pointer bg-white">
            <input data-testid="keg-recurring" type="checkbox" className="accent-[#0D5C3A] w-4 h-4" checked={f.recurring} onChange={(e) => set("recurring", e.target.checked)} />
            <span className="text-sm font-semibold text-[#111827]">Kegiatan berulang (4 minggu, mingguan)</span>
          </label>
        )}
        <button data-testid="button-submit-kegiatan" type="submit" disabled={saving}
          className="sm:col-span-2 h-12 rounded-xl bg-[#0D5C3A] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60">
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} {editing ? "Simpan Perubahan" : "Simpan Kegiatan"}
        </button>
      </form>
    </ModalShell>
  );
}

const STATUS_BTN = {
  hadir: { label: "Hadir", on: "bg-[#0D5C3A] text-white", off: "text-[#065F46]" },
  izin: { label: "Izin", on: "bg-[#D97706] text-white", off: "text-[#92400E]" },
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
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={28} /></div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-xl bg-[#F2F5F2] p-3 text-center"><div className="text-xl font-bold text-[#111827]">{c.total}</div><div className="text-xs text-[#6B7280]">Total</div></div>
            <div className="rounded-xl bg-[#E8F5EE] p-3 text-center"><div className="text-xl font-bold text-[#065F46]">{c.hadir}</div><div className="text-xs text-[#6B7280]">Hadir</div></div>
            <div className="rounded-xl bg-[#FEF3C7] p-3 text-center"><div className="text-xl font-bold text-[#92400E]">{c.izin}</div><div className="text-xs text-[#6B7280]">Izin</div></div>
            <div className="rounded-xl bg-[#FEE2E2] p-3 text-center"><div className="text-xl font-bold text-[#991B1B]">{c.alpha}</div><div className="text-xs text-[#6B7280]">Alpha</div></div>
          </div>

          {/* Absen manual — bisa dibuka/tutup */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden" data-testid="absen-manual-section">
            <button
              data-testid="absen-manual-toggle"
              onClick={() => setOpenManual((v) => !v)}
              className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#FAFBF9]"
            >
              <span className="flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-xl bg-[#E8F5EE] text-[#0D5C3A] flex items-center justify-center"><CheckCircle2 size={18} /></span>
                <span>
                  <span className="block font-bold text-[#111827] text-[15px]">Absen Manual</span>
                  <span className="block text-xs text-[#6B7280]">Tandai Hadir / Izin / Alpha per peserta</span>
                </span>
              </span>
              <ChevronDown size={20} className={`text-[#6B7280] transition-transform ${openManual ? "rotate-180" : ""}`} />
            </button>

            {openManual && (
              <div className="border-t border-[#E5E7EB]">
                <div className="p-3 bg-[#FAFBF9]">
                  <div className="relative">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                    <input data-testid="absensi-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama peserta..." className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A] bg-white" />
                  </div>
                </div>
                <div className="divide-y divide-[#F1F2F0] max-h-[46vh] overflow-y-auto">
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
                              className={`h-8 px-2.5 rounded-lg text-xs font-bold border-2 transition-colors ${active ? `${cfg.on} border-transparent` : `bg-white ${cfg.off} border-[#E5E7EB] hover:border-current`}`}
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
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={28} /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#FAFBF9] p-8 text-center text-sm text-[#9CA3AF]">
          Belum ada pesan / saran dari peserta.
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white divide-y divide-[#F1F2F0] max-h-[60vh] overflow-y-auto" data-testid="feedback-list">
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
        <img src={data.image} alt="QR Kegiatan" className="mx-auto w-56 h-56 rounded-xl border border-[#E5E7EB] p-2" data-testid="qr-image" />
        <p className="text-sm text-[#6B7280] mt-3 break-all px-2">{data.link}</p>
        <p className="text-xs text-[#9CA3AF] mt-1">Tautan rekap berlaku 7 hari.</p>
        <div className="flex gap-2 mt-4">
          <button onClick={copy} className="flex-1 h-11 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold flex items-center justify-center gap-2 hover:bg-[#E8F5EE]"><Copy size={16} /> Salin Link</button>
          <button onClick={download} className="flex-1 h-11 rounded-xl bg-[#0D5C3A] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#094229]"><Download size={16} /> Unduh QR</button>
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
        <img src={data.image} alt="QR Absen" className="mx-auto w-56 h-56 rounded-xl border border-[#E5E7EB] p-2" data-testid="absen-qr-image" />
        <div className="mt-3 bg-[#F0FAF4] border border-[#CDEBD9] rounded-xl p-3 text-left">
          <p className="text-sm font-semibold text-[#065F46] flex items-center gap-1.5"><ScanLine size={15} /> Cara absen mandiri</p>
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
          <button onClick={copy} className="flex-1 h-11 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold flex items-center justify-center gap-2 hover:bg-[#E8F5EE]"><Copy size={16} /> Salin Link</button>
          <button onClick={download} className="flex-1 h-11 rounded-xl bg-[#0D5C3A] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#094229]"><Download size={16} /> Unduh QR</button>
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
        <img src={info.image} alt="QR Absensi Kegiatan" className="mx-auto w-52 h-52 rounded-xl border border-[#E5E7EB] p-2" data-testid="akses-qr-image" />

        <div className="mt-4 rounded-2xl border-2 border-dashed border-[#0D5C3A] bg-[#F0FAF4] p-4">
          <div className="text-xs font-semibold text-[#065F46] flex items-center justify-center gap-1.5">
            <KeyRound size={14} /> KODE AKSES ABSENSI
          </div>
          <div className="mt-1 text-3xl font-bold tracking-[0.35em] text-[#0D5C3A]" data-testid="akses-code">{info.code}</div>
          <div className="text-xs text-[#4B5563] mt-1">
            Berlaku sampai kegiatan <b>ditutup/selesai</b>
            {info.valid_until ? <> · jadwal selesai {tanggalSingkat(String(info.valid_until).slice(0, 10))} {String(info.valid_until).slice(11, 16)} WITA</> : null}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={copyCode} data-testid="akses-copy-code" className="flex-1 h-10 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#E8F5EE]"><Copy size={15} /> Salin Kode</button>
            <button onClick={regenerate} disabled={busy} data-testid="akses-regenerate" className="flex-1 h-10 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60">
              {busy ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />} Perbarui Kode
            </button>
          </div>
        </div>

        <div className="mt-3 bg-white border border-[#E5E7EB] rounded-xl p-3 text-left">
          <p className="text-xs text-[#4B5563] leading-relaxed">
            Penerima tautan memasukkan kode akses ini, lalu langsung melihat <b>daftar peserta</b> —
            termasuk peserta yang <b>belum aktivasi</b> — untuk diabsen <b>manual</b> atau lewat
            <b> scan barcode</b> QR pribadi peserta.
          </p>
        </div>

        <p className="text-xs text-[#9CA3AF] mt-2 break-all px-2">{info.link}</p>

        <div className="flex gap-2 mt-3">
          <button onClick={copyLink} data-testid="akses-copy-link" className="flex-1 h-11 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold flex items-center justify-center gap-2 hover:bg-[#E8F5EE]"><Copy size={16} /> Salin Link</button>
          <button onClick={download} data-testid="akses-download" className="flex-1 h-11 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] font-semibold flex items-center justify-center gap-2 hover:border-[#0D5C3A] hover:text-[#0D5C3A]"><Download size={16} /> Unduh QR</button>
        </div>
        <button onClick={shareWa} data-testid="akses-share-wa" className="mt-2 w-full h-11 rounded-xl bg-[#25D366] text-white font-semibold flex items-center justify-center gap-2 hover:brightness-95"><Send size={16} /> Bagikan lewat WhatsApp</button>
      </div>
    </ModalShell>
  );
}
