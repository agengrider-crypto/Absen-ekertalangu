// Tutorial video: halaman mulai KOSONG, admin menambah sendiri.
// Data disimpan di koleksi `tutorial_video` (lihat backend/server.py).
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Play, Clock, X, Plus, Pencil, Trash2, Loader2, Video, ShieldCheck, Users, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import Modal from "@/components/Modal";

const ROLE_LABEL = { admin: "Administrator", pengurus: "Pengurus", peserta: "Peserta" };
const ROLE_ICON = { admin: ShieldCheck, pengurus: Users, peserta: UserCheck };
const ROLE_OPTIONS = ["admin", "pengurus", "peserta"];

/** Ambil ID video YouTube dari berbagai bentuk URL. */
function youtubeId(url) {
  const m = String(url || "").match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : "";
}

const fld = "w-full h-12 px-3.5 rounded-xl border border-[#8A948D] text-[15px] outline-none focus:border-[#14633F] bg-white";
const lbl = "block text-[13px] font-semibold text-[#14201A] mb-1.5";

function VideoForm({ initial, onClose, onSaved }) {
  const editing = Boolean(initial?.id);
  const [judul, setJudul] = useState(initial?.judul || "");
  const [peran, setPeran] = useState(initial?.peran || "admin");
  const [durasi, setDurasi] = useState(initial?.durasi || "");
  const [url, setUrl] = useState(initial?.url || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!judul.trim()) { toast.error("Judul tutorial wajib diisi."); return; }
    if (!youtubeId(url)) { toast.error("Tautan harus berupa tautan YouTube."); return; }
    setSaving(true);
    try {
      const body = { judul: judul.trim(), peran, durasi: durasi.trim(), url: url.trim() };
      if (editing) await api.patch(`/admin/tutorial-video/${initial.id}`, body);
      else await api.post("/admin/tutorial-video", body);
      toast.success(editing ? "Tutorial diperbarui." : "Tutorial ditambahkan.");
      onSaved();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return (
    <Modal
      onClose={onClose}
      title={editing ? "Ubah tutorial" : "Tambah tutorial"}
      subtitle="Video panduan singkat untuk satu peran."
      testid="modal-tutorial-video"
      maxWidth={520}
      footer={(
        <div className="grid grid-cols-2 gap-2">
          <button type="button" data-testid="tutorial-cancel" onClick={onClose}
            className="h-12 rounded-xl border-2 border-[#E7E3D8] font-semibold text-[#5F6B63] hover:border-[#14633F]">
            Batal
          </button>
          <button type="button" data-testid="tutorial-save" onClick={submit} disabled={saving}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0B6B52] font-semibold text-white hover:brightness-110 disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : null} Simpan
          </button>
        </div>
      )}
    >
      <div className="space-y-3.5">
        <div>
          <label className={lbl} htmlFor="tutorial-judul">Judul</label>
          <input id="tutorial-judul" data-testid="tutorial-judul" value={judul}
            onChange={(e) => setJudul(e.target.value)} className={fld} autoFocus
            placeholder="mis. Membuat kegiatan baru" />
        </div>
        <div>
          <label className={lbl} htmlFor="tutorial-peran">Untuk peran</label>
          <select id="tutorial-peran" data-testid="tutorial-peran" value={peran}
            onChange={(e) => setPeran(e.target.value)} className={fld}>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl} htmlFor="tutorial-durasi">Durasi (opsional)</label>
          <input id="tutorial-durasi" data-testid="tutorial-durasi" value={durasi}
            onChange={(e) => setDurasi(e.target.value)} className={fld} placeholder="mis. 3:20" />
        </div>
        <div>
          <label className={lbl} htmlFor="tutorial-url">Tautan YouTube “Tidak publik”</label>
          <input id="tutorial-url" data-testid="tutorial-url" value={url}
            onChange={(e) => setUrl(e.target.value)} className={fld}
            placeholder="https://youtu.be/…" />
        </div>
      </div>
    </Modal>
  );
}

export default function TutorialVideoView({ role = "admin" }) {
  const isAdmin = role === "admin";
  const [items, setItems] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [pick, setPick] = useState(isAdmin ? "semua" : role);
  const [playing, setPlaying] = useState(null);
  const [form, setForm] = useState(null); // null | {} | item
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setItems(null);
    api.get("/tutorial-video")
      .then(({ data }) => { setItems(data.items || []); setCanManage(Boolean(data.can_manage)); })
      .catch((e) => { setItems([]); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const videos = useMemo(() => {
    const list = items || [];
    if (isAdmin && pick === "semua") return list;
    return list.filter((v) => v.peran === (isAdmin ? pick : role));
  }, [items, isAdmin, pick, role]);

  const remove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/tutorial-video/${confirmDelete.id}`);
      toast.success("Tutorial dihapus.");
      setConfirmDelete(null);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setDeleting(false); }
  };

  return (
    <div className="space-y-4" data-testid="tutorial-video-view">
      <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5 sm:p-6">
        <div className="font-heading text-xl font-bold text-[#14201A] sm:text-2xl">Tutorial video</div>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#5F6B63]">
          Tonton langkah singkat memakai aplikasi. Pilih peran untuk melihat video yang sesuai.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(isAdmin
            ? [["semua", "Semua peran"], ...ROLE_OPTIONS.map((r) => [r, ROLE_LABEL[r]])]
            : [[role, ROLE_LABEL[role] || role]]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              data-testid={`tutorial-filter-${key}`}
              onClick={() => setPick(key)}
              aria-pressed={pick === key}
              className={`h-10 rounded-xl border-2 px-3.5 text-sm font-semibold transition-colors ${
                pick === key ? "border-transparent bg-[#14633F] text-white" : "border-[#E7E3D8] bg-white text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {items === null ? (
        <div className="flex justify-center rounded-2xl border border-[#E7E3D8] bg-white p-12">
          <Loader2 className="animate-spin text-[#0E4E31]" size={26} />
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-10 text-center" data-testid="tutorial-empty">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E3F3EA] text-[#0E4E31]">
            <Video size={24} />
          </span>
          <div className="mt-3 font-heading text-base font-bold text-[#14201A]">Belum ada tutorial</div>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-[#5F6B63]">
            Video panduan akan muncul di sini setelah ditambahkan. Mulai dengan satu video singkat per peran.
          </p>
          {canManage && (
            <button
              type="button"
              data-testid="tutorial-add"
              onClick={() => setForm({})}
              className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#0B6B52] px-4 text-sm font-semibold text-white hover:brightness-110"
            >
              <Plus size={16} /> Tambah tutorial
            </button>
          )}
        </div>
      ) : (
        <>
          {canManage && (
            <div className="flex justify-end">
              <button
                type="button"
                data-testid="tutorial-add"
                onClick={() => setForm({})}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-[#0B6B52] px-4 text-sm font-semibold text-white hover:brightness-110"
              >
                <Plus size={16} /> Tambah tutorial
              </button>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => {
              const Icon = ROLE_ICON[v.peran] || Users;
              const vid = youtubeId(v.url);
              return (
                <div key={v.id} className="overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white" data-testid={`tutorial-card-${v.id}`}>
                  <button
                    type="button"
                    onClick={() => setPlaying(v)}
                    className="group block w-full text-left"
                  >
                    <span className="relative block aspect-video bg-[#14201A]">
                      {vid ? (
                        <img src={`https://i.ytimg.com/vi/${vid}/hqdefault.jpg`} alt="" loading="lazy"
                          className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
                      ) : null}
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-[#0B6B52] shadow-lg">
                          <Play size={20} />
                        </span>
                      </span>
                    </span>
                    <span className="block p-3.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#5F6B63]">
                        <Icon size={12} /> {ROLE_LABEL[v.peran] || v.peran}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-[#14201A]">{v.judul}</span>
                      {v.durasi && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-[#5F6B63]">
                          <Clock size={12} /> {v.durasi}
                        </span>
                      )}
                    </span>
                  </button>
                  {canManage && (
                    <div className="flex gap-1.5 border-t border-[#F0EEE6] px-3 py-2">
                      <button type="button" data-testid={`tutorial-edit-${v.id}`} onClick={() => setForm(v)}
                        className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#0E4E31] hover:bg-[#F6F4EE]">
                        <Pencil size={13} /> Ubah
                      </button>
                      <button type="button" data-testid={`tutorial-delete-${v.id}`} onClick={() => setConfirmDelete(v)}
                        className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[#A32A2A] hover:bg-[#FBE5E3]">
                        <Trash2 size={13} /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {form && (
        <VideoForm
          initial={form.id ? form : null}
          onClose={() => setForm(null)}
          onSaved={() => { setForm(null); load(); }}
        />
      )}

      {confirmDelete && (
        <Modal
          onClose={() => setConfirmDelete(null)}
          title="Hapus tutorial?"
          testid="tutorial-delete-confirm"
          maxWidth={480}
          footer={(
            <div className="grid grid-cols-2 gap-2">
              <button type="button" data-testid="tutorial-delete-cancel" onClick={() => setConfirmDelete(null)}
                className="h-12 rounded-xl border-2 border-[#E7E3D8] font-semibold text-[#5F6B63] hover:border-[#14633F]">
                Batal
              </button>
              <button type="button" data-testid="tutorial-delete-yes" onClick={remove} disabled={deleting}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#A32A2A] font-semibold text-white hover:brightness-95 disabled:opacity-50">
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Ya, hapus
              </button>
            </div>
          )}
        >
          <p className="text-sm leading-relaxed text-[#5F6B63]">
            Tutorial “{confirmDelete.judul}” akan dihapus dan tidak bisa dikembalikan.
          </p>
        </Modal>
      )}

      {playing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(17,17,17,0.7)] p-4" data-testid="tutorial-player">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-black shadow-2xl">
            <div className="flex items-center justify-between gap-2 bg-[#14201A] px-3 py-2">
              <span className="min-w-0 truncate text-sm font-semibold text-white">{playing.judul}</span>
              <button type="button" data-testid="tutorial-player-close" onClick={() => setPlaying(null)}
                aria-label="Tutup video"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/15">
                <X size={18} />
              </button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                title={playing.judul}
                src={`https://www.youtube-nocookie.com/embed/${youtubeId(playing.url)}?autoplay=1&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
