// FASE 15 — Halaman "Kode Akses": tiap kegiatan otomatis punya kode 6 digit + tautan/QR absensi.
import { useCallback, useEffect, useState } from "react";
import {
  KeyRound, Loader2, Copy, RefreshCw, ChevronLeft, ChevronRight, Send, QrCode, X, Download,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalSingkat } from "./kegiatanUtils";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember"];

export default function KodeAksesView() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [qr, setQr] = useState(null);

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

  const copy = (text, label) => { navigator.clipboard.writeText(text); toast.success(`${label} disalin`); };

  const downloadQr = () => {
    if (!qr?.image) return;
    const a = document.createElement("a");
    a.href = qr.image;
    a.download = `qr-absensi-${(qr.name || "kegiatan").replace(/\s+/g, "_")}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#111827] flex items-center gap-2">
            <KeyRound size={22} className="text-[#0D5C3A]" /> Kode Akses Kegiatan
          </h1>
          <p className="text-[#6B7280] text-sm mt-1">
            Setiap kegiatan otomatis punya kode akses 6 digit + tautan absensi. Bagikan ke petugas/penjaga absen.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-xl border border-[#E5E7EB] p-1">
          <button data-testid="kode-prev-month" onClick={() => shift(-1)} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#F2F5F2]"><ChevronLeft size={18} /></button>
          <div className="px-3 font-semibold text-[#111827] text-sm" data-testid="kode-month">{BULAN[m - 1]} {y}</div>
          <button data-testid="kode-next-month" onClick={() => shift(1)} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#F2F5F2]"><ChevronRight size={18} /></button>
        </div>
      </div>

      {data === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={30} /></div>
      ) : data === false ? (
        <div className="p-10 text-center text-[#6B7280]">Gagal memuat kode akses.</div>
      ) : data.rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center text-[#6B7280]" data-testid="kode-empty">
          Belum ada kegiatan pada bulan ini.
        </div>
      ) : (
        <div className="space-y-3" data-testid="kode-list">
          {data.rows.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-4" data-testid={`kode-row-${r.id}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {r.session_label && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#065F46]">{r.session_label}</span>}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === "open" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F3F4F6] text-[#4B5563]"}`}>
                      {r.status === "open" ? "Terbuka" : "Selesai"}
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-[#111827] mt-1.5 truncate">{r.base_name}</h3>
                  <div className="text-sm text-[#6B7280]">{tanggalSingkat(r.date)} · {r.start_time}–{r.end_time} WITA</div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide">Kode akses</div>
                  <div className="font-mono text-3xl font-bold text-[#0D5C3A] tracking-[0.25em]" data-testid={`kode-value-${r.id}`}>{r.code}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button data-testid={`kode-copy-${r.id}`} onClick={() => copy(r.code, "Kode akses")}
                  className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE]">
                  <Copy size={15} /> Salin Kode
                </button>
                <button data-testid={`kode-copy-link-${r.id}`} onClick={() => copy(r.link, "Tautan absensi")}
                  className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-[#E5E7EB] text-[#4B5563] font-semibold text-sm hover:border-[#0D5C3A] hover:text-[#0D5C3A]">
                  <Copy size={15} /> Salin Tautan
                </button>
                <a data-testid={`kode-wa-${r.id}`} href={`https://wa.me/?text=${encodeURIComponent(r.wa_text)}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-[#16A34A] text-white font-semibold text-sm hover:bg-[#15803D]">
                  <Send size={15} /> Bagikan ke WhatsApp
                </a>
                <button data-testid={`kode-qr-${r.id}`} onClick={() => setQr({ image: r.image, name: r.base_name, link: r.link, code: r.code })}
                  className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-[#E5E7EB] text-[#4B5563] font-semibold text-sm hover:border-[#0D5C3A] hover:text-[#0D5C3A]">
                  <QrCode size={15} /> Lihat QR
                </button>
                <button data-testid={`kode-regen-${r.id}`} onClick={() => regenerate(r)} disabled={busyId === r.id}
                  className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-[#FCD34D] text-[#92400E] font-semibold text-sm hover:bg-[#FFFBEB] disabled:opacity-60">
                  {busyId === r.id ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />} Perbarui Kode
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="modal-kode-qr">
          <div className="absolute inset-0 bg-black/40" onClick={() => setQr(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl">
            <div className="px-5 py-4 flex items-center justify-between border-b border-[#E5E7EB]">
              <h3 className="font-heading font-bold text-[#111827]">QR Absensi Kegiatan</h3>
              <button onClick={() => setQr(null)} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"><X size={20} /></button>
            </div>
            <div className="p-5 text-center">
              <img src={qr.image} alt="QR Absensi" className="mx-auto w-52 h-52 rounded-xl border border-[#E5E7EB] p-2" />
              <div className="mt-2 font-semibold text-[#111827]">{qr.name}</div>
              <div className="font-mono text-2xl font-bold text-[#0D5C3A] tracking-[0.25em] mt-1">{qr.code}</div>
              <p className="text-sm text-[#4B5563] mt-2">Penerima memindai QR / membuka tautan, lalu memasukkan kode akses ini untuk mengisi absensi.</p>
              <button onClick={downloadQr} className="mt-4 w-full h-11 rounded-xl bg-[#0D5C3A] text-white font-semibold inline-flex items-center justify-center gap-2"><Download size={16} /> Unduh QR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
