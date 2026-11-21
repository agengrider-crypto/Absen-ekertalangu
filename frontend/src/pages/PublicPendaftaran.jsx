// Halaman publik konfirmasi peserta kegiatan (tanpa login).
// Hanya menulis ke `pendaftaran_konfirmasi`; database peserta tidak disentuh.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, MapPin, CalendarDays,
} from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalIndonesia } from "@/lib/wa";
import { PENDAFTARAN } from "@/constants/testIds";
import { Logo } from "@/components/Logo";

const inputCls =
  "h-12 w-full rounded-xl border border-[#8A948D] bg-white px-3.5 text-base text-[#14201A] outline-none focus:border-[#14633F]";

export default function PublicPendaftaran() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasil, setHasil] = useState(null);
  const [pesan, setPesan] = useState("");
  const [form, setForm] = useState({
    nama: "", nomor_hp: "", kehadiran: "", alasan: "", alasan_lain: "", keterangan: "",
  });

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
    api.get(`/publik/daftar/${token}`)
      .then(({ data }) => setInfo(data))
      .catch((e) => {
        const status = e.response?.status;
        setErr(status === 410
          ? "Pendaftaran kegiatan ini sudah ditutup."
          : "Tautan sudah tidak berlaku. Hubungi pengurus.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setPesan("");
  };

  const kirim = async (e) => {
    e.preventDefault();
    if (form.nama.trim().length < 3) { setPesan("Isi nama lengkap dulu."); return; }
    if (!form.nomor_hp.trim()) { setPesan("Isi nomor HP dulu."); return; }
    if (!form.kehadiran) { setPesan("Pilih konfirmasi kehadiran dulu."); return; }
    if (form.kehadiran === "tidak_hadir" && !form.alasan) {
      setPesan("Pilih alasan tidak hadir dulu.");
      return;
    }
    if (form.kehadiran === "tidak_hadir" && form.alasan === "Lainnya"
      && form.alasan_lain.trim().length < 3) {
      setPesan("Tulis alasannya.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post(`/publik/daftar/${token}`, {
        nama: form.nama.trim(),
        nomor_hp: form.nomor_hp.trim(),
        kehadiran: form.kehadiran,
        alasan: form.kehadiran === "tidak_hadir" ? form.alasan : null,
        alasan_lain: form.kehadiran === "tidak_hadir" && form.alasan === "Lainnya"
          ? form.alasan_lain.trim() : null,
        keterangan: form.keterangan.trim() || null,
      });
      setHasil(data);
    } catch (e2) {
      const status = e2.response?.status;
      setPesan(status === 410
        ? "Pendaftaran kegiatan ini sudah ditutup."
        : formatApiErrorDetail(e2.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

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
        <Logo size={48} />
        <p className="mt-6 max-w-sm text-sm font-semibold text-[#A32A2A]">{err}</p>
      </div>
    );
  }

  if (hasil) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F4EE] px-4 text-center"
        data-testid={PENDAFTARAN.publicResult}>
        <Logo size={48} />
        <CheckCircle2 className="mt-6 text-[#0E4E31]" size={34} />
        <p className="mt-3 max-w-sm text-base font-semibold text-[#14201A]">
          Terima kasih, konfirmasi Anda sudah tersimpan.
        </p>
        <p className="mt-1 max-w-sm text-sm text-[#5F6B63]">
          {hasil.kehadiran === "hadir"
            ? "Anda tercatat HADIR pada kegiatan ini."
            : "Anda tercatat TIDAK BISA HADIR pada kegiatan ini."}
        </p>
        <div className="mt-4 w-full max-w-sm rounded-xl border border-[#E7E3D8] bg-white p-3 text-left">
          <p className="text-sm font-semibold text-[#14201A]">{hasil.pesan}</p>
          <p className="mt-0.5 text-xs text-[#5F6B63]">
            Status akun: {hasil.status_akun_label}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F4EE] px-4 py-8" data-testid={PENDAFTARAN.publicView}>
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-4 text-xl font-bold text-[#14201A]">Konfirmasi Kehadiran</h1>
          <p className="mt-1 text-base font-semibold text-[#0E4E31]">{info?.nama}</p>
          <div className="mt-2 space-y-1 text-sm text-[#5F6B63]">
            <p className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} /> {tanggalIndonesia(info?.tanggal)}
            </p>
            {info?.lokasi && (
              <p className="inline-flex items-center gap-1.5">
                <MapPin size={14} /> {info.lokasi}
              </p>
            )}
          </div>
          {info?.catatan && (
            <p className="mt-2 rounded-xl bg-white px-3 py-2 text-sm text-[#5F6B63]">
              {info.catatan}
            </p>
          )}
        </div>

        <form onSubmit={kirim}
          className="mt-6 space-y-4 rounded-2xl border border-[#E7E3D8] bg-white p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#14201A]">Nama Lengkap</span>
            <input value={form.nama} onChange={(e) => set("nama", e.target.value)}
              data-testid={PENDAFTARAN.publicName} maxLength={100}
              placeholder="Tulis nama lengkap" className={inputCls} />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#14201A]">Nomor HP</span>
            <input value={form.nomor_hp} onChange={(e) => set("nomor_hp", e.target.value)}
              data-testid={PENDAFTARAN.publicPhone} inputMode="tel" maxLength={20}
              placeholder="Contoh: 081234567890" className={inputCls} />
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-semibold text-[#14201A]">
              Konfirmasi kehadiran
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" data-testid={PENDAFTARAN.publicHadir}
                onClick={() => set("kehadiran", "hadir")}
                aria-pressed={form.kehadiran === "hadir"}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold ${
                  form.kehadiran === "hadir"
                    ? "border-[#14633F] bg-[#E3F3EA] text-[#0E4E31]"
                    : "border-[#E7E3D8] bg-white text-[#5F6B63]"
                }`}>
                <CheckCircle2 size={18} /> Saya Hadir
              </button>
              <button type="button" data-testid={PENDAFTARAN.publicTidakHadir}
                onClick={() => set("kehadiran", "tidak_hadir")}
                aria-pressed={form.kehadiran === "tidak_hadir"}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold ${
                  form.kehadiran === "tidak_hadir"
                    ? "border-[#A32A2A] bg-[#FBE5E3] text-[#A32A2A]"
                    : "border-[#E7E3D8] bg-white text-[#5F6B63]"
                }`}>
                <XCircle size={18} /> Saya Tidak Bisa Hadir
              </button>
            </div>
          </div>

          {form.kehadiran === "tidak_hadir" && (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-[#14201A]">
                  Alasan tidak hadir
                </span>
                <select value={form.alasan} onChange={(e) => set("alasan", e.target.value)}
                  data-testid={PENDAFTARAN.publicAlasan} className={inputCls}>
                  <option value="">Pilih alasan</option>
                  {(info?.alasan || []).map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>

              {form.alasan === "Lainnya" && (
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-[#14201A]">
                    Tulis alasannya
                  </span>
                  <input value={form.alasan_lain}
                    onChange={(e) => set("alasan_lain", e.target.value)}
                    data-testid={PENDAFTARAN.publicAlasanLain} maxLength={100}
                    placeholder="Tulis alasannya" className={inputCls} />
                </label>
              )}
            </>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#14201A]">
              Keterangan (opsional)
            </span>
            <textarea value={form.keterangan} onChange={(e) => set("keterangan", e.target.value)}
              data-testid={PENDAFTARAN.publicKeterangan} maxLength={200} rows={2}
              placeholder="Catatan tambahan untuk pengurus"
              className="w-full rounded-xl border border-[#8A948D] bg-white px-3.5 py-2.5 text-base text-[#14201A] outline-none focus:border-[#14633F]" />
          </label>

          {pesan && (
            <p className="flex items-start gap-1.5 rounded-xl bg-[#FBE5E3] p-2.5 text-sm text-[#A32A2A]">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {pesan}
            </p>
          )}

          <button type="submit" disabled={saving} data-testid={PENDAFTARAN.publicSubmit}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#14633F] px-4 text-base font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60">
            {saving && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />}
            {saving ? "Mengirim…" : "Kirim Konfirmasi"}
          </button>
        </form>
      </div>
    </div>
  );
}
