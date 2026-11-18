// Rekap gabungan publik (tanpa login): tab "Gabungan" + satu tab per kegiatan.
// Satu orang dihitung hadir sekali per hari. Persen hanya di tab Gabungan.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, MapPin, User, Loader2, BookOpenCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import ReportHeader from "@/components/ReportHeader";
import { tanggalPanjang } from "./admin/kegiatanUtils";

const KARTU = [
  { key: "hadir", label: "Hadir", bg: "#E3F3EA", fg: "#0E4E31" },
  { key: "izin", label: "Izin", bg: "#FBF1D6", fg: "#6B4500" },
  { key: "sakit", label: "Sakit", bg: "#E3EEFB", fg: "#1D4F91" },
  { key: "alpha", label: "Alpha", bg: "#FBE5E3", fg: "#A32A2A" },
];

/** ISO → "10.02" (WITA). */
function jamWita(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit",
  }).replace(":", ".");
}

/** Bar tipis proporsi tanpa angka persen. */
export function ProporsiBar({ counts }) {
  const total = (counts?.hadir || 0) + (counts?.izin || 0) + (counts?.sakit || 0) + (counts?.alpha || 0);
  if (!total) return null;
  const bagian = [
    { n: counts.hadir || 0, c: "#14633F" },
    { n: counts.izin || 0, c: "#C08A2E" },
    { n: counts.sakit || 0, c: "#1D4F91" },
    { n: counts.alpha || 0, c: "#A32A2A" },
  ];
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-[#F0EEE6]">
      {bagian.map((b, i) => (
        b.n ? <div key={i} style={{ width: `${(b.n / total) * 100}%`, backgroundColor: b.c }} /> : null
      ))}
    </div>
  );
}

/** Bar persen (dipakai Rekap Harian & Rekap Bulanan). */
export function PercentBar({ label, value, sub, color = "#14633F", testid }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div data-testid={testid}>
      <div className="flex items-end justify-between gap-2 mb-1.5">
        <span className="text-xs font-semibold text-[#5F6B63]">{label}</span>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {v}%{sub ? <span className="ml-1 text-[11px] font-medium text-[#5F6B63]">{sub}</span> : null}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-[#F0EEE6] overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${v}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function PublicRekapGabungan() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("gabungan");
  const [status, setStatus] = useState("hadir");
  const [gender, setGender] = useState("semua");

  useEffect(() => {
    api.get(`/rekap-gabungan/${token}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setErr("Tautan tidak berlaku."));
  }, [token]);

  const sesiIdx = useMemo(() => {
    if (tab === "gabungan") return -1;
    return (data?.sessions || []).findIndex((s) => s.id === tab);
  }, [data, tab]);

  const tampilan = useMemo(() => {
    if (!data) return null;
    if (sesiIdx < 0) {
      const t = data.total || {};
      return {
        counts: { hadir: t.hadir || 0, izin: t.izin || 0, sakit: t.sakit || 0, alpha: t.alpha || 0 },
        total: t.total || 0,
        rows: (data.rows || []).map((r) => ({
          name: r.name, gender: r.gender, status: r.status_hari,
          arrival_time: null,
        })),
        label: "Gabungan",
      };
    }
    const s = data.sessions[sesiIdx];
    const rows = (data.rows || [])
      .map((r) => ({ ...r, cell: r.sessions?.[sesiIdx] }))
      .filter((r) => r.cell)
      .map((r) => ({
        name: r.name, gender: r.gender, status: r.cell.status,
        arrival_time: r.cell.arrival_time,
      }));
    return {
      counts: {
        hadir: s.counts.hadir || 0, izin: s.counts.izin || 0,
        sakit: s.counts.sakit || 0, alpha: s.counts.alpha || 0,
      },
      total: s.counts.total || 0,
      rows,
      label: s.label,
      sesi: s,
    };
  }, [data, sesiIdx]);

  const daftar = useMemo(() => {
    if (!tampilan) return [];
    const cocok = (r) => {
      const st = r.status || "belum_diabsen";
      if (status === "hadir") return st === "hadir";
      if (status === "izin") return st === "izin";
      if (status === "sakit") return st === "sakit";
      return st === "alpha" || st === "belum_diabsen";
    };
    return tampilan.rows
      .filter(cocok)
      .filter((r) => gender === "semua" || r.gender === gender)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "id"));
  }, [tampilan, status, gender]);

  if (err) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center px-4 text-center">
        <Logo size={48} />
        <p className="text-[#A32A2A] font-semibold mt-6">{err}</p>
      </div>
    );
  }
  if (!data || !tampilan) {
    return <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={32} /></div>;
  }

  const judulDaftar = `${status === "hadir" ? "Hadir" : status === "izin" ? "Izin" : status === "sakit" ? "Sakit" : "Alpha"}${gender === "L" ? " · laki-laki" : gender === "P" ? " · perempuan" : ""} (${daftar.length})`;
  const persen = tampilan.total ? Math.round((tampilan.counts.hadir / tampilan.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F6F4EE] pb-12">
      <ReportHeader
        title="Laporan rekap kegiatan"
        subtitle={tanggalPanjang(data.date)}
        icon={BookOpenCheck}
        testid="rekap-gabungan-header"
      />

      <main className="mx-auto max-w-2xl space-y-3 px-4">
        <section className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
          <h2 className="font-heading text-xl font-bold text-[#14201A]">{data.base_name}</h2>
          <div className="mt-2 space-y-1 text-sm text-[#5F6B63]">
            <div className="flex items-center gap-2"><CalendarDays size={15} /> {tanggalPanjang(data.date)}</div>
            {data.location && <div className="flex items-center gap-2"><MapPin size={15} /> {data.location}</div>}
            {data.teacher && <div className="flex items-center gap-2"><User size={15} /> {data.teacher}</div>}
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl bg-[#F0EEE6] p-1 no-scrollbar">
            {[{ id: "gabungan", label: "Gabungan" },
              ...(data.sessions || []).map((s) => ({ id: s.id, label: s.label }))].map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                aria-pressed={tab === t.id}
                className={`h-9 shrink-0 rounded-lg px-3 text-xs font-semibold ${tab === t.id ? "bg-white text-[#0E4E31]" : "text-[#5F6B63]"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {sesiIdx < 0 && (
          <section className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
            <div className="font-heading text-base font-bold text-[#14201A]">
              {tampilan.counts.hadir} dari {tampilan.total} orang hadir
            </div>
            <div className="mt-0.5 text-xs text-[#5F6B63]">Tingkat kehadiran {persen}%</div>
            <div className="mt-3"><ProporsiBar counts={tampilan.counts} /></div>
            <p className="mt-2 text-[11px] text-[#5F6B63]">Satu orang dihitung sekali.</p>
          </section>
        )}

        {sesiIdx >= 0 && tampilan.sesi && (
          <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
            <div className="text-sm font-bold text-[#14201A]">
              {tampilan.sesi.label} · {tampilan.sesi.start_time}–{tampilan.sesi.end_time} WITA
            </div>
            {tampilan.sesi.sebelumnya_hadir > 0 && (
              <p className="mt-0.5 text-[11px] text-[#5F6B63]">
                dari {tampilan.total} yang belum hadir sebelumnya
              </p>
            )}
            {tampilan.sesi.dikecualikan > 0 && (
              <p className="mt-0.5 text-[11px] text-[#5F6B63]">
                {tampilan.sesi.dikecualikan} peserta yang sudah hadir di kegiatan sebelumnya hari ini tidak dihitung.
              </p>
            )}
          </section>
        )}

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KARTU.map((k) => {
            const aktif = status === k.key;
            return (
              <button key={k.key} type="button" aria-pressed={aktif} onClick={() => setStatus(k.key)}
                className={`rounded-2xl border p-4 text-left transition-colors ${aktif ? "border-[#14633F]" : "border-[#E7E3D8]"}`}
                style={{ backgroundColor: k.bg }}>
                <div className="text-xs font-semibold" style={{ color: k.fg }}>{k.label}</div>
                <div className="mt-1 font-heading text-2xl font-bold tabular-nums" style={{ color: k.fg }}>
                  {tampilan.counts[k.key] || 0}
                </div>
              </button>
            );
          })}
        </section>

        <section className="rounded-2xl border border-[#E7E3D8] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E7E3D8] px-4 py-3">
            <h3 className="text-sm font-bold text-[#14201A]">{judulDaftar}</h3>
            <div className="flex items-center gap-1 rounded-xl bg-[#F0EEE6] p-1">
              {[["semua", "Semua"], ["L", "L"], ["P", "P"]].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setGender(v)} aria-pressed={gender === v}
                  className={`h-8 px-2.5 rounded-lg text-xs font-semibold ${gender === v ? "bg-white text-[#0E4E31]" : "text-[#5F6B63]"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {status === "hadir" && data.tampilkan_jam && (
            <p className="border-b border-[#E7E3D8] px-4 py-2 text-[11px] text-[#5F6B63]">Jam kehadiran (WITA)</p>
          )}
          {daftar.length ? (
            <ul className="max-h-96 divide-y divide-[#E7E3D8] overflow-y-auto">
              {daftar.map((r, i) => (
                <li key={`${r.name}-${i}`} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-[#14201A]">{r.name}</span>
                  {status === "hadir" && data.tampilkan_jam && (
                    <span className="shrink-0 text-xs tabular-nums text-[#5F6B63]">{jamWita(r.arrival_time)}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-[#5F6B63]">Belum ada nama pada status ini.</p>
          )}
        </section>

        <p className="text-center text-xs text-[#5F6B63]">© 2026 E-KERTALANGU · Absensi Pengajian</p>
      </main>
    </div>
  );
}
