// Pendaftaran Kegiatan — satu daftar kegiatan (tanpa tab Rekap/Arsip).
// Kegiatan berjalan di atas, yang selesai di bawahnya; arsip lewat tautan kecil.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarPlus, Loader2, Copy, MapPin, CalendarDays, Users,
  CheckCircle2, Archive, RefreshCw, RotateCcw, Share2, Send,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalIndonesia } from "@/lib/wa";
import { PENDAFTARAN } from "@/constants/testIds";
import PendaftaranFormModal from "./PendaftaranFormModal";
import PendaftaranDetailModal from "./PendaftaranDetailModal";
import {
  StatusKegiatanBadge, JenisBadge, teksRekapWhatsApp, waHref,
} from "./pendaftaranBagian";

async function salin(teks, pesan = "Link disalin") {
  try {
    await navigator.clipboard.writeText(teks);
    toast.success(pesan);
  } catch {
    toast.error("Tidak bisa menyalin");
  }
}

/** Teks ajakan singkat berisi tautan pendaftaran kegiatan. */
function pesanAjakan(item) {
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

function KartuKegiatan({ item, onOpen, onShare, onAjakan }) {
  return (
    <article
      data-testid={`${PENDAFTARAN.cardPrefix}-${item.id}`}
      className="rounded-2xl border border-[#E7E3D8] bg-white p-4"
    >
      <button type="button" onClick={() => onOpen(item)} className="block w-full text-left">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 text-base font-bold text-[#14201A]">{item.nama}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <JenisBadge wajib={item.wajib_konfirmasi} />
            <StatusKegiatanBadge item={item} />
          </div>
        </div>

        <dl className="mt-3 space-y-1.5 text-sm text-[#5F6B63]">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="shrink-0 text-[#0E4E31]" />
            <span>{tanggalIndonesia(item.tanggal)}</span>
          </div>
          {item.lokasi && (
            <div className="flex items-center gap-2">
              <MapPin size={15} className="shrink-0 text-[#0E4E31]" />
              <span className="truncate">{item.lokasi}</span>
            </div>
          )}
        </dl>

        <p className="mt-3 text-sm text-[#14201A]">
          Ikut <b className="text-[#0E4E31]">{item.ikut}</b>
          {" · "}
          Tidak ikut <b className="text-[#A32A2A]">{item.tidak_ikut}</b>
        </p>
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onOpen(item)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]">
          <Users size={16} /> Lihat peserta
        </button>
        <button type="button" onClick={() => onShare(item)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F]">
          <Share2 size={16} /> Bagikan rekap
        </button>
        <button type="button" data-testid={`${PENDAFTARAN.cardCopyPrefix}-${item.id}`}
          onClick={() => onAjakan(item)} disabled={!item.link}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F] disabled:opacity-50">
          <Send size={16} /> Bagikan ajakan
        </button>
      </div>
    </article>
  );
}

/** Pratinjau pesan rekap WhatsApp dengan pilihan sertakan daftar nama. */
function BagikanRekapModal({ item, onClose }) {
  const [sertakanNama, setSertakanNama] = useState(true);
  const teks = teksRekapWhatsApp(item, { sertakanNama });
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <p className="text-base font-semibold text-[#14201A]">Bagikan rekap ke WhatsApp</p>
        <p className="mt-1 text-sm text-[#5F6B63]">
          Nomor HP peserta tidak pernah dimasukkan ke pesan.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm text-[#14201A]">
          <input type="checkbox" checked={sertakanNama}
            onChange={(e) => setSertakanNama(e.target.checked)}
            className="h-4 w-4 accent-[#14633F]" />
          Sertakan daftar nama yang ikut
        </label>
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-[#F6F4EE] p-3 text-xs text-[#14201A]">
          {teks}
        </pre>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose}
            className="min-h-11 rounded-xl border border-[#E7E3D8] bg-white px-4 text-sm font-semibold text-[#14201A]">
            Batal
          </button>
          <button type="button" onClick={() => salin(teks, "Teks rekap disalin")}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#14633F] bg-white px-3 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA]">
            <Copy size={16} /> Salin teks
          </button>
          <a href={waHref(teks)} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31]">
            <Send size={16} /> Buka WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PendaftaranKegiatanView({ mode = "aktif", onGotoKegiatan }) {
  const [items, setItems] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [jadwalItem, setJadwalItem] = useState(null);
  const [detail, setDetail] = useState(null);
  const [sibuk, setSibuk] = useState(false);
  const [tanyaKegiatan, setTanyaKegiatan] = useState(null);
  const [tanyaRegu, setTanyaRegu] = useState(null);
  const [bagikan, setBagikan] = useState(null);
  const [lihatArsip, setLihatArsip] = useState(mode === "arsip");

  useEffect(() => { setLihatArsip(mode === "arsip"); }, [mode]);

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

  useEffect(() => { muat(); }, [muat]);

  const semua = useMemo(() => items || [], [items]);
  const berjalan = useMemo(
    () => semua.filter((i) => i.status_tampil === "aktif" || i.status_tampil === "berlangsung"),
    [semua],
  );
  const selesai = useMemo(
    () => semua.filter((i) => i.status_tampil === "selesai" || i.status_tampil === "arsip"),
    [semua],
  );

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

  /** Bagikan rekap butuh daftar peserta, jadi detail dimuat lebih dulu. */
  const bukaBagikan = useCallback(async (item) => {
    if (Array.isArray(item?.peserta)) { setBagikan(item); return; }
    try {
      const { data } = await api.get(`/staff/pendaftaran/${item.id}`);
      setBagikan(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  }, []);

  const ubahStatus = async (item, status) => {
    setSibuk(true);
    try {
      await api.post(`/staff/pendaftaran/${item.id}/status`, { status });
      toast.success(status === "arsip" ? "Kegiatan dipindahkan ke arsip."
        : status === "aktif" ? "Kegiatan dipulihkan." : "Kegiatan ditutup.");
      setDetail(null);
      await muat();
      // Tutup pendaftaran → tawarkan membuat kegiatan berabsen.
      if (status === "selesai") setTanyaKegiatan(item);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSibuk(false);
    }
  };

  const buatKegiatan = async (item) => {
    setSibuk(true);
    try {
      const { data } = await api.post(`/staff/pendaftaran/${item.id}/buat-kegiatan`);
      toast.success(data.dibuat
        ? `Kegiatan dibuat: ${data.peserta} peserta, ${data.tamu} tamu.`
        : "Kegiatan sudah ada.");
      setTanyaKegiatan(null);
      setTanyaRegu(data.kegiatan_id);
      await muat();
      if (detail?.item?.id === item.id) await bukaDetail({ id: item.id });
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSibuk(false);
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

  const kartu = (daftar) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {daftar.map((item) => (
        <KartuKegiatan key={item.id} item={item} onOpen={bukaDetail}
          onShare={bukaBagikan}
          onAjakan={(i) => salin(pesanAjakan(i), "Teks ajakan disalin")} />
      ))}
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
          onClose={() => setDetail(null)}
          onCopy={(item) => salin(pesanAjakan(item), "Link disalin")}
          onShare={bukaBagikan}
          onStatus={ubahStatus}
          onUbahJadwal={(item) => setJadwalItem(item)}
          onBuatKegiatan={(item) => buatKegiatan(item)}
          onReload={async () => {
            await muat();
            if (detail?.item?.id) await bukaDetail(detail.item);
          }}
        />
      )}

      {bagikan && <BagikanRekapModal item={bagikan} onClose={() => setBagikan(null)} />}

      {tanyaKegiatan && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4">
            <p className="text-base font-semibold text-[#14201A]">
              Tutup pendaftaran dan buat kegiatan berabsen dari yang ikut?
            </p>
            <p className="mt-1 text-sm text-[#5F6B63]">
              Peserta yang memilih ikut akan masuk ke kegiatan baru.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setTanyaKegiatan(null)}
                className="min-h-11 rounded-xl border border-[#E7E3D8] bg-white px-4 text-sm font-semibold text-[#14201A]">
                Batal
              </button>
              <button type="button" data-testid="pendaftaran-buat-kegiatan-ya"
                onClick={() => buatKegiatan(tanyaKegiatan)} disabled={sibuk}
                className="min-h-11 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white disabled:opacity-60">
                Ya
              </button>
            </div>
          </div>
        </div>
      )}

      {tanyaRegu && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4">
            <p className="text-base font-semibold text-[#14201A]">Bagi regu sekarang?</p>
            <p className="mt-1 text-sm text-[#5F6B63]">
              Peserta kegiatan sudah siap dibagi ke regu.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setTanyaRegu(null)}
                className="min-h-11 rounded-xl border border-[#E7E3D8] bg-white px-4 text-sm font-semibold text-[#14201A]">
                Nanti
              </button>
              <button type="button" data-testid="pendaftaran-bagi-regu"
                onClick={() => { const id = tanyaRegu; setTanyaRegu(null); onGotoKegiatan?.(id); }}
                className="min-h-11 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white">
                Ya
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (lihatArsip) {
    return (
      <div className="space-y-5" data-testid={PENDAFTARAN.view}>
        {kepala}
        <button type="button" onClick={() => setLihatArsip(false)}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F]">
          <RotateCcw size={15} /> Kembali ke daftar
        </button>
        <h2 className="inline-flex items-center gap-2 text-base font-bold text-[#14201A]">
          <Archive size={18} className="text-[#0E4E31]" /> Arsip Pendaftaran
        </h2>
        {items === null ? memuat : items === false ? gagal : selesai.length === 0 ? (
          <div className="rounded-2xl border border-[#E7E3D8] bg-white p-10 text-center">
            <Archive className="mx-auto text-[#5F6B63]" size={30} />
            <p className="mt-3 text-base font-semibold text-[#14201A]">Arsip Pendaftaran Kosong</p>
            <p className="mt-1 text-sm text-[#5F6B63]">
              Belum ada kegiatan yang selesai atau dipindahkan ke arsip.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {selesai.map((item) => (
              <div key={item.id} className="space-y-2">
                <KartuKegiatan item={item} onOpen={bukaDetail}
                  onShare={bukaBagikan}
                  onAjakan={(i) => salin(pesanAjakan(i), "Teks ajakan disalin")} />
                <button type="button" onClick={() => ubahStatus(item, "aktif")} disabled={sibuk}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#14633F] bg-white px-3 text-sm font-semibold text-[#0E4E31] hover:bg-[#E3F3EA] disabled:opacity-60">
                  <RotateCcw size={15} /> Pulihkan
                </button>
              </div>
            ))}
          </div>
        )}
        {modal}
      </div>
    );
  }

  const semuaSelesai = semua.length > 0 && berjalan.length === 0;
  return (
    <div className="space-y-5" data-testid={PENDAFTARAN.view}>
      {kepala}

      {items === null ? memuat : items === false ? gagal : berjalan.length === 0 ? (
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
                onClick={() => setLihatArsip(true)}
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
        <>
          {kartu(berjalan)}
          {selesai.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#5F6B63]">Selesai</p>
              {kartu(selesai)}
            </div>
          )}
        </>
      )}

      {items && semua.length > 0 && (
        <div className="pt-1 text-center">
          <button type="button" onClick={() => setLihatArsip(true)}
            className="text-xs font-semibold text-[#0E4E31] underline-offset-2 hover:underline">
            Lihat arsip
          </button>
        </div>
      )}

      {modal}
    </div>
  );
}
