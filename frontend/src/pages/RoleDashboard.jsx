// Pilih Peran — daftar baris sederhana (ikon bulat + nama + keterangan + chevron).
// Hanya peran yang dimiliki akun yang ditampilkan.
import { Navigate, useNavigate } from "react-router-dom";
import { Shield, Users, UserCheck, GraduationCap, LogOut, ChevronRight, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import ProfileMenu from "@/components/ProfileMenu";
import { getActiveRole, setActiveRole } from "@/lib/roles";

const ROLE_ROWS = [
  { key: "admin", icon: Shield, title: "Administrator", desc: "Kelola semua" },
  { key: "guru", icon: GraduationCap, title: "Guru / Pengajar", desc: "Kelas dan pembelajaran" },
  { key: "pengurus", icon: Users, title: "Pengurus", desc: "Absen dan rekap" },
  { key: "peserta", icon: UserCheck, title: "Peserta", desc: "Absen dan riwayat saya" },
];

export default function RoleDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  if (!user) return null;

  const roles = user.roles || [];

  // Akun dengan satu peran langsung masuk areanya.
  if (roles.length === 1) return <Navigate to={`/area/${roles[0]}`} replace />;
  const activeRole = getActiveRole(roles);
  if (activeRole) return <Navigate to={`/area/${activeRole}`} replace />;
  const incomplete = (user.missing_fields || []).length > 0;

  const handleLogout = async () => {
    await logout();
    toast.success("Anda telah keluar");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#F6F4EE]">
      <header className="sticky top-0 z-40 border-b border-[#E7E3D8] bg-[#F6F4EE]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <button
            data-testid="button-account-switcher"
            onClick={handleLogout}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3.5 text-sm font-semibold text-[#5F6B63] transition-colors hover:border-[#14633F] hover:text-[#0E4E31]"
          >
            <RefreshCw size={18} /> Ganti Akun
          </button>
          <ProfileMenu role={roles[0]} />
        </div>
      </header>

      <main className="mx-auto max-w-[560px] px-4 py-8">
        <div className="mb-6 flex justify-center">
          <Logo size={40} />
        </div>
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-[#14201A]">Pilih Peran Anda</h1>
          <p className="mt-1.5 text-sm text-[#5F6B63]">
            Halo <span className="font-semibold text-[#0E4E31]">{user.name}</span>, pilih area yang ingin dibuka.
          </p>
        </div>

        {incomplete && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border-2 border-[#EAD596] bg-[#FBF1D6] p-4" data-testid="role-incomplete-banner">
            <AlertCircle size={20} className="mt-0.5 shrink-0 text-[#6B4500]" />
            <div className="text-sm text-[#6B4500]">
              Data profil Anda belum lengkap: <b>{(user.missing_fields || []).join(", ")}</b>.
              Buka menu <b>Profil Saya</b> di kanan atas untuk melengkapinya.
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white" data-testid="role-list">
          {ROLE_ROWS.filter((r) => roles.includes(r.key)).map((r) => {
            const Icon = r.icon;
            const on = r.key === activeRole;
            return (
              <button
                key={r.key}
                type="button"
                data-testid={`row-role-${r.key}`}
                aria-current={on ? "true" : undefined}
                onClick={() => { setActiveRole(r.key); navigate(`/area/${r.key}`); }}
                className={`flex w-full items-center gap-3 border-b border-[#F0EEE6] px-4 py-3.5 text-left transition-colors last:border-b-0 ${
                  on ? "bg-[#E3F3EA]" : "hover:bg-[#F6F4EE]"
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  on ? "bg-[#14633F] text-white" : "bg-[#E3F3EA] text-[#0E4E31]"
                }`}>
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#14201A]">{r.title}</span>
                  <span className="mt-0.5 block text-xs text-[#5F6B63]">{r.desc}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-[#D9D4C5]" />
              </button>
            );
          })}
        </div>

        {roles.length === 0 && (
          <div className="mt-8 text-center text-[#5F6B63]" data-testid="no-roles">
            Akun Anda belum memiliki peran. Hubungi administrator.
          </div>
        )}

        <div className="mt-10 text-center">
          <button
            data-testid="button-logout"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 font-medium text-[#5F6B63] hover:text-[#0E4E31]"
          >
            <LogOut size={18} /> Keluar
          </button>
        </div>
      </main>
    </div>
  );
}
