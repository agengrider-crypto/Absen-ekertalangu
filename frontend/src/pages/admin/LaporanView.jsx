// FASE 23 — Laporan terpadu diurutkan: total keseluruhan → jumlah kegiatan → daftar peserta → keterangan.
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  FileBarChart2, Loader2, CalendarDays, CalendarRange, Users, ClipboardList,
  Link2, Copy, Send, X, UserCheck, UserX, AlertTriangle, Search, Download, Info, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

const inp = "h-11 px-3.5 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114] bg-white";

function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

const pctOf = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);
const barColor = (v) => (v >= 80 ? "#15803D" : v >= 50 ? "#D97706" : "#DC2626");

/** Bar persentase yang bisa diketuk: animasi isi bar + panel penjelasan % kehadiran. */
function BarPersen({ label, value, sub, detail, testid }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const [open, setOpen] = useState(false);
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(v), 120);
    return () => clearTimeout(t);
  }, [v]);
  return (
    <div data-testid={testid}>
      <button type="button" onClick={() => setOpen((o) => !o)} data-testid={`${testid}-toggle`}
        className="w-full text-left group">
        <div className="flex items-end justify-between gap-2">
          <span className="text-xs font-semibold text-[#4B5563] inline-flex items-center gap-1">
            {label}
            <ChevronDown size={13} className={`text-[#9CA3AF] transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
          </span>
          <span className="text-sm font-bold tabular-nums" style={{ color: barColor(v) }}>
            {v}% {sub && <span className="text-[11px] font-semibold text-[#9CA3AF]">{sub}</span>}
          </span>
        </div>
        <div className="mt-1.5 h-2.5 rounded-full bg-[#F1F1EE] overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-700 ease-out group-hover:brightness-110"
            style={{ width: `${w}%`, backgroundColor: barColor(v) }} />
        </div>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div data-testid={`${testid}-detail`}
            className="rounded-xl bg-[#FAFAF8] border border-[#E8E8E4] p-3 text-[11px] leading-relaxed text-[#4B5563]">
            <b className="text-[#111827]">Kehadiran {v}%.</b> {detail}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, sub, tone = "default", testid }) {
  const tones = {
    default: "bg-white border-[#E8E8E4] text-[#111114]",
    good: "bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]",
    warn: "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]",
    bad: "bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]",
  };
  return (
    <div data-testid={testid} className={`rounded-xl lg:rounded-2xl border-2 p-2.5 lg:p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] lg:text-[11px] font-bold uppercase tracking-wide opacity-70">
        <Icon size={12} className="shrink-0" /> <span className="truncate">{label}</span>
      </div>
      <div className="font-heading font-bold text-lg lg:text-2xl mt-0.5 lg:mt-1.5 tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[10px] lg:text-[11px] opacity-70 mt-0.5 leading-snug">{sub}</div>}
    </div>
  );
}

function PersenChip({ value }) {
  const cls = value >= 80 ? "bg-[#DCFCE7] text-[#166534]"
    : value >= 50 ? "bg-[#FEF3C7] text-[#92400E]" : "bg-[#FEE2E2] text-[#991B1B]";
  return <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold tabular-nums ${cls}`}>{value}%</span>;
}

function DetailModal({ row, periode, onClose }) {
  if (!row) return null;
  const total = row.pertemuan || 0;
  return createPortal((
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-[#F7F7F5] w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        data-testid="laporan-detail-modal">
        <div className="sticky top-0 bg-white/95 backdrop-blur px-5 py-3.5 border-b border-[#ECECE8] flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading font-bold text-lg text-[#111827] truncate">{row.name}</h2>
            <p className="text-xs text-[#6B7280]">{periode}</p>
          </div>
          <button onClick={onClose} data-testid="laporan-detail-close"
            className="h-9 w-9 shrink-0 rounded-xl text-[#6B7280] hover:bg-[#F4F4F1] flex items-center justify-center"><X size={19} /></button>
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          <div className="rounded-2xl bg-white border border-[#E8E8E4] p-4 text-center">
            <PersenChip value={row.ratio ?? 0} />
            <p className="text-xs text-[#6B7280] mt-2">
              Hadir {row.hadir ?? 0} dari {total} pertemuan yang diikuti
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[["Hadir", row.hadir ?? 0, "good"], ["Izin", row.izin ?? 0, "warn"], ["Alpha", row.alpha ?? 0, "bad"]]
              .map(([l, v, t]) => (
                <div key={l} className={`rounded-xl border-2 p-3 text-center ${
                  t === "good" ? "bg-[#F0FDF4] border-[#BBF7D0] text-[#166534]"
                    : t === "warn" ? "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]"
                      : "bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]"}`}>
                  <div className="text-[11px] font-bold uppercase opacity-70">{l}</div>
                  <div className="font-bold text-xl tabular-nums">{v}</div>
                  <div className="text-[11px] opacity-70">{pctOf(v, total)}%</div>
                </div>
              ))}
          </div>
          <div className="rounded-2xl bg-white border border-[#E8E8E4] p-4 text-sm text-[#4B5563] space-y-1.5">
            <div><b className="text-[#111827]">Jenis kelamin:</b> {row.gender === "L" ? "Laki-laki" : row.gender === "P" ? "Perempuan" : "—"}</div>
            {row.kelompok_name && <div><b className="text-[#111827]">Kelompok:</b> {row.kelompok_name}</div>}
            <div><b className="text-[#111827]">Terakhir hadir:</b> {row.last_date || "—"}</div>
            <div><b className="text-[#111827]">Status akun:</b> {row.account_status === "pending" ? "Belum aktivasi" : "Aktif"}</div>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
}

export default function LaporanView() {
  const [mode, setMode] = useState("bulanan");          // bulanan | harian
  const [month, setMonth] = useState(() => todayYmd().slice(0, 7));
  const [date, setDate] = useState(todayYmd());
  const [data, setData] = useState(null);
  const [akun, setAkun] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("semua");
  const [sort, setSort] = useState("tertinggi");
  const [detail, setDetail] = useState(null);
  const [share, setShare] = useState(null);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(() => {
    setData(null); setShare(null);
    const url = mode === "bulanan" ? `/staff/rekap-bulanan?month=${month}` : `/staff/rekap-harian?date=${date}`;
    api.get(url).then(({ data: d }) => setData(d))
      .catch((e) => { setData(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });
  }, [mode, month, date]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/staff/statistik-akun").then(({ data: d }) => setAkun(d)).catch(() => {}); }, []);

  const rows = useMemo(() => {
    let list = (data?.rows || []).map((r) => ({
      ...r,
      pertemuan: r.pertemuan ?? r.sesi_total ?? 0,
      ratio: r.ratio ?? 0,
    }));
    const s = q.trim().toLowerCase();
    if (s) list = list.filter((r) => (r.name || "").toLowerCase().includes(s));
    if (filter === "rajin") list = list.filter((r) => r.ratio >= 80);
    if (filter === "cukup") list = list.filter((r) => r.ratio >= 50 && r.ratio < 80);
    if (filter === "jarang") list = list.filter((r) => r.ratio < 50 && (r.hadir || 0) > 0);
    if (filter === "belum") list = list.filter((r) => (r.hadir || 0) === 0);
    if (sort !== "nama") {
      list = [...list].sort((a, b) => (sort === "tertinggi" ? b.ratio - a.ratio : a.ratio - b.ratio));
    }
    return list;
  }, [data, q, filter, sort]);

  const ringkas = useMemo(() => {
    const r = data?.rows || [];
    const hadir = r.reduce((a, x) => a + (x.hadir || 0), 0);
    const izin = r.reduce((a, x) => a + (x.izin || 0), 0);
    const alpha = r.reduce((a, x) => a + (x.alpha || 0), 0);
    const catatan = hadir + izin + alpha;
    const kegiatan = mode === "bulanan"
      ? (data?.total_kegiatan ?? data?.total_pertemuan ?? 0)
      : (data?.total_sesi ?? data?.sesi?.length ?? 0);
    const pertemuan = mode === "bulanan" ? (data?.total_pertemuan ?? 0) : (data?.sesi?.length ?? 0);
    return {
      hadir, izin, alpha, catatan, kegiatan, pertemuan,
      total: pctOf(hadir, catatan),
      peserta: r.length,
    };
  }, [data, mode]);

  const buatTautan = async () => {
    setSharing(true);
    try {
      const url = mode === "bulanan"
        ? `/staff/rekap-bulanan/share?month=${month}`
        : `/staff/rekap-harian/share?date=${date}`;
      const { data: d } = await api.post(url);
      setShare(d);
      toast.success("Tautan laporan siap dibagikan.");
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    finally { setSharing(false); }
  };

  const unduh = async (format) => {
    try {
      const from = mode === "bulanan" ? `${month}-01` : date;
      const to = mode === "bulanan" ? `${month}-31` : date;
      const res = await api.get(`/admin/laporan/export?format=${format}&date_from=${from}&date_to=${to}`,
        { responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(res.data);
      a.download = `laporan_${mode}_${mode === "bulanan" ? month : date}.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const periode = mode === "bulanan" ? `Bulan ${month}` : `Tanggal ${date}`;
  const satuan = mode === "bulanan" ? "pertemuan" : "sesi";

  return (
    <div data-testid="laporan-view" className="space-y-4">
      <div>
        <div className="flex items-center gap-2 text-[#111114] font-bold text-lg">
          <FileBarChart2 size={20} /> Laporan Kehadiran
        </div>
        <p className="text-sm text-[#6B7280] mt-0.5">
          Total kehadiran, jumlah kegiatan, dan daftar peserta — harian maupun bulanan dalam satu halaman.
        </p>
      </div>

      {/* Pilih periode */}
      <div className="bg-white rounded-2xl border border-[#E8E8E4] p-3 lg:p-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-[#F4F4F1] rounded-xl p-1" data-testid="laporan-mode">
          {[["bulanan", "Bulanan", CalendarRange], ["harian", "Harian", CalendarDays]].map(([v, l, Ic]) => (
            <button key={v} data-testid={`laporan-mode-${v}`} onClick={() => setMode(v)}
              className={`h-10 px-3.5 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 ${
                mode === v ? "bg-white text-[#111114] shadow-sm" : "text-[#6B7280]"}`}>
              <Ic size={15} /> {l}
            </button>
          ))}
        </div>
        {mode === "bulanan" ? (
          <input data-testid="laporan-month" type="month" value={month}
            onChange={(e) => setMonth(e.target.value)} className={inp} />
        ) : (
          <input data-testid="laporan-date" type="date" value={date}
            onChange={(e) => setDate(e.target.value)} className={inp} />
        )}
        <div className="flex-1" />
        <button data-testid="laporan-share" onClick={buatTautan} disabled={sharing}
          className="h-11 px-3.5 rounded-xl bg-[#111114] text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-black disabled:opacity-60">
          {sharing ? <Loader2 className="animate-spin" size={16} /> : <Link2 size={16} />} Tautan Laporan
        </button>
        <button data-testid="laporan-unduh-excel" onClick={() => unduh("excel")}
          className="h-11 px-3.5 rounded-xl border-2 border-[#E8E8E4] text-sm font-semibold text-[#4B5563] inline-flex items-center gap-2 hover:border-[#111114] hover:text-[#111114]">
          <Download size={16} /> Excel
        </button>
      </div>

      {share && (
        <div className="rounded-2xl border-2 border-[#CCFBF1] bg-[#F0FDFA] p-4" data-testid="laporan-share-box">
          <div className="text-xs font-bold uppercase tracking-wide text-[#0F766E]">Tautan laporan ({periode})</div>
          <a href={share.link} target="_blank" rel="noreferrer"
            className="block text-sm font-semibold text-[#111114] mt-1 break-all hover:underline">{share.link}</a>
          <div className="flex gap-2 mt-3 flex-wrap">
            <button data-testid="laporan-share-copy"
              onClick={() => { navigator.clipboard.writeText(share.link); toast.success("Tautan disalin"); }}
              className="h-10 px-3 rounded-xl border-2 border-[#111114] text-[#111114] text-sm font-semibold inline-flex items-center gap-1.5">
              <Copy size={15} /> Salin
            </button>
            <button data-testid="laporan-share-wa"
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(share.wa_text || share.link)}`, "_blank")}
              className="h-10 px-3 rounded-xl bg-[#25D366] text-white text-sm font-semibold inline-flex items-center gap-1.5">
              <Send size={15} /> WhatsApp
            </button>
          </div>
        </div>
      )}

      {/* 1 — TOTAL SELURUHNYA */}
      <div className="bg-white rounded-2xl border border-[#E8E8E4] p-4 lg:p-5" data-testid="laporan-total">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
          Total Seluruhnya · {periode}
        </div>
        <div className="flex items-end gap-3 mt-1">
          <div className="font-heading font-bold text-4xl lg:text-5xl tabular-nums leading-none"
            style={{ color: barColor(ringkas.total) }} data-testid="laporan-total-persen">
            {ringkas.total}%
          </div>
          <div className="text-[11px] lg:text-xs text-[#6B7280] pb-1 leading-snug" data-testid="laporan-total-hia">
            persentase kehadiran keseluruhan<br />
            total seluruhnya — H {ringkas.hadir} · I {ringkas.izin} · A {ringkas.alpha}
            {" "}(dari {ringkas.catatan} catatan)
          </div>
        </div>
        <div className="mt-3">
          <BarPersen testid="laporan-bar-total" label="Kehadiran keseluruhan" value={ringkas.total}
            sub={`${ringkas.hadir}/${ringkas.catatan}`}
            detail={`Dihitung dari ${ringkas.hadir} kehadiran dibagi ${ringkas.catatan} catatan kehadiran (${ringkas.hadir} hadir + ${ringkas.izin} izin + ${ringkas.alpha} alpha) pada ${periode.toLowerCase()}.`} />
        </div>
      </div>

      {/* 2 — JUMLAH KEGIATAN + BAR */}
      <div className="bg-white rounded-2xl border border-[#E8E8E4] p-4 lg:p-5 space-y-3" data-testid="laporan-kegiatan">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF] inline-flex items-center gap-1.5">
              <ClipboardList size={13} /> {mode === "bulanan" ? "Jumlah kegiatan selama 1 bulan" : "Jumlah sesi hari ini"}
            </div>
            <div className="font-heading font-bold text-2xl lg:text-3xl text-[#111827] tabular-nums mt-0.5"
              data-testid="laporan-jumlah-kegiatan">
              {ringkas.kegiatan} <span className="text-sm font-semibold text-[#6B7280]">jadwal</span>
            </div>
            <div className="text-[11px] text-[#6B7280]">
              {mode === "bulanan" ? `${ringkas.pertemuan} hari pertemuan` : `${ringkas.pertemuan} sesi`} · {ringkas.peserta} peserta dipantau
            </div>
          </div>
          <PersenChip value={ringkas.total} />
        </div>
        <BarPersen testid="laporan-bar-kegiatan" label={`Kehadiran ${ringkas.kegiatan} jadwal ${periode.toLowerCase()}`}
          value={ringkas.total} sub={`${ringkas.hadir}/${ringkas.catatan}`}
          detail={`Dari ${ringkas.kegiatan} jadwal (${ringkas.pertemuan} ${satuan}): hadir ${ringkas.hadir}× (${pctOf(ringkas.hadir, ringkas.catatan)}%), izin ${ringkas.izin}× (${pctOf(ringkas.izin, ringkas.catatan)}%), alpha ${ringkas.alpha}× (${pctOf(ringkas.alpha, ringkas.catatan)}%).`} />
        <div className="text-[11px] text-[#6B7280]" data-testid="laporan-kegiatan-hia">
          Total hadir <b className="text-[#166534]">{ringkas.hadir}</b> ·
          izin <b className="text-[#92400E]">{ringkas.izin}</b> ·
          alpha <b className="text-[#991B1B]">{ringkas.alpha}</b>
        </div>

        {/* Rincian tiap pertemuan / sesi — bar bisa diketuk */}
        {(mode === "bulanan" ? data?.per_pertemuan : data?.sesi)?.length > 0 && (
          <div className="pt-2 border-t border-[#F1F1EE] space-y-3" data-testid="laporan-rincian">
            {(mode === "bulanan" ? data.per_pertemuan : data.sesi).slice(0, 12).map((p, i) => {
              const tot = p.peserta || 0;
              const alp = Math.max(tot - (p.hadir || 0) - (p.izin || 0), 0);
              return (
                <BarPersen key={i} testid={`laporan-bar-rincian-${i}`}
                  label={mode === "bulanan" ? `${p.date} · ${p.name}` : `${p.label} ${p.start_time}–${p.end_time}`}
                  value={p.ratio || 0} sub={`${p.hadir || 0}/${tot}`}
                  detail={`Hadir ${p.hadir || 0}× (${pctOf(p.hadir || 0, tot)}%), izin ${p.izin || 0}× (${pctOf(p.izin || 0, tot)}%), alpha ${alp}× (${pctOf(alp, tot)}%) dari ${tot} peserta.`} />
              );
            })}
          </div>
        )}
      </div>

      {/* 3 — DAFTAR PESERTA */}
      <div className="bg-white rounded-2xl border border-[#E8E8E4] overflow-hidden">
        <div className="p-4 border-b border-[#ECECE8] space-y-3">
          <div className="font-bold text-[#111827] inline-flex items-center gap-2">
            <Users size={17} /> Daftar Peserta
            <span className="text-xs font-medium text-[#6B7280]">({rows.length})</span>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input data-testid="laporan-search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama peserta…" className={`${inp} w-full pl-9`} />
          </div>
          <div className="flex flex-wrap gap-2">
            {[["semua", "Semua"], ["rajin", "Rajin ≥80%"], ["cukup", "Cukup 50–79%"],
              ["jarang", "Jarang <50%"], ["belum", "Belum pernah hadir"]].map(([v, l]) => (
              <button key={v} data-testid={`laporan-filter-${v}`} onClick={() => setFilter(v)}
                className={`h-9 lg:h-10 px-3 rounded-xl border-2 text-xs font-semibold ${
                  filter === v ? "bg-[#111114] text-white border-transparent"
                    : "bg-white text-[#4B5563] border-[#E8E8E4] hover:border-[#111114]"}`}>{l}</button>
            ))}
            <div className="flex items-center gap-1 bg-[#F4F4F1] rounded-xl p-1 ml-auto" data-testid="laporan-sort">
              {[["tertinggi", "Tertinggi"], ["terendah", "Terendah"], ["nama", "A–Z"]].map(([v, l]) => (
                <button key={v} data-testid={`laporan-sort-${v}`} onClick={() => setSort(v)}
                  className={`h-8 lg:h-9 px-3 rounded-lg text-xs font-semibold ${sort === v ? "bg-white text-[#111114] shadow-sm" : "text-[#6B7280]"}`}>{l}</button>
              ))}
            </div>
          </div>
        </div>

        {data === null ? (
          <div className="p-14 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={28} /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#6B7280]">Tidak ada data pada periode / kategori ini.</div>
        ) : (
          <div className="divide-y divide-[#F3F4F6]">
            {rows.map((r) => (
              <button key={r.user_id || r.name} data-testid={`laporan-row-${r.user_id || r.name}`}
                onClick={() => setDetail(r)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[#FAFAF8]">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-sm text-[#111827] truncate">{r.name}</span>
                  <span className="block text-[11px] text-[#9CA3AF]">
                    Hadir {r.hadir ?? 0}/{r.pertemuan} · Izin {r.izin ?? 0} · Alpha {r.alpha ?? 0}
                    {r.account_status === "pending" ? " · belum aktivasi" : ""}
                  </span>
                </span>
                <PersenChip value={r.ratio ?? 0} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Data akun — ringkas, 2 kolom di HP */}
      {akun && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3" data-testid="laporan-data-peserta">
          <MiniStat icon={Users} label="Total peserta" value={akun.peserta} sub={`${akun.laki} L · ${akun.perempuan} P`} />
          <MiniStat icon={UserCheck} label="Akun aktif" value={akun.aktif} tone="good" sub={`${akun.nonaktif} nonaktif`} />
          <MiniStat icon={UserX} label="Belum aktivasi" value={akun.belum_aktivasi} tone="warn" sub="akun belum dipakai" />
          <MiniStat icon={AlertTriangle} label="Data belum lengkap" value={akun.belum_lengkap} tone="bad"
            sub={`${akun.pengurus} pengurus · ${akun.guru} guru · ${akun.admin} admin`} />
        </div>
      )}

      {/* 4 — KETERANGAN HITUNGAN (paling bawah) */}
      <div className="rounded-2xl border-2 border-dashed border-[#E8E8E4] bg-[#FAFAF8] p-4" data-testid="laporan-keterangan">
        <div className="text-sm font-bold text-[#111827] inline-flex items-center gap-2">
          <Info size={16} /> Keterangan hitungan
        </div>
        <ul className="mt-2 text-[11px] lg:text-xs text-[#4B5563] space-y-1.5 leading-relaxed list-disc pl-4">
          <li>
            <b>Persentase kehadiran</b> = jumlah <b>Hadir</b> ÷ total catatan kehadiran × 100%.
            Contoh periode ini: {ringkas.hadir} ÷ {ringkas.catatan || 0} × 100% = <b>{ringkas.total}%</b>.
          </li>
          <li>Total catatan = Hadir + Izin + Alpha ({ringkas.hadir} + {ringkas.izin} + {ringkas.alpha} = {ringkas.catatan}), sehingga ketiganya berjumlah 100%.</li>
          <li>1 {satuan} dihitung per peserta yang memang terdaftar pada {satuan} tersebut; peserta yang tidak dipilih tidak dihitung alpha.</li>
          <li>Warna: <b className="text-[#166534]">hijau ≥80% (rajin)</b>, <b className="text-[#92400E]">kuning 50–79% (cukup)</b>, <b className="text-[#991B1B]">merah &lt;50% (jarang)</b>.</li>
          <li>Ketuk bar persentase untuk melihat penjelasan rincian hitungannya.</li>
        </ul>
      </div>

      <DetailModal row={detail} periode={periode} onClose={() => setDetail(null)} />
    </div>
  );
}
