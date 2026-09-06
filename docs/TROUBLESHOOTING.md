# Troubleshooting

Gejala → penyebab → perbaikan. Semua kasus di sini pernah benar-benar terjadi.

---

## Produksi (Vercel)

### `/` membalas 404 NOT_FOUND meski build sukses

```
x-vercel-error: NOT_FOUND
content-type: text/plain
body: The page could not be found
```

**Penyebab:** `vercel.json` memakai properti legacy `builds` + `routes`. Dengan
`@vercel/static-build` pada `src: "frontend/package.json"`, hasil build tidak dipasang
di root deployment melainkan bersarang di bawah path folder `src`-nya.

**Perbaikan:** buang `builds` dan `routes`, pakai konfigurasi modern:

```json
{
  "buildCommand": "cd frontend && CI=false yarn build",
  "outputDirectory": "frontend/build",
  "functions": { "api/index.py": { "includeFiles": "backend/**" } },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Cek pencegahan:** log build tidak boleh memuat
`WARNING! Due to 'builds' existing in your configuration file...`.

---

### Halaman blank, console: `Uncaught SyntaxError: Unexpected token '<'`

**Penyebab:** request aset (JS/CSS) dibalas `index.html`. Biasanya karena ada aturan
routing yang salah menangkap `/static/*`, atau nama bundel berubah setelah rebuild
sementara HTML lama masih di-cache.

**Perbaikan:** jangan buat aturan khusus untuk `/static` — `rewrites` dievaluasi setelah
filesystem, jadi aset yang ada selalu disajikan apa adanya. Pastikan aset yang **tidak
ada** dibalas 404, bukan HTML.

---

### QR pendaftaran mengarah ke domain yang salah (mis. preview)

**Penyebab:** versi awal menyimpan `link` + `image` QR ke `app_settings.public_qr`.
Karena sandbox dan produksi memakai database Atlas yang sama, QR yang pertama dibuat di
sandbox terus disajikan di produksi.

**Perbaikan:** simpan **hanya token**; hitung `link` dan gambar setiap request lewat
`resolve_base_url(request)`.

```bash
# Verifikasi
curl -s https://<domain>/api/qr/public | python -c "import sys,json;print(json.load(sys.stdin)['link'])"
```

Kalau masih salah: periksa env `FRONTEND_URL` di Vercel (ia berprioritas di atas host
request), lalu **Redeploy**. Bersihkan sisa cache lama bila perlu:

```python
db.app_settings.update_one({"_id": "public_qr"},
                           {"$unset": {"link": "", "image": "", "base_url": ""}})
```

---

### API 500 dengan pesan `JWT_SECRET belum diset pada environment server`

**Perbaikan:** tambahkan `JWT_SECRET` di Vercel → Environment Variables (Production,
Preview, Development) → **Redeploy**. Mengubah nilainya akan mencabut semua sesi aktif
dan membatalkan QR pribadi yang sedang berlaku.

---

### `/api/health` → `"db": "error"`

| Pesan `db_error` | Penyebab | Perbaikan |
|---|---|---|
| `bad auth : authentication failed` | Username/password database salah, atau user belum di-submit di Atlas | Atlas → Database Access → Edit → Edit Password → **Update User**, tunggu cluster hijau |
| `ServerSelectionTimeoutError` | Network Access belum mengizinkan | Atlas → Network Access → tambah `0.0.0.0/0` (Vercel memakai IP dinamis) |
| `SSL: CERTIFICATE_VERIFY_FAILED` | Bundel CA tidak ada | Pastikan `certifi` ada di `requirements.txt`; kode sudah memakai `tlsCAFile=certifi.where()` |
| Timeout hanya di produksi | Password memuat karakter spesial | URL-encode password (`@ : / ? # & %`) |

> Password Atlas hasil autogenerate baru berlaku setelah tombol **Update User** ditekan
> dan cluster selesai menerapkan (~1 menit). Menguji terlalu cepat akan tetap
> `bad auth`.

---

### Login berhasil lalu langsung ter-logout, atau cookie tidak tersimpan

**Penyebab paling umum:** `REACT_APP_BACKEND_URL` **diset** di Vercel, sehingga frontend
memanggil domain lain dan cookie menjadi third-party.

**Perbaikan:** **hapus** variabel itu dari Vercel dan Redeploy. Base URL harus relatif
(`/api`).

Penyebab lain: diakses lewat `http://` (cookie `Secure` butuh HTTPS; `localhost`
dikecualikan browser), atau `JWT_SECRET` berubah.

---

### Kegiatan tidak tertutup otomatis

**Penyebab:** background loop tidak jalan di serverless.

**Yang berlaku sekarang:** auto-close dipicu request (`maybe_auto_close()`, throttle 60
detik) + Vercel Cron harian. Jadi bila tidak ada trafik sama sekali, penutupan menunggu
cron.

**Paksa manual:**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/auto-close
```

---

### Function timeout / lambda terlalu besar

| Gejala | Perbaikan |
|---|---|
| Export PDF/Excel timeout | Naikkan `functions["api/index.py"].maxDuration` (batas paket berlaku) atau perkecil rentang tanggal |
| `Serverless Function has exceeded the unzipped maximum size` | Kecilkan `requirements.txt` root & `api/requirements.txt` — jaga tetap minimal |
| Cold start lambat | Normal. `ensure_init()` hanya 1 query bila penanda sudah ada |

---

## Sandbox / lokal

### Backend tidak mau start

```bash
tail -n 50 /var/log/supervisor/backend.err.log
```

| Error | Perbaikan |
|---|---|
| `ModuleNotFoundError: No module named 'x'` | `pip install x` lalu `sudo supervisorctl restart backend` |
| `RuntimeError: MONGO_URL ... belum diset` | Periksa `backend/.env` |
| Perubahan `.env` tidak terbaca | `sudo supervisorctl restart backend` (hot reload tidak memuat ulang `.env`) |

### Frontend blank / gagal kompilasi

```bash
tail -n 50 /var/log/supervisor/frontend.err.log
```

| Error | Perbaikan |
|---|---|
| `Module not found: Can't resolve '@/...'` | Alias `@` → `src` didefinisikan di `craco.config.js`; periksa ejaan path |
| `removeChild` runtime error di tab Scan | Regresi guard `html5-qrcode` di React StrictMode — lihat `QrScanner.jsx` (delayed-start guard + div reader bebas anak React) |
| Dependency baru tidak terbaca | `cd frontend && yarn install && sudo supervisorctl restart frontend` |

### `datetime is not JSON serializable`

**Penyebab:** objek `datetime` atau `ObjectId` dikembalikan tanpa serialisasi.

**Perbaikan:** kembalikan lewat `public_user()` / `serialize_*()`, dan simpan timestamp
sebagai string: `datetime.now(timezone.utc).isoformat()`.

### 404 pada endpoint yang "sudah dibuat"

| Sebab | Perbaikan |
|---|---|
| Memakai `@app.get` bukan `@api_router.get` | Ganti ke `api_router` |
| Prefix salah (`/admin/...` vs `/staff/...`) | Cocokkan dengan `docs/API.md` |
| Frontend menulis `/api` dua kali | `baseURL` sudah memuat `/api` |

### Method Not Allowed (405)

Method-nya belum terdaftar. Contoh nyata: `GET /api/me/profile` pernah 405 karena hanya
`@api_router.patch("/me/profile")` yang ada.

---

## Perilaku yang benar tapi sering disalahartikan sebagai bug

| Pengamatan | Status |
|---|---|
| 401 pada `/api/auth/me` + `/api/auth/refresh` saat halaman pertama dibuka | **NORMAL** — pengecekan sesi anonim |
| `GET /api/admin/users/{id}/photo` → 404 | **NORMAL** — peserta belum unggah foto |
| Angka alpha kegiatan lampau berubah | **BY DESIGN** — alpha dihitung dari daftar peserta aktif saat ini |
| Peringatan ESLint saat build | **NORMAL** — `CI=false` mencegah build gagal |
| Tautan `/rekap/{token}` balas 410 | **NORMAL** — tautan share kedaluwarsa 7 hari |

---

## Aturan debugging masalah auth

**Jangan pernah** menyarankan "hapus cache", "hard refresh", atau "coba mode incognito"
sebagai solusi. Urutan yang benar:

1. Baca `memory/test_credentials.md` untuk kredensial yang benar
2. Cek `curl /api/health` — pastikan DB tersambung dan `jwt_secret_set: true`
3. Baca log backend untuk error yang sebenarnya
4. Bandingkan implementasi dengan `docs/AUTH.md`
5. Periksa penyebab tersering: `REACT_APP_BACKEND_URL` diset di produksi, `JWT_SECRET`
   berubah, `token_version` tidak cocok, atau `status != "active"`

---

## Perintah diagnostik

```bash
# Kesehatan + DB
curl -s localhost:8001/api/health

# Semua log sekaligus
tail -n 50 /var/log/supervisor/backend.*.log /var/log/supervisor/frontend.*.log

# Status layanan
sudo supervisorctl status

# Daftar route + guard
grep -nE '@api_router\.(get|post|patch|put|delete)' backend/server.py

# Cek koneksi Atlas langsung
python -c "
import os, certifi, pymongo
from dotenv import load_dotenv; load_dotenv('backend/.env')
c = pymongo.MongoClient(os.environ['MONGO_URL'], tlsCAFile=certifi.where(), serverSelectionTimeoutMS=15000)
print(c.admin.command('ping')); print(c.list_database_names())"

# Validasi vercel.json terhadap schema resmi
curl -s -o /tmp/vs.json https://openapi.vercel.sh/vercel.json && python -c "
import json; from jsonschema import Draft202012Validator
errs = list(Draft202012Validator(json.load(open('/tmp/vs.json'))).iter_errors(json.load(open('vercel.json'))))
print('VALID' if not errs else [e.message for e in errs])"
```
