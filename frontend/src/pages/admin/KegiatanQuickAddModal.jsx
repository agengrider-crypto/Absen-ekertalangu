// Formulir kecil "Tambah Kegiatan" (dipakai halaman Tambah Kegiatan).
// Desktop = modal di tengah, HP = panel naik dari bawah (komponen Modal bersama).
// Hanya mengisi nilai default lalu memanggil endpoint simpan yang sudah ada.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import PesertaPicker from "@/components/PesertaPicker";
import Modal from "@/components/Modal";
import { KEGIATAN_TYPES, nowWita, safeEndTime } from "./kegiatanUtils";

const fld = "w-full h-12 px-3.5 rounded-xl border border-[#8A948D] text-[15px] outline-none focus:border-[#14633F] bg-white transition-colors";
const lbl = "block text-[13px] font-semibold text-[#14201A] mb-1.5";

const WAKTU = [
  { key: "sekarang", label: "Sekarang" },
  { key: "terjadwal", label: "Terjadwal" },
  { key: "pekan", label: "Tiap pekan" },
  { key: "lewat", label: "Sudah lewat" },
];
const SESI = [
  { key: "satu", label: "Satu sesi" },
  { key: "banyak", label: "Beberapa sesi" },
];

function Chip({ on, children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className={`h-10 rounded-xl border-2 px-3 text-xs font-semibold transition-colors ${
        on ? "border-transparent bg-[#14633F] text-white" : "border-[#E7E3D8] bg-white text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * @param {object} source  kegiatan sumber salinan (opsional)
 * @param {function} onClose
 * @param {function} onFullForm  buka formulir lengkap dengan nilai awal
 */
export default function KegiatanQuickAddModal({ source = null, onClose, onFullForm }) {
  const navigate = useNavigate();
  const now = useMemo(() => nowWita(), []);
  const [name, setName] = useState("");
  const [type, setType] = useState(source?.type || "rutin");
  const [date, setDate] = useState(now.date);
  const [startTime, setStartTime] = useState(source?.start_time || now.time);
  const [endTime, setEndTime] = useState(source?.end_time || safeEndTime(now.time));
  const [waktu, setWaktu] = useState("sekarang");
  const [sesi, setSesi] = useState("satu");
  const [pickMode, setPickMode] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [totalPeserta, setTotalPeserta] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/admin/users")
      .then(({ data }) => setTotalPeserta((data || []).filter((u) => (u.roles || []).includes("peserta")).length))
      .catch(() => setTotalPeserta(null));
  }, []);

  // "Sekarang" selalu memakai jam WITA saat ini; "Sudah lewat" membebaskan tanggal.
  useEffect(() => {
    if (waktu === "sekarang") {
      setDate(now.date);
      setStartTime(now.time);
      setEndTime(safeEndTime(now.time));
    }
  }, [waktu, now]);

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
    susulan: waktu === "lewat",
    multi: sesi === "banyak",
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
        recurring: waktu === "pekan",
        recurring_months: waktu === "pekan" ? 1 : null,
        participant_ids: pickMode ? participants : [],
        attendance_participant_ids: null,
        sessions: [],
        susulan: waktu === "lewat",
      });
      const created = Array.isArray(data) ? data[0] : data;
      toast.success("Kegiatan dibuat.");
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
      title="Tambah Kegiatan"
      subtitle={source ? `Pengaturan disalin dari “${source.base_name || source.name}”` : "Mulai dari kosong"}
      testid="modal-tambah-kegiatan-cepat"
      maxWidth={560}
      footer={(
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="quick-add-cancel"
              onClick={onClose}
              className="h-12 rounded-xl border-2 border-[#E7E3D8] font-semibold text-[#5F6B63] hover:border-[#14633F]"
            >
              Batal
            </button>
            <button
              type="button"
              data-testid="quick-add-submit"
              onClick={submit}
              disabled={saving}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0B6B52] font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : null} Mulai
            </button>
          </div>
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

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={lbl} htmlFor="quick-add-start">Jam mulai</label>
            <input id="quick-add-start" data-testid="quick-add-start" type="time" value={startTime}
              onChange={(e) => setStartTime(e.target.value)} className={fld} />
          </div>
          <div>
            <label className={lbl} htmlFor="quick-add-end">Jam selesai</label>
            <input id="quick-add-end" data-testid="quick-add-end" type="time" value={endTime}
              onChange={(e) => setEndTime(e.target.value)} className={fld} />
          </div>
        </div>

        <div>
          <span className={lbl}>Waktu</span>
          <div className="flex flex-wrap gap-1.5">
            {WAKTU.map((w) => (
              <Chip key={w.key} on={waktu === w.key} data-testid={`quick-add-waktu-${w.key}`} onClick={() => setWaktu(w.key)}>
                {w.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <span className={lbl}>Sesi</span>
          <div className="flex flex-wrap gap-1.5">
            {SESI.map((s) => (
              <Chip key={s.key} on={sesi === s.key} data-testid={`quick-add-sesi-${s.key}`} onClick={() => setSesi(s.key)}>
                {s.label}
              </Chip>
            ))}
          </div>
          {sesi === "banyak" && (
            <p className="mt-1.5 text-[11px] text-[#5F6B63]">
              Beberapa sesi diatur di formulir lengkap lewat “Atur lengkap”.
            </p>
          )}
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
      </div>
    </Modal>
  );
}
