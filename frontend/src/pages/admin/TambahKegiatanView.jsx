// Halaman "Tambah Kegiatan" — satu tampilan untuk desktop & HP (maks 560px).
// Baris riwayat = kegiatan yang sering dibuat (nama unik, maks 3).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Loader2, ChevronRight, Plus, CalendarDays, Layers, Users,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalSingkat, typeLabel, typeColor } from "./kegiatanUtils";
import KegiatanQuickAddModal from "./KegiatanQuickAddModal";
import KegiatanFormModal from "./KegiatanFormModal";

export default function TambahKegiatanView({ onBack, onDone }) {
  const [items, setItems] = useState(null);
  const [source, setSource] = useState(null); // null = belum buka form
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

  // Kelompokkan per nama (unik), urutkan dari yang terbaru.
  const history = useMemo(() => {
    const map = new Map();
    (items || []).forEach((k) => {
      const key = (k.base_name || k.name || "").trim().toLowerCase();
      if (!key) return;
      const prev = map.get(key);
      if (!prev || `${k.date}${k.start_time}` > `${prev.date}${prev.start_time}`) map.set(key, k);
    });
    return Array.from(map.values())
      .sort((a, b) => `${b.date}${b.start_time}`.localeCompare(`${a.date}${a.start_time}`))
      .slice(0, 3);
  }, [items]);

  const openBlank = () => { setSource(null); setOpenForm(true); };

  return (
    <div className="mx-auto w-full max-w-[560px]" data-testid="tambah-kegiatan-view">
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
      <p className="mt-1 text-sm text-[#5F6B63]">
        Pilih kegiatan yang sering dibuat agar pengaturannya tersalin, atau mulai dari kosong.
      </p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white">
        {items === null ? (
          <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[#0E4E31]" size={24} /></div>
        ) : (
          <>
            {history.length > 0 && (
              <>
                <div className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-[#5F6B63]">
                  Sering dibuat
                </div>
                <ul className="divide-y divide-[#F0EEE6]">
                  {history.map((k) => (
                    <li key={k.id}>
                      <button
                        type="button"
                        data-testid={`tambah-kegiatan-history-${k.id}`}
                        onClick={() => { setSource(k); setOpenForm(true); }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F6F4EE]"
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${typeColor(k.type)}1a`, color: typeColor(k.type) }}
                        >
                          <CalendarDays size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[#14201A]">
                            {k.base_name || k.name}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#5F6B63]">
                            <span>Terakhir {tanggalSingkat(k.date)}</span>
                            <span className="inline-flex items-center gap-1"><Layers size={11} /> {k.session_label || typeLabel(k.type)}</span>
                            <span className="inline-flex items-center gap-1"><Users size={11} /> {k.counts?.total ?? 0} peserta</span>
                          </span>
                        </span>
                        <ChevronRight size={18} className="shrink-0 text-[#D9D4C5]" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button
              type="button"
              data-testid="tambah-kegiatan-blank"
              onClick={openBlank}
              className="flex w-full items-center gap-3 border-t border-[#F0EEE6] px-4 py-3.5 text-left transition-colors hover:bg-[#F6F4EE]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E3F3EA] text-[#0E4E31]">
                <Plus size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#14201A]">Mulai dari kosong</span>
                <span className="mt-0.5 block text-[11px] text-[#5F6B63]">Isi nama, tanggal, waktu, dan peserta sendiri.</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-[#D9D4C5]" />
            </button>
          </>
        )}
      </div>

      {openForm && (
        <KegiatanQuickAddModal
          source={source}
          onClose={() => setOpenForm(false)}
          onFullForm={(initial) => { setOpenForm(false); setFormInitial(initial); }}
        />
      )}
      {formInitial && (
        <KegiatanFormModal
          initial={formInitial}
          suggestions={Array.isArray(items) ? items : []}
          onClose={() => setFormInitial(null)}
          onDone={() => { setFormInitial(null); load(); onDone?.(); }}
        />
      )}
    </div>
  );
}
