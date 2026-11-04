import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, ClipboardList,
  Loader2, Search, Share2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { PARTICIPANT_REPORT } from "@/constants/testIds";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const STATUS = {
  hadir: { label: "Hadir", color: "text-[#14532D]", bg: "bg-[#E8F5EE]" },
  izin: { label: "Izin", color: "text-[#92400E]", bg: "bg-[#FEF3C7]" },
  sakit: { label: "Sakit", color: "text-[#1D4ED8]", bg: "bg-[#DBEAFE]" },
  alpha: { label: "Alpha", color: "text-[#991B1B]", bg: "bg-[#FEE2E2]" },
  belum_diabsen: { label: "Belum diabsen", color: "text-[#4B5563]", bg: "bg-[#F3F4F6]" },
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

function SummaryCard({ label, value, color = "text-[#111827]" }) {
  return (
    <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-base text-[#6B7280]">{label}</div>
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

  const copyLink = async () => {
    const query = new URLSearchParams({ bulan: month, pekan: week });
    const link = `${window.location.origin}/laporan-peserta/${encodeURIComponent(participantId)}?${query}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Tautan laporan peserta disalin.");
    } catch {
      toast.error("Tautan gagal disalin. Coba bagikan melalui WhatsApp.");
    }
  };

  const shareWhatsApp = () => {
    if (!data) return;
    const query = new URLSearchParams({ bulan: month, pekan: week });
    const link = `${window.location.origin}/laporan-peserta/${encodeURIComponent(participantId)}?${query}`;
    const summary = data.six_months.summary;
    const text = [
      `Assalamu'alaikum, berikut laporan kehadiran ${data.participant.name}.`,
      `Periode ${monthLabel(month)}${week !== "bulanan" ? `, ${weekLabel(Number(week))}` : ""}.`,
      `Hadir ${summary.hadir}/${summary.total_pertemuan} pertemuan (${summary.ratio}%).`,
      `Hadir ${summary.hadir} · Izin ${summary.izin} · Sakit ${summary.sakit} · Alpha ${summary.alpha}.`,
      "Tautan ini hanya dapat dibuka oleh pengurus yang sudah masuk ke aplikasi:",
      link,
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  if (!data) {
    return (
      <div className="rounded-2xl border border-[#E8E8E4] bg-white p-10 text-center" data-testid={PARTICIPANT_REPORT.detail}>
        {error ? (
          <>
            <p className="text-base text-[#991B1B]">{error}</p>
            <button type="button" data-testid={PARTICIPANT_REPORT.retry} onClick={load} className="mt-3 min-h-11 rounded-xl bg-[#111114] px-4 font-semibold text-white">Coba lagi</button>
          </>
        ) : <Loader2 className="mx-auto animate-spin text-[#111114]" size={28} aria-label="Memuat laporan peserta" />}
      </div>
    );
  }

  const six = data.six_months;
  return (
    <div className="space-y-4" data-testid={PARTICIPANT_REPORT.detail}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <button type="button" data-testid={PARTICIPANT_REPORT.back} onClick={onBack}
            className="mb-2 inline-flex min-h-11 items-center gap-2 rounded-lg text-base font-semibold text-[#4B5563] hover:text-[#111114]">
            <ArrowLeft size={17} /> Daftar peserta
          </button>
          <h1 className="truncate font-heading text-2xl font-bold text-[#111827]">{data.participant.name}</h1>
          <p className="mt-1 text-base text-[#6B7280]">
              {[data.participant.phone, data.participant.email].filter(Boolean).join(" · ") || "Kontak belum diisi"} · {data.participant.account_status === "pending" ? "Belum aktivasi" : "Akun aktif"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" data-testid={PARTICIPANT_REPORT.copyLink} onClick={copyLink}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-[#E8E8E4] bg-white px-3.5 text-base font-semibold text-[#111827] hover:border-[#111114]">
            <Share2 size={16} /> Salin tautan
          </button>
          <button type="button" data-testid={PARTICIPANT_REPORT.shareWhatsApp} onClick={shareWhatsApp}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3.5 text-base font-semibold text-white hover:brightness-95">
            <Share2 size={16} /> Bagikan ke pengurus
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2" data-testid={PARTICIPANT_REPORT.periodSummary}>
        <SummaryCard label={`Kehadiran · ${monthLabel(month)}${week !== "bulanan" ? ` · Pekan ${week}` : ""}`} value={`${data.summary.ratio}%`} color="text-[#0D5C3A]" />
        <SummaryCard label="Total pertemuan pada periode" value={data.summary.total_pertemuan} />
      </section>
      <StatusSummary summary={data.summary} testid={PARTICIPANT_REPORT.periodStatuses} />

      <section className="space-y-4 rounded-2xl border border-[#E8E8E4] bg-white p-4 sm:p-5" data-testid={PARTICIPANT_REPORT.sixMonthSummary}>
        <div>
          <h2 className="font-bold text-[#111827]">Kehadiran 6 bulan terakhir</h2>
          <p className="mt-1 text-base text-[#6B7280]">
            {six.summary.ratio}% · {six.summary.hadir} hadir dari {six.summary.total_pertemuan} pertemuan
          </p>
        </div>
        <StatusSummary summary={six.summary} testid={PARTICIPANT_REPORT.sixMonthStatuses} />
        <div className="space-y-3" data-testid={PARTICIPANT_REPORT.sixMonthChart}>
          {six.months.map((item) => (
            <div key={item.month} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3">
              <span className="text-base font-semibold text-[#4B5563]">{item.label}</span>
              <div className="h-3 overflow-hidden rounded-full bg-[#F1F1EE]">
                <div className="h-full origin-left rounded-full bg-[#0D5C3A] motion-safe:animate-[rekap-bar-grow_700ms_ease-out_both]"
                  style={{ width: `${Math.min(Math.max(item.ratio || 0, 0), 100)}%` }} />
              </div>
              <span className="text-right text-base font-bold text-[#111827]">{item.ratio}%</span>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E8E8E4] bg-white" data-testid={PARTICIPANT_REPORT.activityList}>
        <div className="flex items-center justify-between border-b border-[#E8E8E4] px-4 py-3">
          <h2 className="inline-flex items-center gap-2 font-bold text-[#111827]">
            <ClipboardList size={18} /> Kegiatan yang diikuti
          </h2>
          <span className="text-base text-[#6B7280]">{data.activities.length} pertemuan</span>
        </div>
        {data.activities.length ? (
          <ul className="divide-y divide-[#ECECE8]">
            {data.activities.map((activity) => (
              <li key={activity.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#111827]">{activity.name}{activity.session_label ? ` · ${activity.session_label}` : ""}</p>
                  <p className="mt-1 text-base text-[#6B7280]">
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
          <p className="p-8 text-center text-base text-[#6B7280]">Belum ada kegiatan pada periode ini.</p>
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
  const [selected, setSelected] = useState(() => new Set());
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [participantId, setParticipantId] = useState(() => searchParams.get("laporanPesertaId"));

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
      return !term
        || (row.name || "").toLocaleLowerCase("id").includes(term)
        || String(row.phone || "").toLocaleLowerCase("id").includes(term)
        || String(row.email || "").toLocaleLowerCase("id").includes(term);
    });
  }, [rows, search, selected, selectedOnly]);

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
      <header className="flex items-center gap-2 font-heading text-xl font-bold text-[#111827]">
        <Users size={21} /> Laporan per Peserta
      </header>

      <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <label htmlFor="laporan-peserta-month" className="mb-1 block text-base font-semibold text-[#4B5563]">Bulan laporan</label>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Bulan sebelumnya" data-testid={PARTICIPANT_REPORT.previousMonth} onClick={() => setMonthValue(shiftMonth(month, -1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E8E8E4] text-[#4B5563] hover:bg-[#F4F4F1]">
                <ChevronLeft size={18} />
              </button>
              <input id="laporan-peserta-month" data-testid={PARTICIPANT_REPORT.month} type="month" max={maxMonth} value={month}
                onChange={(e) => {
                  if (/^\d{4}-\d{2}$/.test(e.target.value) && e.target.value <= maxMonth) setMonthValue(e.target.value);
                }} className="h-11 rounded-xl border-2 border-[#E8E8E4] bg-white px-3 text-base font-semibold text-[#111827]" />
              <button type="button" aria-label="Bulan berikutnya" data-testid={PARTICIPANT_REPORT.nextMonth} disabled={month >= maxMonth} onClick={() => setMonthValue(shiftMonth(month, 1))}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E8E8E4] text-[#4B5563] hover:bg-[#F4F4F1] disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="inline-flex rounded-xl bg-[#F4F4F1] p-1" role="group" aria-label="Periode laporan">
            <button type="button" data-testid={PARTICIPANT_REPORT.monthlyMode} aria-pressed={mode === "bulanan"}
              onClick={() => setMode("bulanan")} className={`min-h-11 rounded-lg px-4 text-base font-semibold ${mode === "bulanan" ? "bg-white text-[#111114] shadow-sm" : "text-[#6B7280]"}`}>
              Bulanan
            </button>
            <button type="button" data-testid={PARTICIPANT_REPORT.weeklyMode} aria-pressed={mode === "mingguan"}
              onClick={() => { setMode("mingguan"); setWeek("1"); }} className={`min-h-11 rounded-lg px-4 text-base font-semibold ${mode === "mingguan" ? "bg-white text-[#111114] shadow-sm" : "text-[#6B7280]"}`}>
              Mingguan
            </button>
          </div>
        </div>
        {mode === "mingguan" && (
          <div className="mt-4">
            <label htmlFor="laporan-peserta-week" className="mb-1 block text-base font-semibold text-[#4B5563]">Pilih pekan</label>
            <select id="laporan-peserta-week" data-testid={PARTICIPANT_REPORT.week} value={week} onChange={(e) => setWeek(e.target.value)}
              className="h-11 w-full max-w-xs rounded-xl border-2 border-[#E8E8E4] bg-white px-3 text-base">
              {Array.from({ length: availableWeeks(month) }, (_, index) => String(index + 1)).map((value) => (
                <option key={value} value={value}>{weekLabel(Number(value))} {monthLabel(month)}</option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
        <label htmlFor="laporan-peserta-search" className="mb-1.5 block text-base font-semibold text-[#374151]">Cari nama, nomor HP, atau email</label>
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input id="laporan-peserta-search" data-testid={PARTICIPANT_REPORT.search} value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Ketik nama, nomor HP, atau email" className="h-12 w-full rounded-xl border-2 border-[#E8E8E4] bg-white pl-11 pr-3 text-base outline-none focus:border-[#111114]" />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-[#374151]">
            <input data-testid={PARTICIPANT_REPORT.selectAll} type="checkbox" checked={allVisibleSelected}
              onChange={toggleAll} className="h-5 w-5 accent-[#0D5C3A]" />
            Pilih semua yang tampil
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" data-testid={PARTICIPANT_REPORT.selectedOnly} aria-pressed={selectedOnly}
              onClick={() => setSelectedOnly((value) => !value)}
              className={`min-h-11 rounded-xl border px-3 text-base font-semibold ${selectedOnly ? "border-[#0D5C3A] bg-[#E8F5EE] text-[#14532D]" : "border-[#E8E8E4] text-[#4B5563]"}`}>
              {selectedOnly ? "Tampilkan semua" : `Pilihan (${selected.size})`}
            </button>
            {selected.size > 0 && (
              <button type="button" data-testid={PARTICIPANT_REPORT.clearSelection} onClick={() => { setSelected(new Set()); setSelectedOnly(false); }}
                className="min-h-11 rounded-xl px-3 text-base font-semibold text-[#991B1B] hover:bg-[#FEE2E2]">
                Hapus pilihan
              </button>
            )}
          </div>
        </div>
      </section>

      {rows === null ? (
        <div className="rounded-2xl border border-[#E8E8E4] bg-white p-12 text-center">
          <Loader2 className="mx-auto animate-spin text-[#111114]" size={28} aria-label="Memuat daftar peserta" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[#FECACA] bg-white p-8 text-center">
          <p className="text-base text-[#991B1B]">{error}</p>
          <button type="button" data-testid={PARTICIPANT_REPORT.retry} onClick={load} className="mt-3 min-h-11 rounded-xl bg-[#111114] px-4 font-semibold text-white">Coba lagi</button>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-[#E8E8E4] bg-white">
          <div className="flex items-center justify-between border-b border-[#E8E8E4] px-4 py-3">
            <h2 className="inline-flex items-center gap-2 font-bold text-[#111827]">
              <CalendarDays size={18} /> {mode === "bulanan" ? monthLabel(month) : `${weekLabel(Number(week))}, ${monthLabel(month)}`}
            </h2>
            <span className="text-base text-[#6B7280]">{filteredRows.length} peserta</span>
          </div>
          {filteredRows.length ? (
            <ul className="divide-y divide-[#ECECE8]">
              {filteredRows.map((row) => (
                <li key={row.user_id} data-testid={`${PARTICIPANT_REPORT.rowPrefix}-${row.user_id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF8]">
                  <input type="checkbox" aria-label={`Pilih ${row.name}`} data-testid={`${PARTICIPANT_REPORT.checkboxPrefix}-${row.user_id}`}
                    checked={selected.has(row.user_id)} onChange={() => toggleSelected(row.user_id)}
                    className="h-5 w-5 shrink-0 accent-[#0D5C3A]" />
                  <button type="button" data-testid={`${PARTICIPANT_REPORT.namePrefix}-${row.user_id}`}
                    onClick={() => setParticipantId(row.user_id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate font-semibold text-[#111827]">{row.name}</span>
                    <span className="mt-0.5 block text-base text-[#6B7280]">{[row.phone, row.email].filter(Boolean).join(" · ") || "Kontak belum diisi"}</span>
                  </button>
                  <div className="shrink-0 text-right">
                    <div className="font-bold text-[#0D5C3A]">{row.ratio}%</div>
                    <div className="text-base text-[#6B7280]">{row.hadir}/{row.total_pertemuan} hadir</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-10 text-center text-base text-[#6B7280]">
              {rows.length ? "Tidak ada peserta yang cocok dengan pencarian atau pilihan." : "Belum ada peserta pada periode ini."}
            </p>
          )}
        </section>
      )}
    </div>
  );
}