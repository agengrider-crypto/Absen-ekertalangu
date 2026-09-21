import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarRange, Users, TrendingDown, TrendingUp, Search, Layers } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { PercentBar } from "./PublicRekapGabungan";
import { SplashLoading } from "@/components/GlobalLoading";

const GEN = [["semua", "Semua"], ["L", "Laki-laki"], ["P", "Perempuan"]];

function badgeOf(r) {
  if (r.pertemuan === 0) return { t: "Tidak ada kegiatan", cls: "bg-[#F3F4F6] text-[#6B7280]" };
  if (r.hadir === 0) return { t: "Belum pernah hadir", cls: "bg-[#FEE2E2] text-[#991B1B]" };
  if (r.ratio < 50) return { t: "Jarang hadir", cls: "bg-[#FEF3C7] text-[#92400E]" };
  if (r.ratio < 80) return { t: "Cukup aktif", cls: "bg-[#E0F2FE] text-[#075985]" };
  return { t: "Rajin hadir", cls: "bg-[#E8F5EE] text-[#065F46]" };
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
      <div className="min-h-screen bg-[#FAFBF9] flex flex-col items-center justify-center px-4 text-center">
        <Logo size={48} />
        <p className="text-[#991B1B] font-semibold mt-6" data-testid="rekap-bulanan-public-error">{err}</p>
      </div>
    );
  }
  if (!data) return <SplashLoading label="Memuat rekap bulanan…" />;

  const g = data.gender || {};

  return (
    <div className="min-h-screen bg-[#FAFBF9] pb-14" data-testid="rekap-bulanan-public">
      <header className="bg-[#0D5C3A] text-white">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden p-0.5"><img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" /></div>
          <div className="leading-tight">
            <div className="font-bold font-heading">E-KERTALANGU</div>
            <div className="text-white/70 text-xs">Rekap Absen Bulanan</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 -mt-3">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#065F46] inline-flex items-center gap-1">
            <CalendarRange size={12} /> {data.label}
          </span>
          <h1 className="font-heading text-xl font-bold text-[#111827] mt-2">
            {data.total_pertemuan} pertemuan · {data.total_peserta} jamaah
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Rata-rata kehadiran {data.summary.rata_rata}% · {data.total_kegiatan} jadwal termasuk sesi
          </p>
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-[#E8F5EE] text-[#065F46] font-semibold inline-flex items-center gap-1"><TrendingUp size={12} /> Rajin: {data.summary.rajin}</span>
            <span className="px-2.5 py-1 rounded-full bg-[#E0F2FE] text-[#075985] font-semibold">Cukup: {data.summary.cukup}</span>
            <span className="px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#92400E] font-semibold inline-flex items-center gap-1"><TrendingDown size={12} /> Jarang: {data.summary.jarang}</span>
            <span className="px-2.5 py-1 rounded-full bg-[#FEE2E2] text-[#991B1B] font-semibold">Belum hadir: {data.summary.belum_pernah}</span>
          </div>
        </div>

        {/* Pisah Laki-laki / Perempuan */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mt-4 space-y-4" data-testid="bulanan-public-gender">
          <div className="text-sm font-semibold text-[#111827] inline-flex items-center gap-2"><Users size={16} className="text-[#0D5C3A]" /> Kehadiran Laki-laki & Perempuan</div>
          <PercentBar label={`Laki-laki (${g.L?.jamaah || 0} jamaah)`} value={g.L?.ratio || 0} sub={`${g.L?.hadir || 0}/${g.L?.pertemuan || 0}`} testid="bar-pub-gender-l" />
          <PercentBar label={`Perempuan (${g.P?.jamaah || 0} jamaah)`} value={g.P?.ratio || 0} sub={`${g.P?.hadir || 0}/${g.P?.pertemuan || 0}`} color="#D97706" testid="bar-pub-gender-p" />
        </div>

        {/* Ringkasan tiap sesi selama 1 bulan */}
        {data.per_sesi?.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mt-4 space-y-3.5" data-testid="bulanan-public-sesi">
            <div className="text-sm font-semibold text-[#111827] inline-flex items-center gap-2"><Layers size={16} className="text-[#0D5C3A]" /> Ringkasan Sesi Sebulan</div>
            {data.per_sesi.map((x) => (
              <div key={x.label}>
                <PercentBar label={`${x.label}${x.required === false ? " · opsional" : ""} — ${x.pertemuan}x kegiatan`}
                  value={x.ratio} sub={`${x.hadir}/${x.peserta}`} testid={`bar-pub-sesi-${x.label}`} />
              </div>
            ))}
          </div>
        )}

        {/* Daftar jamaah */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] mt-4 overflow-hidden">
          <div className="p-4 border-b border-[#E5E7EB] flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input data-testid="bulanan-public-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama jamaah…"
                className="w-full h-10 pl-9 pr-3 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A]" />
            </div>
            <div className="flex items-center gap-1 bg-[#F4F6F4] rounded-xl p-1">
              {GEN.map(([v, l]) => (
                <button key={v} data-testid={`bulanan-public-gender-${v}`} onClick={() => setGender(v)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold ${gender === v ? "bg-white text-[#0D5C3A] shadow-sm" : "text-[#6B7280]"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="bulanan-public-table">
              <thead className="bg-[#F8FAF8] text-[#6B7280] text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Nama Jamaah</th>
                  <th className="px-3 py-2 font-semibold text-center">Ikut</th>
                  <th className="px-3 py-2 font-semibold w-[35%]">Kehadiran</th>
                  <th className="px-3 py-2 font-semibold text-center">Izin</th>
                  <th className="px-3 py-2 font-semibold text-center">Alpha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F2F0]">
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-[#6B7280]">Tidak ada data jamaah.</td></tr>
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
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums text-[#0D5C3A] whitespace-nowrap">
                        {r.hadir}<span className="text-[#9CA3AF] font-semibold">/{r.pertemuan}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <PercentBar label="" value={r.ratio} color={r.ratio >= 80 ? "#0D5C3A" : r.ratio >= 50 ? "#0369A1" : "#D97706"} testid={`bar-pub-bulanan-${r.user_id}`} />
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
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mt-4 space-y-4" data-testid="bulanan-public-pertemuan">
          <div className="text-sm font-semibold text-[#111827]">Kegiatan &amp; Sesi Bulan {data.label}</div>
          {data.per_pertemuan.length === 0 ? (
            <div className="text-sm text-[#6B7280]">Belum ada kegiatan pada bulan ini.</div>
          ) : data.per_pertemuan.map((p, i) => (
            <div key={i} className="rounded-xl border border-[#EEF1EE] p-3.5">
              <PercentBar label={`${p.date} · ${p.name}`} value={p.ratio} sub={`${p.hadir}/${p.peserta}`} testid={`bar-pub-pertemuan-${i}`} />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {p.sesi.map((x, j) => (
                  <span key={j} className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${x.required ? "bg-[#E8F5EE] text-[#065F46]" : "bg-[#EEF2FF] text-[#3730A3]"}`}>
                    {x.label} {x.start_time}–{x.end_time} · {x.hadir}/{x.peserta} ({x.ratio}%)
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-[#9CA3AF] mt-6">© 2026 E-KERTALANGU · Absensi Pengajian</p>
      </main>
    </div>
  );
}
