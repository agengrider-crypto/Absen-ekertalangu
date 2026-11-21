// Form tambah kegiatan pendaftaran (nama, tanggal, lokasi, catatan).
import { useState } from "react";
import { Loader2, CalendarPlus } from "lucide-react";
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

export default function PendaftaranFormModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    nama: "", tanggal: todayYmd(), lokasi: "", catatan: "", wajib_konfirmasi: true,
  });
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setPesan("");
  };

  const simpan = async (e) => {
    e.preventDefault();
    if (form.nama.trim().length < 3) { setPesan("Nama kegiatan minimal 3 huruf."); return; }
    if (!form.tanggal) { setPesan("Tanggal kegiatan wajib diisi."); return; }
    setSibuk(true);
    try {
      await api.post("/staff/pendaftaran", {
        nama: form.nama.trim(),
        tanggal: form.tanggal,
        lokasi: form.lokasi.trim() || null,
        catatan: form.catatan.trim() || null,
        wajib_konfirmasi: form.wajib_konfirmasi,
      });
      toast.success("Kegiatan pendaftaran dibuat.");
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
      onClose={onClose}
      title="Tambah Kegiatan Pendaftaran"
      subtitle="Tautan publik WhatsApp dibuat otomatis."
      testid={PENDAFTARAN.formModal}
      maxWidth={560}
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose}
            className="min-h-11 rounded-xl border border-[#E7E3D8] bg-white px-4 text-sm font-semibold text-[#14201A] hover:border-[#14633F]">
            Batal
          </button>
          <button type="submit" form="pendaftaran-form" disabled={sibuk}
            data-testid={PENDAFTARAN.formSubmit}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60">
            {sibuk ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" />
              : <CalendarPlus size={16} />}
            {sibuk ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      )}
    >
      <form id="pendaftaran-form" onSubmit={simpan} className="space-y-3">
        <label className="block">
          <span className={lbl}>Nama kegiatan</span>
          <input value={form.nama} onChange={(e) => set("nama", e.target.value)}
            data-testid={PENDAFTARAN.formName} maxLength={120}
            placeholder="Contoh: Pengajian Rutin Ahad Pagi" className={fld} />
        </label>
        <label className="block">
          <span className={lbl}>Tanggal</span>
          <input type="date" value={form.tanggal} onChange={(e) => set("tanggal", e.target.value)}
            data-testid={PENDAFTARAN.formDate} className={fld} />
        </label>
        <label className="block">
          <span className={lbl}>Lokasi</span>
          <input value={form.lokasi} onChange={(e) => set("lokasi", e.target.value)}
            data-testid={PENDAFTARAN.formLocation} maxLength={160}
            placeholder="Contoh: Masjid Kertalangu" className={fld} />
        </label>
        <div>
          <span className={lbl}>Jenis kegiatan</span>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button"
              data-testid={PENDAFTARAN.formJenisBiasa}
              onClick={() => set("wajib_konfirmasi", false)}
              aria-pressed={!form.wajib_konfirmasi}
              className={`min-h-12 rounded-xl border-2 px-3 text-left text-sm font-semibold ${
                !form.wajib_konfirmasi
                  ? "border-[#14633F] bg-[#E3F3EA] text-[#0E4E31]"
                  : "border-[#E7E3D8] bg-white text-[#5F6B63]"
              }`}>
              Kegiatan Biasa
              <span className="mt-0.5 block text-xs font-normal">
                Tanpa kewajiban konfirmasi peserta
              </span>
            </button>
            <button type="button"
              data-testid={PENDAFTARAN.formJenisWajib}
              onClick={() => set("wajib_konfirmasi", true)}
              aria-pressed={form.wajib_konfirmasi}
              className={`min-h-12 rounded-xl border-2 px-3 text-left text-sm font-semibold ${
                form.wajib_konfirmasi
                  ? "border-[#14633F] bg-[#E3F3EA] text-[#0E4E31]"
                  : "border-[#E7E3D8] bg-white text-[#5F6B63]"
              }`}>
              ⭐ Wajib Konfirmasi
              <span className="mt-0.5 block text-xs font-normal">
                Peserta wajib konfirmasi hadir / berhalangan
              </span>
            </button>
          </div>
        </div>
        <label className="block">
          <span className={lbl}>Catatan (opsional)</span>
          <textarea value={form.catatan} onChange={(e) => set("catatan", e.target.value)}
            data-testid={PENDAFTARAN.formNote} maxLength={300} rows={3}
            placeholder="Keterangan tambahan untuk peserta"
            className="w-full rounded-xl border border-[#8A948D] bg-white px-3.5 py-2.5 text-base text-[#14201A] outline-none focus:border-[#14633F]" />
        </label>
        {pesan && (
          <p className="rounded-xl bg-[#FBE5E3] p-2.5 text-sm text-[#A32A2A]">{pesan}</p>
        )}
      </form>
    </Modal>
  );
}
