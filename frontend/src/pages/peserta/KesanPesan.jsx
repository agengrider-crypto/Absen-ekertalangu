// FASE 15 — Panel kesan & pesan kegiatan (Suka/Tidak Suka + pesan) di dashboard jamaah.
import { useEffect, useState } from "react";
import { MessageSquareQuote, ThumbsUp, ThumbsDown, Loader2, X, CheckCircle2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto" data-testid="modal-kesan-pesan">
        <div className="sticky top-0 bg-white border-b border-[#E8E8E4] px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-heading font-bold text-[#111827]">Kesan &amp; Pesan</h3>
            <p className="text-xs text-[#6B7280] truncate">{item.name}{item.session_label ? ` (${item.session_label})` : ""}</p>
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"><X size={19} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold text-[#374151]">Bagaimana kegiatan ini?</div>
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
                    className={`rounded-2xl border-2 p-3 text-center transition-colors ${on ? "border-[#3730A3] bg-[#EEEFFB]" : "border-[#E8E8E4] bg-white"}`}
                  >
                    <Icon size={22} className={`mx-auto ${on ? "text-[#3730A3]" : "text-[#9CA3AF]"}`} />
                    <div className={`mt-1.5 font-semibold text-sm ${on ? "text-[#312E81]" : "text-[#374151]"}`}>{o.label}</div>
                    <div className="text-[11px] text-[#6B7280] mt-0.5 leading-snug">{o.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-[#374151]">Kesan dan Pesan</label>
            <textarea
              data-testid="kesan-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 3000))}
              rows={5}
              placeholder="Tulis kesan dan pesan Anda di sini…"
              className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#3730A3] resize-none"
            />
            <div className="text-right text-xs text-[#9CA3AF] mt-1">{message.length}/3000</div>
          </div>

          <button
            data-testid="kesan-kirim"
            onClick={kirim}
            disabled={saving}
            className="w-full h-12 rounded-xl bg-[#3730A3] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-[#2A2480] disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <MessageSquareQuote size={18} />} Kirim Kesan &amp; Pesan
          </button>
        </div>
      </div>
    </div>
  );
}

/** Kesan & pesan untuk kegiatan yang sudah dihadiri jamaah (tampil di dashboard). */
export default function KesanPesan() {
  const [items, setItems] = useState(null);
  const [active, setActive] = useState(null);

  const load = () => api.get("/me/kesan-pesan").then(({ data }) => setItems(data.items || [])).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  if (items === null) {
    return <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#3730A3]" size={22} /></div>;
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5" data-testid="kesan-pesan-panel">
      <div className="flex items-center gap-2 text-[#3730A3] font-heading font-bold">
        <MessageSquareQuote size={18} /> Kesan &amp; Pesan Kegiatan
      </div>
      <p className="text-xs text-[#6B7280] mt-0.5">Sampaikan kesan dan pesan Anda setelah mengikuti kegiatan.</p>

      {items.length === 0 ? (
        <div className="mt-3 rounded-xl bg-[#FAFAF8] border border-dashed border-[#CBD5E1] p-5 text-center text-sm text-[#6B7280]" data-testid="kesan-empty">
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
              className="w-full text-left rounded-xl border-2 border-[#E8E8E4] p-3 hover:border-[#3730A3] hover:bg-[#F5F5FD] transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-[#111827] truncate">
                    {it.name}{it.session_label ? ` · ${it.session_label}` : ""}
                  </div>
                  <div className="text-xs text-[#6B7280] mt-0.5 inline-flex items-center gap-1">
                    <CalendarDays size={12} /> {tanggalSingkat(it.date)} · {it.start_time}–{it.end_time} WITA
                  </div>
                </div>
                {it.sudah_kirim ? (
                  <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full bg-[#EEEFFB] text-[#312E81] inline-flex items-center gap-1">
                    <CheckCircle2 size={12} /> terkirim
                  </span>
                ) : (
                  <span className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full bg-[#FEF3C7] text-[#92400E]">beri kesan</span>
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
