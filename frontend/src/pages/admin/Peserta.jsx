import { useEffect, useMemo, useRef, useState } from "react";
import {
  Users, Search, Loader2, UserPlus, Trash2, FileSpreadsheet, Download,
  ListPlus, X, Eye, AlertTriangle, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { DateField } from "@/components/DateField";
import PesertaDetailModal from "./PesertaDetailModal";
import { formatTanggal, genderLabel, statusBadge } from "./adminUtils";

const inp = "w-full h-[46px] px-3.5 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A] bg-white";

export default function Peserta() {
  const [users, setUsers] = useState(null);
  const [kelompok, setKelompok] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [detailId, setDetailId] = useState(null);
  const [modal, setModal] = useState(null); // "add" | "bulk" | null
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const load = () =>
    api.get("/admin/users")
      .then(({ data }) => setUsers(data.filter((u) => u.roles?.includes("peserta"))))
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));

  useEffect(() => {
    load();
    api.get("/admin/kelompok").then(({ data }) => setKelompok(data)).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    const t = q.trim().toLowerCase();
    if (!t) return users;
    return users.filter((u) =>
      (u.name || "").toLowerCase().includes(t) ||
      (u.phone || "").toLowerCase().includes(t) ||
      (u.birthplace || "").toLowerCase().includes(t));
  }, [users, q]);

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

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/admin/import-template", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "template_peserta_ekertalangu.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error("Gagal mengunduh template"); }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/users/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const flag = data.flagged?.length ? `, ${data.flagged.length} nama kembar ditandai "perlu dilengkapi"` : "";
      const bad = data.invalid_dates?.length ? `, ${data.invalid_dates.length} tanggal tak terbaca` : "";
      toast.success(`${data.count} peserta diimpor${flag}${bad}.`);
      load();
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally {
      setImporting(false);
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
          <button data-testid="button-open-bulk" onClick={() => setModal("bulk")}
            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE]">
            <ListPlus size={16} /> Bulk Data
          </button>
          <label data-testid="button-import" className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE] cursor-pointer">
            {importing ? <Loader2 className="animate-spin" size={16} /> : <FileSpreadsheet size={16} />} Import Excel
            <input ref={fileRef} type="file" accept=".xlsx,.xlsm,.csv,.txt" className="hidden" onChange={handleImport} disabled={importing} data-testid="input-import" />
          </label>
          <button data-testid="button-template" onClick={downloadTemplate}
            className="inline-flex items-center gap-2 h-10 px-3 rounded-xl text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE]">
            <Download size={16} /> Template
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
                  <th className="px-4 py-3 font-semibold">Nama</th>
                  <th className="px-4 py-3 font-semibold hidden sm:table-cell">Jenis Kelamin</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Tempat Lahir</th>
                  <th className="px-4 py-3 font-semibold hidden md:table-cell">Tgl Lahir</th>
                  <th className="px-4 py-3 font-semibold hidden lg:table-cell">No HP</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filtered.map((u) => {
                  const b = statusBadge(u.status, u.needs_completion);
                  return (
                    <tr key={u.id} data-testid={`peserta-row-${u.id}`} className={selected.has(u.id) ? "bg-[#F0FAF4]" : ""}>
                      <td className="px-4 py-3">
                        <input type="checkbox" className="accent-[#0D5C3A] w-4 h-4" checked={selected.has(u.id)} onChange={() => toggleOne(u.id)} data-testid={`checkbox-${u.id}`} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#111827] flex items-center gap-1.5">
                          {u.name}
                          {u.needs_completion && <AlertTriangle size={14} className="text-[#D97706]" title="Perlu dilengkapi" />}
                        </div>
                        <div className="text-xs text-[#9CA3AF] sm:hidden">{genderLabel(u.gender)} · {u.phone || "-"}</div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-[#4B5563]">{genderLabel(u.gender)}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-[#4B5563]">{u.birthplace || "-"}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-[#4B5563]">{formatTanggal(u.dob)}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-[#4B5563]">{u.phone || "-"}</td>
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
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
      {modal === "add" && <AddModal kelompok={kelompok} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {modal === "bulk" && <BulkModal kelompok={kelompok} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
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
  const [f, setF] = useState({ name: "", gender: "", birthplace: "", dob: "", phone: "", whatsapp: "", email: "", address: "", kelompok_id: "" });
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

function normG(v) {
  const s = String(v || "").trim().toLowerCase();
  if (["l", "laki-laki", "laki", "pria", "male", "m", "lk"].includes(s)) return "L";
  if (["p", "perempuan", "wanita", "female", "f", "pr"].includes(s)) return "P";
  return "";
}

const emptyRow = () => ({ name: "", gender: "", birthplace: "", dob: "", phone: "" });

function BulkModal({ kelompok, onClose, onDone }) {
  const [rows, setRows] = useState(() => [emptyRow(), emptyRow(), emptyRow()]);
  const [kid, setKid] = useState("");
  const [saving, setSaving] = useState(false);

  const setCell = (i, key, val) => setRows((prev) => {
    const next = [...prev];
    next[i] = { ...next[i], [key]: val };
    return next;
  });
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i) => setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  // Tempel dari Excel/Sheets: parse tab/baris ke dalam grid mulai dari baris ini
  const handlePaste = (rowIndex) => (e) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n") && !text.includes("\t")) return; // tempel biasa 1 sel
    e.preventDefault();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const parsed = lines.map((line) => {
      const c = line.includes("\t") ? line.split("\t") : line.split(/[;,]/);
      return {
        name: (c[0] || "").trim(),
        gender: normG(c[1]),
        birthplace: (c[2] || "").trim(),
        dob: (c[3] || "").trim(),
        phone: (c[4] || "").trim(),
      };
    });
    setRows((prev) => {
      const next = [...prev];
      parsed.forEach((p, i) => { next[rowIndex + i] = p; });
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const entries = rows
      .map((r) => ({
        name: (r.name || "").trim(),
        gender: r.gender || null,
        birthplace: (r.birthplace || "").trim() || null,
        dob: (r.dob || "").trim() || null,
        phone: (r.phone || "").trim() || null,
      }))
      .filter((r) => r.name);
    if (entries.length === 0) { toast.error("Isi minimal satu baris (nama wajib)"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/admin/users/bulk", { entries, kelompok_id: kid || null });
      const flag = data.flagged?.length ? `, ${data.flagged.length} nama kembar ditandai` : "";
      const bad = data.invalid_dates?.length ? `, ${data.invalid_dates.length} tanggal tak terbaca` : "";
      toast.success(`${data.count} peserta ditambahkan${flag}${bad}.`);
      onDone();
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const cell = "h-10 px-2.5 rounded-lg border border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] bg-white w-full";

  return (
    <ModalShell title="Bulk Data Peserta" onClose={onClose} testid="modal-bulk" wide>
      <form onSubmit={submit}>
        <p className="text-sm text-[#6B7280] mb-3">
          Isi seperti tabel Excel. Anda juga bisa <span className="font-semibold">menyalin dari Excel/Spreadsheet</span> lalu tempel (Ctrl+V) di kolom Nama untuk mengisi banyak baris sekaligus. Hanya <span className="font-semibold">Nama</span> yang wajib.
        </p>

        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full border-separate border-spacing-y-1.5 min-w-[640px]">
            <thead>
              <tr className="text-left text-xs font-semibold text-[#6B7280]">
                <th className="w-6" />
                <th className="px-1 min-w-[150px]">Nama *</th>
                <th className="px-1 w-[120px]">Jenis Kelamin</th>
                <th className="px-1 min-w-[120px]">Tempat Lahir</th>
                <th className="px-1 w-[130px]">Tanggal Lahir</th>
                <th className="px-1 min-w-[120px]">No HP</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} data-testid={`bulk-row-${i}`}>
                  <td className="text-center text-xs text-[#9CA3AF] font-medium">{i + 1}</td>
                  <td className="px-1">
                    <input data-testid={`bulk-name-${i}`} className={cell} value={r.name}
                      onChange={(e) => setCell(i, "name", e.target.value)} onPaste={handlePaste(i)} placeholder="Nama lengkap" />
                  </td>
                  <td className="px-1">
                    <select data-testid={`bulk-gender-${i}`} className={cell} value={r.gender} onChange={(e) => setCell(i, "gender", e.target.value)}>
                      <option value="">-</option>
                      <option value="L">Laki-laki</option>
                      <option value="P">Perempuan</option>
                    </select>
                  </td>
                  <td className="px-1">
                    <input className={cell} value={r.birthplace} onChange={(e) => setCell(i, "birthplace", e.target.value)} placeholder="Kota" />
                  </td>
                  <td className="px-1">
                    <input data-testid={`bulk-dob-${i}`} className={cell} value={r.dob} onChange={(e) => setCell(i, "dob", e.target.value)} placeholder="DD-MM-YYYY" />
                  </td>
                  <td className="px-1">
                    <input className={cell} value={r.phone} onChange={(e) => setCell(i, "phone", e.target.value)} placeholder="08xxxx" />
                  </td>
                  <td className="text-center">
                    <button type="button" onClick={() => removeRow(i)} className="h-8 w-8 flex items-center justify-center rounded-lg text-[#DC2626] hover:bg-red-50"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button type="button" data-testid="button-add-row" onClick={addRow}
          className="mt-1 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border-2 border-dashed border-[#CBD5E1] text-[#4B5563] font-semibold text-sm hover:border-[#0D5C3A] hover:text-[#0D5C3A]">
          <Plus size={16} /> Tambah Baris
        </button>

        <select data-testid="bulk-kelompok" value={kid} onChange={(e) => setKid(e.target.value)} className={`${inp} mt-3`}>
          <option value="">- Tanpa Kelompok -</option>
          {kelompok.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <button data-testid="button-submit-bulk" type="submit" disabled={saving}
          className="mt-3 w-full h-12 rounded-xl bg-[#0D5C3A] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60">
          {saving ? <Loader2 className="animate-spin" size={18} /> : <ListPlus size={18} />} Simpan Semua
        </button>
      </form>
    </ModalShell>
  );
}
