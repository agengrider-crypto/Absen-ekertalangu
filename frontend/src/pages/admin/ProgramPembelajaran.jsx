// Program Pembelajaran = JADWAL KELAS saja. Kurikulum, target, dan penilaian
// ada di EPPG (lihat EPPG_URL di src/lib/api.js).
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen, GraduationCap, Loader2, Plus, Trash2, CalendarClock, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { api, EPPG_URL, formatApiErrorDetail } from "@/lib/api";

const fld = "w-full h-11 px-3.5 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] bg-white";

function JadwalForm({ jenjangId, hari, onDone, pengajar = [] }) {
  const [f, setF] = useState({ day: "Ahad", start_time: "08:00", end_time: "10:00", teacher: "", guru_id: "", location: "", note: "" });
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
      className="rounded-xl border-2 border-[#E7E3D8] bg-[#F6F4EE] p-3.5 grid sm:grid-cols-6 gap-2 items-end">
      <div className="sm:col-span-2">
        <label className="block text-[11px] font-semibold text-[#5F6B63] mb-1">Hari</label>
        <select data-testid="program-jadwal-day" value={f.day} onChange={(e) => set("day", e.target.value)} className={fld}>
          {hari.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#5F6B63] mb-1">Mulai</label>
        <input data-testid="program-jadwal-start" type="time" value={f.start_time}
          onChange={(e) => set("start_time", e.target.value)} className={fld} />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#5F6B63] mb-1">Selesai</label>
        <input data-testid="program-jadwal-end" type="time" value={f.end_time}
          onChange={(e) => set("end_time", e.target.value)} className={fld} />
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#5F6B63] mb-1">Pengajar</label>
        <select data-testid="program-jadwal-teacher" value={f.guru_id}
          onChange={(e) => set("guru_id", e.target.value)} className={fld}>
          <option value="">Pilih pengajar</option>
          {pengajar.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-[#5F6B63] mb-1">Tempat</label>
        <input data-testid="program-jadwal-location" value={f.location}
          onChange={(e) => set("location", e.target.value)} placeholder="Ruang / masjid" className={fld} />
      </div>
      <button type="submit" disabled={busy} data-testid="program-jadwal-submit"
        className="sm:col-span-6 h-11 rounded-xl bg-[#14633F] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-[#0E4E31] disabled:opacity-60">
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
  const [pengajar, setPengajar] = useState([]);

  const loadList = useCallback(() => {
    api.get("/program/jenjang").then(({ data }) => { setList(data.items || []); setHari(data.hari || []); })
      .catch((e) => { setList([]); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, []);

  useEffect(() => {
    api.get("/guru/scope").then(({ data }) => setPengajar(data.pengajar || [])).catch(() => {});
  }, []);

  const loadDetail = useCallback(() => {
    setDetail(null);
    api.get(`/program/${pick}`).then(({ data }) => setDetail(data))
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
  }, [pick]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadDetail(); }, [loadDetail]);

  const groups = useMemo(() => {
    const g = {};
    (list || []).forEach((j) => { (g[j.group] = g[j.group] || []).push(j); });
    return g;
  }, [list]);

  const canEdit = detail?.can_edit;

  const delJadwal = async (id) => {
    if (!window.confirm("Hapus jadwal ini?")) return;
    try { await api.delete(`/program/jadwal/${id}`); toast.success("Jadwal dihapus."); loadDetail(); loadList(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  if (list === null) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={30} /></div>;
  }

  return (
    <div data-testid="program-pembelajaran">
      <div className="mb-4">
        <div className="flex items-center gap-2 text-[#0E4E31] font-bold text-lg">
          <BookOpen size={20} /> Program Pembelajaran
        </div>
        <p className="text-sm text-[#5F6B63] mt-0.5">
          Jadwal kelas per jenjang. Kurikulum, target, dan penilaian ada di EPPG.
          {canEdit === false && " Anda dapat melihat, perubahan dilakukan Administrator atau Guru."}
        </p>
        {EPPG_URL && (
          <a
            href={EPPG_URL}
            target="_blank"
            rel="noreferrer"
            data-testid="program-eppg-link"
            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E7E3D8] bg-white px-3 text-xs font-semibold text-[#0E4E31] hover:border-[#14633F]"
          >
            <ExternalLink size={13} /> Buka kurikulum di EPPG
          </a>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr] items-start">
        {/* Daftar jenjang */}
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-3 space-y-3" data-testid="program-jenjang-list">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-[#5F6B63] px-1.5 mb-1.5">{group}</div>
              <div className="space-y-1">
                {items.map((j) => {
                  const on = pick === j.id;
                  return (
                    <button key={j.id} data-testid={`program-jenjang-${j.id}`} onClick={() => setPick(j.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors ${
                        on ? "bg-[#14633F] text-white" : "text-[#5F6B63] hover:bg-[#F0EEE6] hover:text-[#0E4E31]"
                      }`}>
                      <span className="block text-sm font-semibold">{j.label}</span>
                      <span className={`block text-[11px] ${on ? "text-white/70" : "text-[#5F6B63]"}`}>
                        {j.jadwal_count} jadwal
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
          <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>
        ) : (
          <div className="space-y-4" data-testid="program-detail">
            <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5">
              <div className="flex items-center gap-2.5">
                <span className="h-10 w-10 rounded-xl bg-[#E3F3EA] text-[#0E4E31] flex items-center justify-center">
                  <GraduationCap size={19} />
                </span>
                <div>
                  <div className="font-heading font-bold text-xl text-[#14201A]">{detail.jenjang.label}</div>
                  <div className="text-xs text-[#5F6B63]">{detail.jenjang.group} · {detail.jenjang.age}</div>
                </div>
              </div>
            </div>

            {/* Jadwal */}
            <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5" data-testid="program-jadwal">
              <div className="font-bold text-[#14201A] inline-flex items-center gap-2">
                <CalendarClock size={17} /> Jadwal Pembelajaran
                <span className="text-xs font-medium text-[#5F6B63]">({detail.jadwal.length})</span>
              </div>
              <div className="mt-3 space-y-2">
                {detail.jadwal.length === 0 ? (
                  <p className="text-sm text-[#5F6B63]">Belum ada jadwal untuk jenjang ini.</p>
                ) : detail.jadwal.map((j) => (
                  <div key={j.id} data-testid={`program-jadwal-item-${j.id}`}
                    className="rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-[#14201A]">
                        {j.day} · {j.start_time}–{j.end_time} WITA
                      </div>
                      <div className="text-xs text-[#5F6B63] mt-0.5">
                        {[j.teacher && `Pengajar: ${j.teacher}`, j.location && `Tempat: ${j.location}`]
                          .filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    {canEdit && (
                      <button data-testid={`program-jadwal-delete-${j.id}`} onClick={() => delJadwal(j.id)}
                        className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-[#FBE5E3] bg-white text-[#A32A2A] hover:bg-[#FBE5E3]">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <div className="mt-3">
                  <JadwalForm jenjangId={pick} hari={hari} pengajar={pengajar} onDone={() => { loadDetail(); loadList(); }} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
