// FASE 15 — Halaman "Scan Presensi": daftar kegiatan per tanggal + QR kegiatan & kamera scan QR peserta.
import { useCallback, useEffect, useState } from "react";
import {
  ScanLine, Loader2, Clock, MapPin, User, QrCode, Camera, X,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { ACTIVITIES } from "@/constants/testIds";
import { tanggalSingkat } from "./kegiatanUtils";
import { ScanPesertaModal } from "./KegiatanExtras";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export default function ScanPresensiView() {
  const [date, setDate] = useState(todayYmd);
  const [data, setData] = useState(null);
  const [scanKegiatan, setScanKegiatan] = useState(null);
  const [qrPreview, setQrPreview] = useState(null);

  const load = useCallback(() => {
    setData(null);
    api.get(`/staff/scan-presensi?date=${date}`)
      .then(({ data: d }) => setData(d))
      .catch((e) => { setData(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, [date]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#111827] flex items-center gap-2">
            <ScanLine size={22} className="text-[#1D4ED8]" /> Scan Presensi
          </h1>
          <p className="text-[#6B7280] text-sm mt-1">
            Daftar kegiatan beserta <b>QR kegiatannya</b>. Tampilkan QR agar peserta memindainya sendiri,
            atau buka kamera untuk memindai QR pribadi peserta.
          </p>
        </div>
        <input
          data-testid="scan-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || todayYmd())}
          className="h-11 px-3.5 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#2563EB] bg-white"
        />
      </div>

      {data === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#1D4ED8]" size={30} /></div>
      ) : data === false ? (
        <div className="p-10 text-center text-[#6B7280]">Gagal memuat daftar kegiatan.</div>
      ) : data.rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-10 text-center text-[#6B7280]" data-testid="scan-empty">
          Tidak ada kegiatan pada tanggal {tanggalSingkat(date)}.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2" data-testid="scan-list">
          {data.rows.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-[#E8E8E4] p-4" data-testid={`scan-card-${r.id}`}>
              <div className="flex items-center gap-2 flex-wrap">
                {r.session_label && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8]">{r.session_label}</span>}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === "open" ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#F3F4F6] text-[#4B5563]"}`}>
                  {r.status === "open" ? "Terbuka" : "Selesai"}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#ECFEFF] text-[#1D4ED8]">
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
                <button type="button" onClick={() => setQrPreview(r)} aria-label={`Perbesar QR ${r.base_name}`}
                  data-testid={`${ACTIVITIES.scanQrOpenPrefix}-${r.id}`}
                  className="shrink-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]">
                  <img src={r.image} alt={`QR ${r.base_name}`} className="w-28 h-28 rounded-xl border border-[#E8E8E4] p-1.5" data-testid={`scan-qr-${r.id}`} />
                </button>
                <div className="min-w-0 text-xs text-[#6B7280] space-y-2">
                  <p className="leading-relaxed">
                    <QrCode size={13} className="inline mr-1 text-[#1D4ED8]" />
                    QR ini berlaku <b>satu hari</b>{r.sessions > 1 ? " dan dipakai semua sesi hari itu" : ""}.
                  </p>
                  <p className="font-semibold text-[#1D4ED8]">Ketuk QR untuk memperbesar.</p>
                </div>
              </div>

              <button
                data-testid={`scan-open-camera-${r.id}`}
                onClick={() => setScanKegiatan({ id: r.id, name: r.base_name, status: r.status })}
                className="mt-3 w-full h-11 rounded-xl bg-[#2563EB] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#1D4ED8]"
              >
                <Camera size={17} /> Scan QR Peserta
              </button>
            </div>
          ))}
        </div>
      )}

      {scanKegiatan && (
        <ScanPesertaModal kegiatan={scanKegiatan} onClose={() => setScanKegiatan(null)} onChanged={load} />
      )}
      {qrPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          data-testid={ACTIVITIES.scanQrModal}
          onClick={() => setQrPreview(null)}>
          <div role="dialog" aria-modal="true" aria-label={`QR presensi ${qrPreview.base_name}`}
            className="relative flex max-h-[92vh] w-full max-w-xl flex-col items-center rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setQrPreview(null)} aria-label="Tutup QR"
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-xl text-[#4B5563] hover:bg-[#F3F4F6]">
              <X size={22} />
            </button>
            <h2 className="mb-3 max-w-[80%] text-center text-lg font-bold text-[#111827]">{qrPreview.base_name}</h2>
            <img src={qrPreview.image} alt={`QR presensi ${qrPreview.base_name}`}
              className="max-h-[76vh] max-w-full rounded-xl object-contain" />
            <p className="mt-3 text-center text-sm font-medium text-[#4B5563]">Ketuk di luar QR atau tombol tutup untuk kembali.</p>
          </div>
        </div>
      )}
    </div>
  );
}
