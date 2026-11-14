// Komponen bersama: pembagian peserta per status (Hadir/Izin/Sakit/Alpha/Belum absen).
// Dipakai di rekap gabungan, rekap harian, dan rekap bulanan (accordion tiap acara).
// Animasi: bilah progres terisi, angka naik (rAF ~0,7s), baris muncul bergantian.
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export const STATUS_ORDER = ["hadir", "izin", "sakit", "alpha", "belum_diabsen"];

export const STATUS_META = {
  hadir: { label: "Hadir", color: "#14633F", bg: "#E3F3EA", ink: "#0E4E31" },
  izin: { label: "Izin", color: "#1D4F91", bg: "#E3EEFB", ink: "#1D4F91" },
  sakit: { label: "Sakit", color: "#C98A00", bg: "#FBF1D6", ink: "#6B4500" },
  alpha: { label: "Alpha", color: "#A32A2A", bg: "#FBE5E3", ink: "#A32A2A" },
  belum_diabsen: { label: "Belum absen", color: "#9AA39C", bg: "#F0EEE6", ink: "#5F6B63" },
};

function prefersReduced() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Angka menghitung naik dari 0 ke nilai akhir (sekali, ~700ms). */
export function useCountUp(value, duration = 700) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(() => (prefersReduced() ? target : 0));
  useEffect(() => {
    if (prefersReduced()) { setShown(target); return undefined; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - p) * (1 - p);
      setShown(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return shown;
}

/** Bilah progres yang terisi dari 0. */
export function ProgressBar({ value, color = "#14633F", testid }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const [grown, setGrown] = useState(prefersReduced());
  useEffect(() => {
    if (prefersReduced()) { setGrown(true); return undefined; }
    const t = setTimeout(() => setGrown(true), 30);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F0EEE6]" data-testid={testid}>
      <div
        className="h-full origin-left rounded-full transition-transform duration-700 ease-out"
        style={{ width: `${v}%`, backgroundColor: color, transform: grown ? "scaleX(1)" : "scaleX(0)" }}
      />
    </div>
  );
}

function StatusBox({ status, count, active, onClick }) {
  const meta = STATUS_META[status];
  const shown = useCountUp(count);
  const empty = !Number(count);
  const cls = `rounded-xl border-2 px-2 py-2 text-center transition-all ${
    active ? "border-[#14633F] shadow-sm" : "border-transparent"
  } ${empty ? "opacity-45" : ""}`;
  const inner = (
    <>
      <div className="font-heading text-lg font-bold tabular-nums" style={{ color: meta.ink }}>
        {Math.round(shown)}
      </div>
      <div className="text-[11px] font-semibold" style={{ color: meta.ink }}>{meta.label}</div>
    </>
  );
  if (!onClick) {
    return (
      <div data-testid={`status-box-${status}`} className={cls} style={{ backgroundColor: meta.bg }}>
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={`status-box-${status}`}
      className={cls}
      style={{ backgroundColor: meta.bg }}
    >
      {inner}
    </button>
  );
}

/**
 * @param {object} counts  {hadir, izin, sakit, alpha, belum_diabsen, total}
 * @param {Array} rows     [{ name, status, reason }]
 * @param {boolean} showBelum tampilkan status "Belum absen"
 * @param {boolean} countOnly hanya blok jumlah (tanpa bilah & daftar nama)
 * @param {boolean} collapsible klik blok aktif menutup daftar nama
 * @param {boolean} showRatio tampilkan bilah persen di atas blok
 */
export default function StatusGroups({
  counts = {}, rows = [], showBelum = false, testid = "status-groups",
  defaultStatus = "hadir", title, countOnly = false, collapsible = false,
  showRatio = true, showReason = true,
}) {
  const statuses = showBelum ? STATUS_ORDER : STATUS_ORDER.filter((s) => s !== "belum_diabsen");
  const [active, setActive] = useState(defaultStatus);
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef(null);

  const grouped = useMemo(() => {
    const map = {};
    statuses.forEach((s) => { map[s] = []; });
    (rows || []).forEach((r) => {
      const st = map[r.status] ? r.status : "belum_diabsen";
      if (map[st]) map[st].push(r);
    });
    return map;
  }, [rows, statuses]);

  useEffect(() => { setShowAll(false); }, [active]);

  const list = grouped[active] || [];
  const shown = showAll ? list : list.slice(0, 3);
  const rest = list.length - shown.length;
  const total = Number(counts.total) || 0;
  const hadir = Number(counts.hadir) || 0;
  const ratio = total ? Math.round((hadir / total) * 100) : 0;
  const ratioShown = useCountUp(ratio);

  const pick = (s) => {
    if (collapsible && active === s) { setActive(null); return; }
    setActive(s);
  };

  return (
    <div className="space-y-3" data-testid={testid}>
      {title && <div className="text-sm font-semibold text-[#14201A]">{title}</div>}
      {showRatio && (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-heading text-2xl font-bold tabular-nums text-[#0E4E31]">
              {Math.round(ratioShown)}%
            </span>
            <span className="text-xs font-semibold text-[#5F6B63]">
              {hadir}/{total} hadir
            </span>
          </div>
          <div className="mt-1.5">
            <ProgressBar value={ratio} testid={`${testid}-bar`} />
          </div>
        </div>
      )}

      <div className={`grid gap-1.5 ${statuses.length >= 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {statuses.map((s) => (
          <StatusBox
            key={s}
            status={s}
            count={counts[s] || 0}
            active={active === s}
            onClick={countOnly ? null : () => pick(s)}
          />
        ))}
      </div>

      {!countOnly && active && (
        <div ref={listRef} className="rounded-xl border border-[#E7E3D8]">
          <div className="flex items-center justify-between gap-2 border-b border-[#F0EEE6] px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[#5F6B63]">
              {STATUS_META[active].label} ({list.length})
            </span>
            {list.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-[11px] font-semibold text-[#0E4E31] underline"
              >
                {showAll ? "Ringkas" : "Lihat semua"}
              </button>
            )}
          </div>
          {list.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-[#5F6B63]">Tidak ada peserta pada status ini.</p>
          ) : (
            <ul className="divide-y divide-[#F0EEE6]">
              {shown.map((r, i) => (
                <li
                  key={`${r.name}-${i}`}
                  className="flex min-h-9 items-center justify-between gap-2 px-3 py-1.5 motion-safe:animate-[reportCardIn_0.4s_ease-out_both]"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <span className="min-w-0 truncate text-sm text-[#14201A]">{r.name}</span>
                  {(active === "izin" || active === "sakit") && showReason && (
                    <span className="shrink-0 rounded-full bg-[#E3EEFB] px-2 py-0.5 text-[11px] font-semibold text-[#1D4F91]">
                      {r.reason || "-"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {rest > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="flex w-full items-center justify-center gap-1 border-t border-[#F0EEE6] px-3 py-2 text-[11px] font-semibold text-[#0E4E31]"
            >
              + {rest} peserta lainnya · Lihat semua <ChevronDown size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
