import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, Loader2, Save, KeyRound, ArrowRightLeft, Power, Camera, MoreHorizontal,
  Phone, MessageCircle, Mail, MapPin, GraduationCap, User as UserIcon, HeartHandshake,
  QrCode, Printer, Download, ClipboardList, History, CalendarDays, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { PARTICIPANTS } from "@/constants/testIds";
import ContactButtons from "@/components/ContactButtons";
import { DateField } from "@/components/DateField";
import ActionModal from "@/components/ActionModal";
import {
  EDUCATION_OPTIONS, MUBALIGH_OPTIONS, MARITAL_OPTIONS, ACTION_LABELS,
  genderLabel, statusBadge, formatTanggal, formatDateTime, maritalLabel, mubalighLabel,
} from "./adminUtils";

const inp = "w-full h-[46px] px-3.5 rounded-xl border-2 border-[#E8E8E4] text-base outline-none focus:border-[#111114] bg-white";
const lbl = "text-xs font-semibold text-[#6B7280] mb-1 block";
const card = "bg-white rounded-2xl border border-[#E8E8E4]";

const TABS = [
  { key: "profil", label: "Profil", icon: UserIcon },
  { key: "kehadiran", label: "Kehadiran", icon: ClipboardList },
  { key: "qr", label: "QR", icon: QrCode },
  { key: "riwayat", label: "Riwayat", icon: History },
];

const ROLE_NAMES = { admin: "Admin", pengurus: "Pengurus", peserta: "Peserta", guru: "Guru" };
const STATUS_ABSEN = {
  hadir: { label: "Hadir", cls: "bg-[#E8F5EE] text-[#14532D]" },
  izin: { label: "Izin", cls: "bg-[#FEF3C7] text-[#92400E]" },
  sakit: { label: "Sakit", cls: "bg-[#DBEAFE] text-[#1D4ED8]" },
  alpha: { label: "Alpha", cls: "bg-[#FEE2E2] text-[#991B1B]" },
  belum_diabsen: { label: "Belum diabsen", cls: "bg-[#F3F4F6] text-[#4B5563]" },
};
const LOG_COLORS = {
  login: "bg-[#E0F2FE] text-[#075985]",
  buat_akun: "bg-[#F1F1EE] text-[#111114]",
  hapus_akun: "bg-[#FEE2E2] text-[#991B1B]",
  reset_sandi: "bg-[#FEF3C7] text-[#92400E]",
  pindah_sambung: "bg-[#EDE9FE] text-[#5B21B6]",
};

function InfoRow({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{label}</div>
      <div className="mt-0.5 break-words text-sm font-medium text-[#111827]">{value || "-"}</div>
    </div>
  );
}

function StatCard({ label, value, color = "text-[#111827]" }) {
  return (
    <div className="rounded-xl border border-[#E8E8E4] bg-white p-3 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#E8E8E4] bg-[#FAFAF8] px-4 py-8 text-center">
      <Icon size={22} className="text-[#9CA3AF]" />
      <p className="text-sm text-[#6B7280]">{text}</p>
    </div>
  );
}

export default function PesertaDetailModal({ userId, initialTab = "profil", kelompokList, canManageRoles = true, canResetPassword = false, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [tab, setTab] = useState(initialTab);
  const [editing, setEditing] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [moveTarget, setMoveTarget] = useState(undefined);
  const [moveConfirm, setMoveConfirm] = useState(false);
  const [moveKeterangan, setMoveKeterangan] = useState("");
  const [report, setReport] = useState(null);
  const [logs, setLogs] = useState(null);
  const fileRef = useRef(null);

  const load = () =>
    api.get(`/admin/users/${userId}`)
      .then(({ data }) => { setData(data); setForm(data); })
      .catch((e) => { toast.error(formatApiErrorDetail(e.response?.data?.detail)); onClose(); });

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  useEffect(() => {
    setTab(initialTab);
    setEditing(false);
  }, [initialTab]);

  useEffect(() => {
    let alive = true;
    setReport(null);
    api.get(`/admin/laporan/peserta/${userId}`)
      .then(({ data }) => { if (alive) setReport(data); })
      .catch(() => { if (alive) setReport(false); });
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => {
    if (tab !== "riwayat" || logs !== null) return;
    let alive = true;
    api.get("/admin/logs?limit=500")
      .then(({ data }) => { if (alive) setLogs(data); })
      .catch(() => { if (alive) setLogs(false); });
    return () => { alive = false; };
  }, [tab, logs]);

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
        marital: form.marital || null,
        photo: form.photo ?? null, roles: form.roles, kelompok_id: form.kelompok_id || null,
        needs_completion: false,
      };
      await api.patch(`/admin/users/${userId}`, payload);
      toast.success("Data peserta disimpan");
      setEditing(false);
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
      setResetResult({ password: data.password, username: data.username });
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

  const setStatusTo = async (next) => {
    if ((data.status || "active") === next) return;
    setBusy("status");
    try {
      await api.patch(`/admin/users/${userId}`, { status: next });
      const label = next === "active" ? "Aktif" : next === "nonaktif" ? "Nonaktif" : "Pindah";
      toast.success(`Status akun diubah menjadi ${label}`);
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

  const printQr = () => {
    const svg = document.getElementById(`peserta-qr-${userId}`);
    if (!svg) return;
    const win = window.open("", "_blank", "width=520,height=640");
    if (!win) { toast.error("Izinkan pop-up untuk mencetak QR."); return; }
    const safeName = (data?.name || "Peserta").replace(/[<>&]/g, "");
    win.document.write(
      `<!doctype html><html><head><title>QR ${safeName}</title>` +
      `<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:32px;margin:0}` +
      `h1{font-size:18px;margin:0}p{font-size:12px;color:#6B7280;margin:0}svg{width:280px;height:280px}</style></head><body>` +
      `<h1>${safeName}</h1>` +
      `<p>Kartu identitas peserta E-KERTALANGU</p>` +
      svg.outerHTML +
      `<p>EKT:${userId}</p>` +
      `</body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  };

  const downloadQr = () => {
    const svg = document.getElementById(`peserta-qr-${userId}`);
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${(data?.name || "peserta").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const badge = data ? statusBadge(data.status, data.needs_completion) : null;
  const kelompokName = data?.kelompok_name
    || kelompokList?.find((k) => k.id === data?.kelompok_id)?.name
    || null;
  const six = report && report !== false ? report.six_months : null;
  const activities = report && report !== false ? (report.activities || []) : [];
  const participantLogs = (logs || []).filter((l) => l.target === userId);

  const actions = data ? [
    canManageRoles && {
      key: "ubah", testid: "quick-edit", label: "Ubah Data",
      desc: "Nama, kontak, kelompok, foto", icon: UserIcon,
      onClick: () => { setTab("profil"); setEditing(true); },
    },
    canManageRoles && {
      key: "pindah", testid: "quick-move", label: "Pindah Sambung",
      desc: "Pindahkan ke kelompok lain", icon: ArrowRightLeft,
      onClick: () => { setTab("profil"); setEditing(true); },
    },
    {
      key: "qr", testid: "quick-qr", label: "QR Barcode Peserta",
      desc: "Lihat, cetak & unduh QR permanen", icon: QrCode,
      onClick: () => { setTab("qr"); },
    },
    canResetPassword && {
      key: "reset", testid: "quick-reset", label: "Reset Sandi",
      desc: "Sandi sementara memakai tanggal lahir", icon: KeyRound,
      onClick: () => { setResetConfirm(true); return false; },
    },
    canManageRoles && {
      key: "nonaktif", testid: "quick-deactivate",
      label: data.status === "active" ? "Nonaktifkan Sementara" : "Aktifkan Akun",
      desc: data.status === "active" ? "Akun tidak bisa login, data tetap tersimpan" : "Izinkan akun masuk kembali",
      icon: Power,
      onClick: () => { toggleStatus(); return false; },
    },
  ].filter(Boolean) : [];

  return createPortal((
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#F7F7F5] shadow-2xl sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl"
        data-testid="peserta-detail-modal"
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-white">
          <div className="h-1.5 w-11 rounded-full bg-[#E8E8E4]" />
        </div>

        {/* Header */}
        <div className="shrink-0 border-b border-[#ECECE8] bg-white">
          <div className="flex items-start justify-between gap-3 px-4 pt-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F1F1EE] text-[#111114]">
                {data?.photo ? (
                  <img src={data.photo} alt={data.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold">
                    {(data?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-heading text-base font-bold leading-tight text-[#111827]">
                  {data?.name || "Memuat data…"}
                </h2>
                <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-[#6B7280]">
                  <span className="truncate">{data?.username ? `@${data.username}` : "Detail peserta"}</span>
                  {badge && <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {data && (
                <button
                  type="button"
                  onClick={() => setActionsOpen(true)}
                  aria-label="Aksi lainnya"
                  title="Aksi lainnya"
                  data-testid="button-more-actions"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-[#4B5563] transition-colors hover:bg-[#F4F4F1] hover:text-[#111114]"
                >
                  <MoreHorizontal size={20} />
                </button>
              )}
              <button data-testid="button-close-detail" onClick={onClose} aria-label="Tutup" className="flex h-9 w-9 items-center justify-center rounded-xl text-[#6B7280] transition-colors hover:bg-[#F4F4F1]"><X size={20} /></button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-2 flex gap-1 overflow-x-auto px-3 sm:px-4" role="tablist" aria-label="Bagian detail peserta">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`detail-tab-${t.key}`}
                  onClick={() => setTab(t.key)}
                  className={`relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-t-lg px-3 text-sm font-semibold transition-colors ${
                    active ? "text-[#111114]" : "text-[#6B7280] hover:text-[#111114]"
                  }`}
                >
                  <Icon size={15} /> {t.label}
                  <span className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-colors ${active ? "bg-[#111114]" : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>
        </div>

        {!data ? (
          <div className="flex flex-1 justify-center p-16"><Loader2 className="animate-spin text-[#111114]" size={30} /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {/* ---------------- PROFIL ---------------- */}
            {tab === "profil" && (
              <div className="space-y-3.5">
                {!editing ? (
                  <>
                    <div className={`${card} p-4`}>
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#F1F1EE] text-[#111114]">
                            {data.photo ? <img src={data.photo} alt={data.name} className="h-full w-full object-cover" /> : <UserIcon size={28} />}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-base font-bold text-[#111827]">{data.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
                            {(data.roles || []).map((r) => (
                              <span key={r} className="rounded-full bg-[#F1F1EE] px-2 py-0.5 text-[11px] font-medium text-[#374151]">{ROLE_NAMES[r] || r}</span>
                            ))}
                          </div>
                          <div className="mt-1 truncate text-xs text-[#6B7280]">
                            {data.username ? `@${data.username}` : "Belum punya nama pengguna"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <ContactButtons
                      phone={form.phone}
                      whatsapp={form.whatsapp}
                      name={data.name}
                      testidPrefix="detail-kontak"
                      label={`Hubungi ${data.name || "Peserta"}`}
                    />

                    <div className={`${card} p-4`}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-[#111827]">Biodata</div>
                        {canManageRoles && (
                          <button
                            type="button"
                            data-testid="button-start-edit"
                            onClick={() => setEditing(true)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[#111114] transition-colors hover:bg-[#F1F1EE]"
                          >
                            <Save size={13} /> Ubah
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoRow label="Email" value={data.email} />
                        <InfoRow label="No. telepon" value={data.phone} />
                        <InfoRow label="WhatsApp" value={data.whatsapp} />
                        <InfoRow label="Jenis kelamin" value={genderLabel(data.gender)} />
                        <InfoRow label="Tempat lahir" value={data.birthplace} />
                        <InfoRow label="Tanggal lahir" value={data.dob ? formatTanggal(data.dob) : null} />
                        <InfoRow label="Pendidikan" value={data.education} />
                        <InfoRow label="Kemubalighan" value={mubalighLabel(data.mubaligh)} />
                        <InfoRow label="Status pernikahan" value={maritalLabel(data.marital)} />
                        <InfoRow label="Kelompok" value={kelompokName || "Tanpa kelompok"} />
                        <div className="sm:col-span-2">
                          <InfoRow label="Alamat" value={data.address} />
                        </div>
                      </div>
                    </div>

                    <div className={`${card} p-4`}>
                      <div className="mb-2 text-sm font-semibold text-[#111827]">Status akun</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                        <span className="text-xs text-[#6B7280]">
                          {data.status === "active" ? "Akun dapat masuk ke aplikasi." : data.status === "pending" ? "Menunggu aktivasi akun." : "Akun tidak dapat masuk."}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={`${card} p-4`}>
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-[#F1F1EE] text-[#111114]">
                            {form.photo ? <img src={form.photo} alt="foto" className="h-full w-full object-cover" /> : <UserIcon size={36} />}
                          </div>
                          <button
                            data-testid="button-upload-photo"
                            onClick={() => fileRef.current?.click()}
                            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#111114] text-white"
                            title="Ganti foto"
                          ><Camera size={15} /></button>
                          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} data-testid="input-photo" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-bold text-[#111827]">{data.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
                            {(data.roles || []).map((r) => (
                              <span key={r} className="rounded-full bg-[#F1F1EE] px-2 py-0.5 text-[11px] font-medium text-[#374151]">{ROLE_NAMES[r] || r}</span>
                            ))}
                          </div>
                          <div className="mt-1 truncate text-xs text-[#6B7280]">
                            {data.username ? `@${data.username}` : "Belum punya nama pengguna"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={`${card} p-4`}>
                      <div className="mb-3 text-sm font-semibold text-[#111827]">Biodata</div>
                      <div className="grid gap-3 sm:grid-cols-2">
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
                        <div>
                          <label className={lbl}><HeartHandshake size={12} className="inline mr-1" />Status Pernikahan</label>
                          <select data-testid="detail-marital" value={form.marital || ""} onChange={(e) => set("marital", e.target.value)} className={inp}>
                            <option value="">- Pilih -</option>
                            {MARITAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    {canManageRoles && (
                      <div className={`${card} p-4`}>
                        <div className="mb-2 text-sm font-semibold text-[#111827]">Peran</div>
                        <div className="flex flex-wrap gap-2">
                          {["pengurus", "guru", "peserta"].map((r) => {
                            const on = (form.roles || []).includes(r);
                            return (
                              <label key={r} data-testid={`detail-role-${r}`} className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border-2 px-3.5 text-sm font-semibold capitalize ${on ? "border-[#111114] bg-[#F1F1EE] text-[#111114]" : "border-[#E8E8E4] text-[#6B7280]"}`}>
                                <input type="checkbox" className="accent-[#111114]" checked={on} onChange={() => toggleRole(r)} />{r}
                              </label>
                            );
                          })}
                          {(form.roles || []).includes("admin") && (
                            <span className="inline-flex h-10 items-center rounded-xl border-2 border-[#FDE68A] bg-[#FFFBEB] px-3.5 text-sm font-semibold text-[#92400E]">admin</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className={`${card} p-4`}>
                      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[#111827]"><ArrowRightLeft size={15} /> Pindah Sambung (Kelompok)</div>
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
                          className="flex h-[46px] shrink-0 items-center gap-2 rounded-xl bg-[#111114] px-4 text-sm font-semibold text-white hover:bg-[#000000] disabled:opacity-40"
                        >
                          {busy === "move" ? <Loader2 className="animate-spin" size={16} /> : <ArrowRightLeft size={16} />} Pindah
                        </button>
                      </div>
                      <p className="mt-1.5 text-xs text-[#9CA3AF]">Pilih kelompok tujuan lalu tekan Pindah untuk konfirmasi.</p>
                    </div>

                    <div className={`${card} p-4`}>
                      <div className="mb-2 text-[13px] font-semibold text-[#111827]">Status Akun</div>
                      <div className="grid grid-cols-3 gap-2" data-testid="detail-status-picker">
                        {[
                          { v: "active", label: "Aktif", cls: "bg-[#DCFCE7] text-[#166534] border-[#166534]" },
                          { v: "nonaktif", label: "Nonaktif", cls: "bg-[#FEE2E2] text-[#991B1B] border-[#991B1B]" },
                          { v: "pindah", label: "Pindah", cls: "bg-[#E0F2FE] text-[#075985] border-[#075985]" },
                        ].map((opt) => {
                          const active = (data.status || "active") === opt.v;
                          return (
                            <button
                              key={opt.v}
                              type="button"
                              data-testid={`detail-status-${opt.v}`}
                              disabled={busy === "status"}
                              onClick={() => setStatusTo(opt.v)}
                              className={`h-10 rounded-lg border-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                                active ? opt.cls : "border-[#E8E8E4] bg-white text-[#6B7280] hover:border-current"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-[11px] text-[#9CA3AF]">
                        Pindah = peserta keluar dari kelompok ini (riwayat absensi tetap tersimpan).
                      </p>
                    </div>

                    <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-[#ECECE8] bg-[#F7F7F5]/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
                      <button
                        type="button"
                        data-testid="button-cancel-edit"
                        onClick={() => { setForm(data); setMoveTarget(undefined); setEditing(false); }}
                        className="h-11 rounded-xl border-2 border-[#E8E8E4] bg-white px-4 text-sm font-semibold text-[#4B5563] hover:bg-[#F4F4F1]"
                      >
                        Batal
                      </button>
                      <button data-testid="button-save-detail" onClick={save} disabled={saving}
                        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#111114] px-5 text-sm font-bold text-white hover:bg-[#000000] disabled:opacity-60">
                        {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ---------------- KEHADIRAN ---------------- */}
            {tab === "kehadiran" && (
              <div className="space-y-4">
                {report === null ? (
                  <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[#111114]" size={26} /></div>
                ) : report === false ? (
                  <EmptyState icon={ClipboardList} text="Data kehadiran gagal dimuat." />
                ) : (
                  <>
                    <div className={`${card} p-4`}>
                      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                        <div className="text-sm font-semibold text-[#111827]">Ringkasan 6 bulan terakhir</div>
                        <div className="text-xs text-[#6B7280]">{six.summary.hadir} hadir dari {six.summary.total_pertemuan} pertemuan</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <StatCard label="Kehadiran" value={`${six.summary.ratio}%`} color="text-[#0D5C3A]" />
                        <StatCard label="Hadir" value={six.summary.hadir} color="text-[#14532D]" />
                        <StatCard label="Izin / Sakit" value={`${six.summary.izin} / ${six.summary.sakit}`} color="text-[#92400E]" />
                        <StatCard label="Alpha" value={six.summary.alpha} color="text-[#991B1B]" />
                      </div>
                    </div>

                    <div className={`${card} p-4`}>
                      <div className="mb-3 text-sm font-semibold text-[#111827]">Tren per bulan</div>
                      <div className="space-y-2.5">
                        {six.months.map((item) => (
                          <div key={item.month} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3">
                            <span className="text-xs font-semibold text-[#4B5563]">{item.label}</span>
                            <div className="h-2.5 overflow-hidden rounded-full bg-[#F1F1EE]">
                              <div className="h-full rounded-full bg-[#0D5C3A]" style={{ width: `${Math.min(Math.max(item.ratio || 0, 0), 100)}%` }} />
                            </div>
                            <span className="text-right text-xs font-bold tabular-nums text-[#111827]">{item.ratio}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={`${card} overflow-hidden`}>
                      <div className="flex items-center justify-between border-b border-[#E8E8E4] px-4 py-3">
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]"><CalendarDays size={16} /> Riwayat absensi</div>
                        <span className="text-xs text-[#6B7280]">{activities.length} pertemuan</span>
                      </div>
                      {activities.length === 0 ? (
                        <div className="p-6"><EmptyState icon={CalendarDays} text="Belum ada kegiatan pada periode ini." /></div>
                      ) : (
                        <ul className="max-h-80 divide-y divide-[#ECECE8] overflow-y-auto">
                          {activities.map((a) => {
                            const st = STATUS_ABSEN[a.status] || STATUS_ABSEN.belum_diabsen;
                            return (
                              <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-[#111827]">
                                    {a.name}{a.session_label ? ` · ${a.session_label}` : ""}
                                  </div>
                                  <div className="text-xs text-[#6B7280]">
                                    {formatTanggal(a.date)}{a.start_time ? ` · ${a.start_time}${a.end_time ? `–${a.end_time}` : ""}` : ""}
                                  </div>
                                </div>
                                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ---------------- QR ---------------- */}
            {tab === "qr" && (
              <div className="space-y-4">
                <div className={`${card} flex flex-col items-center gap-4 p-6`}>
                  <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
                    <QRCodeSVG
                      id={`peserta-qr-${userId}`}
                      value={`EKT:${userId}`}
                      title={`Barcode identitas ${data.name}`}
                      size={200}
                      level="M"
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-base font-bold text-[#111827]">{data.name}</div>
                    <div className="mt-0.5 text-xs text-[#6B7280]">Kartu identitas peserta · EKT:{userId}</div>
                  </div>
                  <div className="grid w-full gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={printQr}
                      data-testid="button-print-qr"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#111114] text-sm font-semibold text-white hover:bg-[#000000]"
                    >
                      <Printer size={16} /> Cetak QR
                    </button>
                    <button
                      type="button"
                      onClick={downloadQr}
                      data-testid="button-download-qr"
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border-2 border-[#E8E8E4] bg-white text-sm font-semibold text-[#111114] hover:border-[#111114]"
                    >
                      <Download size={16} /> Unduh QR
                    </button>
                  </div>
                </div>
                <p className="rounded-xl bg-[#F0FDF4] p-3 text-xs leading-relaxed text-[#14532D]">
                  QR ini permanen untuk identifikasi peserta. QR presensi tetap memakai barcode berputar dari menu peserta.
                </p>
              </div>
            )}

            {/* ---------------- RIWAYAT ---------------- */}
            {tab === "riwayat" && (
              <div className="space-y-3.5">
                <div className={`${card} p-4`}>
                  <div className="mb-3 text-sm font-semibold text-[#111827]">Informasi akun</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <InfoRow label="Nama pengguna" value={data.username ? `@${data.username}` : "Belum ada"} />
                    <InfoRow label="Status akun" value={badge.label} />
                    <InfoRow label="Peran" value={(data.roles || []).map((r) => ROLE_NAMES[r] || r).join(", ")} />
                    <InfoRow label="Kelompok" value={kelompokName || "Tanpa kelompok"} />
                    <InfoRow label="Terdaftar" value={data.created_at ? formatDateTime(data.created_at) : "-"} />
                    <InfoRow label="Sumber data" value={data.source === "admin_import" ? "Impor admin" : data.source === "demo" ? "Demo" : "Admin"} />
                  </div>
                </div>

                <div className={`${card} overflow-hidden`}>
                  <div className="flex items-center justify-between border-b border-[#E8E8E4] px-4 py-3">
                    <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]"><History size={16} /> Aktivitas peserta</div>
                    {logs && <span className="text-xs text-[#6B7280]">{participantLogs.length} catatan</span>}
                  </div>
                  {logs === null ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-[#111114]" size={22} /></div>
                  ) : logs === false ? (
                    <div className="p-6"><EmptyState icon={History} text="Riwayat aktivitas gagal dimuat." /></div>
                  ) : participantLogs.length === 0 ? (
                    <div className="p-6"><EmptyState icon={History} text="Belum ada aktivitas tercatat untuk peserta ini." /></div>
                  ) : (
                    <ul className="max-h-80 divide-y divide-[#ECECE8] overflow-y-auto">
                      {participantLogs.map((l) => (
                        <li key={l.id} className="flex items-start gap-3 px-4 py-3">
                          <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${LOG_COLORS[l.action] || "bg-[#F4F4F1] text-[#4B5563]"}`}>
                            {ACTION_LABELS[l.action] || l.action}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-[#111827]">{l.detail || "-"}</div>
                            <div className="mt-0.5 text-xs text-[#9CA3AF]">
                              oleh <span className="font-medium text-[#6B7280]">{l.actor_name || "Sistem"}</span> · {formatDateTime(l.at)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {actionsOpen && (
        <ActionModal
          testid="peserta-more-actions"
          title="Aksi Peserta"
          subtitle={data?.name}
          onClose={() => setActionsOpen(false)}
          actions={actions}
        />
      )}

      {moveConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => setMoveConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="move-confirm-dialog">
            <div className="mb-1 text-base font-bold text-[#111827]">Konfirmasi Pindah Sambung</div>
            <p className="mb-3 text-sm text-[#4B5563]">
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
              className="w-full resize-none rounded-xl border-2 border-[#E8E8E4] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#111114]"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                data-testid="button-move-no"
                onClick={() => setMoveConfirm(false)}
                className="h-11 rounded-xl border-2 border-[#E8E8E4] text-sm font-semibold text-[#4B5563] hover:bg-[#F4F4F1]"
              >
                Tidak
              </button>
              <button
                data-testid="button-move-yes"
                onClick={doMove}
                className="h-11 rounded-xl bg-[#111114] text-sm font-bold text-white hover:bg-[#000000]"
              >
                Ya, Pindahkan
              </button>
            </div>
          </div>
        </div>
      )}

      {resetConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setResetConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="modal-reset-confirm">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF3C7] text-[#B45309]"><KeyRound size={24} /></div>
            <h3 className="font-heading text-lg font-bold text-[#111827]">Reset Kata Sandi?</h3>
            <p className="mt-1.5 text-sm text-[#6B7280]">
              Apakah Anda yakin mereset kata sandi <b className="text-[#111827]">{data?.name}</b>? Sandi sementara memakai tanggal lahir (DDMMYYYY) dan wajib diganti saat peserta masuk berikutnya.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button data-testid="button-reset-cancel" onClick={() => setResetConfirm(false)}
                className="h-11 rounded-xl border-2 border-[#E8E8E4] font-semibold text-[#4B5563] hover:bg-[#F4F4F1]">Tidak</button>
              <button data-testid="button-reset-confirm" onClick={doReset}
                className="h-11 rounded-xl bg-[#9CA3AF] font-bold text-white hover:bg-[#B45309]">Ya, Reset</button>
            </div>
          </div>
        </div>
      )}

      {resetResult && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setResetResult(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="modal-reset-result">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F1EE] text-[#111114]"><CheckCircle2 size={24} /></div>
            <h3 className="font-heading text-lg font-bold text-[#111827]">Kata Sandi Direset</h3>
            <p className="mt-1.5 text-sm text-[#6B7280]">Nama pengguna:</p>
            <div className="my-2 rounded-xl bg-[#F4F4F1] px-3 py-2 font-semibold text-[#111114]" data-testid={PARTICIPANTS.resetUsername}>{resetResult.username || data?.name}</div>
            <p className="mt-2 text-sm text-[#6B7280]">Kata sandi sementara:</p>
            <div className="my-2 rounded-xl bg-[#F4F4F1] py-3 font-mono text-2xl font-bold tracking-widest text-[#111114]" data-testid="reset-result-password">{resetResult.password}</div>
            <p className="text-xs text-[#9CA3AF]">Sampaikan dengan aman. Peserta harus mengganti kata sandi ini dan melengkapi data akun setelah masuk.</p>
            <button data-testid="button-reset-result-close" onClick={() => setResetResult(null)}
              className="mt-4 h-11 w-full rounded-xl bg-[#111114] font-bold text-white hover:bg-[#000000]">Tutup</button>
          </div>
        </div>
      )}
    </div>
  ), document.body);
}
