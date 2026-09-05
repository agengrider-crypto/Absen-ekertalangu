import { useEffect, useState } from "react";
import { Loader2, Pin, AlertCircle, CalendarDays, Clock, MapPin, ShieldCheck, X, Search } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { TYPE_LABEL, TYPE_COLOR, tanggalPanjang } from "@/pages/admin/kegiatanUtils";

function Ring({ value }) {
  const r = 46, c = 2 * Math.PI * r;
  const off = c - (Math.min(value, 100) / 100) * c;
  return (
    <div className="relative h-32 w-32" data-testid="attendance-ring">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#E5E7EB" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#0D5C3A" strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-[#0D5C3A]">{value}%</span>
        <span className="text-[11px] text-[#6B7280]">kehadiran</span>
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
  const btn = (uid, st, label, cls) => (
    <button data-testid={`deleg-mark-${st}-${uid}`} onClick={() => mark(uid, st)} disabled={busy === uid + st}
      className={`h-8 px-2.5 rounded-lg text-xs font-semibold border ${cls}`}>{label}</button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto" data-testid="modal-delegasi-fill">
        <div className="sticky top-0 bg-white border-b border-[#E5E7EB] px-5 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-[#111827]">Isi Absensi (Delegasi)</h3>
            <p className="text-xs text-[#6B7280]">{deleg.kegiatan_name}</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"><X size={20} /></button>
        </div>
        <div className="p-4">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…" className="w-full h-11 pl-9 pr-3 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A]" />
          </div>
          {data === null ? (
            <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={26} /></div>
          ) : (
            <div className="space-y-1.5">
              {rows.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 py-2 border-b border-[#F3F4F6]">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#111827] truncate">{p.name}</div>
                    <div className="text-xs text-[#9CA3AF]">{p.status}</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {btn(p.id, "hadir", "H", p.status === "hadir" ? "bg-[#0D5C3A] text-white border-[#0D5C3A]" : "bg-white text-[#0D5C3A] border-[#0D5C3A]")}
                    {btn(p.id, "izin", "I", p.status === "izin" ? "bg-[#D97706] text-white border-[#D97706]" : "bg-white text-[#D97706] border-[#F59E0B]")}
                    {btn(p.id, "alpha", "A", p.status === "alpha" ? "bg-[#DC2626] text-white border-[#DC2626]" : "bg-white text-[#DC2626] border-[#FCA5A5]")}
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

  useEffect(() => {
    api.get("/me/dashboard").then(({ data }) => setData(data)).catch(() => setData(false));
    api.get("/me/delegations").then(({ data }) => setDelegs(data || [])).catch(() => {});
  }, []);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 19) return "Selamat sore";
    return "Selamat malam";
  })();

  if (data === null) return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={30} /></div>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[#6B7280] text-sm">{greeting},</p>
        <h1 className="font-heading text-2xl font-bold text-[#111827]" data-testid="peserta-greeting">{user?.name}</h1>
      </div>

      {/* Delegation banner */}
      {delegs.map((d) => (
        <div key={d.id} className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-2xl p-4" data-testid={`deleg-banner-${d.id}`}>
          <div className="flex items-center gap-2 text-[#1E40AF] font-semibold text-sm"><ShieldCheck size={18} /> Anda ditunjuk mengisi absen</div>
          <p className="text-sm text-[#1E3A8A] mt-1">{d.kegiatan_name}</p>
          <button data-testid={`deleg-open-${d.id}`} onClick={() => setFill(d)} className="mt-3 h-10 px-4 rounded-xl bg-[#1D4ED8] text-white font-semibold text-sm">Isi Absensi</button>
        </div>
      ))}

      {/* Pinned announcements */}
      {(data?.announcements || []).map((a) => (
        <div key={a.id} className={`rounded-2xl p-4 border ${a.important ? "bg-[#FEF2F2] border-[#FECACA]" : "bg-white border-[#E5E7EB]"}`} data-testid={`peserta-ann-${a.id}`}>
          <div className="flex items-center gap-2 mb-1">
            <Pin size={13} className="text-[#0D5C3A]" />
            {a.important && <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B]"><AlertCircle size={11} /> Penting</span>}
          </div>
          <h3 className="font-heading font-bold text-[#111827]">{a.title}</h3>
          {a.body && <p className="text-sm text-[#4B5563] mt-1 whitespace-pre-wrap">{a.body}</p>}
        </div>
      ))}

      {/* Attendance ring */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex items-center gap-5">
        <Ring value={data?.attendance?.ratio ?? 0} />
        <div>
          <div className="text-sm text-[#6B7280]">Kehadiran Anda</div>
          <div className="text-lg font-bold text-[#111827] mt-1">{data?.attendance?.hadir ?? 0} / {data?.attendance?.total ?? 0}</div>
          <div className="text-xs text-[#9CA3AF]">pengajian dihadiri</div>
        </div>
      </div>

      {/* Upcoming */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-heading font-bold text-[#111827]">Jadwal Mendatang</h2>
          <button onClick={() => onGoto("kegiatan")} className="text-sm font-semibold text-[#0D5C3A]">Lihat semua</button>
        </div>
        {(data?.upcoming || []).length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center text-[#6B7280] text-sm">Belum ada jadwal mendatang.</div>
        ) : (
          <div className="space-y-2">
            {data.upcoming.map((k) => (
              <div key={k.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-4" data-testid={`upcoming-${k.id}`}>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>{TYPE_LABEL[k.type]}</span>
                <h3 className="font-heading font-bold text-[#111827] mt-1.5">{k.name}</h3>
                <div className="text-sm text-[#6B7280] mt-1 flex flex-col gap-1">
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
