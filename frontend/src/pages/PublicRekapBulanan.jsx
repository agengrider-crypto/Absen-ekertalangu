import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Users, TrendingDown, TrendingUp, Search, Layers, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import ReportHeader from "@/components/ReportHeader";
import StatusGroups from "@/components/StatusGroups";
import { PercentBar } from "./PublicRekapGabungan";
import { MONTHLY_RECAP } from "@/constants/testIds";

const GEN = [["semua", "Semua"], ["L", "Laki-laki"], ["P", "Perempuan"]];

function badgeOf(r) {
  if (r.pertemuan === 0) return { t: "Tidak ada kegiatan", cls: "bg-[#F0EEE6] text-[#5F6B63]" };
  if (r.hadir === 0) return { t: "Belum pernah hadir", cls: "bg-[#FBE5E3] text-[#A32A2A]" };
  if (r.ratio < 50) return { t: "Jarang hadir", cls: "bg-[#FBF1D6] text-[#6B4500]" };
  if (r.ratio < 80) return { t: "Cukup aktif", cls: "bg-[#D9F2F4] text-[#1D4F91]" };
  return { t: "Rajin hadir", cls: "bg-[#E3F3EA] text-[#0E4E31]" };
}

export default function PublicRekapBulanan() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [gender, setGender] = useState("semua");
  const [openMeetings, setOpenMeetings] = useState({});
  const [openAll, setOpenAll] = useState(false);

  useEffect(() => {
    api.get(`/rekap-bulanan/${token}`)
      .then(({ data: d }) => setData(d))
      .catch((e) => {
        if (e.response?.status === 410) {
          setErr("Tautan sudah kedaluwarsa. Minta tautan baru ke pengurus.");
        } else {
          setErr("Tautan rekap bulanan tidak ditemukan.");
        }
      });
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
      <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center px-4 text-center">
        <Logo size={48} />
        <p className="text-[#A32A2A] font-semibold mt-6" data-testid="rekap-bulanan-public-error">{err}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] px-4 py-10" role="status" aria-label="Memuat rekap bulanan">
        <div className="mx-auto h-2 max-w-3xl animate-pulse rounded-full bg-[#E7E3D8]" />
        <Loader2 size={20} className="mx-auto mt-8 animate-spin text-[#5F6B63]" />
      </div>
    );
  }

  const g = data.gender || {};

  return (
    <div className="min-h-screen bg-[#F6F4EE] pb-14" data-testid="rekap-bulanan-public">
      <ReportHeader
        title="Laporan Bulanan"
        subtitle={data.label}
        showUserIcon
        testid="rekap-bulanan-header"
      />

      <main className="max-w-3xl mx-auto px-4">
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5 shadow-sm">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E3F3EA] text-[#0E4E31] inline-flex items-center gap-1">
            <CalendarDays size={12} /> {data.label}
          </span>
          <h1 className="font-heading text-xl font-bold text-[#14201A] mt-2 inline-flex items-center gap-2">
            <CalendarDays size={20} className="text-[#14633F]" />
            {data.total_pertemuan} pertemuan · {data.total_peserta} peserta
          </h1>
          <p className="text-sm text-[#5F6B63] mt-1">
            Rata-rata kehadiran {data.summary.rata_rata}% · {data.total_kegiatan} jadwal termasuk sesi
          </p>
          <div className="flex flex-wrap gap-2 mt-3 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-[#E3F3EA] text-[#0E4E31] font-semibold inline-flex items-center gap-1"><TrendingUp size={12} /> Rajin: {data.summary.rajin}</span>
            <span className="px-2.5 py-1 rounded-full bg-[#D9F2F4] text-[#1D4F91] font-semibold">Cukup: {data.summary.cukup}</span>
            <span className="px-2.5 py-1 rounded-full bg-[#FBF1D6] text-[#6B4500] font-semibold inline-flex items-center gap-1"><TrendingDown size={12} /> Jarang: {data.summary.jarang}</span>
            <span className="px-2.5 py-1 rounded-full bg-[#FBE5E3] text-[#A32A2A] font-semibold">Belum hadir: {data.summary.belum_pernah}</span>
          </div>
        </div>

        {/* Pisah Laki-laki / Perempuan */}
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4 mt-4" data-testid="bulanan-public-gender">
          <div className="text-sm font-semibold text-[#14201A] inline-flex items-center gap-2 mb-3"><Users size={16} className="text-[#0E4E31]" /> Kehadiran Laki-laki &amp; Perempuan</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#E3F3EA] p-3" data-testid={MONTHLY_RECAP.maleSummary}>
              <div className="text-xs font-semibold text-[#0E4E31]">Laki-laki</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-[#0E4E31]">{g.L?.ratio || 0}%</div>
            </div>
            <div className="rounded-xl bg-[#ECE4FB] p-3" data-testid={MONTHLY_RECAP.femaleSummary}>
              <div className="text-xs font-semibold text-[#4C2A9B]">Perempuan</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-[#4C2A9B]">{g.P?.ratio || 0}%</div>
            </div>
          </div>
        </div>

        {/* Ringkasan tiap sesi selama 1 bulan */}
        {data.per_sesi?.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4 mt-4" data-testid="bulanan-public-sesi">
            <div className="text-sm font-semibold text-[#14201A] inline-flex items-center gap-2 mb-3"><Layers size={16} className="text-[#0E4E31]" /> Ringkasan Sesi Sebulan</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {data.per_sesi.map((x, i) => (
                <div key={x.label} data-testid={`${MONTHLY_RECAP.sessionCardPrefix}-${i}`}
                  className="min-w-0 rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] p-3">
                  <div className="truncate text-sm font-bold text-[#14201A]" title={x.label}>{x.label}</div>
                  <div className="mt-1 text-[11px] text-[#5F6B63]">{x.pertemuan}× kegiatan{x.required === false ? " · opsional" : ""}</div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-[#0E4E31]">{x.ratio}%</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daftar peserta */}
        <div className="bg-white rounded-2xl border border-[#E7E3D8] mt-4 overflow-hidden">
          <div className="p-4 border-b border-[#E7E3D8] flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
              <input data-testid="bulanan-public-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama peserta…"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F]" />
            </div>
            <div className="flex items-center gap-1 bg-[#F0EEE6] rounded-xl p-1">
              {GEN.map(([v, l]) => (
                <button key={v} data-testid={`bulanan-public-gender-${v}`} onClick={() => setGender(v)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold ${gender === v ? "bg-white text-[#0E4E31] shadow-sm" : "text-[#5F6B63]"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="bulanan-public-table">
              <thead className="bg-[#F6F4EE] text-[#5F6B63] text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Nama Peserta</th>
                  <th className="px-3 py-2 font-semibold text-center">Ikut</th>
                  <th className="px-3 py-2 font-semibold w-[35%]">Kehadiran</th>
                  <th className="px-3 py-2 font-semibold text-center">Izin</th>
                  <th className="px-3 py-2 font-semibold text-center">Alpha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E3D8]">
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-[#5F6B63]">Tidak ada data peserta.</td></tr>
                ) : rows.map((r) => {
                  const b = badgeOf(r);
                  return (
                    <tr key={r.user_id}>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-[#14201A] flex items-center gap-1.5 flex-wrap">
                          {r.name}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${b.cls}`}>{b.t}</span>
                        </div>
                        <div className="text-[11px] text-[#5F6B63]">
                          {r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : "—"}
                          {r.kelompok_name ? ` · ${r.kelompok_name}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold tabular-nums text-[#0E4E31] whitespace-nowrap">
                        {r.hadir}<span className="text-[#5F6B63] font-semibold">/{r.pertemuan}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <PercentBar label="" value={r.ratio} color={r.ratio >= 80 ? "#14201A" : r.ratio >= 50 ? "#5F6B63" : "#5F6B63"} testid={`bar-pub-bulanan-${r.user_id}`} />
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-[#8A5A00]">{r.izin}</td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-[#A32A2A]">{r.alpha}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Daftar pertemuan: accordion per acara (sama seperti halaman utama rekap) */}
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5 mt-4 space-y-3" data-testid="bulanan-public-pertemuan">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-[#14201A]">Kegiatan &amp; Sesi Bulan {data.label}</div>
            {data.per_pertemuan.length > 0 && (
              <button
                type="button"
                data-testid="bulanan-public-toggle-all"
                onClick={() => setOpenAll((v) => !v)}
                className="min-h-10 rounded-xl border-2 border-[#E7E3D8] px-3 text-xs font-semibold text-[#5F6B63] hover:border-[#14633F]"
              >
                {openAll ? "Tutup semua" : "Buka semua"}
              </button>
            )}
          </div>
          {data.per_pertemuan.length === 0 ? (
            <div className="text-sm text-[#5F6B63]">Belum ada kegiatan pada bulan ini.</div>
          ) : (
            <div className="space-y-2">
              {data.per_pertemuan.map((p, i) => {
                const open = openAll || Boolean(openMeetings[i]);
                return (
                  <div key={i} className="overflow-hidden rounded-xl border border-[#F0EEE6]">
                    <button
                      type="button"
                      data-testid={`${MONTHLY_RECAP.publicMeetingAttendancePrefix}-${i}`}
                      onClick={() => setOpenMeetings((prev) => ({ ...prev, [i]: !prev[i] }))}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[#F6F4EE]"
                    >
                      <span className="min-w-0">
                        <span className="block text-[11px] font-semibold text-[#5F6B63]">{p.date}</span>
                        <span className="block truncate text-sm font-semibold text-[#14201A]">{p.name}</span>
                      </span>
                      <span className="shrink-0 rounded-lg bg-[#E3F3EA] px-2.5 py-1 text-xs font-bold text-[#0E4E31]">
                        Hadir {p.hadir} dari {p.peserta}
                      </span>
                    </button>
                    {open && (
                      <div className="border-t border-[#F0EEE6] px-3 py-2.5">
                        <div className="text-[11px] font-semibold text-[#5F6B63]">
                          Hadir {p.hadir} · Izin {p.izin} · Sakit {p.sakit} · Alpha {p.alpha}
                        </div>
                        {p.catatan && (
                          <div className="mt-2 rounded-lg border border-[#EAD596] bg-[#FBF1D6] px-2.5 py-2 text-[11px] leading-relaxed text-[#6B4500]"
                            data-testid={`bulanan-public-catatan-${i}`}>
                            <b>Catatan musyawarah:</b> {p.catatan}
                          </div>
                        )}
                        {(p.peserta_rows || []).length > 0 && (
                          <div className="mt-2">
                            <StatusGroups
                              counts={{
                                total: p.peserta, hadir: p.hadir, izin: p.izin,
                                sakit: p.sakit, alpha: p.alpha, belum_diabsen: p.belum_diabsen,
                              }}
                              rows={(p.peserta_rows || []).map((person) => ({
                                name: person.name,
                                status: person.status,
                                reason: person.reason,
                              }))}
                              showBelum={(p.belum_diabsen || 0) > 0}
                              testid={`bulanan-public-status-${i}`}
                            />
                          </div>
                        )}
                        {(p.sesi || []).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {p.sesi.map((x, j) => (
                              <span key={j} className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${x.required ? "bg-[#E3F3EA] text-[#0E4E31]" : "bg-[#F0EEE6] text-[#5F6B63]"}`}>
                                {x.label} {x.start_time}–{x.end_time}{x.required ? "" : " · opsional"}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-[#E7E3D8] p-4 mt-4 text-sm text-[#5F6B63] space-y-1" data-testid="bulanan-public-legend">
          <div className="font-bold text-[#0E4E31]">Cara menghitung</div>
          <p>Persen hadir = pertemuan berstatus Hadir ÷ pertemuan wajib × 100.</p>
          <p>Hadir di salah satu sesi wajib dihitung hadir. Izin, sakit, alpha, dan belum diabsen dicatat terpisah; sesi opsional tidak menambah kewajiban.</p>
        </div>

        <p className="text-center text-xs text-[#5F6B63] mt-6">© 2026 E-KERTALANGU · Absensi Pengajian</p>
      </main>
    </div>
  );
}
