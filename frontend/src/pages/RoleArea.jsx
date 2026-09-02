import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, Shield, Users, UserCheck, Trash2, QrCode, Copy, Loader2, ListPlus, UserPlus, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/Logo";
import { DateField } from "@/components/DateField";

const META = {
  admin: { icon: Shield, title: "Area Admin", color: "#D97706" },
  pengurus: { icon: Users, title: "Area Pengurus", color: "#0284C7" },
  peserta: { icon: UserCheck, title: "Area Peserta", color: "#0D5C3A" },
};

export default function RoleArea() {
  const { role } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) return null;
  if (!user.roles?.includes(role)) {
    return <Navigate to="/roles" replace />;
  }

  const meta = META[role] || META.peserta;
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-[#FAFBF9]">
      <header className="sticky top-0 z-40 bg-[#FAFBF9]/90 backdrop-blur-md border-b border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            data-testid="button-back-roles"
            onClick={() => navigate("/roles")}
            className="inline-flex items-center gap-2 h-11 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[#4B5563] font-semibold text-sm hover:border-[#0D5C3A] hover:text-[#0D5C3A] transition-colors"
          >
            <ArrowLeft size={18} /> Pilih Peran
          </button>
          <Logo size={36} showText={false} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}>
            <Icon size={26} />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-[#111827]">{meta.title}</h1>
            <p className="text-[#6B7280] text-sm">Masuk sebagai {user.name}</p>
          </div>
        </div>

        {role === "admin" ? (
          <AdminPanel />
        ) : (
          <Placeholder role={role} />
        )}
      </main>
    </div>
  );
}

function Placeholder({ role }) {
  const msg =
    role === "pengurus"
      ? "Fitur buka sesi presensi, verifikasi kehadiran, dan rekap harian akan hadir pada fase berikutnya."
      : "Fitur presensi via QR, jadwal pengajian, dan riwayat kehadiran akan hadir pada fase berikutnya.";
  return (
    <div className="bg-white rounded-2xl p-8 border border-[#E5E7EB] text-center" data-testid="area-placeholder">
      <div className="inline-flex items-center gap-2 bg-[#E8F5EE] text-[#065F46] px-3 py-1 rounded-full text-sm font-semibold mb-4">
        Segera Hadir
      </div>
      <p className="text-[#4B5563] text-lg max-w-xl mx-auto">{msg}</p>
    </div>
  );
}

function AdminPanel() {
  const [users, setUsers] = useState(null);
  const [qr, setQr] = useState(null);
  const [pendingNames, setPendingNames] = useState("");
  const [savingPending, setSavingPending] = useState(false);
  const [importing, setImporting] = useState(false);
  const [newAcc, setNewAcc] = useState({
    name: "", phone: "", email: "", dob: "", address: "", password: "",
    roles: { admin: false, pengurus: false, peserta: true },
  });
  const [savingAcc, setSavingAcc] = useState(false);

  const load = () =>
    api.get("/admin/users").then(({ data }) => setUsers(data)).catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));

  useEffect(() => {
    load();
    api.get("/qr/public").then(({ data }) => setQr(data)).catch(() => {});
  }, []);

  const remove = async (id, name) => {
    if (!window.confirm(`Hapus akun "${name}"?`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success("Pengguna dihapus");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const copyLink = () => {
    if (qr?.link) {
      navigator.clipboard.writeText(qr.link);
      toast.success("Link pendaftaran disalin");
    }
  };

  const submitPending = async (e) => {
    e.preventDefault();
    const entries = pendingNames
      .split("\n")
      .map((line) => {
        const parts = line.split(/[,;]/);
        const name = (parts[0] || "").trim();
        const dob = (parts[1] || "").trim() || null;
        return { name, dob };
      })
      .filter((en) => en.name);
    if (entries.length === 0) {
      toast.error("Masukkan minimal satu nama");
      return;
    }
    setSavingPending(true);
    try {
      const { data } = await api.post("/admin/users/pending", { entries });
      const skip = data.skipped?.length ? `, ${data.skipped.length} dilewati (sudah ada)` : "";
      toast.success(`${data.count} nama peserta ditambahkan${skip}. Peserta dapat aktivasi mandiri.`);
      setPendingNames("");
      load();
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally {
      setSavingPending(false);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/users/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const skip = data.skipped?.length ? `, ${data.skipped.length} dilewati (duplikat)` : "";
      toast.success(`${data.count} peserta diimpor dari file${skip}.`);
      load();
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally {
      setImporting(false);
    }
  };

  const submitAccount = async (e) => {
    e.preventDefault();
    const roles = Object.entries(newAcc.roles).filter(([, v]) => v).map(([k]) => k);
    if (roles.length === 0) {
      toast.error("Pilih minimal satu peran");
      return;
    }
    setSavingAcc(true);
    try {
      const payload = {
        name: newAcc.name, phone: newAcc.phone || null, email: newAcc.email || null,
        dob: newAcc.dob || null, address: newAcc.address || null,
        password: newAcc.password, roles,
      };
      const { data } = await api.post("/admin/users", payload);
      toast.success(`Akun "${data.name}" dibuat & aktif.`);
      setNewAcc({ name: "", phone: "", email: "", dob: "", address: "", password: "", roles: { admin: false, pengurus: false, peserta: true } });
      load();
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally {
      setSavingAcc(false);
    }
  };

  const inp = "w-full h-[46px] px-3.5 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A]";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left column */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB] text-center" data-testid="admin-qr-panel">
          <div className="inline-flex items-center gap-2 text-[#065F46] font-semibold mb-3">
            <QrCode size={18} /> QR Pendaftaran Publik
          </div>
          {qr ? (
            <img src={qr.image} alt="QR Publik" className="mx-auto w-40 h-40 rounded-xl border border-[#E5E7EB] p-2" data-testid="admin-qr-image" />
          ) : (
            <div className="mx-auto w-40 h-40 rounded-xl bg-[#F2F5F2] flex items-center justify-center">
              <Loader2 className="animate-spin text-[#0D5C3A]" size={28} />
            </div>
          )}
          <button
            data-testid="button-copy-qr-link"
            onClick={copyLink}
            className="mt-4 w-full h-11 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#E8F5EE]"
          >
            <Copy size={16} /> Salin Link Daftar
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB]" data-testid="admin-pending-panel">
          <div className="inline-flex items-center gap-2 text-[#0D5C3A] font-bold mb-1">
            <ListPlus size={18} /> Tambah Nama Peserta
          </div>
          <p className="text-sm text-[#6B7280] mb-3">
            Satu baris per peserta. Format: <span className="font-semibold">Nama</span> atau <span className="font-semibold">Nama, DD-MM-YYYY</span> (tanggal lahir sebagai verifikasi). Peserta melengkapi data sendiri lewat menu Aktivasi.
          </p>
          <form onSubmit={submitPending}>
            <textarea
              data-testid="input-pending-names"
              value={pendingNames}
              onChange={(e) => setPendingNames(e.target.value)}
              rows={5}
              placeholder={"Budi Santoso, 17-08-1970\nSiti Aminah, 02-05-1965\nAhmad Fauzi"}
              className="w-full p-3.5 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A] resize-y"
            />
            <button
              data-testid="button-save-pending"
              type="submit"
              disabled={savingPending}
              className="mt-3 w-full h-11 rounded-xl bg-[#0D5C3A] text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60"
            >
              {savingPending ? <Loader2 className="animate-spin" size={18} /> : <ListPlus size={18} />}
              Tambahkan Nama
            </button>
          </form>

          <div className="relative my-4">
            <div className="border-t border-[#E5E7EB]" />
            <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-white px-2 text-xs text-[#9CA3AF]">atau</span>
          </div>
          <p className="text-sm text-[#6B7280] mb-2">
            Impor massal dari file. Kolom: <span className="font-semibold">Nama</span> (wajib), <span className="font-semibold">Tanggal Lahir</span> (opsional).
          </p>
          <label
            data-testid="button-import-file"
            className="w-full h-11 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#E8F5EE] cursor-pointer"
          >
            {importing ? <Loader2 className="animate-spin" size={18} /> : <FileSpreadsheet size={18} />}
            Impor Excel / CSV
            <input
              type="file"
              accept=".xlsx,.xlsm,.csv,.txt"
              onChange={handleImport}
              disabled={importing}
              className="hidden"
              data-testid="input-import-file"
            />
          </label>
        </div>
      </div>

      {/* Right column */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-[#E5E7EB]" data-testid="admin-create-panel">
          <div className="inline-flex items-center gap-2 text-[#0D5C3A] font-bold mb-4">
            <UserPlus size={18} /> Buat Akun Baru (Lengkap)
          </div>
          <form onSubmit={submitAccount} className="grid sm:grid-cols-2 gap-3">
            <input data-testid="input-new-name" required value={newAcc.name} onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })} placeholder="Nama Lengkap *" className={inp} />
            <input data-testid="input-new-phone" value={newAcc.phone} onChange={(e) => setNewAcc({ ...newAcc, phone: e.target.value })} placeholder="Nomor HP" className={inp} />
            <input data-testid="input-new-email" type="email" value={newAcc.email} onChange={(e) => setNewAcc({ ...newAcc, email: e.target.value })} placeholder="Email" className={inp} />
            <DateField testid="input-new-dob" value={newAcc.dob} onChange={(v) => setNewAcc({ ...newAcc, dob: v })} placeholder="Tanggal Lahir" className="h-[46px]" />
            <input data-testid="input-new-address" value={newAcc.address} onChange={(e) => setNewAcc({ ...newAcc, address: e.target.value })} placeholder="Alamat" className={`${inp} sm:col-span-2`} />
            <input data-testid="input-new-password" type="password" required minLength={6} value={newAcc.password} onChange={(e) => setNewAcc({ ...newAcc, password: e.target.value })} placeholder="Kata Sandi *" className={`${inp} sm:col-span-2`} />
            <div className="sm:col-span-2">
              <div className="text-sm font-semibold text-[#111827] mb-2">Peran</div>
              <div className="flex flex-wrap gap-2">
                {["admin", "pengurus", "peserta"].map((r) => (
                  <label key={r} data-testid={`checkbox-role-${r}`} className={`inline-flex items-center gap-2 px-3.5 h-10 rounded-xl border-2 cursor-pointer capitalize font-semibold text-sm transition-colors ${newAcc.roles[r] ? "border-[#0D5C3A] bg-[#E8F5EE] text-[#065F46]" : "border-[#E5E7EB] text-[#6B7280]"}`}>
                    <input type="checkbox" className="accent-[#0D5C3A]" checked={newAcc.roles[r]} onChange={(e) => setNewAcc({ ...newAcc, roles: { ...newAcc.roles, [r]: e.target.checked } })} />
                    {r}
                  </label>
                ))}
              </div>
            </div>
            <button
              data-testid="button-create-account"
              type="submit"
              disabled={savingAcc}
              className="sm:col-span-2 h-12 rounded-xl bg-[#0D5C3A] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60"
            >
              {savingAcc ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
              Buat Akun
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden" data-testid="admin-users-panel">
          <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
            <h2 className="font-heading font-bold text-[#111827] text-lg">Daftar Pengguna</h2>
            <span className="text-sm text-[#6B7280]">{users ? `${users.length} akun` : ""}</span>
          </div>
          {!users ? (
            <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={28} /></div>
          ) : (
            <ul className="divide-y divide-[#E5E7EB]">
              {users.map((u) => (
                <li key={u.id} data-testid={`user-row-${u.id}`} className="px-6 py-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#111827] truncate">{u.name}</div>
                    <div className="text-sm text-[#6B7280] truncate">
                      {u.status === "pending" ? "Belum melengkapi data" : `${u.phone || "-"} · ${u.email || "-"}`}
                    </div>
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {u.status === "pending" ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">Menunggu Aktivasi</span>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#065F46]">Aktif</span>
                      )}
                      {u.roles.map((r) => (
                        <span key={r} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F2F5F2] text-[#4B5563] capitalize">{r}</span>
                      ))}
                      {u.source === "qr_public" && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#075985]">via QR</span>
                      )}
                    </div>
                  </div>
                  <button
                    data-testid={`button-delete-user-${u.id}`}
                    onClick={() => remove(u.id, u.name)}
                    className="shrink-0 h-10 w-10 flex items-center justify-center rounded-lg text-[#DC2626] hover:bg-red-50"
                    aria-label="Hapus pengguna"
                  >
                    <Trash2 size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
