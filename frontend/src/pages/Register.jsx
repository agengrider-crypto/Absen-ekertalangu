import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { QrCode, ArrowLeft, Loader2, UserPlus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import { DateField } from "@/components/DateField";

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [params] = useSearchParams();
  const tokenFromUrl = params.get("token");

  const [qr, setQr] = useState(null);
  const [token, setToken] = useState(tokenFromUrl || "");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", dob: "", address: "", password: "", avatar_gender: "male",
  });

  useEffect(() => {
    if (!tokenFromUrl) {
      api.get("/qr/public").then(({ data }) => {
        setQr(data);
        setToken(data.token);
      }).catch(() => toast.error("Gagal memuat QR pendaftaran"));
    }
  }, [tokenFromUrl]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", { ...form, token });
      setUser(data);
      toast.success("Pendaftaran berhasil! Akun Peserta aktif.");
      navigate("/roles");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const showForm = !!tokenFromUrl;

  return (
    <div className="min-h-screen px-4 py-8 bg-[#F6F4EE]">
      <div className="max-w-md mx-auto">
        <button
          data-testid="button-back-login"
          onClick={() => navigate("/login")}
          className="inline-flex items-center gap-1.5 text-[#5F6B63] font-medium mb-6 hover:text-[#0E4E31]"
        >
          <ArrowLeft size={20} /> Kembali ke Login
        </button>

        <div className="flex justify-center mb-6">
          <Logo size={48} />
        </div>

        {!showForm ? (
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_4px_28px_-6px_rgba(20,32,26,0.14)] border border-[#E7E3D8] text-center" data-testid="qr-panel">
            <div className="inline-flex items-center gap-2 bg-[#E3F3EA] text-[#0E4E31] px-3 py-1 rounded-full text-sm font-semibold mb-4">
              <QrCode size={16} /> QR Pendaftaran
            </div>
            <h1 className="font-heading text-2xl font-bold text-[#14201A]">Scan untuk Daftar</h1>
            <p className="text-[#5F6B63] text-base mt-1 mb-6">
              Arahkan kamera HP ke QR ini, atau tekan tombol di bawah untuk mengisi form langsung.
            </p>
            {qr ? (
              <img
                data-testid="img-public-qr"
                src={qr.image}
                alt="QR Pendaftaran"
                className="mx-auto w-56 h-56 rounded-xl border border-[#E7E3D8] p-2 bg-white"
              />
            ) : (
              <div className="mx-auto w-56 h-56 rounded-xl bg-[#F0EEE6] flex items-center justify-center">
                <Loader2 className="animate-spin text-[#0E4E31]" size={32} />
              </div>
            )}
            <button
              data-testid="button-open-register-form"
              onClick={() => window.location.assign(`/register?token=${token}`)}
              disabled={!token}
              className="mt-6 w-full h-[52px] rounded-xl bg-[#14633F] text-white text-lg font-bold flex items-center justify-center gap-2 hover:bg-[#0E4E31] transition-colors disabled:opacity-60"
            >
              <UserPlus size={22} /> Isi Form Pendaftaran
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-[0_4px_28px_-6px_rgba(20,32,26,0.14)] border border-[#E7E3D8]">
            <h1 className="font-heading text-2xl font-bold text-[#14201A]">Pendaftaran Peserta</h1>
            <p className="text-[#5F6B63] text-base mt-1 mb-2">Akun langsung aktif dengan peran Peserta.</p>
            <div className="inline-flex items-center gap-1.5 text-xs text-[#0E4E31] bg-[#E3F3EA] px-2.5 py-1 rounded-full mb-5">
              <ShieldCheck size={14} /> Data Anda terpantau administrator
            </div>

            <form onSubmit={submit} className="space-y-4" data-testid="register-form">
              <Field label="Nama Lengkap" testid="input-reg-name" value={form.name} onChange={set("name")} placeholder="Nama sesuai identitas" />
              <Field label="Nomor HP" testid="input-reg-phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="cth: 08xxxx" />
              <Field label="Email" testid="input-reg-email" type="email" value={form.email} onChange={set("email")} placeholder="nama@email.com" />
              <div>
                <label className="block text-base font-semibold text-[#14201A] mb-1.5">Tanggal Lahir</label>
                <DateField testid="input-reg-dob" value={form.dob} onChange={(v) => setForm((f) => ({ ...f, dob: v }))} required />
              </div>
              <Field label="Alamat" testid="input-reg-address" value={form.address} onChange={set("address")} placeholder="Alamat tempat tinggal" />
              <Field label="Kata Sandi" testid="input-reg-password" type="password" value={form.password} onChange={set("password")} placeholder="Minimal 6 karakter" minLength={6} />

              <button
                data-testid="button-register-submit"
                type="submit"
                disabled={loading}
                className="w-full h-[54px] rounded-xl bg-[#14633F] text-white text-lg font-bold flex items-center justify-center gap-2 hover:bg-[#0E4E31] transition-colors disabled:opacity-60"
              >
                {loading ? <Loader2 className="animate-spin" size={22} /> : <UserPlus size={22} />}
                Daftar Sekarang
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, testid, type = "text", value, onChange, placeholder, minLength }) {
  return (
    <div>
      <label className="block text-base font-semibold text-[#14201A] mb-1.5">{label}</label>
      <input
        data-testid={testid}
        type={type}
        required
        minLength={minLength}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full h-[52px] px-4 rounded-xl border border-[#8A948D] text-base outline-none transition-colors focus:border-[#14633F] bg-white"
      />
    </div>
  );
}
