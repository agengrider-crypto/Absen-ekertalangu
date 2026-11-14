// Halaman "Tambah Kegiatan" — satu tampilan untuk desktop & HP (maks 520px).
// Empat cara memulai: absen cepat, absen sebelumnya, kegiatan terjadwal, multi-sesi.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ChevronRight, Zap, History, CalendarPlus, CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import KegiatanQuickAddModal from "./KegiatanQuickAddModal";
import KegiatanFormModal from "./KegiatanFormModal";

const MENU = [
  { key: "cepat", label: "Absen cepat", desc: "Mulai absen sekarang, jadwal otomatis.", icon: Zap, testId: "add-menu-absen-cepat" },
  { key: "sebelumnya", label: "Absen sebelumnya", desc: "Catat kegiatan yang sudah lewat.", icon: History, testId: "add-menu-absen-sebelumnya" },
  { key: "terjadwal", label: "Kegiatan terjadwal", desc: "Form lengkap: info, jadwal, peserta, tinjau.", icon: CalendarPlus, testId: "add-menu-terjadwal" },
  { key: "multi", label: "Kegiatan multi-sesi", desc: "Beberapa sesi dalam satu hari (mis. Pagi & Malam).", icon: CalendarClock, testId: "add-menu-multi-sesi" },
];

export default function TambahKegiatanView({ onBack, onDone }) {
  const [items, setItems] = useState(null);
  const [quickMode, setQuickMode] = useState(null); // null | "cepat" | "sebelumnya"
  const [openForm, setOpenForm] = useState(false);
  const [formInitial, setFormInitial] = useState(null);

  const load = useCallback(() => {
    setItems(null);
    api.get("/admin/kegiatan")
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch((e) => { setItems([]); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // Tombol kembali browser = kembali ke daftar tanpa menyimpan.
  const backRef = useRef(onBack);
  backRef.current = onBack;
  useEffect(() => {
    window.history.pushState({ tambahKegiatan: true }, "");
    const onPop = () => backRef.current?.();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const pick = (key) => {
    if (key === "cepat" || key === "sebelumnya") { setQuickMode(key); return; }
    setFormInitial(key === "multi" ? { multi: true } : null);
    setOpenForm(true);
  };

  return (
    <div className="mx-auto w-full max-w-[520px]" data-testid="tambah-kegiatan-view">
      <button
        type="button"
        data-testid="tambah-kegiatan-back"
        onClick={onBack}
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#5F6B63] hover:text-[#0E4E31]"
      >
        <ArrowLeft size={16} /> Daftar Kegiatan
      </button>

      <h1 className="font-heading text-[22px] font-semibold text-[#14201A]">
        Tambah <span className="text-[#14633F]">Kegiatan</span>
      </h1>
      <p className="mt-1 text-sm text-[#5F6B63]">Pilih cara memulai.</p>

      <div className="mt-4 space-y-2.5">
        {MENU.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.key}
              type="button"
              data-testid={m.testId}
              onClick={() => pick(m.key)}
              className="flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-[#E7E3D8] bg-white p-3.5 text-left transition-colors hover:border-[#14633F] hover:bg-[#F6F4EE] active:bg-[#F0EEE6] sm:min-h-[78px]"
            >
              <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#E3F3EA] text-[#0E4E31] sm:h-[46px] sm:w-[46px]">
                <Icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-[#14201A] sm:text-base">{m.label}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-[#5F6B63]">{m.desc}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-[#D9D4C5]" />
            </button>
          );
        })}
      </div>

      {quickMode && (
        <KegiatanQuickAddModal
          mode={quickMode}
          onClose={() => setQuickMode(null)}
          onFullForm={(initial) => { setQuickMode(null); setFormInitial(initial); setOpenForm(true); }}
        />
      )}
      {openForm && (
        <KegiatanFormModal
          initial={formInitial || undefined}
          suggestions={Array.isArray(items) ? items : []}
          onClose={() => { setOpenForm(false); setFormInitial(null); }}
          onDone={() => { setOpenForm(false); setFormInitial(null); load(); onDone?.(); }}
        />
      )}
    </div>
  );
}
