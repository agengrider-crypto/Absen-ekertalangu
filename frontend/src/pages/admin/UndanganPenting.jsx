// FASE 18 — Undangan Penting: centang peserta yang diundang ke kegiatan ini.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MailWarning, Search, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

export default function UndanganPenting({ kegiatanId }) {
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState([]);
  const [message, setMessage] = useState("");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get(`/staff/kegiatan/${kegiatanId}/undangan`)
      .then(({ data: d }) => {
        setData(d);
        setPicked(d.user_ids || []);
        setMessage(d.message || "");
      })
      .catch((e) => { setData({ peserta: [] }); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = data?.peserta || [];
    return t ? base.filter((p) => (p.name || "").toLowerCase().includes(t)) : base;
  }, [data, q]);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async () => {
    if (picked.length === 0) { toast.error("Mohon centang minimal 1 peserta."); return; }
    setSaving(true);
    try {
      const { data: d } = await api.post(`/staff/kegiatan/${kegiatanId}/undangan`, {
        user_ids: picked, message: message.trim(),
      });
      toast.success(d.message_ok || "Undangan penting terkirim.");
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } finally { setSaving(false); }
  };

  const cancel = async () => {
    if (!window.confirm("Batalkan undangan penting kegiatan ini?")) return;
    try {
      await api.delete(`/staff/kegiatan/${kegiatanId}/undangan`);
      toast.success("Undangan penting dibatalkan.");
      setPicked([]); setMessage("");
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  if (!data) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;

  const terkirim = (data.user_ids || []).length;

  return (
    <div className="space-y-3" data-testid="detail-undangan-panel">
      <div className="rounded-2xl border-2 border-[#FBE5E3] bg-[#FBE5E3] p-4">
        <div className="font-bold text-[#A32A2A] text-[15px] inline-flex items-center gap-2">
          <MailWarning size={17} /> Undangan Penting
        </div>
        <p className="text-sm text-[#A32A2A]/90 mt-1 leading-relaxed">
          Centang peserta yang <b>wajib/diharapkan hadir</b> pada kegiatan ini. Undangan langsung
          muncul di <b>lonceng notifikasi</b> dan <b>halaman peserta</b> yang dicentang.
        </p>
        {terkirim > 0 && (
          <p className="text-xs font-semibold text-[#A32A2A] mt-2" data-testid="undangan-terkirim">
            Sudah terkirim ke {terkirim} peserta{data.created_by_name ? ` · oleh ${data.created_by_name}` : ""}.
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4 space-y-3">
        <div>
          <label className="block text-sm font-semibold text-[#14201A] mb-1.5">Pesan undangan (opsional)</label>
          <textarea
            data-testid="undangan-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Mis. Mohon hadir 15 menit lebih awal, ada pembahasan penting."
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] resize-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
            <label className="text-sm font-semibold text-[#14201A]">
              Peserta diundang <span className="text-[#5F6B63] font-medium">({picked.length} dicentang)</span>
            </label>
            <div className="flex gap-2">
              <button type="button" data-testid="undangan-check-all"
                onClick={() => setPicked(rows.map((r) => r.user_id))}
                className="h-8 px-2.5 rounded-lg border border-[#E7E3D8] text-xs font-semibold text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]">
                Centang semua
              </button>
              <button type="button" data-testid="undangan-uncheck-all" onClick={() => setPicked([])}
                className="h-8 px-2.5 rounded-lg border border-[#E7E3D8] text-xs font-semibold text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]">
                Kosongkan
              </button>
            </div>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
            <input data-testid="undangan-search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama peserta…"
              className="w-full h-11 pl-9 pr-3 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] bg-white" />
          </div>
          <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-[#E7E3D8] divide-y divide-[#F0EEE6]">
            {rows.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-[#5F6B63]">Tidak ada peserta.</div>
            ) : rows.map((p) => {
              const on = picked.includes(p.user_id);
              return (
                <label key={p.user_id} data-testid={`undangan-row-${p.user_id}`}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${on ? "bg-[#FBE5E3]" : "hover:bg-[#F6F4EE]"}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(p.user_id)} className="h-4 w-4 accent-[#A32A2A]" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#14201A] truncate">{p.name}</span>
                    <span className="block text-[11px] text-[#5F6B63]">
                      {p.gender === "L" ? "Laki-laki" : p.gender === "P" ? "Perempuan" : "—"}
                      {p.status === "pending" ? " · belum aktivasi" : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <button data-testid="undangan-submit" onClick={submit} disabled={saving}
            className="h-12 rounded-xl bg-[#A32A2A] text-white font-bold inline-flex items-center justify-center gap-2 hover:brightness-95 disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} Kirim Undangan Penting
          </button>
          {terkirim > 0 && (
            <button data-testid="undangan-cancel" onClick={cancel}
              className="h-12 rounded-xl border-2 border-[#A32A2A] text-[#A32A2A] font-bold inline-flex items-center justify-center gap-2 hover:bg-[#FBE5E3]">
              <Trash2 size={18} /> Batalkan Undangan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
