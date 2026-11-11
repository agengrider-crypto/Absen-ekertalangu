import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, ClipboardList,
  Loader2, Search, Share2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { PARTICIPANT_REPORT } from "@/constants/testIds";
import ReportHeader from "@/components/ReportHeader";
import ShareManyLinksModal from "./ShareManyLinksModal";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const STATUS = {
  hadir: { label: "Hadir", color: "text-[#0E4E31]", bg: "bg-[#E3F3EA]" },
  izin: { label: "Izin", color: "text-[#6B4500]", bg: "bg-[#FBF1D6]" },
  sakit: { label: "Sakit", color: "text-[#1D4F91]", bg: "bg-[#E3EEFB]" },
  alpha: { label: "Alpha", color: "text-[#A32A2A]", bg: "bg-[#FBE5E3]" },
  belum_diabsen: { label: "Belum diabsen", color: "text-[#5F6B63]", bg: "bg-[#F0EEE6]" },
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value) {
  const [year, month] = value.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

function dateLabel(value) {
  const [year, month, day] = String(value || "").split("-");
  return day ? `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}` : "Tanggal tidak tersedia";
}

function shiftMonth(value, amount) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function availableWeeks(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const limit = month === currentMonth() ? new Date().getDate() : daysInMonth;
  return Math.max(1, Math.ceil(limit / 7));
}

function weekLabel(week) {
  const first = (week - 1) * 7 + 1;
  const last = Math.min(week * 7, 31);
  return `Pekan ${week} · ${first}–${last}`;
}

function SummaryCard({ label, value, color = "text-[#14201A]" }) {
  return (
    <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-base text-[#5F6B63]">{label}</div>
    </div>
  );
}

function StatusSummary({ summary, testid }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" data-testid={testid}>
      {[
        ["hadir", "Hadir"],
        ["izin", "Izin"],
        ["sakit", "Sakit"],
        ["alpha", "Alpha"],
        ["belum_diabsen", "Belum diabsen"],
      ].map(([key, label]) => (
        <SummaryCard key={key} label={label} value={summary?.[key] || 0} color={STATUS[key].color} />
      ))}
    </section>
  );
}

function ParticipantDetail({ participantId, month, week, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [shareLink, setShareLink] = useState("");
  const [shareExpiresAt, setShareExpiresAt] = useState("");

  const load = useCallback(async () => {
    setData(null);
    setError("");
    try {
      const { data: result } = await api.get(
        `/admin/laporan/peserta/${encodeURIComponent(participantId)}`,
        { params: { month, week } },
      );
      setData(result);
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail));
    }
  }, [month, participantId, week]);

  useEffect(() => { load(); }, [load]);

  const createShareLink = async () => {
    try {
      const { data: result } = await api.post(
        `/admin/laporan/peserta/${encodeURIComponent(participantId)}/share`,
        {},
        { params: { month, week } },
      );
      setShareLink(result.link);
      setShareExpiresAt(result.expires_at);
      return result;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
      return null;
    }
  };

  const copyLink = async () => {
    const result = await createShareLink();
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.link);
      toast.success("Tautan laporan peserta disalin.");
    } catch {
      toast.error("Tautan gagal disalin.");
    }
  };

  const shareWhatsApp = async () => {
    if (!data) return;
    const shareWindow = window.open("", "_blank");
    const result = await createShareLink();
    if (!result) {
      shareWindow?.close();
      return;
    }
    const periodLabel = week === "bulanan"
      ? monthLabel(month)
      : `${dateLabel(result.date_from)}–${dateLabel(result.date_to)}`;
    const text = `Laporan ${result.name} ${periodLabel}\n${result.link}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (shareWindow) shareWindow.location.href = whatsappUrl;
    else toast.error("WhatsApp tidak dapat dibuka. Salin tautan laporan untuk membagikannya.");
  };

  if (!data) {
    return (
      <div className="rounded-2xl border border-[#E7E3D8] bg-white p-10 text-center" data-testid={PARTICIPANT_REPORT.detail}>
        {error ? (
          <>
            <p className="text-base text-[#A32A2A]">{error}</p>
            <button type="button" data-testid={PARTICIPANT_REPORT.retry} onClick={load} className="mt-3 min-h-11 rounded-xl bg-[#14633F] px-4 font-semibold text-white">Coba lagi</button>
          </>
        ) : <Loader2 className="mx-auto animate-spin text-[#0E4E31]" size={28} aria-label="Memuat laporan peserta" />}
      </div>
    );
  }

  const six = data.six_months;
  return (
    <div className="space-y-4" data-testid={PARTICIPANT_REPORT.detail}>
      <ReportHeader
        title="Laporan per Peserta"
        subtitle={`${monthLabel(month)}${week !== "bulanan" ? ` · Pekan ${week}` : ""}`}
        showUserIcon
        compact
        testid="laporan-peserta-admin-header"
      />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <button type="button" data-testid={PARTICIPANT_REPORT.back} onClick={onBack}
            className="mb-2 inline-flex min-h-11 items-center gap-2 rounded-lg text-base font-semibold text-[#5F6B63] hover:text-[#0E4E31]">
            <ArrowLeft size={17} /> Daftar peserta
          </button>
          <h1 className="truncate font-heading text-2xl font-bold text-[#14201A]">{data.participant.name}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" data-testid={PARTICIPANT_REPORT.copyLink} onClick={copyLink}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-[#E7E3D8] bg-white px-3.5 text-base font-semibold text-[#14201A] hover:border-[#14633F]">
            <Share2 size={16} /> Salin tautan
          </button>
          <button type="button" data-testid={PARTICIPANT_REPORT.shareWhatsApp} onClick={shareWhatsApp}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14633F] px-3.5 text-base font-semibold text-white hover:brightness-95">
            <Share2 size={16} /> Bagikan ke pengurus
          </button>
        </div>
      </header>
      {shareLink && (
        <p className="break-all rounded-xl bg-[#F0EEE6] p-3 text-base text-[#5F6B63]" data-testid={PARTICIPANT_REPORT.shareLink}>
          {shareLink}
          <span className="mt-1 block text-sm">Tautan berlaku sampai {new Date(shareExpiresAt).toLocaleDateString("id-ID")}.</span>
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2" data-testid={PARTICIPANT_REPORT.periodSummary}>
        <SummaryCard label={`Kehadiran · ${monthLabel(month)}${week !== "bulanan" ? ` · Pekan ${week}` : ""}`} value={`${data.summary.ratio}%`} color="text-[#0E4E31]" />
        <SummaryCard label="Total pertemuan pada periode" value={data.summary.total_pertemuan} />
      </section>
      <StatusSummary summary={data.summary} testid={PARTICIPANT_REPORT.periodStatuses} />

      <section className="space-y-4 rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5" data-testid={PARTICIPANT_REPORT.sixMonthSummary}>
        <div>
          <h2 className="font-bold text-[#14201A]">Kehadiran 6 bulan terakhir</h2>
          <p className="mt-1 text-base text-[#5F6B63]">
            {six.summary.ratio}% · {six.summary.hadir} hadir dari {six.summary.total_pertemuan} pertemuan
          </p>
        </div>
        <StatusSummary summary={six.summary} testid={PARTICIPANT_REPORT.sixMonthStatuses} />
        <div className="space-y-3" data-testid={PARTICIPANT_REPORT.sixMonthChart}>
          {six.months.map((item) => (
            <div key={item.month} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3">
              <span className="text-base font-semibold text-[#5F6B63]">{item.label}</span>
              <div className="h-3 overflow-hidden rounded-full bg-[#E3F3EA]">
                <div className="h-full origin-left rounded-full bg-[#14633F] motion-safe:animate-[rekap-bar-grow_700ms_ease-out_both]"
                  style={{ width: `${Math.min(Math.max(item.ratio || 0, 0), 100)}%` }} />
              </div>
              <span className="text-right text-base font-bold text-[#14201A]">{item.ratio}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white" data-testid={PARTICIPANT_REPORT.activityList}>
        <div className="flex items-center justify-between border-b border-[#E7E3D8] px-4 py-3">
          <h2 className="inline-flex items-center gap-2 font-bold text-[#14201A]">
            <ClipboardList size={18} /> Kegiatan yang diikuti
          </h2>
          <span className="text-base text-[#5F6B63]">{data.activities.length} pertemuan</span>
        </div>
        {data.activities.length ? (
          <ul className="divide-y divide-[#E7E3D8]">
            {data.activities.map((activity) => (
              <li key={activity.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#14201A]">{activity.name}{activity.session_label ? ` · ${activity.session_label}` : ""}</p>
                  <p className="mt-1 text-base text-[#5F6B63]">
                    {dateLabel(activity.date)}{activity.start_time ? ` · ${activity.start_time}${activity.end_time ? `–${activity.end_time}` : ""}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-base font-semibold ${STATUS[activity.status]?.bg} ${STATUS[activity.status]?.color}`}>
                  {STATUS[activity.status]?.label || activity.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-8 text-center text-base text-[#5F6B63]">Belum ada kegiatan pada periode ini.</p>
        )}
      </section>
    </div>
  );
}

export default function LaporanPesertaView() {
  const [searchParams] = useSearchParams();
  const [month, setMonth] = useState(() => searchParams.get("bulan") || currentMonth());
  const [mode, setMode] = useState(() => searchParams.get("pekan") && searchParams.get("pekan") !== "bulanan" ? "mingguan" : "bulanan");
  const [week, setWeek] = useState(() => searchParams.get("pekan") || "1");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("tertinggi");
  const [selected, setSelected] = useState(() => new Set());
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [participantId, setParticipantId] = useState(() => searchParams.get("laporanPesertaId"));
  const [shareManyOpen, setShareManyOpen] = useState(false);

  const period = mode === "mingguan" ? week : "bulanan";
  const load = useCallback(async () => {
    setRows(null);
    setError("");
    try {
      const { data } = await api.get("/admin/laporan/peserta", {
        params: { month, week: period },
      });
      setRows(data.rows || []);
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail));
    }
  }, [month, period]);

  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("id");
    return (rows || []).filter((row) => {
      if (selectedOnly && !selected.has(row.user_id)) return false;
      return !term || (row.name || "").toLocaleLowerCase("id").includes(term);
    }).sort((a, b) => {
      const ratioDifference = Number(b.ratio || 0) - Number(a.ratio || 0);
      return (sortOrder === "tertinggi" ? ratioDifference : -ratioDifference)
        || a.name.localeCompare(b.name, "id");
    });
  }, [rows, search, selected, selectedOnly, sortOrder]);

  const allVisibleSelected = filteredRows.length > 0
    && filteredRows.every((row) => selected.has(row.user_id));
  const toggleAll = () => setSelected((previous) => {
    const next = new Set(previous);
    if (allVisibleSelected) filteredRows.forEach((row) => next.delete(row.user_id));
    else filteredRows.forEach((row) => next.add(row.user_id));
    return next;
  });
  const toggleSelected = (userId) => setSelected((previous) => {
    const next = new Set(previous);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    return next;
  });

  const setMonthValue = (value) => {
    setMonth(value);
    setWeek("1");
  };
  const maxMonth = currentMonth();

  if (participantId) {
    return (
      <ParticipantDetail
        participantId={participantId}
        month={month}
        week={period}
        onBack={() => setParticipantId(null)}
      />
    );
  }

  return (
    <div className="space-y-4" data-testid={PARTICIPANT_REPORT.page}>
      <header className="flex items-center gap-2 font-heading text-xl font-bold text-[#14201A]">
        <Users size={21} /> Laporan per Peserta
      </header>

      <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <label htmlFor="laporan-peserta-month" className="mb-1 block text-base font-semibold text-[#5F6B63]">Bulan laporan</label>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Bulan sebelumnya" data-testid={PARTICIPANT_REPORT.previousMonth} onClick={() => setMonthValue(shiftMonth(month, -1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E7E3D8] text-[#5F6B63] hover:bg-[#F0EEE6]">
                <ChevronLeft size={18} />
              </button>
              <input id="laporan-peserta-month" data-testid={PARTICIPANT_REPORT.month} type="month" max={maxMonth} value={month}
                onChange={(e) => {
                  if (/^\d{4}-\d{2}$/.test(e.target.value) && e.target.value <= maxMonth) setMonthValue(e.target.value);
                }} className="h-11 rounded-xl border-2 border-[#E7E3D8] bg-white px-3 text-base font-semibold text-[#14201A]" />
              <button type="button" aria-label="Bulan berikutnya" data-testid={PARTICIPANT_REPORT.nextMonth} disabled={month >= maxMonth} onClick={() => setMonthValue(shiftMonth(month, 1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E7E3D8] text-[#5F6B63] hover:bg-[#F0EEE6] disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="inline-flex rounded-xl bg-[#F0EEE6] p-1" role="group" aria-label="Periode laporan">
            <button type="button" data-testid={PARTICIPANT_REPORT.monthlyMode} aria-pressed={mode === "bulanan"}
              onClick={() => setMode("bulanan")} className={`min-h-11 rounded-lg px-4 text-base font-semibold ${mode === "bulanan" ? "bg-white text-[#0E4E31] shadow-sm" : "text-[#5F6B63]"}`}>
              Bulanan
            </button>
            <button type="button" data-testid={PARTICIPANT_REPORT.weeklyMode} aria-pressed={mode === "mingguan"}
              onClick={() => { setMode("mingguan"); setWeek("1"); }} className={`min-h-11 rounded-lg px-4 text-base font-semibold ${mode === "mingguan" ? "bg-white text-[#0E4E31] shadow-sm" : "text-[#5F6B63]"}`}>
              Mingguan
            </button>
          </div>
        </div>
        {mode === "mingguan" && (
          <div className="mt-4">
            <label htmlFor="laporan-peserta-week" className="mb-1 block text-base font-semibold text-[#5F6B63]">Pilih pekan</label>
            <select id="laporan-peserta-week" data-testid={PARTICIPANT_REPORT.week} value={week} onChange={(e) => setWeek(e.target.value)}
              className="h-11 w-full max-w-xs rounded-xl border-2 border-[#E7E3D8] bg-white px-3 text-base">
              {Array.from({ length: availableWeeks(month) }, (_, index) => String(index + 1)).map((value) => (
                <option key={value} value={value}>{weekLabel(Number(value))} {monthLabel(month)}</option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
          <input id="laporan-peserta-search" data-testid={PARTICIPANT_REPORT.search} value={search} onChange={(e) => setSearch(e.target.value)}
            aria-label="Nama peserta" placeholder="Nama peserta" className="h-12 w-full rounded-xl border border-[#8A948D] bg-white pl-11 pr-3 text-base outline-none focus:border-[#14633F]" />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-[#14201A]">
            <input data-testid={PARTICIPANT_REPORT.selectAll} type="checkbox" checked={allVisibleSelected}
              onChange={toggleAll} className="h-5 w-5 accent-[#14633F]" />
            Pilih semua yang tampil
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="laporan-peserta-sort" className="text-base font-semibold text-[#14201A]">Urutkan</label>
            <select id="laporan-peserta-sort" data-testid={PARTICIPANT_REPORT.sort} value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="min-h-11 rounded-xl border-2 border-[#E7E3D8] bg-white px-3 text-base">
              <option value="tertinggi">Tertinggi</option>
              <option value="terendah">Terendah</option>
            </select>
            <button type="button" data-testid={PARTICIPANT_REPORT.selectedOnly} aria-pressed={selectedOnly}
              onClick={() => setSelectedOnly((value) => !value)}
              className={`min-h-11 rounded-xl border px-3 text-base font-semibold ${selectedOnly ? "border-[#14633F] bg-[#E3F3EA] text-[#0E4E31]" : "border-[#E7E3D8] text-[#5F6B63]"}`}>
              {selectedOnly ? "Tampilkan semua" : `Pilihan (${selected.size})`}
            </button>
            {selected.size > 0 && (
              <button type="button" data-testid={PARTICIPANT_REPORT.clearSelection} onClick={() => { setSelected(new Set()); setSelectedOnly(false); }}
                className="min-h-11 rounded-xl px-3 text-base font-semibold text-[#A32A2A] hover:bg-[#FBE5E3]">
                Hapus pilihan
              </button>
            )}
            {selected.size > 0 && (
              <button type="button" data-testid="laporan-peserta-share-many" onClick={() => setShareManyOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-3.5 text-base font-semibold text-white hover:bg-[#0E4E31]">
                <Share2 size={16} /> Bagikan {selected.size} tautan
              </button>
            )}
          </div>
        </div>
      </section>

      {rows === null ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-12 text-center">
          <Loader2 className="mx-auto animate-spin text-[#0E4E31]" size={28} aria-label="Memuat daftar peserta" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[#FBE5E3] bg-white p-8 text-center">
          <p className="text-base text-[#A32A2A]">{error}</p>
          <button type="button" data-testid={PARTICIPANT_REPORT.retry} onClick={load} className="mt-3 min-h-11 rounded-xl bg-[#14633F] px-4 font-semibold text-white">Coba lagi</button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white">
          <div className="flex items-center justify-between border-b border-[#E7E3D8] px-4 py-3">
            <h2 className="inline-flex items-center gap-2 font-bold text-[#14201A]">
              <CalendarDays size={18} /> {mode === "bulanan" ? monthLabel(month) : `${weekLabel(Number(week))}, ${monthLabel(month)}`}
            </h2>
            <span className="text-base text-[#5F6B63]">{filteredRows.length} peserta</span>
          </div>
          {filteredRows.length ? (
            <ul className="divide-y divide-[#E7E3D8]">
              {filteredRows.map((row) => (
                <li key={row.user_id} data-testid={`${PARTICIPANT_REPORT.rowPrefix}-${row.user_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#F6F4EE]">
                  <input type="checkbox" aria-label={`Pilih ${row.name}`} data-testid={`${PARTICIPANT_REPORT.checkboxPrefix}-${row.user_id}`}
                    checked={selected.has(row.user_id)} onChange={() => toggleSelected(row.user_id)}
                    className="h-5 w-5 shrink-0 accent-[#14633F]" />
                  <button type="button" data-testid={`${PARTICIPANT_REPORT.namePrefix}-${row.user_id}`}
                    onClick={() => setParticipantId(row.user_id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-semibold text-[#14201A]">{row.name}</span>
                  </button>
                  <div className="shrink-0 text-right">
                    <div className="font-bold text-[#0E4E31]">{row.ratio}%</div>
                    <div className="text-base text-[#5F6B63]">{row.hadir}/{row.total_pertemuan} hadir</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-10 text-center text-base text-[#5F6B63]">
              {rows.length ? "Tidak ada peserta yang cocok dengan pencarian atau pilihan." : "Belum ada peserta pada periode ini."}
            </p>
          )}
        </section>
      )}

      {shareManyOpen && (
        <ShareManyLinksModal
          rows={filteredRows.filter((row) => selected.has(row.user_id))}
          month={month}
          week={period}
          onClose={() => setShareManyOpen(false)}
        />
      )}
    </div>
  );
}