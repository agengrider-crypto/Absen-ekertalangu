// Bagian bersama halaman Pendaftaran Kegiatan (badge, statistik, daftar).
// Dipakai PendaftaranKegiatanView dan PendaftaranDetailModal agar tidak ada
// duplikasi markup.
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { tanggalIndonesia } from "@/lib/wa";

export const ALASAN_KEYS = ["Kerja", "Sakit", "Keperluan keluarga", "Luar kota", "Lainnya"];

/** Badge jenis kegiatan: Wajib ikut atau Biasa. */
export function JenisBadge({ wajib }) {
  const on = wajib !== false;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={on
        ? { backgroundColor: "#FFF4D6", color: "#8A5A00" }
        : { backgroundColor: "#F0EEE6", color: "#5F6B63" }}
    >
      {on ? "Wajib ikut" : "Biasa"}
    </span>
  );
}

/** Badge status kegiatan pendaftaran: Dibuka / Ditutup / Selesai. */
export function StatusKegiatanBadge({ item }) {
  const selesai = item?.status_tampil === "selesai" || item?.status_tampil === "arsip";
  const jadwal = item?.jadwal_status || "dibuka";
  const meta = selesai
    ? { label: "Selesai", bg: "#E7E3D8", text: "#4A5650" }
    : jadwal === "dibuka"
      ? { label: "Dibuka", bg: "#E3F3EA", text: "#0E4E31" }
      : jadwal === "belum"
        ? { label: "Belum dibuka", bg: "#F0EEE6", text: "#5F6B63" }
        : { label: "Ditutup", bg: "#FBE5E3", text: "#A32A2A" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: meta.bg, color: meta.text }}
    >
      {meta.label}
    </span>
  );
}

export function BadgeKehadiran({ kehadiran }) {
  const ikut = kehadiran === "hadir";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={ikut
        ? { backgroundColor: "#E3F3EA", color: "#0E4E31" }
        : { backgroundColor: "#FBE5E3", color: "#A32A2A" }}
    >
      {ikut ? "Ikut" : "Tidak ikut"}
    </span>
  );
}

/** Tautan Google Maps dari lokasi (tanpa API key) atau tautan yang diisi. */
export function mapsHref(item) {
  if (item?.maps_url) return item.maps_url;
  const lokasi = (item?.lokasi || "").trim();
  if (!lokasi) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lokasi)}`;
}

export function TombolMaps({ item, className = "" }) {
  const href = mapsHref(item);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-xs font-semibold text-[#0E4E31] underline-offset-2 hover:underline ${className}`}
    >
      Buka di Google Maps
    </a>
  );
}

/** Rincian jumlah alasan tidak ikut. */
export function AlasanRingkas({ ringkas }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALASAN_KEYS.map((a) => (
        <span key={a}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E3D8] bg-white px-2.5 py-1 text-xs text-[#14201A]">
          {a}
          <b className="text-[#0E4E31]">{ringkas?.[a] ?? 0}</b>
        </span>
      ))}
    </div>
  );
}

/** Daftar peserta ringkas: Nama + status Ikut/Tidak ikut.
 * Nomor HP, alasan, dan keterangan muncul saat baris diklik. */
export function DaftarPeserta({ rows }) {
  const [buka, setBuka] = useState({});
  if (!rows?.length) {
    return (
      <p className="rounded-xl border border-[#E7E3D8] bg-white p-6 text-center text-sm text-[#5F6B63]">
        Belum ada yang mengisi.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-[#E7E3D8] overflow-hidden rounded-xl border border-[#E7E3D8] bg-white">
      {rows.map((r) => {
        const terbuka = !!buka[r.id];
        const alasan = r.kehadiran === "hadir" ? "-" : (r.alasan_lain || r.alasan || "-");
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setBuka((b) => ({ ...b, [r.id]: !b[r.id] }))}
              aria-expanded={terbuka}
              className="flex min-h-12 w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[#F6F4EE]"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#14201A]">
                {r.nama}
              </span>
              <BadgeKehadiran kehadiran={r.kehadiran} />
              <ChevronDown
                size={15}
                className={`shrink-0 text-[#5F6B63] transition-transform motion-reduce:transition-none ${
                  terbuka ? "rotate-180" : ""
                }`}
              />
            </button>
            {terbuka && (
              <dl className="space-y-1 bg-[#F6F4EE] px-3 py-2.5 text-xs text-[#5F6B63]">
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 font-semibold">Nomor HP</dt>
                  <dd className="min-w-0 break-all">{r.nomor_hp || "-"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 font-semibold">Alasan</dt>
                  <dd className="min-w-0">{alasan}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 font-semibold">Keterangan</dt>
                  <dd className="min-w-0">{r.keterangan || "-"}</dd>
                </div>
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Teks rekap untuk WhatsApp. Nomor HP tidak pernah dimasukkan. */
export function teksRekapWhatsApp(item, { sertakanNama = true, maksNama = 60 } = {}) {
  const ikut = (item?.peserta || []).filter((p) => p.kehadiran === "hadir");
  const baris = [];
  baris.push(`*${item?.nama || "Kegiatan"}*`);
  if (item?.penyelenggara) baris.push(item.penyelenggara);
  baris.push(`${tanggalIndonesia(item?.tanggal)}${item?.lokasi ? ` · ${item.lokasi}` : ""}`);
  baris.push("");
  baris.push(`Ikut: ${item?.ikut ?? 0} · Tidak ikut: ${item?.tidak_ikut ?? 0} · Total: ${item?.total ?? 0}`);
  if (sertakanNama && ikut.length) {
    baris.push("");
    baris.push("*Yang ikut:*");
    const tampil = ikut.slice(0, maksNama);
    tampil.forEach((p, i) => baris.push(`${i + 1}. ${p.nama}`));
    if (ikut.length > tampil.length) {
      baris.push(`dan ${ikut.length - tampil.length} lainnya`);
    }
  }
  if (item?.link) {
    baris.push("");
    baris.push(`Pendaftaran: ${item.link}`);
  }
  return baris.join("\n");
}

/** Tautan wa.me dari teks (di-encode benar). */
export function waHref(teks) {
  return `https://wa.me/?text=${encodeURIComponent(teks)}`;
}

