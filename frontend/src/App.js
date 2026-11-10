import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Activate from "@/pages/Activate";
import RoleDashboard from "@/pages/RoleDashboard";
import RoleArea from "@/pages/RoleArea";
import PublicRekap from "@/pages/PublicRekap";
import PublicRekapGabungan from "@/pages/PublicRekapGabungan";
import PublicRekapBulanan from "@/pages/PublicRekapBulanan";
import PublicRekapHarian from "@/pages/PublicRekapHarian";
import PublicMusyawarah from "@/pages/PublicMusyawarah";
import PublicLaporan from "@/pages/PublicLaporan";
import PublicLaporanPeserta from "@/pages/PublicLaporanPeserta";
import SelfAbsen from "@/pages/SelfAbsen";
import PublicAbsensi from "@/pages/PublicAbsensi";
import PublicHadir from "@/pages/PublicHadir";
import KodeAbsen from "@/pages/KodeAbsen";
import CompleteProfile from "@/pages/CompleteProfile";
import Maintenance from "@/pages/Maintenance";
import SplashScreen from "@/components/SplashScreen";
import InstallPrompt from "@/components/InstallPrompt";
import { useMaintenance } from "@/lib/maintenance";

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
  "/absen",
  "/absensi",
  "/hadir",
  "/absen-kode",
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
      <Route path="/laporan/:token" element={<PublicLaporan />} />
      <Route path="/laporan-peserta/:token" element={<PublicLaporanPeserta />} />
      {/* Absen mandiri: wajib login & fokus 1 peserta (halaman menangani sesinya sendiri) */}
      <Route path="/absen/:token" element={<SelfAbsen />} />
      <Route path="/absensi/:token" element={<PublicAbsensi />} />
      {/* Barcode publik kegiatan terbuka: cukup isi nama, tanpa login */}
      <Route path="/hadir/:token" element={<PublicHadir />} />
      <Route path="/absen-kode" element={<KodeAbsen />} />
      <Route path="/roles" element={<Protected><RoleDashboard /></Protected>} />
      <Route path="/area/:role" element={<Protected><RoleArea /></Protected>} />
      <Route path="/pemeliharaan" element={<Maintenance />} />
      <Route path="/maintenance" element={<Maintenance />} />
      <Route path="*" element={<Navigate to="/roles" replace />} />
    </Routes>
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
