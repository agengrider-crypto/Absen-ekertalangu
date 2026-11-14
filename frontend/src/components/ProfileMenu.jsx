import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User as UserIcon, LogOut, AlertCircle, Sparkles, Info, RefreshCw, Shield, Users, UserCheck, GraduationCap } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProfileModal from "@/components/ProfileModal";
import ActionModal from "@/components/ActionModal";
import UpdateModal, { hasUnreadUpdate } from "@/components/UpdateModal";
import AboutApp, { hasUnseenTour } from "@/components/AboutApp";
import GuidedTour from "@/components/GuidedTour";
import { roleLabel, getActiveRole, setActiveRole, visibleRoles } from "@/lib/roles";

const ROLE_ICON = { admin: Shield, pengurus: Users, guru: GraduationCap, peserta: UserCheck };
const ROLE_DESC = {
  admin: "Kelola semua",
  pengurus: "Absen dan rekap",
  guru: "Kelas dan pembelajaran",
  peserta: "Absen dan riwayat saya",
};
const ROLE_ORDER = ["admin", "guru", "pengurus", "peserta"];

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
  const [showSwitch, setShowSwitch] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [unreadUpdate, setUnreadUpdate] = useState(() => hasUnreadUpdate());
  const [photo, setPhoto] = useState(null);
  const switchRef = useRef(null);

  const initials = (user?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const roles = user?.roles || [];
  const allowedRoles = visibleRoles(user);
  const multiRole = allowedRoles.length > 1;
  const activeRole = getActiveRole(allowedRoles) || role || allowedRoles[0];
  const activeRoleLabel = roleLabel(activeRole);
  const incomplete = (user?.missing_fields || []).length > 0;
  const isStaff = roles.some((r) => r === "admin" || r === "pengurus");
  const switchable = ROLE_ORDER.filter((r) => allowedRoles.includes(r));

  useEffect(() => {
    if (!showSwitch) return undefined;
    const onDown = (e) => { if (switchRef.current && !switchRef.current.contains(e.target)) setShowSwitch(false); };
    const onKey = (e) => { if (e.key === "Escape") setShowSwitch(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showSwitch]);

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

  return (
    <>
      <div className="relative flex items-center gap-1.5" ref={switchRef}>
        {multiRole && (
          <button
            type="button"
            data-testid="button-switch-role"
            onClick={() => setShowSwitch((v) => !v)}
            aria-label={`Pindah peran. Aktif ${activeRoleLabel}`}
            aria-haspopup="menu"
            aria-expanded={showSwitch}
            title="Pindah peran"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E7E3D8] bg-white text-[#0E4E31] transition-colors hover:border-[#14633F] hover:bg-[#F6F4EE]"
          >
            <RefreshCw size={17} />
          </button>
        )}
        <button
          data-testid="button-profile-menu"
          onClick={() => setOpenMenu(true)}
          aria-label="Buka menu akun"
          className="relative flex items-center rounded-full p-1 transition-colors hover:bg-[#F0EEE6]"
        >
          <Avatar size={40} photo={photo} initials={initials} />
          {incomplete && (
            <span data-testid="profile-incomplete-dot" className="absolute -top-0.5 right-0 h-3 w-3 rounded-full bg-[#5F6B63] ring-2 ring-white" />
          )}
          {unreadUpdate && (
            <span data-testid="profile-update-dot" className="absolute right-0 top-0.5 h-2.5 w-2.5 rounded-full bg-[#A32A2A] ring-2 ring-white" />
          )}
        </button>

        {showSwitch && (
          <div
            role="menu"
            data-testid="role-switch-popover"
            className="absolute right-0 top-[calc(100%+8px)] z-40 w-64 overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white p-1.5 shadow-xl"
          >
            <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wide text-[#5F6B63]">
              Pindah ke
            </div>
            {switchable.map((r) => {
              const Icon = ROLE_ICON[r] || Users;
              const on = r === activeRole;
              return (
                <button
                  key={r}
                  type="button"
                  role="menuitem"
                  data-testid={`switch-role-${r}`}
                  aria-current={on ? "true" : undefined}
                  onClick={() => {
                    setShowSwitch(false);
                    if (on) return;
                    setActiveRole(r);
                    navigate(`/area/${r}`);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    on ? "bg-[#E3F3EA]" : "hover:bg-[#F6F4EE]"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    on ? "bg-[#14633F] text-white" : "bg-[#E3F3EA] text-[#0E4E31]"
                  }`}>
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[#14201A]">{roleLabel(r)}</span>
                    <span className="block text-[11px] text-[#5F6B63]">{ROLE_DESC[r] || ""}</span>
                  </span>
                  {on && <span className="shrink-0 text-[10px] font-bold text-[#0E4E31]">Aktif</span>}
                </button>
              );
            })}
          </div>
        )}
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
