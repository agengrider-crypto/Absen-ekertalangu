import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Clock, MapPin, User, BookOpen, Loader2, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Logo, K1Mark } from "@/components/Logo";
import PesertaRekapList from "@/components/PesertaRekapList";
import { TYPE_LABEL, tanggalPanjang } from "./admin/kegiatanUtils";
import { PercentBar } from "./PublicRekapGabungan";

const pct = (n, total) => (total ? Math.round(((Number(n) || 0) / total) * 1000) / 10 : 0);

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
      <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center px-4 text-center">
        <Logo size={48} />
        <p className="text-[#A32A2A] font-semibold mt-6">{err}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={32} /></div>;
  }

  const c = data.counts || {};

  return (
    <div className="min-h-screen bg-[#F6F4EE] pb-12">
      <header className="bg-[#14633F] text-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden p-0.5"><K1Mark size={32} variant="light" /></div>
          <div className="leading-tight">
            <div className="font-bold font-heading">E-KERTALANGU</div>
            <div className="text-white/70 text-xs">Rekap Kehadiran</div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 -mt-3">
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5 shadow-sm">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E3F3EA] text-[#0E4E31]">{TYPE_LABEL[data.type] || data.type}</span>
          <h1 className="font-heading text-xl font-bold text-[#14201A] mt-2">{data.name}</h1>
          <div className="text-sm text-[#5F6B63] mt-2 space-y-1">
            <div className="flex items-center gap-2"><CalendarDays size={15} /> {tanggalPanjang(data.date)}</div>
            <div className="flex items-center gap-2"><Clock size={15} /> {data.start_time}–{data.end_time} WITA</div>
            {data.location && <div className="flex items-center gap-2"><MapPin size={15} /> {data.location}</div>}
            {data.teacher && <div className="flex items-center gap-2"><User size={15} /> {data.teacher}</div>}
            {data.material && <div className="flex items-center gap-2"><BookOpen size={15} /> {data.material}</div>}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 my-4">
          <div className="rounded-xl bg-white border border-[#E7E3D8] p-3 text-center"><div className="text-xl font-bold text-[#14201A]">{c.total}</div><div className="text-xs text-[#5F6B63]">Total</div></div>
          <div className="rounded-xl bg-white border border-[#E7E3D8] p-3 text-center"><div className="text-xl font-bold text-[#0E4E31]">{c.hadir}</div><div className="text-xs text-[#5F6B63]">Hadir</div></div>
          <div className="rounded-xl bg-white border border-[#E7E3D8] p-3 text-center"><div className="text-xl font-bold text-[#6B4500]">{c.izin}</div><div className="text-xs text-[#5F6B63]">Izin</div></div>
          <div className="rounded-xl bg-white border border-[#E7E3D8] p-3 text-center"><div className="text-xl font-bold text-[#A32A2A]">{c.alpha}</div><div className="text-xs text-[#5F6B63]">Alpha</div></div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5 mb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#0E4E31] font-semibold"><CheckCircle2 size={18} /> Tingkat Kehadiran</div>
            <div className="text-2xl font-bold text-[#0E4E31] tabular-nums">{c.ratio}%</div>
          </div>
          <PercentBar label="Hadir" value={c.ratio} sub={`${c.hadir}/${c.total}`} testid="bar-hadir" />
          <PercentBar label="Izin" value={pct(c.izin, c.total)} sub={`${c.izin} orang`} color="#5F6B63" testid="bar-izin" />
          <PercentBar label="Alpha" value={pct(c.alpha, c.total)} sub={`${c.alpha} orang`} color="#A32A2A" testid="bar-alpha" />
        </div>

        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5 mb-4 space-y-4">
          <div className="text-sm font-semibold text-[#14201A]">Kehadiran per Jenis Kelamin</div>
          <PercentBar label={`Laki-laki (${data.gender?.L ?? 0})`} value={pct(data.gender?.L, c.hadir)} color="#14201A" testid="bar-gender-l" />
          <PercentBar label={`Perempuan (${data.gender?.P ?? 0})`} value={pct(data.gender?.P, c.hadir)} color="#5F6B63" testid="bar-gender-p" />
        </div>

        <PesertaRekapList
          rows={data.rows}
          counts={c}
          title="Daftar Peserta"
          testid="rekap-publik-list"
        />

        <p className="text-center text-xs text-[#5F6B63] mt-6">© 2026 E-KERTALANGU · Absensi Pengajian</p>
      </main>
    </div>
  );
}
