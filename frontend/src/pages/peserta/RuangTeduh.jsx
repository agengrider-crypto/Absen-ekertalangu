// FASE 16 — "Ruang Teduh": ruang aman jamaah untuk curhat, bertanya, atau menyampaikan kendala.
import { useEffect, useState } from "react";
import { HeartHandshake, Loader2, Send, Clock, CheckCheck, Trash2, Eraser } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

const FALLBACK_CATEGORIES = [
  { value: "curhat", label: "Curhat / Konsultasi" },
  { value: "saran", label: "Saran & Masukan" },
  { value: "pengaduan", label: "Pengaduan" },
  { value: "doa", label: "Permohonan Doa" },
  { value: "kendala", label: "Kendala Hadir" },
  { value: "pertanyaan", label: "Pertanyaan Keagamaan" },
];

export default function RuangTeduh() {
  const [category, setCategory] = useState("curhat");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [riwayat, setRiwayat] = useState(null);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [maxLength, setMaxLength] = useState(5000);

  const load = () =>
    api.get("/me/pengaduan")
      .then(({ data }) => {
        setRiwayat(data.items || []);
        if (data.categories?.length) setCategories(data.categories);
        if (data.max_length) setMaxLength(data.max_length);
      })
      .catch(() => setRiwayat([]));

  useEffect(() => { load(); }, []);

  const kirim = async () => {
    if (message.trim().length < 10) {
      toast.error("Mohon tuliskan pesan minimal 10 huruf agar pengurus memahami keadaan Anda.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/me/pengaduan", { message: message.trim(), category, anonymous });
      toast.success(data.message);
      setMessage("");
      setAnonymous(false);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setSaving(false);
  };

  const hapus = async (id) => {
    if (!window.confirm("Hapus pesan ini dari riwayat Anda?")) return;
    try {
      await api.delete(`/me/pengaduan/${id}`);
      toast.success("Pesan dihapus");
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const hapusSemua = async () => {
    if (!window.confirm("Hapus SEMUA riwayat pesan Anda? Tindakan ini tidak bisa dibatalkan.")) return;
    try {
      const { data } = await api.delete("/me/pengaduan");
      toast.success(`${data.deleted} pesan dihapus`);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#111114] flex items-center gap-2">
          <HeartHandshake size={22} className="text-[#3730A3]" /> Ruang Teduh
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">Tempat menyampaikan isi hati, pertanyaan, atau kendala Anda kepada pengurus.</p>
      </div>

      <div className="rounded-2xl border border-[#DCDCF5] bg-[#F5F5FD] p-4 text-sm text-[#312E81] flex gap-2.5" data-testid="ruangteduh-kata-baik">
        <HeartHandshake size={18} className="shrink-0 mt-0.5" />
        <span>
          Assalamu'alaikum warahmatullahi wabarakatuh. Silakan bercerita dengan tenang dan apa adanya.
          Insya Allah dijaga kerahasiaannya dan ditindaklanjuti dengan baik oleh pengurus. Jazakumullahu khoiro.
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5 space-y-5">
        <div>
          <label className="text-sm font-semibold text-[#374151]">Jenis pesan</label>
          <div className="mt-2 flex gap-2 flex-wrap">
            {categories.map((c) => (
              <button
                key={c.value}
                type="button"
                data-testid={`ruangteduh-cat-${c.value}`}
                onClick={() => setCategory(c.value)}
                className={`h-10 px-3.5 rounded-full border text-sm font-semibold transition-colors ${
                  category === c.value
                    ? "border-[#3730A3] bg-[#EEEFFB] text-[#312E81]"
                    : "border-[#E8E8E4] text-[#6B7280] hover:border-[#3730A3] hover:text-[#3730A3]"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-[#374151]">Pesan Anda</label>
          <textarea
            data-testid="ruangteduh-message"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, maxLength))}
            rows={8}
            placeholder="Tuliskan di sini… (contoh: kesulitan hadir sesi pagi karena jam kerja, pertanyaan tentang materi, atau hal yang ingin dicurahkan)"
            className="mt-2 w-full px-3.5 py-2.5 rounded-xl border border-[#E8E8E4] text-sm outline-none focus:border-[#3730A3] resize-none leading-relaxed"
          />
          <div className="text-xs text-[#9CA3AF] mt-1 text-right">{message.length} / {maxLength} huruf</div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input data-testid="ruangteduh-anonim" type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-[#3730A3]" />
          <span className="text-sm text-[#374151]">Kirim <b>tanpa nama</b> (pengurus tidak melihat identitas Anda)</span>
        </label>

        <button
          data-testid="ruangteduh-kirim"
          onClick={kirim}
          disabled={saving}
          className="w-full h-12 rounded-xl bg-[#3730A3] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-[#2A2480] transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} Kirim ke Pengurus
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="font-heading font-bold text-[#111114]">Riwayat pesan Anda</h2>
          {riwayat?.length > 0 && (
            <button data-testid="ruangteduh-hapus-semua" onClick={hapusSemua}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#E8E8E4] text-[#DC2626] font-semibold text-xs hover:bg-red-50">
              <Eraser size={14} /> Hapus semua
            </button>
          )}
        </div>
        {riwayat === null ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#3730A3]" size={22} /></div>
        ) : riwayat.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E8E4] p-6 text-center text-sm text-[#6B7280]" data-testid="ruangteduh-riwayat-empty">
            Belum ada pesan terkirim.
          </div>
        ) : (
          <div className="space-y-2" data-testid="ruangteduh-riwayat">
            {riwayat.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-[#E8E8E4] p-4" data-testid={`ruangteduh-riwayat-${r.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-semibold px-2 py-0.5 rounded-full bg-[#EEEFFB] text-[#312E81]">{r.category_label}</span>
                    {r.anonymous && <span className="font-semibold px-2 py-0.5 rounded-full bg-[#F4F4F1] text-[#6B7280]">tanpa nama</span>}
                    <span className="text-[#9CA3AF] inline-flex items-center gap-1"><Clock size={11} /> {String(r.at).slice(0, 16).replace("T", " ")} WITA</span>
                    {r.dibaca && <span className="text-[#312E81] font-semibold inline-flex items-center gap-1"><CheckCheck size={12} /> sudah dibaca pengurus</span>}
                  </div>
                  <button data-testid={`ruangteduh-hapus-${r.id}`} onClick={() => hapus(r.id)}
                    className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-[#DC2626] hover:bg-red-50" title="Hapus pesan ini">
                    <Trash2 size={15} />
                  </button>
                </div>
                <p className="text-sm text-[#374151] mt-2 whitespace-pre-wrap leading-relaxed">{r.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
