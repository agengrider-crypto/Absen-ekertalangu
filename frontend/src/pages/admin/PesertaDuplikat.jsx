// FASE 15 — Halaman "Cek Duplikat": kelompokkan jamaah bernama sama agar data ganda mudah dirapikan.
import { useEffect, useState } from "react";
import { CopyCheck, Loader2, Eye, Trash2, CalendarDays, Phone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import PesertaDetailModal from "./PesertaDetailModal";
import { formatTanggal, genderLabel, statusBadge } from "./adminUtils";

export default function PesertaDuplikat() {
  const [data, setData] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [kelompok, setKelompok] = useState([]);

  const load = () =>
    api.get("/admin/users/duplikat")
      .then(({ data: d }) => setData(d))
      .catch((e) => { setData(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });

  useEffect(() => {
    load();
    api.get("/admin/kelompok").then(({ data: d }) => setKelompok(d)).catch(() => {});
  }, []);

  const hapus = async (row) => {
    if (!window.confirm(`Hapus data "${row.name}" (${row.phone || "tanpa No. HP"})? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await api.delete(`/admin/users/${row.id}`);
      toast.success("Data ganda dihapus");
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#111827] flex items-center gap-2">
            <CopyCheck size={22} className="text-[#111114]" /> Cek Duplikat
          </h1>
          <p className="text-[#6B7280] text-sm mt-1">
            Jamaah dengan nama sama akan dikelompokkan di sini. Periksa tanggal lahir &amp; No. HP sebelum menghapus.
          </p>
        </div>
        <button data-testid="duplikat-refresh" onClick={() => { setData(null); load(); }}
          className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border-2 border-[#111114] text-[#111114] font-semibold text-sm hover:bg-[#F1F1EE]">
          <RefreshCw size={16} /> Periksa Ulang
        </button>
      </div>

      {data === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={30} /></div>
      ) : data === false ? (
        <div className="p-10 text-center text-[#6B7280]">Gagal memuat data.</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 my-4">
            {[
              { label: "Total jamaah", value: data.total_peserta, color: "#111114" },
              { label: "Nama kembar", value: data.total_grup, color: "#9CA3AF" },
              { label: "Data terlibat", value: data.total_duplikat, color: "#DC2626" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-[#E8E8E4] p-4" data-testid={`duplikat-stat-${s.label}`}>
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-[#6B7280] mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {data.groups.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[#E8E8E4] p-10 text-center" data-testid="duplikat-empty">
              <CopyCheck size={30} className="mx-auto text-[#111114] mb-2" />
              <p className="text-[#111114] font-semibold">Alhamdulillah, tidak ada nama jamaah yang kembar.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.groups.map((g) => (
                <div key={g.name} className="bg-white rounded-2xl border border-[#E8E8E4] overflow-hidden" data-testid={`duplikat-group-${g.name}`}>
                  <div className="px-5 py-3 border-b border-[#E8E8E4] flex items-center justify-between gap-3 bg-[#FFFBEB]">
                    <div className="font-heading font-bold text-[#92400E]">{g.name}</div>
                    <div className="flex items-center gap-2">
                      {g.same_dob && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B]">Tanggal lahir sama</span>}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">{g.count} data</span>
                    </div>
                  </div>
                  <ul className="divide-y divide-[#ECECE8]">
                    {g.rows.map((r) => {
                      const b = statusBadge(r.status, r.needs_completion);
                      const kel = kelompok.find((k) => k.id === r.kelompok_id);
                      return (
                        <li key={r.id} data-testid={`duplikat-row-${r.id}`} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                          <div className="min-w-0 text-sm">
                            <div className="font-semibold text-[#111827]">{r.name} <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span></div>
                            <div className="text-[#6B7280] mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                              <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {formatTanggal(r.dob) || "tgl lahir kosong"}</span>
                              <span className="inline-flex items-center gap-1"><Phone size={12} /> {r.phone || "-"}</span>
                              <span>{genderLabel(r.gender)}</span>
                              {kel && <span>{kel.name}</span>}
                              {r.pernah_login && <span className="text-[#111114] font-semibold">pernah login</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button data-testid={`duplikat-detail-${r.id}`} onClick={() => setDetailId(r.id)}
                              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#E8E8E4] text-[#111114] font-semibold text-sm hover:border-[#111114] hover:bg-[#F1F1EE]">
                              <Eye size={15} /> Detail
                            </button>
                            <button data-testid={`duplikat-hapus-${r.id}`} onClick={() => hapus(r)}
                              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[#FCA5A5] text-[#DC2626] font-semibold text-sm hover:bg-red-50">
                              <Trash2 size={15} /> Hapus
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {detailId && (
        <PesertaDetailModal
          userId={detailId}
          kelompokList={kelompok}
          canManageRoles={false}
          onClose={() => setDetailId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
