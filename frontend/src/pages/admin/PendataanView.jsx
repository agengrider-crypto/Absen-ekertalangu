// Halaman Pendataan (pengurus & administrator).
// Membuat tautan publik untuk melengkapi data peserta lama / pendaftaran baru,
// lalu meninjau isian yang masuk. Semua perubahan baru berlaku setelah disetujui.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link2, Loader2, Copy, UserPlus, Check, X, AlertTriangle, RefreshCw, Power,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { tanggalIndonesia } from "@/lib/wa";

const MARITAL_LABEL = { belum_menikah: "Belum menikah", sudah_menikah: "Sudah menikah" };
const GENDER_LABEL = { L: "Laki-laki", P: "Perempuan" };
const FIELD_LABEL = {
  status_pernikahan: "Status pernikahan",
  jenis_kelamin: "Jenis kelamin",
  tanggal_lahir: "Tanggal lahir",
  nomor_hp: "Nomor HP",
};

function nilaiTampil(field, value) {
  if (!value) return "kosong";
  if (field === "status_pernikahan") return MARITAL_LABEL[value] || value;
  if (field === "jenis_kelamin") return GENDER_LABEL[value] || value;
  if (field === "tanggal_lahir") return tanggalIndonesia(value);
  return value;
}

async function salin(teks) {
  try {
    await navigator.clipboard.writeText(teks);
    toast.success("Disalin");
  } catch (_) {
    toast.error("Tidak bisa menyalin");
  }
}

export default function PendataanView() {
  const [users, setUsers] = useState([]);
  const [dipilih, setDipilih] = useState(new Set());
  const [cari, setCari] = useState("");
  const [berlaku, setBerlaku] = useState(7);
  const [tautan, setTautan] = useState([]);
  const [isian, setIsian] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [hasilOrang, setHasilOrang] = useState(null);
  const [hasilBaru, setHasilBaru] = useState(null);

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const [u, t, i] = await Promise.all([
        api.get("/admin/users"),
        api.get("/staff/pendataan/tautan"),
        api.get("/staff/pendataan/isian"),
      ]);
      setUsers((u.data || []).filter((x) => x.roles?.includes("peserta")));
      setTautan(t.data.items || []);
      setIsian(i.data.items || []);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const daftar = useMemo(() => {
    const term = cari.trim().toLowerCase();
    return users
      .filter((u) => !term || (u.name || "").toLowerCase().includes(term))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "id"));
  }, [users, cari]);

  const toggle = (id) => setDipilih((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const buatOrang = async () => {
    if (!dipilih.size) { toast.error("Pilih minimal satu peserta."); return; }
    setSibuk(true);
    try {
      const { data } = await api.post("/staff/pendataan/tautan", {
        jenis: "orang", peserta_ids: Array.from(dipilih), berlaku_hari: berlaku,
      });
      setHasilOrang(data);
      setHasilBaru(null);
      await muat();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSibuk(false); }
  };

  const buatBaru = async () => {
    setSibuk(true);
    try {
      const { data } = await api.post("/staff/pendataan/tautan", {
        jenis: "baru", berlaku_hari: berlaku,
      });
      setHasilBaru(data);
      setHasilOrang(null);
      await muat();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setSibuk(false); }
  };

  const matikan = async (id) => {
    try {
      await api.post(`/staff/pendataan/tautan/${id}/matikan`);
      toast.success("Tautan dimatikan.");
      await muat();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const putuskan = async (id, aksi, pesertaId) => {
    try {
      await api.post(`/staff/pendataan/isian/${id}/putuskan`,
        { aksi, peserta_id: pesertaId || null });
      toast.success(aksi === "tolak" ? "Isian ditolak." : "Isian disetujui.");
      await muat();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const teksPerOrang = (item) =>
    `Lengkapi data berikut:\n${item.nama}\n${item.url}\nBerlaku sampai ${tanggalIndonesia(hasilOrang?.berlaku_sampai)}.`;

  const teksGabungan = () => {
    const baris = (hasilOrang?.items || []).map((it, i) => `${i + 1}. ${it.nama}\n${it.url}`);
    return `Lengkapi data berikut (pilih tautan sesuai nama Anda):\n${baris.join("\n")}\nBerlaku sampai ${tanggalIndonesia(hasilOrang?.berlaku_sampai)}.`;
  };

  const teksBaru = () =>
    `Peserta baru, silakan isi data lengkap di sini:\n${hasilBaru?.items?.[0]?.url || ""}\nBerlaku sampai ${tanggalIndonesia(hasilBaru?.berlaku_sampai)}.`;

  return (
    <div className="space-y-5" data-testid="pendataan-view">
      <div>
        <h1 className="inline-flex items-center gap-2 font-heading text-2xl font-bold text-[#14201A]">
          <Link2 size={22} className="text-[#0E4E31]" /> Pendataan
        </h1>
        <p className="mt-1 text-sm text-[#5F6B63]">
          Buat tautan untuk melengkapi data peserta lama atau mendaftarkan peserta baru.
          Semua isian masuk ke tinjauan dulu.
        </p>
      </div>

      {/* (a) Pembuat tautan */}
      <section className="rounded-2xl border border-[#E7E3D8] bg-white p-4">
        <h2 className="text-sm font-bold text-[#14201A]">Buat tautan</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-sm text-[#5F6B63]">Berlaku</label>
          <select
            value={berlaku}
            onChange={(e) => setBerlaku(Number(e.target.value))}
            className="h-11 rounded-xl border border-[#8A948D] bg-white px-3 text-sm"
          >
            <option value={7}>7 hari</option>
            <option value={14}>14 hari</option>
            <option value={30}>Sebulan</option>
          </select>
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama peserta"
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#8A948D] bg-white px-3 text-sm"
          />
        </div>

        <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-[#E7E3D8]">
          {daftar.length ? daftar.map((u) => (
            <label key={u.id} className="flex min-h-11 cursor-pointer items-center gap-2 border-b border-[#E7E3D8] px-3 py-2 text-sm last:border-b-0">
              <input
                type="checkbox"
                checked={dipilih.has(u.id)}
                onChange={() => toggle(u.id)}
                className="h-5 w-5 accent-[#14633F]"
              />
              <span className="truncate">{u.name}</span>
            </label>
          )) : (
            <p className="p-4 text-center text-sm text-[#5F6B63]">Tidak ada peserta yang cocok.</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={buatOrang} disabled={sibuk}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#14633F] px-4 text-sm font-semibold text-white hover:bg-[#0E4E31] disabled:opacity-60">
            {sibuk ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> : <Link2 size={16} />}
            Buat tautan ({dipilih.size})
          </button>
          <button type="button" onClick={buatBaru} disabled={sibuk}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#14201A] hover:border-[#14633F] disabled:opacity-60">
            <UserPlus size={16} /> Buat tautan peserta baru
          </button>
        </div>

        {hasilOrang && (
          <div className="mt-3 space-y-2 rounded-xl border border-[#E3F3EA] bg-[#E3F3EA] p-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => salin(teksGabungan())}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#14633F] bg-white px-3 text-sm font-semibold text-[#0E4E31]">
                <Copy size={15} /> Salin teks gabungan
              </button>
            </div>
            <p className="text-xs font-semibold text-[#0E4E31]">Salin teks per orang</p>
            <div className="space-y-1.5">
              {hasilOrang.items.map((it) => (
                <div key={it.token} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-[#14201A]">{it.nama}</span>
                  <button type="button" onClick={() => salin(teksPerOrang(it))}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#E7E3D8] px-2.5 text-xs font-semibold text-[#0E4E31]">
                    <Copy size={13} /> Salin
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {hasilBaru && (
          <div className="mt-3 space-y-2 rounded-xl border border-[#E3F3EA] bg-[#E3F3EA] p-3">
            <p className="break-all text-sm text-[#0E4E31]">{hasilBaru.items?.[0]?.url}</p>
            <button type="button" onClick={() => salin(teksBaru())}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#14633F] bg-white px-3 text-sm font-semibold text-[#0E4E31]">
              <Copy size={15} /> Salin teks peserta baru
            </button>
          </div>
        )}
      </section>

      {/* (b) Menunggu tinjauan */}
      <section className="rounded-2xl border border-[#E7E3D8] bg-white">
        <div className="flex items-center justify-between border-b border-[#E7E3D8] px-4 py-3">
          <h2 className="text-sm font-bold text-[#14201A]">Menunggu tinjauan</h2>
          <button type="button" onClick={muat} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E4E31]">
            <RefreshCw size={13} /> Muat ulang
          </button>
        </div>
        {loading ? (
          <p className="flex items-center justify-center gap-2 p-6 text-sm text-[#5F6B63]">
            <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> Memuat…
          </p>
        ) : isian.length ? (
          <div className="divide-y divide-[#E7E3D8]">
            {isian.map((row) => {
              const data = row.data || {};
              const lama = row.peserta || {};
              const label = row.jenis === "calon" ? "Calon peserta" : "Pembaruan data";
              const nama = row.jenis === "calon" ? data.nama : lama.nama;
              const baris = Object.keys(FIELD_LABEL)
                .filter((f) => data[f])
                .map((f) => `${nilaiTampil(f, lama[f])} menjadi ${nilaiTampil(f, data[f])}`);
              return (
                <div key={row.id} className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#F0EEE6] px-2 py-0.5 text-[11px] font-bold text-[#4A5650]">{label}</span>
                    <span className="text-sm font-semibold text-[#14201A]">{nama || "(tanpa nama)"}</span>
                  </div>
                  <ul className="space-y-0.5 text-[13px] text-[#5F6B63]">
                    {baris.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                  {row.kemungkinan?.length > 0 && (
                    <div className="rounded-xl bg-[#FBF1D6] p-2.5 text-[13px] text-[#6B4500]">
                      <p className="flex items-start gap-1.5 font-semibold">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        Mungkin sudah terdaftar sebagai {row.kemungkinan.map((k) => k.nama).join(", ")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => putuskan(row.id, "tolak")}
                          className="min-h-9 rounded-lg border border-[#E7E3D8] bg-white px-2.5 text-xs font-semibold text-[#A32A2A]">Tolak</button>
                        <button type="button" onClick={() => putuskan(row.id, "gabungkan", row.kemungkinan[0].id)}
                          className="min-h-9 rounded-lg border border-[#E7E3D8] bg-white px-2.5 text-xs font-semibold text-[#0E4E31]">
                          Gabungkan ke {row.kemungkinan[0].nama}
                        </button>
                        <button type="button" onClick={() => putuskan(row.id, "setujui")}
                          className="min-h-9 rounded-lg bg-[#14633F] px-2.5 text-xs font-semibold text-white">Setujui tetap baru</button>
                      </div>
                    </div>
                  )}
                  {!(row.kemungkinan?.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => putuskan(row.id, "setujui")}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#14633F] px-3 text-sm font-semibold text-white hover:bg-[#0E4E31]">
                        <Check size={15} /> {row.jenis === "calon" ? "Setujui jadi peserta" : "Setujui"}
                      </button>
                      <button type="button" onClick={() => putuskan(row.id, "tolak")}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#E7E3D8] bg-white px-3 text-sm font-semibold text-[#A32A2A] hover:border-[#A32A2A]">
                        <X size={15} /> Tolak
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="p-6 text-center text-sm text-[#5F6B63]">Belum ada isian yang menunggu tinjauan.</p>
        )}
      </section>

      {/* (c) Tautan aktif */}
      <section className="rounded-2xl border border-[#E7E3D8] bg-white">
        <h2 className="border-b border-[#E7E3D8] px-4 py-3 text-sm font-bold text-[#14201A]">Tautan aktif</h2>
        {tautan.length ? (
          <div className="divide-y divide-[#E7E3D8]">
            {tautan.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-[#14201A]">
                  {t.jenis === "baru" ? "Peserta baru" : (t.nama || "-")}
                  <span className="ml-2 text-xs text-[#5F6B63]">
                    sampai {tanggalIndonesia(t.berlaku_sampai)}
                  </span>
                </span>
                <button type="button" onClick={() => matikan(t.id)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#E7E3D8] px-2.5 text-xs font-semibold text-[#A32A2A] hover:border-[#A32A2A]">
                  <Power size={13} /> Matikan tautan
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-6 text-center text-sm text-[#5F6B63]">Belum ada tautan aktif.</p>
        )}
      </section>
    </div>
  );
}
