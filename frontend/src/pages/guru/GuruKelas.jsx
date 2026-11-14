// Kelas Saya — per jenjang: daftar peserta + persentase kehadiran & tag tidak hadir 3x.
import { useEffect, useState } from "react";
import { Loader2, Users, AlertTriangle, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";

export default function GuruKelas() {
  const [data, setData] = useState(null);
  const [pick, setPick] = useState("");

  useEffect(() => {
    api.get("/guru/kelas").then(({ data: d }) => {
      setData(d);
      setPick((d.items || [])[0]?.jenjang || "");
    }).catch(() => setData(false));
  }, []);

  if (data === null) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;
  }
  if (data === false) {
    return <div className="rounded-2xl border border-[#E7E3D8] bg-white p-8 text-center text-sm text-[#5F6B63]">Gagal memuat kelas.</div>;
  }

  const items = data.items || [];
  const isAdmin = data.scope?.mode === "semua";
  const active = items.find((i) => i.jenjang === pick) || items[0];

  return (
    <div className="space-y-4" data-testid="guru-kelas">
      <div>
        <h1 className="font-heading text-xl font-bold text-[#14201A]">Kelas Saya</h1>
        <p className="mt-1 text-sm text-[#5F6B63]">Peserta per jenjang beserta persentase kehadiran.</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-8 text-center text-sm text-[#5F6B63]">
          Belum ada kelas yang diampu.
        </div>
      ) : (
        <>
          {isAdmin && (
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#14201A]">Pilih kelas</span>
              <div className="relative">
                <select data-testid="guru-kelas-pilih" value={active?.jenjang || ""} onChange={(e) => setPick(e.target.value)}
                  className="h-12 w-full appearance-none rounded-xl border border-[#8A948D] bg-white px-3.5 pr-10 text-[15px] outline-none focus:border-[#14633F]">
                  {items.map((i) => <option key={i.jenjang} value={i.jenjang}>{i.label} · {i.total_peserta} peserta</option>)}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
              </div>
            </label>
          )}

          {active && (
            <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid={`guru-kelas-${active.jenjang}`}>
              <div className="flex items-center gap-2 text-sm font-bold text-[#14201A]">
                <Users size={16} className="text-[#0E4E31]" /> {active.label} · {active.total_peserta} peserta
              </div>
              <div className="mt-3 divide-y divide-[#F0EEE6]">
                {active.peserta.length === 0 ? (
                  <p className="py-4 text-sm text-[#5F6B63]">Belum ada peserta pada jenjang ini.</p>
                ) : active.peserta.map((p) => (
                  <div key={p.user_id} className="flex items-center gap-3 py-2.5" data-testid={`guru-kelas-row-${p.user_id}`}>
                    <span className="min-w-0 flex-1 truncate text-sm text-[#14201A]">{p.name}</span>
                    {p.tidak_hadir_3x && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FBE5E3] px-2 py-0.5 text-[11px] font-semibold text-[#A32A2A]">
                        <AlertTriangle size={11} /> Tidak hadir 3x
                      </span>
                    )}
                    <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-[#0E4E31]">{p.ratio}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
