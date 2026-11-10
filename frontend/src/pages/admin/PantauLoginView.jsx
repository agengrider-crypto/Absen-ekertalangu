import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MonitorSmartphone, Loader2, Search, RefreshCw, Smartphone, Monitor, Tablet, HelpCircle,
  UserX, Users, LogIn, CalendarDays, X, AlertTriangle, ChevronRight, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/api";
import { genderLabel } from "./adminUtils";

/* ---------- util ---------- */
export function fmtLoginTime(iso, withDate = true) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    const opts = withDate
      ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" }
      : { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Makassar" };
    return d.toLocaleString("id-ID", opts);
  } catch { return iso; }
}

export function relTime(iso) {
  if (!iso) return "belum pernah";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} hari lalu`;
  return fmtLoginTime(iso);
}

export function DeviceIcon({ kind, size = 16, className = "" }) {
  const I = kind === "hp" ? Smartphone : kind === "tablet" ? Tablet : kind === "komputer" ? Monitor : HelpCircle;
  return <I size={size} className={className} />;
}

export function RoleBadges({ roles }) {
  const meta = { admin: "bg-[#FBF1D6] text-[#6B4500]", pengurus: "bg-[#D9F2F4] text-[#1D4F91]", peserta: "bg-[#E3F3EA] text-[#0E4E31]" };
  return (
    <span className="inline-flex gap-1 flex-wrap">
      {(roles || []).map((r) => <span key={r} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${meta[r] || "bg-[#F0EEE6] text-[#5F6B63]"}`}>{r}</span>)}
    </span>
  );
}

function todayYmd() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/* ---------- halaman ---------- */
export default function PantauLoginView() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tab, setTab] = useState("terbaru"); // terbaru | belum
  const [detailId, setDetailId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setData(null);
    setRefreshing(true);
    setErr("");
    try {
      const p = new URLSearchParams();
      if (dateFrom) p.set("date_from", dateFrom);
      if (dateTo) p.set("date_to", dateTo);
      if (q.trim()) p.set("q", q.trim());
      p.set("limit", "500");
      const { data: d } = await api.get(`/staff/login-monitor?${p.toString()}`);
      setData(d);
    } catch (e) {
      setErr(formatApiErrorDetail(e.response?.data?.detail) || "Gagal memuat data login");
      if (!silent) setData(false);
    } finally { setRefreshing(false); }
  }, [dateFrom, dateTo, q]);

  useEffect(() => {
    const t = setTimeout(() => load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  // auto-refresh tiap 60 detik agar pantauan tetap segar
  useEffect(() => {
    const iv = setInterval(() => load(true), 60000);
    return () => clearInterval(iv);
  }, [load]);

  const never = useMemo(() => {
    if (!data) return [];
    const t = q.trim().toLowerCase();
    return t ? data.never_logged_in.filter((u) => (u.name || "").toLowerCase().includes(t)) : data.never_logged_in;
  }, [data, q]);

  const quick = (key) => {
    const t = todayYmd();
    if (key === "hari-ini") { setDateFrom(t); setDateTo(t); }
    else if (key === "7-hari") {
      const d = new Date(); d.setDate(d.getDate() - 6);
      setDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`); setDateTo(t);
    } else { setDateFrom(""); setDateTo(""); }
  };

  const s = data?.summary;
  const maxTren = Math.max(1, ...((data?.tren || []).map((x) => x.users)));

  return (
    <div data-testid="pantau-login-view">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-[#0E4E31] font-bold text-lg">
          <MonitorSmartphone size={20} /> Pantau Login
        </div>
        <button data-testid="pantau-refresh" onClick={() => load(true)} disabled={refreshing}
          className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl border-2 border-[#E7E3D8] bg-white text-[#5F6B63] font-semibold text-sm hover:border-[#14633F] hover:text-[#0E4E31] disabled:opacity-60">
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Muat ulang
        </button>
      </div>

      {data === null ? (
        <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={30} /></div>
      ) : data === false ? (
        <div className="bg-white rounded-2xl border border-[#E7E3D8] p-10 text-center">
          <p className="text-sm text-[#A32A2A] mb-3" data-testid="pantau-error">{err}</p>
          <button onClick={() => load()} className="h-10 px-4 rounded-xl border-2 border-[#14633F] text-[#0E4E31] font-semibold text-sm">Coba lagi</button>
        </div>
      ) : (
        <>
          {/* Ringkasan */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4" data-testid="pantau-summary">
            <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4">
              <div className="flex items-center gap-2 text-[#5F6B63] text-xs font-semibold"><LogIn size={14} /> Login hari ini</div>
              <div className="text-2xl font-bold text-[#14201A] mt-1">{s.today_logins}</div>
              <div className="text-xs text-[#5F6B63]">{s.today_users} akun berbeda</div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4">
              <div className="flex items-center gap-2 text-[#5F6B63] text-xs font-semibold"><Users size={14} /> Peserta pernah login</div>
              <div className="text-2xl font-bold text-[#0E4E31] mt-1">{s.sudah_login} <span className="text-sm font-semibold text-[#5F6B63]">/ {s.total_peserta}</span></div>
              <div className="text-xs text-[#5F6B63]">{s.ratio_login}% dari seluruh peserta</div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4">
              <div className="flex items-center gap-2 text-[#5F6B63] text-xs font-semibold"><UserX size={14} /> Belum pernah login</div>
              <div className="text-2xl font-bold text-[#8A5A00] mt-1">{s.belum_login}</div>
              <div className="text-xs text-[#5F6B63]">perlu didampingi masuk aplikasi</div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4">
              <div className="flex items-center gap-2 text-[#5F6B63] text-xs font-semibold"><CalendarDays size={14} /> 7 hari terakhir (akun/hari)</div>
              <div className="flex items-end gap-1 h-12 mt-2" data-testid="pantau-tren">
                {(data.tren || []).map((x) => (
                  <div key={x.date} className="flex-1 flex flex-col items-center gap-0.5" title={`${x.date}: ${x.users} akun, ${x.logins} login`}>
                    <div className="w-full rounded-t bg-[#14633F]/80" style={{ height: `${Math.max(6, (x.users / maxTren) * 40)}px` }} />
                    <span className="text-[9px] text-[#5F6B63]">{x.date.slice(8)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filter */}
          <div className="bg-white rounded-2xl border border-[#E7E3D8] p-3 mb-4 flex flex-col lg:flex-row gap-2 lg:items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5F6B63]" />
              <input data-testid="pantau-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama peserta..."
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] bg-white" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input data-testid="pantau-date-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="h-11 px-3 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] bg-white" />
              <span className="text-xs text-[#5F6B63]">s/d</span>
              <input data-testid="pantau-date-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="h-11 px-3 rounded-xl border border-[#8A948D] text-sm outline-none focus:border-[#14633F] bg-white" />
              {[["hari-ini", "Hari ini"], ["7-hari", "7 hari"], ["semua", "Semua"]].map(([k, l]) => (
                <button key={k} type="button" data-testid={`pantau-quick-${k}`} onClick={() => quick(k)}
                  className="h-9 px-3 rounded-full border-2 border-[#E7E3D8] bg-white text-xs font-semibold text-[#5F6B63] hover:border-[#14633F] hover:text-[#0E4E31]">{l}</button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-3">
            <button data-testid="pantau-tab-terbaru" onClick={() => setTab("terbaru")}
              className={`h-10 px-4 rounded-xl font-semibold text-sm border-2 inline-flex items-center gap-2 ${tab === "terbaru" ? "bg-[#14633F] text-white border-transparent" : "bg-white text-[#5F6B63] border-[#E7E3D8] hover:border-[#14633F]"}`}>
              <LogIn size={15} /> Login Terbaru <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === "terbaru" ? "bg-white/25" : "bg-[#F0EEE6]"}`}>{data.events.length}</span>
            </button>
            <button data-testid="pantau-tab-belum" onClick={() => setTab("belum")}
              className={`h-10 px-4 rounded-xl font-semibold text-sm border-2 inline-flex items-center gap-2 ${tab === "belum" ? "bg-[#8A5A00] text-white border-transparent" : "bg-white text-[#5F6B63] border-[#E7E3D8] hover:border-[#8A5A00]"}`}>
              <UserX size={15} /> Belum Pernah Login <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === "belum" ? "bg-white/25" : "bg-[#F0EEE6]"}`}>{never.length}</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden">
            {tab === "terbaru" ? (
              data.events.length === 0 ? (
                <div className="p-10 text-center text-[#5F6B63] text-sm">Belum ada login pada periode / pencarian ini.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="pantau-table">
                    <thead>
                      <tr className="bg-[#F6F4EE] text-[#5F6B63] text-left">
                        <th className="px-4 py-3 font-semibold">Nama</th>
                        <th className="px-4 py-3 font-semibold">Waktu (WITA)</th>
                        <th className="px-4 py-3 font-semibold hidden sm:table-cell">Perangkat</th>
                        <th className="px-4 py-3 font-semibold hidden lg:table-cell">IP</th>
                        <th className="px-4 py-3 font-semibold hidden md:table-cell">Peran</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E7E3D8]">
                      {data.events.map((e) => (
                        <tr key={e.id} data-testid={`login-event-${e.id}`} className="hover:bg-[#F6F4EE]">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[#14201A] flex items-center gap-1.5">
                              {e.name}
                              {e.is_new_device && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FBF1D6] text-[#6B4500]"><AlertTriangle size={10} /> perangkat baru</span>}
                            </div>
                            <div className="text-xs text-[#5F6B63] sm:hidden inline-flex items-center gap-1"><DeviceIcon kind={e.device?.kind} size={12} /> {e.device?.label || "-"}</div>
                          </td>
                          <td className="px-4 py-3 text-[#5F6B63] whitespace-nowrap">
                            <div className="font-mono text-[13px]">{fmtLoginTime(e.at)}</div>
                            <div className="text-[11px] text-[#5F6B63]">{relTime(e.at)}</div>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell text-[#5F6B63]">
                            <span className="inline-flex items-center gap-1.5"><DeviceIcon kind={e.device?.kind} size={14} className="text-[#0E4E31]" /> {e.device?.label || "-"}</span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-[#5F6B63] font-mono text-xs">{e.ip || "-"}</td>
                          <td className="px-4 py-3 hidden md:table-cell"><RoleBadges roles={e.roles} /></td>
                          <td className="px-4 py-3 text-right">
                            <button data-testid={`login-detail-${e.user_id}`} onClick={() => setDetailId(e.user_id)}
                              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-[#E7E3D8] text-[#0E4E31] font-semibold text-xs hover:border-[#14633F] hover:bg-[#E3F3EA]">
                              Riwayat <ChevronRight size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : never.length === 0 ? (
              <div className="p-10 text-center text-[#0E4E31] text-sm font-semibold" data-testid="pantau-belum-kosong">Semua peserta sudah pernah login.</div>
            ) : (
              <div>
                <div className="px-4 py-3 bg-[#FBF1D6] text-xs text-[#6B4500] border-b border-[#EAD596]">
                  Peserta berikut belum pernah masuk aplikasi. Bantu mereka lewat <b>Aktivasi Akun</b> atau bagikan <b>QR Aktivasi</b> dari Dashboard.
                </div>
                <div className="divide-y divide-[#E7E3D8]" data-testid="pantau-belum-list">
                  {never.map((u) => (
                    <div key={u.id} data-testid={`never-login-${u.id}`} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[#14201A] truncate">{u.name}</div>
                        <div className="text-xs text-[#5F6B63]">{genderLabel(u.gender)} · {u.phone || "-"}</div>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${u.status === "pending" ? "bg-[#FBF1D6] text-[#6B4500]" : "bg-[#F0EEE6] text-[#5F6B63]"}`}>
                        {u.status === "pending" ? "Belum aktivasi" : "Aktif, belum login"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {detailId && <LoginDetailModal userId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

/* ---------- detail per peserta ---------- */
export function LoginDetailModal({ userId, onClose }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get(`/staff/login-monitor/user/${userId}`)
      .then(({ data }) => setD(data))
      .catch((e) => { setErr(formatApiErrorDetail(e.response?.data?.detail) || "Gagal memuat"); toast.error("Gagal memuat riwayat login"); });
  }, [userId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[rgba(20,32,26,0.5)] p-0 sm:p-4" onClick={onClose}>
      <div className="bg-[#F6F4EE] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()} data-testid="modal-login-detail">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-[#E7E3D8] px-5 py-3.5 flex items-center justify-between z-10">
          <h2 className="font-heading font-bold text-[#14201A]">Riwayat Login</h2>
          <button onClick={onClose} className="h-9 w-9 flex items-center justify-center rounded-lg text-[#5F6B63] hover:bg-[#F0EEE6]" data-testid="modal-login-detail-close"><X size={20} /></button>
        </div>
        <div className="p-5">
          {err ? <p className="text-sm text-[#A32A2A]">{err}</p> : !d ? (
            <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-[#0E4E31]" size={26} /></div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-[#E7E3D8] p-4">
                <div className="font-bold text-[#14201A] text-lg">{d.user.name}</div>
                <div className="text-xs text-[#5F6B63] mt-0.5 flex items-center gap-2 flex-wrap">{d.user.phone || "-"} <RoleBadges roles={d.user.roles} /></div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="rounded-xl bg-[#E3F3EA] p-3"><div className="text-xl font-bold text-[#0E4E31]">{d.user.login_count}</div><div className="text-xs text-[#5F6B63]">Total login</div></div>
                  <div className="rounded-xl bg-[#F0EEE6] p-3"><div className="text-sm font-bold text-[#14201A]">{relTime(d.user.last_login_at)}</div><div className="text-xs text-[#5F6B63]">Login terakhir · {d.user.last_login_device || "-"}</div></div>
                </div>
                {d.devices.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-[#5F6B63] mb-1.5">Perangkat yang dipakai</div>
                    <div className="flex flex-wrap gap-1.5">
                      {d.devices.map((x) => <span key={x.label} className="text-xs font-semibold px-2 py-1 rounded-full bg-[#F0EEE6] text-[#14201A]">{x.label} · {x.count}x</span>)}
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-[#E7E3D8] overflow-hidden">
                <div className="px-4 py-2.5 text-xs font-semibold text-[#5F6B63] bg-[#F6F4EE] inline-flex items-center gap-1.5 w-full"><Clock size={13} /> {d.events.length} login terakhir</div>
                <div className="divide-y divide-[#E7E3D8] max-h-[40vh] overflow-y-auto">
                  {d.events.length === 0 ? <div className="p-6 text-center text-sm text-[#5F6B63]">Belum pernah login.</div> : d.events.map((e) => (
                    <div key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                      <div className="inline-flex items-center gap-2 text-[#5F6B63] min-w-0">
                        <DeviceIcon kind={e.device?.kind} size={15} className="text-[#0E4E31] shrink-0" />
                        <span className="truncate">{e.device?.label || "-"}</span>
                        {e.is_new_device && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FBF1D6] text-[#6B4500] shrink-0">baru</span>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-mono text-[13px] text-[#14201A]">{fmtLoginTime(e.at)}</div>
                        <div className="text-[10px] text-[#5F6B63] font-mono">{e.ip || ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
