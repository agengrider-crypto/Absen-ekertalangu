import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, User as UserIcon, RefreshCw, LogOut, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProfileModal from "@/components/ProfileModal";
import ActionModal from "@/components/ActionModal";

/**
 * Menu akun di kanan atas.
 * Memakai ACTION MODAL (bukan dropdown) supaya daftar aksi tidak pernah
 * terpotong / muncul ke atas layar pada perangkat kecil.
 */
export default function ProfileMenu({ subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [photo, setPhoto] = useState(null);

  const initials = (user?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const multiRole = (user?.roles || []).length > 1;
  const incomplete = (user?.missing_fields || []).length > 0;

  useEffect(() => {
    let active = true;
    if (user?.has_photo) {
      api.get("/me/photo").then(({ data }) => { if (active) setPhoto(data.photo || null); }).catch(() => {});
    } else {
      setPhoto(null);
    }
    return () => { active = false; };
  }, [user?.has_photo]);

  const Avatar = ({ size = 40 }) => (
    <div
      className="rounded-full overflow-hidden bg-[#0D5C3A] text-white flex items-center justify-center font-bold shrink-0 border-2 border-white shadow-sm"
      style={{ height: size, width: size, fontSize: size * 0.34 }}
    >
      {photo ? <img src={photo} alt="Foto profil" className="h-full w-full object-cover" /> : initials}
    </div>
  );

  return (
    <>
      <button
        data-testid="button-profile-menu"
        onClick={() => setOpenMenu(true)}
        className="relative flex items-center gap-2.5 rounded-full pl-1 pr-2 py-1 hover:bg-[#F2F5F2] transition-colors"
      >
        <div className="text-right hidden sm:block leading-tight">
          <div className="font-semibold text-[#111827] text-sm">{user?.name}</div>
          {subtitle && <div className="text-xs text-[#6B7280]">{subtitle}</div>}
        </div>
        <Avatar size={40} />
        {incomplete && (
          <span data-testid="profile-incomplete-dot" className="absolute -top-0.5 right-6 h-3 w-3 rounded-full bg-[#D97706] ring-2 ring-white" />
        )}
        <ChevronDown size={16} className="text-[#6B7280]" />
      </button>

      {openMenu && (
        <ActionModal
          testid="profile-action-modal"
          title={user?.name || "Akun Saya"}
          subtitle={(user?.roles || []).join(" · ")}
          onClose={() => setOpenMenu(false)}
          actions={[
            {
              key: "profil",
              testid: "menu-profile",
              label: "Profil Saya",
              desc: incomplete ? `Perlu dilengkapi: ${(user.missing_fields || []).join(", ")}` : "Lihat & ubah data diri, foto profil",
              icon: incomplete ? AlertCircle : UserIcon,
              onClick: () => setShowProfile(true),
            },
            multiRole && {
              key: "ganti-peran",
              testid: "menu-switch-role",
              label: "Ganti Peran",
              desc: "Pindah ke area peran lain",
              icon: RefreshCw,
              onClick: () => navigate("/roles"),
            },
            {
              key: "keluar",
              testid: "menu-logout",
              label: "Keluar",
              desc: "Akhiri sesi akun ini",
              icon: LogOut,
              danger: true,
              onClick: async () => { await logout(); navigate("/login"); },
            },
          ]}
        >
          <div className="px-3.5 py-3 mb-1 flex items-center gap-3.5 rounded-2xl bg-[#FAFBF9] border border-[#F1F2F0]">
            <Avatar size={52} />
            <div className="min-w-0">
              <div className="font-bold text-[#111827] text-sm truncate">{user?.name}</div>
              <div className="text-xs text-[#6B7280] truncate">{user?.username || user?.phone}</div>
            </div>
          </div>
        </ActionModal>
      )}

      {showProfile && (
        <ProfileModal photo={photo} onPhotoChange={setPhoto} onClose={() => setShowProfile(false)} />
      )}
    </>
  );
}
