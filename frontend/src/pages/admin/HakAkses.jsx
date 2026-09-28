// FASE 15 — Hak Akses berbasis pencarian: cari jamaah, lalu beri/cabut peran admin & pengurus.
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Loader2, Save, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

const ROLES = ["admin", "pengurus", "peserta"];

function RoleRow({ u, currentUserId, draft, onToggle, onSave, saving }) {
  const set = draft || new Set();
  const changed = Array.from(set).sort().join(",") !== [...u.roles].sort().join(",");
  return (
    <li data-testid={`hakakses-row-${u.id}`} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="min-w-0">
        <div className="font-semibold text-[#111827] truncate inline-flex items-center gap-1.5">
          <UserRound size={15} className="text-[#111114]" /> {u.name}
        </div>
        <div className="text-sm text-[#6B7280] truncate">{u.email || u.phone || "-"} · peran saat ini: {u.roles.join(", ")}</div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {ROLES.map((r) => {
          const on = set.has(r);
          const disabled = u.id === currentUserId && r === "admin";
          return (
            <label key={r} data-testid={`role-toggle-${u.id}-${r}`}
              className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border-2 capitalize font-semibold text-sm transition-colors ${on ? "border-[#111114] bg-[#F1F1EE] text-[#111114]" : "border-[#E8E8E4] text-[#6B7280]"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
              <input type="checkbox" className="accent-[#111114]" checked={on} disabled={disabled} onChange={() => onToggle(u.id, r)} />
              {r}
            </label>
          );
        })}
        <button
          data-testid={`button-save-roles-${u.id}`}
          onClick={() => onSave(u.id)}
          disabled={!changed || saving}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#111114] text-white font-semibold text-sm hover:bg-[#000000] disabled:opacity-40"
        >
          {saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Simpan
        </button>
      </div>
    </li>
  );
}

export default function HakAkses({ currentUserId }) {
  const [users, setUsers] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [draft, setDraft] = useState({});
  const [q, setQ] = useState("");

  const load = () =>
    api.get("/admin/users")
      .then(({ data }) => {
        const active = data.filter((u) => u.status === "active");
        setUsers(active);
        const d = {};
        active.forEach((u) => { d[u.id] = new Set(u.roles); });
        setDraft(d);
      })
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));

  useEffect(() => { load(); }, []);

  const toggle = (uid, role) => {
    setDraft((prev) => {
      const next = new Set(prev[uid]);
      if (next.has(role)) next.delete(role); else next.add(role);
      return { ...prev, [uid]: next };
    });
  };

  const save = async (uid) => {
    const roles = Array.from(draft[uid] || []);
    if (roles.length === 0) { toast.error("Pilih minimal satu peran"); return; }
    setSavingId(uid);
    try {
      await api.patch(`/admin/users/${uid}/roles`, { roles });
      toast.success("Hak akses diperbarui");
      load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSavingId(null);
    }
  };

  const hasil = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!users || t.length < 2) return [];
    return users.filter((u) =>
      (u.name || "").toLowerCase().includes(t) ||
      (u.phone || "").toLowerCase().includes(t) ||
      (u.email || "").toLowerCase().includes(t)).slice(0, 25);
  }, [users, q]);

  const berhak = useMemo(
    () => (users || []).filter((u) => u.roles?.includes("admin") || u.roles?.includes("pengurus")),
    [users],
  );

  return (
    <div>
      <div className="flex items-center gap-2 text-[#111114] font-bold text-lg mb-1">
        <ShieldCheck size={20} /> Hak Akses
      </div>
      <p className="text-sm text-[#6B7280] mb-4">
        Cari nama jamaah yang akan diberi/dicabut hak akses. Daftar pemegang hak akses saat ini tampil di bawah.
      </p>

      <div className="relative mb-4">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          data-testid="hakakses-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama, No. HP, atau email (minimal 2 huruf)…"
          className="w-full h-12 pl-11 pr-4 rounded-xl border-2 border-[#E8E8E4] text-base outline-none focus:border-[#111114] bg-white"
        />
      </div>

      {!users ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#111114]" size={28} /></div>
      ) : (
        <>
          {q.trim().length >= 2 && (
            <div className="bg-white rounded-2xl border border-[#E8E8E4] overflow-hidden mb-6" data-testid="hakakses-hasil">
              <div className="px-5 py-3 border-b border-[#E8E8E4] text-sm font-semibold text-[#374151]">
                Hasil pencarian ({hasil.length})
              </div>
              {hasil.length === 0 ? (
                <div className="p-8 text-center text-[#6B7280]">Tidak ada akun aktif yang cocok.</div>
              ) : (
                <ul className="divide-y divide-[#E8E8E4]">
                  {hasil.map((u) => (
                    <RoleRow key={u.id} u={u} currentUserId={currentUserId} draft={draft[u.id]}
                      onToggle={toggle} onSave={save} saving={savingId === u.id} />
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-[#E8E8E4] overflow-hidden" data-testid="hakakses-panel">
            <div className="px-5 py-3 border-b border-[#E8E8E4] text-sm font-semibold text-[#374151]">
              Pemegang hak akses saat ini ({berhak.length})
            </div>
            {berhak.length === 0 ? (
              <div className="p-8 text-center text-[#6B7280]">Belum ada admin/pengurus.</div>
            ) : (
              <ul className="divide-y divide-[#E8E8E4]">
                {berhak.map((u) => (
                  <RoleRow key={u.id} u={u} currentUserId={currentUserId} draft={draft[u.id]}
                    onToggle={toggle} onSave={save} saving={savingId === u.id} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
