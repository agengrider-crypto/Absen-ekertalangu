// FASE 18 — Undangan penting yang dikirim pengurus ke peserta ini.
import { useEffect, useState } from "react";
import { MailWarning, CalendarDays, Clock, MapPin, User } from "lucide-react";
import { api } from "@/lib/api";

export default function UndanganSaya() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/me/undangan").then(({ data }) => setItems(data.items || [])).catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="mb-4 space-y-2" data-testid="peserta-undangan">
      {items.map((u) => (
        <div key={u.kegiatan_id} data-testid={`peserta-undangan-${u.kegiatan_id}`}
          className="rounded-2xl border-2 border-[#FECACA] bg-[#FEF2F2] p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#991B1B] inline-flex items-center gap-1.5">
            <MailWarning size={13} /> Undangan Penting
          </div>
          <div className="font-heading font-bold text-[#111827] mt-1">{u.kegiatan?.name}</div>
          <div className="text-xs text-[#4B5563] mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {u.kegiatan?.date}</span>
            <span className="inline-flex items-center gap-1"><Clock size={12} /> {u.kegiatan?.start_time}–{u.kegiatan?.end_time} WITA</span>
            {u.kegiatan?.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {u.kegiatan.location}</span>}
            {u.kegiatan?.teacher && <span className="inline-flex items-center gap-1"><User size={12} /> {u.kegiatan.teacher}</span>}
          </div>
          {u.message && (
            <p className="text-sm text-[#991B1B] mt-2 leading-relaxed whitespace-pre-wrap">{u.message}</p>
          )}
          <p className="text-[11px] text-[#9CA3AF] mt-2">
            Diundang oleh {u.created_by_name || "pengurus"} — mohon diusahakan hadir. Jazakumullahu khoiro.
          </p>
        </div>
      ))}
    </div>
  );
}
