import { useEffect, useMemo, useState } from "react";
import {
  Users, Search, Loader2, UserPlus, Trash2, X, Eye, AlertTriangle,
  ClipboardList, CalendarDays, Heart,
} from "lucide-react";
import { toast } from "sonner";
import { api, API, formatApiErrorDetail } from "@/lib/api";
import { DateField } from "@/components/DateField";
import PesertaDetailModal from "./PesertaDetailModal";
import { formatTanggal, genderLabel, statusBadge, MARITAL_OPTIONS } from "./adminUtils";

const inp = "w-full h-[46px] px-3.5 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A] bg-white";

/**
 * FASE 10 — KELENGKAPAN DATA: tanggal lahir & status pernikahan dipakai untuk
 * penyaringan kegiatan (kelompok usia / khusus menikah). Jamaah yang datanya
 * kosong tidak akan masuk daftar kegiatan khusus tersebut.
 */
export function dataMissing(u) {
  const m = [];
  if (!u?.dob || !/^\d{4}-\d{2}-\d{2}$/.test(String(u.dob).slice(0, 10))) m.push("dob");
  if (!u?.marital) m.push("marital");
  return m;
}
const MISSING_LABEL = { dob: "Tgl lahir", marital: "Status nikah" };

function PesertaAvatar({ user }) {
  const [err, setErr] = useState(false);
  const initials = (user?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  if (user?.has_photo && !err) {
    return (
      <img
        src={`${API}/admin/users/${user.id}/photo`}
        alt={user.name}
        loading="lazy"
        onError={() => setErr(true)}
        className="h-10 w-10 rounded-full object-cover border border-[#E5E7EB]"
        data-testid={`peserta-photo-${user.id}`}
      />
    );
  }
  return (
    <div className="h-10 w-10 rounded-full bg-[#E8F5EE] text-[#0D5C3A] flex items-center justify-center font-bold text-xs">
      {initials}
    </div>
  );
}

export default function Peserta({ role = "admin" }) {
  const isAdmin = role === "admin";
  const [users, setUsers] = useState(null);
  const [kelompok, setKelompok] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | active | incomplete
  const [selected, setSelected] = useState(new Set());
  const [detailId, setDetailId] = useState(null);
  const [modal, setModal] = useState(null); // "add" | "bulk" | null

  const load = () =>
    api.get("/admin/users")
      .then(({ data }) => setUsers(data.filter((u) => u.roles?.includes("peserta"))))
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));

  useEffect(() => {
    load();
    api.get("/admin/kelompok").then(({ data }) => setKelompok(data)).catch(() => {});
  }, []);

  const counts = useMemo(() => {
    const all = users || [];
    return {
      all: all.length,
      pending: all.filter((u) => u.status === "pending").length,
      active: all.filter((u) => u.status === "active").length,
      incomplete: all.filter((u) => dataMissing(u).length > 0).length,
      missingDob: all.filter((u) => dataMissing(u).includes("dob")).length,
      missingMarital: all.filter((u) => dataMissing(u).includes("marital")).length,
    };
  }, [users]);

  const filtered = useMemo(() => {
    if (!users) return [];
    let list = users;
    if (statusFilter === "pending") list = list.filter((u) => u.status === "pending");
    else if (statusFilter === "active") list = list.filter((u) => u.status === "active");
    else if (statusFilter === "incomplete") list = list.filter((u) => dataMissing(u).length > 0);
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((u) =>
      (u.name || "").toLowerCase().includes(t) ||
      (u.phone || "").toLowerCase().includes(t) ||
      (u.birthplace || "").toLowerCase().includes(t));
  }, [users, q, statusFilter]);

  const allChecked = filtered.length > 0 && filtered.every((u) => selected.has(u.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) filtered.forEach((u) => next.delete(u.id));
      else filtered.forEach((u) => next.add(u.id));
      return next;
    });
  };
  const toggleOne = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Hapus ${ids.length} peserta terpilih? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      const { data } = await api.post("/admin/users/bulk-delete", { ids });
      toast.success(`${data.deleted} peserta dihapus`);
      setSelected(new Set());
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-[#0D5C3A] font-bold text-lg">
          <Users size={20} /> Peserta
          {users && <span className="text-sm font-medium text-[#6B7280]">({users.length})</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button data-testid="button-open-add" onClick={() => setModal("add")}
            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm hover:bg-[#094229]">
            <UserPlus size={16} /> Tambah Peserta
          </button>
        </div>
      </div>

      {/* Search + bulk delete */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            data-testid="input-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama, No HP, tempat lahir..."
            className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A] bg-white"
          />
        </div>
        {selected.size > 0 && (
          <button data-testid="button-bulk-delete" onClick={bulkDelete}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[#DC2626] text-white font-semibold text-sm hover:bg-[#B91C1C]">
            <Trash2 size={16} /> Hapus Terpilih ({selected.size})
          </button>
        )}
      </div>

      {/* Filter status aktivasi */}
      <div className="flex items-center gap-2 mb-4 flex-wrap" data-testid="status-filter">
        {[
          { key: "all", label: "Semua", count: counts.all, cls: "bg-[#0D5C3A] text-white border-[#0D5C3A]" },
          { key: "pending", label: "Belum Aktivasi", count: counts.pending, cls: "bg-[#D97706] text-white border-[#D97706]" },
          { key: "active", label: "Sudah Aktif", count: counts.active, cls: "bg-[#059669] text-white border-[#059669]" },
          { key: "incomplete", label: "Data Belum Lengkap", count: counts.incomplete, cls: "bg-[#9D174D] text-white border-[#9D174D]" },
        ].map((f) => {
          const on = statusFilter === f.key;
          return (
            <button
              key={f.key}
              data-testid={`filter-${f.key}`}
              onClick={() => setStatusFilter(f.key)}
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full border-2 text-sm font-semibold transition-colors ${on ? f.cls : "bg-white text-[#4B5563] border-[#E5E7EB] hover:border-[#0D5C3A]"}`}
            >
              {f.key === "pending" && <AlertTriangle size={14} className={on ? "text-white" : "text-[#D97706]"} />}
              {f.key === "incomplete" && <ClipboardList size={14} className={on ? "text-white" : "text-[#9D174D]"} />}
              {f.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${on ? "bg-white/25" : "bg-[#F3F4F6] text-[#374151]"}`}>{f.count}</span>
            </button>
          );
        })}
        {counts.pending > 0 && statusFilter !== "pending" && (
          <span className="text-xs text-[#92400E] bg-[#FEF3C7] px-2.5 py-1 rounded-full">
            {counts.pending} peserta belum mengaktifkan akun — bagikan QR Aktivasi untuk menindaklanjuti
          </span>
        )}
      </div>

      {/* FASE 10 — Kelengkapan data (tanggal lahir & status pernikahan) */}
      {users && counts.incomplete > 0 && (
        <div className={`mb-4 rounded-2xl border-2 p-3.5 flex flex-wrap items-center gap-3 ${statusFilter === "incomplete" ? "border-[#9D174D] bg-[#FDF2F8]" : "border-[#F5D0E3] bg-[#FDF2F8]/60"}`} data-testid="kelengkapan-banner">
          <span className="h-10 w-10 rounded-xl bg-[#9D174D] text-white flex items-center justify-center shrink-0"><ClipboardList size={18} /></span>
          <div className="flex-1 min-w-[200px]">
            <div className="text-sm font-bold text-[#831843]">
              {counts.incomplete} jamaah datanya belum lengkap
            </div>
            <div className="text-xs text-[#9D174D] mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
              <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> Tgl lahir kosong: <b>{counts.missingDob}</b></span>
              <span className="inline-flex items-center gap-1"><Heart size={12} /> Status nikah kosong: <b>{counts.missingMarital}</b></span>
            </div>
            <p className="text-[11px] text-[#6B7280] mt-1 leading-relaxed">
              Data ini dipakai penyaringan kegiatan khusus (kelompok usia / status pernikahan). Jamaah yang datanya
              kosong <b>tidak masuk</b> daftar absen kegiatan khusus tersebut. Klik <b>Detail</b> untuk melengkapi.
            </p>
          </div>
          {statusFilter !== "incomplete" ? (
            <button data-testid="kelengkapan-show" onClick={() => setStatusFilter("incomplete")}
              className="h-10 px-4 rounded-xl bg-[#9D174D] text-white font-semibold text-sm hover:bg-[#831843]">Tampilkan daftar</button>
          ) : (
            <button data-testid="kelengkapan-hide" onClick={() => setStatusFilter("all")}
              className="h-10 px-4 rounded-xl border-2 border-[#9D174D] text-[#9D174D] font-semibold text-sm hover:bg-[#FDF2F8]">Tampilkan semua</button>
          )}
        </div>
      )}
      {users && counts.incomplete === 0 && statusFilter === "incomplete" && (
        <div className="mb-4 rounded-2xl border border-[#CDEBD9] bg-[#F0FAF4] p-3.5 text-sm text-[#065F46] font-semibold" data-testid="kelengkapan-complete">
          Semua jamaah sudah melengkapi tanggal lahir dan status pernikahan.
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden" data-testid="peserta-table">
        {!users ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={28} /></div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[#6B7280]">{q ? "Tidak ada peserta cocok." : "Belum ada peserta."}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAF8] text-[#6B7280] text-left">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" className="accent-[#0D5C3A] w-4 h-4" checked={allChecked} onChange={toggleAll} data-testid="checkbox-all" />
                  </th>
                  <th className="px-4 py-3 font-semibold w-14">Foto</th>
                  <th className="px-4 py-3 font-semibold">Nama</th>
                  <th className="px-4 py-3 font-semibold hidden sm:table-cell">Jenis Kelamin</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Tempat Lahir</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Tgl Lahir</th>
                  <th className="px-4 py-3 font-semibold hidden lg:table-cell">No HP</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Kelengkapan</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filtered.map((u) => {
                  const b = statusBadge(u.status, u.needs_completion);
                  const miss = dataMissing(u);
                  return (
                    <tr key={u.id} data-testid={`peserta-row-${u.id}`} className={selected.has(u.id) ? "bg-[#F0FAF4]" : ""}>
                      <td className="px-4 py-3">
                        <input type="checkbox" className="accent-[#0D5C3A] w-4 h-4" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} data-testid={`checkbox-${u.id}`} />
                      </td>
                      <td className="px-4 py-3">
                        <PesertaAvatar user={u} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#111827] flex items-center gap-1.5">
                          {u.name}
                          {u.needs_completion && <AlertTriangle size={14} className="text-[#D97706]" title="Perlu dilengkapi" />}
                        </div>
                        <div className="text-xs text-[#9CA3AF] sm:hidden">{genderLabel(u.gender)} · {u.phone || "-"}</div>
                        {miss.length > 0 && (
                          <div className="text-[11px] text-[#9D174D] font-semibold md:hidden mt-0.5">
                            {miss.map((m) => MISSING_LABEL[m]).join(" & ")} belum diisi
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-[#4B5563]">{genderLabel(u.gender)}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-[#4B5563]">{u.birthplace || "-"}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-[#4B5563]">{formatTanggal(u.dob)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-[#4B5563]">{u.phone || "-"}</td>
                      <td className="px-4 py-3 hidden md:table-cell" data-testid={`kelengkapan-${u.id}`}>
                        {miss.length === 0 ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#065F46]">Lengkap</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {miss.map((m) => (
                              <span key={m} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#FDF2F8] text-[#9D174D] inline-flex items-center gap-1">
                                {m === "dob" ? <CalendarDays size={11} /> : <Heart size={11} />} {MISSING_LABEL[m]} kosong
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button data-testid={`button-detail-${u.id}`} onClick={() => setDetailId(u.id)}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#E5E7EB] text-[#0D5C3A] font-semibold text-sm hover:border-[#0D5C3A] hover:bg-[#E8F5EE]">
                          <Eye size={15} /> Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailId && (
        <PesertaDetailModal
          userId={detailId}
          kelompokList={kelompok}
          canManageRoles={isAdmin}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
      {modal === "add" && <AddModal kelompok={kelompok} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
    </div>
  );
}

function ModalShell({ title, children, onClose, testid, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className={`bg-[#FAFBF9] w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl`} onClick={(e) => e.stopPropagation()} data-testid={testid}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E5E7EB] px-5 py-3.5 flex items-center justify-between z-10">
          <h2 className="font-heading font-bold text-[#111827]">{title}</h2>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F2F5F2]"><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function AddModal({ kelompok, onClose, onDone }) {
  const [f, setF] = useState({ name: "", gender: "", marital: "", birthplace: "", dob: "", phone: "", whatsapp: "", email: "", address: "", kelompok_id: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) { toast.error("Nama wajib diisi"); return; }
    setSaving(true);
    try {
      await api.post("/admin/users", {
        name: f.name, gender: f.gender || null, birthplace: f.birthplace || null,
        dob: f.dob || null, phone: f.phone || null, whatsapp: f.whatsapp || null,
        email: f.email || null, address: f.address || null, kelompok_id: f.kelompok_id || null,
        marital: f.marital || null,
        roles: ["peserta"],
      });
      toast.success(`Peserta "${f.name}" ditambahkan (menunggu aktivasi).`);
      onDone();
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return (
    <ModalShell title="Tambah Peserta" onClose={onClose} testid="modal-add">
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
        <input data-testid="add-name" required value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Nama Lengkap *" className={`${inp} sm:col-span-2`} />
        <select data-testid="add-gender" value={f.gender} onChange={(e) => set("gender", e.target.value)} className={inp}>
          <option value="">Jenis Kelamin</option>
          <option value="L">Laki-laki</option>
          <option value="P">Perempuan</option>
        </select>
        <select data-testid="add-marital" value={f.marital} onChange={(e) => set("marital", e.target.value)} className={inp}>
          <option value="">Status Pernikahan</option>
          {MARITAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input data-testid="add-birthplace" value={f.birthplace} onChange={(e) => set("birthplace", e.target.value)} placeholder="Tempat Lahir" className={inp} />
        <DateField testid="add-dob" value={f.dob} onChange={(v) => set("dob", v)} placeholder="Tanggal Lahir" className="h-[46px]" />
        <input data-testid="add-phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="No. HP / Telepon" className={inp} />
        <input data-testid="add-whatsapp" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="No. WhatsApp" className={inp} />
        <input data-testid="add-email" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="Email" className={inp} />
        <input data-testid="add-address" value={f.address} onChange={(e) => set("address", e.target.value)} placeholder="Alamat" className={`${inp} sm:col-span-2`} />
        <select data-testid="add-kelompok" value={f.kelompok_id} onChange={(e) => set("kelompok_id", e.target.value)} className={`${inp} sm:col-span-2`}>
          <option value="">- Tanpa Kelompok -</option>
          {kelompok.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <button data-testid="button-submit-add" type="submit" disabled={saving}
          className="sm:col-span-2 h-12 rounded-xl bg-[#0D5C3A] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60">
          {saving ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />} Tambahkan
        </button>
      </form>
    </ModalShell>
  );
}

