// Bagian bersama halaman Pendaftaran Kegiatan (badge status, statistik, tabel).
// Dipakai PendaftaranKegiatanView (Kegiatan Aktif / Rekap / Arsip) dan
// PendaftaranDetailModal agar tidak ada duplikasi markup.

export const STATUS_META = {
  aktif: { label: "Aktif", bg: "#E3F3EA", text: "#0E4E31" },
  berlangsung: { label: "Berlangsung", bg: "#E3EEFB", text: "#1D4F91" },
  selesai: { label: "Selesai", bg: "#E7E3D8", text: "#4A5650" },
  arsip: { label: "Arsip", bg: "#F0EEE6", text: "#5F6B63" },
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

export function BadgeKehadiran({ kehadiran }) {
  const hadir = kehadiran === "hadir";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={hadir
        ? { backgroundColor: "#E3F3EA", color: "#0E4E31" }
        : { backgroundColor: "#FBE5E3", color: "#A32A2A" }}
    >
      {hadir ? "Hadir" : "Tidak Hadir"}
    </span>
  );
}

/** Empat kotak angka: total peserta, hadir, tidak hadir, belum konfirmasi. */
export function Statistik({ item, ikon }) {
  const kotak = [
    { label: "Total peserta", value: item.total_peserta, Icon: ikon.Users, color: "#14201A" },
    { label: "Hadir", value: item.hadir, Icon: ikon.CheckCircle2, color: "#0E4E31" },
    { label: "Tidak hadir", value: item.tidak_hadir, Icon: ikon.XCircle, color: "#A32A2A" },
    { label: "Belum konfirmasi", value: item.belum_konfirmasi, Icon: ikon.Clock, color: "#8A5A00" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {kotak.map(({ label, value, Icon, color }) => (
        <div key={label} className="rounded-xl border border-[#E7E3D8] bg-white p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5F6B63]">
            <Icon size={14} style={{ color }} /> {label}
          </div>
          <p className="mt-1 text-xl font-bold" style={{ color }}>{value}</p>
        </div>
      ))}
    </div>
  );
}

/** Rincian jumlah alasan tidak hadir. */
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

/** Tabel peserta: nama, status akun, kehadiran, alasan, keterangan. */
export function TabelPeserta({ rows, denganKeterangan = false }) {
  if (!rows?.length) {
    return (
      <p className="rounded-xl border border-[#E7E3D8] bg-white p-6 text-center text-sm text-[#5F6B63]">
        Belum ada konfirmasi peserta.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[#E7E3D8] bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-[#F6F4EE] text-xs uppercase tracking-wide text-[#5F6B63]">
          <tr>
            <th className="px-3 py-2.5 font-semibold">Nama</th>
            <th className="px-3 py-2.5 font-semibold">Status akun</th>
            <th className="px-3 py-2.5 font-semibold">Kehadiran</th>
            <th className="px-3 py-2.5 font-semibold">Alasan</th>
            {denganKeterangan && <th className="px-3 py-2.5 font-semibold">Keterangan</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-[#E7E3D8]">
              <td className="px-3 py-2.5 font-medium text-[#14201A]">{r.nama}</td>
              <td className="px-3 py-2.5 text-[#5F6B63]">{r.status_akun_label}</td>
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
