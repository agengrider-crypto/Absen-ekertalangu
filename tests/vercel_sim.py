"""Simulator routing Vercel untuk memverifikasi vercel.json secara nyata.

Meniru urutan routing Vercel pada konfigurasi modern:
  1. Filesystem  -> sajikan file statis yang ADA di outputDirectory (frontend/build)
  2. rewrites[0] -> /api/(.*)  => /api/index  (Python serverless function)
  3. rewrites[1] -> /(.*)      => /index.html (SPA fallback)

Dijalankan dengan VERCEL=1 dan --lifespan off supaya benar-benar meniru lambda
(tanpa startup/lifespan event), sehingga ensure_init() harus jalan via middleware.
"""

import os
import sys
from pathlib import Path

BUILD_DIR = Path("/app/frontend/build")
BACKEND_DIR = Path("/app/backend")

for _p in (str(BACKEND_DIR),):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from server import app as fastapi_app  # noqa: E402
from starlette.responses import FileResponse, PlainTextResponse  # noqa: E402
from starlette.staticfiles import StaticFiles  # noqa: E402

_static = StaticFiles(directory=str(BUILD_DIR))

# Ekstensi aset: jika file tidak ada, Vercel TIDAK melempar ke index.html untuk
# permintaan aset (hasil build selalu ada), jadi kita balas 404 agar mudah dideteksi.
ASSET_EXT = {".js", ".css", ".map", ".png", ".jpg", ".jpeg", ".svg", ".ico",
             ".json", ".txt", ".woff", ".woff2", ".ttf", ".webmanifest"}


async def app(scope, receive, send):
    if scope["type"] != "http":
        return await fastapi_app(scope, receive, send)

    path = scope["path"]

    # --- Langkah 1: filesystem (aset statis hasil build) ---
    rel = path.lstrip("/")
    if rel:
        candidate = (BUILD_DIR / rel).resolve()
        if str(candidate).startswith(str(BUILD_DIR)) and candidate.is_file():
            return await _static(scope, receive, send)

    # --- Langkah 2: rewrite /api/(.*) -> /api/index (serverless function) ---
    if path.startswith("/api"):
        return await fastapi_app(scope, receive, send)

    # Aset yang tidak ada -> 404 (bukan index.html)
    if os.path.splitext(path)[1].lower() in ASSET_EXT:
        resp = PlainTextResponse("Not Found", status_code=404)
        return await resp(scope, receive, send)

    # --- Langkah 3: rewrite /(.*) -> /index.html (SPA fallback) ---
    resp = FileResponse(str(BUILD_DIR / "index.html"))
    return await resp(scope, receive, send)
