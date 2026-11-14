// Formulir kecil "Tambah Kegiatan" (dipakai halaman Tambah Kegiatan).
// Desktop = modal di tengah, HP = panel naik dari bawah (komponen Modal bersama).
// Hanya mengisi nilai default lalu memanggil endpoint simpan yang sudah ada.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Users, ArrowRight, Zap, History, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import PesertaPicker from "@/components/PesertaPicker";
import Modal from "@/components/Modal";
import { KEGIATAN_TYPES, AUDIENCE_OPTIONS, nowWita, safeEndTime, SESSION_LABEL_PRESETS, SESSION_DEFAULT_TIME } from "./kegiatanUtils";

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
  { key: "pagi-malam", label: "Pagi + Malam" },
  { key: "atur", label: "Atur sesi" },
];

const MAX_SESI = 4;

// Dua sesi bawaan memakai konfigurasi jam sesi aplikasi (kegiatanUtils).
const duaSesi = () => [
  { label: "Pagi", start_time: SESSION_DEFAULT_TIME.Pagi[0], end_time: SESSION_DEFAULT_TIME.Pagi[1] },
  { label: "Malam", start_time: SESSION_DEFAULT_TIME.Malam[0], end_time: SESSION_DEFAULT_TIME.Malam[1] },
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
 * @param {"cepat"|"sebelumnya"} mode  jalur cepat: absen sekarang / kegiatan lampau
 * @param {function} onClose
 * @param {function} onFullForm  buka formulir lengkap dengan nilai awal
 */
export default function KegiatanQuickAddModal({ source = null, mode = "cepat", onClose, onFullForm }) {
  const navigate = useNavigate();
  const susulan = mode === "sebelumnya";
  const now = useMemo(() => nowWita(), []);
  const [name, setName] = useState("");
  const [type, setType] = useState(source?.type || "rutin");
  // Bawaan "Terbuka / Publik" untuk absen cepat & formulir kecil.
  const [audience, setAudience] = useState(source?.audience || "publik");
  const [date, setDate] = useState(now.date);
  const [startTime, setStartTime] = useState(source?.start_time || now.time);
  const [endTime, setEndTime] = useState(source?.end_time || safeEndTime(now.time));
  const [waktu, setWaktu] = useState(susulan ? "lewat" : "sekarang");
  const [sesi, setSesi] = useState("satu");
  const [sessions, setSessions] = useState(duaSesi);
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

  const multiSesi = sesi !== "satu";

  // Validasi per baris: jam selesai setelah jam mulai & tidak tumpang tindih.
  const sessionErrors = useMemo(() => {
    if (!multiSesi) return [];
    const errs = sessions.map(() => "");
    sessions.forEach((s, i) => {
      if (!s.start_time || !s.end_time) errs[i] = "Jam wajib diisi.";
      else if (s.end_time <= s.start_time) errs[i] = "Jam selesai harus setelah jam mulai.";
    });
    sessions.forEach((s, i) => {
      if (errs[i]) return;
      const bentrok = sessions.some((o, j) => j !== i && !errs[j]
        && s.start_time < o.end_time && o.start_time < s.end_time);
      if (bentrok) errs[i] = "Jam sesi tumpang tindih dengan sesi lain.";
    });
    return errs;
  }, [multiSesi, sessions]);

  const sesiValid = !multiSesi || (sessions.length >= 2 && sessionErrors.every((e) => !e));

  const ringkasanSesi = multiSesi
    ? `${sessions.length} sesi: ${sessions.map((s) => `${s.label} ${String(s.start_time).replace(":", ".")}-${String(s.end_time).replace(":", ".")}`).join(", ")}`
    : "";

  const setSession = (i, key, val) =>
    setSessions((p) => p.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)));

  const addSession = () => {
    setSessions((p) => {
      if (p.length >= MAX_SESI) return p;
      const used = p.map((s) => s.label);
      const next = SESSION_LABEL_PRESETS.find((l) => !used.includes(l)) || `Sesi ${p.length + 1}`;
      const [st, en] = SESSION_DEFAULT_TIME[next] || ["08:00", "10:00"];
      return [...p, { label: next, start_time: st, end_time: en }];
    });
  };

  const removeSession = (i) => {
    const next = sessions.filter((_, idx) => idx !== i);
    setSessions(next);
    if (next.length < 2) setSesi("satu");
  };

  const pilihSesi = (key) => {
    setSesi(key);
    if (key === "pagi-malam") setSessions(duaSesi());
    if (key === "atur" && sessions.length < 2) setSessions(duaSesi());
  };

  const initialForFullForm = () => ({
    name: name.trim(),
    type,
    audience,
    date,
    start_time: startTime,
    end_time: endTime,
    participant_ids: pickMode ? participants : [],
    susulan: waktu === "lewat",
    multi: multiSesi,
    ...(multiSesi ? { sessions: sessions.map((s) => ({ ...s })) } : {}),
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
    if (multiSesi) {
      if (!sesiValid) {
        toast.error("Periksa jam sesi terlebih dahulu.");
        return;
      }
    } else if (endTime <= startTime) {
      toast.error("Jam selesai harus setelah jam mulai pada hari yang sama.");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/admin/kegiatan", {
        name: name.trim(),
        type,
        audience,
        date,
        start_time: multiSesi ? sessions[0].start_time : startTime,
        end_time: multiSesi ? sessions[0].end_time : endTime,
        recurring: waktu === "pekan",
        recurring_months: waktu === "pekan" ? 1 : null,
        participant_ids: pickMode ? participants : [],
        attendance_participant_ids: null,
        sessions: multiSesi
          ? sessions.map((s) => ({
            label: s.label.trim() || "Sesi",
            start_time: s.start_time,
            end_time: s.end_time,
            required: true,
          }))
          : [],
        susulan: waktu === "lewat",
      });
      const created = Array.isArray(data) ? data : [data];
      toast.success(susulan ? "Kegiatan susulan dibuat." : "Absen dimulai.");
      onClose?.();
      // Sesi yang jamnya sedang berjalan dibuka; jika tidak ada, sesi pertama.
      const nowTime = nowWita().time;
      const aktif = created.find((k) => k?.start_time <= nowTime && nowTime < k?.end_time) || created[0];
      if (aktif?.akses_token) {
        try {
          const { data: v } = await api.post(`/absensi/${aktif.akses_token}/verify`, {
            code: aktif.access_code,
          });
          sessionStorage.setItem(`absensi_access_${aktif.akses_token}`, v.access);
        } catch { /* biarkan pengguna memasukkan kode manual */ }
        navigate(`/absensi/${aktif.akses_token}`);
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
          {multiSesi && (
            <p className="text-[11px] font-semibold text-[#0E4E31]" data-testid="quick-add-sesi-ringkasan">
              {ringkasanSesi}
            </p>
          )}
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
              disabled={saving || !sesiValid}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0B6B52] font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {saving ? <Loader2 size={17} className="animate-spin" /> : susulan ? <History size={17} /> : <Zap size={17} />}
              {susulan ? "Simpan & isi absen" : "Mulai absen sekarang"}
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
          <label className={lbl} htmlFor="quick-add-audience">Tipe peserta</label>
          <select
            id="quick-add-audience"
            data-testid="quick-add-audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className={fld}
          >
            {AUDIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <span className={lbl}>Sesi</span>
          <div className="flex flex-wrap gap-1.5">
            {SESI.map((s) => (
              <Chip key={s.key} on={sesi === s.key} data-testid={`quick-add-sesi-${s.key}`} onClick={() => pilihSesi(s.key)}>
                {s.label}
              </Chip>
            ))}
          </div>

          {multiSesi && (
            <div className="mt-2.5 space-y-2" data-testid="quick-add-sesi-list">
              {sessions.map((s, i) => (
                <div key={i} className="rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] p-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      list="quick-add-sesi-label"
                      data-testid={`quick-add-sesi-label-${i}`}
                      value={s.label}
                      onChange={(e) => setSession(i, "label", e.target.value)}
                      placeholder="Nama sesi"
                      className="h-10 min-w-0 flex-1 rounded-lg border border-[#8A948D] bg-white px-2.5 text-sm outline-none focus:border-[#14633F]"
                    />
                    <button
                      type="button"
                      data-testid={`quick-add-sesi-hapus-${i}`}
                      onClick={() => removeSession(i)}
                      aria-label={`Hapus sesi ${s.label || i + 1}`}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#A32A2A] hover:bg-[#FBE5E3]"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="time"
                      data-testid={`quick-add-sesi-mulai-${i}`}
                      value={s.start_time}
                      onChange={(e) => setSession(i, "start_time", e.target.value)}
                      className="h-10 rounded-lg border border-[#8A948D] bg-white px-2.5 text-sm outline-none focus:border-[#14633F]"
                    />
                    <input
                      type="time"
                      data-testid={`quick-add-sesi-selesai-${i}`}
                      value={s.end_time}
                      onChange={(e) => setSession(i, "end_time", e.target.value)}
                      className="h-10 rounded-lg border border-[#8A948D] bg-white px-2.5 text-sm outline-none focus:border-[#14633F]"
                    />
                  </div>
                  {sessionErrors[i] && (
                    <p className="mt-1 text-[11px] font-semibold text-[#A32A2A]" data-testid={`quick-add-sesi-error-${i}`}>
                      {sessionErrors[i]}
                    </p>
                  )}
                </div>
              ))}
              <datalist id="quick-add-sesi-label">
                {SESSION_LABEL_PRESETS.map((l) => <option key={l} value={l} />)}
              </datalist>
              <button
                type="button"
                data-testid="quick-add-sesi-tambah"
                onClick={addSession}
                disabled={sessions.length >= MAX_SESI}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border-2 border-[#E7E3D8] px-3 text-xs font-semibold text-[#0E4E31] hover:border-[#14633F] disabled:opacity-50"
              >
                <Plus size={14} /> Tambah sesi
              </button>
            </div>
          )}
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

        {!multiSesi && (
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
        )}

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
