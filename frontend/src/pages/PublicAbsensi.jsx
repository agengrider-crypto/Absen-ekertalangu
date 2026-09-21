import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CalendarDays, Clock, MapPin, User, BookOpen, Loader2, KeyRound, ShieldAlert,
  Search, ScanLine, ListChecks, AlertTriangle, CheckCircle2, RefreshCw,
  UserPlus, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail, isOfflineError } from "@/lib/api";
import { useOfflineQueue } from "@/lib/offline";
import OfflineBanner from "@/components/OfflineBanner";
import QrScanner from "@/components/QrScanner";
import { Logo } from "@/components/Logo";
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
  hadir: { label: "Hadir", on: "bg-[#0D5C3A] text-white", off: "text-[#0D5C3A]" },
  izin: { label: "Izin", on: "bg-[#D97706] text-white", off: "text-[#D97706]" },
  alpha: { label: "Alpha", on: "bg-[#DC2626] text-white", off: "text-[#DC2626]" },
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
        <div className="bg-white rounded-2xl border border-[#FECACA] p-6 text-center" data-testid="absensi-fatal">
          <ShieldAlert className="mx-auto text-[#DC2626]" size={34} />
          <p className="mt-3 text-[#991B1B] font-semibold">{fatal}</p>
        </div>
      </Shell>
    );
  }

  /* ------------------------- Gerbang kode akses ------------------------- */
  if (!access || !data) {
    return (
      <Shell>
        <form onSubmit={verify} className="bg-white rounded-2xl border border-[#E5E7EB] p-6" data-testid="absensi-gate">
          <div className="h-12 w-12 rounded-2xl bg-[#E8F5EE] text-[#0D5C3A] flex items-center justify-center mx-auto">
            <KeyRound size={24} />
          </div>
          <h1 className="font-heading text-xl font-bold text-[#111827] text-center mt-3">Kode Akses Absensi</h1>
          <p className="text-sm text-[#6B7280] text-center mt-1">
            Masukkan <b>6 digit kode akses</b> yang diberikan pengurus untuk membuka daftar peserta.
          </p>
          <input
            data-testid="absensi-code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="------"
            className="mt-5 w-full h-14 text-center tracking-[0.6em] text-2xl font-bold rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A]"
          />
          {err && (
            <p className="mt-2 text-sm text-[#DC2626] text-center" data-testid="absensi-code-error">{err}</p>
          )}
          <button
            type="submit"
            data-testid="absensi-code-submit"
            disabled={verifying}
            className="mt-4 w-full h-12 rounded-xl bg-[#0D5C3A] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60"
          >
            {verifying ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />} Buka Daftar Peserta
          </button>
          <p className="mt-3 text-xs text-[#9CA3AF] text-center">
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
  const publik = (k.audience || "reguler") === "publik";
  const guests = data.guests || [];

  return (
    <Shell>
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5" data-testid="absensi-header">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#065F46]">
            {TYPE_LABEL[k.type] || "Kegiatan"}
          </span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${closed ? "bg-[#FEE2E2] text-[#991B1B]" : "bg-[#DCFCE7] text-[#065F46]"}`}>
            {closed ? "Selesai" : "Berlangsung"}
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#3730A3]">
            {AUDIENCE_LABEL[k.audience] || "Reguler"}
          </span>
          {(k.filter_labels && k.filter_labels.length
            ? k.filter_labels
            : (k.gender_filter && k.gender_filter !== "semua" ? [GENDER_FILTER_LABEL[k.gender_filter]] : [])
          ).map((l) => (
            <span key={l} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FDF2F8] text-[#9D174D]">
              {l}
            </span>
          ))}
        </div>
        <h1 className="font-heading text-xl font-bold text-[#111827] mt-2">{k.name}</h1>
        <div className="text-sm text-[#6B7280] mt-2 grid gap-1">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {tanggalPanjang(k.date)}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {k.start_time}–{k.end_time} WITA</span>
          {k.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {k.location}</span>}
          {k.teacher && <span className="inline-flex items-center gap-1.5"><User size={14} /> {k.teacher}</span>}
          {k.material && <span className="inline-flex items-center gap-1.5"><BookOpen size={14} /> {k.material}</span>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mt-3" data-testid="absensi-counts">
        <Stat value={c.total} label="Total" bg="#F2F5F2" fg="#111827" />
        <Stat value={c.hadir} label="Hadir" bg="#E8F5EE" fg="#065F46" />
        <Stat value={c.izin} label="Izin" bg="#FEF3C7" fg="#92400E" />
        <Stat value={c.alpha} label="Alpha" bg="#FEE2E2" fg="#991B1B" />
      </div>

      {closed && (
        <div className="mt-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-2xl p-4 text-sm text-[#92400E] flex gap-2.5">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>Kegiatan sudah selesai/ditutup sehingga absensi lewat kode akses dinonaktifkan.</span>
        </div>
      )}

      <OfflineBanner online={online} pending={pending} syncing={syncing} onSync={flush} className="mt-3" />

      <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
        <TabBtn active={tab === "manual"} onClick={() => setTab("manual")} icon={ListChecks} label="Absen Manual" testid="absensi-tab-manual" />
        <TabBtn active={tab === "scan"} onClick={() => setTab("scan")} icon={ScanLine} label="Scan Barcode" testid="absensi-tab-scan" />
        {publik && (
          <TabBtn active={tab === "tamu"} onClick={() => setTab("tamu")} icon={UserPlus} label={`Tamu (${guests.length})`} testid="absensi-tab-tamu" />
        )}
      </div>

      {tab === "manual" && (
        <div className="mt-3 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden" data-testid="absensi-manual">
          <div className="p-3 bg-[#FAFBF9] border-b border-[#E5E7EB]">
            <div className="relative">
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                data-testid="absensi-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama peserta..."
                className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A] bg-white"
              />
            </div>
          </div>
          <div className="divide-y divide-[#F1F2F0]">
            {rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#6B7280]">Tidak ada peserta.</div>
            ) : rows.map((r) => (
              <div key={r.user_id} data-testid={`absensi-row-${r.user_id}`} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold text-[#111827] text-sm truncate">{r.name}</div>
                  <div className="text-xs text-[#9CA3AF] flex items-center gap-1.5 flex-wrap">
                    {r.kelompok_name || "Tanpa kelompok"}
                    {r.account_status === "pending" && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#92400E]">
                        <AlertTriangle size={11} /> Belum aktivasi
                      </span>
                    )}
                    {r.status === "hadir" && r.arrival_time && (
                      <span className="font-mono text-[11px] text-[#4B5563]">{hhmm(r.arrival_time)}</span>
                    )}
                    {r.attended_other && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[#E8F5EE] text-[#065F46]">
                        Sudah hadir sesi {r.attended_other_label}
                      </span>
                    )}
                    {r.queued && (
                      <span className="text-[11px] font-semibold text-[#B45309]">menunggu dikirim</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {r.attended_other ? (
                    <span className="text-[11px] font-semibold text-[#9CA3AF]" data-testid={`absensi-locked-${r.user_id}`}>tidak perlu diabsen lagi</span>
                  ) : ["hadir", "izin", "alpha"].map((s) => {
                    const on = r.status === s;
                    const cfg = STATUS_BTN[s];
                    return (
                      <button
                        key={s}
                        data-testid={`absensi-btn-${s}-${r.user_id}`}
                        disabled={closed || busy === r.user_id + s}
                        onClick={() => mark(r.user_id, s)}
                        className={`h-8 px-2.5 rounded-lg text-xs font-bold border-2 transition-colors disabled:opacity-50 ${on ? `${cfg.on} border-transparent` : `bg-white ${cfg.off} border-[#E5E7EB] hover:border-current`}`}
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
        <div className="mt-3 bg-white rounded-2xl border border-[#E5E7EB] p-4" data-testid="absensi-scan">
          <p className="text-sm text-[#4B5563] mb-3">
            <ScanLine size={16} className="text-[#0D5C3A] inline mr-1.5 -mt-0.5" />
            Arahkan kamera ke <b>QR pribadi peserta</b> (menu {"\"QR Saya\""} pada akun peserta) untuk mencatat kehadiran.
          </p>
          {!closed && <QrScanner onDetected={onScan} />}
          {!online && (
            <p className="text-xs text-[#B45309] mt-2">
              Mode scan barcode memerlukan internet. Saat offline, silakan gunakan Absen Manual.
            </p>
          )}
          {lastScan && (
            <div className="mt-3 bg-[#F0FAF4] border border-[#CDEBD9] rounded-xl p-3 flex items-center gap-2 text-sm text-[#065F46]" data-testid="absensi-scan-result">
              <CheckCircle2 size={18} /> <b>{lastScan.name}</b> — {lastScan.already ? "sudah tercatat hadir" : "tercatat hadir"}
              {lastScan.arrival_time ? ` (${hhmm(lastScan.arrival_time)})` : ""}
            </div>
          )}
        </div>
      )}

      {tab === "tamu" && publik && (
        <div className="mt-3 space-y-3" data-testid="absensi-tamu">
          <form onSubmit={addGuest} className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <div className="font-bold text-[#111827] text-[15px] flex items-center gap-2">
              <UserPlus size={17} className="text-[#0D5C3A]" /> Tambah Tamu (tanpa akun)
            </div>
            <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
              Kegiatan ini <b>terbuka/publik</b>. Jamaah yang belum mengaktivasi akun cukup
              dicatat namanya saja, dan langsung terhitung hadir.
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <input
                data-testid="absensi-tamu-input"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Nama tamu"
                className="flex-1 min-w-[160px] h-11 px-3.5 rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A] bg-white"
              />
              <button
                data-testid="absensi-tamu-add"
                type="submit"
                disabled={guestSaving || closed || !online}
                className="h-11 px-4 rounded-xl bg-[#0D5C3A] text-white font-semibold inline-flex items-center gap-2 hover:bg-[#094229] disabled:opacity-60"
              >
                {guestSaving ? <Loader2 className="animate-spin" size={17} /> : <UserPlus size={17} />} Catat Hadir
              </button>
            </div>
            {!online && (
              <p className="text-xs text-[#B45309] mt-2">
                Pencatatan tamu memerlukan internet. Mohon coba lagi saat koneksi kembali.
              </p>
            )}
          </form>

          <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E7EB] font-semibold text-[#111827] text-sm flex items-center gap-2">
              <Users size={16} className="text-[#0D5C3A]" /> Daftar Tamu ({guests.length})
            </div>
            {guests.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#9CA3AF]">Belum ada tamu yang dicatat.</div>
            ) : (
              <div className="divide-y divide-[#F1F2F0]">
                {guests.map((g) => (
                  <div key={g.id} data-testid={`absensi-tamu-row-${g.id}`} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-[#111827] text-sm">{g.name}</div>
                      <div className="text-xs text-[#9CA3AF]">Hadir {g.arrival_time ? hhmm(g.arrival_time) : ""}</div>
                    </div>
                    <button
                      data-testid={`absensi-tamu-delete-${g.id}`}
                      onClick={() => removeGuest(g)}
                      className="h-9 w-9 rounded-lg border border-[#FECACA] text-[#DC2626] flex items-center justify-center hover:bg-[#FEF2F2]"
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

      <button
        data-testid="absensi-refresh"
        onClick={() => load(access)}
        className="mt-3 w-full h-11 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] font-semibold flex items-center justify-center gap-2 hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
      >
        <RefreshCw size={16} /> Muat Ulang Data
      </button>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#FAFBF9]">
      <header className="bg-white border-b border-[#E5E7EB]">
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
      <div className="text-xs text-[#6B7280]">{label}</div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label, testid }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className={`flex-1 h-11 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 border-2 transition-colors ${active ? "bg-[#0D5C3A] text-white border-transparent" : "bg-white text-[#4B5563] border-[#E5E7EB] hover:border-[#0D5C3A] hover:text-[#0D5C3A]"}`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}
