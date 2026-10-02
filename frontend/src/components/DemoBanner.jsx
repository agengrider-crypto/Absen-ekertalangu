// FASE 19 — Penanda mode demo (database terpisah dari data real).
import { FlaskConical } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function DemoBanner() {
  const { user } = useAuth();
  if (!user?.demo) return null;
  return (
    <div
      data-testid="demo-banner"
      className="mb-4 rounded-xl border-2 border-[#F59E0B] bg-[#FFFBEB] px-3.5 py-2.5 flex items-start gap-2.5"
    >
      <FlaskConical size={16} className="text-[#B45309] mt-0.5 shrink-0" />
      <p className="text-xs text-[#92400E] leading-relaxed">
        <b>MODE DEMO</b> — Anda memakai database percobaan. Semua peserta, kegiatan, dan absensi di
        sini terpisah dari data real, jadi bebas dicoba-coba.
      </p>
    </div>
  );
}
