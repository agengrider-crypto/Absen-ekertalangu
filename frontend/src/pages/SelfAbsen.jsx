import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays, Clock, MapPin, User, BookOpen, Loader2, CheckCircle2,
  MessageSquareText, Send, PartyPopper, Lock, LogIn, ShieldAlert, UserCheck, UserX,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { TYPE_LABEL, tanggalPanjang, hhmm } from "./admin/kegiatanUtils";

/**
 * Absen Mandiri TERFOKUS — 1 peserta saja.
 *
 * Peserta scan QR kegiatan → halaman ini hanya menampilkan NAMA DIRINYA SENDIRI
 * beserta tombol "Saya Hadir". Daftar nama peserta lain tidak ditampilkan sehingga
 * tidak ada "nitip absen". Absen untuk banyak orang hanya bisa lewat absen MANUAL
 * oleh pengurus / penjaga absen.
 */
export default function SelfAbsen() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [marking, setMarking] = useState(false);
  const [result, setResult] = useState(null);

  const [fbName, setFbName] = useState("");
  const [fbMsg, setFbMsg] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [fbDone, setFbDone] = useState(false);
  const [showFb, setShowFb] = useState(false);

  const load = useCallback(() => {
    if (!user) return;
    api.get(`/me/absen/${token}`)
      .then(({ data: d }) => { setData(d); setErr(""); })
      .catch((e) => setErr(formatApiErrorDetail(e.response?.data?.detail)));
  }, [token, user]);

  useEffect(() => { load(); }, [load]);

  const doMark = async () => {
    setMarking(true);
    try {
      const { data: res } = await api.post(`/me/absen/${token}/mark`);
      setResult(res);
      if (res.already) toast.info(res.message);
      else toast.success(res.message);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setMarking(false);
    }
  };

  const sendFeedback = async (anonim = false) => {
    if (!fbMsg.trim()) { toast.error("Mohon tuliskan kesan & pesan Anda terlebih dahulu."); return; }
    setFbSending(true);
    try {
      const name = anonim ? "Anonim (tanpa nama)" : (fbName.trim() || user?.name || null);
      await api.post(`/absen/${token}/feedback`, { name, message: fbMsg.trim() });
      setFbDone(true);
      setFbName(""); setFbMsg("");
      toast.success(anonim
        ? "Pesan anonim terkirim. Jazakumullahu khoiro 🤲"
        : "Alhamdulillah, jazakumullahu khoiro 🤲");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setFbSending(false);
    }
  };

  // Masih memeriksa sesi
  if (user === null) {
    return (
      <div className="min-h-screen bg-[#FAFBF9] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#0D5C3A]" size={32} />
      </div>
    );
  }

  // Belum login → wajib login supaya absen benar-benar milik yang bersangkutan
  if (user === false) {
    return (
      <Shell subtitle="Absen Mandiri">
        <div className="bg-white rounded-2xl border-2 border-[#0D5C3A]/15 p-6 text-center shadow-sm" data-testid="absen-need-login">
          <div className="h-16 w-16 rounded-2xl bg-[#E8F5EE] text-[#0D5C3A] flex items-center justify-center mx-auto">
            <ShieldAlert size={30} />
          </div>
          <h1 className="font-heading text-lg font-bold text-[#111827] mt-4">Mohon masuk terlebih dahulu</h1>
          <p className="text-sm text-[#4B5563] mt-2 leading-relaxed">
            Absen mandiri hanya dapat dilakukan oleh <b>akun Anda sendiri</b>, supaya kehadiran
            tercatat atas nama yang benar dan tidak bisa dititipkan ke orang lain.
          </p>
          <button
            data-testid="absen-login-button"
            onClick={() => navigate(`/login?next=${encodeURIComponent(`/absen/${token}`)}`)}
            className="mt-5 w-full h-[52px] rounded-xl bg-[#0D5C3A] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-[#094229]"
          >
            <LogIn size={19} /> Masuk untuk Absen
          </button>
          <p className="text-xs text-[#9CA3AF] mt-3">
            Belum punya akun? Silakan aktivasi akun Anda atau hubungi pengurus.
          </p>
        </div>
        <p className="text-center text-xs text-[#9CA3AF] mt-6">© 2026 E-KERTALANGU · Absensi Pengajian</p>
      </Shell>
    );
  }

  if (err) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-[#FCA5A5] p-6 text-center" data-testid="absen-error">
          <div className="h-14 w-14 rounded-full bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center mx-auto">
            <ShieldAlert size={26} />
          </div>
          <p className="text-[#991B1B] font-semibold mt-4">{err}</p>
          <button
            onClick={() => navigate("/roles")}
            className="mt-5 h-11 px-5 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE]"
          >
            Kembali ke Beranda
          </button>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFBF9] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#0D5C3A]" size={32} />
      </div>
    );
  }

  const k = data.kegiatan;
  const me = data.me;
  const closed = k.status && k.status !== "open";
  const sudahHadir = me.status === "hadir";

  return (
    <Shell>
      {/* Info kegiatan */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm" data-testid="absen-kegiatan-info">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E8F5EE] text-[#065F46]">{TYPE_LABEL[k.type] || k.type}</span>
        <h1 className="font-heading text-xl font-bold text-[#111827] mt-2">{k.name}</h1>
        <div className="text-sm text-[#6B7280] mt-2 space-y-1">
          <div className="flex items-center gap-2"><CalendarDays size={15} /> {tanggalPanjang(k.date)}</div>
          <div className="flex items-center gap-2"><Clock size={15} /> {k.start_time}–{k.end_time} WITA</div>
          {k.location && <div className="flex items-center gap-2"><MapPin size={15} /> {k.location}</div>}
          {k.teacher && <div className="flex items-center gap-2"><User size={15} /> {k.teacher}</div>}
          {k.material && <div className="flex items-center gap-2"><BookOpen size={15} /> {k.material}</div>}
        </div>
      </div>

      {/* Kartu absen — FOKUS 1 NAMA */}
      {result && !result.already ? (
        <div className="bg-white rounded-2xl border-2 border-[#0D5C3A] p-6 mt-4 text-center" data-testid="absen-success">
          <div className="h-16 w-16 rounded-full bg-[#E8F5EE] text-[#0D5C3A] flex items-center justify-center mx-auto">
            <PartyPopper size={30} />
          </div>
          <div className="text-lg font-bold text-[#111827] mt-3">Absen Berhasil</div>
          <p className="text-[#4B5563] mt-1.5 leading-relaxed">{result.message}</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-[#F0FAF4] border border-[#CDEBD9] rounded-xl px-4 py-2.5">
            <UserCheck size={18} className="text-[#0D5C3A]" />
            <span className="font-bold text-[#065F46]">{result.name}</span>
            <span className="text-[#4B5563] text-sm">· Hadir {result.arrival_time ? `${hhmm(result.arrival_time)} WITA` : ""}</span>
          </div>
        </div>
      ) : closed ? (
        <div className="bg-white rounded-2xl border border-[#FCA5A5] p-6 mt-4 text-center" data-testid="absen-closed">
          <div className="h-14 w-14 rounded-full bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center mx-auto"><Lock size={26} /></div>
          <div className="text-base font-bold text-[#991B1B] mt-3">Kegiatan sudah ditutup</div>
          <p className="text-sm text-[#4B5563] mt-1.5 leading-relaxed">
            Mohon maaf, absen mandiri untuk kegiatan ini sudah tidak tersedia.
            Silakan menghubungi pengurus untuk absen susulan. Jazakumullahu khoiro.
          </p>
        </div>
      ) : !me.is_peserta ? (
        <div className="bg-white rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-6 mt-4 text-center" data-testid="absen-not-peserta">
          <div className="h-14 w-14 rounded-full bg-[#FEF3C7] text-[#92400E] flex items-center justify-center mx-auto"><ShieldAlert size={26} /></div>
          <div className="text-base font-bold text-[#92400E] mt-3">Akun Anda bukan peserta pengajian</div>
          <p className="text-sm text-[#78350F] mt-1.5">
            Mohon maaf, absen mandiri hanya untuk akun dengan peran peserta.
            Silakan menghubungi pengurus untuk didaftarkan.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mt-4" data-testid="absen-self-card">
          <div className="flex items-center gap-2 text-[#0D5C3A] font-bold">
            <UserCheck size={18} /> Konfirmasi Kehadiran Anda
          </div>
          <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
            Absen ini hanya berlaku untuk akun Anda sendiri dan tidak dapat dititipkan.
          </p>

          <div className="mt-4 rounded-2xl border-2 border-[#0D5C3A]/15 bg-[#FAFBF9] p-4 flex items-center gap-3.5">
            <div className="h-12 w-12 shrink-0 rounded-full bg-[#0D5C3A] text-white flex items-center justify-center font-bold">
              {(me.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-[#111827] truncate" data-testid="absen-self-name">{me.name}</div>
              <div className="text-xs text-[#6B7280] mt-0.5">
                {sudahHadir
                  ? `Sudah hadir${me.arrival_time ? ` · ${hhmm(me.arrival_time)} WITA` : ""}`
                  : "Belum tercatat hadir"}
              </div>
            </div>
          </div>

          {sudahHadir ? (
            <div className="mt-4 rounded-xl bg-[#E8F5EE] border border-[#A7F3D0] p-4 text-center" data-testid="absen-already">
              <CheckCircle2 className="mx-auto text-[#0D5C3A]" size={26} />
              <p className="text-sm font-semibold text-[#065F46] mt-1.5">
                Kehadiran Anda sudah tercatat. Terima kasih, jazakumullahu khoiro.
              </p>
            </div>
          ) : (
            <button
              data-testid="button-saya-hadir"
              onClick={doMark}
              disabled={marking}
              className="mt-4 w-full h-[54px] rounded-xl bg-[#0D5C3A] text-white font-bold text-base inline-flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60"
            >
              {marking ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} Saya Hadir
            </button>
          )}
        </div>
      )}

      {/* Kotak Pesan / Saran */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mt-4">
        <div className="flex items-center gap-2 text-[#0D5C3A] font-bold"><MessageSquareText size={18} /> Kotak Pesan / Saran</div>
        {fbDone ? (
          <div className="mt-3 rounded-xl bg-[#E8F5EE] text-[#065F46] p-4 text-center text-sm font-semibold" data-testid="feedback-done">
            Alhamdulillah, jazakumullahu khoiro 🤲
            <button onClick={() => { setFbDone(false); setShowFb(false); }} className="block mx-auto mt-2 text-[#0D5C3A] underline text-xs font-normal">Kirim lagi</button>
          </div>
        ) : !showFb ? (
          <>
            <p className="text-sm text-[#6B7280] mt-1">Ingin menyampaikan pesan atau saran untuk kegiatan ini? (opsional)</p>
            <button
              data-testid="button-open-feedback"
              onClick={() => setShowFb(true)}
              className="mt-3 w-full h-12 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-bold flex items-center justify-center gap-2 hover:bg-[#E8F5EE]"
            >
              <MessageSquareText size={18} /> Tulis Pesan / Saran
            </button>
          </>
        ) : (
          <div className="mt-3 space-y-2">
            <input
              data-testid="feedback-name"
              value={fbName}
              onChange={(e) => setFbName(e.target.value)}
              placeholder={`Nama (opsional) — mis. ${user?.name || ""}`}
              className="w-full h-11 px-3.5 rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A] bg-white"
            />
            <textarea
              data-testid="feedback-message"
              value={fbMsg}
              onChange={(e) => setFbMsg(e.target.value)}
              rows={3}
              placeholder="Tulis pesan / saran Anda..."
              className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A] bg-white resize-none"
            />
            <div className="flex gap-2">
              <button
                data-testid="button-cancel-feedback"
                onClick={() => setShowFb(false)}
                className="h-12 px-4 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] font-semibold hover:bg-[#F2F5F2]"
              >
                Batal
              </button>
              <button
                data-testid="button-send-feedback"
                onClick={() => sendFeedback(false)}
                disabled={fbSending}
                className="flex-1 h-12 rounded-xl bg-[#0D5C3A] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60"
              >
                {fbSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} Kirim
              </button>
            </div>
            <button
              data-testid="button-send-feedback-anonim"
              onClick={() => sendFeedback(true)}
              disabled={fbSending}
              className="w-full h-12 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-bold flex items-center justify-center gap-2 hover:bg-[#E8F5EE] disabled:opacity-60"
            >
              <UserX size={18} /> Kirim Tanpa Nama (Anonim)
            </button>
            <p className="text-xs text-[#9CA3AF] text-center">
              Pesan anonim tetap terkirim ke pengurus, hanya saja nama Anda tidak ditampilkan.
            </p>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-[#9CA3AF] mt-6">© 2026 E-KERTALANGU · Absensi Pengajian</p>
    </Shell>
  );
}

/**
 * Kerangka halaman. WAJIB didefinisikan di luar komponen utama — bila berada di
 * dalamnya, setiap ketikan (setState) membuat komponen ini dibuat ulang sehingga
 * input kehilangan fokus & keyboard HP menutup setiap 1 huruf.
 */
function Shell({ children, subtitle = "Absen Mandiri" }) {
  return (
    <div className="min-h-screen bg-[#FAFBF9] pb-16">
      <header className="bg-[#0D5C3A] text-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden p-0.5">
            <img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-bold font-heading">E-KERTALANGU</div>
            <div className="text-white/70 text-xs">{subtitle}</div>
          </div>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 -mt-3">{children}</main>
    </div>
  );
}
