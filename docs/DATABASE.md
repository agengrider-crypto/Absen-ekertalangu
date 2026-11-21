# Skema Database

**MongoDB** (produksi: MongoDB Atlas). Nama database dari env `DB_NAME`.

Tidak ada relasi/`$lookup`. Referensi antar dokumen memakai **id string**.

| `_id` | Dipakai di |
|---|---|
| `ObjectId` | `users` |
| UUID string | `kegiatans`, `kelompoks`, `musyawarahs`, `pengumumans`, `delegations`, `pendaftaran_kegiatan`, `pendaftaran_konfirmasi` |
| String tetap | `app_settings` (`public_qr`, `__init__`, `__auto_close__`) |

---

## `users`

```js
{
  _id: ObjectId,
  name: "Ibu Jamaah",
  email: "peserta@ekertalangu.id" | null,   // unik (partial index)
  username: "peserta" | null,               // unik (partial index)
  phone: "081300000003",
  whatsapp: "081300000003" | null,
  dob: "1970-08-17",                        // YYYY-MM-DD
  birthplace: null,
  address: "Jl. Mawar No. 3",
  gender: "L" | "P",
  education: "SMA" | null,                  // EDUCATION_OPTIONS
  mubaligh: "belum" | "sudah" | null,
  kelompok_id: "<uuid>" | null,
  roles: ["peserta"],                       // admin | pengurus | peserta | guru
  status: "active" | "pending" | "nonaktif",
  must_change_password: false,              // true untuk kata sandi sementara; login dibatasi ke setup
  source: "seed" | "admin" | "qr_public",
  avatar_gender: "male" | "female",
  needs_completion: false,
  photo: "data:image/jpeg;base64,..." | null,  // maks 320px, di-resize di browser
  password_hash: "$2b$...",                 // bcrypt — JANGAN pernah dikembalikan
  token_version: 0,                         // dinaikkan untuk mencabut semua sesi
  created_at: "2026-09-06T16:00:09+00:00"   // string ISO UTC
}
```

`username` dibuat dari nama peserta untuk akun yang didaftarkan pengurus. Nama kembar
mendapat akhiran angka agar tetap unik.

**Index:** `email` (unik, partial `$type: string`), `username` (unik, partial),
`phone`, `name`, `status`, `kelompok_id`.

> Index unik memakai `partialFilterExpression` supaya banyak dokumen boleh punya
> `email`/`username` bernilai `null` (peserta yang didaftarkan pengurus belum tentu
> punya email).

**Peserta aktif** difilter dengan `PESERTA_QUERY = {"roles": "peserta", "status": "active"}`
— ini penyebut untuk semua perhitungan rasio kehadiran.

---

## `kegiatans`

```js
{
  _id: "<uuid>",
  name: "Pengajian Malam Jumat",
  type: "rutin" | "khusus" | "asad",
  date: "2026-09-14",            // YYYY-MM-DD (WITA)
  start_time: "19:00",           // HH:MM 24 jam (WITA)
  end_time: "20:30",
  teacher: null, material: null, location: null,
  maps_query: "Masjid Kertalangu, Denpasar" | null,
  recurring: false,
  recurring_group_id: "<uuid>" | null,
  participant_ids: ["<ObjectId string>"], // penyaringan peserta kegiatan
  session_participant_ids: ["<ObjectId string>"] | null, // peserta wajib; lainnya tetap tampil tanpa Alpha
  session_group_id: "<uuid>" | null,
  session_label: "Pagi" | null,
  session_required: true,
  status: "open" | "closed",
  closed_at: "..." | null,
  auto_closed: false,            // true bila ditutup oleh auto-close
  share_token: "<token>" | null,       // untuk /rekap/{token}
  share_expires_at: "..." | null,      // 7 hari
  absen_token: "<token>" | null,       // untuk /absen/{token}
  created_at: "..."
}
```

**Index:** `date`, `status`, `share_token`.

> Hanya **token** yang disimpan. URL lengkapnya dihitung per request lewat
> `resolve_base_url(request)`. Jangan pernah menyimpan URL absolut.

---

## `absensis`

```js
{
  _id: ObjectId,
  kegiatan_id: "<uuid>",
  user_id: "<ObjectId string>",
  status: "hadir" | "izin" | "sakit" | "alpha",
  arrival_time: "2026-09-14T19:12:00+08:00" | null,
  marked_by: "Pak Pengurus" | "Delegasi: <nama>" | "Mandiri",
  marked_by_id: "<user id>",
  updated_at: "..."
}
```

**Index:** `(kegiatan_id, user_id)` **unik**, `kegiatan_id`, `user_id`.

> Index unik itulah yang membuat tiga jalur absensi (manual, scan QR pribadi, absen
> mandiri) bisa memakai `upsert` tanpa menghasilkan duplikat.
>
> Alpha adalah status yang dicatat secara eksplisit setelah kegiatan berakhir; status
> kosong tidak disimpan sebagai Alpha dan ditampilkan sebagai `belum_diabsen`.

---

## `kelompoks`

```js
{ _id: "<uuid>", name: "Majelis Pusat", description: null, created_at: "..." }
```

**Index:** `name`. Seed default: `Majelis Pusat`, `Kelompok Timur`, `Kelompok Barat`.

---

## `musyawarahs`

```js
{ _id: "<uuid>", category: "4S" | "tim7", date: "2026-09-01", content: "...", created_at: "..." }
```

**Index:** `(category, date desc)`.

---

## `pengumumans`

```js
{
  _id: "<uuid>",
  title: "Pengajian dipindah",
  body: "...",
  kegiatan_id: "<uuid>" | null,
  pengajar: null,
  important: false,          // memicu titik merah lonceng di area peserta
  pinned: false,
  pin_roles: ["peserta"],    // peran mana yang melihat versi ter-pin
  created_at: "..."
}
```

**Index:** `pinned`, `pin_roles`.

---

## `delegations`

```js
{
  _id: "<uuid>",
  kegiatan_id: "<uuid>", kegiatan_name: "...",
  granted_by_id: "...", granted_by_name: "Pak Pengurus",
  grantee_id: "...",     grantee_name: "Ibu Jamaah",
  reason: "" | null,         // OPSIONAL
  active: true,
  created_at: "...", revoked_at: null, revoked_reason: null
}
```

**Index:** `(kegiatan_id, grantee_id, active)`, `grantee_id`.

Saat kegiatan ditutup, `revoke_delegations_for_kegiatan()` menonaktifkan semua delegasi
kegiatan itu.

---

## `activity_logs`

```js
{ _id: ObjectId, user_id: "...", user_name: "...", action: "login", detail: "...", at: "..." }
```

**Index:** `at`. Aksi tercatat: `login`, `aktivasi_akun`, `pindah_kelompok`,
`reset_password`, `hapus_peserta`, `ubah_peran`, dll.

---

## `login_attempts`

```js
{ _id: ObjectId, identifier: "<user id atau identifier>", email: "...", at: "..." }
```

**Index:** `identifier`, `email`.

Hanya percobaan **gagal** yang dicatat. Login berhasil menghapus catatan untuk
identifier tersebut. `is_locked()` mengunci bila ≥ 5 catatan dalam 15 menit → HTTP 429.

---

## `laporan_links`

Tautan laporan publik yang **permanen** (dibuat panel Admin → Laporan → "Buat Link Laporan").
`_id` berisi token yang dipakai pada URL `/laporan/{token}`.

```js
{
  _id: "<token urlsafe 9 byte>",
  date_from: "2026-09-07",
  date_to: "2026-09-07",
  mode: "harian" | "bulanan" | "custom",
  title: "Laporan Kehadiran Harian",
  created_by: "Administrator",
  created_by_id: "<user id>",
  created_at: "<ISO WITA>"
}
```

Token dibuat **idempoten**: bila sudah ada dokumen dengan `date_from` + `date_to` + `mode`
yang sama, token lama dipakai ulang. Dengan begitu tautan yang sudah dibagikan tidak
pernah basi dan koleksi ini tidak membengkak. Berbeda dengan `kegiatans.share_token`
(rekap) yang **kedaluwarsa** setelah `SHARE_EXPIRE_DAYS` (7 hari), tautan laporan
**tidak memiliki masa berlaku**.

Data laporan **tidak** disimpan di sini — hanya rentang tanggalnya. Angka selalu
dihitung ulang oleh `build_laporan()` setiap tautan dibuka, jadi selalu mengikuti
koreksi absen terbaru.

---

## `pendaftaran_kegiatan`

Kegiatan yang membutuhkan konfirmasi peserta lewat tautan publik WhatsApp.
**Terpisah dari `kegiatans`** (absensi) — tidak ada relasi ke `absensis`.

```js
{
  _id: "<uuid>",
  nama: "Pengajian Rutin Ahad Pagi",
  tanggal: "2026-12-06",              // YYYY-MM-DD (WITA)
  lokasi: "Masjid Kertalangu",        // boleh null
  catatan: "Bawa kartu peserta",      // boleh null
  status: "aktif" | "selesai" | "arsip",
  token: "<urlsafe 24 byte>",         // dipakai pada URL /daftar/{token}
  dibuat_oleh: "<user id>",
  dibuat_pada: "<ISO WITA>",
  diarsipkan_pada: "<ISO WITA>" | null,
  diarsipkan_oleh: "<user id>" | null
}
```

Status **tampil** (`aktif` / `berlangsung` / `selesai` / `arsip`) dihitung dari
`tanggal` + `status` setiap request — tidak disimpan, jadi tidak butuh pekerjaan
terjadwal. Hanya `token` yang disimpan; `link` dihitung per request lewat
`resolve_base_url(request)`.

Index: `token` (unik), `(status, tanggal)`.

---

## `pendaftaran_konfirmasi`

Satu baris per konfirmasi peserta. **Rute publik hanya menulis ke sini** — `users`
dan `absensis` tidak pernah disentuh.

```js
{
  _id: "<uuid>",
  kegiatan_id: "<pendaftaran_kegiatan._id>",
  nama: "Ahmad Fauzi",
  nomor_hp: "6281200000002",          // dinormalisasi ke 62…
  kehadiran: "hadir" | "tidak_hadir",
  alasan: "Kerja" | "Sakit" | "Keperluan keluarga" | "Luar kota" | "Lainnya" | null,
  alasan_lain: "Acara keluarga" | null,
  keterangan: "Shift pagi" | null,
  peserta_id: "<users._id>" | null,   // null = calon peserta
  status_akun: "aktif" | "belum_aktivasi" | "nonaktif" | "calon",
  dibuat_pada: "<ISO WITA>",
  diperbarui_pada: "<ISO WITA>"
}
```

Index: `(kegiatan_id, nomor_hp)` **unik** (konfirmasi ulang menimpa baris yang sama),
`(kegiatan_id, kehadiran)`.

`peserta_id` dan `status_akun` adalah **salinan saat konfirmasi** — dipakai agar rekap
tetap menampilkan status akun pada saat itu. Konfirmasi calon peserta tidak menambah
`total_peserta` (yang dihitung dari `PESERTA_QUERY`).

---

## `pendaftaran_laju`

Pembatas laju konfirmasi publik (20 per IP & per token / 10 menit).

```js
{ ip: "103.x.x.x", token: "<token>", at: "<ISO WITA>" }
```

Index: `at`. Baris lama tidak dibersihkan otomatis (sama seperti `izin_laju`).

---

## `app_settings`

Collection kunci–nilai dengan `_id` tetap.

```js
// QR pendaftaran publik — HANYA token yang disimpan
{ _id: "public_qr", token: "AJQDnujHiPaQUD3y", created_at: "..." }

// Penanda inisialisasi — mencegah index+seed berulang setiap cold start
{ _id: "__init__", version: 5, at: "..." }

// Klaim slot auto-close — koordinasi antar instance serverless
{ _id: "__auto_close__", next_at: 1788715496.87 }   // epoch detik
```

> **`public_qr` sengaja tidak menyimpan `link`/`image`.** Versi awal menyimpannya dan
> menyebabkan bug produksi: QR pendaftaran mengarah ke domain preview karena dokumen
> dibuat pertama kali di sandbox (sandbox & produksi memakai database yang sama).

---

## Inisialisasi & migrasi

`_run_init()` membuat semua index dan menjalankan seed. Dipanggil `ensure_init()`,
yang dijaga penanda `app_settings.__init__` berisi `INIT_VERSION`.

**Menambah index atau mengubah seed:**

1. Ubah `_run_init()` di `backend/server.py`
2. **Naikkan `INIT_VERSION`**
3. Deploy — request pertama menjalankan ulang inisialisasi sekali saja

Untuk perubahan skema yang butuh transformasi data (mis. mengganti nama field), tulis
skrip migrasi terpisah dan minta persetujuan pengguna — `_run_init()` bukan tempat
migrasi data.

## Data seed

3 akun (admin multi-peran, pengurus, peserta) + 3 kelompok. Password admin dari env
`ADMIN_EMAIL`/`ADMIN_PASSWORD`. Seed bersifat idempoten: akun yang sudah ada tidak
dibuat ulang, tetapi password admin **diselaraskan** dengan env bila berbeda.
