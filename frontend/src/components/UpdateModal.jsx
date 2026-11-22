// Popup "Pembaruan Terbaru": ringkas — judul, maksimal 5 entri terbaru,
// satu tombol tutup, dan tombol WhatsApp ke admin.
// Sumber data changelog ada di @/lib/appInfo (dipakai juga oleh Tentang Aplikasi).
// Status "sudah dibuka" disimpan per akun di localStorage (kunci memuat id pengguna).
import { useEffect, useMemo, useState } from "react";
import { BellRing, X, MessageCircle } from "lucide-react";
import { CHANGELOG, formatChangelogDate } from "@/lib/appInfo";
import Modal from "@/components/Modal";

const STORAGE_PREFIX = "ekertalangu.updateSeen";
const MAKS_ENTRI = 5;

/** Nomor WhatsApp admin (format 62, tanpa +, spasi, atau 0 di depan). */
export const ADMIN_WA_NUMBER = "6281937718541";
const WA_TEXT = "Halo admin E-Kertalangu, saya ingin menyampaikan masukan tentang pembaruan: ";

export function adminWaLink() {
  return `https://wa.me/${ADMIN_WA_NUMBER}?text=${encodeURIComponent(WA_TEXT)}`;
}

/** Kunci localStorage memuat id pengguna DAN id pembaruan. */
function entryKey(userId, updateId) {
  return `${STORAGE_PREFIX}.${userId || "umum"}.${updateId}`;
}

/** Daftar id pembaruan yang sudah dibuka akun ini (aman bila localStorage gagal). */
export function readSeenUpdates(userId) {
  try {
    return CHANGELOG
      .filter((u) => localStorage.getItem(entryKey(userId, u.id)) === "1")
      .map((u) => u.id);
  } catch { return []; }
}

function markSeen(userId, updateId) {
  try { localStorage.setItem(entryKey(userId, updateId), "1"); } catch { /* abaikan */ }
}

/** Pembaruan yang relevan untuk peran aktif (tanpa penanda peran = tampil semua). */
export function updatesForRole(role) {
  return CHANGELOG
    .filter((u) => !u.peran || u.peran.includes(role))
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/** True bila masih ada pembaruan yang belum dibuka akun ini. */
export function hasUnreadUpdate(userId, role) {
  const seen = readSeenUpdates(userId);
  return updatesForRole(role).some((u) => !seen.includes(u.id));
}

export function markUpdatesRead(userId) {
  CHANGELOG.forEach((u) => markSeen(userId, u.id));
}

export default function UpdateModal({ onNavigate, forceOpen = false, onClose, user, role }) {
  const [open, setOpen] = useState(forceOpen);
  const [lihatSemua, setLihatSemua] = useState(false);

  const activeRole = role || (user?.roles || [])[0] || "peserta";
  const rows = useMemo(() => updatesForRole(activeRole), [activeRole]);
  const tampil = lihatSemua ? rows : rows.slice(0, MAKS_ENTRI);

  useEffect(() => {
    if (forceOpen) { setOpen(true); return; }
    const latest = rows[0]?.id;
    if (latest && !readSeenUpdates(user?.id).includes(latest)) setOpen(true);
  }, [forceOpen, rows, user?.id]);

  const close = () => {
    setOpen(false);
    markUpdatesRead(user?.id);
    onClose?.();
  };

  if (!open) return null;

  const header = (
    <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-4 sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B6B52] text-white">
          <BellRing size={17} />
        </span>
        <h2 className="min-w-0 font-heading text-base font-bold leading-tight text-[#14201A] sm:text-lg">
          Pembaruan terbaru
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <a
          href={adminWaLink()}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="update-modal-wa"
          aria-label="Hubungi admin"
          title="Hubungi admin"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E7E3D8] px-2 text-xs font-semibold text-[#0E4E31] hover:border-[#14633F] hover:bg-[#E3F3EA]"
        >
          <MessageCircle size={15} />
          <span className="hidden sm:inline">Hubungi admin</span>
        </a>
        <button
          data-testid="update-modal-close"
          onClick={close}
          aria-label="Tutup"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6]"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      onClose={close}
      testid="update-modal"
      closeTestId="update-modal-close"
      maxWidth={560}
      zIndex={9999}
      hideClose
      bodyClassName="px-4 py-1"
      header={header}
      footer={(
        <button
          onClick={close}
          className="h-11 w-full rounded-xl bg-[#F0EEE6] text-sm font-semibold text-[#5F6B63] hover:bg-[#E7E3D8]"
        >
          Tutup
        </button>
      )}
    >
      <ul className="divide-y divide-[#F0EEE6]" data-testid="update-list">
        {tampil.map((u) => (
          <li key={u.id} data-testid={`update-item-${u.id}`} className="px-1 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5F6B63]">
              {formatChangelogDate(u.date)}
            </p>
            <p className="mt-0.5 text-[13.5px] leading-snug text-[#14201A]">
              {u.keterangan || u.items?.[0] || u.title}
            </p>
          </li>
        ))}
      </ul>
      {rows.length > MAKS_ENTRI && !lihatSemua && (
        <button
          type="button"
          onClick={() => setLihatSemua(true)}
          className="mt-1 mb-2 w-full rounded-lg py-2 text-sm font-semibold text-[#0E4E31] hover:bg-[#F6F4EE]"
        >
          Lihat semua
        </button>
      )}
    </Modal>
  );
}
