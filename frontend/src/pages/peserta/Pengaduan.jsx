import { useEffect, useState } from "react";
import { MessageSquareHeart, Loader2, Send, HeartHandshake, Clock, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

const CATEGORIES = [
  { value: "curhat", label: "Curhat / Konsultasi" },
  { value: "saran", label: "Saran & Masukan" },
  { value: "pengaduan", label: "Pengaduan" },
];

export default function Pengaduan() {
  const [category, setCategory] = useState("curhat");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [riwayat, setRiwayat] = useState(null);

  const load = () => api.get("/me/pengaduan").then(({ data }) => setRiwayat(data.items || [])).catch(() => setRiwayat([]));
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#111827] flex items-center gap-2">
          <MessageSquareHeart size={22} className="text-[#0D5C3A]" /> Curhat &amp; Pengaduan
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">Sampaikan apa pun yang Anda rasakan — pesan ini langsung sampai ke pengurus.</p>
      </div>

      <div className="bg-[#F0FAF4] border border-[#BBF7D0] rounded-2xl p-4 text-sm text-[#065F46] flex gap-2.5" data-testid="pengaduan-kata-baik">
        <HeartHandshake size={18} className="shrink-0 mt-0.5" />
        <span>
          Assalamu'alaikum warahmatullahi wabarakatuh. Silakan bercerita dengan tenang dan apa adanya —
          keluh, saran, maupun kesulitan Anda. Insya Allah dijaga kerahasiaannya dan ditindaklanjuti dengan baik
          oleh pengurus. Jazakumullahu khoiro.
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 space-y-3">
        <div>
          <label className="text-sm font-semibold text-[#374151]">Jenis pesan</label>
          <div className="mt-1.5 flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                data-testid={`pengaduan-cat-${c.value}`}
                onClick={() => setCategory(c.value)}
                className={`h-10 px-3.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                  category === c.value ? "border-[#0D5C3A] bg-[#E8F5EE] text-[#065F46]" : "border-[#E5E7EB] text-[#4B5563]"
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
            data-testid="pengaduan-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            placeholder="Tuliskan di sini… (contoh: kesulitan hadir sesi pagi karena jam kerja, usulan materi, atau hal yang ingin dicurahkan)"
            className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] resize-none"
          />
          <div className="text-xs text-[#9CA3AF] mt-1">{message.trim().length} huruf</div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input data-testid="pengaduan-anonim" type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-[#0D5C3A]" />
          <span className="text-sm text-[#374151]">Kirim <b>tanpa nama</b> (pengurus tidak melihat identitas Anda)</span>
        </label>

        <button
          data-testid="pengaduan-kirim"
          onClick={kirim}
          disabled={saving}
          className="w-full h-12 rounded-xl bg-[#0D5C3A] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} Kirim ke Pengurus
        </button>
      </div>

      <div>
        <h2 className="font-heading font-bold text-[#111827] mb-2">Pesan yang pernah Anda kirim</h2>
        {riwayat === null ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={22} /></div>
        ) : riwayat.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 text-center text-sm text-[#6B7280]" data-testid="pengaduan-riwayat-empty">
            Belum ada pesan terkirim.
          </div>
        ) : (
          <div className="space-y-2" data-testid="pengaduan-riwayat">
            {riwayat.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-4" data-testid={`pengaduan-riwayat-${r.id}`}>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-semibold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#3730A3]">{r.category_label}</span>
                  {r.anonymous && <span className="font-semibold px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#4B5563]">tanpa nama</span>}
                  <span className="text-[#9CA3AF] inline-flex items-center gap-1"><Clock size={11} /> {String(r.at).slice(0, 16).replace("T", " ")} WITA</span>
                  {r.dibaca && <span className="text-[#065F46] font-semibold inline-flex items-center gap-1"><CheckCheck size={12} /> sudah dibaca pengurus</span>}
                </div>
                <p className="text-sm text-[#374151] mt-1.5 whitespace-pre-wrap">{r.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
