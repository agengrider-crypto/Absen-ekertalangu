import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";

const ROLES = ["admin", "pengurus", "peserta"];

export default function HakAkses({ currentUserId }) {
  const [users, setUsers] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [draft, setDraft] = useState({});

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

  return (
    <div>
      <div className="flex items-center gap-2 text-[#0D5C3A] font-bold text-lg mb-1">
        <ShieldCheck size={20} /> Hak Akses
      </div>
      <p className="text-sm text-[#6B7280] mb-4">Atur peran (role) untuk akun yang sudah aktif. Peran menentukan menu yang bisa diakses.</p>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden" data-testid="hakakses-panel">
        {!users ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={28} /></div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-[#6B7280]">Belum ada akun aktif.</div>
        ) : (
          <ul className="divide-y divide-[#E5E7EB]">
            {users.map((u) => {
              const set = draft[u.id] || new Set();
              const changed = Array.from(set).sort().join(",") !== [...u.roles].sort().join(",");
              return (
                <li key={u.id} data-testid={`hakakses-row-${u.id}`} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#111827] truncate">{u.name}</div>
                    <div className="text-sm text-[#6B7280] truncate">{u.email || u.phone || "-"}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ROLES.map((r) => {
                      const on = set.has(r);
                      const disabled = u.id === currentUserId && r === "admin";
                      return (
                        <label key={r} data-testid={`role-toggle-${u.id}-${r}`}
                          className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border-2 capitalize font-semibold text-sm transition-colors ${on ? "border-[#0D5C3A] bg-[#E8F5EE] text-[#065F46]" : "border-[#E5E7EB] text-[#6B7280]"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                          <input type="checkbox" className="accent-[#0D5C3A]" checked={on} disabled={disabled} onChange={() => toggle(u.id, r)} />
                          {r}
                        </label>
                      );
                    })}
                    <button
                      data-testid={`button-save-roles-${u.id}`}
                      onClick={() => save(u.id)}
                      disabled={!changed || savingId === u.id}
                      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#0D5C3A] text-white font-semibold text-sm hover:bg-[#094229] disabled:opacity-40"
                    >
                      {savingId === u.id ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} Simpan
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
