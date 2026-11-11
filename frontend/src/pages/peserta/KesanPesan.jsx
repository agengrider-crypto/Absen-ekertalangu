// FASE 15 — Panel kesan & pesan kegiatan (Suka/Tidak Suka + pesan) di dashboard peserta.
import { useEffect, useState } from "react";
import { MessageSquareQuote, ThumbsUp, ThumbsDown, Loader2, CheckCircle2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import Modal from "@/components/Modal";
import { tanggalSingkat } from "@/pages/admin/kegiatanUtils";

function FormModal({ item, onClose, onDone }) {
  const [sentiment, setSentiment] = useState(item.sentiment || "suka");
  const [message, setMessage] = useState(item.message || "");
  const [saving, setSaving] = useState(false);

  const kirim = async () => {
    if (message.trim().length < 5) { toast.error("Mohon tuliskan kesan & pesan Anda terlebih dahulu."); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/me/kesan-pesan", {
        kegiatan_id: item.kegiatan_id, sentiment, message: message.trim(),
      });
      toast.success(data.message);
      onDone();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setSaving(false);
  };

  return (
    <Modal
      onClose={onClose}
      title="Kesan & Pesan"
      subtitle={`${item.name}${item.session_label ? ` (${item.session_label})` : ""}`}
      testid="modal-kesan-pesan"
      maxWidth={640}
      bodyClassName="p-5 space-y-4"
      footer={(
        <button
          data-testid="kesan-kirim"
          onClick={kirim}
          disabled={saving}
          className="w-full h-12 rounded-xl bg-[#0B6B52] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-[#0E4E31] disabled:opacity-60"
        >
          {saving ? <Loader2 className="animate-spin" size={18} /> : <MessageSquareQuote size={18} />} Kirim Kesan &amp; Pesan
        </button>
      )}
    >
          <div>
            <div className="text-sm font-semibold text-[#14201A]">Bagaimana kegiatan ini?</div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {[
                { key: "suka", label: "Suka", desc: "Suka dengan kegiatan seperti ini", icon: ThumbsUp },
                { key: "tidak_suka", label: "Tidak Suka", desc: "Ada yang perlu diperbaiki", icon: ThumbsDown },
              ].map((o) => {
                const Icon = o.icon;
                const on = sentiment === o.key;
                return (
                  <button
                    key={o.key}
                    type="button"
                    data-testid={`kesan-sentiment-${o.key}`}
                    onClick={() => setSentiment(o.key)}
                    className={`rounded-2xl border-2 p-3 text-center transition-colors ${on ? "border-[#14633F] bg-[#E3F3EA]" : "border-[#E7E3D8] bg-white"}`}
                  >
                    <Icon size={22} className={`mx-auto ${on ? "text-[#0E4E31]" : "text-[#5F6B63]"}`} />
                    <div className={`mt-1.5 font-semibold text-sm ${on ? "text-[#0E4E31]" : "text-[#14201A]"}`}>{o.label}</div>
                    <div className="text-[11px] text-[#5F6B63] mt-0.5 leading-snug">{o.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-[#14201A]">Kesan dan Pesan</label>
            <textarea
              data-testid="kesan-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 3000))}
              rows={5}
              placeholder="Tulis kesan dan pesan Anda di sini…"
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] resize-none"
            />
            <div className="text-right text-xs text-[#5F6B63] mt-1">{message.length}/3000</div>
          </div>
    </Modal>
  );
}

/** Kesan & pesan untuk kegiatan yang sudah dihadiri peserta (tampil di dashboard). */
export default function KesanPesan() {
  const [items, setItems] = useState(null);
  const [active, setActive] = useState(null);

  const load = () => api.get("/me/kesan-pesan").then(({ data }) => setItems(data.items || [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  if (items === null) {
    return <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={22} /></div>;
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5" data-testid="kesan-pesan-panel">
      <div className="flex items-center gap-2 text-[#0E4E31] font-heading font-bold">
        <MessageSquareQuote size={18} /> Kesan &amp; Pesan Kegiatan
      </div>
      <p className="text-xs text-[#5F6B63] mt-0.5">Sampaikan kesan dan pesan Anda setelah mengikuti kegiatan.</p>

      {items.length === 0 ? (
        <div className="mt-3 rounded-xl bg-[#F6F4EE] border border-dashed border-[#D9D4C5] p-5 text-center text-sm text-[#5F6B63]" data-testid="kesan-empty">
          Belum ada kegiatan yang Anda hadiri dalam 30 hari terakhir.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {items.map((it) => (
            <button
              key={it.kegiatan_id}
              type="button"
              data-testid={`kesan-item-${it.kegiatan_id}`}
              onClick={() => setActive(it)}
              className="w-full text-left rounded-xl border-2 border-[#E7E3D8] p-3 hover:border-[#14633F] hover:bg-[#F6F4EE] transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-[#14201A] truncate">
                    {it.name}{it.session_label ? ` · ${it.session_label}` : ""}
                  </div>
                  <div className="text-xs text-[#5F6B63] mt-0.5 inline-flex items-center gap-1">
                    <CalendarDays size={12} /> {tanggalSingkat(it.date)} · {it.start_time}–{it.end_time} WITA
                  </div>
                </div>
                {it.sudah_kirim ? (
                  <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full bg-[#E3F3EA] text-[#0E4E31] inline-flex items-center gap-1">
                    <CheckCircle2 size={12} /> terkirim
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full bg-[#FBF1D6] text-[#6B4500]">beri kesan</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {active && <FormModal item={active} onClose={() => setActive(null)} onDone={() => { setActive(null); load(); }} />}
    </div>
  );
}
