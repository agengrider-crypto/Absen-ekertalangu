import { Phone, MessageCircle, PhoneOff } from "lucide-react";
import { toast } from "sonner";

/** Normalisasi nomor HP Indonesia ke format wa.me (62xxxx). */
export function waNumber(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

/**
 * FASE 7 — Tombol Telepon & WhatsApp.
 *
 * Dipakai pada modal detail peserta (admin/pengurus) dan halaman profil peserta.
 * Nomor WhatsApp memakai field `whatsapp`; bila kosong memakai `phone`.
 */
export default function ContactButtons({ phone, whatsapp, name, testidPrefix = "kontak", label = "Hubungi" }) {
  const tel = (phone || whatsapp || "").trim();
  const wa = waNumber(whatsapp || phone);
  const kosong = !tel && !wa;

  const callNow = () => {
    if (!tel) { toast.error("Nomor telepon belum diisi."); return; }
    window.location.href = `tel:${tel.replace(/\s+/g, "")}`;
  };
  const waNow = () => {
    if (!wa) { toast.error("Nomor WhatsApp belum diisi."); return; }
    const text = `Assalamu'alaikum${name ? ` ${name}` : ""}, `;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB]" data-testid={`${testidPrefix}-section`}>
      <div className="text-sm font-semibold text-[#111827] mb-2.5 flex items-center gap-1.5">
        <Phone size={15} className="text-[#0D5C3A]" /> {label}
      </div>
      {kosong ? (
        <p className="text-sm text-[#9CA3AF] flex items-center gap-1.5">
          <PhoneOff size={14} /> Nomor telepon / WhatsApp belum diisi.
        </p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            data-testid={`${testidPrefix}-call`}
            onClick={callNow}
            disabled={!tel}
            className="flex-1 h-11 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#E8F5EE] disabled:opacity-50"
          >
            <Phone size={16} /> Telepon
          </button>
          <button
            type="button"
            data-testid={`${testidPrefix}-wa`}
            onClick={waNow}
            disabled={!wa}
            className="flex-1 h-11 rounded-xl bg-[#25D366] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-95 disabled:opacity-50"
          >
            <MessageCircle size={16} /> WhatsApp
          </button>
        </div>
      )}
      {(tel || wa) && (
        <p className="text-xs text-[#9CA3AF] mt-2">
          {tel ? `Telepon: ${tel}` : ""}{tel && wa ? " · " : ""}{wa ? `WA: +${wa}` : ""}
        </p>
      )}
    </div>
  );
}
