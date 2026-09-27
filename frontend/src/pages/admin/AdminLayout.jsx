import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, FileBarChart2, ScrollText,
  ShieldCheck, Menu, X, LogOut, ArrowLeftRight, MessagesSquare, Megaphone, UserCog, Layers,
  MonitorSmartphone, CalendarRange, ListPlus, CopyCheck, KeyRound, ScanLine,
  ClipboardList, CalendarCheck, MessageSquareHeart, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import ProfileMenu from "@/components/ProfileMenu";
import RoleSwitcher from "@/components/RoleSwitcher";
import DashboardView from "./DashboardView";
import Peserta from "./Peserta";
import PesertaBulkView from "./PesertaBulkView";
import PesertaDuplikat from "./PesertaDuplikat";
import KegiatanView from "./KegiatanView";
import KodeAksesView from "./KodeAksesView";
import ScanPresensiView from "./ScanPresensiView";
import LaporanView from "./LaporanView";
import LogAktivitas from "./LogAktivitas";
import HakAkses from "./HakAkses";
import MusyawarahView from "./MusyawarahView";
import PengumumanView from "./PengumumanView";
import PengaduanView from "./PengaduanView";
import KelompokView from "./KelompokView";
import PantauLoginView from "./PantauLoginView";
import RekapBulananView from "./RekapBulananView";
import ComingSoon from "./ComingSoon";

const MENU = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "pengurus"] },
  {
    group: "grup-peserta", label: "Peserta", icon: Users, roles: ["admin", "pengurus"],
    items: [
      { key: "peserta", label: "User", icon: UserCog, roles: ["admin", "pengurus"] },
      { key: "peserta-bulk", label: "Bulk Data", icon: ListPlus, roles: ["admin", "pengurus"] },
      { key: "peserta-duplikat", label: "Cek Duplikat", icon: CopyCheck, roles: ["admin", "pengurus"] },
      { key: "pantau-login", label: "Rekap Login", icon: MonitorSmartphone, roles: ["admin"] },
      { key: "kelompok", label: "Kelompok Sambung", icon: Layers, roles: ["admin", "pengurus"] },
    ],
  },
  {
    group: "grup-kegiatan", label: "Kegiatan", icon: CalendarDays, roles: ["admin", "pengurus"],
    items: [
      { key: "kegiatan", label: "Daftar Kegiatan", icon: ClipboardList, roles: ["admin", "pengurus"] },
      { key: "kode-akses", label: "Kode Akses", icon: KeyRound, roles: ["admin", "pengurus"] },
      { key: "scan-presensi", label: "Scan Presensi", icon: ScanLine, roles: ["admin", "pengurus"] },
      { key: "pengumuman", label: "Pengumuman", icon: Megaphone, roles: ["admin", "pengurus"] },
    ],
  },
  {
    group: "grup-laporan", label: "Laporan & Rekap", icon: FileBarChart2, roles: ["admin", "pengurus"],
    items: [
      { key: "laporan", label: "Laporan", icon: FileBarChart2, roles: ["admin", "pengurus"] },
      { key: "rekap-bulanan", label: "Rekap Bulanan", icon: CalendarRange, roles: ["admin", "pengurus"] },
      { key: "rekap-harian", label: "Rekap Harian", icon: CalendarCheck, roles: ["admin", "pengurus"] },
    ],
  },
  { key: "musyawarah", label: "Musyawarah", icon: MessagesSquare, roles: ["admin", "pengurus"] },
  { key: "pengaduan", label: "Pengaduan Jamaah", icon: MessageSquareHeart, roles: ["admin", "pengurus"] },
  { key: "log", label: "Log Aktivitas", icon: ScrollText, roles: ["admin"] },
  { key: "hakakses", label: "Hak Akses", icon: ShieldCheck, roles: ["admin"] },
];

function buildMenu(role) {
  return MENU
    .filter((m) => m.roles.includes(role))
    .map((m) => (m.items ? { ...m, items: m.items.filter((i) => i.roles.includes(role)) } : m))
    .filter((m) => !m.items || m.items.length > 0);
}

function NavButton({ item, active, onNav }) {
  const Icon = item.icon;
  const on = active === item.key;
  return (
    <button
      data-testid={`nav-${item.key}`}
      onClick={() => onNav(item.key)}
      className={`w-full flex items-center gap-3 px-3.5 h-11 rounded-xl font-semibold text-sm transition-colors ${
        on ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={19} /> {item.label}
    </button>
  );
}

function SidebarInner({ active, onNav, onSwitch, onLogout, role, menu }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-white/10">
        <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden p-0.5"><img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" /></div>
        <div className="leading-tight">
          <div className="text-white font-bold font-heading">E-KERTALANGU</div>
          <div className="text-white/60 text-xs">{role === "pengurus" ? "Panel Pengurus" : "Panel Admin"}</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menu.map((m) => {
          if (!m.items) return <NavButton key={m.key} item={m} active={active} onNav={onNav} />;
          return (
            <div key={m.group} className="pt-3" data-testid={`submenu-${m.group}`}>
              <div className="px-3.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-white/40">
                {m.label}
              </div>
              <div className="space-y-1">
                {m.items.map((i) => <NavButton key={i.key} item={i} active={active} onNav={onNav} />)}
              </div>
            </div>
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

export default function AdminLayout({ user, role = "admin" }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const menu = buildMenu(role);
  const [active, setActive] = useState("dashboard");
  const [drawer, setDrawer] = useState(false);
  const [switcher, setSwitcher] = useState(false);

  const allKeys = menu.flatMap((m) => (m.items ? m.items.map((i) => i.key) : [m.key]));

  const go = (key) => {
    if (!allKeys.includes(key)) return;
    setActive(key);
    setDrawer(false);
  };

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  const openSwitcher = () => { setDrawer(false); setSwitcher(true); };

  return (
    <div className="min-h-screen bg-[#F5F7F4]">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-[#0D5C3A] flex-col z-30">
        <SidebarInner active={active} onNav={go} onSwitch={openSwitcher} onLogout={doLogout} role={role} menu={menu} />
      </aside>

      {/* Drawer mobile */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="relative w-64 bg-[#0D5C3A] flex flex-col">
            <button onClick={() => setDrawer(false)} className="absolute top-4 right-3 text-white/80 h-8 w-8 flex items-center justify-center">
              <X size={20} />
            </button>
            <SidebarInner active={active} onNav={go} onSwitch={openSwitcher} onLogout={doLogout} role={role} menu={menu} />
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
            <div className="flex items-center gap-2">
              <ProfileMenu subtitle={role === "pengurus" ? "Pengurus" : "Administrator"} />
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">
          {active === "dashboard" && <DashboardView user={user} onGoto={go} role={role} />}
          {active === "peserta" && <Peserta role={role} />}
          {active === "peserta-bulk" && <PesertaBulkView />}
          {active === "peserta-duplikat" && <PesertaDuplikat />}
          {active === "kegiatan" && <KegiatanView />}
          {active === "kode-akses" && <KodeAksesView />}
          {active === "scan-presensi" && <ScanPresensiView />}
          {active === "musyawarah" && <MusyawarahView />}
          {active === "pengumuman" && <PengumumanView />}
          {active === "pengaduan" && <PengaduanView />}
          {active === "laporan" && <LaporanView />}
          {active === "rekap-bulanan" && <RekapBulananView />}
          {active === "rekap-harian" && (
            <ComingSoon
              title="Rekap Harian"
              message="Rekap kehadiran per hari (semua sesi dalam satu tanggal, lengkap dengan persentase per sesi) sedang kami siapkan. Sementara ini gunakan Rekap Gabungan 1 Hari pada menu Daftar Kegiatan."
            />
          )}
          {active === "pantau-login" && role === "admin" && <PantauLoginView />}
          {active === "kelompok" && <KelompokView />}
          {active === "log" && role === "admin" && <LogAktivitas />}
          {active === "hakakses" && role === "admin" && <HakAkses currentUserId={user?.id} />}
        </main>
      </div>

      {switcher && <RoleSwitcher current={role} onClose={() => setSwitcher(false)} />}
    </div>
  );
}
