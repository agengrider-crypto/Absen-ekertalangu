# Referensi API

Semua endpoint berprefix **`/api`**. Auth memakai **JWT di httpOnly cookie** — bukan
header `Authorization`. Gunakan session yang menyimpan cookie.

Total: **82 endpoint**.

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
| POST | `/api/me/complete-account` | login dengan `must_change_password=true` | Lengkapi profil dan ganti kata sandi sementara `{name, gender, dob, phone, address, new_password, ...}` |

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
| GET | `/api/admin/users` | `require_staff` | Daftar akun, akun sistem dikecualikan |
| POST | `/api/admin/users` | `require_staff` | Buat akun (`AdminCreateUser`) |
| GET | `/api/admin/users/{user_id}` | `require_staff` | Detail (termasuk foto) |
| PATCH | `/api/admin/users/{user_id}` | `require_staff` | Ubah data (`PesertaUpdate`) |
| DELETE | `/api/admin/users/{user_id}` | `require_admin` | Hapus (tidak bisa hapus diri sendiri) |
| PATCH | `/api/admin/users/{user_id}/roles` | `require_admin` | `{roles: [...]}` |
| POST | `/api/admin/users/{user_id}/move` | `require_staff` | Pindah kelompok `{kelompok_id, keterangan}` — tercatat di log |
| POST | `/api/admin/users/{user_id}/reset-password` | `require_staff` | Reset sementara untuk akun berperan tunggal Peserta; respons berisi username dan sandi DDMMYYYY, wajib diganti saat login |
| GET | `/api/admin/users/{user_id}/photo` | `require_staff` | Foto sebagai gambar biner (404 bila belum ada) |
| POST | `/api/admin/users/bulk` | `require_staff` | Tambah banyak `{entries: [...], kelompok_id}` |
| POST | `/api/admin/users/bulk-delete` | `require_admin` | `{ids: [...]}` |
| POST | `/api/admin/users/bulk-activate` | `require_staff` | Aktifkan akun berperan tunggal Peserta yang pending `{ids: [...]}` dan tanggal lahirnya valid; set kata sandi sementara DDMMYYYY dan wajib ganti saat login |
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
| POST | `/api/admin/kegiatan` | `require_staff` | `KegiatanInput`. `recurring_months` 1/2/3/6/12 membuat jadwal bulanan sebanyak pilihan; `recurring: true` lama tetap membuat 4 jadwal mingguan |
| GET | `/api/admin/kegiatan/{kegiatan_id}` | `require_staff` | Detail |
| PATCH | `/api/admin/kegiatan/{kegiatan_id}` | `require_staff` | `KegiatanUpdate` |
| DELETE | `/api/admin/kegiatan/{kegiatan_id}` | `require_staff` | Hapus |
| POST | `/api/admin/kegiatan/{kegiatan_id}/close` | `require_staff` | Tutup manual, tandai peserta wajib yang belum diabsen sebagai Alpha, lalu cabut delegasi |
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
  "maps_query": "Masjid Kertalangu, Denpasar",
  "recurring": false,
  "recurring_months": 3,
  "attendance_participant_ids": ["user-id-1"],
  "sessions": [
    {
      "label": "Pagi",
      "start_time": "08:00",
      "end_time": "09:30",
      "participant_ids": ["user-id-1"]
    }
  ]
}
```

`recurring_months` menerima `1`, `2`, `3`, `6`, atau `12`; satu berarti satu jadwal pada
bulan yang dipilih. Jam selesai harus lebih akhir daripada jam mulai di tanggal yang sama.
`maps_query` menyimpan alamat/kata kunci (bukan URL Maps); tautan Maps dibentuk di UI saat
ditampilkan. `attendance_participant_ids` menentukan peserta wajib pada kegiatan tunggal.
Pada jadwal bersesi, tiap sesi dapat memiliki `participant_ids` sendiri. Peserta di luar
pilihan tetap terlihat, tetapi tidak otomatis dihitung Alpha.

---

## 6. Absensi, rekap, QR kegiatan

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| POST | `/api/admin/kegiatan/{kegiatan_id}/absen` | `require_staff` | `{user_id, status}` — `hadir`\|`izin`\|`sakit`\|`alpha`. Upsert; Alpha ditolak sebelum waktu selesai atau kegiatan ditutup |
| GET | `/api/admin/kegiatan/{kegiatan_id}/rekap` | `require_staff` | `counts` + hitungan gender/status + baris peserta. Setelah kegiatan ditutup, peserta wajib yang belum diabsen otomatis berstatus Alpha |
| GET | `/api/admin/kegiatan/{kegiatan_id}/rekap-gabungan` | `require_staff` | Rekap per sesi (pagi/sore/malam); tidak menghitung agregat hadir lintas sesi |
| POST | `/api/admin/kegiatan/{kegiatan_id}/share-gabungan` | `require_staff` | Tautan publik rekap per sesi, berlaku 7 hari |
| GET | `/api/admin/kegiatan/{kegiatan_id}/qr` | `require_staff` | QR menuju halaman rekap |
| POST | `/api/admin/kegiatan/{kegiatan_id}/share` | `require_staff` | Tautan rekap publik, berlaku 7 hari |
| POST | `/api/admin/kegiatan/{kegiatan_id}/absen-qr` | `require_staff` | QR absen mandiri → `{token, link, image}` |
| GET | `/api/admin/kegiatan/{kegiatan_id}/feedback` | `require_staff` | Pesan/kesan dari peserta |
| GET | `/api/staff/kegiatan/{kegiatan_id}/reminder` | `require_staff` | Teks pengingat + daftar penerima format `62…` untuk `wa.me` |
| POST | `/api/staff/kegiatan/{kegiatan_id}/scan-personal` | `require_staff` | `{content}` — hasil scan QR pribadi jamaah |

`counts` selalu berbentuk:

```json
{
  "total": 120, "hadir": 87, "izin": 5, "sakit": 2, "alpha": 10,
  "belum_diabsen": 16, "ratio": 72.5
}
```

Sebelum kegiatan ditutup, peserta tanpa status dihitung sebagai `belum_diabsen`.
Saat kegiatan ditutup manual atau otomatis setelah jam selesai, peserta wajib yang belum
memiliki status absensi otomatis dicatat sebagai Alpha; peserta di luar daftar wajib tidak
diubah. `ratio` adalah hadir dibagi total. Rekap multi-sesi menampilkan persentase
kehadiran pada setiap sesi secara terpisah;
tidak ada hitungan gabungan seperti hadir minimal satu sesi atau hadir semua sesi.

---

### Laporan per peserta

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| GET | `/api/admin/laporan/peserta?month=YYYY-MM&week=bulanan\|1..5&q=` | `require_staff` | Daftar peserta (pencarian hanya nama), hitungan Hadir/Izin/Sakit/Alpha/Belum diabsen untuk satu bulan atau pekan |
| GET | `/api/admin/laporan/peserta/{user_id}?month=YYYY-MM&week=bulanan\|1..5` | `require_staff` | Detail peserta, ringkasan periode terpilih, kegiatan, serta ringkasan bulanan enam bulan terakhir |
| POST | `/api/admin/laporan/peserta/{user_id}/share?month=YYYY-MM&week=bulanan\|1..5` | `require_staff` | Membuat tautan publik laporan peserta yang berlaku 30 hari |
| GET | `/api/laporan-peserta/{token}` | — | Membaca laporan melalui token publik; **410** bila kedaluwarsa, **404** bila tidak ditemukan |

Pekan dibagi per tanggal dalam bulan: pekan 1 tanggal 1–7, pekan 2 tanggal 8–14,
dan seterusnya. Tanggal di masa depan tidak ikut dihitung. Daftar dan laporan hanya
menampilkan nama peserta, tanpa nomor HP atau email. Tautan berbagi memakai token acak
dan berlaku 30 hari; halaman publik menampilkan nama, periode, ringkasan kehadiran, dan
kegiatan tanpa menampilkan data kontak.

---

## 7. Endpoint publik berbasis token

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| GET | `/api/rekap/{token}` | — | Rekap publik. **410** bila kedaluwarsa, **404** bila token salah |
| GET | `/api/rekap-gabungan/{token}` | — | Rekap status tiap sesi secara terpisah; tanpa ringkasan hadir lintas sesi |
| GET | `/api/laporan/{token}` | — | **Laporan publik (tautan permanen)**. **404** bila token salah |
| POST | `/api/absensi/{token}/share-rekap` | Sesi absensi terverifikasi | `{access}` — buat/ambil tautan publik rekap untuk dibagikan, berlaku 7 hari |
| POST | `/api/absensi/{token}/verify` | — | `{code}` — verifikasi kode akses untuk membuka halaman absensi |
| GET | `/api/absensi/{token}` | Sesi absensi terverifikasi | Info kegiatan, rekap status, dan daftar peserta |
| GET | `/api/absen/{token}` | — | Info kegiatan + daftar peserta (dipakai absen **manual**) |
| POST | `/api/absen/{token}/mark` | — | `{user_id}` — **403** bila kegiatan sudah ditutup |
| POST | `/api/absen/{token}/feedback` | — | `{name?, message}` |

> **Absen mandiri tidak lagi memakai `/api/absen/{token}/mark`.** Sejak Fase 6, peserta
> wajib login dan memakai `/api/me/absen/{token}` + `/api/me/absen/{token}/mark`
> (lihat bagian 10) sehingga hanya bisa mengabsenkan **dirinya sendiri**.

**Respons `/api/laporan/{token}`** — sama seperti `/api/admin/laporan` ditambah
`title`, `mode` (`harian|bulanan|custom`), `created_by`, `created_at`.

---

## 8. Delegasi (Penjaga Absen)

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| POST | `/api/staff/kegiatan/{kegiatan_id}/delegate` | `require_staff` | `{grantee_id, reason?}` — `reason` **opsional** |
| GET | `/api/staff/kegiatan/{kegiatan_id}/delegations` | `require_staff` | Daftar delegasi |
| POST | `/api/staff/delegation/{deleg_id}/revoke` | `require_staff` | Cabut manual |
| GET | `/api/me/delegations` | login | Delegasi aktif milik saya |
| GET | `/api/delegate/kegiatan/{kegiatan_id}` | login + delegasi | Info kegiatan untuk penjaga absen |
| POST | `/api/delegate/kegiatan/{kegiatan_id}/absen` | login + delegasi | `{user_id, status}` — absen **manual** |
| POST | `/api/delegate/kegiatan/{kegiatan_id}/scan-personal` | login + delegasi | `{content}` — absen **scan barcode** QR pribadi peserta. **403** tanpa delegasi, **400** QR tidak sah, **404** peserta tidak ditemukan |

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
| GET | `/api/me/absen/{token}` | login | **Absen mandiri terfokus** — hanya data diri sendiri (`kegiatan` + `me`). **401** tanpa login |
| POST | `/api/me/absen/{token}/mark` | login | Tandai **diri sendiri** hadir. **403** kegiatan ditutup / bukan peserta / profil belum lengkap. Balas `already: true` bila sudah tercatat |

---

## 11. Dashboard & laporan

| Method | Path | Guard | Keterangan |
|---|---|---|---|
| GET | `/api/admin/dashboard` | `require_staff` | Statistik panel |
| GET | `/api/admin/laporan` | `require_staff` | `?date_from=&date_to=` |
| GET | `/api/admin/laporan/export` | `require_staff` | `?format=excel\|pdf&date_from=&date_to=` — file biner |
| POST | `/api/admin/laporan/share` | `require_staff` | `{date_from, date_to, mode}` — buat **tautan laporan publik permanen**. Balas `{token, link, image (QR data URL), title, mode}`. **Idempoten**: rentang + mode yang sama memakai token yang sama. **400** bila tanggal kosong / `date_from > date_to` |

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
gender_hadir, per_kegiatan[], per_peserta[], top_rajin[] (5), top_alpha[] (5)
```

> Rincian per kegiatan memakai kunci **`per_kegiatan`**, bukan `kegiatans`.

`per_peserta[]` (baru sejak Fase 6) berisi seluruh peserta terurut nama:
`{name, gender, account_status, hadir, izin, alpha, ratio}` — dipakai dropdown
"Rekap per Peserta" pada panel laporan dan halaman laporan publik.

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
