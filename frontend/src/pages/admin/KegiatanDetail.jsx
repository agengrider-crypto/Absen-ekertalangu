import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, CalendarDays, Clock, MapPin, User, BookOpen, Loader2, Search,
  ListChecks, ScanLine, KeyRound, MessageSquareText, UserPlus, PhoneCall,
  Copy, RefreshCw, Download, Send, Trash2, CheckCircle2, AlertTriangle,
  Users, PhoneOff, ClipboardList, MoreHorizontal, Pencil,
  Share2, RotateCcw, Layers, FileBarChart2, CheckCheck, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { ACTIVITIES } from "@/constants/testIds";
import ActionModal from "@/components/ActionModal";
import KegiatanRekapPanel from "./KegiatanRekapPanel";
import { api, formatApiErrorDetail, isOfflineError } from "@/lib/api";
import { useOfflineQueue } from "@/lib/offline";
import OfflineBanner from "@/components/OfflineBanner";
import QrScanner from "@/components/QrScanner";
import { waNumber } from "@/components/ContactButtons";
import {
  TYPE_LABEL, TYPE_COLOR, tanggalPanjang, tanggalSingkat, hhmm,
  AUDIENCE_LABEL, GENDER_FILTER_LABEL, PHASE_META, phaseOf,
} from "./kegiatanUtils";

/**
 * FASE 8 — HALAMAN DETAIL ABSEN KEGIATAN.
 *
 * Menggantikan modal absensi yang sempit: sekarang berupa halaman penuh dengan
 * NAVIGASI BAR HORIZONTAL (bisa digeser di HP) berisi seluruh pekerjaan absen
 * pada satu kegiatan — ringkasan, absen manual (mendukung mode offline), scan
 * barcode, daftar tamu, tindak lanjut peserta yang tidak hadir, kode akses, dan
 * kotak pesan/saran.
 */

// Singkatan H / I / A supaya baris absen tetap ringkas di HP.
const STATUS_BTN = {
  hadir: { label: "H", full: "Hadir", on: "bg-[#14633F] text-white", off: "text-[#14633F]" },
  izin: { label: "I", full: "Izin", on: "bg-[#8A5A00] text-white", off: "text-[#6B4500]" },
  sakit: { label: "S", full: "Sakit", on: "bg-[#1D4F91] text-white", off: "text-[#1D4F91]" },
  alpha: { label: "A", full: "Alpha", on: "bg-[#A32A2A] text-white", off: "text-[#A32A2A]" },
};

const FOLLOWUP_META = {
  belum_dihubungi: { label: "Belum dihubungi", cls: "bg-[#F0EEE6] text-[#5F6B63]" },
  sudah_dihubungi: { label: "Sudah dihubungi", cls: "bg-[#D9F2F4] text-[#1D4F91]" },
  akan_hadir: { label: "Akan hadir", cls: "bg-[#E3F3EA] text-[#0E4E31]" },
  tidak_bisa: { label: "Tidak bisa hadir", cls: "bg-[#FBE5E3] text-[#A32A2A]" },
};

export default function KegiatanDetail({ kegiatanId, onBack, onChanged, onEdit,
                                        onReminder, onToggleStatus, onDelete,
                                        onRekapGabungan, onSalinJadwal }) {
  const [tab, setTab] = useState("manual");
  const [showActions, setShowActions] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setData((d) => d);
    try {
      const { data: d } = await api.get(`/admin/kegiatan/${kegiatanId}/rekap`);
      setData(d);
      setErr("");
    } catch (e) {
      if (isOfflineError(e)) setErr("Perangkat sedang tanpa internet. Data terakhir tetap ditampilkan.");
      else setErr(formatApiErrorDetail(e.response?.data?.detail));
    }
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  const k = data?.kegiatan;
  const publik = (k?.audience || "reguler") === "publik";
  const mapLabel = k?.location || k?.maps_query;
  const alphaAllowed = Boolean(k && (
    k.status !== "open"
    || Date.now() >= Date.parse(`${k.date}T${k.end_time}:00+08:00`)
  ));

  const TABS = useMemo(() => ([
    { key: "manual", label: "Absen Manual", icon: ListChecks },
    ...(publik ? [{ key: "tamu", label: "Tamu", icon: UserPlus }] : []),
    { key: "rekap", label: "Rekap / Laporan", icon: FileBarChart2 },
    { key: "pesan", label: "Pesan / Kesan", icon: MessageSquareText },
  ]), [publik]);

  if (!data) {
    return (
      <div>
        <BackBar onBack={onBack} title="Detail Kegiatan" />
        <div className="p-5 flex items-center justify-center gap-2 text-sm text-[#5F6B63]">
          <Loader2 className="animate-spin text-[#0E4E31]" size={20} /> Memuat kegiatan…
        </div>
        {err && <p className="text-center text-sm text-[#A32A2A]">{err}</p>}
      </div>
    );
  }

  const phase = phaseOf(k);
  const pm = PHASE_META[phase];

  return (
    <div data-testid="kegiatan-detail-view">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <BackBar onBack={onBack} title={k.name} />
        <button type="button" data-testid={ACTIVITIES.scanToggle} aria-expanded={scanOpen}
          onClick={() => setScanOpen((open) => !open)}
          className="ml-auto h-10 px-3.5 rounded-xl border-2 border-[#E7E3D8] bg-white text-[#5F6B63] font-semibold text-sm inline-flex items-center gap-2 hover:border-[#14633F] hover:text-[#0E4E31]">
          <ScanLine size={17} /> {scanOpen ? "Tutup Scan" : "Scan Barcode"}
        </button>
        <button
          data-testid="kegiatan-detail-actions-button"
          onClick={() => setShowActions(true)}
          className="h-10 px-3.5 rounded-xl border-2 border-[#E7E3D8] bg-white text-[#5F6B63] font-semibold text-sm inline-flex items-center gap-2 hover:border-[#14633F] hover:text-[#0E4E31]"
        >
          <MoreHorizontal size={17} /> Aksi Kegiatan
        </button>
      </div>
      {scanOpen && (
        <div className="mb-4">
          <ScanTabPanel kegiatanId={kegiatanId} closed={k.status !== "open"}
            onReload={() => { load(true); if (onChanged) onChanged(); }} />
        </div>
      )}

      {/* Kartu info kegiatan */}
      <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4 sm:p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>{TYPE_LABEL[k.type]}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pm.cls}`}>{pm.badge}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#D9F2F4] text-[#0E4E31]">{AUDIENCE_LABEL[k.audience] || "Reguler"}</span>
          {(k.filter_labels && k.filter_labels.length
            ? k.filter_labels
            : (k.gender_filter && k.gender_filter !== "semua" ? [GENDER_FILTER_LABEL[k.gender_filter]] : [])
          ).map((l) => (
            <span key={l} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FBE5E3] text-[#A32A2A]">{l}</span>
          ))}
          {(k.session_total || 1) > 1 && k.session_label && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FBF1D6] text-[#6B4500]">
              Sesi {k.session_label} ({(k.session_index ?? 0) + 1}/{k.session_total})
            </span>
          )}
        </div>
        <h2 className="font-heading text-xl font-bold text-[#14201A] mt-2">{k.name}</h2>
        <div className="text-sm text-[#5F6B63] mt-2 flex flex-wrap gap-x-5 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} /> Tanggal {String(k.date || "").split("-")[2] || "—"}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={15} /> {k.start_time}–{k.end_time} WITA</span>
          {mapLabel && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(k.maps_query || k.location)}`}
            target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[#0E4E31] underline">
            <MapPin size={15} /> {mapLabel}
          </a>}
          {k.teacher && <span className="inline-flex items-center gap-1.5"><User size={15} /> {k.teacher}</span>}
          {k.material && <span className="inline-flex items-center gap-1.5"><BookOpen size={15} /> {k.material}</span>}
        </div>
        {/* FASE 10 — aksi cepat grup sesi: rekap per sesi & salin jadwal */}
        {(k.session_total || 1) > 1 && k.session_group_id && (
          <div className="mt-3 flex flex-wrap gap-2" data-testid="detail-sesi-actions">
            <button type="button" data-testid="detail-rekap-gabungan" onClick={() => onRekapGabungan && onRekapGabungan(k)}
              className="h-10 px-3.5 rounded-xl bg-[#14633F] text-white font-semibold text-sm inline-flex items-center gap-2 hover:bg-[#0E4E31]">
              <FileBarChart2 size={16} /> Rekap Kehadiran per Sesi ({k.session_total} sesi)
            </button>
            <button type="button" data-testid="detail-salin-jadwal" onClick={() => onSalinJadwal && onSalinJadwal(k)}
              className="h-10 px-3.5 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold text-sm inline-flex items-center gap-2 hover:bg-[#E3F3EA]">
              <Copy size={16} /> Salin Jadwal Sesi
            </button>
          </div>
        )}
      </div>

      <nav aria-label="Breadcrumb" className="my-3 flex min-w-0 items-center gap-1 text-[13px]" data-testid={ACTIVITIES.breadcrumb}>
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 font-semibold text-[#0E4E31] transition-colors hover:bg-[#E3F3EA]"
        >
          <ChevronLeft size={16} aria-hidden="true" /> Kegiatan
        </button>
        <ChevronRight size={14} className="shrink-0 text-[#8A948D]" aria-hidden="true" />
        <span className="min-w-0 truncate font-medium text-[#5F6B63]" aria-current="page">{k.name}</span>
      </nav>

      <div className="sticky top-2 z-20 mx-auto mt-3 w-fit max-w-full rounded-2xl border border-[#E7E3D8] bg-white/95 p-2 shadow-lg backdrop-blur">
        <div className="flex gap-2 overflow-x-auto no-scrollbar" data-testid="kegiatan-detail-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                data-testid={`keg-tab-${t.key}`}
                onClick={() => setTab(t.key)}
                className={`shrink-0 h-11 px-3.5 rounded-xl font-semibold text-sm inline-flex items-center gap-2 border-2 transition-colors ${
                  on
                    ? "bg-[#E3F3EA] text-[#0E4E31] border-[#14633F]"
                    : "bg-[#F0EEE6] text-[#5F6B63] border-transparent hover:bg-[#E7E3D8] hover:text-[#14201A]"
                }`}
              >
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {tab === "manual" && (
          <AbsenManual kegiatanId={kegiatanId} rows={data.rows || []} closed={k.status !== "open"} alphaAllowed={alphaAllowed}
            onReload={() => { load(true); if (onChanged) onChanged(); }} />
        )}
        {tab === "tamu" && (
          <TamuPanel kegiatanId={kegiatanId} guests={data.guests || []}
            onReload={() => { load(true); if (onChanged) onChanged(); }} />
        )}
        {tab === "publik" && <BarcodePublikPanel kegiatanId={kegiatanId} />}
        {tab === "rekap" && <KegiatanRekapPanel kegiatanId={kegiatanId} />}
        {tab === "tindak" && <TindakLanjut kegiatanId={kegiatanId} />}
        {tab === "kode" && <KodeAksesPanel kegiatanId={kegiatanId} />}
        {tab === "pesan" && <PesanPanel kegiatanId={kegiatanId} />}
      </div>

      {showActions && (
        <ActionModal
          testid="kegiatan-detail-actions"
          title="Aksi Kegiatan"
          subtitle={k.name}
          onClose={() => setShowActions(false)}
          actions={[
            {
              key: "status",
              testid: "detail-opsi-status",
              label: k.status === "open" ? "Tandai Selesai" : "Buka Kembali",
              desc: k.status === "open" ? "Tutup absensi kegiatan ini" : "Aktifkan kembali absensi",
              icon: k.status === "open" ? CheckCircle2 : RotateCcw,
              onClick: () => onToggleStatus && onToggleStatus(k),
            },
            ...((k.session_total || 1) > 1 ? [{
              key: "gabungan", testid: "detail-opsi-gabungan", label: "Rekap Kehadiran per Sesi",
              desc: "Gabungkan kehadiran semua sesi (pagi/sore/malam)", icon: Layers,
              onClick: () => onRekapGabungan && onRekapGabungan(k),
            }] : []),
            {
              key: "salin", testid: "detail-opsi-salin", label: "Salin ke Tanggal Lain",
              desc: (k.session_total || 1) > 1 ? "Salin pola semua sesi hari ini ke tanggal lain" : "Salin jadwal ini ke tanggal lain",
              icon: Copy,
              onClick: () => onSalinJadwal && onSalinJadwal(k),
            },
            {
              key: "edit", testid: "detail-opsi-edit", label: "Edit Kegiatan",
              desc: "Ubah nama, jadwal, pengajar", icon: Pencil,
              onClick: () => onEdit && onEdit(k),
            },
            {
              key: "delete", testid: "detail-opsi-delete", label: "Hapus Kegiatan",
              desc: "Tindakan ini tidak bisa dibatalkan", icon: Trash2, hapus: true,
              onClick: () => onDelete && onDelete(k),
            },
          ]}
        />
      )}
    </div>
  );
}

function BackBar({ onBack, title }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <button
        data-testid="kegiatan-detail-back"
        onClick={onBack}
        className="h-10 px-3 rounded-xl border border-[#E7E3D8] bg-white text-[#5F6B63] font-semibold text-sm inline-flex items-center gap-2 hover:border-[#14633F] hover:text-[#0E4E31]"
      >
        <ArrowLeft size={17} /> Kembali
      </button>
      <div className="font-bold text-[#0E4E31] truncate">{title}</div>
    </div>
  );
}

function Stat({ value, label, bg, fg, testid }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ backgroundColor: bg }} data-testid={testid}>
      <div className="text-xl font-bold" style={{ color: fg }}>{value ?? 0}</div>
      <div className="text-xs text-[#5F6B63]">{label}</div>
    </div>
  );
}

/* ------------------------- Barcode publik (kegiatan terbuka) ------------------------- */
function BarcodePublikPanel({ kegiatanId }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    api.get(`/admin/kegiatan/${kegiatanId}/publik-qr`)
      .then(({ data }) => setInfo(data))
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  }, [kegiatanId]);

  if (!info) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;

  const download = () => {
    const a = document.createElement("a");
    a.href = info.image;
    a.download = `barcode_publik_${(info.kegiatan_name || "kegiatan").replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5 text-center" data-testid="detail-publik-panel">
      <img src={info.image} alt="Barcode Publik" className="mx-auto w-48 h-48 rounded-xl border border-[#E7E3D8] p-2" data-testid="detail-publik-qr" />
      <div className="mt-4 bg-[#F6F4EE] border border-[#E7E3D8] rounded-xl p-3.5 text-left">
        <p className="text-sm font-semibold text-[#0E4E31] flex items-center gap-1.5"><QrCode size={15} /> Barcode absen untuk peserta umum</p>
        <p className="text-xs text-[#5F6B63] mt-1.5 leading-relaxed">
          Kegiatan ini <b>terbuka</b>, sehingga peserta yang <b>belum aktivasi akun</b> cukup
          scan barcode ini, <b>mengisi nama</b>, lalu kehadiran <b>langsung tercatat</b> —
          tanpa perlu login maupun kode akses.
        </p>
      </div>
      <p className="text-xs text-[#5F6B63] mt-3 break-all px-2">{info.link}</p>
      <div className="grid sm:grid-cols-2 gap-2 mt-3">
        <button onClick={() => { navigator.clipboard.writeText(info.link); toast.success("Tautan absen publik disalin"); }}
          data-testid="detail-publik-copy"
          className="h-11 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#E3F3EA]">
          <Copy size={16} /> Salin Tautan
        </button>
        <button onClick={download} data-testid="detail-publik-download"
          className="h-11 rounded-xl border-2 border-[#E7E3D8] text-[#5F6B63] font-semibold inline-flex items-center justify-center gap-2 hover:border-[#14633F] hover:text-[#0E4E31]">
          <Download size={16} /> Unduh Barcode
        </button>
      </div>
      <button
        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(info.wa_text || info.link)}`, "_blank")}
        data-testid="detail-publik-share-wa"
        className="mt-2 w-full h-11 rounded-xl bg-[#14633F] text-white font-semibold inline-flex items-center justify-center gap-2 hover:brightness-95"
      >
        <Send size={16} /> Bagikan lewat WhatsApp
      </button>
    </div>
  );
}

/* ------------------------- Absen manual (dengan mode offline) ------------------------- */
const REASON_OPTIONS = [
  "Sibuk",
  "Ada tamu",
  "Kerja",
  "Sakit ringan",
  "Acara keluarga",
  "Di luar kota",
  "Lainnya",
];

function AbsenManual({ kegiatanId, rows, closed, alphaAllowed, onReload }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [busyAll, setBusyAll] = useState(false);
  const [reasonFor, setReasonFor] = useState(null); // { user_id, name }
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const sender = useCallback(async (items) => {
    await api.post(`/admin/kegiatan/${kegiatanId}/absen-batch`, { items });
  }, [kegiatanId]);

  const onSynced = useCallback((n) => {
    toast.success(`${n} absen offline berhasil dikirim ke server.`);
    onReload();
  }, [onReload]);

  const { pending, statusMap, online, syncing, add, flush } =
    useOfflineQueue(`keg_${kegiatanId}`, sender, onSynced);

  const mark = async (userId, status, extra = {}) => {
    if (!online) {
      add({ user_id: userId, status, ...extra });
      toast.info("Tanpa internet — absen disimpan di HP dan dikirim otomatis nanti.");
      return;
    }
    setBusy(userId + status);
    try {
      const { data: res } = await api.post(`/admin/kegiatan/${kegiatanId}/absen`, {
        user_id: userId, status, ...extra,
      });
      if (res?.message) toast.success(res.message);
      onReload();
    } catch (e) {
      if (isOfflineError(e)) {
        add({ user_id: userId, status, ...extra });
        toast.info("Koneksi terputus — absen disimpan di HP dan dikirim otomatis nanti.");
      } else {
        toast.error(formatApiErrorDetail(e.response?.data?.detail));
      }
    } finally { setBusy(null); }
  };

  const openReason = (row) => {
    setReasonFor({ user_id: row.user_id, name: row.name });
    setReason("");
    setNote("");
  };

  const submitReason = async () => {
    if (!reason) {
      toast.error("Pilih alasan terlebih dahulu.");
      return;
    }
    const target = reasonFor;
    setReasonFor(null);
    await mark(target.user_id, "izin", { reason, note: note.trim() || null });
  };

  const hadirSemua = async () => {
    if (!window.confirm("Tandai HADIR untuk semua peserta yang belum diabsen?")) return;
    setBusyAll(true);
    try {
      const { data: res } = await api.post(`/admin/kegiatan/${kegiatanId}/hadir-semua`);
      toast.success(res.message || "Selesai.");
      onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusyAll(false); }
  };

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t ? rows.filter((r) => (r.name || "").toLowerCase().includes(t)) : rows;
    return base.map((r) => ({ ...r, status: statusMap[r.user_id] || r.status, queued: Boolean(statusMap[r.user_id]) }));
  }, [rows, q, statusMap]);

  const belumDiabsen = list.filter((r) => !r.attended_other && !r.status).length;

  return (
    <div className="space-y-3">
      <OfflineBanner online={online} pending={pending} syncing={syncing} onSync={flush} />
      {closed && (
        <div className="rounded-2xl border-2 border-[#EAD596] bg-[#FBF1D6] p-4 text-sm text-[#6B4500] flex gap-2.5">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>Kegiatan sudah selesai. Absen susulan masih bisa dicatat oleh admin/pengurus.</span>
        </div>
      )}
      <button
        type="button"
        data-testid={ACTIVITIES.markAllPresent}
        onClick={hadirSemua}
        disabled={busyAll || belumDiabsen === 0}
        className="min-h-11 w-full rounded-xl bg-[#14633F] px-4 font-bold text-white inline-flex items-center justify-center gap-2 hover:bg-[#14633F] disabled:opacity-60"
      >
        {busyAll ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
        Hadirkan Semua Peserta
      </button>
      <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden" data-testid="detail-absen-manual">
        <div className="p-3 bg-[#F6F4EE] border-b border-[#E7E3D8] space-y-2">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
            <input
              data-testid="detail-absen-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama peserta..."
              className="w-full h-11 pl-11 pr-4 rounded-xl border border-[#8A948D] outline-none focus:border-[#14633F] bg-white"
            />
          </div>
          <button
            data-testid="detail-hadir-semua"
            onClick={hadirSemua}
            disabled={busyAll || belumDiabsen === 0}
            className="w-full h-11 rounded-xl bg-[#14633F] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#0E4E31] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busyAll ? <Loader2 className="animate-spin" size={16} /> : <CheckCheck size={16} />}
            Hadir Semua {belumDiabsen > 0 ? `(${belumDiabsen} belum diabsen)` : "(tidak ada yang tersisa)"}
          </button>
        </div>
        <div className="divide-y divide-[#E7E3D8] max-h-[60vh] overflow-y-auto">
          {list.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#5F6B63]">Tidak ada peserta pada kegiatan ini.</div>
          ) : list.map((r) => (
            <div key={r.user_id} data-testid={`detail-absen-row-${r.user_id}`} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[#14201A] text-sm truncate">{r.name}</div>
                <div className="text-xs text-[#5F6B63] flex items-center gap-1.5 flex-wrap">
                  {r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : "—"}
                  {r.account_status === "pending" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B4500]"><AlertTriangle size={11} /> Belum aktivasi</span>
                  )}
                  {r.status === "hadir" && r.arrival_time && (
                    <span className="font-mono text-[11px] text-[#5F6B63]">{hhmm(r.arrival_time)}</span>
                  )}
                  {r.absence_reason && (
                    <span className="text-[11px] text-[#6B4500]">
                      Alasan: {r.absence_reason}{r.absence_note ? ` · ${r.absence_note}` : ""}
                    </span>
                  )}
                  {r.attended_other && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[#E3F3EA] text-[#0E4E31]">
                      Sudah hadir sesi {r.attended_other_label}
                    </span>
                  )}
                  {r.queued && <span className="text-[11px] font-semibold text-[#8A5A00]">menunggu dikirim</span>}
                </div>
                {(r.reason || r.note) && (
                  <div className="mt-1 text-[11px] text-[#5F6B63] leading-snug">
                    {r.reason && <span className="font-semibold text-[#6B4500]">Alasan: {r.reason}</span>}
                    {r.reason && r.note && " · "}
                    {r.note && <span>Ket: {r.note}</span>}
                  </div>
                )}
              </div>
              <div className="ml-auto flex w-full items-center justify-end gap-1 shrink-0 sm:w-auto">
                {r.attended_other ? (
                  <span className="text-[11px] font-semibold text-[#5F6B63]" data-testid={`detail-locked-${r.user_id}`}>tidak perlu diabsen lagi</span>
                ) : ["hadir", "izin", "sakit", "alpha"].map((s) => {
                  const on = r.status === s;
                  const cfg = STATUS_BTN[s];
                  return (
                    <button
                      key={s}
                      data-testid={`detail-btn-${s}-${r.user_id}`}
                      disabled={busy === r.user_id + s || (s === "alpha" && !alphaAllowed)}
                      onClick={() => (s === "izin" ? openReason(r) : mark(r.user_id, s))}
                      title={s === "alpha" && !alphaAllowed ? "Alpha tersedia setelah kegiatan berakhir" : cfg.full}
                      aria-label={cfg.full}
                      className={`h-11 w-11 rounded-full text-sm font-bold border-2 transition-colors disabled:opacity-50 ${on ? `${cfg.on} border-transparent` : `bg-white ${cfg.off} border-[#D9D4C5] hover:border-current`}`}
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
      <button
        data-testid="detail-absen-reload"
        onClick={onReload}
        className="w-full h-11 rounded-xl border-2 border-[#E7E3D8] text-[#5F6B63] font-semibold inline-flex items-center justify-center gap-2 hover:border-[#14633F] hover:text-[#0E4E31]"
      >
        <RefreshCw size={16} /> Muat Ulang Data
      </button>

      {reasonFor && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(20,32,26,0.5)] p-4" onClick={() => setReasonFor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="reason-modal">
            <div className="font-heading font-bold text-[#14201A] text-lg">Alasan Izin</div>
            <p className="text-sm text-[#5F6B63] mt-0.5">{reasonFor.name}</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-[13px] font-semibold text-[#14201A] mb-2">Pilih alasan *</label>
                <div className="flex flex-wrap gap-2" data-testid="reason-options">
                  {REASON_OPTIONS.map((opt) => {
                    const active = reason === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        data-testid={`reason-opt-${opt}`}
                        onClick={() => setReason(opt)}
                        aria-pressed={active}
                        className={`h-10 px-3.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                          active
                            ? "bg-[#14633F] text-white border-[#14633F]"
                            : "bg-white text-[#5F6B63] border-[#E7E3D8] hover:border-[#14633F] hover:text-[#0E4E31]"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-[#14201A] mb-1.5">Keterangan (opsional)</label>
                <textarea
                  data-testid="note-input"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Tambahan bila perlu"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] resize-none"
                />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setReasonFor(null)} className="h-11 rounded-xl border-2 border-[#E7E3D8] font-semibold text-[#5F6B63]">Batalkan</button>
              <button data-testid="reason-submit" onClick={submitReason} disabled={!reason} className="h-11 rounded-xl bg-[#14633F] text-white font-semibold disabled:opacity-40">Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- Scan barcode peserta ------------------------- */
function ScanTabPanel({ kegiatanId, closed, onReload }) {
  const [recent, setRecent] = useState([]);
  const lock = useRef(false);

  const onDetected = async (text) => {
    if (lock.current) return;
    if (!text || !text.startsWith("EKP:")) {
      toast.error("QR ini bukan QR pribadi peserta. Mohon minta peserta membuka menu 'QR Saya'.");
      return;
    }
    lock.current = true;
    try {
      const { data } = await api.post(`/staff/kegiatan/${kegiatanId}/scan-personal`, { content: text });
      setRecent((previous) => [
        { ...data, id: `${data.user_id || data.name}-${Date.now()}` },
        ...previous,
      ].slice(0, 10));
      if (data.already) toast.info(data.message); else toast.success(data.message);
      onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setTimeout(() => { lock.current = false; }, 1500);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4" data-testid="detail-scan-panel">
      <p className="text-sm text-[#5F6B63] mb-3">
        <ScanLine size={16} className="text-[#0E4E31] inline mr-1.5 -mt-0.5" />
        Arahkan kamera ke <b>QR pribadi peserta</b> (menu &quot;QR Saya&quot;) untuk mencatat kehadiran.
        Mode ini memerlukan internet.
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="min-w-0">
          {closed ? (
            <div className="rounded-xl border border-[#FBE5E3] bg-[#FBE5E3] p-4 text-sm text-[#A32A2A]">
              Kegiatan sudah ditutup sehingga scan barcode dinonaktifkan.
            </div>
          ) : <QrScanner onDetected={onDetected} />}
        </div>
        <section className="min-h-48 overflow-hidden rounded-xl border border-[#E7E3D8] bg-[#F6F4EE]" data-testid={ACTIVITIES.scanResults}>
          <div className="flex items-center justify-between border-b border-[#E7E3D8] bg-white px-3.5 py-3">
            <h3 className="font-bold text-[#14201A]">Peserta berhasil dipindai</h3>
            <span className="rounded-full bg-[#E3F3EA] px-2 py-0.5 text-xs font-bold text-[#0E4E31]">{recent.length}</span>
          </div>
          {recent.length ? (
            <div className="max-h-64 divide-y divide-[#E7E3D8] overflow-y-auto">
              {recent.map((result) => (
                <div key={result.id} className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm" data-testid={`${ACTIVITIES.scanResultPrefix}-${result.id}`}>
                  <CheckCircle2 size={18} className="shrink-0 text-[#0E4E31]" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-[#14201A]">{result.name}</span>
                  <span className="shrink-0 text-xs text-[#5F6B63]">
                    {result.already ? "Sudah hadir" : "Hadir"}{result.arrival_time ? ` · ${hhmm(result.arrival_time)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-6 text-center text-sm text-[#5F6B63]">Nama peserta yang berhasil dipindai akan tampil di sini.</p>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------- Tamu (kegiatan publik) ------------------------- */
function TamuPanel({ kegiatanId, guests, onReload }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error("Mohon isi nama tamu (minimal 2 huruf)."); return; }
    setSaving(true);
    try {
      const { data } = await api.post(`/admin/kegiatan/${kegiatanId}/guest`, { name: name.trim() });
      toast.success(data.message || "Tamu tercatat hadir.");
      setName("");
      onReload();
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const remove = async (g) => {
    if (!window.confirm(`Hapus tamu "${g.name}" dari daftar hadir?`)) return;
    try {
      await api.delete(`/admin/kegiatan/${kegiatanId}/guest/${g.id}`);
      toast.success("Data tamu dihapus.");
      onReload();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-3" data-testid="detail-tamu-panel">
      <form onSubmit={add} className="bg-white rounded-2xl border border-[#E7E3D8] p-4">
        <div className="font-bold text-[#14201A] text-[15px] flex items-center gap-2"><UserPlus size={17} className="text-[#0E4E31]" /> Tambah Tamu (tanpa akun)</div>
        <p className="text-sm text-[#5F6B63] mt-1">
          Kegiatan terbuka/publik: peserta yang belum aktivasi akun cukup dicatat namanya saja.
        </p>
        <div className="flex gap-2 mt-3 flex-wrap">
          <input
            data-testid="tamu-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama tamu"
            className="flex-1 min-w-[180px] h-11 px-3.5 rounded-xl border border-[#8A948D] outline-none focus:border-[#14633F] bg-white"
          />
          <button
            data-testid="tamu-add-button"
            type="submit"
            disabled={saving}
            className="h-11 px-4 rounded-xl bg-[#14633F] text-white font-semibold inline-flex items-center gap-2 hover:bg-[#0E4E31] disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={17} /> : <UserPlus size={17} />} Catat Hadir
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E7E3D8] font-semibold text-[#14201A] text-sm">
          Daftar Tamu ({guests.length})
        </div>
        {guests.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#5F6B63]">Belum ada tamu yang dicatat.</div>
        ) : (
          <div className="divide-y divide-[#E7E3D8]">
            {guests.map((g) => (
              <div key={g.id} data-testid={`tamu-row-${g.id}`} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-[#14201A] text-sm">{g.name}</div>
                  <div className="text-xs text-[#5F6B63]">Hadir {g.arrival_time ? hhmm(g.arrival_time) : ""} · dicatat oleh {g.added_by || "petugas"}</div>
                </div>
                <button
                  data-testid={`tamu-delete-${g.id}`}
                  onClick={() => remove(g)}
                  className="h-9 w-9 rounded-lg border border-[#FBE5E3] text-[#A32A2A] flex items-center justify-center hover:bg-[#FBE5E3]"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------- Tindak lanjut tidak hadir ------------------------- */
function TindakLanjut({ kegiatanId }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});

  const load = useCallback(() => {
    api.get(`/staff/kegiatan/${kegiatanId}/tindak-lanjut`)
      .then(({ data: d }) => setData(d))
      .catch((e) => { toast.error(formatApiErrorDetail(e.response?.data?.detail)); setData({ rows: [], previous: null, counts: {} }); });
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (row, status) => {
    setBusy(row.user_id + status);
    try {
      const { data: res } = await api.post(`/staff/kegiatan/${kegiatanId}/tindak-lanjut`, {
        user_id: row.user_id, status, note: notes[row.user_id] || null,
      });
      toast.success(res.message);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(null); }
  };

  if (!data) {
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;
  }

  if (!data.previous) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-[#E7E3D8] p-8 text-center text-sm text-[#5F6B63]" data-testid="tindak-empty">
        Belum ada kegiatan sebelumnya untuk dijadikan rujukan rekap ketidakhadiran.
      </div>
    );
  }

  const c = data.counts || {};
  return (
    <div className="space-y-3" data-testid="detail-tindak-panel">
      <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4">
        <div className="font-bold text-[#14201A] text-[15px] flex items-center gap-2"><ClipboardList size={17} className="text-[#0E4E31]" /> Rekap Tidak Hadir Kegiatan Sebelumnya</div>
        <p className="text-sm text-[#5F6B63] mt-1 leading-relaxed">
          Daftar peserta yang <b>tidak hadir</b> pada kegiatan <b>{data.previous.name}</b>{" "}
          ({tanggalSingkat(data.previous.date)}). Silakan hubungi lewat WhatsApp / telepon,
          lalu tandai apakah mereka <b>akan hadir</b> pada kegiatan ini.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <Stat value={c.total} label="Tidak hadir" bg="#FBE5E3" fg="#A32A2A" testid="tindak-total" />
          <Stat value={c.akan_hadir} label="Akan hadir" bg="#F0EEE6" fg="#14201A" testid="tindak-akan" />
          <Stat value={c.tidak_bisa} label="Tidak bisa" bg="#FBF1D6" fg="#6B4500" testid="tindak-tidak" />
          <Stat value={c.belum_dihubungi} label="Belum dihubungi" bg="#F6F4EE" fg="#14201A" testid="tindak-belum" />
        </div>
      </div>

      {data.rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-8 text-center text-sm text-[#0E4E31]">
          Alhamdulillah, semua peserta hadir pada kegiatan sebelumnya.
        </div>
      ) : (
        <div className="space-y-2">
          {data.rows.map((r) => {
            const fu = r.followup || {};
            const meta = FOLLOWUP_META[fu.status] || FOLLOWUP_META.belum_dihubungi;
            const wa = waNumber(r.whatsapp || r.phone);
            const waText = encodeURIComponent(
              `${r.name ? `Halo ${r.name}, ` : "Halo, "}` +
              "kami dari pengurus pengajian. Mohon izin menanyakan, apakah bisa hadir pada kegiatan berikutnya?");
            return (
              <div key={r.user_id} data-testid={`tindak-row-${r.user_id}`} className="bg-white rounded-2xl border border-[#E7E3D8] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#14201A] text-sm">{r.name}</div>
                    <div className="text-xs text-[#5F6B63]">
                      {r.kelompok_name || "Tanpa kelompok"} · sebelumnya {r.previous_status === "izin" ? "izin" : "tidak hadir"}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                </div>

                <div className="flex gap-2 mt-3 flex-wrap">
                  {wa ? (
                    <a
                      data-testid={`tindak-wa-${r.user_id}`}
                      href={`https://wa.me/${wa}?text=${waText}`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-10 px-3.5 rounded-xl bg-[#14633F] text-white font-semibold text-sm inline-flex items-center gap-2 hover:brightness-95"
                    >
                      <Send size={15} /> WhatsApp
                    </a>
                  ) : (
                    <span className="h-10 px-3.5 rounded-xl bg-[#F0EEE6] text-[#5F6B63] font-semibold text-sm inline-flex items-center gap-2">
                      <PhoneOff size={15} /> Nomor belum ada
                    </span>
                  )}
                  {r.phone && (
                    <a
                      data-testid={`tindak-call-${r.user_id}`}
                      href={`tel:${String(r.phone).replace(/\s+/g, "")}`}
                      className="h-10 px-3.5 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold text-sm inline-flex items-center gap-2 hover:bg-[#E3F3EA]"
                    >
                      <PhoneCall size={15} /> Telepon
                    </a>
                  )}
                </div>

                <input
                  data-testid={`tindak-note-${r.user_id}`}
                  value={notes[r.user_id] ?? (fu.note || "")}
                  onChange={(e) => setNotes((p) => ({ ...p, [r.user_id]: e.target.value }))}
                  placeholder="Catatan (mis. sedang sakit, luar kota)"
                  className="mt-2 w-full h-11 px-3.5 rounded-xl border border-[#8A948D] outline-none focus:border-[#14633F] bg-white text-sm"
                />

                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button
                    data-testid={`tindak-set-akan-${r.user_id}`}
                    disabled={busy === r.user_id + "akan_hadir"}
                    onClick={() => setStatus(r, "akan_hadir")}
                    className="h-10 rounded-xl bg-[#14633F] text-white font-semibold text-xs sm:text-sm hover:bg-[#0E4E31] disabled:opacity-60"
                  >
                    Akan Hadir
                  </button>
                  <button
                    data-testid={`tindak-set-tidak-${r.user_id}`}
                    disabled={busy === r.user_id + "tidak_bisa"}
                    onClick={() => setStatus(r, "tidak_bisa")}
                    className="h-10 rounded-xl border-2 border-[#A32A2A] text-[#A32A2A] font-semibold text-xs sm:text-sm hover:bg-[#FBE5E3] disabled:opacity-60"
                  >
                    Tidak Bisa
                  </button>
                  <button
                    data-testid={`tindak-set-hubungi-${r.user_id}`}
                    disabled={busy === r.user_id + "sudah_dihubungi"}
                    onClick={() => setStatus(r, "sudah_dihubungi")}
                    className="h-10 rounded-xl border-2 border-[#E7E3D8] text-[#5F6B63] font-semibold text-xs sm:text-sm hover:border-[#14633F] hover:text-[#0E4E31] disabled:opacity-60"
                  >
                    Sudah Dihubungi
                  </button>
                </div>
                {fu.by && fu.at && (
                  <p className="text-xs text-[#5F6B63] mt-2">Ditandai oleh {fu.by} · {hhmm(fu.at)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------- Kode akses ------------------------- */
function KodeAksesPanel({ kegiatanId }) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/admin/kegiatan/${kegiatanId}/access`)
      .then(({ data }) => setInfo(data))
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  if (!info) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;

  const regenerate = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/admin/kegiatan/${kegiatanId}/access/regenerate`);
      setInfo(data);
      toast.success("Kode akses baru dibuat. Kode lama sudah tidak berlaku.");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setBusy(false); }
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = info.image;
    a.download = `absensi_${(info.kegiatan_name || "kegiatan").replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5 text-center" data-testid="detail-kode-panel">
      <img src={info.image} alt="QR Absensi Kegiatan" className="mx-auto w-48 h-48 rounded-xl border border-[#E7E3D8] p-2" data-testid="detail-akses-qr" />
      <div className="mt-4 rounded-2xl border-2 border-dashed border-[#14633F] bg-[#F6F4EE] p-4">
        <div className="text-xs font-semibold text-[#0E4E31] flex items-center justify-center gap-1.5"><KeyRound size={14} /> KODE AKSES ABSENSI</div>
        <div className="mt-1 text-3xl font-bold tracking-[0.35em] text-[#0E4E31]" data-testid="detail-akses-code">{info.code}</div>
        <div className="text-xs text-[#5F6B63] mt-1">Berlaku sampai kegiatan ditutup/selesai</div>
      </div>
      <p className="text-xs text-[#5F6B63] mt-3 break-all px-2">{info.link}</p>
      <div className="grid sm:grid-cols-2 gap-2 mt-3">
        <button onClick={() => { navigator.clipboard.writeText(info.code); toast.success("Kode akses disalin"); }}
          data-testid="detail-copy-code"
          className="h-11 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#E3F3EA]">
          <Copy size={16} /> Salin Kode
        </button>
        <button onClick={() => { navigator.clipboard.writeText(info.link); toast.success("Tautan absensi disalin"); }}
          data-testid="detail-copy-link"
          className="h-11 rounded-xl border-2 border-[#E7E3D8] text-[#5F6B63] font-semibold inline-flex items-center justify-center gap-2 hover:border-[#14633F] hover:text-[#0E4E31]">
          <Copy size={16} /> Salin Tautan
        </button>
        <button onClick={download} data-testid="detail-download-qr"
          className="h-11 rounded-xl border-2 border-[#E7E3D8] text-[#5F6B63] font-semibold inline-flex items-center justify-center gap-2 hover:border-[#14633F] hover:text-[#0E4E31]">
          <Download size={16} /> Unduh QR
        </button>
        <button onClick={regenerate} disabled={busy} data-testid="detail-regenerate-code"
          className="h-11 rounded-xl bg-[#14633F] text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#0E4E31] disabled:opacity-60">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} Perbarui Kode
        </button>
      </div>
      <button
        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(info.wa_text || info.link)}`, "_blank")}
        data-testid="detail-share-wa"
        className="mt-2 w-full h-11 rounded-xl bg-[#14633F] text-white font-semibold inline-flex items-center justify-center gap-2 hover:brightness-95"
      >
        <Send size={16} /> Bagikan lewat WhatsApp
      </button>
    </div>
  );
}

/* ------------------------- Pesan / saran ------------------------- */
function PesanPanel({ kegiatanId }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.get(`/admin/kegiatan/${kegiatanId}/feedback`)
      .then(({ data }) => setItems(data || []))
      .catch((e) => { toast.error(formatApiErrorDetail(e.response?.data?.detail)); setItems([]); });
  }, [kegiatanId]);

  if (items === null) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;

  return (
    <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden" data-testid="detail-pesan-panel">
      <div className="px-4 py-3 border-b border-[#E7E3D8] font-semibold text-[#14201A] text-sm">
        Kotak Pesan / Saran ({items.length})
      </div>
      {items.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#5F6B63]">Belum ada pesan / saran dari peserta.</div>
      ) : (
        <div className="divide-y divide-[#E7E3D8] max-h-[60vh] overflow-y-auto">
          {items.map((f) => (
            <div key={f.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-[#14201A] text-sm">{f.name}</div>
                <div className="text-xs text-[#5F6B63]">{f.created_at ? hhmm(f.created_at) : ""}</div>
              </div>
              <p className="text-sm text-[#5F6B63] mt-0.5 whitespace-pre-wrap break-words">{f.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
