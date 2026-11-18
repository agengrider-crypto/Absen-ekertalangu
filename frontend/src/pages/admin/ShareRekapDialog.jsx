// Jendela "Bagikan rekap" — SATU-SATUNYA tempat membagikan tautan rekap.
// Dipakai Detail Kegiatan, Laporan Harian admin, dan Daftar Kegiatan (gabungan).
import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import Modal from "@/components/Modal";
import { tanggalIndonesia } from "@/lib/wa";

const inputCls =
  "h-11 w-full rounded-xl border border-[#8A948D] bg-white px-3 text-sm outline-none focus:border-[#14633F]";

/** Tanggal WITA dari ISO → "24 November 2026". */
function tanggalWita(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return tanggalIndonesia(d.toLocaleDateString("sv-SE", { timeZone: "Asia/Makassar" }));
}

function Saklar({ checked, onChange, label, testid }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testid}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors motion-reduce:transition-none ${checked ? "bg-[#14633F]" : "bg-[#D9D4C5]"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform motion-reduce:transition-none ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

/**
 * mode: "kegiatan" | "gabungan" | "harian"
 * id: kegiatan_id (kegiatan) atau token (gabungan); date untuk harian.
 */
export default function ShareRekapDialog({ open, onClose, mode, id, date }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [hapusOpen, setHapusOpen] = useState(false);

  const endpoint = mode === "kegiatan"
    ? `/admin/kegiatan/${id}/share`
    : mode === "gabungan"
      ? `/admin/kegiatan/share-gabungan/${id}`
      : `/staff/rekap-harian/share${date ? `?date=${date}` : ""}`;

  const muat = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const { data } = await api.get(endpoint);
      setInfo(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  }, [open, endpoint]);

  useEffect(() => { muat(); }, [muat]);

  const buat = async () => {
    setSibuk(true);
    try {
      const { data } = mode === "kegiatan"
        ? await api.post(endpoint)
        : mode === "harian"
          ? await api.post(endpoint)
          : await api.post("/admin/kegiatan/share-gabungan", { kegiatan_ids: id });
      setInfo((prev) => ({ ...prev, ...data, aktif: true }));
      toast.success("Tautan dibuat.");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSibuk(false); }
  };

  const ubah = async (patch) => {
    try {
      await api.patch(endpoint, patch);
      setInfo((prev) => ({ ...prev, ...patch }));
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const hapus = async () => {
    try {
      await api.delete(endpoint);
      setInfo((prev) => ({ ...prev, token: null, link: null }));
      setHapusOpen(false);
      toast.success("Tautan dihapus.");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(info.link);
      toast.success("Tautan disalin.");
    } catch (_) { toast.error("Tidak bisa menyalin"); }
  };

  const wa = () => {
    const teks = `Rekap kehadiran:\n${info.link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(teks)}`, "_blank", "noopener,noreferrer");
  };

  const adaTautan = Boolean(info?.token && info?.link);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Bagikan rekap"
        testid="share-rekap-dialog"
        maxWidth={480}
        footer={(
          <button type="button" onClick={onClose}
            className="h-12 w-full rounded-2xl bg-[#F0EEE6] font-semibold text-[#5F6B63] hover:bg-[#E7E3D8]">
            Tutup
          </button>
        )}
      >
        <div className="space-y-3 p-4">
          {loading ? (
            <p className="flex items-center gap-2 text-sm text-[#5F6B63]">
              <Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> Memuat…
            </p>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-[#14201A]">Tampilkan jam kehadiran</div>
                  <p className="mt-0.5 text-[11px] text-[#5F6B63]">
                    {info?.tampilkan_jam
                      ? "Nyala. Jam absen tampil di halaman publik."
                      : "Mati. Hanya nama dan status."}
                  </p>
                </div>
                <Saklar
                  checked={Boolean(info?.tampilkan_jam)}
                  onChange={(v) => ubah({ tampilkan_jam: v })}
                  label="Tampilkan jam kehadiran"
                  testid="share-toggle-jam"
                />
              </div>

              <p className="text-[11px] text-[#5F6B63]">
                Tautan berlaku 7 hari, sampai {tanggalWita(info?.expires_at)}.
              </p>

              {!adaTautan ? (
                <button type="button" onClick={buat} disabled={sibuk}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60">
                  {sibuk && <Loader2 size={15} className="animate-spin motion-reduce:animate-none" />}
                  Buat tautan
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <input readOnly value={info.link} className={`${inputCls} min-w-0 flex-1`} />
                    <button type="button" onClick={salin} aria-label="Salin tautan"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E7E3D8] text-[#0E4E31] hover:border-[#14633F]">
                      <Copy size={16} />
                    </button>
                    <button type="button" onClick={wa} aria-label="Bagikan lewat WhatsApp"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E7E3D8] text-[#0E4E31] hover:border-[#14633F]">
                      <Send size={16} />
                    </button>
                    <a href={info.link} target="_blank" rel="noopener noreferrer" aria-label="Buka tautan"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E7E3D8] text-[#0E4E31] hover:border-[#14633F]">
                      <ExternalLink size={16} />
                    </a>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-[#E7E3D8] pt-3">
                    <div className="flex items-center gap-2">
                      <Saklar
                        checked={info?.aktif !== false}
                        onChange={(v) => ubah({ aktif: v })}
                        label="Nonaktifkan tautan"
                        testid="share-toggle-aktif"
                      />
                      <span className="text-xs font-semibold text-[#14201A]">Nonaktifkan</span>
                    </div>
                    <button type="button" onClick={() => setHapusOpen(true)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#A32A2A] underline">
                      <Trash2 size={13} /> Hapus
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={hapusOpen}
        onClose={() => setHapusOpen(false)}
        title="Hapus tautan"
        testid="share-hapus-dialog"
        maxWidth={440}
        footer={(
          <div className="flex gap-2">
            <button type="button" onClick={() => setHapusOpen(false)}
              className="h-12 flex-1 rounded-2xl bg-[#F0EEE6] font-semibold text-[#5F6B63] hover:bg-[#E7E3D8]">
              Batal
            </button>
            <button type="button" onClick={hapus}
              className="h-12 flex-1 rounded-2xl bg-[#A32A2A] font-semibold text-white hover:bg-[#8C2323]">
              Ya
            </button>
          </div>
        )}
      >
        <p className="p-4 text-sm text-[#14201A]">
          Hapus tautan ini? Tautan yang sudah dibagikan tidak bisa dibuka lagi.
        </p>
      </Modal>
    </>
  );
}
