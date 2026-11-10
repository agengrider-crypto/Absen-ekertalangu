// Sheet Ganti Peran (Layar 31) — pindah area tanpa keluar akun.
// Warna per area HANYA dipakai di sheet ini (lihat src/lib/theme.js → AREA).
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Shield, Users, UserCheck, X, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { setActiveRole } from "@/lib/roles";
import { AREA } from "@/lib/theme";

const META = {
  admin: { icon: Shield, label: "Area Administrator", desc: "Kelola peserta, kegiatan & laporan" },
  pengurus: { icon: Users, label: "Area Pengurus", desc: "Presensi, musyawarah & rekap" },
  peserta: { icon: UserCheck, label: "Area Peserta", desc: "QR pribadi, absen & curhat" },
};

export default function RoleSwitcher({ current, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const roles = (user?.roles || []).filter((r) => META[r]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-in fade-in duration-150"
        style={{ backgroundColor: "rgba(20,32,26,0.5)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-switcher-title"
        data-testid="role-switcher-modal"
        className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-md sm:rounded-[28px]"
      >
        {/* Pegangan sheet */}
        <div className="flex justify-center pb-1 pt-2.5">
          <div className="h-[5px] w-10 rounded-[3px]" style={{ backgroundColor: "#D9D4C5" }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b px-4 pb-3 pt-2" style={{ borderColor: "#E7E3D8" }}>
          <div className="min-w-0">
            <h2 id="role-switcher-title" className="font-heading text-[20px] font-bold leading-tight text-[#14201A]">
              Ganti Peran
            </h2>
            <p className="mt-0.5 text-[13px] text-[#5F6B63]">Langsung pindah area tanpa keluar akun</p>
          </div>
          <button
            type="button"
            data-testid="role-switcher-modal-close"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#5F6B63] hover:bg-[#F0EEE6]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Daftar area */}
        <div className="flex flex-col gap-2.5 overflow-y-auto px-4 pb-2 pt-3">
          {roles.map((r) => {
            const meta = META[r];
            const Icon = meta.icon;
            const area = AREA[r];
            const active = r === current;
            return (
              <button
                key={r}
                type="button"
                data-testid={`switch-role-${r}`}
                aria-current={active ? "true" : undefined}
                onClick={() => {
                  if (active) return;
                  setActiveRole(r);
                  navigate(`/area/${r}`);
                }}
                className="flex w-full items-center gap-3 rounded-[18px] p-2.5 text-left transition-colors"
                style={{
                  minHeight: 72,
                  backgroundColor: active ? area.aktif : "#FFFFFF",
                  border: active ? `2px solid ${area.utama}` : "1px solid #E7E3D8",
                }}
              >
                <span
                  className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl"
                  style={{
                    backgroundColor: active ? area.utama : area.muda,
                    color: active ? "#FFFFFF" : area.utama,
                  }}
                  aria-hidden="true"
                >
                  <Icon size={24} strokeWidth={2} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-bold text-[#14201A]">{meta.label}</span>
                  <span className="mt-0.5 block text-[12.5px] text-[#5F6B63]">{meta.desc}</span>
                </span>

                {active && (
                  <span className="flex shrink-0 flex-col items-center gap-0.5">
                    <CheckCircle2 size={20} style={{ color: area.teks }} aria-hidden="true" />
                    <span className="text-[11px] font-bold" style={{ color: area.teks }}>
                      Sedang aktif
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tutup */}
        <div className="px-4 pb-[18px] pt-2">
          <button
            type="button"
            data-testid="role-switcher-modal-cancel"
            onClick={onClose}
            className="h-[52px] w-full rounded-[18px] bg-[#F0EEE6] text-[16px] font-bold text-[#14201A] hover:bg-[#E7E3D8]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
