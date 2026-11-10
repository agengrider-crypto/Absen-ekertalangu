import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShieldCheck, Loader2, CalendarDays, Clock, ScanLine, ListChecks,
  ArrowLeft, Search, CheckCircle2, AlertTriangle, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import QrScanner from "@/components/QrScanner";
import { TYPE_LABEL, TYPE_COLOR, tanggalSingkat, hhmm } from "@/pages/admin/kegiatanUtils";

const STATUS_BTN = {
  hadir: { label: "Hadir", on: "bg-[#14633F] text-white", off: "text-[#0E4E31]" },
  izin: { label: "Izin", on: "bg-[#8A5A00] text-white", off: "text-[#6B4500]" },
  sakit: { label: "Sakit", on: "bg-[#1D4F91] text-white", off: "text-[#1D4F91]" },
  alpha: { label: "Alpha", on: "bg-[#A32A2A] text-white", off: "text-[#A32A2A]" },
};

/**
 * Area "Penjaga Absen" untuk peserta yang menerima delegasi dari pengurus.
 * Menyediakan DUA cara mengabsen:
 *   1. Absen Manual   — daftar nama peserta (termasuk yang belum aktivasi)
 *   2. Scan QR   — scan QR pribadi peserta
 */
export default function PenjagaAbsen() {
  const [delegs, setDelegs] = useState(null);
  const [active, setActive] = useState(null); // delegasi terpilih

  const load = useCallback(() => {
    setDelegs(null);
    api.get("/me/delegations")
      .then(({ data }) => setDelegs(data || []))
      .catch((e) => { setDelegs([]); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, []);

  useEffect(() => { load(); }, [load]);

  if (active) {
    return <PenjagaKegiatan deleg={active} onBack={() => { setActive(null); load(); }} />;
  }

  return (
    <div className="space-y-4" data-testid="penjaga-absen-tab">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#14201A] flex items-center gap-2">
          <ShieldCheck size={22} className="text-[#14633F]" /> Penjaga Absen
        </h1>
        <p className="text-sm text-[#5F6B63] mt-1">
          Anda dipercaya mengisi absen kegiatan berikut. Tersedia <b>absen manual</b> dan <b>scan QR</b>.
        </p>
      </div>

      {delegs === null ? (
        <div className="p-14 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>
      ) : delegs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-8 text-center" data-testid="penjaga-empty">
          <div className="h-14 w-14 rounded-2xl bg-[#F0EEE6] text-[#5F6B63] flex items-center justify-center mx-auto">
            <ShieldCheck size={26} />
          </div>
          <p className="text-sm text-[#5F6B63] mt-3 leading-relaxed">
            Saat ini Anda belum diberi hak penjaga absen.<br />
            Hak ini diberikan pengurus saat beliau tidak berada di lokasi kegiatan.
          </p>
          <button onClick={load} className="mt-4 inline-flex items-center gap-2 h-10 px-4 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold text-sm hover:bg-[#E3F3EA]">
            <RefreshCw size={16} /> Muat Ulang
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {delegs.map((d) => {
            const k = d.kegiatan || {};
            return (
              <div key={d.id} className="bg-white rounded-2xl border border-[#E7E3D8] p-4" data-testid={`penjaga-deleg-${d.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>
                    {TYPE_LABEL[k.type] || k.type}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E3F3EA] text-[#0E4E31]">Berlangsung</span>
                </div>
                <h3 className="font-heading font-bold text-[#14201A] mt-1.5">{k.name}</h3>
                <div className="text-sm text-[#5F6B63] mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {tanggalSingkat(k.date)}</span>
                  <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {k.start_time}–{k.end_time} WITA</span>
                </div>
                {d.reason && <p className="text-xs text-[#5F6B63] mt-1.5">Catatan: {d.reason}</p>}
                <p className="text-xs text-[#5F6B63] mt-0.5">Diberikan oleh {d.granted_by}</p>
                <button
                  data-testid={`penjaga-open-${d.id}`}
                  onClick={() => setActive(d)}
                  className="mt-3 w-full h-11 rounded-xl bg-[#14633F] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#0E4E31]"
                >
                  <ListChecks size={17} /> Mulai Mengabsen
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PenjagaKegiatan({ deleg, onBack }) {
  const kegiatanId = deleg.kegiatan_id || deleg.kegiatan?.id;
  const [mode, setMode] = useState("manual"); // manual | scan
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [lastScan, setLastScan] = useState(null);

  const load = useCallback(() => {
    api.get(`/delegate/kegiatan/${kegiatanId}`)
      .then(({ data: d }) => setData(d))
      .catch((e) => { setData(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  const mark = async (userId, status) => {
    setBusy(userId + status);
    try {
      await api.post(`/delegate/kegiatan/${kegiatanId}/absen`, { user_id: userId, status });
      toast.success(`Absen tersimpan: ${status === "hadir" ? "Hadir" : status === "izin" ? "Izin" : "Alpha"}`);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(null); }
  };

  const onDetected = async (text) => {
    if (scanBusy) return;
    if (!text || !text.startsWith("EKP:")) {
      toast.error("Mohon maaf, QR ini bukan QR pribadi peserta. Mohon peserta membuka menu “QR Saya”.");
      return;
    }
    setScanBusy(true);
    try {
      const { data: res } = await api.post(`/delegate/kegiatan/${kegiatanId}/scan-personal`, { content: text });
      setLastScan(res);
      if (res.already) toast.info(res.message);
      else toast.success(res.message);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
    setTimeout(() => setScanBusy(false), 1200);
  };

  const rows = useMemo(() => {
    if (!data || !data.peserta) return [];
    const t = q.trim().toLowerCase();
    return t ? data.peserta.filter((p) => (p.name || "").toLowerCase().includes(t)) : data.peserta;
  }, [data, q]);
  const activity = data?.kegiatan;
  const alphaAllowed = Boolean(activity && (
    activity.status !== "open"
    || Date.now() >= Date.parse(`${activity.date}T${activity.end_time}:00+08:00`)
  ));

  const counts = useMemo(() => {
    const c = { total: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0, belum_diabsen: 0 };
    (data?.peserta || []).forEach((p) => {
      c.total += 1;
      c[p.status || "belum_diabsen"] += 1;
    });
    return c;
  }, [data]);

  const k = data?.kegiatan;

  return (
    <div className="space-y-4" data-testid="penjaga-kegiatan-view">
      <button
        data-testid="penjaga-back"
        onClick={onBack}
        className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border border-[#E7E3D8] bg-white text-[#5F6B63] font-semibold text-sm hover:border-[#14633F] hover:text-[#0E4E31]"
      >
        <ArrowLeft size={17} /> Kembali
      </button>

      <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4">
        <h2 className="font-heading font-bold text-[#14201A]">{k?.name || deleg.kegiatan_name}</h2>
        {k && (
          <div className="text-sm text-[#5F6B63] mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {tanggalSingkat(k.date)}</span>
            <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {k.start_time}–{k.end_time} WITA</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#F0EEE6] p-2.5 text-center"><div className="text-lg font-bold text-[#14201A]">{counts.total}</div><div className="text-[11px] text-[#5F6B63]">Total</div></div>
          <div className="rounded-xl bg-[#E3F3EA] p-2.5 text-center"><div className="text-lg font-bold text-[#0E4E31]">{counts.hadir}</div><div className="text-[11px] text-[#5F6B63]">Hadir</div></div>
          <div className="rounded-xl bg-[#FBF1D6] p-2.5 text-center"><div className="text-lg font-bold text-[#6B4500]">{counts.izin}</div><div className="text-[11px] text-[#5F6B63]">Izin</div></div>
          <div className="rounded-xl bg-[#E3EEFB] p-2.5 text-center"><div className="text-lg font-bold text-[#1D4F91]">{counts.sakit}</div><div className="text-[11px] text-[#5F6B63]">Sakit</div></div>
          <div className="rounded-xl bg-[#FBE5E3] p-2.5 text-center"><div className="text-lg font-bold text-[#A32A2A]">{counts.alpha}</div><div className="text-[11px] text-[#5F6B63]">Alpha</div></div>
          <div className="rounded-xl bg-[#F0EEE6] p-2.5 text-center"><div className="text-lg font-bold text-[#5F6B63]">{counts.belum_diabsen}</div><div className="text-[11px] text-[#5F6B63]">Belum diabsen</div></div>
        </div>
      </div>

      {/* Pilihan cara absen */}
      <div className="grid grid-cols-2 gap-2 bg-white p-1.5 rounded-2xl border border-[#E7E3D8]">
        <button
          data-testid="penjaga-mode-manual"
          onClick={() => setMode("manual")}
          className={`h-12 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors ${
            mode === "manual" ? "bg-[#14633F] text-white" : "text-[#5F6B63] hover:bg-[#F0EEE6]"
          }`}
        >
          <ListChecks size={17} /> Absen Manual
        </button>
        <button
          data-testid="penjaga-mode-scan"
          onClick={() => setMode("scan")}
          className={`h-12 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors ${
            mode === "scan" ? "bg-[#14633F] text-white" : "text-[#5F6B63] hover:bg-[#F0EEE6]"
          }`}
        >
          <ScanLine size={17} /> Scan QR
        </button>
      </div>

      {data === null ? (
        <div className="p-14 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>
      ) : data === false ? (
        <div className="bg-white rounded-2xl border border-[#FBE5E3] p-6 text-center text-sm text-[#A32A2A]">
          Mohon maaf, hak penjaga absen untuk kegiatan ini sudah tidak aktif.
        </div>
      ) : mode === "scan" ? (
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4 space-y-3" data-testid="penjaga-scan-panel">
          <p className="text-sm text-[#5F6B63] flex items-start gap-2">
            <ScanLine size={16} className="text-[#14633F] shrink-0 mt-0.5" />
            Arahkan kamera ke <b>QR pribadi peserta</b> (menu “QR Saya” pada akun peserta) untuk menandai hadir.
          </p>
          <QrScanner onDetected={onDetected} paused={scanBusy} />
          {lastScan && (
            <div className="bg-[#E3F3EA] border border-[#E7E3D8] rounded-xl p-3 text-center" data-testid="penjaga-scan-result">
              <CheckCircle2 className="mx-auto text-[#14633F]" size={26} />
              <div className="font-bold text-[#0E4E31] mt-1">{lastScan.name}</div>
              <div className="text-xs text-[#5F6B63] mt-0.5">{lastScan.message}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden" data-testid="penjaga-manual-panel">
          <div className="p-3 bg-[#F6F4EE] border-b border-[#E7E3D8]">
            <div className="relative">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
              <input
                data-testid="penjaga-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama peserta..."
                className="w-full h-11 pl-11 pr-4 rounded-xl border border-[#8A948D] bg-white text-sm outline-none focus:border-[#14633F]"
              />
            </div>
          </div>
          <ul className="divide-y divide-[#E7E3D8] max-h-[58vh] overflow-y-auto">
            {rows.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-[#5F6B63]">Tidak ada peserta yang cocok.</li>
            ) : rows.map((p) => (
              <li key={p.id} data-testid={`penjaga-row-${p.id}`} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#14201A] text-sm truncate">{p.name}</div>
                    <div className="text-xs text-[#5F6B63] flex items-center gap-1.5 mt-0.5">
                      {p.status === "hadir" && p.arrival_time ? `Datang ${hhmm(p.arrival_time)} WITA` : (p.kelompok_name || "—")}
                      {p.account_status === "pending" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B4500]">
                          <AlertTriangle size={11} /> Belum aktivasi
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {["hadir", "izin", "sakit", "alpha"].map((s) => {
                      const on = p.status === s;
                      const cfg = STATUS_BTN[s];
                      return (
                        <button
                          key={s}
                          data-testid={`penjaga-btn-${s}-${p.id}`}
                          disabled={busy === p.id + s || (s === "alpha" && !alphaAllowed)}
                          onClick={() => mark(p.id, s)}
                          title={s === "alpha" && !alphaAllowed ? "Alpha tersedia setelah kegiatan berakhir" : cfg.label}
                          className={`h-9 px-2.5 rounded-lg text-xs font-bold border-2 transition-colors disabled:opacity-50 ${
                            on ? `${cfg.on} border-transparent` : `bg-white ${cfg.off} border-[#E7E3D8] hover:border-current`
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
      )}
    </div>
  );
}
