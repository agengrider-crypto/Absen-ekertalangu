// Halaman publik izin kegiatan (tanpa login). Hanya nama peserta, tanpa data lain.
// noindex + Referrer-Policy no-referrer dipasang lewat header server & meta.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Logo } from "@/components/Logo";

const inputCls =
  "h-12 w-full rounded-xl border border-[#8A948D] bg-white px-3.5 text-base text-[#14201A] outline-none focus:border-[#14633F]";

export default function PublicIzin() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selesai, setSelesai] = useState(false);
  const [pesan, setPesan] = useState("");
  const [form, setForm] = useState({ peserta_id: "", alasan: "", alasan_lain: "" });

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
    api.get(`/publik/izin/${token}`)
      .then(({ data }) => setInfo(data))
      .catch(() => setErr("Tautan sudah tidak berlaku. Hubungi pengurus."))
      .finally(() => setLoading(false));
  }, [token]);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setPesan("");
  };

  const kirim = async (e) => {
    e.preventDefault();
    if (!form.peserta_id) { setPesan("Pilih nama Anda dulu."); return; }
    if (!form.alasan) { setPesan("Pilih alasan dulu."); return; }
    if (form.alasan === "Lainnya" && form.alasan_lain.trim().length < 3) {
      setPesan("Tulis alasannya.");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/publik/izin/${token}`, form);
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
          Terima kasih. Izin Anda sudah tercatat dan akan ditinjau pengurus.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F4EE] px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <Logo size={44} />
          <h1 className="mt-4 text-xl font-bold text-[#14201A]">Izin tidak hadir</h1>
          <p className="mt-1 text-sm text-[#5F6B63]">{info?.kegiatan}</p>
        </div>

        <form onSubmit={kirim} className="mt-6 space-y-4 rounded-2xl border border-[#E7E3D8] bg-white p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#14201A]">Nama Anda</span>
            <select
              value={form.peserta_id}
              onChange={(e) => set("peserta_id", e.target.value)}
              className={inputCls}
            >
              <option value="">Pilih nama</option>
              {(info?.peserta || []).map((p) => (
                <option key={p.id} value={p.id}>{p.nama}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#14201A]">Alasan</span>
            <select
              value={form.alasan}
              onChange={(e) => set("alasan", e.target.value)}
              className={inputCls}
            >
              <option value="">Pilih alasan</option>
              {(info?.alasan || []).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>

          {form.alasan === "Lainnya" && (
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[#14201A]">Tulis alasannya</span>
              <input
                value={form.alasan_lain}
                onChange={(e) => set("alasan_lain", e.target.value)}
                maxLength={100}
                placeholder="Tulis alasannya"
                className={inputCls}
              />
            </label>
          )}

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
            {saving ? "Mengirim…" : "Kirim izin"}
          </button>
        </form>
      </div>
    </div>
  );
}
