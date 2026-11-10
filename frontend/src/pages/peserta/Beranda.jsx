import { useEffect, useState } from "react";
import { Loader2, Pin, AlertCircle, CalendarDays, Clock, MapPin, ShieldCheck, X, Search, QrCode, ScanLine, ChevronRight, UserCog } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { api, formatApiErrorDetail } from "@/lib/api";
import { TYPE_LABEL, TYPE_COLOR, tanggalPanjang } from "@/pages/admin/kegiatanUtils";
import TutorialQr from "./TutorialQr";
import KesanPesan from "./KesanPesan";
import { roleLabel, profileCompletion } from "@/lib/roles";
import { keteranganHitungan } from "@/pages/admin/rekapUtils";

function Ring({ value }) {
  const r = 46, c = 2 * Math.PI * r;
  const off = c - (Math.min(value, 100) / 100) * c;
  return (
    <div className="relative h-32 w-32" data-testid="attendance-ring">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#E7E3D8" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#14201A" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[#0E4E31]">{value}%</span>
        <span className="text-[11px] text-[#5F6B63]">kehadiran</span>
      </div>
    </div>
  );
}

/* Modal isi absensi delegasi */
function DelegasiFill({ deleg, onClose }) {
  const kid = deleg.kegiatan_id;
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);

  const load = async () => {
    try { const { data } = await api.get(`/delegate/kegiatan/${kid}`); setData(data); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); onClose(); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [kid]);

  const mark = async (uid, status) => {
    setBusy(uid + status);
    try {
      await api.post(`/delegate/kegiatan/${kid}/absen`, { user_id: uid, status });
      setData((prev) => ({ ...prev, peserta: prev.peserta.map((p) => p.id === uid ? { ...p, status } : p) }));
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setBusy(null);
  };

  const rows = (data?.peserta || []).filter((p) => p.name?.toLowerCase().includes(q.toLowerCase()));
  const activity = data?.kegiatan;
  const alphaAllowed = Boolean(activity && (
    activity.status !== "open"
    || Date.now() >= Date.parse(`${activity.date}T${activity.end_time}:00+08:00`)
  ));
  const btn = (uid, st, label, cls) => (
    <button data-testid={`deleg-mark-${st}-${uid}`} onClick={() => mark(uid, st)}
      disabled={busy === uid + st || (st === "alpha" && !alphaAllowed)}
      title={st === "alpha" && !alphaAllowed ? "Alpha tersedia setelah kegiatan berakhir" : label}
      className={`h-8 px-2.5 rounded-lg text-xs font-semibold border ${cls}`}>{label}</button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-[rgba(20,32,26,0.5)]" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto" data-testid="modal-delegasi-fill">
        <div className="sticky top-0 bg-white border-b border-[#E7E3D8] px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-[#14201A]">Isi Absensi (Delegasi)</h3>
            <p className="text-xs text-[#5F6B63]">{deleg.kegiatan_name}</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6]"><X size={20} /></button>
        </div>
        <div className="p-4">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…" className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F]" />
          </div>
          {data === null ? (
            <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={26} /></div>
          ) : (
            <div className="space-y-1.5">
              {rows.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 py-2 border-b border-[#F0EEE6]">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#14201A] truncate">{p.name}</div>
                    <div className="text-xs text-[#5F6B63]">{p.status}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {btn(p.id, "hadir", "H", p.status === "hadir" ? "bg-[#14633F] text-white border-[#14633F]" : "bg-white text-[#14633F] border-[#14633F]")}
                    {btn(p.id, "izin", "I", p.status === "izin" ? "bg-[#8A5A00] text-white border-[#8A5A00]" : "bg-white text-[#6B4500] border-[#8A5A00]")}
                    {btn(p.id, "sakit", "S", p.status === "sakit" ? "bg-[#1D4F91] text-white border-[#1D4F91]" : "bg-white text-[#1D4F91] border-[#1D4F91]")}
                    {btn(p.id, "alpha", "A", p.status === "alpha" ? "bg-[#A32A2A] text-white border-[#A32A2A]" : "bg-white text-[#A32A2A] border-[#A32A2A]")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Beranda({ user, onGoto }) {
  const [data, setData] = useState(null);
  const [delegs, setDelegs] = useState([]);
  const [fill, setFill] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.get("/me/dashboard").then(({ data }) => setData(data)).catch(() => setData(false));
    api.get("/me/delegations").then(({ data }) => setDelegs(data || [])).catch(() => {});
    api.get("/me/attendance-history?months=6").then(({ data }) => setHistory(data)).catch(() => {});
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 19) return "Selamat sore";
    return "Selamat malam";
  })();

  if (data === null) return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={30} /></div>;

  const completion = profileCompletion(user);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5F6B63]" data-testid="peserta-role-label">
          {roleLabel("peserta")}
        </div>
        <h1 className="font-heading text-[26px] font-bold text-[#0E4E31] mt-1 leading-tight" data-testid="peserta-greeting">
          Selamat datang, {user?.name} <span className="inline-block">👋</span>
        </h1>
        <p className="text-[#5F6B63] text-sm mt-1">{greeting}, semoga hari Anda berkah.</p>
      </div>

      {/* Kelengkapan profil dengan persentase → arahkan ke akun pribadi */}
      {completion.percent < 100 && (
        <button
          type="button"
          data-testid="peserta-kelengkapan-banner"
          onClick={() => onGoto("profil")}
          className="w-full text-left rounded-2xl border border-[#E7E3D8] bg-white p-4 hover:border-[#14633F] transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-[#E3F3EA] text-[#14633F] flex items-center justify-center shrink-0"><UserCog size={19} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[#0E4E31]">Lengkapi Profil Kamu</span>
              <span className="block text-xs text-[#5F6B63] mt-0.5">
                {completion.filled} dari {completion.total} data terisi
                {completion.missing.length ? ` · belum: ${completion.missing.slice(0, 3).join(", ")}${completion.missing.length > 3 ? ", …" : ""}` : ""}
              </span>
            </span>
            <span className="shrink-0 text-lg font-bold text-[#0E4E31] tabular-nums" data-testid="peserta-kelengkapan-persen">{completion.percent}%</span>
            <ChevronRight size={18} className="text-[#5F6B63] shrink-0" />
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-[#F0EEE6] overflow-hidden">
            <div className="h-full rounded-full bg-[#14633F] transition-all duration-500" style={{ width: `${completion.percent}%` }} />
          </div>
        </button>
      )}

      {/* Delegation banner */}
      {delegs.map((d) => (
        <div key={d.id} className="bg-[#E3EEFB] border border-[#E3EEFB] rounded-2xl p-4" data-testid={`deleg-banner-${d.id}`}>
          <div className="flex items-center gap-2 text-[#1D4F91] font-semibold text-sm"><ShieldCheck size={18} /> Anda ditunjuk mengisi absen</div>
          <p className="text-sm text-[#1D4F91] mt-1">{d.kegiatan_name}</p>
          <button data-testid={`deleg-open-${d.id}`} onClick={() => setFill(d)} className="mt-3 h-11 px-4 rounded-xl bg-[#14633F] text-white font-semibold text-sm hover:bg-[#0E4E31]">Isi Absensi</button>
        </div>
      ))}

      {/* Pinned announcements */}
      {(data?.announcements || []).map((a) => (
        <div key={a.id} className={`rounded-2xl p-4 border ${a.important ? "bg-[#FBE5E3] border-[#FBE5E3]" : "bg-white border-[#E7E3D8]"}`} data-testid={`peserta-ann-${a.id}`}>
          <div className="flex items-center gap-2 mb-1">
            <Pin size={13} className="text-[#0E4E31]" />
            {a.important && <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FBE5E3] text-[#A32A2A]"><AlertCircle size={11} /> Penting</span>}
          </div>
          <h3 className="font-heading font-bold text-[#14201A]">{a.title}</h3>
          {a.body && <p className="text-sm text-[#5F6B63] mt-1 whitespace-pre-wrap">{a.body}</p>}
        </div>
      ))}

      {/* Pintasan cepat peserta — QR Pribadi Saya & Scan QR */}
      <div className="grid grid-cols-2 gap-3" data-testid="peserta-shortcuts">
        <button
          type="button"
          data-testid="button-goto-barcode"
          onClick={() => onGoto("qr")}
          className="rounded-2xl bg-[#14633F] text-white p-4 text-left shadow-sm hover:bg-[#0E4E31] transition-colors"
        >
          <span className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center"><QrCode size={20} /></span>
          <span className="block font-heading font-bold mt-2.5">QR Pribadi Saya</span>
          <span className="block text-xs text-white/80 mt-0.5 leading-snug">
            Tunjukkan QR ini ke petugas untuk diabsen
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold mt-2">
            Buka QR pribadi saya <ChevronRight size={14} />
          </span>
        </button>
        <button
          type="button"
          data-testid="button-goto-scan"
          onClick={() => onGoto("scan")}
          className="rounded-2xl bg-white border-2 border-[#E7E3D8] p-4 text-left hover:border-[#14633F] transition-colors"
        >
          <span className="h-10 w-10 rounded-xl bg-[#E3F3EA] text-[#14633F] flex items-center justify-center"><ScanLine size={20} /></span>
          <span className="block font-heading font-bold text-[#14201A] mt-2.5">Scan QR Kegiatan</span>
          <span className="block text-xs text-[#5F6B63] mt-0.5 leading-snug">
            Absen mandiri dengan memindai QR kegiatan
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E4E31] mt-2">
            Buka pemindai <ChevronRight size={14} />
          </span>
        </button>
      </div>

      {/* FASE 15 — Tutorial QR & kesan-pesan kegiatan tampil di dashboard peserta */}
      <TutorialQr variant="pribadi" />
      <TutorialQr variant="kegiatan" />

      <KesanPesan />

      {/* Attendance ring */}
      <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5 flex items-center gap-5">
        <Ring value={data?.attendance?.ratio ?? 0} />
        <div>
          <div className="text-sm text-[#5F6B63]">Kehadiran Anda</div>
          <div className="text-lg font-bold text-[#14201A] mt-1">{data?.attendance?.hadir ?? 0} / {data?.attendance?.total ?? 0}</div>
          <div className="text-xs text-[#5F6B63]">pengajian dihadiri</div>
        </div>
      </div>

      {/* Riwayat kehadiran per bulan */}
      <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5" data-testid="riwayat-kehadiran">
        <h2 className="font-heading font-bold text-[#14201A] mb-1">Riwayat Kehadiran</h2>
        <p className="text-xs text-[#5F6B63] mb-3">Ringkasan hadir/izin/alpha 6 bulan terakhir</p>
        {history === null ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={22} /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4 sm:grid-cols-4">
              <div className="rounded-xl bg-[#E3F3EA] px-3 py-2 text-center">
                <div className="text-lg font-bold text-[#0E4E31]" data-testid="riwayat-hadir">{history.current?.hadir ?? 0}</div>
                <div className="text-[11px] text-[#5F6B63]">Hadir (bln ini)</div>
              </div>
              <div className="rounded-xl bg-[#FBF1D6] px-3 py-2 text-center">
                <div className="text-lg font-bold text-[#6B4500]">{history.current?.izin ?? 0}</div>
                <div className="text-[11px] text-[#5F6B63]">Izin</div>
              </div>
              <div className="rounded-xl bg-[#E3EEFB] px-3 py-2 text-center">
                <div className="text-lg font-bold text-[#1D4F91]">{history.current?.sakit ?? 0}</div>
                <div className="text-[11px] text-[#5F6B63]">Sakit</div>
              </div>
              <div className="rounded-xl bg-[#FBE5E3] px-3 py-2 text-center">
                <div className="text-lg font-bold text-[#A32A2A]">{history.current?.alpha ?? 0}</div>
                <div className="text-[11px] text-[#5F6B63]">Alpha</div>
              </div>
            </div>
            <div className="mb-3 rounded-xl border border-dashed border-[#E7E3D8] p-3 text-[11px] text-[#5F6B63]" data-testid="riwayat-keterangan">
              <b className="text-[#0E4E31]">Keterangan bulan ini: </b>
              {keteranganHitungan({
                hadir: history.current?.hadir ?? 0,
                izin: history.current?.izin ?? 0,
                sakit: history.current?.sakit ?? 0,
                alpha: history.current?.alpha ?? 0,
                belum_diabsen: history.current?.belum_diabsen ?? 0,
                total: history.current?.total ?? 0,
              })}
              <div className="mt-1">Peserta yang belum memiliki status tetap tercatat sebagai belum diabsen, bukan Alpha.</div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={history.months || []} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0EEE6" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5F6B63" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#5F6B63" }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="hadir" name="Hadir" stackId="a" fill="#14633F" radius={[0, 0, 0, 0]} />
                <Bar dataKey="izin" name="Izin" stackId="a" fill="#8A5A00" />
                <Bar dataKey="alpha" name="Alpha" stackId="a" fill="#A32A2A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Upcoming */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-heading font-bold text-[#14201A]">Jadwal Mendatang</h2>
          <button onClick={() => onGoto("kegiatan")} className="text-sm font-semibold text-[#0E4E31]">Lihat semua</button>
        </div>
        {(data?.upcoming || []).length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E7E3D8] p-6 text-center text-[#5F6B63] text-sm">Belum ada jadwal mendatang.</div>
        ) : (
          <div className="space-y-2">
            {data.upcoming.map((k) => (
              <div key={k.id} className="bg-white rounded-2xl border border-[#E7E3D8] p-4" data-testid={`upcoming-${k.id}`}>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>{TYPE_LABEL[k.type]}</span>
                <h3 className="font-heading font-bold text-[#14201A] mt-1.5">{k.name}</h3>
                <div className="text-sm text-[#5F6B63] mt-1 flex flex-col gap-1">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {tanggalPanjang(k.date)}</span>
                  <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {k.start_time}–{k.end_time} WITA</span>
                  {k.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {k.location}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {fill && <DelegasiFill deleg={fill} onClose={() => setFill(null)} />}
    </div>
  );
}
