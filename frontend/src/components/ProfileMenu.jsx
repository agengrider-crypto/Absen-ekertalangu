import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, User as UserIcon, RefreshCw, LogOut } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProfileModal from "@/components/ProfileModal";

export default function ProfileMenu({ subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [photo, setPhoto] = useState(null);
  const ref = useRef(null);

  const initials = (user?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const multiRole = (user?.roles || []).length > 1;

  useEffect(() => {
    let active = true;
    if (user?.has_photo) {
      api.get("/me/photo").then(({ data }) => { if (active) setPhoto(data.photo || null); }).catch(() => {});
    } else {
      setPhoto(null);
    }
    return () => { active = false; };
  }, [user?.has_photo]);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const Avatar = ({ size = 40 }) => (
    <div
      className="rounded-full overflow-hidden bg-[#0D5C3A] text-white flex items-center justify-center font-bold shrink-0"
      style={{ height: size, width: size, fontSize: size * 0.35 }}
    >
      {photo ? <img src={photo} alt="Foto" className="h-full w-full object-cover" /> : initials}
    </div>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        data-testid="button-profile-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-full pl-1 pr-2 py-1 hover:bg-[#F2F5F2] transition-colors"
      >
        <div className="text-right hidden sm:block leading-tight">
          <div className="font-semibold text-[#111827] text-sm">{user?.name}</div>
          {subtitle && <div className="text-xs text-[#6B7280]">{subtitle}</div>}
        </div>
        <Avatar size={40} />
        <ChevronDown size={16} className={`text-[#6B7280] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-[#E5E7EB] overflow-hidden z-50" data-testid="profile-dropdown">
          <div className="px-4 py-3 flex items-center gap-3 border-b border-[#F1F2F0]">
            <Avatar size={44} />
            <div className="min-w-0">
              <div className="font-semibold text-[#111827] text-sm truncate">{user?.name}</div>
              <div className="text-xs text-[#6B7280] truncate">{user?.username || user?.phone}</div>
            </div>
          </div>
          <button
            data-testid="menu-profile"
            onClick={() => { setOpen(false); setShowProfile(true); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#111827] hover:bg-[#F0FAF4]"
          >
            <UserIcon size={17} className="text-[#0D5C3A]" /> Profil
          </button>
          {multiRole && (
            <button
              data-testid="menu-switch-role"
              onClick={() => { setOpen(false); navigate("/roles"); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#111827] hover:bg-[#F0FAF4]"
            >
              <RefreshCw size={17} className="text-[#0D5C3A]" /> Ganti Peran
            </button>
          )}
          <button
            data-testid="menu-logout"
            onClick={async () => { setOpen(false); await logout(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#DC2626] hover:bg-red-50 border-t border-[#F1F2F0]"
          >
            <LogOut size={17} /> Keluar
          </button>
        </div>
      )}

      {showProfile && (
        <ProfileModal photo={photo} onPhotoChange={setPhoto} onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
}
