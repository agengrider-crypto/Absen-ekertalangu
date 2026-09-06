# Referensi API

Semua endpoint berprefix **`/api`**. Auth memakai **JWT di httpOnly cookie** — bukan
header `Authorization`. Gunakan session yang menyimpan cookie.

Total: **80 endpoint**.

## Tingkat akses

| Guard | Arti | Kode saat gagal |
|---|---|---|
| — | Publik | — |
| `get_current_user` | Wajib login | 401 |
| `require_staff` | Wajib `admin` **atau** `pengurus` | 401 / 403 |
| `require_admin` | Wajib `admin` | 401 / 403 |

## Kode status

| Kode | Arti |
|---|---|
| 400 | Format tidak valid (tanggal/jam/foto) |
| 401 | Belum login / token tidak valid / sesi berakhir |
| 403 | Login tapi peran tidak mencukupi, atau akun belum aktif |
| 404 | Data tidak ditemukan / token share salah |
| 409 | Duplikat (email atau nomor HP sudah terdaftar) |
| 410 | Tautan share sudah kedaluwarsa |
| 429 | Terlalu banyak percobaan login (5 gagal / 15 menit) |

Error berbentuk `{"detail": "pesan bahasa Indonesia"}`. Pesan ini **ditampilkan langsung
ke pengguna**, jadi tulis dengan bahasa sederhana.

---

## 1. Sistem

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| GET | `/api/` | — | Ping API |
| GET | `/api/health` | — | Status server + ping DB. Respons: `{status, serverless, db, db_name, jwt_secret_set}` |
| GET | `/api/cron/auto-close` | `CRON_SECRET` | Tutup kegiatan yang lewat jam selesai. Respons: `{ok, closed, open_remaining}` |

```bash
curl https://<domain>/api/health
curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/auto-close
# alternatif header: -H "X-Cron-Secret: $CRON_SECRET"
```

---

## 2. Autentikasi

| Method | Path | Guard | Body / Keterangan |
|---|---|---|---|
| POST | `/api/auth/login` | — | `{identifier, password}` — `identifier` menerima email, username, **atau** nomor HP. Set 2 cookie |
| POST | `/api/auth/logout` | — | Hapus cookie |
| GET | `/api/auth/me` | login | Data user yang sedang login |
| POST | `/api/auth/refresh` | — | Perbarui `access_token` dari `refresh_token` |
| POST | `/api/auth/register` | — | `{token, name, phone, email, dob, address, password, avatar_gender}` — `token` dari QR publik |
| POST | `/api/auth/self-reset` | — | `{phone, dob, new_password}` — **hanya** akun berperan tunggal `peserta` (403 untuk lainnya) |
| GET | `/api/activation/search?q=` | — | Cari nama berstatus `pending` (min. 2 karakter, maks 20 hasil) |
| POST | `/api/activation/complete` | — | `{user_id, phone, email?, dob, address?, password, gender, avatar_gender?}` — `dob` harus cocok data pengurus |

```bash
curl -c ck.txt -X POST https://<domain>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"ageng.rider@gmail.com","password":"..."}'
curl -b ck.txt https://<domain>/api/auth/me
```

---

## 3. QR publik

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| GET | `/api/qr/public` | — | QR pendaftaran. Respons: `{token, link, image, base_url, created_at}` |
| GET | `/api/staff/activation-qr` | `require_staff` | QR aktivasi → `{url, image}` |

> `link`/`url` dan gambar QR **dihitung setiap request** dari `resolve_base_url(request)`.
> Hanya `token` yang tersimpan di database, sehingga tautan lama tetap sah tetapi domain
> selalu mengikuti lingkungan yang sedang berjalan.

---

## 4. Pengguna & kelompok

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| GET | `/api/admin/users` | `require_staff` | Daftar peserta |
| POST | `/api/admin/users` | `require_staff` | Buat akun (`AdminCreateUser`) |
| GET | `/api/admin/users/{user_id}` | `require_staff` | Detail (termasuk foto) |
| PATCH | `/api/admin/users/{user_id}` | `require_staff` | Ubah data (`PesertaUpdate`) |
| DELETE | `/api/admin/users/{user_id}` | `require_admin` | Hapus (tidak bisa hapus diri sendiri) |
| PATCH | `/api/admin/users/{user_id}/roles` | `require_admin` | `{roles: [...]}` |
| POST | `/api/admin/users/{user_id}/move` | `require_staff` | Pindah kelompok `{kelompok_id, keterangan}` — tercatat di log |
| POST | `/api/admin/users/{user_id}/reset-password` | `require_staff` | Reset oleh pengurus |
| GET | `/api/admin/users/{user_id}/photo` | `require_staff` | Foto sebagai gambar biner (404 bila belum ada) |
| POST | `/api/admin/users/bulk` | `require_staff` | Tambah banyak `{entries: [...], kelompok_id}` |
| POST | `/api/admin/users/bulk-delete` | `require_admin` | `{ids: [...]}` |
| POST | `/api/admin/users/pending` | `require_staff` | Daftar nama menunggu aktivasi `{entries:[{name, dob}]}` |
| POST | `/api/admin/users/import` | `require_staff` | Impor Excel (multipart) |
| GET | `/api/admin/import-template` | `require_staff` | Unduh template Excel |
| GET | `/api/admin/kelompok` | `require_staff` | Daftar kelompok |
| POST | `/api/admin/kelompok` | `require_admin` | `{name, description}` |
| PATCH | `/api/admin/kelompok/{kelompok_id}` | `require_admin` | Ubah |
| DELETE | `/api/admin/kelompok/{kelompok_id}` | `require_admin` | Hapus |
| GET | `/api/admin/logs` | `require_staff` | Log aktivitas |

---

## 5. Kegiatan

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| GET | `/api/admin/kegiatan` | `require_staff` | Query: `?month=YYYY-MM` atau `?date_from=&date_to=`. Tiap item punya `counts` |
| POST | `/api/admin/kegiatan` | `require_staff` | `KegiatanInput`. `recurring: true` → membuat **4 kegiatan** mingguan |
| GET | `/api/admin/kegiatan/{kegiatan_id}` | `require_staff` | Detail |
| PATCH | `/api/admin/kegiatan/{kegiatan_id}` | `require_staff` | `KegiatanUpdate` |
| DELETE | `/api/admin/kegiatan/{kegiatan_id}` | `require_staff` | Hapus |
| POST | `/api/admin/kegiatan/{kegiatan_id}/close` | `require_staff` | Tutup manual (mencabut delegasi) |
| POST | `/api/admin/kegiatan/{kegiatan_id}/reopen` | `require_staff` | Buka kembali |

`KegiatanInput`:

```json
{
  "name": "Pengajian Malam Jumat",
  "type": "rutin",            // rutin | khusus | asad
  "date": "2026-09-14",       // YYYY-MM-DD (WITA) — 400 bila salah format
  "start_time": "19:00",      // HH:MM 24 jam — 400 bila salah format
  "end_time": "20:30",
  "teacher": null,
  "material": null,
  "location": null,
  "recurring": false
}
```

---

## 6. Absensi, rekap, QR kegiatan

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| POST | `/api/admin/kegiatan/{kegiatan_id}/absen` | `require_staff` | `{user_id, status}` — `hadir`\|`izin`. Upsert |
| GET | `/api/admin/kegiatan/{kegiatan_id}/rekap` | `require_staff` | `counts` + gender + baris peserta (default `alpha`) |
| GET | `/api/admin/kegiatan/{kegiatan_id}/qr` | `require_staff` | QR menuju halaman rekap |
| POST | `/api/admin/kegiatan/{kegiatan_id}/share` | `require_staff` | Tautan rekap publik, berlaku 7 hari |
| POST | `/api/admin/kegiatan/{kegiatan_id}/absen-qr` | `require_staff` | QR absen mandiri → `{token, link, image}` |
| GET | `/api/admin/kegiatan/{kegiatan_id}/feedback` | `require_staff` | Pesan/kesan dari peserta |
| GET | `/api/staff/kegiatan/{kegiatan_id}/reminder` | `require_staff` | Teks pengingat + daftar penerima format `62…` untuk `wa.me` |
| POST | `/api/staff/kegiatan/{kegiatan_id}/scan-personal` | `require_staff` | `{content}` — hasil scan QR pribadi jamaah |

`counts` selalu berbentuk:

```json
{ "total": 120, "hadir": 87, "izin": 5, "alpha": 28, "ratio": 72.5 }
```

`alpha` **dihitung** (`total − hadir − izin`), tidak disimpan.

---

## 7. Endpoint publik berbasis token

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| GET | `/api/rekap/{token}` | — | Rekap publik. **410** bila kedaluwarsa, **404** bila token salah |
| GET | `/api/absen/{token}` | — | Info kegiatan + daftar peserta untuk absen mandiri |
| POST | `/api/absen/{token}/mark` | — | `{user_id}` — **403** bila kegiatan sudah ditutup |
| POST | `/api/absen/{token}/feedback` | — | `{name?, message}` |

---

## 8. Delegasi (Penjaga Absen)

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| POST | `/api/staff/kegiatan/{kegiatan_id}/delegate` | `require_staff` | `{grantee_id, reason?}` — `reason` **opsional** |
| GET | `/api/staff/kegiatan/{kegiatan_id}/delegations` | `require_staff` | Daftar delegasi |
| POST | `/api/staff/delegation/{deleg_id}/revoke` | `require_staff` | Cabut manual |
| GET | `/api/me/delegations` | login | Delegasi aktif milik saya |
| GET | `/api/delegate/kegiatan/{kegiatan_id}` | login + delegasi | Info kegiatan untuk penjaga absen |
| POST | `/api/delegate/kegiatan/{kegiatan_id}/absen` | login + delegasi | `{user_id, status}` |

Delegasi **otomatis dicabut** saat kegiatan ditutup (manual maupun otomatis).

---

## 9. Musyawarah & pengumuman

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| GET | `/api/staff/musyawarah` | `require_staff` | Filter `?category=4S\|tim7&date_from=&date_to=` |
| POST | `/api/staff/musyawarah` | `require_staff` | `{category, date?, content?}` |
| PATCH | `/api/staff/musyawarah/{musy_id}` | `require_staff` | Ubah |
| DELETE | `/api/staff/musyawarah/{musy_id}` | `require_staff` | Hapus |
| GET | `/api/staff/musyawarah/{musy_id}/pdf` | `require_staff` | PDF satu catatan |
| GET | `/api/staff/musyawarah-export-pdf` | `require_staff` | PDF gabungan per periode |
| GET | `/api/staff/pengumuman` | `require_staff` | Daftar |
| POST | `/api/staff/pengumuman` | `require_staff` | `{title, body, kegiatan_id?, pengajar?, important, pinned, pin_roles[]}` |
| PATCH | `/api/staff/pengumuman/{peng_id}` | `require_staff` | Ubah |
| DELETE | `/api/staff/pengumuman/{peng_id}` | `require_staff` | Hapus |

---

## 10. Area peserta (`/me/*`)

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| GET | `/api/me/dashboard` | login | Sapaan, pengumuman ter-pin, jadwal, rasio kehadiran |
| GET | `/api/me/kegiatan` | login | Jadwal + `my_status` |
| GET | `/api/me/kegiatan/{kegiatan_id}` | login | Detail (tanpa rekap orang lain) |
| GET | `/api/me/attendance-history` | login | 6 bulan hadir/izin/alpha (grafik batang) |
| GET | `/api/me/announcements` | login | Pengumuman untuk peran saya |
| GET | `/api/me/qr` | login | QR pribadi berputar (`EKP:<token>`, HMAC, jendela 60 detik) |
| GET | `/api/me/profile` | login | Data profil |
| PATCH | `/api/me/profile` | login | `ProfileUpdate` |
| GET | `/api/me/photo` | login | Foto (data URL) |
| POST | `/api/me/photo` | login | `{photo}` — harus diawali `data:image/` (400 bila tidak) |

---

## 11. Dashboard & laporan

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| GET | `/api/admin/dashboard` | `require_staff` | Statistik panel |
| GET | `/api/admin/laporan` | `require_staff` | `?date_from=&date_to=` |
| GET | `/api/admin/laporan/export` | `require_staff` | `?format=excel\|pdf&date_from=&date_to=` — file biner |

**Kunci respons `/api/admin/dashboard`** (nama persis — jangan tertukar):

```
total_peserta, peserta_L, peserta_P, akun_aktif, akun_nonaktif,
kegiatan_bulan_ini, rasio_kehadiran_bulan, donut, tren, upcoming, recent
```

> Grafik tren memakai kunci **`tren`**, bukan `tren_6_bulan`.

**Kunci respons `/api/admin/laporan`:**

```
date_from, date_to, total_kegiatan, total_peserta,
summary { hadir, izin, alpha, ratio },
gender_hadir, per_kegiatan[], top_rajin[] (5), top_alpha[] (5)
```

> Rincian per kegiatan memakai kunci **`per_kegiatan`**, bukan `kegiatans`.

---

## 12. Nilai enum

| Konstanta | Nilai |
|---|---|
| `VALID_ROLES` | `admin`, `pengurus`, `peserta` |
| `KEGIATAN_TYPES` | `rutin`, `khusus`, `asad` |
| `ABSEN_STATUS` | `hadir`, `izin`, `alpha` |
| `GENDER_OPTIONS` | `L`, `P` |
| `EDUCATION_OPTIONS` | `TK`, `SD`, `SMP`, `SMA`, `D1`–`D4`, `S1`–`S3` |
| `MUBALIGH_OPTIONS` | `belum`, `sudah` |
| `MUSY_CATEGORIES` | `4S`, `tim7` |
| Status kegiatan | `open`, `closed` |
| Status user | `active`, `pending`, `nonaktif` |
| `source` user | `seed`, `admin`, `qr_public` |

| Konstanta waktu | Nilai |
|---|---|
| `WITA` | UTC+8 |
| `SESSION_DAYS` | 365 |
| `SHARE_EXPIRE_DAYS` | 7 |
| `PERSONAL_QR_ROTATE` | 60 detik (+1 window grace) |
| `AUTO_CLOSE_INTERVAL` | 60 detik |
| Lockout login | 5 gagal / 15 menit |
