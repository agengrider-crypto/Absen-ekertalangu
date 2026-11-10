/**
 * LOGO K1 — sumber tunggal.
 * Varian:
 *   - "light" : kotak hijau #0B6B52, batang K putih, lengan emas (untuk latar terang)
 *   - "dark"  : kotak emas #F2C14E, batang K #08503D, lengan putih (untuk latar gelap)
 * Wordmark: "E-" berat 500 + "Kertalangu" berat 800, font Plus Jakarta Sans.
 */
import { APP_INFO } from "@/lib/appInfo";

export const K1_COLORS = {
  green: "#0B6B52",
  greenDark: "#08503D",
  gold: "#F2C14E",
  white: "#FFFFFF",
};

export const TAGLINE = "Absensi Digitalisasi Pengajian";

/** Ikon K1 saja (SVG inline). */
export function K1Mark({ size = 40, variant = "light", className = "", title = "K1" }) {
  const dark = variant === "dark";
  const box = dark ? K1_COLORS.gold : K1_COLORS.green;
  const stem = dark ? K1_COLORS.greenDark : K1_COLORS.white;
  const arm = dark ? K1_COLORS.white : K1_COLORS.gold;

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="8" y="8" width="104" height="104" rx="28" fill={box} />
      <g fill="none" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
        <path d="M42 32V88M59 49L80 88" stroke={stem} />
        <path d="M42 62L80 32" stroke={arm} />
      </g>
    </svg>
  );
}

/** Wordmark "E-Kertalangu". */
export function K1Wordmark({ variant = "light", className = "", size = "text-lg" }) {
  const dark = variant === "dark";
  return (
    <span
      className={`font-heading leading-tight tracking-tight ${size} ${className}`}
      style={{ fontFamily: "'Plus Jakarta Sans', 'Instrument Sans', sans-serif" }}
    >
      <span style={{ fontWeight: 500, color: dark ? K1_COLORS.gold : K1_COLORS.green }}>E-</span>
      <span style={{ fontWeight: 800, color: dark ? K1_COLORS.white : K1_COLORS.green }}>Kertalangu</span>
    </span>
  );
}

/**
 * Logo lengkap: ikon + wordmark (+ tagline opsional).
 * @param {number} size        ukuran ikon (px)
 * @param {"light"|"dark"} variant
 * @param {boolean} showText   tampilkan wordmark
 * @param {boolean} showTagline tampilkan tagline
 */
export const Logo = ({
  size = 44,
  variant = "light",
  showText = true,
  showTagline = false,
  subtitle,
  className = "",
}) => (
  <div className={`flex items-center gap-3 ${className}`} data-testid="app-logo">
    <K1Mark size={size} variant={variant} title={APP_INFO.name} />
    {showText && (
      <div className="leading-tight min-w-0">
        <K1Wordmark variant={variant} size={size >= 48 ? "text-xl" : "text-lg"} />
        {showTagline ? (
          <div
            className={`text-xs font-medium ${variant === "dark" ? "text-white/75" : "text-[#5F6B63]"}`}
          >
            {TAGLINE}
          </div>
        ) : subtitle ? (
          <div className={`text-xs font-medium ${variant === "dark" ? "text-white/75" : "text-[#5F6B63]"}`}>
            {subtitle}
          </div>
        ) : null}
      </div>
    )}
  </div>
);

export default Logo;
