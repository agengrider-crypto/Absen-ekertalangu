import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ClipboardList, Loader2, CalendarDays, Clock, MapPin, Users, ScanLine,
  ArrowLeft, Search, CheckCircle2, AlertTriangle, RefreshCw, UserPlus,
  FileBarChart2, Trash2, Share2, Copy, Send, X, SlidersHorizontal,
  MoreHorizontal, MessageSquareQuote, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import QrScanner from "@/components/QrScanner";
import Modal from "@/components/Modal";
import { TYPE_LABEL, TYPE_COLOR, tanggalSingkat, hhmm } from "@/pages/admin/kegiatanUtils";

const STATUS_BTN = {
  hadir: { label: "H", full: "Hadir", on: "bg-[#14633F] text-white", off: "text-[#0E4E31]" },
  izin: { label: "I", full: "Izin", on: "bg-[#8A5A00] text-white", off: "text-[#6B4500]" },
  sakit: { label: "S", full: "Sakit", on: "bg-[#1D4F91] text-white", off: "text-[#1D4F91]" },
};

const FILTERS = [
  { key: "semua", label: "Semua" },
  { key: "belum", label: "Belum" },
  { key: "hadir", label: "Hadir" },
  { key: "izin", label: "Izin" },
  { key: "sakit", label: "Sakit" },
];

const ALASAN = ["Kerja", "Sakit", "Keperluan keluarga", "Luar kota", "Lainnya"];

/** Status kegiatan menurut waktu (WITA): berlangsung / mendatang / selesai. */
function statusWaktu(k) {
  if (!k) return "selesai";
  if ((k.status || "open") !== "open") return "selesai";
  const now = Date.now();
  const start = Date.parse(`${k.date}T${k.start_time}:00+08:00`);
  const end = Date.parse(`${k.date}T${k.end_time}:00+08:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return "berlangsung";
  if (now < start) return "mendatang";
  if (now >= end) return "selesai";
  return "berlangsung";
}

const STATUS_META = {
  berlangsung: { label: "Berlangsung", cls: "bg-[#E3F3EA] text-[#0E4E31]" },
  mendatang: { label: "Mendatang", cls: "bg-[#E3EEFB] text-[#1D4F91]" },
  selesai: { label: "Selesai", cls: "bg-[#F0EEE6] text-[#5F6B63]" },
};

/**
 * Area "Penjaga Absen" untuk peserta yang menerima delegasi dari pengurus.
 *
 * Dua jalur terpisah langsung dari kartu kegiatan:
 *   - Absensi  → layar daftar absen (Manual / Tamu / Laporan)
 *   - Scan QR  → layar kamera
 * Sub-navigasi memakai query string agar tombol Kembali browser bekerja.
 */
export default function PenjagaAbsen() {
  const [params, setParams] = useSearchParams();
  const [delegs, setDelegs] = useState(null);

  const kegiatanId = params.get("jaga") || "";
  const layar = params.get("layar") || "";

  const load = useCallback(() => {
    setDelegs(null);
    api.get("/me/delegations")
      .then(({ data }) => setDelegs(data || []))
      .catch((e) => { setDelegs([]); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const buka = (id, target) => setParams({ jaga: id, layar: target });
  const kembali = () => setParams({});

  if (kegiatanId && layar) {
    return (
      <PenjagaKegiatan
        kegiatanId={kegiatanId}
        layar={layar}
        onBack={kembali}
        onPindahLayar={(target) => buka(kegiatanId, target)}
      />
    );
  }

  return (
    <div className="space-y-4" data-testid="penjaga-absen-tab">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#14201A] flex items-center gap-2">
          <ClipboardList size={22} className="text-[#14633F]" /> Penjaga Absen
        </h1>
        <p className="text-sm text-[#5F6B63] mt-1">
          Anda dipercaya mengisi absen kegiatan berikut.
        </p>
      </div>

      {delegs === null ? (
        <div className="p-14 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>
      ) : delegs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-8 text-center" data-testid="penjaga-empty">
          <div className="h-14 w-14 rounded-2xl bg-[#F0EEE6] text-[#5F6B63] flex items-center justify-center mx-auto">
            <ClipboardList size={26} />
          </div>
          <p className="text-sm text-[#5F6B63] mt-3 leading-relaxed">
            Saat ini Anda belum diberi hak penjaga absen.<br />
            Hak ini diberikan pengurus saat beliau tidak berada di lokasi kegiatan.
          </p>
          <button onClick={load} className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold text-sm hover:bg-[#E3F3EA]">
            <RefreshCw size={16} /> Muat ulang
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {delegs.map((d) => (
            <KartuPenjaga key={d.id} deleg={d} onBuka={buka} />
          ))}
        </div>
      )}
    </div>
  );
}

function KartuPenjaga({ deleg, onBuka }) {
  const k = deleg.kegiatan || {};
  const st = statusWaktu(k);
  const meta = STATUS_META[st];
  const aktif = st === "berlangsung";
  const jumlah = k.counts?.total ?? null;

  return (
    <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4" data-testid={`penjaga-deleg-${deleg.id}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>
          {TYPE_LABEL[k.type] || k.type}
        </span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
      </div>

      <h3 className="font-heading font-bold text-[#14201A] mt-1.5">{k.name}</h3>

      <div className="text-sm text-[#5F6B63] mt-1 flex flex-wrap gap-x-4 gap-y-1">
        <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {tanggalSingkat(k.date)}</span>
        <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {k.start_time}–{k.end_time} WITA</span>
      </div>
      {k.location && (
        <div className="text-sm text-[#5F6B63] mt-1 inline-flex items-center gap-1.5">
          <MapPin size={14} /> {k.location}
        </div>
      )}
      <div className="text-sm text-[#5F6B63] mt-1 inline-flex items-center gap-1.5">
        <Users size={14} /> {jumlah === null ? "—" : `${jumlah} peserta`}
        <span className="text-[#D9D4C5]">·</span>
        <span className="truncate">{k.sasaran || "Semua peserta"}</span>
      </div>

      <div className="mt-2.5 rounded-xl bg-[#F6F4EE] px-3 py-2">
        <div className="text-xs text-[#5F6B63] inline-flex items-center gap-1.5">
          <ClipboardList size={12} /> Petugas absen: <span className="font-semibold text-[#14201A]">{deleg.grantee_name}</span>
        </div>
        <div className="text-[11px] text-[#8A948D] mt-0.5">Diberikan oleh {deleg.granted_by}</div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button
          type="button"
          data-testid={`penjaga-absensi-${deleg.id}`}
          disabled={!aktif}
          onClick={() => onBuka(deleg.kegiatan_id || k.id, "absensi")}
          className="h-11 rounded-xl bg-[#14633F] text-white font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#0E4E31] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ClipboardList size={16} /> Absensi
        </button>
        <button
          type="button"
          data-testid={`penjaga-scan-${deleg.id}`}
          disabled={!aktif}
          onClick={() => onBuka(deleg.kegiatan_id || k.id, "scan")}
          className="h-11 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#E3F3EA] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ScanLine size={16} /> Scan QR
        </button>
      </div>
      {!aktif && (
        <p className="mt-1.5 text-[11px] text-[#8A948D] text-center">
          {st === "mendatang" ? "Aktif saat kegiatan dimulai" : "Kegiatan sudah selesai"}
        </p>
      )}
    </div>
  );
}

function PenjagaKegiatan({ kegiatanId, layar, onBack, onPindahLayar }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("manual");
  const [q, setQ] = useState("");
  const [cariOpen, setCariOpen] = useState(false);
  const [filter, setFilter] = useState("semua");
  const [busy, setBusy] = useState(null);
  const [reasonFor, setReasonFor] = useState(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [batalFor, setBatalFor] = useState(null);
  const [tamu, setTamu] = useState("");
  const [tamuErr, setTamuErr] = useState("");
  const [tamuBusy, setTamuBusy] = useState(false);
  const [laporan, setLaporan] = useState(null);
  const [bagikan, setBagikan] = useState(null);
  const [aksiOpen, setAksiOpen] = useState(false);
  const [kesanOpen, setKesanOpen] = useState(false);
  const [recent, setRecent] = useState([]);
  const [flash, setFlash] = useState(null);
  const lock = useRef(false);
  const flashTimer = useRef(null);

  const load = useCallback(() => {
    api.get(`/delegate/kegiatan/${kegiatanId}`)
      .then(({ data: d }) => setData(d))
      .catch((e) => { setData(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  const loadLaporan = useCallback(() => {
    setLaporan(null);
    api.get(`/delegate/kegiatan/${kegiatanId}/rekap`)
      .then(({ data: d }) => setLaporan(d))
      .catch((e) => { setLaporan(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, [kegiatanId]);

  useEffect(() => { if (tab === "laporan") loadLaporan(); }, [tab, loadLaporan]);

  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  const mark = async (userId, status, extra = {}) => {
    setBusy(userId + status);
    try {
      await api.post(`/delegate/kegiatan/${kegiatanId}/absen`, { user_id: userId, status, ...extra });
      toast.success(status === "hadir" ? "Kehadiran tercatat." : "Keterangan tersimpan.");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(null); }
  };

  // Ketuk status yang sama = membatalkan catatan (hanya milik penjaga ini).
  const ketukStatus = (p, status) => {
    if (p.status === status && p.can_cancel) { setBatalFor(p); return; }
    if (status === "izin") { setReasonFor(p); setReason(""); setNote(""); return; }
    mark(p.id, status);
  };

  const batal = async () => {
    const target = batalFor;
    setBatalFor(null);
    try {
      await api.delete(`/delegate/kegiatan/${kegiatanId}/absen/${target.id}`);
      toast.success("Catatan absen dibatalkan.");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const submitReason = async () => {
    if (!reason) { toast.error("Pilih alasan terlebih dahulu."); return; }
    const target = reasonFor;
    setReasonFor(null);
    await mark(target.id, "izin", { reason, note: note.trim() || null });
  };

  const showFlash = (payload) => {
    setFlash(payload);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 2000);
  };

  const onDetected = async (text) => {
    if (lock.current) return;
    const raw = (text || "").trim();
    if (!raw.startsWith("EKP:")) {
      showFlash({ kind: "bad", name: "Kartu tidak dikenali" });
      return;
    }
    lock.current = true;
    try {
      const { data: res } = await api.post(`/delegate/kegiatan/${kegiatanId}/scan-personal`, { content: raw });
      setRecent((prev) => [{ ...res, id: `${res.name}-${Date.now()}` }, ...prev].slice(0, 10));
      showFlash({
        kind: res.already ? "dup" : "ok",
        name: res.name,
        label: res.already ? "Sudah tercatat tadi" : "Hadir",
      });
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setTimeout(() => { lock.current = false; }, 1500);
    }
  };

  const tambahTamu = async () => {
    if (tamu.trim().length < 2) { setTamuErr("Nama tamu minimal 2 huruf."); return; }
    setTamuErr("");
    setTamuBusy(true);
    try {
      const { data: res } = await api.post(`/delegate/kegiatan/${kegiatanId}/guest`, { name: tamu.trim() });
      toast.success(res.message || "Tamu tercatat hadir.");
      setTamu("");
      load();
    } catch (e) {
      setTamuErr(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setTamuBusy(false); }
  };

  const hapusTamu = async (id) => {
    try {
      await api.delete(`/delegate/kegiatan/${kegiatanId}/guest/${id}`);
      toast.success("Data tamu dihapus.");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const bukaBagikan = async () => {
    try {
      const { data: res } = await api.post(`/delegate/kegiatan/${kegiatanId}/share`);
      setBagikan(res);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const rows = useMemo(() => {
    if (!data || !data.peserta) return [];
    const t = q.trim().toLowerCase();
    let list = t ? data.peserta.filter((p) => (p.name || "").toLowerCase().includes(t)) : data.peserta;
    if (filter === "belum") list = list.filter((p) => !p.status);
    else if (filter !== "semua") list = list.filter((p) => p.status === filter);
    return list;
  }, [data, q, filter]);

  const counts = useMemo(() => {
    const c = { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0, belum: 0 };
    (data?.peserta || []).forEach((p) => {
      c.total += 1;
      if (p.status && p.status in c) c[p.status] += 1;
      else c.belum += 1;
    });
    return c;
  }, [data]);

  const k = data?.kegiatan;
  const publik = (k?.audience || "reguler") === "publik";
  const tamuCount = (data?.guests || []).length;

  if (data === null) {
    return <div className="p-14 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;
  }
  if (data === false) {
    return (
      <div className="space-y-3">
        <TombolKembali onBack={onBack} />
        <div className="bg-white rounded-2xl border border-[#FBE5E3] p-6 text-center text-sm text-[#A32A2A]">
          Mohon maaf, hak penjaga absen untuk kegiatan ini sudah tidak aktif.
        </div>
      </div>
    );
  }

  /* ---------------------------- LAYAR SCAN ---------------------------- */
  if (layar === "scan") {
    return (
      <div className="space-y-3" data-testid="penjaga-scan-layar">
        <TombolKembali onBack={onBack} />
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4">
          <h2 className="font-heading font-bold text-[#14201A]">{k?.name}</h2>
          <p className="text-sm text-[#5F6B63] mt-1">
            Arahkan kamera ke <b>QR pribadi peserta</b> (menu “QR Saya”) untuk mencatat kehadiran.
          </p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-[#E7E3D8] bg-[#F6F4EE] min-h-[320px]">
          <QrScanner onDetected={onDetected} />
          {flash && (
            <div className="scan-flash pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/45 px-4 text-center">
              {flash.kind === "bad" ? (
                <span className="rounded-full bg-[#FBE5E3] px-4 py-2 text-lg font-extrabold text-[#A32A2A]">{flash.name}</span>
              ) : (
                <>
                  <span className="text-2xl font-extrabold text-white">{flash.name}</span>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${flash.kind === "dup" ? "bg-[#FBF1D6] text-[#6B4500]" : "bg-[#E3F3EA] text-[#0E4E31]"}`}>
                    {flash.label}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
        <section className="overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white" data-testid="penjaga-scan-hasil">
          <div className="flex items-center justify-between border-b border-[#E7E3D8] px-4 py-3">
            <h3 className="font-bold text-[#14201A]">Peserta berhasil dipindai</h3>
            <span className="rounded-full bg-[#E3F3EA] px-2 py-0.5 text-xs font-bold text-[#0E4E31]">{recent.length}</span>
          </div>
          {recent.length ? (
            <div className="divide-y divide-[#E7E3D8] max-h-64 overflow-y-auto">
              {recent.map((r) => (
                <div key={r.id} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
                  <CheckCircle2 size={18} className="shrink-0 text-[#0E4E31]" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-[#14201A]">{r.name}</span>
                  <span className="shrink-0 text-xs text-[#5F6B63]">
                    {r.already ? "Sudah hadir" : "Hadir"}{r.arrival_time ? ` · ${hhmm(r.arrival_time)}` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="p-6 text-center text-sm text-[#5F6B63]">Nama peserta yang berhasil dipindai akan tampil di sini.</p>
          )}
        </section>
      </div>
    );
  }

  /* --------------------------- LAYAR ABSENSI --------------------------- */
  const TABS = [
    { key: "manual", label: "Manual" },
    ...(publik ? [{ key: "tamu", label: "Tamu" }] : []),
    { key: "laporan", label: "Laporan" },
  ];

  return (
    <div className="space-y-3 pb-24 lg:pb-0" data-testid="penjaga-absensi-layar">
      <div className="flex items-center gap-2">
        <TombolKembali onBack={onBack} />
        {/* Desktop: tombol kecil di baris judul (bar bawah disembunyikan). */}
        <div className="ml-auto hidden lg:flex items-center gap-2">
          <button type="button" onClick={bukaBagikan}
            className="h-10 px-3.5 rounded-xl border border-[#E7E3D8] bg-white text-[#5F6B63] font-semibold text-sm inline-flex items-center gap-2 hover:border-[#14633F] hover:text-[#0E4E31]">
            <Share2 size={16} /> Bagikan
          </button>
          <button type="button" data-testid="penjaga-aksi-desktop" onClick={() => setAksiOpen(true)}
            className="h-10 px-3.5 rounded-xl border border-[#E7E3D8] bg-white text-[#5F6B63] font-semibold text-sm inline-flex items-center gap-2 hover:border-[#14633F] hover:text-[#0E4E31]">
            <MoreHorizontal size={16} /> Aksi
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4">
        <h2 className="font-heading font-bold text-[#14201A]">{k?.name}</h2>
        <div className="text-sm text-[#5F6B63] mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {tanggalSingkat(k?.date)}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {k?.start_time}–{k?.end_time} WITA</span>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar bg-white p-1.5 rounded-2xl border border-[#E7E3D8]">
        {TABS.map((t) => (
          <button
            key={t.key}
            data-testid={`penjaga-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`shrink-0 h-11 px-4 rounded-xl font-semibold text-sm transition-colors ${
              tab === t.key ? "bg-[#14633F] text-white" : "text-[#5F6B63] hover:bg-[#F0EEE6]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "manual" && (
        <div className="space-y-2">
          {cariOpen && (
            <div className="relative">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
              <input
                data-testid="penjaga-cari"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama peserta..."
                className="w-full h-11 pl-11 pr-4 rounded-xl border border-[#8A948D] bg-white text-sm outline-none focus:border-[#14633F]"
              />
            </div>
          )}
          {filter !== "semua" && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  data-testid={`penjaga-filter-${f.key}`}
                  onClick={() => setFilter(f.key)}
                  className={`shrink-0 h-9 px-3 rounded-full text-xs font-semibold border transition-colors ${
                    filter === f.key
                      ? "bg-[#14633F] text-white border-[#14633F]"
                      : "bg-white text-[#5F6B63] border-[#E7E3D8] hover:border-[#14633F]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden" data-testid="penjaga-manual-panel">
            <ul className="divide-y divide-[#E7E3D8] max-h-[62vh] overflow-y-auto">
              {rows.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-[#5F6B63]">Tidak ada peserta yang cocok.</li>
              ) : rows.map((p) => (
                <li key={p.id} data-testid={`penjaga-row-${p.id}`} className="px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#14201A] text-sm truncate">{p.name}</div>
                      <div className="text-[11px] text-[#5F6B63] flex items-center gap-1.5 flex-wrap">
                        {p.gender === "L" ? "Laki-laki" : p.gender === "P" ? "Perempuan" : "—"}
                        {p.status === "hadir" && p.arrival_time && <span className="font-mono">{hhmm(p.arrival_time)}</span>}
                        {p.account_status === "pending" && (
                          <span className="inline-flex items-center gap-1 font-semibold text-[#6B4500]">
                            <AlertTriangle size={10} /> Belum aktivasi
                          </span>
                        )}
                        {p.reason && <span className="text-[#6B4500]">Alasan: {p.reason}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {["hadir", "izin", "sakit"].map((s) => {
                        const on = p.status === s;
                        const cfg = STATUS_BTN[s];
                        return (
                          <button
                            key={s}
                            data-testid={`penjaga-btn-${s}-${p.id}`}
                            disabled={busy === p.id + s}
                            onClick={() => ketukStatus(p, s)}
                            title={on && p.can_cancel ? `${cfg.full} — ketuk lagi untuk membatalkan` : cfg.full}
                            aria-label={cfg.full}
                            className={`h-10 w-10 rounded-full text-sm font-bold border-2 transition-colors disabled:opacity-50 ${
                              on ? `${cfg.on} border-transparent` : `bg-white ${cfg.off} border-[#D9D4C5] hover:border-current`
                            }`}
                          >
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "tamu" && (
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4 space-y-3" data-testid="penjaga-tamu-panel">
          <p className="text-sm text-[#5F6B63]">Tambahkan tamu yang hadir tanpa akun peserta.</p>
          <div className="flex gap-2">
            <input
              data-testid="penjaga-tamu-input"
              value={tamu}
              onChange={(e) => { setTamu(e.target.value); setTamuErr(""); }}
              placeholder="Nama tamu"
              className={`h-11 flex-1 rounded-xl border px-3.5 text-sm outline-none focus:border-[#14633F] ${tamuErr ? "border-[#A32A2A]" : "border-[#8A948D]"}`}
            />
            <button
              data-testid="penjaga-tamu-submit"
              onClick={tambahTamu}
              disabled={tamuBusy}
              className="h-11 px-4 rounded-xl bg-[#14633F] text-white font-semibold text-sm hover:bg-[#0E4E31] disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {tamuBusy ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />} Tambah
            </button>
          </div>
          {tamuErr && <p className="text-xs text-[#A32A2A]" data-testid="penjaga-tamu-error">{tamuErr}</p>}
          {(data.guests || []).length === 0 ? (
            <p className="text-sm text-[#5F6B63] py-4 text-center">Belum ada tamu.</p>
          ) : (
            <ul className="divide-y divide-[#E7E3D8] border border-[#E7E3D8] rounded-xl overflow-hidden">
              {(data.guests || []).map((g) => (
                <li key={g.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#14201A]">{g.name}</span>
                  <span className="text-xs text-[#5F6B63]">{g.arrival_time ? `${hhmm(g.arrival_time)} WITA` : "Tamu"}</span>
                  <button
                    data-testid={`penjaga-tamu-hapus-${g.id}`}
                    onClick={() => hapusTamu(g.id)}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-[#E7E3D8] text-[#A32A2A] hover:bg-[#FBE5E3]"
                    aria-label={`Hapus tamu ${g.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "laporan" && (
        <div className="space-y-3" data-testid="penjaga-laporan-panel">
          {laporan === null ? (
            <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={26} /></div>
          ) : laporan === false ? (
            <div className="bg-white rounded-2xl border border-[#FBE5E3] p-6 text-center text-sm text-[#A32A2A]">
              Mohon maaf, laporan tidak dapat dimuat.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-[#14201A] inline-flex items-center gap-2"><FileBarChart2 size={17} /> Laporan kehadiran</h3>
                  <button onClick={loadLaporan} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#E7E3D8] text-xs font-semibold text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]">
                    <RefreshCw size={14} /> Segarkan
                  </button>
                </div>
                <p className="text-xs text-[#5F6B63] mt-1">Diperbarui {hhmm(laporan.diperbarui)} WITA</p>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="rounded-xl bg-[#F0EEE6] p-2.5 text-center"><div className="text-lg font-bold text-[#14201A]">{counts.total}</div><div className="text-[11px] text-[#5F6B63]">Total</div></div>
                  <div className="rounded-xl bg-[#E3F3EA] p-2.5 text-center"><div className="text-lg font-bold text-[#0E4E31]">{counts.hadir}</div><div className="text-[11px] text-[#5F6B63]">Hadir</div></div>
                  <div className="rounded-xl bg-[#FBF1D6] p-2.5 text-center"><div className="text-lg font-bold text-[#6B4500]">{counts.izin}</div><div className="text-[11px] text-[#5F6B63]">Izin</div></div>
                  <div className="rounded-xl bg-[#E3EEFB] p-2.5 text-center"><div className="text-lg font-bold text-[#1D4F91]">{counts.sakit}</div><div className="text-[11px] text-[#5F6B63]">Sakit</div></div>
                  <div className="rounded-xl bg-[#FBE5E3] p-2.5 text-center"><div className="text-lg font-bold text-[#A32A2A]">{counts.alpha}</div><div className="text-[11px] text-[#5F6B63]">Alpha</div></div>
                  <div className="rounded-xl bg-[#F0EEE6] p-2.5 text-center"><div className="text-lg font-bold text-[#5F6B63]">{counts.belum}</div><div className="text-[11px] text-[#5F6B63]">Belum</div></div>
                </div>
                <p className="mt-2.5 text-[11px] leading-snug text-[#8A948D]">
                  Yang belum absen jadi Alpha saat kegiatan selesai pukul {k?.end_time} WITA.
                </p>
              </div>

              {[
                { key: "hadir", label: "Hadir", cls: "bg-[#E3F3EA] text-[#0E4E31]" },
                { key: "izin", label: "Izin", cls: "bg-[#FBF1D6] text-[#6B4500]" },
                { key: "sakit", label: "Sakit", cls: "bg-[#E3EEFB] text-[#1D4F91]" },
                { key: "alpha", label: "Alpha", cls: "bg-[#FBE5E3] text-[#A32A2A]" },
                { key: "belum", label: "Belum diabsen", cls: "bg-[#F0EEE6] text-[#5F6B63]" },
              ].map((g) => {
                const list = laporan.groups?.[g.key] || [];
                return (
                  <div key={g.key} className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden">
                    <div className={`flex items-center justify-between px-4 py-2.5 ${g.cls}`}>
                      <span className="font-bold text-sm">{g.label}</span>
                      <span className="text-sm font-bold">{list.length}</span>
                    </div>
                    {list.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-[#5F6B63]">Tidak ada.</p>
                    ) : (
                      <ul className="divide-y divide-[#E7E3D8] max-h-56 overflow-y-auto">
                        {list.map((r) => (
                          <li key={r.id} className="px-4 py-2.5">
                            <div className="text-sm font-semibold text-[#14201A] truncate">{r.name}</div>
                            {(r.reason || r.note) && (
                              <div className="text-xs text-[#5F6B63] mt-0.5">
                                {r.reason}{r.reason && r.note ? " · " : ""}{r.note}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}

              {tamuCount > 0 && (
                <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#E3F3EA] text-[#0E4E31]">
                    <span className="font-bold text-sm">Tamu</span>
                    <span className="text-sm font-bold">{tamuCount}</span>
                  </div>
                  <ul className="divide-y divide-[#E7E3D8]">
                    {(laporan.guests || []).map((g) => (
                      <li key={g.id} className="px-4 py-2.5 text-sm font-semibold text-[#14201A] truncate">{g.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Bar navigasi bawah — hanya di HP, hanya di layar Absensi. */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-[#E7E3D8] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        data-testid="penjaga-bar-bawah">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end">
          <button type="button" data-testid="penjaga-bar-cari"
            onClick={() => { setTab("manual"); setCariOpen(true); }}
            className={`flex flex-col items-center justify-center gap-0.5 py-2.5 ${cariOpen ? "text-[#0E4E31]" : "text-[#5F6B63]"}`}>
            <Search size={21} />
            <span className="text-[11px] font-medium">Pencarian</span>
          </button>
          <button type="button" data-testid="penjaga-bar-filter"
            onClick={() => { setTab("manual"); setFilter((f) => (f === "semua" ? "belum" : "semua")); }}
            className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 ${filter !== "semua" ? "text-[#0E4E31]" : "text-[#5F6B63]"}`}>
            <SlidersHorizontal size={21} />
            <span className="text-[11px] font-medium">Filter</span>
            {filter !== "semua" && <span className="absolute right-4 top-2 h-1.5 w-1.5 rounded-full bg-[#14633F]" />}
          </button>
          <button type="button" data-testid="penjaga-bar-scan"
            onClick={() => onPindahLayar("scan")}
            aria-label="Scan QR"
            className="flex flex-col items-center justify-end gap-0.5 pb-1.5">
            <span className="-mt-6 flex h-[54px] w-[54px] items-center justify-center rounded-full border-4 border-white bg-[#14633F] text-white shadow-[0_8px_20px_-6px_rgba(11,107,82,0.6)] transition-transform active:scale-95">
              <ScanLine size={24} strokeWidth={2.2} />
            </span>
            <span className="text-[11px] font-medium text-[#5F6B63]">Scan</span>
          </button>
          <button type="button" data-testid="penjaga-bar-bagikan" onClick={bukaBagikan}
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[#5F6B63]">
            <Share2 size={21} />
            <span className="text-[11px] font-medium">Bagikan</span>
          </button>
          <button type="button" data-testid="penjaga-bar-aksi" onClick={() => setAksiOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 text-[#5F6B63]">
            <MoreHorizontal size={21} />
            <span className="text-[11px] font-medium">Aksi</span>
          </button>
        </div>
      </nav>

      {/* Filter pills mengambang di atas bar bawah saat tab bukan Manual. */}
      {filter !== "semua" && tab !== "manual" && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem_+_env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg px-4 lg:hidden">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar rounded-xl border border-[#E7E3D8] bg-white p-1.5 shadow-lg">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => { setFilter(f.key); setTab("manual"); }}
                className={`shrink-0 h-9 px-3 rounded-full text-xs font-semibold border transition-colors ${
                  filter === f.key ? "bg-[#14633F] text-white border-[#14633F]" : "bg-white text-[#5F6B63] border-[#E7E3D8]"
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {aksiOpen && (
        <Modal onClose={() => setAksiOpen(false)} title="Aksi" testid="penjaga-aksi-modal" maxWidth={480}>
          <button
            type="button"
            data-testid="penjaga-aksi-kesan"
            onClick={() => { setAksiOpen(false); setKesanOpen(true); }}
            className="w-full flex items-center gap-3 rounded-xl border border-[#E7E3D8] px-4 py-3 text-left hover:border-[#14633F] hover:bg-[#F6F4EE]"
          >
            <MessageSquareQuote size={18} className="shrink-0 text-[#0E4E31]" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#14201A]">Pesan dan kesan</span>
              <span className="block text-xs text-[#5F6B63]">Sampaikan kesan Anda untuk kegiatan ini.</span>
            </span>
          </button>
        </Modal>
      )}

      {kesanOpen && (
        <KesanModal kegiatanId={kegiatanId} nama={k?.name} onClose={() => setKesanOpen(false)} />
      )}

      {reasonFor && (
        <Modal
          onClose={() => setReasonFor(null)}
          title="Alasan tidak hadir"
          subtitle={reasonFor.name}
          testid="penjaga-alasan-modal"
          maxWidth={520}
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setReasonFor(null)}
                className="h-11 flex-1 rounded-xl border border-[#E7E3D8] font-semibold text-sm text-[#5F6B63] hover:bg-[#F6F4EE]">
                Batal
              </button>
              <button type="button" data-testid="penjaga-alasan-simpan" onClick={submitReason}
                className="h-11 flex-1 rounded-xl bg-[#14633F] font-semibold text-sm text-white hover:bg-[#0E4E31]">
                Simpan
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {ALASAN.map((a) => (
                <button
                  key={a}
                  type="button"
                  data-testid={`penjaga-alasan-${a}`}
                  onClick={() => setReason(a)}
                  className={`h-11 rounded-xl border-2 text-sm font-semibold transition-colors ${
                    reason === a ? "border-[#14633F] bg-[#E3F3EA] text-[#0E4E31]" : "border-[#E7E3D8] text-[#5F6B63] hover:border-[#14633F]"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            <div>
              <label className="text-sm font-semibold text-[#14201A]">Keterangan (opsional)</label>
              <textarea
                data-testid="penjaga-alasan-ket"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-xl border border-[#8A948D] px-3.5 py-2.5 text-sm outline-none focus:border-[#14633F] resize-none"
              />
            </div>
          </div>
        </Modal>
      )}

      {batalFor && (
        <Modal
          onClose={() => setBatalFor(null)}
          title="Batalkan catatan absen?"
          subtitle={batalFor.name}
          testid="penjaga-batal-modal"
          maxWidth={480}
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setBatalFor(null)}
                className="h-11 flex-1 rounded-xl border border-[#E7E3D8] font-semibold text-sm text-[#5F6B63] hover:bg-[#F6F4EE]">
                Batal
              </button>
              <button type="button" data-testid="penjaga-batal-ya" onClick={batal}
                className="h-11 flex-1 rounded-xl bg-[#A32A2A] font-semibold text-sm text-white hover:bg-[#8C2222]">
                Ya, batalkan
              </button>
            </div>
          }
        >
          <p className="text-sm text-[#5F6B63]">
            Catatan absen {batalFor.name} akan dihapus sehingga peserta kembali berstatus belum diabsen.
          </p>
        </Modal>
      )}

      {bagikan && (
        <Modal
          onClose={() => setBagikan(null)}
          title="Bagikan rekap kegiatan"
          testid="penjaga-bagikan-modal"
          maxWidth={560}
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setBagikan(null)}
                className="h-11 flex-1 rounded-xl border border-[#E7E3D8] font-semibold text-sm text-[#5F6B63] hover:bg-[#F6F4EE]">
                Batal
              </button>
              <button type="button"
                onClick={() => { navigator.clipboard.writeText(bagikan.wa_text); toast.success("Teks disalin."); }}
                className="h-11 flex-1 rounded-xl border border-[#E7E3D8] font-semibold text-sm text-[#5F6B63] hover:bg-[#F6F4EE] inline-flex items-center justify-center gap-1.5">
                <Copy size={15} /> Salin teks
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(bagikan.wa_text)}`} target="_blank" rel="noreferrer"
                className="h-11 flex-1 rounded-xl bg-[#14633F] font-semibold text-sm text-white hover:bg-[#0E4E31] inline-flex items-center justify-center gap-1.5">
                <Send size={15} /> Buka WhatsApp
              </a>
            </div>
          }
        >
          <div className="rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] p-3 text-sm whitespace-pre-wrap text-[#14201A] max-h-56 overflow-y-auto">
            {bagikan.wa_text}
          </div>
        </Modal>
      )}
    </div>
  );
}

function TombolKembali({ onBack }) {
  return (
    <button
      type="button"
      data-testid="penjaga-back"
      onClick={onBack}
      className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border border-[#E7E3D8] bg-white text-[#5F6B63] font-semibold text-sm hover:border-[#14633F] hover:text-[#0E4E31]"
    >
      <ArrowLeft size={17} /> Kembali
    </button>
  );
}

/** Kesan & pesan memakai fitur yang sudah ada (POST /me/kesan-pesan). */
function KesanModal({ kegiatanId, nama, onClose }) {
  const [sentiment, setSentiment] = useState("suka");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const kirim = async () => {
    if (message.trim().length < 5) {
      toast.error("Mohon tuliskan kesan & pesan Anda terlebih dahulu.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/me/kesan-pesan", {
        kegiatan_id: kegiatanId, sentiment, message: message.trim(),
      });
      toast.success(data.message);
      onClose();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return (
    <Modal
      onClose={onClose}
      title="Kesan & Pesan"
      subtitle={nama}
      testid="penjaga-kesan-modal"
      maxWidth={560}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-[#E7E3D8] font-semibold text-sm text-[#5F6B63] hover:bg-[#F6F4EE]">
            Batal
          </button>
          <button type="button" data-testid="penjaga-kesan-kirim" onClick={kirim} disabled={saving}
            className="h-11 flex-1 rounded-xl bg-[#14633F] font-semibold text-sm text-white hover:bg-[#0E4E31] disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <MessageSquareQuote size={16} />} Kirim
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[
            { key: "suka", label: "Suka", icon: ThumbsUp },
            { key: "tidak_suka", label: "Tidak suka", icon: ThumbsDown },
          ].map((o) => {
            const Icon = o.icon;
            const on = sentiment === o.key;
            return (
              <button key={o.key} type="button" onClick={() => setSentiment(o.key)}
                className={`rounded-xl border-2 p-3 text-center transition-colors ${on ? "border-[#14633F] bg-[#E3F3EA]" : "border-[#E7E3D8] bg-white"}`}>
                <Icon size={20} className={`mx-auto ${on ? "text-[#0E4E31]" : "text-[#5F6B63]"}`} />
                <div className={`mt-1 text-sm font-semibold ${on ? "text-[#0E4E31]" : "text-[#14201A]"}`}>{o.label}</div>
              </button>
            );
          })}
        </div>
        <div>
          <label className="text-sm font-semibold text-[#14201A]">Kesan dan pesan</label>
          <textarea
            data-testid="penjaga-kesan-pesan"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 3000))}
            rows={4}
            placeholder="Tulis kesan dan pesan Anda di sini…"
            className="mt-1.5 w-full rounded-xl border border-[#8A948D] px-3.5 py-2.5 text-sm outline-none focus:border-[#14633F] resize-none"
          />
        </div>
      </div>
    </Modal>
  );
}
