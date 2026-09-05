import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Loader2, CameraOff } from "lucide-react";

/**
 * Reusable camera QR scanner.
 * Props:
 *  - onDetected(text): called when a QR is decoded (throttled by caller if needed)
 *  - paused: when true, scanning is temporarily halted
 */
export default function QrScanner({ onDetected, paused = false }) {
  const containerId = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef(null);
  const startedRef = useRef(false);
  const lastRef = useRef({ text: "", at: 0 });
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const el = document.getElementById(containerId.current);
    if (!el) return;
    const scanner = new Html5Qrcode(containerId.current, { verbose: false });
    scannerRef.current = scanner;

    const handle = (decoded) => {
      const now = Date.now();
      // debounce identical reads within 2.5s
      if (decoded === lastRef.current.text && now - lastRef.current.at < 2500) return;
      lastRef.current = { text: decoded, at: now };
      onDetected?.(decoded);
    };

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        handle,
        () => {}
      )
      .then(() => {
        if (cancelled) return;
        startedRef.current = true;
        setStarting(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setStarting(false);
        setError(
          e?.toString?.().includes("NotAllowed")
            ? "Izin kamera ditolak. Aktifkan izin kamera di browser."
            : "Tidak dapat mengakses kamera perangkat ini."
        );
      });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s && startedRef.current) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const s = scannerRef.current;
    if (!s || !startedRef.current) return;
    if (paused) {
      s.pause(true);
    } else {
      try { s.resume(); } catch (_) {}
    }
  }, [paused]);

  return (
    <div className="w-full">
      <div
        id={containerId.current}
        className="w-full max-w-xs mx-auto rounded-2xl overflow-hidden bg-black/5 min-h-[240px] flex items-center justify-center"
      >
        {starting && !error && (
          <div className="flex flex-col items-center gap-2 text-[#6B7280] py-10">
            <Loader2 className="animate-spin text-[#0D5C3A]" size={28} />
            <span className="text-sm">Menyalakan kamera…</span>
          </div>
        )}
      </div>
      {error && (
        <div className="mt-3 flex items-center gap-2 justify-center text-sm text-[#DC2626]">
          <CameraOff size={16} /> {error}
        </div>
      )}
    </div>
  );
}
