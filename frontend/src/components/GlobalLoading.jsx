import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Indikator loading global (dipakai di seluruh aplikasi).
 *
 * Muncul hanya bila permintaan ke server tertunda lebih dari `delay` ms,
 * supaya tidak berkedip pada koneksi cepat.
 */
export default function GlobalLoading({ delay = 450 }) {
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const onPending = (e) => {
      const n = e.detail || 0;
      if (n > 0) {
        if (!timer.current) {
          timer.current = setTimeout(() => setBusy(true), delay);
        }
      } else {
        clearTimeout(timer.current);
        timer.current = null;
        setBusy(false);
      }
    };
    window.addEventListener("api-pending", onPending);
    return () => {
      window.removeEventListener("api-pending", onPending);
      clearTimeout(timer.current);
    };
  }, [delay]);

  if (!busy) return null;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-[3px] z-[100] overflow-hidden bg-[#0D5C3A]/10" data-testid="global-loading-bar">
        <div className="h-full w-1/3 bg-[#0D5C3A] rounded-full animate-[loadingslide_1.1s_ease-in-out_infinite]" />
      </div>
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] px-3.5 h-9 rounded-full bg-[#0D5C3A] text-white text-xs font-semibold shadow-lg inline-flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
        data-testid="global-loading-pill">
        <Loader2 size={14} className="animate-spin" /> Memuat…
      </div>
    </>
  );
}

/** Layar pembuka saat aplikasi pertama dibuka / sesi sedang diperiksa. */
export function SplashLoading({ label = "Memuat aplikasi…" }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFBF9] px-6" data-testid="splash-loading">
      <div className="h-20 w-20 rounded-3xl bg-white shadow-sm border border-[#E5E7EB] flex items-center justify-center overflow-hidden p-2 animate-in zoom-in duration-500">
        <img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" />
      </div>
      <div className="font-heading text-lg font-bold text-[#0D5C3A] mt-4 tracking-wide">E-KERTALANGU</div>
      <div className="mt-4 h-1.5 w-40 rounded-full bg-[#E8F5EE] overflow-hidden">
        <div className="h-full w-1/2 bg-[#0D5C3A] rounded-full animate-[loadingslide_1.1s_ease-in-out_infinite]" />
      </div>
      <p className="text-xs text-[#6B7280] mt-3">{label}</p>
    </div>
  );
}

/** Kerangka tabel/daftar saat data sedang dimuat. */
export function SkeletonList({ rows = 5, testid = "skeleton-list" }) {
  return (
    <div className="space-y-2.5" data-testid={testid}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-[#F1F3F1] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}
