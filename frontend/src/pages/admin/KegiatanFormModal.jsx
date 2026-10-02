// FASE 18 — Form Tambah/Edit Kegiatan: tampilan baru (modal berlapis, nyaman di HP & PC).
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Plus, Loader2, Layers, Trash2, SlidersHorizontal, AlertTriangle,
  CalendarDays, Info, Users, ListChecks, Save,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import PesertaPicker from "@/components/PesertaPicker";
import {
  KEGIATAN_TYPES, timeOptions, AUDIENCE_OPTIONS, GENDER_FILTER_OPTIONS,
  MARITAL_FILTER_OPTIONS, AGE_GROUP_OPTIONS, SESSION_LABEL_PRESETS, SESSION_DEFAULT_TIME,
} from "./kegiatanUtils";

const TIMES = timeOptions();
const fld = "w-full h-12 px-3.5 rounded-xl border-2 border-[#E8E8E4] text-[15px] outline-none focus:border-[#111114] bg-white transition-colors";
const lbl = "block text-[13px] font-semibold text-[#111827] mb-1.5";

function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function Section({ icon: Icon, title, desc, children, testid }) {
  return (
    <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 sm:p-5" data-testid={testid}>
      <div className="flex items-start gap-3 mb-3.5">
        <span className="h-9 w-9 shrink-0 rounded-xl bg-[#F1F1EE] text-[#111114] flex items-center justify-center">
          <Icon size={17} />
        </span>
        <div className="min-w-0">
          <h3 className="font-heading font-bold text-[#111827] text-[15px] leading-tight">{title}</h3>
          {desc && <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Chip({ on, children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className={`h-11 rounded-xl border-2 font-semibold text-xs sm:text-sm transition-colors ${
        on ? "bg-[#111114] text-white border-transparent" : "bg-white text-[#4B5563] border-[#E8E8E4] hover:border-[#111114] hover:text-[#111114]"
      }`}
    >
      {children}
    </button>
  );
}

export default function KegiatanFormModal({ onClose, onDone, initial }) {
  const editing = Boolean(initial?.id);
  const [f, setF] = useState({
    name: initial?.name || "", type: initial?.type || "rutin",
    date: initial?.date || todayYmd(), start_time: initial?.start_time || "20:00",
    end_time: initial?.end_time || "21:30", teacher: initial?.teacher || "",
    material: initial?.material || "", location: initial?.location || "", recurring: false,
    audience: initial?.audience || "reguler",
    gender_filter: initial?.gender_filter || "semua",
    marital_filter: initial?.marital_filter || "semua",
    age_filter: initial?.age_filter || [],
  });
  // FASE 18 — mode ceklis peserta tertentu
  const [pickMode, setPickMode] = useState((initial?.participant_ids || []).length > 0);
  const [participants, setParticipants] = useState(initial?.participant_ids || []);
  const [multi, setMulti] = useState(false);
  const [sessions, setSessions] = useState([
    { label: "Pagi", start_time: "08:00", end_time: "10:00", teacher: "", material: "", location: "", required: true },
    { label: "Sore", start_time: "16:00", end_time: "17:30", teacher: "", material: "", location: "", required: true },
  ]);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleAge = (val) => setF((p) => {
    const cur = p.age_filter || [];
    return { ...p, age_filter: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] };
  });

  const setSession = (i, key, val) => setSessions((p) => p.map((s, idx) => (idx === i ? { ...s, [key]: val } : s)));
  const addSession = () => setSessions((p) => {
    const used = p.map((s) => s.label);
    const next = SESSION_LABEL_PRESETS.find((l) => !used.includes(l)) || `Sesi ${p.length + 1}`;
    const [st, en] = SESSION_DEFAULT_TIME[next] || ["08:00", "10:00"];
    return [...p, { label: next, start_time: st, end_time: en, teacher: "", material: "", location: "", required: true }];
  });
  const removeSession = (i) => setSessions((p) => p.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) { toast.error("Nama kegiatan wajib diisi"); return; }
    if (!editing && multi) {
      if (sessions.length < 2) { toast.error("Minimal 2 waktu/sesi bila memakai beberapa waktu"); return; }
      if (sessions.some((s) => !String(s.label).trim())) { toast.error("Nama setiap waktu/sesi wajib diisi"); return; }
    }
    if (pickMode && participants.length === 0) {
      toast.error("Mode ceklis aktif — mohon centang minimal 1 peserta."); return;
    }
    setSaving(true);
    try {
      const participant_ids = pickMode ? participants : [];
      if (editing) {
        const { recurring, ...rest } = f;
        await api.patch(`/admin/kegiatan/${initial.id}`, { ...rest, participant_ids });
        toast.success("Kegiatan diperbarui.");
      } else {
        const { data } = await api.post("/admin/kegiatan", {
          ...f, participant_ids, sessions: multi ? sessions : [],
        });
        const parts = [];
        if (multi) parts.push(`${sessions.length} waktu/sesi`);
        if (f.recurring) parts.push("berulang 4 minggu");
        if (participant_ids.length) parts.push(`${participant_ids.length} peserta terpilih`);
        toast.success(`Kegiatan dibuat${parts.length ? ` (${parts.join(", ")}, total ${data.length} jadwal)` : ""}.`);
      }
      onDone();
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return createPortal((
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        data-testid={editing ? "modal-edit-kegiatan" : "modal-add-kegiatan"}
        className="relative bg-[#F7F7F5] w-full sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-white">
          <div className="h-1.5 w-11 rounded-full bg-[#E8E8E4]" />
        </div>

        {/* Header */}
        <div className="bg-white px-5 py-3.5 border-b border-[#ECECE8] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-[#111827] text-lg leading-tight">
              {editing ? "Edit Kegiatan" : "Tambah Kegiatan"}
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              {editing ? "Ubah jadwal, pengajar, dan penyaringan peserta." : "Isi jadwal pengajian lalu atur siapa saja pesertanya."}
            </p>
          </div>
          <button onClick={onClose} data-testid="kegiatan-form-close"
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F4F4F1]">
            <X size={19} />
          </button>
        </div>

        {/* Body */}
        <form id="kegiatan-form" onSubmit={submit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          <Section icon={Info} title="Informasi Kegiatan" testid="form-section-info"
            desc="Nama, jenis, pengajar, materi, dan lokasi kegiatan.">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={lbl}>Nama kegiatan *</label>
                <input data-testid="keg-name" required value={f.name} onChange={(e) => set("name", e.target.value)}
                  placeholder="cth: Pengajian Rutin Kertalangu" className={fld} />
              </div>
              <div>
                <label className={lbl}>Jenis</label>
                <select data-testid="keg-type" value={f.type} onChange={(e) => set("type", e.target.value)} className={fld}>
                  {KEGIATAN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Pengajar</label>
                <input data-testid="keg-teacher" value={f.teacher} onChange={(e) => set("teacher", e.target.value)}
                  placeholder="cth: Ust. Hasan Basri" className={fld} />
              </div>
              <div>
                <label className={lbl}>Materi</label>
                <input data-testid="keg-material" value={f.material} onChange={(e) => set("material", e.target.value)}
                  placeholder="cth: Kitab Fiqih Bab Sholat" className={fld} />
              </div>
              <div>
                <label className={lbl}>Lokasi</label>
                <input data-testid="keg-location" value={f.location} onChange={(e) => set("location", e.target.value)}
                  placeholder="cth: Masjid Kertalangu" className={fld} />
              </div>
            </div>
          </Section>

          <Section icon={CalendarDays} title="Tanggal & Waktu" testid="form-section-waktu"
            desc="Pilih tanggal; aktifkan beberapa waktu bila sehari ada pagi/sore/malam.">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Tanggal</label>
                <input data-testid="keg-date" type="date" required value={f.date}
                  onChange={(e) => set("date", e.target.value)} className={fld} />
              </div>
              {!editing && multi ? (
                <div className="sm:col-span-2 rounded-xl border-2 border-dashed border-[#E8E8E4] bg-[#FAFAF8] px-3.5 py-3 text-xs text-[#4B5563] flex items-center">
                  Jam diatur pada daftar <b className="mx-1">Waktu / Sesi</b> di bawah.
                </div>
              ) : (
                <>
                  <div>
                    <label className={lbl}>Mulai (WITA)</label>
                    <select data-testid="keg-start" value={f.start_time} onChange={(e) => set("start_time", e.target.value)} className={fld}>
                      {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Selesai (WITA)</label>
                    <select data-testid="keg-end" value={f.end_time} onChange={(e) => set("end_time", e.target.value)} className={fld}>
                      {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            {!editing && (
              <>
                <label className="mt-3 flex items-start gap-2.5 rounded-xl border-2 border-[#E8E8E4] bg-[#FAFAF8] p-3.5 cursor-pointer hover:border-[#111114]">
                  <input data-testid="keg-multi-session" type="checkbox" className="accent-[#111114] w-4 h-4 mt-0.5"
                    checked={multi} onChange={(e) => setMulti(e.target.checked)} />
                  <span>
                    <span className="block text-sm font-bold text-[#111827] inline-flex items-center gap-1.5">
                      <Layers size={15} /> Beberapa waktu dalam 1 hari (pagi / sore / malam)
                    </span>
                    <span className="block text-xs text-[#6B7280] mt-1 leading-relaxed">
                      Setiap waktu menjadi <b>sesi tersendiri</b>: absensi, rekap, kode akses, dan barcode
                      <b> terpisah</b>. Hadir sesi pagi tidak otomatis terhitung hadir di sesi sore/malam.
                    </span>
                  </span>
                </label>

                {multi && (
                  <div className="mt-3 space-y-2" data-testid="keg-session-list">
                    {sessions.map((s, i) => (
                      <div key={i} data-testid={`keg-session-row-${i}`}
                        className="rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] p-3 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-[1.2fr_1fr_1fr_auto] gap-2 items-end">
                          <div className="col-span-2 sm:col-span-1">
                            <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Nama waktu</label>
                            <input data-testid={`keg-session-label-${i}`} list="session-presets" value={s.label}
                              onChange={(e) => setSession(i, "label", e.target.value)} placeholder="Pagi / Sore / Malam"
                              className="w-full h-11 px-3 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114] bg-white" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Mulai</label>
                            <select data-testid={`keg-session-start-${i}`} value={s.start_time}
                              onChange={(e) => setSession(i, "start_time", e.target.value)}
                              className="w-full h-11 px-2 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114] bg-white">
                              {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Selesai</label>
                            <select data-testid={`keg-session-end-${i}`} value={s.end_time}
                              onChange={(e) => setSession(i, "end_time", e.target.value)}
                              className="w-full h-11 px-2 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114] bg-white">
                              {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </div>
                          <button type="button" data-testid={`keg-session-remove-${i}`} onClick={() => removeSession(i)}
                            disabled={sessions.length <= 2}
                            className="h-11 w-11 flex items-center justify-center rounded-xl border-2 border-[#E8E8E4] text-[#DC2626] hover:border-[#DC2626] disabled:opacity-40 bg-white">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-2">
                          <input data-testid={`keg-session-teacher-${i}`} value={s.teacher || ""}
                            onChange={(e) => setSession(i, "teacher", e.target.value)} placeholder="Pengajar sesi ini"
                            className="w-full h-11 px-3 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114] bg-white" />
                          <input data-testid={`keg-session-material-${i}`} value={s.material || ""}
                            onChange={(e) => setSession(i, "material", e.target.value)} placeholder="Materi sesi ini"
                            className="w-full h-11 px-3 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114] bg-white" />
                          <input data-testid={`keg-session-location-${i}`} value={s.location || ""}
                            onChange={(e) => setSession(i, "location", e.target.value)} placeholder="Lokasi sesi ini"
                            className="w-full h-11 px-3 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114] bg-white" />
                        </div>
                        <label className="flex items-start gap-2.5 rounded-xl border-2 border-[#E8E8E4] bg-white px-3 py-2.5 cursor-pointer hover:border-[#111114]">
                          <input type="checkbox" data-testid={`keg-session-required-${i}`} checked={s.required !== false}
                            onChange={(e) => setSession(i, "required", e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#111114]" />
                          <span className="leading-snug">
                            <span className="block text-xs font-bold text-[#111827]">Sesi ini WAJIB dihadiri</span>
                            <span className="block text-[11px] text-[#6B7280]">
                              Dilepas = sesi opsional/tambahan, tidak dihitung Alpha.
                            </span>
                          </span>
                        </label>
                      </div>
                    ))}
                    <datalist id="session-presets">
                      {SESSION_LABEL_PRESETS.map((l) => <option key={l} value={l} />)}
                    </datalist>
                    <button type="button" data-testid="keg-session-add" onClick={addSession} disabled={sessions.length >= 6}
                      className="w-full h-11 rounded-xl border-2 border-dashed border-[#111114] text-[#111114] font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#F1F1EE] disabled:opacity-40">
                      <Plus size={16} /> Tambah Waktu / Sesi
                    </button>
                  </div>
                )}

                <label className="mt-3 flex items-center gap-2.5 px-3.5 h-12 rounded-xl border-2 border-[#E8E8E4] bg-[#FAFAF8] cursor-pointer hover:border-[#111114]">
                  <input data-testid="keg-recurring" type="checkbox" className="accent-[#111114] w-4 h-4"
                    checked={f.recurring} onChange={(e) => set("recurring", e.target.checked)} />
                  <span className="text-sm font-semibold text-[#111827]">Kegiatan berulang (4 minggu, mingguan)</span>
                </label>
              </>
            )}
          </Section>

          <Section icon={Users} title="Peserta Kegiatan" testid="form-section-peserta"
            desc="Tentukan tipe peserta, lalu saring menurut kelompok atau pilih orangnya langsung.">
            <div className="space-y-3">
              <div>
                <label className={lbl}>Tipe peserta</label>
                <select data-testid="keg-audience" value={f.audience} onChange={(e) => set("audience", e.target.value)} className={fld}>
                  {AUDIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="text-xs text-[#6B7280] mt-1.5 leading-relaxed">
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
              <div className="rounded-2xl border-2 border-[#111114] bg-white p-3.5" data-testid="keg-pick-mode-box">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input data-testid="keg-pick-mode" type="checkbox" className="accent-[#111114] w-4 h-4 mt-0.5"
                    checked={pickMode} onChange={(e) => setPickMode(e.target.checked)} />
                  <span>
                    <span className="block text-sm font-bold text-[#111827] inline-flex items-center gap-1.5">
                      <ListChecks size={15} /> Pilih peserta tertentu (mode ceklis)
                    </span>
                    <span className="block text-xs text-[#6B7280] mt-1 leading-relaxed">
                      Dicentang = hanya peserta yang Anda pilih yang masuk daftar absen, halaman
                      absensi, dan laporan kegiatan ini. Penyaringan kelompok di bawah tetap berlaku
                      sebagai tambahan.
                    </span>
                  </span>
                </label>
                {pickMode && (
                  <div className="mt-3">
                    <PesertaPicker value={participants} onChange={setParticipants} testid="keg-peserta-picker" />
                  </div>
                )}
              </div>

              <div className="rounded-2xl border-2 border-[#E8E8E4] bg-[#FAFAF8] p-3.5" data-testid="keg-advanced-group">
                <div className="flex items-center gap-2 text-sm font-bold text-[#111114]">
                  <SlidersHorizontal size={15} /> Pengelompokan Lanjutan
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-bold text-[#111827] mb-1.5">Status pernikahan</label>
                  <div className="grid grid-cols-3 gap-2">
                    {MARITAL_FILTER_OPTIONS.map((o) => (
                      <Chip key={o.value} data-testid={`keg-marital-${o.value}`} on={f.marital_filter === o.value}
                        onClick={() => set("marital_filter", o.value)}>{o.short}</Chip>
                    ))}
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-bold text-[#111827] mb-1.5">
                    Kelompok usia <span className="font-normal text-[#6B7280]">(tidak dipilih = semua usia)</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {AGE_GROUP_OPTIONS.map((o) => {
                      const on = (f.age_filter || []).includes(o.value);
                      return (
                        <button key={o.value} type="button" data-testid={`keg-age-${o.value}`} onClick={() => toggleAge(o.value)}
                          className={`h-12 rounded-xl border-2 font-semibold text-xs transition-colors flex flex-col items-center justify-center leading-tight ${
                            on ? "bg-[#111114] text-white border-transparent" : "bg-white text-[#4B5563] border-[#E8E8E4] hover:border-[#111114] hover:text-[#111114]"
                          }`}>
                          <span>{o.label}</span>
                          <span className={`text-[10px] font-medium ${on ? "text-white/80" : "text-[#9CA3AF]"}`}>{o.range}</span>
                        </button>
                      );
                    })}
                    {(f.age_filter || []).length > 0 && (
                      <button type="button" data-testid="keg-age-reset" onClick={() => set("age_filter", [])}
                        className="h-12 rounded-xl border-2 border-dashed border-[#9CA3AF] text-[#6B7280] font-semibold text-xs hover:border-[#DC2626] hover:text-[#DC2626] bg-white">
                        Semua Usia
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[#92400E] mt-2 leading-relaxed bg-[#FEF3C7] rounded-lg px-2.5 py-2 flex items-start gap-1.5">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>
                      Usia dihitung dari <b>tanggal lahir</b> dan status dari profil peserta. Peserta
                      yang datanya belum diisi tidak masuk daftar kegiatan khusus ini.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </Section>
        </form>

        {/* Footer tetap terlihat */}
        <div className="bg-white border-t border-[#ECECE8] px-4 sm:px-5 py-3 flex gap-2">
          <button type="button" onClick={onClose} data-testid="kegiatan-form-cancel"
            className="h-12 px-4 rounded-xl bg-[#F4F4F1] text-[#4B5563] font-semibold hover:bg-[#E9EDE9]">
            Batal
          </button>
          <button form="kegiatan-form" type="submit" data-testid="button-submit-kegiatan" disabled={saving}
            className="flex-1 h-12 rounded-xl bg-[#111114] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-black disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={18} /> : editing ? <Save size={18} /> : <Plus size={18} />}
            {editing ? "Simpan Perubahan" : "Simpan Kegiatan"}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}
