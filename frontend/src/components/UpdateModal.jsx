// Popup "Pembaruan Terbaru": daftar baris ringkas yang bisa diklik.
// Sumber data changelog ada di @/lib/appInfo (dipakai juga oleh Tentang Aplikasi).
// Status "sudah dibuka" disimpan per akun di localStorage (kunci memuat id pengguna).
import { useEffect, useMemo, useState } from "react";
import {
  BellRing, CalendarDays, X, ArrowRight, ChevronDown, Sparkles, BarChart3,
  HeartHandshake, Users, ClipboardList, CalendarPlus,
} from "lucide-react";
import { CHANGELOG, formatChangelogDate } from "@/lib/appInfo";
import Modal from "@/components/Modal";

const STORAGE_PREFIX = "ekertalangu.updateSeen";

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

/** Tandai semua pembaruan sudah dibaca. */
export function markUpdatesRead(userId) {
  CHANGELOG.forEach((u) => markSeen(userId, u.id));
}

const ICON_BY_TUJUAN = {
  "rekap-bulanan": BarChart3,
  pengaduan: HeartHandshake,
  peserta: Users,
  "laporan-peserta": ClipboardList,
  kalender: CalendarDays,
  kegiatan: CalendarPlus,
};

export default function UpdateModal({ onNavigate, forceOpen = false, onClose, user, role }) {
  const [open, setOpen] = useState(forceOpen);
  const [seen, setSeen] = useState(() => readSeenUpdates(user?.id));
  const [expanded, setExpanded] = useState(null);

  const activeRole = role || (user?.roles || [])[0] || "peserta";
  const rows = useMemo(() => updatesForRole(activeRole), [activeRole]);

  useEffect(() => {
    if (forceOpen) { setOpen(true); return; }
    const latest = rows[0]?.id;
    if (latest && !readSeenUpdates(user?.id).includes(latest)) setOpen(true);
  }, [forceOpen, rows, user?.id]);

  const tandai = (id) => {
    if (seen.includes(id)) return;
    setSeen((prev) => [...prev, id]);
    markSeen(user?.id, id);
  };

  const close = () => {
    setOpen(false);
    markUpdatesRead(user?.id);
    onClose?.();
  };

  const go = (nav) => {
    close();
    onNavigate?.(nav);
  };

  if (!open) return null;

  const header = (
    <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0B6B52] text-white">
          <BellRing size={19} />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold leading-tight text-[#14201A]">Pembaruan terbaru</h2>
          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[#5F6B63]">
            <CalendarDays size={12} /> {rows[0]?.date ? formatChangelogDate(rows[0].date) : "—"}
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
  );

  return (
    <Modal
      onClose={close}
      testid="update-modal"
      closeTestId="update-modal-close"
      maxWidth={640}
      zIndex={9999}
      hideClose
      bodyClassName="px-4 py-2"
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
        {rows.map((u) => {
          const unread = !seen.includes(u.id);
          const Icon = ICON_BY_TUJUAN[u.tujuan] || Sparkles;
          const hasTujuan = Boolean(u.tujuan);
          const longText = (u.keterangan || "").length > 60;
          const expandable = !hasTujuan && longText;
          const clickable = hasTujuan || expandable;
          const isOpen = expanded === u.id;
          const ringkas = u.keterangan || u.items?.[0] || "";

          const body = (
            <>
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E3F3EA] text-[#0E4E31]">
                <Icon size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate text-[14px] font-semibold text-[#14201A]">{u.title}</span>
                  {unread && (
                    <span className="shrink-0 rounded-full bg-[#E3F3EA] px-1.5 py-0.5 text-[10px] font-bold text-[#0E4E31]">
                      Baru
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-[#5F6B63]">{ringkas}</span>
                {hasTujuan && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-[#0E4E31]">
                    Coba sekarang <ArrowRight size={12} />
                  </span>
                )}
              </span>
              {expandable && (
                <ChevronDown
                  size={16}
                  className={`mt-1 shrink-0 text-[#5F6B63] transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
                />
              )}
            </>
          );

          return (
            <li key={u.id} data-testid={`update-item-${u.id}`}>
              {clickable ? (
                <button
                  type="button"
                  data-testid={`update-row-${u.id}`}
                  aria-expanded={expandable ? isOpen : undefined}
                  onClick={() => {
                    tandai(u.id);
                    if (hasTujuan) go(u.tujuan);
                    else setExpanded(isOpen ? null : u.id);
                  }}
                  className="flex min-h-[44px] w-full items-start gap-3 px-1 py-3 text-left transition-colors hover:bg-[#F6F4EE]"
                >
                  {body}
                </button>
              ) : (
                <div className="flex min-h-[44px] w-full items-start gap-3 px-1 py-3">{body}</div>
              )}
              {expandable && isOpen && (
                <p className="px-1 pb-3 pl-12 text-[13px] leading-relaxed text-[#5F6B63] motion-safe:animate-[reportCardIn_0.3s_ease-out_both]">
                  {u.keterangan}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
