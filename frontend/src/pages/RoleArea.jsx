import { useNavigate, useParams, Navigate } from "react-router-dom";
import { ArrowLeft, Shield, Users, UserCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ProfileMenu from "@/components/ProfileMenu";
import AdminLayout from "@/pages/admin/AdminLayout";
import PesertaArea from "@/pages/PesertaArea";

const META = {
  admin: { icon: Shield, title: "Area Admin", color: "#D97706" },
  pengurus: { icon: Users, title: "Area Pengurus", color: "#0284C7" },
  peserta: { icon: UserCheck, title: "Area Peserta", color: "#0D5C3A" },
};

export default function RoleArea() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) return null;
  if (!user.roles?.includes(role)) {
    return <Navigate to="/roles" replace />;
  }

  // Admin & Pengurus: full-screen panel with sidebar navigation
  if (role === "admin" || role === "pengurus") {
    return <AdminLayout user={user} role={role} />;
  }

  // Peserta: mobile-first area with bottom navigation
  if (role === "peserta") {
    return <PesertaArea user={user} />;
  }

  const meta = META[role] || META.peserta;
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-[#FAFBF9]">
      <header className="sticky top-0 z-40 bg-[#FAFBF9]/90 backdrop-blur-md border-b border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            data-testid="button-back-roles"
            onClick={() => navigate("/roles")}
            className="inline-flex items-center gap-2 h-11 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[#4B5563] font-semibold text-sm hover:border-[#0D5C3A] hover:text-[#0D5C3A] transition-colors"
          >
            <ArrowLeft size={18} /> Pilih Peran
          </button>
          <ProfileMenu subtitle={meta.title} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}>
            <Icon size={26} />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-[#111827]">{meta.title}</h1>
            <p className="text-[#6B7280] text-sm">Masuk sebagai {user.name}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-[#E5E7EB] text-center" data-testid="area-placeholder">
          <div className="inline-flex items-center gap-2 bg-[#E8F5EE] text-[#065F46] px-3 py-1 rounded-full text-sm font-semibold mb-4">
            Segera Hadir
          </div>
          <p className="text-[#4B5563] text-lg max-w-xl mx-auto">
            {role === "pengurus"
              ? "Fitur buka sesi presensi, verifikasi kehadiran, dan rekap harian akan hadir pada fase berikutnya."
              : "Fitur presensi via QR, jadwal pengajian, dan riwayat kehadiran akan hadir pada fase berikutnya."}
          </p>
        </div>
      </main>
    </div>
  );
}
