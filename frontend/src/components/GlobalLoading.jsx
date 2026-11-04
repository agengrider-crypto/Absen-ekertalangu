/** Kerangka tabel/daftar saat data sedang dimuat. */
export function SkeletonList({ rows = 5, testid = "skeleton-list" }) {
  return (
    <div className="space-y-2.5" data-testid={testid}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-[#F1F3F1] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}
