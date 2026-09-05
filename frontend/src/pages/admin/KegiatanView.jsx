import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays, Plus, List, Grid3x3, ChevronLeft, ChevronRight, Loader2, X,
  Share2, CheckCircle2, RotateCcw, Trash2, Search, Copy, Download,
  Clock, MapPin, User, ScanLine, MessageSquareText,
  MoreHorizontal, Pencil, FileBarChart2,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import {
  KEGIATAN_TYPES, TYPE_LABEL, TYPE_COLOR, timeOptions,
  tanggalPanjang, tanggalSingkat, hhmm, MONTH_SHORT,
} from "./kegiatanUtils";
import { ReminderModal, DelegasiModal, ScanPesertaModal } from "./KegiatanExtras";
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
  const [feedbackItem, setFeedbackItem] = useState(null);
  const [reminderItem, setReminderItem] = useState(null);
  const [delegasiItem, setDelegasiItem] = useState(null);
  const [scanItem, setScanItem] = useState(null);

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
        <div className="grid gap-3">
          {filtered.map((k) => (
            <KegiatanCard key={k.id} k={k}
              onAbsenQr={async () => {
                try {
                  const { data } = await api.post(`/admin/kegiatan/${k.id}/absen-qr`);
                  setAbsenQr({ ...data, name: k.name });
                } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
              }}
              onShare={async () => {
                try {
                  const { data } = await api.get(`/admin/kegiatan/${k.id}/qr`);
                  setQrModal({ ...data, name: k.name });
                } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
              }}
              onEdit={() => setEditItem(k)}
              onRekap={() => setDetailId(k.id)}
              onFeedback={() => setFeedbackItem(k)}
              onReminder={() => setReminderItem(k)}
              onDelegasi={() => setDelegasiItem(k)}
              onScanPeserta={() => setScanItem(k)}
              onToggleStatus={async () => {
                try {
                  await api.post(`/admin/kegiatan/${k.id}/${k.status === "open" ? "close" : "reopen"}`);
                  toast.success(k.status === "open" ? "Kegiatan diselesaikan" : "Kegiatan dibuka kembali");
                  load();
                } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
              }}
              onDelete={async () => {
                if (!window.confirm(`Hapus kegiatan "${k.name}"?`)) return;
                try {
                  await api.delete(`/admin/kegiatan/${k.id}`);
                  toast.success("Kegiatan dihapus");
                  load();
                } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
              }}
            />
          ))}
        </div>
      )}

      {showAdd && <KegiatanFormModal onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} />}
      {editItem && <KegiatanFormModal initial={editItem} onClose={() => setEditItem(null)} onDone={() => { setEditItem(null); load(); }} />}
      {detailId && <AbsensiModal kegiatanId={detailId} onClose={() => setDetailId(null)} onChanged={load} />}
      {feedbackItem && <FeedbackModal kegiatan={feedbackItem} onClose={() => setFeedbackItem(null)} />}
      {qrModal && <QrModal data={qrModal} onClose={() => setQrModal(null)} />}
      {absenQr && <AbsenQrModal data={absenQr} onClose={() => setAbsenQr(null)} />}
      {reminderItem && <ReminderModal kegiatan={reminderItem} onClose={() => setReminderItem(null)} />}
      {delegasiItem && <DelegasiModal kegiatan={delegasiItem} onClose={() => setDelegasiItem(null)} />}
      {scanItem && <ScanPesertaModal kegiatan={scanItem} onClose={() => setScanItem(null)} onChanged={load} />}
    </div>
  );
}

function KegiatanCard({ k, onAbsenQr, onShare, onEdit, onRekap, onFeedback, onReminder, onDelegasi, onScanPeserta, onToggleStatus, onDelete }) {
  const c = k.counts || {};
  const closed = k.status === "closed";
  const [opsi, setOpsi] = useState(false);
  const opsiRef = useRef(null);
  useEffect(() => {
    const h = (e) => { if (opsiRef.current && !opsiRef.current.contains(e.target)) setOpsi(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const opsiItem = "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-[#111827] hover:bg-[#F0FAF4] text-left";
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4" data-testid={`kegiatan-card-${k.id}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>{TYPE_LABEL[k.type]}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${closed ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#E8F5EE] text-[#065F46]"}`}>{closed ? "Selesai" : "Berlangsung"}</span>
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
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button data-testid={`button-absensi-${k.id}`} onClick={onRekap} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#0D5C3A] text-white font-semibold text-sm hover:bg-[#094229]"><CheckCircle2 size={15} /> Absensi</button>
        <button data-testid={`button-absen-qr-${k.id}`} onClick={onAbsenQr} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE]"><ScanLine size={15} /> Absen QR</button>
        <button data-testid={`button-toggle-status-${k.id}`} onClick={onToggleStatus} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#E5E7EB] text-[#4B5563] font-semibold text-sm hover:border-[#0D5C3A] hover:text-[#0D5C3A]">
          {closed ? <><RotateCcw size={15} /> Buka</> : <><CheckCircle2 size={15} /> Selesai</>}
        </button>

        {/* Opsi dropdown */}
        <div className="relative" ref={opsiRef}>
          <button
            data-testid={`button-opsi-${k.id}`}
            onClick={() => setOpsi((v) => !v)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#E5E7EB] text-[#4B5563] font-semibold text-sm hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
          >
            <MoreHorizontal size={16} /> Opsi
          </button>
          {opsi && (
            <div className="absolute left-0 mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-[#E5E7EB] overflow-hidden z-30" data-testid={`opsi-menu-${k.id}`}>
              <button data-testid={`opsi-share-${k.id}`} onClick={() => { setOpsi(false); onShare(); }} className={opsiItem}><Share2 size={16} className="text-[#0D5C3A]" /> Share</button>
              <button data-testid={`opsi-reminder-${k.id}`} onClick={() => { setOpsi(false); onReminder(); }} className={opsiItem}><SendIcon size={16} className="text-[#0D5C3A]" /> Pengingat WA</button>
              <button data-testid={`opsi-scan-peserta-${k.id}`} onClick={() => { setOpsi(false); onScanPeserta(); }} className={opsiItem}><ScanIcon size={16} className="text-[#0D5C3A]" /> Scan QR Peserta</button>
              <button data-testid={`opsi-delegasi-${k.id}`} onClick={() => { setOpsi(false); onDelegasi(); }} className={opsiItem}><ShieldIcon size={16} className="text-[#0D5C3A]" /> Delegasi Absen</button>
              <button data-testid={`opsi-edit-${k.id}`} onClick={() => { setOpsi(false); onEdit(); }} className={opsiItem}><Pencil size={16} className="text-[#0D5C3A]" /> Edit Kegiatan</button>
              <button data-testid={`opsi-rekap-${k.id}`} onClick={() => { setOpsi(false); onRekap(); }} className={opsiItem}><FileBarChart2 size={16} className="text-[#0D5C3A]" /> Rekap Absen</button>
              <button data-testid={`opsi-feedback-${k.id}`} onClick={() => { setOpsi(false); onFeedback(); }} className={opsiItem}><MessageSquareText size={16} className="text-[#0D5C3A]" /> Kotak Pesan / Saran</button>
            </div>
          )}
        </div>

        <button data-testid={`button-delete-${k.id}`} onClick={onDelete} className="ml-auto h-9 w-9 flex items-center justify-center rounded-lg text-[#DC2626] hover:bg-red-50"><Trash2 size={16} /></button>
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
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) { toast.error("Nama kegiatan wajib diisi"); return; }
    setSaving(true);
    try {
      if (editing) {
        const { recurring, ...payload } = f;
        await api.patch(`/admin/kegiatan/${initial.id}`, payload);
        toast.success("Kegiatan diperbarui.");
      } else {
        const { data } = await api.post("/admin/kegiatan", f);
        toast.success(`Kegiatan dibuat${f.recurring ? ` (${data.length}x berulang)` : ""}.`);
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
        <input data-testid="keg-teacher" value={f.teacher} onChange={(e) => set("teacher", e.target.value)} placeholder="Pengajar" className={inp} />
        <input data-testid="keg-material" value={f.material} onChange={(e) => set("material", e.target.value)} placeholder="Materi" className={inp} />
        <input data-testid="keg-location" value={f.location} onChange={(e) => set("location", e.target.value)} placeholder="Lokasi" className={`${inp} sm:col-span-2`} />
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

function AbsensiModal({ kegiatanId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    api.get(`/admin/kegiatan/${kegiatanId}/rekap`)
      .then(({ data: d }) => setData(d))
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  const mark = async (userId, status) => {
    setBusy(userId + status);
    try {
      await api.post(`/admin/kegiatan/${kegiatanId}/absen`, { user_id: userId, status });
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
        <div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="rounded-xl bg-[#F2F5F2] p-3 text-center"><div className="text-xl font-bold text-[#111827]">{c.total}</div><div className="text-xs text-[#6B7280]">Total</div></div>
            <div className="rounded-xl bg-[#E8F5EE] p-3 text-center"><div className="text-xl font-bold text-[#065F46]">{c.hadir}</div><div className="text-xs text-[#6B7280]">Hadir</div></div>
            <div className="rounded-xl bg-[#FEF3C7] p-3 text-center"><div className="text-xl font-bold text-[#92400E]">{c.izin}</div><div className="text-xs text-[#6B7280]">Izin</div></div>
            <div className="rounded-xl bg-[#FEE2E2] p-3 text-center"><div className="text-xl font-bold text-[#991B1B]">{c.alpha}</div><div className="text-xs text-[#6B7280]">Alpha</div></div>
          </div>

          <div className="relative mb-3">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input data-testid="absensi-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama peserta..." className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A] bg-white" />
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white divide-y divide-[#E5E7EB] max-h-[46vh] overflow-y-auto">
            {rows.length === 0 ? (
              <div className="p-8 text-center text-[#6B7280] text-sm">Tidak ada peserta.</div>
            ) : rows.map((r) => (
              <div key={r.user_id} data-testid={`absensi-row-${r.user_id}`} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-[#111827] truncate">{r.name}</div>
                  <div className="text-xs text-[#9CA3AF]">
                    {r.status === "hadir" && r.arrival_time ? `Datang ${hhmm(r.arrival_time)} WITA` : (r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : "—")}
                  </div>
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

          {/* Kesan & Pesan dipindah ke modal terpisah via menu Opsi */}
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
            Scan QR ini dengan kamera HP. Jamaah/peserta cukup <b>cari nama sendiri</b> lalu tekan
            <b> Konfirmasi Hadir</b>. QR hanya berfungsi selama kegiatan <b>masih berlangsung</b> (belum diselesaikan).
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

