# E-KERTALANGU — Absensi Pengajian

Aplikasi web absensi pengajian untuk Majelis/Kelompok Kertalangu. Dibangun mobile-first
dan ramah lansia: huruf besar, kontras tinggi, alur sesedikit mungkin ketukan.

---

## 1. Overview Project

E-KERTALANGU menggantikan absensi manual (buku tulis + rekap Excel) dengan satu sistem
terpusat yang bisa diakses dari HP.

**Masalah yang diselesaikan**

- Rekap kehadiran manual lambat dan rawan salah hitung.
- Sulit tahu siapa yang sering tidak hadir (perlu ditindaklanjuti pengurus).
- Laporan bulanan harus disusun ulang dari nol setiap bulan.
- Jamaah lansia kesulitan dengan aplikasi yang rumit.

**Cara kerja singkat**

1. **Pengurus** membuat jadwal kegiatan (bisa sekaligus 4 minggu untuk pengajian rutin).
2. Saat kegiatan berlangsung, kehadiran dicatat lewat **3 jalur** yang bisa dipilih:
   - Pengurus menandai manual dari daftar peserta.
   - Pengurus memindai **QR pribadi** milik jamaah (QR berputar tiap 60 detik, anti-titip-absen).
   - Jamaah memindai **QR kegiatan** yang ditempel di lokasi, lalu cari nama sendiri → Konfirmasi Hadir.
3. Yang tidak tercatat otomatis dihitung **alpha**. Kegiatan **tertutup sendiri** setelah
   jam selesai terlewat.
4. **Laporan** harian/bulanan/rentang langsung tersedia, bisa diunduh **Excel/PDF** atau
   dibagikan lewat **WhatsApp** dengan teks salam otomatis.

**Tiga peran pengguna**

| Peran | Kemampuan |
|---|---|
| **Admin** | Semua akses. Kelola akun & hak akses, kelompok, impor peserta dari Excel, log aktivitas. |
| **Pengurus** | Operasional: jadwal kegiatan, absensi, rekap, musyawarah, pengumuman, laporan, delegasi absen. |
| **Peserta / Jamaah** | Lihat jadwal, absen mandiri via QR, QR pribadi, riwayat kehadiran, profil. |

Satu akun bisa memiliki **beberapa peran** sekaligus. Setelah login muncul halaman
**Pilih Peran**, dan hanya peran yang dimiliki yang ditampilkan.

**Fitur pendukung**

- **Pendaftaran & aktivasi via QR** — pengurus cetak QR, jamaah scan lalu daftar/aktivasi sendiri.
- **Delegasi "Penjaga Absen"** — pengurus menitipkan hak mengisi absen ke jamaah tertentu untuk
  satu kegiatan. Hak **otomatis dicabut** saat kegiatan ditutup.
- **Pengingat WhatsApp** — sistem menyusun teks + daftar nomor `wa.me`, pengurus tinggal tap kirim (gratis).
- **Musyawarah** — catatan hasil musyawarah 4S/Tim 7, bisa diekspor PDF gabungan per periode.
- **Pengumuman** — bisa di-pin per peran, muncul sebagai lonceng notifikasi di area peserta.
- **Share rekap publik** — tautan rekap yang bisa dibagikan, kadaluarsa otomatis 7 hari.

---

## 2. Tech Stack

### Frontend

| Komponen | Pilihan | Catatan |
|---|---|---|
| Framework | **React 19** | Create React App + **CRACO** (`craco.config.js`) untuk override webpack |
| Bahasa | JavaScript (JSX) | Tanpa TypeScript |
| Routing | **react-router-dom v7** | SPA, `BrowserRouter` |
| Styling | **Tailwind CSS** + `tailwindcss-animate` | Tema hijau tua `#0D5C3A`, latar putih bersih `#FAFBF9` |
| Komponen UI | **shadcn/ui** (Radix UI) | 46 komponen di `src/components/ui/` |
| Ikon | **lucide-react** | |
| Notifikasi | **sonner** | `<Toaster position="top-center" richColors />` |
| Grafik | **recharts** | Donut komposisi jenis kelamin, tren 6 bulan, grafik batang riwayat |
| HTTP client | **axios** | Satu instance terpusat di `src/lib/api.js`, `withCredentials: true` |
| QR | **html5-qrcode** (baca kamera) · **qrcode.react** (render) | |
| Form | **react-hook-form** + **zod** | |
| Tanggal | **date-fns** / **dayjs** | Zona waktu tampilan: **WITA (UTC+8)** |

### Backend

| Komponen | Pilihan | Catatan |
|---|---|---|
| Framework | **FastAPI 0.110** | ASGI, semua route diberi prefix `/api` |
| Server (lokal) | **uvicorn** | `uvicorn server:app --port 8001 --reload` |
| Server (produksi) | **Vercel Serverless Function** | `api/index.py` → re-export `backend/server.py` |
| Validasi | **Pydantic v2** | `BaseModel` untuk setiap payload masuk |
| Driver DB | **motor** (async) + **pymongo** | |
| QR generator | **qrcode** + **pillow** | PNG dibuat di server, dikirim sebagai data URL base64 |
| Export | **openpyxl** (Excel) · **reportlab** (PDF) | Di-stream langsung dari memori, tanpa tulis ke disk |

### Database

**MongoDB** (produksi: **MongoDB Atlas**). Nama database dari env `DB_NAME`.

| Collection | Isi |
|---|---|
| `users` | Akun + data jamaah (nama, HP, gender, kelompok, roles, foto base64) |
| `kegiatans` | Jadwal kegiatan (tanggal, jam WITA, jenis, status open/closed, share token) |
| `absensis` | Catatan kehadiran (`hadir` / `izin`) — unik per `(kegiatan_id, user_id)` |
| `kelompoks` | Daftar kelompok/majelis |
| `musyawarahs` | Catatan hasil musyawarah |
| `pengumumans` | Pengumuman, termasuk status pin per peran |
| `delegations` | Delegasi hak absen (Penjaga Absen) |
| `activity_logs` | Jejak audit aksi pengurus/admin |
| `login_attempts` | Penghitung percobaan login untuk lockout brute-force |
| `app_settings` | Cache QR publik + penanda `__init__` (versi seed/index) & `__auto_close__` |

Tidak ada relasi/join — referensi antar dokumen memakai **id string** (`kegiatan_id`,
`user_id`, `kelompok_id`).

### Auth

- **JWT di httpOnly cookie**, bukan header `Authorization: Bearer`.
- Dua cookie: `access_token` + `refresh_token`, atribut `httponly`, `secure`,
  `samesite=none`, `path=/`.
- Password di-hash **bcrypt**.
- **Login fleksibel**: satu kolom menerima **email**, **username**, atau **nomor HP**.
- **Lockout brute-force** berbasis collection `login_attempts`.
- **`token_version`** per user — dinaikkan untuk mencabut semua sesi lama sekaligus.
- Reset mandiri (tanggal lahir + nomor HP terdaftar) **dibatasi hanya akun berperan
  tunggal `peserta`**, supaya akun admin/pengurus tidak bisa diambil alih.
- Guard di backend berupa FastAPI dependency:
  `get_current_user` → `require_staff` (admin **atau** pengurus) → `require_admin`.
- Guard di frontend berupa komponen pembungkus: `<Protected>` dan `<PublicOnly>` di `App.js`.

### Storage

**Tidak ada object storage / disk.** Ini disengaja agar aman di serverless
(filesystem read-only, tidak persisten):

- **Foto profil** → di-resize di browser (maks 320px, `src/lib/image.js`) lalu disimpan
  sebagai **data URL base64** di dokumen `users`.
- **QR code** → dibuat on-the-fly di server, dikirim sebagai data URL base64. QR publik
  di-cache di `app_settings` agar stabil melintasi restart.
- **Excel / PDF** → dibangun di `io.BytesIO` dan dikirim via `StreamingResponse`.

### Deployment

**Satu project Vercel** (frontend + backend satu domain, tanpa CORS) + **MongoDB Atlas**.
Panduan lengkap: [`DEPLOY_VERCEL.md`](DEPLOY_VERCEL.md).

---

## 3. Folder Structure

```
Absen-ekertalangu/
│
├── vercel.json                  # Konfigurasi 1-project Vercel: buildCommand,
│                                #   outputDirectory, functions, rewrites, crons
├── requirements.txt             # Dependencies Python MINIMAL untuk lambda Vercel
├── .python-version              # Pin runtime Python (3.12)
├── .vercelignore                # File yang tidak diunggah ke Vercel
├── DEPLOY_VERCEL.md             # Panduan deploy + daftar environment variables
├── vercel-env.example.md        # Contoh nilai environment variables
├── README.md
│
├── api/                         # ENTRYPOINT SERVERLESS (khusus Vercel)
│   ├── index.py                 #   Menambah backend/ ke sys.path lalu
│   │                            #   `from server import app`. Tidak ada logika bisnis.
│   └── requirements.txt          #   Salinan requirements untuk builder Python
│
├── backend/                     # SELURUH KODE BACKEND
│   ├── server.py                #   Aplikasi FastAPI: models, helpers, 80 route, seed
│   ├── requirements.txt         #   Dependencies untuk lokal/sandbox (lebih lengkap)
│   ├── pytest.ini
│   ├── assets/                  #   Aset statis backend (logo untuk PDF)
│   └── tests/                   #   Unit test pytest
│
├── frontend/                    # SELURUH KODE FRONTEND
│   ├── package.json
│   ├── yarn.lock                #   Di-commit agar build Vercel reproducible
│   ├── craco.config.js          #   Override webpack CRA + alias `@` → src/
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── components.json          #   Konfigurasi generator shadcn/ui
│   ├── jsconfig.json            #   Alias path untuk editor
│   ├── public/                  #   index.html, favicon, logo, manifest
│   └── src/
│       ├── index.js             #   Entry React
│       ├── App.js               #   Definisi SEMUA route + Protected/PublicOnly
│       ├── App.css, index.css   #   Base Tailwind + CSS variable tema
│       │
│       ├── context/
│       │   └── AuthContext.jsx  #   Sumber tunggal state user. Menyediakan
│       │                        #     login/logout/refresh + `user`
│       │                        #     (null = memuat, false = anonim, object = login)
│       │
│       ├── lib/                 #   Utilitas murni, TIDAK berisi JSX
│       │   ├── api.js           #     Instance axios + base URL + format error
│       │   ├── image.js         #     Resize/kompres foto sebelum diunggah
│       │   └── utils.js         #     `cn()` penggabung className Tailwind
│       │
│       ├── hooks/
│       │   └── use-toast.js     #   Hook notifikasi
│       │
│       ├── constants/testIds/   #   Registry `data-testid` untuk uji otomatis
│       │   ├── index.js         #     Re-export semua file fitur
│       │   ├── auth.js
│       │   └── home.js
│       │
│       ├── components/          #   Komponen LINTAS halaman
│       │   ├── ui/              #     46 komponen shadcn/ui — JANGAN diedit manual
│       │   ├── DateField.jsx    #     Input tanggal ramah lansia
│       │   ├── Logo.jsx
│       │   ├── ProfileMenu.jsx  #     Menu pojok kanan: Profil / Ganti Peran / Keluar
│       │   ├── ProfileModal.jsx
│       │   └── QrScanner.jsx    #     Pembungkus html5-qrcode (aman dari React StrictMode)
│       │
│       └── pages/               #   Satu file = satu halaman/tab
│           ├── Login.jsx        #     + dialog lupa kata sandi
│           ├── Register.jsx     #     Pendaftaran via QR publik
│           ├── Activate.jsx     #     Aktivasi akun (cari nama sendiri)
│           ├── RoleDashboard.jsx#     Halaman "Pilih Peran"
│           ├── RoleArea.jsx     #     Dispatcher: arahkan ke area sesuai peran
│           ├── PesertaArea.jsx  #     Shell area peserta (bottom-nav mobile-first)
│           ├── PublicRekap.jsx  #     Halaman publik /rekap/:token
│           ├── PublicAbsen.jsx  #     Halaman publik /absen/:token (absen mandiri)
│           │
│           ├── admin/           #     Area Admin & Pengurus (sidebar/drawer)
│           │   ├── AdminLayout.jsx      # Shell: sidebar + hamburger responsif
│           │   ├── Dashboard.jsx        # Container: state + pemilihan menu aktif
│           │   ├── DashboardView.jsx    # Statistik, grafik, pintasan cepat, QR
│           │   ├── Peserta.jsx          # Tabel peserta, tambah, bulk, impor Excel
│           │   ├── PesertaDetailModal.jsx
│           │   ├── KegiatanView.jsx     # List/kalender kegiatan + form
│           │   ├── KegiatanExtras.jsx   # QR kegiatan, pengingat WA, delegasi, rekap
│           │   ├── PenjagaAbsenView.jsx # Kelola delegasi terpusat
│           │   ├── MusyawarahView.jsx
│           │   ├── PengumumanView.jsx
│           │   ├── LaporanView.jsx      # Harian/bulanan/rentang + Excel/PDF/Share WA
│           │   ├── LogAktivitas.jsx
│           │   ├── HakAkses.jsx         # Editor peran pengguna
│           │   ├── ComingSoon.jsx
│           │   ├── adminUtils.js        # Helper khusus area admin (non-JSX)
│           │   └── kegiatanUtils.js     # Format tanggal/jam WITA, label jenis
│           │
│           └── peserta/         #     Tab-tab area peserta
│               ├── Beranda.jsx          # Sapaan, pengumuman, jadwal, riwayat, lonceng
│               ├── KegiatanList.jsx
│               ├── ScanTab.jsx          # Pindai QR kegiatan
│               ├── QrSaya.jsx           # QR pribadi berputar + unduh
│               └── ProfilTab.jsx
│
├── memory/
│   ├── PRD.md                   # Dokumen hidup: keputusan arsitektur & riwayat fase
│   └── test_credentials.md      # Akun uji (di-gitignore)
│
├── tests/
│   ├── __init__.py
│   └── vercel_sim.py            # Simulator routing Vercel untuk uji lokal tanpa deploy
│
├── test_reports/                # Hasil JSON dari agen uji otomatis
├── test_result.md               # Catatan riwayat pengujian
├── design_guidelines.json       # Token desain (warna, tipografi, spasi)
└── backend_test*.py             # Skrip uji integrasi backend per fase
```

**Aturan penempatan file**

| Kalau kode Anda… | Taruh di |
|---|---|
| Halaman/tab utuh yang punya route atau menu | `src/pages/` (atau subfolder `admin/`, `peserta/`) |
| Komponen dipakai ≥ 2 halaman | `src/components/` |
| Komponen hanya dipakai 1 halaman | file yang sama, atau tetangga di folder halaman itu |
| Fungsi murni tanpa JSX | `src/lib/` (global) atau `*Utils.js` (khusus satu area) |
| State yang dibutuhkan lintas halaman | `src/context/` |
| Endpoint API baru | `backend/server.py`, wajib lewat `api_router` |

---

## 4. Data Flow

### 4.1 Alur umum sebuah request

```
Komponen React (pages/)
   │  memanggil api.get / api.post   (src/lib/api.js)
   ▼
axios instance
   │  baseURL = `${REACT_APP_BACKEND_URL || ""}/api`
   │  withCredentials: true  →  cookie JWT ikut terkirim
   ▼
[Produksi Vercel]  rewrite /api/(.*) → /api/index  (path asli dipertahankan)
[Lokal/sandbox]    langsung ke uvicorn :8001
   ▼
api/index.py  →  backend/server.py  (FastAPI)
   │
   ├─ bootstrap_middleware
   │     ├─ ensure_init()       → buat index + seed (sekali saja, ditandai di DB)
   │     └─ maybe_auto_close()  → tutup kegiatan yang lewat jam (throttle 60 detik)
   │
   ├─ Dependency guard
   │     get_current_user  → baca cookie, verifikasi JWT + token_version
   │     require_staff     → wajib admin ATAU pengurus
   │     require_admin     → wajib admin
   │
   ├─ Validasi Pydantic atas request body
   │
   ├─ Query motor (async) ke MongoDB
   │
   └─ serialize_*() / public_user()  → buang field sensitif, ubah ObjectId→str
   ▼
JSON  →  komponen React  →  setState  →  render
```

**Aturan penting:** dokumen MongoDB **tidak pernah** dikembalikan mentah. Semua respons
melewati helper serialisasi (`public_user`, `serialize_kegiatan`, `serialize_musyawarah`,
`serialize_pengumuman`, `serialize_delegation`) yang membuang `password_hash`/`token_version`
dan mengubah `ObjectId` serta `datetime` menjadi string agar aman di-JSON.

### 4.2 Alur login

```
Login.jsx  ─ POST /api/auth/login {identifier, password}
                │
                ├─ cek lockout di `login_attempts`
                ├─ cari user: email OR username OR phone
                ├─ bcrypt.checkpw
                └─ Set-Cookie: access_token + refresh_token (httpOnly, Secure)
                │
AuthContext ─ GET /api/auth/me  →  simpan `user` di state
                │
App.js <Protected> ─ redirect ke /roles
                │
RoleDashboard ─ tampilkan HANYA kartu peran yang dimiliki user
                │
RoleArea ─ /area/admin | /area/pengurus | /area/peserta
```

Saat halaman dibuka pertama kali, `AuthContext` memanggil `/api/auth/me`. Jika 401, ia
mencoba `/api/auth/refresh`. Kedua 401 tersebut **normal** untuk pengunjung anonim dan
bukan tanda error.

### 4.3 Alur absensi (tiga jalur, satu muara)

```
Jalur A — Pengurus manual
  KegiatanExtras.jsx → POST /api/admin/kegiatan/{id}/absen {user_id, status}

Jalur B — Pengurus memindai QR pribadi jamaah
  QrSaya.jsx    → GET  /api/me/qr           (token HMAC, berputar tiap 60 detik)
  QrScanner.jsx → POST /api/staff/kegiatan/{id}/scan-personal {token}

Jalur C — Jamaah absen mandiri dari QR kegiatan
  QR kegiatan → /absen/{token} → PublicAbsen.jsx
              → GET  /api/absen/{token}         (cari nama sendiri)
              → POST /api/absen/{token}/mark    (hanya bila status kegiatan = open)

                              ▼ semuanya menulis ke ▼
              absensis  (upsert, unik per kegiatan_id + user_id)
                              ▼
  GET /api/admin/kegiatan/{id}/rekap
      total peserta − hadir − izin = alpha   (alpha dihitung, tidak disimpan)
                              ▼
  GET /api/admin/laporan  →  ringkasan, per kegiatan, top rajin, top alpha
                              ▼
  GET /api/admin/laporan/export?format=excel|pdf   (StreamingResponse)
```

### 4.4 Penutupan kegiatan otomatis

Kegiatan berstatus `open` harus tertutup sendiri setelah `end_time` (WITA) terlewat.
Karena Vercel serverless tidak punya proses yang hidup terus, ada dua mekanisme:

| Lingkungan | Mekanisme |
|---|---|
| Serverless (Vercel) | `maybe_auto_close()` di HTTP middleware — dipicu request `/api/*`, throttle 60 detik in-process, **klaim slot lewat `app_settings.__auto_close__`** sehingga aman walau banyak instance berjalan paralel. Ditambah **Vercel Cron** harian ke `GET /api/cron/auto-close` (diproteksi `CRON_SECRET`) sebagai jaring pengaman. |
| Server persisten (sandbox/VPS) | `auto_close_loop()` — `while True` + `sleep(60)`. Hanya aktif bila `not IS_SERVERLESS` dan `RUN_SCHEDULER != "0"`. |

Saat kegiatan ditutup, seluruh **delegasi** untuk kegiatan itu **otomatis dicabut**.

### 4.5 Inisialisasi database

```
request pertama → bootstrap_middleware → ensure_init()
                                            │
                          baca app_settings.__init__
                                            │
              version == INIT_VERSION ?  ── ya ─→ lewati (cold start tetap cepat)
                                            │
                                          tidak
                                            ▼
                     _run_init(): buat ~20 index + seed akun + seed kelompok
                                  + siapkan QR publik
                                            ▼
                     tulis app_settings.__init__ = {version: INIT_VERSION}
```

Naikkan konstanta `INIT_VERSION` di `backend/server.py` bila index/seed perlu dijalankan
ulang pada deploy berikutnya.

---

## 5. Coding Conventions

### 5.1 Penamaan file

| Jenis | Aturan | Contoh |
|---|---|---|
| Komponen & halaman React | `PascalCase.jsx` | `DashboardView.jsx`, `QrScanner.jsx` |
| Modul utilitas JS (tanpa JSX) | `camelCase.js` | `adminUtils.js`, `kegiatanUtils.js`, `api.js` |
| Komponen shadcn/ui | `kebab-case.jsx` (bawaan generator) | `alert-dialog.jsx`, `dropdown-menu.jsx` |
| Hook | `use-*.js` | `use-toast.js` |
| Modul Python | `snake_case.py` | `server.py`, `vercel_sim.py` |
| Skrip uji backend | `backend_test*.py` | `backend_test_fase3_1.py` |

**Ekstensi:** `.jsx` **wajib** untuk file yang mengandung JSX, `.js` untuk yang tidak.

### 5.2 Import & alias

Frontend memakai alias `@` → `frontend/src` (didefinisikan di `craco.config.js` +
`jsconfig.json`). **Selalu pakai alias**, jangan `../../..`:

```js
// BENAR
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

// SALAH
import { api } from "../../lib/api";
```

Urutan import: library eksternal → alias `@/` → file relatif → CSS.

### 5.3 Penamaan variabel & fungsi

**Frontend (JavaScript)**

```js
const [isLoading, setIsLoading] = useState(false);   // state: camelCase
const KEGIATAN_TYPES = ["rutin", "khusus", "asad"];  // konstanta modul: UPPER_SNAKE_CASE
function formatWita(date) { ... }                     // fungsi: camelCase, kata kerja
function KegiatanCard({ kegiatan }) { ... }           // komponen: PascalCase
const handleSubmit = async () => { ... };             // handler event: prefix `handle`
```

**Backend (Python — PEP 8)**

```python
def hash_password(password: str) -> str: ...          # fungsi: snake_case
async def require_staff(...) -> dict: ...             # dependency: snake_case
class KegiatanInput(BaseModel): ...                   # model Pydantic: PascalCase
VALID_ROLES = ["admin", "pengurus", "peserta"]        # konstanta: UPPER_SNAKE_CASE
_init_done = False                                     # privat modul: prefix underscore
```

**Nama domain memakai bahasa Indonesia**, istilah teknis memakai bahasa Inggris:

```python
kegiatan_id, absensi, kelompok, musyawarah, pengumuman, peserta, pengurus
# tapi:
user_id, token_version, created_at, status, serialize_kegiatan
```

Konsisten memakai `kegiatan`, jangan dicampur dengan `event`/`activity`.

### 5.4 Konvensi API

- **Semua** route wajib lewat `api_router` yang sudah berprefix `/api`.
  Tanpa prefix ini, ingress Kubernetes/Vercel tidak akan meneruskannya ke backend.
- Pengelompokan path menyatakan tingkat akses:

  | Prefix | Guard | Keterangan |
  |---|---|---|
  | `/api/auth/*` | — | Login, logout, register, refresh, self-reset |
  | `/api/admin/*` | `require_staff` atau `require_admin` | Panel pengelolaan |
  | `/api/staff/*` | `require_staff` | Aksi operasional pengurus |
  | `/api/me/*` | `get_current_user` | Data milik pengguna yang login |
  | `/api/delegate/*` | `get_current_user` + cek delegasi aktif | Peserta yang diberi hak absen |
  | `/api/rekap/{token}`, `/api/absen/{token}`, `/api/qr/public` | — | Publik berbasis token |
  | `/api/health`, `/api/cron/*` | `CRON_SECRET` untuk cron | Operasional |

- Path parameter memakai `snake_case`: `{kegiatan_id}`, `{user_id}`, `{musy_id}`.
- Field JSON memakai `snake_case`, sama persis antara backend dan frontend
  (tidak ada konversi ke camelCase).
- Error dilempar dengan `HTTPException(status_code=..., detail="pesan bahasa Indonesia")`.
  Pesan `detail` **ditampilkan langsung ke pengguna**, jadi tulis dengan bahasa yang
  dimengerti jamaah — bukan jargon teknis.
- Frontend menormalkan pesan error lewat `formatApiErrorDetail()` di `src/lib/api.js`,
  yang menangani `detail` berupa string, array (error validasi Pydantic), maupun objek.

### 5.5 Format tanggal & waktu

- Zona waktu domain: **WITA (UTC+8)**. Helper `now_wita()` dan `kegiatan_end_dt()`.
- Tanggal disimpan sebagai **string** `YYYY-MM-DD`; jam sebagai **string** `HH:MM` 24 jam.
  Format ini divalidasi di backend dan menolak input salah dengan HTTP 400.
- Timestamp sistem (`created_at`, `closed_at`) disimpan sebagai **string ISO 8601 UTC**
  (`datetime.now(timezone.utc).isoformat()`) supaya selalu JSON-serializable.

### 5.6 Konvensi styling

- **Tailwind utility class**, bukan CSS file per komponen.
- Gabungkan class kondisional dengan `cn()` dari `@/lib/utils`, jangan template string manual.
- Palet: hijau tua `#0D5C3A` (primer), latar `#FAFBF9`, oranye untuk aksen peringatan.
  Token lengkap ada di `design_guidelines.json` dan CSS variable di `index.css`.
- **Ramah lansia:** ukuran font minimum besar, area tap minimal 44px, label eksplisit
  (jangan hanya ikon), kontras tinggi.
- **Jangan pakai latar transparan** untuk teks — pengguna bisa memakai tema terang
  maupun gelap sehingga teks bisa tidak terbaca.
- Area peserta **mobile-first** dengan bottom-nav; area admin/pengurus memakai sidebar
  yang berubah menjadi drawer + hamburger di layar kecil.

### 5.7 `data-testid`

Setiap elemen interaktif wajib punya `data-testid` agar bisa diuji otomatis.

- Nilainya **kebab-case** berpola `<fitur>-<elemen>[-<kualifier>]`.
- Didaftarkan terpusat di `src/constants/testIds/`, kuncinya **camelCase**.

```js
// src/constants/testIds/auth.js
export const LOGIN = {
  submitButton: 'login-submit-button',
  passwordInput: 'login-password-input',
};

// pemakaian
import { LOGIN } from "@/constants/testIds";
<Button data-testid={LOGIN.submitButton}>Masuk</Button>
```

Menambah fitur baru: buat `constants/testIds/<fitur>.js`, lalu re-export di `index.js`.

### 5.8 Aturan environment variable

- Backend membaca env lewat `os.environ.get(...)` dengan default yang wajar.
  `JWT_SECRET` dibaca **saat dipakai**, bukan saat import, supaya modul tidak gagal
  di-load dan pesan errornya jelas.
- Frontend hanya mengenal variabel berawalan `REACT_APP_`.
- **Jangan pernah menulis URL atau kredensial secara hardcode** di kode. Nilai yang
  berbeda antar lingkungan harus lewat env.
- `REACT_APP_BACKEND_URL` **dibiarkan kosong di produksi Vercel** agar base URL menjadi
  relatif (`/api`) — satu domain, tanpa CORS.
- Jangan pernah commit file `.env`.

### 5.9 Pola React

- **Container/View:** komponen container memegang state dan panggilan API
  (`Dashboard.jsx`), komponen view fokus menampilkan (`DashboardView.jsx`).
- **Satu sumber kebenaran auth:** state user hanya di `AuthContext`. Tri-state
  `user`: `null` = sedang memuat, `false` = anonim, objek = sudah login. Jangan
  memanggil `/api/auth/me` dari komponen lain.
- **Wajib menangani semua state:** loading, kosong, error, dan sukses. Daftar kosong
  harus menampilkan pesan yang jelas (mis. "Belum ada kegiatan pada periode ini"),
  bukan layar kosong.
- Notifikasi hasil aksi memakai `sonner` (`toast.success` / `toast.error`) dengan pesan
  bahasa Indonesia.
- Jangan mengedit file di `src/components/ui/` secara manual — itu keluaran generator
  shadcn/ui. Bungkus dengan komponen sendiri bila perlu penyesuaian.

### 5.10 Batasan serverless

Semua kode baru harus tetap kompatibel Vercel serverless:

- **Jangan menulis ke filesystem.** Simpan biner sebagai base64 di MongoDB atau
  stream langsung dari `io.BytesIO`.
- **Jangan membuat background task / `while True` / thread.** Pakai pola
  lazy-on-request yang di-throttle (lihat `maybe_auto_close()`) atau Vercel Cron.
- **Jangan menyimpan state di memori proses** sebagai sumber kebenaran — setiap request
  bisa dilayani instance berbeda. Cache in-memory hanya boleh untuk optimasi, dengan
  koordinasi di MongoDB.
- **Jangan bergantung pada event lifespan/startup.** Inisialisasi lewat `ensure_init()`
  yang idempoten.
- Jaga `requirements.txt` root tetap **minimal** — ada batas ukuran lambda.

### 5.11 Alur kerja & pengujian

- Sebelum merge, jalankan uji routing tanpa deploy:

  ```bash
  cd frontend && REACT_APP_BACKEND_URL= CI=false yarn build && cd ..
  VERCEL=1 uvicorn tests.vercel_sim:app --port 8099 --lifespan off
  ```

- Perbarui `memory/PRD.md` setiap ada keputusan arsitektur atau fase baru — file itu
  adalah memori project.
- Tambahkan dependency hanya lewat `yarn add` (frontend) dan `pip install` +
  `pip freeze` (backend). Jangan mengedit `package.json`/`requirements.txt` manual
  untuk dependency, dan jangan memakai `npm`.
- Pesan commit ditulis bahasa Indonesia: satu baris ringkas, lalu bagian
  **Gejala / Penyebab / Perbaikan / Verifikasi** untuk perbaikan bug.

---

## Menjalankan di lokal

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (terminal lain)
cd frontend
yarn install
yarn start
```

`backend/.env`

```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="ekertalangu"
JWT_SECRET="secret-lokal-minimal-32-karakter"
FRONTEND_URL="http://localhost:3000"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="ganti-password"
```

`frontend/.env`

```
REACT_APP_BACKEND_URL=http://localhost:8001
```

Cek kesehatan: `curl http://localhost:8001/api/health`

Untuk deploy produksi, lihat [`DEPLOY_VERCEL.md`](DEPLOY_VERCEL.md).
