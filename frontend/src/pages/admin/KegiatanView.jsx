import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays, Plus, List, Grid3x3, ChevronLeft, ChevronRight, Loader2, X,
  Share2, CheckCircle2, RotateCcw, Trash2, Search, Copy, Download,
  Clock, MapPin, User, ScanLine, MessageSquareText,
  MoreHorizontal, Pencil, FileBarChart2, ChevronDown, AlertTriangle,
  KeyRound, RefreshCw, Send,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import {
  KEGIATAN_TYPES, TYPE_LABEL, TYPE_COLOR, timeOptions,
  tanggalPanjang, tanggalSingkat, hhmm, MONTH_SHORT,
} from "./kegiatanUtils";
import { ReminderModal, DelegasiModal, ScanPesertaModal } from "./KegiatanExtras";
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
  const [feedbackItem, setFeedbackItem] = useState(null);
  const [reminderItem, setReminderItem] = useState(null);
  const [delegasiItem, setDelegasiItem] = useState(null);
  const [scanItem, setScanItem] = useState(null);
  const [aksesItem, setAksesItem] = useState(null);

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
              onAkses={async () => {
                try {
                  const { data } = await api.get(`/admin/kegiatan/${k.id}/access`);
                  setAksesItem({ ...data, kegiatan_id: k.id });
                } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
              }}
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
      {aksesItem && <ShareAbsensiModal data={aksesItem} onClose={() => setAksesItem(null)} />}
    </div>
  );
}

function KegiatanCard({ k, onAbsenQr, onShare, onAkses, onEdit, onRekap, onFeedback, onReminder, onDelegasi, onScanPeserta, onToggleStatus, onDelete }) {
  const c = k.counts || {};
  const closed = k.status === "closed";
  const [showActions, setShowActions] = useState(false);
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
        <button data-testid={`button-akses-${k.id}`} onClick={onAkses} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE]"><KeyRound size={15} /> Kode Akses</button>
        <button data-testid={`button-absen-qr-${k.id}`} onClick={onAbsenQr} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE]"><ScanLine size={15} /> Absen QR</button>
        <button data-testid={`button-toggle-status-${k.id}`} onClick={onToggleStatus} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#E5E7EB] text-[#4B5563] font-semibold text-sm hover:border-[#0D5C3A] hover:text-[#0D5C3A]">
          {closed ? <><RotateCcw size={15} /> Buka</> : <><CheckCircle2 size={15} /> Selesai</>}
        </button>

        {/* Aksi lain — memakai action modal (bukan dropdown) */}
        <button
          data-testid={`button-opsi-${k.id}`}
          onClick={() => setShowActions(true)}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#E5E7EB] text-[#4B5563] font-semibold text-sm hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
        >
          <MoreHorizontal size={16} /> Aksi Lain
        </button>
      </div>

      {showActions && (
        <ActionModal
          testid={`action-modal-${k.id}`}
          title="Aksi Kegiatan"
          subtitle={k.name}
          onClose={() => setShowActions(false)}
          actions={[
            { key: `akses-${k.id}`, testid: `opsi-akses-${k.id}`, label: "Bagikan Kegiatan + Kode Akses", desc: "Tautan absensi + kode 6 digit", icon: KeyRound, onClick: onAkses },
            { key: `rekap-${k.id}`, testid: `opsi-rekap-${k.id}`, label: "Rekap Absen", desc: "Lihat & ubah kehadiran peserta", icon: FileBarChart2, onClick: onRekap },
            { key: `share-${k.id}`, testid: `opsi-share-${k.id}`, label: "Bagikan Rekap", desc: "Tautan & QR rekap kegiatan", icon: Share2, onClick: onShare },
            { key: `reminder-${k.id}`, testid: `opsi-reminder-${k.id}`, label: "Pengingat WhatsApp", desc: "Kirim pengingat ke peserta", icon: SendIcon, onClick: onReminder },
            { key: `scan-${k.id}`, testid: `opsi-scan-peserta-${k.id}`, label: "Scan QR Peserta", desc: "Tandai hadir lewat QR pribadi", icon: ScanIcon, onClick: onScanPeserta },
            { key: `delegasi-${k.id}`, testid: `opsi-delegasi-${k.id}`, label: "Penjaga Absen (Delegasi)", desc: "Serahkan hak absen sementara", icon: ShieldIcon, onClick: onDelegasi },
            { key: `edit-${k.id}`, testid: `opsi-edit-${k.id}`, label: "Edit Kegiatan", desc: "Ubah nama, jadwal, pengajar", icon: Pencil, onClick: onEdit },
            { key: `feedback-${k.id}`, testid: `opsi-feedback-${k.id}`, label: "Kotak Pesan / Saran", desc: "Baca pesan dari peserta", icon: MessageSquareText, onClick: onFeedback },
            { key: `delete-${k.id}`, testid: `opsi-delete-${k.id}`, label: "Hapus Kegiatan", desc: "Tindakan ini tidak bisa dibatalkan", icon: Trash2, danger: true, onClick: onDelete },
          ]}
        />
      )}
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
            Barcode kegiatan ini <b>berlaku 1 bulan</b>{data.expires_at ? <> (sampai {tanggalSingkat(String(data.expires_at).slice(0, 10))})</> : null},
            sehingga bisa dicetak dan dipakai berulang untuk kegiatan tersebut.
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
