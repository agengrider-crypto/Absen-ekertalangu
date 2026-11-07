// Halaman "Tentang Aplikasi": identitas aplikasi, riwayat update, dan pintu masuk
// Guided Product Tour. Hanya UI — tidak memanggil API apa pun.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Info, Sparkles, Play, ChevronRight, CheckCircle2, CalendarDays,
  ShieldCheck, Users, HeartHandshake, Mail, Globe, Smartphone, Layers,
} from "lucide-react";
import { UPDATES } from "@/components/UpdateModal";
import { useAuth } from "@/context/AuthContext";
import { rolesLabel } from "@/lib/roles";

export const APP_INFO = {
  name: "E-KERTALANGU",
  tagline: "Absensi Pengajian",
  version: "1.4.0",
  build: "2026.11.08",
  developer: "Ageng Rider",
  developerNote: "Dikembangkan untuk Majelis / Kelompok Kertalangu",
  copyright: "© 2026 E-KERTALANGU. Seluruh hak cipta dilindungi.",
  contact: "ageng.rider@gmail.com",
  website: "absen-ekertalangu.vercel.app",
  platform: "Web (mobile-first)",
};

const TOUR_STORAGE_KEY = "ekertalangu.tourSeen";

/** True bila tour untuk versi terbaru belum pernah dijalankan pengguna. */
export function hasUnseenTour() {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) !== APP_INFO.version;
  } catch {
    return false;
  }
}

export function markTourSeen() {
  try { localStorage.setItem(TOUR_STORAGE_KEY, APP_INFO.version); } catch { /* abaikan */ }
}

function fmtDate(iso) {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

function InfoRow({ icon: Icon, label, value, href }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F1F1EE] text-[#111114]">
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{label}</div>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="break-words text-sm font-medium text-[#111827] underline decoration-[#D1D5DB] underline-offset-2 hover:decoration-[#111114]">
            {value}
          </a>
        ) : (
          <div className="break-words text-sm font-medium text-[#111827]">{value}</div>
        )}
      </div>
    </div>
  );
}

export default function AboutApp({ onClose, onStartTour }) {
  const { user } = useAuth();
  const isStaff = (user?.roles || []).some((r) => r === "admin" || r === "pengurus");
  const [activeUpdate, setActiveUpdate] = useState(UPDATES[0]?.id || null);
  const latest = useMemo(() => UPDATES[0], []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const content = (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        data-testid="about-app-modal"
        className="relative flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#F7F7F5] shadow-2xl sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#ECECE8] bg-white px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F1F1EE] p-1">
              <img src="/logo.png" alt="" className="h-full w-full object-contain" />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-bold leading-tight text-[#111827]">Tentang Aplikasi</h2>
              <p className="mt-0.5 truncate text-xs text-[#6B7280]">{APP_INFO.name} · v{APP_INFO.version}</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="about-app-close"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F4F4F1]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="space-y-3.5">
            {/* Identitas aplikasi */}
            <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#F1F1EE] p-1.5">
                  <img src="/logo.png" alt={APP_INFO.name} className="h-full w-full object-contain" />
                </span>
                <div className="min-w-0">
                  <div className="font-heading text-base font-bold text-[#111827]">{APP_INFO.name}</div>
                  <div className="text-xs text-[#6B7280]">{APP_INFO.tagline}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#111114] px-2 py-0.5 text-[11px] font-semibold text-white">v{APP_INFO.version}</span>
                    <span className="rounded-full bg-[#F1F1EE] px-2 py-0.5 text-[11px] font-semibold text-[#374151]">build {APP_INFO.build}</span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-[#4B5563]">
                Aplikasi absensi pengajian untuk Majelis/Kelompok Kertalangu. Mencatat kehadiran lewat
                absen manual, QR pribadi, dan QR kegiatan, lalu menyajikan rekap harian, bulanan, dan
                laporan per peserta.
              </p>
            </div>

            {/* Informasi teknis */}
            <div className="rounded-2xl border border-[#E8E8E4] bg-white px-4 py-1.5">
              <InfoRow icon={Layers} label="Versi aplikasi" value={`${APP_INFO.version} (build ${APP_INFO.build})`} />
              <InfoRow icon={Smartphone} label="Platform" value={APP_INFO.platform} />
              <InfoRow icon={Users} label="Peran pengguna" value="Admin · Pengurus · Peserta · Guru" />
              <InfoRow icon={ShieldCheck} label="Keamanan" value="Sesi cookie httpOnly, kata sandi terenkripsi" />
              <InfoRow icon={Globe} label="Situs" value={APP_INFO.website} href={`https://${APP_INFO.website}`} />
              <InfoRow icon={Mail} label="Kontak pengembang" value={APP_INFO.contact} href={`mailto:${APP_INFO.contact}`} />
            </div>

            {/* Pengembang & hak cipta */}
            <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
                <HeartHandshake size={15} /> Pengembang
              </div>
              <div className="mt-1.5 text-sm font-medium text-[#111827]">{APP_INFO.developer}</div>
              <p className="mt-0.5 text-xs leading-relaxed text-[#6B7280]">{APP_INFO.developerNote}</p>
              <div className="mt-3 border-t border-[#F1F1EE] pt-3 text-[11px] leading-relaxed text-[#9CA3AF]">
                {APP_INFO.copyright}
              </div>
            </div>

            {/* Riwayat update — hanya admin & pengurus */}
            {isStaff && (
              <div className="rounded-2xl border border-[#E8E8E4] bg-white" data-testid="about-update-history">
                <div className="flex items-center justify-between gap-2 border-b border-[#F1F1EE] px-4 py-3">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]">
                    <Sparkles size={15} /> Riwayat Update
                  </div>
                  <span className="text-[11px] text-[#9CA3AF]">{UPDATES.length} catatan</span>
                </div>

                <div className="px-4 py-3">
                  <button
                    type="button"
                    data-testid="about-start-tour"
                    onClick={() => onStartTour?.(latest?.id)}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#111114] text-sm font-semibold text-white hover:bg-black"
                  >
                    <Play size={16} /> Mulai Tour Panduan
                  </button>
                  <p className="mt-1.5 text-center text-[11px] text-[#9CA3AF]">
                    Panduan singkat menandai bagian yang baru diperbarui.
                  </p>
                </div>

                <ul className="divide-y divide-[#F1F1EE] border-t border-[#F1F1EE]">
                  {UPDATES.map((u) => {
                    const open = activeUpdate === u.id;
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          data-testid={`about-update-${u.id}`}
                          onClick={() => setActiveUpdate(open ? null : u.id)}
                          aria-expanded={open}
                          className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[#FAFAF8]"
                        >
                          <CalendarDays size={14} className="shrink-0 text-[#9CA3AF]" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-[#111827]">{u.title}</div>
                            <div className="text-[11px] text-[#9CA3AF]">{fmtDate(u.date)}</div>
                          </div>
                          <ChevronRight size={16} className={`shrink-0 text-[#9CA3AF] transition-transform ${open ? "rotate-90" : ""}`} />
                        </button>
                        {open && (
                          <div className="bg-[#FAFAF8] px-4 pb-3">
                            <ul className="space-y-1.5">
                              {u.items.map((it, i) => (
                                <li key={i} className="flex gap-2 text-[13px] leading-snug text-[#4B5563]">
                                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#15803D]" />
                                  <span>{it}</span>
                                </li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              data-testid={`about-tour-${u.id}`}
                              onClick={() => onStartTour?.(u.id)}
                              className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E8E8E4] bg-white px-3 text-xs font-semibold text-[#111114] hover:border-[#111114]"
                            >
                              <Play size={13} /> Jalankan tour ini
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {!isStaff && (
              <div className="flex items-start gap-2 rounded-2xl border border-[#E8E8E4] bg-white p-3.5 text-xs leading-relaxed text-[#6B7280]">
                <Info size={15} className="mt-0.5 shrink-0 text-[#9CA3AF]" />
                <span>
                  Anda masuk sebagai <b className="text-[#111827]">{rolesLabel(user?.roles) || "Peserta"}</b>.
                  Riwayat update dan panduan produk tersedia untuk Admin dan Pengurus.
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-[#ECECE8] bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-full rounded-xl bg-[#F4F4F1] text-sm font-semibold text-[#4B5563] hover:bg-[#E9EDE9]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined" || !document.body) return content;
  return createPortal(content, document.body);
}
