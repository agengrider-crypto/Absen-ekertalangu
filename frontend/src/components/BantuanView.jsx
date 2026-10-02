// FASE 18 — Menu Bantuan (tersedia di semua peran) — segera hadir.
import { LifeBuoy, Sparkles, BookOpen, MessageCircleQuestion, PhoneCall } from "lucide-react";

const ITEMS = [
  { icon: BookOpen, title: "Panduan Pemakaian", desc: "Langkah memakai absensi, QR, dan rekap untuk tiap peran." },
  { icon: MessageCircleQuestion, title: "Tanya Jawab", desc: "Kumpulan pertanyaan yang sering ditanyakan pengurus & peserta." },
  { icon: PhoneCall, title: "Hubungi Pengurus", desc: "Kontak cepat bila ada kendala akun atau kehadiran." },
];

export default function BantuanView() {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E4] p-6 sm:p-8" data-testid="bantuan-view">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-[#F1F1EE] text-[#111114] px-3 py-1 rounded-full text-sm font-semibold mb-4">
          <Sparkles size={16} /> Segera Hadir
        </div>
        <h1 className="font-heading text-2xl font-bold text-[#111827] inline-flex items-center gap-2">
          <LifeBuoy size={22} /> Bantuan
        </h1>
        <p className="text-[#4B5563] mt-2 max-w-xl mx-auto leading-relaxed">
          Pusat bantuan sedang disiapkan: panduan pemakaian, tanya jawab, dan kontak pengurus
          akan tersedia di halaman ini.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mt-6">
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.title} className="rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] p-4">
              <Icon size={18} className="text-[#111114]" />
              <div className="font-semibold text-[#111827] text-sm mt-2">{it.title}</div>
              <p className="text-xs text-[#6B7280] mt-1 leading-relaxed">{it.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
