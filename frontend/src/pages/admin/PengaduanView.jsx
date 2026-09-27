import { useEffect, useState } from "react";
import { MessageSquareHeart, Loader2, Search, CheckCheck, UserRound, Clock } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

const CAT_CLS = {
  curhat: "bg-[#EEF2FF] text-[#3730A3]",
  saran: "bg-[#E8F5EE] text-[#065F46]",
  pengaduan: "bg-[#FEE2E2] text-[#991B1B]",
};

function waktu(iso) {
  if (!iso) return "-";
  return String(iso).slice(0, 16).replace("T", " ") + " WITA";
}

export default function PengaduanView() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");

  const load = () =>
    api.get("/staff/pengaduan")
      .then(({ data: d }) => setData(d))
      .catch((e) => { setData(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });

  useEffect(() => { load(); }, []);

  const tandaiBaca = async (id) => {
    try {
      await api.post(`/staff/pengaduan/${id}/baca`);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const rows = (data?.rows || []).filter((r) => {
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return (r.message || "").toLowerCase().includes(t) || (r.name || "").toLowerCase().includes(t);
  });

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-[#111827] flex items-center gap-2">
        <MessageSquareHeart size={22} className="text-[#0D5C3A]" /> Pengaduan &amp; Curhat Jamaah
      </h1>
      <p className="text-[#6B7280] text-sm mt-1">
        Pesan yang dikirim jamaah dari akunnya. Mohon disikapi dengan lembut dan dijaga kerahasiaannya.
      </p>

      {data && data !== false && (
        <div className="grid grid-cols-2 gap-3 my-4">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4" data-testid="pengaduan-total">
            <div className="text-2xl font-bold text-[#0D5C3A]">{data.total}</div>
            <div className="text-xs text-[#6B7280] mt-1">Total pesan masuk</div>
          </div>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4" data-testid="pengaduan-belum">
            <div className="text-2xl font-bold text-[#B45309]">{data.belum_dibaca}</div>
            <div className="text-xs text-[#6B7280] mt-1">Belum dibaca</div>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          data-testid="pengaduan-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari isi pesan atau nama jamaah…"
          className="w-full h-11 pl-11 pr-4 rounded-xl border-2 border-[#E5E7EB] text-base outline-none focus:border-[#0D5C3A] bg-white"
        />
      </div>

      {data === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={30} /></div>
      ) : data === false ? (
        <div className="p-10 text-center text-[#6B7280]">Gagal memuat pesan.</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center text-[#6B7280]" data-testid="pengaduan-empty">
          Belum ada pesan dari jamaah.
        </div>
      ) : (
        <div className="space-y-3" data-testid="pengaduan-list">
          {rows.map((r) => (
            <div key={r.id} className={`bg-white rounded-2xl border p-4 ${r.dibaca ? "border-[#E5E7EB]" : "border-[#FCD34D]"}`} data-testid={`pengaduan-card-${r.id}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_CLS[r.category] || CAT_CLS.curhat}`}>{r.category_label}</span>
                {!r.dibaca && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">Baru</span>}
                <span className="text-xs text-[#9CA3AF] inline-flex items-center gap-1"><Clock size={12} /> {waktu(r.at)}</span>
              </div>
              <div className="mt-2 font-semibold text-[#111827] inline-flex items-center gap-1.5">
                <UserRound size={15} className="text-[#0D5C3A]" /> {r.name}
                {r.phone && <span className="text-xs font-normal text-[#6B7280]">· {r.phone}</span>}
              </div>
              <p className="text-sm text-[#374151] mt-1.5 whitespace-pre-wrap leading-relaxed">{r.message}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                {r.dibaca ? (
                  <span className="text-xs text-[#065F46] font-semibold inline-flex items-center gap-1.5">
                    <CheckCheck size={14} /> Sudah dibaca{r.dibaca_oleh ? ` oleh ${r.dibaca_oleh}` : ""}
                  </span>
                ) : (
                  <button data-testid={`pengaduan-baca-${r.id}`} onClick={() => tandaiBaca(r.id)}
                    className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-[#0D5C3A] text-white font-semibold text-sm hover:bg-[#094229]">
                    <CheckCheck size={15} /> Tandai Sudah Dibaca
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
