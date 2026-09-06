"""Entrypoint serverless Vercel untuk backend FastAPI E-KERTALANGU.

Vercel (@vercel/python) mendeteksi variabel `app` bertipe ASGI dan menjalankannya
sebagai serverless function. Semua request `/api/*` diarahkan ke file ini
(lihat `vercel.json`), sehingga frontend dan backend berada di SATU domain
(satu project Vercel, tanpa CORS).

Kode backend tetap berada di folder `backend/` supaya bisa dijalankan juga
sebagai server biasa (uvicorn) untuk pengembangan lokal / sandbox.
"""

import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"

for _p in (str(BACKEND_DIR), str(ROOT_DIR)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from server import app  # noqa: E402  (FastAPI ASGI app)

__all__ = ["app"]
