// Popup "Pembaruan Terbaru": daftar perubahan aplikasi berbentuk kartu.
// Setiap kartu punya tombol "Coba Sekarang" yang langsung membuka fitur terkait.
// Sumber data changelog ada di @/lib/appInfo (dipakai juga oleh Tentang Aplikasi).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BellRing, CalendarDays, X, ArrowRight } from "lucide-react";
import { CHANGELOG, formatChangelogDate } from "@/lib/appInfo";

const STORAGE_KEY = "ekertalangu.updateSeen";

// Tujuan tombol "Coba Sekarang" per entri changelog.
// `nav` = key tab di AdminLayout (dibuka lewat /area/admin?tab=<nav>).
const ACTION_BY_ID = {
  "2026-11-09-profil": { label: "Coba Sekarang", nav: "peserta" },
  "2026-11-09-filter-fab": { label: "Coba Sekarang", nav: "peserta" },
  "2026-11-09-rapi": { label: "Coba Sekarang", nav: "kegiatan" },
  "2026-11-09-bottom-bar": { label: "Coba Sekarang", nav: "peserta" },
  "2026-11-09-fab": { label: "Coba Sekarang", nav: "peserta" },
  "2026-11-09-aktivasi": { label: "Coba Sekarang", nav: "dashboard" },
  "2026-11-09-tentang": { label: "Coba Sekarang", nav: "dashboard" },
  "2026-11-08-user": { label: "Coba Sekarang", nav: "peserta" },
  "2026-11-07-absensi": { label: "Coba Sekarang", nav: "kegiatan" },
  "2026-11-06-rekap": { label: "Coba Sekarang", nav: "rekap-bulanan" },
};

export const UPDATES = CHANGELOG.map((entry) => ({
  ...entry,
  action: ACTION_BY_ID[entry.id] || { label: "Coba Sekarang", nav: "dashboard" },
}));

/** True bila ada update yang belum pernah dibuka pengguna. */
export function hasUnreadUpdate() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== (UPDATES[0]?.id || "");
  } catch { return false; }
}

/** Tandai semua update sudah dibaca (dipakai saat modal dibuka manual). */
export function markUpdatesRead() {
  try { localStorage.setItem(STORAGE_KEY, UPDATES[0]?.id || ""); } catch { /* abaikan */ }
}

export default function UpdateModal({ onNavigate, forceOpen = false, onClose }) {
  const [open, setOpen] = useState(forceOpen);

  useEffect(() => {
    if (forceOpen) { setOpen(true); return; }
    let seen = null;
    try { seen = localStorage.getItem(STORAGE_KEY); } catch { /* abaikan */ }
    const latest = UPDATES[0]?.id;
    if (latest && seen !== latest) setOpen(true);
  }, [forceOpen]);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, UPDATES[0]?.id || ""); } catch { /* abaikan */ }
    onClose?.();
  };

  const go = (nav) => {
    close();
    onNavigate?.(nav);
  };

  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={close} />
      <div
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh] overflow-hidden"
        data-testid="update-modal"
      >
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[#ECECE8] bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-10 w-10 shrink-0 rounded-xl bg-[#111114] text-white flex items-center justify-center">
              <BellRing size={19} />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-[#111827] text-lg leading-tight">Pembaruan Terbaru</h2>
              <p className="text-xs text-[#6B7280] mt-0.5 inline-flex items-center gap-1">
                <CalendarDays size={12} /> {formatChangelogDate(UPDATES[0]?.date)}
              </p>
            </div>
          </div>
          <button
            data-testid="update-modal-close"
            onClick={close}
            aria-label="Tutup"
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F4F4F1]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
          {UPDATES.map((u) => (
            <div
              key={u.id}
              data-testid={`update-item-${u.id}`}
              className="rounded-2xl border border-[#E8E8E4] bg-white p-4"
            >
              <h3 className="font-bold text-[#111827] text-[15px] leading-snug">{u.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[#4B5563]">
                {u.items[0]}
              </p>
              <button
                type="button"
                data-testid={`update-try-${u.id}`}
                onClick={() => go(u.action?.nav)}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0D5C3A] px-4 text-sm font-bold text-white hover:bg-[#09482D]"
              >
                {u.action?.label || "Coba Sekarang"} <ArrowRight size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="shrink-0 px-4 py-3 border-t border-[#ECECE8] bg-white">
          <button
            onClick={close}
            className="h-11 w-full rounded-xl bg-[#F4F4F1] text-sm font-semibold text-[#4B5563] hover:bg-[#E9EDE9]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );

  // Portal ke <body> agar tidak terpotong oleh ancestor ber-overflow (AdminLayout).
  if (typeof document === "undefined" || !document.body) return content;
  return createPortal(content, document.body);
}
