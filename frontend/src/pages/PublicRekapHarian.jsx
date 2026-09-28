// FASE 17 — Halaman publik Rekap Harian (tanpa login): rincian sesi + keterangan tiap peserta.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CalendarCheck, Loader2, Users, Layers, Clock, User, MapPin, Info, ChevronDown, Search,
} from "lucide-react";
import { api } from "@/lib/api";
import { PercentBar } from "@/pages/PublicRekapGabungan";
import { REKAP, PersenRingkas, keteranganHitungan, ratioColor } from "@/pages/admin/rekapUtils";

const STATUS_CHIP = {
  hadir: { t: "Hadir", cls: "bg-[#DCFCE7] text-[#166534]" },
  izin: { t: "Izin", cls: "bg-[#FEF3C7] text-[#92400E]" },
  alpha: { t: "Alpha", cls: "bg-[#FEE2E2] text-[#991B1B]" },
};

export default function PublicRekapHarian() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.get(`/rekap-harian/${token}`)
      .then(({ data: d }) => setData(d))
      .catch((e) => setErr(e.response?.data?.detail || "Tautan tidak ditemukan"));
  }, [token]);

  if (err) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-8 text-center max-w-md" data-testid="pub-harian-error">
          <Info size={28} className="mx-auto text-[#DC2626] mb-2" />
          <p className="font-semibold text-[#111114]">{err}</p>
          <p className="text-sm text-[#6B7280] mt-1">Silakan minta tautan terbaru kepada pengurus.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#0F766E]" size={30} />
      </div>
    );
  }

  const s = data.summary;
  const rows = (data.rows || []).filter((r) =>
    !q.trim() || (r.name || "").toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-16">
      <header className="bg-white border-b border-[#E8E8E4]">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#F1F1EE] flex items-center justify-center overflow-hidden p-1">
            <img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-heading font-bold text-[#111114]">E-KERTALANGU</div>
            <div className="text-xs text-[#9CA3AF]">Rekap Absen Harian</div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="rounded-2xl border-2 border-[#CCFBF1] bg-[#F0FDFA] p-4" data-testid="pub-harian-header">
          <div className="font-heading text-xl font-bold text-[#115E59] inline-flex items-center gap-2">
            <CalendarCheck size={20} /> {data.label || data.date}
          </div>
          <div className="text-sm text-[#0F766E] mt-1">
            {(data.kegiatan || []).join(" · ") || "-"} — {data.total_sesi} sesi
          </div>
        </div>

        {data.total_sesi === 0 ? (
          <div className="rounded-2xl border border-[#E8E8E4] bg-white p-10 text-center text-[#6B7280]" data-testid="pub-harian-empty">
            Tidak ada kegiatan pada tanggal ini.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { k: "peserta", label: "Peserta", value: s.peserta, sub: `${s.slot} slot sesi`, color: REKAP.main, icon: Users },
                { k: "hadir", label: "Hadir", value: s.hadir, sub: `${s.hadir_hari} orang hadir`, color: REKAP.hadir, icon: CalendarCheck },
                { k: "izin", label: "Izin", value: s.izin, sub: `${s.izin_hari} orang berizin`, color: REKAP.izin, icon: Info },
                { k: "alpha", label: "Alpha", value: s.alpha, sub: `${s.alpha_hari} tanpa keterangan`, color: REKAP.alpha, icon: Info },
              ].map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.k} className="rounded-2xl border border-[#E8E8E4] bg-white p-4" data-testid={`pub-harian-stat-${c.k}`}>
                    <div className="text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: c.color }}>
                      <Icon size={14} /> {c.label}
                    </div>
                    <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: c.color }}>{c.value}</div>
                    <div className="text-[11px] text-[#9CA3AF] mt-0.5">{c.sub}</div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5 space-y-4" data-testid="pub-harian-sesi">
              <div className="text-sm font-semibold text-[#111114] inline-flex items-center gap-2">
                <Layers size={16} style={{ color: REKAP.main }} /> Kehadiran Tiap Sesi
              </div>
              {data.sesi.map((x) => (
                <div key={x.id} className="rounded-xl border border-[#EEF1EE] p-3.5">
                  <PercentBar
                    label={`${x.label}${x.required ? "" : " · opsional"} — ${x.start_time}–${x.end_time} WITA`}
                    value={x.ratio} sub={`${x.hadir}/${x.peserta}`} color={ratioColor(x.ratio)}
                    testid={`pub-bar-harian-${x.label}`} />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-[#6B7280]">
                    {x.teacher && <span className="inline-flex items-center gap-1"><User size={12} /> {x.teacher}</span>}
                    {x.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {x.location}</span>}
                    {x.material && <span className="inline-flex items-center gap-1"><Clock size={12} /> {x.material}</span>}
                  </div>
                  <div className="mt-2 text-[11px] font-semibold text-[#4B5563]">
                    {keteranganHitungan({ hadir: x.hadir, izin: x.izin, alpha: x.alpha, total: x.peserta, satuan: "peserta" })}
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5 space-y-4" data-testid="pub-harian-gender">
              <div className="text-sm font-semibold text-[#111114] inline-flex items-center gap-2">
                <Users size={16} style={{ color: REKAP.main }} /> Pisah Laki-laki &amp; Perempuan
              </div>
              <PercentBar label={`Laki-laki (${data.gender?.L?.peserta || 0} peserta)`} value={data.gender?.L?.ratio || 0}
                sub={`${data.gender?.L?.hadir || 0}/${data.gender?.L?.slot || 0}`} color={REKAP.lk} testid="pub-bar-harian-l" />
              <PercentBar label={`Perempuan (${data.gender?.P?.peserta || 0} peserta)`} value={data.gender?.P?.ratio || 0}
                sub={`${data.gender?.P?.hadir || 0}/${data.gender?.P?.slot || 0}`} color={REKAP.pr} testid="pub-bar-harian-p" />
            </div>

            <div className="rounded-2xl border border-[#E8E8E4] bg-white p-5">
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input data-testid="pub-harian-search" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama peserta…"
                  className="w-full h-11 pl-9 pr-3 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#0F766E]" />
              </div>
              <div className="divide-y divide-[#ECECE8]" data-testid="pub-harian-rows">
                {rows.length === 0 ? (
                  <div className="p-8 text-center text-[#6B7280]">Nama tidak ditemukan.</div>
                ) : rows.map((r) => {
                  const chip = STATUS_CHIP[r.status_hari];
                  const expanded = open === r.user_id;
                  return (
                    <div key={r.user_id} className="py-3" data-testid={`pub-harian-row-${r.user_id}`}>
                      <button type="button" onClick={() => setOpen(expanded ? null : r.user_id)}
                        className="w-full text-left flex items-center gap-3 justify-between">
                        <span className="min-w-0">
                          <span className="font-semibold text-[#111114] flex items-center gap-1.5 flex-wrap">
                            {r.name}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${chip.cls}`}>{chip.t}</span>
                          </span>
                          <span className="block text-[11px] text-[#9CA3AF]">
                            {r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : "—"}
                            {r.kelompok_name ? ` · ${r.kelompok_name}` : ""}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          <PersenRingkas value={r.ratio} sub={`${r.hadir}/${r.sesi_total}`} testid={`pub-harian-persen-${r.user_id}`} />
                          <ChevronDown size={16} className={`text-[#9CA3AF] transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </span>
                      </button>
                      <div className="mt-1.5 text-[11px] font-semibold text-[#4B5563]">
                        {keteranganHitungan({ hadir: r.hadir, izin: r.izin, alpha: r.alpha, total: r.sesi_total, satuan: "sesi" })}
                      </div>
                      {expanded && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {r.detail.map((x, i) => {
                            const c = STATUS_CHIP[x.status];
                            return (
                              <span key={i} className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${c.cls}`}>
                                {x.label} {x.start_time}–{x.end_time}{x.required ? "" : " (opsional)"} · {c.t}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border-2 border-dashed border-[#E8E8E4] bg-white p-4 text-xs text-[#4B5563] space-y-1.5" data-testid="pub-harian-legend">
              <div className="font-bold text-[#111114] inline-flex items-center gap-1.5"><Info size={14} /> Keterangan hitungan</div>
              <p>Persen kehadiran = jumlah <b>Hadir</b> ÷ jumlah sesi yang wajib diikuti × 100.</p>
              <p>Hadir + Izin + Alpha selalu sama dengan jumlah sesi peserta tersebut, sehingga persennya berjumlah <b>100%</b>.</p>
              <p>Warna persen: <span className="font-bold text-[#166534]">hijau ≥80%</span>, <span className="font-bold text-[#92400E]">kuning 50–79%</span>, <span className="font-bold text-[#991B1B]">merah &lt;50%</span>.</p>
            </div>
          </>
        )}

        <p className="text-center text-[11px] text-[#9CA3AF]">
          Tautan ini dibagikan oleh pengurus E-KERTALANGU · Absensi Pengajian
        </p>
      </main>
    </div>
  );
}
