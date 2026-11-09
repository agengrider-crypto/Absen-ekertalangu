// Guided Product Tour: panduan langkah demi langkah dengan highlight pada elemen UI.
// Murni UI — tidak mengubah data atau fitur apa pun.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";
import { markTourSeen } from "@/components/AboutApp";
import { TOUR } from "@/constants/testIds";

const PAD = 6;

/**
 * Langkah tour. `target` adalah selector CSS elemen yang di-highlight.
 * Bila elemen tidak ditemukan (mis. di ponsel), langkah tetap tampil di tengah layar.
 */
export const TOUR_STEPS = [
  {
    id: "dashboard",
    target: '[data-testid="nav-dashboard"], [data-testid="admin-mobile-nav-dashboard"]',
    title: "Dashboard",
    body: "Ringkasan kehadiran bulan ini: total peserta, peserta yang perlu ditindaklanjuti, tren 6 bulan, dan daftar kegiatan mendatang.",
  },
  {
    id: "user",
    target: '[data-testid="nav-peserta"], [data-testid="admin-mobile-nav-peserta"]',
    title: "User",
    body: "Kelola akun jamaah: tambah peserta, aktivasi, pindah kelompok, dan buka detail bertab untuk melihat kehadiran serta QR pribadi.",
  },
  {
    id: "kegiatan",
    target: '[data-testid="nav-kegiatan"], [data-testid="admin-mobile-nav-kegiatan"]',
    title: "Daftar Kegiatan",
    body: "Buat jadwal pengajian, buka sesi absensi, dan bagikan kode akses. Kartu kegiatan bisa diketuk untuk membuka detail.",
  },
  {
    id: "rekap",
    target: '[data-testid="nav-rekap-bulanan"], [data-testid="admin-mobile-nav-rekap"]',
    title: "Rekap & Laporan",
    body: "Rekap harian, bulanan, dan laporan per peserta siap diunduh (Excel/PDF) atau dibagikan lewat WhatsApp.",
  },
  {
    id: "profil",
    target: '[data-testid="button-profile-menu"]',
    title: "Profil",
    body: "Menu akun: ubah profil, ganti peran, buka Update Terbaru, Tentang Aplikasi, dan ulangi tour ini kapan saja.",
  },
];

function findTarget(selector) {
  if (!selector) return null;
  for (const part of selector.split(",")) {
    const el = document.querySelector(part.trim());
    if (el) return el;
  }
  return null;
}

export default function GuidedTour({ onClose, onFinish, steps = TOUR_STEPS }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [ready, setReady] = useState(false);
  const cardRef = useRef(null);
  const [cardSize, setCardSize] = useState({ w: 320, h: 190 });

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const measure = useCallback(() => {
    const el = findTarget(step?.target);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) { setRect(null); return; }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    setReady(false);
    const el = findTarget(step?.target);
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    }
    const t = setTimeout(() => { measure(); setReady(true); }, 260);
    return () => clearTimeout(t);
  }, [step, measure]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [measure]);

  useEffect(() => {
    if (!cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    setCardSize({ w: r.width, h: r.height });
  }, [index, rect, ready]);

  const finish = useCallback(() => {
    markTourSeen();
    onFinish?.();
    onClose?.();
  }, [onFinish, onClose]);

  const skip = useCallback(() => {
    markTourSeen();
    onClose?.();
  }, [onClose]);

  const next = useCallback(() => {
    if (isLast) finish();
    else setIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [isLast, finish, steps.length]);

  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") skip();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [next, prev, skip]);

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const isMobile = vw < 640;

  const cardPos = useMemo(() => {
    const gap = 14;
    const w = Math.min(cardSize.w || 340, vw - 24);
    if (!rect) {
      return { left: Math.max(12, (vw - w) / 2), top: Math.max(12, (vh - (cardSize.h || 200)) / 2), width: w };
    }
    const below = rect.top + rect.height + gap;
    const above = rect.top - (cardSize.h || 200) - gap;
    let top = below;
    if (below + (cardSize.h || 200) > vh - 12 && above > 12) top = above;
    top = Math.min(Math.max(12, top), Math.max(12, vh - (cardSize.h || 200) - 12));
    let left = rect.left + rect.width / 2 - w / 2;
    left = Math.min(Math.max(12, left), Math.max(12, vw - w - 12));
    return { left, top, width: w };
  }, [rect, cardSize, vw, vh]);

  const content = (
    <div className="fixed inset-0 z-[95]" data-testid={TOUR.root} role="dialog" aria-modal="true" aria-label="Panduan aplikasi">
      {/* Lapisan gelap dengan lubang highlight */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-white/90 transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}

      {/* Kartu tooltip */}
      <div
        ref={cardRef}
        data-testid={TOUR.step}
        className="absolute rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-2xl transition-all duration-200"
        style={{ left: cardPos.left, top: cardPos.top, width: cardPos.width }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111114] text-white">
              <Sparkles size={14} />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
              Langkah {index + 1} dari {steps.length}
            </span>
          </div>
          <button
            type="button"
            onClick={skip}
            aria-label="Tutup panduan"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F4F4F1] hover:text-[#111114]"
          >
            <X size={16} />
          </button>
        </div>

        <h3 className="mt-2 font-heading text-base font-bold leading-tight text-[#111827]">{step?.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[#4B5563]">{step?.body}</p>

        <div className="mt-3 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-[#111114]" : "w-1.5 bg-[#D1D5DB]"}`}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            data-testid={TOUR.skip}
            onClick={skip}
            className="h-9 rounded-lg px-2 text-xs font-semibold text-[#6B7280] hover:bg-[#F4F4F1]"
          >
            Lewati
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid={TOUR.prev}
              onClick={prev}
              disabled={index === 0}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E8E8E4] px-3 text-xs font-semibold text-[#4B5563] hover:border-[#111114] disabled:opacity-40"
            >
              <ChevronLeft size={14} /> Sebelumnya
            </button>
            <button
              type="button"
              data-testid={TOUR.next}
              onClick={next}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#111114] px-3 text-xs font-semibold text-white hover:bg-black"
            >
              {isLast ? <>Selesai <Check size={14} /></> : <>Berikutnya <ChevronRight size={14} /></>}
            </button>
          </div>
        </div>
        {isMobile && <span className="sr-only">Gunakan tombol Sebelumnya dan Berikutnya untuk berpindah langkah.</span>}
      </div>
    </div>
  );

  if (typeof document === "undefined" || !document.body) return content;
  return createPortal(content, document.body);
}
