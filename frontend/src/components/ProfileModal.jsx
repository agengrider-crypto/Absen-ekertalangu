import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Camera, Trash2, Loader2, User as UserIcon, Save, Pencil,
  Phone, Mail, MapPin, Shield, CalendarDays, GraduationCap, MessageCircle, AlertCircle, HeartHandshake,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { resizeImageFile } from "@/lib/image";
import { useAuth } from "@/context/AuthContext";
import { formatTanggal, MARITAL_OPTIONS, maritalLabel } from "@/pages/admin/adminUtils";

const ROLE_LABEL = { admin: "Admin", pengurus: "Pengurus", peserta: "Peserta" };
const inp = "w-full h-11 px-3.5 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] bg-white";

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#F1F2F0] last:border-0">
      <Icon size={16} className="text-[#9CA3AF] mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-[#9CA3AF]">{label}</div>
        <div className="text-sm font-medium text-[#111827] break-words">{value || "-"}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#374151] mb-1.5">
        {label} {required && <span className="text-[#DC2626]">*</span>}
      </label>
      {children}
    </div>
  );
}

/**
 * Profil pengguna \u2014 tersedia untuk SEMUA peran (admin, pengurus, peserta).
 * Tampil sebagai action modal (bottom-sheet di HP, dialog di desktop) sehingga
 * tidak pernah terpotong ke atas seperti dropdown.
 */
export default function ProfileModal({ photo, onPhotoChange, onClose, startEditing = false }) {
  const { user, refresh } = useAuth();
  const [preview, setPreview] = useState(photo || null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(startEditing);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const [f, setF] = useState({
    name: user?.name || "", phone: user?.phone || "", whatsapp: user?.whatsapp || "",
    dob: user?.dob || "", birthplace: user?.birthplace || "", address: user?.address || "",
    gender: user?.gender || "", education: user?.education || "",
    marital: user?.marital || "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { setPreview(photo || null); }, [photo]);

  useEffect(() => {
    if (!photo && user?.has_photo) {
      api.get("/me/photo").then(({ data }) => setPreview(data.photo || null)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const initials = (user?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const missing = user?.missing_fields || [];

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await resizeImageFile(file, 320);
      await api.post("/me/photo", { photo: dataUrl });
      setPreview(dataUrl);
      onPhotoChange?.(dataUrl);
      await refresh();
      toast.success("Foto profil diperbarui");
    } catch (err) {
      toast.error(err?.response ? formatApiErrorDetail(err.response?.data?.detail) : (err.message || "Gagal mengunggah foto"));
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    setBusy(true);
    try {
      await api.post("/me/photo", { photo: null });
      setPreview(null);
      onPhotoChange?.(null);
      await refresh();
      toast.success("Foto profil dihapus");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    const need = [
      ["name", "Nama Lengkap"], ["gender", "Jenis Kelamin"],
      ["dob", "Tanggal Lahir"], ["phone", "No. HP"], ["address", "Alamat"],
    ].filter(([k]) => !String(f[k] || "").trim()).map(([, l]) => l);
    if (need.length) {
      toast.error(`Mohon lengkapi: ${need.join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      await api.patch("/me/profile", f);
      await refresh();
      toast.success("Alhamdulillah, profil berhasil disimpan.");
      setEditing(false);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative bg-[#FAFBF9] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto shadow-2xl"
        data-testid="profile-modal"
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-white">
          <div className="h-1.5 w-11 rounded-full bg-[#E5E7EB]" />
        </div>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E5E7EB] px-5 py-3.5 flex items-center justify-between z-10">
          <h2 className="font-heading font-bold text-[#111827]">Profil Saya</h2>
          <button data-testid="button-close-profile" onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F2F5F2]"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4">
          {missing.length > 0 && (
            <div className="rounded-2xl border-2 border-[#FDE68A] bg-[#FFFBEB] p-3.5 flex items-start gap-2.5" data-testid="profile-missing-warning">
              <AlertCircle size={18} className="text-[#92400E] shrink-0 mt-0.5" />
              <div className="text-sm text-[#92400E]">
                Data berikut masih kosong: <b>{missing.join(", ")}</b>. Mohon dilengkapi.
              </div>
            </div>
          )}

          {/* Foto */}
          <div className="flex flex-col items-center gap-3">
            <div className="h-28 w-28 rounded-full overflow-hidden bg-[#0D5C3A] text-white flex items-center justify-center text-3xl font-bold border-4 border-white shadow">
              {preview ? (
                <img src={preview} alt="Foto profil" className="h-full w-full object-cover" data-testid="profile-photo" />
              ) : initials}
            </div>
            <div className="flex gap-2">
              <button
                data-testid="button-upload-photo"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm hover:bg-[#094229] disabled:opacity-60"
              >
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />} {preview ? "Ganti Foto" : "Unggah Foto"}
              </button>
              {preview && (
                <button
                  data-testid="button-remove-photo"
                  onClick={removePhoto}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border-2 border-[#DC2626] text-[#DC2626] font-semibold text-sm hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <p className="text-xs text-[#9CA3AF] text-center">Format JPG/PNG, otomatis diperkecil ke 320px.</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={onFile} data-testid="input-photo-file" />
          </div>

          {/* Peran */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            {(user?.roles || []).map((r) => (
              <span key={r} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E8F5EE] text-[#065F46]">{ROLE_LABEL[r] || r}</span>
            ))}
          </div>

          {editing ? (
            <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] space-y-3.5" data-testid="profile-edit-form">
              <Field label="Nama Lengkap" required>
                <input data-testid="profile-edit-name" value={f.name} onChange={(e) => set("name", e.target.value)} className={inp} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Jenis Kelamin" required>
                  <select data-testid="profile-edit-gender" value={f.gender} onChange={(e) => set("gender", e.target.value)} className={inp}>
                    <option value="">— Pilih —</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </Field>
                <Field label="Tanggal Lahir" required>
                  <input data-testid="profile-edit-dob" type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} className={inp} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="No. HP" required>
                  <input data-testid="profile-edit-phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inp} />
                </Field>
                <Field label="WhatsApp">
                  <input data-testid="profile-edit-whatsapp" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} className={inp} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tempat Lahir">
                  <input data-testid="profile-edit-birthplace" value={f.birthplace} onChange={(e) => set("birthplace", e.target.value)} className={inp} />
                </Field>
                <Field label="Pendidikan">
                  <input data-testid="profile-edit-education" value={f.education} onChange={(e) => set("education", e.target.value)} className={inp} />
                </Field>
              </div>
              <Field label="Status Pernikahan">
                <select data-testid="profile-edit-marital" value={f.marital} onChange={(e) => set("marital", e.target.value)} className={inp}>
                  <option value="">— Pilih —</option>
                  {MARITAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Alamat" required>
                <textarea
                  data-testid="profile-edit-address"
                  value={f.address}
                  onChange={(e) => set("address", e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] resize-none bg-white"
                />
              </Field>
              <div className="flex gap-2 pt-1">
                <button
                  data-testid="profile-edit-cancel"
                  onClick={() => setEditing(false)}
                  className="h-12 px-4 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] font-semibold hover:bg-[#F2F5F2]"
                >
                  Batal
                </button>
                <button
                  data-testid="profile-edit-save"
                  onClick={save}
                  disabled={saving}
                  className="flex-1 h-12 rounded-xl bg-[#0D5C3A] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60"
                >
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Simpan Profil
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB]" data-testid="profile-view">
                <div className="text-base font-bold text-[#111827] mb-2">{user?.name}</div>
                <Row icon={UserIcon} label="Username" value={user?.username} />
                <Row icon={UserIcon} label="Jenis Kelamin" value={user?.gender === "L" ? "Laki-laki" : user?.gender === "P" ? "Perempuan" : null} />
                <Row icon={CalendarDays} label="Tanggal Lahir" value={user?.dob ? formatTanggal(user.dob) : null} />
                <Row icon={MapPin} label="Tempat Lahir" value={user?.birthplace} />
                <Row icon={Phone} label="Nomor HP" value={user?.phone} />
                <Row icon={MessageCircle} label="WhatsApp" value={user?.whatsapp} />
                <Row icon={Mail} label="Email" value={user?.email} />
                <Row icon={GraduationCap} label="Pendidikan" value={user?.education} />
                <Row icon={HeartHandshake} label="Status Pernikahan" value={user?.marital ? maritalLabel(user.marital) : null} />
                <Row icon={MapPin} label="Alamat" value={user?.address} />
                <Row icon={Shield} label="Status Akun" value={user?.status === "active" ? "Aktif" : user?.status === "pending" ? "Belum aktivasi" : "Nonaktif"} />
              </div>
              <button
                data-testid="profile-edit-open"
                onClick={() => {
                  setF({
                    name: user?.name || "", phone: user?.phone || "", whatsapp: user?.whatsapp || "",
                    dob: user?.dob || "", birthplace: user?.birthplace || "", address: user?.address || "",
                    gender: user?.gender || "", education: user?.education || "",
                    marital: user?.marital || "",
                  });
                  setEditing(true);
                }}
                className="w-full h-12 rounded-xl bg-[#0D5C3A] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-[#094229]"
              >
                <Pencil size={18} /> Ubah Data Profil
              </button>
            </>
          )}
        </div>
      </div>
    </div>
    ),
    document.body,
  );
}
