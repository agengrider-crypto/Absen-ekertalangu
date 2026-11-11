// Jejak halaman di header — satu pola untuk semua halaman admin/pengurus.
// Bentuk: "E-Kertalangu / Halaman" (maks. 3 tingkat).
// Identitas pengguna & peran hanya di kanan atas (ProfileMenu).
import { ChevronRight } from "lucide-react";

/**
 * @param {Array<{label: string, onClick?: Function}>} items  jejak setelah "E-Kertalangu"
 * @param {boolean} compact  di HP hanya tampilkan nama halaman terakhir
 */
export default function PageTrail({ items = [], compact = false }) {
  const trail = items.filter((i) => i && i.label);
  const last = trail[trail.length - 1];

  if (compact) {
    return (
      <nav aria-label="Jejak halaman" data-testid="page-trail" className="flex min-w-0 items-center">
        <span className="min-w-0 truncate text-[15px] font-bold text-[#14201A]" aria-current="page">
          {last?.label || "Dashboard"}
        </span>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Jejak halaman"
      data-testid="page-trail"
      className="flex min-w-0 items-center gap-2"
    >
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <li className="shrink-0 text-[#5F6B63]">E-Kertalangu</li>
        {trail.map((item, index) => {
          const isLast = index === trail.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight size={14} className="shrink-0 text-[#8A948D]" aria-hidden="true" />
              {isLast || !item.onClick ? (
                <span
                  className={`min-w-0 truncate ${isLast ? "font-bold text-[#14201A]" : "text-[#5F6B63]"}`}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="min-w-0 truncate rounded text-[#5F6B63] transition-colors hover:text-[#0E4E31] hover:underline"
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
