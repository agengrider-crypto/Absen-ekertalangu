import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Loader2, CameraOff, RefreshCw } from "lucide-react";

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

/** Hentikan track kamera yang masih menempel pada elemen video di dalam kontainer. */
function stopTracksIn(containerId) {
  try {
    const root = document.getElementById(containerId);
    if (!root) return;
    root.querySelectorAll("video").forEach((video) => {
      const stream = video.srcObject;
      if (stream) {
        try {
          stream.getTracks().forEach((track) => {
            try { track.stop(); } catch (_) { /* ignore */ }
          });
        } catch (_) { /* ignore */ }
        video.srcObject = null;
      }
    });
  } catch (_) { /* ignore */ }
}

const CAMERA_ERROR_TEXT = {
  NotAllowedError: "Izin kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu muat ulang.",
  NotReadableError: "Kamera sedang dipakai aplikasi atau tab lain. Tutup yang lain, lalu coba lagi.",
  NotFoundError: "Kamera tidak ditemukan di perangkat ini.",
  OverconstrainedError: "Kamera perangkat ini tidak mendukung pengaturan yang diminta. Coba lagi.",
  SecurityError: "Kamera diblokir oleh pengaturan browser. Pastikan situs dibuka lewat HTTPS.",
};

/** Nama galat kamera (html5-qrcode membungkusnya jadi teks, jadi dicari juga di pesan). */
function cameraErrorName(err) {
  const direct = err?.name || err?.error?.name;
  if (direct && CAMERA_ERROR_TEXT[direct]) return direct;
  const text = String(err?.message || err || "");
  return Object.keys(CAMERA_ERROR_TEXT).find((name) => text.includes(name)) || "";
}

/**
 * Reusable camera QR scanner (robust against React StrictMode double-mount).
 * Props:
 *  - onDetected(text): called when a QR is decoded (debounced for identical reads)
 *  - paused: when true, scanning is temporarily halted
 *  - large: pratinjau memenuhi lebar kartu (dipakai mode "Perbesar")
 *  - wide: pratinjau memenuhi lebar kartu tanpa menambah tinggi
 */
export default function QrScanner({ onDetected, paused = false, large = false, wide = false }) {
  const idRef = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef(null);
  const startedRef = useRef(false);
  const lastRef = useRef({ text: "", at: 0 });
  const onDetectedRef = useRef(onDetected);
  const [status, setStatus] = useState("starting"); // starting | running | error
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);

  useEffect(() => {
    let cancelled = false;

    // Delay the actual start so StrictMode's mount→unmount→mount cycle
    // cancels the first attempt entirely (prevents double-init / removeChild races).
    const timer = setTimeout(async () => {
      if (cancelled) return;
      // Hentikan kamera lama sebelum membuka yang baru.
      stopTracksIn(idRef.current);

      const handle = (decoded) => {
        const now = Date.now();
        if (decoded === lastRef.current.text && now - lastRef.current.at < 2500) return;
        lastRef.current = { text: decoded, at: now };
        onDetectedRef.current?.(decoded);
      };

      // disableFlip: jangan cerminkan pratinjau agar tulisan pada kartu terbaca benar.
      const scanConfig = { fps: 10, qrbox: { width: 240, height: 240 }, disableFlip: true };

      // Percobaan 1: resolusi ideal 1280x720 (facingMode hanya "ideal", tidak pernah "exact").
      // Percobaan 2: video: true saja, supaya perangkat yang menolak constraint tetap jalan.
      const attempts = [
        {
          facingMode: "environment",
          videoConstraints: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        { facingMode: "environment" },
      ];

      let lastError = null;
      for (let i = 0; i < attempts.length; i += 1) {
        // Instance baru tiap percobaan supaya sisa percobaan gagal tidak mengganggu.
        const scanner = new Html5Qrcode(idRef.current, { verbose: false });
        scannerRef.current = scanner;
        try {
          await scanner.start(attempts[i], scanConfig, handle, () => {});
          lastError = null;
          break;
        } catch (e) {
          lastError = e;
          if (cancelled) break;
          await safeStop(scanner);
          stopTracksIn(idRef.current);
        }
      }

      if (cancelled) { await safeStop(scannerRef.current); scannerRef.current = null; return; }

      if (lastError) {
        const name = cameraErrorName(lastError);
        console.error("Kamera gagal dibuka:", name || "(tanpa nama)", lastError?.message || lastError);
        setStatus("error");
        setError(CAMERA_ERROR_TEXT[name] || "Tidak dapat mengakses kamera perangkat ini.");
        return;
      }

      startedRef.current = true;
      setStatus("running");
      // Fokus otomatis diterapkan SETELAH kamera menyala (best effort).
      try {
        const video = document.getElementById(idRef.current)?.querySelector("video");
        const track = video?.srcObject?.getVideoTracks?.()[0];
        if (track) {
          const caps = track.getCapabilities ? track.getCapabilities() : {};
          if (Array.isArray(caps?.focusMode) && caps.focusMode.includes("continuous")) {
            await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
          }
        }
      } catch (_) { /* perangkat tidak mendukung fokus kontinu */ }
    }, 130);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      const s = scannerRef.current;
      scannerRef.current = null;
      startedRef.current = false;
      stopTracksIn(idRef.current);
      safeStop(s);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

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
    <div className={`relative w-full ${large || wide ? "" : "max-w-xs mx-auto"}`}>
      {/* Reader container: MUST stay free of React-rendered children */}
      <div
        id={idRef.current}
        className={`qr-reader-box w-full overflow-hidden rounded-2xl bg-black/5 ${large ? "qr-reader-box-large min-h-[360px]" : "min-h-[240px]"}`}
      />
      {status !== "running" && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
          {status === "starting" && (
            <div className="pointer-events-none flex flex-col items-center gap-2 text-[#5F6B63]">
              <Loader2 className="animate-spin text-[#0E4E31]" size={28} />
              <span className="text-sm">Menyalakan kamera…</span>
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-2 text-[#A32A2A]">
              <CameraOff size={26} />
              <span className="text-sm">{error}</span>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStatus("starting");
                  setAttempt((n) => n + 1);
                }}
                className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F]"
              >
                <RefreshCw size={15} /> Coba lagi
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
