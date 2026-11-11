// Kartu QR Aktivasi Akun untuk Dashboard.
// - Menampilkan QR pendaftaran/aktivasi (dari /staff/activation-qr).
// - Pembesar QR sekali klik (lightbox) + cetak.
// - Aktivasi manual: cari nama peserta lalu aktifkan, atau ketik nama baru
//   (opsional tanggal lahir) untuk membuat akun yang langsung aktif.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  QrCode, Maximize2, X, Printer, Search, Loader2, UserCheck,
  UserPlus, CheckCircle2, AlertTriangle, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { ACTIVATION_QR } from "@/constants/testIds";
import Modal from "@/components/Modal";

const inp = "w-full h-11 px-3.5 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] bg-white";

function errText(e) {
  return formatApiErrorDetail(e?.response?.data?.detail) || e?.message || "Terjadi kesalahan.";
}

/** Kartu ringkas di dashboard. */
export function ActivationQrCard({ onOpen }) {
  const [qr, setQr] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.get("/staff/activation-qr")
      .then(({ data }) => setQr(data))
      .catch(() => setFailed(true));
  }, []);

  return (
    <section
      className="rounded-2xl border border-[#E7E3D8] bg-white p-5 sm:p-6"
      data-testid={ACTIVATION_QR.card}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading font-bold text-[#14201A] flex items-center gap-2">
            <QrCode size={18} /> QR Aktivasi Akun
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#5F6B63]">
            Cetak atau tampilkan QR ini. Jamaah memindai lalu mengaktifkan akunnya sendiri.
          </p>
        </div>
        <button
          type="button"
          data-testid={ACTIVATION_QR.open}
          onClick={onOpen}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-[#14633F] px-3.5 text-sm font-semibold text-white hover:bg-[#0E4E31]"
        >
          <Maximize2 size={15} /> Buka
        </button>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={onOpen}
          aria-label="Perbesar QR aktivasi"
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl border border-[#E7E3D8] bg-white p-1.5 hover:border-[#14633F]"
        >
          {qr?.image ? (
            <img src={qr.image} alt="QR Aktivasi Akun" className="h-full w-full object-contain" />
          ) : failed ? (
            <AlertTriangle size={22} className="text-[#5F6B63]" />
          ) : (
            <Loader2 size={22} className="animate-spin text-[#5F6B63]" />
          )}
        </button>
        <div className="min-w-0 text-xs text-[#5F6B63]">
          <div className="font-semibold text-[#14201A]">Cara pakai</div>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4">
            <li>Pindai QR dengan kamera HP.</li>
            <li>Cari nama Anda, lalu lengkapi data.</li>
            <li>Akun langsung aktif dan bisa masuk.</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

/** Modal QR besar + aktivasi manual. */
export default function ActivationQrModal({ onClose }) {
  const [qr, setQr] = useState(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const [manualName, setManualName] = useState("");
  const [manualDob, setManualDob] = useState("");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualResult, setManualResult] = useState(null);
  const searchRef = useRef(null);

  const loadQr = useCallback(() => {
    setFailed(false);
    api.get("/staff/activation-qr")
      .then(({ data }) => setQr(data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => { loadQr(); }, [loadQr]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (zoom) setZoom(false);
      else onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, zoom]);

  // Pencarian nama peserta yang belum aktivasi (debounce 350 ms).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/activation/search", { params: { q } });
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const printQr = () => {
    if (!qr?.image) return;
    const w = window.open("", "_blank", "width=520,height=680");
    if (!w) { toast.error("Izinkan pop-up untuk mencetak QR."); return; }
    w.document.write(
      `<html><head><title>QR Aktivasi Akun</title></head>` +
      `<body style="font-family:sans-serif;text-align:center;padding:24px">` +
      `<h2 style="margin:0 0 4px">E-KERTALANGU</h2>` +
      `<p style="margin:0 0 16px;color:#555">Pindai untuk aktivasi akun</p>` +
      `<img src="${qr.image}" style="width:340px;height:340px" />` +
      `<p style="margin-top:16px;font-size:12px;color:#666;word-break:break-all">${qr.url}</p>` +
      `</body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const activateExisting = async (row) => {
    const ok = window.confirm(
      `Aktifkan akun "${row.name}"? Kata sandi sementara memakai tanggal lahir (DDMMYYYY) dan wajib diganti saat pertama masuk.`,
    );
    if (!ok) return;
    setBusyId(row.id);
    try {
      const { data } = await api.post("/admin/users/bulk-activate", { ids: [row.id] });
      if (data.activated?.length) {
        toast.success(`Akun "${row.name}" aktif. Nama pengguna: ${data.activated[0].username}. Sandi awal: tanggal lahir (DDMMYYYY).`);
        setResults((prev) => prev.filter((r) => r.id !== row.id));
      } else {
        toast.warning(data.skipped?.[0]?.reason || "Akun tidak dapat diaktifkan.");
      }
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusyId(null);
    }
  };

  const createAndActivate = async (e) => {
    e.preventDefault();
    const name = manualName.trim();
    if (name.length < 2) { toast.error("Nama minimal 2 huruf."); return; }
    setManualBusy(true);
    setManualResult(null);
    try {
      const { data } = await api.post("/admin/users/pending", {
        entries: [{ name, dob: manualDob || "" }],
      });
      const created = data.created?.[0];
      if (!created) {
        toast.warning(data.skipped?.length
          ? `Nama "${name}" sudah terdaftar dan menunggu aktivasi. Cari namanya di kolom pencarian.`
          : "Akun tidak dibuat.");
        return;
      }
      const act = await api.post("/admin/users/bulk-activate", { ids: [created.id] });
      if (act.data.activated?.length) {
        setManualResult({
          name: created.name,
          username: act.data.activated[0].username,
          password: manualDob ? "tanggal lahir (DDMMYYYY)" : "belum diset — lengkapi tanggal lahir",
        });
        toast.success(`Akun "${created.name}" dibuat & langsung aktif.`);
        setManualName("");
        setManualDob("");
      } else {
        toast.warning(act.data.skipped?.[0]?.reason || "Akun dibuat tetapi belum bisa diaktifkan.");
      }
    } catch (err) {
      toast.error(errText(err));
    } finally {
      setManualBusy(false);
    }
  };

  const content = (
    <Modal
      onClose={onClose}
      testid={ACTIVATION_QR.modal}
      closeTestId={ACTIVATION_QR.close}
      maxWidth={960}
      zIndex={85}
      hideClose
      bodyClassName="bg-[#F6F4EE] p-4 sm:p-5"
      header={(
        <div className="flex items-start justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E3F3EA] text-[#0E4E31]">
              <QrCode size={20} />
            </span>
            <div className="min-w-0">
              <h2 id="activation-qr-title" className="font-heading text-lg font-bold leading-tight text-[#14201A]">
                QR Aktivasi Akun
              </h2>
              <p className="mt-0.5 truncate text-xs text-[#5F6B63]">Pindai, atau aktifkan manual di bawah.</p>
            </div>
          </div>
          <button
            type="button"
            data-testid={ACTIVATION_QR.close}
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#5F6B63] hover:bg-[#F0EEE6]"
          >
            <X size={20} />
          </button>
        </div>
      )}
    >
          <div className="space-y-3.5">
            {/* QR besar */}
            <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  data-testid={ACTIVATION_QR.zoom}
                  onClick={() => qr?.image && setZoom(true)}
                  aria-label="Perbesar QR"
                  className="group relative flex h-56 w-56 items-center justify-center rounded-2xl border border-[#E7E3D8] bg-white p-2 hover:border-[#14633F]"
                >
                  {qr?.image ? (
                    <img
                      src={qr.image}
                      alt="QR Aktivasi Akun"
                      data-testid={ACTIVATION_QR.image}
                      className="h-full w-full object-contain"
                    />
                  ) : failed ? (
                    <span className="text-sm text-[#A32A2A]">Gagal memuat QR.</span>
                  ) : (
                    <Loader2 size={26} className="animate-spin text-[#5F6B63]" />
                  )}
                  {qr?.image && (
                    <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[#14633F]/85 text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Maximize2 size={15} />
                    </span>
                  )}
                </button>
                <p className="text-center text-xs text-[#5F6B63]">
                  Ketuk QR untuk memperbesar. Jamaah memindai lalu mencari namanya.
                </p>
                <div className="grid w-full grid-cols-1 gap-2">
                  <button
                    type="button"
                    data-testid={ACTIVATION_QR.print}
                    onClick={printQr}
                    disabled={!qr?.image}
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#14633F] text-sm font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-50"
                  >
                    <Printer size={15} /> Cetak QR
                  </button>
                </div>
                {qr?.url && (
                  <p className="w-full break-all rounded-lg bg-[#F6F4EE] px-3 py-2 text-[11px] text-[#5F6B63]">
                    {qr.url}
                  </p>
                )}
              </div>
            </div>

            {/* Aktivasi manual — cari nama */}
            <div className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#14201A]">
                <UserCheck size={15} /> Aktifkan Akun yang Sudah Terdaftar
              </div>
              <p className="mt-1 text-xs text-[#5F6B63]">
                Ketik nama peserta yang belum aktivasi, lalu tekan Aktifkan.
              </p>
              <div className="relative mt-3">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
                <input
                  ref={searchRef}
                  data-testid={ACTIVATION_QR.search}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ketik nama peserta…"
                  className={`${inp} pl-10`}
                />
              </div>

              <div className="mt-2" data-testid={ACTIVATION_QR.results}>
                {searching && (
                  <div className="flex items-center gap-2 py-2 text-xs text-[#5F6B63]">
                    <Loader2 size={14} className="animate-spin" /> Mencari…
                  </div>
                )}
                {!searching && query.trim().length >= 2 && results.length === 0 && (
                  <p className="py-2 text-xs text-[#5F6B63]">
                    Tidak ada akun menunggu aktivasi dengan nama itu. Buat akun baru di bawah.
                  </p>
                )}
                <ul className="space-y-1.5">
                  {results.map((r) => (
                    <li
                      key={r.id}
                      data-testid={`${ACTIVATION_QR.resultPrefix}-${r.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[#E7E3D8] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#14201A]">{r.name}</div>
                        <div className="text-[11px] text-[#5F6B63]">
                          {r.requires_dob ? "Tanggal lahir tersedia" : "Tanggal lahir belum diisi"}
                        </div>
                      </div>
                      <button
                        type="button"
                        data-testid={`${ACTIVATION_QR.activatePrefix}-${r.id}`}
                        onClick={() => activateExisting(r)}
                        disabled={busyId === r.id}
                        className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-[#14633F] px-3 text-xs font-semibold text-white hover:bg-[#14633F] disabled:opacity-60"
                      >
                        {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                        Aktifkan
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Aktivasi manual — ketik nama baru */}
            <form onSubmit={createAndActivate} className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#14201A]">
                <UserPlus size={15} /> Buat &amp; Aktifkan Akun Baru
              </div>
              <p className="mt-1 text-xs text-[#5F6B63]">
                Untuk jamaah yang belum terdaftar. Isi tanggal lahir agar sandi awal bisa dipakai.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  data-testid={ACTIVATION_QR.manualName}
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Nama lengkap"
                  className={inp}
                />
                <input
                  data-testid={ACTIVATION_QR.manualDob}
                  type="date"
                  value={manualDob}
                  onChange={(e) => setManualDob(e.target.value)}
                  className={inp}
                  aria-label="Tanggal lahir"
                />
              </div>
              <button
                type="submit"
                data-testid={ACTIVATION_QR.manualSubmit}
                disabled={manualBusy}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#14633F] text-sm font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60"
              >
                {manualBusy ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                Buat &amp; Aktifkan
              </button>

              {manualResult && (
                <div
                  data-testid={ACTIVATION_QR.manualResult}
                  className="mt-3 rounded-xl border border-[#E3F3EA] bg-[#E3F3EA] p-3 text-sm text-[#0E4E31]"
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 size={15} /> Akun aktif
                  </div>
                  <div className="mt-1 space-y-0.5 text-[13px]">
                    <div>Nama: <b>{manualResult.name}</b></div>
                    <div>Nama pengguna: <b>{manualResult.username}</b></div>
                    <div>Sandi awal: <b>{manualResult.password}</b></div>
                  </div>
                </div>
              )}
            </form>

            <div className="flex items-start gap-2 rounded-2xl border border-[#E7E3D8] bg-white p-3.5 text-xs leading-relaxed text-[#5F6B63]">
              <ChevronRight size={15} className="mt-0.5 shrink-0 text-[#5F6B63]" />
              <span>
                Aktivasi manual memakai aturan yang sama dengan Aktivasi Massal: hanya akun berperan
                tunggal <b>Peserta</b> yang berstatus belum aktivasi, dan tanggal lahir harus valid.
              </span>
            </div>
          </div>
    </Modal>
  );

  return (
    <>
      {content}
      {/* Lightbox QR besar */}
      {zoom && qr?.image && (
        <div
          data-testid={ACTIVATION_QR.zoomModal}
          className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-black/85 p-4"
          onClick={() => setZoom(false)}
        >
          <button
            type="button"
            data-testid={ACTIVATION_QR.zoomClose}
            onClick={() => setZoom(false)}
            aria-label="Tutup QR besar"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white hover:bg-white/25"
          >
            <X size={22} />
          </button>
          <img
            src={qr.image}
            alt="QR Aktivasi Akun diperbesar"
            className="max-h-[80vh] w-auto max-w-full rounded-2xl bg-white p-3"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="mt-4 max-w-md break-all text-center text-xs text-white/70">{qr.url}</p>
        </div>
      )}
    </>
  );
}
