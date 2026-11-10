// Mobile Bottom Action Bar untuk daftar User & Kegiatan.
// Selalu menempel di bawah layar pada tampilan mobile, berisi:
// Search, Filter, FAB "+" (menonjol di tengah), Previous/Next, dan indikator halaman.
// Murni UI — tidak mengubah data, API, atau routing.
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
 * @param {string}   props.filterLabel     label tombol filter
 * @param {function} props.onAdd           aksi tombol tambah (FAB)
 * @param {string}   props.addLabel        label tombol tambah
 * @param {number}   props.page            1-based
 * @param {number}   props.pageCount
 * @param {function} props.onPrev
 * @param {function} props.onNext
 * @param {number}   props.total           jumlah item setelah filter
 * @param {number}   props.pageSize
 * @param {Array}    props.actions         tombol tambahan [{ key, label, icon, onClick, active }]
 * @param {string}   props.filterTestId    data-testid untuk wadah chip filter
 * @param {string}   props.filterItemTestId prefix data-testid tiap chip filter
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
  actions = [],
  filterTestId,
  filterItemTestId,
}) {
  const [panel, setPanel] = useState(null); // null | "search" | "filter"
  const inputRef = useRef(null);

  useEffect(() => {
    if (panel !== "search") return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [panel]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setPanel(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const activeFilter = filters.find((f) => f.key === filterValue);
  const hasFilter = Boolean(filterValue) && filterValue !== "all";
  const atFirst = page <= 1;
  const atLast = page >= pageCount;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const content = (
    <div
      data-testid={FAB.root}
      className="pointer-events-none fixed inset-x-0 bottom-16 z-40 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="pointer-events-auto relative mx-auto w-full max-w-lg px-3 pb-2">
        {/* Panel pencarian / filter */}
        {panel && (
          <div
            data-testid={FAB.panel}
            className="mb-2 rounded-2xl border border-[#E8E8E4] bg-white p-3 shadow-[0_-8px_32px_-8px_rgba(17,17,20,0.28)]"
          >
            <div className="flex items-center justify-between gap-2 pb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#9CA3AF]">
                {panel === "search" ? "Cari" : filterLabel}
              </span>
              <button
                type="button"
                data-testid={FAB.close}
                onClick={() => setPanel(null)}
                aria-label="Tutup panel"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"
              >
                <X size={16} />
              </button>
            </div>

            {panel === "search" && (
              <div className="relative">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  ref={inputRef}
                  data-testid={FAB.search}
                  value={search}
                  onChange={(e) => onSearch?.(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-11 w-full rounded-xl border-2 border-[#E8E8E4] bg-white pl-10 pr-9 text-sm outline-none focus:border-[#2563EB]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => onSearch?.("")}
                    aria-label="Hapus pencarian"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            {panel === "filter" && (
              <div className="flex flex-wrap gap-1.5" data-testid={filterTestId}>
                {filters.map((f) => {
                  const on = f.key === filterValue;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      data-testid={filterItemTestId ? `${filterItemTestId}-${f.key}` : FAB.filter}
                      onClick={() => onFilter?.(f.key)}
                      aria-pressed={on}
                      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 px-3 text-xs font-semibold transition-colors ${
                        on
                          ? "border-[#2563EB] bg-[#2563EB] text-white"
                          : "border-[#E8E8E4] bg-white text-[#4B5563] hover:border-[#2563EB]"
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
          </div>
        )}

        {/* Toolbar */}
        <div className="relative flex items-center justify-between gap-1 rounded-2xl border border-[#E8E8E4] bg-white/95 px-2 py-1.5 shadow-[0_-6px_24px_-6px_rgba(17,17,20,0.22)] backdrop-blur">
          {/* Kiri: Search + Filter */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid={FAB.searchToggle}
              onClick={() => setPanel((p) => (p === "search" ? null : "search"))}
              aria-label="Cari"
              aria-expanded={panel === "search"}
              className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                panel === "search" ? "bg-[#2563EB] text-white" : "text-[#4B5563] hover:bg-[#F3F4F6]"
              }`}
            >
              <Search size={19} />
              {search && panel !== "search" && (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#2563EB]" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              data-testid={FAB.filterToggle}
              onClick={() => setPanel((p) => (p === "filter" ? null : "filter"))}
              aria-label={filterLabel}
              aria-expanded={panel === "filter"}
              className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                panel === "filter" ? "bg-[#2563EB] text-white" : "text-[#4B5563] hover:bg-[#F3F4F6]"
              }`}
            >
              <SlidersHorizontal size={19} />
              {hasFilter && panel !== "filter" && (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#2563EB]" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Tengah: Previous + Next (indikator halaman ada di bawah toolbar) */}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
            <button
              type="button"
              data-testid={FAB.prev}
              onClick={onPrev}
              disabled={atFirst}
              aria-label="Halaman sebelumnya"
              className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#F3F4F6] disabled:opacity-30"
            >
              <ChevronLeft size={19} />
            </button>
            <button
              type="button"
              data-testid={FAB.next}
              onClick={onNext}
              disabled={atLast}
              aria-label="Halaman berikutnya"
              className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#F3F4F6] disabled:opacity-30"
            >
              <ChevronRight size={19} />
            </button>
          </div>

          {/* Kanan: aksi tambahan (Panduan, Daftar/Kalender) */}
          <div className="flex items-center gap-1">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  type="button"
                  data-testid={a.testid}
                  onClick={a.onClick}
                  aria-label={a.label}
                  aria-pressed={a.active}
                  title={a.label}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                    a.active ? "bg-[#2563EB] text-white" : "text-[#4B5563] hover:bg-[#F3F4F6]"
                  }`}
                >
                  {Icon ? <Icon size={19} /> : a.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* FAB "+" menonjol di tengah atas toolbar */}
        {onAdd && (
          <button
            type="button"
            data-testid={FAB.add}
            onClick={onAdd}
            aria-label={addLabel}
            title={addLabel}
            className="absolute bottom-[calc(100%-1.75rem)] left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-[#2563EB] text-white shadow-[0_8px_20px_-4px_rgba(13,92,58,0.55)] ring-4 ring-white transition-transform active:scale-95"
          >
            <Plus size={26} strokeWidth={2.6} />
          </button>
        )}

        {/* Indikator halaman + ringkasan data */}
        <div className="mt-1 flex items-center justify-center gap-2 text-[10px] font-medium text-[#9CA3AF]">
          <span
            data-testid={FAB.pageInfo}
            className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#1D4ED8] shadow-sm"
          >
            {page} / {pageCount}
          </span>
          <span>
            {total === 0 ? "Tidak ada data" : `${from}–${to} dari ${total}`}
            {hasFilter && activeFilter ? ` · ${activeFilter.label}` : ""}
          </span>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined" || !document.body) return content;
  return createPortal(content, document.body);
}
