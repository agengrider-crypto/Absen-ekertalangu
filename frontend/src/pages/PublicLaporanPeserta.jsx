import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, ClipboardList, Loader2 } from "lucide-react";
import { Logo, K1Mark, K1Wordmark } from "@/components/Logo";
import { api } from "@/lib/api";
import { PARTICIPANT_REPORT } from "@/constants/testIds";

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

function Metric({ label, value, color = "text-[#14201A]" }) {
  return (
    <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="mt-1 text-base text-[#5F6B63]">{label}</div>
    </div>
  );
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
        <h1 className="mt-5 font-heading text-xl font-bold text-[#14201A]">Laporan Peserta</h1>
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

  const summary = data.summary;
  return (
    <div className="min-h-screen bg-[#F6F4EE] pb-12" data-testid={PARTICIPANT_REPORT.publicPage}>
      <header className="bg-[#14633F] text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <K1Mark size={40} variant="dark" />
          <div className="leading-tight">
            <K1Wordmark variant="dark" size="text-base" />
            <div className="text-sm text-white/75">Laporan Peserta</div>
          </div>
        </div>
      </header>

      <main className="mx-auto -mt-2 max-w-2xl space-y-4 px-4">
        <section className="rounded-2xl border border-[#E7E3D8] bg-white p-5 shadow-sm">
          <h1 className="font-heading text-xl font-bold text-[#14201A]">Laporan Peserta</h1>
          <p className="mt-2 text-lg font-semibold text-[#14201A]">{data.participant.name}</p>
          <p className="mt-2 flex items-center gap-2 text-base text-[#5F6B63]">
            <CalendarDays size={17} />
            {data.week === "bulanan"
              ? monthLabel(data.month)
              : `${dateLabel(data.date_from)}–${dateLabel(data.date_to)}`}
          </p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2" data-testid={PARTICIPANT_REPORT.periodSummary}>
          <Metric label="Persentase kehadiran" value={`${summary.ratio}%`} color="text-[#0E4E31]" />
          <Metric label="Total pertemuan" value={summary.total_pertemuan} />
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid={PARTICIPANT_REPORT.periodStatuses}>
          {STATUSES.map(([key, label, color]) => (
            <Metric key={key} label={label} value={summary[key] || 0} color={color} />
          ))}
        </section>

        <section className="space-y-4 rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5" data-testid={PARTICIPANT_REPORT.sixMonthChart}>
          <div>
            <h2 className="font-bold text-[#14201A]">Kehadiran 6 bulan terakhir</h2>
            <p className="mt-1 text-base text-[#5F6B63]">
              {data.six_months.summary.ratio}% · {data.six_months.summary.hadir} hadir dari {data.six_months.summary.total_pertemuan} pertemuan
            </p>
          </div>
          {data.six_months.months.map((item) => (
            <div key={item.month} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3">
              <span className="text-base font-semibold text-[#5F6B63]">{item.label}</span>
              <div className="h-3 overflow-hidden rounded-full bg-[#E3F3EA]">
                <div className="h-full origin-left rounded-full bg-[#14633F] motion-safe:animate-[rekap-bar-grow_700ms_ease-out_both]"
                  style={{ width: `${Math.min(Math.max(item.ratio || 0, 0), 100)}%` }} />
              </div>
              <span className="text-right text-base font-bold text-[#14201A]">{item.ratio}%</span>
            </div>
          ))}
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
              {data.activities.map((activity) => {
                const status = STATUSES.find(([key]) => key === activity.status);
                return (
                  <li key={activity.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[#14201A]">
                        {activity.name}{activity.session_label ? ` · ${activity.session_label}` : ""}
                      </p>
                      <p className="mt-1 text-base text-[#5F6B63]">
                        {dateLabel(activity.date)}{activity.start_time ? ` · ${activity.start_time}${activity.end_time ? `–${activity.end_time}` : ""}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-base font-semibold ${status?.[3] || "bg-[#F0EEE6]"} ${status?.[2] || "text-[#5F6B63]"}`}>
                      {status?.[1] || activity.status}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="p-8 text-center text-base text-[#5F6B63]">Belum ada kegiatan pada periode ini.</p>
          )}
        </section>

        <p className="text-center text-sm text-[#5F6B63]">
          Tautan berlaku sampai {new Date(data.expires_at).toLocaleDateString("id-ID")}.
        </p>
      </main>
    </div>
  );
}
