// Rekap publik SATU kegiatan (tanpa login). Tanpa persen, tanpa tab, tanpa badge sesi.
// Kartu Hadir/Izin/Sakit/Alpha menjadi filter daftar nama.
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, MapPin, User, BookOpen, Loader2, BookOpenCheck } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import ReportHeader from "@/components/ReportHeader";
import { tanggalPanjang } from "./admin/kegiatanUtils";

const STATUS_LABEL = {
  hadir: "Hadir", izin: "Izin", sakit: "Sakit", alpha: "Alpha",
  belum_diabsen: "Belum diabsen",
};

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

export default function PublicRekap() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("hadir");
  const [gender, setGender] = useState("semua");

  useEffect(() => {
    api.get(`/rekap/${token}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setErr("Tautan tidak berlaku."));
  }, [token]);

  const c = data?.counts || {};
  const rows = data?.rows || [];

  const daftar = useMemo(() => {
    const cocok = (r) => {
      const st = r.status || "belum_diabsen";
      if (status === "hadir") return st === "hadir";
      if (status === "izin") return st === "izin";
      if (status === "sakit") return st === "sakit";
      return st === "alpha" || st === "belum_diabsen";
    };
    return rows
      .filter(cocok)
      .filter((r) => gender === "semua" || r.gender === gender)
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "id"));
  }, [rows, status, gender]);

  if (err) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center px-4 text-center">
        <Logo size={48} />
        <p className="text-[#A32A2A] font-semibold mt-6">{err}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={32} /></div>;
  }

  const judulDaftar = `${STATUS_LABEL[status] || "Hadir"}${gender === "L" ? " · laki-laki" : gender === "P" ? " · perempuan" : ""} (${daftar.length})`;

  return (
    <div className="min-h-screen bg-[#F6F4EE] pb-12">
      <ReportHeader
        title="Laporan rekap kegiatan"
        subtitle={tanggalPanjang(data.date)}
        icon={BookOpenCheck}
        testid="rekap-public-header"
      />

      <main className="mx-auto max-w-2xl space-y-3 px-4">
        <section className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
          <h2 className="font-heading text-xl font-bold text-[#14201A]">{data.name}</h2>
          <div className="mt-2 space-y-1 text-sm text-[#5F6B63]">
            <div className="flex items-center gap-2"><CalendarDays size={15} /> {tanggalPanjang(data.date)}</div>
            {data.location && <div className="flex items-center gap-2"><MapPin size={15} /> {data.location}</div>}
            {data.teacher && <div className="flex items-center gap-2"><User size={15} /> {data.teacher}</div>}
            {data.material && <div className="flex items-center gap-2"><BookOpen size={15} /> {data.material}</div>}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KARTU.map((k) => {
            const aktif = status === k.key;
            return (
              <button
                key={k.key}
                type="button"
                aria-pressed={aktif}
                onClick={() => setStatus(k.key)}
                className={`rounded-2xl border p-4 text-left transition-colors ${aktif ? "border-[#14633F]" : "border-[#E7E3D8]"}`}
                style={{ backgroundColor: k.bg }}
              >
                <div className="text-xs font-semibold" style={{ color: k.fg }}>{k.label}</div>
                <div className="mt-1 font-heading text-2xl font-bold tabular-nums" style={{ color: k.fg }}>
                  {c[k.key] || 0}
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
                <button key={v} type="button" onClick={() => setGender(v)}
                  aria-pressed={gender === v}
                  className={`h-8 px-2.5 rounded-lg text-xs font-semibold ${gender === v ? "bg-white text-[#0E4E31]" : "text-[#5F6B63]"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {status === "hadir" && data.tampilkan_jam && (
            <p className="border-b border-[#E7E3D8] px-4 py-2 text-[11px] text-[#5F6B63]">
              Jam kehadiran (WITA)
            </p>
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
