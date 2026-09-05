import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus, Loader2, Trash2, Send, Download, Check, FileText, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

const CATS = [
  { key: "4S", label: "4S" },
  { key: "tim7", label: "Tim 7" },
];

function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function catLabel(c) {
  return c === "4S" ? "Musyawarah 4S" : "Musyawarah Tim 7";
}

export default function MusyawarahView() {
  const [cat, setCat] = useState("4S");
  const [items, setItems] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [content, setContent] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const [exFrom, setExFrom] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-01`; });
  const [exTo, setExTo] = useState(todayYmd());
  const timer = useRef(null);

  const load = useCallback(async (selectFirst = true) => {
    try {
      const { data } = await api.get(`/staff/musyawarah?category=${cat}`);
      setItems(data);
      if (selectFirst) {
        if (data.length) selectItem(data[0]);
        else { setActiveId(null); setContent(""); setDate(todayYmd()); }
      }
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    // eslint-disable-next-line
  }, [cat]);

  useEffect(() => { setItems(null); load(true); /* eslint-disable-next-line */ }, [cat]);

  const selectItem = (m) => {
    setActiveId(m.id);
    setContent(m.content || "");
    setDate(m.date || todayYmd());
    setSaveState("idle");
  };

  const addNew = async () => {
    try {
      const { data } = await api.post("/staff/musyawarah", { category: cat, content: "", date: todayYmd() });
      await load(false);
      selectItem(data);
      setItems((prev) => (prev ? [data, ...prev.filter((x) => x.id !== data.id)] : [data]));
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const autosave = (nextContent, nextDate) => {
    if (!activeId) return;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await api.patch(`/staff/musyawarah/${activeId}`, { content: nextContent, date: nextDate });
        setSaveState("saved");
        setItems((prev) => prev?.map((x) => (x.id === activeId ? { ...x, content: nextContent, date: nextDate } : x)));
      } catch (e) { setSaveState("idle"); toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    }, 700);
  };

  const onContent = (v) => { setContent(v); autosave(v, date); };
  const onDate = (v) => { setDate(v); autosave(content, v); };

  const del = async (id) => {
    if (!window.confirm("Hapus catatan ini?")) return;
    try {
      await api.delete(`/staff/musyawarah/${id}`);
      toast.success("Catatan dihapus");
      if (id === activeId) { setActiveId(null); setContent(""); }
      load(true);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const shareWa = () => {
    const text = `*${catLabel(cat)}* (${date})\n\n${content || "(kosong)"}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const downloadPdf = async () => {
    if (!activeId) return;
    try {
      const res = await api.get(`/staff/musyawarah/${activeId}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `musyawarah_${cat}_${date}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { toast.error("Gagal mengunduh PDF"); }
  };

  const exportPeriod = async () => {
    try {
      const res = await api.get(`/staff/musyawarah-export-pdf?category=${cat}&date_from=${exFrom}&date_to=${exTo}`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `rekap_musyawarah_${cat}_${exFrom}_${exTo}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Rekap PDF diunduh");
    } catch (e) { toast.error("Gagal mengekspor rekap"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#111827]">Musyawarah</h1>
          <p className="text-[#6B7280] text-sm">Catatan musyawarah — tersimpan otomatis saat mengetik.</p>
        </div>
        <button data-testid="button-add-musyawarah" onClick={addNew} className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm hover:bg-[#094229]"><Plus size={18} /> Catatan Baru</button>
      </div>

      {/* Tabs */}
      <div className="inline-flex bg-[#EAF3EE] rounded-xl p-1 mb-5">
        {CATS.map((c) => (
          <button
            key={c.key}
            data-testid={`tab-musy-${c.key}`}
            onClick={() => setCat(c.key)}
            className={`px-5 h-10 rounded-lg text-sm font-semibold transition-colors ${cat === c.key ? "bg-white text-[#0D5C3A] shadow-sm" : "text-[#4B5563]"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Export periode gabungan */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-3 mb-5 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-semibold text-[#6B7280] mb-1">Ekspor rekap dari</label>
          <input data-testid="musy-export-from" type="date" value={exFrom} onChange={(e) => setExFrom(e.target.value)} className="h-10 px-3 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A]" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#6B7280] mb-1">sampai</label>
          <input data-testid="musy-export-to" type="date" value={exTo} onChange={(e) => setExTo(e.target.value)} className="h-10 px-3 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A]" />
        </div>
        <button data-testid="musy-export-period" onClick={exportPeriod} className="h-10 px-4 rounded-xl border border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE] inline-flex items-center gap-2"><Download size={16} /> Ekspor PDF ({cat === "4S" ? "4S" : "Tim 7"})</button>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        {/* Riwayat list */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-2 max-h-[70vh] overflow-y-auto" data-testid="musy-list">
          {items === null ? (
            <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={24} /></div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-[#6B7280] text-sm">Belum ada catatan.</div>
          ) : (
            items.map((m) => (
              <button
                key={m.id}
                data-testid={`musy-item-${m.id}`}
                onClick={() => selectItem(m)}
                className={`w-full text-left px-3 py-3 rounded-xl mb-1 ${activeId === m.id ? "bg-[#E8F5EE]" : "hover:bg-[#F9FAFB]"}`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]"><Calendar size={14} className="text-[#0D5C3A]" /> {m.date}</div>
                <div className="text-xs text-[#6B7280] mt-1 line-clamp-2">{m.content || "(kosong)"}</div>
              </button>
            ))
          )}
        </div>

        {/* Editor */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
          {!activeId ? (
            <div className="h-64 flex flex-col items-center justify-center text-[#9CA3AF]">
              <FileText size={40} />
              <p className="mt-3 text-sm">Pilih catatan atau buat catatan baru.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-[#374151]">Tanggal</label>
                  <input data-testid="musy-date" type="date" value={date} onChange={(e) => onDate(e.target.value)} className="h-10 px-3 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A]" />
                </div>
                <div className="text-xs font-medium" data-testid="musy-save-state">
                  {saveState === "saving" && <span className="text-[#9CA3AF] inline-flex items-center gap-1"><Loader2 size={13} className="animate-spin" /> Menyimpan…</span>}
                  {saveState === "saved" && <span className="text-[#0D5C3A] inline-flex items-center gap-1"><Check size={14} /> Tersimpan otomatis</span>}
                </div>
              </div>
              <textarea
                data-testid="musy-content"
                value={content}
                onChange={(e) => onContent(e.target.value)}
                rows={14}
                placeholder="Tulis isi catatan musyawarah di sini…"
                className="w-full px-4 py-3 rounded-xl border-2 border-[#E5E7EB] text-sm leading-6 outline-none focus:border-[#0D5C3A] resize-none"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button data-testid="musy-share-wa" onClick={shareWa} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm hover:bg-[#094229]"><Send size={16} /> Share WA</button>
                <button data-testid="musy-download-pdf" onClick={downloadPdf} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE]"><Download size={16} /> Download PDF</button>
                <button data-testid="musy-delete" onClick={() => del(activeId)} className="ml-auto inline-flex items-center gap-2 h-10 px-3 rounded-xl text-[#DC2626] font-semibold text-sm hover:bg-red-50"><Trash2 size={16} /> Hapus</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
