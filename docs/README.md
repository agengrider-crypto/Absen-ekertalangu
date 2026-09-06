# Dokumentasi E-KERTALANGU

Indeks seluruh dokumentasi project.

## Mulai dari mana?

| Anda… | Baca ini |
|---|---|
| Baru pertama kali melihat project ini | [`../README.md`](../README.md) |
| AI agent / developer yang akan menulis kode | [`../AGENTS.md`](../AGENTS.md) — **wajib** |
| Ingin tahu alasan di balik keputusan teknis | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Butuh referensi endpoint | [`API.md`](API.md) |
| Butuh skema database | [`DATABASE.md`](DATABASE.md) |
| Mengerjakan login / hak akses | [`AUTH.md`](AUTH.md) |
| Ingin paham fitur dari sisi pengguna | [`FEATURES.md`](FEATURES.md) |
| Akan menguji perubahan | [`TESTING.md`](TESTING.md) |
| Sedang menghadapi error | [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) |
| Akan deploy | [`../DEPLOY_VERCEL.md`](../DEPLOY_VERCEL.md) |
| Ingin riwayat perubahan | [`../CHANGELOG.md`](../CHANGELOG.md) |
| Ingin riwayat keputusan per fase | [`../memory/PRD.md`](../memory/PRD.md) |

## Ringkasan sistem

```
                    ┌───────────────────────────────┐
                    │   1 domain Vercel (1 project)  │
                    ├───────────────────────────────┤
  Browser  ───────► │ /            → index.html      │  React SPA (CRA + Tailwind
                    │ /static/**   → aset build      │  + shadcn/ui)
                    │ /api/**      → api/index.py    │  FastAPI serverless
                    └───────────────┬───────────────┘
                                    │ motor (async)
                                    ▼
                          MongoDB Atlas — 10 collection
```

| Angka | Nilai |
|---|---|
| Endpoint API | 80 |
| Collection MongoDB | 10 |
| Halaman/tab React | 29 |
| Komponen shadcn/ui | 46 |
| Peran pengguna | 3 (admin, pengurus, peserta) |
| Jalur pencatatan absensi | 3 (manual, scan QR pribadi, absen mandiri) |
| Zona waktu domain | WITA (UTC+8) |
