// FASE 18 — Lonceng notifikasi SEMUA fitur: Ruang Teduh, Kegiatan, Pengumuman,
// Musyawarah, dan Undangan Penting.
import { useCallback, useEffect, useState } from "react";
import {
  Bell, X, CalendarDays, Megaphone, MessagesSquare, HeartHandshake, MailWarning,
} from "lucide-react";
import { api } from "@/lib/api";

const META = {
  kegiatan: { icon: CalendarDays, label: "Kegiatan baru", cls: "bg-[#ECFDF5] text-[#047857]" },
  pengumuman: { icon: Megaphone, label: "Pengumuman", cls: "bg-[#FEF3C7] text-[#92400E]" },
  musyawarah: { icon: MessagesSquare, label: "Musyawarah", cls: "bg-[#EEF2FF] text-[#3730A3]" },
  pengaduan: { icon: HeartHandshake, label: "Ruang Teduh", cls: "bg-[#FDF2F8] text-[#9D174D]" },
  undangan: { icon: MailWarning, label: "Undangan penting", cls: "bg-[#FEE2E2] text-[#991B1B]" },
};

export default function NotificationBell({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    api.get("/notifications")
      .then(({ data }) => { setItems(data.items || []); setCount(data.count || 0); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 45000);
    return () => clearInterval(iv);
  }, [load]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && count > 0) {
      setCount(0);
      try { await api.post("/notifications/read"); } catch { /* abaikan */ }
    }
  };

  return (
    <div className="relative">
      <button
        data-testid="bell-notifikasi"
        onClick={toggle}
        title={count > 0 ? `${count} notifikasi baru` : "Notifikasi"}
        className="relative h-10 w-10 flex items-center justify-center rounded-xl border border-[#E8E8E4] text-[#4B5563] hover:border-[#111114] hover:text-[#111114] transition-colors"
      >
        <Bell size={18} />
        {count > 0 && (
          <span
            data-testid="bell-notifikasi-count"
            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[#DC2626] text-white text-[11px] font-bold flex items-center justify-center"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            data-testid="notif-panel"
            className="absolute right-0 mt-2 w-[min(92vw,380px)] z-50 bg-white rounded-2xl border border-[#E8E8E4] shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-[#ECECE8] flex items-center justify-between">
              <div className="font-heading font-bold text-[#111114] text-sm inline-flex items-center gap-2">
                <Bell size={15} /> Notifikasi
              </div>
              <button data-testid="notif-panel-close" onClick={() => setOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F4F4F1]">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto divide-y divide-[#ECECE8]">
              {items.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#6B7280]">Belum ada notifikasi.</div>
              ) : items.map((n) => {
                const m = META[n.type] || META.pengumuman;
                const Icon = m.icon;
                return (
                  <button
                    key={`${n.type}-${n.id}`}
                    data-testid={`notif-item-${n.type}-${n.id}`}
                    onClick={() => { setOpen(false); onNavigate?.(n.target || n.type, n); }}
                    className="w-full text-left px-4 py-3 hover:bg-[#FAFAF8] flex gap-3"
                  >
                    <span className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${m.cls}`}>
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">{m.label}</span>
                      <span className="block font-semibold text-sm text-[#111114] truncate">{n.title}</span>
                      {n.subtitle && <span className="block text-xs text-[#6B7280] line-clamp-2">{n.subtitle}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
