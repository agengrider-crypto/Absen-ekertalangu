// Floating Action Button (FAB) untuk daftar User & Kegiatan.
// Berisi: pencarian, filter (slider/chip), tombol tambah, serta navigasi
// halaman sebelumnya/berikutnya. Melayang di tengah bawah layar.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search, SlidersHorizontal, Plus, ChevronLeft, ChevronRight, X, Check,
} from "lucide-react";
import { FAB } from "@/constants/testIds";

/**
 * @param {object}   props
 * @param {string}   props.search          nilai pencarian
 * @param {function} props.onSearch        (value) => void
 * @param {string}   props.searchPlaceholder
 * @param {Array}    props.filters         [{ key, label, count }]
 * @param {string}   props.filterValue     key filter aktif
 * @param {function} props.onFilter        (key) => void
 * @param {string}   props.filterLabel     label tombol filter (mis. "Filter")
 * @param {function} props.onAdd           aksi tombol tambah
 * @param {string}   props.addLabel        label tombol tambah
 * @param {number}   props.page            1-based
 * @param {number}   props.pageCount
 * @param {function} props.onPrev
 * @param {function} props.onNext
 * @param {number}   props.total           jumlah item setelah filter
 * @param {number}   props.pageSize
 */
export default function ListFab({
  search = "",
  onSearch,
  searchPlaceholder = "Cari…",
  filters = [],
  filterValue,
  onFilter,
  filterLabel = "Filter",
  onAdd,
  addLabel = "Tambah",
  page = 1,
  pageCount = 1,
  onPrev,
  onNext,
  total = 0,
  pageSize = 0,
}) {
  const [open, setOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const activeFilter = filters.find((f) => f.key === filterValue);
  const hasFilter = filterValue && filterValue !== "all";
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const content = (
    <div
      data-testid={FAB.root}
      className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6"
    >
      <div className="pointer-events-auto w-full max-w-md">
        {/* Panel */}
        {open && (
          <div
            data-testid={FAB.panel}
            className="mb-2 rounded-2xl border border-[#E8E8E4] bg-white p-3 shadow-[0_12px_40px_-8px_rgba(17,17,20,0.28)]"
          >
            <div className="flex items-center justify-between gap-2 pb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">Cari &amp; Filter</span>
              <button
                type="button"
                data-testid={FAB.close}
                onClick={() => setOpen(false)}
                aria-label="Tutup panel"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F4F4F1]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                ref={inputRef}
                data-testid={FAB.search}
                value={search}
                onChange={(e) => onSearch?.(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-11 w-full rounded-xl border-2 border-[#E8E8E4] bg-white pl-10 pr-9 text-sm outline-none focus:border-[#111114]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearch?.("")}
                  aria-label="Hapus pencarian"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F4F4F1]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {filters.length > 0 && (
              <>
                <button
                  type="button"
                  data-testid={FAB.filter}
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                  className={`mt-2 inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border-2 px-3 text-sm font-semibold transition-colors ${
                    hasFilter
                      ? "border-[#111114] bg-[#111114] text-white"
                      : "border-[#E8E8E4] bg-white text-[#4B5563] hover:border-[#111114]"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <SlidersHorizontal size={15} />
                    {hasFilter ? activeFilter?.label || filterLabel : filterLabel}
                  </span>
                  <ChevronRight size={15} className={`transition-transform ${showFilters ? "rotate-90" : ""}`} />
                </button>

                {showFilters && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {filters.map((f) => {
                      const on = f.key === filterValue;
                      return (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => onFilter?.(f.key)}
                          aria-pressed={on}
                          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border-2 px-3 text-xs font-semibold transition-colors ${
                            on
                              ? "border-[#111114] bg-[#111114] text-white"
                              : "border-[#E8E8E4] bg-white text-[#4B5563] hover:border-[#111114]"
                          }`}
                        >
                          {on && <Check size={12} />}
                          {f.label}
                          {typeof f.count === "number" && (
                            <span className={`rounded-full px-1.5 text-[10px] ${on ? "bg-white/25" : "bg-[#F3F4F6] text-[#374151]"}`}>
                              {f.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {onAdd && (
              <button
                type="button"
                data-testid={FAB.add}
                onClick={() => { setOpen(false); onAdd(); }}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#111114] text-sm font-semibold text-white hover:bg-black"
              >
                <Plus size={16} /> {addLabel}
              </button>
            )}
          </div>
        )}

        {/* Bar melayang */}
        <div className="flex items-center gap-1 rounded-full border border-[#E8E8E4] bg-white/95 p-1.5 shadow-[0_10px_30px_-6px_rgba(17,17,20,0.3)] backdrop-blur">
          <button
            type="button"
            data-testid={FAB.prev}
            onClick={onPrev}
            disabled={page <= 1}
            aria-label="Halaman sebelumnya"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#4B5563] hover:bg-[#F4F4F1] disabled:opacity-35"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            type="button"
            data-testid={FAB.toggle}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label="Buka pencarian dan filter"
            className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors ${
              open ? "bg-[#111114] text-white" : "bg-[#F1F1EE] text-[#111114] hover:bg-[#E9E9E4]"
            }`}
          >
            <Search size={17} />
            <span data-testid={FAB.pageInfo} className="tabular-nums">
              {total === 0 ? "0" : `${from}–${to}`} / {total}
            </span>
            {hasFilter && (
              <span className={`h-2 w-2 rounded-full ${open ? "bg-white" : "bg-[#0D5C3A]"}`} aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            data-testid={FAB.next}
            onClick={onNext}
            disabled={page >= pageCount}
            aria-label="Halaman berikutnya"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#4B5563] hover:bg-[#F4F4F1] disabled:opacity-35"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined" || !document.body) return content;
  return createPortal(content, document.body);
}
