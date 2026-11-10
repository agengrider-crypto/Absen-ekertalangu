import { useMemo, useState } from "react";
import { ChevronDown, Search, UserRound, AlertTriangle } from "lucide-react";
import { hhmm } from "@/pages/admin/kegiatanUtils";

const STATUS_META = {
  hadir: { label: "Hadir", cls: "bg-[#E3F3EA] text-[#0E4E31] border-[#D9D4C5]" },
  izin: { label: "Izin", cls: "bg-[#FBF1D6] text-[#6B4500] border-[#EAD596]" },
  sakit: { label: "Sakit", cls: "bg-[#E3EEFB] text-[#1D4F91] border-[#E3EEFB]" },
  alpha: { label: "Alpha", cls: "bg-[#FBE5E3] text-[#A32A2A] border-[#FBE5E3]" },
  belum_diabsen: { label: "Belum diabsen", cls: "bg-[#F0EEE6] text-[#5F6B63] border-[#E7E3D8]" },
  optional: { label: "Tidak wajib", cls: "bg-[#D9F2F4] text-[#6D3FC8] border-[#ECE4FB]" },
};

function statusOf(row) {
  return row.status || (row.required_for_session === false ? "optional" : "belum_diabsen");
}
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
    if (filter !== "all") list = list.filter((r) => statusOf(r) === filter);
    const t = q.trim().toLowerCase();
    if (t) list = list.filter((r) => (r.name || "").toLowerCase().includes(t));
    return list;
  }, [rows, q, filter]);

  const tally = useMemo(() => {
    const c = { hadir: 0, izin: 0, sakit: 0, alpha: 0, belum_diabsen: 0, optional: 0 };
    rows.forEach((r) => { const status = statusOf(r); c[status] = (c[status] || 0) + 1; });
    return c;
  }, [rows]);

  const shown = counts || { total: rows.length, ...tally };

  return (
    <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden" data-testid={testid}>
      {/* Header dropdown */}
      <button
        data-testid={`${testid}-toggle`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F6F4EE] transition-colors"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="h-9 w-9 shrink-0 rounded-xl bg-[#E3F3EA] text-[#0E4E31] flex items-center justify-center">
            <UserRound size={18} />
          </span>
          <span className="min-w-0">
            <span className="block font-bold text-[#14201A] text-[15px]">{title}</span>
            <span className="block text-xs text-[#5F6B63]">
              {shown.total} peserta · Hadir {shown.hadir} · Izin {shown.izin} · Sakit {shown.sakit || 0}
              {" · "}Alpha {shown.alpha} · Belum diabsen {shown.belum_diabsen || 0}
            </span>
          </span>
        </span>
        <ChevronDown size={20} className={`shrink-0 text-[#5F6B63] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-[#E7E3D8]" data-testid={`${testid}-body`}>
          {/* Filter + cari */}
          <div className="p-3 space-y-2.5 bg-[#F6F4EE]">
            {searchable && (
              <div className="relative">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
                <input
                  data-testid={`${testid}-search`}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama peserta..."
                  className="w-full h-11 pl-11 pr-4 rounded-xl border border-[#8A948D] bg-white text-sm outline-none focus:border-[#14633F]"
                />
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                ["all", `Semua (${rows.length})`],
                ["hadir", `Hadir (${tally.hadir})`],
                ["izin", `Izin (${tally.izin})`],
                ["sakit", `Sakit (${tally.sakit})`],
                ["alpha", `Alpha (${tally.alpha})`],
                ["belum_diabsen", `Belum diabsen (${tally.belum_diabsen})`],
              ].map(([k, label]) => (
                <button
                  key={k}
                  data-testid={`${testid}-filter-${k}`}
                  onClick={() => setFilter(k)}
                  className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${
                    filter === k
                      ? "bg-[#14633F] text-white border-[#14633F]"
                      : "bg-white text-[#5F6B63] border-[#E7E3D8] hover:border-[#14633F]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Judul kolom */}
          <div className="px-4 py-2 grid grid-cols-[1fr_auto_auto] items-center gap-4 bg-[#F6F4EE] border-y border-[#E7E3D8] text-[11px] font-bold uppercase tracking-wide text-[#5F6B63]">
            <span>Nama</span>
            <span className="w-14 text-center">Jam</span>
            <span className="w-20 text-right">Status</span>
          </div>

          <ul className="divide-y divide-[#E7E3D8] max-h-[52vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-[#5F6B63]">Tidak ada peserta yang cocok.</li>
            ) : filtered.map((r, i) => {
              const status = statusOf(r);
              const st = STATUS_META[status] || STATUS_META.belum_diabsen;
              const pending = r.account_status === "pending";
              return (
                <li
                  key={r.user_id || r.id || `${r.name}-${i}`}
                  data-testid={`${testid}-row-${r.user_id || r.id || i}`}
                  className="px-4 py-2.5 grid grid-cols-[1fr_auto_auto] items-center gap-4"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-[#14201A] text-sm truncate">{r.name}</span>
                    {pending && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#6B4500]">
                        <AlertTriangle size={11} /> Belum aktivasi
                      </span>
                    )}
                  </span>
                  <span className="w-14 text-center font-mono text-[13px] tabular-nums text-[#5F6B63]">
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
