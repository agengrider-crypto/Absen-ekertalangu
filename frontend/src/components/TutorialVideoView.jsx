// Tutorial video: grid kartu, difilter sesuai peran akun.
// Video = tautan YouTube "Tidak publik" dari konstanta (src/lib/helpContent.js).
// Ketuk kartu → putar di halaman (youtube-nocookie). Tanpa library, tanpa DB.
import { useMemo, useState } from "react";
import { Play, Clock, X, ShieldCheck, Users, UserCheck } from "lucide-react";
import { TUTORIAL_VIDEOS, youtubeId } from "@/lib/helpContent";

const ROLE_LABEL = { admin: "Administrator", pengurus: "Pengurus", peserta: "Peserta" };
const ROLE_ICON = { admin: ShieldCheck, pengurus: Users, peserta: UserCheck };

export default function TutorialVideoView({ role = "admin" }) {
  const isAdmin = role === "admin";
  const [pick, setPick] = useState(isAdmin ? "semua" : role);
  const [playing, setPlaying] = useState(null);

  const videos = useMemo(() => {
    if (isAdmin && pick === "semua") return TUTORIAL_VIDEOS;
    return TUTORIAL_VIDEOS.filter((v) => v.role === (isAdmin ? pick : role));
  }, [isAdmin, pick, role]);

  return (
    <div className="space-y-4" data-testid="tutorial-video-view">
      <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5 sm:p-6">
        <div className="font-heading text-xl font-bold text-[#14201A] sm:text-2xl">Tutorial video</div>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#5F6B63]">
          Tonton langkah singkat memakai aplikasi. Ketuk kartu untuk memutar di halaman ini.
        </p>
        {isAdmin && (
          <div className="mt-3 flex flex-wrap gap-2">
            {[["semua", "Semua peran"], ["admin", "Administrator"], ["pengurus", "Pengurus"], ["peserta", "Peserta"]].map(([key, label]) => (
              <button
                key={key}
                type="button"
                data-testid={`tutorial-filter-${key}`}
                onClick={() => setPick(key)}
                aria-pressed={pick === key}
                className={`h-10 rounded-xl border-2 px-3.5 text-sm font-semibold transition-colors ${
                  pick === key ? "border-transparent bg-[#14633F] text-white" : "border-[#E7E3D8] bg-white text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {videos.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-10 text-center text-sm text-[#5F6B63]">
          Belum ada video untuk peran ini.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => {
            const Icon = ROLE_ICON[v.role] || Users;
            const vid = youtubeId(v.url);
            return (
              <button
                key={`${v.role}-${v.title}`}
                type="button"
                data-testid={`tutorial-card-${v.role}-${v.title}`}
                onClick={() => setPlaying(v)}
                className="group overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white text-left transition-shadow hover:shadow-[0_10px_28px_-10px_rgba(20,32,26,0.25)]"
              >
                <span className="relative block aspect-video bg-[#14201A]">
                  {vid ? (
                    <img
                      src={`https://i.ytimg.com/vi/${vid}/hqdefault.jpg`}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                    />
                  ) : null}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-[#0B6B52] shadow-lg">
                      <Play size={20} />
                    </span>
                  </span>
                </span>
                <span className="block p-3.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-[#5F6B63]">
                    <Icon size={12} /> {ROLE_LABEL[v.role] || v.role}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-[#14201A]">{v.title}</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-[#5F6B63]">
                    <Clock size={12} /> {v.duration}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {playing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(17,17,17,0.7)] p-4" data-testid="tutorial-player">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-black shadow-2xl">
            <div className="flex items-center justify-between gap-2 bg-[#14201A] px-3 py-2">
              <span className="min-w-0 truncate text-sm font-semibold text-white">{playing.title}</span>
              <button
                type="button"
                data-testid="tutorial-player-close"
                onClick={() => setPlaying(null)}
                aria-label="Tutup video"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/15"
              >
                <X size={18} />
              </button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                title={playing.title}
                src={`https://www.youtube-nocookie.com/embed/${youtubeId(playing.url)}?autoplay=1&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
