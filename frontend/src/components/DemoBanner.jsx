// FASE 19 — Penanda mode demo (database terpisah dari data real).
import { FlaskConical } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function DemoBanner() {
  const { user } = useAuth();
  if (!user?.demo) return null;
  return (
    <div
      data-testid="demo-banner"
      className="mb-4 rounded-xl border-2 border-[#8A5A00] bg-[#FBF1D6] px-3.5 py-2.5 flex items-start gap-2.5"
    >
      <FlaskConical size={16} className="text-[#8A5A00] mt-0.5 shrink-0" />
      <p className="text-xs text-[#6B4500] leading-relaxed">
        <b>MODE DEMO</b> — Anda memakai database percobaan. Semua peserta, kegiatan, dan absensi di
        sini terpisah dari data real, jadi bebas dicoba-coba.
      </p>
    </div>
  );
}
