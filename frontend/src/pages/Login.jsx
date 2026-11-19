import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { K1Mark, K1Wordmark } from "@/components/Logo";
import Modal from "@/components/Modal";

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
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState("");

  // Tujuan setelah login (mis. dari scan QR absen: /login?next=/absen/<token>)
  const rawNext = params.get("next") || "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
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
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  // "Lupa kata sandi?" — reset ke tanggal lahir (DDMMYY) dengan konfirmasi.
  const mintaReset = () => {
    setResetMsg("");
    if (!identifier.trim()) {
      setError("Isi nama di kolom atas dulu, lalu ketuk Lupa kata sandi.");
      return;
    }
    setError("");
    setResetOpen(true);
  };

  const jalankanReset = async () => {
    setResetBusy(true);
    try {
      const { data } = await api.post("/auth/reset-dob", { identifier });
      setResetMsg(data?.message || "");
      setPassword("");
    } catch (err) {
      setResetMsg(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setResetBusy(false);
      setResetOpen(false);
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

        <div className="bg-white rounded-[20px] p-6 sm:p-7 border border-[#E7E3D8]">
          <h1 className="font-heading text-[26px] font-bold leading-tight text-[#14201A]">Masuk akun</h1>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="block text-[15px] font-semibold text-[#14201A] mb-1.5">
                Nomor HP, email, username, atau nama
              </label>
              <input
                data-testid="input-login-identifier"
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => { setIdentifier(e.target.value); setError(""); }}
                placeholder="cth: 0813xxxx atau nama"
                className="w-full h-[52px] px-4 rounded-[14px] border border-[#8A948D] text-base outline-none transition-colors focus:border-[#14633F] focus:ring-2 focus:ring-[#14633F]/20 bg-white"
              />
            </div>

            <div>
              <label className="block text-[15px] font-semibold text-[#14201A] mb-1.5">
                Kata sandi
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

            {error && (
              <p data-testid="login-error" role="alert" className="text-[13px] font-semibold text-[#A32A2A]">
                {error}
              </p>
            )}

            <button
              data-testid="button-login-submit"
              type="submit"
              disabled={loading}
              className="w-full h-[52px] rounded-[14px] bg-[#14633F] text-white text-base font-bold flex items-center justify-center gap-2 hover:bg-[#0E4E31] transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin motion-reduce:animate-none" size={20} /> : <LogIn size={20} />}
              Masuk
            </button>
          </form>

          <div className="mt-4">
            <button
              data-testid="button-forgot-password"
              type="button"
              onClick={mintaReset}
              className="text-[13px] font-semibold text-[#0E4E31] underline underline-offset-4 hover:text-[#14633F]"
            >
              Lupa kata sandi? Reset ke tanggal lahir (DDMMYY)
            </button>
            {resetMsg && (
              <p data-testid="reset-result"
                className="mt-2 rounded-xl bg-[#E3F3EA] px-3 py-2 text-[12px] leading-relaxed text-[#0E4E31]">
                {resetMsg}
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-[13px] text-[#5F6B63] mt-6">
          © 2026 E-KERTALANGU · Absensi Pengajian
        </p>
      </div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset kata sandi?"
        testid="reset-dob-dialog"
        maxWidth={440}
        footer={(
          <div className="flex gap-2">
            <button type="button" data-testid="reset-dob-cancel" onClick={() => setResetOpen(false)}
              className="h-12 flex-1 rounded-2xl bg-[#F0EEE6] font-semibold text-[#5F6B63] hover:bg-[#E7E3D8]">
              Batal
            </button>
            <button type="button" data-testid="reset-dob-confirm" onClick={jalankanReset} disabled={resetBusy}
              className="h-12 flex-1 rounded-2xl bg-[#14633F] font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60">
              {resetBusy ? <Loader2 size={16} className="mx-auto animate-spin motion-reduce:animate-none" /> : "Ya, reset"}
            </button>
          </div>
        )}
      >
        <p className="p-4 text-sm text-[#14201A]">
          Kata sandi akun ini akan diganti dengan tanggal lahir (DDMMYY). Lanjutkan?
        </p>
      </Modal>
    </div>
  );
}
