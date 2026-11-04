// FASE 15 — Halaman "Kode Akses": tiap kegiatan otomatis punya kode 6 digit + tautan/QR absensi.
import { useCallback, useEffect, useState } from "react";
import {
  KeyRound, Loader2, RefreshCw, ChevronLeft, ChevronRight, Send,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { ACTIVITIES } from "@/constants/testIds";
import { tanggalSingkat } from "./kegiatanUtils";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember"];

export default function KodeAksesView() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setData(null);
    api.get(`/staff/kode-akses?month=${month}`)
      .then(({ data: d }) => setData(d))
      .catch((e) => { setData(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const [y, m] = month.split("-").map((x) => parseInt(x, 10));
  const shift = (delta) => {
    let ny = y; let nm = m + delta;
    while (nm > 12) { nm -= 12; ny += 1; }
    while (nm < 1) { nm += 12; ny -= 1; }
    setMonth(`${ny}-${String(nm).padStart(2, "0")}`);
  };

  const regenerate = async (row) => {
    if (!window.confirm(`Buat kode akses baru untuk "${row.name}"? Kode lama tidak berlaku lagi.`)) return;
    setBusyId(row.id);
    try {
      await api.post(`/admin/kegiatan/${row.id}/access/regenerate`);
      toast.success("Kode akses baru dibuat");
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setBusyId(null);
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#111827] flex items-center gap-2">
            <KeyRound size={22} className="text-[#111114]" /> Kode Akses Kegiatan
          </h1>
          <p className="text-[#6B7280] text-sm mt-1">
            Bagikan kode akses melalui WhatsApp atau perbarui kode jika diperlukan.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-xl border border-[#E8E8E4] p-1">
          <button data-testid="kode-prev-month" onClick={() => shift(-1)} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#F4F4F1]"><ChevronLeft size={18} /></button>
          <div className="px-3 font-semibold text-[#111827] text-sm" data-testid="kode-month">{BULAN[m - 1]} {y}</div>
          <button data-testid="kode-next-month" onClick={() => shift(1)} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#F4F4F1]"><ChevronRight size={18} /></button>
        </div>
      </div>

      {data === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={30} /></div>
      ) : data === false ? (
        <div className="p-10 text-center text-[#6B7280]">Gagal memuat kode akses.</div>
      ) : data.rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-10 text-center text-[#6B7280]" data-testid="kode-empty">
          Belum ada kegiatan pada bulan ini.
        </div>
      ) : (
        <div className="space-y-3" data-testid="kode-list">
          {data.rows.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-[#E8E8E4] p-4" data-testid={`kode-row-${r.id}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.session_label && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#F1F1EE] text-[#111114]">{r.session_label}</span>}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === "open" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F3F4F6] text-[#4B5563]"}`}>
                      {r.status === "open" ? "Terbuka" : "Selesai"}
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-[#111827] mt-1.5 truncate">{r.base_name}</h3>
                  <div className="text-sm text-[#6B7280]">{tanggalSingkat(r.date)} · {r.start_time}–{r.end_time} WITA</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Kode akses</div>
                  <div className="font-mono text-3xl font-bold text-[#111114] tracking-[0.25em]" data-testid={`kode-value-${r.id}`}>{r.code}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <a data-testid={`${ACTIVITIES.accessSharePrefix}-${r.id}`} href={`https://wa.me/?text=${encodeURIComponent(r.wa_text)}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-[#16A34A] text-white font-semibold text-sm hover:bg-[#15803D]">
                  <Send size={15} /> Bagikan ke WhatsApp
                </a>
                <button data-testid={`${ACTIVITIES.accessRegeneratePrefix}-${r.id}`} onClick={() => regenerate(r)} disabled={busyId === r.id}
                  className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-[#FCD34D] text-[#92400E] font-semibold text-sm hover:bg-[#FFFBEB] disabled:opacity-60">
                  {busyId === r.id ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />} Perbarui Kode
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
