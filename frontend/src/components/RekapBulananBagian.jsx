// Bagian bersama Rekap Bulanan: kartu ringkasan (ring + batang L/P) dan
// kalender pertemuan. Dipakai halaman admin dan tautan publik.
// `interactive` = false pada tautan publik: blok status hanya berisi jumlah.
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Mars, Venus, Users, CalendarRange, ChevronRight } from "lucide-react";
import StatusGroups, { ProgressBar } from "@/components/StatusGroups";
import { REKAP } from "@/pages/admin/rekapUtils";
import { nowWita, tanggalPanjang } from "@/pages/admin/kegiatanUtils";

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function prefersReduced() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Ring({ value, size = 104, stroke = 11 }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [grown, setGrown] = useState(prefersReduced);
  useEffect(() => {
    if (prefersReduced()) { setGrown(true); return undefined; }
    const t = setTimeout(() => setGrown(true), 30);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0EEE6" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={REKAP.hadir} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={grown ? c - (c * v) / 100 : c}
          style={{ transition: "stroke-dashoffset 900ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-xl font-bold tabular-nums text-[#14201A]">{v}%</span>
        <span className="text-[10px] font-semibold text-[#5F6B63]">hadir</span>
      </div>
    </div>
  );
}

function GenderRow({ icon: Icon, label, count, ratio, color, testid }) {
  return (
    <div data-testid={testid}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#14201A]">
          <Icon size={14} style={{ color }} aria-hidden="true" />
          <span className="truncate">{label} · {count} peserta</span>
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color }}>{ratio}%</span>
      </div>
      <div className="mt-1.5">
        <ProgressBar value={ratio} color={color} testid={`${testid}-bar`} />
      </div>
    </div>
  );
}

/** Satu kartu ringkasan: ring gabungan (kiri) + Laki-laki/Perempuan (kanan). */
export function RingkasanBulanan({ data }) {
  const g = data.gender || {};
  const L = g.L || {};
  const P = g.P || {};
  // Bobot = peserta yang punya pertemuan bulan ini (dasar yang sama dengan
  // rata-rata hadir), sehingga ring = rata-rata tertimbang L dan P.
  const nL = Number(L.peserta) || 0;
  const nP = Number(P.peserta) || 0;
  // a + b < N: sisa peserta (jenis kelamin belum diisi / belum punya pertemuan).
  const belum = Math.max(0, (Number(data.total_peserta) || 0) - nL - nP);

  return (
    <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5" data-testid="rekap-bulanan-ringkasan">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex items-center gap-4">
          <Ring value={data.summary?.rata_rata || 0} />
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#5F6B63]">Total gabungan</div>
            <div className="mt-1 space-y-0.5 text-sm text-[#14201A]">
              <div className="inline-flex items-center gap-1.5"><Users size={13} className="text-[#5F6B63]" /> {data.total_peserta} peserta</div>
              <div className="inline-flex items-center gap-1.5"><CalendarDays size={13} className="text-[#5F6B63]" /> {data.total_pertemuan} pertemuan</div>
              <div className="inline-flex items-center gap-1.5"><CalendarRange size={13} className="text-[#5F6B63]" /> {data.total_kegiatan} jadwal</div>
            </div>
          </div>
        </div>

        <div className="space-y-3 border-t border-[#E7E3D8] pt-4 sm:flex-1 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <GenderRow icon={Mars} label="Laki-laki" count={nL} ratio={L.ratio || 0}
            color={REKAP.lk} testid="rekap-bulanan-gender-laki-laki" />
          <GenderRow icon={Venus} label="Perempuan" count={nP} ratio={P.ratio || 0}
            color={REKAP.pr} testid="rekap-bulanan-gender-perempuan" />
          {belum > 0 && (
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#5F6B63]" data-testid="rekap-bulanan-gender-belum">
              <span className="inline-flex items-center gap-1.5"><Users size={14} /> Belum diisi · {belum} peserta</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Kalender pertemuan sebulan + panel rincian tanggal terpilih. */
export function KalenderBulanan({ data, interactive = true, onOpenHarian }) {
  const [selected, setSelected] = useState(null);
  const today = nowWita().date;

  const byDate = useMemo(() => {
    const map = {};
    (data.per_pertemuan || []).forEach((p) => {
      if (!p.date) return;
      (map[p.date] = map[p.date] || []).push(p);
    });
    return map;
  }, [data]);

  const [y, m] = String(data.month || "").split("-").map(Number);
  const daysInMonth = y && m ? new Date(y, m, 0).getDate() : 0;
  const firstDow = y && m ? new Date(y, m - 1, 1).getDay() : 0;
  const cells = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);

  const ymd = (d) => `${data.month}-${String(d).padStart(2, "0")}`;
  const dayItems = selected ? (byDate[selected] || []) : [];

  return (
    <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4 sm:p-5" data-testid="rekap-bulanan-kalender">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-[#14201A] inline-flex items-center gap-2">
          <CalendarDays size={16} className="text-[#14633F]" /> Pertemuan {data.label}
        </div>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#5F6B63]">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#14633F]" /> Hijau = ada kegiatan
        </span>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {HARI.map((h) => (
          <div key={h} className="pb-1 text-center text-[11px] font-bold uppercase tracking-wide text-[#5F6B63]">{h}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;
          const date = ymd(d);
          const has = Boolean(byDate[date]);
          const isToday = date === today;
          const isSel = date === selected;
          return (
            <button
              key={date}
              type="button"
              disabled={!has}
              onClick={() => setSelected(isSel ? null : date)}
              aria-pressed={isSel}
              aria-label={`${tanggalPanjang(date)}${has ? `, ${byDate[date].length} kegiatan` : ", tidak ada kegiatan"}`}
              data-testid={`kalender-bulanan-${date}`}
              className={`relative flex h-10 items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition-colors ${
                has
                  ? isSel
                    ? "bg-[#14633F] text-white"
                    : "bg-[#E3F3EA] text-[#0E4E31] hover:bg-[#D3EBDD]"
                  : "text-[#B4BBB6]"
              } ${isToday && !isSel ? "ring-2 ring-[#14633F] ring-offset-1" : ""}`}
            >
              {d}
            </button>
          );
        })}
      </div>

      {!selected ? (
        <p className="mt-3 text-xs text-[#5F6B63]" data-testid="rekap-bulanan-kalender-hint">
          Pilih tanggal hijau untuk melihat rincian kehadiran.
        </p>
      ) : (
        <div className="mt-4 space-y-3 border-t border-[#E7E3D8] pt-3" data-testid="rekap-bulanan-tanggal-detail">
          <div className="text-sm font-bold text-[#14201A]">{tanggalPanjang(selected)}</div>
          {dayItems.map((p, i) => (
            <div key={`${p.name}-${i}`} className="rounded-xl border border-[#F0EEE6] p-3">
              <div className="text-sm font-semibold text-[#14201A]">{p.name}</div>
              <div className="mt-2">
                <StatusGroups
                  counts={{
                    total: p.peserta, hadir: p.hadir, izin: p.izin,
                    sakit: p.sakit, alpha: p.alpha, belum_diabsen: p.belum_diabsen,
                  }}
                  rows={(p.peserta_rows || []).map((person) => ({
                    name: person.name, status: person.status, reason: person.reason,
                  }))}
                  showBelum={false}
                  countOnly={!interactive}
                  collapsible={interactive}
                  showRatio={false}
                  defaultStatus={null}
                  testid={`bulanan-tanggal-status-${i}`}
                />
              </div>
            </div>
          ))}
          {interactive && onOpenHarian && (
            <button
              type="button"
              onClick={() => onOpenHarian(selected)}
              data-testid="rekap-bulanan-buka-harian"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#0E4E31] underline"
            >
              Buka rekap harian lengkap <ChevronRight size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
