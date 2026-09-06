# Panduan Pengujian

## 1. Prinsip

| Prinsip | Alasan |
|---|---|
| Auth memakai **cookie**, bukan Bearer | Wajib `requests.Session()` atau `curl -c/-b` |
| Uji juga **kondisi serverless** | Bug produksi paling sering karena beda perilaku lifespan/filesystem |
| Uji **routing**, bukan hanya API | Bug 404 di `/` tidak terdeteksi oleh uji API |
| Lewati uji yang butuh **kamera nyata** | Agen uji tidak punya kamera. Cukup pastikan komponen scanner render tanpa error |
| Jangan mengklaim teruji dari pembacaan kode | Jalankan dan buktikan |

Kredensial uji ada di `memory/test_credentials.md`.

---

## 2. Uji cepat backend

```bash
# Kesehatan + koneksi DB
curl -s localhost:8001/api/health
# {"status":"ok","serverless":false,"db":"connected","db_name":"ekertalangu", ...}

# Login (simpan cookie)
curl -s -c /tmp/ck -X POST localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin","password":"<ADMIN_PASSWORD>"}'

# Pakai cookie
curl -s -b /tmp/ck localhost:8001/api/auth/me
curl -s -b /tmp/ck localhost:8001/api/admin/dashboard

# Cron (harus 401 tanpa secret)
curl -s -o /dev/null -w "%{http_code}\n" localhost:8001/api/cron/auto-close
curl -s -H "Authorization: Bearer $CRON_SECRET" localhost:8001/api/cron/auto-close
```

---

## 3. Simulator routing Vercel (`tests/vercel_sim.py`)

Ini pengujian **paling penting** sebelum deploy. Ia meniru urutan routing Vercel
(filesystem → rewrites) dan dijalankan dengan `--lifespan off` + `VERCEL=1` supaya
benar-benar meniru lambda tanpa startup event.

```bash
# 1. Build seperti di Vercel (TANPA REACT_APP_BACKEND_URL → base URL relatif)
cd frontend && REACT_APP_BACKEND_URL= CI=false yarn build && cd ..

# 2. Jalankan simulator
VERCEL=1 uvicorn tests.vercel_sim:app --host 0.0.0.0 --port 8099 --lifespan off
```

### Yang harus lolos

```bash
B=http://localhost:8099

# a. Aset statis tersaji dari filesystem
JS=$(ls frontend/build/static/js/main.*.js | head -1 | sed 's|frontend/build||')
curl -s -o /dev/null -w "$JS -> %{http_code} %{content_type}\n" $B$JS   # 200 text/javascript
curl -s -o /dev/null -w "/favicon.png -> %{http_code}\n" $B/favicon.png # 200

# b. SPA fallback — SEMUA harus 200 text/html
for p in / /roles /area/admin /activate /absen/abc /rekap/xyz; do
  curl -s -o /dev/null -w "$p -> %{http_code}\n" $B$p
done

# c. Aset yang tidak ada harus 404, BUKAN HTML
curl -s -o /dev/null -w "/static/js/lama.js -> %{http_code}\n" $B/static/js/lama.js  # 404

# d. API lewat rewrite
curl -s $B/api/health
```

**Kenapa (c) penting:** kalau aset yang hilang dibalas `index.html`, browser mencoba
mengeksekusi HTML sebagai JavaScript → `Uncaught SyntaxError: Unexpected token '<'`.

### Uji base URL QR

Sandbox dan produksi memakai database yang sama, jadi wajib dipastikan QR tidak
membawa domain lingkungan lain.

```bash
# FRONTEND_URL diset → dipakai
VERCEL=1 FRONTEND_URL="https://absen-ekertalangu.vercel.app" \
  uvicorn api.index:app --port 8003 --lifespan off &
curl -s localhost:8003/api/qr/public | python -c "import sys,json;print(json.load(sys.stdin)['link'])"
# -> https://absen-ekertalangu.vercel.app/register?token=...

# FRONTEND_URL kosong → diambil dari host request
VERCEL=1 FRONTEND_URL= uvicorn api.index:app --port 8005 --lifespan off &
curl -s -H "x-forwarded-proto: https" -H "x-forwarded-host: absen.contoh.id" \
  localhost:8005/api/qr/public | python -c "import sys,json;print(json.load(sys.stdin)['link'])"
# -> https://absen.contoh.id/register?token=...
```

> Menjalankan `api/index.py` secara lokal akan memuat `backend/.env`, sehingga
> `FRONTEND_URL` dari file itu ikut terpakai. Untuk menguji skenario "env tidak diset",
> set eksplisit `FRONTEND_URL=` (string kosong) — kode memperlakukan kosong sebagai
> tidak diset. Di Vercel tidak ada file `.env`, jadi masalah ini tidak muncul.

---

## 4. Skrip uji integrasi backend

| File | Cakupan |
|---|---|
| `backend_test.py` | Fase 1 — auth, user, QR |
| `backend_test_fase2.py` | Fase 2 — kegiatan, absensi, rekap, laporan |
| `backend_test_fase3_1.py` | Fase 3.1 — delegasi, pengingat WA, musyawarah |
| `backend_test_fase3_4.py` | Fase 3–4 — pengurus + peserta |
| `backend_test_new_features.py` | Fitur tambahan |

Hasil agen uji tersimpan di `test_reports/iteration_*.json`. Baca **seluruh** temuan dan
perbaiki **semuanya**, termasuk prioritas rendah.

---

## 5. Pengujian frontend

Yang **wajib** diuji:

- Login dengan ketiga bentuk identifier (email, username, nomor HP)
- Halaman Pilih Peran menampilkan hanya peran yang dimiliki
- **Seluruh** menu sidebar admin dapat diklik tanpa red-screen
- Buat kegiatan lewat UI dan pastikan benar-benar tersimpan di database
- Tandai Hadir/Izin dan pastikan `counts` berubah
- Unduh Excel & PDF ter-trigger tanpa error
- Modal Pengingat WA memuat daftar penerima (bukan 404)
- Modal QR Aktivasi menampilkan gambar + tombol Download/Salin Link
- Area peserta: bottom-nav, grafik riwayat, lonceng, form profil
- **Deep-link**: buka `/area/admin` langsung (bukan lewat navigasi) — menguji SPA fallback

Yang **harus dilewati**:

- Scan QR dengan kamera nyata (`html5-qrcode`) — cukup pastikan komponen render tanpa
  runtime error saat tab dibuka/ditutup berulang
- Drag-and-drop
- Fitur suara

---

## 6. Hasil yang terlihat seperti bug tapi NORMAL

| Pengamatan | Status | Penjelasan |
|---|---|---|
| 401 pada `/api/auth/me` + `/api/auth/refresh` saat halaman dibuka | **NORMAL** | `AuthContext` memeriksa sesi anonim |
| `GET /api/admin/users/{id}/photo` → 404 | **NORMAL** | Peserta itu belum mengunggah foto |
| Spinner agak lama pada request pertama | **NORMAL** | Latensi ke MongoDB Atlas |
| Peringatan ESLint `react-hooks/exhaustive-deps` saat build | **NORMAL** | Sengaja; `CI=false` mencegah build gagal |
| Deprecation warning webpack di log frontend | **NORMAL** | Dari CRA/craco |

**False negative yang pernah dilaporkan agen uji** (API sebenarnya benar, hanya nama
field yang diharapkan agen salah):

| Diharapkan agen | Nama sebenarnya |
|---|---|
| `tren_6_bulan` | `tren` |
| `link` (activation-qr) | `url` |
| `kegiatans` (laporan) | `per_kegiatan` |
| `recent` (me/dashboard) | `announcements` |

Agen juga pernah melaporkan "tombol Masuk sebagai Admin tidak navigasi" — diverifikasi
manual: navigasi berhasil dan 10/10 menu sidebar berfungsi. Selalu verifikasi ulang
temuan agen secara mandiri sebelum mengubah kode.

---

## 7. Membersihkan data uji

Sandbox memakai database Atlas yang sama dengan produksi, jadi **wajib bersihkan** data
uji setelah pengujian.

```python
import os, certifi, pymongo
from dotenv import load_dotenv
load_dotenv('backend/.env')
db = pymongo.MongoClient(os.environ['MONGO_URL'], tlsCAFile=certifi.where())[os.environ['DB_NAME']]

ids = [k['_id'] for k in db.kegiatans.find({'name': {'$regex': '^Test '}}, {'_id': 1})]
db.absensis.delete_many({'kegiatan_id': {'$in': ids}})
db.kegiatans.delete_many({'_id': {'$in': ids}})
db.users.delete_many({'email': {'$regex': r'@test\.com$'}})
```

**Jangan** menghapus akun seed, dan **jangan** drop database.

---

## 8. Checklist sebelum merge

- [ ] `curl /api/health` → `db: connected`
- [ ] Login ketiga akun seed berhasil
- [ ] Guard: peserta → 403 pada `/api/admin/*`; tanpa login → 401
- [ ] Endpoint baru diuji dengan cookie
- [ ] `cd frontend && REACT_APP_BACKEND_URL= CI=false yarn build` sukses
- [ ] Simulator Vercel: `/` 200 html, aset 200, aset hilang 404, `/api/*` 200
- [ ] Deep-link SPA berfungsi
- [ ] Base URL QR benar untuk env yang diset maupun tidak
- [ ] Log backend & frontend bersih
- [ ] Agen uji end-to-end dijalankan dan **semua** temuan diperbaiki
- [ ] Data uji dibersihkan dari Atlas
- [ ] `memory/PRD.md`, `docs/API.md`, `CHANGELOG.md` diperbarui
