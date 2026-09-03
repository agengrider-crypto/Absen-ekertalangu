import { useEffect, useRef, useState } from "react";
import {
  X, Loader2, Save, KeyRound, ArrowRightLeft, Power, Camera,
  Phone, MessageCircle, Mail, MapPin, GraduationCap, User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { DateField } from "@/components/DateField";
import { EDUCATION_OPTIONS, MUBALIGH_OPTIONS, genderLabel, statusBadge } from "./adminUtils";

const inp = "w-full h-[46px] px-3.5 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A] bg-white";
const lbl = "text-xs font-semibold text-[#6B7280] mb-1 block";

export default function PesertaDetailModal({ userId, kelompokList, canManageRoles = true, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [moveTarget, setMoveTarget] = useState(undefined);
  const [moveConfirm, setMoveConfirm] = useState(false);
  const [moveKeterangan, setMoveKeterangan] = useState("");
  const fileRef = useRef(null);

  const load = () =>
    api.get(`/admin/users/${userId}`)
      .then(({ data }) => { setData(data); setForm(data); })
      .catch((e) => { toast.error(formatApiErrorDetail(e.response?.data?.detail)); onClose(); });

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleRole = (r) => {
    setForm((f) => {
      const roles = new Set(f.roles || []);
      if (roles.has(r)) roles.delete(r); else roles.add(r);
      return { ...f, roles: Array.from(roles) };
    });
  };

  const onPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) { toast.error("Ukuran foto maksimal 1.5 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => set("photo", reader.result);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.name?.trim()) { toast.error("Nama wajib diisi"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name, email: form.email || "", phone: form.phone || "",
        whatsapp: form.whatsapp || "", dob: form.dob || null, birthplace: form.birthplace || "",
        address: form.address || "", gender: form.gender || null,
        education: form.education || null, mubaligh: form.mubaligh || null,
        photo: form.photo ?? null, roles: form.roles, kelompok_id: form.kelompok_id || null,
        needs_completion: false,
      };
      await api.patch(`/admin/users/${userId}`, payload);
      toast.success("Data peserta disimpan");
      onChanged?.();
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = () => setResetConfirm(true);

  const doReset = async () => {
    setResetConfirm(false);
    setBusy("reset");
    try {
      const { data } = await api.post(`/admin/users/${userId}/reset-password`);
      setResetResult(data.password);
      onChanged?.();
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setBusy("");
    }
  };

  const toggleStatus = async () => {
    const next = data.status === "active" ? "nonaktif" : "active";
    setBusy("status");
    try {
      await api.patch(`/admin/users/${userId}`, { status: next });
      toast.success(next === "active" ? "Akun diaktifkan" : "Akun dinonaktifkan");
      onChanged?.();
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setBusy("");
    }
  };

  const doMove = async () => {
    const kid = moveTarget !== undefined ? moveTarget : (form.kelompok_id || "");
    setMoveConfirm(false);
    setBusy("move");
    try {
      await api.post(`/admin/users/${userId}/move`, {
        kelompok_id: kid || null,
        keterangan: moveKeterangan.trim() || null,
      });
      set("kelompok_id", kid || null);
      setMoveKeterangan("");
      setMoveTarget(undefined);
      toast.success("Pindah sambung berhasil");
      onChanged?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setBusy("");
    }
  };

  const badge = data ? statusBadge(data.status, data.needs_completion) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-[#FAFBF9] w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="peserta-detail-modal"
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E5E7EB] px-5 py-3.5 flex items-center justify-between z-10">
          <h2 className="font-heading font-bold text-[#111827]">Detail Peserta</h2>
          <button data-testid="button-close-detail" onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F2F5F2]"><X size={20} /></button>
        </div>

        {!data ? (
          <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={30} /></div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Header: photo + name + status */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-20 w-20 rounded-2xl overflow-hidden bg-[#E8F5EE] flex items-center justify-center text-[#0D5C3A]">
                  {form.photo ? <img src={form.photo} alt="foto" className="h-full w-full object-cover" /> : <UserIcon size={36} />}
                </div>
                <button
                  data-testid="button-upload-photo"
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-[#0D5C3A] text-white flex items-center justify-center border-2 border-white"
                  title="Ganti foto"
                ><Camera size={15} /></button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} data-testid="input-photo" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-lg text-[#111827] truncate">{data.name}</div>
                <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
              </div>
            </div>

            {/* Biodata form */}
            <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB] grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className={lbl}>Nama Lengkap *</label>
                <input data-testid="detail-name" value={form.name || ""} onChange={(e) => set("name", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}><Mail size={12} className="inline mr-1" />Email</label>
                <input data-testid="detail-email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}><Phone size={12} className="inline mr-1" />No. Telepon</label>
                <input data-testid="detail-phone" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}><MessageCircle size={12} className="inline mr-1" />WhatsApp</label>
                <input data-testid="detail-whatsapp" value={form.whatsapp || ""} onChange={(e) => set("whatsapp", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Jenis Kelamin</label>
                <select data-testid="detail-gender" value={form.gender || ""} onChange={(e) => set("gender", e.target.value)} className={inp}>
                  <option value="">- Pilih -</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Tempat Lahir</label>
                <input data-testid="detail-birthplace" value={form.birthplace || ""} onChange={(e) => set("birthplace", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Tanggal Lahir</label>
                <DateField testid="detail-dob" value={form.dob || ""} onChange={(v) => set("dob", v)} placeholder="Tanggal Lahir" className="h-[46px]" />
              </div>
              <div className="sm:col-span-2">
                <label className={lbl}><MapPin size={12} className="inline mr-1" />Alamat</label>
                <input data-testid="detail-address" value={form.address || ""} onChange={(e) => set("address", e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}><GraduationCap size={12} className="inline mr-1" />Pendidikan</label>
                <select data-testid="detail-education" value={form.education || ""} onChange={(e) => set("education", e.target.value)} className={inp}>
                  <option value="">- Pilih -</option>
                  {EDUCATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Kemubalighan</label>
                <select data-testid="detail-mubaligh" value={form.mubaligh || ""} onChange={(e) => set("mubaligh", e.target.value)} className={inp}>
                  <option value="">- Pilih -</option>
                  {MUBALIGH_OPTIONS.map((o) => <option key={o} value={o} className="capitalize">{o === "sudah" ? "Sudah" : "Belum"}</option>)}
                </select>
              </div>
            </div>

            {/* Roles */}
            {canManageRoles && (
            <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB]">
              <div className="text-sm font-semibold text-[#111827] mb-2">Peran</div>
              <div className="flex flex-wrap gap-2">
                {["pengurus", "peserta"].map((r) => {
                  const on = (form.roles || []).includes(r);
                  return (
                    <label key={r} data-testid={`detail-role-${r}`} className={`inline-flex items-center gap-2 px-3.5 h-10 rounded-xl border-2 cursor-pointer capitalize font-semibold text-sm ${on ? "border-[#0D5C3A] bg-[#E8F5EE] text-[#065F46]" : "border-[#E5E7EB] text-[#6B7280]"}`}>
                      <input type="checkbox" className="accent-[#0D5C3A]" checked={on} onChange={() => toggleRole(r)} />{r}
                    </label>
                  );
                })}
                {(form.roles || []).includes("admin") && (
                  <span className="inline-flex items-center px-3.5 h-10 rounded-xl border-2 border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] font-semibold text-sm">admin</span>
                )}
              </div>
            </div>
            )}

            {/* Pindah sambung */}
            <div className="bg-white rounded-2xl p-4 border border-[#E5E7EB]">
              <div className="text-sm font-semibold text-[#111827] mb-2 flex items-center gap-1.5"><ArrowRightLeft size={15} /> Pindah Sambung (Kelompok)</div>
              <div className="flex gap-2">
                <select
                  data-testid="detail-kelompok"
                  value={moveTarget !== undefined ? moveTarget : (form.kelompok_id || "")}
                  onChange={(e) => setMoveTarget(e.target.value)}
                  disabled={busy === "move"}
                  className={inp}
                >
                  <option value="">- Tanpa Kelompok -</option>
                  {kelompokList.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
                <button
                  data-testid="button-open-move-confirm"
                  onClick={() => setMoveConfirm(true)}
                  disabled={busy === "move" || (moveTarget === undefined || moveTarget === (form.kelompok_id || ""))}
                  className="shrink-0 h-[46px] px-4 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm flex items-center gap-2 hover:bg-[#094229] disabled:opacity-40"
                >
                  {busy === "move" ? <Loader2 className="animate-spin" size={16} /> : <ArrowRightLeft size={16} />} Pindah
                </button>
              </div>
              <p className="text-xs text-[#9CA3AF] mt-1.5">Pilih kelompok tujuan lalu tekan Pindah untuk konfirmasi.</p>
            </div>

            {/* Konfirmasi pindah sambung */}
            {moveConfirm && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setMoveConfirm(false)}>
                <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="move-confirm-dialog">
                  <div className="text-base font-bold text-[#111827] mb-1">Konfirmasi Pindah Sambung</div>
                  <p className="text-sm text-[#4B5563] mb-3">
                    Pindahkan <b>{data?.name}</b> ke{" "}
                    <b>{(() => {
                      const kid = moveTarget !== undefined ? moveTarget : (form.kelompok_id || "");
                      if (!kid) return "Tanpa Kelompok";
                      return kelompokList.find((k) => k.id === kid)?.name || "kelompok terpilih";
                    })()}</b>?
                  </p>
                  <label className={lbl}>Keterangan (opsional)</label>
                  <textarea
                    data-testid="move-keterangan"
                    value={moveKeterangan}
                    onChange={(e) => setMoveKeterangan(e.target.value)}
                    rows={3}
                    placeholder="cth: pindah domisili, ikut keluarga, dsb."
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] bg-white resize-none"
                  />
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <button
                      data-testid="button-move-no"
                      onClick={() => setMoveConfirm(false)}
                      className="h-11 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] font-semibold text-sm hover:bg-[#F2F5F2]"
                    >
                      Tidak
                    </button>
                    <button
                      data-testid="button-move-yes"
                      onClick={doMove}
                      className="h-11 rounded-xl bg-[#0D5C3A] text-white font-bold text-sm hover:bg-[#094229]"
                    >
                      Ya, Pindahkan
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="grid sm:grid-cols-3 gap-3">
              <button data-testid="button-reset-password" onClick={resetPassword} disabled={busy === "reset"}
                className="h-11 rounded-xl border-2 border-[#D97706] text-[#B45309] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#FFFBEB] disabled:opacity-50">
                {busy === "reset" ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />} Reset Sandi
              </button>
              <button data-testid="button-toggle-status" onClick={toggleStatus} disabled={busy === "status"}
                className={`h-11 rounded-xl border-2 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${data.status === "active" ? "border-[#DC2626] text-[#DC2626] hover:bg-red-50" : "border-[#0D5C3A] text-[#0D5C3A] hover:bg-[#E8F5EE]"}`}>
                {busy === "status" ? <Loader2 className="animate-spin" size={16} /> : <Power size={16} />} {data.status === "active" ? "Nonaktifkan" : "Aktifkan"}
              </button>
              <button data-testid="button-save-detail" onClick={save} disabled={saving}
                className="h-11 rounded-xl bg-[#0D5C3A] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60">
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan
              </button>
            </div>
          </div>
        )}
      </div>

      {resetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setResetConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center" onClick={(e) => e.stopPropagation()} data-testid="modal-reset-confirm">
            <div className="mx-auto h-12 w-12 rounded-full bg-[#FEF3C7] text-[#B45309] flex items-center justify-center mb-3"><KeyRound size={24} /></div>
            <h3 className="font-heading font-bold text-[#111827] text-lg">Reset Kata Sandi?</h3>
            <p className="text-sm text-[#6B7280] mt-1.5">
              Apakah Anda yakin mereset password <b className="text-[#111827]">{data?.name}</b>? Kata sandi akan diganti menjadi tanggal lahir (format DDMMYYYY).
            </p>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button data-testid="button-reset-cancel" onClick={() => setResetConfirm(false)}
                className="h-11 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] font-semibold hover:bg-[#F2F5F2]">Tidak</button>
              <button data-testid="button-reset-confirm" onClick={doReset}
                className="h-11 rounded-xl bg-[#D97706] text-white font-bold hover:bg-[#B45309]">Ya, Reset</button>
            </div>
          </div>
        </div>
      )}

      {resetResult && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setResetResult(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center" onClick={(e) => e.stopPropagation()} data-testid="modal-reset-result">
            <div className="mx-auto h-12 w-12 rounded-full bg-[#E8F5EE] text-[#065F46] flex items-center justify-center mb-3"><KeyRound size={24} /></div>
            <h3 className="font-heading font-bold text-[#111827] text-lg">Kata Sandi Direset</h3>
            <p className="text-sm text-[#6B7280] mt-1.5">Kata sandi baru untuk <b className="text-[#111827]">{data?.name}</b>:</p>
            <div className="my-3 py-3 rounded-xl bg-[#F2F5F2] font-mono text-2xl font-bold tracking-widest text-[#0D5C3A]" data-testid="reset-result-password">{resetResult}</div>
            <p className="text-xs text-[#9CA3AF]">Sampaikan kata sandi ini kepada peserta. Format: DDMMYYYY.</p>
            <button data-testid="button-reset-result-close" onClick={() => setResetResult(null)}
              className="mt-4 w-full h-11 rounded-xl bg-[#0D5C3A] text-white font-bold hover:bg-[#094229]">Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
}
