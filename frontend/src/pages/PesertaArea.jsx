import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, CalendarDays, QrCode, ScanLine, User, ArrowLeftRight, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import Beranda from "./peserta/Beranda";
import KegiatanList from "./peserta/KegiatanList";
import ScanTab from "./peserta/ScanTab";
import QrSaya from "./peserta/QrSaya";
import ProfilTab from "./peserta/ProfilTab";

const TABS = [
  { key: "beranda", label: "Beranda", icon: Home },
  { key: "kegiatan", label: "Kegiatan", icon: CalendarDays },
  { key: "scan", label: "Scan", icon: ScanLine },
  { key: "qr", label: "QR Saya", icon: QrCode },
  { key: "profil", label: "Profil", icon: User },
];

export default function PesertaArea({ user }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [tab, setTab] = useState("beranda");
  const multiRole = (user?.roles?.length || 0) > 1;

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

      <main className="max-w-lg mx-auto px-4 py-4">
        {tab === "beranda" && <Beranda user={user} onGoto={setTab} />}
        {tab === "kegiatan" && <KegiatanList />}
        {tab === "scan" && <ScanTab />}
        {tab === "qr" && <QrSaya user={user} />}
        {tab === "profil" && <ProfilTab user={user} />}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5E7EB]">
        <div className="max-w-lg mx-auto grid grid-cols-5">
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
