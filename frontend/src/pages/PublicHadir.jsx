import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CalendarDays, Clock, MapPin, User, BookOpen, Loader2, CheckCircle2,
  ShieldAlert, PartyPopper, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { TYPE_LABEL, tanggalPanjang, hhmm } from "./admin/kegiatanUtils";

/**
 * Absen kehadiran PUBLIK (kegiatan terbuka) — tanpa login & tanpa kode akses.
 * Peserta yang belum aktivasi akun cukup mengisi NAMA, lalu langsung tercatat hadir.
 */
export default function PublicHadir() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [fatal, setFatal] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get(`/hadir/${token}`)
      .then(({ data }) => setInfo(data))
      .catch((e) => setFatal(formatApiErrorDetail(e.response?.data?.detail)));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) { toast.error("Mohon isi nama Anda (minimal 2 huruf)."); return; }
    setSaving(true);
    try {
      const { data } = await api.post(`/hadir/${token}`, { name: name.trim() });
      setResult(data);
      if (data.already) toast.info(data.message); else toast.success(data.message);
    } catch (ex) {
      toast.error(formatApiErrorDetail(ex.response?.data?.detail));
    } finally { setSaving(false); }
  };

  if (fatal) {
    return (
      <Shell>
        <div className="bg-white rounded-2xl border border-[#FBE5E3] p-6 text-center" data-testid="hadir-fatal">
          <ShieldAlert className="mx-auto text-[#A32A2A]" size={34} />
          <p className="mt-3 text-[#A32A2A] font-semibold">{fatal}</p>
        </div>
      </Shell>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#0E4E31]" size={32} />
      </div>
    );
  }

  const k = info.kegiatan || {};
  const closed = k.status !== "open";

  return (
    <Shell>
      <div className="bg-white rounded-2xl border border-[#E7E3D8] p-5" data-testid="hadir-kegiatan-info">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E3F3EA] text-[#0E4E31]">{TYPE_LABEL[k.type] || "Kegiatan"}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#D9F2F4] text-[#0E4E31]">Terbuka untuk Umum</span>
          {k.gender_filter && k.gender_filter !== "semua" && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FBE5E3] text-[#A32A2A]">{k.gender_label}</span>
          )}
        </div>
        <h1 className="font-heading text-xl font-bold text-[#14201A] mt-2">{k.name}</h1>
        <div className="text-sm text-[#5F6B63] mt-2 grid gap-1">
          <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} /> {tanggalPanjang(k.date)}</span>
          <span className="inline-flex items-center gap-1.5"><Clock size={14} /> {k.start_time}–{k.end_time} WITA</span>
          {k.location && <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {k.location}</span>}
          {k.teacher && <span className="inline-flex items-center gap-1.5"><User size={14} /> {k.teacher}</span>}
          {k.material && <span className="inline-flex items-center gap-1.5"><BookOpen size={14} /> {k.material}</span>}
        </div>
      </div>

      {result ? (
        <div className="bg-white rounded-2xl border-2 border-[#14633F] p-6 mt-4 text-center" data-testid="hadir-success">
          <div className="h-16 w-16 rounded-full bg-[#E3F3EA] text-[#0E4E31] flex items-center justify-center mx-auto">
            <PartyPopper size={30} />
          </div>
          <div className="text-lg font-bold text-[#14201A] mt-3">
            {result.already ? "Sudah Tercatat Hadir" : "Kehadiran Tercatat"}
          </div>
          <p className="text-[#5F6B63] mt-1.5 leading-relaxed">{result.message}</p>
          <div className="mt-4 inline-flex items-center gap-2 bg-[#F6F4EE] border border-[#E7E3D8] rounded-xl px-4 py-2.5">
            <UserCheck size={18} className="text-[#0E4E31]" />
            <span className="font-bold text-[#0E4E31]">{result.name}</span>
            {result.arrival_time && <span className="text-[#5F6B63] text-sm">· {hhmm(result.arrival_time)} WITA</span>}
          </div>
          <button
            data-testid="hadir-again"
            onClick={() => { setResult(null); setName(""); }}
            className="mt-4 w-full h-11 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold hover:bg-[#E3F3EA]"
          >
            Catat Kehadiran Lain
          </button>
        </div>
      ) : closed ? (
        <div className="bg-white rounded-2xl border border-[#FBE5E3] p-6 mt-4 text-center" data-testid="hadir-closed">
          <ShieldAlert className="mx-auto text-[#A32A2A]" size={30} />
          <p className="mt-3 text-[#A32A2A] font-semibold">Kegiatan ini sudah selesai/ditutup.</p>
          <p className="text-sm text-[#5F6B63] mt-1.5">
            Mohon menghubungi pengurus untuk absen susulan. Jazakumullahu khoiro.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="bg-white rounded-2xl border border-[#E7E3D8] p-5 mt-4" data-testid="hadir-form">
          <div className="flex items-center gap-2 text-[#0E4E31] font-bold">
            <UserCheck size={18} /> Absen Kehadiran
          </div>
          <p className="text-sm text-[#5F6B63] mt-1 leading-relaxed">
            Cukup tuliskan <b>nama Anda</b>, kehadiran langsung tercatat. Tidak perlu punya akun.
          </p>
          <input
            data-testid="hadir-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama lengkap Anda"
            className="mt-4 w-full h-[52px] px-4 rounded-xl border border-[#8A948D] text-base outline-none focus:border-[#14633F] bg-white"
          />
          <button
            data-testid="hadir-submit"
            type="submit"
            disabled={saving}
            className="mt-3 w-full h-[54px] rounded-xl bg-[#14633F] text-white font-bold text-base inline-flex items-center justify-center gap-2 hover:bg-[#0E4E31] disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} Catat Kehadiran Saya
          </button>
        </form>
      )}

      <p className="text-center text-xs text-[#5F6B63] mt-6">© 2026 E-KERTALANGU · Absensi Pengajian</p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#F6F4EE] pb-16">
      <header className="bg-white border-b border-[#E7E3D8]">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-center">
          <Logo />
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-5">{children}</main>
    </div>
  );
}
