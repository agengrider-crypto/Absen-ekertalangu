// Modal bersama — satu pola untuk SEMUA dialog/popup di aplikasi.
// Desktop: tengah layar, maks 960px, maks 90vh, sudut 24px.
// HP (<640px): bottom sheet, lebar penuh, sudut atas membulat, maks 90vh.
// Header tetap di atas, isi bisa digulir, footer tetap terlihat.
import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function Modal({
  open = true,
  onClose,
  title,
  subtitle,
  children,
  footer,
  testid = "modal",
  maxWidth = 960,
  zIndex = 60,
  hideClose = false,
  closeTestId,
  header,
  bodyClassName = "",
  className = "",
}) {
  const panelRef = useRef(null);
  const restoreRef = useRef(null);

  const close = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") { e.stopPropagation(); close(); return; }
      if (e.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const list = Array.from(nodes).filter((n) => n.offsetParent !== null);
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey, true);

    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;

    restoreRef.current = document.activeElement;
    const t = setTimeout(() => {
      const target = panelRef.current?.querySelector(FOCUSABLE);
      (target || panelRef.current)?.focus?.();
    }, 30);

    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadding;
      clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [open, close]);

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4"
      style={{ zIndex }}
      data-testid={`${testid}-overlay`}
    >
      <button
        type="button"
        aria-label="Tutup"
        tabIndex={-1}
        onClick={close}
        className="absolute inset-0 cursor-default"
        style={{ backgroundColor: "rgba(17,17,17,0.55)" }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${testid}-title` : undefined}
        tabIndex={-1}
        data-testid={testid}
        className={`relative flex w-full flex-col overflow-hidden bg-white shadow-[0_24px_64px_-16px_rgba(17,17,17,0.35)] outline-none rounded-t-[24px] sm:rounded-[24px] ${className}`}
        style={{
          maxWidth: `min(${maxWidth}px, 100%)`,
          maxHeight: "90vh",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="mx-auto mt-2 h-1.5 w-11 shrink-0 rounded-full bg-[#E7E3D8] sm:hidden" aria-hidden="true" />

        {header ? (
          <div className="shrink-0 border-b border-[#E7E3D8] bg-white">{header}</div>
        ) : (title || !hideClose) && (
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E7E3D8] px-5 pb-3 pt-3">
            <div className="min-w-0">
              {title && (
                <h2 id={`${testid}-title`} className="font-heading text-base font-bold leading-tight text-[#14201A]">
                  {title}
                </h2>
              )}
              {subtitle && <p className="mt-0.5 truncate text-[13px] text-[#5F6B63]">{subtitle}</p>}
            </div>
            {!hideClose && (
              <button
                type="button"
                data-testid={closeTestId || `${testid}-close`}
                onClick={close}
                aria-label="Tutup"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#5F6B63] transition-colors hover:bg-[#F0EEE6]"
              >
                <X size={20} />
              </button>
            )}
          </header>
        )}

        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${/(^|\s)p-/.test(bodyClassName) ? "" : "px-5 py-4"} ${bodyClassName}`}>
          {children}
        </div>

        {footer && (
          <footer className="shrink-0 border-t border-[#E7E3D8] bg-white px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined" || !document.body) return content;
  return createPortal(content, document.body);
}
