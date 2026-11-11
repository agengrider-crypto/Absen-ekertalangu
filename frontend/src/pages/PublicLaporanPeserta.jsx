import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, ClipboardList, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";
import { PARTICIPANT_REPORT } from "@/constants/testIds";
import ReportHeader from "@/components/ReportHeader";
import {
  PercentRing, StackedBar, StatCard, ReportCard, REPORT_COLORS,
} from "@/components/ReportVisuals";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const STATUSES = [
  ["hadir", "Hadir", "text-[#0E4E31]", "bg-[#E3F3EA]"],
  ["izin", "Izin", "text-[#6B4500]", "bg-[#FBF1D6]"],
  ["sakit", "Sakit", "text-[#1D4F91]", "bg-[#E3EEFB]"],
  ["alpha", "Alpha", "text-[#A32A2A]", "bg-[#FBE5E3]"],
  ["belum_diabsen", "Belum diabsen", "text-[#5F6B63]", "bg-[#F0EEE6]"],
];

function dateLabel(value) {
  const [year, month, day] = String(value || "").split("-");
  return day ? `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}` : "-";
}

function monthLabel(value) {
  const [year, month] = value.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

export default function PublicLaporanPeserta() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    setError("");
    api.get(`/laporan-peserta/${encodeURIComponent(token)}`)
      .then(({ data: result }) => setData(result))
      .catch((e) => {
        setError(e.response?.status === 410
          ? "Tautan laporan peserta sudah kedaluwarsa."
          : e.response?.status === 404
            ? "Tautan laporan peserta tidak ditemukan."
            : "Laporan peserta tidak dapat dimuat. Periksa koneksi Anda lalu coba kembali.");
      });
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F4EE] px-4 text-center">
        <Logo size={48} />
        <h1 className="mt-5 font-heading text-xl font-bold text-[#14201A]">Laporan per Peserta</h1>
        <p className="mt-2 text-base text-[#A32A2A]" data-testid={PARTICIPANT_REPORT.publicError}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F4EE]" role="status">
        <Loader2 className="animate-spin text-[#0E4E31]" size={32} aria-label="Memuat laporan peserta" />
      </div>
    );
  }

  const summary = data.summary || {};
  const total = Number(summary.total_pertemuan) || 0;
  const hadir = Number(summary.hadir) || 0;
  const ratio = total ? Math.round((hadir / total) * 100) : 0;
  const period = data.week === "bulanan"
    ? monthLabel(data.month)
    : `${dateLabel(data.date_from)}–${dateLabel(data.date_to)}`;
  const months = data.six_months?.months || [];
  const six = data.six_months?.summary || {};
  const maxRatio = 100;

  return (
    <div className="min-h-screen bg-[#F6F4EE] pb-12" data-testid={PARTICIPANT_REPORT.publicPage}>
      <ReportHeader
        title="Laporan per Peserta"
        subtitle={period}
        showUserIcon
        testid="laporan-peserta-header"
      />

      <main className="mx-auto max-w-2xl space-y-3 px-4">
        <ReportCard index={0} className="rounded-2xl border border-[#E7E3D8] bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5F6B63]">Nama peserta</div>
          <div className="mt-1 font-heading text-xl font-bold text-[#14201A]">{data.participant.name}</div>
          <div className="mt-2 flex items-center gap-2 text-sm text-[#5F6B63]">
            <CalendarDays size={15} /> {period}
          </div>
        </ReportCard>

        <ReportCard index={1} className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
          <div className="flex items-center gap-4">
            <PercentRing value={ratio} />
            <div className="min-w-0">
              <div className="font-heading text-base font-bold text-[#14201A]">
                {hadir} dari {total} pertemuan hadir
              </div>
              <div className="mt-0.5 text-xs text-[#5F6B63]">Persentase kehadiran bulan ini</div>
            </div>
          </div>
          <div className="mt-4">
            <StackedBar counts={summary} showBelum testid="laporan-peserta-stacked-bar" />
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-[#5F6B63]">
              <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: REPORT_COLORS.hadir }} /> Hadir</span>
              <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: REPORT_COLORS.izin }} /> Izin</span>
              <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: REPORT_COLORS.sakit }} /> Sakit</span>
              <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: REPORT_COLORS.alpha }} /> Alpha</span>
              <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: REPORT_COLORS.belum }} /> Belum diabsen</span>
            </div>
          </div>
        </ReportCard>

        <ReportCard index={2} className="grid grid-cols-5 gap-1.5" testid={PARTICIPANT_REPORT.periodStatuses}>
          <StatCard label="Hadir" value={summary.hadir || 0} color="#0E4E31" bg="#E3F3EA" />
          <StatCard label="Izin" value={summary.izin || 0} color="#6B4500" bg="#FBF1D6" />
          <StatCard label="Sakit" value={summary.sakit || 0} color="#1D4F91" bg="#E3EEFB" />
          <StatCard label="Alpha" value={summary.alpha || 0} color="#A32A2A" bg="#FBE5E3" />
          <StatCard label="Belum" value={summary.belum_diabsen || 0} color="#5F6B63" bg="#F0EEE6" />
        </ReportCard>

        <ReportCard index={3} className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5" testid={PARTICIPANT_REPORT.sixMonthChart}>
          <h2 className="font-bold text-[#14201A]">Kehadiran 6 bulan terakhir</h2>
          <p className="mt-1 text-xs text-[#5F6B63]">
            {six.hadir || 0} hadir dari {six.total_pertemuan || 0} pertemuan · {Math.round(six.ratio || 0)}%
          </p>
          <div className="mt-4 flex items-end justify-between gap-2" style={{ height: 132 }}>
            {months.map((item, i) => {
              const noMeeting = !item.total_pertemuan;
              const value = noMeeting ? 0 : Math.min(Math.max(item.ratio || 0, 0), 100);
              const h = noMeeting ? 4 : Math.max(6, (value / maxRatio) * 96);
              return (
                <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-bold tabular-nums text-[#5F6B63]">
                    {noMeeting ? "-" : `${Math.round(item.ratio || 0)}%`}
                  </span>
                  <div
                    className={`w-full max-w-8 rounded-t-md report-bar-up ${noMeeting ? "bg-[#E7E3D8]" : "bg-[#14633F]"}`}
                    style={{ height: h, animationDelay: `${i * 70}ms` }}
                    title={`${item.label}: ${noMeeting ? "tidak ada pertemuan" : `${Math.round(item.ratio || 0)}%`}`}
                  />
                  <span className="w-full truncate text-center text-[10px] font-semibold text-[#5F6B63]">{item.label}</span>
                </div>
              );
            })}
          </div>
        </ReportCard>

        <ReportCard index={4} className="overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white" testid={PARTICIPANT_REPORT.activityList}>
          <div className="flex items-center justify-between border-b border-[#E7E3D8] px-4 py-3">
            <h2 className="inline-flex items-center gap-2 font-bold text-[#14201A]">
              <ClipboardList size={18} /> Kegiatan yang diikuti
            </h2>
            <span className="text-xs text-[#5F6B63]">{data.activities.length} pertemuan</span>
          </div>
          {data.activities.length ? (
            <ul className="divide-y divide-[#E7E3D8]">
              {data.activities.map((activity) => {
                const status = STATUSES.find(([key]) => key === activity.status);
                return (
                  <li key={activity.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#14201A]">
                        {activity.name}{activity.session_label ? ` · ${activity.session_label}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-[#5F6B63]">
                        {dateLabel(activity.date)}{activity.start_time ? ` · ${activity.start_time}${activity.end_time ? `–${activity.end_time}` : ""}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status?.[3] || "bg-[#F0EEE6]"} ${status?.[2] || "text-[#5F6B63]"}`}>
                      {status?.[1] || activity.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="p-8 text-center text-sm text-[#5F6B63]">Belum ada kegiatan pada periode ini.</p>
          )}
        </ReportCard>

        <p className="text-center text-xs text-[#5F6B63]">
          Tautan berlaku sampai {new Date(data.expires_at).toLocaleDateString("id-ID")}.
        </p>
      </main>
    </div>
  );
}
