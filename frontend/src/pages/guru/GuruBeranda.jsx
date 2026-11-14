// Beranda area Guru: mengajar hari ini + ringkasan pertemuan & kehadiran.
import { useEffect, useState } from "react";
import { Loader2, CalendarClock, Clock, MapPin, Users, PlayCircle } from "lucide-react";
import { api } from "@/lib/api";
import { nowWita, tanggalPanjang } from "@/pages/admin/kegiatanUtils";

function Bar({ value, tone = "#14633F" }) {
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#F0EEE6]">
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%`, backgroundColor: tone }}
      />
    </div>
  );
}

export default function GuruBeranda({ user, onGoto, onOpenAbsen }) {
  const [pertemuan, setPertemuan] = useState(null);
  const [ringkasan, setRingkasan] = useState(null);
  const today = nowWita().date;

  useEffect(() => {
    api.get("/guru/pertemuan").then(({ data }) => setPertemuan(data.items || [])).catch(() => setPertemuan([]));
    api.get("/guru/ringkasan").then(({ data }) => setRingkasan(data)).catch(() => setRingkasan(false));
  }, []);

  const hariIni = (pertemuan || []).filter((k) => k.date === today);
  const berikutnya = (pertemuan || []).find((k) => k.date > today);
  const terlaksana = ringkasan?.pertemuan?.terlaksana_bulan_ini ?? 0;
  const kehadiran = ringkasan?.kehadiran || { rata_rata: 0 };

  return (
    <div className="space-y-4" data-testid="guru-beranda">
      <div>
        <h1 className="font-heading text-[24px] font-bold leading-tight text-[#14201A]">
          Halo, {user?.name || "Ustadz/Ustadzah"}
        </h1>
        <p className="mt-1 text-sm text-[#5F6B63]">Ringkasan kelas dan capaian mengajar Anda.</p>
      </div>

      <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="guru-mengajar-hari-ini">
        <div className="flex items-center gap-2 text-sm font-bold text-[#14201A]">
          <CalendarClock size={16} className="text-[#0E4E31]" /> Mengajar hari ini
        </div>
        {pertemuan === null ? (
          <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={22} /></div>
        ) : hariIni.length === 0 ? (
          <div className="mt-2">
            <p className="text-sm text-[#5F6B63]">Tidak ada jadwal mengajar hari ini.</p>
            {berikutnya && (
              <p className="mt-1 text-xs text-[#5F6B63]">
                Pertemuan berikutnya: <b className="text-[#14201A]">{berikutnya.name}</b> · {tanggalPanjang(berikutnya.date)} · {berikutnya.start_time}–{berikutnya.end_time} WITA
              </p>
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {hariIni.map((k) => (
              <div key={k.id} className="rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] p-3" data-testid={`guru-hari-ini-${k.id}`}>
                <div className="text-sm font-semibold text-[#14201A]">{k.name}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#5F6B63]">
                  <span className="inline-flex items-center gap-1"><Clock size={12} /> {k.start_time}–{k.end_time} WITA</span>
                  {k.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {k.location}</span>}
                  <span className="inline-flex items-center gap-1"><Users size={12} /> {k.counts?.total ?? 0} peserta</span>
                </div>
                <button
                  type="button"
                  data-testid={`guru-mulai-absen-${k.id}`}
                  onClick={() => onOpenAbsen?.(k.id)}
                  className="mt-2.5 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#14633F] px-3.5 text-sm font-semibold text-white hover:bg-[#0E4E31]"
                >
                  <PlayCircle size={16} /> Mulai absen kelas
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="guru-capaian">
        <div className="text-sm font-bold text-[#14201A]">Capaian</div>
        {ringkasan === null ? (
          <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={22} /></div>
        ) : (
          <div className="mt-3 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-[#5F6B63]">
                <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> Pertemuan terlaksana bulan ini</span>
                <span className="font-semibold text-[#14201A]">{terlaksana}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-[#5F6B63]">
                <span className="inline-flex items-center gap-1"><Users size={12} /> Kehadiran rata-rata</span>
                <span className="font-semibold text-[#14201A]">{kehadiran.rata_rata}%</span>
              </div>
              <Bar value={kehadiran.rata_rata} tone="#0A5961" />
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => onGoto?.("jadwal")}
        className="w-full rounded-2xl border border-[#E7E3D8] bg-white p-4 text-left text-sm font-semibold text-[#0E4E31] hover:border-[#14633F]"
      >
        Lihat Jadwal Saya
      </button>
    </div>
  );
}
