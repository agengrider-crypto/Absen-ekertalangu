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
  const guestCount = (rekap.guests || []).length;
  const counts = rekap.counts || {};
  const genderStatus = rekap.gender_status || {};
  const statuses = [
    { key: "hadir", label: "Hadir", color: "bg-[#0D5C3A]", text: "text-[#14532D]", bg: "bg-[#E8F5EE]" },
    { key: "izin", label: "Izin", color: "bg-[#D97706]", text: "text-[#92400E]", bg: "bg-[#FEF3C7]" },
    { key: "sakit", label: "Sakit", color: "bg-[#2563EB]", text: "text-[#1D4ED8]", bg: "bg-[#DBEAFE]" },
    { key: "alpha", label: "Alpha", color: "bg-[#DC2626]", text: "text-[#991B1B]", bg: "bg-[#FEE2E2]" },
  ];

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
        <h3 className="mb-1 inline-flex items-center gap-2 font-bold text-[#111827]">
          <FileBarChart2 size={18} /> Rekap Kehadiran
        </h3>
        <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-bold text-[#111114]">{counts.total || 0}</span>
          <span className="text-sm text-[#4B5563]">peserta dan tamu</span>
          <span className="ml-auto text-lg font-bold text-[#0D5C3A]">{counts.ratio || 0}% hadir</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2" data-testid={ACTIVITIES.recapGraph}>
          {statuses.map((status) => {
            const value = Number(counts[status.key]) || 0;
            const percent = counts.total ? Math.min((value / counts.total) * 100, 100) : 0;
            return (
              <div key={status.key} className={`rounded-xl ${status.bg} p-3`} data-testid={`detail-rekap-status-${status.key}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-bold ${status.text}`}>{status.label}</span>
                  <span className={`text-lg font-bold ${status.text}`}>{value}</span>
                </div>
                <div className="mt-1 text-xs text-[#4B5563]">
                  Laki-laki {genderStatus.L?.[status.key] || 0} · Perempuan {genderStatus.P?.[status.key] || 0}
                  {status.key === "hadir" && guestCount ? ` · Tamu ${guestCount}` : ""}
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
                  <div className={`h-full rounded-full ${status.color} transition-all duration-700 ease-out`}
                    style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
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
