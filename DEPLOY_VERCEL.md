# Deploy ke Vercel — E-KERTALANGU (1 Project: Frontend + Backend)

Project ini **tidak dipisah** antara frontend dan backend. Satu repository →
satu project Vercel → satu domain. Infrastruktur hanya **Vercel + MongoDB Atlas**.

---

## 1. Arsitektur

```
Absen-ekertalangu/
├── vercel.json          <-- konfigurasi 1-project (routes + builds + cron)
├── requirements.txt     <-- dependencies Python untuk serverless function
├── .vercelignore
├── api/
│   ├── index.py         <-- ENTRYPOINT serverless: re-export FastAPI app
│   └── requirements.txt
├── backend/
│   ├── server.py        <-- SELURUH kode FastAPI (tetap di sini)
│   └── requirements.txt <-- untuk sandbox/lokal (uvicorn)
└── frontend/
    ├── package.json     <-- script `vercel-build`
    └── src/
```

Routing di `vercel.json`:

| Request | Ditangani |
|---|---|
| `/api/*` | `api/index.py` (FastAPI serverless function) |
| `/static/*`, `/favicon.png`, dll | file statis hasil build React |
| sisanya (`/`, `/area/admin`, `/absen/xxx`, …) | `index.html` (SPA React Router) |

Karena frontend dan backend satu domain, frontend memanggil API secara **relatif**
(`/api/...`) sehingga **tidak ada CORS** dan cookie httpOnly (`SameSite=None; Secure`)
berjalan normal.

---

## 2. Setup MongoDB Atlas

1. **Database Access** → buat user (contoh username `agendb`), catat passwordnya.
   Beri role **`Atlas admin`** atau minimal **`readWriteAnyDatabase`**.
2. **Network Access** → tambahkan `0.0.0.0/0` (Allow access from anywhere).
   Vercel serverless memakai IP dinamis, jadi ini wajib.
3. Ambil connection string (Drivers → Python):
   `mongodb+srv://<user>:<password>@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority`
4. Jika password memuat karakter spesial (`@ : / ? # & %`), **URL-encode** dulu.

Database & collection **tidak perlu dibuat manual** — otomatis dibuat saat request
pertama (index + seed akun admin dijalankan sekali, ditandai di
`app_settings.__init__`).

---

## 3. Import project di Vercel

1. Vercel → **Add New… → Project** → pilih repo `Absen-ekertalangu`.
2. **Root Directory:** `./` (biarkan default / jangan diarahkan ke `frontend`).
3. **Framework Preset:** `Other`.
4. **Build & Output Settings:** biarkan **kosong/default** — semuanya sudah diatur
   oleh `vercel.json`.
5. Isi Environment Variables (bagian 4), lalu **Deploy**.

---

## 4. Environment Variables (Vercel)

Set untuk environment **Production, Preview, dan Development**.

| Key | Contoh nilai | Wajib | Keterangan |
|---|---|---|---|
| `MONGO_URL` | `mongodb+srv://user:pass@cluster0.xxxx.mongodb.net/?retryWrites=true&w=majority` | ✅ | Connection string Atlas |
| `DB_NAME` | `ekertalangu` | ✅ | Nama database |
| `JWT_SECRET` | string acak ≥ 32 karakter | ✅ | Kunci tanda tangan JWT |
| `FRONTEND_URL` | `https://absen-ekertalangu.vercel.app` | ✅ | Dipakai backend untuk membuat **link di dalam QR code** & link share rekap |
| `ADMIN_EMAIL` | `ageng.rider@gmail.com` | ✅ | Email admin seed |
| `ADMIN_PASSWORD` | password admin | ✅ | Password admin seed |
| `CRON_SECRET` | string acak | – | Proteksi `/api/cron/auto-close` |
| `EXTRA_CORS_ORIGINS` | `https://domain-lain.com` | – | Origin tambahan, dipisah koma |

### JANGAN diset di Vercel

- **`REACT_APP_BACKEND_URL`** — biarkan tidak ada. Kalau kosong, frontend memakai
  path relatif `/api` (benar untuk 1-project). Kalau diisi, frontend akan memanggil
  domain lain dan cookie/CORS bisa rusak.
- `RUN_SCHEDULER` — tidak perlu; scheduler otomatis nonaktif di serverless.

> Setelah deploy pertama, ganti `FRONTEND_URL` ke domain final (atau custom domain)
> lalu **Redeploy**, supaya semua QR code mengarah ke domain yang benar.

---

## 5. Verifikasi setelah deploy

```bash
# 1. Cek backend + koneksi database
curl https://<domain>/api/health
# harapan: {"status":"ok","serverless":true,"db":"connected","db_name":"ekertalangu",...}

# 2. Cek login admin
curl -X POST https://<domain>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"<ADMIN_EMAIL>","password":"<ADMIN_PASSWORD>"}'

# 3. Cek cron auto-close
curl -H "Authorization: Bearer <CRON_SECRET>" https://<domain>/api/cron/auto-close
```

Lalu buka `https://<domain>/` → halaman login harus tampil, dan login admin
mengarah ke halaman **Pilih Peran**.

---

## 6. Catatan penyesuaian serverless

Vercel serverless tidak punya proses yang hidup terus & tidak punya disk permanen.
Perubahan yang sudah dilakukan:

| Sebelumnya | Sekarang |
|---|---|
| `asyncio.create_task(auto_close_loop())` — loop 60 detik | Loop hanya jalan di server persisten. Di Vercel: **auto-close lazy** (dipicu request, di-throttle 60 detik & dikoordinasi lewat MongoDB) + **Vercel Cron** harian ke `/api/cron/auto-close` |
| `@app.on_event("startup")` membuat index + seed setiap start | `ensure_init()` — dijalankan lewat HTTP middleware, ditandai `app_settings.__init__` (`INIT_VERSION`) sehingga kerja berat hanya sekali, cold start tetap cepat |
| Motor client tanpa konfigurasi | Pool kecil (`maxPoolSize=5` di serverless), `tlsCAFile=certifi.where()` untuk Atlas, timeout eksplisit |
| `os.environ['JWT_SECRET']` → crash saat import | Dibaca saat dipakai, error 500 dengan pesan jelas |
| CORS hanya 1 origin | `FRONTEND_URL` + `localhost:3000` + `EXTRA_CORS_ORIGINS` |
| Backend URL frontend wajib absolut | Relatif otomatis jika `REACT_APP_BACKEND_URL` kosong |

Foto profil, QR code, dan file export (Excel/PDF) **tidak** ditulis ke disk —
foto/QR disimpan sebagai data URL base64 di MongoDB, export di-stream langsung.
Jadi aman di serverless (read-only filesystem).

Bila `INIT_VERSION` di `backend/server.py` dinaikkan, index & seed akan dijalankan
ulang sekali pada deploy berikutnya.

---

## 7. Menjalankan di lokal / sandbox

`backend/.env`

```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="ekertalangu"
JWT_SECRET="secret-lokal"
FRONTEND_URL="http://localhost:3000"
ADMIN_EMAIL="ageng.rider@gmail.com"
ADMIN_PASSWORD="jokam354"
```

`frontend/.env`

```
REACT_APP_BACKEND_URL=http://localhost:8001
```

```bash
cd backend && pip install -r requirements.txt && uvicorn server:app --port 8001 --reload
cd frontend && yarn install && yarn start
```
