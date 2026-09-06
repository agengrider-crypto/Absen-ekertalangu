# Autentikasi & Otorisasi

## 1. Ringkasan

| Aspek | Pilihan |
|---|---|
| Penyimpanan token | **httpOnly cookie** (bukan header `Authorization`) |
| Format token | JWT HS256, ditandatangani `JWT_SECRET` |
| Cookie | `access_token` + `refresh_token` — `httponly`, `secure`, `samesite=none`, `path=/` |
| Hash password | bcrypt |
| Masa sesi | 365 hari (`SESSION_DAYS`) |
| Pencabutan sesi | `token_version` per user |
| Lockout | 5 percobaan gagal / 15 menit → HTTP 429 |

**Kenapa cookie, bukan Bearer?** Token tidak bisa dibaca JavaScript (tahan XSS),
frontend tidak perlu mengurus penyimpanan token, dan karena frontend+backend satu
domain, cookie otomatis terkirim.

**Implikasi untuk pengujian:** wajib memakai session yang menyimpan cookie.

```bash
curl -c ck.txt -X POST localhost:8001/api/auth/login \
  -H "Content-Type: application/json" -d '{"identifier":"admin","password":"..."}'
curl -b ck.txt localhost:8001/api/auth/me
```

```python
s = requests.Session()                       # BENAR
s.post(f"{BASE}/api/auth/login", json={...})
s.get(f"{BASE}/api/auth/me")
```

---

## 2. Login fleksibel

Satu kolom menerima **email**, **username**, atau **nomor HP**:

```python
user = await db.users.find_one({"$or": [
    {"email": ident},      # ident = identifier.strip().lower()
    {"username": ident},
    {"phone": body.identifier.strip()},   # nomor HP TIDAK di-lowercase
]})
```

Alasan: jamaah lansia sering tidak ingat mana yang dipakai saat mendaftar.

Alur `POST /api/auth/login`:

```
1. Cari user (email OR username OR phone)
2. Cek lockout — kunci = user._id bila user ada, kalau tidak = identifier
   → ≥ 5 gagal dalam 15 menit  → 429 "Terlalu banyak percobaan. Coba lagi dalam 15 menit."
3. bcrypt.checkpw
   → gagal → catat di login_attempts → 401 "Akun atau kata sandi salah"
4. status != "active"  → 403 "Akun belum aktif. Silakan aktivasi terlebih dahulu."
5. Hapus catatan login_attempts
6. Set 2 cookie + catat activity_logs
7. Kembalikan public_user(user)
```

> Kunci lockout memakai `user._id` bila akun ditemukan. Ini mencegah penyerang
> menghindari lockout dengan mengganti-ganti bentuk identifier (email vs username vs HP)
> untuk akun yang sama.

---

## 3. Isi token & pencabutan sesi

```python
{"sub": "<user_id>", "ver": <token_version>, "type": "access"|"refresh", "exp": ...}
```

`get_current_user()` memverifikasi tanda tangan **dan** mencocokkan
`payload["ver"] == user["token_version"]`.

Mencabut seluruh sesi seorang pengguna:

```python
await db.users.update_one({"_id": uid}, {"$inc": {"token_version": 1}})
```

Semua cookie lama langsung tidak sah. Ini mitigasi untuk masa sesi 365 hari, dan
otomatis dijalankan pada reset password mandiri.

---

## 4. Peran & guard

Tiga peran: `admin`, `pengurus`, `peserta`. Satu akun boleh punya **beberapa** peran
(field `roles` berupa array).

Guard berjenjang di backend:

```python
async def get_current_user(request)                 # → 401 bila tidak ada sesi sah
async def require_staff(user = Depends(...))        # → 403 kecuali admin ATAU pengurus
async def require_admin(user = Depends(...))        # → 403 kecuali admin
```

Pemetaan prefix → guard:

| Prefix | Guard |
|---|---|
| `/api/auth/*` | — (kecuali `/auth/me`) |
| `/api/admin/*` | `require_staff` atau `require_admin` |
| `/api/staff/*` | `require_staff` |
| `/api/me/*` | `get_current_user` |
| `/api/delegate/*` | `get_current_user` + cek delegasi aktif |
| `/api/rekap/{token}`, `/api/absen/{token}`, `/api/qr/public` | publik berbasis token |
| `/api/cron/*` | `CRON_SECRET` |

Operasi **destruktif atau menyangkut hak akses** memakai `require_admin`, bukan
`require_staff`: hapus user, hapus massal, ubah peran, dan CRUD kelompok.

Di frontend, guard berupa komponen pembungkus di `App.js`:

```jsx
<Route path="/roles" element={<Protected><RoleDashboard /></Protected>} />
<Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
```

---

## 5. `AuthContext` — satu sumber kebenaran

State `user` bersifat **tri-state**:

| Nilai | Arti | Yang harus dilakukan UI |
|---|---|---|
| `null` | Sedang memuat | Tampilkan loading |
| `false` | Anonim | Redirect ke `/login` |
| objek | Sudah login | Render halaman |

**Jangan** memanggil `/api/auth/me` dari komponen lain.

Saat halaman pertama dibuka, `AuthContext` memanggil `/api/auth/me`; bila 401 ia mencoba
`/api/auth/refresh`. Dua respons **401 di console adalah NORMAL** untuk pengunjung
anonim — bukan bug. Ini pernah dilaporkan keliru sebagai error.

---

## 6. Tiga jalur masuk akun

### a. Pendaftaran mandiri via QR publik

```
Pengurus cetak QR (GET /api/qr/public)
  → jamaah scan → /register?token=<token>
  → POST /api/auth/register {token, name, phone, email, dob, address, password}
  → token dicocokkan dengan app_settings.public_qr.token (400 bila salah)
  → akun dibuat: roles ["peserta"], status "active", source "qr_public"
  → langsung login (cookie di-set)
```

### b. Aktivasi akun yang didaftarkan pengurus

```
Pengurus input daftar nama (POST /api/admin/users/pending) → status "pending"
Pengurus cetak QR aktivasi (GET /api/staff/activation-qr) → /activate
  → jamaah cari namanya (GET /api/activation/search?q=)
  → POST /api/activation/complete {user_id, phone, dob, password, gender, ...}
  → dob WAJIB cocok data pengurus (403 bila tidak) — mencegah klaim nama orang lain
  → status menjadi "active", langsung login
```

### c. Dibuatkan langsung oleh pengurus

`POST /api/admin/users` dengan `password`, atau impor Excel
(`POST /api/admin/users/import`).

---

## 7. Reset password

### Mandiri — `POST /api/auth/self-reset`

Memakai `{phone, dob, new_password}`.

```python
if set(user.get("roles", [])) != {"peserta"}:
    raise HTTPException(403, "Reset mandiri hanya untuk akun Peserta. "
                             "Akun dengan peran lain hubungi administrator.")
```

> **Ini kontrol keamanan penting.** Versi awal mengizinkan semua peran, sehingga siapa
> pun yang tahu nomor HP + tanggal lahir seorang admin bisa mengambil alih akun admin.
> Batasan ke akun berperan **tunggal** `peserta` menutup celah itu — termasuk akun
> multi-peran seperti `["pengurus", "peserta"]`.

Berhasil → `token_version` dinaikkan (mencabut semua sesi lama) + catatan
`login_attempts` dihapus.

### Oleh pengurus — `POST /api/admin/users/{user_id}/reset-password`

Guard `require_staff`, tercatat di `activity_logs`.

---

## 8. QR pribadi rotating (anti titip-absen)

Untuk jalur absensi "pengurus memindai QR jamaah", QR harus tidak bisa
di-screenshot lalu dipakai orang lain.

```python
PERSONAL_QR_ROTATE = 60   # detik

window = int(now_utc.timestamp() // PERSONAL_QR_ROTATE)
sig    = hmac.new(JWT_SECRET, f"{user_id}.{window}", sha256).hexdigest()[:16]
token  = base64url(f"{user_id}.{window}.{sig}")     # dibungkus "EKP:<token>"
```

Verifikasi menerima `window` saat ini **dan** `window - 1` (grace period untuk toleransi
jeda scan), sehingga QR kedaluwarsa dalam ≤ 2 menit.

Tanda tangan HMAC berarti **tidak ada state yang perlu disimpan** — cukup `JWT_SECRET`.
Cocok untuk serverless.

---

## 9. Tautan publik berbasis token

| Tautan | Token | Masa berlaku |
|---|---|---|
| `/register?token=` | `app_settings.public_qr.token` | Permanen (bisa dicetak sekali) |
| `/activate` | — (tanpa token, pencarian nama + verifikasi dob) | Permanen |
| `/rekap/{token}` | `kegiatans.share_token` | **7 hari** → 410 bila lewat, 404 bila salah |
| `/absen/{token}` | `kegiatans.absen_token` | Selama kegiatan `open` → 403 bila sudah ditutup |

Semua URL-nya **dihitung per request** dari `resolve_base_url(request)`. Hanya token yang
tersimpan di database.

---

## 10. Environment yang memengaruhi auth

| Variabel | Wajib | Efek |
|---|---|---|
| `JWT_SECRET` | ✅ | Tanda tangan JWT **dan** HMAC QR pribadi. Menggantinya = mencabut semua sesi & QR aktif |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | ✅ | Akun admin seed. Password diselaraskan dengan env pada setiap init |
| `FRONTEND_URL` | ✅ | Base URL QR/tautan + daftar origin CORS |
| `CRON_SECRET` | – | Proteksi `/api/cron/auto-close` |

`JWT_SECRET` dibaca **saat dipakai**, bukan saat import:

```python
def get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise HTTPException(500, "JWT_SECRET belum diset pada environment server")
    return secret
```

Versi awal memakai `os.environ['JWT_SECRET']` di level modul — kalau env belum diset,
modul gagal di-import dan Vercel hanya menampilkan 500 tanpa pesan berguna.

---

## 11. Checklist saat mengerjakan auth

- [ ] Baca `memory/test_credentials.md` untuk kredensial yang benar
- [ ] Pakai session penyimpan cookie, **bukan** header Bearer
- [ ] Endpoint baru punya guard eksplisit
- [ ] Respons lewat `public_user()` — `password_hash` & `token_version` tidak boleh keluar
- [ ] Operasi destruktif/hak akses memakai `require_admin`, bukan `require_staff`
- [ ] Perubahan password menaikkan `token_version`
- [ ] Pesan error bahasa Indonesia sederhana
- [ ] Seed tetap idempoten
- [ ] **Jangan** menyarankan "hapus cache / mode incognito" sebagai solusi bug auth —
      baca log backend dan cari akar masalahnya
