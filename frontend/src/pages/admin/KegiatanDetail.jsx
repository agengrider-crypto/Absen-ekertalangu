import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, CalendarDays, Clock, MapPin, User, BookOpen, Loader2, Search,
  ListChecks, ScanLine, KeyRound, MessageSquareText, UserPlus, PhoneCall,
  Copy, RefreshCw, Download, Send, Trash2, CheckCircle2, AlertTriangle,
  Users, PhoneOff, ClipboardList, Info,
} from "lucide-react";
import { toast } from "sonner";
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
 * barcode, daftar tamu, tindak lanjut jamaah yang tidak hadir, kode akses, dan
 * kotak pesan/saran.
 */

const STATUS_BTN = {
  hadir: { label: "Hadir", on: "bg-[#0D5C3A] text-white", off: "text-[#065F46]" },
  izin: { label: "Izin", on: "bg-[#D97706] text-white", off: "text-[#92400E]" },
  alpha: { label: "Alpha", on: "bg-[#DC2626] text-white", off: "text-[#991B1B]" },
};

const FOLLOWUP_META = {
  belum_dihubungi: { label: "Belum dihubungi", cls: "bg-[#F3F4F6] text-[#4B5563]" },
  sudah_dihubungi: { label: "Sudah dihubungi", cls: "bg-[#E0F2FE] text-[#075985]" },
  akan_hadir: { label: "Akan hadir", cls: "bg-[#E8F5EE] text-[#065F46]" },
  tidak_bisa: { label: "Tidak bisa hadir", cls: "bg-[#FEE2E2] text-[#991B1B]" },
};

export default function KegiatanDetail({ kegiatanId, onBack, onChanged }) {
  const [tab, setTab] = useState("ringkasan");
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
  const c = data?.counts || {};
  const publik = (k?.audience || "reguler") === "publik";

  const TABS = useMemo(() => ([
    { key: "ringkasan", label: "Ringkasan", icon: Info },
    { key: "manual", label: "Absen Manual", icon: ListChecks },
    { key: "scan", label: "Scan Barcode", icon: ScanLine },
    ...(publik ? [{ key: "tamu", label: "Tamu", icon: UserPlus }] : []),
    { key: "tindak", label: "Tidak Hadir Kemarin", icon: PhoneCall },
    { key: "kode", label: "Kode Akses", icon: KeyRound },
    { key: "pesan", label: "Pesan / Saran", icon: MessageSquareText },
  ]), [publik]);

  if (!data) {
    return (
      <div>
        <BackBar onBack={onBack} title="Detail Kegiatan" />
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={30} /></div>
        {err && <p className="text-center text-sm text-[#DC2626]">{err}</p>}
      </div>
    );
  }

  const phase = phaseOf(k);
  const pm = PHASE_META[phase];

  return (
    <div data-testid="kegiatan-detail-view">
      <BackBar onBack={onBack} title={k.name} />

      {/* Kartu info kegiatan */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>{TYPE_LABEL[k.type]}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pm.cls}`}>{pm.badge}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#3730A3]">{AUDIENCE_LABEL[k.audience] || "Reguler"}</span>
          {k.gender_filter && k.gender_filter !== "semua" && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FDF2F8] text-[#9D174D]">{GENDER_FILTER_LABEL[k.gender_filter]}</span>
          )}
        </div>
        <h2 className="font-heading text-xl font-bold text-[#111827] mt-2">{k.name}</h2>
        <div className="text-sm text-[#6B7280] mt-2 flex flex-wrap gap-x-5 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={15} /> {tanggalPanjang(k.date)}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={15} /> {k.start_time}–{k.end_time} WITA</span>
          {k.location && <span className="inline-flex items-center gap-1.5"><MapPin size={15} /> {k.location}</span>}
          {k.teacher && <span className="inline-flex items-center gap-1.5"><User size={15} /> {k.teacher}</span>}
          {k.material && <span className="inline-flex items-center gap-1.5"><BookOpen size={15} /> {k.material}</span>}
        </div>
      </div>

      {/* NAVIGASI BAR HORIZONTAL */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2 mt-3 bg-[#FAFBF9]/95 backdrop-blur border-b border-[#E5E7EB]">
        <div className="flex gap-2 overflow-x-auto no-scrollbar" data-testid="kegiatan-detail-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                data-testid={`keg-tab-${t.key}`}
                onClick={() => setTab(t.key)}
                className={`shrink-0 h-10 px-3.5 rounded-xl font-semibold text-sm inline-flex items-center gap-2 border-2 transition-colors ${
                  on ? "bg-[#0D5C3A] text-white border-transparent" : "bg-white text-[#4B5563] border-[#E5E7EB] hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
                }`}
              >
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {tab === "ringkasan" && <Ringkasan k={k} counts={c} guests={data.guests || []} gender={data.gender} />}
        {tab === "manual" && (
          <AbsenManual kegiatanId={kegiatanId} rows={data.rows || []} closed={k.status !== "open"}
            onReload={() => { load(true); if (onChanged) onChanged(); }} />
        )}
        {tab === "scan" && (
          <ScanTabPanel kegiatanId={kegiatanId} closed={k.status !== "open"}
            onReload={() => { load(true); if (onChanged) onChanged(); }} />
        )}
        {tab === "tamu" && (
          <TamuPanel kegiatanId={kegiatanId} guests={data.guests || []}
            onReload={() => { load(true); if (onChanged) onChanged(); }} />
        )}
        {tab === "tindak" && <TindakLanjut kegiatanId={kegiatanId} />}
        {tab === "kode" && <KodeAksesPanel kegiatanId={kegiatanId} />}
        {tab === "pesan" && <PesanPanel kegiatanId={kegiatanId} />}
      </div>
    </div>
  );
}

function BackBar({ onBack, title }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <button
        data-testid="kegiatan-detail-back"
        onClick={onBack}
        className="h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[#4B5563] font-semibold text-sm inline-flex items-center gap-2 hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
      >
        <ArrowLeft size={17} /> Kembali
      </button>
      <div className="font-bold text-[#0D5C3A] truncate">{title}</div>
    </div>
  );
}

function Stat({ value, label, bg, fg, testid }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ backgroundColor: bg }} data-testid={testid}>
      <div className="text-xl font-bold" style={{ color: fg }}>{value ?? 0}</div>
      <div className="text-xs text-[#6B7280]">{label}</div>
    </div>
  );
}

function Ringkasan({ k, counts, guests, gender }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat value={counts.total} label="Total" bg="#F2F5F2" fg="#111827" testid="stat-total" />
        <Stat value={counts.hadir} label="Hadir" bg="#E8F5EE" fg="#065F46" testid="stat-hadir" />
        <Stat value={counts.izin} label="Izin" bg="#FEF3C7" fg="#92400E" testid="stat-izin" />
        <Stat value={counts.alpha} label="Alpha" bg="#FEE2E2" fg="#991B1B" testid="stat-alpha" />
        <Stat value={`${counts.ratio ?? 0}%`} label="Kehadiran" bg="#EEF2FF" fg="#3730A3" testid="stat-ratio" />
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
        <div className="font-bold text-[#111827] text-[15px] flex items-center gap-2"><Users size={17} className="text-[#0D5C3A]" /> Ketentuan Peserta</div>
        <ul className="mt-2 text-sm text-[#4B5563] space-y-1.5 leading-relaxed">
          <li>
            <b>{AUDIENCE_LABEL[k.audience] || "Reguler"}</b> —{" "}
            {(k.audience || "reguler") === "publik"
              ? "terbuka untuk semua jamaah (sudah maupun belum aktivasi akun) dan petugas boleh menambahkan tamu cukup dengan nama."
              : "hanya jamaah yang akunnya sudah diaktivasi yang masuk daftar absen."}
          </li>
          <li><b>{GENDER_FILTER_LABEL[k.gender_filter || "semua"]}</b> — daftar peserta &amp; laporan mengikuti ketentuan ini.</li>
          {gender && (
            <li>
              Rincian hadir: laki-laki <b>{gender.L?.hadir ?? 0}</b> dari {gender.L?.total ?? 0} ·
              perempuan <b>{gender.P?.hadir ?? 0}</b> dari {gender.P?.total ?? 0}
            </li>
          )}
          {guests.length > 0 && <li>Tamu tercatat hadir: <b>{guests.length} orang</b></li>}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------- Absen manual (dengan mode offline) ------------------------- */
function AbsenManual({ kegiatanId, rows, closed, onReload }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);

  const sender = useCallback(async (items) => {
    await api.post(`/admin/kegiatan/${kegiatanId}/absen-batch`, { items });
  }, [kegiatanId]);

  const onSynced = useCallback((n) => {
    toast.success(`${n} absen offline berhasil dikirim ke server.`);
    onReload();
  }, [onReload]);

  const { pending, statusMap, online, syncing, add, flush } =
    useOfflineQueue(`keg_${kegiatanId}`, sender, onSynced);

  const mark = async (userId, status) => {
    if (!online) {
      add({ user_id: userId, status });
      toast.info("Tanpa internet — absen disimpan di HP dan dikirim otomatis nanti.");
      return;
    }
    setBusy(userId + status);
    try {
      const { data: res } = await api.post(`/admin/kegiatan/${kegiatanId}/absen`, { user_id: userId, status });
      if (res?.message) toast.success(res.message);
      onReload();
    } catch (e) {
      if (isOfflineError(e)) {
        add({ user_id: userId, status });
        toast.info("Koneksi terputus — absen disimpan di HP dan dikirim otomatis nanti.");
      } else {
        toast.error(formatApiErrorDetail(e.response?.data?.detail));
      }
    } finally { setBusy(null); }
  };

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t ? rows.filter((r) => (r.name || "").toLowerCase().includes(t)) : rows;
    return base.map((r) => ({ ...r, status: statusMap[r.user_id] || r.status, queued: Boolean(statusMap[r.user_id]) }));
  }, [rows, q, statusMap]);

  return (
    <div className="space-y-3">
      <OfflineBanner online={online} pending={pending} syncing={syncing} onSync={flush} />
      {closed && (
        <div className="rounded-2xl border-2 border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E] flex gap-2.5">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>Kegiatan sudah selesai. Absen susulan masih bisa dicatat oleh admin/pengurus.</span>
        </div>
      )}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden" data-testid="detail-absen-manual">
        <div className="p-3 bg-[#FAFBF9] border-b border-[#E5E7EB]">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              data-testid="detail-absen-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama peserta..."
              className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A] bg-white"
            />
          </div>
        </div>
        <div className="divide-y divide-[#F1F2F0] max-h-[60vh] overflow-y-auto">
          {list.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#6B7280]">Tidak ada peserta pada kegiatan ini.</div>
          ) : list.map((r) => (
            <div key={r.user_id} data-testid={`detail-absen-row-${r.user_id}`} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-semibold text-[#111827] text-sm truncate">{r.name}</div>
                <div className="text-xs text-[#9CA3AF] flex items-center gap-1.5 flex-wrap">
                  {r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : "—"}
                  {r.account_status === "pending" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#92400E]"><AlertTriangle size={11} /> Belum aktivasi</span>
                  )}
                  {r.status === "hadir" && r.arrival_time && (
                    <span className="font-mono text-[11px] text-[#4B5563]">{hhmm(r.arrival_time)}</span>
                  )}
                  {r.queued && <span className="text-[11px] font-semibold text-[#B45309]">menunggu dikirim</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {["hadir", "izin", "alpha"].map((s) => {
                  const on = r.status === s;
                  const cfg = STATUS_BTN[s];
                  return (
                    <button
                      key={s}
                      data-testid={`detail-btn-${s}-${r.user_id}`}
                      disabled={busy === r.user_id + s}
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
      <button
        data-testid="detail-absen-reload"
        onClick={onReload}
        className="w-full h-11 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] font-semibold inline-flex items-center justify-center gap-2 hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
      >
        <RefreshCw size={16} /> Muat Ulang Data
      </button>
    </div>
  );
}

/* ------------------------- Scan barcode peserta ------------------------- */
function ScanTabPanel({ kegiatanId, closed, onReload }) {
  const [last, setLast] = useState(null);
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
      setLast(data);
      if (data.already) toast.info(data.message); else toast.success(data.message);
      onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setTimeout(() => { lock.current = false; }, 1500);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4" data-testid="detail-scan-panel">
      <p className="text-sm text-[#4B5563] mb-3">
        <ScanLine size={16} className="text-[#0D5C3A] inline mr-1.5 -mt-0.5" />
        Arahkan kamera ke <b>QR pribadi peserta</b> (menu &quot;QR Saya&quot;) untuk mencatat kehadiran.
        Mode ini memerlukan internet.
      </p>
      {closed ? (
        <div className="rounded-xl bg-[#FEE2E2] border border-[#FECACA] p-4 text-sm text-[#991B1B]">
          Kegiatan sudah ditutup sehingga scan barcode dinonaktifkan.
        </div>
      ) : <QrScanner onDetected={onDetected} />}
      {last && (
        <div className="mt-3 bg-[#F0FAF4] border border-[#CDEBD9] rounded-xl p-3 flex items-center gap-2 text-sm text-[#065F46]" data-testid="detail-scan-result">
          <CheckCircle2 size={18} /> <b>{last.name}</b> — {last.already ? "sudah tercatat hadir" : "tercatat hadir"}
          {last.arrival_time ? ` (${hhmm(last.arrival_time)})` : ""}
        </div>
      )}
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
      <form onSubmit={add} className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
        <div className="font-bold text-[#111827] text-[15px] flex items-center gap-2"><UserPlus size={17} className="text-[#0D5C3A]" /> Tambah Tamu (tanpa akun)</div>
        <p className="text-sm text-[#6B7280] mt-1">
          Kegiatan terbuka/publik: jamaah yang belum aktivasi akun cukup dicatat namanya saja.
        </p>
        <div className="flex gap-2 mt-3 flex-wrap">
          <input
            data-testid="tamu-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama tamu"
            className="flex-1 min-w-[180px] h-11 px-3.5 rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A] bg-white"
          />
          <button
            data-testid="tamu-add-button"
            type="submit"
            disabled={saving}
            className="h-11 px-4 rounded-xl bg-[#0D5C3A] text-white font-semibold inline-flex items-center gap-2 hover:bg-[#094229] disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={17} /> : <UserPlus size={17} />} Catat Hadir
          </button>
        </div>
      </form>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E5E7EB] font-semibold text-[#111827] text-sm">
          Daftar Tamu ({guests.length})
        </div>
        {guests.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#9CA3AF]">Belum ada tamu yang dicatat.</div>
        ) : (
          <div className="divide-y divide-[#F1F2F0]">
            {guests.map((g) => (
              <div key={g.id} data-testid={`tamu-row-${g.id}`} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-[#111827] text-sm">{g.name}</div>
                  <div className="text-xs text-[#9CA3AF]">Hadir {g.arrival_time ? hhmm(g.arrival_time) : ""} · dicatat oleh {g.added_by || "petugas"}</div>
                </div>
                <button
                  data-testid={`tamu-delete-${g.id}`}
                  onClick={() => remove(g)}
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
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={28} /></div>;
  }

  if (!data.previous) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-[#E5E7EB] p-8 text-center text-sm text-[#6B7280]" data-testid="tindak-empty">
        Belum ada kegiatan sebelumnya untuk dijadikan rujukan rekap ketidakhadiran.
      </div>
    );
  }

  const c = data.counts || {};
  return (
    <div className="space-y-3" data-testid="detail-tindak-panel">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
        <div className="font-bold text-[#111827] text-[15px] flex items-center gap-2"><ClipboardList size={17} className="text-[#0D5C3A]" /> Rekap Tidak Hadir Kegiatan Sebelumnya</div>
        <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
          Daftar jamaah yang <b>tidak hadir</b> pada kegiatan <b>{data.previous.name}</b>{" "}
          ({tanggalSingkat(data.previous.date)}). Silakan hubungi lewat WhatsApp / telepon,
          lalu tandai apakah mereka <b>akan hadir</b> pada kegiatan ini.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
          <Stat value={c.total} label="Tidak hadir" bg="#FEE2E2" fg="#991B1B" testid="tindak-total" />
          <Stat value={c.akan_hadir} label="Akan hadir" bg="#E8F5EE" fg="#065F46" testid="tindak-akan" />
          <Stat value={c.tidak_bisa} label="Tidak bisa" bg="#FEF3C7" fg="#92400E" testid="tindak-tidak" />
          <Stat value={c.belum_dihubungi} label="Belum dihubungi" bg="#F2F5F2" fg="#111827" testid="tindak-belum" />
        </div>
      </div>

      {data.rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center text-sm text-[#065F46]">
          Alhamdulillah, semua jamaah hadir pada kegiatan sebelumnya.
        </div>
      ) : (
        <div className="space-y-2">
          {data.rows.map((r) => {
            const fu = r.followup || {};
            const meta = FOLLOWUP_META[fu.status] || FOLLOWUP_META.belum_dihubungi;
            const wa = waNumber(r.whatsapp || r.phone);
            const waText = encodeURIComponent(
              `Assalamu'alaikum warahmatullahi wabarakatuh${r.name ? ` ${r.name}` : ""}, ` +
              `kami dari pengurus pengajian. Mohon izin menanyakan, apakah bisa hadir pada kegiatan berikutnya? ` +
              "Jazakumullahu khoiro.");
            return (
              <div key={r.user_id} data-testid={`tindak-row-${r.user_id}`} className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#111827] text-sm">{r.name}</div>
                    <div className="text-xs text-[#9CA3AF]">
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
                      className="h-10 px-3.5 rounded-xl bg-[#25D366] text-white font-semibold text-sm inline-flex items-center gap-2 hover:brightness-95"
                    >
                      <Send size={15} /> WhatsApp
                    </a>
                  ) : (
                    <span className="h-10 px-3.5 rounded-xl bg-[#F3F4F6] text-[#9CA3AF] font-semibold text-sm inline-flex items-center gap-2">
                      <PhoneOff size={15} /> Nomor belum ada
                    </span>
                  )}
                  {r.phone && (
                    <a
                      data-testid={`tindak-call-${r.user_id}`}
                      href={`tel:${String(r.phone).replace(/\s+/g, "")}`}
                      className="h-10 px-3.5 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm inline-flex items-center gap-2 hover:bg-[#E8F5EE]"
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
                  className="mt-2 w-full h-11 px-3.5 rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A] bg-white text-sm"
                />

                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button
                    data-testid={`tindak-set-akan-${r.user_id}`}
                    disabled={busy === r.user_id + "akan_hadir"}
                    onClick={() => setStatus(r, "akan_hadir")}
                    className="h-10 rounded-xl bg-[#0D5C3A] text-white font-semibold text-xs sm:text-sm hover:bg-[#094229] disabled:opacity-60"
                  >
                    Akan Hadir
                  </button>
                  <button
                    data-testid={`tindak-set-tidak-${r.user_id}`}
                    disabled={busy === r.user_id + "tidak_bisa"}
                    onClick={() => setStatus(r, "tidak_bisa")}
                    className="h-10 rounded-xl border-2 border-[#DC2626] text-[#DC2626] font-semibold text-xs sm:text-sm hover:bg-[#FEF2F2] disabled:opacity-60"
                  >
                    Tidak Bisa
                  </button>
                  <button
                    data-testid={`tindak-set-hubungi-${r.user_id}`}
                    disabled={busy === r.user_id + "sudah_dihubungi"}
                    onClick={() => setStatus(r, "sudah_dihubungi")}
                    className="h-10 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] font-semibold text-xs sm:text-sm hover:border-[#0D5C3A] hover:text-[#0D5C3A] disabled:opacity-60"
                  >
                    Sudah Dihubungi
                  </button>
                </div>
                {fu.by && fu.at && (
                  <p className="text-xs text-[#9CA3AF] mt-2">Ditandai oleh {fu.by} · {hhmm(fu.at)}</p>
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

  if (!info) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={28} /></div>;

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
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 text-center" data-testid="detail-kode-panel">
      <img src={info.image} alt="QR Absensi Kegiatan" className="mx-auto w-48 h-48 rounded-xl border border-[#E5E7EB] p-2" data-testid="detail-akses-qr" />
      <div className="mt-4 rounded-2xl border-2 border-dashed border-[#0D5C3A] bg-[#F0FAF4] p-4">
        <div className="text-xs font-semibold text-[#065F46] flex items-center justify-center gap-1.5"><KeyRound size={14} /> KODE AKSES ABSENSI</div>
        <div className="mt-1 text-3xl font-bold tracking-[0.35em] text-[#0D5C3A]" data-testid="detail-akses-code">{info.code}</div>
        <div className="text-xs text-[#4B5563] mt-1">Berlaku sampai kegiatan ditutup/selesai</div>
      </div>
      <p className="text-xs text-[#9CA3AF] mt-3 break-all px-2">{info.link}</p>
      <div className="grid sm:grid-cols-2 gap-2 mt-3">
        <button onClick={() => { navigator.clipboard.writeText(info.code); toast.success("Kode akses disalin"); }}
          data-testid="detail-copy-code"
          className="h-11 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#E8F5EE]">
          <Copy size={16} /> Salin Kode
        </button>
        <button onClick={() => { navigator.clipboard.writeText(info.link); toast.success("Tautan absensi disalin"); }}
          data-testid="detail-copy-link"
          className="h-11 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] font-semibold inline-flex items-center justify-center gap-2 hover:border-[#0D5C3A] hover:text-[#0D5C3A]">
          <Copy size={16} /> Salin Tautan
        </button>
        <button onClick={download} data-testid="detail-download-qr"
          className="h-11 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] font-semibold inline-flex items-center justify-center gap-2 hover:border-[#0D5C3A] hover:text-[#0D5C3A]">
          <Download size={16} /> Unduh QR
        </button>
        <button onClick={regenerate} disabled={busy} data-testid="detail-regenerate-code"
          className="h-11 rounded-xl bg-[#0D5C3A] text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60">
          {busy ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />} Perbarui Kode
        </button>
      </div>
      <button
        onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(info.wa_text || info.link)}`, "_blank")}
        data-testid="detail-share-wa"
        className="mt-2 w-full h-11 rounded-xl bg-[#25D366] text-white font-semibold inline-flex items-center justify-center gap-2 hover:brightness-95"
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

  if (items === null) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={28} /></div>;

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden" data-testid="detail-pesan-panel">
      <div className="px-4 py-3 border-b border-[#E5E7EB] font-semibold text-[#111827] text-sm">
        Kotak Pesan / Saran ({items.length})
      </div>
      {items.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#9CA3AF]">Belum ada pesan / saran dari peserta.</div>
      ) : (
        <div className="divide-y divide-[#F1F2F0] max-h-[60vh] overflow-y-auto">
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
    </div>
  );
}
