// Bagian bersama halaman Pendaftaran Kegiatan (badge, statistik, tabel).
// Dipakai PendaftaranKegiatanView dan PendaftaranDetailModal agar tidak ada
// duplikasi markup.

export const STATUS_META = {
  aktif: { label: "Aktif", bg: "#E3F3EA", text: "#0E4E31" },
  berlangsung: { label: "Berlangsung", bg: "#E3EEFB", text: "#1D4F91" },
  selesai: { label: "Selesai", bg: "#E7E3D8", text: "#4A5650" },
  arsip: { label: "Arsip", bg: "#F0EEE6", text: "#5F6B63" },
};

export const JADWAL_META = {
  belum: { label: "Belum dibuka", bg: "#F0EEE6", text: "#5F6B63" },
  dibuka: { label: "Dibuka", bg: "#E3F3EA", text: "#0E4E31" },
  ditutup: { label: "Ditutup", bg: "#FBE5E3", text: "#A32A2A" },
};

export const ALASAN_KEYS = ["Kerja", "Sakit", "Keperluan keluarga", "Luar kota", "Lainnya"];

export function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.aktif;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: meta.bg, color: meta.text }}
    >
      {meta.label}
    </span>
  );
}

/** Badge jadwal pendaftaran: Belum dibuka / Dibuka / Ditutup. */
export function JadwalBadge({ status }) {
  const meta = JADWAL_META[status] || JADWAL_META.dibuka;
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: meta.bg, color: meta.text }}
    >
      {meta.label}
    </span>
  );
}

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

/** Angka utama: Total mengisi, Ikut, Tidak ikut. */
export function Statistik({ item, ikon, wajib }) {
  const kotak = [
    { label: "Total mengisi", value: item.total, Icon: ikon.Users, color: "#14201A" },
    { label: "Ikut", value: item.ikut, Icon: ikon.CheckCircle2, color: "#0E4E31" },
    { label: "Tidak ikut", value: item.tidak_ikut, Icon: ikon.XCircle, color: "#A32A2A" },
  ];
  return (
    <div className="space-y-2">
      {wajib && (
        <div className="rounded-xl border border-[#F0D9A8] bg-[#FFF9EC] p-3">
          <p className="text-xs font-semibold text-[#8A5A00]">Ikut</p>
          <p className="text-3xl font-bold leading-tight text-[#8A5A00]">
            {item.ikut} <span className="text-sm font-semibold">orang ikut</span>
          </p>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {kotak.map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-xl border border-[#E7E3D8] bg-white p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5F6B63]">
              <Icon size={14} style={{ color }} /> {label}
            </div>
            <p className="mt-1 text-xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
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

/** Tabel peserta: nama, nomor HP, jawaban, alasan, keterangan. */
export function TabelPeserta({ rows, denganKeterangan = false }) {
  if (!rows?.length) {
    return (
      <p className="rounded-xl border border-[#E7E3D8] bg-white p-6 text-center text-sm text-[#5F6B63]">
        Belum ada yang mengisi.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E7E3D8] bg-white">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-[#F6F4EE] text-xs uppercase tracking-wide text-[#5F6B63]">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Nama</th>
            <th className="px-3 py-2.5 font-semibold">Nomor HP</th>
            <th className="px-3 py-2.5 font-semibold">Jawaban</th>
            <th className="px-3 py-2.5 font-semibold">Alasan</th>
            {denganKeterangan && <th className="px-3 py-2.5 font-semibold">Keterangan</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[#E7E3D8]">
              <td className="px-3 py-2.5 font-medium text-[#14201A]">{r.nama}</td>
              <td className="px-3 py-2.5 text-[#5F6B63]">{r.nomor_hp || "-"}</td>
              <td className="px-3 py-2.5"><BadgeKehadiran kehadiran={r.kehadiran} /></td>
              <td className="px-3 py-2.5 text-[#5F6B63]">
                {r.kehadiran === "hadir" ? "-" : (r.alasan_lain || r.alasan || "-")}
              </td>
              {denganKeterangan && (
                <td className="px-3 py-2.5 text-[#5F6B63]">{r.keterangan || "-"}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
