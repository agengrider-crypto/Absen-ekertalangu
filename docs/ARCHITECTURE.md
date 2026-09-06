# Arsitektur & Keputusan Teknis

Dokumen ini menjelaskan **mengapa** sistem dibangun seperti ini, bukan hanya bagaimana.
Setiap keputusan disertai alasan dan konsekuensinya.

---

## 1. Gambaran besar

```
┌──────────────────────────── Vercel (1 project, 1 domain) ────────────────────────────┐
│                                                                                       │
│  Request masuk                                                                        │
│      │                                                                                │
│      ├─ ada file statisnya?  ──ya──►  frontend/build/**  (index.html, static/**, ...) │
│      │                                                                                │
│      └─ tidak ──► rewrites                                                            │
│                     ├─ /api/(.*)  ──►  api/index.py  ──►  backend/server.py (FastAPI) │
│                     └─ /(.*)      ──►  /index.html   (SPA fallback React Router)      │
│                                                                                       │
└───────────────────────────────────────────┬───────────────────────────────────────────┘
                                            │ motor (async driver)
                                            ▼
                                    MongoDB Atlas
```

Tidak ada layanan lain. Tidak ada Redis, tidak ada S3, tidak ada worker, tidak ada
message queue. Ini disengaja — pengguna adalah pengurus masjid yang harus bisa
mengelola sendiri tanpa tim DevOps.

---

## 2. Keputusan besar

### 2.1 Satu project Vercel, bukan dua

**Keputusan:** frontend dan backend dalam satu repo, satu project Vercel, satu domain.

**Alasan:**

| Manfaat | Penjelasan |
|---|---|
| Tanpa CORS | Frontend memanggil `/api` relatif. Tidak ada preflight, tidak ada daftar origin |
| Cookie berjalan mulus | Cookie httpOnly `SameSite=None; Secure` jadi first-party |
| Satu kali deploy | Frontend & backend tidak bisa "beda versi" |
| Satu domain untuk QR | Semua QR mengarah ke domain yang sama |
| Biaya lebih murah | Satu project |

**Konsekuensi:** `vercel.json` harus mengatur routing manual, dan backend harus
tahan kondisi serverless (lihat 2.4).

### 2.2 Konfigurasi Vercel modern, bukan legacy `builds`

**Keputusan:** memakai `buildCommand` + `outputDirectory` + `functions` + `rewrites`.
**Bukan** `builds` + `routes`.

**Alasan:** dengan `builds` + `@vercel/static-build` pada `src: "frontend/package.json"`,
hasil build **tidak dipasang di root deployment** melainkan bersarang di bawah path
folder `src`-nya. Ini pernah menyebabkan produksi balas `404 NOT_FOUND` di `/` dengan
seluruh JS/CSS ikut 404 meski log build sukses.

`outputDirectory` posisinya deterministik: selalu dipasang di root.

**Urutan routing Vercel** yang harus dipahami:

```
1. redirects
2. headers
3. filesystem  ← file statis & function di /api dicek DI SINI
4. rewrites    ← baru di sini SPA fallback bekerja
5. 404
```

Karena `rewrites` dievaluasi **setelah** filesystem, aset statis yang ada selalu
disajikan apa adanya. Jadi **tidak perlu** aturan khusus untuk `/static` — dan aturan
semacam itu justru pernah mematikan seluruh bundel JS.

`rewrites` juga dievaluasi berurutan, jadi `/api/(.*)` yang ditaruh lebih dulu membuat
aturan catch-all `/(.*)` tidak pernah menelan request API. Negative lookahead tidak perlu.

### 2.3 Kode backend tetap di `backend/`, bukan di `api/`

**Keputusan:** `api/index.py` hanya 20 baris — menambah `backend/` ke `sys.path` lalu
`from server import app`. Seluruh logika tetap di `backend/server.py`.

**Alasan:** development lokal/sandbox menjalankan `uvicorn server:app` dari dalam
folder `backend`. Kalau kode dipindah ke `api/`, alur pengembangan lokal rusak.
Pemisahan ini membuat **satu basis kode** berjalan di dua model eksekusi.

`functions["api/index.py"].includeFiles = "backend/**"` memastikan `server.py` ikut
masuk ke bundel lambda.

### 2.4 Serverless: tiga adaptasi wajib

Serverless tidak punya proses yang hidup terus, tidak punya disk yang bisa ditulis,
dan setiap request bisa dilayani instance berbeda.

#### a. Pengganti background scheduler

Kegiatan berstatus `open` harus tertutup sendiri setelah `end_time` (WITA) terlewat.
Semula memakai `while True: ... await asyncio.sleep(60)` — mustahil di serverless.

Penggantinya **tiga lapis**:

| Lapis | Cara kerja |
|---|---|
| 1. Lazy per request | `maybe_auto_close()` dipanggil middleware pada setiap request `/api/*` |
| 2. Throttle in-process | Variabel `_last_auto_close_local` menolak pemanggilan < 60 detik tanpa menyentuh DB |
| 3. Klaim slot lintas instance | `find_one_and_update` atomik pada `app_settings.__auto_close__` dengan syarat `next_at <= now` — hanya satu instance yang menang |

Ditambah **Vercel Cron** harian ke `GET /api/cron/auto-close` (diproteksi `CRON_SECRET`)
sebagai jaring pengaman bila tidak ada trafik sama sekali.

Di server persisten (sandbox/VPS), `auto_close_loop()` yang lama tetap aktif — dipilih
otomatis lewat `IS_SERVERLESS` dan `RUN_SCHEDULER`.

**Konsekuensi:** kegiatan bisa tertutup terlambat maksimal ~60 detik pada instance yang
sedang melayani trafik. Untuk absensi pengajian, ini tidak berdampak.

#### b. Inisialisasi tanpa lifespan

Event `startup` tidak dijamin dipanggil di serverless, dan kalaupun dipanggil akan
berjalan **setiap cold start** — membuat ~20 `create_index` + query seed di jalur kritis.

`ensure_init()` menyelesaikan keduanya:

```
request → bootstrap_middleware → ensure_init()
            ├─ _init_done (flag proses)?           → langsung keluar
            ├─ app_settings.__init__.version cocok? → set flag, keluar (1 query)
            └─ tidak cocok → _run_init() + tulis penanda
```

Idempoten, dilindungi `asyncio.Lock`, dan biaya per cold start hanya satu query.
Naikkan `INIT_VERSION` bila index/seed perlu dijalankan ulang.

#### c. Tanpa filesystem

| Kebutuhan | Cara |
|---|---|
| Foto profil | Di-resize di browser (maks 320px) lalu disimpan sebagai data URL base64 di `users.photo` |
| QR code | Dibuat on-the-fly dengan `qrcode` + `pillow`, dikirim sebagai data URL |
| Excel / PDF | Dibangun di `io.BytesIO`, dikirim `StreamingResponse` |

Konsekuensi: dokumen `users` bisa membesar karena foto base64. Bisa diterima pada skala
satu majelis (ratusan orang). Kalau nanti ribuan, pindahkan foto ke collection terpisah
atau object storage.

### 2.5 URL tidak boleh disimpan di database

**Keputusan:** yang tersimpan hanya **token**; `link` dan gambar QR dihitung setiap
request lewat `resolve_base_url(request)`.

**Alasan:** sandbox dan produksi memakai **database Atlas yang sama**. Versi awal
menyimpan `link` + `image` QR pendaftaran di `app_settings.public_qr`. Karena QR itu
pertama kali dibuat di sandbox, produksi terus menyajikan QR yang mengarah ke domain
preview Emergent.

`resolve_base_url()` memakai urutan prioritas:

1. env `FRONTEND_URL` bila diset — paling eksplisit, dipakai di produksi
2. host request (`x-forwarded-proto` + `x-forwarded-host`) — jaring pengaman kalau env
   lupa diisi atau memakai custom domain
3. `http://localhost:3000`

Token tetap stabil, jadi tautan/QR yang sudah dicetak tetap sah.

### 2.6 Auth memakai httpOnly cookie, bukan Bearer token

**Alasan:**

- Token tidak bisa dibaca JavaScript → tahan XSS.
- Frontend tidak perlu mengurus penyimpanan & lampiran token.
- Satu domain berarti cookie otomatis terkirim.

**Konsekuensi:** semua pengujian harus memakai session yang menyimpan cookie
(`requests.Session()`, `curl -c/-b`). Tidak ada header `Authorization`.

Masa sesi dibuat **365 hari** (`SESSION_DAYS`). Ini keputusan UX yang sadar: jamaah
lansia kesulitan login berulang. Mitigasinya `token_version` — dinaikkan untuk mencabut
seluruh sesi lama sekaligus.

### 2.7 MongoDB tanpa relasi

Referensi antar dokumen memakai **id string** (`kegiatan_id`, `user_id`, `kelompok_id`),
tanpa `$lookup`. Volume datanya kecil (satu majelis), jadi menghitung di aplikasi lebih
sederhana dan mudah di-debug daripada pipeline agregasi.

**Status `alpha` tidak disimpan.** Dihitung: `total_peserta − hadir − izin`. Konsekuensinya
penting: menambah peserta baru **mengubah** angka alpha kegiatan lampau. Ini disepakati
karena alpha bermakna "tidak hadir dari daftar aktif saat ini".

### 2.8 `server.py` satu file

~2.400 baris dalam satu file. Disengaja: satu domain masalah yang saling terkait erat,
dan agent AI lebih akurat mengedit satu file dengan konteks penuh. Konsistensi urutan
seksi (lihat `AGENTS.md` bagian 2) yang menjaga keterbacaan, bukan jumlah file.

### 2.9 Frontend base URL relatif

```js
const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/+$/, "");
export const API = `${BACKEND_URL}/api`;
```

Satu baris ini yang membuat build yang sama berjalan di dua lingkungan:

| Lingkungan | `REACT_APP_BACKEND_URL` | Base URL efektif |
|---|---|---|
| Sandbox/dev | URL preview | absolut |
| Produksi Vercel | **tidak diset** | `/api` relatif |

Karena itu variabel ini **tidak boleh** diset di Vercel.

---

## 3. Aliran data

### 3.1 Siklus satu request

```
Komponen React (pages/)
   │ api.get / api.post   (src/lib/api.js — satu instance axios, withCredentials)
   ▼
[Produksi] rewrite /api/(.*) → /api/index (path asli dipertahankan)
[Lokal]    langsung ke uvicorn :8001
   ▼
api/index.py → backend/server.py
   │
   ├─ bootstrap_middleware: ensure_init() + maybe_auto_close()
   ├─ Guard: get_current_user → require_staff → require_admin
   ├─ Validasi Pydantic
   ├─ Query motor ke MongoDB
   └─ serialize_*() / public_user()
   ▼
JSON → setState → render
```

### 3.2 Absensi: tiga jalur, satu muara

```
A. Pengurus manual        POST /api/admin/kegiatan/{id}/absen
B. Scan QR pribadi        GET  /api/me/qr  →  POST /api/staff/kegiatan/{id}/scan-personal
C. Absen mandiri jamaah   GET  /api/absen/{token}  →  POST /api/absen/{token}/mark
                                    │
                                    ▼
                     absensis (upsert, unik per kegiatan_id + user_id)
                                    ▼
              rekap → laporan → export Excel/PDF & Share WA
```

Ketiganya menulis ke collection yang sama dengan `upsert`, sehingga tidak ada duplikasi
walau satu orang tercatat lewat dua jalur.

### 3.3 QR pribadi rotating (anti titip-absen)

```python
window = int(now_utc_timestamp // 60)                       # jendela 60 detik
sig    = hmac_sha256(JWT_SECRET, f"{user_id}.{window}")[:16]
token  = base64url(f"{user_id}.{window}.{sig}")
```

Verifikasi menerima `window` saat ini **dan** satu window sebelumnya (grace period),
sehingga QR yang di-screenshot lalu dikirim ke orang lain kedaluwarsa dalam ≤ 2 menit.
Tidak ada state yang perlu disimpan — cukup `JWT_SECRET`, jadi cocok untuk serverless.

---

## 4. Model keamanan

| Lapis | Mekanisme |
|---|---|
| Password | bcrypt |
| Sesi | JWT di httpOnly + Secure + SameSite=None cookie |
| Pencabutan sesi | `token_version` per user |
| Brute force | Maks 5 percobaan gagal / 15 menit per akun → HTTP 429 |
| Otorisasi | Dependency berjenjang: `get_current_user` → `require_staff` → `require_admin` |
| Pencegahan takeover | Reset mandiri hanya untuk akun berperan tunggal `peserta` |
| Kebocoran data | Semua respons lewat helper serialisasi (tidak ada `password_hash` keluar) |
| Tautan publik | Token acak; share rekap kedaluwarsa 7 hari (410 bila lewat, 404 bila salah) |
| Titip absen | QR pribadi HMAC berputar 60 detik |
| Endpoint cron | `CRON_SECRET` via `Authorization: Bearer` atau `X-Cron-Secret` |
| Audit | `activity_logs` mencatat aksi pengurus/admin |

---

## 5. Utang teknis yang diketahui

| Hal | Dampak | Kapan perlu ditangani |
|---|---|---|
| Foto base64 di dalam dokumen `users` | Dokumen membesar, list peserta lebih berat | Bila peserta > ~2.000 |
| Sandbox & produksi berbagi database | Perubahan di sandbox terlihat di produksi | Bila mulai ada data nyata — pisahkan `DB_NAME` |
| Masa sesi 365 hari | Jendela penyalahgunaan panjang bila perangkat hilang | Bila dipakai di luar lingkungan terpercaya |
| `alpha` dihitung, tidak disimpan | Angka historis berubah saat peserta ditambah | Bila butuh laporan historis yang beku |
| Bundel frontend ~426 kB gzip | Muat awal lebih lambat di 3G | Bila keluhan kecepatan muncul → code splitting per area |
| `server.py` satu file | Konflik merge bila banyak developer | Bila tim > 2 orang |
| Tidak ada rate limit selain login | Endpoint publik bisa disalahgunakan | Bila QR pendaftaran disebar luas |
