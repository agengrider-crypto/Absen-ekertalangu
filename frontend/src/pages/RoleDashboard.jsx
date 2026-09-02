import { useNavigate } from "react-router-dom";
import { Shield, Users, UserCheck, LogOut, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";

const ROLE_META = {
  admin: {
    icon: Shield,
    title: "Admin (Pengelola Sistem)",
    description:
      "Kelola pengguna, buat & atur jadwal pengajian, kelola QR code publik, dan lihat laporan presensi lengkap.",
    badge: "Akses Penuh",
    action: "Masuk sebagai Admin",
    color: "#D97706",
    bg: "#FEF3C7",
    text: "#92400E",
    border: "#FCD34D",
  },
  pengurus: {
    icon: Users,
    title: "Pengurus (Petugas Sesi)",
    description:
      "Buka sesi presensi pengajian, verifikasi kehadiran jamaah, dan pantau rekap kehadiran harian.",
    badge: "Akses Operasional",
    action: "Masuk sebagai Pengurus",
    color: "#0284C7",
    bg: "#E0F2FE",
    text: "#075985",
    border: "#7DD3FC",
  },
  peserta: {
    icon: UserCheck,
    title: "Peserta / Jamaah",
    description:
      "Lakukan presensi cepat via QR code, cek jadwal pengajian terkini, dan lihat riwayat kehadiran Anda.",
    badge: "Jamaah",
    action: "Masuk sebagai Peserta",
    color: "#0D5C3A",
    bg: "#E8F5EE",
    text: "#065F46",
    border: "#A7F3D0",
  },
};

const AVATARS = {
  male: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?crop=entropy&cs=srgb&fm=jpg&q=85&w=200",
  female: "https://images.unsplash.com/photo-1527203561188-dae1bc1a417f?crop=entropy&cs=srgb&fm=jpg&q=85&w=200",
};

export default function RoleDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  if (!user) return null;

  const roles = user.roles || [];
  const avatar = AVATARS[user.avatar_gender] || AVATARS.male;

  const handleLogout = async () => {
    await logout();
    toast.success("Anda telah keluar");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#FAFBF9]">
      <header className="sticky top-0 z-40 bg-[#FAFBF9]/90 backdrop-blur-md border-b border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            data-testid="button-account-switcher"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 h-11 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[#4B5563] font-semibold text-sm hover:border-[#0D5C3A] hover:text-[#0D5C3A] transition-colors"
          >
            <RefreshCw size={18} /> Ganti Akun
          </button>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div data-testid="text-user-name" className="font-semibold text-[#111827] text-sm leading-tight max-w-[130px] sm:max-w-none truncate">
                {user.name}
              </div>
              <div className="text-xs text-[#6B7280] capitalize truncate max-w-[130px] sm:max-w-none">{roles.join(" · ")}</div>
            </div>
            <img
              data-testid="img-user-avatar"
              src={avatar}
              alt={user.name}
              className="h-11 w-11 rounded-full object-cover border-2 border-[#0D5C3A]"
            />
          </div>
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
            Halo <span className="font-semibold text-[#0D5C3A]">{user.name}</span>, pilih area yang ingin Anda buka.
          </p>
        </div>

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
                className="bg-white rounded-2xl p-6 border border-[#E5E7EB] shadow-[0_4px_20px_-2px_rgba(13,92,58,0.08)] flex flex-col hover:shadow-[0_10px_32px_-6px_rgba(13,92,58,0.18)] hover:-translate-y-1 transition-all duration-200"
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
            className="inline-flex items-center gap-2 text-[#6B7280] font-medium hover:text-[#0D5C3A]"
          >
            <LogOut size={18} /> Keluar
          </button>
        </div>
      </main>
    </div>
  );
}
