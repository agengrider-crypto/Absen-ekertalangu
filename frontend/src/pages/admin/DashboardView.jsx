import { useEffect, useState } from "react";
import {
  Users, CalendarDays, Loader2, CalendarPlus,
  UserPlus, FileBarChart2, CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import { DASHBOARD } from "@/constants/testIds";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import { useMaintenance } from "@/lib/maintenance";
import { todayIndo } from "./adminUtils";
import { typeLabel, tanggalSingkat } from "./kegiatanUtils";

function Ringkas({ label, value, Icon, testid }) {
  return (
    <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid={testid}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5F6B63]">
        <Icon size={14} className="text-[#0E4E31]" /> {label}
      </div>
      <div className="mt-1 text-2xl font-bold leading-none text-[#14201A]">{value}</div>
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
  const maintenance = useMaintenance();
  const maintenanceOngoing = maintenance.ongoing;

  useEffect(() => {
    api.get("/admin/dashboard").then(({ data }) => setD(data)).catch(() => setD(false));
  }, [role]);

  if (d === null) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={32} /></div>;
  }
  if (d === false) {
    return <div className="p-10 text-center text-[#5F6B63]">Gagal memuat data dashboard.</div>;
  }

  const hariIni = new Date().toISOString().slice(0, 10);
  const kegiatanHariIni = (d.upcoming || []).filter((k) => k.date === hariIni).length;

  return (
    <div>
      <MaintenanceBanner
        state={maintenance.state}
        startAt={maintenance.startAt}
        endAt={maintenance.endAt}
        onDetail={() => onGoto?.("bantuan")}
      />

      <div className="mb-6">
        <h1 className="font-heading text-[28px] sm:text-[34px] font-bold text-[#0E4E31] leading-tight" data-testid={DASHBOARD.welcome}>
          Selamat datang, {user?.name || "-"}
        </h1>
        <p className="text-[#5F6B63] flex items-center gap-1.5 mt-2"><CalendarDays size={16} /> {todayIndo()}</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3" data-testid={DASHBOARD.totalPeserta}>
        <Ringkas label="Peserta aktif" value={d.total_peserta} Icon={Users} testid="dashboard-peserta-aktif" />
        <Ringkas label="Hadir bulan ini" value={d.hadir_bulan_ini ?? 0} Icon={CheckCircle2} testid="dashboard-hadir-bulan" />
        <Ringkas label="Kegiatan hari ini" value={kegiatanHariIni} Icon={CalendarDays} testid="dashboard-kegiatan-hari" />
      </div>

      <div className="mb-6" data-testid={DASHBOARD.shortcutsContainer}>
        <div className="text-sm font-semibold text-[#14201A] mb-2">Pintasan Cepat</div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            { key: "tambah-peserta", label: "Tambah Peserta", icon: UserPlus, action: onAddPeserta, testId: DASHBOARD.shortcuts.addPeserta, writes: true },
            { key: "tambah-kegiatan", label: "Tambah Kegiatan", icon: CalendarPlus, action: onAddKegiatan, testId: DASHBOARD.shortcuts.addKegiatan, writes: true },
            { key: "rekap-bulanan", label: "Rekap Bulanan", icon: FileBarChart2, action: () => onGoto && onGoto("rekap-bulanan"), testId: DASHBOARD.shortcuts.rekapBulanan, writes: false },
          ].map((s) => {
            const Icon = s.icon;
            const off = s.writes && maintenanceOngoing;
            return (
              <button
                key={s.key}
                data-testid={s.testId}
                onClick={off ? undefined : s.action}
                aria-disabled={off || undefined}
                disabled={off}
                className={`flex min-h-14 items-center gap-3 rounded-xl border border-[#E7E3D8] bg-white px-4 py-3 text-left transition-colors focus-visible:border-[#14633F] ${
                  off ? "cursor-not-allowed opacity-55" : "sm:hover:border-[#14633F] sm:hover:bg-[#F6F4EE]"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E3F3EA] text-[#14633F]"><Icon size={20} /></span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-[#14201A]">{s.label}</span>
                {maintenanceOngoing && (
                  <span className="shrink-0 text-[11px] font-bold text-[#5F6B63]">
                    {s.writes ? "Nonaktif" : "Masih bisa dibaca"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section className="rounded-2xl border border-[#E7E3D8] bg-white p-5 sm:p-6" data-testid={DASHBOARD.activitiesSection}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading font-bold text-[#14201A]">Kegiatan terdekat</h2>
          <button onClick={() => onGoto && onGoto("kegiatan")} className="text-sm font-semibold text-[#0E4E31] hover:underline inline-flex items-center gap-1">
            <CalendarPlus size={15} /> Kelola
          </button>
        </div>
        {(!d.upcoming || d.upcoming.length === 0) ? (
          <div className="rounded-xl border border-dashed border-[#D9D4C5] bg-[#F6F4EE] p-6 text-center text-sm text-[#5F6B63]">
            Belum ada kegiatan mendatang.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left" data-testid={DASHBOARD.kegiatanTable}>
              <thead>
                <tr className="border-b border-[#E7E3D8] text-xs font-semibold text-[#5F6B63]">
                  <th scope="col" className="px-3 py-3">Nama Kegiatan</th>
                  <th scope="col" className="px-3 py-3">Jenis</th>
                  <th scope="col" className="px-3 py-3">Tanggal & Waktu</th>
                  <th scope="col" className="px-3 py-3 text-right">Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7E3D8]">
                {d.upcoming.map((k) => (
                  <tr key={k.id} className="hover:bg-[#F6F4EE]">
                    <td className="px-3 py-3 font-semibold text-[#14201A]">
                      <button
                        type="button"
                        data-testid={`${DASHBOARD.kegiatanRowPrefix}-${k.id}`}
                        onClick={() => onOpenKegiatan?.(k.id)}
                        className="text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#14633F]"
                      >
                        {k.name}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-sm text-[#5F6B63]">{typeLabel(k.type)}</td>
                    <td className="px-3 py-3 text-sm text-[#5F6B63]">
                      {tanggalSingkat(k.date)} · {k.start_time}–{k.end_time}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-semibold text-[#14201A]">
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
