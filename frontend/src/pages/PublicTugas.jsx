// Halaman publik tugas (tanpa login). Hanya nama depan + data tugas.
// noindex + Referrer-Policy no-referrer dipasang lewat header server & meta.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2, CalendarClock, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import Modal from "@/components/Modal";
import { tanggalIndonesia } from "@/lib/wa";

export default function PublicTugas() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

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
    api.get(`/tugas/${token}`)
      .then(({ data: d }) => setData(d))
      .catch((e) => {
        setErr(e.response?.status === 410
          ? "Tautan sudah tidak berlaku."
          : "Tautan tugas tidak ditemukan.");
      });
  }, [token]);

  const kumpul = async () => {
    setSaving(true);
    try {
      await api.post(`/tugas/${token}/kumpul`);
      setData((d) => ({ ...d, sudah_kumpul: true }));
      setConfirm(false);
    } catch (e) {
      setErr(e.response?.status === 410 ? "Tautan sudah tidak berlaku." : "Gagal menyimpan. Coba lagi.");
      setConfirm(false);
    } finally { setSaving(false); }
  };

  if (err) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center px-4 text-center">
        <Logo size={48} />
        <p className="mt-6 font-semibold text-[#A32A2A]" data-testid="tugas-public-error">{err}</p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center" role="status" aria-label="Memuat tugas">
        <Loader2 size={22} className="animate-spin text-[#5F6B63]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F4EE] px-4 py-10" data-testid="tugas-public">
      <main className="mx-auto max-w-md">
        <div className="mb-4 flex justify-center"><Logo size={44} /></div>
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
          <h1 className="font-heading text-lg font-bold text-[#14201A]">
            Tugas Ananda <span className="text-[#14633F]">{data.nama_depan}</span>
          </h1>
          <div className="mt-3 text-sm font-semibold text-[#14201A]">{data.judul}</div>
          {data.keterangan && (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#5F6B63]">{data.keterangan}</p>
          )}
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#5F6B63]">
            <CalendarClock size={13} /> Batas kumpul {tanggalIndonesia(data.batas_kumpul)}
          </div>

          {!data.berlaku ? (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#FBE5E3] px-3 py-2 text-sm font-semibold text-[#A32A2A]">
              <AlertTriangle size={15} /> Tautan sudah tidak berlaku.
            </div>
          ) : data.sudah_kumpul ? (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#E3F3EA] px-3 py-2 text-sm font-semibold text-[#0E4E31]"
              data-testid="tugas-public-selesai">
              <CheckCircle2 size={15} /> Terima kasih, tugas sudah dicatat.
            </div>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} data-testid="tugas-public-kumpul"
              className="mt-4 h-12 w-full rounded-xl bg-[#14633F] font-bold text-white hover:bg-[#0E4E31]">
              Sudah dikerjakan
            </button>
          )}
        </div>
        <p className="mt-6 text-center text-[11px] text-[#5F6B63]">© 2026 E-KERTALANGU</p>
      </main>

      <Modal open={confirm} onClose={() => setConfirm(false)} title="Tandai tugas sudah dikerjakan?"
        maxWidth={420} hideClose testid="tugas-public-konfirmasi"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirm(false)}
              className="h-11 flex-1 rounded-xl border-2 border-[#E7E3D8] font-semibold text-[#5F6B63] hover:bg-[#F6F4EE]">Batal</button>
            <button type="button" onClick={kumpul} disabled={saving}
              className="h-11 flex-1 rounded-xl bg-[#14633F] font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60">
              {saving ? "Menyimpan…" : "Ya, sudah"}
            </button>
          </div>
        }>
        <p className="text-sm text-[#5F6B63]">Setelah ditandai, tugas tidak bisa dibatalkan.</p>
      </Modal>
    </div>
  );
}
