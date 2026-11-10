// Halaman "Tentang Aplikasi": identitas aplikasi dan Tour Panduan.
// Daftar perubahan aplikasi ada di menu "Update Terbaru" (terpisah).
// Murni UI — tidak memanggil API apa pun.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, Info, Play, CalendarDays,
  ShieldCheck, Users, Smartphone, HeartHandshake, Layers, BookOpen,
} from "lucide-react";
import { ABOUT } from "@/constants/testIds";
import { APP_INFO } from "@/lib/appInfo";
import { K1Mark } from "@/components/Logo";

const TOUR_STORAGE_KEY = "ekertalangu.tourSeen";

/**
 * Tour panduan hanya dijalankan SEKALI untuk selamanya (bukan per versi).
 * Update aplikasi berikutnya tidak memunculkan tour lagi.
 */
export function hasUnseenTour() {
  try {
    return !localStorage.getItem(TOUR_STORAGE_KEY);
  } catch {
    return false;
  }
}

export function markTourSeen() {
  try { localStorage.setItem(TOUR_STORAGE_KEY, "1"); } catch { /* abaikan */ }
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E3F3EA] text-[#0E4E31]">
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5F6B63]">{label}</div>
        <div className="break-words text-sm font-medium text-[#14201A]">{value}</div>
      </div>
    </div>
  );
}

export default function AboutApp({ onClose, onStartTour }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const content = (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-[rgba(20,32,26,0.5)] backdrop-blur-[2px]" onClick={onClose} />
      <div
        data-testid={ABOUT.page}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-app-title"
        className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#F6F4EE] shadow-2xl sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E7E3D8] bg-white px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E3F3EA] p-1">
              <K1Mark size={32} variant="light" />
            </span>
            <div className="min-w-0">
              <h2 id="about-app-title" className="font-heading text-lg font-bold leading-tight text-[#14201A]">
                Tentang Aplikasi
              </h2>
              <p className="mt-0.5 truncate text-xs text-[#5F6B63]">
                {APP_INFO.name} · v{APP_INFO.version}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid={ABOUT.close}
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#5F6B63] hover:bg-[#F0EEE6]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="space-y-3.5">
            {/* Identitas aplikasi */}
            <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid={ABOUT.identity}>
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#E3F3EA] p-1.5">
                  <K1Mark size={32} variant="light" />
                </span>
                <div className="min-w-0">
                  <div className="font-heading text-base font-bold text-[#14201A]">{APP_INFO.name}</div>
                  <div className="text-xs text-[#5F6B63]">{APP_INFO.tagline}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#14633F] px-2 py-0.5 text-[11px] font-semibold text-white">
                      v{APP_INFO.version}
                    </span>
                    <span className="rounded-full bg-[#E3F3EA] px-2 py-0.5 text-[11px] font-semibold text-[#14201A]">
                      build {APP_INFO.build}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-[#5F6B63]">{APP_INFO.description}</p>
            </div>

            {/* Informasi teknis */}
            <div className="rounded-2xl border border-[#E7E3D8] bg-white px-4 py-1.5" data-testid={ABOUT.info}>
              <InfoRow icon={Layers} label="Versi aplikasi" value={`${APP_INFO.version} (build ${APP_INFO.build})`} />
              <InfoRow icon={CalendarDays} label="Tahun rilis" value={String(APP_INFO.releaseYear)} />
              <InfoRow icon={Smartphone} label="Platform" value="Web (mobile-first)" />
              <InfoRow icon={Users} label="Peran pengguna" value="Administrator · Pengurus · Peserta · Guru" />
              <InfoRow icon={ShieldCheck} label="Keamanan" value="Sesi cookie httpOnly, kata sandi terenkripsi" />
            </div>

            {/* Pengembang & hak cipta */}
            <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid={ABOUT.developer}>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#14201A]">
                <HeartHandshake size={15} /> Pengembang
              </div>
              <div className="mt-1.5 text-sm font-medium text-[#14201A]">{APP_INFO.developer}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-[#5F6B63]">{APP_INFO.developerNote}</p>
              <div className="mt-3 border-t border-[#F0EEE6] pt-3 text-[11px] leading-relaxed text-[#5F6B63]">
                {APP_INFO.copyright}
              </div>
            </div>

            {/* Tour Panduan */}
            <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid={ABOUT.tourSection}>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#14201A]">
                <BookOpen size={15} /> Tour Panduan
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#5F6B63]">
                Panduan singkat 5 langkah: Dashboard → User → Daftar Kegiatan → Rekap &amp; Laporan → Profil.
                Bisa diulang kapan saja.
              </p>
              <button
                type="button"
                data-testid={ABOUT.tourStart}
                onClick={() => onStartTour?.()}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#14633F] text-sm font-semibold text-white hover:bg-[#0E4E31]"
              >
                <Play size={16} /> Mulai Tour
              </button>
            </div>

            <div className="flex items-start gap-2 rounded-2xl border border-[#E7E3D8] bg-white p-3.5 text-xs leading-relaxed text-[#5F6B63]">
              <Info size={15} className="mt-0.5 shrink-0 text-[#5F6B63]" />
              <span>
                Tour Panduan memandu Anda mengenali menu utama dan bisa diulang kapan saja.
                Daftar perubahan aplikasi ada di menu <b>Update Terbaru</b>.
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-[#E7E3D8] bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-xl bg-[#F0EEE6] text-sm font-semibold text-[#5F6B63] hover:bg-[#E7E3D8]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined" || !document.body) return content;
  return createPortal(content, document.body);
}
