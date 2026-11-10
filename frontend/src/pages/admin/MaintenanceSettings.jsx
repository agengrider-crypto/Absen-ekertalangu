// Pengaturan Pemeliharaan (Layar 32) — khusus admin.
// Menyimpan satu dokumen `app_settings._id = "maintenance"` lewat API.
import { useEffect, useState } from "react";
import { CalendarClock, Lock, Loader2, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { formatWita, jamWita } from "@/lib/maintenance";

const inp =
  "h-12 w-full rounded-[14px] border bg-white px-3.5 text-sm text-[#14201A] outline-none focus:border-[#14633F]";
const inpStyle = { borderColor: "#8A948D" };

/** ISO → nilai untuk <input type="datetime-local"> (WITA). */
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MaintenanceSettings() {
  const [data, setData] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get("/admin/maintenance")
      .then(({ data: d }) => {
        setData(d);
        setEnabled(Boolean(d.enabled));
        setStartAt(toLocalInput(d.startAt));
        setEndAt(toLocalInput(d.endAt));
        setMessage(d.message || "");
      })
      .catch((e) => {
        setData(false);
        toast.error(formatApiErrorDetail(e.response?.data?.detail));
      });
  };

  useEffect(load, []);

  const save = async () => {
    setSaving(true);
    try {
      const { data: d } = await api.put("/admin/maintenance", {
        enabled,
        startAt: startAt ? new Date(startAt).toISOString() : "",
        endAt: endAt ? new Date(endAt).toISOString() : "",
        message,
      });
      setData(d);
      toast.success("Pengaturan pemeliharaan disimpan.");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  if (data === null) {
    return (
      <div className="flex justify-center p-16">
        <Loader2 className="animate-spin text-[#0E4E31]" size={30} />
      </div>
    );
  }
  if (data === false) {
    return <div className="p-10 text-center text-[#5F6B63]">Gagal memuat pengaturan pemeliharaan.</div>;
  }

  const stateLabel = {
    none: "Tidak ada pemeliharaan",
    scheduled: "Terjadwal",
    ongoing: "Sedang berlangsung",
  }[data.state] || "Tidak ada pemeliharaan";

  return (
    <div className="space-y-4" data-testid="maintenance-settings">
      <div>
        <h1 className="font-heading text-2xl font-bold text-[#14201A]">Pemeliharaan</h1>
        <p className="mt-1 text-sm text-[#5F6B63]">
          Atur jadwal perawatan aplikasi. Saat berlangsung, peserta diarahkan ke halaman pemeliharaan
          dan operasi tulis ditolak server.
        </p>
      </div>

      {/* Status sekarang */}
      <div
        className="flex items-start gap-3 rounded-2xl p-3.5"
        style={
          data.state === "ongoing"
            ? { backgroundColor: "#FBF1D6", border: "1px solid #EAD596", color: "#6B4500" }
            : data.state === "scheduled"
              ? { backgroundColor: "#E3EEFB", color: "#1D4F91" }
              : { backgroundColor: "#F0EEE6", color: "#4A5650" }
        }
        role="status"
      >
        <span className="mt-0.5 shrink-0" aria-hidden="true">
          {data.state === "ongoing" ? <Lock size={22} /> : <CalendarClock size={22} />}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold">{stateLabel}</div>
          <div className="mt-0.5 text-[13px]">
            {data.state === "none" && "Aplikasi berjalan normal untuk semua peran."}
            {data.state === "scheduled" &&
              `${formatWita(data.startAt)}, pukul ${jamWita(data.startAt)}-${jamWita(data.endAt)} WITA.`}
            {data.state === "ongoing" &&
              `Perkiraan selesai pukul ${jamWita(data.endAt)} WITA. Admin & Pengurus tetap bisa masuk.`}
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4 rounded-2xl border bg-white p-4" style={{ borderColor: "#E7E3D8" }}>
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#14201A]">Sakelar manual</span>
            <span className="block text-xs text-[#5F6B63]">
              Nyalakan untuk memulai pemeliharaan sekarang, mengabaikan jadwal.
            </span>
          </span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            data-testid="maintenance-toggle"
            className="h-6 w-11 shrink-0 accent-[#14633F]"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Mulai (WITA)</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              data-testid="maintenance-start"
              className={inp}
              style={inpStyle}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Selesai (WITA)</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              data-testid="maintenance-end"
              className={inp}
              style={inpStyle}
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Pesan untuk peserta</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            data-testid="maintenance-message"
            className="w-full rounded-[14px] border bg-white px-3.5 py-2.5 text-sm text-[#14201A] outline-none focus:border-[#14633F]"
            style={inpStyle}
            placeholder="Aplikasi sedang dalam perawatan. Silakan tunggu beberapa saat lalu coba kembali."
          />
        </label>

        <div className="flex items-start gap-2 rounded-xl bg-[#F0EEE6] p-3 text-xs text-[#5F6B63]">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Saat berlangsung, peserta diarahkan ke halaman pemeliharaan dan semua operasi tulis
            (POST/PUT/PATCH/DELETE) ditolak server dengan status 503. Operasi baca tetap boleh.
          </span>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          data-testid="maintenance-save"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#14633F] text-sm font-bold text-white hover:bg-[#0E4E31] disabled:opacity-60"
        >
          {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          Simpan pengaturan
        </button>
      </div>
    </div>
  );
}
