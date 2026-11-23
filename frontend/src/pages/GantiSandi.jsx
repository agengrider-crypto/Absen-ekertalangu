// Ganti password wajib saat login pertama (atau setelah reset oleh admin).
// Halaman ini tidak bisa ditutup atau dilewati; backend juga menolak endpoint lain.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";

const inputCls =
  "h-12 w-full rounded-xl border border-[#8A948D] bg-white px-3.5 pr-11 text-base text-[#14201A] outline-none focus:border-[#14633F]";

function KolomSandi({ label, value, onChange, testid, lihat, onLihat }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-[#14201A]">{label}</span>
      <span className="relative block">
        <input
          type={lihat ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={testid}
          autoComplete="new-password"
          className={inputCls}
        />
        <button
          type="button"
          onClick={onLihat}
          aria-label={lihat ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
          className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6]"
        >
          {lihat ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  );
}

export default function GantiSandi() {
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [lama, setLama] = useState("");
  const [baru, setBaru] = useState("");
  const [ulang, setUlang] = useState("");
  const [lihat, setLihat] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");

  const simpan = async (e) => {
    e.preventDefault();
    if (baru.length < 6) { setPesan("Kata sandi baru minimal 6 karakter."); return; }
    if (baru !== ulang) { setPesan("Konfirmasi kata sandi belum sama."); return; }
    if (baru === lama) { setPesan("Kata sandi baru tidak boleh sama dengan yang lama."); return; }
    setSibuk(true);
    setPesan("");
    try {
      await api.post("/me/ganti-sandi", { password_lama: lama, password_baru: baru });
      toast.success("Kata sandi berhasil diganti");
      await refresh();
      navigate("/roles", { replace: true });
    } catch (err) {
      setPesan(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F4EE] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-4 inline-flex items-center gap-2 text-xl font-bold text-[#14201A]">
            <KeyRound size={20} className="text-[#0E4E31]" /> Ganti password
          </h1>
          <p className="mt-1 text-sm text-[#5F6B63]">
            Password awal wajib diganti agar akun lebih aman.
          </p>
        </div>

        <form onSubmit={simpan} className="mt-6 space-y-3 rounded-2xl border border-[#E7E3D8] bg-white p-4">
          <KolomSandi label="Password saat ini" value={lama} onChange={setLama}
            testid="ganti-sandi-lama" lihat={lihat} onLihat={() => setLihat((v) => !v)} />
          <KolomSandi label="Password baru" value={baru} onChange={setBaru}
            testid="ganti-sandi-baru" lihat={lihat} onLihat={() => setLihat((v) => !v)} />
          <KolomSandi label="Ulangi password baru" value={ulang} onChange={setUlang}
            testid="ganti-sandi-ulang" lihat={lihat} onLihat={() => setLihat((v) => !v)} />

          {pesan && (
            <p className="rounded-xl bg-[#FBE5E3] p-2.5 text-sm text-[#A32A2A]">{pesan}</p>
          )}

          <button type="submit" disabled={sibuk} data-testid="ganti-sandi-simpan"
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#14633F] px-4 text-base font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60">
            {sibuk && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />}
            {sibuk ? "Menyimpan…" : "Simpan password baru"}
          </button>
        </form>
      </div>
    </div>
  );
}
