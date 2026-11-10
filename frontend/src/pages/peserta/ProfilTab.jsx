import { useEffect, useRef, useState } from "react";
import { Loader2, Camera, Save, User as UserIcon, Trash2, AlertCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { resizeImageFile } from "@/lib/image";
import ContactButtons from "@/components/ContactButtons";
import AboutApp from "@/components/AboutApp";
import { MARITAL_OPTIONS } from "@/pages/admin/adminUtils";

function Field({ label, required, children }) {
  return (
    <div>
      <label className="text-sm font-semibold text-[#14201A]">
        {label} {required && <span className="text-[#A32A2A]">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const inp = "w-full h-11 px-3.5 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] bg-white";

export default function ProfilTab({ user }) {
  const { refresh } = useAuth();
  const fileRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [f, setF] = useState({
    name: user?.name || "", phone: user?.phone || "", whatsapp: user?.whatsapp || "",
    dob: user?.dob || "", birthplace: user?.birthplace || "", address: user?.address || "",
    gender: user?.gender || "", education: user?.education || "",
    marital: user?.marital || "",
  });
  const [saving, setSaving] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    api.get("/me/photo").then(({ data }) => setPhoto(data.photo || null)).catch(() => {});
  }, []);

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 320);
      await api.post("/me/photo", { photo: dataUrl });
      setPhoto(dataUrl);
      toast.success("Foto diperbarui");
    } catch (err) { toast.error(err.message || "Gagal mengunggah foto"); }
    e.target.value = "";
  };

  const removePhoto = async () => {
    try { await api.post("/me/photo", { photo: null }); setPhoto(null); toast.success("Foto dihapus"); }
    catch (e) { toast.error("Gagal menghapus foto"); }
  };

  const save = async () => {
    const need = [
      ["name", "Nama Lengkap"], ["gender", "Jenis Kelamin"],
      ["dob", "Tanggal Lahir"], ["phone", "No. HP"], ["address", "Alamat"],
    ].filter(([k]) => !String(f[k] || "").trim()).map(([, l]) => l);
    if (need.length) { toast.error(`Mohon lengkapi: ${need.join(", ")}`); return; }
    setSaving(true);
    try {
      await api.patch("/me/profile", f);
      await refresh();
      toast.success("Alhamdulillah, profil berhasil disimpan.");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setSaving(false);
  };

  const missing = user?.missing_fields || [];

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-[#14201A]">Profil Saya</h1>

      {missing.length > 0 && (
        <div className="rounded-2xl border-2 border-[#EAD596] bg-[#FBF1D6] p-4 flex items-start gap-3" data-testid="profil-missing-warning">
          <AlertCircle size={19} className="text-[#6B4500] shrink-0 mt-0.5" />
          <div className="text-sm text-[#6B4500]">
            Data berikut masih kosong: <b>{missing.join(", ")}</b>. Mohon dilengkapi agar kehadiran Anda dapat diverifikasi.
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5 flex flex-col items-center">
        <div className="relative">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-[#E3F3EA] flex items-center justify-center border-2 border-[#14633F]/20">
            {photo ? <img src={photo} alt="Foto" className="h-full w-full object-cover" data-testid="profil-photo" /> : <UserIcon size={40} className="text-[#0E4E31]" />}
          </div>
          <button data-testid="profil-photo-pick" onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-[#14633F] text-white flex items-center justify-center shadow-md"><Camera size={16} /></button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onPickPhoto} />
        </div>
        {photo && <button data-testid="profil-photo-remove" onClick={removePhoto} className="mt-3 text-xs text-[#A32A2A] font-semibold inline-flex items-center gap-1"><Trash2 size={12} /> Hapus foto</button>}
      </div>

      {/* Fase 7 — Tombol Telepon & WhatsApp untuk nomor pada profil ini */}
      <ContactButtons
        phone={f.phone}
        whatsapp={f.whatsapp}
        name={f.name}
        testidPrefix="profil-kontak"
        label="Kontak Saya"
      />

      <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5 space-y-4">
        <Field label="Nama Lengkap" required><input data-testid="profil-name" value={f.name} onChange={(e) => set("name", e.target.value)} className={inp} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="No. HP" required><input data-testid="profil-phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inp} /></Field>
          <Field label="WhatsApp"><input data-testid="profil-whatsapp" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} className={inp} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tempat Lahir"><input data-testid="profil-birthplace" value={f.birthplace} onChange={(e) => set("birthplace", e.target.value)} className={inp} /></Field>
          <Field label="Tanggal Lahir" required><input data-testid="profil-dob" type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} className={inp} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jenis Kelamin" required>
            <select data-testid="profil-gender" value={f.gender} onChange={(e) => set("gender", e.target.value)} className={inp}>
              <option value="">—</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </Field>
          <Field label="Pendidikan"><input data-testid="profil-education" value={f.education} onChange={(e) => set("education", e.target.value)} className={inp} /></Field>
        </div>
        <Field label="Status Pernikahan">
          <select data-testid="profil-marital" value={f.marital} onChange={(e) => set("marital", e.target.value)} className={inp}>
            <option value="">—</option>
            {MARITAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Alamat" required><textarea data-testid="profil-address" value={f.address} onChange={(e) => set("address", e.target.value)} rows={2} className="w-full px-3.5 py-2.5 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] resize-none" /></Field>

        <button data-testid="profil-save" onClick={save} disabled={saving} className="w-full h-12 rounded-xl bg-[#14633F] text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#0E4E31] disabled:opacity-60">
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Simpan Profil
        </button>
      </div>

      <button
        type="button"
        data-testid="profil-about-open"
        onClick={() => setShowAbout(true)}
        className="w-full rounded-2xl border-2 border-[#E7E3D8] bg-white p-4 text-left hover:border-[#14633F]"
      >
        <span className="flex items-center gap-2 font-bold text-[#14201A]"><Info size={16} /> Tentang Aplikasi</span>
        <span className="mt-1 block text-sm text-[#5F6B63]">Versi, pengembang, update terbaru, dan tour panduan.</span>
      </button>

      {showAbout && <AboutApp onClose={() => setShowAbout(false)} />}
    </div>
  );
}
