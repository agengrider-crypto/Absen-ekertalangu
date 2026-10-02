// FASE 18 — Mode ceklis: memilih peserta TERTENTU untuk sebuah kegiatan.
import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, CheckCircle2, Users } from "lucide-react";
import { api } from "@/lib/api";

export default function PesertaPicker({ value = [], onChange, testid = "peserta-picker" }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/admin/users")
      .then(({ data }) => setRows((data || []).filter((u) => (u.roles || []).includes("peserta"))))
      .catch(() => setRows([]));
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

  return (
    <div className="space-y-2" data-testid={testid}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-semibold text-[#4B5563] inline-flex items-center gap-1.5">
          <Users size={14} /> {value.length} peserta dicentang
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            data-testid={`${testid}-toggle-all`}
            onClick={() => onChange(allShownChecked
              ? value.filter((id) => !allShownIds.includes(id))
              : Array.from(new Set([...value, ...allShownIds])))}
            className="h-8 px-2.5 rounded-lg border border-[#E8E8E4] text-xs font-semibold text-[#4B5563] hover:border-[#111114] hover:text-[#111114]"
          >
            {allShownChecked ? "Lepas semua" : "Centang semua"}
          </button>
          {value.length > 0 && (
            <button type="button" data-testid={`${testid}-clear`} onClick={() => onChange([])}
              className="h-8 px-2.5 rounded-lg border border-[#FECACA] text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2]">
              Kosongkan
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          data-testid={`${testid}-search`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama peserta…"
          className="w-full h-11 pl-9 pr-3 rounded-xl border-2 border-[#E8E8E4] text-sm outline-none focus:border-[#111114] bg-white"
        />
      </div>

      {rows === null ? (
        <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={22} /></div>
      ) : (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-[#E8E8E4] divide-y divide-[#F3F4F6] bg-white">
          {list.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-[#9CA3AF]">Tidak ada peserta.</div>
          ) : list.map((u) => {
            const on = value.includes(u.id);
            return (
              <label
                key={u.id}
                data-testid={`${testid}-row-${u.id}`}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${on ? "bg-[#F1F1EE]" : "hover:bg-[#FAFAF8]"}`}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(u.id)} className="h-4 w-4 accent-[#111114]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[#111827] truncate">{u.name}</span>
                  <span className="block text-[11px] text-[#9CA3AF]">
                    {u.gender === "L" ? "Laki-laki" : u.gender === "P" ? "Perempuan" : "—"}
                    {u.status === "pending" ? " · belum aktivasi" : ""}
                  </span>
                </span>
                {on && <CheckCircle2 size={16} className="text-[#111114] shrink-0" />}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
