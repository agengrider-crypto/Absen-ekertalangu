// Pengumuman Kelas — guru membuat pengumuman untuk kelas yang diajar.
// Administrator/Pengurus melihat semua dan boleh menghapus.
import { useEffect, useState } from "react";
import { Loader2, Megaphone, Plus, Trash2, Pencil, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import Modal from "@/components/Modal";
import TeksPengumuman from "@/components/TeksPengumuman";
import { tanggalPanjang } from "@/pages/admin/kegiatanUtils";

const inp = "w-full h-11 rounded-xl border border-[#8A948D] px-3 text-base outline-none focus:border-[#14633F] bg-white";

export default function GuruPengumuman() {
  const [data, setData] = useState(null);
  const [kelas, setKelas] = useState([]);
  const [form, setForm] = useState(null); // { id?, jenjang: [], judul, isi, berlaku_sampai }
  const [saving, setSaving] = useState(false);
  const [hapus, setHapus] = useState(null);

  const load = () => {
    setData(null);
    api.get("/guru/pengumuman")
      .then(({ data: d }) => setData(d))
      .catch(() => setData({ items: [], jenjang: [] }));
  };

  useEffect(() => {
    load();
    api.get("/guru/kelas")
      .then(({ data: d }) => setKelas(d.items || []))
      .catch(() => setKelas([]));
  }, []);

  const buka = (p) => setForm(p
    ? { id: p.id, jenjang: [p.jenjang], judul: p.judul || "", isi: p.isi || "", berlaku_sampai: p.berlaku_sampai || "" }
    : { id: null, jenjang: [], judul: "", isi: "", berlaku_sampai: "" });

  const simpan = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const payload = {
        jenjang: form.jenjang, judul: form.judul.trim(), isi: form.isi.trim(),
        berlaku_sampai: form.berlaku_sampai || null,
      };
      if (form.id) await api.patch(`/guru/pengumuman/${form.id}`, payload);
      else await api.post("/guru/pengumuman", payload);
      toast.success("Pengumuman tersimpan");
      setForm(null);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const hapusPengumuman = async (id) => {
    try {
      await api.delete(`/guru/pengumuman/${id}`);
      toast.success("Pengumuman dihapus");
      setHapus(null);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const toggleKelas = (j) => setForm((f) => ({
    ...f,
    jenjang: f.jenjang.includes(j) ? f.jenjang.filter((x) => x !== j) : [...f.jenjang, j],
  }));

  if (data === null) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;
  }

  return (
    <div className="space-y-4" data-testid="guru-pengumuman">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-[#14201A]">Pengumuman Kelas</h1>
          <p className="mt-1 text-sm text-[#5F6B63]">Pengumuman untuk peserta di kelas yang Anda ajar.</p>
        </div>
        <button type="button" onClick={() => buka(null)} data-testid="guru-pengumuman-buat"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]">
          <Plus size={16} /> Buat pengumuman
        </button>
      </div>

      {data.items.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-8 text-center text-sm text-[#5F6B63]">
          Belum ada pengumuman.
        </div>
      ) : (
        <div className="space-y-2">
          {data.items.map((p) => (
            <div key={p.id} className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid={`guru-pengumuman-${p.id}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-[#E3F3EA] px-2 py-0.5 text-[11px] font-semibold text-[#0E4E31]">
                  {p.jenjang_label || p.jenjang}
                </span>
                <span className="text-[11px] text-[#5F6B63]">{tanggalPanjang(String(p.dibuat_at || "").slice(0, 10))}</span>
                {p.berlaku_sampai && (
                  <span className="text-[11px] text-[#5F6B63]">· berlaku s.d. {tanggalPanjang(p.berlaku_sampai)}</span>
                )}
                <span className="ml-auto flex gap-1">
                  <button type="button" onClick={() => buka(p)} aria-label="Ubah pengumuman"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6]">
                    <Pencil size={15} />
                  </button>
                  <button type="button" onClick={() => setHapus(p.id)} aria-label="Hapus pengumuman"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[#A32A2A] hover:bg-[#FBE5E3]">
                    <Trash2 size={15} />
                  </button>
                </span>
              </div>
              <div className="mt-1.5 text-sm font-bold text-[#14201A]">{p.judul}</div>
              <TeksPengumuman text={p.isi} className="mt-1 text-sm leading-relaxed text-[#14201A]" />
              <div className="mt-1 text-[11px] text-[#5F6B63]">{p.guru_nama}</div>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(form)} onClose={() => setForm(null)}
        title={form?.id ? "Ubah pengumuman" : "Buat pengumuman"} maxWidth={560}
        testid="guru-pengumuman-form"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(null)}
              className="h-11 flex-1 rounded-xl border-2 border-[#E7E3D8] font-semibold text-[#5F6B63] hover:bg-[#F6F4EE]">Batal</button>
            <button type="button" onClick={simpan} disabled={saving || !form?.judul?.trim() || !form?.isi?.trim() || form?.jenjang?.length === 0}
              className="h-11 flex-1 rounded-xl bg-[#14633F] font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-50">
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        }>
        {form && (
          <div className="space-y-3">
            {!form.id && (
              <div>
                <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Kelas (boleh lebih dari satu)</span>
                <div className="flex flex-wrap gap-1.5">
                  {kelas.length === 0 ? (
                    <p className="text-sm text-[#5F6B63]">Belum ada kelas yang diampu.</p>
                  ) : kelas.map((k) => (
                    <button key={k.jenjang} type="button" onClick={() => toggleKelas(k.jenjang)}
                      className={`h-9 rounded-lg px-3 text-xs font-semibold ${form.jenjang.includes(k.jenjang) ? "bg-[#14633F] text-white" : "bg-[#F0EEE6] text-[#5F6B63] hover:bg-[#E7E3D8]"}`}>
                      {k.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Judul</span>
              <input value={form.judul} maxLength={80} onChange={(e) => setForm((f) => ({ ...f, judul: e.target.value }))}
                placeholder="Judul pengumuman" className={inp} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Isi</span>
              <textarea rows={5} value={form.isi} maxLength={500}
                onChange={(e) => setForm((f) => ({ ...f, isi: e.target.value }))}
                placeholder="Tulis pengumuman…"
                className="w-full resize-none rounded-xl border border-[#8A948D] px-3 py-2 text-sm outline-none focus:border-[#14633F]" />
              <span className="mt-0.5 block text-right text-[11px] text-[#5F6B63]">{form.isi.length}/500</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Berlaku sampai (opsional)</span>
              <input type="date" value={form.berlaku_sampai}
                onChange={(e) => setForm((f) => ({ ...f, berlaku_sampai: e.target.value }))} className={inp} />
            </label>
          </div>
        )}
      </Modal>

      <Modal open={hapus !== null} onClose={() => setHapus(null)} title="Hapus pengumuman ini?"
        maxWidth={420} hideClose testid="guru-pengumuman-hapus">
        <p className="text-sm text-[#5F6B63]">Pengumuman tidak akan tampil lagi di kelas.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setHapus(null)}
            className="h-11 flex-1 rounded-xl border-2 border-[#E7E3D8] font-semibold text-[#5F6B63] hover:bg-[#F6F4EE]">Batal</button>
          <button type="button" onClick={() => hapusPengumuman(hapus)}
            className="h-11 flex-1 rounded-xl bg-[#A32A2A] font-semibold text-white hover:bg-[#8C2323]">Ya, hapus</button>
        </div>
      </Modal>
    </div>
  );
}
