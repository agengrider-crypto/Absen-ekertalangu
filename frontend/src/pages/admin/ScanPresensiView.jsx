// FASE 15 — Halaman "Scan Presensi": daftar kegiatan per tanggal + QR kegiatan & kamera scan QR jamaah.
import { useCallback, useEffect, useState } from "react";
import {
  ScanLine, Loader2, Copy, Download, Clock, MapPin, User, QrCode, Camera,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalSingkat } from "./kegiatanUtils";
import { ScanPesertaModal } from "./KegiatanExtras";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function ScanPresensiView() {
  const [date, setDate] = useState(todayYmd);
  const [data, setData] = useState(null);
  const [scanKegiatan, setScanKegiatan] = useState(null);

  const load = useCallback(() => {
    setData(null);
    api.get(`/staff/scan-presensi?date=${date}`)
      .then(({ data: d }) => setData(d))
      .catch((e) => { setData(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const download = (row) => {
    const a = document.createElement("a");
    a.href = row.image;
    a.download = `qr-kegiatan-${(row.base_name || "kegiatan").replace(/\s+/g, "_")}-${row.date}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#111827] flex items-center gap-2">
            <ScanLine size={22} className="text-[#0D5C3A]" /> Scan Presensi
          </h1>
          <p className="text-[#6B7280] text-sm mt-1">
            Daftar kegiatan beserta <b>QR kegiatannya</b>. Tampilkan QR agar jamaah memindainya sendiri,
            atau buka kamera untuk memindai QR pribadi jamaah.
          </p>
        </div>
        <input
          data-testid="scan-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || todayYmd())}
          className="h-11 px-3.5 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] bg-white"
        />
      </div>

      {data === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={30} /></div>
      ) : data === false ? (
        <div className="p-10 text-center text-[#6B7280]">Gagal memuat daftar kegiatan.</div>
      ) : data.rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center text-[#6B7280]" data-testid="scan-empty">
          Tidak ada kegiatan pada tanggal {tanggalSingkat(date)}.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="scan-list">
          {data.rows.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-4" data-testid={`scan-card-${r.id}`}>
              <div className="flex items-center gap-2 flex-wrap">
                {r.session_label && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#065F46]">{r.session_label}</span>}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === "open" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F3F4F6] text-[#4B5563]"}`}>
                  {r.status === "open" ? "Terbuka" : "Selesai"}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#3730A3]">
                  H {r.counts?.hadir ?? 0} · I {r.counts?.izin ?? 0} · A {r.counts?.alpha ?? 0}
                </span>
              </div>
              <h3 className="font-heading font-bold text-[#111827] mt-1.5">{r.base_name}</h3>
              <div className="text-sm text-[#6B7280] mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1"><Clock size={13} /> {r.start_time}–{r.end_time} WITA</span>
                {r.location && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {r.location}</span>}
                {r.teacher && <span className="inline-flex items-center gap-1"><User size={13} /> {r.teacher}</span>}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <img src={r.image} alt={`QR ${r.base_name}`} className="w-28 h-28 rounded-xl border border-[#E5E7EB] p-1.5 shrink-0" data-testid={`scan-qr-${r.id}`} />
                <div className="min-w-0 text-xs text-[#6B7280] space-y-2">
                  <p className="leading-relaxed">
                    <QrCode size={13} className="inline mr-1 text-[#0D5C3A]" />
                    QR ini berlaku <b>satu hari</b>{r.sessions > 1 ? " dan dipakai semua sesi hari itu" : ""}.
                  </p>
                  <button data-testid={`scan-copy-${r.id}`} onClick={() => { navigator.clipboard.writeText(r.link); toast.success("Tautan absen disalin"); }}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#E5E7EB] text-[#4B5563] font-semibold hover:border-[#0D5C3A] hover:text-[#0D5C3A]">
                    <Copy size={14} /> Salin Tautan
                  </button>
                  <button data-testid={`scan-download-${r.id}`} onClick={() => download(r)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#E5E7EB] text-[#4B5563] font-semibold hover:border-[#0D5C3A] hover:text-[#0D5C3A]">
                    <Download size={14} /> Unduh QR
                  </button>
                </div>
              </div>

              <button
                data-testid={`scan-open-camera-${r.id}`}
                onClick={() => setScanKegiatan({ id: r.id, name: r.base_name, status: r.status })}
                className="mt-3 w-full h-11 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#094229]"
              >
                <Camera size={17} /> Scan QR Jamaah
              </button>
            </div>
          ))}
        </div>
      )}

      {scanKegiatan && (
        <ScanPesertaModal kegiatan={scanKegiatan} onClose={() => setScanKegiatan(null)} onChanged={load} />
      )}
    </div>
  );
}
