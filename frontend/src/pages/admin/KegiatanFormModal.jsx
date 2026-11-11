// FASE 18 — Form Tambah/Edit Kegiatan: tampilan baru (modal berlapis, nyaman di HP & PC).
import { useMemo, useState } from "react";
import {
  Plus, Loader2, Layers, Trash2, SlidersHorizontal, AlertTriangle,
  CalendarDays, Info, Users, ListChecks, Save,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { ACTIVITIES } from "@/constants/testIds";
import PesertaPicker from "@/components/PesertaPicker";
import Modal from "@/components/Modal";
import {
  KEGIATAN_TYPES, timeOptions, AUDIENCE_OPTIONS, GENDER_FILTER_OPTIONS,
  MARITAL_FILTER_OPTIONS, AGE_GROUP_OPTIONS, SESSION_LABEL_PRESETS, SESSION_DEFAULT_TIME,
} from "./kegiatanUtils";

const TIMES = timeOptions();
const DURATIONS = [
  { value: 30, label: "30 menit" },
  { value: 60, label: "1 jam" },
  { value: 90, label: "1,5 jam" },
  { value: 120, label: "2 jam" },
];
const fld = "w-full h-12 px-3.5 rounded-xl border border-[#8A948D] text-[15px] outline-none focus:border-[#14633F] bg-white transition-colors";
const lbl = "block text-[13px] font-semibold text-[#14201A] mb-1.5";

function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function addMinutes(time, minutes) {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function timeMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function uniqueSuggestions(items, fields) {
  const found = new Map();
  (items || []).forEach((item) => fields.forEach((field) => {
    const value = String(item?.[field] || "").trim();
    const key = value.toLocaleLowerCase("id");
    if (value && !found.has(key)) found.set(key, value);
  }));
  return Array.from(found.values()).sort((a, b) => a.localeCompare(b, "id"));
}

function Section({ icon: Icon, title, desc, children, testid }) {
  return (
    <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5" data-testid={testid}>
      <div className="flex items-start gap-3 mb-3.5">
        <span className="h-9 w-9 shrink-0 rounded-xl bg-[#E3F3EA] text-[#0E4E31] flex items-center justify-center">
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <h3 className="font-heading font-bold text-[#14201A] text-[15px] leading-tight">{title}</h3>
          {desc && <p className="text-xs text-[#5F6B63] mt-0.5 leading-relaxed">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function ReviewItem({ label, value }) {
  return (
    <div className="rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] px-3.5 py-3">
      <dt className="text-xs font-semibold text-[#5F6B63]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-[#14201A]">{value}</dd>
    </div>
  );
}

function Chip({ on, children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className={`h-11 rounded-xl border-2 font-semibold text-xs sm:text-sm transition-colors ${
        on ? "bg-[#14633F] text-white border-transparent" : "bg-white text-[#5F6B63] border-[#E7E3D8] hover:border-[#14633F] hover:text-[#0E4E31]"
      }`}
    >
      {children}
    </button>
  );
}

export default function KegiatanFormModal({ onClose, onDone, initial, suggestions = [] }) {
  const editing = Boolean(initial?.id);
  const [f, setF] = useState({
    name: initial?.name || "", type: initial?.type || "rutin",
    date: initial?.date || todayYmd(), start_time: initial?.start_time || "20:00",
    end_time: initial?.end_time || "21:30", teacher: initial?.teacher || "",
    material: initial?.material || "", location: initial?.location || "",
    maps_query: initial?.maps_query || initial?.location || "",
    recurring_months: 0,
    audience: initial?.audience || "reguler",
    gender_filter: initial?.gender_filter || "semua",
    marital_filter: initial?.marital_filter || "semua",
    age_filter: initial?.age_filter || [],
  });
  // FASE 18 — mode ceklis peserta tertentu
  const [pickMode, setPickMode] = useState((initial?.participant_ids || []).length > 0);
  const [participants, setParticipants] = useState(initial?.participant_ids || []);
  const [requiredParticipants, setRequiredParticipants] = useState(initial?.session_participant_ids || []);
  const [multi, setMulti] = useState(false);
  const [sessions, setSessions] = useState([
    { label: "Pagi", start_time: "08:00", end_time: "10:00", teacher: "", material: "", location: "", required: true },
    { label: "Sore", start_time: "16:00", end_time: "17:30", teacher: "", material: "", location: "", required: true },
  ]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const teacherSuggestions = useMemo(() => uniqueSuggestions(suggestions, ["teacher"]), [suggestions]);
  const materialSuggestions = useMemo(() => uniqueSuggestions(suggestions, ["material"]), [suggestions]);
  const locationSuggestions = useMemo(() => uniqueSuggestions(suggestions, ["location"]), [suggestions]);
  const mapsSuggestions = useMemo(() => uniqueSuggestions(suggestions, ["maps_query", "location"]), [suggestions]);
  const [duration, setDuration] = useState(() => {
    const [startHour, startMinute] = (initial?.start_time || "20:00").split(":").map(Number);
    const [endHour, endMinute] = (initial?.end_time || "21:30").split(":").map(Number);
    const minutes = (endHour * 60 + endMinute - startHour * 60 - startMinute + 1440) % 1440;
    return DURATIONS.some((option) => option.value === minutes) ? minutes : "custom";
  });

  const set = (k, v) => {
    setReviewConfirmed(false);
    setF((p) => ({ ...p, [k]: v }));
  };
  const toggleAge = (val) => {
    setReviewConfirmed(false);
    setF((p) => {
      const cur = p.age_filter || [];
      return { ...p, age_filter: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] };
    });
  };

  const setSession = (i, key, val) => {
    setReviewConfirmed(false);
    setSessions((p) => p.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)));
  };
  const addSession = () => {
    setReviewConfirmed(false);
    setSessions((p) => {
      const used = p.map((s) => s.label);
      const next = SESSION_LABEL_PRESETS.find((l) => !used.includes(l)) || `Sesi ${p.length + 1}`;
      const [st, en] = SESSION_DEFAULT_TIME[next] || ["08:00", "10:00"];
      return [...p, { label: next, start_time: st, end_time: en, teacher: "", material: "", location: "", required: true }];
    });
  };
  const removeSession = (i) => {
    setReviewConfirmed(false);
    setSessions((p) => p.filter((_, idx) => idx !== i));
  };

  const validateStep = (currentStep) => {
    if (currentStep === 0 && !f.name.trim()) {
      toast.error("Nama kegiatan wajib diisi.");
      return false;
    }
    if (currentStep === 1) {
      if (!f.date) {
        toast.error("Tanggal kegiatan wajib dipilih.");
        return false;
      }
      if (!editing && multi && (sessions.length < 2 || sessions.some((s) => !String(s.label).trim()))) {
        toast.error("Isi minimal dua nama sesi untuk jadwal beberapa waktu.");
        return false;
      }
    }
    if (currentStep === 2 && pickMode && participants.length === 0) {
      toast.error("Pilih minimal satu peserta atau nonaktifkan mode pilih peserta.");
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep((current) => Math.min(current + 1, 3));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (step !== 3) {
      toast.info("Tinjau semua informasi terlebih dahulu sebelum menyimpan.");
      return;
    }
    if (!reviewConfirmed) {
      toast.error("Centang konfirmasi setelah memastikan data kegiatan sudah benar.");
      return;
    }
    for (let currentStep = 0; currentStep <= 2; currentStep += 1) {
      if (!validateStep(currentStep)) {
        setStep(currentStep);
        return;
      }
    }
    setSaving(true);
    try {
      const participant_ids = pickMode ? participants : [];
      if (editing) {
        const { recurring_months, ...rest } = f;
        await api.patch(`/admin/kegiatan/${initial.id}`, {
          ...rest,
          participant_ids,
          attendance_participant_ids: requiredParticipants,
        });
        toast.success("Kegiatan diperbarui.");
      } else {
        const { data } = await api.post("/admin/kegiatan", {
          ...f,
          recurring: false,
          recurring_months: Number(f.recurring_months) || null,
          participant_ids,
          attendance_participant_ids: multi ? null : requiredParticipants,
          sessions: multi ? sessions.map(({ participant_ids: sessionParticipants, ...session }) => ({
            ...session,
            ...(sessionParticipants?.length ? { participant_ids: sessionParticipants } : {}),
          })) : [],
        });
        const parts = [];
        if (multi) parts.push(`${sessions.length} waktu/sesi`);
        if (Number(f.recurring_months) > 1) parts.push(`rutin bulanan ${f.recurring_months} kali`);
        if (participant_ids.length) parts.push(`${participant_ids.length} peserta terpilih`);
        toast.success(`Kegiatan dibuat${parts.length ? ` (${parts.join(", ")}, total ${data.length} jadwal)` : ""}.`);
      }
      onDone();
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return (
    <Modal
      onClose={onClose}
      title={editing ? "Edit Kegiatan" : "Tambah Kegiatan"}
      subtitle={editing ? "Ubah jadwal, pengajar, dan penyaringan peserta." : "Isi jadwal pengajian lalu atur siapa saja pesertanya."}
      testid={editing ? "modal-edit-kegiatan" : "modal-add-kegiatan"}
      closeTestId="kegiatan-form-close"
      maxWidth={960}
      bodyClassName="bg-[#F6F4EE] p-0"
      footer={(
        <div className="flex gap-2">
          <button type="button" onClick={() => {
            if (step === 0) onClose();
            else {
              setReviewConfirmed(false);
              setStep((current) => Math.max(current - 1, 0));
            }
          }}
            data-testid={step === 0 ? "kegiatan-form-cancel" : ACTIVITIES.wizardPrevious}
            className="h-12 px-4 rounded-xl bg-[#F0EEE6] text-[#5F6B63] font-semibold hover:bg-[#E7E3D8]">
            {step === 0 ? "Batal" : "Kembali"}
          </button>
          {step < 3 ? (
            <button type="button" onClick={nextStep} data-testid={ACTIVITIES.wizardNext}
              className="flex-1 h-12 rounded-xl bg-[#0B6B52] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-[#0E4E31]">
              Lanjut
            </button>
          ) : (
          <button form="kegiatan-form" type="submit" data-testid="button-submit-kegiatan" disabled={saving || !reviewConfirmed}
            className="flex-1 h-12 rounded-xl bg-[#0B6B52] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-[#0E4E31] disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={18} /> : editing ? <Save size={18} /> : <Plus size={18} />}
            {editing ? "Simpan Perubahan" : "Simpan Kegiatan"}
          </button>
          )}
        </div>
      )}
    >
        <div className="grid grid-cols-4 gap-1 border-b border-[#E7E3D8] bg-white px-4 pb-3 pt-3 sm:px-5">
          {["Kegiatan", "Jadwal", "Peserta", "Tinjau"].map((label, index) => (
            <button key={label} type="button" onClick={() => index <= step && setStep(index)}
              aria-current={step === index ? "step" : undefined}
              data-testid={`${ACTIVITIES.wizardStepPrefix}-${index + 1}`}
              className={`min-h-11 rounded-lg px-1 text-xs font-semibold sm:text-sm ${
                step >= index ? "bg-[#14633F] text-white" : "bg-[#E7E3D8] text-[#5F6B63]"
              }`}>
              <span className="mr-1">{index + 1}.</span>{label}
            </button>
          ))}
        </div>

        {/* Body */}
        <form id="kegiatan-form" noValidate onSubmit={submit} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          {step === 0 && <Section icon={Info} title="Informasi Kegiatan" testid="form-section-info"
            desc="Nama, jenis, pengajar, materi, dan lokasi kegiatan.">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={lbl}>Nama kegiatan <span className="text-[#A32A2A]" aria-hidden="true">*</span></label>
                <input data-testid="keg-name" required value={f.name} onChange={(e) => set("name", e.target.value)}
                  placeholder="cth: Pengajian Rutin Kertalangu" className={fld} />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Jenis</label>
                <div role="group" aria-label="Jenis kegiatan" className="grid grid-cols-3 gap-2" data-testid="keg-type">
                  {KEGIATAN_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      data-testid={`${ACTIVITIES.typeOptionPrefix}-${t.value}`}
                      aria-pressed={f.type === t.value}
                      onClick={() => set("type", t.value)}
                      className={`min-h-12 rounded-xl border-2 px-2 text-sm font-semibold transition-colors ${
                        f.type === t.value
                          ? "border-[#14633F] bg-[#14633F] text-white"
                          : "border-[#E7E3D8] bg-white text-[#5F6B63] hover:border-[#14633F]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={lbl}>Pengajar</label>
                <input data-testid={ACTIVITIES.teacher} list="kegiatan-teacher-suggestions" value={f.teacher}
                  onChange={(e) => set("teacher", e.target.value)}
                  placeholder="Mulai ketik untuk melihat saran" autoComplete="on" className={fld} />
                <datalist id="kegiatan-teacher-suggestions">
                  {teacherSuggestions.map((value) => <option key={value} value={value} />)}
                </datalist>
              </div>
              <div>
                <label className={lbl}>Materi</label>
                <input data-testid={ACTIVITIES.material} list="kegiatan-material-suggestions" value={f.material}
                  onChange={(e) => set("material", e.target.value)}
                  placeholder="Mulai ketik untuk melihat saran" autoComplete="on" className={fld} />
                <datalist id="kegiatan-material-suggestions">
                  {materialSuggestions.map((value) => <option key={value} value={value} />)}
                </datalist>
              </div>
              <div>
                <label className={lbl}>Lokasi</label>
                <input data-testid={ACTIVITIES.location} list="kegiatan-location-suggestions" value={f.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Mulai ketik untuk melihat saran" autoComplete="on" className={fld} />
                <datalist id="kegiatan-location-suggestions">
                  {locationSuggestions.map((value) => <option key={value} value={value} />)}
                </datalist>
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}>Alamat atau kata kunci Google Maps</label>
                <input data-testid={ACTIVITIES.mapsQuery} list="kegiatan-maps-suggestions" value={f.maps_query}
                  onChange={(e) => set("maps_query", e.target.value)}
                  placeholder="Mulai ketik untuk melihat saran" autoComplete="on" className={fld} />
                <datalist id="kegiatan-maps-suggestions">
                  {mapsSuggestions.map((value) => <option key={value} value={value} />)}
                </datalist>
              </div>
            </div>
            <p className="mt-2 text-xs text-[#5F6B63]">Saran diambil dari jadwal tersimpan. Anda tetap bisa mengetik pilihan baru.</p>
          </Section>}

          {step === 1 && <Section icon={CalendarDays} title="Jadwal Kegiatan" testid="form-section-waktu"
            desc="Pilih tanggal; aktifkan beberapa waktu bila sehari ada pagi/sore/malam.">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Tanggal</label>
                <input data-testid="keg-date" type="date" required value={f.date}
                  onChange={(e) => set("date", e.target.value)} className={fld} />
              </div>
              {!editing && multi ? (
                <div className="sm:col-span-2 rounded-xl border-2 border-dashed border-[#E7E3D8] bg-[#F6F4EE] px-3.5 py-3 text-xs text-[#5F6B63] flex items-center">
                  Jam diatur pada daftar <b className="mx-1">Waktu / Sesi</b> di bawah.
                </div>
              ) : (
                <>
                  <div>
                    <label className={lbl}>Mulai (WITA)</label>
                    <select data-testid="keg-start" value={f.start_time} onChange={(e) => {
                      set("start_time", e.target.value);
                      if (duration !== "custom") set("end_time", addMinutes(e.target.value, duration));
                      else if (timeMinutes(f.end_time) <= timeMinutes(e.target.value)) {
                        const nextEnd = TIMES.find((time) => timeMinutes(time) > timeMinutes(e.target.value));
                        if (nextEnd) set("end_time", nextEnd);
                      }
                    }} className={fld}>
                      {TIMES.filter((time) => timeMinutes(time) + (duration === "custom" ? 30 : duration) <= 1410)
                        .map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Durasi</label>
                    <select data-testid={ACTIVITIES.duration} value={duration} onChange={(e) => {
                      const value = e.target.value === "custom" ? "custom" : Number(e.target.value);
                      setDuration(value);
                      if (value !== "custom") set("end_time", addMinutes(f.start_time, value));
                    }} className={fld}>
                      {DURATIONS.map((option) => (
                        <option key={option.value} value={option.value}
                          disabled={timeMinutes(f.start_time) + option.value > 1410}>
                          {option.label}
                        </option>
                      ))}
                      <option value="custom">Atur manual</option>
                    </select>
                  </div>
                  {duration === "custom" && <div>
                    <label className={lbl}>Jam selesai (WITA)</label>
                    <select data-testid="keg-end" value={f.end_time} onChange={(e) => set("end_time", e.target.value)} className={fld}>
                      {TIMES.filter((time) => timeMinutes(time) > timeMinutes(f.start_time))
                        .map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>}
                </>
              )}
            </div>

            {!editing && (
              <>
                <label className="mt-3 flex items-start gap-2.5 rounded-xl border-2 border-[#E7E3D8] bg-[#F6F4EE] p-3.5 cursor-pointer hover:border-[#14633F]">
                  <input data-testid="keg-multi-session" type="checkbox" className="accent-[#14633F] w-4 h-4 mt-0.5"
                    checked={multi} onChange={(e) => { setReviewConfirmed(false); setMulti(e.target.checked); }} />
                  <span>
                    <span className="block text-sm font-bold text-[#14201A] inline-flex items-center gap-1.5">
                      <Layers size={15} /> Beberapa waktu dalam 1 hari (pagi / sore / malam)
                    </span>
                    <span className="block text-xs text-[#5F6B63] mt-1 leading-relaxed">
                      Setiap waktu menjadi <b>sesi tersendiri</b>: absensi, rekap, kode akses, dan barcode
                      <b> terpisah</b>. Hadir sesi pagi tidak otomatis terhitung hadir di sesi sore/malam.
                    </span>
                  </span>
                </label>

                {multi && (
                  <div className="mt-3 space-y-2" data-testid="keg-session-list">
                    {sessions.map((s, i) => (
                      <div key={i} data-testid={`keg-session-row-${i}`}
                        className="rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] p-3 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-[1.2fr_1fr_1fr_auto] gap-2 items-end">
                          <div className="col-span-2 sm:col-span-1">
                            <label className="block text-[11px] font-semibold text-[#5F6B63] mb-1">Nama waktu</label>
                            <input data-testid={`keg-session-label-${i}`} list="session-presets" value={s.label}
                              onChange={(e) => setSession(i, "label", e.target.value)} placeholder="Pagi / Sore / Malam"
                              className="w-full h-11 px-3 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] bg-white" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-[#5F6B63] mb-1">Mulai</label>
                            <select data-testid={`keg-session-start-${i}`} value={s.start_time}
                              onChange={(e) => setSession(i, "start_time", e.target.value)}
                              className="w-full h-11 px-2 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] bg-white">
                              {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-[#5F6B63] mb-1">Selesai</label>
                            <select data-testid={`keg-session-end-${i}`} value={s.end_time}
                              onChange={(e) => setSession(i, "end_time", e.target.value)}
                              className="w-full h-11 px-2 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] bg-white">
                              {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <button type="button" data-testid={`keg-session-remove-${i}`} onClick={() => removeSession(i)}
                            disabled={sessions.length <= 2}
                            className="h-11 w-11 flex items-center justify-center rounded-xl border-2 border-[#E7E3D8] text-[#A32A2A] hover:border-[#A32A2A] disabled:opacity-40 bg-white">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-2">
                          <input data-testid={`${ACTIVITIES.sessionLocationPrefix}${i}`} list="kegiatan-location-suggestions" value={s.location || ""}
                            onChange={(e) => setSession(i, "location", e.target.value)} placeholder="Lokasi sesi"
                            className="w-full h-11 px-3 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] bg-white" />
                        </div>
                        <div className="rounded-xl border border-[#E7E3D8] bg-white p-3">
                          <label className="mb-2 block text-xs font-bold text-[#14201A]">
                            Peserta wajib sesi ini
                          </label>
                          <PesertaPicker
                            value={s.participant_ids || []}
                            onChange={(ids) => setSession(i, "participant_ids", ids)}
                            testid={`${ACTIVITIES.sessionParticipantPickerPrefix}${i}`}
                          />
                          <p className="mt-2 text-[11px] text-[#5F6B63]">
                            Peserta lain tetap terlihat di daftar, tetapi tidak otomatis dihitung Alpha.
                            Jika tidak memilih siapa pun, peserta sesuai filter kegiatan menjadi wajib.
                          </p>
                        </div>
                      </div>
                    ))}
                    <datalist id="session-presets">
                      {SESSION_LABEL_PRESETS.map((l) => <option key={l} value={l} />)}
                    </datalist>
                    <button type="button" data-testid="keg-session-add" onClick={addSession} disabled={sessions.length >= 6}
                      className="w-full h-11 rounded-xl border-2 border-dashed border-[#14633F] text-[#0E4E31] font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#E3F3EA] disabled:opacity-40">
                      <Plus size={16} /> Tambah Waktu / Sesi
                    </button>
                  </div>
                )}

                <div className="mt-3">
                  <label className={lbl}>Jadwal rutin bulanan</label>
                  <select data-testid={ACTIVITIES.recurringMonths} value={f.recurring_months}
                    onChange={(e) => set("recurring_months", Number(e.target.value))} className={fld}>
                    <option value={0}>Tidak berulang</option>
                    {[1, 2, 3, 6, 12].map((months) => (
                      <option key={months} value={months}>{months} {months === 1 ? "bulan" : "bulan"} ({months} jadwal bulanan)</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </Section>}

          {step === 2 && <Section icon={Users} title="Peserta Kegiatan" testid="form-section-peserta"
            desc="Tentukan tipe peserta, lalu saring menurut kelompok atau pilih orangnya langsung.">
            <div className="space-y-3">
              <div>
                <label className={lbl}>Tipe peserta</label>
                <select data-testid="keg-audience" value={f.audience} onChange={(e) => set("audience", e.target.value)} className={fld}>
                  {AUDIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="text-xs text-[#5F6B63] mt-1.5 leading-relaxed">
                  {AUDIENCE_OPTIONS.find((o) => o.value === f.audience)?.desc}
                </p>
              </div>

              <div>
                <label className={lbl}>Khusus jenis kelamin</label>
                <div className="grid grid-cols-3 gap-2">
                  {GENDER_FILTER_OPTIONS.map((o) => (
                    <Chip key={o.value} data-testid={`keg-gender-${o.value}`} on={f.gender_filter === o.value}
                      onClick={() => set("gender_filter", o.value)}>{o.short}</Chip>
                  ))}
                </div>
              </div>

              {/* FASE 18 — MODE CEKLIS peserta tertentu */}
              <div className="rounded-2xl border-2 border-[#14633F] bg-white p-3.5" data-testid="keg-pick-mode-box">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input data-testid="keg-pick-mode" type="checkbox" className="accent-[#14633F] w-4 h-4 mt-0.5"
                    checked={pickMode} onChange={(e) => { setReviewConfirmed(false); setPickMode(e.target.checked); }} />
                  <span>
                    <span className="block text-sm font-bold text-[#14201A] inline-flex items-center gap-1.5">
                      <ListChecks size={15} /> Pilih peserta tertentu (mode ceklis)
                    </span>
                    <span className="block text-xs text-[#5F6B63] mt-1 leading-relaxed">
                      Dicentang = hanya peserta yang Anda pilih yang masuk daftar absen, halaman
                      absensi, dan laporan kegiatan ini. Penyaringan kelompok di bawah tetap berlaku
                      sebagai tambahan.
                    </span>
                  </span>
                </label>
                {pickMode && (
                  <div className="mt-3">
                    <PesertaPicker value={participants} onChange={(ids) => {
                      setReviewConfirmed(false);
                      setParticipants(ids);
                    }} testid={ACTIVITIES.participantPicker} />
                  </div>
                )}
              </div>

              {(!multi || editing) && (
                <div className="rounded-2xl border-2 border-[#14633F] bg-white p-3.5" data-testid={ACTIVITIES.attendanceParticipants}>
                  <label className="mb-1 block text-sm font-bold text-[#14201A]">
                    Peserta wajib diabsen
                  </label>
                  <p className="mb-3 text-xs leading-relaxed text-[#5F6B63]">
                    Peserta lain tetap muncul di daftar, tetapi tidak otomatis dihitung Alpha.
                    Jika tidak ada pilihan, semua peserta sesuai filter kegiatan menjadi wajib.
                  </p>
                  <PesertaPicker
                    value={requiredParticipants}
                    onChange={(ids) => {
                      setReviewConfirmed(false);
                      setRequiredParticipants(ids);
                    }}
                    testid={ACTIVITIES.attendanceParticipantPicker}
                  />
                </div>
              )}

              <div className="rounded-2xl border-2 border-[#E7E3D8] bg-[#F6F4EE] p-3.5" data-testid="keg-advanced-group">
                <div className="flex items-center gap-2 text-sm font-bold text-[#0E4E31]">
                  <SlidersHorizontal size={15} /> Pengelompokan Lanjutan
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-bold text-[#14201A] mb-1.5">Status pernikahan</label>
                  <div className="grid grid-cols-3 gap-2">
                    {MARITAL_FILTER_OPTIONS.map((o) => (
                      <Chip key={o.value} data-testid={`keg-marital-${o.value}`} on={f.marital_filter === o.value}
                        onClick={() => set("marital_filter", o.value)}>{o.short}</Chip>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-bold text-[#14201A] mb-1.5">
                    Kelompok usia <span className="font-normal text-[#5F6B63]">(tidak dipilih = semua usia)</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AGE_GROUP_OPTIONS.map((o) => {
                      const on = (f.age_filter || []).includes(o.value);
                      return (
                        <button key={o.value} type="button" data-testid={`keg-age-${o.value}`} onClick={() => toggleAge(o.value)}
                          className={`h-12 rounded-xl border-2 font-semibold text-xs transition-colors flex flex-col items-center justify-center leading-tight ${
                            on ? "bg-[#14633F] text-white border-transparent" : "bg-white text-[#5F6B63] border-[#E7E3D8] hover:border-[#14633F] hover:text-[#0E4E31]"
                          }`}>
                          <span>{o.label}</span>
                          <span className={`text-[10px] font-medium ${on ? "text-white/80" : "text-[#5F6B63]"}`}>{o.range}</span>
                        </button>
                      );
                    })}
                    {(f.age_filter || []).length > 0 && (
                      <button type="button" data-testid="keg-age-reset" onClick={() => set("age_filter", [])}
                        className="h-12 rounded-xl border-2 border-dashed border-[#5F6B63] text-[#5F6B63] font-semibold text-xs hover:border-[#A32A2A] hover:text-[#A32A2A] bg-white">
                        Semua Usia
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6B4500] mt-2 leading-relaxed bg-[#FBF1D6] rounded-lg px-2.5 py-2 flex items-start gap-1.5">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>
                      Usia dihitung dari <b>tanggal lahir</b> dan status dari profil peserta. Peserta
                      yang datanya belum diisi tidak masuk daftar kegiatan khusus ini.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </Section>}

          {step === 3 && (
            <Section icon={ListChecks} title="Tinjau Kegiatan" testid={ACTIVITIES.wizardReview}
              desc="Pastikan informasi dan pilihan kegiatan sudah benar sebelum disimpan.">
              <dl className="grid gap-2 sm:grid-cols-2">
                <ReviewItem label="Nama kegiatan" value={f.name || "Belum diisi"} />
                <ReviewItem label="Jenis" value={KEGIATAN_TYPES.find((type) => type.value === f.type)?.label || f.type} />
                <ReviewItem label="Tanggal" value={f.date} />
                <ReviewItem label="Waktu" value={!editing && multi
                  ? sessions.map((session) => `${session.label} ${session.start_time}–${session.end_time}`).join(", ")
                  : `${f.start_time}–${f.end_time} WITA`} />
                <ReviewItem label="Pengajar" value={f.teacher || "Belum ditentukan"} />
                <ReviewItem label="Materi" value={f.material || "Belum ditentukan"} />
                <ReviewItem label="Lokasi" value={f.location || "Belum ditentukan"} />
                <ReviewItem label="Alamat Google Maps" value={f.maps_query || "Belum ditentukan"} />
                <ReviewItem label="Peserta" value={pickMode ? `${participants.length} peserta dipilih` : AUDIENCE_OPTIONS.find((option) => option.value === f.audience)?.short || "Reguler"} />
                <ReviewItem label="Pengulangan" value={!editing && Number(f.recurring_months)
                  ? `Bulanan, ${f.recurring_months} jadwal` : "Tidak berulang"} />
              </dl>
              <p className="mt-4 rounded-xl bg-[#E3F3EA] p-3 text-sm text-[#0E4E31]">
                Periksa kembali semua informasi. Data belum disimpan sampai tombol Simpan ditekan.
              </p>
              <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 border-[#E7E3D8] bg-white px-3 py-2 text-sm font-semibold text-[#14201A]">
                <input type="checkbox" data-testid={ACTIVITIES.reviewConfirm} checked={reviewConfirmed}
                  onChange={(event) => setReviewConfirmed(event.target.checked)}
                  className="h-5 w-5 accent-[#14633F]" />
                Saya sudah memeriksa informasi kegiatan.
              </label>
            </Section>
          )}
        </form>
    </Modal>
  );
}
