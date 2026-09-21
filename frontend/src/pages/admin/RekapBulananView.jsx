import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange, Loader2, Search, Users, TrendingUp, TrendingDown, ClipboardCopy,
  ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PercentBar } from "@/pages/PublicRekapGabungan";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember"];

function thisMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(m, delta) {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(y, mm - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function badgeOf(r) {
  if (r.pertemuan === 0) return { t: "Tidak ada kegiatan", cls: "bg-[#F3F4F6] text-[#6B7280]" };
  if (r.hadir === 0) return { t: "Belum pernah hadir", cls: "bg-[#FEE2E2] text-[#991B1B]" };
  if (r.ratio < 50) return { t: "Jarang hadir", cls: "bg-[#FEF3C7] text-[#92400E]" };
  if (r.ratio < 80) return { t: "Cukup aktif", cls: "bg-[#E0F2FE] text-[#075985]" };
  return { t: "Rajin hadir", cls: "bg-[#E8F5EE] text-[#065F46]" };
}

export default function RekapBulananView() {
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("semua"); // semua | jarang | rajin | belum

  const load = (m) => {
    setLoading(true);
    api.get(`/staff/rekap-bulanan?month=${m}`)
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error("Gagal memuat rekap bulanan"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(month); }, [month]);

  const rows = useMemo(() => {
    let list = data?.rows || [];
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((r) => (r.name || "").toLowerCase().includes(s));
    if (filter === "jarang") list = list.filter((r) => r.pertemuan > 0 && r.ratio < 50);
    if (filter === "rajin") list = list.filter((r) => r.ratio >= 80 && r.pertemuan > 0);
    if (filter === "belum") list = list.filter((r) => r.pertemuan > 0 && r.hadir === 0);
    return list;
  }, [data, q, filter]);

  const copyWa = async () => {
    if (!data) return;
    const top = (data.rows || []).filter((r) => r.pertemuan > 0 && r.ratio < 50).slice(0, 20);
    const text =
      `*Rekap Absen Bulanan — ${data.label}*\n` +
      `Jumlah pertemuan: ${data.total_pertemuan}\n` +
      `Rata-rata kehadiran: ${data.summary.rata_rata}%\n\n` +
      (top.length
        ? `Jamaah yang perlu diperhatikan (hadir < 50%):\n` +
          top.map((r, i) => `${i + 1}. ${r.name} — ${r.hadir}/${r.pertemuan} (${r.ratio}%)`).join("\n")
        : "Alhamdulillah, semua jamaah hadir di atas 50%.");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Ringkasan bulanan disalin.");
    } catch { toast.info("Tidak bisa menyalin otomatis di perangkat ini."); }
  };

  const [y, m] = month.split("-").map(Number);

  return (
    <div className="space-y-5" data-testid="rekap-bulanan-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#111827]">Rekap Absen Bulanan</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Berapa kali setiap jamaah mengikuti pertemuan dalam satu bulan. Satu hari kegiatan dihitung satu pertemuan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="bulan-prev" onClick={() => setMonth(shiftMonth(month, -1))}
            className="h-11 w-11 rounded-xl border-2 border-[#E5E7EB] flex items-center justify-center text-[#4B5563] hover:border-[#0D5C3A] hover:text-[#0D5C3A]"><ChevronLeft size={18} /></button>
          <div className="h-11 px-4 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm inline-flex items-center gap-2" data-testid="bulan-aktif">
            <CalendarRange size={16} /> {BULAN[m - 1]} {y}
          </div>
          <button data-testid="bulan-next" onClick={() => setMonth(shiftMonth(month, 1))}
            className="h-11 w-11 rounded-xl border-2 border-[#E5E7EB] flex items-center justify-center text-[#4B5563] hover:border-[#0D5C3A] hover:text-[#0D5C3A]"><ChevronRight size={18} /></button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={30} /></div>
      ) : !data ? null : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4" data-testid="stat-pertemuan">
              <div className="text-xs font-semibold text-[#6B7280] inline-flex items-center gap-1.5"><CalendarRange size={14} /> Pertemuan bulan ini</div>
              <div className="text-3xl font-bold text-[#111827] mt-1 tabular-nums">{data.total_pertemuan}</div>
              <div className="text-[11px] text-[#9CA3AF] mt-0.5">{data.total_kegiatan} jadwal termasuk sesi</div>
            </div>
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4" data-testid="stat-jamaah">
              <div className="text-xs font-semibold text-[#6B7280] inline-flex items-center gap-1.5"><Users size={14} /> Jumlah jamaah</div>
              <div className="text-3xl font-bold text-[#111827] mt-1 tabular-nums">{data.total_peserta}</div>
              <div className="text-[11px] text-[#9CA3AF] mt-0.5">Rata-rata hadir {data.summary.rata_rata}%</div>
            </div>
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4" data-testid="stat-rajin">
              <div className="text-xs font-semibold text-[#065F46] inline-flex items-center gap-1.5"><TrendingUp size={14} /> Rajin hadir (≥80%)</div>
              <div className="text-3xl font-bold text-[#0D5C3A] mt-1 tabular-nums">{data.summary.rajin}</div>
              <div className="text-[11px] text-[#9CA3AF] mt-0.5">Cukup aktif: {data.summary.cukup}</div>
            </div>
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4" data-testid="stat-jarang">
              <div className="text-xs font-semibold text-[#92400E] inline-flex items-center gap-1.5"><TrendingDown size={14} /> Jarang hadir (&lt;50%)</div>
              <div className="text-3xl font-bold text-[#B45309] mt-1 tabular-nums">{data.summary.jarang}</div>
              <div className="text-[11px] text-[#9CA3AF] mt-0.5">Belum pernah hadir: {data.summary.belum_pernah}</div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input data-testid="rekap-bulanan-search" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama jamaah…"
                  className="w-full h-11 pl-9 pr-3 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A]" />
              </div>
              <div className="flex items-center gap-1 bg-[#F4F6F4] rounded-xl p-1">
                {[["semua", "Semua"], ["jarang", "Jarang"], ["belum", "Belum hadir"], ["rajin", "Rajin"]].map(([v, l]) => (
                  <button key={v} data-testid={`rekap-bulanan-filter-${v}`} onClick={() => setFilter(v)}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold ${filter === v ? "bg-white text-[#0D5C3A] shadow-sm" : "text-[#6B7280]"}`}>{l}</button>
                ))}
              </div>
              <button data-testid="rekap-bulanan-copy" onClick={copyWa}
                className="h-11 px-4 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm inline-flex items-center gap-2 hover:bg-[#E8F5EE]">
                <ClipboardCopy size={16} /> Salin Ringkasan
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="rekap-bulanan-table">
                <thead className="bg-[#F8FAF8] text-[#6B7280] text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Nama Jamaah</th>
                    <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Ikut</th>
                    <th className="px-3 py-2 font-semibold w-[38%]">Tingkat kehadiran</th>
                    <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Izin</th>
                    <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Alpha</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Terakhir hadir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F2F0]">
                  {rows.length === 0 ? (
                    <tr><td colSpan={6} className="p-10 text-center text-[#6B7280]">Tidak ada data jamaah.</td></tr>
                  ) : rows.map((r) => {
                    const b = badgeOf(r);
                    return (
                      <tr key={r.user_id} data-testid={`rekap-bulanan-row-${r.user_id}`} className="hover:bg-[#FAFBF9]">
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
                          <PercentBar label="" value={r.ratio} color={r.ratio >= 80 ? "#0D5C3A" : r.ratio >= 50 ? "#0369A1" : "#D97706"} testid={`bar-bulanan-${r.user_id}`} />
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-[#B45309]">{r.izin}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-[#DC2626]">{r.alpha}</td>
                        <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{r.last_date || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5">
            <div className="font-semibold text-[#111827] text-sm mb-3">Daftar Pertemuan {data.label}</div>
            {data.per_pertemuan.length === 0 ? (
              <div className="text-sm text-[#6B7280] inline-flex items-center gap-2"><AlertTriangle size={15} /> Belum ada kegiatan pada bulan ini.</div>
            ) : (
              <div className="space-y-3" data-testid="rekap-bulanan-pertemuan">
                {data.per_pertemuan.map((p, i) => (
                  <div key={i}>
                    <PercentBar label={`${p.date} · ${p.name}${p.sessions > 1 ? ` (${p.sessions} sesi)` : ""}`}
                      value={p.ratio} sub={`${p.hadir}/${p.peserta}`} testid={`bar-pertemuan-${i}`} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-[#9CA3AF] inline-flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Hadir di salah satu sesi wajib pada hari itu sudah dihitung hadir untuk pertemuan tersebut.
          </p>
        </>
      )}
    </div>
  );
}
