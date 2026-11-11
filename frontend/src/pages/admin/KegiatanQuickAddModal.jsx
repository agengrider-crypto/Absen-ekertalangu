// Absen cepat & Absen sebelumnya — modal kecil satu layar.
// Hanya mengisi nilai default lalu memanggil endpoint simpan kegiatan yang sama
// dengan form lengkap (POST /admin/kegiatan). Tidak ada endpoint baru.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Zap, History, Users, CalendarDays, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import PesertaPicker from "@/components/PesertaPicker";
import Modal from "@/components/Modal";
import { KEGIATAN_TYPES, nowWita, safeEndTime } from "./kegiatanUtils";

const fld = "w-full h-12 px-3.5 rounded-xl border border-[#8A948D] text-[15px] outline-none focus:border-[#14633F] bg-white transition-colors";
const lbl = "block text-[13px] font-semibold text-[#14201A] mb-1.5";

export default function KegiatanQuickAddModal({ mode = "cepat", onClose, onFullForm }) {
  const navigate = useNavigate();
  const susulan = mode === "sebelumnya";
  const now = useMemo(() => nowWita(), []);
  const [name, setName] = useState("");
  const [type, setType] = useState("rutin");
  const [date, setDate] = useState(now.date);
  const [startTime, setStartTime] = useState(now.time);
  const [endTime, setEndTime] = useState(() => safeEndTime(now.time));
  const [pickMode, setPickMode] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [totalPeserta, setTotalPeserta] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/admin/users")
      .then(({ data }) => setTotalPeserta((data || []).filter((u) => (u.roles || []).includes("peserta")).length))
      .catch(() => setTotalPeserta(null));
  }, []);

  const pesertaLabel = pickMode
    ? `${participants.length} peserta dipilih`
    : `Semua peserta${totalPeserta === null ? "" : ` (${totalPeserta})`}`;

  const initialForFullForm = () => ({
    name: name.trim(),
    type,
    date,
    start_time: startTime,
    end_time: endTime,
    participant_ids: pickMode ? participants : [],
    susulan,
  });

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Nama kegiatan wajib diisi.");
      return;
    }
    if (pickMode && participants.length === 0) {
      toast.error("Pilih minimal satu peserta atau kembalikan ke semua peserta.");
      return;
    }
    if (!date) {
      toast.error("Tanggal kegiatan wajib diisi.");
      return;
    }
    if (endTime <= startTime) {
      toast.error("Jam selesai harus setelah jam mulai pada hari yang sama.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/admin/kegiatan", {
        name: name.trim(),
        type,
        date,
        start_time: startTime,
        end_time: endTime,
        recurring: false,
        recurring_months: null,
        participant_ids: pickMode ? participants : [],
        attendance_participant_ids: null,
        sessions: [],
        susulan,
      });
      const created = Array.isArray(data) ? data[0] : data;
      toast.success(susulan ? "Kegiatan susulan dibuat." : "Absen dimulai.");
      onClose?.();
      if (created?.akses_token) {
        try {
          const { data: v } = await api.post(`/absensi/${created.akses_token}/verify`, {
            code: created.access_code,
          });
          sessionStorage.setItem(`absensi_access_${created.akses_token}`, v.access);
        } catch { /* biarkan pengguna memasukkan kode manual */ }
        navigate(`/absensi/${created.akses_token}`);
      }
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={susulan ? "Absen sebelumnya" : "Absen cepat"}
      subtitle={susulan
        ? "Catat kegiatan yang sudah lewat, lalu isi absennya menyusul."
        : "Mulai absen sekarang tanpa mengisi form lengkap."}
      testid={susulan ? "modal-absen-sebelumnya" : "modal-absen-cepat"}
      maxWidth={520}
      footer={(
        <div className="space-y-2">
          <button
            type="button"
            data-testid="quick-add-submit"
            onClick={submit}
            disabled={saving}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B6B52] font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <Loader2 size={17} className="animate-spin" /> : susulan ? <History size={17} /> : <Zap size={17} />}
            {susulan ? "Simpan & isi absen" : "Mulai absen sekarang"}
          </button>
          <button
            type="button"
            data-testid="quick-add-full-form"
            onClick={() => onFullForm?.(initialForFullForm())}
            className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-[#0E4E31] hover:bg-[#F6F4EE]"
          >
            Atur lengkap <ArrowRight size={15} />
          </button>
        </div>
      )}
    >
      <div className="space-y-3.5">
        <div>
          <label className={lbl} htmlFor="quick-add-name">Nama kegiatan</label>
          <input
            id="quick-add-name"
            data-testid="quick-add-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="mis. Pengajian Malam Jumat"
            className={fld}
            autoFocus
          />
        </div>

        <div>
          <label className={lbl} htmlFor="quick-add-type">Jenis kegiatan</label>
          <select
            id="quick-add-type"
            data-testid="quick-add-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={fld}
          >
            {KEGIATAN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold text-[#14201A]">Peserta</span>
            <button
              type="button"
              data-testid="quick-add-pick-toggle"
              onClick={() => setPickMode((v) => !v)}
              className="text-xs font-semibold text-[#0E4E31] underline"
            >
              {pickMode ? "Pakai semua peserta" : "Ubah"}
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] px-3 py-2.5 text-sm font-semibold text-[#14201A]">
            <Users size={16} className="shrink-0 text-[#0E4E31]" /> {pesertaLabel}
          </div>
          {pickMode && (
            <div className="mt-2">
              <PesertaPicker value={participants} onChange={setParticipants} testid="quick-add-peserta" />
            </div>
          )}
        </div>

        {susulan ? (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="col-span-2">
              <label className={lbl} htmlFor="quick-add-date">Tanggal</label>
              <input
                id="quick-add-date"
                data-testid="quick-add-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={fld}
              />
            </div>
            <div>
              <label className={lbl} htmlFor="quick-add-start">Jam mulai</label>
              <input
                id="quick-add-start"
                data-testid="quick-add-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={fld}
              />
            </div>
            <div>
              <label className={lbl} htmlFor="quick-add-end">Jam selesai</label>
              <input
                id="quick-add-end"
                data-testid="quick-add-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={fld}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] px-3 py-2.5 text-xs text-[#5F6B63]">
            <div className="inline-flex items-center gap-1.5 font-semibold text-[#14201A]">
              <CalendarDays size={14} /> Jadwal otomatis
            </div>
            <div className="mt-1 inline-flex items-center gap-1.5">
              <Clock size={13} /> {date} · {startTime}–{endTime} WITA
            </div>
            <p className="mt-1 leading-relaxed">
              Status langsung Terbuka dan kode akses dibuat otomatis. Ubah jam lewat “Atur lengkap”.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
