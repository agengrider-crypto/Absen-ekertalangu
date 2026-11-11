// Sheet Ganti Peran (Layar 31) — pindah area tanpa keluar akun.
// Warna per area HANYA dipakai di sheet ini (lihat src/lib/theme.js → AREA).
import { useNavigate } from "react-router-dom";
import { Shield, Users, UserCheck, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { setActiveRole } from "@/lib/roles";
import { AREA } from "@/lib/theme";
import Modal from "@/components/Modal";

const META = {
  admin: { icon: Shield, label: "Area Administrator", desc: "Kelola peserta, kegiatan & laporan" },
  pengurus: { icon: Users, label: "Area Pengurus", desc: "Presensi, musyawarah & rekap" },
  peserta: { icon: UserCheck, label: "Area Peserta", desc: "QR pribadi, absen & curhat" },
};

export default function RoleSwitcher({ current, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const roles = (user?.roles || []).filter((r) => META[r]);

  return (
    <Modal
      onClose={onClose}
      title="Ganti Peran"
      subtitle="Langsung pindah area tanpa keluar akun"
      testid="role-switcher-modal"
      maxWidth={560}
      bodyClassName="px-4 pb-2 pt-3"
      footer={(
        <button
          type="button"
          data-testid="role-switcher-modal-cancel"
          onClick={onClose}
          className="h-[52px] w-full rounded-[18px] bg-[#F0EEE6] text-[16px] font-bold text-[#14201A] hover:bg-[#E7E3D8]"
        >
          Tutup
        </button>
      )}
    >
      <div className="flex flex-col gap-2.5">
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
                    Aktif
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
