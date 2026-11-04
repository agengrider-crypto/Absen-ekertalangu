import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { PARTICIPANT_REPORT } from "@/constants/testIds";
import { tanggalSingkat } from "./kegiatanUtils";

const inp = "h-11 rounded-xl border-2 border-[#E8E8E4] bg-white px-3.5 text-base outline-none focus:border-[#111114]";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function weeksInMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const weeks = [];
  let firstDay = 1;
  while (firstDay <= daysInMonth) {
    const date = new Date(year, monthNumber - 1, firstDay);
    const daysUntilSunday = 6 - ((date.getDay() + 6) % 7);
    const lastDay = Math.min(daysInMonth, firstDay + daysUntilSunday);
    weeks.push({
      key: String(firstDay),
      from: `${month}-${String(firstDay).padStart(2, "0")}`,
      to: `${month}-${String(lastDay).padStart(2, "0")}`,
      label: `Minggu ${weeks.length + 1} · ${tanggalSingkat(`${month}-${String(firstDay).padStart(2, "0")}`)}–${tanggalSingkat(`${month}-${String(lastDay).padStart(2, "0")}`)}`,
    });
    firstDay = lastDay + 1;
  }
  return weeks;
}

export default function LaporanPesertaView() {
  const [month, setMonth] = useState(currentMonth);
  const [mode, setMode] = useState("month");
  const [weekKey, setWeekKey] = useState("1");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const requestId = useRef(0);

  const weeks = useMemo(() => weeksInMonth(month), [month]);
  const selectedWeek = weeks.find((week) => week.key === weekKey) || weeks[0];
  const range = mode === "week" && selectedWeek ? selectedWeek : monthRange(month);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setData(null);
    setLoadError("");
    try {
      const { data: result } = await api.get("/admin/laporan/peserta", {
        params: { date_from: range.from, date_to: range.to },
      });
      if (requestId.current === currentRequest) setData(result);
    } catch (error) {
      if (requestId.current !== currentRequest) return;
      const message = formatApiErrorDetail(error.response?.data?.detail);
      setLoadError(message);
      toast.error(message);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    load();
    return () => { requestId.current += 1; };
  }, [load]);

  const visibleRows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("id");
    const rows = (data?.per_peserta || []).filter((row) =>
      !term || (row.name || "").toLocaleLowerCase("id").includes(term));
    return selectedOnly ? rows.filter((row) => selectedIds.has(row.user_id)) : rows;
  }, [data, query, selectedIds, selectedOnly]);

  const selectedRows = useMemo(
    () => (data?.per_peserta || []).filter((row) => selectedIds.has(row.user_id)),
    [data, selectedIds],
  );
  const allVisibleSelected = visibleRows.length > 0
    && visibleRows.every((row) => selectedIds.has(row.user_id));

  const toggleAllVisible = () => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      visibleRows.forEach((row) => {
        if (allVisibleSelected) next.delete(row.user_id);
        else next.add(row.user_id);
      });
      return next;
    });
  };

  const toggleParticipant = (userId) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const periodLabel = mode === "week"
    ? selectedWeek?.label
    : `${tanggalSingkat(range.from)} – ${tanggalSingkat(range.to)}`;
  const totals = selectedRows.reduce((summary, row) => ({
    meetings: summary.meetings + (row.kegiatan || 0),
    hadir: summary.hadir + (row.hadir || 0),
    izin: summary.izin + (row.izin || 0),
    sakit: summary.sakit + (row.sakit || 0),
    alpha: summary.alpha + (row.alpha || 0),
  }), { meetings: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 });

  return (
    <div className="space-y-4" data-testid="laporan-peserta-view">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E8F5EE] text-[#0D5C3A]">
          <Users size={21} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Laporan per Peserta</h1>
          <p className="text-sm text-[#6B7280]">Pilih periode dan peserta untuk melihat rekap kehadiran.</p>
        </div>
      </header>

      <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Jenis periode">
          <button type="button" data-testid={PARTICIPANT_REPORT.periodModeMonth}
            aria-pressed={mode === "month"} onClick={() => setMode("month")}
            className={`min-h-11 rounded-xl px-4 font-semibold ${mode === "month" ? "bg-[#0D5C3A] text-white" : "border-2 border-[#E8E8E4] text-[#374151]"}`}>
            Per Bulan
          </button>
          <button type="button" data-testid={PARTICIPANT_REPORT.periodModeWeek}
            aria-pressed={mode === "week"} onClick={() => setMode("week")}
            className={`min-h-11 rounded-xl px-4 font-semibold ${mode === "week" ? "bg-[#0D5C3A] text-white" : "border-2 border-[#E8E8E4] text-[#374151]"}`}>
            Per Minggu
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold text-[#374151]">
            Bulan
            <input data-testid={PARTICIPANT_REPORT.periodMonth} type="month" value={month}
              onChange={(event) => {
                if (!event.target.value) return;
                setMonth(event.target.value);
                setWeekKey("1");
              }}
              className={inp} />
          </label>
          {mode === "week" && (
            <label className="flex flex-col gap-1 text-sm font-semibold text-[#374151]">
              Minggu dalam bulan
              <select data-testid={PARTICIPANT_REPORT.periodWeek} value={selectedWeek?.key || ""}
                onChange={(event) => setWeekKey(event.target.value)} className={inp}>
                {weeks.map((week) => <option key={week.key} value={week.key}>{week.label}</option>)}
              </select>
            </label>
          )}
          <div className="flex min-h-11 items-center gap-2 text-sm text-[#4B5563]">
            <CalendarDays size={17} /> Periode: <b className="text-[#111827]">{periodLabel}</b>
          </div>
        </div>
      </section>

      {data && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid={PARTICIPANT_REPORT.selectionSummary}>
          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
            <div className="text-2xl font-bold text-[#111827]">{selectedRows.length}</div>
            <div className="text-sm text-[#6B7280]">Peserta dipilih</div>
          </div>
          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
            <div className="text-2xl font-bold text-[#0D5C3A]">{totals.hadir}</div>
            <div className="text-sm text-[#6B7280]">Hadir · {totals.meetings} pertemuan</div>
          </div>
          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
            <div className="text-lg font-bold text-[#92400E]">Izin {totals.izin} · Sakit {totals.sakit}</div>
            <div className="text-sm text-[#6B7280]">Izin dan sakit</div>
          </div>
          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
            <div className="text-2xl font-bold text-[#991B1B]">{totals.alpha}</div>
            <div className="text-sm text-[#6B7280]">Alpha</div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#E8E8E4] bg-white">
        <div className="flex flex-col gap-3 border-b border-[#E8E8E4] bg-[#FAFAF8] p-4">
          <div className="relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6B7280]" />
            <input data-testid={PARTICIPANT_REPORT.search} type="search" value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama peserta"
              className={`${inp} w-full pl-10`} />
          </div>
          {data && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#374151]">
                <input data-testid={PARTICIPANT_REPORT.selectAll} type="checkbox"
                  checked={allVisibleSelected} onChange={toggleAllVisible}
                  className="h-5 w-5 accent-[#0D5C3A]" />
                Pilih semua yang tampil ({visibleRows.length})
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 text-sm text-[#374151]">
                <input data-testid={PARTICIPANT_REPORT.selectedOnly} type="checkbox"
                  checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)}
                  className="h-5 w-5 accent-[#0D5C3A]" />
                Tampilkan pilihan saja ({selectedRows.length})
              </label>
            </div>
          )}
        </div>

        {data === null && !loadError ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-[#4B5563]" role="status">
            <Loader2 size={21} className="animate-spin" /> Memuat laporan peserta…
          </div>
        ) : loadError ? (
          <div className="p-8 text-center">
            <p className="text-sm text-[#991B1B]">{loadError}</p>
            <button type="button" onClick={load} className="mt-3 min-h-11 rounded-xl bg-[#111114] px-4 font-semibold text-white">
              Coba lagi
            </button>
          </div>
        ) : visibleRows.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#6B7280]">
            {query
              ? "Nama peserta tidak ditemukan."
              : selectedOnly ? "Belum ada peserta yang dipilih." : "Belum ada peserta pada laporan ini."}
          </p>
        ) : (
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full min-w-[760px] text-sm" data-testid={PARTICIPANT_REPORT.table}>
              <thead className="sticky top-0 bg-[#FAFAF8] text-left text-[#6B7280]">
                <tr>
                  <th scope="col" className="w-12 px-4 py-3"><span className="sr-only">Pilih</span></th>
                  <th scope="col" className="px-4 py-3 font-semibold">Nama Peserta</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Pertemuan</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Hadir</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Izin</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Sakit</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Alpha</th>
                  <th scope="col" className="px-3 py-3 text-center font-semibold">Belum</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECECE8]">
                {visibleRows.map((row) => (
                  <tr key={row.user_id} data-testid={`${PARTICIPANT_REPORT.rowPrefix}-${row.user_id}`}
                    className={selectedIds.has(row.user_id) ? "bg-[#F0FDF4]" : ""}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(row.user_id)}
                        onChange={() => toggleParticipant(row.user_id)}
                        aria-label={`Pilih ${row.name}`}
                        className="h-5 w-5 accent-[#0D5C3A]" />
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#111827]">{row.name || "Tanpa nama"}</td>
                    <td className="px-3 py-3 text-center text-[#4B5563]">{row.kegiatan || 0}</td>
                    <td className="px-3 py-3 text-center font-semibold text-[#0D5C3A]">{row.hadir || 0}</td>
                    <td className="px-3 py-3 text-center text-[#92400E]">{row.izin || 0}</td>
                    <td className="px-3 py-3 text-center text-[#1D4ED8]">{row.sakit || 0}</td>
                    <td className="px-3 py-3 text-center text-[#991B1B]">{row.alpha || 0}</td>
                    <td className="px-3 py-3 text-center text-[#6B7280]">{row.belum_diabsen || 0}</td>
                    <td className="px-3 py-3 text-right font-bold text-[#111827]">{row.ratio || 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <div className="border-t border-[#E8E8E4] px-4 py-3 text-sm text-[#6B7280]">
          {visibleRows.length} peserta ditampilkan · {data.total_kegiatan} kegiatan pada periode ini
        </div>}
      </section>
    </div>
  );
}
