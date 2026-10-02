"""Seed data contoh untuk preview (jamaah + kegiatan bersesi + absensi bulan ini)."""
import os
import random
import re
import sys

import requests

BASE = "https://repo-preview-show.preview.emergentagent.com"
API = f"{BASE}/api"
env = dict(re.findall(r'(\w+)="?([^"\n]*)"?', open('/app/backend/.env').read()))
s = requests.Session()
r = s.post(f"{API}/auth/login", json={"identifier": env["ADMIN_EMAIL"], "password": env["ADMIN_PASSWORD"]})
r.raise_for_status()
print("login ok")

kel = s.get(f"{API}/admin/kelompok").json()
kel_ids = [k["id"] for k in kel] or [None]
print("kelompok:", [k["name"] for k in kel])

JAMAAH = [
    ("Budi Santoso", "L", "1988-03-12"), ("Ahmad Fauzi", "L", "1995-07-04"),
    ("Slamet Riyadi", "L", "1979-11-23"), ("Hendra Gunawan", "L", "2001-01-30"),
    ("Made Arifin", "L", "1992-05-18"), ("Rizky Pratama", "L", "2004-09-09"),
    ("Siti Aminah", "P", "1990-02-14"), ("Nur Halimah", "P", "1985-06-21"),
    ("Dewi Lestari", "P", "1998-12-02"), ("Wulan Sari", "P", "2003-04-27"),
    ("Fatimah Az Zahra", "P", "1996-08-15"), ("Umi Kulsum", "P", "1972-10-05"),
]
users = []
for i, (name, g, dob) in enumerate(JAMAAH):
    d, m, y = dob.split("-")[2], dob.split("-")[1], dob.split("-")[0]
    payload = {"name": name, "gender": g, "dob": dob,
               "phone": f"0812900{i:04d}", "address": "Kertalangu, Denpasar",
               "marital": "sudah_menikah" if i % 3 else "belum_menikah",
               "kelompok_id": kel_ids[i % len(kel_ids)], "roles": ["peserta"],
               "password": f"{d}{m}{y}"}
    rr = s.post(f"{API}/admin/users", json=payload)
    if rr.status_code >= 400:
        print("skip", name, rr.text[:120])
        continue
    users.append(rr.json())
print("jamaah dibuat:", len(users))

MONTH = "2026-09"
DATES = ["2026-09-02", "2026-09-06", "2026-09-09", "2026-09-13", "2026-09-16", "2026-09-20", "2026-09-23"]
for idx, date in enumerate(DATES):
    body = {
        "name": "Pengajian Rutin Kertalangu" if idx % 2 == 0 else "Pengajian Umum Malam",
        "type": "rutin", "date": date, "start_time": "05:30", "end_time": "21:00",
        "teacher": "Ust. Hasan Basri", "material": "Kitab Fiqih Bab Sholat",
        "location": "Masjid Kertalangu", "audience": "reguler",
        "sessions": [
            {"label": "Pagi", "start_time": "05:30", "end_time": "07:00",
             "teacher": "Ust. Hasan Basri", "material": "Tafsir Al-Qur'an", "required": True},
            {"label": "Sore", "start_time": "16:00", "end_time": "17:30",
             "teacher": "Ust. Abdul Latif", "material": "Fiqih Ibadah", "required": True},
            {"label": "Malam", "start_time": "19:30", "end_time": "21:00",
             "teacher": "Ust. Solihin", "material": "Nasihat & Kajian Hadits", "required": False},
        ],
    }
    rr = s.post(f"{API}/admin/kegiatan", json=body)
    print(date, rr.status_code, str(rr.json())[:80] if rr.status_code < 400 else rr.text[:150])

kegs = s.get(f"{API}/admin/kegiatan", params={"month": MONTH}).json()
if isinstance(kegs, dict):
    kegs = kegs.get("items") or kegs.get("kegiatan") or []
print("total kegiatan (sesi):", len(kegs))

random.seed(7)
uids = [u["id"] for u in users]
marked = 0
by_date = {}
for k in kegs:
    by_date.setdefault(k.get("date"), []).append(k)
for date, sess in by_date.items():
    sess.sort(key=lambda x: x.get("start_time") or "")
    for uid in uids:
        roll = random.random()
        if roll < 0.12:
            target, status = sess[0], "izin"
        elif roll < 0.22:
            continue  # alpha (tidak ditandai)
        else:
            target = sess[0] if roll < 0.7 else sess[min(1, len(sess) - 1)]
            status = "hadir"
        rr = s.post(f"{API}/admin/kegiatan/{target['id']}/absen", json={"user_id": uid, "status": status})
        if rr.status_code < 400:
            marked += 1
print("absensi ditandai:", marked)

rk = s.get(f"{API}/staff/rekap-bulanan", params={"month": MONTH}).json()
print("rekap:", rk.get("total_pertemuan"), "pertemuan,", rk.get("total_peserta"), "jamaah,",
      "rata-rata", rk.get("summary", {}).get("rata_rata"))
sh = s.post(f"{API}/staff/rekap-bulanan/share", params={"month": MONTH}).json()
print("share link:", sh)
