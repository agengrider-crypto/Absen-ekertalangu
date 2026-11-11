// FAB (tombol tambah) + paginasi daftar untuk tampilan HP.
// FAB: 56x56 px, ikon 24 px, hijau zamrud, 16 px dari kanan dan 16 px di atas
// bilah menu bawah (tinggi bilah 64 px + safe-area). Paginasi diletakkan di
// bawah daftar (bukan melayang). Murni UI — tidak mengubah data/API/routing.
import { createPortal } from "react-dom";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { FAB } from "@/constants/testIds";

const NAV_HEIGHT = 64;

export default function ListFab({ onAdd, addLabel = "Tambah" }) {
  if (!onAdd) return null;

  const content = (
    <button
      type="button"
      data-testid={FAB.add}
      onClick={onAdd}
      aria-label={addLabel}
      title={addLabel}
      className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_24px_-6px_rgba(11,107,82,0.55)] transition-transform active:scale-95 lg:hidden"
      style={{
        backgroundColor: "#0B6B52",
        bottom: `calc(${NAV_HEIGHT}px + 16px + env(safe-area-inset-bottom))`,
      }}
    >
      <Plus size={24} strokeWidth={2.4} />
    </button>
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
