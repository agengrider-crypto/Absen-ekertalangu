// Prompt pemasangan PWA: muncul saat browser mengirim event beforeinstallprompt.
// Murni UI — tidak mengubah logika aplikasi.
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { K1Mark, K1Wordmark, TAGLINE } from "@/components/Logo";

const DISMISS_KEY = "ekertalangu.installDismissed";

export default function InstallPrompt() {
  const [evt, setEvt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* abaikan */ }
    if (dismissed) return;

    const onPrompt = (e) => {
      e.preventDefault();
      setEvt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const close = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* abaikan */ }
  };

  const install = async () => {
    if (!evt) return;
    evt.prompt();
    try { await evt.userChoice; } catch { /* abaikan */ }
    setEvt(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      data-testid="pwa-install-prompt"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_12px_40px_-8px_rgba(17,24,39,0.28)] sm:inset-x-auto sm:right-4"
    >
      <div className="flex items-start gap-3">
        <K1Mark size={44} variant="light" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <K1Wordmark size="text-base" />
              <p className="mt-0.5 text-xs text-[#6B7280]">{TAGLINE}</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Tutup"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"
            >
              <X size={16} />
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-[#4B5563]">
            Pasang aplikasi di layar utama agar lebih cepat dibuka.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={close}
              className="h-10 flex-1 rounded-xl border-2 border-[#E8E8E4] text-sm font-semibold text-[#4B5563] hover:border-[#2563EB]"
            >
              Nanti
            </button>
            <button
              type="button"
              data-testid="pwa-install-button"
              onClick={install}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0B6B52] text-sm font-bold text-white hover:bg-[#08503D]"
            >
              <Download size={15} /> Pasang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
