// FASE 15 — Halaman "Bulk Data": entri banyak peserta sekaligus (manual / tempel dari Excel).
import { useRef, useState } from "react";
import { ListPlus, Loader2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

const cell = "h-10 px-2.5 rounded-lg border border-[#E8E8E4] text-sm outline-none focus:border-[#111114] bg-white w-full";
const inp = "w-full h-[46px] px-3.5 rounded-xl border-2 border-[#E8E8E4] text-base outline-none focus:border-[#111114] bg-white";

function normG(v) {
  const s = String(v || "").trim().toLowerCase();
  if (["l", "laki-laki", "laki", "pria", "male", "m", "lk"].includes(s)) return "L";
  if (["p", "perempuan", "wanita", "female", "f", "pr"].includes(s)) return "P";
  return "";
}

const emptyRow = () => ({ name: "", gender: "", birthplace: "", dob: "", phone: "" });

export default function PesertaBulkView() {
  const [rows, setRows] = useState(() => [emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow()]);
  const [kelompok, setKelompok] = useState([]);
  const [kid, setKid] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const loaded = useRef(false);

  if (!loaded.current) {
    loaded.current = true;
    api.get("/admin/kelompok").then(({ data }) => setKelompok(data)).catch(() => {});
  }

  const setCell = (i, key, val) => setRows((prev) => {
    const next = [...prev];
    next[i] = { ...next[i], [key]: val };
    return next;
  });
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (i) => setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const handlePaste = (rowIndex) => (e) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n") && !text.includes("\t")) return;
    e.preventDefault();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const parsed = lines.map((line) => {
      const c = line.includes("\t") ? line.split("\t") : line.split(/[;,]/);
      return {
        name: (c[0] || "").trim(), gender: normG(c[1]),
        birthplace: (c[2] || "").trim(), dob: (c[3] || "").trim(), phone: (c[4] || "").trim(),
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
        name: (r.name || "").trim(), gender: r.gender || null,
        birthplace: (r.birthplace || "").trim() || null,
        dob: (r.dob || "").trim() || null, phone: (r.phone || "").trim() || null,
      }))
      .filter((r) => r.name);
    if (entries.length === 0) { toast.error("Isi minimal satu baris (nama wajib)"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/admin/users/bulk", { entries, kelompok_id: kid || null });
      toast.success(`${data.count} peserta ditambahkan.`);
      setLastResult(data);
      setRows([emptyRow(), emptyRow(), emptyRow(), emptyRow(), emptyRow()]);
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#111827] flex items-center gap-2">
            <ListPlus size={22} className="text-[#111114]" /> Bulk Data Peserta
          </h1>
          <p className="text-[#6B7280] text-sm mt-1">
            Isi seperti tabel Excel, atau salin dari Excel/Spreadsheet lalu tempel (Ctrl+V) di kolom <b>Nama</b>.
            Hanya nama yang wajib.
          </p>
        </div>
      </div>

      {lastResult && (
        <div className="mb-4 rounded-2xl border border-[#E8E8E4] bg-[#FAFAF8] p-4 text-sm text-[#111114]" data-testid="bulk-result">
          <b>{lastResult.count}</b> peserta tersimpan.
          {lastResult.flagged?.length ? ` ${lastResult.flagged.length} nama kembar ditandai "perlu dilengkapi".` : ""}
          {lastResult.invalid_dates?.length ? ` ${lastResult.invalid_dates.length} tanggal tidak terbaca.` : ""}
        </div>
      )}

      <form onSubmit={submit} className="bg-white rounded-2xl border border-[#E8E8E4] p-4">
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
          className="mt-1 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border-2 border-dashed border-[#CBD5E1] text-[#4B5563] font-semibold text-sm hover:border-[#111114] hover:text-[#111114]">
          <Plus size={16} /> Tambah Baris
        </button>

        <select data-testid="bulk-kelompok" value={kid} onChange={(e) => setKid(e.target.value)} className={`${inp} mt-3`}>
          <option value="">- Tanpa Kelompok -</option>
          {kelompok.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
        </select>
        <button data-testid="button-submit-bulk" type="submit" disabled={saving}
          className="mt-3 w-full h-12 rounded-xl bg-[#111114] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#000000] disabled:opacity-60">
          {saving ? <Loader2 className="animate-spin" size={18} /> : <ListPlus size={18} />} Simpan Semua
        </button>
      </form>
    </div>
  );
}
