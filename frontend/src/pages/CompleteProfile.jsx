import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, Save, ShieldCheck, Camera, Trash2, User as UserIcon,
  LogOut, CheckCircle2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { resizeImageFile } from "@/lib/image";
import { Logo } from "@/components/Logo";

const inp = "w-full h-12 px-3.5 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A] bg-white";

function Field({ label, required, filled, children, hint }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-semibold text-[#374151] mb-1.5">
        {label}
        {required && <span className="text-[#DC2626]">*</span>}
        {required && filled && <CheckCircle2 size={14} className="text-[#059669]" />}
      </label>
      {children}
      {hint && <p className="text-xs text-[#9CA3AF] mt-1">{hint}</p>}
    </div>
  );
}

/**
 * Gerbang verifikasi akun — tampil SETELAH login selama data wajib belum lengkap.
 * Field wajib: Nama, Jenis Kelamin, Tanggal Lahir, No. HP, Alamat.
 * Pengguna tidak bisa memakai aplikasi sebelum data ini dilengkapi.
 */
export default function CompleteProfile() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    name: user?.name || "",
    gender: user?.gender || "",
    dob: user?.dob || "",
    phone: user?.phone || "",
    whatsapp: user?.whatsapp || "",
    birthplace: user?.birthplace || "",
    address: user?.address || "",
    education: user?.education || "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    toast.warning("Mohon lengkapi data akun Anda terlebih dahulu", {
      description: "Data ini dipakai untuk verifikasi kehadiran pengajian.",
      duration: 6000,
    });
  }, []);

  useEffect(() => {
    api.get("/me/photo").then(({ data }) => setPhoto(data.photo || null)).catch(() => {});
  }, []);

  const missing = user?.missing_fields || [];

  const onPickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file, 320);
      await api.post("/me/photo", { photo: dataUrl });
      setPhoto(dataUrl);
      await refresh();
      toast.success("Foto profil tersimpan");
    } catch (err) {
      toast.error(err.message || "Gagal mengunggah foto");
    }
  };

  const removePhoto = async () => {
    try {
      await api.post("/me/photo", { photo: null });
      setPhoto(null);
      await refresh();
      toast.success("Foto dihapus");
    } catch {
      toast.error("Gagal menghapus foto");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
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
      const fresh = await refresh();
      if (fresh && fresh.profile_complete) {
        toast.success("Alhamdulillah, data akun Anda sudah lengkap. Jazakumullahu khoiro.");
        navigate("/roles", { replace: true });
      } else {
        toast.error(`Masih ada data yang kurang: ${(fresh?.missing_fields || []).join(", ")}`);
      }
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-[#FAFBF9] pb-12" data-testid="page-complete-profile">
      <header className="bg-[#0D5C3A] text-white">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden p-0.5">
              <img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <div className="font-bold font-heading">E-KERTALANGU</div>
              <div className="text-white/70 text-xs">Verifikasi Akun</div>
            </div>
          </div>
          <button
            data-testid="complete-logout"
            onClick={async () => { await logout(); navigate("/login"); }}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-white/10 text-white text-sm font-semibold hover:bg-white/20"
          >
            <LogOut size={16} /> Keluar
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 -mt-3">
        <div className="bg-white rounded-2xl border-2 border-[#FDE68A] bg-[#FFFBEB] p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="h-11 w-11 shrink-0 rounded-xl bg-[#FEF3C7] text-[#92400E] flex items-center justify-center">
              <AlertCircle size={22} />
            </span>
            <div>
              <h1 className="font-heading text-lg font-bold text-[#92400E]">Assalamualaikum, {user?.name}</h1>
              <p className="text-sm text-[#78350F] mt-1 leading-relaxed">
                Sebelum memakai aplikasi, mohon lengkapi data akun Anda terlebih dahulu.
                Data ini dipakai pengurus untuk verifikasi kehadiran pengajian.
              </p>
              {missing.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5" data-testid="missing-fields">
                  {missing.map((m) => (
                    <span key={m} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white text-[#92400E] border border-[#FDE68A]">
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Foto profil */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mt-4 flex flex-col items-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full overflow-hidden bg-[#E8F5EE] flex items-center justify-center border-2 border-[#0D5C3A]/20 text-[#0D5C3A] font-bold text-2xl">
              {photo ? <img src={photo} alt="Foto" className="h-full w-full object-cover" data-testid="complete-photo" /> : (initials || <UserIcon size={38} />)}
            </div>
            <button
              data-testid="complete-photo-pick"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-[#0D5C3A] text-white flex items-center justify-center shadow-md hover:bg-[#094229]"
            >
              <Camera size={16} />
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onPickPhoto} />
          </div>
          <p className="text-xs text-[#6B7280] mt-3">Foto profil (opsional)</p>
          {photo && (
            <button data-testid="complete-photo-remove" onClick={removePhoto} className="mt-1.5 text-xs text-[#DC2626] font-semibold inline-flex items-center gap-1">
              <Trash2 size={12} /> Hapus foto
            </button>
          )}
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mt-4 space-y-4">
          <Field label="Nama Lengkap" required filled={!!f.name.trim()}>
            <input data-testid="complete-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama sesuai identitas" className={inp} />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Jenis Kelamin" required filled={!!f.gender}>
              <select data-testid="complete-gender" value={f.gender} onChange={(e) => set("gender", e.target.value)} className={inp}>
                <option value="">— Pilih —</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </Field>
            <Field label="Tanggal Lahir" required filled={!!f.dob}>
              <input data-testid="complete-dob" type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} className={inp} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="No. HP" required filled={!!f.phone.trim()}>
              <input data-testid="complete-phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="08xxxxxxxxxx" className={inp} />
            </Field>
            <Field label="No. WhatsApp" hint="Opsional — kosongkan jika sama dengan No. HP">
              <input data-testid="complete-whatsapp" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="08xxxxxxxxxx" className={inp} />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Tempat Lahir">
              <input data-testid="complete-birthplace" value={f.birthplace} onChange={(e) => set("birthplace", e.target.value)} placeholder="Kota kelahiran" className={inp} />
            </Field>
            <Field label="Pendidikan">
              <input data-testid="complete-education" value={f.education} onChange={(e) => set("education", e.target.value)} placeholder="Mis. SMA / S1" className={inp} />
            </Field>
          </div>

          <Field label="Alamat" required filled={!!f.address.trim()}>
            <textarea
              data-testid="complete-address"
              value={f.address}
              onChange={(e) => set("address", e.target.value)}
              rows={3}
              placeholder="Alamat tempat tinggal saat ini"
              className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A] resize-none bg-white"
            />
          </Field>

          <button
            data-testid="complete-submit"
            type="submit"
            disabled={saving}
            className="w-full h-[52px] rounded-xl bg-[#0D5C3A] text-white font-bold text-base inline-flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={19} /> : <ShieldCheck size={19} />}
            Simpan &amp; Verifikasi Akun
          </button>
          <p className="text-center text-xs text-[#9CA3AF]">
            Tanda <span className="text-[#DC2626] font-bold">*</span> wajib diisi
          </p>
        </form>

        <div className="flex justify-center mt-8"><Logo size={34} /></div>
        <p className="text-center text-xs text-[#9CA3AF] mt-3">© 2026 E-KERTALANGU · Absensi Pengajian</p>
      </main>
    </div>
  );
}
