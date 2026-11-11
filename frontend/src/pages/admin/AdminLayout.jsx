// Navigasi Admin/Pengurus: sidebar desktop dan menu bottom-sheet di ponsel.
import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CalendarDays, FileBarChart2, ScrollText,
  ShieldCheck, Menu, X, LogOut, MessagesSquare, Megaphone, UserCog, Layers,
  MonitorSmartphone, CalendarRange, ListPlus, CopyCheck, KeyRound, ScanLine,
  ClipboardList, CalendarCheck, HeartHandshake, LifeBuoy, CalendarClock, QrCode,
  PanelLeftClose, PanelLeftOpen, Wrench,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { K1Mark, K1Wordmark } from "@/components/Logo";
import ProfileMenu from "@/components/ProfileMenu";
import { ADMIN_SIDEBAR } from "@/constants/testIds";
import NotificationBell from "@/components/NotificationBell";
import PageTrail from "@/components/PageTrail";
import UpdateModal from "@/components/UpdateModal";
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
import LaporanPesertaView from "./LaporanPesertaView";
import LogAktivitas from "./LogAktivitas";
import HakAkses from "./HakAkses";
import MusyawarahView from "./MusyawarahView";
import PengumumanView from "./PengumumanView";
import RuangTeduhView from "./RuangTeduhView";
import KelompokView from "./KelompokView";
import PantauLoginView from "./PantauLoginView";
import RekapBulananView from "./RekapBulananView";
import RekapHarianView from "./RekapHarianView";
import MaintenanceSettings from "./MaintenanceSettings";

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
    group: "grup-laporan", label: "Rekap & Laporan", icon: FileBarChart2, roles: ["admin", "pengurus"],
    items: [
      { key: "laporan-peserta", label: "Laporan per Peserta", icon: Users, roles: ["admin", "pengurus"] },
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
      { key: "pemeliharaan", label: "Pemeliharaan", icon: Wrench, roles: ["admin"] },
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

/** Label jejak halaman per menu (Layar: "Jejak halaman di header"). */
const TRAIL_LABEL = {
  dashboard: "Dashboard",
  peserta: "User",
  "kartu-nama": "Kartu Nama",
  "peserta-bulk": "Bulk Data",
  "peserta-duplikat": "Cek Duplikat",
  kelompok: "Kelompok Sambung",
  kegiatan: "Kegiatan",
  kalender: "Kalender Kegiatan",
  "kode-akses": "Kode Akses",
  "scan-presensi": "Scan Presensi",
  pengumuman: "Pengumuman",
  "laporan-peserta": "Laporan per Peserta",
  "rekap-bulanan": "Rekap Bulanan",
  "rekap-harian": "Rekap Harian",
  musyawarah: "Musyawarah",
  pengaduan: "Laporan Masuk",
  bantuan: "Bantuan",
  pemeliharaan: "Pemeliharaan",
  "pantau-login": "Aktivitas Login",
  log: "Log Aktivitas",
  hakakses: "Hak Akses",
};

/** Menu induk untuk jejak tiga tingkat (mis. Kegiatan / Tambah Kegiatan). */
const TRAIL_PARENT = {
  kalender: "kegiatan",
  "kode-akses": "kegiatan",
  "scan-presensi": "kegiatan",
  pengumuman: "kegiatan",
  "kartu-nama": "peserta",
  "peserta-bulk": "peserta",
  "peserta-duplikat": "peserta",
  kelompok: "peserta",
  "rekap-bulanan": "laporan-peserta",
  "rekap-harian": "laporan-peserta",
  musyawarah: "laporan-peserta",
  pengaduan: "laporan-peserta",
};

function NavButton({ item, active, onNav, collapsed, mobile = false }) {
  const Icon = item.icon;
  const on = active === item.key;
  const testId = item.key === "laporan-peserta"
    ? ADMIN_SIDEBAR.participantReport
    : item.key === "kartu-nama" ? ADMIN_SIDEBAR.nameTags : `nav-${item.key}`;
  const activeClass = mobile
    ? (on ? "text-[#0E4E31] font-semibold" : "text-[#5F6B63] hover:bg-[#F6F4EE]")
    : (on ? "bg-[#E3F3EA] text-[#0E4E31] font-semibold" : "text-[#5F6B63] hover:bg-[#F0EEE6] hover:text-[#0E4E31]");
  return (
    <button
      data-testid={testId}
      type="button"
      disabled={item.comingSoon}
      onClick={() => { if (!item.comingSoon) onNav(item.key); }}
      title={collapsed ? `${item.label}${item.comingSoon ? " — Segera hadir" : ""}` : undefined}
      aria-label={`${item.label}${item.comingSoon ? ", segera hadir" : ""}`}
      aria-current={on ? "page" : undefined}
      aria-disabled={item.comingSoon || undefined}
      className={`w-full ${
        mobile
          ? "flex min-h-[104px] flex-col items-center justify-start gap-1.5 px-1 py-2 text-center text-xs"
          : `flex items-center ${collapsed ? "justify-center px-0" : "gap-3 px-3.5"} h-11 text-sm`
      } rounded-xl font-medium transition-colors ${item.comingSoon ? "cursor-not-allowed text-[#5F6B63]" : activeClass}`}
    >
      {mobile ? (
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${on ? "bg-[#14633F] text-white" : "bg-[#F0EEE6] text-[#14201A]"}`}>
          <Icon size={24} />
        </span>
      ) : <Icon size={19} className={on ? "text-[#14633F]" : undefined} />}
      {(!collapsed || mobile) && (
        <span className={mobile ? "flex min-h-10 w-full flex-col items-center justify-start break-words leading-5" : "min-w-0 flex-1 text-left"}>
          <span>{item.label}</span>
          {item.comingSoon && <span className="text-xs font-semibold text-[#5F6B63]">Segera hadir</span>}
        </span>
      )}
    </button>
  );
}

function SidebarInner({ active, onNav, onLogout, role, menu, collapsed, onToggleCollapse, onClose, mobile = false }) {
  return (
    <div className="flex flex-col h-full">
      {mobile ? (
        <div className="relative shrink-0 border-b border-[#E7E3D8] px-4 pb-4 pt-3">
          <div className="mx-auto mb-2 h-1 w-12 rounded-full bg-[#D9D4C5]" />
          <h2 id="admin-mobile-menu-title" className="text-center text-lg font-bold text-[#14201A]">Semua Menu</h2>
          <button
            data-testid={ADMIN_SIDEBAR.closeButton}
            onClick={onClose}
            aria-label="Tutup menu"
            className="absolute right-3 top-5 flex h-10 w-10 items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6]"
          >
            <X size={20} />
          </button>
        </div>
      ) : (
        <div className={`px-3 py-4 flex items-center ${collapsed ? "justify-center" : "justify-between"} gap-2.5 border-b border-[#E7E3D8]`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <K1Mark size={40} variant="light" />
              <div className="leading-tight min-w-0">
                <K1Wordmark size="text-base" />
                <div className="text-[#5F6B63] text-xs">{role === "pengurus" ? "Panel Pengurus" : "Panel Admin"}</div>
              </div>
            </div>
          )}
          <button
            data-testid={ADMIN_SIDEBAR.collapseButton}
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
            title={collapsed ? "Buka sidebar" : "Ciutkan sidebar"}
            className="hidden lg:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6]"
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
                <div className={`pb-2 text-xs font-semibold text-[#5F6B63] ${mobile ? "px-1 uppercase tracking-wide" : "px-3.5"}`}>
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
      <div className="p-3 border-t border-[#E7E3D8]">
        <button
          data-testid="button-logout"
          onClick={onLogout}
          title={collapsed ? "Keluar" : undefined}
          aria-label="Keluar"
          className={`w-full flex items-center ${mobile ? "gap-3 px-4" : collapsed ? "justify-center px-0" : "gap-3 px-3.5"} h-11 rounded-xl text-[#5F6B63] hover:bg-[#F0EEE6] hover:text-[#A32A2A] font-medium text-sm transition-colors`}
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
    rekap: ["laporan-peserta", "rekap-bulanan", "rekap-harian", "musyawarah", "pengaduan"],
  };
  const activeSection = Object.keys(sections).find((key) => sections[key].includes(active));
  const items = [
    { key: "dashboard", label: "Beranda", icon: LayoutDashboard, action: () => onNavigate("dashboard") },
    { key: "peserta", label: "Peserta", icon: Users, action: () => onNavigate("peserta") },
    { key: "kegiatan", label: "Kegiatan", icon: CalendarDays, action: () => onNavigate("kegiatan") },
    { key: "rekap", label: "Rekap", icon: CalendarRange, action: () => onNavigate("rekap-bulanan") },
    { key: "menu", label: "Menu", icon: Menu, action: onOpenMenu },
  ];

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E7E3D8] bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(20,32,26,0.06)] backdrop-blur lg:hidden"
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
                isActive ? "text-[#0E4E31]" : "text-[#5F6B63] hover:text-[#0E4E31]"
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
  const location = useLocation();
  const { logout } = useAuth();
  const menu = buildMenu(role);
  const [active, setActive] = useState(() => {
    const params = new URLSearchParams(location.search);
    if (params.has("laporanPesertaId")) return "laporan-peserta";
    const tab = params.get("tab");
    const valid = menu.flatMap((m) => (m.items ? m.items.map((i) => i.key) : [m.key]));
    return tab && valid.includes(tab) ? tab : "dashboard";
  });
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [addPesertaRequest, setAddPesertaRequest] = useState(0);
  const [addKegiatanRequest, setAddKegiatanRequest] = useState(0);
  const [kegiatanIdToOpen, setKegiatanIdToOpen] = useState(null);
  const [monthlyRecapFilter, setMonthlyRecapFilter] = useState("semua");
  const [kegiatanSubPage, setKegiatanSubPage] = useState(null);
  const leaveGuard = useRef(null);

  const allKeys = menu.flatMap((m) => (m.items ? m.items.map((i) => i.key) : [m.key]));

  // Dukung navigasi dari luar (mis. tombol "Coba Sekarang" di Update Terbaru)
  // lewat query `?tab=<key>`. Setelah dipakai, query dibersihkan agar refresh
  // tidak memaksa kembali ke tab tersebut.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (!tab) return;
    if (allKeys.includes(tab)) setActive(tab);
    params.delete("tab");
    const qs = params.toString();
    navigate(`${location.pathname}${qs ? `?${qs}` : ""}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const go = (key, filter = "semua") => {
    if (!allKeys.includes(key)) return;
    // Cegah keluar dari Kode Akses tanpa konfirmasi tutup absen.
    if (active === "kode-akses" && key !== "kode-akses" && leaveGuard.current) {
      const allowed = leaveGuard.current();
      if (!allowed) {
        leaveGuard.current.proceed = () => {
          leaveGuard.current = null;
          go(key, filter);
        };
        return;
      }
    }
    if (key === "rekap-bulanan") setMonthlyRecapFilter(filter);
    setActive(key);
    setDrawer(false);
  };

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Jejak halaman: "E-Kertalangu / <menu>" atau tiga tingkat saat ada sub-halaman.
  const trailItems = (() => {
    const label = TRAIL_LABEL[active] || "Dashboard";
    const parentKey = TRAIL_PARENT[active];
    const base = parentKey && TRAIL_LABEL[parentKey]
      ? [{ label: TRAIL_LABEL[parentKey], onClick: () => go(parentKey) }, { label }]
      : [{ label }];
    if (active === "kegiatan" && kegiatanSubPage) {
      return [...base, { label: kegiatanSubPage }];
    }
    return base;
  })();

  return (
    <div className="min-h-screen bg-[#F6F4EE]">
      <UpdateModal onNavigate={go} />
      {/* Sidebar desktop */}
      <aside className={`hidden lg:flex fixed inset-y-0 left-0 ${collapsed ? "w-[76px]" : "w-[264px]"} bg-white border-r border-[#E7E3D8] flex-col z-30 transition-[width] duration-200`}>
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
            className="absolute inset-0 bg-[rgba(20,32,26,0.5)] backdrop-blur-[2px]"
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
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-[#E7E3D8]">
          <div className="px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
            <PageTrail items={trailItems} role={role} name={user?.name} />
            <div className="flex shrink-0 items-center gap-2">
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

        <main className="px-4 pb-40 pt-6 sm:px-8 sm:pb-40 sm:pt-10 lg:py-10 max-w-6xl mx-auto">
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
              onSubPageChange={setKegiatanSubPage}
            />
          )}
          {active === "kalender" && <KalenderView />}
          {active === "bantuan" && <BantuanView />}
          {active === "pemeliharaan" && role === "admin" && <MaintenanceSettings />}
          {active === "kode-akses" && <KodeAksesView onLeave={leaveGuard} />}
          {active === "scan-presensi" && <ScanPresensiView />}
          {active === "musyawarah" && <MusyawarahView />}
          {active === "pengumuman" && <PengumumanView />}
          {active === "pengaduan" && <RuangTeduhView />}
          {active === "laporan-peserta" && <LaporanPesertaView />}
          {active === "rekap-bulanan" && <RekapBulananView initialFilter={monthlyRecapFilter} />}
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
