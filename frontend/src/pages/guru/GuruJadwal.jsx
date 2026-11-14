// Jadwal Saya — daftar pertemuan (kegiatan jenis Pembelajaran) pekan ini & berikutnya.
import { useEffect, useMemo, useState } from "react";
import { Loader2, CalendarClock, Clock, MapPin, Users, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { nowWita, tanggalPanjang } from "@/pages/admin/kegiatanUtils";

export default function GuruJadwal({ onOpenAbsen }) {
  const [items, setItems] = useState(null);
  const [pick, setPick] = useState(null);
  const today = nowWita().date;

  useEffect(() => {
    api.get("/guru/pertemuan").then(({ data }) => setItems(data.items || [])).catch(() => setItems([]));
  }, []);

  const groups = useMemo(() => {
    const out = [];
    (items || []).forEach((k) => {
      const last = out[out.length - 1];
      if (last && last.date === k.date) last.rows.push(k);
      else out.push({ date: k.date, rows: [k] });
    });
    return out;
  }, [items]);

  if (items === null) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;
  }

  return (
    <div className="space-y-4" data-testid="guru-jadwal">
      <div>
        <h1 className="font-heading text-xl font-bold text-[#14201A]">Jadwal Saya</h1>
        <p className="mt-1 text-sm text-[#5F6B63]">Pertemuan pekan ini dan berikutnya.</p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-8 text-center text-sm text-[#5F6B63]">
          Belum ada pertemuan terjadwal.
        </div>
      ) : groups.map((g) => (
        <div key={g.date} className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-[#5F6B63]">
            {tanggalPanjang(g.date)}{g.date === today ? " · hari ini" : ""}
          </div>
          <div className="mt-2 space-y-2">
            {g.rows.map((k) => {
              const on = pick === k.id;
              return (
                <div key={k.id} data-testid={`guru-jadwal-${k.id}`}
                  className={`rounded-xl border-2 p-3 transition-colors ${on ? "border-[#14633F] bg-white" : "border-[#E7E3D8] bg-[#F6F4EE]"}`}>
                  <button type="button" onClick={() => setPick(on ? null : k.id)}
                    className="flex w-full items-center gap-2 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#14201A]">{k.name}</span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#5F6B63]">
                        <span className="inline-flex items-center gap-1"><Clock size={12} /> {k.start_time}–{k.end_time} WITA</span>
                        {k.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {k.location}</span>}
                        <span className="inline-flex items-center gap-1"><Users size={12} /> {k.counts?.total ?? 0} peserta</span>
                      </span>
                    </span>
                    <ChevronRight size={18} className={`shrink-0 text-[#D9D4C5] transition-transform ${on ? "rotate-90" : ""}`} />
                  </button>
                  {on && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button type="button" data-testid={`guru-jadwal-absen-${k.id}`}
                        onClick={() => onOpenAbsen?.(k.id)}
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#14633F] px-3.5 text-sm font-semibold text-white hover:bg-[#0E4E31]">
                        <CalendarClock size={15} /> Buka absen kelas
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
