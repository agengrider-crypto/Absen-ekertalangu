// Daftar kegiatan lama untuk "Absen sebelumnya".
// Setiap baris: "Isi absen" (buka absensi menyusul) dan "Salin" (form Tambah Kegiatan terisi).
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, ChevronRight, History, Copy } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import Modal from "@/components/Modal";
import { KEGIATAN_TYPES, nowWita, tanggalSingkat } from "./kegiatanUtils";

const PAGE = 10;

/** Kegiatan yang sudah lewat (tanggal < hari ini, atau sudah ditutup). */
function sudahLewat(k, today) {
  if (!k?.date) return false;
  if (k.date < today) return true;
  return (k.status || "open") !== "open";
}

export default function AbsenSebelumnyaModal({ items, onClose, onSalin, onBuatBaru }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState(null);

  const today = useMemo(() => nowWita().date, []);

  const daftar = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items || [])
      .filter((k) => k && k.id && sudahLewat(k, today))
      .filter((k) => !t || (k.name || "").toLowerCase().includes(t))
      .sort((a, b) => `${b.date || ""}${b.start_time || ""}`.localeCompare(`${a.date || ""}${a.start_time || ""}`));
  }, [items, q, today]);

  const tampil = daftar.slice(0, limit);

  const isiAbsen = async (k) => {
    if (!k.akses_token) {
      toast.error("Kegiatan ini belum punya tautan absensi.");
      return;
    }
    setBusy(k.id);
    try {
      // Kegiatan yang sudah ditutup dibuka kembali agar absen susulan bisa diisi.
      if ((k.status || "open") !== "open") {
        await api.post(`/admin/kegiatan/${k.id}/reopen`);
      }
      try {
        const { data: v } = await api.post(`/absensi/${k.akses_token}/verify`, {
          code: k.access_code,
        });
        sessionStorage.setItem(`absensi_access_${k.akses_token}`, v.access);
      } catch { /* biarkan pengguna memasukkan kode manual */ }
      onClose?.();
      navigate(`/absensi/${k.akses_token}`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Absen sebelumnya"
      subtitle="Pilih kegiatan lama untuk mengisi absen menyusul atau menyalin isinya."
      testid="modal-absen-sebelumnya"
      maxWidth={520}
    >
      <div className="space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
          <input data-testid="absen-sebelumnya-search" value={q}
            onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }}
            placeholder="Cari kegiatan"
            className="h-11 w-full rounded-xl border border-[#8A948D] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#14633F]" />
        </div>

        {tampil.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-[#5F6B63]">
            Belum ada kegiatan lama yang cocok.
          </p>
        ) : (
          <div className="divide-y divide-[#F0EEE6] overflow-hidden rounded-xl border border-[#E7E3D8]">
            {tampil.map((k) => (
              <div key={k.id} data-testid={`absen-sebelumnya-row-${k.id}`} className="px-3 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[#14201A]">{k.name}</div>
                  <div className="mt-0.5 text-[11px] text-[#5F6B63]">
                    {tanggalSingkat(k.date)} · {KEGIATAN_TYPES.find((x) => x.value === k.type)?.label || k.type || "-"}
                    {" · "}{k.counts?.hadir || 0} hadir
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" data-testid={`absen-sebelumnya-isi-${k.id}`}
                    onClick={() => isiAbsen(k)} disabled={busy === k.id}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#14633F] px-2.5 text-xs font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60">
                    {busy === k.id ? <Loader2 size={13} className="animate-spin motion-reduce:animate-none" /> : <History size={13} />}
                    Isi absen
                  </button>
                  <button type="button" data-testid={`absen-sebelumnya-salin-${k.id}`}
                    onClick={() => onSalin?.(k)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E7E3D8] px-2.5 text-xs font-semibold text-[#0E4E31] hover:border-[#14633F]">
                    <Copy size={13} /> Salin
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {daftar.length > tampil.length && (
          <button type="button" data-testid="absen-sebelumnya-muat-lagi"
            onClick={() => setLimit((n) => n + PAGE)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-[#E7E3D8] text-sm font-semibold text-[#0E4E31] hover:border-[#14633F]">
            Muat lagi
          </button>
        )}

        <button type="button" data-testid="absen-sebelumnya-buat-baru"
          onClick={() => onBuatBaru?.()}
          className="inline-flex min-h-11 w-full items-center justify-center gap-1 text-xs font-semibold text-[#0E4E31] underline">
          Kegiatan belum ada di daftar? Buat baru <ChevronRight size={14} />
        </button>
      </div>
    </Modal>
  );
}
