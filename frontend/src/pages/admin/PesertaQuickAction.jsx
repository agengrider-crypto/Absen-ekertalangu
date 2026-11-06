// Modal aksi cepat peserta: profil ringkas + total persen kehadiran + daftar aksi.
// Dibuka sekali klik dari daftar User, tanpa harus masuk ke halaman detail penuh.
import { useCallback, useEffect, useState } from "react";
import {
  Loader2, User as UserIcon, Pencil, ArrowRightLeft, QrCode, Trash2,
  Power, TrendingUp, CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import ActionModal from "@/components/ActionModal";

function initialsOf(name) {
  return (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function PesertaQuickAction({
  userId, onClose, onOpenDetail, onChanged, canManage = true,
}) {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null); // "delete" | "deactivate"

  const load = useCallback(() => {
    api.get(`/admin/users/${userId}`)
      .then(({ data: d }) => setData(d))
      .catch(() => toast.error("Gagal memuat data peserta"));
    api.get(`/admin/laporan/peserta/${userId}`)
      .then(({ data: d }) => setStats(d?.six_months?.summary || null))
      .catch(() => setStats({ ratio: null, hadir: 0, total_pertemuan: 0 }));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const doDelete = async () => {
    setBusy("delete");
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success("Peserta dihapus.");
      onChanged?.();
      onClose?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(""); setConfirm(null); }
  };

  const doDeactivate = async () => {
    setBusy("status");
    try {
      await api.patch(`/admin/users/${userId}`, { status: "nonaktif" });
      toast.success("Akun peserta dinonaktifkan.");
      onChanged?.();
      onClose?.();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(""); setConfirm(null); }
  };

  const ratio = stats?.ratio;
  const ratioColor = ratio == null ? "#6B7280" : ratio >= 80 ? "#15803D" : ratio >= 50 ? "#B45309" : "#DC2626";

  return (
    <>
      {!confirm && (
        <ActionModal
          testid="peserta-quick-action"
          title={data?.name || "Memuat…"}
          subtitle={data ? `${data.roles?.includes("peserta") ? "Peserta" : data.roles?.join(", ")} · ${data.status === "active" ? "Aktif" : data.status === "nonaktif" ? "Nonaktif" : data.status === "pindah" ? "Pindah" : "Menunggu aktivasi"}` : ""}
          onClose={onClose}
          actions={[
            canManage && {
              key: "ubah", testid: "quick-edit", label: "Ubah Data",
              desc: "Nama, kontak, kelompok, foto", icon: Pencil,
              onClick: () => onOpenDetail?.(userId),
            },
            canManage && {
              key: "pindah", testid: "quick-move", label: "Pindah Sambung",
              desc: "Pindahkan ke kelompok lain", icon: ArrowRightLeft,
              onClick: () => onOpenDetail?.(userId),
            },
            {
              key: "qr", testid: "quick-qr", label: "QR Barcode Peserta",
              desc: "Lihat & cetak QR permanen", icon: QrCode,
              onClick: () => onOpenDetail?.(userId),
            },
            canManage && {
              key: "nonaktif", testid: "quick-deactivate", label: "Nonaktifkan Sementara",
              desc: "Akun tidak bisa login, data tetap tersimpan", icon: Power,
              onClick: () => { setConfirm("deactivate"); return false; },
            },
            canManage && {
              key: "hapus", testid: "quick-delete", label: "Hapus Data",
              desc: "Hapus permanen beserta riwayat absensi", icon: Trash2,
              danger: true,
              onClick: () => { setConfirm("delete"); return false; },
            },
          ]}
        >
        {/* Profil + statistik */}
        <div className="px-3.5 py-3 mb-1 rounded-2xl bg-[#FAFAF8] border border-[#ECECE8]">
          <div className="flex items-center gap-3.5">
            <div className="h-14 w-14 shrink-0 rounded-2xl bg-[#111114] text-white flex items-center justify-center font-bold text-lg">
              {initialsOf(data?.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[#111827] text-sm truncate">{data?.name || "—"}</div>
              <div className="text-xs text-[#6B7280] truncate">
                {data?.phone || data?.email || data?.username || "—"}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white border border-[#E8E8E4] p-2.5 text-center">
              <div className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide">Total</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: ratioColor }}>
                {stats === null ? "…" : ratio == null ? "—" : `${ratio}%`}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-[#E8E8E4] p-2.5 text-center">
              <div className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide">Hadir</div>
              <div className="text-lg font-bold tabular-nums text-[#15803D]">
                {stats === null ? "…" : stats.hadir ?? 0}
              </div>
            </div>
            <div className="rounded-xl bg-white border border-[#E8E8E4] p-2.5 text-center">
              <div className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide">Kegiatan</div>
              <div className="text-lg font-bold tabular-nums text-[#111827]">
                {stats === null ? "…" : stats.total_pertemuan ?? 0}
              </div>
            </div>
          </div>
        </div>
      </ActionModal>
      )}

      {confirm === "delete" && (
        <ActionModal
          testid="confirm-delete-peserta"
          title="Hapus peserta ini?"
          subtitle={data?.name}
          onClose={() => setConfirm(null)}
          actions={[{
            key: "yes", testid: "confirm-delete-yes",
            label: busy === "delete" ? "Menghapus…" : "Ya, Hapus",
            desc: "Semua riwayat absensi ikut terhapus permanen.",
            icon: Trash2, danger: true, disabled: busy === "delete",
            onClick: doDelete,
          }]}
        >
          <p className="px-3 py-2 text-sm text-[#4B5563]">
            Peserta ini akan dihapus dari semua kegiatan. Riwayat kehadiran,
            QR barcode, dan datanya hilang permanen dan tidak bisa dikembalikan.
          </p>
        </ActionModal>
      )}

      {confirm === "deactivate" && (
        <ActionModal
          testid="confirm-deactivate-peserta"
          title="Nonaktifkan akun?"
          subtitle={data?.name}
          onClose={() => setConfirm(null)}
          actions={[{
            key: "yes", testid: "confirm-deactivate-yes",
            label: busy === "status" ? "Memproses…" : "Ya, Nonaktifkan",
            desc: "Bisa diaktifkan kembali kapan saja.",
            icon: Power, disabled: busy === "status",
            onClick: doDeactivate,
          }]}
        >
          <p className="px-3 py-2 text-sm text-[#4B5563]">
            Akun peserta tidak bisa login sementara. Peserta <b>tetap muncul</b> di
            daftar kegiatan dan rekap — data serta riwayat absensi tidak dihapus.
          </p>
        </ActionModal>
      )}
    </>
  );
}
