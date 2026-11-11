// Jejak halaman di header — satu pola untuk semua halaman admin/pengurus.
// Bentuk: "E-Kertalangu / Halaman" (maks. 3 tingkat), di kanan ada peran + inisial.
import { ChevronRight } from "lucide-react";

const ROLE_LABEL = { admin: "Administrator", pengurus: "Pengurus", peserta: "Peserta" };

function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * @param {Array<{label: string, onClick?: Function}>} items  jejak setelah "E-Kertalangu"
 * @param {string} role   "admin" | "pengurus"
 * @param {string} name   nama pengguna untuk inisial
 */
export default function PageTrail({ items = [], role = "admin", name = "" }) {
  const trail = items.filter((i) => i && i.label);
  return (
    <nav
      aria-label="Jejak halaman"
      data-testid="page-trail"
      className="flex min-w-0 items-center gap-2"
    >
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
        <li className="shrink-0 text-[#5F6B63]">E-Kertalangu</li>
        {trail.map((item, index) => {
          const last = index === trail.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight size={14} className="shrink-0 text-[#8A948D]" aria-hidden="true" />
              {last || !item.onClick ? (
                <span
                  className={`min-w-0 truncate ${last ? "font-bold text-[#14201A]" : "text-[#5F6B63]"}`}
                  aria-current={last ? "page" : undefined}
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

      <span className="ml-1 hidden shrink-0 items-center gap-2 sm:flex">
        <span className="text-[13px] font-semibold text-[#14201A]">{ROLE_LABEL[role] || ROLE_LABEL.admin}</span>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#14633F] text-[12px] font-bold text-white"
          aria-hidden="true"
        >
          {initials(name)}
        </span>
      </span>
    </nav>
  );
}
