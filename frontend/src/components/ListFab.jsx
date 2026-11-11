// FAB (tombol tambah) + paginasi daftar untuk tampilan HP.
// FAB: 56x56 px, ikon 24 px, hijau zamrud, 16 px dari kanan dan 16 px di atas
// bilah menu bawah (tinggi bilah 64 px + safe-area). Paginasi diletakkan di
// bawah daftar (bukan melayang). Murni UI — tidak mengubah data/API/routing.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, ChevronLeft, ChevronRight, X } from "lucide-react";
import { FAB } from "@/constants/testIds";

const NAV_HEIGHT = 64;

export default function ListFab({
  onAdd, addLabel = "Tambah", items = null, open = false, onOpenChange,
}) {
  const hasMenu = Array.isArray(items) && items.length > 0;
  const [selfOpen, setSelfOpen] = useState(false);
  const menuOpen = hasMenu ? open : false;
  const setMenuOpen = (value) => {
    if (hasMenu) onOpenChange?.(value);
    else setSelfOpen(value);
  };
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [menuOpen]);

  if (!onAdd && !hasMenu) return null;

  const content = (
    <div
      ref={wrapRef}
      className="fixed right-4 z-40 flex flex-col items-end gap-2 lg:hidden"
      style={{ bottom: `calc(${NAV_HEIGHT}px + 16px + env(safe-area-inset-bottom))` }}
    >
      {menuOpen && (
        <div
          role="menu"
          data-testid="fab-add-menu"
          className="w-64 overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white p-1.5 shadow-[0_18px_40px_-12px_rgba(17,17,17,0.35)]"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                data-testid={item.testId}
                onClick={() => { setMenuOpen(false); item.onClick?.(); }}
                className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-[#F6F4EE]"
              >
                {Icon && (
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E3F3EA] text-[#0E4E31]">
                    <Icon size={16} />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#14201A]">{item.label}</span>
                  {item.desc && <span className="mt-0.5 block text-[11px] leading-snug text-[#5F6B63]">{item.desc}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        data-testid={FAB.add}
        onClick={() => (hasMenu ? setMenuOpen(!menuOpen) : onAdd?.())}
        aria-label={addLabel}
        aria-haspopup={hasMenu ? "menu" : undefined}
        aria-expanded={hasMenu ? menuOpen : undefined}
        title={addLabel}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_24px_-6px_rgba(11,107,82,0.55)] transition-transform active:scale-95"
        style={{ backgroundColor: "#0B6B52" }}
      >
        {menuOpen ? <X size={24} strokeWidth={2.4} /> : <Plus size={24} strokeWidth={2.4} />}
      </button>
    </div>
  );

  if (typeof document === "undefined" || !document.body) return content;
  return createPortal(content, document.body);
}

/**
 * Paginasi di bawah daftar (tidak melayang).
 * @param {number} page 1-based
 * @param {number} pageCount
 * @param {function} onPrev
 * @param {function} onNext
 * @param {number} total
 * @param {number} pageSize
 */
export function ListPagination({ page = 1, pageCount = 1, onPrev, onNext, total = 0, pageSize = 0 }) {
  if (pageCount <= 1 && total === 0) return null;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#E7E3D8] bg-white px-3 py-2">
      <span className="text-xs text-[#5F6B63]">
        {total === 0 ? "Tidak ada data" : `${from}–${to} dari ${total}`}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid={FAB.prev}
          onClick={onPrev}
          disabled={page <= 1}
          aria-label="Halaman sebelumnya"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6] disabled:opacity-30"
        >
          <ChevronLeft size={19} />
        </button>
        <span
          data-testid={FAB.pageInfo}
          className="min-w-12 text-center text-xs font-bold tabular-nums text-[#0E4E31]"
        >
          {page} / {pageCount}
        </span>
        <button
          type="button"
          data-testid={FAB.next}
          onClick={onNext}
          disabled={page >= pageCount}
          aria-label="Halaman berikutnya"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6] disabled:opacity-30"
        >
          <ChevronRight size={19} />
        </button>
      </div>
    </div>
  );
}
