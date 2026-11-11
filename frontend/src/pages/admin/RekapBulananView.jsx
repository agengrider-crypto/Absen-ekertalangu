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
  if (r.pertemuan === 0) return { t: "Tidak ada kegiatan", cls: "bg-[#F0EEE6] text-[#5F6B63]" };
  if (r.hadir === 0) return { t: "Belum pernah hadir", cls: "bg-[#FBE5E3] text-[#A32A2A]" };
  if (r.ratio < 50) return { t: "Jarang hadir", cls: "bg-[#FBF1D6] text-[#6B4500]" };
  if (r.ratio < 80) return { t: "Cukup aktif", cls: "bg-[#E3EEFB] text-[#1D4F91]" };
  return { t: "Rajin hadir", cls: "bg-[#E3F3EA] text-[#0E4E31]" };
}

function statusStyle(status) {
  const styles = {
    hadir: { name: "text-[#0E4E31]", badge: "bg-[#E3F3EA]", label: "Hadir" },
    izin: { name: "text-[#6B4500]", badge: "bg-[#FBF1D6]", label: "Izin" },
    sakit: { name: "text-[#1D4F91]", badge: "bg-[#E3EEFB]", label: "Sakit" },
    alpha: { name: "text-[#A32A2A]", badge: "bg-[#FBE5E3]", label: "Alpha" },
    belum_diabsen: { name: "text-[#5F6B63]", badge: "bg-[#F0EEE6]", label: "Belum diabsen" },
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
  const [openSections, setOpenSections] = useState({ peserta: false, pertemuan: false, sesi: false, legend: false });
  const [openMeetings, setOpenMeetings] = useState({});

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
          <h1 className="font-heading text-2xl font-bold text-[#14201A]">Rekap Absen Bulanan</h1>
          <p className="text-sm text-[#5F6B63] mt-0.5">
            Berapa kali setiap peserta mengikuti pertemuan dalam satu bulan. Satu hari kegiatan dihitung satu pertemuan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="bulan-prev" onClick={() => setMonth(shiftMonth(month, -1))}
            className="h-11 w-11 rounded-xl border-2 border-[#E7E3D8] flex items-center justify-center text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]"><ChevronLeft size={18} /></button>
          <div className="h-11 px-4 rounded-xl bg-[#14633F] text-white font-semibold text-sm inline-flex items-center gap-2" data-testid="bulan-aktif">
            <CalendarRange size={16} /> {BULAN[m - 1]} {y}
          </div>
          <button data-testid="bulan-next" onClick={() => setMonth(shiftMonth(month, 1))}
            className="h-11 w-11 rounded-xl border-2 border-[#E7E3D8] flex items-center justify-center text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]"><ChevronRight size={18} /></button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-[#F0EEE6] animate-pulse" style={{ animationDelay: `${i * 90}ms` }} />)}
          </div>
          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
            <div className="text-sm text-[#5F6B63] mb-3 inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin text-[#0E4E31]" /> Memuat rekap bulanan…</div>
            <SkeletonList rows={6} testid="rekap-bulanan-skeleton" />
          </div>
        </div>
      ) : !data ? null : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="stat-pertemuan">
              <div className="text-xs font-semibold text-[#5F6B63] inline-flex items-center gap-1.5"><CalendarRange size={14} /> Pertemuan bulan ini</div>
              <div className="text-3xl font-bold text-[#14201A] mt-1 tabular-nums">{data.total_pertemuan}</div>
              <div className="text-[11px] text-[#5F6B63] mt-0.5">{data.total_kegiatan} jadwal termasuk sesi</div>
            </div>
            <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="stat-jamaah">
              <div className="text-xs font-semibold text-[#5F6B63] inline-flex items-center gap-1.5"><Users size={14} /> Jumlah peserta</div>
              <div className="text-3xl font-bold text-[#14201A] mt-1 tabular-nums">{data.total_peserta}</div>
              <div className="text-[11px] text-[#5F6B63] mt-0.5">Rata-rata hadir {data.summary.rata_rata}%</div>
            </div>
            <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="stat-rajin">
              <div className="text-xs font-semibold text-[#0E4E31] inline-flex items-center gap-1.5"><TrendingUp size={14} /> Rajin hadir (≥80%)</div>
              <div className="text-3xl font-bold text-[#0E4E31] mt-1 tabular-nums">{data.summary.rajin}</div>
              <div className="text-[11px] text-[#5F6B63] mt-0.5">Cukup aktif: {data.summary.cukup}</div>
            </div>
            <div className="rounded-2xl border border-[#FBE5E3] bg-[#FBE5E3] p-4" data-testid="stat-jarang">
              <div className="text-xs font-semibold text-[#A32A2A] inline-flex items-center gap-1.5"><TrendingDown size={14} /> Jarang hadir (&lt;50%)</div>
              <div className="text-3xl font-bold text-[#A32A2A] mt-1 tabular-nums">{data.summary.jarang}</div>
              <div className="text-[11px] text-[#A32A2A]/80 mt-0.5">Belum pernah hadir: {data.summary.belum_pernah}</div>
            </div>
          </div>

          {/* Bagikan sebagai tautan + WhatsApp */}
          <div className="rounded-2xl bg-[#14633F] p-4 space-y-2.5 text-white" data-testid="rekap-bulanan-share">
            <div className="text-sm font-bold text-white inline-flex items-center gap-1.5"><Link2 size={15} /> Bagikan rekap bulan ini</div>
            <p className="text-[11px] text-white/85 leading-relaxed">
              Tautan publik: siapa pun yang klik bisa langsung melihat siapa saja yang hadir,
              berapa kali ikut, dan rincian sesinya — tanpa perlu login.
            </p>
            {share && (
              <div className="text-[11px] font-mono break-all bg-white rounded-lg border border-[#E7E3D8] px-2.5 py-2 text-[#14201A]" data-testid="rekap-bulanan-link">{share.link}</div>
            )}
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <button onClick={shareWa} disabled={sharing} data-testid="rekap-bulanan-share-wa"
                className="h-11 rounded-xl bg-white text-[#0E4E31] font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#E3F3EA] disabled:opacity-60">
                {sharing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Bagikan ke WhatsApp
              </button>
              <button onClick={copyLink} disabled={sharing} data-testid="rekap-bulanan-copy-link"
                className="h-11 rounded-xl border-2 border-white/70 text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:bg-white/10 disabled:opacity-60">
                <Link2 size={15} /> Salin Tautan
              </button>
            </div>
          </div>

          {/* Pisah Laki-laki / Perempuan */}
          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="rekap-bulanan-gender">
            <div className="text-sm font-semibold text-[#14201A] inline-flex items-center gap-2 mb-3"><Users size={16} style={{ color: REKAP.main }} /> Pisah Laki-laki &amp; Perempuan</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#E3F3EA] p-3" data-testid={MONTHLY_RECAP.maleSummary}>
                <div className="text-xs font-semibold text-[#0E4E31]">Laki-laki</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-[#0E4E31]">{data.gender?.L?.ratio || 0}%</div>
              </div>
              <div className="rounded-xl bg-[#ECE4FB] p-3" data-testid={MONTHLY_RECAP.femaleSummary}>
                <div className="text-xs font-semibold text-[#4C2A9B]">Perempuan</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-[#4C2A9B]">{data.gender?.P?.ratio || 0}%</div>
              </div>
            </div>
          </div>

          {/* Ringkasan sesi sebulan */}
          {data.per_sesi?.length > 0 && (
            <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="rekap-bulanan-sesi">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setOpenSections((prev) => ({ ...prev, sesi: !prev.sesi }))}
                  aria-expanded={Boolean(openSections.sesi)}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#14201A]"
                >
                  <ChevronDown size={16} className={`transition-transform ${openSections.sesi ? "rotate-180" : ""}`} />
                  <Layers size={16} style={{ color: REKAP.main }} /> Ringkasan Sesi Selama Sebulan
                </button>
                <button
                  type="button"
                  onClick={() => setOpenSections((prev) => ({ ...prev, sesi: !prev.sesi }))}
                  className="min-h-11 rounded-xl border-2 border-[#E7E3D8] px-3 text-xs font-semibold text-[#5F6B63] hover:border-[#14633F]"
                >
                  {openSections.sesi ? "Tutup semua" : "Buka semua"}
                </button>
              </div>
              {openSections.sesi && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {data.per_sesi.map((x, i) => (
                  <div key={x.label} data-testid={`${MONTHLY_RECAP.sessionCardPrefix}-${i}`}
                    className="min-w-0 rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] p-3">
                    <div className="truncate text-sm font-bold text-[#14201A]" title={x.label}>{x.label}</div>
                    <div className="mt-1 text-[11px] text-[#5F6B63]">{x.pertemuan}× kegiatan{x.required === false ? " · opsional" : ""}</div>
                    <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: ratioColor(x.ratio) }}>{x.ratio}%</div>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setOpenSections((prev) => ({ ...prev, peserta: !prev.peserta }))}
                aria-expanded={Boolean(openSections.peserta)}
                data-testid="rekap-bulanan-peserta-toggle"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#14201A]"
              >
                <ChevronDown size={16} className={`transition-transform ${openSections.peserta ? "rotate-180" : ""}`} />
                Daftar Peserta ({rows.length})
              </button>
              <button
                type="button"
                onClick={() => setOpenSections((prev) => ({ ...prev, peserta: !prev.peserta }))}
                className="min-h-11 rounded-xl border-2 border-[#E7E3D8] px-3 text-xs font-semibold text-[#5F6B63] hover:border-[#14633F]"
              >
                {openSections.peserta ? "Tutup semua" : "Buka semua"}
              </button>
            </div>
            {openSections.peserta && (
            <>
            <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
                <input data-testid="rekap-bulanan-search" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama peserta…"
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#8A948D] text-base outline-none focus:border-[#14633F]" />
              </div>
              <div className="-mx-1 flex items-center gap-1 overflow-x-auto rounded-xl bg-[#F0EEE6] p-1" data-testid="rekap-bulanan-gender-tabs" style={{ scrollbarWidth: "none" }}>
                {[["semua", "L/P"], ["L", "Laki-laki"], ["P", "Perempuan"]].map(([v, l]) => (
                  <button key={v} data-testid={`rekap-bulanan-gender-${v}`} onClick={() => setGender(v)}
                    className={`h-9 shrink-0 whitespace-nowrap rounded-lg px-3 text-xs font-semibold ${gender === v ? "bg-white text-[#0E4E31] shadow-sm" : "text-[#5F6B63]"}`}>{l}</button>
                ))}
              </div>
              <div className="-mx-1 flex items-center gap-1 overflow-x-auto rounded-xl bg-[#F0EEE6] p-1" style={{ scrollbarWidth: "none" }}>
                {[["semua", "Semua"], ["belum", "Belum hadir"], ["jarang", "Jarang"], ["cukup", "Cukup"], ["rajin", "Rajin"]].map(([v, l]) => (
                  <button key={v} data-testid={`rekap-bulanan-filter-${v}`} onClick={() => setFilter(v)}
                    className={`h-9 shrink-0 whitespace-nowrap rounded-lg px-3 text-xs font-semibold ${filter === v ? "bg-white text-[#0E4E31] shadow-sm" : "text-[#5F6B63]"}`}>{l}</button>
                ))}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showHiddenParticipants}
                data-testid="rekap-bulanan-show-hidden"
                onClick={() => setShowHiddenParticipants((v) => !v)}
                className={`inline-flex items-center gap-2 h-9 pl-2 pr-3 rounded-xl border-2 text-xs font-semibold transition-colors ${
                  showHiddenParticipants
                    ? "bg-[#14633F] border-[#14633F] text-white"
                    : "bg-white border-[#E7E3D8] text-[#5F6B63] hover:border-[#14633F]"
                }`}
                title="Tampilkan peserta yang disembunyikan dari daftar rekap"
              >
                <span className={`relative h-5 w-9 rounded-full transition-colors ${showHiddenParticipants ? "bg-white/30" : "bg-[#E7E3D8]"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${showHiddenParticipants ? "left-[18px]" : "left-0.5"}`} />
                </span>
                Tampilkan tersembunyi ({hiddenRows.length})
              </button>
            </div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F6F4EE] px-3 py-2.5">
              <p className="text-xs text-[#5F6B63]">
                Peserta tersembunyi hanya tidak ditampilkan di daftar ini selama 3 bulan; hitungan dan tautan publik tidak berubah.
              </p>
              <button
                type="button"
                data-testid={MONTHLY_RECAP.hiddenParticipantsToggle}
                aria-expanded={showHiddenParticipants}
                onClick={() => setShowHiddenParticipants((show) => !show)}
                className="min-h-11 shrink-0 rounded-xl border-2 border-[#14633F] px-3 text-sm font-semibold text-[#0E4E31] inline-flex items-center gap-2"
              >
                {showHiddenParticipants ? <Eye size={16} /> : <EyeOff size={16} />}
                {showHiddenParticipants ? "Tutup daftar tersembunyi" : `Peserta tersembunyi (${hiddenRows.length})`}
              </button>
            </div>
            {showHiddenParticipants && hiddenRows.length > 0 && (
              <div className="mb-3 rounded-xl border border-[#E7E3D8] p-3" data-testid={MONTHLY_RECAP.hiddenParticipantsList}>
                <div className="mb-2 text-sm font-semibold text-[#14201A]">Tampilkan kembali peserta</div>
                <div className="flex flex-wrap gap-2">
                  {hiddenRows.map((person) => (
                    <button
                      key={person.user_id}
                      type="button"
                      data-testid={`${MONTHLY_RECAP.showParticipantPrefix}-${person.user_id}`}
                      onClick={() => updateHiddenParticipants(person.user_id, false)}
                      className="min-h-11 rounded-xl border border-[#E7E3D8] px-3 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA]"
                    >
                      <Eye size={15} className="mr-1 inline" />{person.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm" data-testid="rekap-bulanan-table">
                <thead className="bg-[#F6F4EE] text-[#5F6B63]">
                  <tr>
                    <th className="sticky left-0 z-10 w-[240px] min-w-[240px] border-b border-[#E7E3D8] bg-[#F6F4EE] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">Nama Peserta</th>
                    <th className="w-[72px] border-b border-[#E7E3D8] bg-[#F6F4EE] px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide whitespace-nowrap">Ikut</th>
                    <th className="w-[120px] border-b border-[#E7E3D8] bg-[#F6F4EE] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">Kehadiran</th>
                    <th className="w-[72px] border-b border-[#E7E3D8] bg-[#F6F4EE] px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide whitespace-nowrap">Izin</th>
                    <th className="w-[72px] border-b border-[#E7E3D8] bg-[#F6F4EE] px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide whitespace-nowrap">Alpha</th>
                    <th className="w-[130px] border-b border-[#E7E3D8] bg-[#F6F4EE] px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">Terakhir hadir</th>
                    <th className="w-[130px] border-b border-[#E7E3D8] bg-[#F6F4EE] px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide whitespace-nowrap">Tampilan</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} className="p-10 text-center text-[#5F6B63]">Tidak ada data peserta.</td></tr>
                  ) : rows.map((r) => {
                    const b = badgeOf(r);
                    return (
                      <tr key={r.user_id} data-testid={`rekap-bulanan-row-${r.user_id}`} className="group">
                        <td className="sticky left-0 z-10 border-b border-[#F0EEE6] bg-white px-3 py-2.5 align-top group-hover:bg-[#F6F4EE]">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="min-w-0 truncate font-semibold text-[#14201A]" title={r.name}>{r.name}</span>
                            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${b.cls}`}>{b.t}</span>
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-[#5F6B63]" title={r.kelompok_name || undefined}>
                            {r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : "—"}
                            {r.kelompok_name ? ` · ${r.kelompok_name}` : ""}
                          </div>
                        </td>
                        <td className="border-b border-[#F0EEE6] px-3 py-2.5 text-right font-bold tabular-nums whitespace-nowrap text-[#14633F] group-hover:bg-[#F6F4EE]">
                          {r.hadir}<span className="font-semibold text-[#5F6B63]">/{r.pertemuan}</span>
                        </td>
                        <td className="border-b border-[#F0EEE6] px-3 py-2.5 group-hover:bg-[#F6F4EE]">
                          <PersenRingkas value={r.ratio} testid={`persen-bulanan-${r.user_id}`} />
                        </td>
                        <td className="border-b border-[#F0EEE6] px-3 py-2.5 text-right font-semibold tabular-nums text-[#8A5A00] group-hover:bg-[#F6F4EE]">{r.izin}</td>
                        <td className="border-b border-[#F0EEE6] px-3 py-2.5 text-right font-semibold tabular-nums text-[#A32A2A] group-hover:bg-[#F6F4EE]">{r.alpha}</td>
                        <td className="border-b border-[#F0EEE6] px-3 py-2.5 tabular-nums whitespace-nowrap text-[#5F6B63] group-hover:bg-[#F6F4EE]">{r.last_date || "—"}</td>
                        <td className="border-b border-[#F0EEE6] px-3 py-2.5 text-right group-hover:bg-[#F6F4EE]">
                          <button
                            type="button"
                            data-testid={`${MONTHLY_RECAP.hideParticipantPrefix}-${r.user_id}`}
                            onClick={() => updateHiddenParticipants(r.user_id, true)}
                            className="inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-semibold text-[#5F6B63] hover:bg-[#F0EEE6]"
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
            </>
            )}
          </div>

          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setOpenSections((prev) => ({ ...prev, pertemuan: !prev.pertemuan }))}
                aria-expanded={Boolean(openSections.pertemuan)}
                data-testid="rekap-bulanan-pertemuan-toggle"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#14201A]"
              >
                <ChevronDown size={16} className={`transition-transform ${openSections.pertemuan ? "rotate-180" : ""}`} />
                Daftar Pertemuan {data.label} ({data.per_pertemuan.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !openSections.pertemuan;
                  setOpenSections((prev) => ({ ...prev, pertemuan: next }));
                  setOpenMeetings(next
                    ? Object.fromEntries((data.per_pertemuan || []).map((_, idx) => [idx, true]))
                    : {});
                }}
                className="min-h-11 rounded-xl border-2 border-[#E7E3D8] px-3 text-xs font-semibold text-[#5F6B63] hover:border-[#14633F]"
              >
                {openSections.pertemuan ? "Tutup semua" : "Buka semua"}
              </button>
            </div>
            {openSections.pertemuan && (data.per_pertemuan.length === 0 ? (
              <div className="text-sm text-[#5F6B63] inline-flex items-center gap-2"><AlertTriangle size={15} /> Belum ada kegiatan pada bulan ini.</div>
            ) : (
              <TooltipProvider>
              <div className="space-y-3" data-testid="rekap-bulanan-pertemuan">
                {data.per_pertemuan.map((p, i) => (
                  <div key={i} className="rounded-xl border border-[#F0EEE6] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-sm text-[#14201A]">{p.date} · {p.name}</div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" data-testid={`${MONTHLY_RECAP.meetingAttendancePrefix}-${i}`}
                            aria-label={`Kehadiran ${p.hadir} dari ${p.peserta} peserta`}
                            className="min-h-11 rounded-lg bg-[#E3F3EA] px-3 text-sm font-bold text-[#0E4E31]">
                            Hadir {p.hadir}/{p.peserta}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{p.ratio}% hadir</TooltipContent>
                      </Tooltip>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenMeetings((prev) => ({ ...prev, [i]: !prev[i] }))}
                      aria-expanded={Boolean(openMeetings[i])}
                      data-testid={`${MONTHLY_RECAP.meetingTogglePrefix}-${i}`}
                      className="mt-1 flex min-h-11 w-full items-center gap-1 text-left text-sm font-semibold text-[#0E4E31]"
                    >
                      Lihat nama dan absensi <span className="text-[#5F6B63]">({p.peserta} peserta)</span>
                      <ChevronDown size={16} className={`ml-auto transition-transform ${openMeetings[i] ? "rotate-180" : ""}`} />
                    </button>
                    {openMeetings[i] && (
                      <div className="mt-1 divide-y divide-[#F0EEE6] rounded-lg bg-[#F6F4EE] px-3" data-testid={`${MONTHLY_RECAP.meetingParticipantsPrefix}-${i}`}>
                        {(p.peserta_rows || []).length === 0 ? (
                          <div className="py-3 text-sm text-[#5F6B63]">Belum ada peserta yang wajib diabsen.</div>
                        ) : (p.peserta_rows || []).map((person, j) => {
                          const status = statusStyle(person.status);
                          return (
                            <div key={`${person.name}-${j}`} className={`flex min-h-10 items-center justify-between gap-3 text-sm ${status.name}`}>
                              <span className="min-w-0 truncate font-medium">
                                {person.name}
                                {person.session_labels?.length > 0 && ` (${person.session_labels.join(", ")})`}
                              </span>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${status.badge}`}>{status.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(p.sesi || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.sesi.map((x, j) => (
                          <span key={j} className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${x.required ? "bg-[#E3EEFB] text-[#1D4F91]" : "bg-[#F0EEE6] text-[#5F6B63]"}`}>
                            {x.label} {x.start_time}–{x.end_time}{x.required ? "" : " · opsional"}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              </TooltipProvider>
            ))}
          </div>
          <div className="rounded-xl border border-[#E7E3D8] bg-white p-4 text-sm text-[#5F6B63] space-y-1" data-testid="rekap-bulanan-legend">
            <button
              type="button"
              onClick={() => setOpenSections((prev) => ({ ...prev, legend: !prev.legend }))}
              aria-expanded={Boolean(openSections.legend)}
              className="inline-flex min-h-11 w-full items-center gap-1.5 font-bold text-[#0E4E31]"
            >
              <CheckCircle2 size={15} /> Cara menghitung
              <ChevronDown size={16} className={`ml-auto transition-transform ${openSections.legend ? "rotate-180" : ""}`} />
            </button>
            {openSections.legend && (
              <>
                <p>Persen hadir = pertemuan berstatus Hadir ÷ pertemuan wajib × 100.</p>
                <p>Hadir di salah satu sesi wajib dihitung hadir. Izin, sakit, alpha, dan belum diabsen dicatat terpisah; sesi opsional tidak menambah kewajiban.</p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
