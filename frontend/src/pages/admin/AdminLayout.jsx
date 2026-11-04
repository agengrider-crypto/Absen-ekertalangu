// Navigasi Admin/Pengurus: sidebar desktop dan menu bottom-sheet di ponsel.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, FileBarChart2, ScrollText,
  ShieldCheck, Menu, X, LogOut, MessagesSquare, Megaphone, UserCog, Layers,
  MonitorSmartphone, CalendarRange, ListPlus, CopyCheck, KeyRound, ScanLine,
  ClipboardList, CalendarCheck, HeartHandshake, LifeBuoy, CalendarClock, QrCode,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import ProfileMenu from "@/components/ProfileMenu";
import { ADMIN_SIDEBAR } from "@/constants/testIds";
import NotificationBell from "@/components/NotificationBell";
import DemoBanner from "@/components/DemoBanner";
import BantuanView from "@/components/BantuanView";
import KalenderView from "./KalenderView";
import { roleLabel } from "@/lib/roles";
import DashboardView from "./DashboardView";
import Peserta from "./Peserta";
import KartuNamaView from "./KartuNamaView";
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
import RekapHarianView from "./RekapHarianView";

const MENU = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "pengurus"] },
  {
    group: "grup-peserta", label: "Peserta", icon: Users, roles: ["admin", "pengurus"],
    items: [
      { key: "peserta", label: "User", icon: UserCog, roles: ["admin", "pengurus"] },
      { key: "kartu-nama", label: "Kartu Nama", icon: QrCode, roles: ["admin", "pengurus"] },
      { key: "peserta-bulk", label: "Bulk Data", icon: ListPlus, roles: ["admin", "pengurus"] },
      { key: "peserta-duplikat", label: "Cek Duplikat", icon: CopyCheck, roles: ["admin", "pengurus"] },
      { key: "kelompok", label: "Kelompok Sambung", icon: Layers, roles: ["admin", "pengurus"] },
    ],
  },
  {
    group: "grup-kegiatan", label: "Kegiatan", icon: CalendarDays, roles: ["admin", "pengurus"],
    items: [
      { key: "kegiatan", label: "Daftar Kegiatan", icon: ClipboardList, roles: ["admin", "pengurus"] },
      { key: "kalender", label: "Kalender Kegiatan", icon: CalendarClock, roles: ["admin", "pengurus"] },
      { key: "kode-akses", label: "Kode Akses", icon: KeyRound, roles: ["admin", "pengurus"] },
      { key: "scan-presensi", label: "Scan Presensi", icon: ScanLine, roles: ["admin", "pengurus"] },
      { key: "pengumuman", label: "Pengumuman", icon: Megaphone, roles: ["admin", "pengurus"] },
    ],
  },
  {
    group: "grup-laporan", label: "Laporan", icon: FileBarChart2, roles: ["admin", "pengurus"],
    items: [
      { key: "laporan", label: "Laporan", icon: FileBarChart2, roles: ["admin", "pengurus"] },
      { key: "rekap-bulanan", label: "Rekap Bulanan", icon: CalendarRange, roles: ["admin", "pengurus"] },
      { key: "rekap-harian", label: "Rekap Harian", icon: CalendarCheck, roles: ["admin", "pengurus"] },
      { key: "musyawarah", label: "Musyawarah", icon: MessagesSquare, roles: ["admin", "pengurus"] },
      { key: "pengaduan", label: "Laporan Masuk", icon: HeartHandshake, roles: ["admin", "pengurus"] },
    ],
  },
  {
    group: "grup-pengaturan", label: "Pengaturan", icon: ShieldCheck, roles: ["admin"],
    items: [
      { key: "bantuan", label: "Bantuan", icon: LifeBuoy, roles: ["admin"] },
      { key: "pantau-login", label: "Aktivitas Login", icon: MonitorSmartphone, roles: ["admin"] },
      { key: "log", label: "Log Aktivitas", icon: ScrollText, roles: ["admin"] },
      { key: "hakakses", label: "Hak Akses", icon: ShieldCheck, roles: ["admin"] },
    ],
  },
  { key: "bantuan", label: "Bantuan", icon: LifeBuoy, roles: ["pengurus"] },
];

function buildMenu(role) {
  return MENU
    .filter((m) => m.roles.includes(role))
    .map((m) => (m.items ? { ...m, items: m.items.filter((i) => i.roles.includes(role)) } : m))
    .filter((m) => !m.items || m.items.length > 0);
}

function NavButton({ item, active, onNav, collapsed, mobile = false }) {
  const Icon = item.icon;
  const on = active === item.key;
  const activeClass = mobile
    ? (on ? "text-[#0D5C3A] font-semibold" : "text-[#4B5563] hover:bg-[#F7F7F5]")
    : (on ? "bg-[#F1F1EE] text-[#111114] font-semibold" : "text-[#6B7280] hover:bg-[#F4F4F1] hover:text-[#111114]");
  return (
    <button
      data-testid={item.key === "kartu-nama" ? ADMIN_SIDEBAR.nameTags : `nav-${item.key}`}
      onClick={() => onNav(item.key)}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      aria-current={on ? "page" : undefined}
      className={`w-full ${
        mobile
          ? "flex min-h-[104px] flex-col items-center justify-start gap-1.5 px-1 py-2 text-center text-xs"
          : `flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-3.5"} h-11 text-sm`
      } rounded-xl font-medium transition-colors ${activeClass}`}
    >
      {mobile ? (
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${on ? "bg-[#0D9B6C] text-white" : "bg-[#F3F4F6] text-[#4B5563]"}`}>
          <Icon size={24} />
        </span>
      ) : <Icon size={19} />}
      {(!collapsed || mobile) && <span className={mobile ? "flex min-h-10 w-full items-start justify-center break-words leading-5" : ""}>{item.label}</span>}
    </button>
  );
}

function SidebarInner({ active, onNav, onLogout, role, menu, collapsed, onToggleCollapse, onClose, mobile = false }) {
  return (
    <div className="flex flex-col h-full">
      {mobile ? (
        <div className="relative shrink-0 border-b border-[#E8E8E4] px-4 pb-4 pt-3">
          <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-[#D1D5DB]" />
          <h2 id="admin-mobile-menu-title" className="text-center text-lg font-bold text-[#111827]">Semua Menu</h2>
          <button
            data-testid={ADMIN_SIDEBAR.closeButton}
            onClick={onClose}
            aria-label="Tutup menu"
            className="absolute right-3 top-5 flex h-10 w-10 items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#F4F4F1]"
          >
            <X size={20} />
          </button>
        </div>
      ) : (
        <div className={`px-3 py-4 flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2.5 border-b border-[#E8E8E4]`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-[#F1F1EE] flex items-center justify-center overflow-hidden p-1">
                <img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" />
              </div>
              <div className="leading-tight">
                <div className="text-[#111114] font-bold font-heading">E-KERTALANGU</div>
                <div className="text-[#9CA3AF] text-xs">{role === "pengurus" ? "Panel Pengurus" : "Panel Adminator"}</div>
              </div>
            </div>
          )}
          <button
            data-testid={ADMIN_SIDEBAR.collapseButton}
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
            title={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
            className="hidden lg:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F4F4F1]"
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
        </div>
      )}
      <nav className={`flex-1 ${mobile ? "px-4" : collapsed ? "px-2" : "px-3"} ${mobile ? "py-4" : "py-3"} overflow-y-auto`}>
        {menu.map((m) => {
          if (!m.items) {
            return (
              <div key={m.key} className={mobile ? "grid grid-cols-4 gap-1" : ""}>
                <NavButton item={m} active={active} onNav={onNav} collapsed={collapsed} mobile={mobile} />
              </div>
            );
          }
          return (
            <div key={m.group} className={mobile ? "pt-5" : "pt-3"} data-testid={`submenu-${m.group}`}>
              {!collapsed && (
                <div className={`pb-2 text-xs font-semibold text-[#9CA3AF] ${mobile ? "px-1 uppercase tracking-wide" : "px-3.5"}`}>
                  {m.label}
                </div>
              )}
              <div className={mobile ? "grid grid-cols-4 gap-x-1 gap-y-2" : "space-y-0.5"}>
                {m.items.map((i) => (
                  <NavButton key={i.key} item={i} active={active} onNav={onNav} collapsed={collapsed} mobile={mobile} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-[#E8E8E4]">
        <button
          data-testid="button-logout"
          onClick={onLogout}
          title={collapsed ? "Keluar" : undefined}
          aria-label="Keluar"
          className={`w-full flex items-center ${mobile ? "gap-3 px-4" : collapsed ? "justify-center px-0" : "gap-3 px-3.5"} h-11 rounded-xl text-[#6B7280] hover:bg-[#F4F4F1] hover:text-[#DC2626] font-medium text-sm transition-colors`}
        >
          <LogOut size={18} /> {!collapsed && "Keluar"}
        </button>
      </div>
    </div>
  );
}

function MobileBottomNav({ active, menuOpen, onNavigate, onOpenMenu }) {
  const sections = {
    dashboard: ["dashboard"],
    peserta: ["peserta", "kartu-nama", "peserta-bulk", "peserta-duplikat", "kelompok"],
    kegiatan: ["kegiatan", "kalender", "kode-akses", "scan-presensi", "pengumuman"],
    laporan: ["laporan", "rekap-bulanan", "rekap-harian", "musyawarah", "pengaduan"],
  };
  const activeSection = Object.keys(sections).find((key) => sections[key].includes(active));
  const items = [
    { key: "dashboard", label: "Beranda", icon: LayoutDashboard, action: () => onNavigate("dashboard") },
    { key: "peserta", label: "Peserta", icon: Users, action: () => onNavigate("peserta") },
    { key: "kegiatan", label: "Kegiatan", icon: CalendarDays, action: () => onNavigate("kegiatan") },
    { key: "laporan", label: "Laporan", icon: FileBarChart2, action: () => onNavigate("laporan") },
    { key: "menu", label: "Menu", icon: Menu, action: onOpenMenu },
  ];

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8E8E4] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(17,17,20,0.06)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === "menu" ? menuOpen || !activeSection : activeSection === item.key;
          return (
            <button
              key={item.key}
              type="button"
              data-testid={ADMIN_SIDEBAR.mobileNav[item.key]}
              onClick={item.action}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              aria-expanded={item.key === "menu" ? menuOpen : undefined}
              aria-controls={item.key === "menu" ? "admin-mobile-menu" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-xs font-medium leading-none transition-colors ${
                isActive ? "text-[#0D5C3A]" : "text-[#6B7280] hover:text-[#111114]"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
              <span className="w-full truncate text-center">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function AdminLayout({ user, role = "admin" }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const menu = buildMenu(role);
  const [active, setActive] = useState("dashboard");
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [addPesertaRequest, setAddPesertaRequest] = useState(0);
  const [addKegiatanRequest, setAddKegiatanRequest] = useState(0);
  const [kegiatanIdToOpen, setKegiatanIdToOpen] = useState(null);

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
      <aside className={`hidden lg:flex fixed inset-y-0 left-0 ${collapsed ? "w-[76px]" : "w-[264px]"} bg-white border-r border-[#E8E8E4] flex-col z-30 transition-[width] duration-200`}>
        <SidebarInner active={active} onNav={go} onLogout={doLogout} role={role} menu={menu} collapsed={collapsed} onToggleCollapse={() => setCollapsed((value) => !value)} />
      </aside>

      {/* Drawer mobile */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end" data-testid="admin-mobile-menu-overlay">
          <button
            type="button"
            data-testid={ADMIN_SIDEBAR.overlayBackdrop}
            aria-label="Tutup menu"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/35 backdrop-blur-[2px]"
          />
          <aside
            id="admin-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Semua Menu"
            aria-labelledby="admin-mobile-menu-title"
            className="relative flex h-[86dvh] max-h-[86dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl"
          >
            <SidebarInner active={active} onNav={go} onLogout={doLogout} role={role} menu={menu} collapsed={false} onToggleCollapse={() => {}} onClose={() => setDrawer(false)} mobile />
          </aside>
        </div>
      )}

      <div className={collapsed ? "lg:pl-[76px]" : "lg:pl-[264px]"}>
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[#E8E8E4]">
          <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size={32} />
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell onNavigate={(target) => {
                const map = {
                  kegiatan: "kegiatan", pengumuman: "pengumuman",
                  musyawarah: "musyawarah", pengaduan: "pengaduan",
                };
                go(map[target] || "dashboard");
              }} />
              <ProfileMenu subtitle={roleLabel(role)} />
            </div>
          </div>
        </header>

        <main className="px-4 pb-24 pt-6 sm:px-8 sm:pb-24 sm:pt-10 lg:py-10 max-w-6xl mx-auto">
          <DemoBanner />
          {active === "dashboard" && (
            <DashboardView
              user={user}
              onGoto={go}
              role={role}
              onAddPeserta={() => {
                setActive("peserta");
                setAddPesertaRequest((request) => request + 1);
              }}
              onAddKegiatan={() => {
                setActive("kegiatan");
                setAddKegiatanRequest((request) => request + 1);
              }}
              onOpenKegiatan={(id) => {
                setKegiatanIdToOpen(id);
                setActive("kegiatan");
              }}
            />
          )}
          {active === "peserta" && (
            <Peserta
              role={role}
              addRequest={addPesertaRequest}
              onAddRequestHandled={() => setAddPesertaRequest(0)}
            />
          )}
          {active === "kartu-nama" && <KartuNamaView />}
          {active === "peserta-bulk" && <PesertaBulkView />}
          {active === "peserta-duplikat" && <PesertaDuplikat />}
          {active === "kegiatan" && (
            <KegiatanView
              addRequest={addKegiatanRequest}
              initialDetailId={kegiatanIdToOpen}
              onAddRequestHandled={() => setAddKegiatanRequest(0)}
              onInitialDetailHandled={() => setKegiatanIdToOpen(null)}
            />
          )}
          {active === "kalender" && <KalenderView />}
          {active === "bantuan" && <BantuanView />}
          {active === "kode-akses" && <KodeAksesView />}
          {active === "scan-presensi" && <ScanPresensiView />}
          {active === "musyawarah" && <MusyawarahView />}
          {active === "pengumuman" && <PengumumanView />}
          {active === "pengaduan" && <RuangTeduhView />}
          {active === "laporan" && <LaporanView />}
          {active === "rekap-bulanan" && <RekapBulananView />}
          {active === "rekap-harian" && <RekapHarianView />}
          {active === "pantau-login" && role === "admin" && <PantauLoginView />}
          {active === "kelompok" && <KelompokView />}
          {active === "log" && role === "admin" && <LogAktivitas />}
          {active === "hakakses" && role === "admin" && <HakAkses currentUserId={user?.id} />}
        </main>
      </div>
      <MobileBottomNav
        active={active}
        menuOpen={drawer}
        onNavigate={go}
        onOpenMenu={() => setDrawer(true)}
      />
    </div>
  );
}
