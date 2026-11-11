import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, User as UserIcon, LogOut, AlertCircle, Sparkles, Info, ArrowLeftRight } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProfileModal from "@/components/ProfileModal";
import ActionModal from "@/components/ActionModal";
import RoleSwitcher from "@/components/RoleSwitcher";
import UpdateModal, { hasUnreadUpdate } from "@/components/UpdateModal";
import AboutApp, { hasUnseenTour } from "@/components/AboutApp";
import GuidedTour from "@/components/GuidedTour";
import { roleLabel, getActiveRole } from "@/lib/roles";

/**
 * Menu akun di kanan atas.
 * Memakai ACTION MODAL (bukan dropdown) supaya daftar aksi tidak pernah
 * terpotong / muncul ke atas layar pada perangkat kecil.
 *
 * Label peran aktif tampil di samping nama dan menjadi pemicu "Ganti Peran".
 */
export default function ProfileMenu({ role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [unreadUpdate, setUnreadUpdate] = useState(() => hasUnreadUpdate());
  const [photo, setPhoto] = useState(null);

  const initials = (user?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const roles = user?.roles || [];
  const multiRole = roles.length > 1;
  const activeRole = getActiveRole(roles) || role || roles[0];
  const activeRoleLabel = roleLabel(activeRole);
  const incomplete = (user?.missing_fields || []).length > 0;
  const isStaff = roles.some((r) => r === "admin" || r === "pengurus");
  // Nama akun yang sama persis dengan nama peran tidak perlu diulang.
  const showName = Boolean(user?.name) && user.name.trim().toLowerCase() !== activeRoleLabel.toLowerCase();

  // Guided tour hanya muncul SEKALI (khusus admin & pengurus). Update berikutnya
  // tidak memunculkan tour lagi — cukup pop-up Update Terbaru.
  useEffect(() => {
    if (!isStaff || !hasUnseenTour()) return;
    const t = setTimeout(() => setTourOpen(true), 900);
    return () => clearTimeout(t);
  }, [isStaff]);

  useEffect(() => {
    let active = true;
    if (user?.has_photo) {
      api.get("/me/photo").then(({ data }) => { if (active) setPhoto(data.photo || null); }).catch(() => {});
    } else {
      setPhoto(null);
    }
    return () => { active = false; };
  }, [user?.has_photo]);

  const roleBadge = multiRole ? (
    <button
      type="button"
      data-testid="button-switch-role"
      onClick={() => setShowSwitcher(true)}
      aria-label={`Peran aktif ${activeRoleLabel}. Ganti peran`}
      title="Ganti peran"
      className="inline-flex min-h-11 items-center gap-1 rounded-full bg-[#E3F3EA] px-2.5 py-0.5 text-[11px] font-semibold text-[#0E4E31] transition-colors hover:bg-[#D3EBDD] sm:min-h-6 sm:px-2"
    >
      {activeRoleLabel}
      <ArrowLeftRight size={11} aria-hidden="true" />
    </button>
  ) : (
    <span
      data-testid="role-label-static"
      className="inline-flex min-h-6 items-center rounded-full bg-[#F0EEE6] px-2 py-0.5 text-[11px] font-semibold text-[#5F6B63]"
    >
      {activeRoleLabel}
    </span>
  );

  return (
    <>
      <div className="flex items-center gap-1.5">
        <div className="flex flex-col items-end leading-tight">
          {showName && <div className="hidden text-sm font-semibold text-[#14201A] sm:block">{user?.name}</div>}
          <div className="flex justify-end">{roleBadge}</div>
        </div>
        <button
          data-testid="button-profile-menu"
          onClick={() => setOpenMenu(true)}
          aria-label="Buka menu akun"
          className="relative flex items-center gap-1.5 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-[#F0EEE6]"
        >
          <Avatar size={40} photo={photo} initials={initials} />
          {incomplete && (
            <span data-testid="profile-incomplete-dot" className="absolute -top-0.5 right-6 h-3 w-3 rounded-full bg-[#5F6B63] ring-2 ring-white" />
          )}
          {unreadUpdate && (
            <span data-testid="profile-update-dot" className="absolute right-5 top-0.5 h-2.5 w-2.5 rounded-full bg-[#A32A2A] ring-2 ring-white" />
          )}
          <ChevronDown size={16} className="hidden text-[#5F6B63] sm:block" />
        </button>
      </div>

      {openMenu && (
        <ActionModal
          testid="profile-action-modal"
          title={user?.name || "Akun Saya"}
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
            {
              key: "update-terbaru",
              testid: "menu-updates",
              label: "Update Terbaru",
              desc: unreadUpdate ? "Ada update baru — ketuk untuk melihat" : "Lihat fitur baru & perbaikan aplikasi",
              icon: Sparkles,
              badge: unreadUpdate,
              onClick: () => setShowUpdates(true),
            },
            {
              key: "tentang",
              testid: "menu-about",
              label: "Tentang Aplikasi",
              desc: "Versi, pengembang, dan panduan aplikasi",
              icon: Info,
              onClick: () => setShowAbout(true),
            },
            {
              key: "keluar",
              testid: "menu-logout",
              label: "Keluar",
              desc: "Akhiri sesi akun ini",
              icon: LogOut,
              hapus: true,
              onClick: async () => { await logout(); navigate("/login"); },
            },
          ]}
        >
          <div className="mb-1 flex items-center gap-3.5 rounded-2xl border border-[#E7E3D8] bg-[#F6F4EE] px-3.5 py-3">
            <Avatar size={52} photo={photo} initials={initials} />
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-[#14201A]">{user?.name}</div>
              <div className="truncate text-xs text-[#5F6B63]">{user?.username || user?.phone}</div>
            </div>
          </div>
        </ActionModal>
      )}

      {showProfile && (
        <ProfileModal photo={photo} onPhotoChange={setPhoto} onClose={() => setShowProfile(false)} />
      )}

      {showSwitcher && <RoleSwitcher current={activeRole} onClose={() => setShowSwitcher(false)} />}

      {showUpdates && (
        <UpdateModal
          forceOpen
          onClose={() => { setShowUpdates(false); setUnreadUpdate(false); }}
          onNavigate={(key) => {
            setShowUpdates(false);
            setUnreadUpdate(false);
            if (key) navigate(`/area/admin?tab=${key}`);
          }}
        />
      )}

      {showAbout && (
        <AboutApp
          onClose={() => setShowAbout(false)}
          onStartTour={() => { setShowAbout(false); setTourOpen(true); }}
        />
      )}

      {tourOpen && (
        <GuidedTour
          onClose={() => setTourOpen(false)}
          onFinish={() => setTourOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Avatar didefinisikan di LUAR komponen agar tidak dibuat ulang tiap render
 * (penyebab input kehilangan fokus / keyboard HP menutup tiap 1 huruf).
 */
function Avatar({ size = 40, photo, initials }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full border-2 border-white bg-[#14633F] font-bold text-white shadow-sm"
      style={{ height: size, width: size, fontSize: size * 0.34, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      {photo ? <img src={photo} alt="Foto profil" className="h-full w-full object-cover" /> : initials}
    </div>
  );
}
