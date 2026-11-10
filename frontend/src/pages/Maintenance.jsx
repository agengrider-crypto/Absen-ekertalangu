// Halaman Pemeliharaan (Layar 32) — dipakai peserta saat pemeliharaan berlangsung.
// Tanpa merah: pemeliharaan bukan kesalahan.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, RefreshCw } from "lucide-react";
import { APP_INFO } from "@/lib/appInfo";
import { useMaintenance, jamWita } from "@/lib/maintenance";

const RELOAD_MS = 60_000;

export default function Maintenance() {
  const { ongoing, endAt, message, refresh } = useMaintenance();
  const [busy, setBusy] = useState(false);

  // Muat ulang otomatis tiap 60 detik; bila pemeliharaan selesai, kembali.
  useEffect(() => {
    const iv = setInterval(async () => {
      const next = await refresh();
      if (next && next.state !== "ongoing") {
        const back = sessionStorage.getItem("ekertalangu.maintenanceBack") || "/roles";
        sessionStorage.removeItem("ekertalangu.maintenanceBack");
        window.location.replace(back);
      }
    }, RELOAD_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  const onReload = async () => {
    setBusy(true);
    const next = await refresh();
    setBusy(false);
    if (next && next.state !== "ongoing") {
      const back = sessionStorage.getItem("ekertalangu.maintenanceBack") || "/roles";
      sessionStorage.removeItem("ekertalangu.maintenanceBack");
      window.location.replace(back);
    }
  };

  return (
    <main
      data-testid="maintenance-page"
      className="flex min-h-screen flex-col items-center justify-center bg-[#F6F4EE] px-7 py-10 text-center"
    >
      <div className="w-full max-w-md">
        {/* Lingkaran ikon kunci inggris */}
        <div
          className="mx-auto flex h-[132px] w-[132px] items-center justify-center rounded-full"
          style={{ backgroundColor: "#E7E3D8" }}
          aria-hidden="true"
        >
          <Lock size={64} strokeWidth={1.8} style={{ color: "#4A5650" }} />
        </div>

        <h1 className="mt-6 font-heading text-[26px] font-bold leading-tight text-[#14201A]">
          Lagi dirapikan dulu ya 🛠️
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#5F6B63]">
          {message || "E-Kertalangu sedang dipelihara supaya absen makin lancar. Mohon ditunggu sebentar ya 🙏"}
        </p>

        {/* Kartu keterangan */}
        <div className="mt-6 overflow-hidden rounded-[18px] border bg-white text-left" style={{ borderColor: "#E7E3D8" }}>
          <div className="flex items-start gap-3 px-4 py-3.5">
            <span aria-hidden="true" className="text-base leading-6">⏰</span>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-[#14201A]">Perkiraan selesai</div>
              <div className="text-[13px] text-[#5F6B63]">
                {endAt ? `Pukul ${jamWita(endAt)} WITA` : "Belum ditentukan"}
              </div>
            </div>
          </div>
          <div className="h-px w-full" style={{ backgroundColor: "#E7E3D8" }} aria-hidden="true" />
          <div className="flex items-start gap-3 px-4 py-3.5">
            <span aria-hidden="true" className="text-base leading-6">✅</span>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-[#14201A]">Data kamu aman</div>
              <div className="text-[13px] text-[#5F6B63]">Absen yang sudah tercatat tidak hilang</div>
            </div>
          </div>
        </div>

        {/* Satu-satunya blok hijau penuh di halaman */}
        <button
          type="button"
          data-testid="maintenance-retry"
          onClick={onReload}
          disabled={busy}
          className="mt-5 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#14633F] text-[15px] font-bold text-white transition-colors hover:bg-[#0E4E31] disabled:opacity-60"
        >
          <RefreshCw size={18} className={busy ? "animate-spin" : undefined} />
          Muat ulang
        </button>

        <Link
          to="/bantuan"
          className="mt-3 inline-flex min-h-11 items-center justify-center px-3 text-[13px] font-bold text-[#0E4E31] underline underline-offset-4"
        >
          Hubungi pengurus
        </Link>

        <p className="mt-6 text-[11px] leading-relaxed text-[#5F6B63]">
          {APP_INFO.name} · v{APP_INFO.version}
          <br />
          {APP_INFO.copyright}
        </p>
      </div>
    </main>
  );
}
