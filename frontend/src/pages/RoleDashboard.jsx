import { Navigate, useNavigate } from "react-router-dom";
import { Shield, Users, UserCheck, LogOut, ChevronRight, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import ProfileMenu from "@/components/ProfileMenu";
import { rolesLabel } from "@/lib/roles";

const ROLE_META = {
  admin: {
    icon: Shield,
    title: "Adminator",
    description:
      "Kelola pengguna, buat & atur jadwal pengajian, kelola QR code publik, dan lihat laporan presensi lengkap.",
    badge: "Akses Penuh",
    action: "Masuk sebagai Adminator",
    color: "#111114",
    bg: "#F1F1EE",
    text: "#111114",
    border: "#D5D5CE",
  },
  pengurus: {
    icon: Users,
    title: "Pengurus",
    description:
      "Buka sesi presensi pengajian, verifikasi kehadiran peserta, dan pantau rekap kehadiran harian.",
    badge: "Akses Operasional",
    action: "Masuk sebagai Pengurus",
    color: "#4B5563",
    bg: "#F1F1EE",
    text: "#4B5563",
    border: "#D5D5CE",
  },
  peserta: {
    icon: UserCheck,
    title: "Peserta",
    description:
      "Lakukan presensi cepat via QR code, cek jadwal pengajian terkini, dan lihat riwayat kehadiran Anda.",
    badge: "Akses Peserta",
    action: "Masuk sebagai Peserta",
    color: "#111114",
    bg: "#F1F1EE",
    text: "#111114",
    border: "#D5D5CE",
  },
};

export default function RoleDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  if (!user) return null;

  const roles = user.roles || [];

  // FASE 16 — akun dengan satu peran (mis. peserta) langsung masuk areanya.
  if (roles.length === 1) return <Navigate to={`/area/${roles[0]}`} replace />;
  const incomplete = (user.missing_fields || []).length > 0;

  const handleLogout = async () => {
    await logout();
    toast.success("Anda telah keluar");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <header className="sticky top-0 z-40 bg-[#FAFAF8]/90 backdrop-blur-md border-b border-[#E8E8E4]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            data-testid="button-account-switcher"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 h-11 px-3.5 rounded-xl border border-[#E8E8E4] bg-white text-[#4B5563] font-semibold text-sm hover:border-[#111114] hover:text-[#111114] transition-colors"
          >
            <RefreshCw size={18} /> Ganti Akun
          </button>

          {/* Foto profil + menu akun (tersedia di halaman peran juga) */}
          <ProfileMenu subtitle={rolesLabel(roles)} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex justify-center mb-6">
          <Logo size={40} />
        </div>
        <div className="text-center mb-10">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-[#111827]">
            Pilih Peran Anda
          </h1>
          <p className="text-[#4B5563] text-lg mt-2">
            Halo <span className="font-semibold text-[#111114]">{user.name}</span>, pilih area yang ingin Anda buka.
          </p>
        </div>

        {incomplete && (
          <div className="max-w-2xl mx-auto mb-8 rounded-2xl border-2 border-[#FDE68A] bg-[#FFFBEB] p-4 flex items-start gap-3" data-testid="role-incomplete-banner">
            <AlertCircle size={20} className="text-[#92400E] shrink-0 mt-0.5" />
            <div className="text-sm text-[#92400E]">
              Data profil Anda belum lengkap: <b>{(user.missing_fields || []).join(", ")}</b>.
              Silakan buka menu <b>Profil Saya</b> di kanan atas untuk melengkapinya.
            </div>
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {["admin", "pengurus", "peserta"].map((rid) => {
            const meta = ROLE_META[rid];
            const owned = roles.includes(rid);
            if (!owned) return null;
            const Icon = meta.icon;
            return (
              <div
                key={rid}
                data-testid={`card-role-${rid}`}
                className="bg-white rounded-2xl p-6 border border-[#E8E8E4] shadow-[0_4px_20px_-2px_rgba(17,17,24,0.08)] flex flex-col hover:shadow-[0_10px_32px_-6px_rgba(17,17,24,0.18)] hover:-translate-y-1 transition-all duration-200"
              >
                <div
                  className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: meta.bg, color: meta.color }}
                >
                  <Icon size={28} />
                </div>
                <span
                  className="self-start text-xs font-bold px-2.5 py-1 rounded-full mb-3"
                  style={{ backgroundColor: meta.bg, color: meta.text, border: `1px solid ${meta.border}` }}
                >
                  {meta.badge}
                </span>
                <h2 className="font-heading text-xl font-bold text-[#111827] mb-2">{meta.title}</h2>
                <p className="text-[#4B5563] text-base leading-relaxed flex-1">{meta.description}</p>
                <button
                  data-testid={`button-select-role-${rid}`}
                  onClick={() => navigate(`/area/${rid}`)}
                  className="mt-5 w-full h-[52px] rounded-xl text-white text-base font-bold flex items-center justify-center gap-2 transition-colors"
                  style={{ backgroundColor: meta.color }}
                >
                  {meta.action} <ChevronRight size={20} />
                </button>
              </div>
            );
          })}
        </div>

        {roles.length === 0 && (
          <div className="text-center text-[#6B7280] mt-10" data-testid="no-roles">
            Akun Anda belum memiliki peran. Hubungi administrator.
          </div>
        )}

        <div className="text-center mt-12">
          <button
            data-testid="button-logout"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 text-[#6B7280] font-medium hover:text-[#111114]"
          >
            <LogOut size={18} /> Keluar
          </button>
        </div>
      </main>
    </div>
  );
}
