import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, UserCheck, Search, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import { DateField } from "@/components/DateField";

export default function Activate() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null); // {id, name}
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    phone: "", email: "", dob: "", address: "", password: "", avatar_gender: "male",
  });

  useEffect(() => {
    if (selected) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/activation/search`, { params: { q } });
        setResults(data);
      } catch {
        /* ignore */
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, selected]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/activation/complete", { user_id: selected.id, ...form });
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

          {!selected ? (
            <>
              <p className="text-[#6B7280] text-base mt-1 mb-5">
                Cari nama Anda yang telah didaftarkan pengurus, lalu lengkapi data diri Anda.
              </p>
              <label className="block text-base font-semibold text-[#111827] mb-1.5">Cari Nama Anda</label>
              <div className="relative">
                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  data-testid="input-activation-search"
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ketik nama lengkap Anda..."
                  className="w-full h-[52px] pl-12 pr-4 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A]"
                />
              </div>

              <div className="mt-4 min-h-[60px]" data-testid="activation-results">
                {searching && (
                  <div className="flex items-center gap-2 text-[#6B7280] text-sm py-3">
                    <Loader2 className="animate-spin" size={18} /> Mencari...
                  </div>
                )}
                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <p className="text-[#6B7280] text-sm py-3">
                    Nama tidak ditemukan. Pastikan pengurus sudah mendaftarkan nama Anda.
                  </p>
                )}
                <ul className="space-y-2">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button
                        data-testid={`activation-result-${r.id}`}
                        onClick={() => setSelected(r)}
                        className="w-full flex items-center justify-between px-4 h-[52px] rounded-xl border-2 border-[#E5E7EB] hover:border-[#0D5C3A] hover:bg-[#E8F5EE] transition-colors text-left"
                      >
                        <span className="font-semibold text-[#111827]">{r.name}</span>
                        <ChevronRight size={20} className="text-[#0D5C3A]" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <>
              <p className="text-[#6B7280] text-base mt-1 mb-1">
                Melengkapi data untuk:
              </p>
              <div className="flex items-center justify-between bg-[#E8F5EE] rounded-xl px-4 py-3 mb-5">
                <span className="font-bold text-[#065F46]" data-testid="activation-selected-name">{selected.name}</span>
                <button
                  data-testid="button-change-name"
                  onClick={() => { setSelected(null); setResults([]); }}
                  className="text-sm font-semibold text-[#0D5C3A] hover:underline"
                >
                  Ganti
                </button>
              </div>

              <form onSubmit={submit} className="space-y-4" data-testid="activation-form">
                <Field label="Nomor HP" testid="input-act-phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="cth: 08xxxx" />
                <Field label="Email" testid="input-act-email" type="email" value={form.email} onChange={set("email")} placeholder="nama@email.com" />
                <div>
                  <label className="block text-base font-semibold text-[#111827] mb-1.5">Tanggal Lahir</label>
                  <DateField testid="input-act-dob" value={form.dob} onChange={(v) => setForm((f) => ({ ...f, dob: v }))} required />
                  {selected?.requires_dob && (
                    <p className="text-xs text-[#92400E] bg-[#FEF3C7] rounded-lg px-2.5 py-1.5 mt-1.5" data-testid="dob-verify-note">
                      Tanggal lahir harus sesuai data yang didaftarkan pengurus untuk verifikasi.
                    </p>
                  )}
                </div>
                <Field label="Alamat" testid="input-act-address" value={form.address} onChange={set("address")} placeholder="Alamat tempat tinggal" />
                <Field label="Kata Sandi" testid="input-act-password" type="password" value={form.password} onChange={set("password")} placeholder="Minimal 6 karakter" minLength={6} />

                <button
                  data-testid="button-activate-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full h-[54px] rounded-xl bg-[#0D5C3A] text-white text-lg font-bold flex items-center justify-center gap-2 hover:bg-[#094229] transition-colors disabled:opacity-60"
                >
                  {loading ? <Loader2 className="animate-spin" size={22} /> : <UserCheck size={22} />}
                  Aktivasi & Masuk
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, testid, type = "text", value, onChange, placeholder, minLength }) {
  return (
    <div>
      <label className="block text-base font-semibold text-[#111827] mb-1.5">{label}</label>
      <input
        data-testid={testid}
        type={type}
        required
        minLength={minLength}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full h-[52px] px-4 rounded-xl border-2 border-[#E5E7EB] text-base outline-none transition-colors focus:border-[#0D5C3A] bg-white"
      />
    </div>
  );
}
