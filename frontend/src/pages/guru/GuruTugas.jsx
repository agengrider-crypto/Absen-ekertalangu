// Tab Tugas di Kelas Saya — buat tugas + antrean kirim WhatsApp wali.
import { useEffect, useState } from "react";
import { Loader2, Send, Plus, ChevronDown, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { ProgressBar } from "@/components/StatusGroups";
import { bukaWhatsApp, pesanTugas, pesanPengingat, tanggalIndonesia } from "@/lib/wa";
import { todayYmd } from "@/pages/admin/kegiatanUtils";

const STATUS_CHIP = {
  belum: { label: "Belum dikirim", cls: "bg-[#F0EEE6] text-[#5F6B63]" },
  dibuka: { label: "Sudah dibuka", cls: "bg-[#E3EEFB] text-[#1D4F91]" },
  kumpul: { label: "Sudah kumpul", cls: "bg-[#E3F3EA] text-[#0E4E31]" },
  tanpa_nomor: { label: "Belum ada nomor", cls: "bg-[#FBF1D6] text-[#6B4500]" },
};

export default function GuruTugas({ jenjang, label, isAdmin, items, onPick }) {
  const [data, setData] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [judul, setJudul] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [batas, setBatas] = useState(todayYmd());
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState(null);

  const load = () => {
    if (!jenjang) { setData({ items: [] }); return; }
    setData(null);
    api.get(`/guru/tugas?jenjang=${jenjang}`)
      .then(({ data: d }) => {
        setData(d);
        setActiveId((prev) => (d.items || []).some((t) => t.id === prev) ? prev : (d.items || [])[0]?.id || null);
      })
      .catch(() => setData({ items: [] }));
  };

  useEffect(() => { load(); }, [jenjang]);

  const simpan = async () => {
    if (!judul.trim() || !batas) return;
    setSaving(true);
    try {
      const { data: d } = await api.post("/guru/tugas", {
        jenjang, judul: judul.trim(), keterangan: keterangan.trim() || null, batas_kumpul: batas,
      });
      toast.success(`Tugas disiapkan untuk ${d.total} peserta`);
      setJudul(""); setKeterangan(""); setOpenForm(false);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const kirim = async (tugas, anak, ingatkan = false) => {
    const teks = ingatkan
      ? pesanPengingat({ namaDepan: anak.nama_depan, judul: tugas.judul, batasKumpul: tugas.batas_kumpul, token: anak.token })
      : pesanTugas({ namaDepan: anak.nama_depan, judul: tugas.judul, batasKumpul: tugas.batas_kumpul, token: anak.token });
    if (!bukaWhatsApp(anak.nomor_wa, teks)) {
      toast.error("Nomor wali belum ada.");
      return;
    }
    try {
      await api.post(`/guru/tugas/${tugas.id}/peserta/${anak.peserta_id}/wa-dibuka`);
      load();
    } catch { /* status tetap, tidak menghalangi */ }
  };

  const ingatkanSemua = async (tugas) => {
    const belum = (tugas.antrean || []).filter((a) => a.status !== "kumpul" && a.nomor_wa);
    if (belum.length === 0) { toast.info("Semua sudah kumpul atau belum ada nomor."); return; }
    for (const anak of belum) {
      // Satu per satu agar guru bisa memeriksa tiap pesan.
      // eslint-disable-next-line no-await-in-loop
      await kirim(tugas, anak, true);
    }
  };

  const tugas = (data?.items || []).find((t) => t.id === activeId) || null;

  return (
    <div className="space-y-4" data-testid="guru-tugas">
      {isAdmin && items?.length > 0 && (
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-[#14201A]">Pilih kelas</span>
          <div className="relative">
            <select value={jenjang} onChange={(e) => onPick(e.target.value)}
              className="h-12 w-full appearance-none rounded-xl border border-[#8A948D] bg-white px-3.5 pr-10 text-[15px] outline-none focus:border-[#14633F]">
              {items.map((i) => <option key={i.jenjang} value={i.jenjang}>{i.label} · {i.total_peserta} peserta</option>)}
            </select>
            <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
          </div>
        </label>
      )}

      <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
        <button type="button" onClick={() => setOpenForm((v) => !v)} data-testid="guru-tugas-buka-form"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-[#14201A]">
          <Plus size={16} className="text-[#0E4E31]" /> Buat tugas {label ? `· ${label}` : ""}
        </button>
        {openForm && (
          <div className="mt-2 space-y-2">
            <input value={judul} maxLength={100} onChange={(e) => setJudul(e.target.value)}
              placeholder="Judul tugas" data-testid="guru-tugas-judul"
              className="h-11 w-full rounded-xl border border-[#8A948D] px-3 text-base outline-none focus:border-[#14633F]" />
            <textarea rows={2} value={keterangan} onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Keterangan (opsional)" data-testid="guru-tugas-keterangan"
              className="w-full resize-none rounded-xl border border-[#8A948D] px-3 py-2 text-sm outline-none focus:border-[#14633F]" />
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-[#5F6B63]">Batas kumpul</span>
              <input type="date" value={batas} onChange={(e) => setBatas(e.target.value)} data-testid="guru-tugas-batas"
                className="h-11 rounded-xl border border-[#8A948D] px-3 text-sm outline-none focus:border-[#14633F]" />
            </label>
            <button type="button" onClick={simpan} disabled={saving || !judul.trim() || !batas}
              data-testid="guru-tugas-simpan"
              className="h-11 w-full rounded-xl bg-[#14633F] text-sm font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-50">
              {saving ? "Menyimpan…" : "Simpan dan siapkan pesan"}
            </button>
          </div>
        )}
      </div>

      {data === null ? (
        <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={22} /></div>
      ) : (data.items || []).length === 0 ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-6 text-center text-sm text-[#5F6B63]">
          Belum ada tugas pada kelas ini.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(data.items || []).map((t) => (
              <button key={t.id} type="button" onClick={() => setActiveId(t.id)}
                className={`h-9 rounded-lg px-3 text-xs font-semibold ${activeId === t.id ? "bg-[#14633F] text-white" : "bg-[#F0EEE6] text-[#5F6B63] hover:bg-[#E7E3D8]"}`}>
                {t.judul}
              </button>
            ))}
          </div>

          {tugas && (
            <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="guru-tugas-detail">
              <div className="text-sm font-bold text-[#14201A]">{tugas.judul}</div>
              {tugas.keterangan && <p className="mt-1 text-[13px] text-[#5F6B63]">{tugas.keterangan}</p>}
              <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#5F6B63]">
                <Clock size={11} /> Batas kumpul {tanggalIndonesia(tugas.batas_kumpul)}
              </div>

              <div className="mt-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-[#14201A]">Sudah kumpul {tugas.kumpul} dari {tugas.total}</span>
                  <span className="text-xs font-bold tabular-nums text-[#0E4E31]">
                    {tugas.total ? Math.round((tugas.kumpul / tugas.total) * 100) : 0}%
                  </span>
                </div>
                <div className="mt-1.5">
                  <ProgressBar value={tugas.total ? (tugas.kumpul / tugas.total) * 100 : 0} testid="guru-tugas-bilah" />
                </div>
              </div>

              <button type="button" onClick={() => ingatkanSemua(tugas)} data-testid="guru-tugas-ingatkan"
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-[#14633F] px-3 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA]">
                <Send size={15} /> Ingatkan yang belum
              </button>

              <div className="mt-3 divide-y divide-[#F0EEE6]">
                {(tugas.antrean || []).map((a) => {
                  const chip = STATUS_CHIP[a.status] || STATUS_CHIP.belum;
                  return (
                    <div key={a.peserta_id} className="flex items-center gap-2 py-2.5" data-testid={`guru-tugas-row-${a.peserta_id}`}>
                      <span className="min-w-0 flex-1 truncate text-sm text-[#14201A]">{a.nama}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${chip.cls}`}>
                        {a.status === "kumpul" && <CheckCircle2 size={10} className="mr-0.5 inline" />}{chip.label}
                      </span>
                      <button type="button" disabled={!a.nomor_wa} onClick={() => kirim(tugas, a)}
                        data-testid={`guru-tugas-wa-${a.peserta_id}`}
                        className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-[#14633F] px-2.5 text-[11px] font-semibold text-white hover:bg-[#0E4E31] disabled:bg-[#E7E3D8] disabled:text-[#8A948D]">
                        <Send size={12} /> Buka WhatsApp
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
