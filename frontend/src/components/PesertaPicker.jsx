// FASE 18 — Mode ceklis: memilih peserta TERTENTU untuk sebuah kegiatan.
import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, CheckCircle2, Users, ChevronDown } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";

export default function PesertaPicker({ value = [], onChange, testid = "peserta-picker" }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api.get("/admin/users")
      .then(({ data }) => {
        setRows((data || []).filter((u) => (u.roles || []).includes("peserta")));
        setLoadError("");
      })
      .catch((error) => {
        const message = formatApiErrorDetail(error?.response?.data?.detail);
        setLoadError(message);
        setRows([]);
        toast.error(message);
      });
  }, []);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = rows || [];
    return t ? base.filter((u) => (u.name || "").toLowerCase().includes(t)) : base;
  }, [rows, q]);

  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const allShownIds = list.map((u) => u.id);
  const allShownChecked = allShownIds.length > 0 && allShownIds.every((id) => value.includes(id));
  const selectedNames = (rows || []).filter((user) => value.includes(user.id)).map((user) => user.name);

  return (
    <div className="relative">
      <button type="button" aria-expanded={open} aria-controls={`${testid}-dropdown`}
        data-testid={testid}
        onClick={() => setOpen((visible) => !visible)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border-2 border-[#E7E3D8] bg-white px-3 text-left text-sm font-semibold text-[#14201A] hover:border-[#14633F]">
        <Users size={16} className="shrink-0 text-[#5F6B63]" />
        <span className="min-w-0 flex-1 truncate">
          {value.length ? `${value.length} peserta dipilih${selectedNames.length ? ` · ${selectedNames.slice(0, 2).join(", ")}` : ""}` : "Pilih peserta"}
        </span>
        {rows === null && <Loader2 className="animate-spin text-[#0E4E31]" size={16} />}
        <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id={`${testid}-dropdown`} className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border-2 border-[#E7E3D8] bg-white p-2 shadow-xl">
          <div className="mb-2 flex flex-wrap gap-2">
            <button type="button" data-testid={`${testid}-toggle-all`}
              onClick={() => onChange(allShownChecked
                ? value.filter((id) => !allShownIds.includes(id))
                : Array.from(new Set([...value, ...allShownIds])))}
              className="min-h-10 rounded-lg border border-[#E7E3D8] px-3 text-xs font-semibold text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]">
              {allShownChecked ? "Lepas semua" : "Centang semua"}
            </button>
            {value.length > 0 && (
              <button type="button" data-testid={`${testid}-clear`} onClick={() => onChange([])}
                className="min-h-10 rounded-lg border border-[#FBE5E3] px-3 text-xs font-semibold text-[#A32A2A] hover:bg-[#FBE5E3]">
                Kosongkan
              </button>
            )}
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
            <input data-testid={`${testid}-search`} value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama peserta…"
              className="h-11 w-full rounded-xl border border-[#8A948D] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#14633F]" />
          </div>
          {rows === null ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-[#0E4E31]" size={22} /></div>
          ) : (
            <div className="mt-2 max-h-56 divide-y divide-[#F0EEE6] overflow-y-auto rounded-xl border border-[#E7E3D8] bg-white">
              {loadError ? (
                <div role="alert" className="px-3 py-6 text-center text-sm text-[#A32A2A]">{loadError}</div>
              ) : list.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-[#5F6B63]">Tidak ada peserta.</div>
              ) : list.map((u) => {
                const on = value.includes(u.id);
                return (
                  <label key={u.id} data-testid={`${testid}-row-${u.id}`}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2.5 ${on ? "bg-[#E3F3EA]" : "hover:bg-[#F6F4EE]"}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(u.id)} className="h-4 w-4 accent-[#14633F]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#14201A]">{u.name}</span>
                      <span className="block text-[11px] text-[#5F6B63]">
                        {u.gender === "L" ? "Laki-laki" : u.gender === "P" ? "Perempuan" : "—"}
                        {u.status === "pending" ? " · belum aktivasi" : ""}
                      </span>
                    </span>
                    {on && <CheckCircle2 size={16} className="shrink-0 text-[#0E4E31]" />}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
