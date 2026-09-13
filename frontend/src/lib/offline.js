import { useCallback, useEffect, useRef, useState } from "react";

/**
 * FASE 8 — MODE OFFLINE untuk absensi.
 *
 * Saat sinyal internet hilang, absen yang ditandai petugas TIDAK hilang:
 * disimpan dulu di penyimpanan lokal perangkat (localStorage) sebagai antrean,
 * lalu dikirim otomatis ke server begitu koneksi kembali.
 */

const PREFIX = "ekertalangu_offline_";

function key(scope) {
  return `${PREFIX}${scope}`;
}

export function loadQueue(scope) {
  try {
    const raw = localStorage.getItem(key(scope));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveQueue(scope, items) {
  try {
    localStorage.setItem(key(scope), JSON.stringify(items || []));
  } catch {
    /* penyimpanan penuh / mode privat — abaikan */
  }
}

export function clearQueue(scope) {
  try {
    localStorage.removeItem(key(scope));
  } catch {
    /* abaikan */
  }
}

/** Tambah / ganti antrean untuk 1 peserta (status terakhir yang menang). */
export function enqueueMark(scope, item) {
  const items = loadQueue(scope).filter((i) => i.user_id !== item.user_id);
  items.push(item);
  saveQueue(scope, items);
  return items;
}

/** Status koneksi perangkat (reaktif). */
export function useOnline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}

/**
 * Antrean absen offline + sinkronisasi otomatis.
 *
 * @param scope  kunci unik penyimpanan (mis. `absensi_<token>`)
 * @param sender async (items) => void  — pengirim batch ke server
 * @param onSynced (jumlah) => void     — dipanggil setelah sinkron berhasil
 */
export function useOfflineQueue(scope, sender, onSynced) {
  const [queue, setQueue] = useState(() => loadQueue(scope));
  const [syncing, setSyncing] = useState(false);
  const online = useOnline();
  const senderRef = useRef(sender);
  const syncedRef = useRef(onSynced);
  senderRef.current = sender;
  syncedRef.current = onSynced;

  const flush = useCallback(async () => {
    const items = loadQueue(scope);
    if (!items.length) return { applied: 0 };
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { applied: 0 };
    setSyncing(true);
    try {
      await senderRef.current(items);
      clearQueue(scope);
      setQueue([]);
      if (syncedRef.current) syncedRef.current(items.length);
      return { applied: items.length };
    } catch {
      // Gagal: antrean tetap disimpan untuk dicoba lagi nanti.
      return { applied: 0, failed: true };
    } finally {
      setSyncing(false);
    }
  }, [scope]);

  // Begitu koneksi kembali → langsung sinkron.
  useEffect(() => {
    if (online) flush();
  }, [online, flush]);

  const add = useCallback((item) => {
    setQueue(enqueueMark(scope, { ...item, marked_at: new Date().toISOString() }));
  }, [scope]);

  const statusMap = {};
  queue.forEach((q) => { statusMap[q.user_id] = q.status; });

  return { queue, pending: queue.length, statusMap, online, syncing, add, flush };
}
