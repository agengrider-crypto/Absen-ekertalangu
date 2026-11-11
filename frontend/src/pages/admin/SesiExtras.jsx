import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, Layers, Search, CalendarDays, Clock, MapPin, User, Copy,
  Plus, Trash2, AlertTriangle, ClipboardCopy, Link2, Send, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { ACTIVITIES } from "@/constants/testIds";
import Modal from "@/components/Modal";
import { tanggalPanjang, tanggalSingkat, hhmm, typeLabel, typeColor } from "./kegiatanUtils";

function Shell({ title, subtitle, children, onClose, testid, wide }) {
  return (
    <Modal
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      testid={testid}
      maxWidth={wide ? 960 : 640}
      bodyClassName="bg-[#F6F4EE] p-5"
    >
      {children}
    </Modal>
  );
}

const ST = {
  hadir: { t: "H", cls: "bg-[#14633F] text-white", title: "Hadir" },
  izin: { t: "I", cls: "bg-[#5F6B63] text-white", title: "Izin" },
  sakit: { t: "S", cls: "bg-[#E3EEFB] text-[#1D4F91]", title: "Sakit" },
  alpha: { t: "A", cls: "bg-[#FBE5E3] text-[#A32A2A]", title: "Alpha" },
  belum_diabsen: { t: "—", cls: "bg-[#FBF1D6] text-[#6B4500]", title: "Belum diabsen" },
  exempt: { t: "✓", cls: "bg-[#F0EEE6] text-[#5F6B63]", title: "Sudah hadir di sesi sebelumnya — tidak dihitung" },
  optional: { t: "·", cls: "bg-[#D9F2F4] text-[#6D3FC8]", title: "Sesi opsional — tidak wajib, tidak dihitung" },
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
  const [openReasons, setOpenReasons] = useState({});
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
          <p className="text-sm text-[#A32A2A] mb-3" data-testid="rekap-gabungan-error">{err}</p>
          <button onClick={load} className="h-10 px-4 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold text-sm">Coba lagi</button>
        </div>
      ) : !data ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>
      ) : (
        <div className="space-y-4">
          <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="rekap-gabungan-total">
            <div className="text-xs font-bold uppercase tracking-wide text-[#5F6B63]">Total keseluruhan (final)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-[#14201A]">
              Hadir {data.total?.hadir ?? 0} / {data.total?.total ?? 0} orang = {data.total?.ratio ?? 0}%
            </div>
          </section>

          <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="rekap-gabungan-per-sesi">
            <h3 className="mb-3 font-bold text-[#14201A]">Kehadiran tiap waktu</h3>
            <div className="grid auto-cols-[minmax(12rem,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
              {data.sessions.map((session) => (
                <div key={session.id} className="min-w-0 rounded-xl bg-[#F6F4EE] p-3" data-testid={`gab-bar-sesi-${session.id}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-[#14201A]">{session.label}</div>
                      <div className="text-xs text-[#5F6B63]">{session.start_time}–{session.end_time} WITA</div>
                    </div>
                    <div className="shrink-0 text-xl font-bold text-[#0E4E31]">{session.counts.ratio}%</div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#E7E3D8]">
                    <div className="h-full origin-left rounded-full bg-[#14633F] motion-safe:animate-[rekap-bar-grow_700ms_ease-out_both]"
                      style={{ width: `${Math.min(Math.max(session.counts.ratio || 0, 0), 100)}%` }} />
                  </div>
                  <div className="mt-2 space-y-0.5 text-[11px] text-[#5F6B63]">
                    <div>Hadir <b className="text-[#0E4E31]">{session.counts.hadir}/{session.counts.total}</b> = {session.counts.ratio}%</div>
                    <div>Izin <b className="text-[#6B4500]">{session.counts.izin}</b></div>
                    <div>Sakit <b className="text-[#1D4F91]">{session.counts.sakit}</b></div>
                    <div>Alpha <b className="text-[#A32A2A]">{session.counts.alpha}</b></div>
                  </div>
                  {session.required === false && <div className="mt-1 text-[11px] text-[#5F6B63]">Sesi opsional</div>}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="rekap-gabungan-alasan">
            <h3 className="mb-2 font-bold text-[#14201A]">Rincian Izin / Sakit / Alpha per sesi</h3>
            <div className="space-y-2">
              {data.sessions.map((session) => {
                const idx = data.sessions.findIndex((x) => x.id === session.id);
                const detail = (data.rows || [])
                  .map((r) => ({ name: r.name, cell: r.sessions?.[idx] }))
                  .filter((x) => x.cell && ["izin", "sakit", "alpha"].includes(x.cell.status));
                const open = Boolean(openReasons[session.id]);
                return (
                  <div key={session.id} className="rounded-xl border border-[#E7E3D8]">
                    <button
                      type="button"
                      onClick={() => setOpenReasons((prev) => ({ ...prev, [session.id]: !prev[session.id] }))}
                      aria-expanded={open}
                      data-testid={`gab-alasan-toggle-${session.id}`}
                      className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm font-semibold text-[#14201A]"
                    >
                      <span className="min-w-0 truncate">{session.label} · {detail.length} peserta</span>
                      <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && (
                      <div className="divide-y divide-[#F0EEE6] border-t border-[#F0EEE6] px-3" data-testid={`gab-alasan-list-${session.id}`}>
                        {detail.length === 0 ? (
                          <div className="py-3 text-sm text-[#5F6B63]">Tidak ada peserta izin/sakit/alpha.</div>
                        ) : detail.map((x, i) => (
                          <div key={`${x.name}-${i}`} className="flex min-h-10 items-center justify-between gap-3 py-1.5 text-sm">
                            <span className="min-w-0 truncate font-medium text-[#14201A]">{x.name}</span>
                            <span className="shrink-0 text-xs text-[#5F6B63]">{x.cell.reason || x.cell.note || "-"}</span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${ST[x.cell.status]?.cls || ""}`}>
                              {ST[x.cell.status]?.title || x.cell.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Bagikan sebagai LINK (seperti rekap kegiatan biasa) */}
          <div className="rounded-2xl border-2 border-[#E7E3D8] bg-[#F6F4EE] p-4 space-y-2.5" data-testid="rekap-gabungan-share">
            <div className="text-sm font-bold text-[#0E4E31] inline-flex items-center gap-1.5"><Link2 size={15} /> Bagikan rekap ini sebagai tautan</div>
            <p className="text-[11px] text-[#0E4E31]/80 leading-relaxed">
              Tautan publik berisi bar persentase kehadiran semua sesi — bisa dibuka siapa pun tanpa login (berlaku 7 hari).
            </p>
            {share && (
              <div className="text-[11px] font-mono break-all bg-white rounded-lg border border-[#E7E3D8] px-2.5 py-2 text-[#0E4E31]" data-testid="rekap-gabungan-link">{share.link}</div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={shareWa} disabled={sharing} data-testid="rekap-gabungan-share-wa"
                className="h-11 rounded-xl bg-[#14633F] text-white font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:brightness-95 disabled:opacity-60">
                {sharing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Bagikan ke WhatsApp
              </button>
              <button onClick={copyLink} disabled={sharing} data-testid="rekap-gabungan-copy-link"
                className="h-11 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 hover:bg-[#E3F3EA] disabled:opacity-60">
                <Link2 size={15} /> Salin Tautan
              </button>
            </div>
          </div>

          <button onClick={copyText} data-testid="rekap-gabungan-copy"
            className="w-full h-11 rounded-xl border-2 border-[#E7E3D8] text-[#5F6B63] font-semibold text-sm inline-flex items-center justify-center gap-2 hover:border-[#14633F] hover:text-[#0E4E31]">
            <ClipboardCopy size={16} /> Salin Ringkasan (teks WhatsApp)
          </button>

          <button type="button" onClick={() => setShowRows((visible) => !visible)} aria-expanded={showRows}
            data-testid={ACTIVITIES.recapRowsToggle}
            className="w-full rounded-xl border-2 border-[#E7E3D8] bg-white px-4 py-3 text-left text-sm font-bold text-[#14201A] hover:border-[#14633F]">
            {showRows ? "Sembunyikan rincian peserta" : `Lihat rincian peserta (${data.rows.length})`}
          </button>
          {showRows && (
            <div className="space-y-2">
              <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden">
            <div className="p-3 bg-[#F6F4EE] flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
                <input data-testid="rekap-gabungan-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama peserta..." className="w-full h-10 pl-10 pr-3 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] bg-white" />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[46vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#F6F4EE] text-[#5F6B63] text-left">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Nama</th>
                    {data.sessions.map((x) => <th key={x.id} className="px-2 py-2 font-semibold text-center whitespace-nowrap">{x.label}{x.required === false ? <span className="block text-[9px] font-bold text-[#6D3FC8]">opsional</span> : null}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7E3D8]">
                  {rows.length === 0 ? (
                    <tr><td colSpan={data.sessions.length + 1} className="p-8 text-center text-[#5F6B63]">Tidak ada peserta.</td></tr>
                  ) : rows.map((r) => (
                    <tr key={r.user_id} data-testid={`rekap-gabungan-row-${r.user_id}`}>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-[#14201A] truncate max-w-[180px] sm:max-w-none">{r.name}</div>
                        <div className="text-[11px] text-[#5F6B63]">{r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : "—"}</div>
                      </td>
                      {r.sessions.map((c, i) => (
                        <td key={i} className="px-2 py-2 text-center">
                          {c === null ? (
                            <span className="text-[#D9D4C5]" title="Tidak termasuk daftar sesi ini">—</span>
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
              <p className="text-[11px] text-[#5F6B63] leading-relaxed">
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

  const chip = "h-9 px-3 rounded-full border-2 border-[#E7E3D8] bg-white text-xs font-semibold text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]";

  return (
    <Shell title="Salin Jadwal ke Tanggal Lain" subtitle={`${first.base_name || first.name} · ${tanggalSingkat(first.date)}`} onClose={onClose} testid="modal-salin-jadwal" wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid="salin-pola">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${typeColor(first.type)}1a`, color: typeColor(first.type) }}>{typeLabel(first.type)}</span>
            {items.length > 1 && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FBF1D6] text-[#6B4500] inline-flex items-center gap-1"><Layers size={12} /> {items.length} Waktu / Sesi</span>
            )}
            {(first.filter_labels || []).map((l) => <span key={l} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#FBE5E3] text-[#A32A2A]">{l}</span>)}
          </div>
          <div className="font-bold text-[#14201A] mt-1.5">{first.base_name || first.name}</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="salin-preview-sesi">
            {items.map((k) => (
              <div key={k.id} className="rounded-xl bg-[#F6F4EE] p-3">
                <div className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0E4E31]">
                  <Clock size={14} /> {k.session_label || "Jadwal"} · {k.start_time}–{k.end_time} WITA
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#5F6B63]">
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
          <p className="mt-3 text-xs text-[#5F6B63]">Pola jadwal, pengajar, materi, lokasi, Google Maps, dan pilihan peserta akan mengikuti kegiatan ini. Data absensi tidak disalin.</p>
        </div>

        {/* Tanggal tujuan */}
        <div>
          <label className="block text-sm font-semibold text-[#14201A] mb-1.5">Tanggal Tujuan</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button type="button" data-testid="salin-quick-1" className={chip} onClick={() => quick(1)}>Besok</button>
            <button type="button" data-testid="salin-quick-7" className={chip} onClick={() => quick(7)}>Minggu depan</button>
            <button type="button" data-testid="salin-quick-4w" className={chip} onClick={() => mingguan(4)}>4 minggu ke depan</button>
          </div>
          <div className="space-y-2" data-testid="salin-date-list">
            {dates.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <CalendarDays size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63] pointer-events-none" />
                  <input data-testid={`salin-date-${i}`} type="date" required value={d} onChange={(e) => setDate(i, e.target.value)}
                    aria-label={`Tanggal tujuan ke-${i + 1}`}
                    className="w-full h-11 pl-10 pr-3 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] bg-white" />
                </div>
                <span className="hidden sm:block text-xs text-[#5F6B63] w-[150px] truncate">{d ? tanggalPanjang(d) : ""}</span>
                <button type="button" data-testid={`salin-date-remove-${i}`} onClick={() => removeDate(i)} disabled={dates.length <= 1}
                  className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl border-2 border-[#E7E3D8] text-[#A32A2A] hover:border-[#A32A2A] disabled:opacity-40 disabled:cursor-not-allowed bg-white"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button type="button" data-testid="salin-date-add" onClick={addDate} disabled={dates.length >= 12}
            className="mt-2 w-full h-10 rounded-xl border-2 border-dashed border-[#14633F] text-[#0E4E31] font-semibold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-[#E3F3EA] disabled:opacity-40">
            <Plus size={15} /> Tambah tanggal lain
          </button>
        </div>

        <p className="rounded-xl bg-[#E3F3EA] px-3 py-2 text-sm font-semibold text-[#0E4E31]" data-testid="salin-jumlah-ringkasan">
          Akan dibuat {dates.filter(Boolean).length * items.length} jadwal baru untuk {dates.filter(Boolean).length} tanggal.
        </p>

        <p className="text-[11px] text-[#6B4500] leading-relaxed bg-[#FBF1D6] rounded-lg px-2.5 py-2 inline-flex items-start gap-1.5">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>Yang disalin: nama, jenis, sesi &amp; jam, pengajar, materi, lokasi/Maps, serta penyaringan dan peserta wajib.
            <b> Absensi tidak ikut disalin</b> — jadwal baru punya kode akses &amp; barcode sendiri.</span>
        </p>

        <button type="submit" data-testid="salin-submit" disabled={saving}
          className="w-full h-12 rounded-xl bg-[#14633F] text-white font-bold flex items-center justify-center gap-2 hover:bg-[#0E4E31] disabled:opacity-60">
          {saving ? <Loader2 className="animate-spin" size={18} /> : <Copy size={18} />}
          Salin ke {dates.filter(Boolean).length} tanggal ({dates.filter(Boolean).length * items.length} jadwal)
        </button>
      </form>
    </Shell>
  );
}
