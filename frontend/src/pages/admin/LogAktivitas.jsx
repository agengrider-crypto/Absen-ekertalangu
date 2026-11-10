import { useEffect, useState } from "react";
import { ScrollText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { ACTION_LABELS, formatDateTime } from "./adminUtils";

const ACTION_COLORS = {
  login: "bg-[#D9F2F4] text-[#1D4F91]",
  buat_akun: "bg-[#E3F3EA] text-[#0E4E31]",
  hapus_akun: "bg-[#FBE5E3] text-[#A32A2A]",
  hapus_massal: "bg-[#FBE5E3] text-[#A32A2A]",
  reset_sandi: "bg-[#FBF1D6] text-[#6B4500]",
  pindah_sambung: "bg-[#ECE4FB] text-[#4C2A9B]",
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
        <div className="flex items-center gap-2 text-[#0E4E31] font-bold text-lg">
          <ScrollText size={20} /> Log Aktivitas
        </div>
        <button
          data-testid="button-refresh-logs"
          onClick={load}
          className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border border-[#E7E3D8] bg-white text-[#5F6B63] font-semibold text-sm hover:border-[#14633F] hover:text-[#0E4E31]"
        >
          <RefreshCw size={16} /> Muat Ulang
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden" data-testid="logs-panel">
        {!logs ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={28} /></div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-[#5F6B63]">Belum ada aktivitas tercatat.</div>
        ) : (
          <ul className="divide-y divide-[#E7E3D8]">
            {logs.map((l) => (
              <li key={l.id} data-testid={`log-row-${l.id}`} className="px-5 py-3.5 flex items-start gap-3">
                <span className={`shrink-0 mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${ACTION_COLORS[l.action] || "bg-[#F0EEE6] text-[#5F6B63]"}`}>
                  {ACTION_LABELS[l.action] || l.action}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-[#14201A]">{l.detail || "-"}</div>
                  <div className="text-xs text-[#5F6B63] mt-0.5">
                    oleh <span className="font-medium text-[#5F6B63]">{l.actor_name || "Sistem"}</span> · {formatDateTime(l.at)}
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
