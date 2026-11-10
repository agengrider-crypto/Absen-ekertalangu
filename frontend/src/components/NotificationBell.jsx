// Lonceng notifikasi SEMUA fitur: Ruang Teduh, Kegiatan, Pengumuman,
// Musyawarah, dan Undangan Penting.
// Tampilan sengaja dibuat SIMPLE: satu baris per notifikasi, tanpa ikon
// berwarna dan tanpa label kategori yang panjang.
import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { api } from "@/lib/api";

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
        className="relative h-10 w-10 flex items-center justify-center rounded-xl border border-[#E7E3D8] text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31] transition-colors"
      >
        <Bell size={18} />
        {count > 0 && (
          <span
            data-testid="bell-notifikasi-count"
            className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[#A32A2A] text-white text-[11px] font-bold flex items-center justify-center"
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
            className="absolute right-0 mt-2 w-[min(88vw,320px)] z-50 bg-white rounded-2xl border border-[#E7E3D8] shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-2.5 border-b border-[#E7E3D8] flex items-center justify-between">
              <div className="font-heading font-bold text-[#0E4E31] text-sm">Notifikasi</div>
              <button data-testid="notif-panel-close" onClick={() => setOpen(false)}
                aria-label="Tutup notifikasi"
                className="h-8 w-8 flex items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6]">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#F0EEE6]">
              {items.length === 0 ? (
                <div className="p-6 text-center text-sm text-[#5F6B63]">Belum ada notifikasi.</div>
              ) : items.map((n) => (
                <button
                  key={`${n.type}-${n.id}`}
                  data-testid={`notif-item-${n.type}-${n.id}`}
                  onClick={() => { setOpen(false); onNavigate?.(n.target || n.type, n); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-[#F6F4EE]"
                >
                  <span className="block truncate text-sm font-semibold text-[#0E4E31]">{n.title}</span>
                  {n.subtitle && (
                    <span className="mt-0.5 block truncate text-xs text-[#5F6B63]">{n.subtitle}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
