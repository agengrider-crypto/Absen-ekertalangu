// Header seragam untuk SEMUA halaman laporan/rekap.
// Judul di tengah: kata pertama warna teks normal, kata berikutnya hijau tema.
// Ikon orang (opsional) di kiri judul, satu kelompok di tengah layar.
import { UserRound } from "lucide-react";

// Varian skema warna judul. Ganti ke "warnaLain" bila nanti diminta
// skema hijau + oranye tanpa mengubah pemanggil.
export const REPORT_TITLE_SCHEME = {
  hijau: { rest: "#14633F" },
  warnaLain: { rest: "#C2410C" },
};
export const REPORT_TITLE_VARIANT = "hijau";

/**
 * @param {string} title   judul lengkap, mis. "Laporan Rekap Gabungan"
 * @param {string} subtitle teks chip kecil (tanggal/periode, boleh dengan jam)
 * @param {boolean} showUserIcon tampilkan ikon orang di kiri judul
 * @param {function} onUserClick bila diisi, ikon bisa diketuk (halaman login)
 */
export default function ReportHeader({
  title = "Laporan",
  subtitle = "",
  showUserIcon = false,
  onUserClick,
  compact = false,
  testid = "report-header",
}) {
  const words = String(title).trim().split(/\s+/);
  const first = words.shift() || "Laporan";
  const rest = words.join(" ");
  const scheme = REPORT_TITLE_SCHEME[REPORT_TITLE_VARIANT] || REPORT_TITLE_SCHEME.hijau;

  const icon = showUserIcon ? (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E3F3EA] text-[#0E4E31]"
      aria-hidden={onUserClick ? undefined : "true"}
    >
      <UserRound size={16} />
    </span>
  ) : null;

  return (
    <header className={compact ? "pb-2" : "px-4 pb-3 pt-5"} data-testid={testid}>
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 text-center">
        <div className="flex items-center justify-center gap-2">
          {icon && (onUserClick ? (
            <button
              type="button"
              onClick={onUserClick}
              data-testid={`${testid}-user`}
              aria-label="Buka profil peserta"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E3F3EA] text-[#0E4E31] transition-colors hover:bg-[#D3EBDD]"
            >
              <UserRound size={16} />
            </button>
          ) : icon)}
          <h1 className="font-heading text-[18px] font-semibold leading-tight text-[#14201A]">
            {first}
            {rest ? <span style={{ color: scheme.rest }}> {rest}</span> : null}
          </h1>
        </div>
        {subtitle ? (
          <span
            className="inline-flex max-w-full items-center justify-center rounded-full bg-[#E3F3EA] px-3 py-1 text-[11px] font-semibold text-[#0E4E31]"
            data-testid={`${testid}-period`}
          >
            {subtitle}
          </span>
        ) : null}
      </div>
    </header>
  );
}
