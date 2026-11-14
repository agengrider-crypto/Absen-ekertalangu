// Absen Kelas — pilih pertemuan, tandai Hadir/Izin/Sakit/Alpha, simpan materi hari ini.
// Memakai ulang endpoint rekap & absen yang sudah ada (logika absensi sama).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, CheckCircle2, BookOpen, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { nowWita, tanggalPanjang, hhmm } from "@/pages/admin/kegiatanUtils";

const STATUS_BTN = {
  hadir: { label: "Hadir", on: "bg-[#14633F] text-white", off: "text-[#14633F]" },
  izin: { label: "Izin", on: "bg-[#8A5A00] text-white", off: "text-[#6B4500]" },
  sakit: { label: "Sakit", on: "bg-[#1D4F91] text-white", off: "text-[#1D4F91]" },
  alpha: { label: "Alpha", on: "bg-[#A32A2A] text-white", off: "text-[#A32A2A]" },
};

export default function GuruAbsenKelas({ initialId = null }) {
  const [pertemuan, setPertemuan] = useState(null);
  const [pick, setPick] = useState(initialId);
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(null);
  const [materi, setMateri] = useState(null);
  const [materiPick, setMateriPick] = useState("");
  const [tersampaikan, setTersampaikan] = useState(false);
  const [savingMateri, setSavingMateri] = useState(false);
  const today = nowWita().date;

  useEffect(() => {
    api.get("/guru/pertemuan").then(({ data: d }) => {
      const items = d.items || [];
      setPertemuan(items);
      if (!pick) {
        const hariIni = items.find((k) => k.date === today);
        setPick(hariIni?.id || items[0]?.id || null);
      }
    }).catch(() => setPertemuan([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(() => {
    if (!pick) return;
    setData(null);
    api.get(`/guru/pertemuan/${pick}/rekap`)
      .then(({ data: d }) => setData(d))
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));
    api.get(`/guru/pertemuan/${pick}/materi`)
      .then(({ data: d }) => {
        setMateri(d);
        setMateriPick(d.materi_id || d.saran?.id || "");
        setTersampaikan(Boolean(d.materi_tersampaikan));
      })
      .catch(() => setMateri(false));
  }, [pick]);

  useEffect(() => { load(); }, [load]);

  const mark = async (userId, status) => {
    setBusy(userId + status);
    try {
      const { data: res } = await api.post(`/guru/pertemuan/${pick}/absen`, { user_id: userId, status });
      if (res?.message) toast.success(res.message);
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setBusy(null); }
  };

  const simpanMateri = async () => {
    setSavingMateri(true);
    try {
      await api.post(`/guru/pertemuan/${pick}/materi`, {
        materi_id: materiPick || null, materi_tersampaikan: tersampaikan,
      });
      toast.success("Materi pertemuan disimpan.");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSavingMateri(false); }
  };

  const rows = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    return t ? data.rows.filter((r) => (r.name || "").toLowerCase().includes(t)) : data.rows;
  }, [data, q]);

  const k = data?.kegiatan;
  const c = data?.counts || {};
  const alphaAllowed = Boolean(k && (
    k.status !== "open" || Date.now() >= Date.parse(`${k.date}T${k.end_time}:00+08:00`)
  ));

  if (pertemuan === null) {
    return <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>;
  }

  return (
    <div className="space-y-4" data-testid="guru-absen-kelas">
      <div>
        <h1 className="font-heading text-xl font-bold text-[#14201A]">Absen Kelas</h1>
        <p className="mt-1 text-sm text-[#5F6B63]">Pilih pertemuan lalu tandai kehadiran peserta.</p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-[#14201A]">Pertemuan</span>
        <div className="relative">
          <select data-testid="guru-absen-pilih" value={pick || ""} onChange={(e) => setPick(e.target.value)}
            className="h-12 w-full appearance-none rounded-xl border border-[#8A948D] bg-white px-3.5 pr-10 text-[15px] outline-none focus:border-[#14633F]">
            {pertemuan.length === 0 && <option value="">Belum ada pertemuan</option>}
            {pertemuan.map((p) => (
              <option key={p.id} value={p.id}>
                {tanggalPanjang(p.date)} · {p.start_time}–{p.end_time} · {p.name}
              </option>
            ))}
          </select>
          <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
        </div>
      </label>

      {!pick ? null : !data ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={26} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="rounded-xl bg-[#F0EEE6] p-3 text-center"><div className="text-xl font-bold text-[#14201A]">{c.total}</div><div className="text-xs text-[#5F6B63]">Total</div></div>
            <div className="rounded-xl bg-[#E3F3EA] p-3 text-center"><div className="text-xl font-bold text-[#0E4E31]">{c.hadir}</div><div className="text-xs text-[#5F6B63]">Hadir</div></div>
            <div className="rounded-xl bg-[#FBF1D6] p-3 text-center"><div className="text-xl font-bold text-[#6B4500]">{c.izin}</div><div className="text-xs text-[#5F6B63]">Izin</div></div>
            <div className="rounded-xl bg-[#E3EEFB] p-3 text-center"><div className="text-xl font-bold text-[#1D4F91]">{c.sakit || 0}</div><div className="text-xs text-[#5F6B63]">Sakit</div></div>
            <div className="rounded-xl bg-[#FBE5E3] p-3 text-center"><div className="text-xl font-bold text-[#A32A2A]">{c.alpha}</div><div className="text-xs text-[#5F6B63]">Alpha</div></div>
          </div>

          {/* Materi hari ini */}
          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="guru-materi">
            <div className="flex items-center gap-2 text-sm font-bold text-[#14201A]">
              <BookOpen size={16} className="text-[#0E4E31]" /> Materi hari ini
            </div>
            {materi === null ? (
              <div className="py-4 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={20} /></div>
            ) : materi === false ? (
              <p className="mt-2 text-sm text-[#5F6B63]">Materi belum tersedia.</p>
            ) : (
              <div className="mt-2 space-y-2">
                <select data-testid="guru-materi-pilih" value={materiPick} onChange={(e) => setMateriPick(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[#8A948D] bg-white px-3 text-sm outline-none focus:border-[#14633F]">
                  <option value="">Pilih materi</option>
                  {materi.pilihan.map((m) => (
                    <option key={m.id} value={m.id}>{m.pekan ? `Pekan ${m.pekan} · ` : ""}{m.title}</option>
                  ))}
                </select>
                {materi.saran && !materi.materi_id && (
                  <p className="text-[11px] text-[#5F6B63]">Disarankan: {materi.saran.title}</p>
                )}
                <label className="flex items-center gap-2.5 text-sm text-[#14201A]">
                  <input type="checkbox" data-testid="guru-materi-tersampaikan" checked={tersampaikan}
                    onChange={(e) => setTersampaikan(e.target.checked)} className="h-4 w-4 accent-[#14633F]" />
                  Materi tersampaikan
                </label>
                <button type="button" data-testid="guru-materi-simpan" onClick={simpanMateri} disabled={savingMateri}
                  className="h-10 rounded-xl bg-[#14633F] px-3.5 text-sm font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60">
                  {savingMateri ? "Menyimpan…" : "Simpan materi"}
                </button>
              </div>
            )}
          </div>

          {/* Daftar peserta */}
          <div className="overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white">
            <div className="flex items-center gap-2 border-b border-[#E7E3D8] bg-[#F6F4EE] p-3">
              <CheckCircle2 size={16} className="text-[#0E4E31]" />
              <span className="text-sm font-bold text-[#14201A]">Daftar peserta</span>
            </div>
            <div className="p-3">
              <div className="relative">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
                <input data-testid="guru-absen-cari" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Cari nama peserta..." className="h-11 w-full rounded-xl border border-[#8A948D] bg-white pl-11 pr-4 outline-none focus:border-[#14633F]" />
              </div>
            </div>
            <div className="max-h-[52vh] divide-y divide-[#E7E3D8] overflow-y-auto">
              {rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#5F6B63]">Tidak ada peserta.</div>
              ) : rows.map((r) => (
                <div key={r.user_id} data-testid={`guru-absen-row-${r.user_id}`} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#14201A]">{r.name}</div>
                    <div className="text-xs text-[#5F6B63]">
                      {r.status === "hadir" && r.arrival_time ? hhmm(r.arrival_time) : "—"}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {["hadir", "izin", "sakit", "alpha"].map((s) => {
                      const active = r.status === s;
                      const cfg = STATUS_BTN[s];
                      return (
                        <button key={s} type="button"
                          data-testid={`guru-btn-${s}-${r.user_id}`}
                          disabled={busy === r.user_id + s || (s === "alpha" && !alphaAllowed)}
                          onClick={() => mark(r.user_id, s)}
                          title={s === "alpha" && !alphaAllowed ? "Alpha tersedia setelah kegiatan berakhir" : cfg.label}
                          className={`h-10 w-10 rounded-full border-2 text-[11px] font-bold transition-colors ${active ? `${cfg.on} border-transparent` : `bg-white ${cfg.off} border-[#D9D4C5] hover:border-current`}`}>
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
