import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, UserPlus, LogIn, KeyRound, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { K1Mark, K1Wordmark } from "@/components/Logo";
import { DateField } from "@/components/DateField";

function fmtWaktu(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Makassar",
    }) + " WITA";
  } catch { return iso; }
}

/**
 * FASE 11 — Notifikasi login berhasil untuk setiap akun:
 * menampilkan perangkat & waktu login sekarang, serta login terakhir sebelumnya.
 * Bila perangkat belum pernah dipakai akun ini, tampil sebagai peringatan.
 */
function showLoginNotice(data) {
  const info = data?.login_info;
  const title = `Selamat datang, ${data?.name || ""}`;
  if (!info) { toast.success(title); return; }
  const dev = info.device?.label || "perangkat ini";
  const lines = [`Login ${fmtWaktu(info.at)} · ${dev}`];
  if (info.first_login) lines.push("Ini login pertama akun Anda.");
  else if (info.previous_at) lines.push(`Login sebelumnya: ${fmtWaktu(info.previous_at)}${info.previous_device ? ` · ${info.previous_device}` : ""}`);
  const description = (
    <span className="whitespace-pre-line" data-testid="login-notice-desc">
      {lines.join("\n")}
      {info.is_new_device ? "\nBukan Anda? Segera ganti kata sandi lewat menu Profil." : ""}
    </span>
  );
  if (info.is_new_device) {
    toast.warning(`${title} — login dari perangkat baru`, { description, duration: 9000 });
  } else {
    toast.success(title, { description, duration: 6000 });
  }
}

/** Peran tunggal → langsung masuk areanya tanpa halaman pilih peran. */
function autoRoleTarget(roles = []) {
  return roles.length === 1 ? `/area/${roles[0]}` : "/roles";
}

export default function Login() {  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { setUser } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  // Tujuan setelah login (mis. dari scan QR absen: /login?next=/absen/<token>)
  const rawNext = params.get("next") || "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { identifier, password });
      setUser(data);
      // FASE 11 — notifikasi login untuk akun ini (perangkat, waktu, login sebelumnya)
      showLoginNotice(data);
      if (data.profile_complete === false || data.must_change_password) {
        toast.warning(`Selamat datang, ${data.name}. Mohon lengkapi data akun Anda dahulu.`);
        navigate("/lengkapi-akun", { replace: true });
        return;
      }
      navigate(next || autoRoleTarget(data.roles), { replace: true });
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-[#F6F4EE]">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center mb-7">
          <K1Mark size={64} variant="light" />
          <div className="mt-3 text-center">
            <K1Wordmark size="text-[26px]" />
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5F6B63]">
              Absensi Digitalisasi Pengajian
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[20px] p-6 sm:p-7 shadow-[0_4px_28px_-6px_rgba(20,32,26,0.14)] border border-[#E7E3D8]">
          <h1 className="font-heading text-[26px] font-bold leading-tight text-[#14201A]">Masuk Akun</h1>
          <p className="text-[#5F6B63] text-[15px] mt-1 mb-6">
            Gunakan Nomor HP, Email, atau Username Anda.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[15px] font-semibold text-[#14201A] mb-1.5">
                Nomor HP / Email / Username
              </label>
              <input
                data-testid="input-login-identifier"
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="cth: 0813xxxx atau nama@email.com"
                className="w-full h-[52px] px-4 rounded-[14px] border border-[#8A948D] text-base outline-none transition-colors focus:border-[#14633F] focus:ring-2 focus:ring-[#14633F]/20 bg-white"
              />
            </div>

            <div>
              <label className="block text-[15px] font-semibold text-[#14201A] mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <input
                  data-testid="input-login-password"
                  type={showPw ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="w-full h-[52px] pl-4 pr-14 rounded-[14px] border border-[#8A948D] text-base outline-none transition-colors focus:border-[#14633F] focus:ring-2 focus:ring-[#14633F]/20 bg-white"
                />
                <button
                  type="button"
                  data-testid="button-password-toggle"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 flex items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6] transition-colors"
                >
                  {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              data-testid="button-login-submit"
              type="submit"
              disabled={loading}
              className="w-full h-[52px] rounded-[14px] bg-[#14633F] text-white text-base font-bold flex items-center justify-center gap-2 hover:bg-[#0E4E31] active:scale-[0.99] transition-all disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <LogIn size={20} />}
              Masuk
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-2 text-center">
            <button
              data-testid="button-forgot-password"
              onClick={() => setShowReset(true)}
              className="text-[#0E4E31] font-semibold text-[15px] underline underline-offset-4 hover:text-[#14633F] inline-flex items-center justify-center gap-1.5"
            >
              Lupa kata sandi?
            </button>
          </div>

          <div className="relative my-5">
            <div className="border-t border-[#E7E3D8]" />
            <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-white px-3 text-sm text-[#5F6B63]">
              atau
            </span>
          </div>

          <div className="grid gap-3">
            <button
              data-testid="button-activate-qr"
              onClick={() => navigate("/activate")}
              className="w-full h-[52px] rounded-[14px] border-2 border-[#E7E3D8] text-[#14201A] text-[15px] font-bold flex items-center justify-center gap-2 hover:border-[#14633F] hover:bg-[#F6F4EE] transition-colors"
            >
              <UserPlus size={20} /> Aktivasi Akun (Cari Nama)
            </button>
          </div>
        </div>

        <p className="text-center text-[13px] text-[#5F6B63] mt-6">
          © 2026 E-KERTALANGU · Absensi Pengajian
        </p>
      </div>

      {showReset && <ResetDialog onClose={() => setShowReset(false)} />}
    </div>
  );
}

function ResetDialog({ onClose }) {
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/self-reset", { phone, dob, new_password: newPassword });
      toast.success(data.message || "Kata sandi diperbarui");
      onClose();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[rgba(20,32,26,0.5)] backdrop-blur-sm flex items-center justify-center p-4" data-testid="reset-dialog">
      <div className="bg-white rounded-2xl p-6 sm:p-7 w-full max-w-md shadow-2xl">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-heading text-xl font-bold text-[#14201A]">Reset Kata Sandi</h2>
          <button onClick={onClose} aria-label="Tutup" className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-[#F0EEE6] text-[#5F6B63]">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-[#5F6B63] mb-1">
          Khusus <span className="font-semibold text-[#0E4E31]">Peserta</span>. Verifikasi dengan tanggal lahir & Nomor HP terdaftar.
        </p>
        <p className="text-xs text-[#5F6B63] mb-5">
          Untuk akun Admin/Pengurus: hubungi administrator.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-base font-semibold text-[#14201A] mb-1.5">Nomor HP Terdaftar</label>
            <input
              data-testid="input-reset-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="cth: 081300000003"
              className="w-full h-[52px] px-4 rounded-xl border border-[#8A948D] text-base outline-none focus:border-[#14633F]"
            />
          </div>
          <div>
            <label className="block text-base font-semibold text-[#14201A] mb-1.5">Tanggal Lahir</label>
            <DateField testid="input-reset-dob" value={dob} onChange={setDob} required />
          </div>
          <div>
            <label className="block text-base font-semibold text-[#14201A] mb-1.5">Kata Sandi Baru</label>
            <input
              data-testid="input-reset-newpassword"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full h-[52px] px-4 rounded-xl border border-[#8A948D] text-base outline-none focus:border-[#14633F]"
            />
          </div>
          <button
            data-testid="button-reset-submit"
            type="submit"
            disabled={loading}
            className="w-full h-[52px] rounded-xl bg-[#14633F] text-white text-lg font-bold flex items-center justify-center gap-2 hover:bg-[#0E4E31] transition-colors disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={22} /> : <KeyRound size={20} />}
            Perbarui Kata Sandi
          </button>
        </form>
      </div>
    </div>
  );
}
