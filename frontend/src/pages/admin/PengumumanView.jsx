import { useEffect, useState } from "react";
import {
  Plus, Loader2, Trash2, Pin, PinOff, AlertCircle, X, Pencil, Megaphone, LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

const ROLE_LABEL = { admin: "Admin", pengurus: "Pengurus", peserta: "Peserta" };
const MAX_PINNED = 3;

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember"];

function tglIndo(ymd) {
  const p = String(ymd || "").slice(0, 10).split("-");
  if (p.length !== 3) return ymd || "-";
  return `${parseInt(p[2], 10)} ${BULAN[parseInt(p[1], 10) - 1]} ${p[0]}`;
}

/** Template pengumuman siap pakai berdasarkan kegiatan yang dipilih. */
const TEMPLATES = [
  {
    key: "undangan",
    label: "Undangan Kegiatan",
    build: (k) => ({
      title: k ? `Undangan ${k.base_name || k.name}` : "Undangan Pengajian",
      body: [
        "Assalamu'alaikum warahmatullahi wabarakatuh",
        "",
        "Bismillah, dengan ini kami mengundang peserta untuk menghadiri:",
        `📌 Kegiatan : ${k ? (k.base_name || k.name) : "-"}`,
        `🗓️ Tanggal  : ${k ? tglIndo(k.date) : "-"}`,
        `⏰ Waktu    : ${k ? `${k.start_time}–${k.end_time} WITA` : "-"}${k?.session_label ? ` (sesi ${k.session_label})` : ""}`,
        `📍 Tempat   : ${k?.location || "-"}`,
        `👤 Pengajar : ${k?.teacher || "-"}`,
        k?.material ? `📖 Materi   : ${k.material}` : "",
        "",
        "Mohon hadir tepat waktu. Jazakumullahu khoiro.",
      ].filter((x) => x !== "").join("\n"),
    }),
  },
  {
    key: "pengingat",
    label: "Pengingat Hari-H",
    build: (k) => ({
      title: k ? `Pengingat: ${k.base_name || k.name} hari ini` : "Pengingat Pengajian",
      body: [
        "Assalamu'alaikum warahmatullahi wabarakatuh",
        "",
        `Mengingatkan kembali kegiatan ${k ? (k.base_name || k.name) : "pengajian"} ${k ? `pada ${tglIndo(k.date)}` : ""}`,
        `pukul ${k ? `${k.start_time}–${k.end_time} WITA` : "-"}${k?.location ? ` di ${k.location}` : ""}.`,
        "",
        "Jangan lupa membawa HP untuk absen QR. Jazakumullahu khoiro.",
      ].join("\n"),
    }),
  },
  {
    key: "perubahan",
    label: "Perubahan Jadwal",
    build: (k) => ({
      title: k ? `Perubahan jadwal ${k.base_name || k.name}` : "Perubahan Jadwal Pengajian",
      body: [
        "Assalamu'alaikum warahmatullahi wabarakatuh",
        "",
        `Mohon perhatian, ada perubahan pada kegiatan ${k ? (k.base_name || k.name) : "pengajian"}:`,
        `• Jadwal semula : ${k ? `${tglIndo(k.date)}, ${k.start_time}–${k.end_time} WITA` : "-"}`,
        "• Jadwal baru   : (tulis di sini)",
        "• Alasan        : (tulis di sini)",
        "",
        "Mohon dimaklumi. Jazakumullahu khoiro.",
      ].join("\n"),
    }),
  },
];

function Field({ label, children }) {
  return (
    <div>
      <label className="text-sm font-semibold text-[#374151]">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function FormModal({ initial, kegiatanOptions, pinnedCount, onClose, onDone }) {
  const editing = !!initial;
  const [f, setF] = useState({
    title: initial?.title || "",
    body: initial?.body || "",
    kegiatan_id: initial?.kegiatan_id || "",
    pengajar: initial?.pengajar || "",
    important: initial?.important || false,
    pinned: initial?.pinned || false,
    pin_roles: initial?.pin_roles || ["peserta"],
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleRole = (r) => set("pin_roles", f.pin_roles.includes(r) ? f.pin_roles.filter((x) => x !== r) : [...f.pin_roles, r]);

  const pinLimitReached = !editing && !initial?.pinned && pinnedCount >= MAX_PINNED;

  const submit = async () => {
    if (!f.title.trim()) { toast.error("Judul wajib diisi"); return; }
    setSaving(true);
    const payload = {
      title: f.title.trim(), body: f.body, kegiatan_id: f.kegiatan_id || null,
      pengajar: f.pengajar || null, important: f.important, pinned: f.pinned,
      pin_roles: f.pinned ? f.pin_roles : [],
    };
    try {
      if (editing) await api.patch(`/staff/pengumuman/${initial.id}`, payload);
      else await api.post("/staff/pengumuman", payload);
      toast.success(editing ? "Pengumuman diperbarui" : "Pengumuman dibuat");
      onDone();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto" data-testid="modal-pengumuman-form">
        <div className="sticky top-0 bg-white border-b border-[#E8E8E4] px-5 py-4 flex items-center justify-between">
          <h3 className="font-heading font-bold text-[#111827] text-lg">{editing ? "Edit Pengumuman" : "Pengumuman Baru"}</h3>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Kegiatan terkait (untuk mengisi template)">
            <select data-testid="peng-kegiatan" value={f.kegiatan_id} onChange={(e) => set("kegiatan_id", e.target.value)} className="w-full h-11 px-3 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114] bg-white">
              <option value="">— Tidak terkait kegiatan —</option>
              {kegiatanOptions.map((k) => (
                <option key={k.id} value={k.id}>
                  {tglIndo(k.date)} · {k.base_name || k.name}{k.session_label ? ` (${k.session_label})` : ""}
                </option>
              ))}
            </select>
          </Field>

          <div className="rounded-2xl border border-[#E8E8E4] bg-[#FAFAF8] p-3">
            <div className="text-sm font-semibold text-[#111114] inline-flex items-center gap-1.5"><LayoutTemplate size={15} /> Template siap pakai</div>
            <p className="text-xs text-[#4B5563] mt-0.5">Tap salah satu, judul &amp; isi langsung terisi rapi (masih bisa diedit).</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  data-testid={`peng-template-${t.key}`}
                  onClick={() => {
                    const keg = kegiatanOptions.find((k) => k.id === f.kegiatan_id) || null;
                    const res = t.build(keg);
                    setF((p) => ({ ...p, title: res.title, body: res.body, pengajar: keg?.teacher || p.pengajar }));
                    toast.success(`Template "${t.label}" diterapkan`);
                  }}
                  className="h-9 px-3 rounded-lg border-2 border-[#111114] bg-white text-[#111114] text-xs font-semibold hover:bg-[#F1F1EE]"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Judul">
            <input data-testid="peng-title" value={f.title} onChange={(e) => set("title", e.target.value)} className="w-full h-11 px-3.5 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114]" />
          </Field>
          <Field label="Isi Pengumuman">
            <textarea data-testid="peng-body" value={f.body} onChange={(e) => set("body", e.target.value)} rows={9} className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114] resize-none leading-relaxed" />
          </Field>
          <Field label="Pengajar">
            <input data-testid="peng-pengajar" value={f.pengajar} onChange={(e) => set("pengajar", e.target.value)} className="w-full h-11 px-3.5 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114]" />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer">
            <input data-testid="peng-important" type="checkbox" checked={f.important} onChange={(e) => set("important", e.target.checked)} className="h-4 w-4 accent-[#DC2626]" />
            <span className="text-sm text-[#374151]">Tandai <b>Penting</b></span>
          </label>

          <div className="border border-[#E8E8E4] rounded-xl p-3 space-y-2.5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input data-testid="peng-pinned" type="checkbox" checked={f.pinned} disabled={pinLimitReached} onChange={(e) => set("pinned", e.target.checked)} className="h-4 w-4 accent-[#111114]" />
              <span className="text-sm text-[#374151]">Pin ke dashboard role</span>
            </label>
            {pinLimitReached && <p className="text-xs text-[#DC2626]">Sudah ada {MAX_PINNED} pengumuman ter-pin (maksimal {MAX_PINNED}).</p>}
            {f.pinned && (
              <div className="flex gap-2 flex-wrap pl-7">
                {["admin", "pengurus", "peserta"].map((r) => (
                  <button
                    key={r}
                    data-testid={`peng-role-${r}`}
                    type="button"
                    onClick={() => toggleRole(r)}
                    className={`px-3 h-8 rounded-lg text-xs font-semibold border ${f.pin_roles.includes(r) ? "bg-[#111114] text-white border-[#111114]" : "bg-white text-[#4B5563] border-[#E8E8E4]"}`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button data-testid="peng-submit" onClick={submit} disabled={saving} className="w-full h-12 rounded-xl bg-[#111114] text-white font-semibold hover:bg-[#000000] disabled:opacity-60 inline-flex items-center justify-center gap-2">
            {saving && <Loader2 className="animate-spin" size={18} />} {editing ? "Simpan Perubahan" : "Terbitkan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PengumumanView() {
  const [items, setItems] = useState(null);
  const [kegiatanOptions, setKegiatanOptions] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/staff/pengumuman");
      setItems(data);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  useEffect(() => {
    load();
    const month = new Date().toISOString().slice(0, 7);
    api.get(`/admin/kegiatan?month=${month}`).then(({ data }) => setKegiatanOptions(data || [])).catch(() => {});
  }, []);

  const del = async (id) => {
    if (!window.confirm("Hapus pengumuman ini?")) return;
    try { await api.delete(`/staff/pengumuman/${id}`); toast.success("Pengumuman dihapus"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const togglePin = async (p) => {
    try {
      await api.patch(`/staff/pengumuman/${p.id}`, { pinned: !p.pinned, pin_roles: p.pinned ? [] : (p.pin_roles?.length ? p.pin_roles : ["peserta"]) });
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const pinnedCount = (items || []).filter((p) => p.pinned).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#111827]">Pengumuman</h1>
          <p className="text-[#6B7280] text-sm">Yang di-pin tampil paling atas & di dashboard role terpilih (maks {MAX_PINNED}).</p>
        </div>
        <button data-testid="button-add-pengumuman" onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[#111114] text-white font-semibold text-sm hover:bg-[#000000]"><Plus size={18} /> Pengumuman</button>
      </div>

      {items === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={30} /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-10 text-center text-[#6B7280]"><Megaphone className="mx-auto mb-2 text-[#9CA3AF]" size={32} />Belum ada pengumuman.</div>
      ) : (
        <div className="grid gap-3">
          {items.map((p) => (
            <div key={p.id} className={`bg-white rounded-2xl border p-4 ${p.pinned ? "border-[#111114]" : "border-[#E8E8E4]"}`} data-testid={`pengumuman-card-${p.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.pinned && <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F1F1EE] text-[#111114]"><Pin size={11} /> Ter-pin</span>}
                    {p.important && <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B]"><AlertCircle size={11} /> Penting</span>}
                    {p.pinned && p.pin_roles?.map((r) => <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#4B5563]">{ROLE_LABEL[r]}</span>)}
                  </div>
                  <h3 className="font-heading font-bold text-[#111827] mt-1.5">{p.title}</h3>
                  {p.body && <p className="text-sm text-[#4B5563] mt-1 whitespace-pre-wrap">{p.body}</p>}
                  <div className="text-xs text-[#9CA3AF] mt-2 flex flex-wrap gap-x-3">
                    {p.kegiatan_name && <span>Kegiatan: {p.kegiatan_name}</span>}
                    {p.pengajar && <span>Pengajar: {p.pengajar}</span>}
                    <span>oleh {p.created_by}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button data-testid={`peng-pin-${p.id}`} onClick={() => togglePin(p)} title={p.pinned ? "Lepas pin" : "Pin"} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#111114] hover:bg-[#F1F1EE]">{p.pinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
                  <button data-testid={`peng-edit-${p.id}`} onClick={() => setEditItem(p)} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#4B5563] hover:bg-[#F3F4F6]"><Pencil size={16} /></button>
                  <button data-testid={`peng-delete-${p.id}`} onClick={() => del(p.id)} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#DC2626] hover:bg-red-50"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <FormModal kegiatanOptions={kegiatanOptions} pinnedCount={pinnedCount} onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); load(); }} />}
      {editItem && <FormModal initial={editItem} kegiatanOptions={kegiatanOptions} pinnedCount={pinnedCount} onClose={() => setEditItem(null)} onDone={() => { setEditItem(null); load(); }} />}
    </div>
  );
}
