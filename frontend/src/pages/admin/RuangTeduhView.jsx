// Laporan Masuk (Ruang Teduh) — panel Pengurus & Administrator.
// Desktop: daftar pesan (kiri) + detail terpilih (kanan). HP: daftar saja,
// ketuk pesan membuka detail dengan tautan "← Daftar pesan".
// Status tiga tahap diturunkan dari data: ditindaklanjuti_at > read_by > baru.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  HeartHandshake, Loader2, Search, Clock, Trash2, MoreVertical, ArrowLeft,
  CheckCheck, UserRound, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import Modal from "@/components/Modal";

const CAT_CLS = {
  pertemanan: "bg-[#E3F3EA] text-[#0E4E31]",
  keluarga: "bg-[#E3F3EA] text-[#0E4E31]",
  sekolah: "bg-[#D9F2F4] text-[#1D4F91]",
  perundungan: "bg-[#FBE5E3] text-[#A32A2A]",
  kekerasan: "bg-[#FBE5E3] text-[#A32A2A]",
  kehadiran: "bg-[#FBF1D6] text-[#6B4500]",
  perasaan: "bg-[#ECE4FB] text-[#4C2A9B]",
  saran: "bg-[#E3F3EA] text-[#0E4E31]",
  curhat: "bg-[#E3F3EA] text-[#0E4E31]",
  mental: "bg-[#FBE5E3] text-[#A32A2A]",
  ekonomi: "bg-[#FBF1D6] text-[#6B4500]",
  lainnya: "bg-[#F0EEE6] text-[#5F6B63]",
  pengaduan: "bg-[#FBE5E3] text-[#A32A2A]",
  kendala: "bg-[#FBF1D6] text-[#6B4500]",
  pertanyaan: "bg-[#D9F2F4] text-[#1D4F91]",
};

const STATUS_META = {
  baru: { label: "Baru", cls: "bg-[#E3F3EA] text-[#0E4E31]" },
  dibaca: { label: "Dibaca", cls: "bg-[#E3EEFB] text-[#1D4F91]" },
  ditindaklanjuti: { label: "Ditindaklanjuti", cls: "bg-[#F0EEE6] text-[#5F6B63]" },
};

const TAHAP = [
  ["baru", "Baru"],
  ["dibaca", "Dibaca"],
  ["ditindaklanjuti", "Ditindaklanjuti"],
];

const FILTERS = [
  ["semua", "Semua"],
  ["belum", "Belum dibaca"],
  ["segera", "Perlu segera"],
];

const BULAN_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function waktuSingkat(iso) {
  if (!iso) return "-";
  const s = String(iso);
  const d = s.slice(0, 10).split("-");
  const jam = s.slice(11, 16);
  if (d.length !== 3) return s;
  return `${Number(d[2])} ${BULAN_SHORT[Number(d[1]) - 1]} ${jam}`;
}

function waktuLengkap(iso) {
  if (!iso) return "-";
  return `${String(iso).slice(0, 16).replace("T", " ")} WITA`;
}

function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel, testid }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} testid={testid} maxWidth={420} hideClose
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} data-testid={`${testid}-batal`}
            className="h-11 flex-1 rounded-xl border-2 border-[#E7E3D8] font-semibold text-[#5F6B63] hover:bg-[#F6F4EE]">
            Batal
          </button>
          <button type="button" onClick={onConfirm} data-testid={`${testid}-ya`}
            className="h-11 flex-1 rounded-xl bg-[#A32A2A] font-semibold text-white hover:bg-[#8C2323]">
            {confirmLabel}
          </button>
        </div>
      }>
      <p className="text-sm text-[#5F6B63]">{body}</p>
    </Modal>
  );
}

export default function RuangTeduhView() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("semua");
  const [activeId, setActiveId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmHapus, setConfirmHapus] = useState(null); // id | "semua" | null
  const [catatan, setCatatan] = useState("");
  const [saveState, setSaveState] = useState("idle");
  const debounceRef = useRef(null);

  const load = () =>
    api.get("/staff/pengaduan")
      .then(({ data: d }) => setData(d))
      .catch((e) => { setData(false); toast.error(formatApiErrorDetail(e.response?.data?.detail)); });

  useEffect(() => { load(); }, []);

  const rows = useMemo(() => {
    let list = data?.rows || [];
    const t = q.trim().toLowerCase();
    if (t) {
      list = list.filter((r) => (r.message || "").toLowerCase().includes(t)
        || (r.name || "").toLowerCase().includes(t)
        || (r.judul || "").toLowerCase().includes(t));
    }
    if (filter === "belum") list = list.filter((r) => r.status === "baru");
    if (filter === "segera") list = list.filter((r) => r.perlu_segera);
    return list;
  }, [data, q, filter]);

  const active = (data?.rows || []).find((r) => r.id === activeId) || null;

  // Buka pesan Baru → otomatis Dibaca (server menyimpan read_by).
  const openPesan = async (r) => {
    setActiveId(r.id);
    setCatatan(r.catatan_pengurus || "");
    if (r.status === "baru") {
      try {
        const { data: d } = await api.patch(`/staff/pengaduan/${r.id}`, { status: "dibaca" });
        setData((prev) => prev && { ...prev, rows: prev.rows.map((x) => (x.id === d.id ? d : x)) });
      } catch { /* biarkan status lama */ }
    }
  };

  const ubahStatus = async (status) => {
    if (!active) return;
    try {
      const { data: d } = await api.patch(`/staff/pengaduan/${active.id}`, { status });
      setData((prev) => prev && { ...prev, rows: prev.rows.map((x) => (x.id === d.id ? d : x)) });
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  // Catatan pengurus: simpan otomatis (debounce 600 ms).
  const onCatatan = (value) => {
    setCatatan(value);
    setSaveState("saving");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const id = active?.id;
    debounceRef.current = setTimeout(async () => {
      if (!id) return;
      try {
        const { data: d } = await api.patch(`/staff/pengaduan/${id}`, { catatan_pengurus: value });
        setData((prev) => prev && { ...prev, rows: prev.rows.map((x) => (x.id === d.id ? d : x)) });
        setSaveState("saved");
      } catch { setSaveState("idle"); }
    }, 600);
  };

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const hapus = async (id) => {
    try {
      await api.delete(`/staff/pengaduan/${id}`);
      toast.success("Pesan dihapus");
      if (activeId === id) setActiveId(null);
      setConfirmHapus(null);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const hapusSemua = async () => {
    try {
      const { data: d } = await api.delete("/staff/pengaduan");
      toast.success(`${d.deleted} pesan dihapus`);
      setActiveId(null);
      setConfirmHapus(null);
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const total = data && data !== false ? data.total : 0;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold text-[#0E4E31] flex items-center gap-2">
            <HeartHandshake size={22} className="text-[#0E4E31]" /> Laporan Masuk
          </h1>
          <p className="text-[#5F6B63] text-sm mt-1">
            Cerita peserta dari Ruang Teduh. Mohon disikapi dengan lembut dan dijaga kerahasiaannya.
          </p>
        </div>
        <div className="relative shrink-0">
          <button type="button" data-testid="ruangteduh-menu" onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu lain" aria-expanded={menuOpen}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[#5F6B63] hover:bg-[#F0EEE6]">
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <>
              <button type="button" aria-label="Tutup menu" tabIndex={-1}
                onClick={() => setMenuOpen(false)} className="fixed inset-0 z-10 cursor-default" />
              <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-[#E7E3D8] bg-white shadow-lg">
                <button type="button" data-testid="ruangteduh-hapus-semua"
                  onClick={() => { setMenuOpen(false); setConfirmHapus("semua"); }}
                  className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm font-semibold text-[#A32A2A] hover:bg-[#FBE5E3]">
                  <Trash2 size={15} /> Hapus semua riwayat
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {data && data !== false && (
        <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="ruangteduh-statistik">
          <span className="rounded-full bg-[#F0EEE6] px-2.5 py-1 text-xs font-semibold text-[#5F6B63]">Total {data.total}</span>
          <span className="rounded-full bg-[#E3F3EA] px-2.5 py-1 text-xs font-semibold text-[#0E4E31]">Belum dibaca {data.belum_dibaca}</span>
          <span className="rounded-full bg-[#FBE5E3] px-2.5 py-1 text-xs font-semibold text-[#A32A2A]">Perlu segera {data.perlu_segera || 0}</span>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* Daftar pesan */}
        <div className={active ? "hidden lg:block" : ""}>
          <div className="relative">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
            <input data-testid="ruangteduh-search" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Cari judul, isi, atau nama peserta…"
              className="h-11 w-full rounded-xl border border-[#E7E3D8] bg-white pl-11 pr-4 text-base outline-none focus:border-[#14633F]" />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {FILTERS.map(([v, l]) => (
              <button key={v} type="button" data-testid={`ruangteduh-filter-${v}`} onClick={() => setFilter(v)}
                className={`h-9 rounded-lg px-3 text-xs font-semibold ${filter === v ? "bg-[#14633F] text-white" : "bg-[#F0EEE6] text-[#5F6B63] hover:bg-[#E7E3D8]"}`}>
                {l}
              </button>
            ))}
          </div>

          <div className="mt-3 max-h-[70vh] overflow-y-auto rounded-2xl border border-[#E7E3D8] bg-white p-1.5" data-testid="ruangteduh-list">
            {data === null ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[#0E4E31]" size={24} /></div>
            ) : data === false ? (
              <div className="p-8 text-center text-sm text-[#5F6B63]">Gagal memuat pesan.</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#5F6B63]" data-testid="ruangteduh-empty">Belum ada pesan dari peserta.</div>
            ) : rows.map((r) => (
              <button key={r.id} type="button" data-testid={`ruangteduh-card-${r.id}`} onClick={() => openPesan(r)}
                className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left ${activeId === r.id ? "bg-[#E3F3EA]" : "hover:bg-[#F6F4EE]"}`}>
                <div className="flex items-center gap-1.5">
                  {r.status === "baru" && <span className="h-2 w-2 shrink-0 rounded-full bg-[#14633F]" aria-label="Belum dibaca" />}
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${CAT_CLS[r.category] || CAT_CLS.curhat}`}>{r.category_label}</span>
                  {r.perlu_segera && (
                    <span className="shrink-0 rounded-full bg-[#FBE5E3] px-1.5 py-0.5 text-[10px] font-bold text-[#A32A2A]">Perlu segera</span>
                  )}
                  <span className="ml-auto shrink-0 text-[10px] text-[#5F6B63]">{waktuSingkat(r.at)}</span>
                </div>
                <div className={`mt-1 truncate text-sm ${r.status === "baru" ? "font-bold text-[#14201A]" : "font-semibold text-[#14201A]"}`}>
                  {r.judul || "(tanpa judul)"}
                </div>
                <div className="truncate text-[11px] text-[#5F6B63]">
                  {r.name} · {(r.message || "").replace(/\n/g, " ")}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail pesan */}
        <div className={`${active ? "" : "hidden lg:block"}`}>
          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-5" data-testid="ruangteduh-detail">
            {!active ? (
              <div className="flex h-64 flex-col items-center justify-center text-[#5F6B63]">
                <HeartHandshake size={40} />
                <p className="mt-3 text-sm">Pilih pesan untuk membaca ceritanya.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <button type="button" onClick={() => setActiveId(null)} data-testid="ruangteduh-kembali-daftar"
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#5F6B63] hover:text-[#0E4E31] lg:hidden">
                  <ArrowLeft size={16} /> Daftar pesan
                </button>

                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CAT_CLS[active.category] || CAT_CLS.curhat}`}>{active.category_label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[active.status].cls}`}>{STATUS_META[active.status].label}</span>
                    {active.perlu_segera && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#FBE5E3] px-2 py-0.5 text-xs font-bold text-[#A32A2A]">
                        <ShieldAlert size={12} /> Perlu segera
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-[#5F6B63]"><Clock size={12} /> {waktuLengkap(active.at)}</span>
                  </div>
                  <button type="button" data-testid={`ruangteduh-hapus-${active.id}`} onClick={() => setConfirmHapus(active.id)}
                    aria-label="Hapus pesan ini"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#A32A2A] hover:bg-[#FBE5E3]">
                    <Trash2 size={15} />
                  </button>
                </div>

                <h2 className="font-heading text-lg font-bold text-[#14201A]">{active.judul || "(tanpa judul)"}</h2>
                <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0E4E31]">
                  <UserRound size={15} /> Dari: {active.name}
                </div>

                {active.anonymous && (
                  <div className="rounded-xl border border-[#E7E3D8] bg-[#F6F4EE] px-3 py-2.5 text-xs text-[#5F6B63]" data-testid="ruangteduh-anonim">
                    Dikirim tanpa nama. Tidak bisa dibalas secara pribadi.
                  </div>
                )}

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#14201A]">{active.message}</p>

                <div>
                  <div className="mb-1.5 text-xs font-semibold text-[#5F6B63]">Status</div>
                  <div className="inline-flex w-full max-w-md rounded-xl bg-[#F0EEE6] p-1" data-testid="ruangteduh-status">
                    {TAHAP.map(([v, l]) => (
                      <button key={v} type="button" data-testid={`ruangteduh-status-${v}`} onClick={() => ubahStatus(v)}
                        className={`h-9 flex-1 rounded-lg px-2 text-xs font-semibold ${active.status === v ? "bg-white text-[#0E4E31] shadow-sm" : "text-[#5F6B63]"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="catatan-pengurus" className="text-xs font-semibold text-[#5F6B63]">
                      Catatan pengurus (hanya terlihat pengurus)
                    </label>
                    <span className="text-[11px] font-medium text-[#5F6B63]" data-testid="ruangteduh-catatan-state">
                      {saveState === "saving" && <span className="inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Menyimpan…</span>}
                      {saveState === "saved" && <span className="inline-flex items-center gap-1 text-[#0E4E31]"><CheckCheck size={12} /> Tersimpan</span>}
                    </span>
                  </div>
                  <textarea id="catatan-pengurus" data-testid="ruangteduh-catatan" rows={2} value={catatan}
                    onChange={(e) => onCatatan(e.target.value)}
                    placeholder="Catatan internal untuk pengurus…"
                    className="w-full resize-none rounded-xl border border-[#8A948D] px-3 py-2 text-sm outline-none focus:border-[#14633F]" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmHapus !== null && confirmHapus !== "semua"}
        title="Hapus pesan ini?"
        body="Pesan tidak bisa dikembalikan."
        confirmLabel="Ya, hapus"
        testid="ruangteduh-konfirmasi-hapus"
        onCancel={() => setConfirmHapus(null)}
        onConfirm={() => hapus(confirmHapus)}
      />
      <ConfirmDialog
        open={confirmHapus === "semua"}
        title={`Hapus semua ${total} pesan?`}
        body="Semua cerita akan hilang dan tidak bisa dikembalikan."
        confirmLabel="Ya, hapus"
        testid="ruangteduh-konfirmasi-hapus-semua"
        onCancel={() => setConfirmHapus(null)}
        onConfirm={hapusSemua}
      />
    </div>
  );
}
