// Pendaftaran Kegiatan — konfirmasi peserta lewat tautan publik WhatsApp.
// Satu komponen dipakai tiga submenu sidebar: Kegiatan Aktif, Rekap Kegiatan,
// dan Arsip Pendaftaran (dibedakan lewat prop `mode`).
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarPlus, Loader2, Copy, MapPin, CalendarDays, Users,
  CheckCircle2, XCircle, Clock, Archive, FileSpreadsheet,
  FileText, Printer, Filter, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalIndonesia } from "@/lib/wa";
import { PENDAFTARAN } from "@/constants/testIds";
import PendaftaranFormModal from "./PendaftaranFormModal";
import PendaftaranDetailModal from "./PendaftaranDetailModal";
import {
  StatusBadge, Statistik, AlasanRingkas, TabelPeserta,
} from "./pendaftaranBagian";

const inp =
  "h-11 w-full rounded-xl border border-[#8A948D] bg-white px-3 text-sm text-[#14201A] outline-none focus:border-[#14633F]";

const IKON = { Users, CheckCircle2, XCircle, Clock };

async function salin(teks) {
  try {
    await navigator.clipboard.writeText(teks);
    toast.success("Link disalin");
  } catch {
    toast.error("Tidak bisa menyalin");
  }
}

/** Teks WhatsApp siap kirim berisi tautan konfirmasi kegiatan. */
function pesanWhatsApp(item) {
  return [
    "Assalamualaikum, Bapak/Ibu.",
    "Mohon konfirmasi kehadiran pada kegiatan:",
    item.nama,
    `Tanggal: ${tanggalIndonesia(item.tanggal)}`,
    item.lokasi ? `Lokasi: ${item.lokasi}` : null,
    "",
    "Silakan buka tautan berikut dan isi konfirmasi kehadiran:",
    item.link,
  ].filter(Boolean).join("\n");
}

function KartuKegiatan({ item, onOpen, onCopy }) {
  return (
    <article
      data-testid={`${PENDAFTARAN.cardPrefix}-${item.id}`}
      className="rounded-2xl border border-[#E7E3D8] bg-white p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-base font-bold text-[#14201A]">{item.nama}</h3>
        <StatusBadge status={item.status_tampil} />
      </div>

      <dl className="mt-3 space-y-1.5 text-sm text-[#5F6B63]">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="shrink-0 text-[#0E4E31]" />
          <span>{tanggalIndonesia(item.tanggal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={15} className="shrink-0 text-[#0E4E31]" />
          <span className="truncate">{item.lokasi || "Lokasi belum diisi"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users size={15} className="shrink-0 text-[#0E4E31]" />
          <span>
            {item.total_peserta} peserta · {item.hadir} hadir · {item.tidak_hadir} tidak hadir
            {item.belum_konfirmasi > 0 ? ` · ${item.belum_konfirmasi} belum konfirmasi` : ""}
          </span>
        </div>
      </dl>

      {item.link && (
        <p className="mt-3 break-all rounded-xl bg-[#F6F4EE] px-3 py-2 text-xs text-[#5F6B63]">
          {item.link}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-testid={`${PENDAFTARAN.cardOpenPrefix}-${item.id}`}
          onClick={() => onOpen(item)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]"
        >
          <Users size={16} /> Lihat Peserta
        </button>
        <button
          type="button"
          data-testid={`${PENDAFTARAN.cardCopyPrefix}-${item.id}`}
          onClick={() => onCopy(item)}
          disabled={!item.link}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F] disabled:opacity-50"
        >
          <Copy size={16} /> Salin Link WhatsApp
        </button>
      </div>
    </article>
  );
}

export default function PendaftaranKegiatanView({ mode = "aktif", onGoto }) {
  const [items, setItems] = useState(null);
  const [rekap, setRekap] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [ekspor, setEkspor] = useState("");

  // Filter rekap
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [kegiatanId, setKegiatanId] = useState("");
  const [kehadiran, setKehadiran] = useState("");

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
  useEffect(() => { if (mode === "rekap") muatRekap(); }, [mode, muatRekap]);

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
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  }, []);

  const ubahStatus = async (item, status) => {
    setSibuk(true);
    try {
      await api.post(`/staff/pendaftaran/${item.id}/status`, { status });
      toast.success(status === "arsip" ? "Kegiatan dipindahkan ke arsip."
        : status === "aktif" ? "Kegiatan diaktifkan kembali." : "Kegiatan ditutup.");
      setDetail(null);
      await muat();
      if (mode === "rekap") await muatRekap();
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

  const judul = mode === "rekap" ? "Rekap Kegiatan"
    : mode === "arsip" ? "Arsip Pendaftaran" : "Kegiatan Aktif";

  const kepala = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="inline-flex items-center gap-2 font-heading text-2xl font-bold text-[#14201A]">
          <CalendarPlus size={22} className="text-[#0E4E31]" /> Pendaftaran Kegiatan
        </h1>
        <p className="mt-1 text-sm text-[#5F6B63]">
          {judul} — konfirmasi peserta lewat tautan publik WhatsApp, tanpa wajib login.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={muat}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F]"
        >
          <RefreshCw size={16} /> Muat ulang
        </button>
        <button
          type="button"
          data-testid={PENDAFTARAN.addButton}
          onClick={() => setFormOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]"
        >
          <CalendarPlus size={16} /> Tambah Kegiatan
        </button>
      </div>
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

  // ---------------------------------------------------------------- REKAP
  if (mode === "rekap") {
    return (
      <div className="space-y-5" data-testid={PENDAFTARAN.rekapView}>
        {kepala}

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
              <span className="mb-1 block text-xs font-semibold text-[#5F6B63]">Status kehadiran</span>
              <select value={kehadiran} onChange={(e) => setKehadiran(e.target.value)}
                data-testid={PENDAFTARAN.rekapKehadiran} className={inp}>
                <option value="">Semua</option>
                <option value="hadir">Hadir</option>
                <option value="tidak_hadir">Tidak hadir</option>
                <option value="belum">Belum konfirmasi</option>
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
                  <StatusBadge status={item.status_tampil} />
                </div>

                <div className="mt-3">
                  <Statistik item={item} ikon={IKON} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-[#F6F4EE] px-3 py-2.5">
                  <span className="text-sm font-semibold text-[#14201A]">
                    Persentase kehadiran: {item.persentase_hadiran}%
                  </span>
                  <span className="text-xs text-[#5F6B63]">
                    {item.hadir} dari {item.total_peserta} peserta terdaftar
                  </span>
                </div>

                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-[#5F6B63]">
                    Alasan tidak hadir
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
      </div>
    );
  }

  // ------------------------------------------------------- AKTIF / ARSIP
  const daftar = mode === "arsip" ? arsip : aktif;
  const semuaSelesai = mode === "aktif" && semua.length > 0 && aktif.length === 0;

  return (
    <div className="space-y-5" data-testid={PENDAFTARAN.view}>
      {kepala}

      {items === null ? memuat : items === false ? gagal : daftar.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E3D8] bg-white p-10 text-center">
          {mode === "arsip" ? (
            <>
              <Archive className="mx-auto text-[#5F6B63]" size={30} />
              <p className="mt-3 text-base font-semibold text-[#14201A]">
                Arsip Pendaftaran Kosong
              </p>
              <p className="mt-1 text-sm text-[#5F6B63]">
                Belum ada kegiatan yang dipindahkan ke arsip.
              </p>
            </>
          ) : semuaSelesai ? (
            <>
              <CheckCircle2 className="mx-auto text-[#0E4E31]" size={30} />
              <p className="mt-3 text-base font-semibold text-[#14201A]">
                Tidak Ada Pendaftaran Aktif
              </p>
              <p className="mt-1 text-sm text-[#5F6B63]">
                Semua kegiatan telah selesai atau dipindahkan ke arsip.
              </p>
              <button
                type="button"
                data-testid={PENDAFTARAN.emptyArchiveButton}
                onClick={() => onGoto?.("pendaftaran-arsip")}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#14633F] bg-white px-4 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA]"
              >
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
              <button
                type="button"
                data-testid={PENDAFTARAN.emptyAddButton}
                onClick={() => setFormOpen(true)}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]"
              >
                <CalendarPlus size={16} /> Tambah Kegiatan
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {daftar.map((item) => (
            <KartuKegiatan key={item.id} item={item} onOpen={bukaDetail} onCopy={salinLink} />
          ))}
        </div>
      )}

      {formOpen && (
        <PendaftaranFormModal
          onClose={() => setFormOpen(false)}
          onSaved={async () => { setFormOpen(false); await muat(); }}
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
          onReload={async () => {
            await muat();
            if (detail?.item?.id) await bukaDetail(detail.item);
          }}
        />
      )}
    </div>
  );
}
