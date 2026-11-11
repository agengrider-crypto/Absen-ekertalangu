// Popup "Pembaruan Terbaru": daftar perubahan aplikasi berbentuk kartu.
// Setiap kartu punya tombol "Coba Sekarang" yang langsung membuka fitur terkait.
// Sumber data changelog ada di @/lib/appInfo (dipakai juga oleh Tentang Aplikasi).
import { useEffect, useState } from "react";
import { BellRing, CalendarDays, X, ArrowRight } from "lucide-react";
import { CHANGELOG, formatChangelogDate } from "@/lib/appInfo";
import Modal from "@/components/Modal";

const STORAGE_KEY = "ekertalangu.updateSeen";

// Tujuan tombol "Coba Sekarang" per entri changelog.
// `nav` = key tab di AdminLayout (dibuka lewat /area/admin?tab=<nav>).
const ACTION_BY_ID = {
  "2026-11-11-logo": { label: "Coba Sekarang", nav: "dashboard" },
  "2026-11-09-tema": { label: "Coba Sekarang", nav: "dashboard" },
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
    <Modal
      onClose={close}
      testid="update-modal"
      closeTestId="update-modal-close"
      maxWidth={640}
      zIndex={9999}
      hideClose
      bodyClassName="px-4 py-4 space-y-3"
      header={(
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B6B52] text-white">
              <BellRing size={19} />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-bold leading-tight text-[#14201A]">Pembaruan Terbaru</h2>
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#5F6B63]">
                <CalendarDays size={12} /> {formatChangelogDate(UPDATES[0]?.date)}
              </p>
            </div>
          </div>
          <button
            data-testid="update-modal-close"
            onClick={close}
            aria-label="Tutup"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#5F6B63] hover:bg-[#F0EEE6]"
          >
            <X size={20} />
          </button>
        </div>
      )}
      footer={(
        <button
          onClick={close}
          className="h-11 w-full rounded-xl bg-[#F0EEE6] text-sm font-semibold text-[#5F6B63] hover:bg-[#E7E3D8]"
        >
          Tutup
        </button>
      )}
    >
          {UPDATES.map((u) => (
            <div
              key={u.id}
              data-testid={`update-item-${u.id}`}
              className="rounded-2xl border border-[#E7E3D8] bg-white p-4"
            >
              <h3 className="font-bold text-[#14201A] text-[15px] leading-snug">{u.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-[#5F6B63]">
                {u.items[0]}
              </p>
              <button
                type="button"
                data-testid={`update-try-${u.id}`}
                onClick={() => go(u.action?.nav)}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-bold text-white hover:bg-[#0E4E31]"
              >
                {u.action?.label || "Coba Sekarang"} <ArrowRight size={16} />
              </button>
            </div>
          ))}
    </Modal>
  );

  // Portal ke <body> agar tidak terpotong oleh ancestor ber-overflow (AdminLayout).
  if (typeof document === "undefined" || !document.body) return content;
  return content;
}
