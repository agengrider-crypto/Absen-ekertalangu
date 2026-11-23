// Acak regu & nomor undian untuk satu kegiatan (Administrator & Pengurus).
// Pengacakan dilakukan di server (SystemRandom); hasil stabil setelah dikunci.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Shuffle, Hash, Copy, Lock, Search } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import Modal from "@/components/Modal";

const inp =
  "h-11 w-full rounded-xl border border-[#8A948D] bg-white px-3 text-sm text-[#14201A] outline-none focus:border-[#14633F]";

async function salin(teks) {
  try {
    await navigator.clipboard.writeText(teks);
    toast.success("Teks disalin");
  } catch {
    toast.error("Tidak bisa menyalin");
  }
}

export default function AcakKegiatanModal({ kegiatan, onClose }) {
  const [tab, setTab] = useState("regu");
  const [sumber, setSumber] = useState("hadir");
  const [mode, setMode] = useState("jumlah_regu");
  const [nilai, setNilai] = useState(2);
  const [seimbang, setSeimbang] = useState(true);
  const [regu, setRegu] = useState(null);
  const [undian, setUndian] = useState(null);
  const [dikunci, setDikunci] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [tanya, setTanya] = useState(false);
  const [cari, setCari] = useState("");

  const muat = useCallback(() => {
    api.get(`/staff/kegiatan/${kegiatan.id}/acak`)
      .then(({ data }) => {
        setRegu(data.regu || null);
        setUndian(data.undian || null);
        setDikunci(Boolean(data.dikunci));
      })
      .catch(() => { /* abaikan */ });
  }, [kegiatan.id]);

  useEffect(() => { muat(); }, [muat]);

  const acakRegu = async () => {
    if (sibuk) return;
    setSibuk(true);
    try {
      const { data } = await api.post(`/staff/kegiatan/${kegiatan.id}/acak-regu`, {
        sumber, mode, nilai: Number(nilai) || 1, seimbang,
      });
      setRegu(data.regu);
      setDikunci(false);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Gagal mengacak regu.");
    } finally {
      setSibuk(false);
    }
  };

  const acakUndian = async () => {
    if (sibuk) return;
    setSibuk(true);
    try {
      const { data } = await api.post(`/staff/kegiatan/${kegiatan.id}/acak-undian`, { sumber });
      setUndian(data.undian);
      setDikunci(false);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Gagal mengacak nomor undian.");
    } finally {
      setSibuk(false);
    }
  };

  const simpan = async () => {
    setSibuk(true);
    try {
      await api.post(`/staff/kegiatan/${kegiatan.id}/acak-simpan`, { regu, undian });
      setDikunci(true);
      toast.success("Hasil acak disimpan");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSibuk(false);
    }
  };

  const teksRegu = useMemo(() => {
    if (!regu) return "";
    return [`Acak regu — ${kegiatan.name}`, ""]
      .concat(regu.map((r) => `${r.nama} (${r.anggota.length}):\n` +
        r.anggota.map((a) => `- ${a.nama}`).join("\n")))
      .join("\n");
  }, [regu, kegiatan.name]);

  const undianTampil = useMemo(() => {
    const t = cari.trim().toLowerCase();
    if (!t) return undian || [];
    return (undian || []).filter((u) => String(u.nomor).includes(t)
      || (u.nama || "").toLowerCase().includes(t));
  }, [undian, cari]);

  const teksUndian = useMemo(() => {
    if (!undian) return "";
    return [`Nomor undian — ${kegiatan.name}`, ""]
      .concat(undian.map((u) => `${u.nomor}. ${u.nama}`)).join("\n");
  }, [undian, kegiatan.name]);

  return (
    <Modal
      open
      onClose={onClose}
      title="Acak regu dan nomor undian"
      subtitle={kegiatan.name}
      testid="acak-modal"
      maxWidth={640}
    >
      <div className="space-y-3">
        <div className="flex gap-1.5 rounded-xl border border-[#E7E3D8] bg-white p-1">
          {[
            { key: "regu", label: "Acak regu", Icon: Shuffle },
            { key: "undian", label: "Nomor undian", Icon: Hash },
          ].map(({ key, label, Icon }) => (
            <button key={key} type="button" onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold ${
                tab === key ? "bg-[#E3F3EA] text-[#0E4E31]" : "text-[#5F6B63]"
              }`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Sumber peserta</span>
            <select value={sumber} onChange={(e) => setSumber(e.target.value)} className={inp}>
              <option value="hadir">Yang hadir</option>
              <option value="terdaftar">Yang terdaftar</option>
            </select>
          </label>
          {tab === "regu" && (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Cara membagi</span>
                <select value={mode} onChange={(e) => setMode(e.target.value)} className={inp}>
                  <option value="jumlah_regu">Jumlah regu</option>
                  <option value="anggota_per_regu">Anggota per regu</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">
                  {mode === "jumlah_regu" ? "Jumlah regu" : "Anggota per regu"}
                </span>
                <input type="number" min={1} value={nilai}
                  onChange={(e) => setNilai(e.target.value)} className={inp} />
              </label>
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3">
                <input type="checkbox" checked={seimbang}
                  onChange={(e) => setSeimbang(e.target.checked)}
                  className="h-4 w-4 accent-[#14633F]" />
                <span className="text-sm text-[#14201A]">Seimbang jenis kelamin & kategori</span>
              </label>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={sibuk}
            onClick={() => {
              if (sibuk) return;
              if (dikunci) { setTanya(true); return; }
              if (tab === "regu") acakRegu(); else acakUndian();
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white disabled:opacity-60">
            {sibuk ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> : <Shuffle size={15} />}
            {sibuk ? "Memproses…" : dikunci ? "Acak ulang" : "Acak"}
          </button>
          {((tab === "regu" && regu) || (tab === "undian" && undian)) && !dikunci && (
            <button type="button" onClick={simpan} disabled={sibuk}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#14633F] bg-white px-4 text-sm font-semibold text-[#0E4E31] disabled:opacity-60">
              <Lock size={15} /> Simpan & kunci
            </button>
          )}
          {dikunci && (
            <span className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#F0EEE6] px-3 text-xs font-semibold text-[#5F6B63]">
              <Lock size={13} /> Sudah dikunci
            </span>
          )}
        </div>

        {tab === "regu" && regu && (
          <div className="space-y-2">
            <button type="button" onClick={() => salin(teksRegu)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F]">
              <Copy size={15} /> Salin teks WhatsApp
            </button>
            <div className="grid gap-2 sm:grid-cols-2">
              {regu.map((r) => (
                <div key={r.nama} className="rounded-xl border border-[#E7E3D8] bg-white p-3">
                  <p className="text-sm font-bold text-[#14201A]">
                    {r.nama} <span className="font-normal text-[#5F6B63]">({r.anggota.length})</span>
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-[#5F6B63]">
                    {r.anggota.map((a) => <li key={a.id}>{a.nama}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "undian" && undian && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => salin(teksUndian)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F]">
                <Copy size={15} /> Salin teks WhatsApp
              </button>
              <div className="relative min-w-0 flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
                <input value={cari} onChange={(e) => setCari(e.target.value)}
                  placeholder="Cari nomor atau nama"
                  className="h-10 w-full rounded-xl border border-[#8A948D] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#14633F]" />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-[#E7E3D8] bg-white">
              <table className="w-full text-left text-sm">
                <tbody>
                  {undianTampil.map((u) => (
                    <tr key={u.id} className="border-b border-[#F0EEE6] last:border-0">
                      <td className="w-16 px-3 py-2 font-bold tabular-nums text-[#0E4E31]">{u.nomor}</td>
                      <td className="px-3 py-2 text-[#14201A]">{u.nama}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {tanya && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4">
            <p className="text-base font-semibold text-[#14201A]">Acak ulang setelah dikunci?</p>
            <p className="mt-1 text-sm text-[#5F6B63]">Hasil sebelumnya akan diganti.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setTanya(false)}
                className="min-h-11 rounded-xl border border-[#E7E3D8] bg-white px-4 text-sm font-semibold text-[#14201A]">
                Batal
              </button>
              <button type="button"
                onClick={() => { setTanya(false); if (tab === "regu") acakRegu(); else acakUndian(); }}
                className="min-h-11 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white">
                Ya
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
