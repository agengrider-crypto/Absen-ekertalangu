import { useEffect, useState } from "react";
import {
  Users, UserCheck, UserX, CalendarDays, TrendingUp, Loader2, QrCode, Copy, CalendarPlus,
  Megaphone, UserCog, FileBarChart2, Download, X, ScanLine, ClipboardList,
  MonitorSmartphone, LogIn, ChevronRight, AlertTriangle,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { todayIndo } from "./adminUtils";
import { MONTH_SHORT, TYPE_LABEL, tanggalSingkat, hhmm } from "./kegiatanUtils";
import { fmtLoginTime, relTime, DeviceIcon } from "./PantauLoginView";

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

export default function DashboardView({ user, onGoto, role = "admin" }) {
  const [d, setD] = useState(null);
  const [qr, setQr] = useState(null);
  const [actQr, setActQr] = useState(null);
  const [showActQr, setShowActQr] = useState(false);
  const [lengkap, setLengkap] = useState(null); // FASE 10 — kelengkapan data jamaah
  const [loginMon, setLoginMon] = useState(null); // FASE 11 — pantau login

  useEffect(() => {
    api.get("/admin/dashboard").then(({ data }) => setD(data)).catch(() => setD(false));
    api.get("/qr/public").then(({ data }) => setQr(data)).catch(() => {});
    api.get("/admin/users/kelengkapan").then(({ data }) => setLengkap(data)).catch(() => {});
    // FASE 12 — Pantau Login hanya untuk ADMIN
    if (role !== "admin") { setLoginMon(false); return undefined; }
    const loadLogin = () => api.get("/staff/login-monitor?limit=8").then(({ data }) => setLoginMon(data)).catch(() => setLoginMon(false));
    loadLogin();
    const iv = setInterval(loadLogin, 60000);
    return () => clearInterval(iv);
  }, [role]);

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

      {/* FASE 10 — Peringatan kelengkapan data (tgl lahir & status pernikahan) */}
      {lengkap && lengkap.belum_lengkap > 0 && (
        <button
          type="button"
          data-testid="dashboard-kelengkapan"
          onClick={() => onGoto && onGoto("peserta")}
          className="w-full text-left mb-6 rounded-2xl border-2 border-[#F5D0E3] bg-[#FDF2F8] p-4 flex items-center gap-3 hover:border-[#9D174D] transition-colors"
        >
          <span className="h-11 w-11 rounded-xl bg-[#9D174D] text-white flex items-center justify-center shrink-0"><ClipboardList size={20} /></span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-[#831843]">
              {lengkap.belum_lengkap} dari {lengkap.total_peserta} jamaah datanya belum lengkap
            </span>
            <span className="block text-xs text-[#9D174D] mt-0.5">
              Tanggal lahir kosong: <b>{lengkap.missing_dob}</b> · Status pernikahan kosong: <b>{lengkap.missing_marital}</b>
              {" "}— diperlukan untuk kegiatan khusus usia / status pernikahan.
            </span>
          </span>
          <span className="text-xs font-semibold text-[#9D174D] shrink-0 hidden sm:block">Lihat daftar →</span>
        </button>
      )}

      {/* FASE 11 — Pantau Login ringkas (khusus admin) */}
      {role === "admin" && loginMon && (
        <div className="mb-6 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden" data-testid="dashboard-pantau-login">
          <div className="px-5 py-3.5 flex items-center justify-between gap-3 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2 font-bold text-[#0D5C3A]"><MonitorSmartphone size={18} /> Pantau Login</div>
            <button data-testid="dashboard-pantau-login-open" onClick={() => onGoto && onGoto("pantau-login")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[#0D5C3A] hover:underline">Lihat semua <ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-3 divide-x divide-[#E5E7EB] border-b border-[#E5E7EB]">
            <div className="p-3 text-center"><div className="text-xl font-bold text-[#111827]">{loginMon.summary.today_logins}</div><div className="text-[11px] text-[#6B7280]">Login hari ini · {loginMon.summary.today_users} akun</div></div>
            <div className="p-3 text-center"><div className="text-xl font-bold text-[#0D5C3A]">{loginMon.summary.sudah_login}<span className="text-xs text-[#6B7280] font-semibold">/{loginMon.summary.total_peserta}</span></div><div className="text-[11px] text-[#6B7280]">Peserta pernah login</div></div>
            <button type="button" onClick={() => onGoto && onGoto("pantau-login")} className="p-3 text-center hover:bg-[#FFFBEB]" data-testid="dashboard-belum-login">
              <div className="text-xl font-bold text-[#B45309] inline-flex items-center gap-1"><UserX size={16} /> {loginMon.summary.belum_login}</div>
              <div className="text-[11px] text-[#6B7280]">Belum pernah login</div>
            </button>
          </div>
          {loginMon.events.length === 0 ? (
            <div className="p-5 text-center text-sm text-[#6B7280]">Belum ada login tercatat.</div>
          ) : (
            <div className="divide-y divide-[#F1F2F0]" data-testid="dashboard-login-recent">
              {loginMon.events.slice(0, 6).map((e) => (
                <div key={e.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="h-8 w-8 rounded-lg bg-[#E8F5EE] text-[#0D5C3A] flex items-center justify-center shrink-0"><LogIn size={15} /></span>
                    <div className="min-w-0">
                      <div className="font-semibold text-[#111827] truncate flex items-center gap-1.5">
                        {e.name}
                        {e.is_new_device && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]"><AlertTriangle size={10} /> baru</span>}
                      </div>
                      <div className="text-[11px] text-[#9CA3AF] inline-flex items-center gap-1"><DeviceIcon kind={e.device?.kind} size={11} /> {e.device?.label || "-"}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-[12px] text-[#4B5563]">{fmtLoginTime(e.at)}</div>
                    <div className="text-[10px] text-[#9CA3AF]">{relTime(e.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shortcut cepat */}
      <div className="mb-6" data-testid="dashboard-shortcuts">
        <div className="text-sm font-semibold text-[#374151] mb-2">Pintasan Cepat</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {[
            { key: "peserta", label: "Peserta", icon: Users, action: () => onGoto && onGoto("peserta") },
            { key: "kegiatan", label: "Kegiatan", icon: CalendarPlus, action: () => onGoto && onGoto("kegiatan") },
            { key: "pengumuman", label: "Pengumuman", icon: Megaphone, action: () => onGoto && onGoto("pengumuman") },
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
