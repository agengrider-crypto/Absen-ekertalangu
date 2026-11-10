import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarRange, Users, TrendingDown, TrendingUp, Search, Layers, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Logo, K1Mark } from "@/components/Logo";
import { PercentBar } from "./PublicRekapGabungan";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MONTHLY_RECAP } from "@/constants/testIds";

const GEN = [["semua", "Semua"], ["L", "Laki-laki"], ["P", "Perempuan"]];

function badgeOf(r) {
  if (r.pertemuan === 0) return { t: "Tidak ada kegiatan", cls: "bg-[#F3F4F6] text-[#6B7280]" };
  if (r.hadir === 0) return { t: "Belum pernah hadir", cls: "bg-[#FEE2E2] text-[#991B1B]" };
  if (r.ratio < 50) return { t: "Jarang hadir", cls: "bg-[#FEF3C7] text-[#92400E]" };
  if (r.ratio < 80) return { t: "Cukup aktif", cls: "bg-[#CFFAFE] text-[#155E75]" };
  return { t: "Rajin hadir", cls: "bg-[#EFF6FF] text-[#1D4ED8]" };
}

export default function PublicRekapBulanan() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("semua");

  useEffect(() => {
    api.get(`/rekap-bulanan/${token}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setErr("Tautan rekap bulanan tidak ditemukan."));
  }, [token]);

  const rows = useMemo(() => {
    let list = data?.rows || [];
    if (gender !== "semua") list = list.filter((r) => r.gender === gender);
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((r) => (r.name || "").toLowerCase().includes(s));
    return list;
  }, [data, q, gender]);

  if (err) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-4 text-center">
        <Logo size={48} />
        <p className="text-[#991B1B] font-semibold mt-6" data-testid="rekap-bulanan-public-error">{err}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] px-4 py-10" role="status" aria-label="Memuat rekap bulanan">
        <div className="mx-auto h-2 max-w-3xl animate-pulse rounded-full bg-[#E8E8E4]" />
        <Loader2 size={20} className="mx-auto mt-8 animate-spin text-[#6B7280]" />
      </div>
    );
  }

  const g = data.gender || {};

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-14" data-testid="rekap-bulanan-public">
      <header className="bg-[#2563EB] text-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden p-0.5"><K1Mark size={32} variant="light" /></div>
          <div className="leading-tight">
            <div className="font-bold font-heading">E-KERTALANGU</div>
            <div className="text-white/70 text-xs">Rekap Absen Bulanan</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 -mt-3">
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5 shadow-sm">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] inline-flex items-center gap-1">
            <CalendarRange size={12} /> {data.label}
          </span>
          <h1 className="font-heading text-xl font-bold text-[#111827] mt-2">
            {data.total_pertemuan} pertemuan · {data.total_peserta} peserta
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Rata-rata kehadiran {data.summary.rata_rata}% · {data.total_kegiatan} jadwal termasuk sesi
          </p>
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#1D4ED8] font-semibold inline-flex items-center gap-1"><TrendingUp size={12} /> Rajin: {data.summary.rajin}</span>
            <span className="px-2.5 py-1 rounded-full bg-[#CFFAFE] text-[#155E75] font-semibold">Cukup: {data.summary.cukup}</span>
            <span className="px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] font-semibold inline-flex items-center gap-1"><TrendingDown size={12} /> Jarang: {data.summary.jarang}</span>
            <span className="px-2.5 py-1 rounded-full bg-[#FEE2E2] text-[#991B1B] font-semibold">Belum hadir: {data.summary.belum_pernah}</span>
          </div>
        </div>

        {/* Pisah Laki-laki / Perempuan */}
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-4 mt-4" data-testid="bulanan-public-gender">
          <div className="text-sm font-semibold text-[#111827] inline-flex items-center gap-2 mb-3"><Users size={16} className="text-[#1D4ED8]" /> Kehadiran Laki-laki &amp; Perempuan</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#F0FDF4] p-3" data-testid={MONTHLY_RECAP.maleSummary}>
              <div className="text-xs font-semibold text-[#166534]">Laki-laki</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-[#166534]">{g.L?.ratio || 0}%</div>
            </div>
            <div className="rounded-xl bg-[#F5F3FF] p-3" data-testid={MONTHLY_RECAP.femaleSummary}>
              <div className="text-xs font-semibold text-[#6D28D9]">Perempuan</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-[#6D28D9]">{g.P?.ratio || 0}%</div>
            </div>
          </div>
        </div>

        {/* Ringkasan tiap sesi selama 1 bulan */}
        {data.per_sesi?.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E8E8E4] p-4 mt-4" data-testid="bulanan-public-sesi">
            <div className="text-sm font-semibold text-[#111827] inline-flex items-center gap-2 mb-3"><Layers size={16} className="text-[#1D4ED8]" /> Ringkasan Sesi Sebulan</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {data.per_sesi.map((x, i) => (
                <div key={x.label} data-testid={`${MONTHLY_RECAP.sessionCardPrefix}-${i}`}
                  className="min-w-0 rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] p-3">
                  <div className="truncate text-sm font-bold text-[#111827]" title={x.label}>{x.label}</div>
                  <div className="mt-1 text-[11px] text-[#6B7280]">{x.pertemuan}× kegiatan{x.required === false ? " · opsional" : ""}</div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-[#1D4ED8]">{x.ratio}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daftar peserta */}
        <div className="bg-white rounded-2xl border border-[#E8E8E4] mt-4 overflow-hidden">
          <div className="p-4 border-b border-[#E8E8E4] flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input data-testid="bulanan-public-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama peserta…"
                className="w-full h-10 pl-9 pr-3 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#2563EB]" />
            </div>
            <div className="flex items-center gap-1 bg-[#F3F4F6] rounded-xl p-1">
              {GEN.map(([v, l]) => (
                <button key={v} data-testid={`bulanan-public-gender-${v}`} onClick={() => setGender(v)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold ${gender === v ? "bg-white text-[#1D4ED8] shadow-sm" : "text-[#6B7280]"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="bulanan-public-table">
              <thead className="bg-[#FAFAF8] text-[#6B7280] text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Nama Peserta</th>
                  <th className="px-3 py-2 font-semibold text-center">Ikut</th>
                  <th className="px-3 py-2 font-semibold w-[35%]">Kehadiran</th>
                  <th className="px-3 py-2 font-semibold text-center">Izin</th>
                  <th className="px-3 py-2 font-semibold text-center">Alpha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECECE8]">
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-[#6B7280]">Tidak ada data peserta.</td></tr>
                ) : rows.map((r) => {
                  const b = badgeOf(r);
                  return (
                    <tr key={r.user_id}>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-[#111827] flex items-center gap-1.5 flex-wrap">
                          {r.name}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${b.cls}`}>{b.t}</span>
                        </div>
                        <div className="text-[11px] text-[#9CA3AF]">
                          {r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : "—"}
                          {r.kelompok_name ? ` · ${r.kelompok_name}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums text-[#1D4ED8] whitespace-nowrap">
                        {r.hadir}<span className="text-[#9CA3AF] font-semibold">/{r.pertemuan}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <PercentBar label="" value={r.ratio} color={r.ratio >= 80 ? "#111114" : r.ratio >= 50 ? "#6B7280" : "#9CA3AF"} testid={`bar-pub-bulanan-${r.user_id}`} />
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-[#B45309]">{r.izin}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-[#DC2626]">{r.alpha}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daftar pertemuan + rincian sesi */}
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5 mt-4 space-y-4" data-testid="bulanan-public-pertemuan">
          <div className="text-sm font-semibold text-[#111827]">Kegiatan &amp; Sesi Bulan {data.label}</div>
          {data.per_pertemuan.length === 0 ? (
            <div className="text-sm text-[#6B7280]">Belum ada kegiatan pada bulan ini.</div>
          ) : (
            <TooltipProvider>
              {data.per_pertemuan.map((p, i) => (
                <div key={i} className="rounded-xl border border-[#EEF1EE] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold text-sm text-[#111827]">{p.date} · {p.name}</div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" data-testid={`${MONTHLY_RECAP.publicMeetingAttendancePrefix}-${i}`}
                          aria-label={`Kehadiran ${p.hadir} dari ${p.peserta} peserta`}
                          className="min-h-11 rounded-lg bg-[#F0FDF4] px-3 text-sm font-bold text-[#166534]">
                          Hadir {p.hadir}/{p.peserta}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{p.ratio}% hadir</TooltipContent>
                    </Tooltip>
                  </div>
                  {(p.sesi || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.sesi.map((x, j) => (
                        <span key={j} className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${x.required ? "bg-[#EFF6FF] text-[#1D4ED8]" : "bg-[#ECFEFF] text-[#1D4ED8]"}`}>
                          {x.label} {x.start_time}–{x.end_time}{x.required ? "" : " · opsional"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </TooltipProvider>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#E8E8E4] p-4 mt-4 text-sm text-[#4B5563] space-y-1" data-testid="bulanan-public-legend">
          <div className="font-bold text-[#1D4ED8]">Cara menghitung</div>
          <p>Persen hadir = pertemuan berstatus Hadir ÷ pertemuan wajib × 100.</p>
          <p>Hadir di salah satu sesi wajib dihitung hadir. Izin, sakit, alpha, dan belum diabsen dicatat terpisah; sesi opsional tidak menambah kewajiban.</p>
        </div>

        <p className="text-center text-xs text-[#9CA3AF] mt-6">© 2026 E-KERTALANGU · Absensi Pengajian</p>
      </main>
    </div>
  );
}
