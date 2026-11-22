// Lonceng notifikasi SEMUA fitur: Ruang Teduh, Kegiatan, Pengumuman,
// Musyawarah, dan Undangan Penting.
// Tampilan sengaja dibuat SIMPLE: satu baris per notifikasi, tanpa ikon
// berwarna dan tanpa label kategori yang panjang.
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { api } from "@/lib/api";

// Jeda bertahap setelah gagal: 30s → 60s → 120s → 300s, berhenti setelah 5 kali.
const RETRY_DELAYS = [30000, 60000, 120000, 300000];
const MAX_FAIL = 5;
const NORMAL_DELAY = 45000;

export default function NotificationBell({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const timerRef = useRef(null);
  const failRef = useRef(0);
  const stopRef = useRef(false);

  const schedule = useCallback((delay) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (stopRef.current) return;
    timerRef.current = setTimeout(() => { loadRef.current?.(); }, delay);
  }, []);

  const load = useCallback(() => {
    if (stopRef.current) return;
    // Jangan memanggil saat tab tidak terlihat.
    if (typeof document !== "undefined" && document.hidden) {
      schedule(NORMAL_DELAY);
      return;
    }
    api.get("/notifications", { __noRetry: true })
      .then(({ data }) => {
        setItems(data.items || []);
        setCount(data.count || 0);
        setFailed(false);
        failRef.current = 0;
        schedule(NORMAL_DELAY);
      })
      .catch((err) => {
        // 401: sesi habis — hentikan polling, jangan diulang.
        if (err?.response?.status === 401) {
          stopRef.current = true;
          if (timerRef.current) clearTimeout(timerRef.current);
          setFailed(true);
          setCount(0);
          return;
        }
        setFailed(true);
        setCount(0);
        failRef.current += 1;
        if (failRef.current >= MAX_FAIL) {
          stopRef.current = true;
          return;
        }
        const delay = RETRY_DELAYS[Math.min(failRef.current - 1, RETRY_DELAYS.length - 1)];
        schedule(delay);
      });
  }, [schedule]);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  useEffect(() => {
    load();
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
        title={failed ? "Notifikasi tidak dapat dimuat" : count > 0 ? `${count} notifikasi baru` : "Notifikasi"}
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
