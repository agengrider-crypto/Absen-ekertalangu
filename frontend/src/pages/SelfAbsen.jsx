import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CalendarDays, Clock, MapPin, User, BookOpen, Loader2, CheckCircle2,
  MessageSquareText, Send, PartyPopper, Lock, LogIn, ShieldAlert, UserCheck, UserX,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { SELF_ABSENCE } from "@/constants/testIds";
import { TYPE_LABEL, tanggalPanjang, hhmm } from "./admin/kegiatanUtils";
import { K1Mark } from "@/components/Logo";

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
  const [absenceFormOpen, setAbsenceFormOpen] = useState(false);
  const [absenceReason, setAbsenceReason] = useState("");
  const [absenceNote, setAbsenceNote] = useState("");
  const [absenceSending, setAbsenceSending] = useState(false);

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

  const doMark = useCallback(async () => {
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
  }, [token, load]);

  const submitCannotAttend = async () => {
    if (!absenceReason.trim()) {
      toast.error("Mohon isi alasan tidak dapat hadir.");
      return;
    }
    setAbsenceSending(true);
    try {
      const { data: res } = await api.post(`/me/absen/${token}/tidak-hadir`, {
        alasan: absenceReason.trim(),
        keterangan: absenceNote.trim() || null,
      });
      setData((current) => ({
        ...current,
        me: {
          ...current.me, status: "izin",
          absence_reason: res.reason, absence_note: res.note,
        },
      }));
      setAbsenceFormOpen(false);
      toast.success(res.message);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setAbsenceSending(false);
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
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#1D4ED8]" size={32} />
      </div>
    );
  }

  // Belum login → wajib login supaya absen benar-benar milik yang bersangkutan
  if (user === false) {
    return (
      <Shell subtitle="Absen Mandiri">
        <div className="bg-white rounded-2xl border-2 border-[#2563EB]/15 p-6 text-center shadow-sm" data-testid="absen-need-login">
          <div className="h-16 w-16 rounded-2xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center mx-auto">
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
            className="mt-5 w-full h-[52px] rounded-xl bg-[#2563EB] text-white font-bold inline-flex items-center justify-center gap-2 hover:bg-[#1D4ED8]"
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
        <div className="bg-white rounded-2xl border border-[#FECACA] p-6 text-center" data-testid="absen-error">
          <div className="h-14 w-14 rounded-full bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center mx-auto">
            <ShieldAlert size={26} />
          </div>
          <p className="text-[#991B1B] font-semibold mt-4">{err}</p>
          <button
            onClick={() => navigate("/roles")}
            className="mt-5 h-11 px-5 rounded-xl border-2 border-[#2563EB] text-[#1D4ED8] font-semibold text-sm hover:bg-[#EFF6FF]"
          >
            Kembali ke Beranda
          </button>
        </div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#1D4ED8]" size={32} />
      </div>
    );
  }

  const k = data.kegiatan;
  const me = data.me;
  const closed = k.status && k.status !== "open";
  const sudahHadir = me.status === "hadir";
  const sudahLaporkan = me.status === "izin" && Boolean(me.absence_reason);

  return (
    <Shell>
      {/* Info kegiatan */}
      <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5 shadow-sm" data-testid="absen-kegiatan-info">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8]">{TYPE_LABEL[k.type] || k.type}</span>
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
        <div className="bg-white rounded-2xl border-2 border-[#2563EB] p-6 mt-4 text-center" data-testid="absen-success">
          <div className="h-16 w-16 rounded-full bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center mx-auto">
            <PartyPopper size={30} />
          </div>
          <div className="text-lg font-bold text-[#111827] mt-3">Absen Berhasil</div>
          <p className="text-[#4B5563] mt-1.5 leading-relaxed">{result.message}</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-[#FAFAF8] border border-[#E8E8E4] rounded-xl px-4 py-2.5">
            <UserCheck size={18} className="text-[#1D4ED8]" />
            <span className="font-bold text-[#1D4ED8]">{result.name}</span>
            <span className="text-[#4B5563] text-sm">· Hadir {result.arrival_time ? `${hhmm(result.arrival_time)} WITA` : ""}</span>
          </div>
        </div>
      ) : closed ? (
        <div className="bg-white rounded-2xl border border-[#FECACA] p-6 mt-4 text-center" data-testid="absen-closed">
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
          <p className="text-sm text-[#92400E] mt-1.5">
            Mohon maaf, absen mandiri hanya untuk akun dengan peran peserta.
            Silakan menghubungi pengurus untuk didaftarkan.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5 mt-4" data-testid="absen-self-card">
          <div className="flex items-center gap-2 text-[#1D4ED8] font-bold">
            <UserCheck size={18} /> Kehadiran Anda
          </div>
          <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
            Kehadiran langsung dicatat atas nama akun Anda sendiri dan tidak dapat dititipkan.
          </p>

          <div className="mt-4 rounded-2xl border-2 border-[#2563EB]/15 bg-[#FAFAF8] p-4 flex items-center gap-3.5">
            <div className="h-12 w-12 shrink-0 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold">
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
            <div className="mt-4 rounded-xl bg-[#EFF6FF] border border-[#D1D5DB] p-4 text-center" data-testid="absen-already">
              <CheckCircle2 className="mx-auto text-[#1D4ED8]" size={26} />
              <p className="text-sm font-semibold text-[#1D4ED8] mt-1.5">
                Kehadiran Anda sudah tercatat. Terima kasih, jazakumullahu khoiro.
              </p>
            </div>
          ) : sudahLaporkan ? (
            <div className="mt-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] p-4" data-testid={SELF_ABSENCE.absenceReported}>
              <div className="font-bold text-[#92400E]">Laporan tidak hadir sudah dikirim</div>
              <p className="text-sm text-[#92400E] mt-1">Alasan: {me.absence_reason}</p>
              {me.absence_note && <p className="text-sm text-[#92400E] mt-1">Keterangan: {me.absence_note}</p>}
              <button
                type="button"
                data-testid={SELF_ABSENCE.editAbsence}
                onClick={() => {
                  setAbsenceReason(me.absence_reason || "");
                  setAbsenceNote(me.absence_note || "");
                  setAbsenceFormOpen(true);
                }}
                className="mt-3 min-h-11 rounded-xl border-2 border-[#92400E] px-4 font-semibold text-[#92400E]"
              >
                Perbarui Laporan
              </button>
              {absenceFormOpen && <AbsenceForm
                reason={absenceReason} setReason={setAbsenceReason}
                note={absenceNote} setNote={setAbsenceNote}
                sending={absenceSending} onSubmit={submitCannotAttend}
                onCancel={() => setAbsenceFormOpen(false)}
              />}
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-[#FAFAF8] border border-[#E8E8E4] p-4" data-testid="absen-auto">
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  data-testid={SELF_ABSENCE.markPresent}
                  onClick={doMark}
                  disabled={marking || absenceSending}
                  className="min-h-[54px] rounded-xl bg-[#2563EB] px-3 text-white font-bold text-base inline-flex items-center justify-center gap-2 hover:bg-[#1D4ED8] disabled:opacity-60"
                >
                  {marking ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                  Catat Kehadiran Saya
                </button>
                <button
                  type="button"
                  data-testid={SELF_ABSENCE.cannotAttend}
                  onClick={() => setAbsenceFormOpen((open) => !open)}
                  disabled={marking || absenceSending}
                  className="min-h-[54px] rounded-xl border-2 border-[#92400E] px-3 text-[#92400E] font-bold text-base inline-flex items-center justify-center gap-2 hover:bg-[#FFFBEB] disabled:opacity-60"
                >
                  <UserX size={20} /> Tidak Bisa Hadir
                </button>
              </div>
              {marking && <p className="text-center text-sm font-semibold text-[#4B5563] mt-2">Mencatat kehadiran Anda…</p>}
              {absenceFormOpen && <AbsenceForm
                reason={absenceReason} setReason={setAbsenceReason}
                note={absenceNote} setNote={setAbsenceNote}
                sending={absenceSending} onSubmit={submitCannotAttend}
                onCancel={() => setAbsenceFormOpen(false)}
              />}
            </div>
          )}
        </div>
      )}

      {/* Kotak Pesan / Saran */}
      <div className="bg-white rounded-2xl border border-[#E8E8E4] p-5 mt-4">
        <div className="flex items-center gap-2 text-[#1D4ED8] font-bold"><MessageSquareText size={18} /> Kotak Pesan / Saran</div>
        {fbDone ? (
          <div className="mt-3 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] p-4 text-center text-sm font-semibold" data-testid="feedback-done">
            Alhamdulillah, jazakumullahu khoiro 🤲
            <button onClick={() => { setFbDone(false); setShowFb(false); }} className="block mx-auto mt-2 text-[#1D4ED8] underline text-xs font-normal">Kirim lagi</button>
          </div>
        ) : !showFb ? (
          <>
            <p className="text-sm text-[#6B7280] mt-1">Ingin menyampaikan pesan atau saran untuk kegiatan ini? (opsional)</p>
            <button
              data-testid="button-open-feedback"
              onClick={() => setShowFb(true)}
              className="mt-3 w-full h-12 rounded-xl border-2 border-[#2563EB] text-[#1D4ED8] font-bold flex items-center justify-center gap-2 hover:bg-[#EFF6FF]"
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
              className="w-full h-11 px-3.5 rounded-xl border-2 border-[#E8E8E4] outline-none focus:border-[#2563EB] bg-white"
            />
            <textarea
              data-testid="feedback-message"
              value={fbMsg}
              onChange={(e) => setFbMsg(e.target.value)}
              rows={3}
              placeholder="Tulis pesan / saran Anda..."
              className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[#E8E8E4] outline-none focus:border-[#2563EB] bg-white resize-none"
            />
            <div className="flex gap-2">
              <button
                data-testid="button-cancel-feedback"
                onClick={() => setShowFb(false)}
                className="h-12 px-4 rounded-xl border-2 border-[#E8E8E4] text-[#4B5563] font-semibold hover:bg-[#F3F4F6]"
              >
                Batal
              </button>
              <button
                data-testid="button-send-feedback"
                onClick={() => sendFeedback(false)}
                disabled={fbSending}
                className="flex-1 h-12 rounded-xl bg-[#2563EB] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#1D4ED8] disabled:opacity-60"
              >
                {fbSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} Kirim
              </button>
            </div>
            <button
              data-testid="button-send-feedback-anonim"
              onClick={() => sendFeedback(true)}
              disabled={fbSending}
              className="w-full h-12 rounded-xl border-2 border-[#2563EB] text-[#1D4ED8] font-bold flex items-center justify-center gap-2 hover:bg-[#EFF6FF] disabled:opacity-60"
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
function AbsenceForm({ reason, setReason, note, setNote, sending, onSubmit, onCancel }) {
  return (
    <div className="mt-4 space-y-3 border-t border-[#E8E8E4] pt-4" data-testid={SELF_ABSENCE.absenceForm}>
      <label className="block text-left text-sm font-semibold text-[#374151]">
        Alasan tidak dapat hadir *
        <input
          data-testid={SELF_ABSENCE.absenceReason}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
          className="mt-1.5 w-full min-h-11 rounded-xl border-2 border-[#E8E8E4] bg-white px-3.5 text-base outline-none focus:border-[#2563EB]"
          placeholder="Contoh: sakit atau ada keperluan keluarga"
        />
      </label>
      <label className="block text-left text-sm font-semibold text-[#374151]">
        Keterangan (opsional)
        <textarea
          data-testid={SELF_ABSENCE.absenceNote}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          className="mt-1.5 w-full rounded-xl border-2 border-[#E8E8E4] bg-white px-3.5 py-2.5 text-base outline-none focus:border-[#2563EB]"
          placeholder="Tambahkan keterangan bila diperlukan"
        />
      </label>
      <div className="flex gap-2">
        <button type="button" data-testid={SELF_ABSENCE.cancelAbsence} onClick={onCancel}
          className="min-h-11 rounded-xl border-2 border-[#E8E8E4] px-4 font-semibold text-[#4B5563]">
          Batal
        </button>
        <button type="button" data-testid={SELF_ABSENCE.submitAbsence} onClick={onSubmit} disabled={sending}
          className="min-h-11 flex-1 rounded-xl bg-[#92400E] px-4 font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} Kirim Laporan
        </button>
      </div>
    </div>
  );
}

function Shell({ children, subtitle = "Absen Mandiri" }) {
  return (
    <div className="min-h-screen bg-[#FAFAF8] pb-16">
      <header className="bg-[#2563EB] text-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden p-0.5">
            <K1Mark size={32} variant="light" />
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
