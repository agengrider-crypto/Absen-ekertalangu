// Rekap Harian admin: satu orang dihitung sekali per hari. Angka identik dengan publik.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarCheck, Calendar1, CalendarX2, Loader2, Search, ChevronLeft, ChevronRight, Info,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { SkeletonList } from "@/components/GlobalLoading";
import { tanggalPanjang } from "./kegiatanUtils";
import ShareRekapDialog from "./ShareRekapDialog";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDay(ymd, delta) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

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

export default function RekapHarianView({ initialDate = null }) {
  const [date, setDate] = useState(() => initialDate || todayYmd());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("semua");
  const [shareOpen, setShareOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/staff/rekap-harian?date=${date}`)
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error("Gagal memuat rekap harian"))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    let list = data?.rows || [];
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((r) => (r.name || "").toLowerCase().includes(s));
    if (filter !== "semua") list = list.filter((r) => r.status_hari === filter);
    return list;
  }, [data, q, filter]);

  const sum = data?.summary || {};
  const persen = sum.peserta ? Math.round((sum.hadir / sum.peserta) * 100) : 0;

  return (
    <div className="space-y-5" data-testid="rekap-harian-view">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#14201A] inline-flex items-center gap-2">
            <Calendar1 size={22} className="text-[#14633F]" /> Rekap Harian
          </h1>
          <p className="text-sm text-[#5F6B63] mt-0.5">Kehadiran seluruh kegiatan pada satu tanggal.</p>
        </div>
        <div className="flex items-center gap-2">
          <button data-testid="harian-prev" onClick={() => setDate(shiftDay(date, -1))}
            className="h-11 w-11 rounded-xl border-2 border-[#E7E3D8] flex items-center justify-center text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]"><ChevronLeft size={18} /></button>
          <input data-testid="harian-date" type="date" value={date}
            onChange={(e) => setDate(e.target.value || todayYmd())}
            className="h-11 px-3 rounded-xl border border-[#8A948D] text-sm font-semibold outline-none focus:border-[#14633F] bg-white" />
          <button data-testid="harian-next" onClick={() => setDate(shiftDay(date, 1))}
            className="h-11 w-11 rounded-xl border-2 border-[#E7E3D8] flex items-center justify-center text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]"><ChevronRight size={18} /></button>
          <button type="button" onClick={() => setShareOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#14633F] px-3 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA]">
            Bagikan rekap
          </button>
        </div>
      </div>
      <div className="text-sm font-semibold text-[#14201A]" data-testid="harian-tanggal-panjang">
        {tanggalPanjang(date)}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
          <div className="text-sm text-[#5F6B63] mb-3 inline-flex items-center gap-2">
            <Loader2 size={15} className="animate-spin text-[#0E4E31]" /> Memuat rekap harian…
          </div>
          <SkeletonList rows={6} testid="rekap-harian-skeleton" />
        </div>
      ) : !data ? null : data.total_sesi === 0 ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-8 text-center" data-testid="rekap-harian-empty">
          <CalendarX2 size={30} className="mx-auto text-[#5F6B63]" />
          <div className="mt-2 font-heading text-base font-bold text-[#14201A]">Tidak ada kegiatan pada tanggal ini</div>
          {data.terdekat ? (
            <>
              <p className="mx-auto mt-1 max-w-md text-sm text-[#5F6B63]">Pilih tanggal lain, atau langsung ke kegiatan terdekat.</p>
              <button type="button" onClick={() => setDate(data.terdekat)} data-testid="harian-ke-terdekat"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]">
                <CalendarCheck size={16} /> Ke kegiatan terdekat
              </button>
            </>
          ) : (
            <p className="mx-auto mt-1 max-w-md text-sm text-[#5F6B63]">Belum ada kegiatan tercatat.</p>
          )}
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-[#E7E3D8] bg-white p-5" data-testid="rekap-harian-header">
            <div className="text-sm font-bold text-[#14201A]">Gabungan hari ini</div>
            <div className="mt-3 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-[#14633F] text-base font-bold tabular-nums text-[#0E4E31]">
                {persen}%
              </div>
              <div className="min-w-0">
                <div className="font-heading text-base font-bold text-[#14201A]">
                  {sum.hadir || 0} dari {sum.peserta || 0} orang hadir
                </div>
                <p className="mt-0.5 text-[11px] text-[#5F6B63]">Satu orang dihitung sekali.</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {KARTU.map((k) => (
                <div key={k.key} className="rounded-xl p-3" style={{ backgroundColor: k.bg }} data-testid={`harian-stat-${k.key}`}>
                  <div className="text-[11px] font-semibold" style={{ color: k.fg }}>{k.label}</div>
                  <div className="mt-0.5 text-xl font-bold tabular-nums" style={{ color: k.fg }}>{sum[k.key] || 0}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-[#5F6B63]">Alpha dihitung setelah semua kegiatan hari ini selesai.</p>
          </section>

          <section className="rounded-2xl border border-[#E7E3D8] bg-white p-5 space-y-3" data-testid="rekap-harian-sesi">
            <div className="text-sm font-bold text-[#14201A]">Kegiatan hari ini</div>
            {(data.sesi || []).map((x) => (
              <div key={x.id} className="rounded-xl border border-[#F0EEE6] p-3.5" data-testid={`harian-sesi-${x.label}`}>
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
            <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
                <input data-testid="harian-search" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama peserta…"
                  className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F]" />
              </div>
              <div className="flex items-center gap-1 bg-[#F0EEE6] rounded-xl p-1">
                {[["semua", "Semua"], ["hadir", "Hadir"], ["izin", "Izin"], ["sakit", "Sakit"], ["alpha", "Alpha"]].map(([v, l]) => (
                  <button key={v} data-testid={`harian-filter-${v}`} onClick={() => setFilter(v)}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold ${filter === v ? "bg-white text-[#0E4E31]" : "text-[#5F6B63]"}`}>{l}</button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-[#E7E3D8]" data-testid="rekap-harian-rows">
              {rows.length === 0 ? (
                <div className="p-10 text-center text-[#5F6B63]">Tidak ada peserta pada filter ini.</div>
              ) : rows.map((r) => {
                const chip = chipOf(r.status_hari);
                return (
                  <div key={r.user_id} data-testid={`harian-row-${r.user_id}`} className="flex items-center gap-2 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#14201A]">{r.name}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${chip.cls}`}>
                      {chip.t}{r.status_hari === "hadir" && r.hadir_di ? ` · ${r.hadir_di}` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="rounded-2xl border-2 border-dashed border-[#E7E3D8] bg-white p-4 text-xs text-[#5F6B63] space-y-1.5">
            <div className="font-bold text-[#0E4E31] inline-flex items-center gap-1.5"><Info size={14} /> Keterangan hitungan</div>
            <p>Satu orang dihitung <b>hadir sekali</b> per hari, pada kegiatan pertama yang ia hadiri.</p>
            <p>Hadir + Izin + Sakit + Alpha selalu sama dengan jumlah peserta unik hari itu.</p>
            <p>Persen = Hadir ÷ jumlah peserta unik, dibulatkan sama di semua halaman.</p>
          </div>
        </>
      )}

      <ShareRekapDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        mode="harian"
        date={date}
      />
    </div>
  );
}
