import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Loader2, FileBarChart2, CalendarDays, TrendingUp, Award, AlertTriangle, Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { tanggalSingkat, tanggalPanjang, TYPE_LABEL } from "./admin/kegiatanUtils";
import TamuLaporanList from "@/components/TamuLaporanList";

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
      <div className="min-h-screen bg-[#FAFBF9] flex flex-col items-center justify-center px-4 text-center">
        <div className="h-14 w-14 rounded-2xl overflow-hidden bg-white border border-[#E5E7EB] flex items-center justify-center p-1">
          <img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" />
        </div>
        <p className="text-[#991B1B] font-semibold mt-6" data-testid="laporan-error">{err}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFBF9] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#0D5C3A]" size={32} />
      </div>
    );
  }

  const s = data.summary || {};
  const single = data.date_from === data.date_to;

  return (
    <div className="min-h-screen bg-[#FAFBF9] pb-12" data-testid="page-public-laporan">
      <header className="bg-[#0D5C3A] text-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden p-0.5">
            <img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-bold font-heading">E-KERTALANGU</div>
            <div className="text-white/70 text-xs">{data.title || "Laporan Kehadiran"}</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 -mt-3">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E8F5EE] text-[#065F46]">
            {data.mode === "harian" ? "Laporan Harian" : data.mode === "bulanan" ? "Laporan Bulanan" : "Laporan Rentang"}
          </span>
          <h1 className="font-heading text-xl font-bold text-[#111827] mt-2 flex items-center gap-2">
            <FileBarChart2 size={20} className="text-[#0D5C3A]" /> {data.title || "Laporan Kehadiran"}
          </h1>
          <div className="text-sm text-[#6B7280] mt-2 flex items-center gap-2">
            <CalendarDays size={15} />
            {single ? tanggalPanjang(data.date_from) : `${tanggalSingkat(data.date_from)} s/d ${tanggalSingkat(data.date_to)}`}
          </div>
          <div className="text-sm text-[#6B7280] mt-1">
            {data.total_kegiatan} kegiatan · {data.total_peserta} peserta
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
          <div className="rounded-xl bg-white border border-[#E5E7EB] p-4 text-center"><div className="text-2xl font-bold text-[#0D5C3A]">{s.ratio}%</div><div className="text-xs text-[#6B7280] mt-0.5">Kehadiran</div></div>
          <div className="rounded-xl bg-white border border-[#E5E7EB] p-4 text-center"><div className="text-2xl font-bold text-[#065F46]">{s.hadir}</div><div className="text-xs text-[#6B7280] mt-0.5">Total Hadir</div></div>
          <div className="rounded-xl bg-white border border-[#E5E7EB] p-4 text-center"><div className="text-2xl font-bold text-[#92400E]">{s.izin}</div><div className="text-xs text-[#6B7280] mt-0.5">Total Izin</div></div>
          <div className="rounded-xl bg-white border border-[#E5E7EB] p-4 text-center"><div className="text-2xl font-bold text-[#991B1B]">{s.alpha}</div><div className="text-xs text-[#6B7280] mt-0.5">Total Alpha</div></div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mb-4">
          <div className="text-sm font-semibold text-[#111827] mb-1">Kehadiran per Jenis Kelamin</div>
          <div className="flex gap-5 text-sm text-[#4B5563]">
            <span>Laki-laki: <b className="text-[#0D5C3A]">{data.gender_hadir?.L ?? 0}</b></span>
            <span>Perempuan: <b className="text-[#D97706]">{data.gender_hadir?.P ?? 0}</b></span>
          </div>
        </div>

        {/* Rincian per kegiatan */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden mb-4" data-testid="laporan-per-kegiatan">
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center gap-2 font-bold text-[#111827]">
            <TrendingUp size={17} className="text-[#0D5C3A]" /> Rincian per Kegiatan
          </div>
          {(!data.per_kegiatan || data.per_kegiatan.length === 0) ? (
            <div className="p-8 text-center text-[#6B7280] text-sm">Tidak ada kegiatan pada periode ini.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8FAF8] text-[#6B7280] text-left">
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">Kegiatan</th>
                    <th className="px-4 py-3 font-semibold text-center">Hadir</th>
                    <th className="px-4 py-3 font-semibold text-center">Izin</th>
                    <th className="px-4 py-3 font-semibold text-center">Alpha</th>
                    <th className="px-4 py-3 font-semibold text-center">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {data.per_kegiatan.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 text-[#4B5563] whitespace-nowrap">{tanggalSingkat(r.date)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#111827]">{r.name}</div>
                        <div className="text-xs text-[#9CA3AF]">{TYPE_LABEL[r.type] || r.type}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-[#065F46] font-semibold">{r.hadir}</td>
                      <td className="px-4 py-3 text-center text-[#92400E]">{r.izin}</td>
                      <td className="px-4 py-3 text-center text-[#991B1B]">{r.alpha}</td>
                      <td className="px-4 py-3 text-center font-bold text-[#0D5C3A]">{r.ratio}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Daftar peserta (dropdown) */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden mb-4" data-testid="laporan-per-peserta">
          <button
            data-testid="laporan-peserta-toggle"
            onClick={() => setOpenPeserta((v) => !v)}
            className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#FAFBF9]"
          >
            <span className="flex items-center gap-2 font-bold text-[#111827]">
              <Users size={17} className="text-[#0D5C3A]" /> Rekap per Peserta
              <span className="text-xs font-medium text-[#6B7280]">({(data.per_peserta || []).length})</span>
            </span>
            <span className="text-sm font-semibold text-[#0D5C3A]">{openPeserta ? "Tutup" : "Lihat"}</span>
          </button>
          {openPeserta && (
            <div className="border-t border-[#E5E7EB] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8FAF8] text-[#9CA3AF] text-left text-[11px] uppercase tracking-wide">
                    <th className="px-4 py-2.5 font-bold">Nama</th>
                    <th className="px-4 py-2.5 font-bold text-center w-20">Hadir</th>
                    <th className="px-4 py-2.5 font-bold text-center w-20">Izin</th>
                    <th className="px-4 py-2.5 font-bold text-center w-20">Alpha</th>
                    <th className="px-4 py-2.5 font-bold text-right w-20">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F2F0]">
                  {(data.per_peserta || []).map((p, i) => (
                    <tr key={i} data-testid={`laporan-peserta-row-${i}`}>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-[#111827]">{p.name}</div>
                        {p.account_status === "pending" && (
                          <div className="text-[11px] font-semibold text-[#92400E] inline-flex items-center gap-1 mt-0.5">
                            <AlertTriangle size={11} /> Belum aktivasi
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono tabular-nums text-[#065F46] font-semibold">{p.hadir}</td>
                      <td className="px-4 py-2.5 text-center font-mono tabular-nums text-[#92400E]">{p.izin}</td>
                      <td className="px-4 py-2.5 text-center font-mono tabular-nums text-[#991B1B]">{p.alpha}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-[#0D5C3A]">{p.ratio}%</td>
                    </tr>
                  ))}
                  {(data.per_peserta || []).length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#9CA3AF]">Belum ada data peserta.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Daftar tamu TERPISAH dari jamaah terdaftar */}
        <TamuLaporanList rows={data.tamu || []} />

        <p className="text-center text-xs text-[#9CA3AF] mt-8">
          © 2026 E-KERTALANGU · Absensi Pengajian
          {data.created_by ? ` · Dibuat oleh ${data.created_by}` : ""}
        </p>
      </main>
    </div>
  );
}

