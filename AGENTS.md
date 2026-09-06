# AGENTS.md — Panduan Kerja untuk AI Coding Agent

> File ini adalah **kontrak kerja** bagi AI agent (Claude, Cursor, Copilot, Emergent,
> dsb.) yang mengerjakan project E-KERTALANGU. Baca **seluruh** file ini sebelum
> menulis kode. Aturan di sini mengalahkan kebiasaan/default Anda.
>
> Untuk manusia: file ini juga berfungsi sebagai onboarding developer baru.

---

## 0. TL;DR — 12 aturan yang paling sering dilanggar

1. **Semua route backend wajib berprefix `/api`** lewat `api_router`. Tanpa itu, request tidak akan pernah sampai ke backend.
2. **Jangan pernah mengubah** `MONGO_URL` di `backend/.env` dan `REACT_APP_BACKEND_URL` di `frontend/.env`.
3. **Jangan menulis ke filesystem.** Produksi berjalan di serverless (disk read-only). Simpan biner sebagai base64 di MongoDB atau stream dari `io.BytesIO`.
4. **Jangan membuat `while True`, thread, atau background task.** Pakai pola lazy-on-request yang di-throttle, atau Vercel Cron.
5. **Jangan mengandalkan event `startup`/lifespan.** Inisialisasi lewat `ensure_init()` yang idempoten.
6. **Jangan mengembalikan dokumen MongoDB mentah.** Selalu lewat helper `public_user()` / `serialize_*()`.
7. **Auth memakai httpOnly cookie, bukan Bearer token.** Saat menguji pakai session yang menyimpan cookie.
8. **Tanggal = string `YYYY-MM-DD`, jam = string `HH:MM`, zona waktu domain = WITA (UTC+8).** Timestamp sistem = string ISO 8601 UTC.
9. **Jangan pernah menyimpan URL absolut ke database.** Hitung dari `resolve_base_url(request)` setiap request — sandbox & produksi berbagi database yang sama.
10. **Setiap elemen interaktif wajib `data-testid`** kebab-case, didaftarkan di `src/constants/testIds/`.
11. **Frontend wajib mengikuti backend.** Kalau menambah endpoint, UI-nya harus ada juga. Jangan tinggalkan backend-only.
12. **Jangan pakai `npm`.** Frontend memakai `yarn`. Backend: `pip install` lalu `pip freeze`.

---

## 1. Konteks project

Aplikasi absensi pengajian untuk Majelis Kertalangu. Pengguna nyatanya adalah
**jamaah lansia** dan **pengurus masjid non-teknis**. Ini mengubah banyak keputusan:

- Alur harus sesedikit mungkin ketukan. Kalau butuh 5 langkah, cari cara 2 langkah.
- Teks besar, kontras tinggi, label eksplisit (jangan ikon tanpa tulisan).
- Semua teks UI **bahasa Indonesia**. Tidak ada bahasa Inggris yang terlihat pengguna.
- Fitur yang "pintar tapi membingungkan" lebih buruk daripada fitur sederhana.
- WhatsApp adalah kanal komunikasi utama — bukan email, bukan push notification.

Dokumen pendukung:

| File | Isi |
|---|---|
| [`README.md`](README.md) | Overview, tech stack, struktur folder, data flow, konvensi |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Keputusan arsitektur & alasannya |
| [`docs/API.md`](docs/API.md) | Referensi 80 endpoint |
| [`docs/DATABASE.md`](docs/DATABASE.md) | Skema 10 collection + index |
| [`docs/AUTH.md`](docs/AUTH.md) | Detail autentikasi & otorisasi |
| [`docs/FEATURES.md`](docs/FEATURES.md) | Alur fitur dari sudut pandang pengguna |
| [`docs/TESTING.md`](docs/TESTING.md) | Cara menguji, termasuk simulator Vercel |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Gejala → penyebab → perbaikan |
| [`DEPLOY_VERCEL.md`](DEPLOY_VERCEL.md) | Deploy ke Vercel + environment variables |
| [`memory/PRD.md`](memory/PRD.md) | **Memori project** — riwayat keputusan per fase |
| [`CHANGELOG.md`](CHANGELOG.md) | Riwayat perubahan |

---

## 2. Peta kode — di mana harus menulis apa

```
backend/server.py        ← SATU file, ~2.400 baris. Semua backend di sini.
api/index.py             ← Entrypoint Vercel. TIDAK BOLEH berisi logika bisnis.
frontend/src/pages/      ← Satu file = satu halaman/tab
frontend/src/components/ ← Komponen lintas halaman
frontend/src/lib/        ← Fungsi murni, tanpa JSX
frontend/src/context/    ← State lintas halaman (hanya AuthContext)
```

### Kenapa `server.py` satu file besar?

Disengaja. Aplikasinya satu domain masalah yang saling terkait erat, dan agent lebih
akurat mengedit satu file dengan konteks penuh daripada melacak 12 modul. **Jangan
memecahnya tanpa diminta pengguna.** Kalau memecah, urutan yang benar:
`models.py` → `deps.py` (guard) → `routers/*.py`, dan `server.py` hanya merakit.

### Urutan seksi di dalam `server.py`

Ikuti urutan ini saat menambah kode agar file tetap bisa dinavigasi:

```
1.  load_dotenv + import
2.  Koneksi MongoDB (client, db) + IS_SERVERLESS
3.  Konstanta + resolve_base_url()
4.  app = FastAPI() + api_router = APIRouter(prefix="/api")
5.  Helper password & JWT (hash_password, create_access_token, set_auth_cookies)
6.  Helper serialisasi (public_user, ...)
7.  Model Pydantic
8.  Dependency guard (get_current_user, require_staff, require_admin)
9.  Helper QR
10. Endpoint auth
11. Endpoint admin (users, kelompok, logs)
12. Konstanta & helper kegiatan (WITA, now_wita, serialize_kegiatan, auto_close)
13. Endpoint kegiatan, absensi, QR/share
14. Endpoint musyawarah, pengumuman, delegasi
15. Endpoint peserta (/me/*)
16. Endpoint dashboard, laporan, export
17. Endpoint health & cron
18. app.include_router + CORS
19. seed_users, seed_kelompok, _run_init, ensure_init
20. bootstrap_middleware + startup/shutdown
```

---

## 3. Aturan wajib (JANGAN dilanggar)

### 3.1 Environment

| Larangan | Alasan |
|---|---|
| Mengubah `MONGO_URL` / `REACT_APP_BACKEND_URL` di `.env` | Memutus integrasi frontend↔backend & database |
| Menulis ulang (`>`) file `.env`, `requirements.txt`, `package.json` | Merusak environment. Hanya boleh **menambah baris** |
| Hardcode URL, secret, atau nama database di kode | Harus lewat env |
| Commit file `.env` | Kebocoran kredensial |
| Memakai `npm install` | Merusak lockfile yarn |

Menambah dependency:

```bash
cd frontend && yarn add <paket>              # otomatis update package.json + yarn.lock
cd backend && pip install <paket> && pip freeze > requirements.txt
```

> `requirements.txt` **root** dan `api/requirements.txt` sengaja dibuat minimal untuk
> menekan ukuran lambda Vercel. Kalau menambah dependency backend yang dipakai di
> produksi, tambahkan ke **ketiga** file tersebut.

### 3.2 Routing API

```python
# BENAR
@api_router.get("/admin/kegiatan")          # → /api/admin/kegiatan
async def list_kegiatan(admin: dict = Depends(require_staff)): ...

# SALAH — tidak akan pernah terjangkau
@app.get("/admin/kegiatan")
```

Pilih prefix sesuai tingkat akses:

| Prefix | Guard wajib |
|---|---|
| `/auth/*` | — |
| `/admin/*` | `require_staff` atau `require_admin` |
| `/staff/*` | `require_staff` |
| `/me/*` | `get_current_user` |
| `/delegate/*` | `get_current_user` + verifikasi delegasi aktif |
| `/rekap/{token}`, `/absen/{token}`, `/qr/public` | publik berbasis token |

**Setiap endpoint baru wajib punya guard eksplisit.** Kalau memang publik, tulis komentar
yang menjelaskan mengapa aman.

### 3.3 Serialisasi respons

```python
# BENAR
user = await db.users.find_one({"_id": oid})
return public_user(user)

# SALAH — membocorkan password_hash & token_version, dan ObjectId/datetime
#         akan melempar "not JSON serializable"
return user
```

Helper tersedia: `public_user()`, `serialize_kegiatan()`, `serialize_musyawarah()`,
`serialize_pengumuman()`, `serialize_delegation()`.

**Menambah collection baru? Buat `serialize_<nama>()` lebih dulu**, sebelum endpoint.
Helper itu wajib mengubah `_id` → `id` string, membuang field sensitif, dan memastikan
semua `datetime` menjadi string ISO.

### 3.4 URL & base URL (pernah jadi bug produksi)

Sandbox dan produksi **memakai database MongoDB Atlas yang sama**. Karena itu:

```python
# BENAR — dihitung per request
@api_router.get("/qr/public")
async def public_qr(request: Request):
    base = resolve_base_url(request)
    link = f"{base}/register?token={token}"
    return {"link": link, "image": make_qr_data_url(link)}

# SALAH — link ikut tersimpan, lingkungan lain akan memakai domain yang salah
await db.app_settings.insert_one({"_id": "public_qr", "link": link, "image": img})
```

Aturan:

- Simpan **hanya token** di database (agar tautan yang sudah dicetak tetap sah).
- Hitung `link` dan gambar QR **setiap request** lewat `resolve_base_url(request)`.
- Endpoint yang menghasilkan URL wajib menerima parameter `request: Request`.
- `resolve_base_url()` memprioritaskan env `FRONTEND_URL`, lalu jatuh ke host request
  (`x-forwarded-proto` / `x-forwarded-host`), lalu `http://localhost:3000`.

### 3.5 Batasan serverless

| Jangan | Lakukan |
|---|---|
| `open(path, "w")`, `Path.write_bytes()` | `io.BytesIO()` + `StreamingResponse` |
| Simpan file upload ke disk | base64 data URL di MongoDB |
| `while True: ... await asyncio.sleep(n)` | Lazy-on-request + throttle DB (lihat `maybe_auto_close()`) |
| `asyncio.create_task()` untuk pekerjaan periodik | Vercel Cron ke endpoint `/api/cron/*` |
| Cache global sebagai sumber kebenaran | MongoDB sebagai sumber kebenaran; cache hanya optimasi |
| Logika di `@app.on_event("startup")` | `ensure_init()` idempoten, dipanggil middleware |

Pola throttle yang benar (contoh nyata di `maybe_auto_close()`):

```python
_last_run_local = 0.0        # optimasi per-instance

async def periodic_job():
    global _last_run_local
    now = time.time()
    if now - _last_run_local < INTERVAL:      # 1) tolak cepat tanpa query
        return
    _last_run_local = now
    claimed = await db.app_settings.find_one_and_update(   # 2) klaim slot lintas instance
        {"_id": "__job__", "next_at": {"$lte": now}},
        {"$set": {"next_at": now + INTERVAL}})
    if claimed is None:
        return
    await do_the_work()
```

### 3.6 Tanggal & waktu

```python
# Domain (kegiatan) — WITA, disimpan sebagai string
"date": "2026-09-14"        # YYYY-MM-DD
"start_time": "19:00"       # HH:MM 24 jam
now_wita()                  # datetime aware UTC+8

# Timestamp sistem — string ISO UTC, JANGAN objek datetime
"created_at": datetime.now(timezone.utc).isoformat()
```

Menyimpan objek `datetime` ke MongoDB lalu mengembalikannya apa adanya adalah penyebab
nomor satu error `"datetime is not JSON serializable"`. Simpan sebagai string.

---

## 4. Konvensi frontend

### 4.1 Alias import

```js
import { api } from "@/lib/api";               // BENAR
import { api } from "../../lib/api";           // SALAH
```

### 4.2 Memanggil API

```js
import { api, formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";

const [items, setItems] = useState(null);   // null = loading, [] = kosong

const load = useCallback(async () => {
  try {
    const { data } = await api.get("/admin/kegiatan", { params: { month } });
    setItems(data);
  } catch (e) {
    setItems([]);
    toast.error(formatApiErrorDetail(e?.response?.data?.detail));
  }
}, [month]);
```

Aturan:

- Jangan membuat instance axios baru. Pakai `api` dari `@/lib/api`.
- Jangan menulis `/api` di path — sudah ada di `baseURL`.
- Jangan menampilkan `e.message` mentah. Selalu lewat `formatApiErrorDetail()`.

### 4.3 Wajib menangani 4 state

| State | Tampilan |
|---|---|
| Loading | spinner (`<Loader2 className="animate-spin" />`) |
| Kosong | pesan jelas, mis. "Belum ada kegiatan pada periode ini." |
| Error | `toast.error` + tampilan tidak blank |
| Sukses | data |

Layar putih kosong dihitung sebagai bug.

### 4.4 Auth

```js
const { user } = useAuth();
// user === null   → sedang memuat  → tampilkan loading
// user === false  → anonim         → redirect ke /login
// user === object → sudah login
```

**Jangan** memanggil `/api/auth/me` dari komponen lain. `AuthContext` adalah satu-satunya
sumber kebenaran. Guard halaman memakai `<Protected>` / `<PublicOnly>` di `App.js`.

### 4.5 Styling

```jsx
import { cn } from "@/lib/utils";

<button className={cn("rounded-xl px-4 py-3 text-base", isActive && "bg-[#0D5C3A] text-white")} />
```

- Tailwind utility, bukan file CSS per komponen.
- Class kondisional lewat `cn()`, bukan template string manual.
- **Jangan pakai latar transparan untuk teks** — pengguna bisa bertema terang atau gelap.
- Area tap minimal 44px. Font body jangan di bawah `text-base`.
- Jangan edit manual file di `src/components/ui/` (keluaran generator shadcn/ui).

### 4.6 `data-testid`

```js
// src/constants/testIds/kegiatan.js
export const KEGIATAN = {
  addButton: 'kegiatan-add-button',
  nameInput: 'kegiatan-name-input',
};
// lalu di src/constants/testIds/index.js:  export * from './kegiatan';
```

```jsx
import { KEGIATAN } from "@/constants/testIds";
<Button data-testid={KEGIATAN.addButton}>Tambah Kegiatan</Button>
```

Kunci `camelCase`, nilai `kebab-case` berpola `<fitur>-<elemen>[-<kualifier>]`.

---

## 5. Penamaan

| Jenis | Aturan | Contoh |
|---|---|---|
| Komponen/halaman React | `PascalCase.jsx` | `LaporanView.jsx` |
| Utilitas JS | `camelCase.js` | `kegiatanUtils.js` |
| Komponen shadcn/ui | `kebab-case.jsx` | `alert-dialog.jsx` |
| Hook | `use-*.js` | `use-toast.js` |
| Modul Python | `snake_case.py` | `server.py` |
| Fungsi Python | `snake_case` | `serialize_kegiatan` |
| Model Pydantic | `PascalCase` | `KegiatanInput` |
| Konstanta | `UPPER_SNAKE_CASE` | `VALID_ROLES` |
| Privat modul | `_prefix` | `_init_done` |
| Field JSON & DB | `snake_case` | `kegiatan_id`, `created_at` |
| Path parameter | `snake_case` | `{kegiatan_id}` |

**Bahasa:** istilah domain memakai bahasa Indonesia (`kegiatan`, `absensi`, `kelompok`,
`musyawarah`, `pengumuman`, `peserta`, `pengurus`), istilah teknis memakai bahasa Inggris
(`user_id`, `token_version`, `created_at`, `status`). Konsisten — jangan mencampur
`kegiatan` dengan `event`/`activity`.

---

## 6. Alur kerja mengerjakan tugas

### 6.1 Sebelum menulis kode

1. Baca `memory/PRD.md` — cek apakah hal ini sudah pernah diputuskan/dikerjakan.
2. Baca `docs/API.md` — jangan membuat endpoint duplikat.
3. Cari dulu helper yang sudah ada (`grep`) sebelum membuat yang baru.
4. Kalau ada dua kemungkinan tafsir permintaan, **tanya**, jangan menebak.

### 6.2 Saat menulis kode

1. Backend dulu (endpoint + guard + serialisasi), lalu frontend.
2. **Selesaikan sampai frontend jadi.** Backend tanpa UI dianggap belum selesai.
3. Tambahkan `data-testid` sambil menulis JSX, jangan ditunda.
4. Tangani keempat state UI.

### 6.3 Setelah menulis kode

1. Cek log: `tail -n 50 /var/log/supervisor/backend.*.log /var/log/supervisor/frontend.*.log`
2. Uji endpoint dengan cookie:
   ```bash
   curl -s -c /tmp/ck -X POST localhost:8001/api/auth/login \
     -H "Content-Type: application/json" -d '{"identifier":"admin","password":"..."}'
   curl -s -b /tmp/ck localhost:8001/api/endpoint-baru
   ```
3. Uji routing produksi tanpa deploy (lihat `docs/TESTING.md`):
   ```bash
   cd frontend && REACT_APP_BACKEND_URL= CI=false yarn build && cd ..
   VERCEL=1 uvicorn tests.vercel_sim:app --port 8099 --lifespan off
   ```
4. Jalankan agen uji end-to-end. **Jangan mengklaim "sudah teruji" hanya berdasarkan
   curl atau pembacaan kode sendiri.**
5. Perbarui `memory/PRD.md`, `docs/API.md` (kalau ada endpoint baru), dan `CHANGELOG.md`.

### 6.4 Kalau macet

Setelah **2 kali** percobaan perbaikan gagal, berhenti menebak. Kumpulkan gejala persis,
pesan error dari log, file terkait, dan apa yang sudah dicoba — lalu lakukan analisis akar
masalah secara sistematis atau tanya pengguna. Menembak berulang kali justru menambah
kerusakan.

---

## 7. Kejujuran teknis (paling penting)

| Jangan | Lakukan |
|---|---|
| "Sudah saya perbaiki dan teruji" padahal belum dijalankan | Sebutkan persis apa yang diuji dan hasilnya |
| Menyembunyikan bagian yang gagal di ringkasan | Sebutkan kegagalan secara eksplisit |
| Memakai data mock lalu bilang fitur sudah jalan | Jangan pakai mock kecuali diminta. Kalau terpaksa, tulis **MOCKED** dengan huruf besar |
| Menandai todo selesai padahal belum | Biarkan `in_progress` |
| Bilang "seharusnya jalan" | Jalankan dan buktikan |

Kalau laporan agen uji bertentangan dengan pengamatan Anda, **verifikasi ulang secara
mandiri** dan laporkan mana yang benar beserta buktinya. Jangan langsung menerima maupun
langsung menolak.

---

## 8. Antipattern yang pernah benar-benar merusak project ini

Semuanya nyata pernah terjadi. Jangan diulang.

| # | Antipattern | Akibat | Perbaikan yang benar |
|---|---|---|---|
| 1 | `vercel.json` memakai legacy `builds` + `routes` | Output build tidak di root deployment → `/` balas **404 NOT_FOUND**, semua JS/CSS 404, halaman blank | `buildCommand` + `outputDirectory` + `rewrites` |
| 2 | Aturan `/static/(.*)` → status 404 sebagai "pengaman" | Justru mematikan seluruh bundel JS | Biarkan filesystem menangani; `rewrites` dievaluasi setelahnya |
| 3 | Menyimpan `link` + gambar QR ke database | QR pendaftaran di produksi mengarah ke domain preview | Simpan hanya token; hitung link per request via `resolve_base_url(request)` |
| 4 | `asyncio.create_task(loop_60_detik)` | Tidak jalan di serverless; kegiatan tidak pernah tertutup | Lazy-on-request + throttle DB + Vercel Cron |
| 5 | Index + seed di event `startup` | Cold start lambat, lifespan tidak dijamin dipanggil | `ensure_init()` + penanda `app_settings.__init__` |
| 6 | `os.environ['JWT_SECRET']` di level modul | Modul gagal di-import → 500 tanpa pesan berguna | Baca saat dipakai, lempar error yang jelas |
| 7 | Reset password mandiri berlaku untuk semua peran | Akun admin bisa diambil alih | Batasi hanya akun berperan tunggal `peserta` |
| 8 | `html5-qrcode` dipasang tanpa guard di React StrictMode | `removeChild` runtime error saat pindah tab | Delayed-start guard + div reader bebas anak React |
| 9 | Path pengingat WA salah (`/admin/...` bukan `/staff/...`) | 404 saat pengurus membuka modal | Cocokkan path dengan `docs/API.md` |
| 10 | `REACT_APP_BACKEND_URL` diisi di produksi Vercel | Frontend memanggil domain lain → cookie & CORS rusak | Biarkan kosong agar base URL relatif |
| 11 | Mengembalikan dokumen Mongo mentah | `ObjectId`/`datetime` not JSON serializable | Helper `serialize_*()` |

---

## 9. Definisi "selesai"

Sebuah tugas hanya boleh disebut selesai bila **semua** terpenuhi:

- [ ] Endpoint backend ada, ber-guard, dan responsnya lewat helper serialisasi
- [ ] UI frontend-nya ada dan benar-benar memakai endpoint itu
- [ ] Keempat state UI ditangani (loading, kosong, error, sukses)
- [ ] `data-testid` terpasang dan terdaftar di `constants/testIds/`
- [ ] Semua teks yang terlihat pengguna berbahasa Indonesia
- [ ] Tidak ada tulis ke disk, background loop, ketergantungan lifespan, atau URL absolut di DB
- [ ] Tidak ada nilai hardcode yang seharusnya lewat env
- [ ] Log backend & frontend bersih dari error
- [ ] Sudah diuji agen uji end-to-end, dan **semua** temuan (termasuk prioritas rendah) diperbaiki
- [ ] `memory/PRD.md`, `docs/API.md`, `CHANGELOG.md` diperbarui
- [ ] Uji routing produksi (`tests/vercel_sim.py`) lolos

---

## 10. Format pesan commit

Bahasa Indonesia. Satu baris ringkas, lalu detail.

Fitur baru:

```
Tambah ekspor rekap per kelompok

- Endpoint GET /api/admin/laporan/kelompok?kelompok_id=&date_from=&date_to=
  (require_staff), respons lewat serialize_laporan().
- UI: LaporanView.jsx tab "Per Kelompok" + tombol Share WA per koordinator.
- data-testid: laporan-kelompok-select, laporan-kelompok-share-button.
- Diuji: 3 kelompok, rentang 1 bulan, Excel & PDF valid.
```

Perbaikan bug — wajib memakai empat bagian ini:

```
Fix <ringkasan gejala>

Gejala:
  <apa yang dilihat pengguna, sertakan pesan/kode error persis>

Penyebab:
  <akar masalah, bukan gejalanya>

Perbaikan:
  <apa yang diubah dan mengapa cara ini benar>

Verifikasi:
  <perintah/uji yang dijalankan beserta hasilnya>
```

---

## 11. Perintah yang sering dipakai

```bash
# Layanan (sandbox)
sudo supervisorctl status
sudo supervisorctl restart backend      # wajib setelah ubah .env atau dependency
sudo supervisorctl restart frontend

# Log
tail -n 50 /var/log/supervisor/backend.*.log /var/log/supervisor/frontend.*.log

# Kesehatan backend + koneksi DB
curl -s localhost:8001/api/health

# Daftar semua route beserta guard-nya
grep -nE '@api_router\.(get|post|patch|put|delete)' backend/server.py

# Build produksi seperti di Vercel
cd frontend && REACT_APP_BACKEND_URL= CI=false yarn build

# Simulator routing Vercel
VERCEL=1 uvicorn tests.vercel_sim:app --port 8099 --lifespan off
```

> Hot reload aktif. Restart layanan **hanya** perlu setelah mengubah `.env` atau
> menambah dependency.

---

## 12. Yang boleh & tidak boleh diubah

| Boleh diubah bebas | Ubah dengan hati-hati | Jangan diubah tanpa izin pengguna |
|---|---|---|
| `frontend/src/pages/**` | `backend/server.py` (ikuti urutan seksi) | `backend/.env` (`MONGO_URL`) |
| `frontend/src/components/**` (kecuali `ui/`) | `vercel.json` | `frontend/.env` (`REACT_APP_BACKEND_URL`) |
| `frontend/src/lib/**` | `frontend/src/context/AuthContext.jsx` | `frontend/src/components/ui/**` |
| `docs/**`, `README.md`, `CHANGELOG.md` | `requirements.txt` (jaga tetap minimal) | Skema data yang sudah dipakai produksi |
| `tests/**` | `api/index.py` | Konfigurasi supervisor |

Mengubah skema data yang sudah dipakai produksi (mis. mengganti nama field di `users`)
membutuhkan skrip migrasi dan **persetujuan eksplisit** pengguna.
