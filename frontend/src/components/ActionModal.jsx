import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * ActionModal — pengganti menu dropdown.
 *
 * Tampil sebagai bottom-sheet di HP dan dialog di tengah pada layar besar,
 * sehingga daftar aksi tidak pernah terpotong / keluar layar seperti dropdown.
 *
 * Pemakaian:
 *   <ActionModal title="Aksi Kegiatan" subtitle={k.name} onClose={...} actions={[
 *     { key: "share", label: "Bagikan Rekap", desc: "...", icon: Share2, onClick: fn },
 *     { key: "hapus", label: "Hapus", icon: Trash2, danger: true, onClick: fn },
 *   ]} />
 */
export default function ActionModal({ title, subtitle, actions = [], onClose, testid = "action-modal", children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-150" onClick={onClose} />
      <div
        data-testid={testid}
        className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88vh] flex flex-col overflow-hidden"
      >
        {/* Handle bar (mobile) */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
          <div className="h-1.5 w-11 rounded-full bg-[#E5E7EB]" />
        </div>

        <div className="px-5 pt-3 pb-3 border-b border-[#F1F2F0] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-heading font-bold text-[#111827] text-base leading-tight">{title}</h3>
            {subtitle && <p className="text-sm text-[#6B7280] mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            data-testid={`${testid}-close`}
            onClick={onClose}
            aria-label="Tutup"
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F2F5F2]"
          >
            <X size={19} />
          </button>
        </div>

        <div className="overflow-y-auto p-3">
          {children}
          {actions.filter(Boolean).map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                data-testid={a.testid || `action-${a.key}`}
                disabled={a.disabled}
                onClick={() => { onClose?.(); a.onClick?.(); }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-left transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                  a.danger ? "hover:bg-red-50" : "hover:bg-[#F0FAF4]"
                }`}
              >
                <span
                  className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: a.danger ? "#FEE2E2" : "#E8F5EE",
                    color: a.danger ? "#DC2626" : "#0D5C3A",
                  }}
                >
                  {Icon && <Icon size={19} />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[15px] font-semibold ${a.danger ? "text-[#DC2626]" : "text-[#111827]"}`}>
                    {a.label}
                  </span>
                  {a.desc && <span className="block text-xs text-[#6B7280] mt-0.5">{a.desc}</span>}
                </span>
              </button>
            );
          })}
        </div>

        <div className="px-3 pb-3 pt-1 border-t border-[#F1F2F0]">
          <button
            data-testid={`${testid}-cancel`}
            onClick={onClose}
            className="w-full h-12 rounded-2xl bg-[#F2F5F2] text-[#4B5563] font-semibold hover:bg-[#E9EDE9]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
    ),
    document.body,
  );
}
