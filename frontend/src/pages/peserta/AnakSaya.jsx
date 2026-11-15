// "Anak saya" — hanya baca, untuk akun peserta yang tertaut sebagai wali.
// Server memeriksa relasi wali_anak; tidak ada anak_id yang dipercaya dari klien.
import { useEffect, useState } from "react";
import { Loader2, Users, CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import { ProgressBar } from "@/components/StatusGroups";
import { tanggalSingkat } from "@/pages/admin/kegiatanUtils";

const STATUS = {
  hadir: { label: "Hadir", cls: "bg-[#E3F3EA] text-[#0E4E31]" },
  izin: { label: "Izin", cls: "bg-[#FBF1D6] text-[#6B4500]" },
  sakit: { label: "Sakit", cls: "bg-[#E3EEFB] text-[#1D4F91]" },
  alpha: { label: "Alpha", cls: "bg-[#FBE5E3] text-[#A32A2A]" },
  belum_diabsen: { label: "Belum diabsen", cls: "bg-[#F0EEE6] text-[#5F6B63]" },
};

export default function AnakSaya() {
  const [data, setData] = useState(null);
  const [pick, setPick] = useState(null);

  useEffect(() => {
    api.get("/me/anak")
      .then(({ data: d }) => {
        setData(d.items || []);
        setPick((d.items || [])[0]?.id || null);
      })
      .catch(() => setData([]));
  }, []);

  if (data === null) {
    return <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={20} /></div>;
  }
  if (data.length === 0) return null;

  const anak = data.find((a) => a.id === pick) || data[0];
  const k = anak.kehadiran || {};

  return (
    <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="anak-saya">
      <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#14201A]">
        <Users size={16} className="text-[#0E4E31]" /> Anak saya
      </div>

      {data.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.map((a) => (
            <button key={a.id} type="button" onClick={() => setPick(a.id)}
              className={`h-9 rounded-lg px-3 text-xs font-semibold ${a.id === anak.id ? "bg-[#14633F] text-white" : "bg-[#F0EEE6] text-[#5F6B63] hover:bg-[#E7E3D8]"}`}>
              {a.nama}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-[#14201A]">{anak.nama}</span>
          <span className="text-sm font-bold tabular-nums text-[#0E4E31]">{k.ratio ?? 0}%</span>
        </div>
        <div className="mt-1 text-[11px] text-[#5F6B63]">
          Kehadiran bulan ini · {k.hadir ?? 0} dari {k.total ?? 0} pertemuan
        </div>
        <div className="mt-1.5">
          <ProgressBar value={k.ratio ?? 0} testid="anak-saya-bilah" />
        </div>
      </div>

      <div className="mt-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#5F6B63]">Lima pertemuan terakhir</div>
        {(anak.terakhir || []).length === 0 ? (
          <p className="mt-1 text-xs text-[#5F6B63]">Belum ada pertemuan yang berlangsung.</p>
        ) : (
          <ul className="mt-1 divide-y divide-[#F0EEE6]">
            {anak.terakhir.map((t, i) => {
              const st = STATUS[t.status] || STATUS.belum_diabsen;
              return (
                <li key={`${t.date}-${i}`} className="flex items-center gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs text-[#14201A]">{t.name}</span>
                  <span className="shrink-0 text-[11px] text-[#5F6B63]">{tanggalSingkat(t.date)}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(anak.tugas || []).length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#5F6B63]">Tugas dari guru</div>
          <ul className="mt-1 divide-y divide-[#F0EEE6]">
            {anak.tugas.map((t, i) => (
              <li key={`${t.judul}-${i}`} className="flex items-center gap-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-xs text-[#14201A]">{t.judul}</span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-[#5F6B63]">
                  <CalendarDays size={11} /> {tanggalSingkat(t.batas_kumpul)}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.sudah ? "bg-[#E3F3EA] text-[#0E4E31]" : "bg-[#F0EEE6] text-[#5F6B63]"}`}>
                  {t.sudah ? "Sudah" : "Belum"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
