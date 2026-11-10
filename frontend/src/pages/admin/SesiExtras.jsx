import { useCallback, useEffect, useMemo, useState } from "react";
import {
  X, Loader2, Layers, Search, CalendarDays, Clock, MapPin, User, Copy,
  Plus, Trash2, AlertTriangle, ClipboardCopy, Link2, Send,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { ACTIVITIES } from "@/constants/testIds";
import { tanggalPanjang, tanggalSingkat, hhmm, TYPE_LABEL, TYPE_COLOR } from "./kegiatanUtils";

function Shell({ title, subtitle, children, onClose, testid, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className={`bg-[#FAFAF8] w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl`} onClick={(e) => e.stopPropagation()} data-testid={testid}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E8E8E4] px-5 py-3.5 flex items-center justify-between z-10 gap-3">
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-[#111827] truncate">{title}</h2>
            {subtitle && <p className="text-xs text-[#6B7280] truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]" data-testid={`${testid}-close`}><X size={20} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const ST = {
  hadir: { t: "H", cls: "bg-[#2563EB] text-white", title: "Hadir" },
  izin: { t: "I", cls: "bg-[#9CA3AF] text-white", title: "Izin" },
  sakit: { t: "S", cls: "bg-[#DBEAFE] text-[#1D4ED8]", title: "Sakit" },
  alpha: { t: "A", cls: "bg-[#FEE2E2] text-[#991B1B]", title: "Alpha" },
  belum_diabsen: { t: "—", cls: "bg-[#FEF3C7] text-[#92400E]", title: "Belum diabsen" },
  exempt: { t: "✓", cls: "bg-[#F3F4F6] text-[#9CA3AF]", title: "Sudah hadir di sesi sebelumnya — tidak dihitung" },
  optional: { t: "·", cls: "bg-[#ECFEFF] text-[#6366F1]", title: "Sesi opsional — tidak wajib, tidak dihitung" },
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
  const [showRows, setShowRows] = useState(false);
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
      toast.success("Tautan rekap per sesi disalin.");
    } catch { toast.info("Tautan siap disalin manual dari kotak di atas."); }
  };

  const shareWa = async () => {
    const popup = window.open("", "_blank");
    const d = await getLink();
    if (!d) {
      popup?.close();
      return;
    }
    if (popup) popup.location.href = `https://wa.me/?text=${encodeURIComponent(d.wa_text)}`;
    else toast.error("WhatsApp tidak dapat dibuka. Salin tautan rekap untuk membagikannya.");
  };

  const load = useCallback(() => {
    setErr("");
    api.get(`/admin/kegiatan/${kegiatanId}/rekap-gabungan`)
      .then(({ data: d }) => setData(d))
      .catch((e) => setErr(formatApiErrorDetail(e.response?.data?.detail) || "Gagal memuat rekap per sesi"));
  }, [kegiatanId]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    return t ? data.rows.filter((r) => (r.name || "").toLowerCase().includes(t)) : data.rows;
  }, [data, q]);

  const copyText = async () => {
    if (!data) return;
    const lines = [
      `*REKAP KEHADIRAN PER SESI ${String(data.base_name || "").toUpperCase()}*`,
      tanggalPanjang(data.date),
      "",
      ...data.sessions.map((x) => (
        `• ${x.label} (${x.start_time}–${x.end_time}): `
        + `Hadir ${x.counts.hadir}/${x.counts.total} (${x.counts.ratio}%) · `
        + `Izin ${x.counts.izin} · Sakit ${x.counts.sakit} · Alpha ${x.counts.alpha} · `
        + `Belum diabsen ${x.counts.belum_diabsen}`
      )),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Rekap per sesi disalin — siap ditempel ke WhatsApp.");
    } catch { toast.error("Gagal menyalin teks"); }
  };

  return (
    <Shell title="Rekap Kehadiran per Sesi" subtitle={data ? `${data.base_name} · ${tanggalPanjang(data.date)}` : ""} onClose={onClose} testid="modal-rekap-gabungan" wide>
      {err && !data ? (
        <div className="p-8 text-center">
          <p className="text-sm text-[#DC2626] mb-3" data-testid="rekap-gabungan-error">{err}</p>
          <button onClick={load} className="h-10 px-4 rounded-xl border-2 border-[#2563EB] text-[#1D4ED8] font-semibold text-sm">Coba lagi</button>
        </div>
      ) : !data ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#1D4ED8]" size={28} /></div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-[#E8E8E4] bg-white p-4" data-testid="rekap-gabungan-per-sesi">
            <h3 className="mb-3 font-bold text-[#111827]">Kehadiran tiap waktu</h3>
            <div className="grid auto-cols-[minmax(12rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
              {data.sessions.map((session) => (
                <div key={session.id} className="min-w-0 rounded-xl bg-[#FAFAF8] p-3" data-testid={`gab-bar-sesi-${session.id}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-[#111827]">{session.label}</div>
                      <div className="text-xs text-[#6B7280]">{session.start_time}–{session.end_time} WITA</div>
                    </div>
                    <div className="shrink-0 text-xl font-bold text-[#1D4ED8]">{session.counts.ratio}%</div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#E8E8E4]">
                    <div className="h-full origin-left rounded-full bg-[#2563EB] motion-safe:animate-[rekap-bar-grow_700ms_ease-out_both]"
                      style={{ width: `${Math.min(Math.max(session.counts.ratio || 0, 0), 100)}%` }} />
                  </div>
                  {session.required === false && <div className="mt-1 text-[11px] text-[#6B7280]">Sesi opsional</div>}
                </div>
              ))}
            </div>
          </section>

          {/* Bagikan sebagai LINK (seperti rekap kegiatan biasa) */}
          <div className="rounded-2xl border-2 border-[#E8E8E4] bg-[#FAFAF8] p-4 space-y-2.5" data-testid="rekap-gabungan-share">
            <div className="text-sm font-bold text-[#1D4ED8] inline-flex items-center gap-1.5"><Link2 size={15} /> Bagikan rekap ini sebagai tautan</div>
            <p className="text-[11px] text-[#1D4ED8]/80 leading-relaxed">
              Tautan publik berisi bar persentase kehadiran semua sesi — bisa dibuka siapa pun tanpa login (berlaku 7 hari).
            </p>
            {share && (
              <div className="text-[11px] font-mono break-all bg-white rounded-lg border border-[#E8E8E4] px-2.5 py-2 text-[#1D4ED8]" data-testid="rekap-gabungan-link">{share.link}</div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={shareWa} disabled={sharing} data-testid="rekap-gabungan-share-wa"
                className="h-11 rounded-xl bg-[#25D366] text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:brightness-95 disabled:opacity-60">
                {sharing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Bagikan ke WhatsApp
              </button>
              <button onClick={copyLink} disabled={sharing} data-testid="rekap-gabungan-copy-link"
                className="h-11 rounded-xl border-2 border-[#2563EB] text-[#1D4ED8] font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#EFF6FF] disabled:opacity-60">
                <Link2 size={15} /> Salin Tautan
              </button>
            </div>
          </div>

          <button onClick={copyText} data-testid="rekap-gabungan-copy"
            className="w-full h-11 rounded-xl border-2 border-[#E8E8E4] text-[#4B5563] font-semibold text-sm inline-flex items-center justify-center gap-2 hover:border-[#2563EB] hover:text-[#1D4ED8]">
            <ClipboardCopy size={16} /> Salin Ringkasan (teks WhatsApp)
          </button>

          <button type="button" onClick={() => setShowRows((visible) => !visible)} aria-expanded={showRows}
            data-testid={ACTIVITIES.recapRowsToggle}
            className="w-full rounded-xl border-2 border-[#E8E8E4] bg-white px-4 py-3 text-left text-sm font-bold text-[#111827] hover:border-[#2563EB]">
            {showRows ? "Sembunyikan rincian peserta" : `Lihat rincian peserta (${data.rows.length})`}
          </button>
          {showRows && (
            <div className="space-y-2">
              <div className="bg-white rounded-2xl border border-[#E8E8E4] overflow-hidden">
            <div className="p-3 bg-[#FAFAF8] flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input data-testid="rekap-gabungan-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama peserta..." className="w-full h-10 pl-10 pr-3 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#2563EB] bg-white" />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[46vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#FAFAF8] text-[#6B7280] text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Nama</th>
                    {data.sessions.map((x) => <th key={x.id} className="px-2 py-2 font-semibold text-center whitespace-nowrap">{x.label}{x.required === false ? <span className="block text-[9px] font-bold text-[#6366F1]">opsional</span> : null}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECECE8]">
                  {rows.length === 0 ? (
                    <tr><td colSpan={data.sessions.length + 1} className="p-8 text-center text-[#6B7280]">Tidak ada peserta.</td></tr>
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
                              {ST[c.status]?.t || ""}
                              {c.status === "hadir" && c.arrival_time && <span className="text-[9px] font-medium leading-none">{hhmm(c.arrival_time)}</span>}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              </div>
              <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                <b>H</b> hadir · <b>I</b> izin · <b>S</b> sakit · <b>A</b> alpha · <b>—</b> belum diabsen atau tidak termasuk sesi.
                Setiap kolom menunjukkan kehadiran pada sesi yang bersangkutan.
              </p>
            </div>
          )}
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
    const selectedDates = dates.filter(Boolean);
    const clean = Array.from(new Set(selectedDates));
    if (!clean.length) { toast.error("Pilih minimal 1 tanggal tujuan"); return; }
    if (clean.length !== selectedDates.length) {
      toast.error("Tanggal tujuan tidak boleh dipilih lebih dari satu kali.");
      return;
    }
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

  const chip = "h-9 px-3 rounded-full border-2 border-[#E8E8E4] bg-white text-xs font-semibold text-[#4B5563] hover:border-[#2563EB] hover:text-[#1D4ED8]";

  return (
    <Shell title="Salin Jadwal ke Tanggal Lain" subtitle={`${first.base_name || first.name} · ${tanggalSingkat(first.date)}`} onClose={onClose} testid="modal-salin-jadwal" wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-2xl border border-[#E8E8E4] bg-white p-4" data-testid="salin-pola">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${TYPE_COLOR[first.type]}1a`, color: TYPE_COLOR[first.type] }}>{TYPE_LABEL[first.type]}</span>
            {items.length > 1 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] inline-flex items-center gap-1"><Layers size={12} /> {items.length} Waktu / Sesi</span>
            )}
            {(first.filter_labels || []).map((l) => <span key={l} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#B91C1C]">{l}</span>)}
          </div>
          <div className="font-bold text-[#111827] mt-1.5">{first.base_name || first.name}</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="salin-preview-sesi">
            {items.map((k) => (
              <div key={k.id} className="rounded-xl bg-[#FAFAF8] p-3">
                <div className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1D4ED8]">
                  <Clock size={14} /> {k.session_label || "Jadwal"} · {k.start_time}–{k.end_time} WITA
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6B7280]">
                  {k.teacher && <span className="inline-flex items-center gap-1"><User size={12} /> {k.teacher}</span>}
                  {k.material && <span>{k.material}</span>}
                  {k.location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {k.location}</span>}
                  {k.maps_query && k.maps_query !== k.location && (
                    <span className="inline-flex items-center gap-1"><MapPin size={12} /> Maps: {k.maps_query}</span>
                  )}
                  {k.session_participant_ids?.length > 0 && (
                    <span>{k.session_participant_ids.length} peserta wajib</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#6B7280]">Pola jadwal, pengajar, materi, lokasi, Google Maps, dan pilihan peserta akan mengikuti kegiatan ini. Data absensi tidak disalin.</p>
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
                    aria-label={`Tanggal tujuan ke-${i + 1}`}
                    className="w-full h-11 pl-10 pr-3 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#2563EB] bg-white" />
                </div>
                <span className="hidden sm:block text-xs text-[#6B7280] w-[150px] truncate">{d ? tanggalPanjang(d) : ""}</span>
                <button type="button" data-testid={`salin-date-remove-${i}`} onClick={() => removeDate(i)} disabled={dates.length <= 1}
                  className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border-2 border-[#E8E8E4] text-[#DC2626] hover:border-[#DC2626] disabled:opacity-40 disabled:cursor-not-allowed bg-white"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button type="button" data-testid="salin-date-add" onClick={addDate} disabled={dates.length >= 12}
            className="mt-2 w-full h-10 rounded-xl border-2 border-dashed border-[#2563EB] text-[#1D4ED8] font-semibold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-[#EFF6FF] disabled:opacity-40">
            <Plus size={15} /> Tambah tanggal lain
          </button>
        </div>

        <p className="rounded-xl bg-[#EFF6FF] px-3 py-2 text-sm font-semibold text-[#1D4ED8]" data-testid="salin-jumlah-ringkasan">
          Akan dibuat {dates.filter(Boolean).length * items.length} jadwal baru untuk {dates.filter(Boolean).length} tanggal.
        </p>

        <p className="text-[11px] text-[#92400E] leading-relaxed bg-[#FEF3C7] rounded-lg px-2.5 py-2 inline-flex items-start gap-1.5">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>Yang disalin: nama, jenis, sesi &amp; jam, pengajar, materi, lokasi/Maps, serta penyaringan dan peserta wajib.
            <b> Absensi tidak ikut disalin</b> — jadwal baru punya kode akses &amp; barcode sendiri.</span>
        </p>

        <button type="submit" data-testid="salin-submit" disabled={saving}
          className="w-full h-12 rounded-xl bg-[#2563EB] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#1D4ED8] disabled:opacity-60">
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Copy size={18} />}
          Salin ke {dates.filter(Boolean).length} tanggal ({dates.filter(Boolean).length * items.length} jadwal)
        </button>
      </form>
    </Shell>
  );
}
