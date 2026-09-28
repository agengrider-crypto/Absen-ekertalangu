// FASE 17 — Rekap Absen Harian: rincian tiap sesi dalam 1 hari + keterangan per peserta.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck, Loader2, Search, Users, Layers, ChevronLeft, ChevronRight,
  Clock, User, MapPin, Info, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PercentBar } from "@/pages/PublicRekapGabungan";
import { SkeletonList } from "@/components/GlobalLoading";
import { REKAP, PersenRingkas, keteranganHitungan, ratioColor } from "./rekapUtils";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDay(ymd, delta) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

const STATUS_CHIP = {
  hadir: { t: "Hadir", cls: "bg-[#DCFCE7] text-[#166534]" },
  izin: { t: "Izin", cls: "bg-[#FEF3C7] text-[#92400E]" },
  alpha: { t: "Alpha", cls: "bg-[#FEE2E2] text-[#991B1B]" },
};

export default function RekapHarianView() {
  const [date, setDate] = useState(todayYmd);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("semua"); // semua | hadir | izin | alpha
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/staff/rekap-harian?date=${date}`)
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error("Gagal memuat rekap harian"))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    let list = data?.rows || [];
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((r) => (r.name || "").toLowerCase().includes(s));
    if (filter !== "semua") list = list.filter((r) => r.status_hari === filter);
    return list;
  }, [data, q, filter]);

  const sum = data?.summary;

  return (
    <div className="space-y-5" data-testid="rekap-harian-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#111114]">Rekap Absen Harian</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Rincian kehadiran seluruh sesi pada satu tanggal, lengkap dengan keterangan hitungan tiap peserta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="harian-prev" onClick={() => setDate(shiftDay(date, -1))}
            className="h-11 w-11 rounded-xl border-2 border-[#E8E8E4] flex items-center justify-center text-[#4B5563] hover:border-[#0F766E] hover:text-[#0F766E]"><ChevronLeft size={18} /></button>
          <input data-testid="harian-date" type="date" value={date}
            onChange={(e) => setDate(e.target.value || todayYmd())}
            className="h-11 px-3 rounded-xl border-2 border-[#E8E8E4] text-sm font-semibold outline-none focus:border-[#0F766E] bg-white" />
          <button data-testid="harian-next" onClick={() => setDate(shiftDay(date, 1))}
            className="h-11 w-11 rounded-xl border-2 border-[#E8E8E4] flex items-center justify-center text-[#4B5563] hover:border-[#0F766E] hover:text-[#0F766E]"><ChevronRight size={18} /></button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5">
          <div className="text-sm text-[#6B7280] mb-3 inline-flex items-center gap-2">
            <Loader2 size={15} className="animate-spin text-[#0F766E]" /> Memuat rekap harian…
          </div>
          <SkeletonList rows={6} testid="rekap-harian-skeleton" />
        </div>
      ) : !data ? null : data.total_sesi === 0 ? (
        <div className="rounded-2xl border border-[#E8E8E4] bg-white p-10 text-center text-[#6B7280]" data-testid="rekap-harian-empty">
          Tidak ada kegiatan pada tanggal ini.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border-2 border-[#CCFBF1] bg-[#F0FDFA] p-4" data-testid="rekap-harian-header">
            <div className="font-heading text-lg font-bold text-[#115E59]">{data.label}</div>
            <div className="text-sm text-[#0F766E] mt-0.5">
              {data.kegiatan.join(" · ")} — {data.total_sesi} sesi
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { k: "peserta", label: "Peserta terdaftar", value: sum.peserta, sub: `${sum.slot} slot sesi`, color: REKAP.main, icon: Users },
              { k: "hadir", label: "Hadir", value: sum.hadir, sub: `${sum.hadir_hari} peserta hadir hari ini`, color: REKAP.hadir, icon: CalendarCheck },
              { k: "izin", label: "Izin", value: sum.izin, sub: `${sum.izin_hari} peserta berizin`, color: REKAP.izin, icon: Info },
              { k: "alpha", label: "Alpha", value: sum.alpha, sub: `${sum.alpha_hari} peserta tanpa keterangan`, color: REKAP.alpha, icon: Info },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.k} className="rounded-2xl border border-[#E8E8E4] bg-white p-4" data-testid={`harian-stat-${s.k}`}>
                  <div className="text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: s.color }}>
                    <Icon size={14} /> {s.label}
                  </div>
                  <div className="text-3xl font-bold mt-1 tabular-nums" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[11px] text-[#9CA3AF] mt-0.5">{s.sub}</div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5 space-y-4" data-testid="rekap-harian-sesi">
            <div className="text-sm font-semibold text-[#111114] inline-flex items-center gap-2">
              <Layers size={16} style={{ color: REKAP.main }} /> Kehadiran Tiap Sesi
            </div>
            {data.sesi.map((s) => (
              <div key={s.id} className="rounded-xl border border-[#EEF1EE] p-3.5" data-testid={`harian-sesi-${s.label}`}>
                <PercentBar
                  label={`${s.label}${s.required ? "" : " · opsional"} — ${s.start_time}–${s.end_time} WITA`}
                  value={s.ratio} sub={`${s.hadir}/${s.peserta}`} color={ratioColor(s.ratio)}
                  testid={`bar-harian-${s.label}`} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-[#6B7280]">
                  {s.teacher && <span className="inline-flex items-center gap-1"><User size={12} /> {s.teacher}</span>}
                  {s.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {s.location}</span>}
                  {s.material && <span className="inline-flex items-center gap-1"><Clock size={12} /> {s.material}</span>}
                </div>
                <div className="mt-2 text-[11px] font-semibold text-[#4B5563]">
                  {keteranganHitungan({ hadir: s.hadir, izin: s.izin, alpha: s.alpha, total: s.peserta, satuan: "peserta" })}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5 space-y-4" data-testid="rekap-harian-gender">
            <div className="text-sm font-semibold text-[#111114] inline-flex items-center gap-2">
              <Users size={16} style={{ color: REKAP.main }} /> Pisah Laki-laki &amp; Perempuan
            </div>
            <PercentBar label={`Laki-laki (${data.gender?.L?.peserta || 0} peserta)`} value={data.gender?.L?.ratio || 0}
              sub={`${data.gender?.L?.hadir || 0}/${data.gender?.L?.slot || 0}`} color={REKAP.lk} testid="bar-harian-gender-l" />
            <PercentBar label={`Perempuan (${data.gender?.P?.peserta || 0} peserta)`} value={data.gender?.P?.ratio || 0}
              sub={`${data.gender?.P?.hadir || 0}/${data.gender?.P?.slot || 0}`} color={REKAP.pr} testid="bar-harian-gender-p" />
          </div>

          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5">
            <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input data-testid="harian-search" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama peserta…"
                  className="w-full h-11 pl-9 pr-3 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#0F766E]" />
              </div>
              <div className="flex items-center gap-1 bg-[#F4F6F4] rounded-xl p-1">
                {[["semua", "Semua"], ["hadir", "Hadir"], ["izin", "Izin"], ["alpha", "Alpha"]].map(([v, l]) => (
                  <button key={v} data-testid={`harian-filter-${v}`} onClick={() => setFilter(v)}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold ${filter === v ? "bg-white text-[#0F766E] shadow-sm" : "text-[#6B7280]"}`}>{l}</button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-[#ECECE8]" data-testid="rekap-harian-rows">
              {rows.length === 0 ? (
                <div className="p-10 text-center text-[#6B7280]">Tidak ada peserta pada filter ini.</div>
              ) : rows.map((r) => {
                const chip = STATUS_CHIP[r.status_hari];
                const expanded = open === r.user_id;
                return (
                  <div key={r.user_id} data-testid={`harian-row-${r.user_id}`} className="py-3">
                    <button type="button" onClick={() => setOpen(expanded ? null : r.user_id)}
                      className="w-full text-left flex items-center gap-3 justify-between">
                      <span className="min-w-0">
                        <span className="font-semibold text-[#111114] flex items-center gap-1.5 flex-wrap">
                          {r.name}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${chip.cls}`}>{chip.t}</span>
                        </span>
                        <span className="block text-[11px] text-[#9CA3AF]">
                          {r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : "—"}
                          {r.kelompok_name ? ` · ${r.kelompok_name}` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <PersenRingkas value={r.ratio} sub={`${r.hadir}/${r.sesi_total}`} testid={`harian-persen-${r.user_id}`} />
                        <ChevronDown size={16} className={`text-[#9CA3AF] transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </span>
                    </button>

                    <div className="mt-1.5 text-[11px] font-semibold text-[#4B5563]" data-testid={`harian-keterangan-${r.user_id}`}>
                      {keteranganHitungan({ hadir: r.hadir, izin: r.izin, alpha: r.alpha, total: r.sesi_total, satuan: "sesi" })}
                    </div>

                    {expanded && (
                      <div className="mt-2 flex flex-wrap gap-1.5" data-testid={`harian-detail-${r.user_id}`}>
                        {r.detail.map((x, i) => {
                          const c = STATUS_CHIP[x.status];
                          return (
                            <span key={i} className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${c.cls}`}>
                              {x.label} {x.start_time}–{x.end_time}{x.required ? "" : " (opsional)"} · {c.t}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border-2 border-dashed border-[#E8E8E4] bg-white p-4 text-xs text-[#4B5563] space-y-1.5" data-testid="rekap-harian-legend">
            <div className="font-bold text-[#111114] inline-flex items-center gap-1.5"><Info size={14} /> Keterangan hitungan</div>
            <p>Persen kehadiran = jumlah <b>Hadir</b> ÷ jumlah sesi yang wajib diikuti × 100.</p>
            <p>Hadir + Izin + Alpha selalu sama dengan jumlah sesi peserta tersebut, sehingga persennya berjumlah <b>100%</b>.</p>
            <p>Warna persen: <span className="font-bold text-[#166534]">hijau ≥80%</span>, <span className="font-bold text-[#92400E]">kuning 50–79%</span>, <span className="font-bold text-[#991B1B]">merah &lt;50%</span>.</p>
          </div>
        </>
      )}
    </div>
  );
}
