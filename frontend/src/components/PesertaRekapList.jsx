import { useMemo, useState } from "react";
import { ChevronDown, Search, UserRound, AlertTriangle } from "lucide-react";
import { hhmm } from "@/pages/admin/kegiatanUtils";

const STATUS_META = {
  hadir: { label: "Hadir", cls: "bg-[#E8F5EE] text-[#065F46] border-[#A7F3D0]" },
  izin: { label: "Izin", cls: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]" },
  alpha: { label: "Alpha", cls: "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]" },
};

/**
 * Daftar peserta rekap absen dalam bentuk DROPDOWN (accordion) yang bisa
 * dibuka/tutup, dengan baris berkolom berjarak:
 *
 *   Ageng Setiawan            12:00            Hadir
 *
 * Dipakai di modal Absensi (admin), halaman rekap publik, dan laporan publik.
 */
export default function PesertaRekapList({
  rows = [],
  counts,
  defaultOpen = false,
  searchable = true,
  title = "Daftar Peserta",
  testid = "rekap-peserta-list",
  renderActions,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    let list = rows;
    if (filter !== "all") list = list.filter((r) => (r.status || "alpha") === filter);
    const t = q.trim().toLowerCase();
    if (t) list = list.filter((r) => (r.name || "").toLowerCase().includes(t));
    return list;
  }, [rows, q, filter]);

  const tally = useMemo(() => {
    const c = { hadir: 0, izin: 0, alpha: 0 };
    rows.forEach((r) => { c[r.status || "alpha"] = (c[r.status || "alpha"] || 0) + 1; });
    return c;
  }, [rows]);

  const shown = counts || { total: rows.length, ...tally };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden" data-testid={testid}>
      {/* Header dropdown */}
      <button
        data-testid={`${testid}-toggle`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#FAFBF9] transition-colors"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="h-9 w-9 shrink-0 rounded-xl bg-[#E8F5EE] text-[#0D5C3A] flex items-center justify-center">
            <UserRound size={18} />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-[#111827] text-[15px]">{title}</span>
            <span className="block text-xs text-[#6B7280]">
              {shown.total} peserta · Hadir {shown.hadir} · Izin {shown.izin} · Alpha {shown.alpha}
            </span>
          </span>
        </span>
        <ChevronDown size={20} className={`shrink-0 text-[#6B7280] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-[#E5E7EB]" data-testid={`${testid}-body`}>
          {/* Filter + cari */}
          <div className="p-3 space-y-2.5 bg-[#FAFBF9]">
            {searchable && (
              <div className="relative">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  data-testid={`${testid}-search`}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama peserta..."
                  className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-[#E5E7EB] bg-white text-sm outline-none focus:border-[#0D5C3A]"
                />
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                ["all", `Semua (${rows.length})`],
                ["hadir", `Hadir (${tally.hadir})`],
                ["izin", `Izin (${tally.izin})`],
                ["alpha", `Alpha (${tally.alpha})`],
              ].map(([k, label]) => (
                <button
                  key={k}
                  data-testid={`${testid}-filter-${k}`}
                  onClick={() => setFilter(k)}
                  className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${
                    filter === k
                      ? "bg-[#0D5C3A] text-white border-[#0D5C3A]"
                      : "bg-white text-[#4B5563] border-[#E5E7EB] hover:border-[#0D5C3A]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Judul kolom */}
          <div className="px-4 py-2 grid grid-cols-[1fr_auto_auto] items-center gap-4 bg-[#F8FAF8] border-y border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
            <span>Nama</span>
            <span className="w-14 text-center">Jam</span>
            <span className="w-20 text-right">Status</span>
          </div>

          <ul className="divide-y divide-[#F1F2F0] max-h-[52vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-[#9CA3AF]">Tidak ada peserta yang cocok.</li>
            ) : filtered.map((r, i) => {
              const st = STATUS_META[r.status || "alpha"] || STATUS_META.alpha;
              const pending = r.account_status === "pending";
              return (
                <li
                  key={r.user_id || r.id || `${r.name}-${i}`}
                  data-testid={`${testid}-row-${r.user_id || r.id || i}`}
                  className="px-4 py-2.5 grid grid-cols-[1fr_auto_auto] items-center gap-4"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-[#111827] text-sm truncate">{r.name}</span>
                    {pending && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#92400E]">
                        <AlertTriangle size={11} /> Belum aktivasi
                      </span>
                    )}
                  </span>
                  <span className="w-14 text-center font-mono text-[13px] tabular-nums text-[#4B5563]">
                    {r.status === "hadir" && r.arrival_time ? hhmm(r.arrival_time) : "—"}
                  </span>
                  <span className="w-20 flex justify-end">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
                  </span>
                  {renderActions && <span className="col-span-3 pt-1">{renderActions(r)}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
