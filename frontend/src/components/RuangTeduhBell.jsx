// FASE 16 — Lonceng notifikasi: jumlah pesan Ruang Teduh yang belum dibaca.
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";

export default function RuangTeduhBell({ onOpen, active }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = () =>
      api.get("/staff/pengaduan/unread-count")
        .then(({ data }) => setCount(data.belum_dibaca || 0))
        .catch(() => {});
    load();
    const iv = setInterval(load, 45000);
    return () => clearInterval(iv);
  }, [active]);

  return (
    <button
      data-testid="bell-ruang-teduh"
      onClick={onOpen}
      title={count > 0 ? `${count} pesan Ruang Teduh belum dibaca` : "Ruang Teduh"}
      className="relative h-10 w-10 flex items-center justify-center rounded-xl border border-[#E8E8E4] text-[#4B5563] hover:border-[#111114] hover:text-[#111114] transition-colors"
    >
      <Bell size={18} />
      {count > 0 && (
        <span
          data-testid="bell-ruang-teduh-count"
          className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[#111114] text-white text-[11px] font-bold flex items-center justify-center"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
