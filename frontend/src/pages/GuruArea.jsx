// Area Guru / Pengajar — sidebar desktop (8 menu) + menu bawah 5 tab di HP.
// Semua data lewat getGuruScope: guru = miliknya, Administrator = semua.
import { useState } from "react";
import {
  LifeBuoy, BookOpen, CalendarClock, ClipboardCheck, Users,
  NotebookPen, Megaphone, Home, LayoutGrid, ArrowLeftRight, X, ChevronRight,
} from "lucide-react";
import ProfileMenu from "@/components/ProfileMenu";
import BantuanView from "@/components/BantuanView";
import DemoBanner from "@/components/DemoBanner";
import ProgramPembelajaran from "@/pages/admin/ProgramPembelajaran";
import { K1Mark } from "@/components/Logo";
import GuruBeranda from "./guru/GuruBeranda";
import GuruJadwal from "./guru/GuruJadwal";
import GuruAbsenKelas from "./guru/GuruAbsenKelas";
import GuruKelas from "./guru/GuruKelas";

const MENU = [
  { group: null, items: [{ key: "beranda", label: "Beranda", icon: Home }] },
  {
    group: "MENGAJAR",
    items: [
      { key: "jadwal", label: "Jadwal Saya", icon: CalendarClock },
      { key: "absen", label: "Absen Kelas", icon: ClipboardCheck },
      { key: "kelas", label: "Kelas Saya", icon: Users },
    ],
  },
  {
    group: "PERKEMBANGAN",
    items: [{ key: "catatan", label: "Catatan Peserta", icon: NotebookPen, soon: true }],
  },
  {
    group: "KOMUNIKASI",
    items: [{ key: "pengumuman", label: "Pengumuman Kelas", icon: Megaphone, soon: true }],
  },
  {
    group: "PROGRAM",
    items: [
      { key: "program", label: "Program Pembelajaran", icon: BookOpen },
      { key: "bantuan", label: "Bantuan", icon: LifeBuoy },
    ],
  },
];

const BOTTOM = [
  { key: "beranda", label: "Beranda", icon: Home },
  { key: "kelas", label: "Kelas", icon: Users },
  { key: "absen", label: "Absen", icon: ClipboardCheck, center: true },
  { key: "catatan", label: "Catatan", icon: NotebookPen, soon: true },
  { key: "lainnya", label: "Lainnya", icon: LayoutGrid },
];

const LAINNYA = [
  { key: "jadwal", label: "Jadwal Saya", icon: CalendarClock },
  { key: "pengumuman", label: "Pengumuman Kelas", icon: Megaphone, soon: true },
  { key: "program", label: "Program Pembelajaran", icon: BookOpen },
  { key: "bantuan", label: "Bantuan", icon: LifeBuoy },
];

export default function GuruArea({ user }) {
  const [tab, setTab] = useState("beranda");
  const [absenId, setAbsenId] = useState(null);
  const [more, setMore] = useState(false);

  const isAdmin = (user?.roles || []).includes("admin");

  const go = (key) => {
    if (key === "lainnya") { setMore(true); return; }
    setTab(key);
    setMore(false);
  };

  const openAbsen = (id) => { setAbsenId(id || null); setTab("absen"); setMore(false); };

  const body = () => {
    if (tab === "beranda") return <GuruBeranda user={user} onGoto={go} onOpenAbsen={openAbsen} />;
    if (tab === "jadwal") return <GuruJadwal onOpenAbsen={openAbsen} />;
    if (tab === "absen") return <GuruAbsenKelas key={absenId || "auto"} initialId={absenId} />;
    if (tab === "kelas") return <GuruKelas />;
    if (tab === "program") return <ProgramPembelajaran />;
    if (tab === "bantuan") return <BantuanView role="guru" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F6F4EE] pb-[calc(5.5rem_+_env(safe-area-inset-bottom))] lg:pb-0" data-testid="guru-area">
      <header className="sticky top-0 z-30 border-b border-[#E7E3D8] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-[#E3F3EA] p-1">
              <K1Mark size={32} variant="light" />
            </div>
            <div className="leading-tight">
              <div className="font-heading text-sm font-bold text-[#0E4E31]">E-KERTALANGU</div>
              <div className="text-[11px] text-[#5F6B63]">Area Guru / Pengajar</div>
            </div>
          </div>
          <ProfileMenu role="guru" />
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-4">
        {/* Sidebar desktop */}
        <aside className="hidden w-60 shrink-0 lg:block" data-testid="guru-sidebar">
          <nav className="space-y-4">
            {MENU.map((section, i) => (
              <div key={section.group || `g${i}`}>
                {section.group && (
                  <div className="mb-1 px-2 text-[10px] font-bold uppercase tracking-wider text-[#5F6B63]">
                    {section.group}
                  </div>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const on = tab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        disabled={item.soon}
                        data-testid={`guru-menu-${item.key}`}
                        onClick={() => go(item.key)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${
                          item.soon
                            ? "cursor-not-allowed text-[#8A948D]"
                            : on ? "bg-[#E3F3EA] font-semibold text-[#0E4E31]" : "text-[#5F6B63] hover:bg-[#F0EEE6] hover:text-[#0E4E31]"
                        }`}
                      >
                        <Icon size={17} />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {item.soon && (
                          <span className="shrink-0 rounded-full bg-[#F0EEE6] px-1.5 py-0.5 text-[10px] font-bold text-[#5F6B63]">
                            Segera
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <DemoBanner />
          {isAdmin && (
            <div className="mb-3 rounded-xl border border-[#D9F2F4] bg-[#D9F2F4] px-3 py-2 text-[12px] font-semibold text-[#0A5961]" data-testid="guru-admin-banner">
              Anda melihat sebagai Administrator
            </div>
          )}
          {body()}
        </main>
      </div>

      {/* Menu bawah HP */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E7E3D8] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="mx-auto grid max-w-lg items-end" style={{ gridTemplateColumns: `repeat(${BOTTOM.length}, minmax(0, 1fr))` }}>
          {BOTTOM.map((t) => {
            const Icon = t.icon;
            const on = tab === t.key;
            if (t.center) {
              return (
                <button key={t.key} type="button" data-testid={`guru-tab-${t.key}`} onClick={() => go(t.key)}
                  aria-label={t.label} className="flex flex-col items-center justify-end gap-0.5 pb-1.5">
                  <span className={`-mt-6 flex h-[54px] w-[54px] items-center justify-center rounded-full border-4 border-[#F6F4EE] text-white shadow-[0_8px_20px_-6px_rgba(11,107,82,0.6)] transition-transform active:scale-95 ${on ? "bg-[#0E4E31]" : "bg-[#14633F]"}`}>
                    <Icon size={24} strokeWidth={2.2} />
                  </span>
                  <span className={`text-[11px] ${on ? "font-semibold text-[#0E4E31]" : "font-medium text-[#5F6B63]"}`}>{t.label}</span>
                </button>
              );
            }
            return (
              <button key={t.key} type="button" disabled={t.soon} data-testid={`guru-tab-${t.key}`}
                onClick={() => go(t.key)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 ${t.soon ? "text-[#8A948D]" : on ? "text-[#0E4E31]" : "text-[#5F6B63]"}`}>
                <Icon size={22} strokeWidth={on ? 2.4 : 2} />
                <span className={`text-[11px] ${on ? "font-semibold" : "font-medium"}`}>{t.label}</span>
                <span className={`h-1 w-1 rounded-full ${on ? "bg-[#14633F]" : "bg-transparent"}`} />
              </button>
            );
          })}
        </div>
      </nav>

      {/* Sheet "Lainnya" */}
      {more && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-[rgba(20,32,26,0.5)]" onClick={() => setMore(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))]">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-heading font-bold text-[#14201A]">Lainnya</span>
              <button type="button" onClick={() => setMore(false)} aria-label="Tutup"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6]">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-1">
              {LAINNYA.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.key} type="button" disabled={item.soon}
                    data-testid={`guru-more-${item.key}`}
                    onClick={() => go(item.key)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-3 text-left text-sm ${
                      item.soon ? "cursor-not-allowed text-[#8A948D]" : "text-[#14201A] hover:bg-[#F6F4EE]"
                    }`}>
                    <Icon size={17} />
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {item.soon
                      ? <span className="rounded-full bg-[#F0EEE6] px-1.5 py-0.5 text-[10px] font-bold text-[#5F6B63]">Segera</span>
                      : <ChevronRight size={16} className="text-[#D9D4C5]" />}
                  </button>
                );
              })}
              <a href="/roles" data-testid="guru-more-pindah-peran"
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-3 text-left text-sm text-[#14201A] hover:bg-[#F6F4EE]">
                <ArrowLeftRight size={17} />
                <span className="min-w-0 flex-1">Pindah peran</span>
                <ChevronRight size={16} className="text-[#D9D4C5]" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
