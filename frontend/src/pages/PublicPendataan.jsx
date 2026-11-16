// Halaman publik Pendataan (tanpa login, tanpa menu aplikasi).
// noindex + Referrer-Policy no-referrer dipasang lewat header server & meta.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Logo } from "@/components/Logo";

const MARITAL = [
  { value: "belum menikah", label: "Belum menikah" },
  { value: "sudah menikah", label: "Sudah menikah" },
];
const GENDER = [
  { value: "laki-laki", label: "Laki-laki" },
  { value: "perempuan", label: "Perempuan" },
];

const inputCls =
  "h-12 w-full rounded-xl border border-[#8A948D] bg-white px-3.5 text-base text-[#14201A] outline-none focus:border-[#14633F]";

export default function PublicPendataan() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selesai, setSelesai] = useState(false);
  const [pesan, setPesan] = useState("");
  const [form, setForm] = useState({
    nama: "", status_pernikahan: "", jenis_kelamin: "", tanggal_lahir: "", nomor_hp: "",
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
    api.get(`/publik/pendataan/${token}`)
      .then(({ data }) => setInfo(data))
      .catch(() => setErr("Tautan sudah tidak berlaku. Hubungi pengurus."))
      .finally(() => setLoading(false));
  }, [token]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const kirim = async (e) => {
    e.preventDefault();
    setPesan("");
    if (info?.jenis === "baru" && form.nama.trim().length < 3) {
      setPesan("Nama lengkap minimal 3 huruf.");
      return;
    }
    if (!form.status_pernikahan) { setPesan("Pilih status pernikahan."); return; }
    if (!form.jenis_kelamin) { setPesan("Pilih jenis kelamin."); return; }
    setSaving(true);
    try {
      await api.post(`/publik/pendataan/${token}`, form);
      setSelesai(true);
    } catch (e2) {
      const status = e2.response?.status;
      setPesan(status === 410
        ? "Tautan sudah tidak berlaku. Hubungi pengurus."
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

  if (selesai) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F4EE] px-4 text-center">
        <Logo size={48} />
        <CheckCircle2 className="mt-6 text-[#0E4E31]" size={34} />
        <p className="mt-3 max-w-sm text-base font-semibold text-[#14201A]">
          Terima kasih. Data Anda menunggu tinjauan pengurus.
        </p>
      </div>
    );
  }

  const judul = info?.jenis === "baru" ? "Pendaftaran peserta baru" : "Lengkapi data Anda";

  return (
    <div className="min-h-screen bg-[#F6F4EE] px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-4 text-xl font-bold text-[#14201A]">{judul}</h1>
          {info?.jenis === "orang" && info?.nama && (
            <p className="mt-1 text-sm text-[#5F6B63]">Halo, {info.nama}.</p>
          )}
        </div>

        <form onSubmit={kirim} className="mt-6 space-y-4 rounded-2xl border border-[#E7E3D8] bg-white p-4">
          {info?.jenis === "baru" && (
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[#14201A]">Nama lengkap</span>
              <input
                value={form.nama}
                onChange={(e) => set("nama", e.target.value)}
                maxLength={100}
                placeholder="Nama lengkap"
                className={inputCls}
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#14201A]">Status pernikahan</span>
            <select
              value={form.status_pernikahan}
              onChange={(e) => set("status_pernikahan", e.target.value)}
              className={inputCls}
            >
              <option value="">Pilih status</option>
              {MARITAL.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#14201A]">Jenis kelamin</span>
            <select
              value={form.jenis_kelamin}
              onChange={(e) => set("jenis_kelamin", e.target.value)}
              className={inputCls}
            >
              <option value="">Pilih jenis kelamin</option>
              {GENDER.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#14201A]">Tanggal lahir</span>
            <input
              type="date"
              value={form.tanggal_lahir}
              onChange={(e) => set("tanggal_lahir", e.target.value)}
              className={inputCls}
            />
            <span className="mt-1 block text-xs text-[#5F6B63]">Boleh dikosongkan.</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#14201A]">Nomor HP</span>
            <input
              type="tel"
              inputMode="tel"
              value={form.nomor_hp}
              onChange={(e) => set("nomor_hp", e.target.value)}
              placeholder="08xxxxxxxxxx"
              className={inputCls}
            />
            <span className="mt-1 block text-xs text-[#5F6B63]">Boleh dikosongkan.</span>
          </label>

          <p className="text-xs leading-relaxed text-[#5F6B63]">
            Nama dan kelompok tidak bisa diubah dari halaman ini.
          </p>

          {pesan && (
            <p className="flex items-start gap-1.5 rounded-xl bg-[#FBE5E3] p-2.5 text-sm text-[#A32A2A]">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {pesan}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#14633F] px-4 text-base font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />}
            {saving ? "Mengirim…" : "Kirim"}
          </button>
        </form>
      </div>
    </div>
  );
}
