import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange, Loader2, Search, Users, TrendingUp, TrendingDown, Link2, Send,
  ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Layers, ChevronDown, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { SkeletonList } from "@/components/GlobalLoading";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MONTHLY_RECAP } from "@/constants/testIds";
import { useAuth } from "@/context/AuthContext";
import { REKAP, PersenRingkas, ratioColor } from "./rekapUtils";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember"];
const HIDDEN_PARTICIPANTS_KEY = "rekap-bulanan-peserta-tersembunyi";

function thisMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(m, delta) {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(y, mm - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function hiddenStorageKey(userId) {
  return `${HIDDEN_PARTICIPANTS_KEY}:${userId || "pengguna"}`;
}

function readHiddenParticipants(userId) {
  const saved = JSON.parse(localStorage.getItem(hiddenStorageKey(userId)) || "{}");
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(saved).filter(([, expiresAt]) => Number(expiresAt) > now),
  );
}

function threeMonthsFromNow() {
  const date = new Date();
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + 3);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return date.getTime();
}

function badgeOf(r) {
  if (r.pertemuan === 0) return { t: "Tidak ada kegiatan", cls: "bg-[#F3F4F6] text-[#6B7280]" };
  if (r.hadir === 0) return { t: "Belum pernah hadir", cls: "bg-[#FEE2E2] text-[#991B1B]" };
  if (r.ratio < 50) return { t: "Jarang hadir", cls: "bg-[#FEF3C7] text-[#92400E]" };
  if (r.ratio < 80) return { t: "Cukup aktif", cls: "bg-[#E0F2FE] text-[#075985]" };
  return { t: "Rajin hadir", cls: "bg-[#DCFCE7] text-[#166534]" };
}

function statusStyle(status) {
  const styles = {
    hadir: { name: "text-[#166534]", badge: "bg-[#DCFCE7]", label: "Hadir" },
    izin: { name: "text-[#92400E]", badge: "bg-[#FEF3C7]", label: "Izin" },
    sakit: { name: "text-[#1D4ED8]", badge: "bg-[#DBEAFE]", label: "Sakit" },
    alpha: { name: "text-[#991B1B]", badge: "bg-[#FEE2E2]", label: "Alpha" },
    belum_diabsen: { name: "text-[#6B7280]", badge: "bg-[#F3F4F6]", label: "Belum diabsen" },
  };
  return styles[status] || styles.belum_diabsen;
}

export default function RekapBulananView({ initialFilter = "semua" }) {
  const { user } = useAuth();
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(initialFilter); // semua | jarang | cukup | rajin | belum
  const [gender, setGender] = useState("semua"); // semua | L | P
  const [share, setShare] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [hiddenParticipants, setHiddenParticipants] = useState({});
  const [showHiddenParticipants, setShowHiddenParticipants] = useState(false);

  useEffect(() => {
    setHiddenParticipants(readHiddenParticipants(user?.id));
  }, [user?.id]);

  const updateHiddenParticipants = (userId, hide) => {
    const updated = { ...hiddenParticipants };
    if (hide) updated[userId] = threeMonthsFromNow();
    else delete updated[userId];
    localStorage.setItem(hiddenStorageKey(user?.id), JSON.stringify(updated));
    setHiddenParticipants(updated);
  };

  const load = (m) => {
    setLoading(true);
    api.get(`/staff/rekap-bulanan?month=${m}`)
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error("Gagal memuat rekap bulanan"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(month); setShare(null); }, [month]);

  const filteredRows = useMemo(() => {
    let list = data?.rows || [];
    if (gender !== "semua") list = list.filter((r) => r.gender === gender);
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((r) => (r.name || "").toLowerCase().includes(s));
    if (filter === "jarang") list = list.filter((r) => r.pertemuan > 0 && r.hadir > 0 && r.ratio < 50);
    if (filter === "cukup") list = list.filter((r) => r.pertemuan > 0 && r.ratio >= 50 && r.ratio < 80);
    if (filter === "rajin") list = list.filter((r) => r.ratio >= 80 && r.pertemuan > 0);
    if (filter === "belum") list = list.filter((r) => r.pertemuan > 0 && r.hadir === 0);
    return list;
  }, [data, q, filter, gender]);
  const rows = filteredRows.filter((r) => !hiddenParticipants[r.user_id]);
  const hiddenRows = (data?.rows || []).filter((r) => hiddenParticipants[r.user_id]);

  const getLink = async () => {
    if (share) return share;
    setSharing(true);
    try {
      const { data: d } = await api.post(`/staff/rekap-bulanan/share?month=${month}`);
      setShare(d);
      return d;
    } catch {
      toast.error("Gagal membuat tautan rekap bulanan");
      return null;
    } finally { setSharing(false); }
  };

  const copyLink = async () => {
    const d = await getLink();
    if (!d) return;
    try {
      await navigator.clipboard.writeText(d.link);
      toast.success("Tautan rekap bulanan disalin.");
    } catch { toast.info("Tautan siap disalin manual dari kotak di bawah."); }
  };

  const shareWa = async () => {
    const d = await getLink();
    if (!d) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(d.wa_text)}`, "_blank");
  };

  const [y, m] = month.split("-").map(Number);

  return (
    <div className="space-y-5" data-testid="rekap-bulanan-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#111827]">Rekap Absen Bulanan</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Berapa kali setiap peserta mengikuti pertemuan dalam satu bulan. Satu hari kegiatan dihitung satu pertemuan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="bulan-prev" onClick={() => setMonth(shiftMonth(month, -1))}
            className="h-11 w-11 rounded-xl border-2 border-[#E8E8E4] flex items-center justify-center text-[#4B5563] hover:border-[#0F766E] hover:text-[#0F766E]"><ChevronLeft size={18} /></button>
          <div className="h-11 px-4 rounded-xl bg-[#0F766E] text-white font-semibold text-sm inline-flex items-center gap-2" data-testid="bulan-aktif">
            <CalendarRange size={16} /> {BULAN[m - 1]} {y}
          </div>
          <button data-testid="bulan-next" onClick={() => setMonth(shiftMonth(month, 1))}
            className="h-11 w-11 rounded-xl border-2 border-[#E8E8E4] flex items-center justify-center text-[#4B5563] hover:border-[#0F766E] hover:text-[#0F766E]"><ChevronRight size={18} /></button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-[#F1F3F1] animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />)}
          </div>
          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5">
            <div className="text-sm text-[#6B7280] mb-3 inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin text-[#0F766E]" /> Memuat rekap bulanan…</div>
            <SkeletonList rows={6} testid="rekap-bulanan-skeleton" />
          </div>
        </div>
      ) : !data ? null : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4" data-testid="stat-pertemuan">
              <div className="text-xs font-semibold text-[#0F766E] inline-flex items-center gap-1.5"><CalendarRange size={14} /> Pertemuan bulan ini</div>
              <div className="text-3xl font-bold text-[#0F766E] mt-1 tabular-nums">{data.total_pertemuan}</div>
              <div className="text-[11px] text-[#9CA3AF] mt-0.5">{data.total_kegiatan} jadwal termasuk sesi</div>
            </div>
            <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4" data-testid="stat-jamaah">
              <div className="text-xs font-semibold text-[#2563EB] inline-flex items-center gap-1.5"><Users size={14} /> Jumlah peserta</div>
              <div className="text-3xl font-bold text-[#2563EB] mt-1 tabular-nums">{data.total_peserta}</div>
              <div className="text-[11px] text-[#9CA3AF] mt-0.5">Rata-rata hadir {data.summary.rata_rata}%</div>
            </div>
            <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4" data-testid="stat-rajin">
              <div className="text-xs font-semibold text-[#15803D] inline-flex items-center gap-1.5"><TrendingUp size={14} /> Rajin hadir (≥80%)</div>
              <div className="text-3xl font-bold text-[#15803D] mt-1 tabular-nums">{data.summary.rajin}</div>
              <div className="text-[11px] text-[#9CA3AF] mt-0.5">Cukup aktif: {data.summary.cukup}</div>
            </div>
            <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4" data-testid="stat-jarang">
              <div className="text-xs font-semibold text-[#92400E] inline-flex items-center gap-1.5"><TrendingDown size={14} /> Jarang hadir (&lt;50%)</div>
              <div className="text-3xl font-bold text-[#B45309] mt-1 tabular-nums">{data.summary.jarang}</div>
              <div className="text-[11px] text-[#9CA3AF] mt-0.5">Belum pernah hadir: {data.summary.belum_pernah}</div>
            </div>
          </div>

          {/* Bagikan sebagai tautan + WhatsApp */}
          <div className="rounded-2xl border-2 border-[#CCFBF1] bg-[#F0FDFA] p-4 space-y-2.5" data-testid="rekap-bulanan-share">
            <div className="text-sm font-bold text-[#115E59] inline-flex items-center gap-1.5"><Link2 size={15} /> Bagikan rekap bulan ini</div>
            <p className="text-[11px] text-[#0F766E] leading-relaxed">
              Tautan publik: siapa pun yang klik bisa langsung melihat siapa saja yang hadir,
              berapa kali ikut, dan rincian sesinya — tanpa perlu login.
            </p>
            {share && (
              <div className="text-[11px] font-mono break-all bg-white rounded-lg border border-[#E8E8E4] px-2.5 py-2 text-[#111114]" data-testid="rekap-bulanan-link">{share.link}</div>
            )}
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <button onClick={shareWa} disabled={sharing} data-testid="rekap-bulanan-share-wa"
                className="h-11 rounded-xl bg-[#25D366] text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:brightness-95 disabled:opacity-60">
                {sharing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Bagikan ke WhatsApp
              </button>
              <button onClick={copyLink} disabled={sharing} data-testid="rekap-bulanan-copy-link"
                className="h-11 rounded-xl border-2 border-[#0F766E] text-[#0F766E] font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#CCFBF1] disabled:opacity-60">
                <Link2 size={15} /> Salin Tautan
              </button>
            </div>
          </div>

          {/* Pisah Laki-laki / Perempuan */}
          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4" data-testid="rekap-bulanan-gender">
            <div className="text-sm font-semibold text-[#111827] inline-flex items-center gap-2 mb-3"><Users size={16} style={{ color: REKAP.main }} /> Pisah Laki-laki &amp; Perempuan</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#F0FDF4] p-3" data-testid={MONTHLY_RECAP.maleSummary}>
                <div className="text-xs font-semibold text-[#166534]">Laki-laki</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-[#166534]">{data.gender?.L?.ratio || 0}%</div>
              </div>
              <div className="rounded-xl bg-[#F5F3FF] p-3" data-testid={MONTHLY_RECAP.femaleSummary}>
                <div className="text-xs font-semibold text-[#6D28D9]">Perempuan</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-[#6D28D9]">{data.gender?.P?.ratio || 0}%</div>
              </div>
            </div>
          </div>

          {/* Ringkasan sesi sebulan */}
          {data.per_sesi?.length > 0 && (
            <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4" data-testid="rekap-bulanan-sesi">
              <div className="text-sm font-semibold text-[#111827] inline-flex items-center gap-2 mb-3"><Layers size={16} style={{ color: REKAP.main }} /> Ringkasan Sesi Selama Sebulan</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {data.per_sesi.map((x, i) => (
                  <div key={x.label} data-testid={`${MONTHLY_RECAP.sessionCardPrefix}-${i}`}
                    className="min-w-0 rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] p-3">
                    <div className="truncate text-sm font-bold text-[#111827]" title={x.label}>{x.label}</div>
                    <div className="mt-1 text-[11px] text-[#6B7280]">{x.pertemuan}× kegiatan{x.required === false ? " · opsional" : ""}</div>
                    <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: ratioColor(x.ratio) }}>{x.ratio}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5">
            <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input data-testid="rekap-bulanan-search" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama peserta…"
                  className="w-full h-11 pl-9 pr-3 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#0F766E]" />
              </div>
              <div className="flex items-center gap-1 bg-[#F4F6F4] rounded-xl p-1" data-testid="rekap-bulanan-gender-tabs">
                {[["semua", "L/P"], ["L", "Laki-laki"], ["P", "Perempuan"]].map(([v, l]) => (
                  <button key={v} data-testid={`rekap-bulanan-gender-${v}`} onClick={() => setGender(v)}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold ${gender === v ? "bg-white text-[#0F766E] shadow-sm" : "text-[#6B7280]"}`}>{l}</button>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-[#F4F6F4] rounded-xl p-1">
                {[["semua", "Semua"], ["belum", "Belum hadir"], ["jarang", "Jarang"], ["cukup", "Cukup"], ["rajin", "Rajin"]].map(([v, l]) => (
                  <button key={v} data-testid={`rekap-bulanan-filter-${v}`} onClick={() => setFilter(v)}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold ${filter === v ? "bg-white text-[#0F766E] shadow-sm" : "text-[#6B7280]"}`}>{l}</button>
                ))}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={hideInactive}
                data-testid="rekap-bulanan-hide-inactive"
                onClick={() => setHideInactive((v) => !v)}
                className={`inline-flex items-center gap-2 h-9 pl-2 pr-3 rounded-xl border-2 text-xs font-semibold transition-colors ${
                  hideInactive
                    ? "bg-[#0F766E] border-[#0F766E] text-white"
                    : "bg-white border-[#E8E8E4] text-[#6B7280] hover:border-[#0F766E]"
                }`}
                title="Sembunyikan peserta yang tidak pernah hadir dalam 3 bulan terakhir"
              >
                <span className={`relative h-5 w-9 rounded-full transition-colors ${hideInactive ? "bg-white/30" : "bg-[#E8E8E4]"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${hideInactive ? "left-[18px]" : "left-0.5"}`} />
                </span>
                Sembunyikan tidak aktif
              </button>
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FAFAF8] px-3 py-2.5">
              <p className="text-xs text-[#6B7280]">
                Peserta tersembunyi hanya tidak ditampilkan di daftar ini selama 3 bulan; hitungan dan tautan publik tidak berubah.
              </p>
              <button
                type="button"
                data-testid={MONTHLY_RECAP.hiddenParticipantsToggle}
                aria-expanded={showHiddenParticipants}
                onClick={() => setShowHiddenParticipants((show) => !show)}
                className="min-h-11 shrink-0 rounded-xl border-2 border-[#0F766E] px-3 text-sm font-semibold text-[#0F766E] inline-flex items-center gap-2"
              >
                {showHiddenParticipants ? <Eye size={16} /> : <EyeOff size={16} />}
                {showHiddenParticipants ? "Tutup daftar tersembunyi" : `Peserta tersembunyi (${hiddenRows.length})`}
              </button>
            </div>
            {showHiddenParticipants && hiddenRows.length > 0 && (
              <div className="mb-3 rounded-xl border border-[#E8E8E4] p-3" data-testid={MONTHLY_RECAP.hiddenParticipantsList}>
                <div className="mb-2 text-sm font-semibold text-[#111827]">Tampilkan kembali peserta</div>
                <div className="flex flex-wrap gap-2">
                  {hiddenRows.map((person) => (
                    <button
                      key={person.user_id}
                      type="button"
                      data-testid={`${MONTHLY_RECAP.showParticipantPrefix}-${person.user_id}`}
                      onClick={() => updateHiddenParticipants(person.user_id, false)}
                      className="min-h-11 rounded-xl border border-[#E8E8E4] px-3 text-sm font-semibold text-[#0F766E] hover:bg-[#F0FDFA]"
                    >
                      <Eye size={15} className="mr-1 inline" />{person.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="rekap-bulanan-table">
                <thead className="bg-[#FAFAF8] text-[#6B7280] text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Nama Peserta</th>
                    <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Ikut</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Kehadiran</th>
                    <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Izin</th>
                    <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Alpha</th>
                    <th className="px-3 py-2 font-semibold whitespace-nowrap">Terakhir hadir</th>
                    <th className="px-3 py-2 font-semibold text-right">Tampilan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECECE8]">
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} className="p-10 text-center text-[#6B7280]">Tidak ada data peserta.</td></tr>
                  ) : rows.map((r) => {
                    const b = badgeOf(r);
                    return (
                      <tr key={r.user_id} data-testid={`rekap-bulanan-row-${r.user_id}`} className="hover:bg-[#FAFAF8]">
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
                        <td className="px-3 py-2.5 text-center font-bold tabular-nums text-[#15803D] whitespace-nowrap">
                          {r.hadir}<span className="text-[#9CA3AF] font-semibold">/{r.pertemuan}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <PersenRingkas value={r.ratio} testid={`persen-bulanan-${r.user_id}`} />
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-[#D97706] font-semibold">{r.izin}</td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-[#DC2626] font-semibold">{r.alpha}</td>
                        <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{r.last_date || "—"}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            data-testid={`${MONTHLY_RECAP.hideParticipantPrefix}-${r.user_id}`}
                            onClick={() => updateHiddenParticipants(r.user_id, true)}
                            className="min-h-11 rounded-lg px-2 text-xs font-semibold text-[#6B7280] hover:bg-[#F3F4F6]"
                          >
                            <EyeOff size={15} className="mr-1 inline" />Sembunyikan
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5">
            <div className="font-semibold text-[#111827] text-sm mb-3">Daftar Pertemuan {data.label}</div>
            {data.per_pertemuan.length === 0 ? (
              <div className="text-sm text-[#6B7280] inline-flex items-center gap-2"><AlertTriangle size={15} /> Belum ada kegiatan pada bulan ini.</div>
            ) : (
              <TooltipProvider>
              <div className="space-y-3" data-testid="rekap-bulanan-pertemuan">
                {data.per_pertemuan.map((p, i) => (
                  <div key={i} className="rounded-xl border border-[#EEF1EE] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-sm text-[#111827]">{p.date} · {p.name}</div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" data-testid={`${MONTHLY_RECAP.meetingAttendancePrefix}-${i}`}
                            aria-label={`Kehadiran ${p.hadir} dari ${p.peserta} peserta`}
                            className="min-h-11 rounded-lg bg-[#F0FDF4] px-3 text-sm font-bold text-[#166534]">
                            Hadir {p.hadir}/{p.peserta}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{p.ratio}% hadir</TooltipContent>
                      </Tooltip>
                    </div>
                    <details className="mt-1 group">
                      <summary data-testid={`${MONTHLY_RECAP.meetingTogglePrefix}-${i}`}
                        className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-[#0F766E]">
                        Lihat nama dan absensi <span className="text-[#6B7280]">({p.peserta} peserta)</span>
                        <ChevronDown size={16} className="ml-auto transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-1 divide-y divide-[#EEF1EE] rounded-lg bg-[#FAFAF8] px-3" data-testid={`${MONTHLY_RECAP.meetingParticipantsPrefix}-${i}`}>
                        {(p.peserta_rows || []).length === 0 ? (
                          <div className="py-3 text-sm text-[#6B7280]">Belum ada peserta yang wajib diabsen.</div>
                        ) : (p.peserta_rows || []).filter((person) => !hiddenParticipants[person.user_id]).length === 0 ? (
                          <div className="py-3 text-sm text-[#6B7280]">Semua nama peserta pada daftar ini sedang disembunyikan.</div>
                        ) : (p.peserta_rows || []).filter((person) => !hiddenParticipants[person.user_id]).map((person, j) => {
                          const status = statusStyle(person.status);
                          return (
                            <div key={`${person.name}-${j}`} className={`flex min-h-10 items-center justify-between gap-3 text-sm ${status.name}`}>
                              <span className="min-w-0 truncate font-medium">
                                {person.name}
                                {person.session_labels?.length > 0 && ` (${person.session_labels.join(", ")})`}
                              </span>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.badge}`}>{status.label}</span>
                              <button
                                type="button"
                                data-testid={`${MONTHLY_RECAP.hideMeetingParticipantPrefix}-${person.user_id}`}
                                onClick={() => updateHiddenParticipants(person.user_id, true)}
                                aria-label={`Sembunyikan ${person.name}`}
                                className="min-h-10 shrink-0 px-2 text-[#6B7280] hover:text-[#991B1B]"
                              >
                                <EyeOff size={15} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                    {(p.sesi || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.sesi.map((x, j) => (
                          <span key={j} className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${x.required ? "bg-[#CCFBF1] text-[#115E59]" : "bg-[#E0F2FE] text-[#075985]"}`}>
                            {x.label} {x.start_time}–{x.end_time}{x.required ? "" : " · opsional"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </TooltipProvider>
            )}
          </div>

          <div className="rounded-xl border border-[#E8E8E4] bg-white p-4 text-sm text-[#4B5563] space-y-1" data-testid="rekap-bulanan-legend">
            <div className="font-bold text-[#111114] inline-flex items-center gap-1.5"><CheckCircle2 size={15} /> Cara menghitung</div>
            <p>Persen hadir = pertemuan berstatus Hadir ÷ pertemuan wajib × 100.</p>
            <p>Hadir di salah satu sesi wajib dihitung hadir. Izin, sakit, alpha, dan belum diabsen dicatat terpisah; sesi opsional tidak menambah kewajiban.</p>
          </div>
        </>
      )}
    </div>
  );
}
