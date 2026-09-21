import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Loader2, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { tanggalPanjang } from "./admin/kegiatanUtils";

export default function PublicMusyawarah() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get(`/musyawarah/${token}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setErr("Tautan musyawarah tidak ditemukan."));
  }, [token]);

  if (err) {
    return (
      <div className="min-h-screen bg-[#FAFBF9] flex flex-col items-center justify-center px-4 text-center">
        <Logo size={48} />
        <p className="text-[#991B1B] font-semibold mt-6" data-testid="musyawarah-public-error">{err}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen bg-[#FAFBF9] flex items-center justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-[#FAFBF9] pb-14" data-testid="musyawarah-public">
      <header className="bg-[#0D5C3A] text-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden p-0.5"><img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" /></div>
          <div className="leading-tight">
            <div className="font-bold font-heading">E-KERTALANGU</div>
            <div className="text-white/70 text-xs">Hasil Musyawarah</div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 -mt-3">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#065F46]">{data.label}</span>
          <h1 className="font-heading text-xl font-bold text-[#111827] mt-2 flex items-center gap-2"><CalendarDays size={18} className="text-[#0D5C3A]" /> {tanggalPanjang(data.date)}</h1>
          {data.created_by && (
            <div className="text-sm text-[#6B7280] mt-1.5 inline-flex items-center gap-1.5"><UserRound size={14} /> Dicatat oleh {data.created_by}</div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mt-4">
          <p className="text-sm leading-7 text-[#374151] whitespace-pre-line" data-testid="musyawarah-public-content">
            {data.content || "(belum ada isi catatan)"}
          </p>
        </div>

        <p className="text-center text-xs text-[#9CA3AF] mt-6">© 2026 E-KERTALANGU · Absensi Pengajian</p>
      </main>
    </div>
  );
}
