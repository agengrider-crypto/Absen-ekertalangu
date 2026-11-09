import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, BellRing, CalendarDays, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { RELEASE_NOTES } from "@/constants/testIds";

const RELEASE_VERSION = "2026-11-06";
const RELEASE_DATE = "6 November 2026";
const RELEASE_ITEMS = [
  {
    id: "absen-status",
    title: "Tombol status absensi lebih rapi",
    description: "Pilihan Hadir, Izin, Sakit, dan Alpha sekarang rata kanan dan lebih mudah ditekan.",
    roles: ["pengurus", "admin"],
  },
  {
    id: "close-attendance",
    title: "Tutup absen dan tandai Alpha otomatis",
    description: "Tutup absensi dari Kode Akses; peserta wajib yang belum tercatat otomatis menjadi Alpha.",
    roles: ["pengurus", "admin"],
  },
  {
    id: "bulk-present",
    title: "Hadirkan semua peserta",
    description: "Pengurus dapat mencatat Hadir untuk semua peserta wajib dalam satu tindakan.",
    roles: ["pengurus", "admin"],
  },
  {
    id: "absence-report",
    title: "Laporkan tidak bisa hadir",
    description: "Peserta dapat mengirim alasan dan keterangan tambahan yang opsional.",
    roles: ["peserta"],
  },
  {
    id: "activity-type",
    title: "Jenis kegiatan lebih mudah dipilih",
    description: "Pilihan jenis kegiatan kini tampil mendatar dan menyesuaikan lebar layar.",
    roles: ["pengurus", "admin"],
  },
  {
    id: "hide-participant",
    title: "Atur tampilan peserta rekap",
    description: "Sembunyikan nama dari daftar Rekap Bulanan selama tiga bulan tanpa mengubah hitungan.",
    roles: ["pengurus", "admin"],
  },
];

export function ReleaseNotesModal({ user, onClose, onAction }) {
  const navigate = useNavigate();

  const openItem = (item) => {
    const roles = user?.roles || [];
    const role = item.roles.find((candidate) => roles.includes(candidate)) || roles[0];
    onAction?.();
    onClose();
    navigate(role ? `/area/${role}` : "/roles");
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      data-testid={RELEASE_NOTES.modal}>
      <div className="w-full max-w-xl rounded-t-3xl bg-[#FAFAF8] shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4 rounded-t-3xl border-b border-[#E8E8E4] bg-white px-5 py-4 sm:rounded-t-3xl">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-bold text-[#0D5C3A]">
              <BellRing size={17} /> Pembaruan Terbaru
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#6B7280]">
              <CalendarDays size={14} /> {RELEASE_DATE}
            </div>
          </div>
          <button type="button" data-testid={RELEASE_NOTES.close} onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F4F4F1]"
            aria-label="Tutup pembaruan">
            <X size={20} />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4 sm:p-5">
          {RELEASE_ITEMS.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[#E8E8E4] bg-white p-4">
              <h3 className="font-bold text-[#111827]">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-[#4B5563]">{item.description}</p>
              <button type="button" data-testid={`${RELEASE_NOTES.actionPrefix}-${item.id}`}
                onClick={() => openItem(item)}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0D5C3A] px-4 font-bold text-white hover:bg-[#09482D]">
                Coba Sekarang <ArrowRight size={17} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ReleaseNotice() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const storageKey = `${RELEASE_NOTES.storagePrefix}-${user?.id || "pengguna"}`;

  useEffect(() => {
    if (!user || localStorage.getItem(storageKey) === RELEASE_VERSION) return;
    setOpen(true);
  }, [storageKey, user]);

  const close = () => {
    localStorage.setItem(storageKey, RELEASE_VERSION);
    setOpen(false);
  };

  if (!open || !user) return null;
  return <ReleaseNotesModal user={user} onClose={close} onAction={close} />;
}
