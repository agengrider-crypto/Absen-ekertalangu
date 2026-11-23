// Cadangan data — unduh salinan data per kelompok (Administrator).
// Tidak menyertakan hash password, token, atau data rahasia lain.
import { useCallback, useEffect, useState } from "react";
import { DatabaseBackup, Loader2, Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalIndonesia } from "@/lib/wa";
import Modal from "@/components/Modal";

const KELOMPOK = [
  { key: "peserta", label: "Peserta", desc: "Data profil peserta tanpa kata sandi" },
  { key: "kegiatan", label: "Kegiatan", desc: "Jadwal dan rincian kegiatan" },
  { key: "absensi", label: "Absensi", desc: "Catatan kehadiran peserta" },
  { key: "pendaftaran", label: "Pendaftaran", desc: "Jawaban pendaftaran kegiatan" },
];

function waktuWita(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${tanggalIndonesia(iso.slice(0, 10))} ${d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit",
  }).replace(":", ".")} WITA`;
}

export default function CadanganDataView() {
  const [info, setInfo] = useState(null);
  const [pilih, setPilih] = useState(null);
  const [password, setPassword] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");

  const muat = useCallback(() => {
    api.get("/admin/cadangan/info")
      .then(({ data }) => setInfo(data))
      .catch(() => setInfo(false));
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const unduh = async () => {
    if (!password.trim()) { setPesan("Isi password Administrator dulu."); return; }
    setSibuk(true);
    setPesan("");
    try {
      const res = await api.post("/admin/cadangan",
        { password, kelompok: pilih.key }, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cadangan_${pilih.key}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Cadangan diunduh");
      setPilih(null);
      setPassword("");
      muat();
    } catch (e) {
      // Respons galat berbentuk blob; baca isinya untuk pesan yang jelas.
      let teks = "";
      try {
        teks = await e.response?.data?.text?.();
        teks = JSON.parse(teks)?.detail || "";
      } catch { teks = ""; }
      setPesan(teks || formatApiErrorDetail(e.response?.data?.detail) || "Gagal mengunduh cadangan.");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="cadangan-view">
      <div>
        <h1 className="inline-flex items-center gap-2 font-heading text-2xl font-bold text-[#14201A]">
          <DatabaseBackup size={22} className="text-[#0E4E31]" /> Cadangan data
        </h1>
        <p className="mt-1 text-sm text-[#5F6B63]">
          Unduh salinan data per kelompok. Berkas berformat Excel dan tidak memuat kata sandi.
        </p>
      </div>

      <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
        <p className="text-sm text-[#14201A]">
          Cadangan terakhir diunduh:{" "}
          <b>{info === null ? "memuat…" : waktuWita(info?.terakhir)}</b>
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {KELOMPOK.map((k) => (
          <button
            key={k.key}
            type="button"
            data-testid={`cadangan-${k.key}`}
            onClick={() => { setPilih(k); setPassword(""); setPesan(""); }}
            className="flex min-h-16 items-center gap-3 rounded-xl border border-[#E7E3D8] bg-white px-4 py-3 text-left hover:border-[#14633F]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E3F3EA] text-[#0E4E31]">
              <Download size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[#14201A]">{k.label}</span>
              <span className="block text-xs text-[#5F6B63]">{k.desc}</span>
            </span>
            <span className="shrink-0 text-xs font-semibold text-[#5F6B63]">
              {info?.jumlah?.[k.key] ?? "-"} baris
            </span>
          </button>
        ))}
      </div>

      <p className="inline-flex items-start gap-1.5 rounded-xl bg-[#F6F4EE] px-3 py-2 text-xs text-[#5F6B63]">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        Kata sandi, token, dan kunci rahasia tidak pernah disertakan dalam cadangan.
      </p>

      {pilih && (
        <Modal
          open
          onClose={() => setPilih(null)}
          title={`Unduh cadangan ${pilih.label}`}
          subtitle="Masukkan password Administrator untuk melanjutkan."
          testid="cadangan-modal"
          maxWidth={420}
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPilih(null)}
                className="min-h-11 rounded-xl border border-[#E7E3D8] bg-white px-4 text-sm font-semibold text-[#14201A]">
                Batal
              </button>
              <button type="button" onClick={unduh} disabled={sibuk}
                data-testid="cadangan-unduh"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white disabled:opacity-60">
                {sibuk && <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />}
                Ya, unduh
              </button>
            </div>
          )}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-[#14201A]">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPesan(""); }}
              data-testid="cadangan-password"
              autoComplete="current-password"
              className="h-11 w-full rounded-xl border border-[#8A948D] bg-white px-3 text-base text-[#14201A] outline-none focus:border-[#14633F]"
            />
          </label>
          {pesan && <p className="mt-2 rounded-xl bg-[#FBE5E3] p-2.5 text-sm text-[#A32A2A]">{pesan}</p>}
        </Modal>
      )}
    </div>
  );
}
