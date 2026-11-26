import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, FileBarChart2, Users, CheckCircle2, RefreshCw, Radio } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ACTIVITIES } from "@/constants/testIds";

/** Selisih jam server vs jam perangkat (ms) dari header `Date`. */
function serverOffset(res) {
  const raw = res?.headers?.date;
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t - Date.now();
}

/** "14:05" WITA dari ISO. */
function jamWita(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/** Sisa waktu "1 jam 12 menit" / "8 menit" / "kurang dari 1 menit". */
function sisaWaktu(ms) {
  if (ms <= 0) return null;
  const menit = Math.floor(ms / 60000);
  if (menit < 1) return "kurang dari 1 menit";
  const jam = Math.floor(menit / 60);
  const sisaMenit = menit % 60;
  if (jam && sisaMenit) return `${jam} jam ${sisaMenit} menit`;
  if (jam) return `${jam} jam`;
  return `${menit} menit`;
}

const POLL_MS = 30000;
const IDLE_MS = 20 * 60 * 1000;

export default function KegiatanRekapPanel({ kegiatanId }) {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.roles?.includes("admin"));
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [diperbarui, setDiperbarui] = useState(null);
  const [segar, setSegar] = useState(false);
  const [auto, setAuto] = useState(false);
  const [sisa, setSisa] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const etagRef = useRef(null);
  const backoffRef = useRef(0);
  const lastActiveRef = useRef(Date.now());

  const load = useCallback(async (silent = false) => {
    if (!silent) { setData(null); setError(""); }
    try {
      const res = await api.get(`/admin/kegiatan/${kegiatanId}/rekap`);
      setData({ rekap: res.data });
      setOffset(serverOffset(res));
      setDiperbarui(new Date().toISOString());
      setError("");
      backoffRef.current = 0;
    } catch (e) {
      const message = formatApiErrorDetail(e.response?.data?.detail);
      if (!silent) { setError(message); toast.error(message); }
    }
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  // Jam berjalan untuk hitung mundur (1 detik).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Pembaruan otomatis (khusus admin, hanya saat kegiatan berlangsung).
  useEffect(() => {
    if (!auto || !isAdmin) return undefined;
    let stopped = false;
    let timer = null;

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState !== "visible"
          || Date.now() - lastActiveRef.current > IDLE_MS) {
        timer = setTimeout(tick, POLL_MS);
        return;
      }
      try {
        const res = await api.get(`/admin/kegiatan/${kegiatanId}/ringkasan`, {
          headers: etagRef.current ? { "If-None-Match": etagRef.current } : {},
          validateStatus: (s) => s === 200 || s === 304,
        });
        if (res.status === 200) {
          etagRef.current = res.headers?.etag || null;
          setData((prev) => (prev ? { ...prev, rekap: { ...prev.rekap, counts: res.data.counts, guests: prev.rekap.guests } } : prev));
          setDiperbarui(new Date().toISOString());
          setSegar(true);
          setTimeout(() => setSegar(false), 1500);
        }
        backoffRef.current = 0;
      } catch {
        backoffRef.current = Math.min(backoffRef.current + 1, 2);
      }
      const wait = [POLL_MS, 60000, 120000][backoffRef.current] || POLL_MS;
      timer = setTimeout(tick, wait);
    };

    const onActive = () => { lastActiveRef.current = Date.now(); };
    const onVisible = () => { if (document.visibilityState === "visible") lastActiveRef.current = Date.now(); };
    window.addEventListener("pointerdown", onActive);
    window.addEventListener("keydown", onActive);
    document.addEventListener("visibilitychange", onVisible);
    timer = setTimeout(tick, POLL_MS);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("pointerdown", onActive);
      window.removeEventListener("keydown", onActive);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [auto, isAdmin, kegiatanId]);

  // Hitung mundur 5 menit sejak pembaruan terakhir.
  useEffect(() => {
    if (!diperbarui) { setSisa(null); return; }
    const target = Date.parse(diperbarui) + 5 * 60 * 1000;
    setSisa(sisaWaktu(target - (now + offset)));
  }, [diperbarui, now, offset]);

  if (!data && !error) {
    return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;
  }
  if (error) {
    return (
      <div className="rounded-2xl border border-[#FBE5E3] bg-white p-8 text-center" data-testid={ACTIVITIES.recapError}>
        <p className="text-sm text-[#5F6B63]">{error}</p>
        <button type="button" onClick={() => load()} className="mt-3 min-h-11 rounded-xl bg-[#14633F] px-4 font-semibold text-white">Coba lagi</button>
      </div>
    );
  }

  const { rekap } = data;
  const berlangsung = (rekap.kegiatan?.status || "open") === "open";
  const hadirRows = (rekap.rows || []).filter((row) => row.status === "hadir" && !row.attended_other);  const absentStatuses = [
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

  return (
    <div className="space-y-4" data-testid="detail-rekap-panel">
      <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="inline-flex items-center gap-2 font-bold text-[#14201A]">
            <FileBarChart2 size={18} /> Rekap Kehadiran
          </h3>
          <button
            type="button"
            data-testid="rekap-segarkan"
            onClick={() => load(true)}
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#E7E3D8] px-3 text-xs font-semibold text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]"
          >
            <RefreshCw size={14} className={segar ? "text-[#14633F]" : ""} /> Segarkan
          </button>
        </div>
        <p className="mb-3 text-xs text-[#5F6B63]" data-testid="rekap-diperbarui">
          Diperbarui {jamWita(diperbarui)} WITA
          {berlangsung && sisa ? ` · perbarui lagi dalam ${sisa}` : ""}
          {!berlangsung ? " · kegiatan sudah selesai" : ""}
        </p>
        {isAdmin && berlangsung && (
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-[#F6F4EE] px-3 py-2.5">
            <Radio size={16} className={auto ? "text-[#14633F]" : "text-[#8A948D]"} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[#14201A]">Perbarui otomatis</div>
              <div className="text-xs text-[#5F6B63]">Angka hadir diperbarui tiap 30 detik selama halaman terbuka.</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={auto}
              aria-label="Perbarui otomatis"
              data-testid="rekap-auto"
              onClick={() => setAuto((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${auto ? "bg-[#14633F]" : "bg-[#D9D4C5]"}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${auto ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        )}
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
    </div>
  );
}
