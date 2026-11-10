// Splash screen PWA: tampil singkat saat aplikasi dibuka dalam mode standalone.
// Murni UI — tidak memblokir aplikasi lebih dari ~1 detik.
import { useEffect, useState } from "react";
import { K1Mark, K1Wordmark, TAGLINE } from "@/components/Logo";

const SPLASH_KEY = "ekertalangu.splashShown";

function isStandalone() {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  } catch {
    return false;
  }
}

export default function SplashScreen() {
  const [show, setShow] = useState(() => {
    if (!isStandalone()) return false;
    try {
      return sessionStorage.getItem(SPLASH_KEY) !== "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => {
      try { sessionStorage.setItem(SPLASH_KEY, "1"); } catch { /* abaikan */ }
      setShow(false);
    }, 1100);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div
      data-testid="pwa-splash"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0B6B52] px-6 text-center"
    >
      <K1Mark size={96} variant="dark" />
      <div className="mt-5">
        <K1Wordmark variant="dark" size="text-2xl" />
      </div>
      <p className="mt-2 text-sm font-medium text-white/80">{TAGLINE}</p>
    </div>
  );
}
