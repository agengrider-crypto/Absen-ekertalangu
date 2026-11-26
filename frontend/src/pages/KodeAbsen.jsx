// Halaman ramah untuk /absen-kode (Kode Akses sudah tidak dipakai).
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function KodeAbsen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[#E7E3D8] bg-white p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E3F3EA] text-[#0E4E31]">
          <ClipboardList size={26} />
        </div>
        <div className="mt-4 flex justify-center">
          <Logo size={28} />
        </div>
        <h1 className="mt-3 font-heading text-lg font-bold text-[#14201A]">
          Absen dengan kode sudah tidak dipakai
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5F6B63]">
          Absensi lewat kode sudah tidak dipakai. Hubungi admin atau penjaga absen.
        </p>
        <button
          type="button"
          data-testid="absen-kode-kembali"
          onClick={() => navigate("/roles")}
          className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#14633F] text-sm font-semibold text-white hover:bg-[#0E4E31]"
        >
          <ArrowLeft size={16} /> Kembali
        </button>
      </div>
    </div>
  );
}
