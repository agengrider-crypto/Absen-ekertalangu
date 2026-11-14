// Rekap Bulanan — susunan baru: ring + L/P + kalender, daftar peserta, cara menghitung.
// Perbaikan galat: data bulan lama dibersihkan saat ganti bulan, respons usang
// diabaikan (AbortController + id permintaan), dan galat ditampilkan di dalam
// halaman (bukan toast) sehingga tidak ada data bulan lain yang tertinggal.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays, Loader2, Search, Users, Link2, Send, ChevronLeft, ChevronRight,
  ChevronDown, Eye, EyeOff, CalendarOff, RefreshCw, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { SkeletonList } from "@/components/GlobalLoading";
import { MONTHLY_RECAP } from "@/constants/testIds";
import { useAuth } from "@/context/AuthContext";
import { KalenderBulanan, RingkasanBulanan } from "@/components/RekapBulananBagian";
import { ratioColor } from "./rekapUtils";
import { nowWita } from "./kegiatanUtils";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember"];
const HIDDEN_PARTICIPANTS_KEY = "rekap-bulanan-peserta-tersembunyi";

function thisMonth() {
  return nowWita().date.slice(0, 7);
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
  try {
    const saved = JSON.parse(localStorage.getItem(hiddenStorageKey(userId)) || "{}");
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(saved).filter(([, expiresAt]) => Number(expiresAt) > now),
    );
  } catch { return {}; }
}

function threeMonthsFromNow() {
  const date = new Date();
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + 3);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return date.getTime();
}

const FILTERS = [
  ["semua", "Semua"],
  ["rajin", "Rajin ≥80%"],
  ["cukup", "Cukup aktif"],
  ["jarang", "Jarang <50%"],
  ["belum", "Belum pernah"],
];

function matchFilter(r, filter) {
  if (filter === "rajin") return r.pertemuan > 0 && r.ratio >= 80;
  if (filter === "cukup") return r.pertemuan > 0 && r.ratio >= 50 && r.ratio < 80;
  if (filter === "jarang") return r.pertemuan > 0 && r.ratio < 50;
  if (filter === "belum") return r.pertemuan > 0 && r.hadir === 0;
  return true;
}

function Accordion({ open, onToggle, title, testid, children }) {
  return (
    <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5" data-testid={testid}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex min-h-11 w-full items-center gap-2 text-left text-sm font-semibold text-[#14201A]"
      >
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        {title}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

export default function RekapBulananView({ initialFilter = "semua", onOpenHarian }) {
  const { user } = useAuth();
  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(initialFilter);
  const [share, setShare] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [hiddenParticipants, setHiddenParticipants] = useState({});
  const [showHiddenParticipants, setShowHiddenParticipants] = useState(false);
  const [openSections, setOpenSections] = useState({ peserta: false, legend: false });
  const reqRef = useRef(0);
  const abortRef = useRef(null);

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

  const load = useCallback((m) => {
    const id = reqRef.current + 1;
    reqRef.current = id;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    // Kosongkan data lama supaya bulan sebelumnya tidak tertinggal di layar.
    setData(null);
    setError(false);
    setLoading(true);
    api.get(`/staff/rekap-bulanan?month=${m}`, { signal: controller.signal })
      .then(({ data: d }) => {
        if (reqRef.current !== id) return;
        setData(d);
      })
      .catch((err) => {
        if (reqRef.current !== id || err?.code === "ERR_CANCELED") return;
        setError(true);
      })
      .finally(() => {
        if (reqRef.current === id) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load(month);
    setShare(null);
    return () => { if (abortRef.current) abortRef.current.abort(); };
  }, [month, load]);

  const [y, m] = month.split("-").map(Number);
  const label = `${BULAN[m - 1]} ${y}`;
  const isCurrentMonth = month >= thisMonth();

  const rows = useMemo(() => {
    let list = (data?.rows || []).filter((r) => !hiddenParticipants[r.user_id]);
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((r) => (r.name || "").toLowerCase().includes(s));
    return list.filter((r) => matchFilter(r, filter));
  }, [data, q, filter, hiddenParticipants]);
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

  const goToMonthWithData = () => {
    const target = data?.bulan_terakhir;
    if (target && target !== month) { setMonth(target); return; }
    // Tidak ada data sama sekali: mundur satu bulan sebagai jalan keluar.
    setMonth(shiftMonth(month, -1));
  };

  return (
    <div className="space-y-4" data-testid="rekap-bulanan-view">
      <nav className="text-xs font-semibold text-[#5F6B63]" aria-label="Breadcrumb" data-testid="rekap-bulanan-breadcrumb">
        E-Kertalangu <span className="px-1 text-[#B4BBB6]">›</span>
        Rekap &amp; Laporan <span className="px-1 text-[#B4BBB6]">›</span>
        <span className="text-[#14201A]">Rekap Bulanan</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold text-[#14201A] inline-flex items-center gap-2 sm:text-2xl">
            <CalendarDays size={22} className="shrink-0 text-[#14633F]" />
            Rekap <span className="text-[#14633F]">Bulanan</span>
          </h1>
          <p className="mt-0.5 text-sm text-[#5F6B63]">
            Berapa kali tiap peserta mengikuti pertemuan dalam satu bulan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button" data-testid="bulan-prev" aria-label="Bulan sebelumnya"
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#E7E3D8] text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white" data-testid="bulan-aktif">
            <CalendarDays size={16} /> {label}
          </div>
          <button
            type="button" data-testid="bulan-next" aria-label="Bulan berikutnya"
            disabled={isCurrentMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#E7E3D8] text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#E7E3D8]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
          <div className="mb-3 inline-flex items-center gap-2 text-sm text-[#5F6B63]">
            <Loader2 size={15} className="animate-spin text-[#0E4E31]" /> Memuat rekap {label}…
          </div>
          <SkeletonList rows={6} testid="rekap-bulanan-skeleton" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[#FBE5E3] bg-white p-6 text-center" data-testid="rekap-bulanan-error">
          <AlertTriangle size={28} className="mx-auto text-[#A32A2A]" />
          <div className="mt-2 font-heading text-base font-bold text-[#14201A]">
            Rekap {label} belum bisa dimuat
          </div>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#5F6B63]">
            Data bulan lain tidak ditampilkan agar tidak tertukar. Coba lagi, atau pilih bulan yang lain.
          </p>
          <button
            type="button" onClick={() => load(month)} data-testid="rekap-bulanan-retry"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]"
          >
            <RefreshCw size={16} /> Coba lagi
          </button>
        </div>
      ) : !data ? null : data.total_pertemuan === 0 ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-6 text-center" data-testid="rekap-bulanan-kosong">
          <CalendarOff size={28} className="mx-auto text-[#5F6B63]" />
          <div className="mt-2 font-heading text-base font-bold text-[#14201A]">Tidak ada kegiatan di bulan ini</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#5F6B63]">
            Belum ada pertemuan yang tercatat pada {label}. Ini bukan galat.
          </p>
          <button
            type="button" onClick={goToMonthWithData} data-testid="rekap-bulanan-ke-bulan-berkegiatan"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#14633F] px-4 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA]"
          >
            <CalendarDays size={16} /> Ke bulan dengan kegiatan
          </button>
        </div>
      ) : (
        <>
          <RingkasanBulanan data={data} />

          <KalenderBulanan data={data} interactive onOpenHarian={onOpenHarian} />

          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="rekap-bulanan-share">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 text-sm font-bold text-[#14201A]">
                  <Link2 size={15} className="text-[#14633F]" /> Bagikan rekap bulan ini
                </div>
                <p className="mt-0.5 text-[11px] text-[#5F6B63]">Tautan berlaku 7 hari, tanpa login.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button" onClick={shareWa} disabled={sharing} data-testid="rekap-bulanan-share-wa"
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60"
                >
                  {sharing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} WhatsApp
                </button>
                <button
                  type="button" onClick={copyLink} disabled={sharing} data-testid="rekap-bulanan-copy-link"
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-[#14633F] px-4 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA] disabled:opacity-60"
                >
                  <Link2 size={15} /> Salin Tautan
                </button>
              </div>
            </div>
            {share && (
              <div className="mt-2 break-all rounded-lg border border-[#E7E3D8] bg-[#F6F4EE] px-2.5 py-2 font-mono text-[11px] text-[#14201A]" data-testid="rekap-bulanan-link">
                {share.link}
              </div>
            )}
          </div>

          <Accordion
            open={openSections.peserta}
            onToggle={() => setOpenSections((p) => ({ ...p, peserta: !p.peserta }))}
            title={`Daftar Peserta (${rows.length})`}
            testid="rekap-bulanan-peserta"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[180px] flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
                <input
                  data-testid="rekap-bulanan-search" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama peserta…"
                  className="h-11 w-full rounded-xl border border-[#8A948D] pl-9 pr-3 text-base outline-none focus:border-[#14633F]"
                />
              </div>
              <div className="-mx-1 flex items-center gap-1 overflow-x-auto rounded-xl bg-[#F0EEE6] p-1" style={{ scrollbarWidth: "none" }}>
                {FILTERS.map(([v, l]) => (
                  <button
                    key={v} type="button" data-testid={`rekap-bulanan-filter-${v}`} onClick={() => setFilter(v)}
                    className={`h-9 shrink-0 whitespace-nowrap rounded-lg px-3 text-xs font-semibold ${filter === v ? "bg-white text-[#0E4E31] shadow-sm" : "text-[#5F6B63]"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F6F4EE] px-3 py-2.5">
              <p className="text-xs text-[#5F6B63]">
                Peserta tersembunyi hanya tidak ditampilkan di daftar ini selama 3 bulan; hitungan dan tautan publik tidak berubah.
              </p>
              <button
                type="button" data-testid={MONTHLY_RECAP.hiddenParticipantsToggle}
                aria-expanded={showHiddenParticipants}
                onClick={() => setShowHiddenParticipants((v) => !v)}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border-2 border-[#14633F] px-3 text-sm font-semibold text-[#0E4E31]"
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
                      key={person.user_id} type="button"
                      data-testid={`${MONTHLY_RECAP.showParticipantPrefix}-${person.user_id}`}
                      onClick={() => updateHiddenParticipants(person.user_id, false)}
                      className="inline-flex min-h-11 items-center rounded-xl border border-[#E7E3D8] px-3 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA]"
                    >
                      <Eye size={15} className="mr-1" />{person.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ul className="divide-y divide-[#F0EEE6]" data-testid="rekap-bulanan-table">
              {rows.length === 0 ? (
                <li className="py-8 text-center text-sm text-[#5F6B63]">Tidak ada peserta pada filter ini.</li>
              ) : rows.map((r) => (
                <li key={r.user_id} data-testid={`rekap-bulanan-row-${r.user_id}`} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="min-w-0 truncate text-sm font-semibold text-[#14201A]" title={r.name}>{r.name}</span>
                      <span className="shrink-0 rounded-full bg-[#F0EEE6] px-1.5 py-0.5 text-[10px] font-bold text-[#5F6B63]">
                        {r.gender === "L" ? "L" : r.gender === "P" ? "P" : "—"}
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#F0EEE6]">
                      <div
                        className="h-full rounded-full transition-[width] duration-700 ease-out"
                        style={{ width: `${Math.max(0, Math.min(100, r.ratio))}%`, backgroundColor: ratioColor(r.ratio) }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-[#14201A]">
                    {r.hadir}<span className="font-semibold text-[#5F6B63]"> dari {r.pertemuan}</span>
                  </span>
                  <button
                    type="button" data-testid={`${MONTHLY_RECAP.hideParticipantPrefix}-${r.user_id}`}
                    onClick={() => updateHiddenParticipants(r.user_id, true)}
                    aria-label={`Sembunyikan ${r.name}`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6]"
                  >
                    <EyeOff size={15} />
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-3 rounded-xl bg-[#F6F4EE] px-3 py-2 text-xs text-[#5F6B63]" data-testid="rekap-bulanan-ringkas-kategori">
              Rajin ≥80%: {data.summary.rajin} · Cukup aktif: {data.summary.cukup} · Jarang &lt;50%: {data.summary.jarang} · Belum pernah hadir: {data.summary.belum_pernah}
            </p>
          </Accordion>

          <Accordion
            open={openSections.legend}
            onToggle={() => setOpenSections((p) => ({ ...p, legend: !p.legend }))}
            title="Cara menghitung"
            testid="rekap-bulanan-legend"
          >
            <div className="space-y-1 text-sm text-[#5F6B63]">
              <p className="inline-flex items-start gap-1.5"><CheckCircle2 size={15} className="mt-0.5 shrink-0" /> Persen hadir = pertemuan berstatus Hadir ÷ pertemuan wajib × 100.</p>
              <p>Hadir di salah satu sesi wajib dihitung hadir. Izin, sakit, alpha, dan belum diabsen dicatat terpisah; sesi opsional tidak menambah kewajiban.</p>
              <p className="inline-flex items-start gap-1.5"><Users size={15} className="mt-0.5 shrink-0" /> Rata-rata gabungan = seluruh kehadiran ÷ seluruh slot pertemuan, sama dengan rata-rata tertimbang Laki-laki dan Perempuan.</p>
            </div>
          </Accordion>
        </>
      )}
    </div>
  );
}
