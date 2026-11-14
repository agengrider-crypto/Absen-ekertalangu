// Ruang Teduh — layar depan sederhana + form "Mulai bercerita".
// Penyimpanan memakai endpoint pengaduan yang sudah ada (koleksi `pengaduans`).
import { useEffect, useState } from "react";
import {
  HeartHandshake, Loader2, ArrowLeft, ChevronDown, Eye, ShieldCheck, UserX,
  AlertTriangle, CheckCircle2, Clock, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

const FALLBACK_CATEGORIES = [
  { value: "pertemanan", label: "Pertemanan" },
  { value: "keluarga", label: "Keluarga" },
  { value: "sekolah", label: "Sekolah / Kerja / Kuliah" },
  { value: "perundungan", label: "Perundungan / Bullying" },
  { value: "kekerasan", label: "Kekerasan" },
  { value: "kehadiran", label: "Kehadiran" },
  { value: "perasaan", label: "Perasaan pribadi" },
  { value: "saran", label: "Saran & Masukan" },
  { value: "curhat", label: "Curhat / Konsultasi" },
  { value: "mental", label: "Permasalahan mental" },
  { value: "ekonomi", label: "Ekonomi" },
  { value: "lainnya", label: "Lainnya" },
];

const SENSITIVE = ["perundungan", "kekerasan", "mental"];
const JUDUL_MAX = 60;
const ISI_MAX = 800;
const DARURAT = "Jika kamu atau orang lain sedang dalam bahaya, segera hubungi pengurus atau orang dewasa terdekat.";

const POIN = [
  { icon: Eye, label: "Yang membaca pengurus saja" },
  { icon: ShieldCheck, label: "Namamu dijaga baik" },
  { icon: UserX, label: "Tanpa nama tidak apa-apa" },
];

function DaruratNote() {
  return (
    <p className="px-1 text-[11px] leading-relaxed text-[#5F6B63]" data-testid="ruangteduh-darurat">
      {DARURAT}
    </p>
  );
}

const BULAN_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function tanggalSingkat(iso) {
  const d = String(iso || "").slice(0, 10).split("-");
  if (d.length !== 3) return "-";
  return `${Number(d[2])} ${BULAN_SHORT[Number(d[1]) - 1]}`;
}

const TAHAP_STATUS = [
  ["baru", "Terkirim"],
  ["dibaca", "Dibaca"],
  ["ditindaklanjuti", "Ditindaklanjuti"],
];

/** Tiga titik status: sampai status saat ini hijau, sisanya abu-abu. */
function StatusTiga({ status }) {
  const idx = Math.max(0, TAHAP_STATUS.findIndex(([v]) => v === (status || "baru")));
  return (
    <div className="mt-2.5 flex items-center gap-1.5" data-testid="ruangteduh-status-tiga">
      {TAHAP_STATUS.map(([v, label], i) => (
        <span key={v} className="inline-flex items-center gap-1.5">
          {i > 0 && <span className={`h-px w-3 ${i <= idx ? "bg-[#14633F]" : "bg-[#E7E3D8]"}`} />}
          <span className={`h-2 w-2 rounded-full ${i <= idx ? "bg-[#14633F]" : "bg-[#D9D4C5]"}`} />
          <span className={`text-[10px] font-semibold ${i === idx ? "text-[#0E4E31]" : "text-[#5F6B63]"}`}>{label}</span>
        </span>
      ))}
    </div>
  );
}

export default function RuangTeduh() {
  const [view, setView] = useState("depan"); // depan | form | terkirim
  const [riwayat, setRiwayat] = useState(null);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [sent, setSent] = useState(null);

  const load = () =>
    api.get("/me/pengaduan")
      .then(({ data }) => {
        setRiwayat(data.items || []);
        if (data.categories?.length) setCategories(data.categories);
      })
      .catch(() => setRiwayat([]));

  useEffect(() => { load(); }, []);

  if (view === "form") {
    return (
      <FormCerita
        categories={categories}
        onBack={() => setView("depan")}
        onSent={(info) => { setSent(info); setView("terkirim"); load(); }}
      />
    );
  }

  if (view === "terkirim") {
    return (
      <div className="space-y-4" data-testid="ruangteduh-terkirim">
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E3F3EA] text-[#0E4E31]">
            <CheckCircle2 size={26} />
          </span>
          <h1 className="font-heading text-xl font-bold text-[#14201A] mt-3">Terima kasih</h1>
          <p className="text-sm text-[#5F6B63] mt-1">Ceritamu sudah sampai ke pengurus.</p>
          <p className="text-sm text-[#5F6B63] mt-2">
            {sent?.anonymous
              ? "Dikirim tanpa nama, jadi pengurus tidak bisa membalas kamu secara pribadi."
              : "Dikirim atas namamu, dan namamu dijaga baik."}
          </p>
        </div>
        <button
          type="button"
          data-testid="ruangteduh-kembali"
          onClick={() => setView("depan")}
          className="h-12 w-full rounded-xl bg-[#14633F] font-semibold text-white hover:bg-[#0E4E31]"
        >
          Kembali ke Ruang Teduh
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="ruangteduh-depan">
      <div>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E3F3EA] text-[#0E4E31]">
          <HeartHandshake size={24} />
        </span>
        <h1 className="font-heading text-2xl font-bold text-[#14201A] mt-3">
          Ruang <span className="text-[#14633F]">Teduh</span>
        </h1>
        <p className="text-sm text-[#5F6B63] mt-1">
          Tempat untuk bercerita tentang apa saja yang sedang kamu hadapi.
        </p>
      </div>

      <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
        <ul className="space-y-2.5">
          {POIN.map((p) => {
            const Icon = p.icon;
            return (
              <li key={p.label} className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E3F3EA] text-[#0E4E31]">
                  <Icon size={15} />
                </span>
                <span className="text-sm font-semibold text-[#14201A]">{p.label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        data-testid="ruangteduh-mulai"
        onClick={() => setView("form")}
        className="h-12 w-full rounded-xl bg-[#14633F] font-bold text-white hover:bg-[#0E4E31]"
      >
        Mulai bercerita
      </button>

      <div>
        <h2 className="font-heading font-bold text-[#14201A] mb-1">Cerita saya</h2>
        <p className="mb-2 text-[11px] text-[#5F6B63]">Hanya Anda yang bisa melihat ini.</p>
        {riwayat === null ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={22} /></div>
        ) : riwayat.length === 0 ? (
          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5 text-center" data-testid="ruangteduh-riwayat-empty">
            <p className="text-sm text-[#5F6B63]">Belum ada cerita. Ruang Teduh siap mendengarkan.</p>
            <button type="button" onClick={() => setView("form")}
              className="mt-3 h-11 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]">
              Mulai bercerita
            </button>
          </div>
        ) : (
          <div className="space-y-2" data-testid="ruangteduh-riwayat">
            {riwayat.map((r) => (
              <div key={r.id} className="rounded-2xl border border-[#E7E3D8] bg-white p-4" data-testid={`ruangteduh-riwayat-${r.id}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-[#E3F3EA] px-2 py-0.5 font-semibold text-[#0E4E31]">{r.category_label}</span>
                  <span className="inline-flex items-center gap-1 text-[#5F6B63]"><Clock size={11} /> {tanggalSingkat(r.at)}</span>
                </div>
                <p className="mt-1.5 truncate text-sm text-[#14201A]">{r.cuplikan || "(tanpa isi)"}</p>
                {r.anonymous ? (
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#5F6B63]">
                    <EyeOff size={12} /> Dikirim anonim, tanpa status
                  </p>
                ) : (
                  <StatusTiga status={r.status} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <DaruratNote />
    </div>
  );
}

function FormCerita({ categories, onBack, onSent }) {
  const [category, setCategory] = useState("");
  const [judul, setJudul] = useState("");
  const [isi, setIsi] = useState("");
  const [anonim, setAnonim] = useState(false);
  const [saving, setSaving] = useState(false);

  const valid = Boolean(category) && judul.trim().length >= 3 && isi.trim().length >= 10;
  const sensitif = SENSITIVE.includes(category);

  const kirim = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const { data } = await api.post("/me/pengaduan", {
        category, judul: judul.trim(), message: isi.trim(), anonymous: anonim,
      });
      onSent({ anonymous: Boolean(data?.anonymous ?? anonim) });
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="ruangteduh-form">
      <button
        type="button"
        data-testid="ruangteduh-back"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#5F6B63] hover:text-[#0E4E31]"
      >
        <ArrowLeft size={16} /> Ruang Teduh
      </button>

      <h1 className="font-heading text-[22px] font-semibold text-[#14201A]">
        Mulai <span className="text-[#14633F]">bercerita</span>
      </h1>

      <div className="rounded-2xl bg-[#E3F3EA] p-4 text-sm leading-relaxed text-[#0E4E31]">
        Silakan bercerita dengan tenang dan apa adanya. Ceritamu dibaca pengurus, namamu dijaga baik,
        dan ditindaklanjuti dengan baik.
      </div>

      <div className="space-y-4 rounded-2xl border border-[#E7E3D8] bg-white p-4">
        <div>
          <label className="block text-[13px] font-semibold text-[#14201A]" htmlFor="teduh-kategori">Tentang apa?</label>
          <div className="relative mt-1.5">
            <select
              id="teduh-kategori"
              data-testid="ruangteduh-kategori"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-12 w-full appearance-none rounded-xl border border-[#8A948D] bg-white px-3.5 pr-10 text-[15px] outline-none focus:border-[#14633F]"
            >
              <option value="">Pilih kategori</option>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <ChevronDown size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
          </div>
          {sensitif && (
            <p className="mt-2 rounded-lg bg-[#FBF1D6] px-3 py-2 text-[11px] leading-relaxed text-[#6B4500]" data-testid="ruangteduh-peringatan">
              <AlertTriangle size={12} className="mr-1 inline" />
              Jika kamu butuh bantuan segera, hubungi pengurus atau orang dewasa yang kamu percaya.
            </p>
          )}
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-[#14201A]" htmlFor="teduh-judul">Judul masalahnya?</label>
          <input
            id="teduh-judul"
            data-testid="ruangteduh-judul"
            value={judul}
            onChange={(e) => setJudul(e.target.value.slice(0, JUDUL_MAX))}
            placeholder="Singkat saja"
            className="mt-1.5 h-12 w-full rounded-xl border border-[#8A948D] px-3.5 text-[15px] outline-none focus:border-[#14633F]"
          />
          <div className="mt-1 text-right text-[11px] text-[#5F6B63]">{judul.length} / {JUDUL_MAX}</div>
        </div>

        <div>
          <label className="block text-[13px] font-semibold text-[#14201A]" htmlFor="teduh-isi">Ceritakan masalahnya?</label>
          <textarea
            id="teduh-isi"
            data-testid="ruangteduh-message"
            value={isi}
            onChange={(e) => setIsi(e.target.value.slice(0, ISI_MAX))}
            rows={5}
            placeholder="Tulis dengan bebas..."
            className="mt-1.5 w-full resize-none rounded-xl border border-[#8A948D] px-3.5 py-2.5 text-[15px] leading-relaxed outline-none focus:border-[#14633F]"
          />
          <div className="mt-1 text-right text-[11px] text-[#5F6B63]">{isi.length} / {ISI_MAX}</div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[#14201A]">Kirim tanpa nama</span>
            <button
              type="button"
              role="switch"
              aria-checked={anonim}
              aria-label="Kirim tanpa nama"
              data-testid="ruangteduh-anonim"
              onClick={() => setAnonim((v) => !v)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${anonim ? "bg-[#14633F]" : "bg-[#D9D4C5]"}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${anonim ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#5F6B63]">
            {anonim
              ? "Namamu tidak disimpan. Pengurus tidak bisa membalas pribadi."
              : "Namamu ikut terkirim ke pengurus."}
          </p>
        </div>

        <button
          type="button"
          data-testid="ruangteduh-kirim"
          onClick={kirim}
          disabled={!valid || saving}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#14633F] font-bold text-white transition-colors hover:bg-[#0E4E31] disabled:opacity-50"
        >
          {saving && <Loader2 size={17} className="animate-spin" />} Kirim
        </button>
      </div>

      <DaruratNote />
    </div>
  );
}
