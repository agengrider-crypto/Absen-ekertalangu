// FASE 16 — Panel "Ruang Teduh": admin & pengurus membaca pesan jamaah, menandai dibaca, atau menghapus riwayat.
import { useEffect, useState } from "react";
import { HeartHandshake, Loader2, Search, CheckCheck, UserRound, Clock, Trash2, Eraser } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

const CAT_CLS = {
  curhat: "bg-[#EEEFFB] text-[#312E81]",
  saran: "bg-[#EEF6F0] text-[#166534]",
  pengaduan: "bg-[#FEE2E2] text-[#991B1B]",
  doa: "bg-[#FDF4FF] text-[#86198F]",
  kendala: "bg-[#FEF3C7] text-[#92400E]",
  pertanyaan: "bg-[#E0F2FE] text-[#075985]",
};

function waktu(iso) {
  if (!iso) return "-";
  return String(iso).slice(0, 16).replace("T", " ") + " WITA";
}

export default function RuangTeduhView() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");

  const load = () =>
    api.get("/staff/pengaduan")
      .then(({ data: d }) => setData(d))
      .catch((e) => { setData(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });

  useEffect(() => { load(); }, []);

  const tandaiBaca = async (id) => {
    try { await api.post(`/staff/pengaduan/${id}/baca`); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const hapus = async (id) => {
    if (!window.confirm("Hapus pesan ini? Tindakan ini tidak bisa dibatalkan.")) return;
    try { await api.delete(`/staff/pengaduan/${id}`); toast.success("Pesan dihapus"); load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const hapusSemua = async () => {
    if (!window.confirm("Hapus SELURUH riwayat Ruang Teduh? Tindakan ini tidak bisa dibatalkan.")) return;
    try {
      const { data: d } = await api.delete("/staff/pengaduan");
      toast.success(`${d.deleted} pesan dihapus`);
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#111114] flex items-center gap-2">
            <HeartHandshake size={22} className="text-[#3730A3]" /> Ruang Teduh
          </h1>
          <p className="text-[#6B7280] text-sm mt-1">
            Pesan jamaah: curhat, saran, pengaduan, permohonan doa, kendala hadir, dan pertanyaan.
            Mohon disikapi dengan lembut dan dijaga kerahasiaannya.
          </p>
        </div>
        {rows.length > 0 && (
          <button data-testid="ruangteduh-hapus-semua" onClick={hapusSemua}
            className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border border-[#E8E8E4] text-[#DC2626] font-semibold text-sm hover:bg-red-50">
            <Eraser size={16} /> Hapus semua riwayat
          </button>
        )}
      </div>

      {data && data !== false && (
        <div className="grid grid-cols-2 gap-4 my-6">
          <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5" data-testid="ruangteduh-total">
            <div className="text-[28px] font-semibold text-[#111114] leading-none">{data.total}</div>
            <div className="text-[11px] uppercase tracking-wider text-[#9CA3AF] mt-2">Total pesan masuk</div>
          </div>
          <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5" data-testid="ruangteduh-belum">
            <div className="text-[28px] font-semibold text-[#3730A3] leading-none">{data.belum_dibaca}</div>
            <div className="text-[11px] uppercase tracking-wider text-[#9CA3AF] mt-2">Belum dibaca</div>
          </div>
        </div>
      )}

      <div className="relative mb-5">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          data-testid="ruangteduh-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari isi pesan atau nama jamaah…"
          className="w-full h-11 pl-11 pr-4 rounded-xl border border-[#E8E8E4] text-base outline-none focus:border-[#3730A3] bg-white"
        />
      </div>

      {data === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#3730A3]" size={30} /></div>
      ) : data === false ? (
        <div className="p-10 text-center text-[#6B7280]">Gagal memuat pesan.</div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-10 text-center text-[#6B7280]" data-testid="ruangteduh-empty">
          Belum ada pesan dari jamaah.
        </div>
      ) : (
        <div className="space-y-3" data-testid="ruangteduh-list">
          {rows.map((r) => (
            <div key={r.id} className={`bg-white rounded-2xl border p-5 ${r.dibaca ? "border-[#E8E8E4]" : "border-[#C9C9EE]"}`} data-testid={`ruangteduh-card-${r.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CAT_CLS[r.category] || CAT_CLS.curhat}`}>{r.category_label}</span>
                  {!r.dibaca && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#EEEFFB] text-[#312E81]">Baru</span>}
                  <span className="text-xs text-[#9CA3AF] inline-flex items-center gap-1"><Clock size={12} /> {waktu(r.at)}</span>
                </div>
                <button data-testid={`ruangteduh-hapus-${r.id}`} onClick={() => hapus(r.id)}
                  className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg text-[#DC2626] hover:bg-red-50" title="Hapus pesan ini">
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-2.5 font-semibold text-[#111114] inline-flex items-center gap-1.5">
                <UserRound size={15} className="text-[#3730A3]" /> {r.name}
                {r.phone && <span className="text-xs font-normal text-[#6B7280]">· {r.phone}</span>}
              </div>
              <p className="text-sm text-[#374151] mt-1.5 whitespace-pre-wrap leading-relaxed">{r.message}</p>
              <div className="mt-4">
                {r.dibaca ? (
                  <span className="text-xs text-[#312E81] font-semibold inline-flex items-center gap-1.5">
                    <CheckCheck size={14} /> Sudah dibaca{r.dibaca_oleh ? ` oleh ${r.dibaca_oleh}` : ""}
                  </span>
                ) : (
                  <button data-testid={`ruangteduh-baca-${r.id}`} onClick={() => tandaiBaca(r.id)}
                    className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl bg-[#3730A3] text-white font-semibold text-sm hover:bg-[#2A2480]">
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
