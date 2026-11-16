// Pembentuk pesan + pembuka WhatsApp untuk tugas wali.
// Dipisah agar nanti bisa diganti pengiriman otomatis tanpa mengubah halaman.

/** Nomor wali → 62xxxxxxxxxx (buang spasi/strip, 08… → 628…). */
export function normalisasiNomor(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
  "Agustus", "September", "Oktober", "November", "Desember"];

/** "2026-11-20" → "20 November 2026". */
export function tanggalIndonesia(ymd) {
  const p = String(ymd || "").slice(0, 10).split("-");
  if (p.length !== 3) return ymd || "-";
  return `${Number(p[2])} ${BULAN[Number(p[1]) - 1]} ${p[0]}`;
}

export function tautanTugas(token) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/tugas/${token}`;
}

/** Pesan tugas untuk wali. */
export function pesanTugas({ namaDepan, judul, batasKumpul, token }) {
  return [
    `Assalamualaikum, Bapak/Ibu wali ${namaDepan}.`,
    `Ada tugas untuk ananda: ${judul}.`,
    `Batas kumpul ${tanggalIndonesia(batasKumpul)}.`,
    `Silakan buka tautan berikut untuk menandai tugas sudah dikerjakan:`,
    tautanTugas(token),
  ].join("\n");
}

/** Pesan pengingat singkat untuk yang belum mengumpulkan. */
export function pesanPengingat({ namaDepan, judul, batasKumpul, token }) {
  return [
    `Assalamualaikum, Bapak/Ibu wali ${namaDepan}.`,
    `Mengingatkan tugas "${judul}" belum ditandai selesai (batas ${tanggalIndonesia(batasKumpul)}).`,
    tautanTugas(token),
  ].join("\n");
}

/** Buka WhatsApp (wa.me) dengan teks terisi. Mengembalikan false bila tanpa nomor. */
export function bukaWhatsApp(nomor, teks) {
  const n = normalisasiNomor(nomor);
  if (!n) return false;
  window.open(`https://wa.me/${n}?text=${encodeURIComponent(teks)}`, "_blank", "noopener");
  return true;
}

/** URL wa.me dengan teks terisi. Tanpa nomor → pengurus memilih kontak sendiri. */
export function tautanWhatsApp(nomor, teks) {
  const n = normalisasiNomor(nomor);
  return `https://wa.me/${n}?text=${encodeURIComponent(teks)}`;
}

/** Nomor tersamar untuk ditampilkan, mis. 6281234567890 → 0812****6789. */
export function nomorTersamar(value) {
  const n = normalisasiNomor(value);
  if (!n) return "";
  const lokal = n.startsWith("62") ? `0${n.slice(2)}` : n;
  if (lokal.length < 9) return lokal;
  return `${lokal.slice(0, 4)}****${lokal.slice(-4)}`;
}
