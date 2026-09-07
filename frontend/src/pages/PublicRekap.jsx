import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Clock, MapPin, User, BookOpen, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import PesertaRekapList from "@/components/PesertaRekapList";
import { TYPE_LABEL, tanggalPanjang } from "./admin/kegiatanUtils";

export default function PublicRekap() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get(`/rekap/${token}`)
      .then(({ data: d }) => setData(d))
      .catch((e) => {
        if (e.response?.status === 410) setErr("Tautan rekap sudah kadaluarsa (berlaku 7 hari).");
        else setErr("Tautan rekap tidak ditemukan.");
      });
  }, [token]);

  if (err) {
    return (
      <div className="min-h-screen bg-[#FAFBF9] flex flex-col items-center justify-center px-4 text-center">
        <Logo size={48} />
        <p className="text-[#991B1B] font-semibold mt-6">{err}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen bg-[#FAFBF9] flex items-center justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={32} /></div>;
  }

  const c = data.counts || {};

  return (
    <div className="min-h-screen bg-[#FAFBF9] pb-12">
      <header className="bg-[#0D5C3A] text-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden p-0.5"><img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" /></div>
          <div className="leading-tight">
            <div className="font-bold font-heading">E-KERTALANGU</div>
            <div className="text-white/70 text-xs">Rekap Kehadiran</div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 -mt-3">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#065F46]">{TYPE_LABEL[data.type] || data.type}</span>
          <h1 className="font-heading text-xl font-bold text-[#111827] mt-2">{data.name}</h1>
          <div className="text-sm text-[#6B7280] mt-2 space-y-1">
            <div className="flex items-center gap-2"><CalendarDays size={15} /> {tanggalPanjang(data.date)}</div>
            <div className="flex items-center gap-2"><Clock size={15} /> {data.start_time}–{data.end_time} WITA</div>
            {data.location && <div className="flex items-center gap-2"><MapPin size={15} /> {data.location}</div>}
            {data.teacher && <div className="flex items-center gap-2"><User size={15} /> {data.teacher}</div>}
            {data.material && <div className="flex items-center gap-2"><BookOpen size={15} /> {data.material}</div>}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 my-4">
          <div className="rounded-xl bg-white border border-[#E5E7EB] p-3 text-center"><div className="text-xl font-bold text-[#111827]">{c.total}</div><div className="text-xs text-[#6B7280]">Total</div></div>
          <div className="rounded-xl bg-white border border-[#E5E7EB] p-3 text-center"><div className="text-xl font-bold text-[#065F46]">{c.hadir}</div><div className="text-xs text-[#6B7280]">Hadir</div></div>
          <div className="rounded-xl bg-white border border-[#E5E7EB] p-3 text-center"><div className="text-xl font-bold text-[#92400E]">{c.izin}</div><div className="text-xs text-[#6B7280]">Izin</div></div>
          <div className="rounded-xl bg-white border border-[#E5E7EB] p-3 text-center"><div className="text-xl font-bold text-[#991B1B]">{c.alpha}</div><div className="text-xs text-[#6B7280]">Alpha</div></div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#0D5C3A] font-semibold"><CheckCircle2 size={18} /> Tingkat Kehadiran</div>
          <div className="text-2xl font-bold text-[#0D5C3A]">{c.ratio}%</div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mb-4">
          <div className="text-sm font-semibold text-[#111827] mb-1">Kehadiran per Jenis Kelamin</div>
          <div className="flex gap-4 text-sm text-[#4B5563]">
            <span>Laki-laki: <b className="text-[#0D5C3A]">{data.gender?.L ?? 0}</b></span>
            <span>Perempuan: <b className="text-[#D97706]">{data.gender?.P ?? 0}</b></span>
          </div>
        </div>

        <PesertaRekapList
          rows={data.rows}
          counts={c}
          title="Daftar Peserta"
          testid="rekap-publik-list"
        />

        <p className="text-center text-xs text-[#9CA3AF] mt-6">© 2026 E-KERTALANGU · Absensi Pengajian</p>
      </main>
    </div>
  );
}
