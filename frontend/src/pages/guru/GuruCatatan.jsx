// Catatan Peserta — catat cepat + riwayat. Hanya guru kelas & administrator.
import { useEffect, useMemo, useState } from "react";
import { Loader2, NotebookPen, Search, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import Modal from "@/components/Modal";
import { tanggalPanjang } from "@/pages/admin/kegiatanUtils";

const JENIS = [
  ["perhatian", "Perhatian", "bg-[#FBE5E3] text-[#A32A2A]"],
  ["perkembangan", "Perkembangan", "bg-[#E3F3EA] text-[#0E4E31]"],
  ["catatan", "Catatan", "bg-[#F0EEE6] text-[#5F6B63]"],
];
const JENIS_CLS = Object.fromEntries(JENIS.map(([v, , c]) => [v, c]));
const JENIS_LABEL = Object.fromEntries(JENIS.map(([v, l]) => [v, l]));
const ISI_MAX = 300;

export default function GuruCatatan() {
  const [kelas, setKelas] = useState(null);
  const [jenjang, setJenjang] = useState("");
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [pesertaId, setPesertaId] = useState("");
  const [jenis, setJenis] = useState("catatan");
  const [isi, setIsi] = useState("");
  const [saving, setSaving] = useState(false);
  const [hapus, setHapus] = useState(null);

  useEffect(() => {
    api.get("/guru/kelas").then(({ data: d }) => {
      setKelas(d);
      setJenjang((d.items || [])[0]?.jenjang || "");
    }).catch(() => setKelas(false));
  }, []);

  const load = (j) => {
    setRows(null);
    api.get(`/guru/catatan${j ? `?jenjang=${j}` : ""}`)
      .then(({ data: d }) => setRows(d.rows || []))
      .catch(() => setRows([]));
  };

  useEffect(() => { if (jenjang) load(jenjang); }, [jenjang]);

  const items = kelas?.items || [];
  const isAdmin = kelas?.scope?.mode === "semua";
  const active = items.find((i) => i.jenjang === jenjang) || items[0];
  const peserta = useMemo(() => {
    const list = active?.peserta || [];
    const t = q.trim().toLowerCase();
    return t ? list.filter((p) => (p.name || "").toLowerCase().includes(t)) : list;
  }, [active, q]);

  const simpan = async () => {
    if (!pesertaId || !isi.trim()) return;
    setSaving(true);
    try {
      await api.post("/guru/catatan", { peserta_id: pesertaId, jenis, isi: isi.trim() });
      setIsi("");
      toast.success("Catatan tersimpan");
      load(jenjang);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const hapusCatatan = async (id) => {
    try {
      await api.delete(`/guru/catatan/${id}`);
      toast.success("Catatan dihapus");
      setHapus(null);
      load(jenjang);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  if (kelas === null) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;
  }

  return (
    <div className="space-y-4" data-testid="guru-catatan">
      <div>
        <h1 className="font-heading text-xl font-bold text-[#14201A]">Catatan Peserta</h1>
        <p className="mt-1 text-[11px] text-[#5F6B63]">
          Catatan ini hanya terlihat oleh guru kelas dan administrator.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-8 text-center text-sm text-[#5F6B63]">
          Belum ada kelas yang diampu.
        </div>
      ) : (
        <>
          {isAdmin && (
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#14201A]">Pilih kelas</span>
              <div className="relative">
                <select data-testid="guru-catatan-kelas" value={active?.jenjang || ""} onChange={(e) => setJenjang(e.target.value)}
                  className="h-12 w-full appearance-none rounded-xl border border-[#8A948D] bg-white px-3.5 pr-10 text-[15px] outline-none focus:border-[#14633F]">
                  {items.map((i) => <option key={i.jenjang} value={i.jenjang}>{i.label} · {i.total_peserta} peserta</option>)}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
              </div>
            </label>
          )}

          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="guru-catatan-form">
            <div className="inline-flex items-center gap-1.5 text-sm font-bold text-[#14201A]">
              <NotebookPen size={16} className="text-[#0E4E31]" /> Catat cepat
            </div>

            <div className="relative mt-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari peserta…"
                className="h-11 w-full rounded-xl border border-[#8A948D] pl-9 pr-3 text-base outline-none focus:border-[#14633F]" />
            </div>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-[#E7E3D8]">
              {peserta.length === 0 ? (
                <p className="p-3 text-sm text-[#5F6B63]">Peserta tidak ditemukan.</p>
              ) : peserta.map((p) => (
                <button key={p.user_id} type="button" onClick={() => setPesertaId(p.user_id)}
                  data-testid={`guru-catatan-peserta-${p.user_id}`}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm ${pesertaId === p.user_id ? "bg-[#E3F3EA] font-semibold text-[#0E4E31]" : "text-[#14201A] hover:bg-[#F6F4EE]"}`}>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.perhatian_30h && <span className="h-2 w-2 shrink-0 rounded-full bg-[#A32A2A]" aria-label="Ada catatan perhatian" />}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {JENIS.map(([v, l]) => (
                <button key={v} type="button" onClick={() => setJenis(v)} data-testid={`guru-catatan-jenis-${v}`}
                  className={`h-9 rounded-lg px-3 text-xs font-semibold ${jenis === v ? "bg-[#14633F] text-white" : "bg-[#F0EEE6] text-[#5F6B63] hover:bg-[#E7E3D8]"}`}>
                  {l}
                </button>
              ))}
            </div>

            <textarea rows={3} value={isi} maxLength={ISI_MAX} onChange={(e) => setIsi(e.target.value)}
              placeholder="Tulis catatan singkat…" data-testid="guru-catatan-isi"
              className="mt-2 w-full resize-none rounded-xl border border-[#8A948D] px-3 py-2 text-sm outline-none focus:border-[#14633F]" />
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#5F6B63]">{isi.length}/{ISI_MAX}</span>
              <button type="button" onClick={simpan} disabled={saving || !pesertaId || !isi.trim()}
                data-testid="guru-catatan-simpan"
                className="h-11 rounded-xl bg-[#14633F] px-5 text-sm font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-50">
                {saving ? "Menyimpan…" : "Simpan"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="guru-catatan-riwayat">
            <div className="text-sm font-bold text-[#14201A]">Riwayat catatan terbaru</div>
            {rows === null ? (
              <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={20} /></div>
            ) : rows.length === 0 ? (
              <p className="py-4 text-sm text-[#5F6B63]">Belum ada catatan pada kelas ini.</p>
            ) : (
              <div className="mt-2 divide-y divide-[#F0EEE6]">
                {rows.map((c) => (
                  <div key={c.id} className="flex items-start gap-2 py-2.5" data-testid={`guru-catatan-row-${c.id}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-[#14201A]">{c.peserta_nama || "Peserta"}</span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${JENIS_CLS[c.jenis] || JENIS_CLS.catatan}`}>
                          {JENIS_LABEL[c.jenis] || "Catatan"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[13px] text-[#5F6B63]">{c.isi}</p>
                      <div className="text-[11px] text-[#5F6B63]">{tanggalPanjang(String(c.created_at || "").slice(0, 10))}</div>
                    </div>
                    <button type="button" onClick={() => setHapus(c.id)} aria-label="Hapus catatan"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#A32A2A] hover:bg-[#FBE5E3]">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Modal open={hapus !== null} onClose={() => setHapus(null)} title="Hapus catatan ini?" maxWidth={420} hideClose
        testid="guru-catatan-konfirmasi"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setHapus(null)}
              className="h-11 flex-1 rounded-xl border-2 border-[#E7E3D8] font-semibold text-[#5F6B63] hover:bg-[#F6F4EE]">Batal</button>
            <button type="button" onClick={() => hapusCatatan(hapus)}
              className="h-11 flex-1 rounded-xl bg-[#A32A2A] font-semibold text-white hover:bg-[#8C2323]">Ya, hapus</button>
          </div>
        }>
        <p className="text-sm text-[#5F6B63]">Catatan tidak bisa dikembalikan.</p>
      </Modal>
    </div>
  );
}
