import { CloudOff, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";

/**
 * FASE 8 — Penanda status koneksi + antrean absen offline.
 * Bahasa dibuat sederhana agar mudah dipahami jamaah/pengurus.
 */
export default function OfflineBanner({ online, pending = 0, syncing, onSync, className = "" }) {
  if (online && pending === 0) return null;

  if (!online) {
    return (
      <div
        data-testid="offline-banner"
        className={`rounded-2xl border-2 border-[#FDE68A] bg-[#FFFBEB] p-4 flex items-start gap-3 ${className}`}
      >
        <CloudOff size={20} className="text-[#B45309] shrink-0 mt-0.5" />
        <div className="text-sm text-[#78350F] leading-relaxed">
          <b>Sedang tanpa internet (mode offline).</b> Absen yang Anda tandai tetap
          tersimpan di HP ini{pending > 0 ? ` (${pending} data menunggu)` : ""} dan akan
          otomatis terkirim begitu internet kembali. Mohon jangan menutup halaman ini.
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="offline-pending-banner"
      className={`rounded-2xl border-2 border-[#A7F3D0] bg-[#F0FAF4] p-4 flex items-center gap-3 flex-wrap ${className}`}
    >
      {syncing ? <Loader2 size={20} className="text-[#0D5C3A] animate-spin" /> : <CheckCircle2 size={20} className="text-[#0D5C3A]" />}
      <div className="text-sm text-[#065F46] flex-1 min-w-[180px]">
        <b>{pending} absen offline</b> menunggu dikirim ke server.
      </div>
      <button
        data-testid="offline-sync-now"
        onClick={onSync}
        disabled={syncing}
        className="h-10 px-4 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm inline-flex items-center gap-2 hover:bg-[#094229] disabled:opacity-60"
      >
        <RefreshCw size={15} /> Kirim Sekarang
      </button>
    </div>
  );
}
