// Dialog Tambah / Ubah jadwal kegiatan pendaftaran.
// Dipakai untuk membuat kegiatan baru dan mengubah jadwal buka/tutup.
import { useState } from "react";
import { Loader2, CalendarPlus, Save } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { PENDAFTARAN } from "@/constants/testIds";
import Modal from "@/components/Modal";

const fld =
  "w-full h-12 rounded-xl border border-[#8A948D] bg-white px-3.5 text-base text-[#14201A] outline-none focus:border-[#14633F]";
const lbl = "mb-1.5 block text-[13px] font-semibold text-[#14201A]";

function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

function besokYmd(ymd) {
  if (!ymd) return "";
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MAPS_POLA = /(google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps)/i;

/** Saklar berjajar untuk opsi formulir publik. */
function Saklar({ label, hint, aktif, onChange, testid }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aktif}
      data-testid={testid}
      onClick={() => onChange(!aktif)}
      className={`flex min-h-12 w-full items-start gap-2.5 rounded-xl border-2 px-3 py-2 text-left ${
        aktif ? "border-[#14633F] bg-[#E3F3EA]" : "border-[#E7E3D8] bg-white"
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors motion-reduce:transition-none ${
          aktif ? "bg-[#14633F]" : "bg-[#D9D4C5]"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white transition-transform motion-reduce:transition-none ${
            aktif ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className={`block text-[13px] font-semibold ${aktif ? "text-[#0E4E31]" : "text-[#14201A]"}`}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-[#5F6B63]">{hint}</span>}
      </span>
    </button>
  );
}

export default function PendaftaranFormModal({ onClose, onSaved, jadwalOnly = false, item = null }) {
  const [form, setForm] = useState({
    nama: item?.nama || "",
    tanggal: item?.tanggal || todayYmd(),
    lokasi: item?.lokasi || "",
    maps_url: item?.maps_url || "",
    catatan: item?.catatan || "",
    penyelenggara: item?.penyelenggara || "",
    wajib_konfirmasi: item ? item.wajib_konfirmasi !== false : true,
    hp_wajib: item ? item.hp_wajib !== false : true,
    kegiatan_umum: item ? item.kegiatan_umum === true : false,
    tampilkan_logo: item ? item.tampilkan_logo !== false : true,
    pendaftaran_buka: item?.pendaftaran_buka || "",
    pendaftaran_tutup: item?.pendaftaran_tutup || "",
  });
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const [kotor, setKotor] = useState(false);
  const [tanyaTutup, setTanyaTutup] = useState(false);
  const [tanyaSaklar, setTanyaSaklar] = useState(null);

  const set = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "tanggal" && !f.pendaftaran_tutup) {
        next.pendaftaran_tutup = besokYmd(value);
      }
      return next;
    });
    setKotor(true);
    setPesan("");
  };

  /** Saklar yang mengubah perilaku formulir publik setelah ada pendaftar. */
  const ubahSaklar = (key, value) => {
    const adaPendaftar = (item?.total || 0) > 0;
    if (adaPendaftar) {
      setTanyaSaklar({ key, value });
      return;
    }
    terapkanSaklar(key, value);
  };

  const terapkanSaklar = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (key === "kegiatan_umum" && value) {
        next.hp_wajib = false;
        next.tampilkan_logo = false;
      }
      return next;
    });
    setKotor(true);
    setPesan("");
  };

  const tutup = () => {
    if (kotor) { setTanyaTutup(true); return; }
    onClose?.();
  };

  const simpan = async (e) => {
    e.preventDefault();
    if (!jadwalOnly) {
      if (form.nama.trim().length < 3) { setPesan("Nama kegiatan minimal 3 huruf."); return; }
      if (!form.tanggal) { setPesan("Tanggal acara wajib diisi."); return; }
    }
    const maps = form.maps_url.trim();
    if (maps && !MAPS_POLA.test(maps)) {
      setPesan("Tautan harus dari Google Maps. Kosongkan bila tidak perlu.");
      return;
    }
    const buka = form.pendaftaran_buka || "";
    const tutupTgl = form.pendaftaran_tutup || "";
    if (buka && tutupTgl && tutupTgl < buka) {
      setPesan("Tanggal tutup harus setelah tanggal buka dan tidak melewati tanggal acara.");
      return;
    }
    if (tutupTgl && form.tanggal && tutupTgl > form.tanggal) {
      setPesan("Tanggal tutup harus setelah tanggal buka dan tidak melewati tanggal acara.");
      return;
    }
    setSibuk(true);
    try {
      const isi = {
        pendaftaran_buka: buka || null,
        pendaftaran_tutup: tutupTgl || null,
      };
      if (!jadwalOnly) {
        Object.assign(isi, {
          nama: form.nama.trim(),
          tanggal: form.tanggal,
          lokasi: form.lokasi.trim() || null,
          maps_url: maps || null,
          catatan: form.catatan.trim() || null,
          penyelenggara: form.penyelenggara.trim() || null,
          wajib_konfirmasi: form.wajib_konfirmasi,
          hp_wajib: form.hp_wajib,
          kegiatan_umum: form.kegiatan_umum,
          tampilkan_logo: form.tampilkan_logo,
        });
      }
      if (jadwalOnly && item?.id) {
        await api.patch(`/staff/pendaftaran/${item.id}`, isi);
        toast.success("Jadwal pendaftaran diperbarui.");
      } else {
        await api.post("/staff/pendaftaran", isi);
        toast.success("Kegiatan pendaftaran dibuat.");
      }
      await onSaved?.();
    } catch (e2) {
      setPesan(formatApiErrorDetail(e2.response?.data?.detail));
    } finally {
      setSibuk(false);
    }
  };

  return (
    <Modal
      open
      onClose={tutup}
      title={jadwalOnly ? "Ubah Jadwal Pendaftaran" : "Tambah Kegiatan"}
      subtitle={jadwalOnly
        ? "Jawaban yang sudah masuk tidak berubah."
        : "Tautan publik WhatsApp dibuat otomatis."}
      testid={PENDAFTARAN.formModal}
      maxWidth={560}
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={tutup}
            className="min-h-11 rounded-xl border border-[#E7E3D8] bg-white px-4 text-sm font-semibold text-[#14201A] hover:border-[#14633F]">
            Batal
          </button>
          <button type="submit" form="pendaftaran-form" disabled={sibuk}
            data-testid={PENDAFTARAN.formSubmit}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60">
            {sibuk ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
              : jadwalOnly ? <Save size={16} /> : <CalendarPlus size={16} />}
            {sibuk ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      )}
    >
      <form id="pendaftaran-form" onSubmit={simpan} className="space-y-3">
        {!jadwalOnly && (
          <>
            <label className="block">
              <span className={lbl}>Nama kegiatan *</span>
              <input value={form.nama} onChange={(e) => set("nama", e.target.value)}
                data-testid={PENDAFTARAN.formName} maxLength={120}
                placeholder="Contoh: Pengajian Rutin Ahad Pagi" className={fld} />
            </label>
            <label className="block">
              <span className={lbl}>Tanggal acara *</span>
              <input type="date" value={form.tanggal}
                onChange={(e) => set("tanggal", e.target.value)}
                data-testid={PENDAFTARAN.formDate} className={fld} />
            </label>
            <label className="block">
              <span className={lbl}>Lokasi</span>
              <input value={form.lokasi} onChange={(e) => set("lokasi", e.target.value)}
                data-testid={PENDAFTARAN.formLocation} maxLength={160}
                placeholder="Contoh: Masjid Kertalangu" className={fld} />
            </label>
            <label className="block">
              <span className={lbl}>Tautan Google Maps (opsional)</span>
              <input value={form.maps_url} onChange={(e) => set("maps_url", e.target.value)}
                data-testid={PENDAFTARAN.formMaps} maxLength={400}
                placeholder="https://maps.app.goo.gl/…" className={fld} />
            </label>
            <div>
              <span className={lbl}>Jenis kegiatan</span>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button"
                  data-testid={PENDAFTARAN.formJenisWajib}
                  onClick={() => set("wajib_konfirmasi", true)}
                  aria-pressed={form.wajib_konfirmasi}
                  className={`min-h-12 rounded-xl border-2 px-3 text-left text-sm font-semibold ${
                    form.wajib_konfirmasi
                      ? "border-[#14633F] bg-[#E3F3EA] text-[#0E4E31]"
                      : "border-[#E7E3D8] bg-white text-[#5F6B63]"
                  }`}>
                  Wajib ikut
                  <span className="mt-0.5 block text-xs font-normal">
                    Acara khusus yang butuh hitungan peserta
                  </span>
                </button>
                <button type="button"
                  data-testid={PENDAFTARAN.formJenisBiasa}
                  onClick={() => set("wajib_konfirmasi", false)}
                  aria-pressed={!form.wajib_konfirmasi}
                  className={`min-h-12 rounded-xl border-2 px-3 text-left text-sm font-semibold ${
                    !form.wajib_konfirmasi
                      ? "border-[#14633F] bg-[#E3F3EA] text-[#0E4E31]"
                      : "border-[#E7E3D8] bg-white text-[#5F6B63]"
                  }`}>
                  Biasa
                  <span className="mt-0.5 block text-xs font-normal">
                    Kegiatan rutin seperti ngaji
                  </span>
                </button>
              </div>
            </div>

            <div>
              <span className={lbl}>Opsi formulir publik</span>
              <div className="grid gap-2 sm:grid-cols-3">
                <Saklar
                  testid={PENDAFTARAN.formHpWajib}
                  label="Nomor HP wajib diisi"
                  hint="Bila mati, nomor HP boleh kosong."
                  aktif={form.hp_wajib}
                  onChange={(v) => ubahSaklar("hp_wajib", v)}
                />
                <Saklar
                  testid={PENDAFTARAN.formKegiatanUmum}
                  label="Kegiatan umum"
                  hint="Pendaftar dari luar Kertalangu."
                  aktif={form.kegiatan_umum}
                  onChange={(v) => ubahSaklar("kegiatan_umum", v)}
                />
                <Saklar
                  testid={PENDAFTARAN.formTampilkanLogo}
                  label="Tampilkan logo"
                  hint="Logo E-Kertalangu di formulir publik."
                  aktif={form.tampilkan_logo}
                  onChange={(v) => ubahSaklar("tampilkan_logo", v)}
                />
              </div>
            </div>

            <label className="block">
              <span className={lbl}>Penyelenggara (opsional)</span>
              <input value={form.penyelenggara}
                onChange={(e) => set("penyelenggara", e.target.value)}
                data-testid={PENDAFTARAN.formPenyelenggara} maxLength={120}
                placeholder="Contoh: Karang Taruna Desa X" className={fld} />
            </label>
          </>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className={lbl}>Pendaftaran dibuka</span>
            <input type="date" value={form.pendaftaran_buka}
              onChange={(e) => set("pendaftaran_buka", e.target.value)}
              data-testid={PENDAFTARAN.formBuka} className={fld} />
            <span className="mt-1 block text-xs text-[#5F6B63]">Kosong = langsung dibuka</span>
          </label>
          <label className="block">
            <span className={lbl}>Pendaftaran ditutup</span>
            <input type="date" value={form.pendaftaran_tutup}
              onChange={(e) => set("pendaftaran_tutup", e.target.value)}
              data-testid={PENDAFTARAN.formTutup} className={fld} />
            <span className="mt-1 block text-xs text-[#5F6B63]">
              Bawaan: sehari sebelum tanggal acara
            </span>
          </label>
        </div>

        {!jadwalOnly && (
          <label className="block">
            <span className={lbl}>Catatan (opsional)</span>
            <textarea value={form.catatan} onChange={(e) => set("catatan", e.target.value)}
              data-testid={PENDAFTARAN.formNote} maxLength={300} rows={3}
              placeholder="Keterangan tambahan untuk peserta"
              className="w-full rounded-xl border border-[#8A948D] bg-white px-3.5 py-2.5 text-base text-[#14201A] outline-none focus:border-[#14633F]" />
          </label>
        )}

        {pesan && (
          <p className="rounded-xl bg-[#FBE5E3] p-2.5 text-sm text-[#A32A2A]">{pesan}</p>
        )}
      </form>

      {tanyaSaklar && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4">
            <p className="text-base font-semibold text-[#14201A]">Ubah opsi formulir?</p>
            <p className="mt-1 text-sm text-[#5F6B63]">
              Kegiatan ini sudah punya {item?.total || 0} pendaftar. Perubahan hanya
              berlaku untuk pengisian berikutnya; jawaban yang sudah masuk tidak dihapus.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setTanyaSaklar(null)}
                className="min-h-11 rounded-xl border border-[#E7E3D8] bg-white px-4 text-sm font-semibold text-[#14201A]">
                Batal
              </button>
              <button type="button"
                onClick={() => {
                  const { key, value } = tanyaSaklar;
                  setTanyaSaklar(null);
                  terapkanSaklar(key, value);
                }}
                className="min-h-11 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white">
                Ya
              </button>
            </div>
          </div>
        </div>
      )}

      {tanyaTutup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4">
            <p className="text-base font-semibold text-[#14201A]">Tutup tanpa menyimpan?</p>
            <p className="mt-1 text-sm text-[#5F6B63]">Isian yang sudah diketik akan hilang.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setTanyaTutup(false)}
                className="min-h-11 rounded-xl border border-[#E7E3D8] bg-white px-4 text-sm font-semibold text-[#14201A]">
                Batal
              </button>
              <button type="button" onClick={() => { setTanyaTutup(false); onClose?.(); }}
                className="min-h-11 rounded-xl bg-[#A32A2A] px-4 text-sm font-semibold text-white">
                Ya
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
