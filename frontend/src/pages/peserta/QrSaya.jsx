import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Download, RefreshCw, QrCode } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function QrSaya({ user }) {
  const [qr, setQr] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  const fetchQr = useCallback(async () => {
    try {
      const { data } = await api.get("/me/qr");
      setQr(data);
      setCountdown(data.expires_in || data.rotate_seconds || 60);
    } catch (e) { toast.error("Gagal memuat QR pribadi"); }
  }, []);

  useEffect(() => { fetchQr(); }, [fetchQr]);

  // countdown + auto refresh when window rotates
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { fetchQr(); return qr?.rotate_seconds || 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [fetchQr, qr?.rotate_seconds]);

  const download = () => {
    if (!qr?.image) return;
    const a = document.createElement("a");
    a.href = qr.image;
    a.download = `qr-${(user?.name || "peserta").replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-[#111827]">QR Pribadi Saya</h1>
      <p className="text-sm text-[#6B7280]">Tunjukkan QR ini kepada pengurus untuk absen dibantu. Demi keamanan, kode berganti otomatis secara berkala.</p>

      <div className="bg-white rounded-3xl border border-[#E5E7EB] p-6 flex flex-col items-center">
        {qr === null ? (
          <div className="h-56 w-56 flex items-center justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={32} /></div>
        ) : (
          <>
            <div className="p-3 bg-white rounded-2xl border border-[#E5E7EB]">
              <img data-testid="personal-qr-image" src={qr.image} alt="QR Pribadi" className="h-56 w-56 object-contain" />
            </div>
            <div className="mt-4 text-center">
              <div className="font-heading font-bold text-[#111827]">{user?.name}</div>
              <div className="text-xs text-[#6B7280] mt-1 inline-flex items-center gap-1.5" data-testid="qr-countdown">
                <RefreshCw size={12} /> Berganti dalam {countdown}s
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button data-testid="qr-download" onClick={download} disabled={!qr} className="flex-1 h-12 rounded-xl bg-[#0D5C3A] text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"><Download size={18} /> Download</button>
        <button data-testid="qr-refresh" onClick={fetchQr} className="h-12 px-4 rounded-xl border border-[#0D5C3A] text-[#0D5C3A] font-semibold inline-flex items-center justify-center gap-2"><RefreshCw size={18} /></button>
      </div>

      <div className="bg-[#F0FAF4] border border-[#BBF7D0] rounded-2xl p-4 text-sm text-[#065F46] flex gap-2">
        <QrCode size={18} className="shrink-0 mt-0.5" />
        <span>QR bersifat rahasia & berganti berkala sehingga aman meski sempat terlihat orang lain.</span>
      </div>
    </div>
  );
}
