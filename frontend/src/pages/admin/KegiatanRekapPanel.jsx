import { useCallback, useEffect, useState } from "react";
import { Loader2, Copy, Send, FileBarChart2, ExternalLink, Users, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { ACTIVITIES } from "@/constants/testIds";

export default function KegiatanRekapPanel({ kegiatanId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setData(null);
    setError("");
    try {
      const [linkResponse, rekapResponse] = await Promise.all([
        api.get(`/admin/kegiatan/${kegiatanId}/qr`),
        api.get(`/admin/kegiatan/${kegiatanId}/rekap`),
      ]);
      setData({ link: linkResponse.data, rekap: rekapResponse.data });
    } catch (e) {
      const message = formatApiErrorDetail(e.response?.data?.detail);
      setError(message);
      toast.error(message);
    }
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  if (!data && !error) {
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={28} /></div>;
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-[#FECACA] bg-white p-8 text-center" data-testid={ACTIVITIES.recapError}>
        <p className="text-sm text-[#6B7280]">{error}</p>
        <button type="button" onClick={load} className="mt-3 min-h-11 rounded-xl bg-[#111114] px-4 font-semibold text-white">Coba lagi</button>
      </div>
    );
  }

  const { link, rekap } = data;
  const hadirRows = (rekap.rows || []).filter((row) => row.status === "hadir" && !row.attended_other);
  const maleCount = hadirRows.filter((row) => row.gender === "L").length;
  const femaleCount = hadirRows.filter((row) => row.gender === "P").length;
  const guestCount = (rekap.guests || []).length;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link.link);
      toast.success("Tautan rekap disalin.");
    } catch {
      toast.error("Tautan gagal disalin. Silakan salin tautan yang tampil di layar.");
    }
  };
  const shareWa = () => {
    const text = link.wa_text
      || `Assalamu'alaikum warahmatullahi wabarakatuh\n\nBerikut rekap kehadiran kegiatan\n${link.link}\n\nJazakumullahu khoiro.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4" data-testid="detail-rekap-panel">
      <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 sm:p-5">
        <h3 className="mb-3 inline-flex items-center gap-2 font-bold text-[#111827]">
          <FileBarChart2 size={18} /> Rekap Kehadiran
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#F1F1EE] p-3 text-center">
            <div className="text-xl font-bold text-[#111114]">{maleCount}</div>
            <div className="text-sm text-[#4B5563]">Laki-laki hadir</div>
          </div>
          <div className="rounded-xl bg-[#E8F5EE] p-3 text-center">
            <div className="text-xl font-bold text-[#14532D]">{femaleCount}</div>
            <div className="text-sm text-[#4B5563]">Perempuan hadir</div>
          </div>
          <div className="rounded-xl bg-[#F4F4F1] p-3 text-center">
            <div className="text-xl font-bold text-[#111827]">{rekap.counts?.hadir || 0}</div>
            <div className="text-sm text-[#4B5563]">Total hadir{guestCount ? ` · tamu ${guestCount}` : ""}</div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E8E8E4] bg-white" data-testid={ACTIVITIES.recapAttendees}>
        <div className="flex items-center justify-between border-b border-[#E8E8E4] px-4 py-3">
          <h3 className="inline-flex items-center gap-2 font-bold text-[#111827]">
            <Users size={17} /> Peserta Hadir
          </h3>
          <span className="rounded-full bg-[#E8F5EE] px-2.5 py-1 text-xs font-bold text-[#14532D]">{hadirRows.length + (rekap.guests || []).length}</span>
        </div>
        {hadirRows.length || rekap.guests?.length ? (
          <ul className="max-h-72 divide-y divide-[#ECECE8] overflow-y-auto">
            {hadirRows.map((row) => (
              <li key={row.user_id} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle2 size={17} className="shrink-0 text-[#0D5C3A]" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#111827]">{row.name}</span>
                <span className="text-xs text-[#6B7280]">{row.gender === "L" ? "Laki-laki" : row.gender === "P" ? "Perempuan" : "Peserta"}</span>
              </li>
            ))}
            {(rekap.guests || []).map((guest) => (
              <li key={guest.id} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle2 size={17} className="shrink-0 text-[#0D5C3A]" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#111827]">{guest.name}</span>
                <span className="text-xs text-[#6B7280]">Tamu</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-center text-sm text-[#6B7280]">Belum ada peserta yang tercatat hadir.</p>
        )}
      </section>

      <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4 sm:p-5" data-testid={ACTIVITIES.recapShare}>
        <h3 className="font-bold text-[#111827]">Bagikan tautan rekap</h3>
        <p className="mt-1 text-sm text-[#6B7280]">Tautan publik berlaku 7 hari. Tidak ada barcode pada bagian ini.</p>
        <a href={link.link} target="_blank" rel="noreferrer" data-testid="detail-rekap-link"
          className="mt-3 block break-all rounded-xl bg-[#F7F7F5] p-3 text-sm font-semibold text-[#111114] hover:underline">
          <ExternalLink size={15} className="mr-1 inline" />{link.link}
        </a>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" data-testid="detail-rekap-copy" onClick={copyLink}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-[#111114] font-semibold text-[#111114] hover:bg-[#F1F1EE]">
            <Copy size={16} /> Salin Tautan
          </button>
          <button type="button" data-testid="detail-rekap-wa" onClick={shareWa}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] font-semibold text-white hover:brightness-95">
            <Send size={16} /> Bagikan lewat WhatsApp
          </button>
        </div>
      </section>
    </div>
  );
}
