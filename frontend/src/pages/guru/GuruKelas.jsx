// Kelas Saya — per jenjang: daftar peserta + persentase kehadiran & tag tidak hadir 3x.
// Tab "Tugas": buat tugas + antrean kirim WhatsApp wali.
import { useEffect, useState } from "react";
import { Loader2, Users, AlertTriangle, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";
import Modal from "@/components/Modal";
import { tanggalPanjang } from "@/pages/admin/kegiatanUtils";
import GuruTugas from "./GuruTugas";

export default function GuruKelas() {
  const [data, setData] = useState(null);
  const [pick, setPick] = useState("");
  const [tab, setTab] = useState("peserta");
  const [detail, setDetail] = useState(null);
  const [catatan, setCatatan] = useState(null);

  useEffect(() => {
    if (!detail) { setCatatan(null); return; }
    setCatatan(null);
    api.get(`/guru/catatan?peserta_id=${detail.user_id}`)
      .then(({ data: d }) => setCatatan(d.rows || []))
      .catch(() => setCatatan([]));
  }, [detail]);

  useEffect(() => {
    api.get("/guru/kelas").then(({ data: d }) => {
      setData(d);
      setPick((d.items || [])[0]?.jenjang || "");
    }).catch(() => setData(false));
  }, []);

  if (data === null) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;
  }
  if (data === false) {
    return <div className="rounded-2xl border border-[#E7E3D8] bg-white p-8 text-center text-sm text-[#5F6B63]">Gagal memuat kelas.</div>;
  }

  const items = data.items || [];
  const isAdmin = data.scope?.mode === "semua";
  const active = items.find((i) => i.jenjang === pick) || items[0];

  return (
    <div className="space-y-4" data-testid="guru-kelas">
      <div>
        <h1 className="font-heading text-xl font-bold text-[#14201A]">Kelas Saya</h1>
        <p className="mt-1 text-sm text-[#5F6B63]">Peserta per jenjang beserta persentase kehadiran.</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-8 text-center text-sm text-[#5F6B63]">
          Belum ada kelas yang diampu.
        </div>
      ) : (
        <>
          <div className="inline-flex rounded-xl bg-[#F0EEE6] p-1" data-testid="guru-kelas-tabs">
            {[["peserta", "Peserta"], ["tugas", "Tugas"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setTab(v)} data-testid={`guru-kelas-tab-${v}`}
                className={`h-9 rounded-lg px-4 text-xs font-semibold ${tab === v ? "bg-white text-[#0E4E31] shadow-sm" : "text-[#5F6B63]"}`}>
                {l}
              </button>
            ))}
          </div>

          {tab === "tugas" ? (
            <GuruTugas jenjang={active?.jenjang || ""} label={active?.label || ""}
              isAdmin={isAdmin} items={items} onPick={setPick} />
          ) : (
          <>
          {isAdmin && (
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-[#14201A]">Pilih kelas</span>
              <div className="relative">
                <select data-testid="guru-kelas-pilih" value={active?.jenjang || ""} onChange={(e) => setPick(e.target.value)}
                  className="h-12 w-full appearance-none rounded-xl border border-[#8A948D] bg-white px-3.5 pr-10 text-[15px] outline-none focus:border-[#14633F]">
                  {items.map((i) => <option key={i.jenjang} value={i.jenjang}>{i.label} · {i.total_peserta} peserta</option>)}
                </select>
                <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
              </div>
            </label>
          )}

          {active && (
            <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid={`guru-kelas-${active.jenjang}`}>
              <div className="flex items-center gap-2 text-sm font-bold text-[#14201A]">
                <Users size={16} className="text-[#0E4E31]" /> {active.label} · {active.total_peserta} peserta
              </div>
              <div className="mt-1 text-xs text-[#5F6B63]" data-testid="guru-kelas-terlaksana">
                Pertemuan terlaksana: <b className="text-[#14201A]">{active.pertemuan_terlaksana ?? 0}</b>
              </div>
              <div className="mt-3 divide-y divide-[#F0EEE6]">
                {active.peserta.length === 0 ? (
                  <p className="py-4 text-sm text-[#5F6B63]">Belum ada peserta pada jenjang ini.</p>
                ) : active.peserta.map((p) => (
                  <button key={p.user_id} type="button" onClick={() => setDetail(p)}
                    className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-[#F6F4EE]"
                    data-testid={`guru-kelas-row-${p.user_id}`}>
                    <span className="min-w-0 flex-1 truncate text-sm text-[#14201A]">{p.name}</span>
                    {p.perhatian_30h && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-[#A32A2A]" aria-label="Ada catatan perhatian 30 hari" />
                    )}
                    {p.tidak_hadir_3x && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FBE5E3] px-2 py-0.5 text-[11px] font-semibold text-[#A32A2A]">
                        <AlertTriangle size={11} /> Tidak hadir 3x
                      </span>
                    )}
                    <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-[#0E4E31]">{p.ratio}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          </>
          )}
        </>
      )}

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)}
        title={detail ? `Catatan ${detail.name}` : "Catatan"} maxWidth={520}
        testid="guru-kelas-catatan-modal">
        {catatan === null ? (
          <div className="py-6 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={20} /></div>
        ) : catatan.length === 0 ? (
          <p className="py-4 text-sm text-[#5F6B63]">Belum ada catatan untuk peserta ini.</p>
        ) : (
          <div className="divide-y divide-[#F0EEE6]">
            {catatan.map((c) => (
              <div key={c.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    c.jenis === "perhatian" ? "bg-[#FBE5E3] text-[#A32A2A]"
                      : c.jenis === "perkembangan" ? "bg-[#E3F3EA] text-[#0E4E31]"
                        : "bg-[#F0EEE6] text-[#5F6B63]"}`}>
                    {c.jenis === "perhatian" ? "Perhatian" : c.jenis === "perkembangan" ? "Perkembangan" : "Catatan"}
                  </span>
                  <span className="text-[11px] text-[#5F6B63]">{tanggalPanjang(String(c.created_at || "").slice(0, 10))}</span>
                </div>
                <p className="mt-1 text-sm text-[#14201A]">{c.isi}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
