// FASE 15 — Sidebar panel: menu datar berlabel seksi (Peserta / Kegiatan / Laporan & Rekap).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, FileBarChart2, ScrollText,
  ShieldCheck, Menu, X, LogOut, MessagesSquare, Megaphone, UserCog, Layers,
  MonitorSmartphone, CalendarRange, ListPlus, CopyCheck, KeyRound, ScanLine,
  ClipboardList, CalendarCheck, HeartHandshake,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import ProfileMenu from "@/components/ProfileMenu";
import RuangTeduhBell from "@/components/RuangTeduhBell";
import { roleLabel } from "@/lib/roles";
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
import RuangTeduhView from "./RuangTeduhView";
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
  { key: "pengaduan", label: "Ruang Teduh", icon: HeartHandshake, roles: ["admin", "pengurus"] },
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
      className={`w-full flex items-center gap-3 px-3.5 h-11 rounded-xl font-medium text-sm transition-colors ${
        on ? "bg-[#F1F1EE] text-[#111114] font-semibold" : "text-[#6B7280] hover:bg-[#F4F4F1] hover:text-[#111114]"
      }`}
    >
      <Icon size={19} /> {item.label}
    </button>
  );
}

function SidebarInner({ active, onNav, onLogout, role, menu }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 flex items-center gap-2.5 border-b border-[#E8E8E4]">
        <div className="h-9 w-9 rounded-xl bg-[#F1F1EE] flex items-center justify-center overflow-hidden p-1"><img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" /></div>
        <div className="leading-tight">
          <div className="text-[#111114] font-bold font-heading">E-KERTALANGU</div>
          <div className="text-[#9CA3AF] text-xs">{role === "pengurus" ? "Panel Pengurus" : "Panel Adminator"}</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {menu.map((m) => {
          if (!m.items) return <NavButton key={m.key} item={m} active={active} onNav={onNav} />;
          return (
            <div key={m.group} className="pt-5" data-testid={`submenu-${m.group}`}>
              <div className="px-3.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">
                {m.label}
              </div>
              <div className="space-y-1">
                {m.items.map((i) => <NavButton key={i.key} item={i} active={active} onNav={onNav} />)}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-[#E8E8E4]">
        <button
          data-testid="button-logout"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3.5 h-11 rounded-xl text-[#6B7280] hover:bg-[#F4F4F1] hover:text-[#DC2626] font-medium text-sm transition-colors"
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

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[264px] bg-white border-r border-[#E8E8E4] flex-col z-30">
        <SidebarInner active={active} onNav={go} onLogout={doLogout} role={role} menu={menu} />
      </aside>

      {/* Drawer mobile */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="relative w-[264px] bg-white flex flex-col">
            <button onClick={() => setDrawer(false)} className="absolute top-4 right-3 text-[#6B7280] h-8 w-8 flex items-center justify-center">
              <X size={20} />
            </button>
            <SidebarInner active={active} onNav={go} onLogout={doLogout} role={role} menu={menu} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[264px]">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[#E8E8E4]">
          <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                data-testid="button-open-drawer"
                onClick={() => setDrawer(true)}
                className="lg:hidden h-10 w-10 flex items-center justify-center rounded-lg border border-[#E8E8E4] text-[#4B5563]"
              >
                <Menu size={20} />
              </button>
              <Logo size={32} />
            </div>
            <div className="flex items-center gap-2">
              <RuangTeduhBell onOpen={() => go("pengaduan")} active={active} />
              <ProfileMenu subtitle={roleLabel(role)} />
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-8 py-8 sm:py-10 max-w-6xl mx-auto">
          {active === "dashboard" && <DashboardView user={user} onGoto={go} role={role} />}
          {active === "peserta" && <Peserta role={role} />}
          {active === "peserta-bulk" && <PesertaBulkView />}
          {active === "peserta-duplikat" && <PesertaDuplikat />}
          {active === "kegiatan" && <KegiatanView />}
          {active === "kode-akses" && <KodeAksesView />}
          {active === "scan-presensi" && <ScanPresensiView />}
          {active === "musyawarah" && <MusyawarahView />}
          {active === "pengumuman" && <PengumumanView />}
          {active === "pengaduan" && <RuangTeduhView />}
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
    </div>
  );
}
