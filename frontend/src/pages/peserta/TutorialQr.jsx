// FASE 15 — Tutorial singkat pemakaian QR, ditampilkan di dashboard jamaah.
import { QrCode, ScanLine, ShieldCheck } from "lucide-react";

/**
 * Tutorial singkat pemakaian QR bagi jamaah.
 * variant="pribadi" → cara memakai QR pribadi (diabsen petugas)
 * variant="kegiatan" → cara scan QR kegiatan (absen mandiri)
 */
const STEPS = {
  pribadi: {
    icon: QrCode,
    title: "Cara pakai QR Pribadi Saya",
    steps: [
      "Buka menu QR Saya saat tiba di lokasi pengajian.",
      "Tunjukkan layar HP kepada petugas absen.",
      "Petugas memindai, kehadiran Anda langsung tercatat.",
    ],
    note: "Kode berganti otomatis tiap beberapa detik, jadi tetap aman walau sempat terlihat orang lain.",
  },
  kegiatan: {
    icon: ScanLine,
    title: "Cara scan QR Kegiatan",
    steps: [
      "Tap menu Scan, lalu izinkan pemakaian kamera.",
      "Arahkan kamera ke QR kegiatan yang dipasang pengurus.",
      "Tunggu sebentar — kehadiran Anda tercatat otomatis.",
    ],
    note: "Pastikan kegiatan masih berlangsung. Bila sudah ditutup, mohon hubungi pengurus untuk absen susulan.",
  },
};

export default function TutorialQr({ variant = "pribadi" }) {
  const cfg = STEPS[variant] || STEPS.pribadi;
  const Icon = cfg.icon;
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4" data-testid={`tutorial-qr-${variant}`}>
      <div className="flex items-center gap-2 text-[#0D5C3A] font-heading font-bold">
        <Icon size={18} /> {cfg.title}
      </div>
      <ol className="mt-2.5 space-y-2">
        {cfg.steps.map((s, i) => (
          <li key={s} className="flex gap-2.5 text-sm text-[#374151]">
            <span className="h-6 w-6 shrink-0 rounded-full bg-[#E8F5EE] text-[#065F46] text-xs font-bold flex items-center justify-center">{i + 1}</span>
            <span className="leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-[#6B7280] flex gap-2">
        <ShieldCheck size={14} className="shrink-0 mt-0.5 text-[#0D5C3A]" /> {cfg.note}
      </p>
    </div>
  );
}
