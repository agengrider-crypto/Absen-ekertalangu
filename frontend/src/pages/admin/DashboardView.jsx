import { useEffect, useState } from "react";
import {
  Users, UserCheck, UserX, CalendarDays, TrendingUp, Loader2, QrCode, Copy, CalendarPlus,
  Megaphone, UserCog, FileBarChart2, Download, X, ScanLine,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { todayIndo } from "./adminUtils";
import { MONTH_SHORT, TYPE_LABEL, tanggalSingkat, hhmm } from "./kegiatanUtils";

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB]" data-testid={`stat-${label}`}>
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1a`, color }}>
          <Icon size={22} />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-[#111827] leading-none">{value}</div>
          <div className="text-sm text-[#6B7280] mt-1 truncate">{label}</div>
        </div>
      </div>
      {sub && <div className="mt-3 text-sm text-[#6B7280]">{sub}</div>}
    </div>
  );
}

export default function DashboardView({ user, onGoto }) {
  const [d, setD] = useState(null);
  const [qr, setQr] = useState(null);
  const [actQr, setActQr] = useState(null);
  const [showActQr, setShowActQr] = useState(false);

  useEffect(() => {
    api.get("/admin/dashboard").then(({ data }) => setD(data)).catch(() => setD(false));
    api.get("/qr/public").then(({ data }) => setQr(data)).catch(() => {});
  }, []);

  const openActQr = () => {
    setShowActQr(true);
    if (!actQr) api.get("/staff/activation-qr").then(({ data }) => setActQr(data)).catch(() => {});
  };

  const downloadActQr = () => {
    if (!actQr?.image) return;
    const a = document.createElement("a");
    a.href = actQr.image;
    a.download = "qr-aktivasi-akun.png";
    document.body.appendChild(a); a.click(); a.remove();
  };

  const copyActLink = () => {
    if (actQr?.url) { navigator.clipboard.writeText(actQr.url); toast.success("Link aktivasi disalin"); }
  };

  if (d === null) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={32} /></div>;
  }
  if (d === false) {
    return <div className="p-10 text-center text-[#6B7280]">Gagal memuat data dashboard.</div>;
  }

  const pieData = [
    { name: "Laki-laki", value: d.peserta_L, color: "#0D5C3A" },
    { name: "Perempuan", value: d.peserta_P, color: "#D97706" },
    { name: "Belum diisi", value: Math.max(d.total_peserta - d.peserta_L - d.peserta_P, 0), color: "#CBD5E1" },
  ].filter((x) => x.value > 0);

  const trend = (d.tren || []).map((t) => {
    const m = parseInt(t.month.slice(5, 7), 10);
    return { name: MONTH_SHORT[m - 1] || t.month, ratio: t.ratio, kegiatan: t.kegiatan };
  });

  const copyLink = () => {
    if (qr?.link) {
      navigator.clipboard.writeText(qr.link);
      toast.success("Link pendaftaran disalin");
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-[#111827]">
          Selamat Datang, {user?.name?.split(" ")[0] || "Admin"}
        </h1>
        <p className="text-[#6B7280] flex items-center gap-1.5 mt-1"><CalendarDays size={16} /> {todayIndo()}</p>
      </div>

      {/* Shortcut cepat */}
      <div className="mb-6" data-testid="dashboard-shortcuts">
        <div className="text-sm font-semibold text-[#374151] mb-2">Pintasan Cepat</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { key: "peserta", label: "Peserta", icon: Users, action: () => onGoto && onGoto("peserta") },
            { key: "kegiatan", label: "Kegiatan", icon: CalendarPlus, action: () => onGoto && onGoto("kegiatan") },
            { key: "pengumuman", label: "Pengumuman", icon: Megaphone, action: () => onGoto && onGoto("pengumuman") },
            { key: "penjaga", label: "Penjaga Absen", icon: UserCog, action: () => onGoto && onGoto("penjaga") },
            { key: "laporan", label: "Laporan", icon: FileBarChart2, action: () => onGoto && onGoto("laporan") },
            { key: "qr-aktivasi", label: "QR Aktivasi", icon: ScanLine, action: openActQr },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                data-testid={`shortcut-${s.key}`}
                onClick={s.action}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-3 flex flex-col items-center justify-center gap-2 hover:border-[#0D5C3A] hover:bg-[#F0FAF4] transition-colors"
              >
                <span className="h-11 w-11 rounded-xl bg-[#E8F5EE] text-[#0D5C3A] flex items-center justify-center"><Icon size={22} /></span>
                <span className="text-xs font-semibold text-[#374151] text-center leading-tight">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard icon={Users} label="Total Peserta" value={d.total_peserta} color="#0D5C3A"
          sub={`${d.peserta_L} Laki-laki · ${d.peserta_P} Perempuan`} />
        <StatCard icon={CalendarDays} label="Kegiatan Bulan Ini" value={d.kegiatan_bulan_ini} color="#0284C7" />
        <StatCard icon={UserCheck} label="Akun Aktif" value={d.akun_aktif} color="#059669"
          sub={`${d.akun_nonaktif} nonaktif/menunggu`} />
        <StatCard icon={TrendingUp} label="Rasio Kehadiran (bln ini)" value={`${d.rasio_kehadiran_bulan}%`} color="#D97706" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB]" data-testid="chart-gender">
          <h2 className="font-heading font-bold text-[#111827] mb-2">Komposisi Jenis Kelamin</h2>
          {pieData.length === 0 ? (
            <p className="text-[#6B7280] py-10 text-center">Belum ada data peserta.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={92}
                    paddingAngle={3}
                    label={({ value }) => `${value}`}
                    labelLine={false}
                  >
                    {pieData.map((x) => <Cell key={x.name} fill={x.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} orang`, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2" data-testid="gender-legend">
                {pieData.map((x) => {
                  const pct = d.total_peserta ? Math.round((x.value / d.total_peserta) * 100) : 0;
                  return (
                    <div key={x.name} className="flex items-center gap-2 rounded-lg bg-[#F8FAF8] px-3 py-2">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: x.color }} />
                      <span className="text-sm text-[#4B5563] min-w-0 truncate">{x.name}</span>
                      <span className="ml-auto text-sm font-bold text-[#111827]">{x.value}</span>
                      <span className="text-xs text-[#9CA3AF]">({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB]" data-testid="chart-trend">
          <h2 className="font-heading font-bold text-[#111827] mb-2">Tren Kehadiran (6 bulan)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trend} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2EE" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6B7280" }} />
              <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} domain={[0, 100]} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="ratio" fill="#0D5C3A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#E5E7EB]" data-testid="upcoming-activities">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-bold text-[#111827]">Kegiatan Mendatang</h2>
            <button onClick={() => onGoto && onGoto("kegiatan")} className="text-sm font-semibold text-[#0D5C3A] hover:underline inline-flex items-center gap-1">
              <CalendarPlus size={15} /> Kelola
            </button>
          </div>
          {(!d.upcoming || d.upcoming.length === 0) ? (
            <div className="rounded-xl bg-[#F8FAF8] border border-dashed border-[#CBD5E1] p-6 text-center text-[#6B7280] text-sm">
              Belum ada kegiatan mendatang. Tambahkan lewat menu Kegiatan.
            </div>
          ) : (
            <ul className="divide-y divide-[#E5E7EB]">
              {d.upcoming.map((k) => (
                <li key={k.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#111827] truncate">{k.name}</div>
                    <div className="text-xs text-[#6B7280]">
                      {TYPE_LABEL[k.type]} · {tanggalSingkat(k.date)} · {k.start_time}–{k.end_time} WITA
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#065F46]">
                    {k.counts?.hadir ?? 0}/{k.counts?.total ?? 0} hadir
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] text-center" data-testid="dashboard-qr">
          <div className="inline-flex items-center gap-2 text-[#065F46] font-semibold mb-3">
            <QrCode size={18} /> QR Pendaftaran
          </div>
          {qr ? (
            <img src={qr.image} alt="QR Publik" className="mx-auto w-36 h-36 rounded-xl border border-[#E5E7EB] p-2" />
          ) : (
            <div className="mx-auto w-36 h-36 rounded-xl bg-[#F2F5F2] flex items-center justify-center">
              <Loader2 className="animate-spin text-[#0D5C3A]" size={24} />
            </div>
          )}
          <p className="text-xs text-[#6B7280] mt-2">Bagikan untuk pendaftaran mandiri jamaah.</p>
          <button onClick={copyLink} className="mt-3 w-full h-10 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#E8F5EE]">
            <Copy size={15} /> Salin Link
          </button>
        </div>
      </div>

      {showActQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="modal-activation-qr">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowActQr(false)} />
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl">
            <div className="px-5 py-4 flex items-center justify-between border-b border-[#E5E7EB]">
              <h3 className="font-heading font-bold text-[#111827] flex items-center gap-2"><ScanLine size={18} className="text-[#0D5C3A]" /> QR Aktivasi Akun</h3>
              <button onClick={() => setShowActQr(false)} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"><X size={20} /></button>
            </div>
            <div className="p-5 text-center">
              {actQr ? (
                <img data-testid="activation-qr-image" src={actQr.image} alt="QR Aktivasi" className="mx-auto w-52 h-52 rounded-xl border border-[#E5E7EB] p-2" />
              ) : (
                <div className="mx-auto w-52 h-52 rounded-xl bg-[#F2F5F2] flex items-center justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={26} /></div>
              )}
              <p className="text-sm text-[#4B5563] mt-3">Peserta cukup <b>scan</b> QR ini, lalu <b>cari nama</b> mereka untuk mengaktifkan akun sendiri.</p>
              <div className="flex gap-2 mt-4">
                <button data-testid="activation-qr-download" onClick={downloadActQr} disabled={!actQr} className="flex-1 h-11 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"><Download size={16} /> Download</button>
                <button data-testid="activation-qr-copy" onClick={copyActLink} disabled={!actQr} className="h-11 px-4 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"><Copy size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
