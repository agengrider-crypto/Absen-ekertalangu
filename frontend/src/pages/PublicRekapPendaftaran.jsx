// Rekap publik pendaftaran kegiatan (tanpa login, hanya baca).
// Hanya angka dan nama yang ikut; tanpa nomor HP, keterangan, atau kelompok.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, Loader2, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { tanggalIndonesia } from "@/lib/wa";
import { Logo } from "@/components/Logo";

/** ISO → "26 Nov 2026, 14.05 WITA". */
function waktuWita(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const tgl = d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Makassar", day: "numeric", month: "short", year: "numeric",
  });
  const jam = d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit",
  }).replace(":", ".");
  return `${tgl}, ${jam} WITA`;
}

export default function PublicRekapPendaftaran() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("ikut");

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const ref = document.createElement("meta");
    ref.name = "referrer";
    ref.content = "no-referrer";
    document.head.appendChild(ref);
    return () => {
      document.head.removeChild(meta);
      document.head.removeChild(ref);
    };
  }, []);

  useEffect(() => {
    api.get(`/publik/rekap-pendaftaran/${token}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setErr("Tautan tidak tersedia"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F4EE]">
        <Loader2 className="animate-spin text-[#0E4E31] motion-reduce:animate-none" size={28} />
      </div>
    );
  }

  if (err) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F4EE] px-4 text-center">
        <p className="max-w-sm text-base font-semibold text-[#14201A]">Tautan tidak tersedia</p>
        <p className="mt-1 max-w-sm text-sm text-[#5F6B63]">
          Hubungi pengurus kegiatan untuk tautan yang benar.
        </p>
      </div>
    );
  }

  const pakaiLogo = data?.tampilkan_logo !== false;
  const kotak = [
    { label: "Total", value: data?.total ?? 0, color: "#14201A" },
    { label: "Ikut", value: data?.ikut ?? 0, color: "#0E4E31" },
    { label: "Tidak ikut", value: data?.tidak_ikut ?? 0, color: "#A32A2A" },
  ];
  const namaIkut = data?.nama_ikut || [];
  const namaTidakIkut = data?.nama_tidak_ikut || [];
  // Alasan hanya ada di respons bila saklarnya menyala (whitelist di server).
  const tampilAlasan = namaTidakIkut.some((r) => "alasan" in r);

  return (
    <div className="min-h-screen bg-[#F6F4EE] px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          {pakaiLogo && <Logo size={44} />}
          {data?.penyelenggara && (
            <p className={`text-sm font-semibold text-[#5F6B63] ${pakaiLogo ? "mt-3" : ""}`}>
              {data.penyelenggara}
            </p>
          )}
          <h1 className={`text-xl font-bold text-[#14201A] ${pakaiLogo || data?.penyelenggara ? "mt-2" : ""}`}>
            Rekap Pendaftaran
          </h1>
          <p className="mt-1 text-base font-semibold text-[#0E4E31]">{data?.judul}</p>
          <div className="mt-2 space-y-1 text-sm text-[#5F6B63]">
            <p className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} /> {tanggalIndonesia(data?.tanggal)}
            </p>
            {data?.lokasi && (
              <p className="inline-flex items-center gap-1.5">
                <MapPin size={14} /> {data.lokasi}
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {kotak.map((k) => (
            <div key={k.label} className="rounded-xl border border-[#E7E3D8] bg-white p-3 text-center">
              <p className="text-xs font-semibold text-[#5F6B63]">{k.label}</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        <section className="mt-4 rounded-2xl border border-[#E7E3D8] bg-white p-4">
          <div className="flex gap-1.5" role="tablist" aria-label="Rekap pendaftaran">
            {[
              { key: "ikut", label: `Ikut (${namaIkut.length})` },
              { key: "tidak", label: `Tidak ikut (${namaTidakIkut.length})` },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                data-testid={`rekap-publik-tab-${t.key}`}
                onClick={() => setTab(t.key)}
                className={`min-h-10 flex-1 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                  tab === t.key
                    ? "border-[#14633F] bg-[#E3F3EA] text-[#0E4E31]"
                    : "border-[#E7E3D8] bg-white text-[#5F6B63] hover:border-[#14633F]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "ikut" ? (
            namaIkut.length === 0 ? (
              <p className="mt-3 text-sm text-[#5F6B63]">Belum ada yang memilih ikut.</p>
            ) : (
              <ol className="mt-3 space-y-1.5 text-sm text-[#14201A]">
                {namaIkut.map((nama, i) => (
                  <li key={`${nama}-${i}`} className="flex gap-2">
                    <span className="w-5 shrink-0 text-right text-[#5F6B63]">{i + 1}.</span>
                    <span className="min-w-0 break-words">{nama}</span>
                  </li>
                ))}
              </ol>
            )
          ) : namaTidakIkut.length === 0 ? (
            <p className="mt-3 text-sm text-[#5F6B63]">Belum ada yang tidak ikut.</p>
          ) : (
            <ol className="mt-3 space-y-1.5 text-sm text-[#14201A]">
              {namaTidakIkut.map((r, i) => (
                <li key={`${r.nama}-${i}`} className="flex gap-2">
                  <span className="w-5 shrink-0 text-right text-[#5F6B63]">{i + 1}.</span>
                  <span className="min-w-0">
                    <span className="block break-words">{r.nama}</span>
                    {tampilAlasan && r.alasan && (
                      <span className="mt-0.5 block break-words text-xs text-[#5F6B63]">
                        {r.alasan}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <p className="mt-4 text-center text-xs text-[#5F6B63]">
          Diperbarui {waktuWita(data?.diperbarui_pada)}
        </p>
      </div>
    </div>
  );
}
