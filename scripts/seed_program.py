"""Isi awal Program Pembelajaran: kurikulum, materi, dan jadwal untuk tiap jenjang.

Jalankan (data real):  python3 /app/scripts/seed_program.py
Jalankan (data demo):  python3 /app/scripts/seed_program.py demo
"""
import re
import sys

import requests

BASE = "https://repo-preview-show.preview.emergentagent.com"
API = f"{BASE}/api"

MODE = (sys.argv[1] if len(sys.argv) > 1 else "real").lower()
if MODE == "demo":
    CRED = {"identifier": "demo", "password": "demo1234"}
else:
    env = dict(re.findall(r'(\w+)="?([^"\n]*)"?', open("/app/backend/.env").read()))
    CRED = {"identifier": env["ADMIN_EMAIL"], "password": env["ADMIN_PASSWORD"]}

s = requests.Session()
r = s.post(f"{API}/auth/login", json=CRED)
r.raise_for_status()
print("login ok ·", r.json().get("name"), "· demo =", r.json().get("demo"))

KUR = {
    "paud": {
        "tujuan": "Mengenal Allah dan Rasul lewat cerita sederhana, hafal doa harian pendek "
                  "(doa makan, tidur, masuk kamar mandi), serta mengenal 10 huruf hijaiyah awal.",
        "metode": "Media bermain: kartu bergambar besar, boneka tangan, lagu hijaiyah, "
                  "video animasi 3–5 menit, mewarnai, dan tepuk/gerak lagu. Satu materi "
                  "maksimal 10 menit lalu ganti kegiatan.",
        "catatan": "Durasi total 30 menit. Banyak pujian, hindari menegur keras, "
                   "libatkan orang tua untuk mengulang di rumah.",
    },
    "cabe": {
        "tujuan": "Lancar membaca Al-Qur'an sesuai tingkatan, hafal doa harian dan surat pendek, "
                  "memahami akhlak dasar (jujur, hormat orang tua, salam), serta tertib ibadah "
                  "sholat lima waktu.",
        "metode": "Media campuran: papan tulis, buku prestasi/iqro, kartu ayat, tayangan video "
                  "kisah nabi, permainan kuis kelompok, dan praktik wudhu/sholat berjamaah. "
                  "Pola 10 menit hafalan – 20 menit materi – 10 menit kuis.",
        "catatan": "Pakai buku prestasi agar perkembangan tiap anak terpantau. Beri bintang "
                   "untuk yang tuntas hafalan pekan itu.",
    },
    "muda": {
        "tujuan": "Memahami fiqih ibadah dan muamalah sehari-hari, menjaga akhlak pergaulan, "
                  "mampu menyampaikan materi secara sederhana, dan siap berperan dalam kegiatan "
                  "jamaah.",
        "metode": "Media diskusi: slide presentasi, mind map, studi kasus, bedah ayat/hadits, "
                  "latihan public speaking, dan tugas proyek kecil (bakti sosial, dokumentasi "
                  "kegiatan). Tautan bacaan dibagikan sebelum pertemuan.",
        "catatan": "Beri ruang tanya jawab terbuka. Materi pra nikah dibawakan terpisah "
                   "putra/putri sesuai kebutuhan.",
    },
}

MATERI = {
    "paud": [
        (1, "Mengenal Huruf Hijaiyah (alif – tsa)", "Lagu hijaiyah + kartu bergambar besar, lalu menebalkan huruf."),
        (2, "Doa Sebelum & Sesudah Makan", "Tepuk doa, praktik makan bersama sambil melafalkan doa."),
        (3, "Kisah Nabi Muhammad Kecil", "Boneka tangan + video animasi 4 menit, tanya jawab ringan."),
    ],
    "cabe": [
        (1, "Tartil & Tajwid Dasar", "Baca bersama per baris, guru mencontohkan, murid menirukan, lalu setoran satu-satu."),
        (2, "Sholat: Gerakan & Bacaan", "Peragaan langsung di depan kelas, dilanjutkan praktik berjamaah."),
        (3, "Akhlak kepada Orang Tua", "Studi kasus singkat + video kisah, ditutup komitmen pekan ini."),
        (4, "Hafalan Surat Pendek", "Metode talaqqi 3x ulang, kuis sambung ayat antar kelompok."),
    ],
    "muda": [
        (1, "Fiqih Thaharah & Sholat Praktis", "Slide + studi kasus harian, bedah pertanyaan peserta."),
        (2, "Akhlak Pergaulan Muda-Mudi", "Diskusi kelompok dengan kasus nyata, kesimpulan ditulis bersama."),
        (3, "Latihan Menyampaikan Materi", "Setiap peserta tampil 3 menit, dinilai teman sekelas."),
        (4, "Persiapan Keluarga Sakinah", "Bedah hak & kewajiban suami-istri, tanya jawab tertutup."),
    ],
}

JADWAL = {
    "paud": ("Ahad", "08:00", "08:30", "Ustadzah Nur Aisyah", "Ruang PAUD"),
    "cabe": ("Ahad", "08:00", "09:30", "Ust. Hasan Basri", "Ruang Cabe Rawit"),
    "muda": ("Sabtu", "19:30", "21:00", "Ust. Abdul Latif", "Masjid Kertalangu"),
}


def bucket(jid: str) -> str:
    if jid == "paud":
        return "paud"
    if jid.startswith("cabe"):
        return "cabe"
    return "muda"


jenjang = s.get(f"{API}/program/jenjang").json()["items"]
print("jenjang:", len(jenjang))

for j in jenjang:
    jid = j["id"]
    b = bucket(jid)
    s.put(f"{API}/program/{jid}/kurikulum", json=KUR[b])

    existing = {m["title"] for m in s.get(f"{API}/program/{jid}").json()["materi"]}
    added = 0
    for pekan, title, desc in MATERI[b]:
        if title in existing:
            continue
        rr = s.post(f"{API}/program/{jid}/materi",
                    json={"title": title, "description": desc, "pekan": pekan, "media": []})
        added += 1 if rr.status_code < 400 else 0

    detail = s.get(f"{API}/program/{jid}").json()
    if not detail["jadwal"]:
        day, st, en, teacher, loc = JADWAL[b]
        s.post(f"{API}/program/{jid}/jadwal",
               json={"day": day, "start_time": st, "end_time": en,
                     "teacher": teacher, "location": loc, "note": ""})
    print(f"  {j['label']}: +{added} materi")

print("selesai.")
