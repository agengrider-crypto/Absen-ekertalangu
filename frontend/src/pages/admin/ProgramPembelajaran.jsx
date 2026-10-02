// FASE 20 — Program Pembelajaran: kurikulum, materi + media, dan jadwal per jenjang.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen, GraduationCap, Loader2, Plus, Save, Trash2, Link2, Paperclip, X,
  CalendarClock, Target, Lightbulb, FileText, Image as ImageIcon, ExternalLink, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { api, API, formatApiErrorDetail } from "@/lib/api";

const fld = "w-full h-11 px-3.5 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114] bg-white";
const area = "w-full px-3.5 py-2.5 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114] bg-white resize-none";
const lbl = "block text-[13px] font-semibold text-[#111827] mb-1.5";

function MediaChip({ m, onRemove }) {
  const isFile = m.kind === "file";
  const Icon = isFile ? ((m.content_type || "").includes("pdf") ? FileText : ImageIcon) : Link2;
  const href = isFile ? `${API}/program/file/${m.file_id}` : m.url;
  return (
    <span className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1.5 rounded-lg border border-[#E8E8E4] bg-[#FAFAF8] text-xs text-[#111827] max-w-full">
      <Icon size={13} className="shrink-0 text-[#4B5563]" />
      <a href={href} target="_blank" rel="noreferrer" className="truncate max-w-[180px] hover:underline">
        {m.label || (isFile ? "Berkas" : m.url)}
      </a>
      {!isFile && <ExternalLink size={11} className="text-[#9CA3AF] shrink-0" />}
      {onRemove && (
        <button type="button" onClick={onRemove}
          className="h-6 w-6 shrink-0 flex items-center justify-center rounded-md text-[#9CA3AF] hover:text-[#DC2626] hover:bg-white">
          <X size={13} />
        </button>
      )}
    </span>
  );
}

function MateriForm({ jenjangId, initial, onClose, onDone }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [pekan, setPekan] = useState(initial?.pekan || "");
  const [desc, setDesc] = useState(initial?.description || "");
  const [media, setMedia] = useState(initial?.media || []);
  const [link, setLink] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const addLink = () => {
    const url = link.trim();
    if (!url) return;
    setMedia((p) => [...p, { kind: "link", url, label: linkLabel.trim() || url }]);
    setLink(""); setLinkLabel("");
  };

  const upload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const { data } = await api.post("/program/upload", fd,
        { headers: { "Content-Type": "multipart/form-data" } });
      setMedia((p) => [...p, { kind: "file", file_id: data.file_id, label: data.name,
        url: data.url, content_type: data.content_type }]);
      toast.success("Berkas terunggah.");
    } catch (e2) { toast.error(formatApiErrorDetail(e2.response?.data?.detail)); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { toast.error("Judul materi wajib diisi"); return; }
    setBusy(true);
    const body = {
      title: title.trim(), description: desc.trim(),
      pekan: pekan === "" ? null : Number(pekan),
      media: media.map((m) => ({ kind: m.kind, label: m.label, url: m.kind === "link" ? m.url : null, file_id: m.file_id || null })),
    };
    try {
      if (initial?.id) await api.patch(`/program/materi/${initial.id}`, body);
      else await api.post(`/program/${jenjangId}/materi`, body);
      toast.success(initial?.id ? "Materi diperbarui." : "Materi ditambahkan.");
      onDone();
    } catch (e2) { toast.error(formatApiErrorDetail(e2.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} data-testid="program-materi-form"
      className="rounded-2xl border-2 border-[#111114] bg-white p-4 space-y-3">
      <div className="font-bold text-[#111827] text-sm">
        {initial?.id ? "Edit Materi" : "Materi Baru"}
      </div>
      <div className="grid sm:grid-cols-[1fr_120px] gap-3">
        <div>
          <label className={lbl}>Judul materi *</label>
          <input data-testid="program-materi-title" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="cth: Mengenal Huruf Hijaiyah" className={fld} />
        </div>
        <div>
          <label className={lbl}>Pekan ke-</label>
          <input data-testid="program-materi-pekan" type="number" min="1" value={pekan}
            onChange={(e) => setPekan(e.target.value)} placeholder="1" className={fld} />
        </div>
      </div>
      <div>
        <label className={lbl}>Uraian / metode mengajar</label>
        <textarea data-testid="program-materi-desc" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)}
          placeholder="cth: Bernyanyi bersama, kartu bergambar, lalu praktik menulis." className={area} />
      </div>
      <div>
        <label className={lbl}>Media pembelajaran</label>
        {media.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {media.map((m, i) => (
              <MediaChip key={i} m={m} onRemove={() => setMedia((p) => p.filter((_, x) => x !== i))} />
            ))}
          </div>
        )}
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
          <input data-testid="program-media-url" value={link} onChange={(e) => setLink(e.target.value)}
            placeholder="Tautan video / bacaan" className={fld} />
          <input data-testid="program-media-label" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)}
            placeholder="Nama tautan (opsional)" className={fld} />
          <button type="button" data-testid="program-media-add-link" onClick={addLink}
            className="h-11 px-3.5 rounded-xl border-2 border-[#E8E8E4] text-sm font-semibold text-[#4B5563] hover:border-[#111114] hover:text-[#111114] inline-flex items-center gap-1.5">
            <Link2 size={15} /> Tautan
          </button>
        </div>
        <label className="mt-2 inline-flex items-center gap-2 h-11 px-3.5 rounded-xl border-2 border-dashed border-[#111114] text-sm font-semibold text-[#111114] cursor-pointer hover:bg-[#F1F1EE]">
          {uploading ? <Loader2 className="animate-spin" size={15} /> : <Paperclip size={15} />}
          Unggah berkas (PDF / gambar, maks 10 MB)
          <input data-testid="program-media-file" type="file" className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif" onChange={upload} disabled={uploading} />
        </label>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onClose} data-testid="program-materi-cancel"
          className="h-11 px-4 rounded-xl bg-[#F4F4F1] text-[#4B5563] font-semibold hover:bg-[#E9EDE9]">Batal</button>
        <button type="submit" disabled={busy} data-testid="program-materi-submit"
          className="flex-1 h-11 rounded-xl bg-[#111114] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-black disabled:opacity-60">
          {busy ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />} Simpan Materi
        </button>
      </div>
    </form>
  );
}

function JadwalForm({ jenjangId, hari, onDone }) {
  const [f, setF] = useState({ day: "Ahad", start_time: "08:00", end_time: "10:00", teacher: "", location: "", note: "" });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/program/${jenjangId}/jadwal`, f);
      toast.success("Jadwal ditambahkan.");
      onDone();
    } catch (e2) { toast.error(formatApiErrorDetail(e2.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} data-testid="program-jadwal-form"
      className="rounded-xl border-2 border-[#E8E8E4] bg-[#FAFAF8] p-3.5 grid sm:grid-cols-6 gap-2 items-end">
      <div className="sm:col-span-2">
        <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Hari</label>
        <select data-testid="program-jadwal-day" value={f.day} onChange={(e) => set("day", e.target.value)} className={fld}>
          {hari.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Mulai</label>
        <input data-testid="program-jadwal-start" type="time" value={f.start_time}
          onChange={(e) => set("start_time", e.target.value)} className={fld} />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Selesai</label>
        <input data-testid="program-jadwal-end" type="time" value={f.end_time}
          onChange={(e) => set("end_time", e.target.value)} className={fld} />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Pengajar</label>
        <input data-testid="program-jadwal-teacher" value={f.teacher}
          onChange={(e) => set("teacher", e.target.value)} placeholder="Nama" className={fld} />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#6B7280] mb-1">Tempat</label>
        <input data-testid="program-jadwal-location" value={f.location}
          onChange={(e) => set("location", e.target.value)} placeholder="Ruang / masjid" className={fld} />
      </div>
      <button type="submit" disabled={busy} data-testid="program-jadwal-submit"
        className="sm:col-span-6 h-11 rounded-xl bg-[#111114] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-black disabled:opacity-60">
        {busy ? <Loader2 className="animate-spin" size={17} /> : <Plus size={17} />} Tambah Jadwal
      </button>
    </form>
  );
}

export default function ProgramPembelajaran() {
  const [list, setList] = useState(null);
  const [hari, setHari] = useState([]);
  const [pick, setPick] = useState("paud");
  const [detail, setDetail] = useState(null);
  const [kur, setKur] = useState({ tujuan: "", metode: "", catatan: "" });
  const [savingKur, setSavingKur] = useState(false);
  const [showMateri, setShowMateri] = useState(false);
  const [editMateri, setEditMateri] = useState(null);

  const loadList = useCallback(() => {
    api.get("/program/jenjang").then(({ data }) => { setList(data.items || []); setHari(data.hari || []); })
      .catch((e) => { setList([]); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, []);

  const loadDetail = useCallback(() => {
    setDetail(null);
    api.get(`/program/${pick}`).then(({ data }) => {
      setDetail(data);
      setKur({ tujuan: data.kurikulum.tujuan, metode: data.kurikulum.metode, catatan: data.kurikulum.catatan });
    }).catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  }, [pick]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  const groups = useMemo(() => {
    const g = {};
    (list || []).forEach((j) => { (g[j.group] = g[j.group] || []).push(j); });
    return g;
  }, [list]);

  const canEdit = detail?.can_edit;

  const saveKur = async () => {
    setSavingKur(true);
    try {
      await api.put(`/program/${pick}/kurikulum`, kur);
      toast.success("Kurikulum disimpan.");
      loadDetail();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSavingKur(false); }
  };

  const delMateri = async (id) => {
    if (!window.confirm("Hapus materi ini?")) return;
    try { await api.delete(`/program/materi/${id}`); toast.success("Materi dihapus."); loadDetail(); loadList(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const delJadwal = async (id) => {
    if (!window.confirm("Hapus jadwal ini?")) return;
    try { await api.delete(`/program/jadwal/${id}`); toast.success("Jadwal dihapus."); loadDetail(); loadList(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  if (list === null) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={30} /></div>;
  }

  return (
    <div data-testid="program-pembelajaran">
      <div className="mb-4">
        <div className="flex items-center gap-2 text-[#111114] font-bold text-lg">
          <BookOpen size={20} /> Program Pembelajaran
        </div>
        <p className="text-sm text-[#6B7280] mt-0.5">
          Kurikulum, materi beserta media pembelajaran, dan jadwal untuk setiap jenjang.
          {canEdit === false && " Anda dapat melihat, perubahan dilakukan Adminator atau Guru."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr] items-start">
        {/* Daftar jenjang */}
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-3 space-y-3" data-testid="program-jenjang-list">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] px-1.5 mb-1.5">{group}</div>
              <div className="space-y-1">
                {items.map((j) => {
                  const on = pick === j.id;
                  return (
                    <button key={j.id} data-testid={`program-jenjang-${j.id}`} onClick={() => setPick(j.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                        on ? "bg-[#111114] text-white" : "text-[#4B5563] hover:bg-[#F4F4F1] hover:text-[#111114]"
                      }`}>
                      <span className="block text-sm font-semibold">{j.label}</span>
                      <span className={`block text-[11px] ${on ? "text-white/70" : "text-[#9CA3AF]"}`}>
                        {j.materi_count} materi · {j.jadwal_count} jadwal
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Detail jenjang */}
        {detail === null ? (
          <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={28} /></div>
        ) : (
          <div className="space-y-4" data-testid="program-detail">
            <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5">
              <div className="flex items-center gap-2.5">
                <span className="h-10 w-10 rounded-xl bg-[#F1F1EE] text-[#111114] flex items-center justify-center">
                  <GraduationCap size={19} />
                </span>
                <div>
                  <div className="font-heading font-bold text-xl text-[#111827]">{detail.jenjang.label}</div>
                  <div className="text-xs text-[#6B7280]">{detail.jenjang.group} · {detail.jenjang.age}</div>
                </div>
              </div>
            </div>

            {/* Kurikulum */}
            <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5" data-testid="program-kurikulum">
              <div className="font-bold text-[#111827] inline-flex items-center gap-2">
                <Target size={17} /> Kurikulum &amp; Capaian
              </div>
              {detail.kurikulum.updated_by && (
                <p className="text-[11px] text-[#9CA3AF] mt-1">
                  Terakhir diubah oleh {detail.kurikulum.updated_by}
                </p>
              )}
              {canEdit ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className={lbl}>Tujuan / capaian pembelajaran</label>
                    <textarea data-testid="program-kurikulum-tujuan" rows={3} className={area}
                      value={kur.tujuan} onChange={(e) => setKur((p) => ({ ...p, tujuan: e.target.value }))}
                      placeholder="cth: Peserta mengenal huruf hijaiyah dan hafal doa harian." />
                  </div>
                  <div>
                    <label className={lbl}>Metode &amp; media pembelajaran</label>
                    <textarea data-testid="program-kurikulum-metode" rows={3} className={area}
                      value={kur.metode} onChange={(e) => setKur((p) => ({ ...p, metode: e.target.value }))}
                      placeholder="cth: Bermain peran, kartu bergambar, video animasi, lagu, praktik langsung." />
                  </div>
                  <div>
                    <label className={lbl}>Catatan pengajar</label>
                    <textarea data-testid="program-kurikulum-catatan" rows={2} className={area}
                      value={kur.catatan} onChange={(e) => setKur((p) => ({ ...p, catatan: e.target.value }))}
                      placeholder="cth: Durasi maksimal 30 menit, banyak gerak dan pujian." />
                  </div>
                  <button data-testid="program-kurikulum-save" onClick={saveKur} disabled={savingKur}
                    className="h-11 px-4 rounded-xl bg-[#111114] text-white font-bold inline-flex items-center gap-2 hover:bg-black disabled:opacity-60">
                    {savingKur ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />} Simpan Kurikulum
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-3 text-sm text-[#4B5563]">
                  <div><b className="text-[#111827]">Tujuan:</b> {detail.kurikulum.tujuan || "—"}</div>
                  <div><b className="text-[#111827]">Metode &amp; media:</b> {detail.kurikulum.metode || "—"}</div>
                  <div><b className="text-[#111827]">Catatan:</b> {detail.kurikulum.catatan || "—"}</div>
                </div>
              )}
            </div>

            {/* Materi */}
            <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5" data-testid="program-materi">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-bold text-[#111827] inline-flex items-center gap-2">
                  <Lightbulb size={17} /> Materi &amp; Media Pembelajaran
                  <span className="text-xs font-medium text-[#6B7280]">({detail.materi.length})</span>
                </div>
                {canEdit && !showMateri && !editMateri && (
                  <button data-testid="program-materi-add" onClick={() => setShowMateri(true)}
                    className="h-10 px-3.5 rounded-xl bg-[#111114] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-black">
                    <Plus size={16} /> Tambah Materi
                  </button>
                )}
              </div>

              {(showMateri || editMateri) && (
                <div className="mt-3">
                  <MateriForm
                    jenjangId={pick}
                    initial={editMateri}
                    onClose={() => { setShowMateri(false); setEditMateri(null); }}
                    onDone={() => { setShowMateri(false); setEditMateri(null); loadDetail(); loadList(); }}
                  />
                </div>
              )}

              <div className="mt-3 space-y-2">
                {detail.materi.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">Belum ada materi untuk jenjang ini.</p>
                ) : detail.materi.map((m) => (
                  <div key={m.id} data-testid={`program-materi-item-${m.id}`}
                    className="rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {m.pekan && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#111114] text-white">
                              Pekan {m.pekan}
                            </span>
                          )}
                          <span className="font-semibold text-[#111827] text-sm">{m.title}</span>
                        </div>
                        {m.description && (
                          <p className="text-xs text-[#4B5563] mt-1 leading-relaxed whitespace-pre-wrap">{m.description}</p>
                        )}
                        {m.media?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {m.media.map((x, i) => <MediaChip key={i} m={x} />)}
                          </div>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex gap-1 shrink-0">
                          <button data-testid={`program-materi-edit-${m.id}`} onClick={() => { setShowMateri(false); setEditMateri(m); }}
                            className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#E8E8E4] bg-white text-[#4B5563] hover:border-[#111114] hover:text-[#111114]">
                            <Pencil size={15} />
                          </button>
                          <button data-testid={`program-materi-delete-${m.id}`} onClick={() => delMateri(m.id)}
                            className="h-9 w-9 flex items-center justify-center rounded-lg border border-[#FECACA] bg-white text-[#DC2626] hover:bg-[#FEF2F2]">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Jadwal */}
            <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5" data-testid="program-jadwal">
              <div className="font-bold text-[#111827] inline-flex items-center gap-2">
                <CalendarClock size={17} /> Jadwal Pembelajaran
                <span className="text-xs font-medium text-[#6B7280]">({detail.jadwal.length})</span>
              </div>
              <div className="mt-3 space-y-2">
                {detail.jadwal.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">Belum ada jadwal untuk jenjang ini.</p>
                ) : detail.jadwal.map((j) => (
                  <div key={j.id} data-testid={`program-jadwal-item-${j.id}`}
                    className="rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-[#111827]">
                        {j.day} · {j.start_time}–{j.end_time} WITA
                      </div>
                      <div className="text-xs text-[#6B7280] mt-0.5">
                        {[j.teacher && `Pengajar: ${j.teacher}`, j.location && `Tempat: ${j.location}`]
                          .filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    {canEdit && (
                      <button data-testid={`program-jadwal-delete-${j.id}`} onClick={() => delJadwal(j.id)}
                        className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-[#FECACA] bg-white text-[#DC2626] hover:bg-[#FEF2F2]">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="mt-3">
                  <JadwalForm jenjangId={pick} hari={hari} onDone={() => { loadDetail(); loadList(); }} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
