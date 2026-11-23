// Popup "Pembaruan terbaru": daftar baris yang bisa digulir di dalam modal.
// Sumber data changelog ada di @/lib/appInfo (dipakai juga oleh Tentang Aplikasi).
// Status "sudah dibuka" disimpan per akun di localStorage (kunci memuat id pengguna).
import { useEffect, useMemo, useState } from "react";
import { X, MessageCircle, ArrowRight } from "lucide-react";
import {
  CHANGELOG, formatChangelogDateShort, jenisEntri,
} from "@/lib/appInfo";
import Modal from "@/components/Modal";

const STORAGE_PREFIX = "ekertalangu.updateSeen";
const MAKS_ENTRI = 10;

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

/** Potong penjelasan menjadi maksimal 2 kalimat. */
function duaKalimat(teks) {
  const t = String(teks || "").trim();
  if (!t) return "";
  const bagian = t.match(/[^.!?]+[.!?]+/g);
  if (!bagian) return t;
  return bagian.slice(0, 2).join(" ").trim();
}

const JENIS_META = {
  fitur: { label: "Fitur baru", cls: "bg-[#E3F3EA] text-[#0E4E31]" },
  perbaikan: { label: "Perbaikan", cls: "bg-[#FBF1D6] text-[#6B4500]" },
};

export default function UpdateModal({ onNavigate, forceOpen = false, onClose, user, role }) {
  const [open, setOpen] = useState(forceOpen);

  const activeRole = role || (user?.roles || [])[0] || "peserta";
  const rows = useMemo(() => updatesForRole(activeRole).slice(0, MAKS_ENTRI), [activeRole]);

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

  const coba = (tujuan) => {
    close();
    onNavigate?.(tujuan);
  };

  if (!open) return null;

  const header = (
    <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3.5">
      <h2 className="min-w-0 font-heading text-base font-bold leading-tight text-[#14201A]">
        Pembaruan terbaru
      </h2>
      <div className="flex shrink-0 items-center gap-1">
        <a
          href={adminWaLink()}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="update-modal-wa"
          aria-label="Hubungi admin lewat WhatsApp"
          title="Hubungi admin lewat WhatsApp"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#0E4E31] hover:bg-[#E3F3EA]"
        >
          <MessageCircle size={18} />
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
      maxWidth={340}
      zIndex={9999}
      hideClose
      bodyClassName="px-3 pb-3"
      header={header}
    >
      <ul
        className="max-h-[60vh] space-y-2 overflow-y-auto pr-1 sm:max-h-[340px]"
        data-testid="update-list"
      >
        {rows.map((u) => {
          const meta = JENIS_META[jenisEntri(u)];
          const teks = duaKalimat(u.keterangan || u.items?.[0] || "");
          return (
            <li
              key={u.id}
              data-testid={`update-item-${u.id}`}
              className="rounded-xl border border-[#E7E3D8] bg-white p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${meta.cls}`}>
                  {meta.label}
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-[#5F6B63]">
                  {formatChangelogDateShort(u.date)}
                </span>
              </div>
              <p className="mt-1.5 truncate text-[13.5px] font-semibold text-[#14201A]">
                {u.title}
              </p>
              {teks && (
                <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[#5F6B63]">
                  {teks}
                </p>
              )}
              {u.tujuan && (
                <button
                  type="button"
                  data-testid={`update-coba-${u.id}`}
                  onClick={() => coba(u.tujuan)}
                  className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#14633F] px-2.5 text-[12px] font-semibold text-[#0E4E31] hover:bg-[#E3F3EA]"
                >
                  Coba sekarang <ArrowRight size={12} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
