import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";

export default function Activate() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/activate", { code, password });
      setUser(data);
      toast.success("Akun berhasil diaktivasi!");
      navigate("/roles");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8 bg-[#FAFBF9]">
      <div className="max-w-md mx-auto">
        <button
          data-testid="button-back-login"
          onClick={() => navigate("/login")}
          className="inline-flex items-center gap-1.5 text-[#4B5563] font-medium mb-6 hover:text-[#0D5C3A]"
        >
          <ArrowLeft size={20} /> Kembali ke Login
        </button>

        <div className="flex justify-center mb-6">
          <Logo size={48} />
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_4px_28px_-6px_rgba(13,92,58,0.14)] border border-[#E5E7EB]">
          <h1 className="font-heading text-2xl font-bold text-[#111827]">Aktivasi Akun</h1>
          <p className="text-[#6B7280] text-base mt-1 mb-6">
            Masukkan kode aktivasi dari QR yang diberikan administrator, lalu buat kata sandi Anda.
          </p>

          <form onSubmit={submit} className="space-y-4" data-testid="activate-form">
            <div>
              <label className="block text-base font-semibold text-[#111827] mb-1.5">Kode Aktivasi</label>
              <input
                data-testid="input-activate-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="cth: AKT-XXXX"
                className="w-full h-[52px] px-4 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A]"
              />
            </div>
            <div>
              <label className="block text-base font-semibold text-[#111827] mb-1.5">Kata Sandi Baru</label>
              <input
                data-testid="input-activate-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full h-[52px] px-4 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A]"
              />
            </div>
            <button
              data-testid="button-activate-submit"
              type="submit"
              disabled={loading}
              className="w-full h-[54px] rounded-xl bg-[#0D5C3A] text-white text-lg font-bold flex items-center justify-center gap-2 hover:bg-[#094229] transition-colors disabled:opacity-60"
            >
              {loading ? <Loader2 className="animate-spin" size={22} /> : <UserCheck size={22} />}
              Aktivasi Sekarang
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
