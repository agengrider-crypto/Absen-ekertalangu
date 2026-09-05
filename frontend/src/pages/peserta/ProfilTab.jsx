import { useEffect, useRef, useState } from "react";
import { Loader2, Camera, Save, User as UserIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { resizeImageFile } from "@/lib/image";

function Field({ label, children }) {
  return (
    <div>
      <label className="text-sm font-semibold text-[#374151]">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const inp = "w-full h-11 px-3.5 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] bg-white";

export default function ProfilTab({ user }) {
  const { refresh } = useAuth();
  const fileRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [f, setF] = useState({
    name: user?.name || "", phone: user?.phone || "", whatsapp: user?.whatsapp || "",
    dob: user?.dob || "", birthplace: user?.birthplace || "", address: user?.address || "",
    gender: user?.gender || "", education: user?.education || "",
  });
  const [saving, setSaving] = useState(false);
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
    if (!f.name.trim()) { toast.error("Nama wajib diisi"); return; }
    setSaving(true);
    try {
      await api.patch("/me/profile", f);
      await refresh();
      toast.success("Profil disimpan");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-[#111827]">Profil Saya</h1>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex flex-col items-center">
        <div className="relative">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-[#E8F5EE] flex items-center justify-center border-2 border-[#0D5C3A]/20">
            {photo ? <img src={photo} alt="Foto" className="h-full w-full object-cover" data-testid="profil-photo" /> : <UserIcon size={40} className="text-[#0D5C3A]" />}
          </div>
          <button data-testid="profil-photo-pick" onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-[#0D5C3A] text-white flex items-center justify-center shadow-md"><Camera size={16} /></button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onPickPhoto} />
        </div>
        {photo && <button data-testid="profil-photo-remove" onClick={removePhoto} className="mt-3 text-xs text-[#DC2626] font-semibold inline-flex items-center gap-1"><Trash2 size={12} /> Hapus foto</button>}
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 space-y-4">
        <Field label="Nama Lengkap"><input data-testid="profil-name" value={f.name} onChange={(e) => set("name", e.target.value)} className={inp} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="No. HP"><input data-testid="profil-phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inp} /></Field>
          <Field label="WhatsApp"><input data-testid="profil-whatsapp" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} className={inp} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tempat Lahir"><input data-testid="profil-birthplace" value={f.birthplace} onChange={(e) => set("birthplace", e.target.value)} className={inp} /></Field>
          <Field label="Tanggal Lahir"><input data-testid="profil-dob" type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} className={inp} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jenis Kelamin">
            <select data-testid="profil-gender" value={f.gender} onChange={(e) => set("gender", e.target.value)} className={inp}>
              <option value="">—</option>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </Field>
          <Field label="Pendidikan"><input data-testid="profil-education" value={f.education} onChange={(e) => set("education", e.target.value)} className={inp} /></Field>
        </div>
        <Field label="Alamat"><textarea data-testid="profil-address" value={f.address} onChange={(e) => set("address", e.target.value)} rows={2} className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] resize-none" /></Field>

        <button data-testid="profil-save" onClick={save} disabled={saving} className="w-full h-12 rounded-xl bg-[#0D5C3A] text-white font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60">
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Simpan Profil
        </button>
      </div>
    </div>
  );
}
