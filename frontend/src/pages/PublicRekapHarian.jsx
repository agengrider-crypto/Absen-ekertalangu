// Laporan Harian publik (tanpa login). Satu orang dihitung sekali per hari.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Info, Search, CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import ReportHeader from "@/components/ReportHeader";

const STATUS_CHIP = {
  hadir: { t: "Hadir", cls: "bg-[#E3F3EA] text-[#0E4E31]" },
  izin: { t: "Izin", cls: "bg-[#FBF1D6] text-[#6B4500]" },
  sakit: { t: "Sakit", cls: "bg-[#E3EEFB] text-[#1D4F91]" },
  alpha: { t: "Alpha", cls: "bg-[#FBE5E3] text-[#A32A2A]" },
  belum_diabsen: { t: "Belum diabsen", cls: "bg-[#F0EEE6] text-[#5F6B63]" },
};
const NETRAL = { t: "Belum diabsen", cls: "bg-[#F0EEE6] text-[#5F6B63]" };
const chipOf = (s) => STATUS_CHIP[s] || NETRAL;

const KARTU = [
  { key: "hadir", label: "Hadir", bg: "#E3F3EA", fg: "#0E4E31" },
  { key: "izin", label: "Izin", bg: "#FBF1D6", fg: "#6B4500" },
  { key: "sakit", label: "Sakit", bg: "#E3EEFB", fg: "#1D4F91" },
  { key: "alpha", label: "Alpha", bg: "#FBE5E3", fg: "#A32A2A" },
];

export default function PublicRekapHarian() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get(`/rekap-harian/${token}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setErr("Tautan tidak berlaku."));
  }, [token]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.rows || []).filter((r) => !s || (r.name || "").toLowerCase().includes(s));
  }, [data, q]);

  if (err) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-8 text-center max-w-md">
          <Info size={28} className="mx-auto text-[#A32A2A] mb-2" />
          <p className="font-semibold text-[#A32A2A]">{err}</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={30} /></div>;
  }

  const s = data.summary || {};
  const persen = s.peserta ? Math.round((s.hadir / s.peserta) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F6F4EE] pb-16">
      <ReportHeader
        title="Laporan harian"
        subtitle={data.label || data.date}
        icon={CalendarDays}
        testid="pub-harian-report-header"
      />

      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {data.total_sesi === 0 ? (
          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-10 text-center text-[#5F6B63]">
            Tidak ada kegiatan pada tanggal ini.
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
              <div className="text-sm font-bold text-[#14201A]">Gabungan hari ini</div>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-[#14633F] text-base font-bold tabular-nums text-[#0E4E31]">
                  {persen}%
                </div>
                <div className="min-w-0">
                  <div className="font-heading text-base font-bold text-[#14201A]">
                    {s.hadir || 0} dari {s.peserta || 0} orang hadir
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#5F6B63]">Satu orang dihitung sekali.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {KARTU.map((k) => (
                  <div key={k.key} className="rounded-xl p-3" style={{ backgroundColor: k.bg }}>
                    <div className="text-[11px] font-semibold" style={{ color: k.fg }}>{k.label}</div>
                    <div className="mt-0.5 text-xl font-bold tabular-nums" style={{ color: k.fg }}>{s[k.key] || 0}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-[#5F6B63]">
                Alpha dihitung setelah semua kegiatan hari ini selesai.
              </p>
            </section>

            <section className="rounded-2xl border border-[#E7E3D8] bg-white p-5 space-y-3">
              <div className="text-sm font-bold text-[#14201A]">Kegiatan hari ini</div>
              {(data.sesi || []).map((x) => (
                <div key={x.id} className="rounded-xl border border-[#F0EEE6] p-3.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-[#14201A]">
                      {x.label} · {x.start_time}–{x.end_time} WITA
                    </span>
                    {x.berlangsung === false && (
                      <span className="rounded-full bg-[#F0EEE6] px-2.5 py-0.5 text-[11px] font-semibold text-[#5F6B63]">
                        Belum dimulai
                      </span>
                    )}
                  </div>
                  {x.berlangsung !== false && (
                    <>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#5F6B63]">
                        <span>Hadir <b className="text-[#0E4E31]">{x.hadir}</b></span>
                        <span>Izin <b className="text-[#6B4500]">{x.izin}</b></span>
                        <span>Sakit <b className="text-[#1D4F91]">{x.sakit}</b></span>
                      </div>
                      {x.sebelumnya_hadir > 0 && (
                        <p className="mt-1 text-[11px] text-[#5F6B63]">
                          dari {x.peserta} yang belum hadir sebelumnya
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </section>

            <section className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
                <input value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama peserta…"
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F]" />
              </div>
              <div className="divide-y divide-[#E7E3D8]">
                {rows.length === 0 ? (
                  <div className="p-8 text-center text-[#5F6B63]">Nama tidak ditemukan.</div>
                ) : rows.map((r) => {
                  const chip = chipOf(r.status_hari);
                  return (
                    <div key={r.user_id} className="flex items-center gap-2 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#14201A]">{r.name}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${chip.cls}`}>
                        {chip.t}{r.status_hari === "hadir" && r.hadir_di ? ` · ${r.hadir_di}` : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        <p className="text-center text-[11px] text-[#5F6B63]">
          Tautan ini dibagikan oleh pengurus E-KERTALANGU · Absensi Pengajian
        </p>
      </main>
    </div>
  );
}
