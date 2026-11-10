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
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-[#FBE5E3] bg-white p-8 text-center" data-testid={ACTIVITIES.recapError}>
        <p className="text-sm text-[#5F6B63]">{error}</p>
        <button type="button" onClick={load} className="mt-3 min-h-11 rounded-xl bg-[#14633F] px-4 font-semibold text-white">Coba lagi</button>
      </div>
    );
  }

  const { link, rekap } = data;
  const hadirRows = (rekap.rows || []).filter((row) => row.status === "hadir" && !row.attended_other);
  const absentStatuses = [
    { key: "izin", label: "Izin", color: "text-[#6B4500]", bg: "bg-[#FBF1D6]" },
    { key: "sakit", label: "Sakit", color: "text-[#1D4F91]", bg: "bg-[#E3EEFB]" },
    { key: "alpha", label: "Alpha", color: "text-[#A32A2A]", bg: "bg-[#FBE5E3]" },
  ].map((status) => ({
    ...status,
    rows: (rekap.rows || []).filter((row) => row.status === status.key && !row.attended_other),
  }));
  const guestCount = (rekap.guests || []).length;
  const counts = rekap.counts || {};
  const genderStatus = rekap.gender_status || {};
  const statuses = [
    { key: "hadir", label: "Hadir", color: "bg-[#14633F]", text: "text-[#0E4E31]", bg: "bg-[#E3F3EA]" },
    { key: "izin", label: "Izin", color: "bg-[#8A5A00]", text: "text-[#6B4500]", bg: "bg-[#FBF1D6]" },
    { key: "sakit", label: "Sakit", color: "bg-[#1D4F91]", text: "text-[#1D4F91]", bg: "bg-[#E3EEFB]" },
    { key: "alpha", label: "Alpha", color: "bg-[#A32A2A]", text: "text-[#A32A2A]", bg: "bg-[#FBE5E3]" },
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
      || `Berikut rekap kehadiran kegiatan\n${link.link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4" data-testid="detail-rekap-panel">
      <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5">
        <h3 className="mb-1 inline-flex items-center gap-2 font-bold text-[#14201A]">
          <FileBarChart2 size={18} /> Rekap Kehadiran
        </h3>
        <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-bold text-[#0E4E31]">{counts.total || 0}</span>
          <span className="text-sm text-[#5F6B63]">peserta dan tamu</span>
          <span className="ml-auto text-lg font-bold text-[#0E4E31]">{counts.ratio || 0}% hadir</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2" data-testid={ACTIVITIES.recapGraph}>
          {statuses.map((status, index) => {
            const value = Number(counts[status.key]) || 0;
            const percent = counts.total ? Math.min((value / counts.total) * 100, 100) : 0;
            return (
              <div key={status.key} className={`rounded-xl ${status.bg} p-3`} data-testid={`detail-rekap-status-${status.key}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-bold ${status.text}`}>{status.label}</span>
                  <span className={`text-lg font-bold ${status.text}`}>{value}</span>
                </div>
                <div className="mt-1 text-xs text-[#5F6B63]">
                  Laki-laki {genderStatus.L?.[status.key] || 0} · Perempuan {genderStatus.P?.[status.key] || 0}
                  {status.key === "hadir" && guestCount ? ` · Tamu ${guestCount}` : ""}
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
                  <div className={`h-full origin-left rounded-full ${status.color} motion-safe:animate-[rekap-bar-grow_700ms_ease-out_both]`}
                    style={{ width: `${percent}%`, animationDelay: `${index * 90}ms` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5" data-testid={ACTIVITIES.recapAbsentees}>
        <h3 className="mb-3 inline-flex items-center gap-2 font-bold text-[#14201A]">
          <Users size={17} /> Peserta Tidak Hadir
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {absentStatuses.map((status) => (
            <div key={status.key} className="overflow-hidden rounded-xl border border-[#E7E3D8]">
              <div className={`flex items-center justify-between px-3 py-2 ${status.bg}`}>
                <span className={`font-bold ${status.color}`}>{status.label}</span>
                <span className={`text-sm font-bold ${status.color}`}>{status.rows.length}</span>
              </div>
              {status.rows.length ? (
                <ul className="max-h-48 divide-y divide-[#E7E3D8] overflow-y-auto">
                  {status.rows.map((row) => (
                    <li key={row.user_id} className="px-3 py-2.5 text-sm font-medium text-[#14201A]">
                      <span className="block truncate">{row.name}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-4 text-center text-sm text-[#5F6B63]">Tidak ada peserta.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white" data-testid={ACTIVITIES.recapAttendees}>
        <div className="flex items-center justify-between border-b border-[#E7E3D8] px-4 py-3">
          <h3 className="inline-flex items-center gap-2 font-bold text-[#14201A]">
            <Users size={17} /> Peserta Hadir
          </h3>
          <span className="rounded-full bg-[#E3F3EA] px-2.5 py-1 text-xs font-bold text-[#0E4E31]">{hadirRows.length + (rekap.guests || []).length}</span>
        </div>
        {hadirRows.length || rekap.guests?.length ? (
          <ul className="max-h-72 divide-y divide-[#E7E3D8] overflow-y-auto">
            {hadirRows.map((row) => (
              <li key={row.user_id} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle2 size={17} className="shrink-0 text-[#0E4E31]" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#14201A]">{row.name}</span>
                <span className="text-xs text-[#5F6B63]">{row.gender === "L" ? "Laki-laki" : row.gender === "P" ? "Perempuan" : "Peserta"}</span>
              </li>
            ))}
            {(rekap.guests || []).map((guest) => (
              <li key={guest.id} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle2 size={17} className="shrink-0 text-[#0E4E31]" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#14201A]">{guest.name}</span>
                <span className="text-xs text-[#5F6B63]">Tamu</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-center text-sm text-[#5F6B63]">Belum ada peserta yang tercatat hadir.</p>
        )}
      </section>

      <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5" data-testid={ACTIVITIES.recapShare}>
        <h3 className="font-bold text-[#14201A]">Bagikan tautan rekap</h3>
        <p className="mt-1 text-sm text-[#5F6B63]">Tautan publik berlaku 7 hari. Tidak ada barcode pada bagian ini.</p>
        <a href={link.link} target="_blank" rel="noreferrer" data-testid="detail-rekap-link"
          className="mt-3 block break-all rounded-xl bg-[#F6F4EE] p-3 text-sm font-semibold text-[#0E4E31] hover:underline">
          <ExternalLink size={15} className="mr-1 inline" />{link.link}
        </a>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button type="button" data-testid="detail-rekap-copy" onClick={copyLink}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-[#14633F] font-semibold text-[#0E4E31] hover:bg-[#E3F3EA]">
            <Copy size={16} /> Salin Tautan
          </button>
          <button type="button" data-testid="detail-rekap-wa" onClick={shareWa}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#14633F] font-semibold text-white hover:brightness-95">
            <Send size={16} /> Bagikan lewat WhatsApp
          </button>
        </div>
      </section>
    </div>
  );
}
