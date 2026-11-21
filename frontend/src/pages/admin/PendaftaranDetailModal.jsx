// Detail kegiatan pendaftaran: statistik, daftar peserta, salin link, ekspor,
// arsipkan, dan hapus permanen (khusus Administrator).
import { useState } from "react";
import {
  Loader2, Copy, FileSpreadsheet, FileText, Archive, Trash2, Users,
  CheckCircle2, XCircle, Clock, RefreshCw, AlertTriangle,
} from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalIndonesia } from "@/lib/wa";
import { PENDAFTARAN } from "@/constants/testIds";
import { useAuth } from "@/context/AuthContext";
import Modal from "@/components/Modal";
import { toast } from "sonner";
import { Statistik, AlasanRingkas, TabelPeserta, JenisBadge } from "./pendaftaranBagian";

const IKON = { Users, CheckCircle2, XCircle, Clock };

export default function PendaftaranDetailModal({
  data, sibuk, ekspor, onClose, onCopy, onExport, onStatus, onReload,
}) {
  const { user } = useAuth();
  const isAdmin = (user?.roles || []).includes("admin");
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false);
  const [menghapus, setMenghapus] = useState(false);
  const [membuatUlang, setMembuatUlang] = useState(false);

  const item = data?.item;
  const loading = data?.loading;

  const hapus = async () => {
    if (!item?.id) return;
    setMenghapus(true);
    try {
      await api.delete(`/staff/pendaftaran/${item.id}`);
      toast.success("Kegiatan pendaftaran dihapus permanen.");
      setKonfirmasiHapus(false);
      onClose?.();
      await onReload?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setMenghapus(false);
    }
  };

  const buatUlangTautan = async () => {
    if (!item?.id) return;
    setMembuatUlang(true);
    try {
      await api.post(`/staff/pendaftaran/${item.id}/tautan`);
      toast.success("Tautan publik dibuat ulang. Tautan lama tidak berlaku.");
      await onReload?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setMembuatUlang(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={item?.nama || "Detail Kegiatan"}
      subtitle={item
        ? `${tanggalIndonesia(item.tanggal)} · ${item.lokasi || "Lokasi belum diisi"}`
        : undefined}
      testid={PENDAFTARAN.detailModal}
      maxWidth={900}
      footer={item ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid={PENDAFTARAN.detailCopyLink}
              onClick={() => onCopy?.(item)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F]">
              <Copy size={16} /> Salin Link WhatsApp
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
                <RefreshCw size={16} /> Aktifkan lagi
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
          </div>
          <Statistik item={item} ikon={IKON} />

          <div className="rounded-xl bg-[#F6F4EE] px-3 py-2.5">
            <p className="text-xs font-semibold text-[#5F6B63]">Link publik</p>
            <p className="mt-0.5 break-all text-sm text-[#14201A]">{item.link || "-"}</p>
            <button type="button" data-testid={PENDAFTARAN.detailRegenerate}
              onClick={buatUlangTautan} disabled={membuatUlang}
              className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E7E3D8] bg-white px-2.5 text-xs font-semibold text-[#0E4E31] disabled:opacity-60">
              {membuatUlang
                ? <Loader2 size={13} className="animate-spin motion-reduce:animate-none" />
                : <RefreshCw size={13} />}
              Buat ulang tautan
            </button>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#5F6B63]">
              Alasan tidak hadir
            </p>
            <AlasanRingkas ringkas={item.alasan_ringkas} />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#5F6B63]">
              Daftar peserta ({item.peserta?.length || 0})
            </p>
            <TabelPeserta rows={item.peserta} denganKeterangan />
          </div>

          {konfirmasiHapus && (
            <div className="rounded-xl border border-[#A32A2A] bg-[#FBE5E3] p-3">
              <p className="flex items-start gap-1.5 text-sm font-semibold text-[#A32A2A]">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                Hapus permanen kegiatan ini beserta seluruh konfirmasi peserta?
                Tindakan ini tidak bisa dibatalkan.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" data-testid={PENDAFTARAN.detailDeleteConfirm}
                  onClick={hapus} disabled={menghapus}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#A32A2A] px-3 text-sm font-semibold text-white disabled:opacity-60">
                  {menghapus && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />}
                  Ya, hapus permanen
                </button>
                <button type="button" onClick={() => setKonfirmasiHapus(false)}
                  className="min-h-10 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A]">
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
