import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Loader2, FileBarChart2, CalendarDays, TrendingUp, Award, AlertTriangle, Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { tanggalSingkat, tanggalPanjang, TYPE_LABEL } from "./admin/kegiatanUtils";
import TamuLaporanList from "@/components/TamuLaporanList";
import { K1Mark } from "@/components/Logo";

/**
 * Halaman laporan PUBLIK — dibuka lewat tautan permanen dari panel Admin.
 * Tidak perlu login: siapa pun yang klik tautan langsung melihat laporannya.
 */
export default function PublicLaporan() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [openPeserta, setOpenPeserta] = useState(false);

  useEffect(() => {
    api.get(`/laporan/${token}`)
      .then(({ data: d }) => setData(d))
      .catch((e) => setErr(e.response?.data?.detail || "Mohon maaf, tautan laporan tidak dikenali."));
  }, [token]);

  if (err) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center px-4 text-center">
        <div className="h-14 w-14 rounded-2xl overflow-hidden bg-white border border-[#E7E3D8] flex items-center justify-center p-1">
          <K1Mark size={32} variant="light" />
        </div>
        <p className="text-[#A32A2A] font-semibold mt-6" data-testid="laporan-error">{err}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#0E4E31]" size={32} />
      </div>
    );
  }

  const s = data.summary || {};
  const single = data.date_from === data.date_to;

  return (
    <div className="min-h-screen bg-[#F6F4EE] pb-12" data-testid="page-public-laporan">
      <header className="bg-[#14633F] text-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden p-0.5">
            <K1Mark size={32} variant="light" />
          </div>
          <div className="leading-tight">
            <div className="font-bold font-heading">E-KERTALANGU</div>
            <div className="text-white/70 text-xs">{data.title || "Laporan Kehadiran"}</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 -mt-3">
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5 shadow-sm">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E3F3EA] text-[#0E4E31]">
            {data.mode === "harian" ? "Laporan Harian" : data.mode === "bulanan" ? "Laporan Bulanan" : "Laporan Rentang"}
          </span>
          <h1 className="font-heading text-xl font-bold text-[#14201A] mt-2 flex items-center gap-2">
            <FileBarChart2 size={20} className="text-[#0E4E31]" /> {data.title || "Laporan Kehadiran"}
          </h1>
          <div className="text-sm text-[#5F6B63] mt-2 flex items-center gap-2">
            <CalendarDays size={15} />
            {single ? tanggalPanjang(data.date_from) : `${tanggalSingkat(data.date_from)} s/d ${tanggalSingkat(data.date_to)}`}
          </div>
          <div className="text-sm text-[#5F6B63] mt-1">
            {data.total_kegiatan} kegiatan · {data.total_peserta} peserta
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
          <div className="rounded-xl bg-white border border-[#E7E3D8] p-4 text-center"><div className="text-2xl font-bold text-[#0E4E31]">{s.ratio}%</div><div className="text-xs text-[#5F6B63] mt-0.5">Kehadiran</div></div>
          <div className="rounded-xl bg-white border border-[#E7E3D8] p-4 text-center"><div className="text-2xl font-bold text-[#0E4E31]">{s.hadir}</div><div className="text-xs text-[#5F6B63] mt-0.5">Total Hadir</div></div>
          <div className="rounded-xl bg-white border border-[#E7E3D8] p-4 text-center"><div className="text-2xl font-bold text-[#6B4500]">{s.izin}</div><div className="text-xs text-[#5F6B63] mt-0.5">Total Izin</div></div>
          <div className="rounded-xl bg-white border border-[#E7E3D8] p-4 text-center"><div className="text-2xl font-bold text-[#A32A2A]">{s.alpha}</div><div className="text-xs text-[#5F6B63] mt-0.5">Total Alpha</div></div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4 mb-4">
          <div className="text-sm font-semibold text-[#14201A] mb-1">Kehadiran per Jenis Kelamin</div>
          <div className="flex gap-5 text-sm text-[#5F6B63]">
            <span>Laki-laki: <b className="text-[#0E4E31]">{data.gender_hadir?.L ?? 0}</b></span>
            <span>Perempuan: <b className="text-[#5F6B63]">{data.gender_hadir?.P ?? 0}</b></span>
          </div>
        </div>

        {/* Rincian per kegiatan */}
        <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden mb-4" data-testid="laporan-per-kegiatan">
          <div className="px-5 py-3.5 border-b border-[#E7E3D8] flex items-center gap-2 font-bold text-[#14201A]">
            <TrendingUp size={17} className="text-[#0E4E31]" /> Rincian per Kegiatan
          </div>
          {(!data.per_kegiatan || data.per_kegiatan.length === 0) ? (
            <div className="p-8 text-center text-[#5F6B63] text-sm">Tidak ada kegiatan pada periode ini.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F6F4EE] text-[#5F6B63] text-left">
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">Kegiatan</th>
                    <th className="px-4 py-3 font-semibold text-center">Hadir</th>
                    <th className="px-4 py-3 font-semibold text-center">Izin</th>
                    <th className="px-4 py-3 font-semibold text-center">Alpha</th>
                    <th className="px-4 py-3 font-semibold text-center">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E3D8]">
                  {data.per_kegiatan.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 text-[#5F6B63] whitespace-nowrap">{tanggalSingkat(r.date)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#14201A]">{r.name}</div>
                        <div className="text-xs text-[#5F6B63]">{TYPE_LABEL[r.type] || r.type}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-[#0E4E31] font-semibold">{r.hadir}</td>
                      <td className="px-4 py-3 text-center text-[#6B4500]">{r.izin}</td>
                      <td className="px-4 py-3 text-center text-[#A32A2A]">{r.alpha}</td>
                      <td className="px-4 py-3 text-center font-bold text-[#0E4E31]">{r.ratio}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Daftar peserta (dropdown) */}
        <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden mb-4" data-testid="laporan-per-peserta">
          <button
            data-testid="laporan-peserta-toggle"
            onClick={() => setOpenPeserta((v) => !v)}
            className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#F6F4EE]"
          >
            <span className="flex items-center gap-2 font-bold text-[#14201A]">
              <Users size={17} className="text-[#0E4E31]" /> Rekap per Peserta
              <span className="text-xs font-medium text-[#5F6B63]">({(data.per_peserta || []).length})</span>
            </span>
            <span className="text-sm font-semibold text-[#0E4E31]">{openPeserta ? "Tutup" : "Lihat"}</span>
          </button>
          {openPeserta && (
            <div className="border-t border-[#E7E3D8] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F6F4EE] text-[#5F6B63] text-left text-[11px] uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-bold">Nama</th>
                    <th className="px-4 py-2.5 font-bold text-center w-20">Hadir</th>
                    <th className="px-4 py-2.5 font-bold text-center w-20">Izin</th>
                    <th className="px-4 py-2.5 font-bold text-center w-20">Alpha</th>
                    <th className="px-4 py-2.5 font-bold text-right w-20">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E3D8]">
                  {(data.per_peserta || []).map((p, i) => (
                    <tr key={i} data-testid={`laporan-peserta-row-${i}`}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-[#14201A]">{p.name}</div>
                        {p.account_status === "pending" && (
                          <div className="text-[11px] font-semibold text-[#6B4500] inline-flex items-center gap-1 mt-0.5">
                            <AlertTriangle size={11} /> Belum aktivasi
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono tabular-nums text-[#0E4E31] font-semibold">{p.hadir}</td>
                      <td className="px-4 py-2.5 text-center font-mono tabular-nums text-[#6B4500]">{p.izin}</td>
                      <td className="px-4 py-2.5 text-center font-mono tabular-nums text-[#A32A2A]">{p.alpha}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#0E4E31]">{p.ratio}%</td>
                    </tr>
                  ))}
                  {(data.per_peserta || []).length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#5F6B63]">Belum ada data peserta.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Daftar tamu TERPISAH dari peserta terdaftar */}
        <TamuLaporanList rows={data.tamu || []} />

        <p className="text-center text-xs text-[#5F6B63] mt-8">
          © 2026 E-KERTALANGU · Absensi Pengajian
          {data.created_by ? ` · Dibuat oleh ${data.created_by}` : ""}
        </p>
      </main>
    </div>
  );
}

