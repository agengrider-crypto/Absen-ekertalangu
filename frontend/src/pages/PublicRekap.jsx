import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CalendarDays, MapPin, User, BookOpen, Loader2, Send, ChevronDown, Layers,
} from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import PesertaRekapList from "@/components/PesertaRekapList";
import ReportHeader from "@/components/ReportHeader";
import {
  PercentRing, StackedBar, StatCard, ReportCard, REPORT_COLORS,
} from "@/components/ReportVisuals";
import { TYPE_LABEL, tanggalPanjang } from "./admin/kegiatanUtils";

const STATUS_LABEL = {
  hadir: "Hadir", izin: "Izin", sakit: "Sakit", alpha: "Alpha",
  belum_diabsen: "Belum diabsen", optional: "Tidak wajib",
};

function genderCounts(rows) {
  const out = { L: 0, P: 0, unknown: 0 };
  (rows || []).forEach((r) => {
    if (r.status !== "hadir") return;
    if (r.gender === "L") out.L += 1;
    else if (r.gender === "P") out.P += 1;
    else out.unknown += 1;
  });
  return out;
}

export default function PublicRekap() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("gabungan");

  useEffect(() => {
    api.get(`/rekap/${token}`)
      .then(({ data: d }) => setData(d))
      .catch((e) => {
        if (e.response?.status === 410) setErr("Tautan rekap sudah kadaluarsa (berlaku 7 hari).");
        else setErr("Tautan rekap tidak ditemukan.");
      });
  }, [token]);

  const gabungan = data?.gabungan || null;
  const sessions = gabungan?.sessions || [];
  const multi = sessions.length > 1;

  const view = useMemo(() => {
    if (!data) return null;
    if (multi && tab !== "gabungan") {
      const idx = sessions.findIndex((s) => s.id === tab);
      const s = sessions[idx];
      if (s) {
        const rows = (gabungan.rows || [])
          .map((r) => ({ ...r, cell: r.sessions?.[idx] }))
          .filter((r) => r.cell)
          .map((r) => ({
            user_id: r.user_id, name: r.name, gender: r.gender,
            status: r.cell.status, arrival_time: r.cell.arrival_time,
            reason: r.cell.reason, note: r.cell.note,
          }));
        return {
          counts: s.counts, rows, label: `${s.label} · ${s.start_time}–${s.end_time}`,
          reasons: rows.filter((r) => ["izin", "sakit", "alpha"].includes(r.status)),
        };
      }
    }
    if (multi) {
      const rows = (gabungan.rows || []).map((r) => {
        const cells = (r.sessions || []).filter(Boolean);
        const hadirCell = cells.find((c) => c.status === "hadir");
        const pick = cells.find((c) => ["izin", "sakit", "alpha"].includes(c.status));
        return {
          user_id: r.user_id, name: r.name, gender: r.gender,
          status: hadirCell ? "hadir" : (pick?.status || "belum_diabsen"),
          arrival_time: hadirCell?.arrival_time || null,
          reason: pick?.reason, note: pick?.note,
        };
      });
      return {
        counts: {
          total: gabungan.total?.total || 0,
          hadir: gabungan.total?.hadir || 0,
          izin: sessions.reduce((n, s) => n + (s.counts.izin || 0), 0),
          sakit: sessions.reduce((n, s) => n + (s.counts.sakit || 0), 0),
          alpha: sessions.reduce((n, s) => n + (s.counts.alpha || 0), 0),
          ratio: gabungan.total?.ratio || 0,
        },
        rows, label: "Gabungan semua sesi",
        reasons: (gabungan.rows || []).flatMap((r) => (r.sessions || [])
          .map((c, i) => (c && ["izin", "sakit", "alpha"].includes(c.status)
            ? { name: r.name, session: sessions[i]?.label, status: c.status, reason: c.reason || c.note }
            : null))
          .filter(Boolean)),
      };
    }
    return {
      counts: data.counts || {}, rows: data.rows || [],
      label: `${data.start_time}–${data.end_time}`, reasons: [],
    };
  }, [data, gabungan, multi, sessions, tab]);

  if (err) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center px-4 text-center">
        <Logo size={48} />
        <p className="text-[#A32A2A] font-semibold mt-6">{err}</p>
      </div>
    );
  }
  if (!data || !view) {
    return <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={32} /></div>;
  }

  const c = view.counts || {};
  const total = Number(c.total) || 0;
  const hadir = Number(c.hadir) || 0;
  const ratio = total ? Math.round((hadir / total) * 100) : 0;
  const g = genderCounts(view.rows);
  const waText = [
    `Laporan ${data.name}`,
    `${tanggalPanjang(data.date)} · ${view.label}`,
    `Hadir ${hadir}/${total} orang = ${ratio}%`,
    `Izin ${c.izin || 0} · Sakit ${c.sakit || 0} · Alpha ${c.alpha || 0}`,
    typeof window !== "undefined" ? window.location.href : "",
  ].join("\n");

  return (
    <div className="min-h-screen bg-[#F6F4EE] pb-12">
      <ReportHeader
        title="Laporan Rekap Kegiatan"
        subtitle={`${tanggalPanjang(data.date)} · ${view.label}`}
        showUserIcon
        testid="rekap-public-header"
      />

      <main className="mx-auto max-w-2xl space-y-3 px-4">
        <ReportCard index={0} className="rounded-2xl border border-[#E7E3D8] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#E3F3EA] px-2 py-0.5 text-xs font-semibold text-[#0E4E31]">
              {TYPE_LABEL[data.type] || "Kegiatan"}
            </span>
            {multi && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#FBF1D6] px-2 py-0.5 text-xs font-bold text-[#6B4500]">
                <Layers size={12} /> {sessions.length} sesi
              </span>
            )}
          </div>
          <h2 className="mt-2 font-heading text-xl font-bold text-[#14201A]">{data.name}</h2>
          <div className="mt-2 space-y-1 text-sm text-[#5F6B63]">
            <div className="flex items-center gap-2"><CalendarDays size={15} /> {tanggalPanjang(data.date)}</div>
            {data.location && <div className="flex items-center gap-2"><MapPin size={15} /> {data.location}</div>}
            {data.teacher && <div className="flex items-center gap-2"><User size={15} /> {data.teacher}</div>}
            {data.material && <div className="flex items-center gap-2"><BookOpen size={15} /> {data.material}</div>}
          </div>
          {multi && (
            <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl bg-[#F0EEE6] p-1 no-scrollbar" data-testid="rekap-session-toggle">
              {[{ id: "gabungan", label: "Gabungan" }, ...sessions.map((s) => ({ id: s.id, label: s.label }))].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-pressed={tab === t.id}
                  className={`h-9 shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors ${
                    tab === t.id ? "bg-white text-[#0E4E31] shadow-sm" : "text-[#5F6B63]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </ReportCard>

        <ReportCard index={1} className="rounded-2xl border border-[#E7E3D8] bg-white p-5">
          <div className="flex items-center gap-4">
            <PercentRing value={ratio} />
            <div className="min-w-0">
              <div className="font-heading text-base font-bold text-[#14201A]">
                {hadir} dari {total} orang hadir
              </div>
              <div className="mt-0.5 text-xs text-[#5F6B63]">Tingkat kehadiran · {view.label}</div>
            </div>
          </div>
          <div className="mt-4">
            <StackedBar counts={c} testid="rekap-stacked-bar" />
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-[#5F6B63]">
              <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: REPORT_COLORS.hadir }} /> Hadir</span>
              <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: REPORT_COLORS.izin }} /> Izin</span>
              <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: REPORT_COLORS.sakit }} /> Sakit</span>
              <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ background: REPORT_COLORS.alpha }} /> Alpha</span>
            </div>
          </div>
        </ReportCard>

        <ReportCard index={2} className="grid grid-cols-4 gap-2">
          <StatCard label="Hadir" value={c.hadir || 0} color="#0E4E31" bg="#E3F3EA" testid="rekap-stat-hadir" />
          <StatCard label="Izin" value={c.izin || 0} color="#6B4500" bg="#FBF1D6" testid="rekap-stat-izin" />
          <StatCard label="Sakit" value={c.sakit || 0} color="#1D4F91" bg="#E3EEFB" testid="rekap-stat-sakit" />
          <StatCard label="Alpha" value={c.alpha || 0} color="#A32A2A" bg="#FBE5E3" testid="rekap-stat-alpha" />
        </ReportCard>

        <ReportCard index={3} className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
            <div className="font-heading text-xl font-bold tabular-nums text-[#14201A]">{g.L}</div>
            <div className="mt-0.5 text-[11px] font-semibold text-[#5F6B63]">Laki-laki hadir</div>
          </div>
          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
            <div className="font-heading text-xl font-bold tabular-nums text-[#14201A]">{g.P}</div>
            <div className="mt-0.5 text-[11px] font-semibold text-[#5F6B63]">Perempuan hadir</div>
          </div>
          {g.unknown > 0 && (
            <p className="col-span-2 text-[11px] text-[#5F6B63]">{g.unknown} peserta belum mengisi jenis kelamin</p>
          )}
        </ReportCard>

        <ReportCard index={4}>
          <PesertaRekapList rows={view.rows} title="Daftar Peserta" testid="rekap-publik-list" />
        </ReportCard>

        {view.reasons.length > 0 && (
          <ReportCard index={5}>
            <ReasonAccordion items={view.reasons} />
          </ReportCard>
        )}

        <ReportCard index={6}>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
            target="_blank"
            rel="noreferrer"
            data-testid="rekap-share-wa"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B6B52] font-semibold text-white hover:brightness-110"
          >
            <Send size={17} /> Bagikan rekap ke WhatsApp
          </a>
        </ReportCard>

        <p className="text-center text-xs text-[#5F6B63]">© 2026 E-KERTALANGU · Absensi Pengajian</p>
      </main>
    </div>
  );
}

function ReasonAccordion({ items }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E7E3D8] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid="rekap-reasons-toggle"
        className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left text-sm font-semibold text-[#14201A]"
      >
        Rincian Izin / Sakit / Alpha ({items.length})
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="divide-y divide-[#F0EEE6] border-t border-[#F0EEE6] px-4">
          {items.map((x, i) => (
            <li key={`${x.name}-${i}`} className="flex min-h-10 items-center justify-between gap-3 py-1.5 text-sm">
              <span className="min-w-0 truncate font-medium text-[#14201A]">
                {x.name}{x.session ? <span className="text-[#5F6B63]"> · {x.session}</span> : null}
              </span>
              <span className="shrink-0 text-xs text-[#5F6B63]">{x.reason || "-"}</span>
              <span className="shrink-0 rounded-full bg-[#F0EEE6] px-2 py-0.5 text-[11px] font-semibold text-[#5F6B63]">
                {STATUS_LABEL[x.status] || x.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
