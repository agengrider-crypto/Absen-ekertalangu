// FASE 17 — Rekap Absen Harian: rincian tiap sesi dalam 1 hari + keterangan per peserta.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck, Calendar1, Loader2, Search, Users, Layers, ChevronLeft, ChevronRight,
  Clock, User, MapPin, Info, ChevronDown, Link2, Send,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { PercentBar } from "@/pages/PublicRekapGabungan";
import ReportHeader from "@/components/ReportHeader";
import StatusGroups from "@/components/StatusGroups";
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
  hadir: { t: "Hadir", cls: "bg-[#E3F3EA] text-[#0E4E31]" },
  izin: { t: "Izin", cls: "bg-[#FBF1D6] text-[#6B4500]" },
  alpha: { t: "Alpha", cls: "bg-[#FBE5E3] text-[#A32A2A]" },
};

export default function RekapHarianView({ initialDate = null }) {
  const [date, setDate] = useState(() => initialDate || todayYmd());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("semua"); // semua | hadir | izin | alpha
  const [open, setOpen] = useState(null);
  const [share, setShare] = useState(null);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/staff/rekap-harian?date=${date}`)
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error("Gagal memuat rekap harian"))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); setShare(null); }, [load]);

  const getLink = async () => {
    if (share) return share;
    setSharing(true);
    try {
      const { data: d } = await api.post(`/staff/rekap-harian/share?date=${date}`);
      setShare(d);
      return d;
    } catch {
      toast.error("Gagal membuat tautan rekap harian");
      return null;
    } finally { setSharing(false); }
  };

  const copyLink = async () => {
    const d = await getLink();
    if (!d) return;
    try {
      await navigator.clipboard.writeText(d.link);
      toast.success("Tautan rekap harian disalin.");
    } catch { toast.info("Tautan siap disalin manual dari kotak di atas."); }
  };

  const shareWa = async () => {
    const d = await getLink();
    if (!d) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(d.wa_text)}`, "_blank");
  };

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
      <ReportHeader
        title="Laporan Harian"
        subtitle={data?.label || date}
        showUserIcon
        compact
        testid="rekap-harian-header"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0E4E31] inline-flex items-center gap-2">
            <Calendar1 size={22} className="text-[#14633F]" /> Rekap Absen Harian
          </h1>
          <p className="text-sm text-[#5F6B63] mt-0.5">
            Rincian kehadiran seluruh sesi pada satu tanggal, lengkap dengan keterangan hitungan tiap peserta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="harian-prev" onClick={() => setDate(shiftDay(date, -1))}
            className="h-11 w-11 rounded-xl border-2 border-[#E7E3D8] flex items-center justify-center text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]"><ChevronLeft size={18} /></button>
          <input data-testid="harian-date" type="date" value={date}
            onChange={(e) => setDate(e.target.value || todayYmd())}
            className="h-11 px-3 rounded-xl border border-[#8A948D] text-sm font-semibold outline-none focus:border-[#14633F] bg-white" />
          <button data-testid="harian-next" onClick={() => setDate(shiftDay(date, 1))}
            className="h-11 w-11 rounded-xl border-2 border-[#E7E3D8] flex items-center justify-center text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]"><ChevronRight size={18} /></button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
          <div className="text-sm text-[#5F6B63] mb-3 inline-flex items-center gap-2">
            <Loader2 size={15} className="animate-spin text-[#0E4E31]" /> Memuat rekap harian…
          </div>
          <SkeletonList rows={6} testid="rekap-harian-skeleton" />
        </div>
      ) : !data ? null : data.total_sesi === 0 ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-10 text-center text-[#5F6B63]" data-testid="rekap-harian-empty">
          Tidak ada kegiatan pada tanggal ini.
        </div>
      ) : (
        <>
          <div className="rounded-2xl border-2 border-[#D9F2F4] bg-[#E3F3EA] p-4" data-testid="rekap-harian-header">
            <div className="font-heading text-lg font-bold text-[#0A5961]">{data.label}</div>
            <div className="text-sm text-[#0E4E31] mt-0.5">
              {data.kegiatan.join(" · ")} — {data.total_sesi} sesi
            </div>
          </div>

          <div className="rounded-2xl border-2 border-[#D9F2F4] bg-[#E3F3EA] p-4 space-y-2.5" data-testid="rekap-harian-share">
            <div className="text-sm font-bold text-[#0A5961] inline-flex items-center gap-1.5"><Link2 size={15} /> Bagikan rekap hari ini</div>
            <p className="text-[11px] text-[#0E4E31] leading-relaxed">
              Tautan publik: siapa pun yang klik bisa langsung melihat rincian tiap sesi,
              keterangan hitungan, dan status kehadiran tiap peserta pada tanggal ini — tanpa perlu login.
            </p>
            {share && (
              <div className="text-[11px] font-mono break-all bg-white rounded-lg border border-[#E7E3D8] px-2.5 py-2 text-[#0A5961]" data-testid="rekap-harian-link">{share.link}</div>
            )}
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <button onClick={shareWa} disabled={sharing} data-testid="rekap-harian-share-wa"
                className="h-11 rounded-xl bg-[#14633F] text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:brightness-95 disabled:opacity-60">
                {sharing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Bagikan ke WhatsApp
              </button>
              <button onClick={copyLink} disabled={sharing} data-testid="rekap-harian-copy-link"
                className="h-11 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#D9F2F4] disabled:opacity-60">
                <Link2 size={15} /> Salin Tautan
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { k: "peserta", label: "Peserta terdaftar", value: sum.peserta, sub: `${sum.slot} slot sesi`, color: REKAP.main, icon: Users },
              { k: "hadir", label: "Hadir", value: sum.hadir, sub: `${sum.hadir_hari} peserta hadir hari ini`, color: REKAP.hadir, icon: CalendarCheck },
              { k: "izin", label: "Izin", value: sum.izin, sub: `${sum.izin_hari} peserta berizin`, color: REKAP.izin, icon: Info },
              { k: "sakit", label: "Sakit", value: sum.sakit, sub: `${sum.sakit_hari} peserta sakit`, color: REKAP.lk, icon: Info },
              { k: "alpha", label: "Alpha", value: sum.alpha, sub: `${sum.alpha_hari} peserta tanpa keterangan`, color: REKAP.alpha, icon: Info },
              { k: "belum_diabsen", label: "Belum diabsen", value: sum.belum_diabsen, sub: `${sum.belum_diabsen_hari} peserta menunggu`, color: "#5F6B63", icon: Info },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.k} className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid={`harian-stat-${s.k}`}>
                  <div className="text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: s.color }}>
                    <Icon size={14} /> {s.label}
                  </div>
                  <div className="text-3xl font-bold mt-1 tabular-nums" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[11px] text-[#5F6B63] mt-0.5">{s.sub}</div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5 space-y-4" data-testid="rekap-harian-sesi">
            <div className="text-sm font-semibold text-[#0E4E31] inline-flex items-center gap-2">
              <Layers size={16} style={{ color: REKAP.main }} /> Kehadiran Tiap Sesi
            </div>
            {data.sesi.map((s) => (
              <div key={s.id} className="rounded-xl border border-[#F0EEE6] p-3.5" data-testid={`harian-sesi-${s.label}`}>
                <PercentBar
                  label={`${s.label}${s.required ? "" : " · opsional"} — ${s.start_time}–${s.end_time} WITA`}
                  value={s.ratio} sub={`${s.hadir}/${s.peserta}`} color={ratioColor(s.ratio)}
                  testid={`bar-harian-${s.label}`} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-[#5F6B63]">
                  {s.teacher && <span className="inline-flex items-center gap-1"><User size={12} /> {s.teacher}</span>}
                  {s.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {s.location}</span>}
                  {s.material && <span className="inline-flex items-center gap-1"><Clock size={12} /> {s.material}</span>}
                </div>
                <div className="mt-3">
                  <StatusGroups
                    counts={{
                      total: s.peserta, hadir: s.hadir, izin: s.izin,
                      sakit: s.sakit, alpha: s.alpha, belum_diabsen: s.belum_diabsen,
                    }}
                    rows={(data.rows || []).map((r) => {
                      const cell = (r.detail || []).find((x) => x.label === s.label);
                      return cell ? { name: r.name, status: cell.status, reason: cell.reason } : null;
                    }).filter(Boolean)}
                    showBelum={(s.belum_diabsen || 0) > 0}
                    testid={`harian-status-${s.label}`}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5 space-y-4" data-testid="rekap-harian-gender">
            <div className="text-sm font-semibold text-[#0E4E31] inline-flex items-center gap-2">
              <Users size={16} style={{ color: REKAP.main }} /> Pisah Laki-laki &amp; Perempuan
            </div>
            <PercentBar label={`Laki-laki (${data.gender?.L?.peserta || 0} peserta)`} value={data.gender?.L?.ratio || 0}
              sub={`${data.gender?.L?.hadir || 0}/${data.gender?.L?.slot || 0}`} color={REKAP.lk} testid="bar-harian-gender-l" />
            <PercentBar label={`Perempuan (${data.gender?.P?.peserta || 0} peserta)`} value={data.gender?.P?.ratio || 0}
              sub={`${data.gender?.P?.hadir || 0}/${data.gender?.P?.slot || 0}`} color={REKAP.pr} testid="bar-harian-gender-p" />
          </div>

          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
            <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
                <input data-testid="harian-search" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama peserta…"
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F]" />
              </div>
              <div className="flex items-center gap-1 bg-[#F0EEE6] rounded-xl p-1">
                {[["semua", "Semua"], ["hadir", "Hadir"], ["izin", "Izin"], ["alpha", "Alpha"]].map(([v, l]) => (
                  <button key={v} data-testid={`harian-filter-${v}`} onClick={() => setFilter(v)}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold ${filter === v ? "bg-white text-[#0E4E31] shadow-sm" : "text-[#5F6B63]"}`}>{l}</button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-[#E7E3D8]" data-testid="rekap-harian-rows">
              {rows.length === 0 ? (
                <div className="p-10 text-center text-[#5F6B63]">Tidak ada peserta pada filter ini.</div>
              ) : rows.map((r) => {
                const chip = STATUS_CHIP[r.status_hari];
                const expanded = open === r.user_id;
                return (
                  <div key={r.user_id} data-testid={`harian-row-${r.user_id}`} className="py-3">
                    <button type="button" onClick={() => setOpen(expanded ? null : r.user_id)}
                      className="w-full text-left flex items-center gap-3 justify-between">
                      <span className="min-w-0">
                        <span className="font-semibold text-[#0E4E31] flex items-center gap-1.5 flex-wrap">
                          {r.name}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${chip.cls}`}>{chip.t}</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <PersenRingkas value={r.ratio} sub={`${r.hadir}/${r.sesi_total}`} testid={`harian-persen-${r.user_id}`} />
                        <ChevronDown size={16} className={`text-[#5F6B63] transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </span>
                    </button>

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

          <div className="rounded-2xl border-2 border-dashed border-[#E7E3D8] bg-white p-4 text-xs text-[#5F6B63] space-y-1.5" data-testid="rekap-harian-legend">
            <div className="font-bold text-[#0E4E31] inline-flex items-center gap-1.5"><Info size={14} /> Keterangan hitungan</div>
            <p>Persen kehadiran = jumlah <b>Hadir</b> ÷ jumlah sesi yang wajib diikuti × 100.</p>
            <p>Hadir + Izin + Alpha selalu sama dengan jumlah sesi peserta tersebut, sehingga persennya berjumlah <b>100%</b>.</p>
            <p>Warna persen: <span className="font-bold text-[#0E4E31]">hijau ≥80%</span>, <span className="font-bold text-[#6B4500]">kuning 50–79%</span>, <span className="font-bold text-[#A32A2A]">merah &lt;50%</span>.</p>
          </div>
        </>
      )}
    </div>
  );
}
