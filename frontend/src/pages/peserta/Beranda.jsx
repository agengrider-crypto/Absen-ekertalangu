import { useEffect, useState } from "react";
import { Loader2, Pin, AlertCircle, CalendarDays, Clock, MapPin, ShieldCheck, Search, QrCode, ScanLine, ChevronRight, UserCog } from "lucide-react";
import { toast } from "sonner";
import Modal from "@/components/Modal";
import ReportHeader from "@/components/ReportHeader";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalPanjang } from "@/pages/admin/kegiatanUtils";
import KesanPesan from "./KesanPesan";
import { profileCompletion } from "@/lib/roles";
import { keteranganHitungan } from "@/pages/admin/rekapUtils";

function Ring({ value }) {
  const r = 46, c = 2 * Math.PI * r;
  const off = c - (Math.min(value, 100) / 100) * c;
  return (
    <div className="relative h-24 w-24 shrink-0" data-testid="attendance-ring">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#E7E3D8" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#14633F" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-[#0E4E31]">{value}%</span>
        <span className="text-[10px] text-[#5F6B63]">kehadiran</span>
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
    <Modal
      onClose={onClose}
      title="Isi Absensi (Delegasi)"
      subtitle={deleg.kegiatan_name}
      testid="modal-delegasi-fill"
      maxWidth={640}
      bodyClassName="p-4"
    >
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
    </Modal>
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
  const next = (data?.upcoming || [])[0];
  const cur = history?.current || {};

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-[24px] font-bold text-[#14201A] leading-tight" data-testid="peserta-greeting">
          Halo, {user?.name}
        </h1>
        <p className="text-[#5F6B63] text-sm mt-1">{greeting}. Semoga harimu lancar.</p>
      </div>

      {/* Kegiatan berikutnya — disembunyikan bila tidak ada */}
      {next && (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid={`upcoming-${next.id}`}>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#5F6B63]">Kegiatan berikutnya</div>
          <h2 className="font-heading font-bold text-[#14201A] mt-1">{next.name}</h2>
          <div className="text-sm text-[#5F6B63] mt-1 flex flex-col gap-1">
            <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {tanggalPanjang(next.date)}</span>
            <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {next.start_time}–{next.end_time} WITA</span>
            {next.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {next.location}</span>}
          </div>
        </div>
      )}

      {/* Satu-satunya elemen hijau tebal */}
      <button
        type="button"
        data-testid="button-goto-scan"
        onClick={() => onGoto("scan")}
        className="flex w-full items-center gap-3 rounded-2xl bg-[#14633F] p-4 text-left text-white shadow-sm transition-colors hover:bg-[#0E4E31]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><ScanLine size={22} /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-heading font-bold">Scan QR Kegiatan</span>
          <span className="block text-xs text-white/80 mt-0.5">Absen mandiri dengan memindai QR kegiatan</span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-white/80" />
      </button>

      <button
        type="button"
        data-testid="button-goto-barcode"
        onClick={() => onGoto("qr")}
        className="flex w-full items-center gap-2 px-1 py-1 text-left text-sm font-semibold text-[#0E4E31] hover:underline"
      >
        <QrCode size={16} /> Tampilkan QR Pribadi saya
      </button>

      {/* Kehadiran */}
      <button
        type="button"
        data-testid="peserta-kehadiran-card"
        onClick={() => document.getElementById("riwayat-kehadiran")?.scrollIntoView({ behavior: "smooth", block: "start" })}
        className="w-full rounded-2xl border border-[#E7E3D8] bg-white p-4 text-left transition-colors hover:border-[#14633F]"
      >
        <div className="flex items-center gap-4">
          <Ring value={data?.attendance?.ratio ?? 0} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#14201A]">Kehadiran Anda</div>
            <div className="text-xs text-[#5F6B63] mt-0.5">
              {data?.attendance?.hadir ?? 0} dari {data?.attendance?.total ?? 0} pengajian
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1 text-center">
              <span className="rounded-lg bg-[#E3F3EA] px-1 py-1">
                <span className="block text-sm font-bold text-[#0E4E31]">{cur.hadir ?? 0}</span>
                <span className="block text-[10px] text-[#5F6B63]">Hadir</span>
              </span>
              <span className="rounded-lg bg-[#FBF1D6] px-1 py-1">
                <span className="block text-sm font-bold text-[#6B4500]">{cur.izin ?? 0}</span>
                <span className="block text-[10px] text-[#5F6B63]">Izin</span>
              </span>
              <span className="rounded-lg bg-[#E3EEFB] px-1 py-1">
                <span className="block text-sm font-bold text-[#1D4F91]">{cur.sakit ?? 0}</span>
                <span className="block text-[10px] text-[#5F6B63]">Sakit</span>
              </span>
              <span className="rounded-lg bg-[#FBE5E3] px-1 py-1">
                <span className="block text-sm font-bold text-[#A32A2A]">{cur.alpha ?? 0}</span>
                <span className="block text-[10px] text-[#5F6B63]">Alpha</span>
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Kelengkapan profil — disembunyikan bila 100% */}
      {completion.percent < 100 && (
        <button
          type="button"
          data-testid="peserta-kelengkapan-banner"
          onClick={() => onGoto("profil")}
          className="flex w-full items-center gap-2 px-1 py-1 text-left text-sm font-semibold text-[#0E4E31] hover:underline"
        >
          <UserCog size={16} /> Lengkapi profil
          <span className="tabular-nums" data-testid="peserta-kelengkapan-persen">{completion.percent}%</span>
          <ChevronRight size={16} className="ml-auto text-[#5F6B63]" />
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

      <KesanPesan />

      {/* Riwayat kehadiran per bulan */}
      <div id="riwayat-kehadiran" className="bg-white rounded-2xl border border-[#E7E3D8] p-5" data-testid="riwayat-kehadiran">
        <ReportHeader
          title="Laporan Kehadiran Saya"
          subtitle={history?.current?.label || "6 bulan terakhir"}
          showUserIcon
          onUserClick={() => onGoto?.("profil")}
          compact
          testid="riwayat-kehadiran-header"
        />
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

      {fill && <DelegasiFill deleg={fill} onClose={() => setFill(null)} />}
    </div>
  );
}
