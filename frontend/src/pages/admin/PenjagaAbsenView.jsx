import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, CalendarDays, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { TYPE_LABEL, TYPE_COLOR, tanggalSingkat } from "./kegiatanUtils";
import { DelegasiModal } from "./KegiatanExtras";

function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export default function PenjagaAbsenView() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [items, setItems] = useState(null);
  const [active, setActive] = useState(null); // kegiatan for DelegasiModal

  const load = () => {
    setItems(null);
    api.get(`/admin/kegiatan?month=${month}`)
      .then(({ data }) => setItems(data || []))
      .catch((e) => { setItems([]); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);

  const shift = (d) => {
    const [y, m] = month.split("-").map(Number);
    const nd = new Date(y, m - 1 + d, 1);
    setMonth(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`);
  };
  const monthLabel = new Date(month + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const today = todayYmd();

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-heading text-2xl font-bold text-[#111827] flex items-center gap-2"><ShieldCheck size={22} className="text-[#0D5C3A]" /> Penjaga Absen</h1>
        <p className="text-[#6B7280] text-sm">Serahkan hak pengisian absen ke orang terpilih saat Anda tidak di lokasi. Hak otomatis dicabut saat kegiatan ditutup.</p>
      </div>

      <div className="flex items-center justify-between bg-white rounded-xl border border-[#E5E7EB] p-2 mb-4 max-w-xs">
        <button onClick={() => shift(-1)} className="h-9 px-3 rounded-lg text-[#4B5563] hover:bg-[#F3F4F6] font-semibold">‹</button>
        <span className="text-sm font-semibold text-[#111827]">{monthLabel}</span>
        <button onClick={() => shift(1)} className="h-9 px-3 rounded-lg text-[#4B5563] hover:bg-[#F3F4F6] font-semibold">›</button>
      </div>

      {items === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={30} /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center text-[#6B7280] text-sm">Tidak ada kegiatan bulan ini.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((k) => {
            const open = (k.status || "open") === "open";
            return (
              <div key={k.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-4" data-testid={`penjaga-keg-${k.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[k.type]}1a`, color: TYPE_COLOR[k.type] }}>{TYPE_LABEL[k.type]}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${open ? "bg-[#E8F5EE] text-[#065F46]" : "bg-[#F3F4F6] text-[#6B7280]"}`}>{open ? "Aktif" : "Ditutup"}</span>
                </div>
                <h3 className="font-heading font-bold text-[#111827] mt-1.5">{k.name}</h3>
                <div className="text-sm text-[#6B7280] mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {tanggalSingkat(k.date)}</span>
                  <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {k.start_time}–{k.end_time} WITA</span>
                </div>
                <button
                  data-testid={`penjaga-manage-${k.id}`}
                  onClick={() => setActive(k)}
                  className="mt-3 w-full h-10 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#094229]"
                >
                  <Users size={16} /> Kelola Delegasi
                </button>
              </div>
            );
          })}
        </div>
      )}

      {active && <DelegasiModal kegiatan={active} onClose={() => setActive(null)} />}
    </div>
  );
}
