import json, requests, datetime
API = "https://github-absen-preview.preview.emergentagent.com/api"
s = requests.Session()
r = s.post(f"{API}/auth/login", json={"identifier": "ageng.rider@gmail.com", "password": "jokam354"})
print("login", r.status_code)
today = datetime.date.today().isoformat()

# 1. Buat kegiatan 2 sesi dengan pengajar/materi/lokasi per sesi
payload = {
    "name": "Uji Sesi FASE12", "type": "rutin", "date": today,
    "start_time": "08:00", "end_time": "10:00",
    "teacher": "Pengajar Induk", "location": "Masjid Induk", "material": "Materi Induk",
    "sessions": [
        {"label": "Pagi", "start_time": "08:00", "end_time": "10:00",
         "teacher": "Ust. Pagi", "material": "Tafsir", "location": "Aula A"},
        {"label": "Malam", "start_time": "19:30", "end_time": "21:00"},
    ],
}
r = s.post(f"{API}/admin/kegiatan", json=payload)
print("create", r.status_code)
items = r.json()
for it in items:
    print("  ", it["session_label"], it["teacher"], "|", it["material"], "|", it["location"])
pagi, malam = items[0], items[1]

# 2. QR absen: 1 token per hari untuk semua sesi
q1 = s.post(f"{API}/admin/kegiatan/{pagi['id']}/absen-qr").json()
q2 = s.post(f"{API}/admin/kegiatan/{malam['id']}/absen-qr").json()
print("token sama:", q1["token"] == q2["token"], "expires:", q1["expires_at"], "sessions:", q1.get("sessions"))

# 3. Absen peserta di sesi pagi
rows = s.get(f"{API}/admin/kegiatan/{pagi['id']}/rekap").json()["rows"]
if not rows:
    print("!! tidak ada peserta, lewati uji sesi ganda")
else:
    p = rows[0]
    r = s.post(f"{API}/admin/kegiatan/{pagi['id']}/absen", json={"user_id": p["user_id"], "status": "hadir"})
    print("absen pagi", r.status_code, r.json().get("message"))
    # coba absen orang yang sama di sesi malam -> harus ditolak
    r = s.post(f"{API}/admin/kegiatan/{malam['id']}/absen", json={"user_id": p["user_id"], "status": "hadir"})
    print("absen malam (harus 400):", r.status_code, r.json().get("detail"))
    rk = s.get(f"{API}/admin/kegiatan/{malam['id']}/rekap").json()
    row = [x for x in rk["rows"] if x["user_id"] == p["user_id"]][0]
    print("rekap malam counts:", rk["counts"])
    print("baris peserta:", row["name"], "attended_other:", row["attended_other"], row["attended_other_label"])

# 4. Share link rekap gabungan
sh = s.post(f"{API}/admin/kegiatan/{pagi['id']}/share-gabungan").json()
print("share gabungan:", sh["link"])
pub = requests.get(f"{API}/rekap-gabungan/{sh['token']}")
print("publik gabungan:", pub.status_code, pub.json().get("summary"))

# 5. Musyawarah pleno + share
m = s.post(f"{API}/staff/musyawarah", json={"category": "pleno", "content": "Uji pleno", "date": today})
print("musy pleno", m.status_code, m.json().get("category_label"))
mid = m.json()["id"]
ms = s.post(f"{API}/staff/musyawarah/{mid}/share").json()
print("musy link:", ms["link"])
print("musy publik:", requests.get(f"{API}/musyawarah/{ms['token']}").status_code)

# 6. Notifikasi peserta
u = s.get(f"{API}/me/updates").json()
print("updates:", len(u["items"]), u["items"][0] if u["items"] else None)

# 7. Pantau login admin-only (login as admin -> masih 200)
print("login-monitor admin:", s.get(f"{API}/staff/login-monitor").status_code)

# cleanup
for it in items:
    s.delete(f"{API}/admin/kegiatan/{it['id']}")
s.delete(f"{API}/staff/musyawarah/{mid}")
print("cleanup done")
