# Skema Database

**MongoDB** (produksi: MongoDB Atlas). Nama database dari env `DB_NAME`.

Tidak ada relasi/`$lookup`. Referensi antar dokumen memakai **id string**.

| `_id` | Dipakai di |
|---|---|
| `ObjectId` | `users` |
| UUID string | `kegiatans`, `kelompoks`, `musyawarahs`, `pengumumans`, `delegations` |
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
  roles: ["peserta"],                       // admin | pengurus | peserta
  status: "active" | "pending" | "nonaktif",
  source: "seed" | "admin" | "qr_public",
  avatar_gender: "male" | "female",
  needs_completion: false,
  photo: "data:image/jpeg;base64,..." | null,  // maks 320px, di-resize di browser
  password_hash: "$2b$...",                 // bcrypt — JANGAN pernah dikembalikan
  token_version: 0,                         // dinaikkan untuk mencabut semua sesi
  created_at: "2026-09-06T16:00:09+00:00"   // string ISO UTC
}
```

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
  recurring: false,
  group_id: "<uuid>" | null,     // penanda satu seri (4 minggu)
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
  status: "hadir" | "izin",
  arrival_time: "19:12",              // HH:MM WITA
  marked_by: "Pak Pengurus" | "Delegasi: <nama>" | "Mandiri",
  marked_by_id: "<user id>",
  updated_at: "..."
}
```

**Index:** `(kegiatan_id, user_id)` **unik**, `kegiatan_id`, `user_id`.

> Index unik itulah yang membuat tiga jalur absensi (manual, scan QR pribadi, absen
> mandiri) bisa memakai `upsert` tanpa menghasilkan duplikat.
>
> **`alpha` tidak pernah disimpan.** Dihitung `total_peserta − hadir − izin`.
> Konsekuensinya: menambah peserta baru mengubah angka alpha kegiatan lampau.

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

## `app_settings`

Collection kunci–nilai dengan `_id` tetap.

```js
// QR pendaftaran publik — HANYA token yang disimpan
{ _id: "public_qr", token: "AJQDnujHiPaQUD3y", created_at: "..." }

// Penanda inisialisasi — mencegah index+seed berulang setiap cold start
{ _id: "__init__", version: 3, at: "..." }

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
