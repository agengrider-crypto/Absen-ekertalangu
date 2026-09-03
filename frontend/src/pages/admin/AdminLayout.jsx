import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, FileBarChart2, ScrollText,
  ShieldCheck, Menu, X, LogOut, ArrowLeftRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import DashboardView from "./DashboardView";
import Peserta from "./Peserta";
import KegiatanView from "./KegiatanView";
import LaporanView from "./LaporanView";
import LogAktivitas from "./LogAktivitas";
import HakAkses from "./HakAkses";

const MENU = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "peserta", label: "Peserta", icon: Users },
  { key: "kegiatan", label: "Kegiatan", icon: CalendarDays },
  { key: "laporan", label: "Laporan", icon: FileBarChart2 },
  { key: "log", label: "Log Aktivitas", icon: ScrollText },
  { key: "hakakses", label: "Hak Akses", icon: ShieldCheck },
];

function SidebarInner({ active, onNav, onSwitch, onLogout }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
        <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center text-white font-bold">EK</div>
        <div className="leading-tight">
          <div className="text-white font-bold font-heading">E-KERTALANGU</div>
          <div className="text-white/60 text-xs">Panel Admin</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {MENU.map((m) => {
          const Icon = m.icon;
          const on = active === m.key;
          return (
            <button
              key={m.key}
              data-testid={`nav-${m.key}`}
              onClick={() => onNav(m.key)}
              className={`w-full flex items-center gap-3 px-3.5 h-11 rounded-xl font-semibold text-sm transition-colors ${
                on ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={19} /> {m.label}
            </button>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10 space-y-1">
        <button
          data-testid="button-switch-role"
          onClick={onSwitch}
          className="w-full flex items-center gap-3 px-3.5 h-11 rounded-xl text-white/70 hover:bg-white/10 hover:text-white font-semibold text-sm"
        >
          <ArrowLeftRight size={18} /> Ganti Peran
        </button>
        <button
          data-testid="button-logout"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3.5 h-11 rounded-xl text-white/70 hover:bg-white/10 hover:text-white font-semibold text-sm"
        >
          <LogOut size={18} /> Keluar
        </button>
      </div>
    </div>
  );
}

export default function AdminLayout({ user }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [active, setActive] = useState("dashboard");
  const [drawer, setDrawer] = useState(false);

  const go = (key) => {
    setActive(key);
    setDrawer(false);
  };

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = (user?.name || "A").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-[#F5F7F4]">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-[#0D5C3A] flex-col z-30">
        <SidebarInner active={active} onNav={go} onSwitch={() => navigate("/roles")} onLogout={doLogout} />
      </aside>

      {/* Drawer mobile */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="relative w-64 bg-[#0D5C3A] flex flex-col">
            <button onClick={() => setDrawer(false)} className="absolute top-4 right-3 text-white/80 h-8 w-8 flex items-center justify-center">
              <X size={20} />
            </button>
            <SidebarInner active={active} onNav={go} onSwitch={() => navigate("/roles")} onLogout={doLogout} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[#E5E7EB]">
          <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                data-testid="button-open-drawer"
                onClick={() => setDrawer(true)}
                className="lg:hidden h-10 w-10 flex items-center justify-center rounded-lg border border-[#E5E7EB] text-[#4B5563]"
              >
                <Menu size={20} />
              </button>
              <Logo size={32} />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block leading-tight">
                <div className="font-semibold text-[#111827] text-sm">{user?.name}</div>
                <div className="text-xs text-[#6B7280]">Administrator</div>
              </div>
              <div className="h-10 w-10 rounded-full bg-[#0D5C3A] text-white flex items-center justify-center font-bold text-sm">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">
          {active === "dashboard" && <DashboardView user={user} onGoto={go} />}
          {active === "peserta" && <Peserta />}
          {active === "kegiatan" && <KegiatanView />}
          {active === "laporan" && <LaporanView />}
          {active === "log" && <LogAktivitas />}
          {active === "hakakses" && <HakAkses currentUserId={user?.id} />}
        </main>
      </div>
    </div>
  );
}
