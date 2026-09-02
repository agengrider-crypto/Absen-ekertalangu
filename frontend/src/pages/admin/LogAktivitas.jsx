import { useEffect, useState } from "react";
import { ScrollText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { ACTION_LABELS, formatDateTime } from "./adminUtils";

const ACTION_COLORS = {
  login: "bg-[#E0F2FE] text-[#075985]",
  buat_akun: "bg-[#E8F5EE] text-[#065F46]",
  hapus_akun: "bg-[#FEE2E2] text-[#991B1B]",
  hapus_massal: "bg-[#FEE2E2] text-[#991B1B]",
  reset_sandi: "bg-[#FEF3C7] text-[#92400E]",
  pindah_sambung: "bg-[#EDE9FE] text-[#5B21B6]",
};

export default function LogAktivitas() {
  const [logs, setLogs] = useState(null);

  const load = () =>
    api.get("/admin/logs?limit=200")
      .then(({ data }) => setLogs(data))
      .catch((e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)));

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-[#0D5C3A] font-bold text-lg">
          <ScrollText size={20} /> Log Aktivitas
        </div>
        <button
          data-testid="button-refresh-logs"
          onClick={load}
          className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border border-[#E5E7EB] bg-white text-[#4B5563] font-semibold text-sm hover:border-[#0D5C3A] hover:text-[#0D5C3A]"
        >
          <RefreshCw size={16} /> Muat Ulang
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden" data-testid="logs-panel">
        {!logs ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0D5C3A]" size={28} /></div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-[#6B7280]">Belum ada aktivitas tercatat.</div>
        ) : (
          <ul className="divide-y divide-[#E5E7EB]">
            {logs.map((l) => (
              <li key={l.id} data-testid={`log-row-${l.id}`} className="px-5 py-3.5 flex items-start gap-3">
                <span className={`shrink-0 mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[l.action] || "bg-[#F2F5F2] text-[#4B5563]"}`}>
                  {ACTION_LABELS[l.action] || l.action}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[#111827]">{l.detail || "-"}</div>
                  <div className="text-xs text-[#9CA3AF] mt-0.5">
                    oleh <span className="font-medium text-[#6B7280]">{l.actor_name || "Sistem"}</span> · {formatDateTime(l.at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
