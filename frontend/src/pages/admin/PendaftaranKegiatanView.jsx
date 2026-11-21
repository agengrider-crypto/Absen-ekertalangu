// Pendaftaran Kegiatan — satu halaman dengan dua tab:
// "Kegiatan Aktif" dan "Rekap dan Arsip" (chip Rekap / Arsip).
// Rute lama (pendaftaran-aktif / -rekap / -arsip) tetap membuka tab yang sesuai.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarPlus, Loader2, Copy, MapPin, CalendarDays, Users,
  CheckCircle2, XCircle, Archive, FileSpreadsheet, FileText,
  Printer, Filter, RefreshCw, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalIndonesia } from "@/lib/wa";
import { PENDAFTARAN } from "@/constants/testIds";
import PendaftaranFormModal from "./PendaftaranFormModal";
import PendaftaranDetailModal from "./PendaftaranDetailModal";
import {
  StatusBadge, JadwalBadge, JenisBadge, Statistik, AlasanRingkas,
  TabelPeserta, TombolMaps,
} from "./pendaftaranBagian";

const inp =
  "h-11 w-full rounded-xl border border-[#8A948D] bg-white px-3 text-sm text-[#14201A] outline-none focus:border-[#14633F]";

const IKON = { Users, CheckCircle2, XCircle };

async function salin(teks) {
  try {
    await navigator.clipboard.writeText(teks);
    toast.success("Link disalin");
  } catch {
    toast.error("Tidak bisa menyalin");
  }
}

/** Teks WhatsApp siap kirim berisi tautan pendaftaran kegiatan. */
function pesanWhatsApp(item) {
  return [
    "Assalamualaikum, Bapak/Ibu.",
    "Mohon isi pendaftaran pada kegiatan:",
    item.nama,
    `Tanggal: ${tanggalIndonesia(item.tanggal)}`,
    item.lokasi ? `Lokasi: ${item.lokasi}` : null,
    "",
    "Silakan buka tautan berikut:",
    item.link,
  ].filter(Boolean).join("\n");
}

function KartuKegiatan({ item, onOpen, onCopy }) {
  const wajib = item.wajib_konfirmasi !== false;
  return (
    <article
      data-testid={`${PENDAFTARAN.cardPrefix}-${item.id}`}
      className="rounded-2xl border border-[#E7E3D8] bg-white p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-base font-bold text-[#14201A]">{item.nama}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <JenisBadge wajib={item.wajib_konfirmasi} />
          <StatusBadge status={item.status_tampil} />
          <JadwalBadge status={item.jadwal_status} />
        </div>
      </div>

      <dl className="mt-3 space-y-1.5 text-sm text-[#5F6B63]">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="shrink-0 text-[#0E4E31]" />
          <span>{tanggalIndonesia(item.tanggal)}</span>
        </div>
        {item.lokasi && (
          <div className="flex flex-wrap items-center gap-2">
            <MapPin size={15} className="shrink-0 text-[#0E4E31]" />
            <span className="truncate">{item.lokasi}</span>
            <TombolMaps item={item} />
          </div>
        )}
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="shrink-0 text-[#0E4E31]" />
          <span>Tutup {item.pendaftaran_tutup ? tanggalIndonesia(item.pendaftaran_tutup) : "-"}</span>
        </div>
      </dl>

      <p className="mt-3 text-sm text-[#14201A]">
        <b className={wajib ? "text-lg text-[#8A5A00]" : ""}>{item.ikut}</b> ikut
        {" · "}
        <b>{item.tidak_ikut}</b> tidak ikut
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid={`${PENDAFTARAN.cardOpenPrefix}-${item.id}`}
          onClick={() => onOpen(item)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]"
        >
          <Users size={16} /> Lihat peserta
        </button>
        <button
          type="button"
          data-testid={`${PENDAFTARAN.cardCopyPrefix}-${item.id}`}
          onClick={() => onCopy(item)}
          disabled={!item.link}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F] disabled:opacity-50"
        >
          <Copy size={16} /> Salin link WhatsApp
        </button>
      </div>
    </article>
  );
}

export default function PendaftaranKegiatanView({ mode = "aktif", onGoto }) {
  const tabAwal = mode === "aktif" ? "aktif" : "rekap";
  const [tab, setTab] = useState(tabAwal);
  const [chip, setChip] = useState(mode === "arsip" ? "arsip" : "rekap");
  const [items, setItems] = useState(null);
  const [rekap, setRekap] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [jadwalItem, setJadwalItem] = useState(null);
  const [detail, setDetail] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [ekspor, setEkspor] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [kegiatanId, setKegiatanId] = useState("");
  const [kehadiran, setKehadiran] = useState("");

  useEffect(() => {
    setTab(mode === "aktif" ? "aktif" : "rekap");
    setChip(mode === "arsip" ? "arsip" : "rekap");
  }, [mode]);

  const muat = useCallback(async () => {
    setItems(null);
    try {
      const { data } = await api.get("/staff/pendaftaran");
      setItems(data.items || []);
    } catch (e) {
      setItems(false);
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  }, []);

  const muatRekap = useCallback(async () => {
    setRekap(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (kegiatanId) params.set("kegiatan_id", kegiatanId);
      if (kehadiran) params.set("kehadiran", kehadiran);
      const { data } = await api.get(`/staff/pendaftaran/rekap?${params.toString()}`);
      setRekap(data);
    } catch (e) {
      setRekap(false);
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  }, [dateFrom, dateTo, kegiatanId, kehadiran]);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => { if (tab === "rekap") muatRekap(); }, [tab, muatRekap]);

  const semua = useMemo(() => items || [], [items]);
  const aktif = useMemo(
    () => semua.filter((i) => i.status_tampil === "aktif" || i.status_tampil === "berlangsung"),
    [semua],
  );
  const arsip = useMemo(
    () => semua.filter((i) => i.status_tampil === "arsip" || i.status_tampil === "selesai"),
    [semua],
  );

  const salinLink = (item) => salin(pesanWhatsApp(item));

  const bukaDetail = useCallback(async (item) => {
    setDetail({ loading: true, item });
    try {
      const { data } = await api.get(`/staff/pendaftaran/${item.id}`);
      setDetail({ loading: false, item: data });
    } catch (e) {
      setDetail(null);
      const status = e.response?.status;
      if (status === 404 || status === 410) {
        await muat();
        return;
      }
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  }, [muat]);

  const ubahStatus = async (item, status) => {
    setSibuk(true);
    try {
      await api.post(`/staff/pendaftaran/${item.id}/status`, { status });
      toast.success(status === "arsip" ? "Kegiatan dipindahkan ke arsip."
        : status === "aktif" ? "Kegiatan dipulihkan." : "Kegiatan ditutup.");
      setDetail(null);
      await muat();
      if (tab === "rekap") await muatRekap();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSibuk(false);
    }
  };

  const eksporKegiatan = async (item, format) => {
    setEkspor(`${item.id}-${format}`);
    try {
      const res = await api.get(`/staff/pendaftaran/${item.id}/export?format=${format}`,
        { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pendaftaran_${item.id}.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengekspor data");
    } finally {
      setEkspor("");
    }
  };

  const eksporRekap = async (format) => {
    setEkspor(`rekap-${format}`);
    try {
      const params = new URLSearchParams({ format });
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (kegiatanId) params.set("kegiatan_id", kegiatanId);
      if (kehadiran) params.set("kehadiran", kehadiran);
      const res = await api.get(`/staff/pendaftaran/rekap/export?${params.toString()}`,
        { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rekap_pendaftaran.${format === "pdf" ? "pdf" : "xlsx"}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengekspor rekap");
    } finally {
      setEkspor("");
    }
  };

  const kepala = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="inline-flex items-center gap-2 font-heading text-2xl font-bold text-[#14201A]">
          <CalendarPlus size={22} className="text-[#0E4E31]" /> Pendaftaran Kegiatan
        </h1>
        <p className="mt-1 text-sm text-[#5F6B63]">
          Pendaftaran peserta lewat tautan publik WhatsApp, tanpa wajib login.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={muat}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F]">
          <RefreshCw size={16} /> Muat ulang
        </button>
        <button type="button" data-testid={PENDAFTARAN.addButton}
          onClick={() => setFormOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]">
          <CalendarPlus size={16} /> Tambah Kegiatan
        </button>
      </div>
    </div>
  );

  const tabBar = (
    <div className="flex gap-1.5 rounded-xl border border-[#E7E3D8] bg-white p-1">
      <button type="button" data-testid={PENDAFTARAN.tabAktif}
        onClick={() => setTab("aktif")} aria-pressed={tab === "aktif"}
        className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold ${
          tab === "aktif" ? "bg-[#E3F3EA] text-[#0E4E31]" : "text-[#5F6B63]"
        }`}>
        Kegiatan Aktif
      </button>
      <button type="button" data-testid={PENDAFTARAN.tabRekap}
        onClick={() => setTab("rekap")} aria-pressed={tab === "rekap"}
        className={`min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold ${
          tab === "rekap" ? "bg-[#E3F3EA] text-[#0E4E31]" : "text-[#5F6B63]"
        }`}>
        Rekap dan Arsip
      </button>
    </div>
  );

  const memuat = (
    <div className="flex justify-center p-16">
      <Loader2 className="animate-spin text-[#0E4E31] motion-reduce:animate-none" size={30} />
    </div>
  );

  const gagal = (
    <div className="rounded-2xl border border-[#FBE5E3] bg-white p-8 text-center">
      <p className="text-sm text-[#5F6B63]">Data pendaftaran gagal dimuat.</p>
      <button type="button" onClick={muat}
        className="mt-3 min-h-11 rounded-xl bg-[#14633F] px-4 font-semibold text-white">
        Coba lagi
      </button>
    </div>
  );

  const modal = (
    <>
      {formOpen && (
        <PendaftaranFormModal
          onClose={() => setFormOpen(false)}
          onSaved={async () => { setFormOpen(false); await muat(); }}
        />
      )}
      {jadwalItem && (
        <PendaftaranFormModal
          jadwalOnly
          item={jadwalItem}
          onClose={() => setJadwalItem(null)}
          onSaved={async () => {
            const id = jadwalItem.id;
            setJadwalItem(null);
            await muat();
            if (detail?.item?.id === id) await bukaDetail({ id });
          }}
        />
      )}
      {detail && (
        <PendaftaranDetailModal
          data={detail}
          sibuk={sibuk}
          ekspor={ekspor}
          onClose={() => setDetail(null)}
          onCopy={salinLink}
          onExport={eksporKegiatan}
          onStatus={ubahStatus}
          onUbahJadwal={(item) => setJadwalItem(item)}
          onReload={async () => {
            await muat();
            if (detail?.item?.id) await bukaDetail(detail.item);
          }}
        />
      )}
    </>
  );

  // ------------------------------------------------------- TAB AKTIF
  if (tab === "aktif") {
    const semuaSelesai = semua.length > 0 && aktif.length === 0;
    return (
      <div className="space-y-5" data-testid={PENDAFTARAN.view}>
        {kepala}
        {tabBar}

        {items === null ? memuat : items === false ? gagal : aktif.length === 0 ? (
          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-10 text-center">
            {semuaSelesai ? (
              <>
                <CheckCircle2 className="mx-auto text-[#0E4E31]" size={30} />
                <p className="mt-3 text-base font-semibold text-[#14201A]">
                  Tidak Ada Pendaftaran Aktif
                </p>
                <p className="mt-1 text-sm text-[#5F6B63]">
                  Semua kegiatan telah selesai atau dipindahkan ke arsip.
                </p>
                <button type="button" data-testid={PENDAFTARAN.emptyArchiveButton}
                  onClick={() => { setTab("rekap"); setChip("arsip"); }}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#14633F] bg-white px-4 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA]">
                  <Archive size={16} /> Lihat Arsip
                </button>
              </>
            ) : (
              <>
                <CalendarPlus className="mx-auto text-[#5F6B63]" size={30} />
                <p className="mt-3 text-base font-semibold text-[#14201A]">
                  Belum Ada Pendaftaran Kegiatan Aktif
                </p>
                <p className="mt-1 text-sm text-[#5F6B63]">
                  Belum ada kegiatan yang membutuhkan konfirmasi peserta.
                </p>
                <button type="button" data-testid={PENDAFTARAN.emptyAddButton}
                  onClick={() => setFormOpen(true)}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]">
                  <CalendarPlus size={16} /> Tambah Kegiatan
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {aktif.map((item) => (
              <KartuKegiatan key={item.id} item={item} onOpen={bukaDetail} onCopy={salinLink} />
            ))}
          </div>
        )}
        {modal}
      </div>
    );
  }

  // ------------------------------------------------- TAB REKAP & ARSIP
  const daftarArsip = arsip;
  return (
    <div className="space-y-5" data-testid={PENDAFTARAN.rekapView}>
      {kepala}
      {tabBar}

      <div className="flex flex-wrap gap-1.5">
        {[
          { key: "rekap", label: "Rekap" },
          { key: "arsip", label: "Arsip" },
        ].map((c) => (
          <button key={c.key} type="button" onClick={() => setChip(c.key)}
            aria-pressed={chip === c.key}
            className={`min-h-9 rounded-full border px-3 text-xs font-semibold ${
              chip === c.key
                ? "border-[#14633F] bg-[#E3F3EA] text-[#0E4E31]"
                : "border-[#E7E3D8] bg-white text-[#5F6B63]"
            }`}>
            {c.label}
          </button>
        ))}
      </div>

      {chip === "arsip" ? (
        items === null ? memuat : items === false ? gagal : daftarArsip.length === 0 ? (
          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-10 text-center">
            <Archive className="mx-auto text-[#5F6B63]" size={30} />
            <p className="mt-3 text-base font-semibold text-[#14201A]">Arsip Pendaftaran Kosong</p>
            <p className="mt-1 text-sm text-[#5F6B63]">
              Belum ada kegiatan yang dipindahkan ke arsip.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {daftarArsip.map((item) => (
              <div key={item.id} className="space-y-2">
                <KartuKegiatan item={item} onOpen={bukaDetail} onCopy={salinLink} />
                <button type="button" onClick={() => ubahStatus(item, "aktif")} disabled={sibuk}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#14633F] bg-white px-3 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA] disabled:opacity-60">
                  <RotateCcw size={15} /> Pulihkan
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
            <h2 className="inline-flex items-center gap-2 text-sm font-bold text-[#14201A]">
              <Filter size={16} /> Filter
            </h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Dari tanggal</span>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                  data-testid={PENDAFTARAN.rekapDateFrom} className={inp} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Sampai tanggal</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                  data-testid={PENDAFTARAN.rekapDateTo} className={inp} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Kegiatan</span>
                <select value={kegiatanId} onChange={(e) => setKegiatanId(e.target.value)}
                  data-testid={PENDAFTARAN.rekapKegiatan} className={inp}>
                  <option value="">Semua kegiatan</option>
                  {semua.map((i) => <option key={i.id} value={i.id}>{i.nama}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Jawaban</span>
                <select value={kehadiran} onChange={(e) => setKehadiran(e.target.value)}
                  data-testid={PENDAFTARAN.rekapKehadiran} className={inp}>
                  <option value="">Semua</option>
                  <option value="hadir">Ikut</option>
                  <option value="tidak_hadir">Tidak ikut</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={muatRekap}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]">
                <Filter size={16} /> Terapkan
              </button>
              <button type="button" data-testid={PENDAFTARAN.rekapExportExcel}
                onClick={() => eksporRekap("excel")} disabled={ekspor === "rekap-excel"}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F] disabled:opacity-60">
                <FileSpreadsheet size={16} /> Excel
              </button>
              <button type="button" data-testid={PENDAFTARAN.rekapExportPdf}
                onClick={() => eksporRekap("pdf")} disabled={ekspor === "rekap-pdf"}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F] disabled:opacity-60">
                <FileText size={16} /> PDF
              </button>
              <button type="button" data-testid={PENDAFTARAN.rekapPrint}
                onClick={() => window.print()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F]">
                <Printer size={16} /> Cetak laporan
              </button>
            </div>
          </section>

          {rekap === null ? memuat : rekap === false ? gagal : rekap.items.length === 0 ? (
            <div className="rounded-2xl border border-[#E7E3D8] bg-white p-10 text-center">
              <p className="text-base font-semibold text-[#14201A]">Belum Ada Data Rekap</p>
              <p className="mt-1 text-sm text-[#5F6B63]">
                Belum ada kegiatan pendaftaran pada periode atau filter ini.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {rekap.items.map((item) => (
                <section key={item.id} className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-[#14201A]">{item.nama}</h3>
                      <p className="mt-0.5 text-sm text-[#5F6B63]">
                        {tanggalIndonesia(item.tanggal)} · {item.lokasi || "Lokasi belum diisi"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <JenisBadge wajib={item.wajib_konfirmasi} />
                      <StatusBadge status={item.status_tampil} />
                      <JadwalBadge status={item.jadwal_status} />
                    </div>
                  </div>

                  <div className="mt-3">
                    <Statistik item={item} ikon={IKON} wajib={item.wajib_konfirmasi !== false} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-[#F6F4EE] px-3 py-2.5">
                    <span className="text-sm font-semibold text-[#14201A]">
                      Persentase ikut: {item.persentase_ikut}%
                    </span>
                    <span className="text-xs text-[#5F6B63]">
                      {item.ikut} dari {item.total} yang mengisi
                    </span>
                  </div>

                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#5F6B63]">
                      Alasan tidak ikut
                    </p>
                    <AlasanRingkas ringkas={item.alasan_ringkas} />
                  </div>

                  <div className="mt-3">
                    <TabelPeserta rows={item.peserta} />
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
      {modal}
    </div>
  );
}
