// Pencarian nama peserta untuk halaman publik (pendaftaran & izin).
// Mengetik minimal 2 huruf → hasil dari server (maksimal 5, hanya id + nama).
// Tidak ada daftar penuh dan tidak ada dropdown.
import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { api } from "@/lib/api";

const inputCls =
  "h-12 w-full rounded-xl border border-[#8A948D] bg-white pl-10 pr-10 text-base text-[#14201A] outline-none focus:border-[#14633F]";

export default function CariNamaPeserta({ value, onPick, testid }) {
  const [q, setQ] = useState("");
  const [hasil, setHasil] = useState(null);
  const [cari, setCari] = useState(false);
  const [pesan, setPesan] = useState("");
  const seq = useRef(0);

  useEffect(() => {
    const teks = q.trim();
    if (teks.length < 2) {
      setHasil(null);
      setPesan("");
      return undefined;
    }
    const id = ++seq.current;
    setCari(true);
    const t = setTimeout(() => {
      api.get("/publik/peserta/cari", { params: { q: teks } })
        .then(({ data }) => {
          if (seq.current !== id) return;
          setHasil(data.items || []);
          setPesan("");
        })
        .catch((e) => {
          if (seq.current !== id) return;
          setHasil([]);
          setPesan(e.response?.status === 429
            ? "Terlalu banyak pencarian. Coba lagi nanti."
            : "Pencarian gagal. Coba lagi.");
        })
        .finally(() => { if (seq.current === id) setCari(false); });
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <div className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-[#14633F] bg-[#E3F3EA] px-3">
        <span className="min-w-0 truncate text-sm font-semibold text-[#0E4E31]">
          {value.nama}
        </span>
        <button type="button" onClick={() => { onPick(null); setQ(""); setHasil(null); }}
          aria-label="Ganti nama"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#0E4E31] hover:bg-white">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid={testid}
          placeholder="Ketik minimal 2 huruf nama"
          maxLength={60}
          className={inputCls}
        />
        {cari && (
          <Loader2 size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#0E4E31] motion-reduce:animate-none" />
        )}
      </div>

      {pesan && <p className="mt-1.5 text-xs text-[#A32A2A]">{pesan}</p>}

      {hasil && hasil.length > 0 && (
        <ul className="mt-1.5 divide-y divide-[#E7E3D8] overflow-hidden rounded-xl border border-[#E7E3D8] bg-white">
          {hasil.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p)}
                className="flex min-h-11 w-full items-center px-3 text-left text-sm font-medium text-[#14201A] hover:bg-[#F6F4EE]">
                {p.nama}
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasil && hasil.length === 0 && !cari && (
        <p className="mt-1.5 text-xs text-[#5F6B63]">
          Nama tidak ditemukan. Isi nama lengkap di bawah untuk mendaftar sebagai tamu.
        </p>
      )}
    </div>
  );
}
