import axios from "axios";

// Base URL backend.
// - Sandbox / dev: pakai REACT_APP_BACKEND_URL dari .env
// - Produksi Vercel (1 project, frontend + backend satu domain): variabel tidak
//   diset, sehingga base menjadi relatif ("/api") dan otomatis bebas CORS.
const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
  // FASE 8: batas waktu jelas supaya permintaan tidak menggantung selamanya
  // saat jaringan lemah / fungsi serverless Vercel baru "bangun" (cold start).
  timeout: 25000,
});

/**
 * FASE 8 — Koneksi lebih stabil di Vercel.
 *
 * Permintaan GET yang gagal karena jaringan/timeout (bukan error dari server)
 * dicoba ulang otomatis maksimal 2x dengan jeda singkat. Ini mengatasi keluhan
 * "loading agak lama" pada permintaan pertama setelah aplikasi lama tidak dibuka.
 */
const MAX_RETRY = 2;

/**
 * Indikator "loading" global.
 *
 * Setiap permintaan ke server menaikkan penghitung; komponen GlobalLoading
 * menampilkan bar + tulisan "Memuat…" bila ada permintaan yang tertunda
 * lebih dari sekejap (mis. laporan, absen, rekap saat jaringan lambat).
 */
let pending = 0;

function emitPending() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("api-pending", { detail: pending }));
}

export function apiPendingCount() {
  return pending;
}

api.interceptors.request.use((cfg) => {
  pending += 1;
  emitPending();
  return cfg;
});

api.interceptors.response.use(
  (res) => {
    pending = Math.max(0, pending - 1);
    emitPending();
    return res;
  },
  (error) => {
    pending = Math.max(0, pending - 1);
    emitPending();
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const cfg = error.config || {};
    const isNetwork = !error.response;
    const method = (cfg.method || "get").toLowerCase();
    const retriable = isNetwork && method === "get" && !cfg.__noRetry;
    cfg.__retryCount = cfg.__retryCount || 0;
    if (retriable && cfg.__retryCount < MAX_RETRY) {
      cfg.__retryCount += 1;
      const wait = 600 * cfg.__retryCount;
      await new Promise((r) => setTimeout(r, wait));
      return api(cfg);
    }
    return Promise.reject(error);
  },
);

export function formatApiErrorDetail(detail) {
  if (detail == null) return "Terjadi kesalahan. Silakan coba lagi.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

/** Pesan ramah saat perangkat sedang offline / jaringan bermasalah. */
export function isOfflineError(error) {
  return !error?.response || error?.code === "ECONNABORTED";
}
