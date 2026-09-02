import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, Shield, Users, UserCheck, Trash2, QrCode, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";

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
          <Logo size={36} showText={false} />
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

        {role === "admin" ? (
          <AdminPanel />
        ) : (
          <Placeholder role={role} />
        )}
      </main>
    </div>
  );
}

function Placeholder({ role }) {
  const msg =
    role === "pengurus"
      ? "Fitur buka sesi presensi, verifikasi kehadiran, dan rekap harian akan hadir pada fase berikutnya."
      : "Fitur presensi via QR, jadwal pengajian, dan riwayat kehadiran akan hadir pada fase berikutnya.";
  return (
    <div className="bg-white rounded-2xl p-8 border border-[#E5E7EB] text-center" data-testid="area-placeholder">
      <div className="inline-flex items-center gap-2 bg-[#E8F5EE] text-[#065F46] px-3 py-1 rounded-full text-sm font-semibold mb-4">
        Segera Hadir
      </div>
      <p className="text-[#4B5563] text-lg max-w-xl mx-auto">{msg}</p>
    </div>
  );
}

function AdminPanel() {
  const [users, setUsers] = useState(null);
  const [qr, setQr] = useState(null);

  const load = () => api.get("/admin/users").then(({ data }) => setUsers(data)).catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));

  useEffect(() => {
    load();
    api.get("/qr/public").then(({ data }) => setQr(data)).catch(() => {});
  }, []);

  const remove = async (id, name) => {
    if (!window.confirm(`Hapus akun "${name}"?`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success("Pengguna dihapus");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const copyLink = () => {
    if (qr?.link) {
      navigator.clipboard.writeText(qr.link);
      toast.success("Link pendaftaran disalin");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] text-center" data-testid="admin-qr-panel">
          <div className="inline-flex items-center gap-2 text-[#065F46] font-semibold mb-3">
            <QrCode size={18} /> QR Pendaftaran Publik
          </div>
          {qr ? (
            <img src={qr.image} alt="QR Publik" className="mx-auto w-44 h-44 rounded-xl border border-[#E5E7EB] p-2" data-testid="admin-qr-image" />
          ) : (
            <div className="mx-auto w-44 h-44 rounded-xl bg-[#F2F5F2] flex items-center justify-center">
              <Loader2 className="animate-spin text-[#0D5C3A]" size={28} />
            </div>
          )}
          <button
            data-testid="button-copy-qr-link"
            onClick={copyLink}
            className="mt-4 w-full h-11 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#E8F5EE]"
          >
            <Copy size={16} /> Salin Link Daftar
          </button>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden" data-testid="admin-users-panel">
          <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <h2 className="font-heading font-bold text-[#111827] text-lg">Daftar Pengguna</h2>
            <span className="text-sm text-[#6B7280]">{users ? `${users.length} akun` : ""}</span>
          </div>
          {!users ? (
            <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={28} /></div>
          ) : (
            <ul className="divide-y divide-[#E5E7EB]">
              {users.map((u) => (
                <li key={u.id} data-testid={`user-row-${u.id}`} className="px-6 py-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#111827] truncate">{u.name}</div>
                    <div className="text-sm text-[#6B7280] truncate">{u.phone} · {u.email}</div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {u.roles.map((r) => (
                        <span key={r} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#065F46] capitalize">{r}</span>
                      ))}
                      {u.source === "qr_public" && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">via QR</span>
                      )}
                    </div>
                  </div>
                  <button
                    data-testid={`button-delete-user-${u.id}`}
                    onClick={() => remove(u.id, u.name)}
                    className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg text-[#DC2626] hover:bg-red-50"
                    aria-label="Hapus pengguna"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
