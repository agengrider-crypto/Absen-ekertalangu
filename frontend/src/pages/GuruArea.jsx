// FASE 18 — Area Guru / Pengajar (segera hadir) + menu Bantuan.
import { useState } from "react";
import { GraduationCap, LifeBuoy, Sparkles, BookOpen, ClipboardList } from "lucide-react";
import ProfileMenu from "@/components/ProfileMenu";
import BantuanView from "@/components/BantuanView";
import DemoBanner from "@/components/DemoBanner";

const TABS = [
  { key: "beranda", label: "Beranda", icon: GraduationCap },
  { key: "bantuan", label: "Bantuan", icon: LifeBuoy },
];

export default function GuruArea({ user }) {
  const [tab, setTab] = useState("beranda");

  return (
    <div className="min-h-screen bg-[#FAFAF8]" data-testid="guru-area">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#E8E8E4]">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#F1F1EE] flex items-center justify-center overflow-hidden p-1">
              <img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <div className="font-heading font-bold text-[#111114] text-sm">E-KERTALANGU</div>
              <div className="text-[11px] text-[#9CA3AF]">Area Guru / Pengajar</div>
            </div>
          </div>
          <ProfileMenu subtitle="Guru / Pengajar" />
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto no-scrollbar" data-testid="guru-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                data-testid={`guru-tab-${t.key}`}
                onClick={() => setTab(t.key)}
                className={`shrink-0 h-10 px-3.5 rounded-xl font-semibold text-sm inline-flex items-center gap-2 border-2 transition-colors ${
                  on ? "bg-[#111114] text-white border-transparent" : "bg-white text-[#4B5563] border-[#E8E8E4] hover:border-[#111114] hover:text-[#111114]"
                }`}
              >
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <DemoBanner />
        {tab === "beranda" ? (
          <div className="bg-white rounded-2xl border border-[#E8E8E4] p-8 text-center" data-testid="guru-coming-soon">
            <div className="inline-flex items-center gap-2 bg-[#F1F1EE] text-[#111114] px-3 py-1 rounded-full text-sm font-semibold mb-4">
              <Sparkles size={16} /> Segera Hadir
            </div>
            <h1 className="font-heading text-2xl font-bold text-[#111827]">Area Guru / Pengajar</h1>
            <p className="text-[#4B5563] mt-2 max-w-xl mx-auto leading-relaxed">
              Halo {user?.name || "Ustadz/Ustadzah"} — area khusus pengajar sedang disiapkan. Nanti
              di sini tersedia jadwal mengajar, materi pembelajaran, dan catatan perkembangan peserta.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-6 text-left max-w-xl mx-auto">
              <div className="rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] p-4">
                <BookOpen size={18} className="text-[#111114]" />
                <div className="font-semibold text-[#111827] text-sm mt-2">Materi &amp; Silabus</div>
                <p className="text-xs text-[#6B7280] mt-1">Kelola materi tiap pertemuan beserta sumbernya.</p>
              </div>
              <div className="rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] p-4">
                <ClipboardList size={18} className="text-[#111114]" />
                <div className="font-semibold text-[#111827] text-sm mt-2">Catatan Peserta</div>
                <p className="text-xs text-[#6B7280] mt-1">Pantau perkembangan dan hafalan peserta per kelompok.</p>
              </div>
            </div>
          </div>
        ) : (
          <BantuanView />
        )}
      </main>
    </div>
  );
}
