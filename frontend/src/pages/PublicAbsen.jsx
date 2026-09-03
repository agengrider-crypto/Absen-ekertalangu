import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CalendarDays, Clock, MapPin, User, BookOpen, Loader2, CheckCircle2,
  Search, ScanLine, MessageSquareText, Send, PartyPopper, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { TYPE_LABEL, tanggalPanjang, hhmm } from "./admin/kegiatanUtils";

export default function PublicAbsen() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [marking, setMarking] = useState(null);
  const [marked, setMarked] = useState(null);

  const [fbName, setFbName] = useState("");
  const [fbMsg, setFbMsg] = useState("");
  const [fbSending, setFbSending] = useState(false);
  const [fbDone, setFbDone] = useState(false);
  const [showFb, setShowFb] = useState(false);

  const load = () =>
    api.get(`/absen/${token}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setErr("Tautan absen tidak ditemukan."));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const k = data?.kegiatan;
  const closed = k?.status && k.status !== "open";

  const filtered = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    if (!t) return data.peserta;
    return data.peserta.filter((p) => (p.name || "").toLowerCase().includes(t));
  }, [data, q]);

  const doMark = async (p) => {
    setMarking(p.id);
    try {
      const { data: res } = await api.post(`/absen/${token}/mark`, { user_id: p.id });
      setMarked(res);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setMarking(null);
    }
  };

  const sendFeedback = async () => {
    if (!fbMsg.trim()) { toast.error("Tulis kesan & pesan dulu ya."); return; }
    setFbSending(true);
    try {
      await api.post(`/absen/${token}/feedback`, { name: fbName.trim() || null, message: fbMsg.trim() });
      setFbDone(true);
      setFbName(""); setFbMsg("");
      toast.success("Alhamdulillah, jazakumullahu khoiro 🤲");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setFbSending(false);
    }
  };

  if (err) {
    return (
      <div className="min-h-screen bg-[#FAFBF9] flex flex-col items-center justify-center px-4 text-center">
        <div className="h-14 w-14 rounded-2xl overflow-hidden bg-white border border-[#E5E7EB] flex items-center justify-center p-1"><img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" /></div>
        <p className="text-[#991B1B] font-semibold mt-6">{err}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen bg-[#FAFBF9] flex items-center justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-[#FAFBF9] pb-16">
      <header className="bg-[#0D5C3A] text-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden p-0.5"><img src="/logo.png" alt="E-KERTALANGU" className="h-full w-full object-contain" /></div>
          <div className="leading-tight">
            <div className="font-bold font-heading">E-KERTALANGU</div>
            <div className="text-white/70 text-xs">Absen Mandiri</div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 -mt-3">
        {/* Info kegiatan */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
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

        {/* Absen */}
        {marked ? (
          <div className="bg-white rounded-2xl border-2 border-[#0D5C3A] p-6 mt-4 text-center" data-testid="absen-success">
            <div className="h-16 w-16 rounded-full bg-[#E8F5EE] text-[#0D5C3A] flex items-center justify-center mx-auto">
              <PartyPopper size={30} />
            </div>
            <div className="text-lg font-bold text-[#111827] mt-3">
              {marked.already ? "Anda sudah tercatat hadir" : "Kehadiran tercatat!"}
            </div>
            <p className="text-[#4B5563] mt-1">
              <b>{marked.name}</b><br />
              Hadir · {marked.arrival_time ? `${hhmm(marked.arrival_time)} WITA` : ""}
            </p>
            <button
              data-testid="button-absen-other"
              onClick={() => { setMarked(null); setQ(""); }}
              className="mt-4 h-11 px-5 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm hover:bg-[#E8F5EE]"
            >
              Absen nama lain
            </button>
          </div>
        ) : closed ? (
          <div className="bg-white rounded-2xl border border-[#FCA5A5] p-6 mt-4 text-center" data-testid="absen-closed">
            <div className="h-14 w-14 rounded-full bg-[#FEE2E2] text-[#991B1B] flex items-center justify-center mx-auto"><Lock size={26} /></div>
            <div className="text-base font-bold text-[#991B1B] mt-3">Kegiatan sudah ditutup</div>
            <p className="text-sm text-[#6B7280] mt-1">Absen mandiri sudah tidak tersedia untuk kegiatan ini. Silakan hubungi pengurus.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] mt-4 overflow-hidden">
            <div className="px-4 pt-4">
              <div className="flex items-center gap-2 text-[#0D5C3A] font-bold"><ScanLine size={18} /> Konfirmasi Kehadiran</div>
              <p className="text-sm text-[#6B7280] mt-1">Cari nama Anda lalu tekan <b>Hadir</b>.</p>
              <div className="relative my-3">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  data-testid="absen-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Ketik nama Anda..."
                  className="w-full h-12 pl-11 pr-4 rounded-xl border-2 border-[#E5E7EB] outline-none focus:border-[#0D5C3A] bg-white text-base"
                />
              </div>
            </div>
            <ul className="divide-y divide-[#F1F2F0] max-h-[52vh] overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-[#9CA3AF]">Nama tidak ditemukan. Coba ketik dengan ejaan lain.</li>
              ) : filtered.map((p) => {
                const hadir = p.status === "hadir";
                return (
                  <li key={p.id} data-testid={`absen-peserta-${p.id}`} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#111827] truncate">{p.name}</div>
                      <div className="text-xs text-[#9CA3AF]">
                        {hadir ? `Hadir${p.arrival_time ? ` · ${hhmm(p.arrival_time)} WITA` : ""}` : (p.kelompok_name || "—")}
                      </div>
                    </div>
                    {hadir ? (
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E8F5EE] text-[#065F46]"><CheckCircle2 size={14} /> Hadir</span>
                    ) : (
                      <button
                        data-testid={`button-hadir-${p.id}`}
                        disabled={marking === p.id}
                        onClick={() => doMark(p)}
                        className="shrink-0 h-10 px-4 rounded-xl bg-[#0D5C3A] text-white font-bold text-sm flex items-center gap-1.5 hover:bg-[#094229] disabled:opacity-60"
                      >
                        {marking === p.id ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Hadir
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Kotak Pesan / Saran (opsi terpisah, tidak menempel di alur absen) */}
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
                placeholder="Nama (opsional)"
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
                  onClick={sendFeedback}
                  disabled={fbSending}
                  className="flex-1 h-12 rounded-xl bg-[#0D5C3A] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60"
                >
                  {fbSending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />} Kirim
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[#9CA3AF] mt-6">© 2026 E-KERTALANGU · Absensi Pengajian</p>
      </main>
    </div>
  );
}
