"""Seed data contoh untuk MODE DEMO (database terpisah `<DB_NAME>_demo`).

Jalankan: python3 /app/scripts/seed_demo_workspace.py
Login demo: demo / demo1234
"""
import random

import requests

BASE = "https://repo-preview-show.preview.emergentagent.com"
API = f"{BASE}/api"

s = requests.Session()
r = s.post(f"{API}/auth/login", json={"identifier": "demo", "password": "demo1234"})
r.raise_for_status()
print("login demo ok ·", r.json().get("name"), "demo =", r.json().get("demo"))

kel = s.get(f"{API}/admin/kelompok").json()
kel_ids = [k["id"] for k in kel] or [None]
print("kelompok:", [k["name"] for k in kel])

PESERTA = [
    ("Demo Arif Budiman", "L", "1987-04-11"), ("Demo Yusuf Hadi", "L", "1994-09-02"),
    ("Demo Rahmat Ali", "L", "2002-06-17"), ("Demo Ika Puspita", "P", "1991-01-25"),
    ("Demo Laila Rahma", "P", "1999-11-08"), ("Demo Sri Wahyuni", "P", "1975-07-30"),
]
users = []
for i, (name, g, dob) in enumerate(PESERTA):
    y, m, d = dob.split("-")
    payload = {"name": name, "gender": g, "dob": dob,
               "phone": f"0811000{i:04d}", "address": "Kertalangu, Denpasar (demo)",
               "marital": "sudah_menikah" if i % 2 else "belum_menikah",
               "kelompok_id": kel_ids[i % len(kel_ids)], "roles": ["peserta"],
               "password": f"{d}{m}{y}"}
    rr = s.post(f"{API}/admin/users", json=payload)
    if rr.status_code >= 400:
        print("skip", name, rr.text[:120])
        continue
    users.append(rr.json())
print("peserta demo dibuat:", len(users))

DATES = ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"]
for idx, date in enumerate(DATES):
    body = {
        "name": "DEMO · Pengajian Rutin" if idx % 2 == 0 else "DEMO · Kajian Malam",
        "type": "rutin", "date": date, "start_time": "16:00", "end_time": "21:00",
        "teacher": "Ust. Demo Hasan", "material": "Materi Latihan",
        "location": "Masjid Demo Kertalangu", "audience": "reguler",
        "sessions": [
            {"label": "Sore", "start_time": "16:00", "end_time": "17:30",
             "teacher": "Ust. Demo Hasan", "material": "Fiqih Dasar", "required": True},
            {"label": "Malam", "start_time": "19:30", "end_time": "21:00",
             "teacher": "Ust. Demo Latif", "material": "Kajian Hadits", "required": True},
        ],
    }
    rr = s.post(f"{API}/admin/kegiatan", json=body)
    print(date, rr.status_code)

kegs = []
for month in ("2026-09", "2026-10"):
    kegs += s.get(f"{API}/admin/kegiatan", params={"month": month}).json()
print("total jadwal (sesi):", len(kegs))

random.seed(11)
marked = 0
for k in kegs:
    for u in users:
        roll = random.random()
        if roll < 0.15:
            status = "izin"
        elif roll < 0.3:
            continue
        else:
            status = "hadir"
        rr = s.post(f"{API}/admin/kegiatan/{k['id']}/absen",
                    json={"user_id": u["id"], "status": status})
        if rr.status_code < 400:
            marked += 1
print("absensi demo ditandai:", marked)

rk = s.get(f"{API}/staff/rekap-bulanan", params={"month": "2026-09"}).json()
print("rekap demo:", rk.get("total_pertemuan"), "pertemuan,", rk.get("total_peserta"), "peserta")
