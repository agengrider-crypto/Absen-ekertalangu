import { useEffect, useRef, useState } from "react";
import { X, Camera, Trash2, Loader2, User as UserIcon, Phone, Mail, MapPin, Shield } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { resizeImageFile } from "@/lib/image";
import { useAuth } from "@/context/AuthContext";

const ROLE_LABEL = { admin: "Admin", pengurus: "Pengurus", peserta: "Peserta" };

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-[#F1F2F0] last:border-0">
      <Icon size={16} className="text-[#9CA3AF] mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-[#9CA3AF]">{label}</div>
        <div className="text-sm font-medium text-[#111827] break-words">{value || "-"}</div>
      </div>
    </div>
  );
}

export default function ProfileModal({ photo, onPhotoChange, onClose }) {
  const { user, refresh } = useAuth();
  const [preview, setPreview] = useState(photo || null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { setPreview(photo || null); }, [photo]);

  const initials = (user?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

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

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-[#FAFBF9] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="profile-modal"
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E5E7EB] px-5 py-3.5 flex items-center justify-between z-10">
          <h2 className="font-heading font-bold text-[#111827]">Profil Saya</h2>
          <button data-testid="button-close-profile" onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F2F5F2]"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4">
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

          {/* Biodata */}
          <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB]">
            <div className="text-sm font-bold text-[#111827] mb-1">{user?.name}</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {(user?.roles || []).map((r) => (
                <span key={r} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#065F46]">{ROLE_LABEL[r] || r}</span>
              ))}
            </div>
            <Row icon={UserIcon} label="Username" value={user?.username} />
            <Row icon={Phone} label="Nomor HP" value={user?.phone} />
            <Row icon={Mail} label="Email" value={user?.email} />
            <Row icon={MapPin} label="Alamat" value={user?.address} />
            <Row icon={Shield} label="Status" value={user?.status === "active" ? "Aktif" : "Nonaktif"} />
          </div>
        </div>
      </div>
    </div>
  );
}
