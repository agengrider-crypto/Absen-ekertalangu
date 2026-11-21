// Detail satu kegiatan pendaftaran: angka, chip alasan, filter, daftar peserta.
// Link publik & buat ulang tautan ada di menu titik tiga.
import { useMemo, useState } from "react";
import {
  Loader2, Copy, FileSpreadsheet, FileText, Archive, Trash2, RefreshCw,
  MoreVertical, CalendarClock, Link2, MapPin, CalendarDays,
  Users, CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalIndonesia } from "@/lib/wa";
import { PENDAFTARAN } from "@/constants/testIds";
import { useAuth } from "@/context/AuthContext";
import Modal from "@/components/Modal";
import {
  Statistik, AlasanRingkas, TabelPeserta, JenisBadge, StatusBadge,
  JadwalBadge, TombolMaps,
} from "./pendaftaranBagian";

const IKON = { Users, CheckCircle2, XCircle };

export default function PendaftaranDetailModal({
  data, sibuk, ekspor, onClose, onCopy, onExport, onStatus, onReload, onUbahJadwal,
}) {
  const { user } = useAuth();
  const isAdmin = (user?.roles || []).includes("admin");
  const loading = data?.loading;
  const item = data?.item;
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  const [konfirmasiTautan, setKonfirmasiTautan] = useState(false);
  const [menu, setMenu] = useState(false);
  const [membuatUlang, setMembuatUlang] = useState(false);
  const [filter, setFilter] = useState("semua");

  const peserta = useMemo(() => item?.peserta || [], [item]);
  const tampil = useMemo(() => {
    if (filter === "ikut") return peserta.filter((p) => p.kehadiran === "hadir");
    if (filter === "tidak") return peserta.filter((p) => p.kehadiran === "tidak_hadir");
    return peserta;
  }, [peserta, filter]);

  const buatUlangTautan = async () => {
    setMembuatUlang(true);
    try {
      await api.post(`/staff/pendaftaran/${item.id}/tautan`);
      toast.success("Tautan baru dibuat. Tautan lama tidak berlaku lagi.");
      setKonfirmasiTautan(false);
      setMenu(false);
      await onReload?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setMembuatUlang(false);
    }
  };

  const hapus = async () => {
    try {
      await api.delete(`/staff/pendaftaran/${item.id}`);
      toast.success("Kegiatan dihapus permanen.");
      setKonfirmasiHapus(false);
      onClose?.();
      await onReload?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item?.nama || "Detail Kegiatan"}
      subtitle={item ? tanggalIndonesia(item.tanggal) : undefined}
      testid={PENDAFTARAN.detailModal}
      maxWidth={720}
      footer={item ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid={PENDAFTARAN.detailCopyLink}
              onClick={() => onCopy?.(item)} disabled={!item.link}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-50">
              <Copy size={16} /> Salin link
            </button>
            <button type="button" data-testid={PENDAFTARAN.detailExportExcel}
              onClick={() => onExport?.(item, "excel")} disabled={ekspor === `${item.id}-excel`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F] disabled:opacity-60">
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button type="button" data-testid={PENDAFTARAN.detailExportPdf}
              onClick={() => onExport?.(item, "pdf")} disabled={ekspor === `${item.id}-pdf`}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F] disabled:opacity-60">
              <FileText size={16} /> PDF
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {item.status_tampil !== "arsip" ? (
              <button type="button" data-testid={PENDAFTARAN.detailArchive}
                onClick={() => onStatus?.(item, "arsip")} disabled={sibuk}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F] disabled:opacity-60">
                <Archive size={16} /> Arsipkan
              </button>
            ) : (
              <button type="button" onClick={() => onStatus?.(item, "aktif")} disabled={sibuk}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#14633F] bg-white px-3 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA] disabled:opacity-60">
                <RefreshCw size={16} /> Pulihkan
              </button>
            )}
            {isAdmin && (
              <button type="button" data-testid={PENDAFTARAN.detailDelete}
                onClick={() => setKonfirmasiHapus(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#A32A2A] bg-white px-3 text-sm font-semibold text-[#A32A2A] hover:bg-[#FBE5E3]">
                <Trash2 size={16} /> Hapus permanen
              </button>
            )}
          </div>
        </div>
      ) : null}
    >
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-[#0E4E31] motion-reduce:animate-none" size={28} />
        </div>
      ) : !item ? (
        <p className="p-6 text-center text-sm text-[#5F6B63]">Data tidak ditemukan.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <JenisBadge wajib={item.wajib_konfirmasi} />
            <StatusBadge status={item.status_tampil} />
            <JadwalBadge status={item.jadwal_status} />
            <div className="relative ml-auto">
              <button type="button" onClick={() => setMenu((v) => !v)}
                aria-label="Aksi lainnya"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E7E3D8] bg-white text-[#14201A] hover:border-[#14633F]">
                <MoreVertical size={16} />
              </button>
              {menu && (
                <div className="absolute right-0 z-20 mt-1 w-60 rounded-xl border border-[#E7E3D8] bg-white p-1 shadow-lg">
                  <button type="button" onClick={() => { onCopy?.(item); setMenu(false); }}
                    disabled={!item.link}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#14201A] hover:bg-[#F6F4EE] disabled:opacity-50">
                    <Copy size={15} /> Salin link
                  </button>
                  <button type="button" onClick={() => { setMenu(false); onUbahJadwal?.(item); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#14201A] hover:bg-[#F6F4EE]">
                    <CalendarClock size={15} /> Ubah jadwal pendaftaran
                  </button>
                  <button type="button" onClick={() => { setMenu(false); setKonfirmasiTautan(true); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#14201A] hover:bg-[#F6F4EE]">
                    <Link2 size={15} /> Buat ulang tautan
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1 rounded-xl bg-[#F6F4EE] px-3 py-2.5 text-sm text-[#5F6B63]">
            <p className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} /> {tanggalIndonesia(item.tanggal)}
            </p>
            {item.lokasi && (
              <p className="inline-flex flex-wrap items-center gap-1.5">
                <MapPin size={14} /> {item.lokasi}
                <TombolMaps item={item} />
              </p>
            )}
            <p className="text-xs">
              Pendaftaran: {item.pendaftaran_buka ? tanggalIndonesia(item.pendaftaran_buka) : "langsung dibuka"}
              {" — "}
              {item.pendaftaran_tutup ? tanggalIndonesia(item.pendaftaran_tutup) : "-"}
            </p>
          </div>

          <Statistik item={item} ikon={IKON} wajib={item.wajib_konfirmasi !== false} />

          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#5F6B63]">
              Alasan tidak ikut
            </p>
            <AlasanRingkas ringkas={item.alasan_ringkas} />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { key: "semua", label: `Semua ${peserta.length}` },
              { key: "ikut", label: `Ikut ${item.ikut}` },
              { key: "tidak", label: `Tidak ikut ${item.tidak_ikut}` },
            ].map((f) => (
              <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${
                  filter === f.key
                    ? "border-[#14633F] bg-[#E3F3EA] text-[#0E4E31]"
                    : "border-[#E7E3D8] bg-white text-[#5F6B63]"
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          <TabelPeserta rows={tampil} denganKeterangan />
        </div>
      )}

      {konfirmasiHapus && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4">
            <p className="text-base font-semibold text-[#14201A]">Hapus permanen kegiatan?</p>
            <p className="mt-1 text-sm text-[#5F6B63]">
              Jawaban peserta ikut terhapus dan tidak bisa dikembalikan.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setKonfirmasiHapus(false)}
                className="min-h-11 rounded-xl border border-[#E7E3D8] bg-white px-4 text-sm font-semibold text-[#14201A]">
                Batal
              </button>
              <button type="button" data-testid={PENDAFTARAN.detailDeleteConfirm}
                onClick={hapus}
                className="min-h-11 rounded-xl bg-[#A32A2A] px-4 text-sm font-semibold text-white">
                Ya
              </button>
            </div>
          </div>
        </div>
      )}

      {konfirmasiTautan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4">
            <p className="text-base font-semibold text-[#14201A]">Buat ulang tautan?</p>
            <p className="mt-1 text-sm text-[#5F6B63]">Tautan lama tidak berlaku lagi.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setKonfirmasiTautan(false)}
                className="min-h-11 rounded-xl border border-[#E7E3D8] bg-white px-4 text-sm font-semibold text-[#14201A]">
                Batal
              </button>
              <button type="button" onClick={buatUlangTautan} disabled={membuatUlang}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white disabled:opacity-60">
                {membuatUlang && <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />}
                Ya
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
