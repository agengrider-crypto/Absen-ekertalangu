import { useCallback, useEffect, useMemo, useState } from "react";
import {
  X, Loader2, Layers, Search, CalendarDays, Clock, MapPin, User, Copy,
  Plus, Trash2, AlertTriangle, ClipboardCopy, Link2, Send,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { PercentBar } from "@/pages/PublicRekapGabungan";
import { tanggalPanjang, tanggalSingkat, hhmm, TYPE_LABEL, TYPE_COLOR } from "./kegiatanUtils";

function Shell({ title, subtitle, children, onClose, testid, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className={`bg-[#FAFBF9] w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl`} onClick={(e) => e.stopPropagation()} data-testid={testid}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E5E7EB] px-5 py-3.5 flex items-center justify-between z-10 gap-3">
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-[#111827] truncate">{title}</h2>
            {subtitle && <p className="text-xs text-[#6B7280] truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F2F5F2]" data-testid={`${testid}-close`}><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const ST = {
  hadir: { t: "H", cls: "bg-[#0D5C3A] text-white", title: "Hadir" },
  izin: { t: "I", cls: "bg-[#D97706] text-white", title: "Izin" },
  alpha: { t: "A", cls: "bg-[#FEE2E2] text-[#991B1B]", title: "Alpha" },
};

/**
 * FASE 10 — REKAP GABUNGAN 1 HARI: menggabungkan kehadiran semua sesi
 * (pagi / sore / malam) dalam satu ringkasan, dengan tetap menampilkan
 * kolom per sesi sehingga terlihat siapa hadir di sesi mana.
 */
export function RekapGabunganModal({ kegiatanId, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("semua"); // semua | hadir | tidak
  const [share, setShare] = useState(null);
  const [sharing, setSharing] = useState(false);

  const getLink = async () => {
    if (share) return share;
    setSharing(true);
    try {
      const { data: d } = await api.post(`/admin/kegiatan/${kegiatanId}/share-gabungan`);
      setShare(d);
      return d;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Gagal membuat tautan");
      return null;
    } finally { setSharing(false); }
  };

  const copyLink = async () => {
    const d = await getLink();
    if (!d) return;
    try {
      await navigator.clipboard.writeText(d.link);
      toast.success("Tautan rekap gabungan disalin.");
    } catch { toast.info("Tautan siap disalin manual dari kotak di atas."); }
  };

  const shareWa = async () => {
    const d = await getLink();
    if (!d) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(d.wa_text)}`, "_blank");
  };

  const load = useCallback(() => {
    setErr("");
    api.get(`/admin/kegiatan/${kegiatanId}/rekap-gabungan`)
      .then(({ data: d }) => setData(d))
      .catch((e) => setErr(formatApiErrorDetail(e.response?.data?.detail) || "Gagal memuat rekap gabungan"));
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    let list = data.rows;
    if (mode === "hadir") list = list.filter((r) => r.hadir > 0);
    else if (mode === "tidak") list = list.filter((r) => r.hadir === 0);
    return t ? list.filter((r) => (r.name || "").toLowerCase().includes(t)) : list;
  }, [data, q, mode]);

  const copyText = async () => {
    if (!data) return;
    const s = data.summary;
    const lines = [
      `*REKAP GABUNGAN ${String(data.base_name || "").toUpperCase()}*`,
      tanggalPanjang(data.date),
      "",
      ...data.sessions.map((x) => `• ${x.label} (${x.start_time}–${x.end_time}): Hadir ${x.counts.hadir} / ${x.counts.total} (${x.counts.ratio}%)`),
      "",
      `Total jamaah: ${s.total}`,
      `Hadir minimal 1 sesi: ${s.hadir_min_1} (${s.ratio_min_1}%)`,
      `Hadir semua sesi: ${s.hadir_semua} (${s.ratio_semua}%)`,
      `Izin (tidak hadir sama sekali): ${s.izin_saja}`,
      `Tidak hadir sama sekali: ${s.tidak_hadir}`,
      ...(s.tamu ? [`Tamu: ${s.tamu}`] : []),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Ringkasan gabungan disalin — siap ditempel ke WhatsApp.");
    } catch { toast.error("Gagal menyalin teks"); }
  };

  const s = data?.summary;

  return (
    <Shell title="Rekap Gabungan 1 Hari" subtitle={data ? `${data.base_name} · ${tanggalPanjang(data.date)}` : ""} onClose={onClose} testid="modal-rekap-gabungan" wide>
      {err && !data ? (
        <div className="p-8 text-center">
          <p className="text-sm text-[#DC2626] mb-3" data-testid="rekap-gabungan-error">{err}</p>
          <button onClick={load} className="h-10 px-4 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-sm">Coba lagi</button>
        </div>
      ) : !data ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={28} /></div>
      ) : (
        <div className="space-y-4">
          {/* Ringkasan gabungan */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="rekap-gabungan-summary">
            <div className="rounded-xl bg-[#F2F5F2] p-3 text-center"><div className="text-xl font-bold text-[#111827]">{s.total}</div><div className="text-xs text-[#6B7280]">Total Jamaah</div></div>
            <div className="rounded-xl bg-[#E8F5EE] p-3 text-center"><div className="text-xl font-bold text-[#065F46]">{s.hadir_min_1} <span className="text-xs font-semibold">({s.ratio_min_1}%)</span></div><div className="text-xs text-[#6B7280]">Hadir ≥ 1 Sesi</div></div>
            <div className="rounded-xl bg-[#DCFCE7] p-3 text-center"><div className="text-xl font-bold text-[#14532D]">{s.hadir_semua} <span className="text-xs font-semibold">({s.ratio_semua}%)</span></div><div className="text-xs text-[#6B7280]">Hadir Semua Sesi</div></div>
            <div className="rounded-xl bg-[#FEE2E2] p-3 text-center"><div className="text-xl font-bold text-[#991B1B]">{s.tidak_hadir}</div><div className="text-xs text-[#6B7280]">Tidak Hadir Sama Sekali</div></div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
            <span className="px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] font-semibold">Izin saja: {s.izin_saja}</span>
            {s.tamu > 0 && <span className="px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#3730A3] font-semibold">Tamu: {s.tamu}</span>}
            {(data.filter_labels || []).map((l) => <span key={l} className="px-2 py-0.5 rounded-full bg-[#FDF2F8] text-[#9D174D] font-semibold">{l}</span>)}
            <span className="inline-flex items-center gap-1"><Layers size={12} /> {data.sessions.length} sesi</span>
          </div>

          {/* Bar persen ringkasan gabungan */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-3.5" data-testid="rekap-gabungan-bars">
            <PercentBar label="Hadir minimal 1 sesi" value={s.ratio_min_1} sub={`${s.hadir_min_1}/${s.total}`} testid="gab-bar-min1" />
            <PercentBar label="Hadir semua sesi" value={s.ratio_semua} sub={`${s.hadir_semua}/${s.total}`} color="#14532D" testid="gab-bar-semua" />
          </div>

          {/* Per sesi + bar persen */}
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-3.5" data-testid="rekap-gabungan-per-sesi">
            <div className="text-sm font-semibold text-[#111827]">Kehadiran per Sesi</div>
            {data.sessions.map((x) => (
              <div key={x.id}>
                <PercentBar label={`${x.label} · ${x.start_time}–${x.end_time} WITA`} value={x.counts.ratio}
                  sub={`${x.counts.hadir}/${x.counts.total}`} testid={`gab-bar-sesi-${x.id}`} />
                <div className="text-[11px] text-[#9CA3AF] mt-1 flex flex-wrap gap-x-3">
                  <span>H {x.counts.hadir}</span><span>I {x.counts.izin}</span><span>A {x.counts.alpha}</span>
                  {x.counts.sudah_sesi_lain > 0 && <span>Sudah hadir sesi lain {x.counts.sudah_sesi_lain}</span>}
                  {x.teacher && <span className="inline-flex items-center gap-1"><User size={11} /> {x.teacher}</span>}
                  {x.location && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {x.location}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Bagikan sebagai LINK (seperti rekap kegiatan biasa) */}
          <div className="rounded-2xl border-2 border-[#CDEBD9] bg-[#F0FAF4] p-4 space-y-2.5" data-testid="rekap-gabungan-share">
            <div className="text-sm font-bold text-[#065F46] inline-flex items-center gap-1.5"><Link2 size={15} /> Bagikan rekap ini sebagai tautan</div>
            <p className="text-[11px] text-[#065F46]/80 leading-relaxed">
              Tautan publik berisi bar persentase kehadiran semua sesi — bisa dibuka siapa pun tanpa login (berlaku 7 hari).
            </p>
            {share && (
              <div className="text-[11px] font-mono break-all bg-white rounded-lg border border-[#CDEBD9] px-2.5 py-2 text-[#065F46]" data-testid="rekap-gabungan-link">{share.link}</div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={shareWa} disabled={sharing} data-testid="rekap-gabungan-share-wa"
                className="h-11 rounded-xl bg-[#25D366] text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:brightness-95 disabled:opacity-60">
                {sharing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Bagikan ke WhatsApp
              </button>
              <button onClick={copyLink} disabled={sharing} data-testid="rekap-gabungan-copy-link"
                className="h-11 rounded-xl border-2 border-[#0D5C3A] text-[#0D5C3A] font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#E8F5EE] disabled:opacity-60">
                <Link2 size={15} /> Salin Tautan
              </button>
            </div>
          </div>

          <button onClick={copyText} data-testid="rekap-gabungan-copy"
            className="w-full h-11 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] font-semibold text-sm inline-flex items-center justify-center gap-2 hover:border-[#0D5C3A] hover:text-[#0D5C3A]">
            <ClipboardCopy size={16} /> Salin Ringkasan (teks WhatsApp)
          </button>

          {/* Tabel jamaah × sesi */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
            <div className="p-3 bg-[#FAFBF9] flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input data-testid="rekap-gabungan-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama jamaah..." className="w-full h-10 pl-10 pr-3 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] bg-white" />
              </div>
              <div className="flex gap-1 bg-white border border-[#E5E7EB] rounded-xl p-1">
                {[["semua", "Semua"], ["hadir", "Hadir ≥1"], ["tidak", "Tidak hadir"]].map(([v, l]) => (
                  <button key={v} type="button" data-testid={`rekap-gabungan-mode-${v}`} onClick={() => setMode(v)}
                    className={`h-8 px-3 rounded-lg text-xs font-semibold ${mode === v ? "bg-[#E8F5EE] text-[#065F46]" : "text-[#6B7280]"}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto max-h-[46vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#F8FAF8] text-[#6B7280] text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Nama</th>
                    {data.sessions.map((x) => <th key={x.id} className="px-2 py-2 font-semibold text-center whitespace-nowrap">{x.label}</th>)}
                    <th className="px-2 py-2 font-semibold text-center">Hadir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F2F0]">
                  {rows.length === 0 ? (
                    <tr><td colSpan={data.sessions.length + 2} className="p-8 text-center text-[#6B7280]">Tidak ada jamaah.</td></tr>
                  ) : rows.map((r) => (
                    <tr key={r.user_id} data-testid={`rekap-gabungan-row-${r.user_id}`}>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-[#111827] truncate max-w-[180px] sm:max-w-none">{r.name}</div>
                        <div className="text-[11px] text-[#9CA3AF]">{r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : "—"}</div>
                      </td>
                      {r.sessions.map((c, i) => (
                        <td key={i} className="px-2 py-2 text-center">
                          {c === null ? (
                            <span className="text-[#D1D5DB]" title="Tidak termasuk daftar sesi ini">—</span>
                          ) : (
                            <span title={ST[c.status]?.title} className={`inline-flex flex-col items-center justify-center min-w-[30px] h-7 px-1.5 rounded-lg text-[11px] font-bold ${ST[c.status]?.cls || ""}`}>
                              {ST[c.status]?.t}
                              {c.status === "hadir" && c.arrival_time && <span className="text-[9px] font-medium leading-none">{hhmm(c.arrival_time)}</span>}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center font-bold tabular-nums text-[#0D5C3A]">{r.hadir}/{r.eligible}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
            <b>H</b> hadir · <b>I</b> izin · <b>A</b> alpha · <b>—</b> tidak termasuk daftar sesi tersebut.
            Angka per sesi tetap tercatat terpisah; ringkasan ini hanya menggabungkannya untuk 1 hari.
          </p>
        </div>
      )}
    </Shell>
  );
}

function addDays(ymd, n) {
  const [y, m, d] = String(ymd).split("-").map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * FASE 10 — SALIN JADWAL: menyalin pola sesi (pagi/sore/malam + jam, pengajar,
 * lokasi, penyaringan peserta) ke tanggal lain. Absensi tidak ikut disalin.
 */
export function SalinJadwalModal({ group, onClose, onDone }) {
  const items = group?.items || [];
  const first = items[0] || {};
  const [dates, setDates] = useState([addDays(first.date, 7)]);
  const [saving, setSaving] = useState(false);

  const setDate = (i, v) => setDates((p) => p.map((d, idx) => (idx === i ? v : d)));
  const addDate = () => setDates((p) => (p.length >= 12 ? p : [...p, addDays(p[p.length - 1] || first.date, 7)]));
  const removeDate = (i) => setDates((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== i)));
  const quick = (n) => setDates([addDays(first.date, n)]);
  const mingguan = (n) => setDates(Array.from({ length: n }, (_, i) => addDays(first.date, 7 * (i + 1))));

  const submit = async (e) => {
    e.preventDefault();
    const clean = Array.from(new Set(dates.filter(Boolean)));
    if (!clean.length) { toast.error("Pilih minimal 1 tanggal tujuan"); return; }
    if (clean.includes(first.date)) { toast.error("Tanggal tujuan sama dengan tanggal asal"); return; }
    setSaving(true);
    try {
      const { data } = await api.post(`/admin/kegiatan/${first.id}/salin`, { dates: clean });
      toast.success(data.message || "Jadwal disalin.");
      onDone && onDone(data);
    } catch (e2) {
      toast.error(formatApiErrorDetail(e2.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const chip = "h-9 px-3 rounded-full border-2 border-[#E5E7EB] bg-white text-xs font-semibold text-[#4B5563] hover:border-[#0D5C3A] hover:text-[#0D5C3A]";

  return (
    <Shell title="Salin Jadwal ke Tanggal Lain" subtitle={`${first.base_name || first.name} · ${tanggalSingkat(first.date)}`} onClose={onClose} testid="modal-salin-jadwal">
      <form onSubmit={submit} className="space-y-4">
        {/* Pola yang akan disalin */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-3.5" data-testid="salin-pola">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[first.type]}1a`, color: TYPE_COLOR[first.type] }}>{TYPE_LABEL[first.type]}</span>
            {items.length > 1 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] inline-flex items-center gap-1"><Layers size={12} /> {items.length} Waktu / Sesi</span>
            )}
            {(first.filter_labels || []).map((l) => <span key={l} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FDF2F8] text-[#9D174D]">{l}</span>)}
          </div>
          <div className="font-bold text-[#111827] mt-1.5">{first.base_name || first.name}</div>
          <div className="text-xs text-[#6B7280] mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {first.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {first.location}</span>}
            {first.teacher && <span className="inline-flex items-center gap-1"><User size={12} /> {first.teacher}</span>}
          </div>
          <div className="mt-2 grid gap-1">
            {items.map((k) => (
              <div key={k.id} className="text-xs text-[#4B5563] inline-flex items-center gap-1.5 rounded-lg bg-[#FAFBF9] px-2.5 py-1.5">
                <Clock size={12} className="text-[#0D5C3A]" />
                <b className="text-[#0D5C3A]">{k.session_label || "Jadwal"}</b> {k.start_time}–{k.end_time} WITA
              </div>
            ))}
          </div>
        </div>

        {/* Tanggal tujuan */}
        <div>
          <label className="block text-sm font-semibold text-[#111827] mb-1.5">Tanggal Tujuan</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button type="button" data-testid="salin-quick-1" className={chip} onClick={() => quick(1)}>Besok</button>
            <button type="button" data-testid="salin-quick-7" className={chip} onClick={() => quick(7)}>Minggu depan</button>
            <button type="button" data-testid="salin-quick-4w" className={chip} onClick={() => mingguan(4)}>4 minggu ke depan</button>
          </div>
          <div className="space-y-2" data-testid="salin-date-list">
            {dates.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <CalendarDays size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                  <input data-testid={`salin-date-${i}`} type="date" required value={d} onChange={(e) => setDate(i, e.target.value)}
                    className="w-full h-11 pl-10 pr-3 rounded-xl border-2 border-[#E5E7EB] text-sm outline-none focus:border-[#0D5C3A] bg-white" />
                </div>
                <span className="hidden sm:block text-xs text-[#6B7280] w-[150px] truncate">{d ? tanggalPanjang(d) : ""}</span>
                <button type="button" data-testid={`salin-date-remove-${i}`} onClick={() => removeDate(i)} disabled={dates.length <= 1}
                  className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border-2 border-[#E5E7EB] text-[#DC2626] hover:border-[#DC2626] disabled:opacity-40 disabled:cursor-not-allowed bg-white"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button type="button" data-testid="salin-date-add" onClick={addDate} disabled={dates.length >= 12}
            className="mt-2 w-full h-10 rounded-xl border-2 border-dashed border-[#0D5C3A] text-[#0D5C3A] font-semibold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-[#E8F5EE] disabled:opacity-40">
            <Plus size={15} /> Tambah tanggal lain
          </button>
        </div>

        <p className="text-[11px] text-[#92400E] leading-relaxed bg-[#FEF3C7] rounded-lg px-2.5 py-2 inline-flex items-start gap-1.5">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>Yang disalin: nama, jenis, semua sesi &amp; jam, pengajar, materi, lokasi, dan penyaringan peserta.
            <b> Absensi tidak ikut disalin</b> — jadwal baru punya kode akses &amp; barcode sendiri.</span>
        </p>

        <button type="submit" data-testid="salin-submit" disabled={saving}
          className="w-full h-12 rounded-xl bg-[#0D5C3A] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#094229] disabled:opacity-60">
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Copy size={18} />}
          Salin ke {dates.filter(Boolean).length} tanggal ({dates.filter(Boolean).length * items.length} jadwal)
        </button>
      </form>
    </Shell>
  );
}
