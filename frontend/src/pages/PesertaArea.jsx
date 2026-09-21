import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, CalendarDays, QrCode, ScanLine, User, ArrowLeftRight, LogOut, Bell, ShieldCheck, Megaphone, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Beranda from "./peserta/Beranda";
import KegiatanList from "./peserta/KegiatanList";
import ScanTab from "./peserta/ScanTab";
import QrSaya from "./peserta/QrSaya";
import ProfilTab from "./peserta/ProfilTab";
import PenjagaAbsen from "./peserta/PenjagaAbsen";

const BASE_TABS = [
  { key: "beranda", label: "Beranda", icon: Home },
  { key: "kegiatan", label: "Kegiatan", icon: CalendarDays },
  { key: "scan", label: "Scan", icon: ScanLine },
  { key: "qr", label: "QR Saya", icon: QrCode },
  { key: "profil", label: "Profil", icon: User },
];

const PENJAGA_TAB = { key: "penjaga", label: "Penjaga", icon: ShieldCheck };

export default function PesertaArea({ user }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [tab, setTab] = useState("beranda");
  const [updates, setUpdates] = useState([]);
  const [unread, setUnread] = useState(0);
  const [panel, setPanel] = useState(false);
  const multiRole = (user?.roles?.length || 0) > 1;
  const seenKey = `upd_seen_${user?.id || "me"}`;

  // Tab "Penjaga Absen" dinonaktifkan (absensi memakai kode akses kegiatan).
  const TABS = BASE_TABS;

  // FASE 12 — lonceng notifikasi: kegiatan baru + pengumuman baru
  const loadUpdates = () => api.get("/me/updates").then(({ data }) => {
    const items = data.items || [];
    setUpdates(items);
    const seen = localStorage.getItem(seenKey) || "";
    setUnread(items.filter((i) => !seen || i.at > seen).length);
  }).catch(() => {});

  useEffect(() => {
    loadUpdates();
    const t = setInterval(loadUpdates, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, []);

  const openBell = () => {
    setPanel((p) => !p);
    if (updates.length) localStorage.setItem(seenKey, updates[0].at);
    setUnread(0);
  };

  const doLogout = async () => { await logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-[#F5F7F4] pb-20">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-[#0D5C3A] text-white">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center overflow-hidden p-0.5">
              <img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" />
            </div>
            <span className="font-heading font-bold text-sm">E-KERTALANGU</span>
          </div>
          <div className="flex items-center gap-1">
            <button data-testid="peserta-bell" onClick={openBell} className="relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-white/10" title="Notifikasi">
              <Bell size={18} />
              {unread > 0 && (
                <span data-testid="peserta-bell-count" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#0D5C3A]">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            {multiRole && (
              <button data-testid="peserta-switch-role" onClick={() => navigate("/roles")} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-white/10" title="Ganti Peran">
                <ArrowLeftRight size={18} />
              </button>
            )}
            <button data-testid="peserta-logout" onClick={doLogout} className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-white/10" title="Keluar">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* FASE 12 — panel notifikasi peserta */}
      {panel && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setPanel(false)} />
          <div className="sticky top-14 z-40 max-w-lg mx-auto px-4">
            <div className="mt-2 bg-white rounded-2xl border border-[#E5E7EB] shadow-xl overflow-hidden" data-testid="peserta-notif-panel">
              <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                <div className="font-heading font-bold text-[#111827] text-sm inline-flex items-center gap-2"><Bell size={15} className="text-[#0D5C3A]" /> Notifikasi</div>
                <button onClick={() => setPanel(false)} data-testid="peserta-notif-close" className="h-8 w-8 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F2F5F2]"><X size={16} /></button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#F1F2F0]">
                {updates.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[#6B7280]">Belum ada kegiatan atau pengumuman baru.</div>
                ) : updates.map((u) => (
                  <button
                    key={`${u.type}-${u.id}`}
                    data-testid={`peserta-notif-${u.type}-${u.id}`}
                    onClick={() => { setPanel(false); setTab(u.type === "kegiatan" ? "kegiatan" : "beranda"); }}
                    className="w-full text-left px-4 py-3 hover:bg-[#F9FAFB] flex gap-3"
                  >
                    <span className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${u.type === "kegiatan" ? "bg-[#E8F5EE] text-[#0D5C3A]" : "bg-[#FEF3C7] text-[#92400E]"}`}>
                      {u.type === "kegiatan" ? <CalendarDays size={17} /> : <Megaphone size={17} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                        {u.type === "kegiatan" ? "Kegiatan baru" : "Pengumuman"}
                      </span>
                      <span className="block font-semibold text-sm text-[#111827] truncate">{u.title}</span>
                      {u.subtitle && <span className="block text-xs text-[#6B7280] truncate">{u.subtitle}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <main className="max-w-lg mx-auto px-4 py-4">
        {tab === "beranda" && <Beranda user={user} onGoto={setTab} />}
        {tab === "kegiatan" && <KegiatanList />}
        {tab === "scan" && <ScanTab />}
        {tab === "qr" && <QrSaya user={user} />}
        {tab === "profil" && <ProfilTab user={user} />}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB]">
        <div className="max-w-lg mx-auto grid" style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                data-testid={`bottomnav-${t.key}`}
                onClick={() => setTab(t.key)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 ${on ? "text-[#0D5C3A]" : "text-[#9CA3AF]"}`}
              >
                <Icon size={22} strokeWidth={on ? 2.4 : 2} />
                <span className={`text-[11px] ${on ? "font-semibold" : "font-medium"}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
