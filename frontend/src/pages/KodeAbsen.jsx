import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Loader2, ArrowLeft, ScanLine, Info } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Logo } from "@/components/Logo";

/**
 * FASE 7 — "Absen dengan Kode".
 *
 * Petugas/pengurus cukup mengetik 6 digit kode akses kegiatan (tanpa perlu
 * tautan maupun login). Bila kode cocok dengan kegiatan yang masih berlangsung,
 * pengguna diarahkan ke halaman absensi kegiatan tersebut.
 */
export default function KodeAbsen() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const clean = code.replace(/\D/g, "");
    if (clean.length !== 6) {
      setErr("Kode akses harus 6 digit angka.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const { data } = await api.post("/absensi/verify-code", { code: clean });
      sessionStorage.setItem(`absensi_access_${data.token}`, data.access);
      toast.success(`Kode benar — ${data.kegiatan?.name || "kegiatan"} siap diabsen.`);
      navigate(`/absensi/${data.token}`);
    } catch (ex) {
      setErr(formatApiErrorDetail(ex.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFBF9] flex flex-col">
      <header className="bg-white border-b border-[#E5E7EB]">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-center">
          <Logo />
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto px-4 py-8">
        <button
          data-testid="kode-absen-back"
          onClick={() => navigate("/login")}
          className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-[#E5E7EB] bg-white text-[#4B5563] font-semibold text-sm hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
        >
          <ArrowLeft size={16} /> Kembali ke Masuk
        </button>

        <form onSubmit={submit} className="mt-4 bg-white rounded-2xl border border-[#E5E7EB] p-6" data-testid="kode-absen-form">
          <div className="h-12 w-12 rounded-2xl bg-[#E8F5EE] text-[#0D5C3A] flex items-center justify-center mx-auto">
            <KeyRound size={24} />
          </div>
          <h1 className="font-heading text-xl font-bold text-[#111827] text-center mt-3">Absen dengan Kode</h1>
          <p className="text-sm text-[#6B7280] text-center mt-1">
            Masukkan <b>6 digit kode akses</b> kegiatan dari pengurus. Tidak perlu masuk akun.
          </p>

          <input
            data-testid="kode-absen-input"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="------"
            className="mt-5 w-full h-14 text-center tracking-[0.6em] text-2xl font-bold rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A]"
          />
          {err && <p className="mt-2 text-sm text-[#DC2626] text-center" data-testid="kode-absen-error">{err}</p>}

          <button
            type="submit"
            data-testid="kode-absen-submit"
            disabled={busy}
            className="mt-4 w-full h-12 rounded-xl bg-[#0D5C3A] text-white font-semibold flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin" size={18} /> : <ScanLine size={18} />} Buka Daftar Peserta
          </button>
        </form>

        <div className="mt-3 bg-[#F0FAF4] border border-[#BBF7D0] rounded-2xl p-4 text-sm text-[#065F46] flex gap-2.5">
          <Info size={18} className="shrink-0 mt-0.5" />
          <span>
            Kode hanya berlaku selama kegiatan <b>masih berlangsung</b>. Setelah kegiatan
            ditutup/selesai, kode tidak dapat dipakai lagi.
          </span>
        </div>
      </main>
    </div>
  );
}
