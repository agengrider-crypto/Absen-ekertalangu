import "@/App.css";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import SplashScreen from "@/components/SplashScreen";
import InstallPrompt from "@/components/InstallPrompt";
import { useMaintenance } from "@/lib/maintenance";

// Rute dimuat per halaman (code splitting) agar muat awal ringan.
const Register = lazy(() => import("@/pages/Register"));
const Activate = lazy(() => import("@/pages/Activate"));
const RoleDashboard = lazy(() => import("@/pages/RoleDashboard"));
const RoleArea = lazy(() => import("@/pages/RoleArea"));
const PublicRekap = lazy(() => import("@/pages/PublicRekap"));
const PublicRekapGabungan = lazy(() => import("@/pages/PublicRekapGabungan"));
const PublicRekapBulanan = lazy(() => import("@/pages/PublicRekapBulanan"));
const PublicRekapHarian = lazy(() => import("@/pages/PublicRekapHarian"));
const PublicMusyawarah = lazy(() => import("@/pages/PublicMusyawarah"));
const PublicTugas = lazy(() => import("@/pages/PublicTugas"));
const PublicLaporan = lazy(() => import("@/pages/PublicLaporan"));
const PublicLaporanPeserta = lazy(() => import("@/pages/PublicLaporanPeserta"));
const PublicPendataan = lazy(() => import("@/pages/PublicPendataan"));
const PublicIzin = lazy(() => import("@/pages/PublicIzin"));
const PublicKartu = lazy(() => import("@/pages/PublicKartu"));
const SelfAbsen = lazy(() => import("@/pages/SelfAbsen"));
const PublicAbsensi = lazy(() => import("@/pages/PublicAbsensi"));
const PublicHadir = lazy(() => import("@/pages/PublicHadir"));
const PublicPendaftaran = lazy(() => import("@/pages/PublicPendaftaran"));
const KodeAbsen = lazy(() => import("@/pages/KodeAbsen"));
const CompleteProfile = lazy(() => import("@/pages/CompleteProfile"));
const Maintenance = lazy(() => import("@/pages/Maintenance"));

/** Indikator muat sederhana (token tema, tanpa animasi berat). */
function RouteLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F4EE] px-4" role="status">
      <span className="text-base text-[#5F6B63]">Memuat…</span>
    </main>
  );
}

function CheckingSession() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F4EE] px-4" role="status">
      <span className="text-base text-[#5F6B63]">Memeriksa sesi akun…</span>
    </main>
  );
}

/**
 * Gerbang pemeliharaan (Layar 32).
 * Peserta diarahkan ke /pemeliharaan saat pemeliharaan berlangsung.
 * Admin & Pengurus tetap bisa masuk. Halaman login, /pemeliharaan, dan
 * halaman publik (rekap/laporan/absen) dikecualikan.
 */
const MAINTENANCE_EXEMPT = [
  "/pemeliharaan",
  "/maintenance",
  "/login",
  "/register",
  "/activate",
  "/lengkapi-akun",
  "/rekap",
  "/rekap-gabungan",
  "/rekap-bulanan",
  "/rekap-harian",
  "/musyawarah",
  "/laporan",
  "/laporan-peserta",
  "/data",
  "/izin",
  "/kartu",
  "/absen",
  "/absensi",
  "/hadir",
  "/absen-kode",
  "/daftar",
];

function MaintenanceGate({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const { ongoing } = useMaintenance();

  if (!ongoing) return children;
  if (MAINTENANCE_EXEMPT.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`))) {
    return children;
  }
  const roles = user?.roles || [];
  if (roles.includes("admin") || roles.includes("pengurus")) return children;

  try {
    sessionStorage.setItem(
      "ekertalangu.maintenanceBack",
      `${location.pathname}${location.search}`,
    );
  } catch { /* abaikan */ }

  return <Navigate to="/pemeliharaan" replace />;
}

/**
 * Protected + gerbang verifikasi akun.
 * Selama data wajib profil belum lengkap, pengguna diarahkan ke /lengkapi-akun.
 */
function Protected({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === null) return <CheckingSession />;
  if (user === false) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (user.profile_complete === false || user.must_change_password) return <Navigate to="/lengkapi-akun" replace />;
  return children;
}

function ProfileGate() {
  const { user } = useAuth();
  if (user === null) return <CheckingSession />;
  if (user === false) return <Navigate to="/login" replace />;
  if (user.profile_complete !== false && !user.must_change_password) return <Navigate to="/roles" replace />;
  return <CompleteProfile />;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  if (user === null) return <CheckingSession />;
  if (user) {
    if (user.profile_complete === false || user.must_change_password) return <Navigate to="/lengkapi-akun" replace />;
    // Hormati ?next= (mis. dari halaman absen: /login?next=/absen/<token>)
    const raw = params.get("next") || "";
    const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/roles";
    return <Navigate to={next} replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/register" element={<Register />} />
        <Route path="/activate" element={<Activate />} />
        <Route path="/lengkapi-akun" element={<ProfileGate />} />
        <Route path="/rekap/:token" element={<PublicRekap />} />
        <Route path="/rekap-gabungan/:token" element={<PublicRekapGabungan />} />
        <Route path="/rekap-bulanan/:token" element={<PublicRekapBulanan />} />
        <Route path="/rekap-harian/:token" element={<PublicRekapHarian />} />
        <Route path="/musyawarah/:token" element={<PublicMusyawarah />} />
        <Route path="/tugas/:token" element={<PublicTugas />} />
        <Route path="/laporan/:token" element={<PublicLaporan />} />
        <Route path="/laporan-peserta/:token" element={<PublicLaporanPeserta />} />
        <Route path="/data/:token" element={<PublicPendataan />} />
        <Route path="/izin/:token" element={<PublicIzin />} />
        <Route path="/kartu/:token" element={<PublicKartu />} />
        {/* Absen mandiri: wajib login & fokus 1 peserta (halaman menangani sesinya sendiri) */}
        <Route path="/absen/:token" element={<SelfAbsen />} />
        <Route path="/absensi/:token" element={<PublicAbsensi />} />
        {/* Barcode publik kegiatan terbuka: cukup isi nama, tanpa login */}
        <Route path="/hadir/:token" element={<PublicHadir />} />
        {/* Konfirmasi peserta kegiatan lewat tautan publik WhatsApp: tanpa login */}
        <Route path="/daftar/:token" element={<PublicPendaftaran />} />
        <Route path="/absen-kode" element={<KodeAbsen />} />
        <Route path="/roles" element={<Protected><RoleDashboard /></Protected>} />
        <Route path="/area/:role" element={<Protected><RoleArea /></Protected>} />
        <Route path="/pemeliharaan" element={<Maintenance />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="*" element={<Navigate to="/roles" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <div className="App">
      <SplashScreen />
      <AuthProvider>
        <BrowserRouter>
          <MaintenanceGate>
            <AppRoutes />
          </MaintenanceGate>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </AuthProvider>
      <InstallPrompt />
    </div>
  );
}

export default App;
