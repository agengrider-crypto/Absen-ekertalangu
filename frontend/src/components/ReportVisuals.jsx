// Primitif visual laporan: ring persen, bar bertumpuk, kartu angka, animasi
// hitung naik. Murni CSS + requestAnimationFrame, tanpa library animasi.
import { useEffect, useRef, useState } from "react";

export const REPORT_COLORS = {
  hadir: "#14633F",
  izin: "#C98A00",
  sakit: "#1D4F91",
  alpha: "#A32A2A",
  belum: "#9AA39C",
};

function prefersReduced() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Angka menghitung naik dari nilai lama ke nilai baru (sekali, ~700ms). */
export function useCountUp(value, { duration = 700, from = 0 } = {}) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(() => (prefersReduced() ? target : from));
  const fromRef = useRef(prefersReduced() ? target : from);

  useEffect(() => {
    if (prefersReduced()) { setShown(target); fromRef.current = target; return undefined; }
    const start = fromRef.current;
    if (start === target) { setShown(target); return undefined; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - (1 - p) * (1 - p);
      setShown(start + (target - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return shown;
}

/** Ring persen: terisi dari 0 (atau nilai lama) ke nilai akhir. */
export function PercentRing({ value, size = 84, stroke = 8, color = REPORT_COLORS.hadir, label }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const shown = useCountUp(v);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} data-testid="report-ring">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0EEE6" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c - (c * shown) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-lg font-bold tabular-nums text-[#14201A]">{Math.round(shown)}%</span>
        {label ? <span className="text-[10px] font-semibold text-[#5F6B63]">{label}</span> : null}
      </div>
    </div>
  );
}

/** SATU bar bertumpuk: Hadir / Izin / Sakit / Alpha (/ Belum diabsen). */
export function StackedBar({ counts = {}, showBelum = false, testid = "report-stacked-bar" }) {
  const parts = [
    { key: "hadir", color: REPORT_COLORS.hadir },
    { key: "izin", color: REPORT_COLORS.izin },
    { key: "sakit", color: REPORT_COLORS.sakit },
    { key: "alpha", color: REPORT_COLORS.alpha },
  ];
  if (showBelum) parts.push({ key: "belum_diabsen", color: REPORT_COLORS.belum });
  const total = parts.reduce((sum, p) => sum + (Number(counts[p.key]) || 0), 0);
  const [grown, setGrown] = useState(prefersReduced());
  useEffect(() => {
    if (prefersReduced()) { setGrown(true); return undefined; }
    const t = setTimeout(() => setGrown(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-[#F0EEE6]" data-testid={testid}>
      <div
        className="flex h-full w-full origin-left report-motion transition-transform duration-700 ease-out"
        style={{ transform: grown ? "scaleX(1)" : "scaleX(0)" }}
      >
        {total === 0 ? <div className="h-full flex-1 bg-[#E7E3D8]" /> : parts.map((p) => {
          const n = Number(counts[p.key]) || 0;
          if (!n) return null;
          return <div key={p.key} className="h-full report-motion transition-[width] duration-500 ease-out" style={{ width: `${(n / total) * 100}%`, backgroundColor: p.color }} />;
        })}
      </div>
    </div>
  );
}

/** Kartu angka berwarna dengan angka menghitung naik. */
export function StatCard({ label, value, color = "#14201A", bg = "#FFFFFF", testid }) {
  const shown = useCountUp(value);
  return (
    <div className="rounded-2xl border border-[#E7E3D8] p-3 text-center" style={{ backgroundColor: bg }} data-testid={testid}>
      <div className="font-heading text-xl font-bold tabular-nums" style={{ color }}>{Math.round(shown)}</div>
      <div className="mt-0.5 text-[11px] font-semibold text-[#5F6B63]">{label}</div>
    </div>
  );
}

/** Pembungkus kartu dengan animasi muncul bergantian (jeda ~90ms). */
export function ReportCard({ index = 0, className = "", children, testid }) {
  return (
    <div
      className={`report-card-in ${className}`}
      style={{ animationDelay: `${Math.min(index, 12) * 90}ms` }}
      data-testid={testid}
    >
      {children}
    </div>
  );
}
