// FASE 23 — Panel "Rekap & Laporan" kegiatan: rincian kehadiran + grafik beranimasi + bagikan tautan.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, Copy, Send, FileBarChart2, ExternalLink, Users, UserCheck,
  UserMinus, UserX, UserPlus, Layers, AlertTriangle,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

// Warna cerah khusus rekap kegiatan.
const C = { hadir: "#22C55E", izin: "#F59E0B", alpha: "#EF4444", tamu: "#06B6D4", lk: "#3B82F6", pr: "#EC4899" };

function Kartu({ icon: Icon, label, value, sub, color, bg, testid }) {
  return (
    <div data-testid={testid} className="rounded-2xl p-3.5 border-2 transition-transform duration-300 hover:-translate-y-0.5"
      style={{ borderColor: `${color}55`, backgroundColor: bg }}>
      <div className="text-[11px] font-bold uppercase tracking-wide inline-flex items-center gap-1.5" style={{ color }}>
        <Icon size={13} /> {label}
      </div>
      <div className="font-heading font-bold text-2xl lg:text-3xl tabular-nums mt-0.5" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: `${color}cc` }}>{sub}</div>}
    </div>
  );
}

const tipStyle = {
  borderRadius: 12, border: "1px solid #E8E8E4", fontSize: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,.08)",
};

export default function KegiatanRekapPanel({ kegiatanId, counts = {}, gender = {}, rows = [], guests = [] }) {
  const [share, setShare] = useState(null);

  const load = useCallback(() => {
    api.post(`/admin/kegiatan/${kegiatanId}/share`)
      .then(({ data }) => setShare(data))
      .catch((e) => { setShare(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  const total = counts.total ?? 0;
  const hadir = counts.hadir ?? 0;
  const izin = counts.izin ?? 0;
  const alpha = counts.alpha ?? 0;
  const tamu = guests.length;
  const pct = (n) => (total ? Math.round((n / total) * 1000) / 10 : 0);

  // Rincian per jenis kelamin dihitung dari baris absensi (tanpa peserta yang sudah hadir di sesi lain).
  const perGender = useMemo(() => {
    const base = { L: { label: "Laki-laki", total: 0, hadir: 0, izin: 0, alpha: 0, color: C.lk },
      P: { label: "Perempuan", total: 0, hadir: 0, izin: 0, alpha: 0, color: C.pr },
      X: { label: "Belum diisi", total: 0, hadir: 0, izin: 0, alpha: 0, color: "#94A3B8" } };
    rows.filter((r) => !r.attended_other).forEach((r) => {
      const g = r.gender === "L" ? "L" : r.gender === "P" ? "P" : "X";
      base[g].total += 1;
      if (r.status === "hadir") base[g].hadir += 1;
      else if (r.status === "izin") base[g].izin += 1;
      else base[g].alpha += 1;
    });
    return Object.values(base).filter((g) => g.total > 0);
  }, [rows]);

  const pieData = [
    { name: "Hadir", value: hadir, color: C.hadir },
    { name: "Izin", value: izin, color: C.izin },
    { name: "Alpha", value: alpha, color: C.alpha },
  ].filter((x) => x.value > 0);

  const barData = perGender.map((g) => ({
    name: g.label, Hadir: g.hadir, Izin: g.izin, Alpha: g.alpha,
  }));

  const belumAktivasi = rows.filter((r) => r.account_status === "pending").length;
  const sesiLain = counts.sudah_sesi_lain ?? 0;

  const shareWa = () => {
    if (!share?.link) return;
    const text = share.wa_text
      || `Assalamu'alaikum warahmatullahi wabarakatuh\n\nBerikut rekap kehadiran kegiatan\n${share.link}\n\nJazakumullahu khoiro.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-4" data-testid="detail-rekap-panel">
      {/* Ringkasan angka */}
      <div className="bg-white rounded-2xl border border-[#E8E8E4] p-4 lg:p-5">
        <div className="font-bold text-[#111827] inline-flex items-center gap-2">
          <FileBarChart2 size={17} /> Rekap &amp; Laporan Kegiatan
        </div>
        <div className="flex items-end gap-3 mt-2">
          <div className="font-heading font-bold text-4xl lg:text-5xl tabular-nums leading-none"
            style={{ color: C.hadir }} data-testid="rekap-ratio">
            {counts.ratio ?? 0}%
          </div>
          <div className="text-[11px] lg:text-xs text-[#6B7280] pb-1 leading-snug">
            kehadiran kegiatan ini<br />
            dari <b>{total}</b> peserta terdaftar{tamu ? ` (termasuk ${tamu} tamu)` : ""}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3 mt-4">
          <Kartu testid="rekap-kartu-total" icon={Users} label="Total peserta" value={total}
            sub={`${perGender.map((g) => `${g.label.slice(0, 1)} ${g.total}`).join(" · ")}`}
            color="#0F172A" bg="#F8FAFC" />
          <Kartu testid="rekap-kartu-hadir" icon={UserCheck} label="Hadir" value={hadir}
            sub={`${pct(hadir)}% dari total`} color={C.hadir} bg="#F0FDF4" />
          <Kartu testid="rekap-kartu-izin" icon={UserMinus} label="Izin" value={izin}
            sub={`${pct(izin)}% dari total`} color={C.izin} bg="#FFFBEB" />
          <Kartu testid="rekap-kartu-alpha" icon={UserX} label="Alpha" value={alpha}
            sub={`${pct(alpha)}% dari total`} color={C.alpha} bg="#FEF2F2" />
        </div>

        <div className="flex flex-wrap gap-2 mt-3 text-[11px]">
          {tamu > 0 && (
            <span className="px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1"
              style={{ backgroundColor: "#ECFEFF", color: "#0E7490" }} data-testid="rekap-chip-tamu">
              <UserPlus size={12} /> Tamu hadir: {tamu}
            </span>
          )}
          {sesiLain > 0 && (
            <span className="px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1 bg-[#F1F1EE] text-[#111114]"
              data-testid="rekap-chip-sesi-lain">
              <Layers size={12} /> Sudah hadir sesi lain: {sesiLain}
            </span>
          )}
          {belumAktivasi > 0 && (
            <span className="px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1 bg-[#FEF3C7] text-[#92400E]"
              data-testid="rekap-chip-pending">
              <AlertTriangle size={12} /> Belum aktivasi akun: {belumAktivasi}
            </span>
          )}
        </div>
      </div>

      {/* Grafik kehadiran */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-4 lg:p-5" data-testid="rekap-chart-donut">
          <div className="text-sm font-bold text-[#111827]">Bagan Kehadiran</div>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Arahkan / ketuk bagiannya untuk melihat angkanya.</p>
          {pieData.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#9CA3AF]">Belum ada data absensi.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={56} outerRadius={92} paddingAngle={3}
                  animationBegin={120} animationDuration={1100} animationEasing="ease-out"
                  label={({ value }) => `${value}`} labelLine={false}>
                  {pieData.map((x) => <Cell key={x.name} fill={x.color} stroke="#fff" strokeWidth={2} />)}
                </Pie>
                <Tooltip contentStyle={tipStyle}
                  formatter={(v, n) => [`${v} orang (${pct(v)}%)`, n]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-4 lg:p-5" data-testid="rekap-chart-gender">
          <div className="text-sm font-bold text-[#111827]">Kehadiran per Jenis Kelamin</div>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Batang bertumpuk: hadir, izin, dan alpha.</p>
          {barData.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#9CA3AF]">Belum ada peserta pada kegiatan ini.</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F1EE" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6B7280" }} />
                <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} allowDecimals={false} />
                <Tooltip contentStyle={tipStyle} formatter={(v, n) => [`${v} orang`, n]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Hadir" stackId="a" fill={C.hadir} radius={[0, 0, 0, 0]} animationDuration={1000} />
                <Bar dataKey="Izin" stackId="a" fill={C.izin} animationDuration={1000} animationBegin={120} />
                <Bar dataKey="Alpha" stackId="a" fill={C.alpha} radius={[6, 6, 0, 0]} animationDuration={1000} animationBegin={240} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Rincian detail per jenis kelamin */}
      {perGender.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E8E8E4] overflow-hidden" data-testid="rekap-detail-gender">
          <div className="px-4 py-3 border-b border-[#ECECE8] text-sm font-bold text-[#111827]">
            Rincian Detail
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#FAFAF8] text-[#6B7280] text-left">
                <tr>
                  <th className="px-4 py-2 font-semibold">Kelompok</th>
                  <th className="px-3 py-2 font-semibold text-center">Peserta</th>
                  <th className="px-3 py-2 font-semibold text-center">Hadir</th>
                  <th className="px-3 py-2 font-semibold text-center">Izin</th>
                  <th className="px-3 py-2 font-semibold text-center">Alpha</th>
                  <th className="px-3 py-2 font-semibold text-center">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {perGender.map((g) => (
                  <tr key={g.label} data-testid={`rekap-detail-row-${g.label}`}>
                    <td className="px-4 py-2.5 font-semibold text-[#111827] whitespace-nowrap">
                      <span className="inline-block h-2.5 w-2.5 rounded-full mr-2" style={{ backgroundColor: g.color }} />
                      {g.label}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{g.total}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums font-bold" style={{ color: C.hadir }}>{g.hadir}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums" style={{ color: C.izin }}>{g.izin}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums" style={{ color: C.alpha }}>{g.alpha}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums font-bold text-[#111114]">
                      {g.total ? Math.round((g.hadir / g.total) * 1000) / 10 : 0}%
                    </td>
                  </tr>
                ))}
                {tamu > 0 && (
                  <tr data-testid="rekap-detail-row-tamu">
                    <td className="px-4 py-2.5 font-semibold text-[#111827]">
                      <span className="inline-block h-2.5 w-2.5 rounded-full mr-2" style={{ backgroundColor: C.tamu }} />
                      Tamu (tanpa akun)
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">{tamu}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums font-bold" style={{ color: C.hadir }}>{tamu}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">0</td>
                    <td className="px-3 py-2.5 text-center tabular-nums">0</td>
                    <td className="px-3 py-2.5 text-center tabular-nums font-bold text-[#111114]">100%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bagikan tautan laporan */}
      <div className="bg-white rounded-2xl border border-[#E8E8E4] p-4 lg:p-5" data-testid="rekap-share-box">
        <div className="text-sm font-bold text-[#111827]">Bagikan Laporan</div>
        <p className="text-[11px] text-[#6B7280] mt-0.5">
          Penerima tautan langsung melihat rekap kehadiran kegiatan ini tanpa login.
        </p>
        {share === null ? (
          <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={22} /></div>
        ) : share === false ? (
          <p className="text-sm text-[#991B1B] mt-2">Gagal memuat tautan rekap.</p>
        ) : (
          <>
            <a href={share.link} target="_blank" rel="noreferrer" data-testid="detail-rekap-link"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#111114] hover:underline break-all">
              <ExternalLink size={14} className="shrink-0" /> {share.link}
            </a>
            <div className="grid sm:grid-cols-2 gap-2 mt-3">
              <button data-testid="detail-rekap-copy"
                onClick={() => { navigator.clipboard.writeText(share.link); toast.success("Tautan rekap disalin"); }}
                className="h-11 rounded-xl border-2 border-[#111114] text-[#111114] font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#F1F1EE]">
                <Copy size={16} /> Salin Tautan
              </button>
              <button data-testid="detail-rekap-wa" onClick={shareWa}
                className="h-11 rounded-xl bg-[#25D366] text-white font-semibold inline-flex items-center justify-center gap-2 hover:brightness-95">
                <Send size={16} /> Bagikan lewat WhatsApp
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
