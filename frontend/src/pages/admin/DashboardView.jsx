import { useEffect, useState } from "react";
import {
  Users, CalendarDays, Loader2, CalendarPlus,
  UserPlus, FileBarChart2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import { DASHBOARD } from "@/constants/testIds";
import { ActivationQrCard } from "@/components/ActivationQr";
import ActivationQrModal from "@/components/ActivationQr";
import { todayIndo } from "./adminUtils";
import { MONTH_SHORT, TYPE_LABEL, tanggalSingkat } from "./kegiatanUtils";

function StatCard({ value }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#E8E8E4] bg-white p-5" data-testid={DASHBOARD.totalPeserta}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F1F1EE] text-[#111114]">
        <Users size={24} />
      </span>
      <div>
        <div className="text-2xl font-bold leading-none text-[#111827]">{value}</div>
        <div className="mt-1 text-sm text-[#6B7280]">Total Peserta</div>
      </div>
    </div>
  );
}

export default function DashboardView({
  user,
  onGoto,
  onAddPeserta,
  onAddKegiatan,
  onOpenKegiatan,
  role = "admin",
}) {
  const [d, setD] = useState(null);
  const [monthlyRecap, setMonthlyRecap] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    api.get("/admin/dashboard").then(({ data }) => setD(data)).catch(() => setD(false));
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    api.get(`/staff/rekap-bulanan?month=${month}`)
      .then(({ data }) => setMonthlyRecap(data))
      .catch(() => setMonthlyRecap(false));
  }, [role]);

  if (d === null) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={32} /></div>;
  }
  if (d === false) {
    return <div className="p-10 text-center text-[#6B7280]">Gagal memuat data dashboard.</div>;
  }

  const trend = (d.tren || []).map((t) => {
    const m = parseInt(t.month.slice(5, 7), 10);
    return { name: MONTH_SHORT[m - 1] || t.month, ratio: t.ratio, kegiatan: t.kegiatan };
  });
  const actionRows = monthlyRecap?.rows || [];
  const followUpCounts = {
    neverAttended: actionRows.filter((r) => r.pertemuan > 0 && r.hadir === 0).length,
    rarelyAttended: actionRows.filter((r) => r.pertemuan > 0 && r.hadir > 0 && r.ratio < 50).length,
    sometimesAttended: actionRows.filter((r) => r.pertemuan > 0 && r.ratio >= 50 && r.ratio < 80).length,
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-heading text-[28px] sm:text-[34px] font-bold text-[#111114] leading-tight" data-testid={DASHBOARD.welcome}>
          Selamat datang, {user?.name || "-"}
        </h1>
        <p className="text-[#6B7280] flex items-center gap-1.5 mt-2"><CalendarDays size={16} /> {todayIndo()}</p>
      </div>

      <div className="mb-6" data-testid={DASHBOARD.shortcutsContainer}>
        <div className="text-sm font-semibold text-[#374151] mb-2">Pintasan Cepat</div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            { key: "tambah-peserta", label: "Tambah Peserta", icon: UserPlus, action: onAddPeserta, testId: DASHBOARD.shortcuts.addPeserta },
            { key: "tambah-kegiatan", label: "Tambah Kegiatan", icon: CalendarPlus, action: onAddKegiatan, testId: DASHBOARD.shortcuts.addKegiatan },
            { key: "rekap-bulanan", label: "Rekap Bulanan", icon: FileBarChart2, action: () => onGoto && onGoto("rekap-bulanan"), testId: DASHBOARD.shortcuts.rekapBulanan },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                data-testid={s.testId}
                onClick={s.action}
                className="flex min-h-14 items-center gap-3 rounded-xl border border-[#E8E8E4] bg-white px-4 py-3 text-left hover:border-[#111114] hover:bg-[#FAFAF8] transition-colors"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F1EE] text-[#111114]"><Icon size={20} /></span>
                <span className="text-sm font-semibold text-[#374151]">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6 max-w-sm">
        <StatCard value={d.total_peserta} />
      </div>

      <div className="mb-6">
        <ActivationQrCard onOpen={() => setQrOpen(true)} />
      </div>

      {qrOpen && <ActivationQrModal onClose={() => setQrOpen(false)} />}

      <section className="mb-6 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-4 sm:p-5" data-testid={DASHBOARD.followUp.container}>
        <div className="mb-3">
          <h2 className="font-heading font-bold text-[#78350F]">Perlu Tindakan</h2>
          <p className="mt-0.5 text-xs text-[#92400E]">Kehadiran peserta bulan ini</p>
        </div>
        {monthlyRecap === null ? (
          <div className="flex items-center gap-2 text-sm text-[#92400E]"><Loader2 size={16} className="animate-spin" /> Memuat jumlah peserta…</div>
        ) : monthlyRecap === false ? (
          <p className="text-sm text-[#991B1B]">Gagal memuat jumlah peserta yang perlu ditindaklanjuti.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { key: "neverAttended", label: "Belum pernah hadir", filter: "belum", testId: DASHBOARD.followUp.neverAttended, color: "border-[#FECACA] bg-white text-[#991B1B]" },
              { key: "rarelyAttended", label: "Jarang hadir", filter: "jarang", testId: DASHBOARD.followUp.rarelyAttended, color: "border-[#FDE68A] bg-white text-[#92400E]" },
              { key: "sometimesAttended", label: "Cukup aktif", filter: "cukup", testId: DASHBOARD.followUp.sometimesAttended, color: "border-[#BAE6FD] bg-white text-[#075985]" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                data-testid={item.testId}
                onClick={() => onGoto?.("rekap-bulanan", item.filter)}
                className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left hover:shadow-sm ${item.color}`}
              >
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-xl font-bold tabular-nums">{followUpCounts[item.key]}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="mb-6 rounded-2xl border border-[#E8E8E4] bg-white p-5 sm:p-6" data-testid={DASHBOARD.trendChart}>
        <h2 className="mb-3 font-heading font-bold text-[#111827]">Tren Kehadiran (6 bulan)</h2>
        {trend.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#6B7280]">Belum ada data tren kehadiran.</p>
          ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, trend.length * 38)}>
            <BarChart data={trend} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EFEFEA" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12, fill: "#6B7280" }} />
              <YAxis type="category" dataKey="name" width={48} tick={{ fontSize: 12, fill: "#6B7280" }} />
              <Tooltip formatter={(value) => `${value}%`} />
              <Bar dataKey="ratio" fill="#0D5C3A" radius={[0, 6, 6, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="rounded-2xl border border-[#E8E8E4] bg-white p-5 sm:p-6" data-testid={DASHBOARD.activitiesSection}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading font-bold text-[#111827]">Daftar Kegiatan</h2>
          <button onClick={() => onGoto && onGoto("kegiatan")} className="text-sm font-semibold text-[#111114] hover:underline inline-flex items-center gap-1">
            <CalendarPlus size={15} /> Kelola
          </button>
        </div>
        {(!d.upcoming || d.upcoming.length === 0) ? (
          <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#FAFAF8] p-6 text-center text-sm text-[#6B7280]">
            Belum ada kegiatan mendatang.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left" data-testid={DASHBOARD.kegiatanTable}>
              <thead>
                <tr className="border-b border-[#E8E8E4] text-xs font-semibold text-[#6B7280]">
                  <th scope="col" className="px-3 py-3">Nama Kegiatan</th>
                  <th scope="col" className="px-3 py-3">Jenis</th>
                  <th scope="col" className="px-3 py-3">Tanggal & Waktu</th>
                  <th scope="col" className="px-3 py-3 text-right">Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E4]">
                {d.upcoming.map((k) => (
                  <tr key={k.id} className="hover:bg-[#FAFAF8]">
                    <td className="px-3 py-3 font-semibold text-[#111827]">
                      <button
                        type="button"
                        data-testid={`${DASHBOARD.kegiatanRowPrefix}-${k.id}`}
                        onClick={() => onOpenKegiatan?.(k.id)}
                        className="text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0D5C3A]"
                      >
                        {k.name}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-sm text-[#4B5563]">{TYPE_LABEL[k.type] || k.type || "-"}</td>
                    <td className="px-3 py-3 text-sm text-[#4B5563]">
                      {tanggalSingkat(k.date)} · {k.start_time}–{k.end_time}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-semibold text-[#111827]">
                      {k.counts?.hadir ?? 0}/{k.counts?.total ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
