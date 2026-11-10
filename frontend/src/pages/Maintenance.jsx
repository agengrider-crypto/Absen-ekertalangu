// Halaman Maintenance: tampil saat aplikasi sedang dalam perawatan.
// Murni UI — tidak memanggil API dan tidak mengubah logika apa pun.
import { useEffect, useState } from "react";
import { Wrench, RefreshCw, Server, Clock } from "lucide-react";
import { APP_INFO } from "@/lib/appInfo";

const MAINTENANCE_KEY = "ekertalangu.maintenance";

/** True bila mode maintenance diaktifkan (localStorage atau ?maintenance=1). */
export function isMaintenanceMode() {
  try {
    if (new URLSearchParams(window.location.search).get("maintenance") === "1") return true;
    return localStorage.getItem(MAINTENANCE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Nyalakan / matikan mode maintenance (dipakai untuk pratinjau). */
export function setMaintenanceMode(on) {
  try {
    if (on) localStorage.setItem(MAINTENANCE_KEY, "1");
    else localStorage.removeItem(MAINTENANCE_KEY);
  } catch { /* abaikan */ }
}

export default function Maintenance({ onRetry }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(iv);
  }, []);

  const jam = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  return (
    <main
      data-testid="maintenance-page"
      className="flex min-h-screen items-center justify-center bg-[#FAFAF8] px-4 py-10"
    >
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-[#E8E8E4] bg-white p-7 text-center shadow-[0_10px_40px_-12px_rgba(17,24,39,0.18)] sm:p-9">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
            <Wrench size={38} strokeWidth={2.2} />
          </div>

          <h1 className="mt-5 font-heading text-2xl font-bold leading-tight text-[#111827]">
            Sedang Dalam Perawatan
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#4B5563]">
            Aplikasi sedang dalam perawatan. Silakan tunggu beberapa saat lalu coba kembali.
            Terima kasih atas pengertiannya.
          </p>

          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-[#F3F4F6] px-3 py-2 text-xs font-medium text-[#6B7280]">
            <Clock size={14} /> Dicek pukul {jam} WITA
          </div>

          <button
            type="button"
            data-testid="maintenance-retry"
            onClick={() => (onRetry ? onRetry() : window.location.reload())}
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2563EB] text-sm font-bold text-white transition-colors hover:bg-[#1D4ED8]"
          >
            <RefreshCw size={17} /> Coba Lagi
          </button>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-[#9CA3AF]">
            <Server size={12} /> {APP_INFO.name} · v{APP_INFO.version}
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-[#9CA3AF]">
          {APP_INFO.copyright}
        </p>
      </div>
    </main>
  );
}
