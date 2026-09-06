# Contoh Environment Variables untuk Vercel (1 project: frontend + backend)
# Salin isian ini ke Vercel → Project Settings → Environment Variables.
# JANGAN commit file .env yang berisi nilai asli.

# --- WAJIB ---
MONGO_URL=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
DB_NAME=ekertalangu
JWT_SECRET=ganti-dengan-string-acak-minimal-32-karakter
FRONTEND_URL=https://absen-ekertalangu.vercel.app
ADMIN_EMAIL=ageng.rider@gmail.com
ADMIN_PASSWORD=ganti-password-admin

# --- OPSIONAL ---
# Melindungi endpoint /api/cron/auto-close (Vercel Cron mengirim header
# Authorization: Bearer <CRON_SECRET>)
CRON_SECRET=ganti-dengan-string-acak

# Origin tambahan yang diizinkan CORS, dipisah koma
EXTRA_CORS_ORIGINS=

# --- JANGAN DISET DI VERCEL ---
# REACT_APP_BACKEND_URL  -> biarkan kosong/tidak ada agar frontend memakai /api relatif
# RUN_SCHEDULER          -> otomatis nonaktif di serverless
