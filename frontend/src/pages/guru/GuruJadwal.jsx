// Jadwal Saya — daftar pertemuan (kegiatan jenis Pembelajaran) pekan ini & berikutnya.
import { useEffect, useMemo, useState } from "react";
import { Loader2, CalendarClock, Clock, MapPin, Users, ChevronRight, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import Modal from "@/components/Modal";
import { nowWita, tanggalPanjang } from "@/pages/admin/kegiatanUtils";

const IZIN_CHIP = (izin) => {
  if (!izin) return null;
  if (izin.status === "diterima") return `Izin, digantikan ${izin.pengganti_nama || "guru lain"}`;
  if (izin.status === "menunggu") return "Izin, menunggu pengganti";
  return "Izin tanpa pengganti";
};

export default function GuruJadwal({ onOpenAbsen }) {
  const [items, setItems] = useState(null);
  const [pick, setPick] = useState(null);
  const [gurus, setGurus] = useState([]);
  const [form, setForm] = useState(null); // { id, alasan, pengganti_id }
  const [saving, setSaving] = useState(false);
  const [batal, setBatal] = useState(null);
  const today = nowWita().date;

  const load = () => {
    api.get("/guru/pertemuan").then(({ data }) => setItems(data.items || [])).catch(() => setItems([]));
  };

  useEffect(() => {
    load();
    api.get("/guru/pengganti").then(({ data }) => setGurus(data.items || [])).catch(() => setGurus([]));
  }, []);

  const ajukan = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await api.post(`/guru/pertemuan/${form.id}/izin`, {
        alasan: form.alasan || null,
        pengganti_id: form.pengganti_id || null,
      });
      toast.success("Izin diajukan");
      setForm(null);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const batalkan = async (id) => {
    try {
      await api.delete(`/guru/pertemuan/${id}/izin`);
      toast.success("Izin dibatalkan");
      setBatal(null);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const groups = useMemo(() => {
    const out = [];
    (items || []).forEach((k) => {
      const last = out[out.length - 1];
      if (last && last.date === k.date) last.rows.push(k);
      else out.push({ date: k.date, rows: [k] });
    });
    return out;
  }, [items]);

  if (items === null) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;
  }

  return (
    <div className="space-y-4" data-testid="guru-jadwal">
      <div>
        <h1 className="font-heading text-xl font-bold text-[#14201A]">Jadwal Saya</h1>
        <p className="mt-1 text-sm text-[#5F6B63]">Pertemuan pekan ini dan berikutnya.</p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-8 text-center text-sm text-[#5F6B63]">
          Belum ada pertemuan terjadwal.
        </div>
      ) : groups.map((g) => (
        <div key={g.date} className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-[#5F6B63]">
            {tanggalPanjang(g.date)}{g.date === today ? " · hari ini" : ""}
          </div>
          <div className="mt-2 space-y-2">
            {g.rows.map((k) => {
              const on = pick === k.id;
              return (
                <div key={k.id} data-testid={`guru-jadwal-${k.id}`}
                  className={`rounded-xl border-2 p-3 transition-colors ${on ? "border-[#14633F] bg-white" : "border-[#E7E3D8] bg-[#F6F4EE]"}`}>
                  <button type="button" onClick={() => setPick(on ? null : k.id)}
                    className="flex w-full items-center gap-2 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-[#14201A]">{k.name}</span>
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#5F6B63]">
                        <span className="inline-flex items-center gap-1"><Clock size={12} /> {k.start_time}–{k.end_time} WITA</span>
                        {k.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {k.location}</span>}
                        <span className="inline-flex items-center gap-1"><Users size={12} /> {k.counts?.total ?? 0} peserta</span>
                      </span>
                    </span>
                    <ChevronRight size={18} className={`shrink-0 text-[#D9D4C5] transition-transform ${on ? "rotate-90" : ""}`} />
                  </button>
                  {on && (
                    <div className="mt-2.5 space-y-2">
                      {k.pokok_bahasan && (
                        <p className="text-xs text-[#5F6B63]" data-testid={`guru-jadwal-pokok-${k.id}`}>
                          Pokok bahasan: <b className="text-[#14201A]">{k.pokok_bahasan}</b>
                        </p>
                      )}
                      {k.izin && (
                        <span className="inline-flex rounded-full bg-[#FBF1D6] px-2.5 py-0.5 text-[11px] font-semibold text-[#6B4500]"
                          data-testid={`guru-jadwal-izin-${k.id}`}>
                          {IZIN_CHIP(k.izin)}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button type="button" data-testid={`guru-jadwal-absen-${k.id}`}
                          onClick={() => onOpenAbsen?.(k.id)}
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#14633F] px-3.5 text-sm font-semibold text-white hover:bg-[#0E4E31]">
                          <CalendarClock size={15} /> Buka absen kelas
                        </button>
                        {!k.izin && k.date >= today && (
                          <button type="button" data-testid={`guru-jadwal-izin-btn-${k.id}`}
                            onClick={() => setForm({ id: k.id, alasan: "", pengganti_id: "" })}
                            className="inline-flex h-10 items-center gap-1.5 rounded-xl border-2 border-[#14633F] px-3.5 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA]">
                            <UserMinus size={15} /> Ajukan izin
                          </button>
                        )}
                        {k.izin && k.date >= today && (
                          <button type="button" onClick={() => setBatal(k.id)}
                            className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-[#A32A2A] hover:bg-[#FBE5E3]">
                            Batalkan izin
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <Modal open={Boolean(form)} onClose={() => setForm(null)} title="Ajukan izin" maxWidth={480}
        testid="guru-izin-form"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm(null)}
              className="h-11 flex-1 rounded-xl border-2 border-[#E7E3D8] font-semibold text-[#5F6B63] hover:bg-[#F6F4EE]">Batal</button>
            <button type="button" onClick={ajukan} disabled={saving}
              className="h-11 flex-1 rounded-xl bg-[#14633F] font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60">
              {saving ? "Mengirim…" : "Ajukan izin"}
            </button>
          </div>
        }>
        {form && (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Alasan (opsional)</span>
              <textarea rows={2} maxLength={200} value={form.alasan}
                onChange={(e) => setForm((f) => ({ ...f, alasan: e.target.value }))}
                placeholder="Mis. sakit"
                className="w-full resize-none rounded-xl border border-[#8A948D] px-3 py-2 text-sm outline-none focus:border-[#14633F]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Guru pengganti</span>
              <select value={form.pengganti_id}
                onChange={(e) => setForm((f) => ({ ...f, pengganti_id: e.target.value }))}
                className="h-11 w-full rounded-xl border border-[#8A948D] bg-white px-3 text-base outline-none focus:border-[#14633F]">
                <option value="">Tanpa pengganti</option>
                {gurus.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          </div>
        )}
      </Modal>

      <Modal open={batal !== null} onClose={() => setBatal(null)} title="Batalkan izin?" maxWidth={420}
        hideClose testid="guru-izin-batal">
        <p className="text-sm text-[#5F6B63]">Pengajar pertemuan dikembalikan ke Anda.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setBatal(null)}
            className="h-11 flex-1 rounded-xl border-2 border-[#E7E3D8] font-semibold text-[#5F6B63] hover:bg-[#F6F4EE]">Batal</button>
          <button type="button" onClick={() => batalkan(batal)}
            className="h-11 flex-1 rounded-xl bg-[#A32A2A] font-semibold text-white hover:bg-[#8C2323]">Ya, batalkan</button>
        </div>
      </Modal>
    </div>
  );
}
