// Status pemeliharaan (Layar 32).
// Sumber kebenaran = server (`GET /api/maintenance`). Cache hanya untuk tampilan
// awal; status selalu diambil ulang saat aplikasi dibuka dan saat kembali fokus.
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const CACHE_KEY = "ekertalangu.maintenanceState";
const POLL_MS = 60_000;

/** Keadaan awal dari cache (supaya tidak berkedip saat aplikasi dibuka). */
export function cachedMaintenance() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveCache(state) {
  try {
    if (state) localStorage.setItem(CACHE_KEY, JSON.stringify(state));
    else localStorage.removeItem(CACHE_KEY);
  } catch { /* abaikan */ }
}

/** Ambil status pemeliharaan terbaru dari server. */
export async function fetchMaintenance() {
  try {
    const { data } = await api.get("/maintenance");
    saveCache(data);
    return data;
  } catch {
    return cachedMaintenance();
  }
}

/**
 * Hook status pemeliharaan.
 * Mengambil ulang saat mount, saat tab kembali fokus, dan tiap 60 detik.
 */
export function useMaintenance() {
  const [state, setState] = useState(() => cachedMaintenance());
  const [loading, setLoading] = useState(!cachedMaintenance());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const next = await fetchMaintenance();
      if (!alive) return;
      setState(next);
      setLoading(false);
    };
    load();
    const iv = setInterval(load, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      alive = false;
      clearInterval(iv);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return {
    state: state?.state || "none",
    ongoing: state?.state === "ongoing",
    scheduled: state?.state === "scheduled",
    endAt: state?.endAt || null,
    startAt: state?.startAt || null,
    message: state?.message || "",
    loading,
    refresh: async () => {
      const next = await fetchMaintenance();
      setState(next);
      return next;
    },
  };
}

/** Format ISO → "Senin, 3 November, pukul 21.00" (WITA). */
export function formatWita(iso, { withDay = true, withDate = true } = {}) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const opts = { timeZone: "Asia/Makassar" };
  const parts = [];
  if (withDay) parts.push(d.toLocaleDateString("id-ID", { ...opts, weekday: "long" }));
  if (withDate) parts.push(d.toLocaleDateString("id-ID", { ...opts, day: "numeric", month: "long" }));
  return parts.join(", ");
}

/** Format ISO → "21.00" (WITA). */
export function jamWita(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit",
  }).replace(":", ".");
}
