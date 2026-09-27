import { useNavigate } from "react-router-dom";
import { Shield, Users, UserCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ActionModal from "@/components/ActionModal";

const META = {
  admin: { icon: Shield, label: "Area Admin", desc: "Kelola jamaah, kegiatan & laporan" },
  pengurus: { icon: Users, label: "Area Pengurus", desc: "Presensi, musyawarah & rekap" },
  peserta: { icon: UserCheck, label: "Area Jamaah", desc: "QR pribadi, absen & curhat" },
};

/** Pindah peran TANPA keluar akun — langsung berganti area. */
export default function RoleSwitcher({ current, onClose }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const roles = (user?.roles || []).filter((r) => META[r]);

  return (
    <ActionModal
      testid="role-switcher-modal"
      title="Ganti Peran"
      subtitle="Langsung pindah area tanpa keluar akun"
      onClose={onClose}
      actions={roles.map((r) => ({
        key: r,
        testid: `switch-role-${r}`,
        label: META[r].label,
        desc: r === current ? "Sedang dibuka" : META[r].desc,
        icon: META[r].icon,
        disabled: r === current,
        onClick: () => navigate(`/area/${r}`),
      }))}
    />
  );
}
