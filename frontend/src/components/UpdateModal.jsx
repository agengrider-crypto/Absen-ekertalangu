// Popup "Update Terbaru": menampilkan daftar perubahan aplikasi beserta tanggal,
// bisa diklik untuk menuju halaman terkait, dan punya tombol "Coba Sekarang".
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, ChevronRight, CalendarDays, CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "ekertalangu.updateSeen";

// Daftar update terbaru. Tambahkan entri baru di paling atas setiap rilis.
export const UPDATES = [
  {
    id: "2026-11-08-tentang",
    date: "2026-11-08",
    title: "Tentang Aplikasi & Tour Panduan",
    items: [
      "Menu Tentang Aplikasi di Profil: versi, build, pengembang, dan hak cipta.",
      "Admin & Pengurus mendapat Riwayat Update di halaman Tentang Aplikasi.",
      "Tour panduan menandai bagian yang baru diperbarui, bisa diulang kapan saja.",
    ],
    action: { label: "Coba Sekarang", nav: "peserta" },
  },
  {
    id: "2026-11-08-user-redesign",
    date: "2026-11-08",
    title: "Halaman User lebih rapi",
    items: [
      "Daftar user kini berupa kartu ringkas — cukup nama, kontak, peran, dan status.",
      "Seluruh baris bisa diketuk untuk membuka detail, bukan hanya nama atau foto.",
      "Detail user dibagi menjadi tab Profil, Kehadiran, QR, dan Riwayat.",
      "Semua aksi (ubah data, pindah sambung, reset sandi, nonaktifkan) ada di tombol ⋯.",
    ],
    action: { label: "Coba Sekarang", nav: "peserta" },
  },
  {
    id: "2026-11-07-absensi",
    date: "2026-11-07",
    title: "Absensi lebih cepat & lengkap",
    items: [
      "Tombol Hadir Semua untuk menandai seluruh peserta sekaligus.",
      "Tutup Absen di Kode Akses — peserta yang belum diabsen otomatis Alpha.",
      "Izin/Sakit kini meminta alasan dan keterangan (opsional).",
      "Posisi tombol H/I/S/A dirapikan rata kanan agar mudah dibaca.",
    ],
    action: { label: "Coba Sekarang", nav: "kegiatan" },
  },
  {
    id: "2026-11-07-form",
    date: "2026-11-07",
    title: "Form & data peserta",
    items: [
      "Jenis kegiatan dipilih horizontal, bukan dropdown lagi.",
      "Status akun peserta: Aktif, Nonaktif, atau Pindah.",
      "Rekap Bulanan punya tombol sembunyikan peserta tidak aktif.",
    ],
    action: { label: "Buka Rekap", nav: "rekap-bulanan" },
  },
];

function fmtDate(iso) {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

/** True bila ada update yang belum pernah dibuka pengguna. */
export function hasUnreadUpdate() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== (UPDATES[0]?.id || "");
  } catch { return false; }
}

/** Tandai semua update sudah dibaca (dipakai saat modal dibuka manual). */
export function markUpdatesRead() {
  try { localStorage.setItem(STORAGE_KEY, UPDATES[0]?.id || ""); } catch { /* abaikan */ }
}

export default function UpdateModal({ onNavigate, forceOpen = false, onClose }) {
  const [open, setOpen] = useState(forceOpen);
  const [active, setActive] = useState(UPDATES[0]?.id || null);

  useEffect(() => {
    if (forceOpen) { setOpen(true); return; }
    let seen = null;
    try { seen = localStorage.getItem(STORAGE_KEY); } catch { /* abaikan */ }
    const latest = UPDATES[0]?.id;
    if (latest && seen !== latest) setOpen(true);
  }, [forceOpen]);

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, UPDATES[0]?.id || ""); } catch { /* abaikan */ }
    onClose?.();
  };

  const go = (nav) => {
    close();
    onNavigate?.(nav);
  };

  if (!open) return null;

  const current = UPDATES.find((u) => u.id === active) || UPDATES[0];

  const content = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={close} />
      <div
        className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh] overflow-hidden"
        data-testid="update-modal"
      >
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-[#ECECE8] bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="h-10 w-10 shrink-0 rounded-xl bg-[#111114] text-white flex items-center justify-center">
              <Sparkles size={19} />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-[#111827] text-lg leading-tight">Update Terbaru</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">Perbaikan & fitur baru aplikasi</p>
            </div>
          </div>
          <button
            data-testid="update-modal-close"
            onClick={close}
            aria-label="Tutup"
            className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F4F4F1]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4 space-y-2">
          {UPDATES.map((u) => {
            const isActive = u.id === current?.id;
            return (
              <div key={u.id} className="rounded-2xl border border-[#E8E8E4] overflow-hidden">
                <button
                  type="button"
                  data-testid={`update-item-${u.id}`}
                  onClick={() => setActive(u.id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-2 transition-colors ${
                    isActive ? "bg-[#FAFAF8]" : "bg-white hover:bg-[#FAFAF8]"
                  }`}
                >
                  <CalendarDays size={15} className="shrink-0 text-[#9CA3AF]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[#111827] truncate">{u.title}</div>
                    <div className="text-[11px] text-[#9CA3AF]">{fmtDate(u.date)}</div>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`shrink-0 text-[#9CA3AF] transition-transform ${isActive ? "rotate-90" : ""}`}
                  />
                </button>
                {isActive && (
                  <ul className="px-4 pb-3 pt-1 space-y-1.5 bg-[#FAFAF8]">
                    {u.items.map((it, i) => (
                      <li key={i} className="flex gap-2 text-[13px] text-[#4B5563] leading-snug">
                        <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-[#15803D]" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-[#ECECE8] grid grid-cols-2 gap-2 bg-white">
          <button
            onClick={close}
            className="h-11 rounded-xl border-2 border-[#E8E8E4] font-semibold text-[#4B5563] hover:border-[#111114]"
          >
            Nanti
          </button>
          <button
            data-testid="update-modal-try"
            onClick={() => go(current?.action?.nav)}
            className="h-11 rounded-xl bg-[#111114] text-white font-semibold hover:bg-black"
          >
            {current?.action?.label || "Coba Sekarang"}
          </button>
        </div>
      </div>
    </div>
  );

  // Portal ke <body> agar tidak terpotong oleh ancestor ber-overflow (AdminLayout).
  if (typeof document === "undefined" || !document.body) return content;
  return createPortal(content, document.body);
}
