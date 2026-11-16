// Halaman "Periksa aplikasi" (khusus administrator).
// Hanya membaca: server tidak menulis/mengubah data apa pun.
import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Camera, CheckCircle2, AlertTriangle, XCircle, Loader2, Copy, Play } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { formatWita, jamWita } from "@/lib/maintenance";

const STATUS_META = {
  ok: { label: "Baik", icon: CheckCircle2, bg: "#E3F3EA", fg: "#0E4E31" },
  warn: { label: "Perlu dicek", icon: AlertTriangle, bg: "#FBF1D6", fg: "#6B4500" },
  error: { label: "Bermasalah", icon: XCircle, bg: "#FBE5E3", fg: "#A32A2A" },
};

/** Pemeriksaan kamera di perangkat ini — tanpa membuka aliran kamera. */
async function periksaKamera() {
  const hasil = { kelompok: "Perangkat", nama: "Kamera perangkat ini" };
  try {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return { ...hasil, status: "warn", keterangan: "Perangkat ini tidak melaporkan kamera." };
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const kamera = devices.filter((d) => d.kind === "videoinput");
    if (!kamera.length) {
      return { ...hasil, status: "warn", keterangan: "Tidak ada kamera terdeteksi di perangkat ini." };
    }
    let izin = "";
    try {
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: "camera" });
        izin = status?.state || "";
      }
    } catch (_) { /* peramban tidak mendukung pemeriksaan izin */ }
    if (izin === "denied") {
      return { ...hasil, status: "warn", keterangan: "Izin kamera diblokir di peramban ini." };
    }
    return {
      ...hasil,
      status: "ok",
      keterangan: `Kamera terdeteksi (${kamera.length} kamera)${izin === "granted" ? ", izin sudah diberikan" : ""}.`,
    };
  } catch (_) {
    return { ...hasil, status: "warn", keterangan: "Kamera tidak bisa diperiksa di peramban ini." };
  }
}

export default function PeriksaAplikasiView() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [ringkasan, setRingkasan] = useState(null);
  const [diperiksaAt, setDiperiksaAt] = useState(null);
  const [tampil, setTampil] = useState(0);
  const [sudah, setSudah] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Baris muncul satu per satu setelah hasil datang.
  const tampilkanBertahap = (total) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTampil(0);
    let n = 0;
    timerRef.current = setInterval(() => {
      n += 1;
      setTampil(n);
      if (n >= total) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setSudah(true);
      }
    }, 90);
  };

  const jalankan = async () => {
    setLoading(true);
    setSudah(false);
    setItems([]);
    setRingkasan(null);
    try {
      const { data } = await api.get("/admin/periksa-aplikasi");
      const kamera = await periksaKamera();
      const semua = [...(data.items || []), kamera];
      setItems(semua);
      setRingkasan({
        ok: semua.filter((i) => i.status === "ok").length,
        warn: semua.filter((i) => i.status === "warn").length,
        error: semua.filter((i) => i.status === "error").length,
      });
      setDiperiksaAt(data.diperiksa_at || new Date().toISOString());
      tampilkanBertahap(semua.length);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
      setSudah(true);
    } finally {
      setLoading(false);
    }
  };

  const kelompok = useMemo(() => {
    const urutan = [];
    const peta = new Map();
    items.slice(0, tampil).forEach((item) => {
      if (!peta.has(item.kelompok)) { peta.set(item.kelompok, []); urutan.push(item.kelompok); }
      peta.get(item.kelompok).push(item);
    });
    return urutan.map((nama) => ({ nama, rows: peta.get(nama) }));
  }, [items, tampil]);

  const salinDetail = async () => {
    const masalah = items.filter((i) => i.status !== "ok");
    const waktu = diperiksaAt ? `${formatWita(diperiksaAt)}, ${jamWita(diperiksaAt)} WITA` : "-";
    const teks = [
      `Periksa aplikasi — ${waktu}`,
      ...masalah.map((i) => `[${STATUS_META[i.status]?.label || i.status}] ${i.kelompok} · ${i.nama}: ${i.keterangan}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(teks);
      toast.success("Disalin");
    } catch (_) {
      toast.error("Tidak bisa menyalin");
    }
  };

  const adaMasalah = items.some((i) => i.status !== "ok");

  return (
    <div className="space-y-4" data-testid="periksa-aplikasi">
      <div>
        <h1 className="inline-flex items-center gap-2 font-heading text-2xl font-bold text-[#14201A]">
          <Activity size={22} className="text-[#0E4E31]" /> Periksa aplikasi
        </h1>
        <p className="mt-1 text-sm text-[#5F6B63]">
          Hanya administrator. Hanya membaca, tidak mengubah data.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={jalankan}
          disabled={loading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> : <Play size={16} />}
          {loading ? "Memeriksa…" : sudah ? "Jalankan ulang" : "Jalankan pemeriksaan"}
        </button>
        {adaMasalah && (
          <button
            type="button"
            onClick={salinDetail}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F]"
          >
            <Copy size={16} /> Salin detail masalah
          </button>
        )}
      </div>

      {ringkasan && (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-3.5 text-sm font-semibold text-[#14201A]">
          {ringkasan.ok} baik, {ringkasan.warn} perlu dicek, {ringkasan.error} bermasalah
          {diperiksaAt && (
            <span className="mt-1 block text-xs font-normal text-[#5F6B63]">
              Terakhir diperiksa {formatWita(diperiksaAt)}, {jamWita(diperiksaAt)} WITA
            </span>
          )}
        </div>
      )}

      {kelompok.map((grup) => (
        <section key={grup.nama} className="rounded-2xl border border-[#E7E3D8] bg-white">
          <h2 className="border-b border-[#E7E3D8] px-3.5 py-2.5 text-sm font-bold text-[#14201A]">{grup.nama}</h2>
          <div className="divide-y divide-[#E7E3D8]">
            {grup.rows.map((item) => {
              const meta = STATUS_META[item.status] || STATUS_META.warn;
              const Icon = meta.icon;
              return (
                <div key={`${item.kelompok}-${item.nama}`} className="flex items-start gap-2.5 px-3.5 py-2.5">
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: meta.bg, color: meta.fg }}
                    aria-hidden="true"
                  >
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#14201A]">{item.nama}</div>
                    <div className="text-[13px] text-[#5F6B63]">{item.keterangan}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {!items.length && !loading && (
        <p className="rounded-2xl border border-dashed border-[#D9D4C5] bg-white p-6 text-center text-sm text-[#5F6B63]">
          Tekan tombol di atas untuk memeriksa aplikasi.
        </p>
      )}

      {items.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-[#5F6B63]">
          <Camera size={13} /> Pemeriksaan kamera dilakukan di perangkat ini tanpa membuka kamera.
        </p>
      )}
    </div>
  );
}
