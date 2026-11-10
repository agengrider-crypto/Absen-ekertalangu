// Banner pemeliharaan (Layar 32) — tampil di Beranda admin/pengurus.
// Terjadwal: biru. Berlangsung: kuning. Tanpa merah.
import { CalendarClock, Lock } from "lucide-react";
import { formatWita, jamWita } from "@/lib/maintenance";

export default function MaintenanceBanner({ state, startAt, endAt, onDetail }) {
  if (state !== "scheduled" && state !== "ongoing") return null;

  const scheduled = state === "scheduled";

  return (
    <div
      role="status"
      data-testid={`maintenance-banner-${state}`}
      className="mb-4 flex items-start gap-3 rounded-2xl p-3.5"
      style={
        scheduled
          ? { backgroundColor: "#E3EEFB", color: "#1D4F91" }
          : { backgroundColor: "#FBF1D6", color: "#6B4500", border: "1px solid #EAD596" }
      }
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {scheduled ? <CalendarClock size={24} strokeWidth={2} /> : <Lock size={24} strokeWidth={2} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold">
          {scheduled ? "Ada jadwal pemeliharaan 🗓️" : "Pemeliharaan sedang berlangsung 🛠️"}
        </div>
        <div className="mt-0.5 text-[13px] leading-relaxed">
          {scheduled
            ? `${formatWita(startAt)}, pukul ${jamWita(startAt)}-${jamWita(endAt)} WITA. Sebaiknya jangan menutup absen pada jam itu ya.`
            : endAt
              ? `Perkiraan selesai pukul ${jamWita(endAt)} WITA. Absen peserta ditutup sementara, dan tombol tambah atau ubah data dinonaktifkan.`
              : "Absen peserta ditutup sementara, dan tombol tambah atau ubah data dinonaktifkan. Data yang sudah ada tetap bisa dibaca."}
        </div>
        {onDetail && (
          <button
            type="button"
            onClick={onDetail}
            className="mt-1 inline-flex min-h-11 items-center text-[13px] font-bold underline underline-offset-4"
            style={{ color: scheduled ? "#1D4F91" : "#6B4500" }}
          >
            Lihat detail
          </button>
        )}
      </div>
    </div>
  );
}
