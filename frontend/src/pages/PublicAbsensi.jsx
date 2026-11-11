import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CalendarDays, Clock, MapPin, User, BookOpen, Loader2, KeyRound, ShieldAlert,
  Search, ScanLine, ListChecks, AlertTriangle, CheckCircle2, RefreshCw,
  UserPlus, Trash2, Users, FileBarChart2, Link2, Send,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail, isOfflineError } from "@/lib/api";
import { useOfflineQueue } from "@/lib/offline";
import OfflineBanner from "@/components/OfflineBanner";
import QrScanner from "@/components/QrScanner";
import { Logo } from "@/components/Logo";
import { ACTIVITIES } from "@/constants/testIds";
import { TYPE_LABEL, tanggalPanjang, hhmm, AUDIENCE_LABEL, GENDER_FILTER_LABEL } from "./admin/kegiatanUtils";

/**
 * FASE 7 — Halaman Absensi lewat TAUTAN + KODE AKSES 6 digit.
 *
 * Pengurus membagikan tautan kegiatan beserta kode akses 6 digit. Pemegang
 * tautan (petugas absen di lokasi) memasukkan kode, lalu langsung melihat
 * DAFTAR PESERTA — baik yang sudah aktif maupun yang BELUM aktivasi — untuk
 * diabsen MANUAL atau lewat SCAN BARCODE (QR pribadi peserta).
 *
 * Kode akses berlaku sampai kegiatan ditutup/selesai.
 */

const STATUS_BTN = {
  hadir: { label: "H", full: "Hadir", on: "bg-[#14633F] text-white", off: "text-[#0E4E31]" },
  izin: { label: "I", full: "Izin", on: "bg-[#8A5A00] text-white", off: "text-[#6B4500]" },
  sakit: { label: "S", full: "Sakit", on: "bg-[#1D4F91] text-white", off: "text-[#1D4F91]" },
  alpha: { label: "A", full: "Alpha", on: "bg-[#A32A2A] text-white", off: "text-[#A32A2A]" },
};

const REPORT_STATUS = {
  hadir: { label: "Hadir", cls: "bg-[#E3F3EA] text-[#0E4E31]" },
  izin: { label: "Izin", cls: "bg-[#FBF1D6] text-[#6B4500]" },
  sakit: { label: "Sakit", cls: "bg-[#E3EEFB] text-[#1D4F91]" },
  alpha: { label: "Alpha", cls: "bg-[#FBE5E3] text-[#A32A2A]" },
  belum_diabsen: { label: "Belum diabsen", cls: "bg-[#F0EEE6] text-[#5F6B63]" },
  optional: { label: "Tidak wajib", cls: "bg-[#ECE4FB] text-[#4C2A9B]" },
};

function storageKey(token) {
  return `absensi_access_${token}`;
}

export default function PublicAbsensi() {
  const { token } = useParams();
  const [access, setAccess] = useState(() => sessionStorage.getItem(storageKey(token)) || "");
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [fatal, setFatal] = useState("");
  const [tab, setTab] = useState("manual");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [guestName, setGuestName] = useState("");
  const [guestSaving, setGuestSaving] = useState(false);
  const [reportShare, setReportShare] = useState(null);
  const [reportSharing, setReportSharing] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(null); // null | "back" | "button"
  const [closing, setClosing] = useState(false);
  const leavingRef = useRef(false);
  const scanLock = useRef(false);

  const dropAccess = useCallback(() => {
    sessionStorage.removeItem(storageKey(token));
    setAccess("");
    setData(null);
  }, [token]);

  const load = useCallback(async (acc) => {
    try {
      const { data: d } = await api.get(`/absensi/${token}`, { params: { access: acc } });
      setData(d);
      setFatal("");
    } catch (e) {
      const status = e.response?.status;
      const detail = formatApiErrorDetail(e.response?.data?.detail);
      if (isOfflineError(e)) {
        // Mode offline: pertahankan data terakhir yang sudah tampil.
        return;
      }
      if (status === 401) {
        dropAccess();
        setErr(detail);
      } else {
        setFatal(detail);
      }
    }
  }, [token, dropAccess]);

  // FASE 8 — antrean absen offline + sinkronisasi otomatis saat online kembali.
  const sender = useCallback(async (items) => {
    await api.post(`/absensi/${token}/mark-batch`, { access, items });
  }, [token, access]);

  const onSynced = useCallback((n) => {
    toast.success(`${n} absen offline berhasil dikirim ke server.`);
    load(access);
  }, [load, access]);

  const { pending, statusMap, online, syncing, add: addQueue, flush } =
    useOfflineQueue(`absensi_${token}`, sender, onSynced);

  useEffect(() => {
    if (access) load(access);
  }, [access, load]);

  /* ------------------- Tutup absensi & peringatan keluar ------------------- */
  const absensiOpen = Boolean(access && data?.kegiatan && data.kegiatan.status === "open");

  const closeAbsensi = useCallback(async () => {
    const leaving = closeConfirm === "back";
    setClosing(true);
    try {
      const { data: res } = await api.post(`/absensi/${token}/close`, { access });
      toast.success(res.message || "Absensi ditutup.");
      setCloseConfirm(null);
      await load(access);
      if (leaving) {
        leavingRef.current = true;
        window.history.back();
      }
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setClosing(false);
    }
  }, [token, access, load, closeConfirm]);

  // Peringatan saat menutup tab / keluar halaman (dialog bawaan browser).
  useEffect(() => {
    if (!absensiOpen) return undefined;
    const onBeforeUnload = (e) => {
      if (leavingRef.current) return undefined;
      e.preventDefault();
      e.returnValue = "Absensi belum ditutup. Peserta yang belum diabsen akan otomatis ditandai Alpha. Yakin keluar?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [absensiOpen]);

  // Tombol back browser → modal konfirmasi sendiri.
  useEffect(() => {
    if (!absensiOpen) return undefined;
    window.history.pushState({ absensiGuard: true }, "");
    const onPopState = () => {
      if (leavingRef.current) return;
      setCloseConfirm("back");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [absensiOpen]);

  const cancelClose = () => {
    const fromBack = closeConfirm === "back";
    setCloseConfirm(null);
    if (fromBack && absensiOpen) window.history.pushState({ absensiGuard: true }, "");
  };

  const verify = async (e) => {
    if (e) e.preventDefault();
    const clean = code.replace(/\D/g, "");
    if (clean.length !== 6) {
      setErr("Kode akses harus 6 digit angka.");
      return;
    }
    setVerifying(true);
    setErr("");
    try {
      const { data: d } = await api.post(`/absensi/${token}/verify`, { code: clean });
      sessionStorage.setItem(storageKey(token), d.access);
      setAccess(d.access);
      setData(d);
      setCode("");
      toast.success("Kode akses benar. Daftar peserta siap diabsen.");
    } catch (ex) {
      setErr(formatApiErrorDetail(ex.response?.data?.detail));
    } finally {
      setVerifying(false);
    }
  };

  const mark = async (userId, status) => {
    if (!online) {
      addQueue({ user_id: userId, status });
      toast.info("Tanpa internet — absen disimpan di HP ini dan dikirim otomatis nanti.");
      return;
    }
    setBusy(userId + status);
    try {
      const { data: res } = await api.post(`/absensi/${token}/mark`, {
        access, user_id: userId, status,
      });
      // Fase 7: notifikasi HANYA untuk status "hadir".
      if (res.message) toast.success(res.message);
      await load(access);
    } catch (e) {
      if (isOfflineError(e)) {
        addQueue({ user_id: userId, status });
        toast.info("Koneksi terputus — absen disimpan di HP ini dan dikirim otomatis nanti.");
      } else {
        if (e.response?.status === 401) dropAccess();
        toast.error(formatApiErrorDetail(e.response?.data?.detail));
      }
    } finally {
      setBusy(null);
    }
  };

  const addGuest = async (e) => {
    e.preventDefault();
    if (guestName.trim().length < 2) { toast.error("Mohon isi nama tamu (minimal 2 huruf)."); return; }
    setGuestSaving(true);
    try {
      const { data: res } = await api.post(`/absensi/${token}/guest`, {
        access, name: guestName.trim(),
      });
      toast.success(res.message || "Tamu tercatat hadir.");
      setGuestName("");
      await load(access);
    } catch (ex) {
      toast.error(formatApiErrorDetail(ex.response?.data?.detail));
    } finally { setGuestSaving(false); }
  };

  const removeGuest = async (g) => {
    if (!window.confirm(`Hapus tamu "${g.name}" dari daftar hadir?`)) return;
    try {
      await api.delete(`/absensi/${token}/guest/${g.id}`, { params: { access } });
      toast.success("Data tamu dihapus.");
      await load(access);
    } catch (ex) {
      toast.error(formatApiErrorDetail(ex.response?.data?.detail));
    }
  };

  const getReportShare = async () => {
    if (reportShare) return reportShare;
    setReportSharing(true);
    try {
      const { data: result } = await api.post(`/absensi/${token}/share-rekap`, { access });
      setReportShare(result);
      return result;
    } catch (error) {
      toast.error(formatApiErrorDetail(error.response?.data?.detail));
      return null;
    } finally {
      setReportSharing(false);
    }
  };

  const copyReportLink = async () => {
    const result = await getReportShare();
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.link);
      toast.success("Tautan laporan disalin.");
    } catch {
      toast.error("Tautan gagal disalin. Silakan coba lagi.");
    }
  };

  const shareReportWhatsApp = async () => {
    const popup = window.open("", "_blank");
    const result = await getReportShare();
    if (!result) {
      popup?.close();
      return;
    }
    if (popup) {
      popup.location.href = `https://wa.me/?text=${encodeURIComponent(result.wa_text)}`;
    } else {
      toast.error("WhatsApp tidak dapat dibuka. Salin tautan laporan untuk membagikannya.");
    }
  };

  const onScan = async (text) => {
    if (scanLock.current) return;
    if (!text || !text.startsWith("EKP:")) {
      toast.error("QR ini bukan QR pribadi peserta. Mohon minta peserta membuka menu 'QR Saya'.");
      return;
    }
    scanLock.current = true;
    try {
      const { data: res } = await api.post(`/absensi/${token}/scan-personal`, {
        access, content: text,
      });
      setLastScan(res);
      if (res.already) toast.info(res.message);
      else toast.success(res.message);
      await load(access);
    } catch (e) {
      if (e.response?.status === 401) dropAccess();
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setTimeout(() => { scanLock.current = false; }, 1500);
    }
  };

  const rows = useMemo(() => {
    if (!data?.rows) return [];
    const t = q.trim().toLowerCase();
    const base = t ? data.rows.filter((r) => (r.name || "").toLowerCase().includes(t)) : data.rows;
    return base.map((r) => ({
      ...r,
      status: statusMap[r.user_id] || r.status,
      queued: Boolean(statusMap[r.user_id]),
    }));
  }, [data, q, statusMap]);

  /* ------------------------- Layar error permanen ------------------------- */
  if (fatal) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-[#FBE5E3] p-6 text-center" data-testid="absensi-fatal">
          <ShieldAlert className="mx-auto text-[#A32A2A]" size={34} />
          <p className="mt-3 text-[#A32A2A] font-semibold">{fatal}</p>
        </div>
      </Shell>
    );
  }

  /* ------------------------- Gerbang kode akses ------------------------- */
  if (!access || !data) {
    return (
      <Shell>
        <form onSubmit={verify} className="bg-white rounded-2xl border border-[#E7E3D8] p-6" data-testid="absensi-gate">
          <div className="h-12 w-12 rounded-2xl bg-[#E3F3EA] text-[#14633F] flex items-center justify-center mx-auto">
            <KeyRound size={24} />
          </div>
          <h1 className="font-heading text-xl font-bold text-[#14201A] text-center mt-3">Kode Akses Absensi</h1>
          <p className="text-sm text-[#5F6B63] text-center mt-1">
            Masukkan <b>6 digit kode akses</b> yang diberikan pengurus untuk membuka daftar peserta.
          </p>
          <input
            data-testid="absensi-code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="------"
            className="mt-5 w-full h-14 text-center tracking-[0.6em] text-2xl font-bold rounded-xl border-2 border-[#14633F] outline-none focus:border-[#14633F]"
          />
          {err && (
            <p className="mt-2 text-sm text-[#A32A2A] text-center" data-testid="absensi-code-error">{err}</p>
          )}
          <button
            type="submit"
            data-testid="absensi-code-submit"
            disabled={verifying}
            className="mt-4 w-full h-12 rounded-xl bg-[#14633F] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#0E4E31] disabled:opacity-60"
          >
            {verifying ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Buka Daftar Peserta
          </button>
          <p className="mt-3 text-xs text-[#5F6B63] text-center">
            Kode akses berlaku sampai kegiatan ditutup/selesai.
          </p>
        </form>
      </Shell>
    );
  }

  /* ------------------------- Halaman absensi ------------------------- */
  const k = data.kegiatan || {};
  const c = data.counts || {};
  const closed = k.status !== "open";
  const alphaAllowed = closed || Date.now() >= Date.parse(`${k.date}T${k.end_time}:00+08:00`);
  const publik = (k.audience || "reguler") === "publik";
  const guests = data.guests || [];
  const reportRows = [
    ...(data.rows || []).map((row) => {
      const status = statusMap[row.user_id] || row.status;
      return {
        ...row,
        status,
        reportStatus: status || (row.required_for_session ? "belum_diabsen" : "optional"),
        isGuest: false,
      };
    }),
    ...guests.map((guest) => ({
      ...guest,
      reportStatus: "hadir",
      isGuest: true,
    })),
  ];

  return (
    <Shell>
      <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5" data-testid="absensi-header">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E3F3EA] text-[#0E4E31]">
            {TYPE_LABEL[k.type] || "Kegiatan"}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${closed ? "bg-[#FBE5E3] text-[#A32A2A]" : "bg-[#E3F3EA] text-[#0E4E31]"}`}>
            {closed ? "Selesai" : "Berlangsung"}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E3EEFB] text-[#1D4F91]">
            {AUDIENCE_LABEL[k.audience] || "Reguler"}
          </span>
          {k.susulan && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FBF1D6] text-[#6B4500]" data-testid="absensi-susulan-badge">
              Mode isi susulan
            </span>
          )}
          {(k.filter_labels && k.filter_labels.length
            ? k.filter_labels
            : (k.gender_filter && k.gender_filter !== "semua" ? [GENDER_FILTER_LABEL[k.gender_filter]] : [])
          ).map((l) => (
            <span key={l} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FBE5E3] text-[#A32A2A]">
              {l}
            </span>
          ))}
        </div>
        <h1 className="font-heading text-xl font-bold text-[#14201A] mt-2">{k.name}</h1>
        <div className="text-sm text-[#5F6B63] mt-2 grid gap-1">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {tanggalPanjang(k.date)}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {k.start_time}–{k.end_time} WITA</span>
          {k.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {k.location}</span>}
          {k.teacher && <span className="inline-flex items-center gap-1.5"><User size={14} /> {k.teacher}</span>}
          {k.material && <span className="inline-flex items-center gap-1.5"><BookOpen size={14} /> {k.material}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 sm:grid-cols-3" data-testid="absensi-counts">
        <Stat value={c.total} label="Total" bg="#F6F4EE" fg="#14201A" />
        <Stat value={c.hadir} label="Hadir" bg="#E3F3EA" fg="#0E4E31" />
        <Stat value={c.izin} label="Izin" bg="#FBF1D6" fg="#6B4500" />
        <Stat value={c.sakit} label="Sakit" bg="#E3EEFB" fg="#1D4F91" />
        <Stat value={c.alpha} label="Alpha" bg="#FBE5E3" fg="#A32A2A" />
        <Stat value={c.belum_diabsen} label="Belum diabsen" bg="#F0EEE6" fg="#5F6B63" />
      </div>

      {closed && (
        <div className="mt-3 bg-[#FBF1D6] border border-[#EAD596] rounded-2xl p-4 text-sm text-[#6B4500] flex gap-2.5">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>Kegiatan sudah selesai/ditutup sehingga absensi lewat kode akses dinonaktifkan.</span>
        </div>
      )}

      {!closed && (
        <button
          type="button"
          data-testid="absensi-close-button"
          onClick={() => setCloseConfirm("button")}
          className="mt-3 w-full h-12 rounded-xl bg-[#A32A2A] text-white font-semibold inline-flex items-center justify-center gap-2 hover:brightness-95"
        >
          <CheckCircle2 size={18} /> {k.susulan ? "Simpan dan selesai" : "Tutup Absensi"}
        </button>
      )}

      {closeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,32,26,0.55)] p-4" data-testid="absensi-close-confirm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="font-heading text-lg font-bold text-[#14201A]">Tutup Absensi?</div>
            <p className="mt-1.5 text-sm text-[#5F6B63]">
              Absensi belum ditutup. Peserta yang belum diabsen akan otomatis ditandai Alpha. Yakin keluar?
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="absensi-close-cancel"
                onClick={cancelClose}
                disabled={closing}
                className="h-11 rounded-xl border-2 border-[#E7E3D8] font-semibold text-[#5F6B63] hover:border-[#14633F] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                data-testid="absensi-close-confirm-yes"
                onClick={closeAbsensi}
                disabled={closing}
                className="h-11 rounded-xl bg-[#A32A2A] text-white font-semibold inline-flex items-center justify-center gap-2 hover:brightness-95 disabled:opacity-60"
              >
                {closing ? <Loader2 size={16} className="animate-spin" /> : null} Tutup &amp; Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      <OfflineBanner online={online} pending={pending} syncing={syncing} onSync={flush} className="mt-3" />

      <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
        <TabBtn active={tab === "manual"} onClick={() => setTab("manual")} icon={ListChecks} label="Absen Manual" testid="absensi-tab-manual" />
        <TabBtn active={tab === "scan"} onClick={() => setTab("scan")} icon={ScanLine} label="Scan Barcode" testid="absensi-tab-scan" />
        {publik && (
          <TabBtn active={tab === "tamu"} onClick={() => setTab("tamu")} icon={UserPlus} label={`Tamu (${guests.length})`} testid="absensi-tab-tamu" />
        )}
        <TabBtn active={tab === "report"} onClick={() => setTab("report")} icon={FileBarChart2} label="Rekap/Laporan" testid={ACTIVITIES.absensiTabReport} />
      </div>

      {tab === "manual" && (
        <div className="mt-3 bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden" data-testid="absensi-manual">
          <div className="p-3 bg-[#F6F4EE] border-b border-[#E7E3D8]">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
              <input
                data-testid="absensi-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama peserta..."
                className="w-full h-11 pl-11 pr-4 rounded-xl border border-[#8A948D] outline-none focus:border-[#14633F] bg-white"
              />
            </div>
          </div>
          <div className="divide-y divide-[#E7E3D8]">
            {rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#5F6B63]">Tidak ada peserta.</div>
            ) : rows.map((r) => (
              <div key={r.user_id} data-testid={`absensi-row-${r.user_id}`} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold text-[#14201A] text-sm truncate">{r.name}</div>
                  <div className="text-xs text-[#5F6B63] flex items-center gap-1.5 flex-wrap">
                    {r.kelompok_name || "Tanpa kelompok"}
                    {r.account_status === "pending" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B4500]">
                        <AlertTriangle size={11} /> Belum aktivasi
                      </span>
                    )}
                    {r.status === "hadir" && r.arrival_time && (
                      <span className="font-mono text-[11px] text-[#5F6B63]">{hhmm(r.arrival_time)}</span>
                    )}
                    {r.attended_other && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[#E3F3EA] text-[#0E4E31]">
                        Sudah hadir sesi {r.attended_other_label}
                      </span>
                    )}
                    {r.queued && (
                      <span className="text-[11px] font-semibold text-[#8A5A00]">menunggu dikirim</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {r.attended_other ? (
                    <span className="text-[11px] font-semibold text-[#5F6B63]" data-testid={`absensi-locked-${r.user_id}`}>tidak perlu diabsen lagi</span>
                  ) : ["hadir", "izin", "sakit", "alpha"].map((s) => {
                    const on = r.status === s;
                    const cfg = STATUS_BTN[s];
                    return (
                      <button
                        key={s}
                        data-testid={`absensi-btn-${s}-${r.user_id}`}
                        disabled={closed || busy === r.user_id + s || (s === "alpha" && !alphaAllowed)}
                        onClick={() => mark(r.user_id, s)}
                        title={s === "alpha" && !alphaAllowed ? "Alpha tersedia setelah kegiatan berakhir" : cfg.full}
                        aria-label={cfg.full}
                        className={`h-11 w-11 rounded-full text-xs font-bold border-2 transition-colors disabled:opacity-50 ${on ? `${cfg.on} border-transparent` : `bg-white ${cfg.off} border-[#D9D4C5] hover:border-current`}`}
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

      {tab === "scan" && (
        <div className="mt-3 bg-white rounded-2xl border border-[#E7E3D8] p-4" data-testid="absensi-scan">
          <p className="text-sm text-[#5F6B63] mb-3">
            <ScanLine size={16} className="text-[#14633F] inline mr-1.5 -mt-0.5" />
            Arahkan kamera ke <b>QR pribadi peserta</b> (menu {"\"QR Saya\""} pada akun peserta) untuk mencatat kehadiran.
          </p>
          {!closed && <QrScanner onDetected={onScan} />}
          {!online && (
            <p className="text-xs text-[#8A5A00] mt-2">
              Mode scan barcode memerlukan internet. Saat offline, silakan gunakan Absen Manual.
            </p>
          )}
          {lastScan && (
            <div className="mt-3 bg-[#F6F4EE] border border-[#E7E3D8] rounded-xl p-3 flex items-center gap-2 text-sm text-[#0E4E31]" data-testid="absensi-scan-result">
              <CheckCircle2 size={18} /> <b>{lastScan.name}</b> — {lastScan.already ? "sudah tercatat hadir" : "tercatat hadir"}
              {lastScan.arrival_time ? ` (${hhmm(lastScan.arrival_time)})` : ""}
            </div>
          )}
        </div>
      )}

      {tab === "tamu" && publik && (
        <div className="mt-3 space-y-3" data-testid="absensi-tamu">
          <form onSubmit={addGuest} className="bg-white rounded-2xl border border-[#E7E3D8] p-4">
            <div className="font-bold text-[#14201A] text-[15px] flex items-center gap-2">
              <UserPlus size={17} className="text-[#14633F]" /> Tambah Tamu (tanpa akun)
            </div>
            <p className="text-sm text-[#5F6B63] mt-1 leading-relaxed">
              Kegiatan ini <b>terbuka/publik</b>. Peserta yang belum mengaktivasi akun cukup
              dicatat namanya saja, dan langsung terhitung hadir.
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <input
                data-testid="absensi-tamu-input"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Nama tamu"
                className="flex-1 min-w-[160px] h-11 px-3.5 rounded-xl border border-[#8A948D] outline-none focus:border-[#14633F] bg-white"
              />
              <button
                data-testid="absensi-tamu-add"
                type="submit"
                disabled={guestSaving || closed || !online}
                className="h-11 px-4 rounded-xl bg-[#14633F] text-white font-semibold inline-flex items-center gap-2 hover:bg-[#0E4E31] disabled:opacity-60"
              >
                {guestSaving ? <Loader2 className="animate-spin" size={17} /> : <UserPlus size={17} />} Catat Hadir
              </button>
            </div>
            {!online && (
              <p className="text-xs text-[#8A5A00] mt-2">
                Pencatatan tamu memerlukan internet. Mohon coba lagi saat koneksi kembali.
              </p>
            )}
          </form>

          <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E7E3D8] font-semibold text-[#14201A] text-sm flex items-center gap-2">
              <Users size={16} className="text-[#0E4E31]" /> Daftar Tamu ({guests.length})
            </div>
            {guests.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#5F6B63]">Belum ada tamu yang dicatat.</div>
            ) : (
              <div className="divide-y divide-[#E7E3D8]">
                {guests.map((g) => (
                  <div key={g.id} data-testid={`absensi-tamu-row-${g.id}`} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[#14201A] text-sm">{g.name}</div>
                      <div className="text-xs text-[#5F6B63]">Hadir {g.arrival_time ? hhmm(g.arrival_time) : ""}</div>
                    </div>
                    <button
                      data-testid={`absensi-tamu-delete-${g.id}`}
                      onClick={() => removeGuest(g)}
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
      )}

      {tab === "report" && (
        <section className="mt-3 space-y-3" data-testid={ACTIVITIES.absensiReport}>
          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
            <h2 className="mb-3 inline-flex items-center gap-2 font-bold text-[#14201A]">
              <FileBarChart2 size={18} /> Rekap Kehadiran
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ["hadir", "Hadir"], ["izin", "Izin"], ["sakit", "Sakit"],
                ["alpha", "Alpha"], ["belum_diabsen", "Belum diabsen"],
              ].map(([status, label]) => (
                <div key={status} className="rounded-xl bg-[#F6F4EE] p-3" data-testid={`absensi-report-count-${status}`}>
                  <div className="text-xl font-bold text-[#14201A]">{c[status] || 0}</div>
                  <div className="text-xs text-[#5F6B63]">{label}</div>
                </div>
              ))}
              {guests.length > 0 && (
                <div className="rounded-xl bg-[#D9F2F4] p-3">
                  <div className="text-xl font-bold text-[#1D4F91]">{guests.length}</div>
                  <div className="text-xs text-[#6D3FC8]">Tamu hadir</div>
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[#5F6B63]">Persentase kehadiran</span>
              <span className="text-xl font-bold text-[#0E4E31]">{c.ratio || 0}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#E7E3D8]">
              <div className="h-full rounded-full bg-[#14633F] transition-all duration-700"
                style={{ width: `${Math.min(Math.max(Number(c.ratio) || 0, 0), 100)}%` }} />
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white">
            <h3 className="border-b border-[#E7E3D8] px-4 py-3 font-bold text-[#14201A]">Rincian peserta</h3>
            {reportRows.length === 0 ? (
              <div className="p-6 text-center text-sm text-[#5F6B63]">Belum ada data peserta.</div>
            ) : (
              <ul className="max-h-80 divide-y divide-[#E7E3D8] overflow-y-auto">
                {reportRows.map((row, index) => {
                  const status = REPORT_STATUS[row.reportStatus] || REPORT_STATUS.belum_diabsen;
                  return (
                    <li key={row.user_id || row.id || index} className="flex items-center gap-3 px-4 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#14201A]">{row.name}</span>
                        <span className="block text-xs text-[#5F6B63]">
                          {row.isGuest ? "Tamu" : row.gender === "L" ? "Laki-laki" : row.gender === "P" ? "Perempuan" : "Peserta"}
                          {row.arrival_time ? ` · ${hhmm(row.arrival_time)}` : ""}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${status.cls}`}>{status.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
            <h3 className="inline-flex items-center gap-2 font-bold text-[#14201A]"><Link2 size={17} /> Bagikan laporan</h3>
            <p className="mt-1 text-sm text-[#5F6B63]">Bagikan tautan rekap ini tanpa kode akses absensi.</p>
            {reportShare && (
              <div className="mt-3 break-all rounded-xl bg-[#F6F4EE] p-3 text-xs font-medium text-[#14201A]"
                data-testid={ACTIVITIES.absensiReportLink}>{reportShare.link}</div>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={shareReportWhatsApp} disabled={reportSharing}
                data-testid={ACTIVITIES.absensiReportShareWhatsApp}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14633F] px-3 font-semibold text-white hover:brightness-95 disabled:opacity-60">
                {reportSharing ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                Bagikan ke WhatsApp
              </button>
              <button type="button" onClick={copyReportLink} disabled={reportSharing}
                data-testid={ACTIVITIES.absensiReportCopyLink}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-[#14633F] px-3 font-semibold text-[#0E4E31] hover:bg-[#E3F3EA] disabled:opacity-60">
                <Link2 size={16} /> Salin tautan laporan
              </button>
            </div>
            <p className="mt-2 text-xs text-[#5F6B63]">Tautan laporan berlaku 7 hari.</p>
          </div>
        </section>
      )}

      <button
        data-testid="absensi-refresh"
        onClick={() => load(access)}
        className="mt-3 w-full h-11 rounded-xl border-2 border-[#E7E3D8] text-[#5F6B63] font-semibold flex items-center justify-center gap-2 hover:border-[#14633F] hover:text-[#0E4E31]"
      >
        <RefreshCw size={16} /> Muat Ulang Data
      </button>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#F6F4EE]">
      <header className="bg-white border-b border-[#E7E3D8]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-center">
          <Logo />
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-5 pb-16">{children}</main>
    </div>
  );
}

function Stat({ value, label, bg, fg }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ backgroundColor: bg }}>
      <div className="text-xl font-bold" style={{ color: fg }}>{value ?? 0}</div>
      <div className="text-xs text-[#5F6B63]">{label}</div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className={`min-w-[136px] shrink-0 sm:flex-1 h-11 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 border-2 transition-colors ${active ? "bg-[#14633F] text-white border-transparent" : "bg-white text-[#5F6B63] border-[#E7E3D8] hover:border-[#14633F] hover:text-[#0E4E31]"}`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}
