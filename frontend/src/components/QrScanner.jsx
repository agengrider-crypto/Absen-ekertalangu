import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Loader2, CameraOff } from "lucide-react";

// Html5QrcodeScannerState: SCANNING = 2, PAUSED = 3
async function safeStop(scanner) {
  if (!scanner) return;
  try {
    const st = scanner.getState ? scanner.getState() : null;
    if (st === 2 || st === 3) {
      await scanner.stop();
    }
  } catch (_) { /* ignore */ }
  try { scanner.clear(); } catch (_) { /* ignore */ }
}

/**
 * Reusable camera QR scanner (robust against React StrictMode double-mount).
 * Props:
 *  - onDetected(text): called when a QR is decoded (debounced for identical reads)
 *  - paused: when true, scanning is temporarily halted
 */
export default function QrScanner({ onDetected, paused = false }) {
  const idRef = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef(null);
  const startedRef = useRef(false);
  const lastRef = useRef({ text: "", at: 0 });
  const onDetectedRef = useRef(onDetected);
  const [status, setStatus] = useState("starting"); // starting | running | error
  const [error, setError] = useState("");

  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  useEffect(() => {
    let cancelled = false;

    // Delay the actual start so StrictMode's mount→unmount→mount cycle
    // cancels the first attempt entirely (prevents double-init / removeChild races).
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const scanner = new Html5Qrcode(idRef.current, { verbose: false });
      scannerRef.current = scanner;

      const handle = (decoded) => {
        const now = Date.now();
        if (decoded === lastRef.current.text && now - lastRef.current.at < 2500) return;
        lastRef.current = { text: decoded, at: now };
        onDetectedRef.current?.(decoded);
      };

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          handle,
          () => {}
        );
        if (cancelled) { await safeStop(scanner); scannerRef.current = null; return; }
        startedRef.current = true;
        setStatus("running");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        const msg = e?.toString?.() || "";
        setError(
          msg.includes("NotAllowed") || msg.includes("Permission")
            ? "Izin kamera ditolak. Aktifkan izin kamera di browser Anda."
            : "Tidak dapat mengakses kamera perangkat ini."
        );
      }
    }, 130);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      const s = scannerRef.current;
      scannerRef.current = null;
      startedRef.current = false;
      safeStop(s);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = scannerRef.current;
    if (!s || !startedRef.current) return;
    try {
      const st = s.getState ? s.getState() : null;
      if (paused && st === 2) s.pause(true);
      else if (!paused && st === 3) s.resume();
    } catch (_) { /* ignore */ }
  }, [paused]);

  return (
    <div className="relative w-full max-w-xs mx-auto">
      {/* Reader container: MUST stay free of React-rendered children */}
      <div
        id={idRef.current}
        className="w-full rounded-2xl overflow-hidden bg-black/5 min-h-[240px]"
      />
      {status !== "running" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-4 text-center">
          {status === "starting" && (
            <div className="flex flex-col items-center gap-2 text-[#6B7280]">
              <Loader2 className="animate-spin text-[#0D5C3A]" size={28} />
              <span className="text-sm">Menyalakan kamera…</span>
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-2 text-[#DC2626]">
              <CameraOff size={26} />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
