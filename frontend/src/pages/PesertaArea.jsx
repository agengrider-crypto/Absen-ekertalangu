import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, CalendarDays, QrCode, ScanLine, User, ArrowLeftRight, LogOut, Bell, ShieldCheck, Megaphone, X, HeartHandshake, LifeBuoy, MailWarning, MessagesSquare } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import RoleSwitcher from "@/components/RoleSwitcher";
import BantuanView from "@/components/BantuanView";
import DemoBanner from "@/components/DemoBanner";
import UndanganSaya from "./peserta/UndanganSaya";
import Beranda from "./peserta/Beranda";
import KegiatanList from "./peserta/KegiatanList";
import ScanTab from "./peserta/ScanTab";
import QrSaya from "./peserta/QrSaya";
import ProfilTab from "./peserta/ProfilTab";
import RuangTeduh from "./peserta/RuangTeduh";
import PenjagaAbsen from "./peserta/PenjagaAbsen";
import { K1Mark } from "@/components/Logo";

const BASE_TABS = [
  { key: "beranda", label: "Beranda", icon: Home },
  { key: "kegiatan", label: "Kegiatan", icon: CalendarDays },
  { key: "scan", label: "Scan", icon: ScanLine },
  { key: "qr", label: "QR Saya", icon: QrCode },
  { key: "curhat", label: "Ruang Teduh", icon: HeartHandshake },
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
  const [switcher, setSwitcher] = useState(false);
  const multiRole = (user?.roles?.length || 0) > 1;

  // Tab "Penjaga Absen" dinonaktifkan (absensi memakai kode akses kegiatan).
  const TABS = BASE_TABS;

  // FASE 18 — lonceng notifikasi: semua fitur (kegiatan, pengumuman, undangan penting)
  const loadUpdates = () => api.get("/notifications").then(({ data }) => {
    setUpdates(data.items || []);
    setUnread(data.count || 0);
  }).catch(() => {});

  useEffect(() => {
    loadUpdates();
    const t = setInterval(loadUpdates, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, []);

  const openBell = async () => {
    const next = !panel;
    setPanel(next);
    if (next && unread > 0) {
      setUnread(0);
      try { await api.post("/notifications/read"); } catch { /* abaikan */ }
    }
  };

  const doLogout = async () => { await logout(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-[#F6F4EE] pb-20">
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-white text-[#0E4E31] border-b border-[#E7E3D8]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[#E3F3EA] flex items-center justify-center overflow-hidden p-0.5">
              <K1Mark size={32} variant="light" />
            </div>
            <span className="font-heading font-bold text-sm">E-KERTALANGU</span>
          </div>
          <div className="flex items-center gap-1">
            <button data-testid="peserta-bantuan" onClick={() => setTab("bantuan")}
              className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors ${tab === "bantuan" ? "bg-[#E3F3EA] text-[#0E4E31]" : "text-[#5F6B63] hover:bg-[#E3F3EA] hover:text-[#0E4E31]"}`}
              title="Bantuan">
              <LifeBuoy size={18} />
            </button>
            <button data-testid="peserta-bell" onClick={openBell} className="relative h-9 w-9 flex items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#E3F3EA] hover:text-[#0E4E31] transition-colors" title="Notifikasi">
              <Bell size={18} />
              {unread > 0 && (
                <span data-testid="peserta-bell-count" className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#14633F] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
            {multiRole && (
              <button data-testid="peserta-switch-role" onClick={() => setSwitcher(true)} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#E3F3EA] hover:text-[#0E4E31] transition-colors" title="Ganti Peran">
                <ArrowLeftRight size={18} />
              </button>
            )}
            <button data-testid="peserta-logout" onClick={doLogout} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#E3F3EA] hover:text-[#A32A2A] transition-colors" title="Keluar">
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
            <div className="mt-2 bg-white rounded-2xl border border-[#E7E3D8] shadow-xl overflow-hidden" data-testid="peserta-notif-panel">
              <div className="px-4 py-3 border-b border-[#E7E3D8] flex items-center justify-between">
                <div className="font-heading font-bold text-[#0E4E31] text-sm inline-flex items-center gap-2"><Bell size={15} className="text-[#0E4E31]" /> Notifikasi</div>
                <button onClick={() => setPanel(false)} data-testid="peserta-notif-close" className="h-8 w-8 flex items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6]"><X size={16} /></button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-[#E7E3D8]">
                {updates.length === 0 ? (
                  <div className="p-6 text-center text-sm text-[#5F6B63]">Belum ada notifikasi baru.</div>
                ) : updates.map((u) => {
                  const meta = u.type === "kegiatan"
                    ? { Icon: CalendarDays, label: "Kegiatan baru", cls: "bg-[#E3F3EA] text-[#0E4E31]", tab: "kegiatan" }
                    : u.type === "undangan"
                      ? { Icon: MailWarning, label: "Undangan penting", cls: "bg-[#FBE5E3] text-[#A32A2A]", tab: "beranda" }
                      : u.type === "musyawarah"
                        ? { Icon: MessagesSquare, label: "Musyawarah", cls: "bg-[#D9F2F4] text-[#1D4F91]", tab: "beranda" }
                        : { Icon: Megaphone, label: "Pengumuman", cls: "bg-[#FBF1D6] text-[#6B4500]", tab: "beranda" };
                  const Icon = meta.Icon;
                  return (
                    <button
                      key={`${u.type}-${u.id}`}
                      data-testid={`peserta-notif-${u.type}-${u.id}`}
                      onClick={() => { setPanel(false); setTab(meta.tab); }}
                      className="w-full text-left px-4 py-3 hover:bg-[#F6F4EE] flex gap-3"
                    >
                      <span className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${meta.cls}`}>
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11px] font-bold uppercase tracking-wide text-[#5F6B63]">{meta.label}</span>
                        <span className="block font-semibold text-sm text-[#0E4E31] truncate">{u.title}</span>
                        {u.subtitle && <span className="block text-xs text-[#5F6B63] truncate">{u.subtitle}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      <main className="max-w-lg mx-auto px-4 py-4">
        <DemoBanner />
        {tab === "beranda" && <><UndanganSaya /><Beranda user={user} onGoto={setTab} /></>}
        {tab === "kegiatan" && <KegiatanList />}
        {tab === "scan" && <ScanTab />}
        {tab === "qr" && <QrSaya user={user} />}
        {tab === "curhat" && <RuangTeduh />}
        {tab === "bantuan" && <BantuanView />}
        {tab === "profil" && <ProfilTab user={user} />}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E7E3D8]">
        <div className="max-w-lg mx-auto grid" style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0, 1fr))` }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                data-testid={`bottomnav-${t.key}`}
                onClick={() => setTab(t.key)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 ${on ? "text-[#0E4E31]" : "text-[#5F6B63]"}`}
              >
                <Icon size={22} strokeWidth={on ? 2.4 : 2} />
                <span className={`text-[11px] ${on ? "font-semibold" : "font-medium"}`}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {switcher && <RoleSwitcher current="peserta" onClose={() => setSwitcher(false)} />}
    </div>
  );
}
