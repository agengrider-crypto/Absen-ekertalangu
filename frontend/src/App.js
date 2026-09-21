import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import GlobalLoading, { SplashLoading } from "@/components/GlobalLoading";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Activate from "@/pages/Activate";
import RoleDashboard from "@/pages/RoleDashboard";
import RoleArea from "@/pages/RoleArea";
import PublicRekap from "@/pages/PublicRekap";
import PublicRekapGabungan from "@/pages/PublicRekapGabungan";
import PublicRekapBulanan from "@/pages/PublicRekapBulanan";
import PublicMusyawarah from "@/pages/PublicMusyawarah";
import PublicLaporan from "@/pages/PublicLaporan";
import SelfAbsen from "@/pages/SelfAbsen";
import PublicAbsensi from "@/pages/PublicAbsensi";
import PublicHadir from "@/pages/PublicHadir";
import KodeAbsen from "@/pages/KodeAbsen";
import CompleteProfile from "@/pages/CompleteProfile";

function Loading() {
  return <SplashLoading />;
}

/**
 * Protected + gerbang verifikasi akun.
 * Selama data wajib profil belum lengkap, pengguna diarahkan ke /lengkapi-akun.
 */
function Protected({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === null) return <Loading />;
  if (user === false) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  if (user.profile_complete === false) return <Navigate to="/lengkapi-akun" replace />;
  return children;
}

function ProfileGate() {
  const { user } = useAuth();
  if (user === null) return <Loading />;
  if (user === false) return <Navigate to="/login" replace />;
  if (user.profile_complete !== false) return <Navigate to="/roles" replace />;
  return <CompleteProfile />;
}

function PublicOnly({ children }) {
  const { user } = useAuth();
  const [params] = useSearchParams();
  if (user === null) return <Loading />;
  if (user) {
    if (user.profile_complete === false) return <Navigate to="/lengkapi-akun" replace />;
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
      <Route path="/musyawarah/:token" element={<PublicMusyawarah />} />
      <Route path="/laporan/:token" element={<PublicLaporan />} />
      {/* Absen mandiri: wajib login & fokus 1 peserta (halaman menangani sesinya sendiri) */}
      <Route path="/absen/:token" element={<SelfAbsen />} />
      <Route path="/absensi/:token" element={<PublicAbsensi />} />
      {/* Barcode publik kegiatan terbuka: cukup isi nama, tanpa login */}
      <Route path="/hadir/:token" element={<PublicHadir />} />
      <Route path="/absen-kode" element={<KodeAbsen />} />
      <Route path="/roles" element={<Protected><RoleDashboard /></Protected>} />
      <Route path="/area/:role" element={<Protected><RoleArea /></Protected>} />
      <Route path="*" element={<Navigate to="/roles" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <GlobalLoading />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </div>
  );
}

export default App;
