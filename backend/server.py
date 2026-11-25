from dotenv import load_dotenv
from contextvars import ContextVar
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import logging
import base64
import io
import time
import re
import secrets
import random
import hashlib
import hmac
import uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
from typing import List, Optional, Annotated

import bcrypt
import jwt
import qrcode
import requests
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.responses import StreamingResponse, Response as FastResponse, JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict
from pymongo import UpdateOne
from pymongo.errors import DuplicateKeyError

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# ---------------------------------------------------------------------------
# Database (serverless-friendly: single global client, small pool, TLS via certifi)
# ---------------------------------------------------------------------------
IS_SERVERLESS = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))

mongo_url = os.environ.get('MONGO_URL') or os.environ.get('MONGODB_URI')
if not mongo_url:
    raise RuntimeError("MONGO_URL (atau MONGODB_URI) belum diset di environment")

_mongo_kwargs = {
    "maxPoolSize": 5 if IS_SERVERLESS else 20,
    "minPoolSize": 0,
    "serverSelectionTimeoutMS": 15000,
    "connectTimeoutMS": 15000,
    "socketTimeoutMS": 30000,
    "retryWrites": True,
    "appname": "e-kertalangu",
}
if mongo_url.startswith("mongodb+srv://") or "tls=true" in mongo_url or "ssl=true" in mongo_url:
    try:
        import certifi
        _mongo_kwargs["tlsCAFile"] = certifi.where()
    except Exception:  # pragma: no cover
        pass

client = AsyncIOMotorClient(mongo_url, **_mongo_kwargs)
_DB_NAME = os.environ.get('DB_NAME') or 'ekertalangu'
_db_real = client[_DB_NAME]
_db_demo = client[f"{_DB_NAME}_demo"]

# FASE 19 — Mode Demo: data demo benar-benar terpisah (database sendiri).
# Semua query memakai proxy `db` yang mengikuti konteks request (real / demo),
# jadi akun demo tidak pernah menyentuh data real.
_current_db = ContextVar("current_db", default=None)


class _DbProxy:
    @staticmethod
    def _target():
        cur = _current_db.get()
        return _db_real if cur is None else cur

    def __getattr__(self, name):
        return getattr(self._target(), name)

    def __getitem__(self, name):
        return self._target()[name]


db = _DbProxy()


def use_demo_db(demo: bool) -> None:
    _current_db.set(_db_demo if demo else _db_real)


def is_demo_ctx() -> bool:
    cur = _current_db.get()
    return cur is _db_demo

JWT_ALGORITHM = "HS256"
DEFAULT_FRONTEND_URL = "http://localhost:3000"
# Nilai eksplisit dari environment (kosong = tidak diset).
FRONTEND_URL_ENV = (os.environ.get("FRONTEND_URL") or "").strip().rstrip("/")
FRONTEND_URL = FRONTEND_URL_ENV or DEFAULT_FRONTEND_URL


def resolve_base_url(request: Optional[Request] = None) -> str:
    """Base URL untuk link yang ditanam di QR code & tautan share.

    Urutan prioritas:
      1. env `FRONTEND_URL` bila diset (paling eksplisit, dipakai di produksi)
      2. host request yang sedang berjalan (x-forwarded-* dari proxy Vercel)
      3. fallback localhost

    Poin 2 penting supaya QR tidak pernah mengarah ke domain lain hanya karena
    `FRONTEND_URL` lupa diisi/masih tertinggal dari lingkungan sebelumnya.
    """
    if FRONTEND_URL_ENV:
        return FRONTEND_URL_ENV
    if request is not None:
        proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
        host = request.headers.get("x-forwarded-host") or request.headers.get("host")
        if host:
            return f"{proto}://{host}".rstrip("/")
    return DEFAULT_FRONTEND_URL
# Session lifetime (masa percobaan): sesi bertahan 365 hari agar tetap login saat refresh web
SESSION_DAYS = 365
SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60  # detik
VALID_ROLES = ["admin", "pengurus", "guru", "peserta"]
EDUCATION_OPTIONS = ["TK", "SD", "SMP", "SMA", "D1", "D2", "D3", "D4", "S1", "S2", "S3"]
MUBALIGH_OPTIONS = ["belum", "sudah"]
# Status pernikahan peserta (dropdown)
MARITAL_OPTIONS = ["belum_menikah", "sudah_menikah"]
GENDER_OPTIONS = ["L", "P"]

def _jsonable(value):
    """Ubah ObjectId (termasuk bersarang di list/dict) menjadi str."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    return value


class SafeJSONResponse(JSONResponse):
    """Respons JSON yang selalu aman dari ObjectId mentah."""

    def render(self, content) -> bytes:
        return super().render(_jsonable(content))


app = FastAPI(default_response_class=SafeJSONResponse)
api_router = APIRouter(prefix="/api")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Log error tak tertangani (terbaca di Vercel Logs) + balasan JSON ringkas."""
    logger.exception(
        "Unhandled error pada %s %s: %s: %s",
        request.method, request.url.path, type(exc).__name__, exc,
    )
    return JSONResponse(
        status_code=500,
        content={"error": "Terjadi kesalahan pada server. Silakan coba lagi."},
    )

# ---------------------------------------------------------------------------
# Helpers: password + jwt
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise HTTPException(status_code=500,
                            detail="JWT_SECRET belum diset pada environment server")
    return secret

def create_access_token(user_id: str, ver: int = 0, demo: bool = False) -> str:
    payload = {"sub": user_id, "ver": ver, "type": "access", "demo": demo,
               "exp": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str, ver: int = 0, demo: bool = False) -> str:
    payload = {"sub": user_id, "ver": ver, "type": "refresh", "demo": demo,
               "exp": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def _cookie_flags() -> dict:
    """Cookie aman di HTTPS (produksi), tapi tetap jalan di HTTP lokal.

    SameSite=None wajib disertai Secure; kalau tidak, browser menolak cookie
    sehingga login gagal di http://localhost.
    """
    secure = os.environ.get("COOKIE_SECURE")
    if secure is None:
        secure = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
    secure = str(secure).lower() not in ("0", "false", "no")
    return {"secure": secure, "samesite": "none" if secure else "lax"}


def set_auth_cookies(response: Response, user_id: str, ver: int, demo: bool = False):
    flags = _cookie_flags()
    response.set_cookie("access_token", create_access_token(user_id, ver, demo), httponly=True,
                        max_age=SESSION_MAX_AGE, path="/", **flags)
    response.set_cookie("refresh_token", create_refresh_token(user_id, ver, demo), httponly=True,
                        max_age=SESSION_MAX_AGE, path="/", **flags)

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
PyObjectId = Annotated[str, BeforeValidator(str)]

def _derive_gender(user: dict) -> Optional[str]:
    g = user.get("gender")
    if g in GENDER_OPTIONS:
        return g
    av = user.get("avatar_gender")
    if av == "female":
        return "P"
    if av == "male":
        return "L"
    return None


# ---------------------------------------------------------------------------
# Kelengkapan profil (verifikasi akun sebelum memakai aplikasi)
# ---------------------------------------------------------------------------
# Field yang WAJIB diisi setiap pengguna (semua peran) sebelum boleh memakai app.
REQUIRED_PROFILE_FIELDS = [
    ("name", "Nama Lengkap"),
    ("gender", "Jenis Kelamin"),
    ("dob", "Tanggal Lahir"),
    ("phone", "No. HP"),
    ("address", "Alamat"),
]


def profile_missing_fields(user: dict) -> List[str]:
    """Label field wajib yang masih kosong pada profil pengguna."""
    missing = []
    for key, label in REQUIRED_PROFILE_FIELDS:
        if key == "gender":
            # Sengaja memakai nilai MENTAH (bukan turunan dari avatar_gender),
            # supaya pengguna benar-benar memilih jenis kelaminnya sendiri.
            val = user.get("gender") if user.get("gender") in GENDER_OPTIONS else None
        else:
            val = user.get(key)
        if val is None or str(val).strip() == "":
            missing.append(label)
    return missing


def public_user(user: dict, include_photo: bool = False) -> dict:
    missing = profile_missing_fields(user)
    data = {
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "username": user.get("username"),
        "phone": user.get("phone"),
        "whatsapp": user.get("whatsapp"),
        "dob": user.get("dob"),
        "birthplace": user.get("birthplace"),
        "address": user.get("address"),
        "gender": _derive_gender(user),
        "education": user.get("education"),
        "mubaligh": user.get("mubaligh"),
        "marital": user.get("marital"),
        "kategori": user.get("kategori"),
        "kelompok_id": user.get("kelompok_id"),
        "jenjang": user.get("jenjang"),
        "jenjang_saran": bool(user.get("jenjang_saran", False)),
        "nomor_wa_wali": user.get("nomor_wa_wali"),
        "pengajar": bool(user.get("pengajar", False)),
        "roles": user.get("roles", []),
        "status": user.get("status", "active"),
        "must_change_password": bool(user.get("must_change_password", False)),
        "source": user.get("source", "admin"),
        "avatar_gender": user.get("avatar_gender", "male"),
        "needs_completion": bool(user.get("needs_completion", False)),
        "profile_complete": len(missing) == 0,
        "missing_fields": missing,
        "has_photo": bool(user.get("photo")),
        "is_system": bool(user.get("is_system", False)),
        "demo": is_demo_ctx(),
        "created_at": user.get("created_at"),
    }
    if include_photo:
        data["photo"] = user.get("photo")
    return data

class LoginInput(BaseModel):
    identifier: str
    password: str

class RegisterInput(BaseModel):
    token: str
    name: str
    phone: str
    email: str
    dob: str
    address: str
    password: str
    avatar_gender: Optional[str] = "male"

class ActivationComplete(BaseModel):
    user_id: str
    phone: str
    email: Optional[str] = None
    dob: str
    address: Optional[str] = None
    password: str
    gender: Optional[str] = None
    avatar_gender: Optional[str] = "male"

class AdminCreateUser(BaseModel):
    name: str
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    email: Optional[str] = None
    dob: Optional[str] = None
    birthplace: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None
    education: Optional[str] = None
    mubaligh: Optional[str] = None
    marital: Optional[str] = None
    kelompok_id: Optional[str] = None
    roles: List[str] = ["peserta"]
    password: Optional[str] = None
    jenjang: Optional[str] = None
    nomor_wa_wali: Optional[str] = None

class PendingEntry(BaseModel):
    name: str
    dob: Optional[str] = None

class AdminPendingNames(BaseModel):
    entries: List[PendingEntry]

class SelfResetInput(BaseModel):
    phone: str
    dob: str
    new_password: str

# --- Fase 2: Kelompok, Peserta management ---
class KelompokInput(BaseModel):
    name: str
    description: Optional[str] = None

class BulkEntry(BaseModel):
    name: str
    gender: Optional[str] = None
    birthplace: Optional[str] = None
    dob: Optional[str] = None
    phone: Optional[str] = None

class BulkCreateInput(BaseModel):
    entries: List[BulkEntry]
    kelompok_id: Optional[str] = None

class BulkDeleteInput(BaseModel):
    ids: List[str]

class BulkActivateInput(BaseModel):
    ids: List[str]

class PesertaUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    dob: Optional[str] = None
    birthplace: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None
    education: Optional[str] = None
    mubaligh: Optional[str] = None
    marital: Optional[str] = None
    photo: Optional[str] = None
    roles: Optional[List[str]] = None
    status: Optional[str] = None
    kelompok_id: Optional[str] = None
    needs_completion: Optional[bool] = None
    jenjang: Optional[str] = None
    nomor_wa_wali: Optional[str] = None
    pengajar: Optional[bool] = None

class MoveInput(BaseModel):
    kelompok_id: Optional[str] = None
    keterangan: Optional[str] = None


class PhotoInput(BaseModel):
    photo: Optional[str] = None


class FeedbackInput(BaseModel):
    name: Optional[str] = None
    message: str


class SelfAbsenInput(BaseModel):
    user_id: str


class TidakHadirInput(BaseModel):
    alasan: str
    keterangan: Optional[str] = None

# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipe token tidak valid")
        use_demo_db(bool(payload.get("demo")))
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
        if payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Sesi telah berakhir")
        allowed_setup_paths = {
            "/api/auth/me",
            "/api/auth/logout",
            "/api/me/ganti-sandi",
            "/api/me/complete-account",
            "/api/me/photo",
        }
        if user.get("must_change_password") and request.url.path not in allowed_setup_paths:
            raise HTTPException(
                status_code=403,
                detail="Ganti kata sandi sementara dan lengkapi data akun sebelum menggunakan aplikasi.",
            )
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token kadaluarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if "admin" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Akses khusus admin")
    return user

async def require_staff(user: dict = Depends(get_current_user)) -> dict:
    roles = user.get("roles", [])
    if "admin" not in roles and "pengurus" not in roles:
        raise HTTPException(status_code=403, detail="Akses khusus admin/pengurus")
    return user

def is_admin(user: dict) -> bool:
    return "admin" in (user.get("roles", []) or [])

def normalize_dob(value) -> Optional[str]:
    """Return YYYY-MM-DD or None. Accepts date/datetime and common ID string formats."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if hasattr(value, "strftime"):  # date object from openpyxl
        return value.strftime("%Y-%m-%d")
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%Y/%m/%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None

def normalize_gender(value) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip().lower()
    if not s:
        return None
    if s in ("l", "laki-laki", "laki", "pria", "male", "m", "lk"):
        return "L"
    if s in ("p", "perempuan", "wanita", "female", "f", "pr"):
        return "P"
    return None

def build_pending_doc(name: str, dob: Optional[str]) -> dict:
    return {
        "name": name, "email": None, "username": None, "phone": None,
        "dob": normalize_dob(dob), "address": None, "roles": ["peserta"],
        "source": "admin_import", "avatar_gender": "male", "password_hash": None,
        "status": "pending", "token_version": 0, "kategori": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

async def log_activity(actor: Optional[dict], action: str, detail: str = "", target: str = ""):
    """Persist an audit log entry. Never raises."""
    try:
        await db.activity_logs.insert_one({
            "_id": str(uuid.uuid4()),
            "actor_id": str(actor["_id"]) if actor else None,
            "actor_name": actor.get("name") if actor else "Sistem",
            "action": action,
            "detail": detail,
            "target": target,
            "at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as exc:  # pragma: no cover
        logger.warning("Gagal mencatat log: %s", exc)

# ---------------------------------------------------------------------------
# QR helpers (server-side generated & cached)
# ---------------------------------------------------------------------------
def make_qr_data_url(data: str) -> str:
    qr = qrcode.QRCode(version=1, box_size=10, border=2,
                       error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#000000", back_color="#FFFFFF")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

async def get_or_create_public_qr(request: Optional[Request] = None) -> dict:
    """QR pendaftaran publik.

    Yang disimpan permanen di database HANYA `token`-nya, supaya tautan yang
    sudah pernah dicetak/dibagikan tetap sah. `link` dan `image` SENGAJA
    dihitung ulang setiap request dari base URL yang berlaku.

    Alasan: sandbox dan produksi memakai database yang sama. Kalau link/gambar
    ikut disimpan, QR yang pertama dibuat di satu lingkungan (mis. preview) akan
    terus dipakai di lingkungan lain, sehingga QR pendaftaran mengarah ke domain
    yang salah. Membuat PNG QR sangat murah, jadi tidak perlu di-cache.
    """
    base = resolve_base_url(request)
    doc = await db.app_settings.find_one({"_id": "public_qr"})
    if not doc:
        token = secrets.token_urlsafe(12)
        await db.app_settings.update_one(
            {"_id": "public_qr"},
            {"$setOnInsert": {"token": token,
                              "created_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True)
        doc = await db.app_settings.find_one({"_id": "public_qr"}) or {"token": token}
    token = doc["token"]
    link = f"{base}/register?token={token}"
    return {"token": token, "link": link, "image": make_qr_data_url(link),
            "base_url": base, "created_at": doc.get("created_at")}

# ---------------------------------------------------------------------------
# Brute force helpers
# ---------------------------------------------------------------------------
async def is_locked(identifier: str) -> bool:
    since = datetime.now(timezone.utc) - timedelta(minutes=15)
    count = await db.login_attempts.count_documents(
        {"identifier": identifier, "at": {"$gte": since.isoformat()}})
    return count >= LOGIN_AKUN_MAKS


# --- Login: pembatas laju per akun (bukan per IP) + pencocokan pengenal ---
LOGIN_AKUN_MAKS = 10            # 10 percobaan gagal / 15 menit per akun
LOGIN_IP_MAKS = 200             # pengaman kasar saja, tidak mengunci per IP
LOGIN_IP_JENDELA = 900          # detik (15 menit)
RESET_LAJU_MAKS = 5
RESET_LAJU_JENDELA = 900        # 5 percobaan / 15 menit
RESET_JEDA_AKUN = 600           # maksimal 1 reset berhasil / 10 menit per akun
RESET_TEKS = ("Kata sandi diatur ke tanggal lahirmu (DDMMYY). Silakan masuk.")
RESET_TEKS_UMUM = ("Jika akun ini terdaftar dan tanggal lahirnya sudah diisi, "
                   "kata sandi sudah diatur ke tanggal lahir (DDMMYY).")
RESET_TANPA_DOB = "Tanggal lahir belum diisi. Hubungi admin."
LOGIN_GAGAL_TEKS = ("Kata sandi atau akun tidak cocok. Belum pernah mengganti kata sandi? "
                    "Coba tanggal lahir. Lupa? Gunakan Reset.")
LOGIN_TERKUNCI_TEKS = "Terlalu banyak percobaan. Coba lagi sekitar 15 menit lagi."
LOGIN_KEMBAR_TEKS = ("Ada lebih dari satu nama yang sama. Gunakan nomor HP atau username, "
                     "atau hubungi pengurus.")
LAJU_TEKS = "Terlalu banyak percobaan. Coba lagi nanti."


async def _login_ip_locked(ip: Optional[str]) -> bool:
    if not ip:
        return False
    since = (datetime.now(timezone.utc) - timedelta(seconds=LOGIN_IP_JENDELA)).isoformat()
    count = await db.login_attempts.count_documents({"ip": ip, "at": {"$gte": since}})
    return count >= LOGIN_IP_MAKS


def _norm_nama(value) -> str:
    """Nama untuk pencocokan: spasi ganda jadi satu, tanpa beda huruf besar/kecil."""
    return re.sub(r"\s+", " ", str(value or "").strip()).lower()


def _norm_hp_login(value) -> Optional[str]:
    """Nomor HP → 62xxxxxxxxxx (awalan 0 atau 8 diganti 62)."""
    digits = re.sub(r"\D", "", str(value or ""))
    if not digits:
        return None
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("8"):
        digits = "62" + digits
    return digits


def _hanya_peserta(user: dict) -> bool:
    """True bila akun murni Peserta (bukan Administrator/Pengurus/Guru)."""
    roles = set(user.get("roles") or [])
    return "peserta" in roles and not ({"admin", "pengurus", "guru"} & roles)


def _sandi_default_dari_dob(dob) -> Optional[tuple]:
    """(DDMMYY, DDMMYYYY) dari tanggal lahir, atau None bila tidak bisa dibaca."""
    d = normalize_dob(dob)
    if not d:
        return None
    y, m, day = d.split("-")
    return (f"{day}{m}{y[2:]}", f"{day}{m}{y}")


def _cocok_sandi_default(sandi: str, dob) -> bool:
    """True bila sandi sama dengan DDMMYY atau DDMMYYYY dari tanggal lahir."""
    pasangan = _sandi_default_dari_dob(dob)
    if not pasangan:
        return False
    return (sandi or "").strip() in pasangan


async def _setel_sandi_default(user: dict, oleh: Optional[dict] = None) -> dict:
    """Reset kata sandi ke DDMMYY dari tanggal lahir (dipakai bersama).

    Memastikan perubahan benar-benar tersimpan, mengaktifkan penanda wajib
    ganti, dan membersihkan penghitung gagal login. Tidak pernah mencetak sandi.
    """
    pasangan = _sandi_default_dari_dob(user.get("dob"))
    if not pasangan:
        return {"ok": False, "alasan": RESET_TANPA_DOB}
    sandi = pasangan[0]
    oid = user["_id"]
    set_fields = {"password_hash": hash_password(sandi), "must_change_password": True}
    if not user.get("username"):
        set_fields["username"] = await unique_username_from_name(user.get("name") or "peserta")
    if user.get("status") == "pending":
        set_fields["status"] = "active"
    res = await db.users.update_one({"_id": oid}, {"$set": set_fields, "$inc": {"token_version": 1}})
    tersimpan = await db.users.find_one({"_id": oid}, {"password_hash": 1})
    if not tersimpan or not verify_password(sandi, tersimpan.get("password_hash") or ""):
        logger.error("Reset sandi gagal tersimpan untuk akun %s", oid)
        return {"ok": False, "alasan": "Kata sandi gagal disimpan. Coba lagi."}
    await db.login_attempts.delete_many({"identifier": str(oid)})
    await db.login_attempts.delete_many({"identifier": _norm_nama(user.get("name"))})
    await log_activity(oleh or user, "reset_sandi",
                       f"Reset sandi '{user.get('name')}' ke tanggal lahir (DDMMYY)", str(oid))
    await simpan_notif_sandi(str(oid))
    return {"ok": True, "sandi": sandi, "modified": res.modified_count}


async def _cari_user_login(ident: str):
    """Cari akun dari pengenal. Urutan: nomor HP, email, username, lalu nama.

    Nama HANYA dicocokkan untuk peran Peserta. Mengembalikan (user, kembar).
    """
    raw = (ident or "").strip()
    if not raw:
        return None, False
    low = raw.lower()
    hp = _norm_hp_login(raw)
    if hp:
        variants = {raw, hp}
        if hp.startswith("62"):
            variants.add("0" + hp[2:])
        u = await db.users.find_one({"phone": {"$in": list(variants)}})
        if u:
            return u, False
    u = await db.users.find_one({"email": low})
    if u:
        return u, False
    u = await db.users.find_one({"username": low})
    if u:
        return u, False
    target = _norm_nama(raw)
    if not target:
        return None, False
    kandidat = []
    async for u in db.users.find({"roles": "peserta", "is_system": {"$ne": True}}):
        if _norm_nama(u.get("name")) == target:
            kandidat.append(u)
            if len(kandidat) > 1:
                break
    if len(kandidat) == 1:
        return kandidat[0], False
    if len(kandidat) > 1:
        return None, True
    return None, False


async def _reset_laju_ok(ip: Optional[str], akun: str):
    """Catat percobaan reset. Mengembalikan id catatan, atau None bila dibatasi."""
    batas = (now_wita() - timedelta(seconds=RESET_LAJU_JENDELA)).isoformat()
    if ip:
        n = await db.reset_laju.count_documents({"ip": ip, "at": {"$gte": batas}})
        if n >= RESET_LAJU_MAKS:
            return None
    if akun:
        n = await db.reset_laju.count_documents({"akun": akun, "at": {"$gte": batas}})
        if n >= RESET_LAJU_MAKS:
            return None
    res = await db.reset_laju.insert_one(
        {"ip": ip, "akun": akun, "at": now_wita().isoformat(), "ok": False})
    return res.inserted_id


async def simpan_notif_sandi(user_id: str) -> None:
    """Notifikasi lonceng peserta: kata sandi direset."""
    try:
        oid = _oid(user_id)
        if not oid:
            return
        u = await db.users.find_one({"_id": oid}, {"password_hash": 1})
        if not u or not u.get("password_hash"):
            return
        key = {"peserta_id": user_id, "kegiatan_id": None}
        await db.notifikasi.update_one(
            key,
            {"$set": {**key, "jenis": "sandi",
                      "tanggal": now_wita().strftime("%Y-%m-%d"),
                      "teks": "Kata sandi akun Anda direset.",
                      "dibaca": False, "dibuat_pada": now_wita().isoformat()}},
            upsert=True)
    except Exception:
        logger.exception("Gagal menyimpan notifikasi sandi")

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "E-KERTALANGU API"}

# --------------------------- FASE 11: Pantau Login ---------------------------
def parse_device(ua: str) -> dict:
    """Ringkasan perangkat dari User-Agent (tanpa pustaka tambahan)."""
    u = (ua or "")
    ul = u.lower()
    if "ipad" in ul:
        os_name, kind = "iPadOS", "tablet"
    elif "iphone" in ul:
        os_name, kind = "iPhone", "hp"
    elif "android" in ul:
        os_name, kind = "Android", ("tablet" if "mobile" not in ul else "hp")
    elif "windows" in ul:
        os_name, kind = "Windows", "komputer"
    elif "mac os" in ul or "macintosh" in ul:
        os_name, kind = "macOS", "komputer"
    elif "cros" in ul:
        os_name, kind = "ChromeOS", "komputer"
    elif "linux" in ul:
        os_name, kind = "Linux", "komputer"
    else:
        os_name, kind = "Perangkat lain", "lainnya"
    if "edg/" in ul:
        browser = "Edge"
    elif "opr/" in ul or "opera" in ul:
        browser = "Opera"
    elif "samsungbrowser" in ul:
        browser = "Samsung Internet"
    elif "chrome" in ul or "crios" in ul:
        browser = "Chrome"
    elif "firefox" in ul or "fxios" in ul:
        browser = "Firefox"
    elif "safari" in ul:
        browser = "Safari"
    elif "wv" in ul and "android" in ul:
        browser = "Aplikasi (WebView)"
    else:
        browser = "Browser lain"
    return {"os": os_name, "browser": browser, "kind": kind,
            "label": f"{browser} · {os_name}"}


def client_ip(request: Request) -> Optional[str]:
    xff = request.headers.get("x-forwarded-for") or request.headers.get("x-real-ip")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else None


def serialize_login_event(e: dict) -> dict:
    return {
        "id": e["_id"],
        "user_id": e.get("user_id"),
        "name": e.get("name"),
        "roles": e.get("roles", []),
        "at": e.get("at"),
        "date": e.get("date"),
        "device": e.get("device") or {},
        "ip": e.get("ip"),
        "is_new_device": bool(e.get("is_new_device")),
    }


async def record_login_event(user: dict, request: Request) -> dict:
    """Simpan peristiwa login & kembalikan info untuk notifikasi ke akun tersebut.
    Tidak pernah melempar error (login tetap sukses walau pencatatan gagal)."""
    try:
        now = now_wita()
        ua = request.headers.get("user-agent", "")
        dev = parse_device(ua)
        ip = client_ip(request)
        uid = str(user["_id"])
        prev = await db.login_events.find({"user_id": uid}).sort("at", -1).to_list(1)
        prev = prev[0] if prev else None
        known = await db.login_events.count_documents(
            {"user_id": uid, "device.label": dev["label"]})
        is_new_device = prev is not None and known == 0
        doc = {
            "_id": str(uuid.uuid4()),
            "user_id": uid,
            "name": user.get("name"),
            "roles": user.get("roles", []),
            "at": now.isoformat(),
            "date": now.strftime("%Y-%m-%d"),
            "device": dev,
            "ua": ua[:300],
            "ip": ip,
            "is_new_device": is_new_device,
        }
        await db.login_events.insert_one(doc)
        await db.users.update_one({"_id": user["_id"]}, {
            "$set": {"last_login_at": doc["at"], "last_login_device": dev["label"]},
            "$inc": {"login_count": 1},
        })
        return {
            "at": doc["at"],
            "device": dev,
            "ip": ip,
            "is_new_device": is_new_device,
            "first_login": prev is None,
            "login_count": int(user.get("login_count") or 0) + 1,
            "previous_at": prev.get("at") if prev else None,
            "previous_device": (prev.get("device") or {}).get("label") if prev else None,
        }
    except Exception as exc:  # pragma: no cover
        logger.warning("record_login_event gagal: %s", exc)
        return {"at": now_wita().isoformat(), "device": {"label": "-"}, "ip": None,
                "is_new_device": False, "first_login": False, "login_count": 0,
                "previous_at": None, "previous_device": None}


@api_router.get("/staff/login-monitor")
async def login_monitor(staff: dict = Depends(require_admin),
                        date_from: str = "", date_to: str = "", q: str = "",
                        limit: int = 200):
    """FASE 11 — Pantau login peserta untuk admin/pengurus.

    Ringkasan hari ini (WITA), daftar login terbaru (bisa difilter tanggal & nama),
    dan daftar peserta yang BELUM PERNAH login.
    """
    today = now_wita().strftime("%Y-%m-%d")
    query: dict = {}
    if date_from.strip() or date_to.strip():
        rng = {}
        if date_from.strip():
            rng["$gte"] = date_from.strip()
        if date_to.strip():
            rng["$lte"] = date_to.strip()
        query["date"] = rng
    if q.strip():
        query["name"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    limit = max(1, min(limit, 1000))
    events = await db.login_events.find(query).sort("at", -1).to_list(limit)

    today_events = await db.login_events.find({"date": today}).to_list(10000)
    today_users = {e["user_id"] for e in today_events}

    peserta = await db.users.find(
        PESERTA_QUERY,
        {"name": 1, "status": 1, "phone": 1, "gender": 1, "avatar_gender": 1,
         "last_login_at": 1, "last_login_device": 1, "login_count": 1,
         "login_backfilled": 1}).sort("name", 1).to_list(10000)

    # Backfill sekali: peserta yang pernah login SEBELUM fitur ini ada diambil dari
    # Log Aktivitas (aksi "login") agar tidak salah dihitung "belum pernah login".
    need_bf = [u for u in peserta if not u.get("last_login_at") and not u.get("login_backfilled")]
    if need_bf:
        ids = [str(u["_id"]) for u in need_bf]
        logs = await db.activity_logs.find({"action": "login", "actor_id": {"$in": ids}},
                                           {"actor_id": 1, "at": 1}).to_list(50000)
        latest: dict = {}
        cnt: dict = {}
        for lg in logs:
            a = lg.get("actor_id")
            cnt[a] = cnt.get(a, 0) + 1
            if (lg.get("at") or "") > (latest.get(a) or ""):
                latest[a] = lg.get("at")
        for u in need_bf:
            uid = str(u["_id"])
            upd = {"login_backfilled": True}
            if uid in latest:
                upd["last_login_at"] = to_wita_iso(latest[uid])
                upd["last_login_device"] = "Riwayat lama"
                upd["login_count"] = cnt.get(uid, 1)
                u["last_login_at"] = upd["last_login_at"]
            await db.users.update_one({"_id": u["_id"]}, {"$set": upd})

    never = [{
        "id": str(u["_id"]), "name": u.get("name"), "phone": u.get("phone"),
        "status": u.get("status", "active"), "gender": _derive_gender(u),
    } for u in peserta if not u.get("last_login_at")]
    sudah = len(peserta) - len(never)

    # 7 hari terakhir: jumlah login unik per hari (untuk grafik kecil)
    days = []
    for i in range(6, -1, -1):
        d = (now_wita() - timedelta(days=i)).strftime("%Y-%m-%d")
        days.append(d)
    week_events = await db.login_events.find({"date": {"$gte": days[0]}}).to_list(20000)
    per_day = {d: {"date": d, "logins": 0, "users": set()} for d in days}
    for e in week_events:
        b = per_day.get(e.get("date"))
        if b:
            b["logins"] += 1
            b["users"].add(e["user_id"])
    tren = [{"date": d, "logins": per_day[d]["logins"], "users": len(per_day[d]["users"])} for d in days]

    return {
        "today": today,
        "summary": {
            "today_logins": len(today_events),
            "today_users": len(today_users),
            "total_peserta": len(peserta),
            "sudah_login": sudah,
            "belum_login": len(never),
            "ratio_login": round((sudah / len(peserta)) * 100, 1) if peserta else 0.0,
        },
        "tren": tren,
        "events": [serialize_login_event(e) for e in events],
        "never_logged_in": never,
    }


@api_router.get("/staff/login-monitor/user/{user_id}")
async def login_monitor_user(user_id: str, staff: dict = Depends(require_admin), limit: int = 50):
    """Riwayat login 1 peserta (untuk detail di halaman Pantau Login)."""
    u = await db.users.find_one({"_id": parse_object_id(user_id)})
    if not u:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    limit = max(1, min(limit, 500))
    events = await db.login_events.find({"user_id": user_id}).sort("at", -1).to_list(limit)
    devices: dict = {}
    for e in events:
        lbl = (e.get("device") or {}).get("label") or "-"
        devices[lbl] = devices.get(lbl, 0) + 1
    return {
        "user": {"id": str(u["_id"]), "name": u.get("name"), "phone": u.get("phone"),
                 "status": u.get("status", "active"), "roles": u.get("roles", []),
                 "last_login_at": u.get("last_login_at"),
                 "last_login_device": u.get("last_login_device"),
                 "login_count": int(u.get("login_count") or 0)},
        "devices": [{"label": k, "count": v} for k, v in sorted(devices.items(), key=lambda x: -x[1])],
        "events": [serialize_login_event(e) for e in events],
    }


@api_router.post("/auth/login")
async def login(body: LoginInput, request: Request, response: Response):
    ident = re.sub(r"\s+", " ", (body.identifier or "").strip())
    ip = client_ip(request)
    if await _login_ip_locked(ip):
        raise HTTPException(status_code=429, detail=LOGIN_TERKUNCI_TEKS)
    # FASE 19 — cari di data real dulu, lalu di data demo (database terpisah).
    use_demo_db(False)
    user, kembar = await _cari_user_login(ident)
    if not user and not kembar:
        use_demo_db(True)
        user, kembar = await _cari_user_login(ident)
        if not user and not kembar:
            use_demo_db(False)
    demo = is_demo_ctx()
    lock_key = str(user["_id"]) if user else _norm_nama(ident) or ident.lower()
    if await is_locked(lock_key):
        raise HTTPException(status_code=429, detail=LOGIN_TERKUNCI_TEKS)

    def gagal(detail: str):
        return HTTPException(status_code=401, detail=detail)

    if kembar:
        await db.login_attempts.insert_one({
            "identifier": lock_key, "ip": ip,
            "at": datetime.now(timezone.utc).isoformat()})
        raise gagal(LOGIN_KEMBAR_TEKS)

    ok = bool(user) and bool(user.get("password_hash")) and verify_password(
        body.password.strip(), user["password_hash"])
    # Kata sandi awal: DDMMYY atau DDMMYYYY dari tanggal lahir, selama akun
    # masih memakai kata sandi default (belum pernah mengganti).
    pakai_dob = False
    if user and not ok and _cocok_sandi_default(body.password, user.get("dob")):
        pakai_dob = True
        ok = True
    if not ok:
        await db.login_attempts.insert_one({
            "identifier": lock_key, "ip": ip,
            "email": user["email"] if user else None,
            "at": datetime.now(timezone.utc).isoformat()})
        raise gagal(LOGIN_GAGAL_TEKS)
    if user.get("status") not in ("active", "pending"):
        raise HTTPException(status_code=403, detail="Akun belum aktif. Silakan aktivasi terlebih dahulu.")

    set_fields = {}
    if pakai_dob:
        set_fields["password_hash"] = hash_password(body.password.strip())
        if user.get("status") == "pending":
            set_fields["status"] = "active"
    if set_fields:
        await db.users.update_one({"_id": user["_id"]}, {"$set": set_fields})
        user = await db.users.find_one({"_id": user["_id"]})

    await db.login_attempts.delete_many({"identifier": lock_key})
    set_auth_cookies(response, str(user["_id"]), user.get("token_version", 0), demo)
    await log_activity(user, "login", f"Login berhasil sebagai {', '.join(user.get('roles', []))}")
    # FASE 11 — catat peristiwa login (untuk notifikasi akun & pantau login staf)
    login_info = await record_login_event(user, request)
    data = public_user(user)
    data["login_info"] = login_info
    return data

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Keluar berhasil"}


def parse_object_id(value: str) -> ObjectId:
    try:
        return ObjectId(value)
    except Exception:
        raise HTTPException(status_code=400, detail="ID pengguna tidak valid")

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api_router.get("/me/photo")
async def get_my_photo(user: dict = Depends(get_current_user)):
    return {"photo": user.get("photo")}


@api_router.post("/me/photo")
async def set_my_photo(body: PhotoInput, user: dict = Depends(get_current_user)):
    photo = (body.photo or "").strip() or None
    if photo and not photo.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Format foto tidak valid (harus JPG/PNG).")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"photo": photo}})
    return {"has_photo": bool(photo)}

@api_router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Tidak ada sesi")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token tidak valid")
        use_demo_db(bool(payload.get("demo")))
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user or payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Sesi telah berakhir")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    response.set_cookie("access_token",
                        create_access_token(str(user["_id"]), user.get("token_version", 0), is_demo_ctx()),
                        httponly=True, max_age=SESSION_MAX_AGE, path="/", **_cookie_flags())
    return public_user(user)

@api_router.post("/auth/register")
async def register(body: RegisterInput, response: Response):
    qr = await db.app_settings.find_one({"_id": "public_qr"})
    if not qr or body.token != qr["token"]:
        raise HTTPException(status_code=400, detail="Kode QR pendaftaran tidak valid atau kadaluarsa")

    email = body.email.strip().lower()
    phone = body.phone.strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email sudah terdaftar")
    if await db.users.find_one({"phone": phone}):
        raise HTTPException(status_code=409, detail="Nomor HP sudah terdaftar")

    doc = {
        "name": body.name.strip(),
        "email": email,
        "username": None,
        "phone": phone,
        "dob": normalize_dob(body.dob) or body.dob.strip(),
        "address": body.address.strip(),
        "password_hash": hash_password(body.password),
        "roles": ["peserta"],
        "status": "active",
        "source": "qr_public",
        "avatar_gender": body.avatar_gender or "male",
        "token_version": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    set_auth_cookies(response, str(res.inserted_id), 0)
    return public_user(doc)

@api_router.get("/activation/search")
async def activation_search(q: str = ""):
    q = q.strip()
    if len(q) < 2:
        return []
    cur = db.users.find(
        {"status": "pending", "name": {"$regex": re.escape(q), "$options": "i"}}
    ).sort("name", 1).limit(20)
    results = await cur.to_list(20)
    return [{"id": str(u["_id"]), "name": u["name"], "requires_dob": bool(u.get("dob"))} for u in results]

@api_router.post("/activation/complete")
async def activation_complete(body: ActivationComplete, response: Response):
    user = await db.users.find_one({"_id": parse_object_id(body.user_id)})
    if not user or user.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Data peserta tidak ditemukan atau sudah aktif")

    submitted_dob = normalize_dob(body.dob)
    if user.get("dob") and submitted_dob != user["dob"]:
        raise HTTPException(status_code=403, detail="Tanggal lahir tidak sesuai data yang didaftarkan pengurus.")

    gender = normalize_gender(body.gender)
    if not gender:
        raise HTTPException(status_code=400, detail="Jenis kelamin wajib diisi (Laki-laki / Perempuan).")

    phone = body.phone.strip()
    if not phone:
        raise HTTPException(status_code=400, detail="Nomor HP wajib diisi.")
    email = (body.email or "").strip().lower() or None
    address = (body.address or "").strip() or None

    if email:
        dup_email = await db.users.find_one({"email": email, "_id": {"$ne": user["_id"]}})
        if dup_email:
            raise HTTPException(status_code=409, detail="Email sudah terdaftar")
    dup_phone = await db.users.find_one({"phone": phone, "_id": {"$ne": user["_id"]}})
    if dup_phone:
        raise HTTPException(status_code=409, detail="Nomor HP sudah terdaftar")

    await db.users.update_one({"_id": user["_id"]}, {"$set": {
        "phone": phone, "email": email, "dob": submitted_dob or body.dob.strip(),
        "address": address, "password_hash": hash_password(body.password),
        "status": "active", "gender": gender,
        "avatar_gender": "female" if gender == "P" else "male"}})
    # Jenjang kosong → isi saran dari umur sebagai NILAI AWAL (tidak menimpa isian).
    if not user.get("jenjang"):
        saran = saran_jenjang(submitted_dob or user.get("dob"))
        if saran:
            await db.users.update_one({"_id": user["_id"]},
                                      {"$set": {"jenjang": saran, "jenjang_saran": True}})
    user = await db.users.find_one({"_id": user["_id"]})
    set_auth_cookies(response, str(user["_id"]), user.get("token_version", 0))
    await log_activity(user, "aktivasi_akun", "Akun diaktivasi & data dilengkapi")
    return public_user(user)

class ResetDobInput(BaseModel):
    identifier: str = ""


@api_router.post("/auth/reset-dob")
async def reset_dob(body: ResetDobInput, request: Request):
    """Reset kata sandi ke DDMMYY dari tanggal lahir TERSIMPAN.

    Berlaku untuk semua akun (peserta, pengurus, admin). Teks hasil seragam
    agar tidak membocorkan akun mana yang ada.
    """
    ip = client_ip(request)
    ident = re.sub(r"\s+", " ", (body.identifier or "").strip())
    akun = _norm_nama(ident) or "-"
    catat = await _reset_laju_ok(ip, akun)
    if catat is None:
        raise HTTPException(status_code=429, detail=LOGIN_TERKUNCI_TEKS)
    try:
        user, kembar = await _cari_user_login(ident)
        if not user or kembar:
            return {"message": RESET_TEKS_UMUM}
        if not _sandi_default_dari_dob(user.get("dob")):
            return {"message": RESET_TANPA_DOB}
        # Maksimal 1 reset berhasil per akun per 10 menit.
        jeda = (now_wita() - timedelta(seconds=RESET_JEDA_AKUN)).isoformat()
        baru = await db.reset_laju.count_documents(
            {"akun": str(user["_id"]), "ok": True, "at": {"$gte": jeda}})
        if baru >= 1:
            return {"message": RESET_TEKS_UMUM}
        hasil = await _setel_sandi_default(user)
        if not hasil.get("ok"):
            return {"message": hasil.get("alasan") or RESET_TEKS_UMUM}
        await db.reset_laju.update_one({"_id": catat}, {"$set": {"ok": True}})
        await log_activity(user, "reset_sandi_mandiri",
                           f"Reset sandi mandiri '{user.get('name')}' (DDMMYY) dari {ip or '-'}",
                           str(user["_id"]))
        return {"message": RESET_TEKS}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Gagal reset sandi mandiri")
        return {"message": RESET_TEKS_UMUM}


@api_router.post("/auth/self-reset")
async def self_reset(body: SelfResetInput):
    phone = body.phone.strip()
    dob = normalize_dob(body.dob) or body.dob.strip()
    user = await db.users.find_one({"phone": phone, "dob": dob})
    if not user:
        raise HTTPException(status_code=404, detail="Data tidak cocok. Periksa Nomor HP & tanggal lahir Anda.")
    if set(user.get("roles") or []) != {"peserta"}:
        raise HTTPException(status_code=403, detail="Reset mandiri hanya untuk akun Peserta. Akun dengan peran lain hubungi administrator.")
    await db.users.update_one({"_id": user["_id"]}, {
        "$set": {"password_hash": hash_password(body.new_password), "status": "active"},
        "$inc": {"token_version": 1}})
    await db.login_attempts.delete_many({"email": user["email"]})
    return {"message": "Kata sandi berhasil diperbarui. Silakan login."}

# ---- QR ----
@api_router.get("/qr/public")
async def public_qr(request: Request):
    doc = await get_or_create_public_qr(request)
    return {"link": doc["link"], "image": doc["image"], "token": doc["token"]}

# ---- Admin ----
@api_router.get("/admin/users")
async def admin_users(admin: dict = Depends(require_staff), include_system: bool = False):
    """Daftar pengguna.

    Fase 7: akun SISTEM (admin pengelola) tidak ditampilkan pada daftar peserta
    maupun hak akses — kirim `include_system=true` bila memang perlu.
    """
    query = {} if include_system else {"is_system": {"$ne": True}}
    # Projection: foto base64 tidak pernah dikirim di daftar (hanya penanda has_photo).
    users = await db.users.find(query, {"photo": 0}).sort("created_at", -1).to_list(1000)
    return [public_user(u) for u in users]


@api_router.get("/admin/users/kelengkapan")
async def admin_users_kelengkapan(admin: dict = Depends(require_staff)):
    """FASE 10 — Daftar peserta yang TANGGAL LAHIR atau STATUS PERNIKAHAN-nya
    belum diisi. Data ini dipakai penyaringan kegiatan (kelompok usia & status
    pernikahan); peserta yang datanya kosong tidak akan masuk daftar kegiatan khusus.

    Didefinisikan SEBELUM `/admin/users/{user_id}` agar tidak tertangkap route generik.
    """
    users = await db.users.find(PESERTA_QUERY).sort("name", 1).to_list(10000)
    rows = []
    missing_dob = missing_marital = 0
    for u in users:
        need = []
        if not normalize_dob(u.get("dob")):
            need.append("dob")
            missing_dob += 1
        if (u.get("marital") or None) not in MARITAL_OPTIONS:
            need.append("marital")
            missing_marital += 1
        if not need:
            continue
        rows.append({
            "id": str(u["_id"]),
            "name": u.get("name"),
            "phone": u.get("phone"),
            "gender": _derive_gender(u),
            "status": u.get("status", "active"),
            "dob": u.get("dob"),
            "marital": u.get("marital"),
            "missing": need,
            "missing_labels": [{"dob": "Tanggal lahir", "marital": "Status pernikahan"}[m] for m in need],
        })
    return {
        "total_peserta": len(users),
        "belum_lengkap": len(rows),
        "lengkap": len(users) - len(rows),
        "missing_dob": missing_dob,
        "missing_marital": missing_marital,
        "rows": rows,
    }


@api_router.get("/admin/users/duplikat")
async def admin_users_duplikat(admin: dict = Depends(require_staff)):
    """FASE 15 — Cek data ganda: peserta dengan NAMA sama (huruf besar/kecil & spasi diabaikan).

    Didefinisikan SEBELUM `/admin/users/{user_id}` agar tidak tertangkap route generik.
    """
    users = await db.users.find(PESERTA_QUERY, {"photo": 0}).sort("name", 1).to_list(10000)
    groups: dict = {}
    for u in users:
        key = re.sub(r"\s+", " ", (u.get("name") or "").strip().lower())
        if not key:
            continue
        groups.setdefault(key, []).append(u)
    out = []
    for items in groups.values():
        if len(items) < 2:
            continue
        rows = [{
            "id": str(u["_id"]), "name": u.get("name"), "phone": u.get("phone"),
            "dob": u.get("dob"), "gender": _derive_gender(u),
            "status": u.get("status", "active"), "kelompok_id": u.get("kelompok_id"),
            "needs_completion": bool(u.get("needs_completion")),
            "pernah_login": bool(u.get("last_login_at")),
            "created_at": u.get("created_at"),
        } for u in items]
        dobs = {r["dob"] for r in rows if r["dob"]}
        out.append({"name": items[0].get("name"), "count": len(rows), "rows": rows,
                    "same_dob": len(dobs) <= 1})
    out.sort(key=lambda g: (-g["count"], g["name"] or ""))
    return {"total_peserta": len(users), "total_grup": len(out),
            "total_duplikat": sum(g["count"] for g in out), "groups": out}



@api_router.get("/admin/users/{user_id}/photo")
async def admin_user_photo(user_id: str, admin: dict = Depends(require_staff)):
    user = await db.users.find_one({"_id": parse_object_id(user_id)})
    photo = (user or {}).get("photo")
    if not user or not photo or not isinstance(photo, str) or "," not in photo:
        raise HTTPException(status_code=404, detail="Foto tidak ditemukan")
    try:
        header, b64 = photo.split(",", 1)
        media = "image/jpeg"
        if header.startswith("data:") and ";" in header:
            media = header[5:].split(";", 1)[0] or media
        raw = base64.b64decode(b64)
    except Exception:
        raise HTTPException(status_code=404, detail="Foto tidak valid")
    return Response(content=raw, media_type=media,
                    headers={"Cache-Control": "private, max-age=60"})

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(require_staff)):
    if user_id == str(admin["_id"]):
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    target = await db.users.find_one({"_id": parse_object_id(user_id)})
    if not target:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    # Satu-satunya Administrator tidak boleh dihapus.
    if "admin" in (target.get("roles") or []):
        sisa_admin = await db.users.count_documents(
            {"roles": "admin", "_id": {"$ne": target["_id"]}})
        if sisa_admin == 0:
            raise HTTPException(
                status_code=400,
                detail="Tidak dapat menghapus satu-satunya Administrator")
    res = await db.users.delete_one({"_id": target["_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    await log_activity(admin, "hapus_akun", f"Menghapus akun '{target.get('name') or user_id}'", user_id)
    return {"message": "Pengguna dihapus"}

class RoleUpdate(BaseModel):
    roles: List[str]

class BulkJenjangInput(BaseModel):
    ids: List[str]
    jenjang: str

@api_router.post("/admin/users/bulk-jenjang")
async def admin_bulk_jenjang(body: BulkJenjangInput, admin: dict = Depends(require_staff)):
    """Atur jenjang massal (koreksi) untuk peserta terpilih."""
    if body.jenjang not in JENJANG_BY_ID:
        raise HTTPException(status_code=400, detail="Jenjang tidak valid")
    ids = [i for i in (body.ids or []) if i]
    if not ids:
        raise HTTPException(status_code=400, detail="Pilih minimal satu peserta")
    res = await db.users.update_many(
        {"_id": {"$in": [parse_object_id(i) for i in ids]}},
        {"$set": {"jenjang": body.jenjang, "jenjang_saran": False}})
    await log_activity(admin, "atur_jenjang",
                       f"Mengatur jenjang {res.modified_count} peserta → {JENJANG_BY_ID[body.jenjang]['label']}")
    return {"ok": True, "updated": res.modified_count}

@api_router.patch("/admin/users/{user_id}/roles")
async def admin_update_roles(user_id: str, body: RoleUpdate, admin: dict = Depends(require_admin)):
    roles = [r for r in body.roles if r in VALID_ROLES]
    if not roles:
        raise HTTPException(status_code=400, detail="Minimal satu peran valid")
    oid = parse_object_id(user_id)
    await db.users.update_one({"_id": oid}, {"$set": {"roles": roles}})
    user = await db.users.find_one({"_id": oid})
    return public_user(user)

@api_router.post("/admin/users")
async def admin_create_user(body: AdminCreateUser, admin: dict = Depends(require_staff)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama wajib diisi")
    roles = [r for r in body.roles if r in VALID_ROLES] or ["peserta"]
    email = body.email.strip().lower() if body.email else None
    phone = body.phone.strip() if body.phone else None
    if email and await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email sudah terdaftar")
    if phone and await db.users.find_one({"phone": phone}):
        raise HTTPException(status_code=409, detail="Nomor HP sudah terdaftar")
    username = await unique_username_from_name(name) if "peserta" in roles else None

    doc = {
        "name": name, "email": email, "username": username, "phone": phone,
        "whatsapp": body.whatsapp.strip() if body.whatsapp else None,
        "dob": normalize_dob(body.dob),
        "birthplace": body.birthplace.strip() if body.birthplace else None,
        "address": body.address.strip() if body.address else None,
        "gender": normalize_gender(body.gender),
        "education": body.education if body.education in EDUCATION_OPTIONS else None,
        "mubaligh": body.mubaligh if body.mubaligh in MUBALIGH_OPTIONS else None,
        "marital": body.marital if body.marital in MARITAL_OPTIONS else None,
        "kategori": kategori_dari_status(body.marital),
        "kelompok_id": body.kelompok_id or None,
        "roles": roles, "source": "admin",
        "avatar_gender": "female" if normalize_gender(body.gender) == "P" else "male",
        "token_version": 0, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    # Jenjang: pakai isian admin; bila kosong, isi otomatis dari umur sebagai
    # NILAI AWAL (ditandai jenjang_saran sampai admin mengonfirmasi).
    jenjang = body.jenjang if body.jenjang in JENJANG_BY_ID else None
    if jenjang:
        doc["jenjang"] = jenjang
        doc["jenjang_saran"] = False
    else:
        saran = saran_jenjang(doc.get("dob"))
        if saran:
            doc["jenjang"] = saran
            doc["jenjang_saran"] = True
    doc["nomor_wa_wali"] = normalize_wa_wali(body.nomor_wa_wali)
    if body.password:
        doc["password_hash"] = hash_password(body.password)
        doc["status"] = "active"
    else:
        doc["password_hash"] = None
        doc["status"] = "pending"
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    await log_activity(admin, "buat_akun", f"Membuat akun '{name}' ({', '.join(roles)})", str(res.inserted_id))
    return public_user(doc)

@api_router.post("/admin/users/pending")
async def admin_create_pending(body: AdminPendingNames, admin: dict = Depends(require_staff)):
    created, skipped, invalid_dates = [], [], []
    for entry in body.entries:
        name = entry.name.strip()
        if not name:
            continue
        existing = await db.users.find_one({"name": name, "status": "pending"})
        if existing:
            skipped.append(name)
            continue
        if entry.dob and str(entry.dob).strip() and normalize_dob(entry.dob) is None:
            invalid_dates.append({"name": name, "value": str(entry.dob).strip()})
        doc = build_pending_doc(name, entry.dob)
        doc["username"] = await unique_username_from_name(name)
        res = await db.users.insert_one(doc)
        doc["_id"] = res.inserted_id
        created.append(public_user(doc))
    return {"created": created, "count": len(created), "skipped": skipped, "invalid_dates": invalid_dates}

@api_router.get("/admin/import-template")
async def import_template(admin: dict = Depends(require_staff)):
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Peserta"
    ws.append(["Nama", "Tanggal Lahir", "Nama ayah", "HP ayah",
               "Nama ibu", "HP ibu", "Nama wali", "HP wali"])
    ws.append(["Budi Santoso", "17-08-1970", "Santoso", "081200000001",
               "Sri Wahyuni", "081200000002", "", ""])
    ws.append(["Siti Aminah", "02-05-1965", "", "", "", "", "Ahmad", "081200000003"])
    ws.append(["Ahmad Fauzi", "", "", "", "", "", "", ""])
    for col, width in zip("ABCDEFGH", (32, 18, 24, 18, 24, 18, 24, 18)):
        ws.column_dimensions[col].width = width
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_peserta_ekertalangu.xlsx"},
    )


async def _tautkan_orang_tua(anak_id: str, nama: str, hp: str, hubungan: str,
                             oleh: dict, hasil: dict) -> None:
    """Tautkan/buat akun orang tua untuk satu baris impor (satu transaksi logis)."""
    nama = (nama or "").strip()
    nomor = normalize_wa_wali(hp)
    if not nama and not nomor:
        return
    if not nomor:
        hasil["perlu_dicek"].append({"nama_anak": nama or anak_id,
                                     "alasan": f"{hubungan}: HP kosong, akun tidak dibuat"})
        return
    kandidat = await db.users.find(
        {"phone": nomor, "is_system": {"$ne": True}}, {"name": 1}).to_list(5)
    if len(kandidat) > 1:
        hasil["perlu_dicek"].append({"nama_anak": nama or anak_id,
                                     "alasan": f"{hubungan}: HP {nomor} cocok dengan lebih dari satu akun"})
        return
    if kandidat:
        wali_id = str(kandidat[0]["_id"])
    else:
        if not nama:
            hasil["perlu_dicek"].append({"nama_anak": anak_id,
                                         "alasan": f"{hubungan}: nama kosong, akun tidak dibuat"})
            return
        doc = build_pending_doc(nama, None)
        doc["username"] = await unique_username_from_name(nama)
        doc["phone"] = nomor
        doc["source"] = "import_orang_tua"
        await db.users.insert_one(doc)
        wali_id = str(doc["_id"])
        hasil["akun_baru"] += 1
    if wali_id == anak_id:
        hasil["perlu_dicek"].append({"nama_anak": nama,
                                     "alasan": f"{hubungan}: HP sama dengan akun anak"})
        return
    lama = await db.wali_anak.find_one(
        {"anak_id": {"$in": _id_varian(anak_id)}, "hubungan": hubungan})
    if lama:
        if lama.get("wali_id") != wali_id:
            hasil["perlu_dicek"].append({"nama_anak": nama,
                                         "alasan": f"{hubungan}: sudah tertaut akun lain"})
        return
    await db.wali_anak.insert_one(_wali_doc(anak_id, wali_id, hubungan, oleh))
    hasil["tertaut"] += 1


@api_router.post("/admin/users/import")
async def admin_import_users(file: UploadFile = File(...), admin: dict = Depends(require_staff)):
    fname = (file.filename or "").lower()
    data = await file.read()
    rows = []  # (name, dob, ayah_nama, ayah_hp, ibu_nama, ibu_hp, wali_nama, wali_hp)
    try:
        if fname.endswith(".csv") or fname.endswith(".txt"):
            import csv
            text = data.decode("utf-8-sig", errors="ignore")
            for cols in csv.reader(io.StringIO(text)):
                if cols:
                    rows.append(tuple(list(cols) + [None] * 8)[:8])
        elif fname.endswith(".xlsx") or fname.endswith(".xlsm"):
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
            ws = wb.active
            for r in ws.iter_rows(values_only=True):
                if r and r[0] is not None:
                    rows.append(tuple(list(r) + [None] * 8)[:8])
            wb.close()
        else:
            raise HTTPException(status_code=400, detail="Format tidak didukung. Gunakan .xlsx atau .csv")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Gagal membaca file. Pastikan format .xlsx atau .csv benar.")

    created, skipped, invalid_dates, flagged = [], [], [], []
    hasil = {"tertaut": 0, "akun_baru": 0, "perlu_dicek": []}
    for row in rows:
        name_val, dob_val = row[0], row[1]
        ayah_nama, ayah_hp = row[2], row[3]
        ibu_nama, ibu_hp = row[4], row[5]
        wali_nama, wali_hp = row[6], row[7]
        name = str(name_val).strip()
        if not name or name.lower() in ("nama", "name", "nama lengkap", "nama peserta"):
            continue
        # Nama kembar: tetap dibuat, tandai perlu dilengkapi (jangan dilewati)
        duplicate = await db.users.find_one({"name": name})
        if dob_val is not None and str(dob_val).strip() and normalize_dob(dob_val) is None:
            invalid_dates.append({"name": name, "value": str(dob_val).strip()})
        doc = build_pending_doc(name, dob_val)
        doc["username"] = await unique_username_from_name(name)
        if duplicate:
            doc["needs_completion"] = True
            flagged.append(name)
        await db.users.insert_one(doc)
        anak_id = str(doc["_id"])
        created.append(name)
        # Satu baris = satu transaksi logis: kegagalan orang tua tidak membatalkan anak.
        for hubungan, nm, hp in (("ayah", ayah_nama, ayah_hp),
                                 ("ibu", ibu_nama, ibu_hp),
                                 ("wali", wali_nama, wali_hp)):
            try:
                await _tautkan_orang_tua(anak_id, nm, hp, hubungan, admin, hasil)
            except Exception as exc:  # pragma: no cover
                logger.warning("Taut wali gagal (%s): %s", name, exc)
                hasil["perlu_dicek"].append({"nama_anak": name,
                                             "alasan": f"{hubungan}: gagal disimpan"})
    await log_activity(admin, "impor_peserta",
                       f"Impor {len(created)} peserta dari file ({len(flagged)} nama kembar ditandai, "
                       f"{hasil['tertaut']} wali tertaut, {hasil['akun_baru']} akun orang tua baru)")
    return {"count": len(created), "skipped": skipped, "created_names": created,
            "invalid_dates": invalid_dates, "flagged": flagged,
            "wali": {"tertaut": hasil["tertaut"], "akun_baru": hasil["akun_baru"],
                     "perlu_dicek": hasil["perlu_dicek"]}}

# ---------------------------------------------------------------------------
# Fase 2: Kelompok / Majelis
# ---------------------------------------------------------------------------
@api_router.get("/admin/kelompok")
async def list_kelompok(admin: dict = Depends(require_staff)):
    items = await db.kelompoks.find().sort("name", 1).to_list(500)
    counts = await db.users.aggregate([
        {"$match": {"kelompok_id": {"$ne": None}}},
        {"$group": {"_id": "$kelompok_id", "n": {"$sum": 1}}},
    ]).to_list(1000)
    count_map = {c["_id"]: c["n"] for c in counts}
    return [{
        "id": k["_id"], "name": k.get("name"), "description": k.get("description"),
        "member_count": count_map.get(k["_id"], 0), "created_at": k.get("created_at"),
    } for k in items]

@api_router.post("/admin/kelompok")
async def create_kelompok(body: KelompokInput, admin: dict = Depends(require_admin)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama kelompok wajib diisi")
    if await db.kelompoks.find_one({"name": name}):
        raise HTTPException(status_code=409, detail="Nama kelompok sudah ada")
    doc = {"_id": str(uuid.uuid4()), "name": name,
           "description": body.description.strip() if body.description else None,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.kelompoks.insert_one(doc)
    await log_activity(admin, "buat_kelompok", f"Membuat kelompok '{name}'", doc["_id"])
    return {"id": doc["_id"], "name": doc["name"], "description": doc["description"], "member_count": 0}

@api_router.patch("/admin/kelompok/{kelompok_id}")
async def update_kelompok(kelompok_id: str, body: KelompokInput, admin: dict = Depends(require_admin)):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama kelompok wajib diisi")
    dup = await db.kelompoks.find_one({"name": name, "_id": {"$ne": kelompok_id}})
    if dup:
        raise HTTPException(status_code=409, detail="Nama kelompok sudah ada")
    res = await db.kelompoks.update_one({"_id": kelompok_id}, {"$set": {
        "name": name, "description": body.description.strip() if body.description else None}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Kelompok tidak ditemukan")
    return {"id": kelompok_id, "name": name}

@api_router.delete("/admin/kelompok/{kelompok_id}")
async def delete_kelompok(kelompok_id: str, keterangan: str = "",
                          admin: dict = Depends(require_admin)):
    """Hapus kelompok sambung. Anggota di dalamnya menjadi tanpa kelompok.

    Fase 7: UI wajib menampilkan pop-up konfirmasi (Ya / Tidak) + kolom keterangan;
    keterangan dikirim sebagai query `keterangan` dan dicatat pada log aktivitas.
    """
    k = await db.kelompoks.find_one({"_id": kelompok_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kelompok tidak ditemukan")
    affected = await db.users.count_documents({"kelompok_id": kelompok_id})
    await db.kelompoks.delete_one({"_id": kelompok_id})
    await db.users.update_many({"kelompok_id": kelompok_id}, {"$set": {"kelompok_id": None}})
    ket = (keterangan or "").strip()
    detail = f"Menghapus kelompok '{k.get('name')}' ({affected} anggota dilepas)"
    if ket:
        detail += f" — Ket: {ket}"
    await log_activity(admin, "hapus_kelompok", detail, kelompok_id)
    return {"message": f"Kelompok '{k.get('name')}' dihapus.",
            "affected": affected, "keterangan": ket or None}

# ---------------------------------------------------------------------------
# Fase 2: Peserta detail + update + bulk + reset + move
# ---------------------------------------------------------------------------
@api_router.get("/admin/users/{user_id}")
async def admin_user_detail(user_id: str, admin: dict = Depends(require_staff)):
    user = await db.users.find_one({"_id": parse_object_id(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    data = public_user(user, include_photo=True)
    if user.get("kelompok_id"):
        k = await db.kelompoks.find_one({"_id": user["kelompok_id"]})
        data["kelompok_name"] = k.get("name") if k else None
    return data

@api_router.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: PesertaUpdate, admin: dict = Depends(require_staff)):
    oid = parse_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    updates = {}
    if body.name is not None and body.name.strip():
        updates["name"] = body.name.strip()
    if body.email is not None:
        email = body.email.strip().lower() or None
        if email and await db.users.find_one({"email": email, "_id": {"$ne": oid}}):
            raise HTTPException(status_code=409, detail="Email sudah terdaftar")
        updates["email"] = email
    if body.phone is not None:
        phone = body.phone.strip() or None
        if phone and await db.users.find_one({"phone": phone, "_id": {"$ne": oid}}):
            raise HTTPException(status_code=409, detail="Nomor HP sudah terdaftar")
        updates["phone"] = phone
    if body.whatsapp is not None:
        updates["whatsapp"] = body.whatsapp.strip() or None
    if body.dob is not None:
        updates["dob"] = normalize_dob(body.dob)
        # Peserta yang BELUM punya jenjang boleh diisi saran dari umur (nilai awal).
        if not user.get("jenjang"):
            saran = saran_jenjang(updates["dob"])
            if saran:
                updates["jenjang"] = saran
                updates["jenjang_saran"] = True
    if body.birthplace is not None:
        updates["birthplace"] = body.birthplace.strip() or None
    if body.address is not None:
        updates["address"] = body.address.strip() or None
    if body.gender is not None:
        g = normalize_gender(body.gender)
        updates["gender"] = g
        updates["avatar_gender"] = "female" if g == "P" else "male"
    if body.education is not None:
        updates["education"] = body.education if body.education in EDUCATION_OPTIONS else None
    if body.mubaligh is not None:
        updates["mubaligh"] = body.mubaligh if body.mubaligh in MUBALIGH_OPTIONS else None
    if body.marital is not None:
        updates["marital"] = body.marital if body.marital in MARITAL_OPTIONS else None
        # Kategori selalu dihitung server; nilai dari klien diabaikan.
        kategori = kategori_dari_status(updates["marital"])
        if kategori:
            updates["kategori"] = kategori
    if body.photo is not None:
        updates["photo"] = body.photo or None
    if body.kelompok_id is not None:
        updates["kelompok_id"] = body.kelompok_id or None
    if body.needs_completion is not None:
        updates["needs_completion"] = bool(body.needs_completion)
    if body.jenjang is not None:
        jenjang = body.jenjang if body.jenjang in JENJANG_BY_ID else None
        updates["jenjang"] = jenjang
        # Admin mengonfirmasi/mengubah → bukan lagi saran dari umur.
        updates["jenjang_saran"] = False
    if body.nomor_wa_wali is not None:
        updates["nomor_wa_wali"] = normalize_wa_wali(body.nomor_wa_wali)
    if body.pengajar is not None:
        updates["pengajar"] = bool(body.pengajar)
    if body.roles is not None:
        roles = [r for r in body.roles if r in VALID_ROLES]
        if not roles:
            raise HTTPException(status_code=400, detail="Minimal satu peran valid")
        updates["roles"] = roles
    if body.status is not None:
        if body.status not in ("active", "nonaktif", "pending", "pindah", "calon"):
            raise HTTPException(status_code=400, detail="Status tidak valid")
        if body.status == "active" and not user.get("password_hash"):
            raise HTTPException(status_code=400, detail="Akun belum punya kata sandi. Tetapkan sandi dulu (reset).")
        updates["status"] = body.status
    if not updates:
        return public_user(user, include_photo=True)
    await db.users.update_one({"_id": oid}, {"$set": updates})
    user = await db.users.find_one({"_id": oid})
    await log_activity(admin, "ubah_peserta", f"Mengubah data '{user.get('name')}'", user_id)
    return public_user(user, include_photo=True)

@api_router.post("/admin/users/bulk")
async def admin_bulk_create(body: BulkCreateInput, admin: dict = Depends(require_staff)):
    created, invalid_dates, flagged = [], [], []
    for entry in body.entries:
        name = (entry.name or "").strip()
        if not name:
            continue
        duplicate = await db.users.find_one({"name": name})
        if entry.dob and str(entry.dob).strip() and normalize_dob(entry.dob) is None:
            invalid_dates.append({"name": name, "value": str(entry.dob).strip()})
        g = normalize_gender(entry.gender)
        doc = {
            "name": name, "email": None, "username": await unique_username_from_name(name),
            "phone": entry.phone.strip() if entry.phone else None, "whatsapp": None,
            "dob": normalize_dob(entry.dob),
            "birthplace": entry.birthplace.strip() if entry.birthplace else None,
            "address": None, "gender": g,
            "avatar_gender": "female" if g == "P" else "male",
            "education": None, "mubaligh": None,
            "kelompok_id": body.kelompok_id or None,
            "roles": ["peserta"], "source": "admin_bulk", "password_hash": None,
            "status": "pending", "token_version": 0,
            "needs_completion": bool(duplicate),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if duplicate:
            flagged.append(name)
        await db.users.insert_one(doc)
        created.append(name)
    await log_activity(admin, "tambah_bulk", f"Menambah {len(created)} peserta (bulk)")
    return {"count": len(created), "flagged": flagged, "invalid_dates": invalid_dates}

class CadanganInput(BaseModel):
    password: str
    kelompok: str = "peserta"          # peserta | kegiatan | absensi | pendaftaran


CADANGAN_KELOMPOK = ("peserta", "kegiatan", "absensi", "pendaftaran")
CADANGAN_BARIS_MAKS = 4000             # per berkas, agar aman di bawah 4,5 MB


def _cadangan_peserta() -> list:
    rows = []
    for u in db.users.find({"roles": "peserta"}).sort("name", 1):
        rows.append({
            "nama": u.get("name"), "username": u.get("username"),
            "email": u.get("email"), "telepon": u.get("phone"),
            "jenis_kelamin": u.get("gender"), "tempat_lahir": u.get("birthplace"),
            "tanggal_lahir": u.get("dob"), "alamat": u.get("address"),
            "pendidikan": u.get("education"), "status_pernikahan": u.get("marital"),
            "kategori": u.get("kategori"), "jenjang": u.get("jenjang"),
            "kelompok": u.get("kelompok_id"), "status": u.get("status"),
            "peran": ", ".join(u.get("roles") or []),
        })
    return rows


def _cadangan_kegiatan() -> list:
    rows = []
    for k in db.kegiatans.find({}).sort("date", 1):
        rows.append({
            "tanggal": k.get("date"), "nama": k.get("name"), "jenis": k.get("type"),
            "mulai": k.get("start_time"), "selesai": k.get("end_time"),
            "lokasi": k.get("location"), "pengajar": k.get("teacher"),
            "materi": k.get("material"), "status": k.get("status"),
        })
    return rows


def _cadangan_absensi() -> list:
    rows = []
    for a in db.absensis.find({}).sort("updated_at", 1):
        rows.append({
            "kegiatan_id": a.get("kegiatan_id"), "peserta_id": a.get("user_id"),
            "status": a.get("status"), "waktu_hadir": a.get("arrival_time"),
            "dicatat_oleh": a.get("marked_by"), "diperbarui": a.get("updated_at"),
        })
    return rows


def _cadangan_pendaftaran() -> list:
    rows = []
    for r in db.pendaftaran_konfirmasi.find({}).sort("dibuat_pada", 1):
        rows.append({
            "kegiatan_id": r.get("kegiatan_id"), "nama": r.get("nama"),
            "nomor_hp": r.get("nomor_hp"), "jawaban": r.get("kehadiran"),
            "alasan": r.get("alasan"), "alasan_lain": r.get("alasan_lain"),
            "keterangan": r.get("keterangan"), "dibuat": r.get("dibuat_pada"),
        })
    return rows


@api_router.get("/admin/cadangan/info")
async def cadangan_info(admin: dict = Depends(require_admin)):
    """Ringkasan jumlah baris per kelompok + waktu cadangan terakhir."""
    doc = await db.app_settings.find_one({"_id": "cadangan_terakhir"}) or {}
    return {
        "jumlah": {
            "peserta": await db.users.count_documents({"roles": "peserta"}),
            "kegiatan": await db.kegiatans.count_documents({}),
            "absensi": await db.absensis.count_documents({}),
            "pendaftaran": await db.pendaftaran_konfirmasi.count_documents({}),
        },
        "terakhir": doc.get("at"),
        "terakhir_oleh": doc.get("oleh"),
    }


@api_router.post("/admin/cadangan")
async def cadangan_unduh(body: CadanganInput, admin: dict = Depends(require_admin)):
    """Unduh cadangan satu kelompok data (xlsx). Butuh konfirmasi password."""
    if not verify_password(body.password or "", admin.get("password_hash") or ""):
        raise HTTPException(status_code=400, detail="Password Administrator salah.")
    kelompok = (body.kelompok or "").strip().lower()
    if kelompok not in CADANGAN_KELOMPOK:
        raise HTTPException(status_code=400, detail="Kelompok data tidak valid.")

    pengambil = {
        "peserta": _cadangan_peserta, "kegiatan": _cadangan_kegiatan,
        "absensi": _cadangan_absensi, "pendaftaran": _cadangan_pendaftaran,
    }[kelompok]
    rows = await asyncio.to_thread(pengambil)

    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = kelompok.capitalize()
    if rows:
        ws.append(list(rows[0].keys()))
        for r in rows:
            ws.append([r.get(k) for k in rows[0].keys()])
    else:
        ws.append(["Keterangan"])
        ws.append(["Belum ada data"])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    ukuran = buf.getbuffer().nbytes

    sekarang = now_wita().isoformat()
    await db.app_settings.update_one(
        {"_id": "cadangan_terakhir"},
        {"$set": {"at": sekarang, "oleh": admin.get("name")}}, upsert=True)
    await log_activity(admin, "cadangan_unduh",
                       f"Mengunduh cadangan {kelompok} ({len(rows)} baris)")
    nama = f"cadangan_{kelompok}_{now_wita().strftime('%Y%m%d_%H%M')}.xlsx"
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nama}"',
                 "X-Cadangan-Baris": str(len(rows)),
                 "X-Cadangan-Ukuran": str(ukuran)})


class AcakReguInput(BaseModel):
    sumber: str = "hadir"              # hadir | terdaftar
    mode: str = "jumlah_regu"          # jumlah_regu | anggota_per_regu
    nilai: int = 2
    seimbang: bool = True


class NomorUndianInput(BaseModel):
    sumber: str = "hadir"              # hadir | terdaftar


async def _peserta_acak(k: dict, sumber: str) -> list:
    """Peserta yang ikut diacak (nonaktif sementara tidak ikut)."""
    if sumber == "hadir":
        ids = [a["user_id"] async for a in db.absensis.find(
            {"kegiatan_id": k["_id"], "status": "hadir"}, {"user_id": 1})]
        if not ids:
            return []
        docs = await db.users.find({"_id": {"$in": [ObjectId(i) for i in ids if ObjectId.is_valid(i)]}},
                                   {"name": 1, "gender": 1, "kategori": 1, "marital": 1,
                                    "status": 1}).to_list(5000)
    else:
        docs = await db.users.find(peserta_query_for(k),
                                   {"name": 1, "gender": 1, "kategori": 1, "marital": 1,
                                    "status": 1}).to_list(5000)
    out = []
    for u in docs:
        if (u.get("status") or "") in ("nonaktif", "pindah"):
            continue
        out.append({
            "id": str(u["_id"]), "nama": u.get("name"),
            "gender": _derive_gender(u) or "Tidak diketahui",
            "kategori": kategori_dari_status(u.get("marital")) or u.get("kategori")
                        or "tidak_diketahui",
        })
    return out


@api_router.get("/staff/kegiatan/{kegiatan_id}/acak")
async def acak_hasil(kegiatan_id: str, staff: dict = Depends(require_staff)):
    """Hasil acak regu / nomor undian yang sudah disimpan."""
    doc = await db.kegiatan_acak.find_one({"_id": kegiatan_id}) or {}
    return {"regu": doc.get("regu"), "undian": doc.get("undian"),
            "dikunci": bool(doc.get("dikunci")), "dibuat": doc.get("dibuat")}


@api_router.post("/staff/kegiatan/{kegiatan_id}/acak-regu")
async def acak_regu(kegiatan_id: str, body: AcakReguInput,
                    staff: dict = Depends(require_staff)):
    """Acak pembagian regu (SystemRandom). Hasil belum disimpan sampai dikunci."""
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    sumber = (body.sumber or "hadir").strip().lower()
    if sumber not in ("hadir", "terdaftar"):
        raise HTTPException(status_code=400, detail="Sumber peserta tidak valid.")
    try:
        peserta = await _peserta_acak(k, sumber)
        if not peserta:
            raise HTTPException(
                status_code=400,
                detail=("Belum ada yang hadir" if sumber == "hadir"
                        else "Belum ada peserta terdaftar untuk kegiatan ini"))
        if len(peserta) < 2:
            raise HTTPException(status_code=400, detail="Peserta kurang dari 2 orang.")
        try:
            nilai = int(body.nilai or 1)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Jumlah regu tidak valid.")
        nilai = max(1, nilai)
        if body.mode == "anggota_per_regu":
            jumlah_regu = max(1, -(-len(peserta) // nilai))
        else:
            if nilai > len(peserta):
                raise HTTPException(status_code=400,
                                    detail="Jumlah regu melebihi jumlah peserta")
            jumlah_regu = nilai

        rnd = random.SystemRandom()
        if body.seimbang:
            # Kunci urut selalu teks agar nilai kosong tidak dibandingkan dengan None.
            kunci = sorted(peserta, key=lambda p: (
                str(p.get("kategori") or "tidak_diketahui").lower(),
                str(p.get("gender") or "tidak diketahui").lower(),
                str(p.get("nama") or "").lower(),
            ))
            rnd.shuffle(kunci)
            regu = [[] for _ in range(jumlah_regu)]
            for i, p in enumerate(kunci):
                regu[i % jumlah_regu].append(p)
        else:
            acak = peserta[:]
            rnd.shuffle(acak)
            regu = [[] for _ in range(jumlah_regu)]
            for i, p in enumerate(acak):
                regu[i % jumlah_regu].append(p)

        hasil = []
        for i, anggota in enumerate(regu, start=1):
            rnd.shuffle(anggota)
            hasil.append({"nama": f"Regu {i}", "anggota": anggota})
        return {"regu": hasil, "jumlah_peserta": len(peserta)}
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        logger.exception("Acak regu gagal (kegiatan %s): %s", kegiatan_id, exc)
        raise HTTPException(status_code=500,
                            detail="Gagal mengacak regu. Coba lagi.")


@api_router.post("/staff/kegiatan/{kegiatan_id}/acak-undian")
async def acak_undian(kegiatan_id: str, body: NomorUndianInput,
                      staff: dict = Depends(require_staff)):
    """Beri nomor undian unik (SystemRandom). Belum disimpan sampai dikunci."""
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    sumber = (body.sumber or "hadir").strip().lower()
    if sumber not in ("hadir", "terdaftar"):
        raise HTTPException(status_code=400, detail="Sumber peserta tidak valid.")
    try:
        peserta = await _peserta_acak(k, sumber)
        if not peserta:
            raise HTTPException(
                status_code=400,
                detail=("Belum ada yang hadir" if sumber == "hadir"
                        else "Belum ada peserta terdaftar untuk kegiatan ini"))
        rnd = random.SystemRandom()
        nomor = rnd.sample(range(1, len(peserta) * 10 + 1), len(peserta))
        hasil = [{"nomor": n, "id": p["id"], "nama": p["nama"]}
                 for n, p in zip(nomor, peserta)]
        hasil.sort(key=lambda r: r["nomor"] if r["nomor"] is not None else 0)
        return {"undian": hasil, "jumlah_peserta": len(peserta)}
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover
        logger.exception("Acak undian gagal (kegiatan %s): %s", kegiatan_id, exc)
        raise HTTPException(status_code=500,
                            detail="Gagal mengacak nomor undian. Coba lagi.")


@api_router.post("/staff/kegiatan/{kegiatan_id}/acak-simpan")
async def acak_simpan(kegiatan_id: str, body: dict, staff: dict = Depends(require_staff)):
    """Kunci hasil acak agar stabil saat dibuka ulang."""
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    regu = body.get("regu")
    undian = body.get("undian")
    if not regu and not undian:
        raise HTTPException(status_code=400, detail="Tidak ada hasil untuk disimpan.")
    await db.kegiatan_acak.update_one(
        {"_id": kegiatan_id},
        {"$set": {"regu": regu, "undian": undian, "dikunci": True,
                  "dibuat": now_wita().isoformat(),
                  "dibuat_oleh": staff.get("name")}},
        upsert=True)
    await log_activity(staff, "acak_kegiatan",
                       f"Menyimpan hasil acak regu/undian '{k.get('name')}'", kegiatan_id)
    return {"ok": True}


@api_router.post("/admin/users/migrasi-kategori")
async def admin_migrasi_kategori(apply: bool = False, admin: dict = Depends(require_admin)):
    """Hitung ulang kategori peserta dari status pernikahan.

    `apply=false` (bawaan) hanya menampilkan pratinjau; `apply=true` menyimpan.
    Nilai status kosong/tidak dikenal tidak diubah.
    """
    rows = await db.users.find({"roles": "peserta"}).to_list(20000)
    pindah, tanpa_status, dewasa_jenjang = [], [], []
    for u in rows:
        baru = kategori_dari_status(u.get("marital"))
        lama = u.get("kategori")
        if baru is None:
            tanpa_status.append(u.get("name"))
            continue
        if baru != lama:
            pindah.append({"id": str(u["_id"]), "nama": u.get("name"),
                           "lama": lama, "baru": baru})
        if baru == "dewasa" and u.get("jenjang"):
            dewasa_jenjang.append({"nama": u.get("name"), "jenjang": u.get("jenjang")})
    if apply and pindah:
        for p in pindah:
            await db.users.update_one({"_id": ObjectId(p["id"])},
                                      {"$set": {"kategori": p["baru"]}})
        await log_activity(admin, "migrasi_kategori",
                           f"Menghitung ulang kategori {len(pindah)} peserta")
    return {"apply": apply, "jumlah": len(pindah), "pindah": pindah,
            "tanpa_status": len(tanpa_status),
            "dewasa_jenjang": dewasa_jenjang}


@api_router.post("/admin/users/bulk-delete")
async def admin_bulk_delete(body: BulkDeleteInput, admin: dict = Depends(require_staff)):
    ids = [i for i in body.ids if i != str(admin["_id"])]
    oids = []
    for i in ids:
        try:
            oids.append(ObjectId(i))
        except Exception:
            continue
    if not oids:
        raise HTTPException(status_code=400, detail="Tidak ada ID valid untuk dihapus")
    res = await db.users.delete_many({"_id": {"$in": oids}})
    await log_activity(admin, "hapus_massal", f"Menghapus {res.deleted_count} akun sekaligus")
    return {"deleted": res.deleted_count}

async def unique_username_from_name(name: str, exclude_id=None) -> str:
    base = " ".join(name.strip().lower().split())
    for suffix in range(1, 10000):
        candidate = base if suffix == 1 else f"{base} {suffix}"
        query = {"username": candidate}
        if exclude_id is not None:
            query["_id"] = {"$ne": exclude_id}
        if await db.users.find_one(query) is None:
            return candidate
    raise HTTPException(status_code=409, detail="Nama pengguna tidak dapat dibuat karena terlalu banyak nama yang sama.")


@api_router.post("/admin/users/bulk-activate")
async def admin_bulk_activate(body: BulkActivateInput, admin: dict = Depends(require_staff)):
    if not body.ids:
        raise HTTPException(status_code=400, detail="Pilih minimal satu akun peserta.")
    activated = []
    skipped = []
    seen = set()
    for user_id in body.ids:
        if user_id in seen:
            continue
        seen.add(user_id)
        try:
            oid = parse_object_id(user_id)
        except HTTPException:
            skipped.append({"id": user_id, "reason": "ID tidak valid"})
            continue
        user = await db.users.find_one({"_id": oid})
        if not user:
            skipped.append({"id": user_id, "reason": "Peserta tidak ditemukan"})
            continue
        if set(user.get("roles") or []) != {"peserta"}:
            skipped.append({"id": user_id, "reason": "Aktivasi massal hanya untuk akun dengan peran Peserta saja"})
            continue
        if user.get("status") != "pending":
            skipped.append({"id": user_id, "reason": "Akun tidak berstatus Belum Aktivasi"})
            continue
        dob = normalize_dob(user.get("dob"))
        if not dob:
            skipped.append({"id": user_id, "reason": "Tanggal lahir belum valid"})
            continue
        year, month, day = dob.split("-")
        username = user.get("username") or await unique_username_from_name(user.get("name") or "peserta")
        result = await db.users.update_one(
            {"_id": oid, "status": "pending"},
            {"$set": {
                "username": username,
                "password_hash": hash_password(f"{day}{month}{year}"),
                "status": "active",
                "must_change_password": True,
            }, "$inc": {"token_version": 1}},
        )
        if result.modified_count:
            await db.login_attempts.delete_many({"identifier": user_id})
            activated.append({"id": user_id, "name": user.get("name"), "username": username})
        else:
            skipped.append({"id": user_id, "reason": "Status akun berubah saat diproses"})

    await log_activity(
        admin, "aktivasi_massal",
        f"Mengaktifkan {len(activated)} akun Peserta; {len(skipped)} dilewati",
    )
    return {"activated": activated, "skipped": skipped}

@api_router.get("/admin/users/{user_id}/status-login")
async def admin_status_login(user_id: str, admin: dict = Depends(require_admin)):
    """Ringkasan status login satu akun (tanpa hash kata sandi)."""
    oid = parse_object_id(user_id)
    u = await db.users.find_one({"_id": oid})
    if not u:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    pasangan = _sandi_default_dari_dob(u.get("dob"))
    h = u.get("password_hash")
    masih_default = bool(pasangan and h and verify_password(pasangan[0], h))
    sejak = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
    gagal = await db.login_attempts.count_documents(
        {"identifier": str(oid), "at": {"$gte": sejak}})
    return {
        "tanggal_lahir_terisi": bool(pasangan),
        "sandi_masih_default": masih_default,
        "wajib_ganti": bool(u.get("must_change_password")),
        "gagal_login_15_menit": gagal,
        "terkunci": gagal >= LOGIN_AKUN_MAKS,
    }


@api_router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_password(user_id: str, admin: dict = Depends(require_staff)):
    oid = parse_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    hasil = await _setel_sandi_default(user, oleh=admin)
    if not hasil.get("ok"):
        raise HTTPException(status_code=400, detail=hasil.get("alasan") or "Reset gagal.")
    return {"message": "Kata sandi direset ke tanggal lahir (DDMMYY).",
            "sandi_sementara": hasil["sandi"]}
    return {
        "password": new_pw,
        "username": set_fields.get("username", user.get("username")),
        "message": "Kata sandi sementara direset ke tanggal lahir (ddmmyyyy); peserta wajib menggantinya saat masuk.",
    }

@api_router.post("/admin/users/{user_id}/move")
async def admin_move_kelompok(user_id: str, body: MoveInput, admin: dict = Depends(require_staff)):
    oid = parse_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    kname = None
    if body.kelompok_id:
        k = await db.kelompoks.find_one({"_id": body.kelompok_id})
        if not k:
            raise HTTPException(status_code=404, detail="Kelompok tujuan tidak ditemukan")
        kname = k.get("name")
    await db.users.update_one({"_id": oid}, {"$set": {"kelompok_id": body.kelompok_id or None}})
    ket = (body.keterangan or "").strip()
    detail = f"Pindah '{user.get('name')}' ke kelompok {kname or '-'}"
    if ket:
        detail += f" — Ket: {ket}"
    await log_activity(admin, "pindah_sambung", detail, user_id)
    return {"message": "Pindah sambung berhasil", "kelompok_id": body.kelompok_id or None,
            "kelompok_name": kname, "keterangan": ket or None}

# ---------------------------------------------------------------------------
# Fase 2: Log Aktivitas
# ---------------------------------------------------------------------------
@api_router.get("/admin/logs")
async def admin_logs(admin: dict = Depends(require_staff), limit: int = 100, action: str = ""):
    query = {}
    if action.strip():
        query["action"] = action.strip()
    limit = max(1, min(limit, 500))
    logs = await db.activity_logs.find(query).sort("at", -1).to_list(limit)
    return [{
        "id": l["_id"], "actor_id": l.get("actor_id"), "actor_name": l.get("actor_name"),
        "action": l.get("action"), "detail": l.get("detail"), "target": l.get("target"),
        "at": l.get("at"),
    } for l in logs]

# ===========================================================================
# FASE 2 — KEGIATAN + ABSENSI + DASHBOARD + LAPORAN (Admin)
# ===========================================================================
import asyncio

WITA = timezone(timedelta(hours=8))
KEGIATAN_TYPES = ["rutin", "khusus", "asad", "pembelajaran"]
ABSEN_STATUS = ["hadir", "izin", "sakit", "alpha"]
# Daftar peserta untuk absensi & rekap.
# Termasuk peserta hasil import Excel yang BELUM aktivasi (status "pending") supaya
# pengurus/penjaga absen tetap bisa mengabsen mereka secara MANUAL, dan mereka juga
# ikut dihitung pada rekap/laporan kehadiran.
# Fase 7: akun sistem (admin pengelola) TIDAK ikut terdaftar/dihitung sebagai peserta.
PESERTA_QUERY = {"roles": "peserta", "status": {"$in": ["active", "pending"]},
                 "is_system": {"$ne": True}}
# FASE 8 — Tipe peserta kegiatan:
#   "reguler" → hanya peserta yang SUDAH aktivasi akun (status active)
#   "publik"  → terbuka: peserta aktif + belum aktivasi + tamu (nama bebas)
KEGIATAN_AUDIENCES = ["reguler", "publik"]
# FASE 8 — Penyaringan peserta kegiatan berdasarkan jenis kelamin.
KEGIATAN_GENDER_FILTERS = ["semua", "L", "P"]
# FASE 9 — PENGELOMPOKAN LANJUTAN (dibuka, sebelumnya "segera hadir"):
#   1. Status pernikahan  → "semua" | "belum_menikah" | "sudah_menikah"
#   2. Kelompok usia      → daftar kosong = semua usia
KEGIATAN_MARITAL_FILTERS = ["semua"] + MARITAL_OPTIONS
AGE_GROUPS = [
    {"value": "anak", "label": "Anak-anak", "min": 0, "max": 12},
    {"value": "remaja", "label": "Remaja", "min": 13, "max": 19},
    {"value": "muda", "label": "Usia Muda", "min": 20, "max": 35},
    {"value": "dewasa", "label": "Dewasa", "min": 36, "max": 55},
    {"value": "lansia", "label": "Lansia", "min": 56, "max": 200},
]
AGE_GROUP_KEYS = [g["value"] for g in AGE_GROUPS]
AGE_GROUP_LABEL = {g["value"]: g["label"] for g in AGE_GROUPS}
MARITAL_LABEL = {"belum_menikah": "Belum Menikah", "sudah_menikah": "Sudah Menikah"}
# FASE 9 — Label sesi kegiatan (1 hari beberapa waktu).
SESSION_LABELS = ["Pagi", "Siang", "Sore", "Malam"]
# FASE 8 — Status tindak lanjut peserta yang tidak hadir kegiatan sebelumnya.
FOLLOWUP_STATUSES = ["belum_dihubungi", "sudah_dihubungi", "akan_hadir", "tidak_bisa"]
SHARE_EXPIRE_DAYS = 7
# Fase 7: barcode/QR absen per kegiatan berlaku 1 bulan (30 hari).
KEGIATAN_BARCODE_DAYS = 30
# Fase 7: panjang kode akses absensi kegiatan.
ACCESS_CODE_LEN = 6


def now_wita() -> datetime:
    return datetime.now(WITA)


def kegiatan_end_dt(date_str: str, end_time: str):
    try:
        return datetime.strptime(f"{date_str} {end_time}", "%Y-%m-%d %H:%M").replace(tzinfo=WITA)
    except Exception:
        return None


def valid_kegiatan_schedule(date_str: str, start_time: str, end_time: str) -> bool:
    start = kegiatan_end_dt(date_str, start_time)
    end = kegiatan_end_dt(date_str, end_time)
    return bool(start and end and end > start)


def gen_access_code() -> str:
    """Kode akses absensi kegiatan — 6 digit angka."""
    return "".join(secrets.choice("0123456789") for _ in range(ACCESS_CODE_LEN))


def wa_template_laporan(judul: str, link: str) -> str:
    """Template WhatsApp BAKU untuk berbagi laporan/rekap (Fase 7)."""
    judul = re.sub(r"^laporan\s+", "", (judul or "").strip(), flags=re.IGNORECASE)
    return (
        f"Laporan {judul}\n"
        f"{link}"
    )


def end_of_day_iso(date_str: Optional[str]) -> str:
    """Akhir hari (23:59:59 WITA) dari tanggal kegiatan."""
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, tzinfo=WITA)
    except Exception:
        d = now_wita().replace(hour=23, minute=59, second=59, microsecond=0)
    return d.isoformat()


def kegiatan_barcode_expiry(k: dict) -> str:
    """REVISI — QR absen kegiatan berlaku HARIAN: habis di akhir hari kegiatan."""
    return end_of_day_iso(k.get("date"))


def to_wita_iso(value: Optional[str]) -> str:
    """FASE 8 \u2014 Waktu dari HP (biasanya UTC) diseragamkan ke zona WITA.

    Dipakai saat sinkronisasi absen offline agar jam kedatangan yang tampil
    tetap konsisten dengan absen online.
    """
    if not value:
        return now_wita().isoformat()
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return now_wita().isoformat()
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(WITA).isoformat()


def is_expired_iso(value: Optional[str]) -> bool:
    if not value:
        return False
    try:
        dt = datetime.fromisoformat(value)
    except Exception:
        return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=WITA)
    return dt <= datetime.now(timezone.utc)


class SessionInput(BaseModel):
    """FASE 9 — satu waktu/sesi kegiatan dalam 1 hari (mis. Pagi 08:00-10:00).

    FASE 12 — setiap sesi bisa punya pengajar, materi & lokasi sendiri.
    Bila dikosongkan, dipakai nilai dari kegiatan induk.
    """
    label: str
    start_time: str
    end_time: str
    teacher: Optional[str] = None
    material: Optional[str] = None
    location: Optional[str] = None
    required: bool = True   # FASE 13 — sesi WAJIB dihadiri (False = opsional/tambahan)
    participant_ids: Optional[List[str]] = None


class KegiatanInput(BaseModel):
    name: str
    type: str = "rutin"
    date: str  # YYYY-MM-DD (WITA)
    start_time: str  # HH:MM (WITA, 24h)
    end_time: str
    teacher: Optional[str] = None
    material: Optional[str] = None
    location: Optional[str] = None
    recurring: bool = False
    recurring_months: Optional[int] = None
    maps_query: Optional[str] = None
    # FASE 8
    audience: str = "reguler"          # reguler | publik
    gender_filter: str = "semua"       # semua | L | P
    # FASE 9 — pengelompokan lanjutan
    marital_filter: str = "semua"      # semua | belum_menikah | sudah_menikah
    age_filter: List[str] = []         # [] = semua usia
    # FASE 18 — daftar peserta tertentu (mode ceklis). [] = ikut penyaringan di atas.
    participant_ids: List[str] = []
    attendance_participant_ids: Optional[List[str]] = None
    # FASE 9 — beberapa waktu/sesi dalam 1 hari (pagi/sore/malam)
    sessions: List[SessionInput] = []
    # Absen sebelumnya — kegiatan lampau yang sengaja dibiarkan terbuka
    # (dikecualikan dari auto-close) sampai pengurus menutupnya manual.
    susulan: bool = False
    # Pengajar ber-penanda `pengajar` tidak dihitung di rekap kegiatan ini.
    pengajar_tidak_wajib: bool = False
    # Daftar nama (id peserta) yang dikecualikan dari kewajiban absen.
    pengajar_dikecualikan_ids: List[str] = []


class KegiatanUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    teacher: Optional[str] = None
    material: Optional[str] = None
    location: Optional[str] = None
    maps_query: Optional[str] = None
    audience: Optional[str] = None
    gender_filter: Optional[str] = None
    marital_filter: Optional[str] = None
    age_filter: Optional[List[str]] = None
    participant_ids: Optional[List[str]] = None
    attendance_participant_ids: Optional[List[str]] = None
    session_label: Optional[str] = None
    pengajar_tidak_wajib: Optional[bool] = None
    pengajar_dikecualikan_ids: Optional[List[str]] = None


class AbsenInput(BaseModel):
    user_id: str
    status: str  # hadir | izin | sakit | alpha
    reason: Optional[str] = None   # alasan "tidak bisa hadir" (izin/sakit)
    note: Optional[str] = None     # keterangan tambahan (opsional)


class AbsenBatchItem(BaseModel):
    user_id: str
    status: str
    marked_at: Optional[str] = None
    reason: Optional[str] = None
    note: Optional[str] = None


class AbsenBatchInput(BaseModel):
    items: List[AbsenBatchItem] = []


class AbsensiBatchInput(BaseModel):
    access: str
    items: List[AbsenBatchItem] = []


class GuestInput(BaseModel):
    name: str


class AbsensiGuestInput(BaseModel):
    access: str
    name: str


class FollowUpInput(BaseModel):
    user_id: str
    status: str = "sudah_dihubungi"
    note: Optional[str] = None


def serialize_kegiatan(k: dict, counts: Optional[dict] = None) -> dict:
    d = {
        "id": k["_id"],
        "name": k.get("name"),
        "type": k.get("type", "rutin"),
        "date": k.get("date"),
        "start_time": k.get("start_time"),
        "end_time": k.get("end_time"),
        "teacher": k.get("teacher"),
        "material": k.get("material"),
        "location": k.get("location"),
        "maps_query": k.get("maps_query"),
        "recurring": bool(k.get("recurring")),
        "status": k.get("status", "open"),
        "closed_at": k.get("closed_at"),
        "auto_closed": bool(k.get("auto_closed", False)),
        "pengajar_tidak_wajib": bool(k.get("pengajar_tidak_wajib", False)),
        "pengajar_dikecualikan_ids": list(k.get("pengajar_dikecualikan_ids") or []),
        # Kegiatan lama: saklar menyala tanpa daftar → daftar diisi semua pengajar.
        "pengajar_dikecualikan_warisan": bool(
            k.get("pengajar_tidak_wajib") and k.get("pengajar_dikecualikan_ids") is None),
        "susulan": bool(k.get("susulan", False)),
        "share_token": k.get("share_token"),
        "share_expires_at": k.get("share_expires_at"),
        # Fase 7 — kode akses absensi + masa berlaku barcode kegiatan (1 bulan)
        "access_code": k.get("access_code"),
        "akses_token": k.get("akses_token"),
        "absen_expires_at": k.get("absen_expires_at"),
        # FASE 8 — tipe peserta, filter jenis kelamin & fase waktu kegiatan
        "audience": k.get("audience", "reguler"),
        "gender_filter": k.get("gender_filter", "semua"),
        # FASE 9 — pengelompokan lanjutan + sesi (1 hari beberapa waktu)
        "marital_filter": k.get("marital_filter", "semua"),
        "age_filter": normalize_age_filter(k.get("age_filter")),
        "participant_ids": list(k.get("participant_ids") or []),
        "filter_labels": kegiatan_filter_labels(k),
        "base_name": k.get("base_name") or k.get("name"),
        "session_label": k.get("session_label"),
        "session_group_id": k.get("session_group_id"),
        "session_index": k.get("session_index"),
        "session_total": k.get("session_total") or 1,
        "session_required": bool(k.get("session_required", True)),
        "session_participant_ids": list(k.get("session_participant_ids") or []),
        # Guru — pertemuan otomatis dari jadwal Program Pembelajaran
        "jadwal_id": k.get("jadwal_id"),
        "materi_id": k.get("materi_id"),
        "materi_tersampaikan": bool(k.get("materi_tersampaikan", False)),
        "pokok_bahasan": k.get("pokok_bahasan"),
        "guru_id": k.get("guru_id"),
        "jenjang": k.get("jenjang"),
        "phase": kegiatan_phase(k),
        "created_at": k.get("created_at"),
    }
    if counts is not None:
        d["counts"] = counts
    return d


def kegiatan_phase(k: dict) -> str:
    """FASE 8 — Fase kegiatan untuk pengurutan daftar.

    - "akan_datang" : tanggal masih di depan & belum ditutup
    - "berlangsung" : hari ini / masih terbuka
    - "selesai"     : sudah ditutup / diselesaikan
    """
    if (k.get("status") or "open") != "open":
        return "selesai"
    today = now_wita().date().isoformat()
    date = k.get("date") or today
    if date > today:
        return "akan_datang"
    return "berlangsung"


def gender_label(gf: str) -> str:
    return {"L": "Khusus Laki-laki", "P": "Khusus Perempuan"}.get(gf, "Semua Peserta")


# --------------------------- FASE 9: usia & pernikahan ---------------------------
def age_from_dob(dob: Optional[str], ref: Optional[datetime] = None) -> Optional[int]:
    """Umur (tahun penuh) dari tanggal lahir 'YYYY-MM-DD'. None bila tidak valid."""
    d = normalize_dob(dob)
    if not d:
        return None
    try:
        born = datetime.strptime(d, "%Y-%m-%d").date()
    except Exception:
        return None
    today = (ref or now_wita()).date()
    years = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return years if 0 <= years <= 200 else None


def age_group_of(dob: Optional[str]) -> Optional[str]:
    """Kelompok usia peserta ('anak'|'remaja'|'muda'|'dewasa'|'lansia')."""
    age = age_from_dob(dob)
    if age is None:
        return None
    for g in AGE_GROUPS:
        if g["min"] <= age <= g["max"]:
            return g["value"]
    return None


def normalize_age_filter(value) -> list:
    """Bersihkan daftar kelompok usia; daftar kosong = semua usia."""
    if not value:
        return []
    out = []
    for v in value:
        v = str(v).strip()
        if v and v != "semua" and v in AGE_GROUP_KEYS and v not in out:
            out.append(v)
    # Semua kelompok dipilih = tidak ada penyaringan
    if len(out) == len(AGE_GROUP_KEYS):
        return []
    return out


def kegiatan_filter_labels(k: dict) -> list:
    """Label ringkas semua penyaringan peserta kegiatan (untuk UI & pesan error)."""
    labels = []
    gf = k.get("gender_filter") or "semua"
    if gf in ("L", "P"):
        labels.append(gender_label(gf))
    mf = k.get("marital_filter") or "semua"
    if mf in MARITAL_OPTIONS:
        labels.append(f"Khusus {MARITAL_LABEL[mf]}")
    ages = normalize_age_filter(k.get("age_filter"))
    if ages:
        labels.append("Khusus Usia " + ", ".join(AGE_GROUP_LABEL[a] for a in ages))
    pids = k.get("participant_ids") or []
    if pids:
        labels.append(f"Peserta Terpilih ({len(pids)} orang)")
    return labels


def peserta_query_for(k: dict) -> dict:
    """Query peserta sesuai tipe kegiatan (FASE 8) + status pernikahan (FASE 9)."""
    q = dict(PESERTA_QUERY)
    if (k.get("audience") or "reguler") == "reguler":
        # Kegiatan reguler: hanya akun yang sudah aktivasi.
        q["status"] = "active"
    mf = k.get("marital_filter") or "semua"
    if mf in MARITAL_OPTIONS:
        q["marital"] = mf
    return q


def match_gender_filter(k: dict, user: dict) -> bool:
    """Apakah 1 peserta termasuk daftar peserta kegiatan.

    FASE 9 — selain jenis kelamin, ikut memeriksa PENGELOMPOKAN LANJUTAN:
    status pernikahan & kelompok usia. Nama fungsi dipertahankan karena
    dipakai di banyak endpoint.
    """
    pids = k.get("participant_ids") or []
    if pids and str(user.get("_id")) not in set(pids):
        return False
    gf = k.get("gender_filter") or "semua"
    if gf in ("L", "P") and (_derive_gender(user) or "L") != gf:
        return False
    mf = k.get("marital_filter") or "semua"
    if mf in MARITAL_OPTIONS and (user.get("marital") or None) != mf:
        return False
    ages = normalize_age_filter(k.get("age_filter"))
    if ages and age_group_of(user.get("dob")) not in ages:
        return False
    return True


def assert_gender_eligible(k: dict, u: dict) -> None:
    """REVISI: blokir total peserta yang tidak sesuai penyaringan kegiatan."""
    if not match_gender_filter(k, u):
        labels = kegiatan_filter_labels(k) or ["khusus kelompok tertentu"]
        raise HTTPException(
            status_code=400,
            detail=f"Kegiatan ini {' · '.join(labels).lower()}. "
                   f"{u.get('name') or 'Peserta'} tidak termasuk daftar peserta kegiatan ini.")


async def peserta_for_kegiatan(k: dict) -> list:
    """Daftar peserta yang berhak diabsen pada satu kegiatan (FASE 8/9)."""
    docs = await db.users.find(peserta_query_for(k)).sort("name", 1).to_list(5000)
    return [d for d in docs if match_gender_filter(k, d)]


def filter_peserta_for_kegiatan(k: dict, all_users: list) -> list:
    """Versi in-memory (dipakai daftar kegiatan agar tidak query berulang)."""
    reguler = (k.get("audience") or "reguler") == "reguler"
    out = []
    for u in all_users:
        if reguler and (u.get("status") or "active") != "active":
            continue
        if not match_gender_filter(k, u):
            continue
        out.append(u)
    return out


def session_requires_participant(k: dict, user_id: str) -> bool:
    participant_ids = k.get("session_participant_ids")
    if participant_ids is not None:
        return user_id in set(participant_ids)
    return bool(k.get("session_required", True))


def alpha_allowed(k: dict) -> bool:
    if k.get("status", "open") != "open":
        return True
    end = kegiatan_end_dt(k.get("date"), k.get("end_time"))
    return bool(end and now_wita() >= end)


def validate_absen_status(k: dict, status: str) -> None:
    if status not in ABSEN_STATUS:
        raise HTTPException(status_code=400, detail="Status absensi tidak valid")
    if status == "alpha" and not alpha_allowed(k):
        raise HTTPException(
            status_code=400,
            detail="Status Alpha baru bisa dipilih setelah waktu kegiatan berakhir")


async def count_peserta_total() -> int:
    return await db.users.count_documents(PESERTA_QUERY)


def pengajar_dikecualikan(k: Optional[dict], peserta: list) -> set:
    """Peserta yang TIDAK dihitung sebagai peserta wajib di kegiatan ini.

    Hanya berlaku bila kegiatan menyetel `pengajar_tidak_wajib` = true.
    Daftar nama diambil dari `pengajar_dikecualikan_ids`; kegiatan lama yang
    hanya menyalakan saklar tanpa daftar memakai semua peserta ber-penanda
    `pengajar` (hasil rekap lama tidak berubah).
    """
    if not k or not k.get("pengajar_tidak_wajib"):
        return set()
    ids = k.get("pengajar_dikecualikan_ids")
    if ids is None:
        return {str(p["_id"]) for p in peserta if p.get("pengajar")}
    return {str(x) for x in ids if str(x).strip()}


def compute_counts(peserta: list, absens: list, guests: int = 0,
                   skip_ids: Optional[set] = None, kegiatan: Optional[dict] = None,
                   exclude_ids: Optional[set] = None) -> dict:
    """Angka rekap 1 kegiatan — SATU-SATUNYA fungsi hitung rekap.

    `skip_ids` = peserta yang sudah hadir di sesi lain pada hari yang sama
    (dipakai daftar kegiatan admin; peserta wajib tetap dihitung).
    `exclude_ids` = peserta yang sudah hadir di kegiatan yang MULAI LEBIH AWAL
    pada hari & kelompok yang sama. Mereka dikeluarkan dari penyebut, kartu, dan
    daftar nama rekap kegiatan ini (dipakai rekap publik & gabungan).
    Peserta di daftar `pengajar_dikecualikan_ids` tidak dihitung sebagai peserta
    wajib (tidak menjadi Alpha), tetapi tetap dihitung bila punya status.
    """
    amap = {a["user_id"]: a.get("status") for a in absens}
    skip = skip_ids or set()
    if kegiatan:
        skip = {
            pid for pid in skip
            if not session_requires_participant(kegiatan, pid)
        }
    drop = skip | (exclude_ids or set())
    pengajar = pengajar_dikecualikan(kegiatan, peserta)
    ids = {
        str(p["_id"]) for p in peserta
        if str(p["_id"]) not in drop
        and (str(p["_id"]) in amap
             or (str(p["_id"]) not in pengajar
                 and session_requires_participant(kegiatan, str(p["_id"]))))
    }
    counts = {"hadir": guests, "izin": 0, "sakit": 0, "alpha": 0, "belum_diabsen": 0}
    for pid in ids:
        status = amap.get(pid)
        if status in ("hadir", "izin", "sakit", "alpha"):
            counts[status] += 1
        else:
            counts["belum_diabsen"] += 1
    total = len(ids) + guests
    hadir = counts["hadir"]
    ratio = round((hadir / total) * 100, 1) if total else 0.0
    return {"total": total, **counts, "ratio": ratio,
            "sudah_sesi_lain": len(skip),
            "dikecualikan": len(exclude_ids or set()),
            "pengajar_dikecualikan": len(pengajar)}


def _kegiatan_urutan(k: dict) -> tuple:
    """Kunci urutan kegiatan dalam satu kelompok: jam mulai lalu indeks sesi."""
    return (k.get("start_time") or "", k.get("session_index") or 0)


async def hadir_di_kegiatan_sebelumnya(k: dict) -> dict:
    """Peserta yang HADIR di kegiatan lain pada hari & kelompok yang sama yang
    MULAI LEBIH AWAL dari kegiatan ini.

    Kunci kelompok = `session_group_id` (sama dengan pengelompokan pagi/malam).
    Mengembalikan {user_id: label kegiatan}.
    """
    gid = k.get("session_group_id")
    if not gid:
        return {}
    docs = await db.kegiatans.find({"session_group_id": gid,
                                    "_id": {"$ne": k.get("_id")}}).to_list(20)
    urut = _kegiatan_urutan(k)
    earlier = {d["_id"]: d for d in docs if _kegiatan_urutan(d) < urut}
    if not earlier:
        return {}
    absens = await db.absensis.find({"kegiatan_id": {"$in": list(earlier)},
                                     "status": "hadir"}).to_list(50000)
    out: dict = {}
    for a in absens:
        d = earlier.get(a["kegiatan_id"]) or {}
        out.setdefault(a["user_id"], d.get("session_label") or d.get("name"))
    return out


async def attended_other_sessions(k: dict) -> dict:
    """FASE 12 — peserta yang SUDAH hadir di sesi LAIN pada hari yang sama.

    Mengembalikan {user_id: {"label": nama sesi, "arrival_time": ...}}.
    Dipakai agar nama yang sudah absen sesi pagi tidak lagi tercatat/ditagih
    pada sesi sore/malam di hari yang sama.
    """
    gid = k.get("session_group_id")
    if not gid:
        return {}
    docs = await db.kegiatans.find({"session_group_id": gid,
                                    "_id": {"$ne": k.get("_id")}}).to_list(20)
    if not docs:
        return {}
    dmap = {d["_id"]: d for d in docs}
    absens = await db.absensis.find({"kegiatan_id": {"$in": list(dmap)},
                                     "status": "hadir"}).to_list(50000)
    out: dict = {}
    for a in absens:
        d = dmap.get(a["kegiatan_id"]) or {}
        idx = d.get("session_index") or 0
        prev = out.get(a["user_id"])
        if prev is None or idx < prev["index"]:
            out[a["user_id"]] = {"label": d.get("session_label") or d.get("name"),
                                 "arrival_time": a.get("arrival_time"), "index": idx}
    return out


async def assert_not_attended_other_session(k: dict, user_id: str, name: str = "Peserta") -> None:
    info = (await attended_other_sessions(k)).get(user_id)
    if info and not session_requires_participant(k, user_id):
        raise HTTPException(
            status_code=400,
            detail=f"{name} sudah tercatat hadir pada sesi {info['label']} di hari yang sama, "
                   "jadi tidak perlu diabsen lagi pada sesi ini.")


async def kegiatan_counts(kegiatan, total: Optional[int] = None) -> dict:
    """Rekap angka absensi 1 kegiatan (hormati filter peserta FASE 8)."""
    k = kegiatan
    if isinstance(kegiatan, str):
        k = await db.kegiatans.find_one({"_id": kegiatan}) or {"_id": kegiatan}
    peserta = await peserta_for_kegiatan(k)
    absens = await db.absensis.find({"kegiatan_id": k["_id"]}).to_list(10000)
    guests = await db.guest_absens.count_documents({"kegiatan_id": k["_id"]})
    skip = set(await attended_other_sessions(k))
    return compute_counts(peserta, absens, guests, skip, k)


async def mark_missing_alpha(k: dict, marked_at: Optional[str] = None) -> None:
    """Tandai Alpha untuk peserta wajib yang belum diabsen saat kegiatan ditutup.

    Satu query batch (bulk_write) agar tidak menulis satu per satu.
    """
    participants = await peserta_for_kegiatan(k)
    existing = await db.absensis.find({"kegiatan_id": k["_id"]}).to_list(10000)
    existing_by_user = {row["user_id"]: row for row in existing}
    timestamp = marked_at or now_wita().isoformat()
    alpha_fields = {
        "kegiatan_id": k["_id"],
        "status": "alpha",
        "arrival_time": None,
        "marked_by": "Sistem (otomatis)",
        "updated_at": timestamp,
    }

    ops = []
    pengajar = pengajar_dikecualikan(k, participants)
    for participant in participants:
        user_id = str(participant["_id"])
        if not session_requires_participant(k, user_id):
            continue
        if user_id in pengajar:
            continue  # dikecualikan: tidak menjadi Alpha
        existing_row = existing_by_user.get(user_id)
        if existing_row and existing_row.get("status") in ABSEN_STATUS:
            continue
        ops.append(UpdateOne(
            {"kegiatan_id": k["_id"], "user_id": user_id},
            {"$set": {**alpha_fields, "user_id": user_id}},
            upsert=True,
        ))
    if ops:
        await db.absensis.bulk_write(ops, ordered=False)


async def kirim_notif_alpha(k: dict) -> None:
    """Kirim notifikasi Alpha SEKALI setelah kegiatan terakhir di kelompoknya selesai.

    Hanya untuk peserta yang benar-benar Alpha menurut fungsi hitung bersama:
    yang sudah hadir di sesi sebelumnya, pengajar yang dikecualikan, dan yang
    berizin/sakit tidak menerimanya.
    """
    try:
        gid = k.get("session_group_id")
        if gid:
            docs = await db.kegiatans.find({"session_group_id": gid}).to_list(20)
        else:
            docs = [k]
        # Tunggu sampai SEMUA kegiatan di kelompok itu ditutup.
        if any((d.get("status") or "open") == "open" for d in docs):
            return
        docs = sorted(docs, key=_kegiatan_urutan)
        ids = [d["_id"] for d in docs]
        all_users = await db.users.find(PESERTA_QUERY).to_list(10000)
        absens = await db.absensis.find({"kegiatan_id": {"$in": ids}}).to_list(50000)
        status_by: dict = {}
        for a in absens:
            status_by.setdefault(a["user_id"], set()).add(a.get("status"))
        # Peserta yang dihitung di kelompok ini (bukan pengajar yang dikecualikan
        # di SEMUA sesi) dan tidak punya status hadir/izin/sakit sama sekali.
        dihitung: dict = {}
        for d in docs:
            peserta = filter_peserta_for_kegiatan(d, all_users)
            for p in peserta:
                pid = str(p["_id"])
                if pid in pengajar_dikecualikan(d, peserta):
                    continue
                dihitung.setdefault(pid, d)
        for pid, d in dihitung.items():
            st = status_by.get(pid) or set()
            if st & {"hadir", "izin", "sakit"}:
                continue
            await simpan_notif_kehadiran(pid, "alpha", d)
    except Exception:
        logger.exception("Gagal mengirim notifikasi alpha")


async def auto_close_kegiatan():
    """Tutup otomatis kegiatan (per-kegiatan) saat jam selesai WITA sudah lewat."""
    now = now_wita()
    async for k in db.kegiatans.find({"status": "open"}):
        # Kegiatan "absen sebelumnya" (susulan) sengaja dibiarkan terbuka
        # sampai pengurus menutupnya manual.
        if k.get("susulan"):
            continue
        end = kegiatan_end_dt(k.get("date"), k.get("end_time"))
        if end and now >= end:
            result = await db.kegiatans.update_one(
                {"_id": k["_id"], "status": "open"},
                {"$set": {"status": "closed", "closed_at": now.isoformat(), "auto_closed": True}})
            if result.modified_count:
                await mark_missing_alpha(k, now.isoformat())
                await revoke_delegations_for_kegiatan(k["_id"], "Kegiatan ditutup otomatis")
                await kirim_notif_alpha(k)


async def auto_close_loop():
    """Loop scheduler untuk mode server persisten (sandbox/VPS). Tidak dipakai di serverless."""
    while True:
        try:
            await auto_close_kegiatan()
        except Exception as exc:  # pragma: no cover
            logger.warning("auto_close_loop error: %s", exc)
        await asyncio.sleep(60)


# Throttle auto-close untuk mode serverless (tanpa background worker):
# dijalankan maksimal 1x per AUTO_CLOSE_INTERVAL detik, dikoordinasi lewat MongoDB
# sehingga aman walau ada banyak instance lambda paralel.
AUTO_CLOSE_INTERVAL = 60
_last_auto_close_local = 0.0


async def maybe_auto_close():
    """Jalankan auto-close secara 'lazy' saat ada request masuk (serverless-safe)."""
    global _last_auto_close_local
    nowts = time.time()
    if nowts - _last_auto_close_local < AUTO_CLOSE_INTERVAL:
        return
    _last_auto_close_local = nowts
    try:
        claimed = await db.app_settings.find_one_and_update(
            {"_id": "__auto_close__", "next_at": {"$lte": nowts}},
            {"$set": {"next_at": nowts + AUTO_CLOSE_INTERVAL}},
        )
        if claimed is None:
            # Dokumen belum ada? buat sekaligus klaim slot pertama.
            existing = await db.app_settings.find_one({"_id": "__auto_close__"})
            if existing is None:
                await db.app_settings.update_one(
                    {"_id": "__auto_close__"},
                    {"$setOnInsert": {"next_at": nowts + AUTO_CLOSE_INTERVAL}},
                    upsert=True)
            else:
                return  # instance lain sudah mengklaim slot ini
        await auto_close_kegiatan()
    except Exception as exc:  # pragma: no cover
        logger.warning("maybe_auto_close error: %s", exc)


# ------------------------- Kegiatan CRUD -------------------------
@api_router.post("/admin/kegiatan")
async def create_kegiatan(body: KegiatanInput, admin: dict = Depends(require_staff)):
    if body.type not in KEGIATAN_TYPES:
        raise HTTPException(status_code=400, detail="Jenis kegiatan tidak valid")
    try:
        base_date = datetime.strptime(body.date, "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=400, detail="Format tanggal harus YYYY-MM-DD")
    if not valid_kegiatan_schedule(body.date, body.start_time, body.end_time):
        raise HTTPException(status_code=400, detail="Jam selesai harus setelah jam mulai pada hari yang sama.")

    audience = (body.audience or "reguler").strip()
    if audience not in KEGIATAN_AUDIENCES:
        raise HTTPException(status_code=400, detail="Tipe peserta kegiatan tidak valid")
    gender_filter = (body.gender_filter or "semua").strip()
    if gender_filter not in KEGIATAN_GENDER_FILTERS:
        raise HTTPException(status_code=400, detail="Filter jenis kelamin tidak valid")
    marital_filter = (body.marital_filter or "semua").strip()
    if marital_filter not in KEGIATAN_MARITAL_FILTERS:
        raise HTTPException(status_code=400, detail="Filter status pernikahan tidak valid")
    age_filter = normalize_age_filter(body.age_filter)
    participant_ids = []
    for pid in (body.participant_ids or []):
        pid = str(pid).strip()
        if pid and pid not in participant_ids:
            participant_ids.append(pid)

    # FASE 9 — beberapa waktu/sesi dalam 1 hari (mis. pengajian pagi / sore / malam).
    # Setiap sesi menjadi KEGIATAN TERSENDIRI yang saling terhubung lewat
    # `session_group_id`, sehingga absensi, rekap, laporan, kode akses & barcode
    # otomatis TERPISAH per sesi (peserta yang hadir pagi tidak ikut terhitung
    # hadir di sesi sore/malam).
    sessions = []
    for s in (body.sessions or []):
        label = (s.label or "").strip()
        if not label:
            raise HTTPException(status_code=400, detail="Nama waktu/sesi kegiatan wajib diisi")
        if not valid_kegiatan_schedule(body.date, s.start_time, s.end_time):
            raise HTTPException(
                status_code=400,
                detail=f"Jam selesai sesi {label} harus setelah jam mulai pada hari yang sama.")
        session_participant_ids = list(dict.fromkeys(
            str(pid).strip() for pid in (s.participant_ids or []) if str(pid).strip()))
        if s.participant_ids is not None and not session_participant_ids:
            raise HTTPException(status_code=400, detail=f"Pilih minimal satu peserta untuk sesi {label}")
        sessions.append({"label": label, "start_time": s.start_time, "end_time": s.end_time,
                         "teacher": (s.teacher or "").strip() or None,
                         "material": (s.material or "").strip() or None,
                         "location": (s.location or "").strip() or None,
                         "required": bool(s.required),
                         "participant_ids": session_participant_ids if s.participant_ids is not None else None})
    if len(sessions) > 6:
        raise HTTPException(status_code=400, detail="Maksimal 6 waktu/sesi dalam 1 hari")
    multi = len(sessions) > 1
    if not sessions:
        sessions = [{"label": None, "start_time": body.start_time, "end_time": body.end_time,
                     "teacher": None, "material": None, "location": None, "required": True}]

    if body.recurring_months is not None and body.recurring_months not in (1, 2, 3, 6, 12):
        raise HTTPException(status_code=400, detail="Durasi jadwal rutin tidak valid")
    monthly_recurring = body.recurring_months is not None and body.recurring_months > 1
    legacy_weekly = body.recurring and body.recurring_months is None
    occurrences = body.recurring_months or (4 if legacy_weekly else 1)
    is_recurring = monthly_recurring or legacy_weekly
    group_id = str(uuid.uuid4()) if is_recurring else None
    now_iso = datetime.now(timezone.utc).isoformat()
    base_name = body.name.strip()
    maps_query = (body.maps_query or "").strip() or None

    selected_session_ids = {
        pid for session in sessions for pid in (session.get("participant_ids") or [])
    }
    if not multi:
        selected_session_ids.update(
            str(pid).strip() for pid in (body.attendance_participant_ids or []) if str(pid).strip())
    if selected_session_ids:
        filter_input = {
            "audience": audience, "gender_filter": gender_filter,
            "marital_filter": marital_filter, "age_filter": age_filter,
            "participant_ids": participant_ids,
        }
        eligible = await db.users.find(peserta_query_for(filter_input)).to_list(10000)
        eligible_ids = {str(u["_id"]) for u in eligible if match_gender_filter(filter_input, u)}
        if not selected_session_ids.issubset(eligible_ids):
            raise HTTPException(
                status_code=400,
                detail="Peserta sesi harus termasuk dalam filter peserta kegiatan.")

    docs = []
    for i in range(occurrences):
        if monthly_recurring:
            month_index = base_date.month - 1 + i
            year = base_date.year + month_index // 12
            month = month_index % 12 + 1
            month_end = (datetime(year, month, 1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            d = base_date.replace(year=year, month=month, day=min(base_date.day, month_end.day))
        else:
            d = base_date + timedelta(weeks=i)
        session_group_id = str(uuid.uuid4()) if multi else None
        for idx, s in enumerate(sessions):
            docs.append({
                "_id": str(uuid.uuid4()),
                "name": f"{base_name} ({s['label']})" if multi else base_name,
                "base_name": base_name,
                "session_label": s["label"] if multi else None,
                "session_group_id": session_group_id,
                "session_index": idx if multi else None,
                "session_total": len(sessions) if multi else 1,
                "session_required": bool(s.get("required", True)),
                "type": body.type,
                "date": d.strftime("%Y-%m-%d"),
                "start_time": s["start_time"],
                "end_time": s["end_time"],
                "teacher": (body.teacher or "").strip() or None,
                "material": (body.material or "").strip() or None,
                "location": s.get("location") or (body.location or "").strip() or None,
                "maps_query": maps_query,
                "recurring": is_recurring,
                "recurring_group_id": group_id,
                "audience": audience,
                "gender_filter": gender_filter,
                "marital_filter": marital_filter,
                "age_filter": age_filter,
                "participant_ids": participant_ids,
                "session_participant_ids": (
                    s.get("participant_ids") if multi
                    else list(dict.fromkeys(
                        str(pid).strip() for pid in (body.attendance_participant_ids or [])
                        if str(pid).strip()))
                    or None
                ),
                "status": "open",
                "closed_at": None,
                "auto_closed": False,
                "susulan": bool(body.susulan),
                "pengajar_tidak_wajib": bool(body.pengajar_tidak_wajib),
                "pengajar_dikecualikan_ids": list(dict.fromkeys(
                    str(pid).strip() for pid in (body.pengajar_dikecualikan_ids or [])
                    if str(pid).strip())),
                "share_token": None,
                "share_expires_at": None,
                # Fase 7: setiap kegiatan baru langsung punya kode akses absensi 6 digit
                # (berlaku sampai kegiatan ditutup/selesai) + token halaman absensi.
                "akses_token": secrets.token_urlsafe(9),
                "access_code": gen_access_code(),
                "access_code_at": now_iso,
                "absen_token": None,
                "absen_expires_at": None,
                "created_at": now_iso,
                "created_by": str(admin["_id"]),
            })
    await db.kegiatans.insert_many(docs)
    extra = []
    if multi:
        extra.append(f"{len(sessions)} waktu/sesi: " + ", ".join(s["label"] for s in sessions))
    if body.susulan:
        extra.append("mode isi susulan")
    if monthly_recurring:
        extra.append(f"rutin bulanan selama {occurrences} bulan")
    elif legacy_weekly:
        extra.append(f"berulang {occurrences}x")
    await log_activity(admin, "buat_kegiatan",
                       f"Membuat kegiatan '{base_name}'" + (f" ({'; '.join(extra)})" if extra else ""))
    return [serialize_kegiatan(d, await kegiatan_counts(d)) for d in docs]


@api_router.get("/admin/kegiatan")
async def list_kegiatan(admin: dict = Depends(require_staff),
                        month: str = "", date_from: str = "", date_to: str = ""):
    query = {}
    if month.strip():
        query["date"] = {"$regex": f"^{re.escape(month.strip())}"}
    elif date_from.strip() or date_to.strip():
        rng = {}
        if date_from.strip():
            rng["$gte"] = date_from.strip()
        if date_to.strip():
            rng["$lte"] = date_to.strip()
        query["date"] = rng
    kegiatans = await db.kegiatans.find(query).sort([("date", -1), ("start_time", -1)]).to_list(1000)
    if not kegiatans:
        return []

    # FASE 8 — optimasi: 3 query saja (bukan 3 query per kegiatan) agar halaman
    # kegiatan tetap ringan walau dijalankan di serverless (Vercel).
    ids = [k["_id"] for k in kegiatans]
    all_users = await db.users.find(PESERTA_QUERY).to_list(10000)
    absens = await db.absensis.find({"kegiatan_id": {"$in": ids}}).to_list(50000)
    guests = await db.guest_absens.find({"kegiatan_id": {"$in": ids}}).to_list(10000)
    abs_by_keg: dict = {}
    for a in absens:
        abs_by_keg.setdefault(a["kegiatan_id"], []).append(a)
    guest_by_keg: dict = {}
    for g in guests:
        guest_by_keg[g["kegiatan_id"]] = guest_by_keg.get(g["kegiatan_id"], 0) + 1

    out = []
    for k in kegiatans:
        peserta = filter_peserta_for_kegiatan(k, all_users)
        counts = compute_counts(
            peserta, abs_by_keg.get(k["_id"], []), guest_by_keg.get(k["_id"], 0), kegiatan=k)
        out.append(serialize_kegiatan(k, counts))
    return out


@api_router.get("/admin/kegiatan/{kegiatan_id}")
async def get_kegiatan(kegiatan_id: str, admin: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    total = await count_peserta_total()
    return serialize_kegiatan(k, await kegiatan_counts(k))


@api_router.patch("/admin/kegiatan/{kegiatan_id}")
async def update_kegiatan(kegiatan_id: str, body: KegiatanUpdate, admin: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    updates = {}
    for field in ["name", "type", "date", "start_time", "end_time", "teacher",
                  "material", "location", "maps_query", "audience", "gender_filter",
                  "marital_filter", "session_label"]:
        val = getattr(body, field)
        if val is not None:
            if field == "type" and val not in KEGIATAN_TYPES:
                raise HTTPException(status_code=400, detail="Jenis kegiatan tidak valid")
            if field == "audience" and val not in KEGIATAN_AUDIENCES:
                raise HTTPException(status_code=400, detail="Tipe peserta kegiatan tidak valid")
            if field == "gender_filter" and val not in KEGIATAN_GENDER_FILTERS:
                raise HTTPException(status_code=400, detail="Filter jenis kelamin tidak valid")
            if field == "marital_filter" and val not in KEGIATAN_MARITAL_FILTERS:
                raise HTTPException(status_code=400, detail="Filter status pernikahan tidak valid")
            updates[field] = val.strip() if isinstance(val, str) else val
    if body.age_filter is not None:
        updates["age_filter"] = normalize_age_filter(body.age_filter)
    if body.pengajar_tidak_wajib is not None:
        updates["pengajar_tidak_wajib"] = bool(body.pengajar_tidak_wajib)
    if body.pengajar_dikecualikan_ids is not None:
        updates["pengajar_dikecualikan_ids"] = list(dict.fromkeys(
            str(pid).strip() for pid in body.pengajar_dikecualikan_ids
            if str(pid).strip()))
    if body.participant_ids is not None:
        seen = []
        for pid in body.participant_ids:
            pid = str(pid).strip()
            if pid and pid not in seen:
                seen.append(pid)
        updates["participant_ids"] = seen
    if body.attendance_participant_ids is not None:
        attendance_ids = list(dict.fromkeys(
            str(pid).strip() for pid in body.attendance_participant_ids if str(pid).strip()))
        if attendance_ids:
            activity_filter = {
                **k, "participant_ids": updates.get("participant_ids", k.get("participant_ids", [])),
                "audience": updates.get("audience", k.get("audience", "reguler")),
                "gender_filter": updates.get("gender_filter", k.get("gender_filter", "semua")),
                "marital_filter": updates.get("marital_filter", k.get("marital_filter", "semua")),
                "age_filter": updates.get("age_filter", k.get("age_filter", [])),
            }
            eligible = await db.users.find(peserta_query_for(activity_filter)).to_list(10000)
            eligible_ids = {
                str(user["_id"]) for user in eligible
                if match_gender_filter(activity_filter, user)
            }
            if not set(attendance_ids).issubset(eligible_ids):
                raise HTTPException(status_code=400, detail="Peserta wajib absen harus termasuk dalam filter kegiatan.")
        updates["session_participant_ids"] = attendance_ids or None
    schedule_date = updates.get("date", k.get("date"))
    schedule_start = updates.get("start_time", k.get("start_time"))
    schedule_end = updates.get("end_time", k.get("end_time"))
    if not valid_kegiatan_schedule(schedule_date, schedule_start, schedule_end):
        raise HTTPException(status_code=400, detail="Jadwal tidak valid. Jam selesai harus setelah jam mulai.")
    if "name" in updates and not k.get("session_label"):
        updates["base_name"] = updates["name"]
    if updates:
        await db.kegiatans.update_one({"_id": kegiatan_id}, {"$set": updates})
        await log_activity(admin, "ubah_kegiatan", f"Mengubah kegiatan '{k.get('name')}'")
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    return serialize_kegiatan(k, await kegiatan_counts(kegiatan_id))


@api_router.delete("/admin/kegiatan/{kegiatan_id}")
async def delete_kegiatan(kegiatan_id: str, admin: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    await db.kegiatans.delete_one({"_id": kegiatan_id})
    await db.absensis.delete_many({"kegiatan_id": kegiatan_id})
    await db.guest_absens.delete_many({"kegiatan_id": kegiatan_id})
    await db.follow_ups.delete_many({"kegiatan_id": kegiatan_id})
    await log_activity(admin, "hapus_kegiatan", f"Menghapus kegiatan '{k.get('name')}'")
    return {"message": "Kegiatan dihapus"}


@api_router.post("/admin/kegiatan/{kegiatan_id}/close")
async def close_kegiatan(kegiatan_id: str, admin: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    await db.kegiatans.update_one({"_id": kegiatan_id}, {"$set": {
        "status": "closed", "closed_at": now_wita().isoformat(), "auto_closed": False}})
    await mark_missing_alpha(k)
    await revoke_delegations_for_kegiatan(kegiatan_id, "Kegiatan diselesaikan")
    await kirim_notif_alpha(k)
    await log_activity(admin, "selesaikan_kegiatan", f"Menyelesaikan kegiatan '{k.get('name')}'")
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    return serialize_kegiatan(k, await kegiatan_counts(kegiatan_id))


@api_router.post("/admin/kegiatan/{kegiatan_id}/hadir-semua")
async def mark_all_present(kegiatan_id: str, admin: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")

    peserta = await peserta_for_kegiatan(k)
    eligible_ids = [
        str(p["_id"]) for p in peserta
        if session_requires_participant(k, str(p["_id"]))
    ]
    other = await attended_other_sessions(k)
    eligible_ids = [uid for uid in eligible_ids if uid not in other]
    existing = await db.absensis.find({
        "kegiatan_id": kegiatan_id, "user_id": {"$in": eligible_ids},
    }).to_list(5000) if eligible_ids else []
    already_present = {a["user_id"] for a in existing if a.get("status") == "hadir"}
    to_mark = [uid for uid in eligible_ids if uid not in already_present]
    now = now_wita().isoformat()
    if to_mark:
        await db.absensis.bulk_write([
            UpdateOne(
                {"kegiatan_id": kegiatan_id, "user_id": uid},
                {"$set": {
                    "kegiatan_id": kegiatan_id, "user_id": uid, "status": "hadir",
                    "arrival_time": now, "marked_by": admin.get("name"),
                    "marked_by_id": str(admin["_id"]), "updated_at": now,
                }, "$unset": {"reason": "", "note": ""}},
                upsert=True,
            )
            for uid in to_mark
        ], ordered=False)
        for uid in to_mark:
            await notif_kehadiran_dari_status(uid, "hadir", k)
        _rekap_cache_buang(kegiatan_id)
    return {
        "applied": len(to_mark),
        "skipped": len(peserta) - len(to_mark),
        "message": f"{len(to_mark)} peserta berhasil dicatat hadir.",
    }


@api_router.post("/admin/kegiatan/{kegiatan_id}/reopen")
async def reopen_kegiatan(kegiatan_id: str, admin: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    await db.kegiatans.update_one({"_id": kegiatan_id}, {"$set": {
        "status": "open", "closed_at": None, "auto_closed": False}})
    await log_activity(admin, "buka_kegiatan", f"Membuka kembali kegiatan '{k.get('name')}' untuk absen susulan")
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    return serialize_kegiatan(k, await kegiatan_counts(kegiatan_id))


# ------------------------- Absensi -------------------------
@api_router.post("/admin/kegiatan/{kegiatan_id}/absen")
async def mark_absen(kegiatan_id: str, body: AbsenInput, admin: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    validate_absen_status(k, body.status)
    u = await db.users.find_one({"_id": ObjectId(body.user_id)}) if ObjectId.is_valid(body.user_id) else None
    if not u:
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan")
    assert_gender_eligible(k, u)
    await assert_not_attended_other_session(k, body.user_id, u.get("name") or "Peserta")
    arrival = now_wita().isoformat() if body.status == "hadir" else None
    reason = (body.reason or "").strip() or None
    note = (body.note or "").strip() or None
    await db.absensis.update_one(
        {"kegiatan_id": kegiatan_id, "user_id": body.user_id},
        {"$set": {
            "kegiatan_id": kegiatan_id, "user_id": body.user_id, "status": body.status,
            "arrival_time": arrival, "reason": reason, "note": note,
            "marked_by": admin.get("name"),
            "marked_by_id": str(admin["_id"]), "updated_at": now_wita().isoformat()}},
        upsert=True)
    # Fase 7: notifikasi HANYA untuk status "hadir".
    # Status "izin" & "alpha" tidak memunculkan notifikasi apa pun.
    message = ("Absen berhasil, alhamdulillah jazakumullahu khoiro."
               if body.status == "hadir" else None)
    await notif_kehadiran_dari_status(body.user_id, body.status, k)
    _rekap_cache_buang(kegiatan_id)
    return {"user_id": body.user_id, "status": body.status, "arrival_time": arrival,
            "message": message}


@api_router.post("/admin/kegiatan/{kegiatan_id}/hadir-semua")
async def mark_hadir_semua(kegiatan_id: str, admin: dict = Depends(require_staff)):
    """Tandai HADIR untuk semua peserta wajib yang belum punya status absensi."""
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    participants = await peserta_for_kegiatan(k)
    existing = await db.absensis.find({"kegiatan_id": kegiatan_id}).to_list(10000)
    existing_by_user = {row["user_id"]: row for row in existing}
    other = await attended_other_sessions(k)
    timestamp = now_wita().isoformat()
    applied = 0
    for participant in participants:
        user_id = str(participant["_id"])
        if not session_requires_participant(k, user_id):
            continue
        if user_id in other:
            continue
        row = existing_by_user.get(user_id)
        if row and row.get("status") in ABSEN_STATUS:
            continue
        await db.absensis.update_one(
            {"kegiatan_id": kegiatan_id, "user_id": user_id},
            {"$set": {"kegiatan_id": kegiatan_id, "user_id": user_id,
                      "status": "hadir", "arrival_time": timestamp,
                      "reason": None, "note": None,
                      "marked_by": f"{admin.get('name')} (hadir semua)",
                      "marked_by_id": str(admin["_id"]), "updated_at": timestamp}},
            upsert=True)
        await notif_kehadiran_dari_status(user_id, "hadir", k)
        applied += 1
    _rekap_cache_buang(kegiatan_id)
    await log_activity(admin, "hadir_semua",
                       f"Menandai hadir semua ({applied} peserta) pada '{k.get('name')}'")
    return {"applied": applied,
            "message": f"{applied} peserta ditandai hadir." if applied
                       else "Semua peserta sudah memiliki status absensi."}


@api_router.post("/admin/kegiatan/{kegiatan_id}/tutup-absen")
async def tutup_absen(kegiatan_id: str, admin: dict = Depends(require_staff)):
    """Tutup absen kegiatan sekaligus centang otomatis ALPHA untuk yang belum diabsen."""
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    if k.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Kegiatan sudah ditutup")
    await db.kegiatans.update_one({"_id": kegiatan_id}, {"$set": {
        "status": "closed", "closed_at": now_wita().isoformat(), "auto_closed": False}})
    await mark_missing_alpha(k)
    await revoke_delegations_for_kegiatan(kegiatan_id, "Kegiatan diselesaikan")
    await kirim_notif_alpha(k)
    await log_activity(admin, "tutup_absen",
                       f"Menutup absen & menandai alpha otomatis pada '{k.get('name')}'")
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    counts = await kegiatan_counts(kegiatan_id)
    return {"kegiatan": serialize_kegiatan(k, counts), "counts": counts,
            "message": "Absen ditutup. Peserta yang belum diabsen otomatis tercatat Alpha."}


@api_router.post("/admin/kegiatan/{kegiatan_id}/absen-batch")
async def mark_absen_batch(kegiatan_id: str, body: AbsenBatchInput,
                           admin: dict = Depends(require_staff)):
    """FASE 8 — Sinkronisasi absen yang ditandai saat OFFLINE (antrean dari HP)."""
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    applied, failed = 0, []
    for item in body.items[:500]:
        if item.status not in ABSEN_STATUS or not ObjectId.is_valid(item.user_id):
            failed.append(item.user_id)
            continue
        if item.status == "alpha" and not alpha_allowed(k):
            failed.append(item.user_id)
            continue
        u = await db.users.find_one({"_id": ObjectId(item.user_id)})
        if not u:
            failed.append(item.user_id)
            continue
        if not match_gender_filter(k, u):
            failed.append(item.user_id)
            continue
        arrival = to_wita_iso(item.marked_at) if item.status == "hadir" else None
        await db.absensis.update_one(
            {"kegiatan_id": kegiatan_id, "user_id": item.user_id},
            {"$set": {"kegiatan_id": kegiatan_id, "user_id": item.user_id,
                      "status": item.status, "arrival_time": arrival,
                      "reason": (item.reason or "").strip() or None,
                      "note": (item.note or "").strip() or None,
                      "marked_by": f"{admin.get('name')} (sinkron offline)",
                      "marked_by_id": str(admin["_id"]),
                      "updated_at": now_wita().isoformat()},
             "$unset": {"reason": "", "note": ""}},
            upsert=True)
        await notif_kehadiran_dari_status(item.user_id, item.status, k)
        applied += 1
    _rekap_cache_buang(kegiatan_id)
    return {"applied": applied, "failed": failed,
            "message": f"{applied} absen offline berhasil disinkronkan."}


@api_router.get("/admin/kegiatan/{kegiatan_id}/rekap")
async def rekap_kegiatan(kegiatan_id: str, admin: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    peserta = await peserta_for_kegiatan(k)
    absens = await db.absensis.find({"kegiatan_id": kegiatan_id}).to_list(10000)
    guests = await db.guest_absens.find({"kegiatan_id": kegiatan_id}).sort("created_at", 1).to_list(2000)
    amap = {a["user_id"]: a for a in absens}
    other = await attended_other_sessions(k)
    rows = []
    gender_status = {
        gender_key: {"hadir": 0, "izin": 0, "sakit": 0, "alpha": 0, "belum_diabsen": 0}
        for gender_key in ("L", "P")
    }
    pengajar_excluded = pengajar_dikecualikan(k, peserta)
    skipped = 0
    for p in peserta:
        pid = str(p["_id"])
        a = amap.get(pid)
        status = a.get("status") if a else None
        required = session_requires_participant(k, pid)
        ot = other.get(pid)
        if ot and not required:
            skipped += 1
            rows.append({
                "user_id": pid, "name": p.get("name"), "gender": _derive_gender(p),
                "marital": p.get("marital"),
                "status": status, "account_status": p.get("status", "active"),
                "arrival_time": a.get("arrival_time") if a else ot.get("arrival_time"),
                "marked_by": a.get("marked_by") if a else None,
                "absence_reason": a.get("reason") if a else None,
                "absence_note": a.get("note") if a else None,
                "required_for_session": required,
                "attended_other": True, "attended_other_label": ot.get("label"),
                "pengajar": bool(p.get("pengajar")),
                "tidak_dihitung": pid in pengajar_excluded,
            })
            continue
        if required or status in ABSEN_STATUS:
            g = _derive_gender(p)
            # Pengajar yang dikecualikan tetap dihitung bila punya status.
            if g in gender_status and (pid not in pengajar_excluded
                                       or status in ABSEN_STATUS):
                status_key = status if status in ABSEN_STATUS else "belum_diabsen"
                gender_status[g][status_key] += 1
        rows.append({
            "user_id": pid, "name": p.get("name"), "gender": _derive_gender(p),
            "marital": p.get("marital"),
            "status": status,
            "account_status": p.get("status", "active"),
            "arrival_time": a.get("arrival_time") if a else None,
            "reason": a.get("reason") if a else None,
            "note": a.get("note") if a else None,
            "marked_by": a.get("marked_by") if a else None,
            "sumber": a.get("sumber") if a else None,
            "tinjauan": a.get("tinjauan") if a else None,
            "absence_reason": a.get("reason") if a else None,
            "absence_note": a.get("note") if a else None,
            "required_for_session": required,
            "attended_other": False, "attended_other_label": None,
            "pengajar": bool(p.get("pengajar")),
            "tidak_dihitung": pid in pengajar_excluded,
        })
    counts = compute_counts(peserta, absens, len(guests), set(other), k)
    gender = {
        gender_key: {
            "total": sum(statuses.values()),
            "hadir": statuses["hadir"],
        }
        for gender_key, statuses in gender_status.items()
    }
    return {
        "kegiatan": serialize_kegiatan(k),
        "counts": counts,
        "gender": gender,
        "gender_status": gender_status,
        "rows": rows,
        "guests": [serialize_guest(g) for g in guests],
        "izin_belum_ditinjau": len([r for r in rows
                                    if r.get("status") == "izin"
                                    and r.get("tinjauan") == "belum_ditinjau"]),
        "pengajar_tidak_wajib": bool(k.get("pengajar_tidak_wajib", False)),
        "pengajar_dikecualikan": len(pengajar_excluded),
    }


# ------------------- FASE 10: Rekap kehadiran per sesi -------------------
async def sesi_group_docs(kegiatan_id: str) -> list:
    """Semua kegiatan dalam 1 grup sesi (pagi/sore/malam) dari salah satu id-nya.
    Bila kegiatan tidak bersesi, kembalikan list berisi 1 kegiatan itu saja."""
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    gid = k.get("session_group_id")
    if not gid:
        return [k]
    docs = await db.kegiatans.find({"session_group_id": gid}).to_list(20)
    docs.sort(key=lambda d: (d.get("session_index") or 0, d.get("start_time") or ""))
    return docs


async def build_rekap_gabungan(docs: list, tampilkan_jam: bool = False) -> dict:
    """Rekap gabungan beberapa kegiatan: SATU ORANG DIHITUNG HADIR SEKALI.

    Kegiatan diurutkan menurut jam mulai. Peserta dihitung hadir hanya di kegiatan
    pertama yang ia hadiri; kegiatan berikutnya memakai penyebut peserta yang belum
    hadir sebelumnya.
    """
    docs = sorted(docs, key=lambda d: (d.get("start_time") or "", d.get("session_index") or 0))
    ids = [d["_id"] for d in docs]
    all_users = await db.users.find(PESERTA_QUERY).sort("name", 1).to_list(10000)
    absens = await db.absensis.find({"kegiatan_id": {"$in": ids}}).to_list(50000)
    guests = await db.guest_absens.find({"kegiatan_id": {"$in": ids}}).to_list(10000)
    abs_by_keg: dict = {}
    for a in absens:
        abs_by_keg.setdefault(a["kegiatan_id"], {})[a["user_id"]] = a
    guest_by_keg: dict = {}
    for g in guests:
        guest_by_keg[g["kegiatan_id"]] = guest_by_keg.get(g["kegiatan_id"], 0) + 1

    hadir_by_keg = {kid: {pid for pid, a in m.items() if a.get("status") == "hadir"}
                    for kid, m in abs_by_keg.items()}
    sessions_out = []
    peserta_union: dict = {}
    eligible_by_keg: dict = {}
    sudah_hadir: set = set()
    hadir_di: dict = {}
    dikecualikan_by_keg: dict = {}
    pengajar_by_keg: dict = {}
    for d in docs:
        peserta = filter_peserta_for_kegiatan(d, all_users)
        eligible_by_keg[d["_id"]] = {str(p["_id"]) for p in peserta}
        for p in peserta:
            peserta_union[str(p["_id"])] = p
        # Peserta yang sudah hadir di kegiatan lebih awal tidak dihitung di sini.
        dikecualikan_by_keg[d["_id"]] = set(sudah_hadir)
        # Pengajar yang dikecualikan kegiatan ini juga tidak dihitung sebagai wajib.
        pengajar_keg = pengajar_dikecualikan(d, peserta)
        pengajar_by_keg[d["_id"]] = pengajar_keg
        penyebut = {str(p["_id"]) for p in peserta
                    if str(p["_id"]) not in sudah_hadir
                    and (str(p["_id"]) not in pengajar_keg
                         or str(p["_id"]) in abs_by_keg.get(d["_id"], {}))}
        counts = compute_counts(
            [p for p in peserta if str(p["_id"]) in penyebut],
            list(abs_by_keg.get(d["_id"], {}).values()),
            guest_by_keg.get(d["_id"], 0), set(), d)
        for pid in hadir_by_keg.get(d["_id"], set()):
            if pid in penyebut:
                sudah_hadir.add(pid)
                hadir_di.setdefault(pid, d.get("session_label") or d.get("name"))
        sessions_out.append({
            "id": d["_id"],
            "label": d.get("session_label") or d.get("name"),
            "start_time": d.get("start_time"),
            "end_time": d.get("end_time"),
            "teacher": d.get("teacher"),
            "material": d.get("material"),
            "location": d.get("location"),
            "status": d.get("status", "open"),
            "required": bool(d.get("session_required", True)),
            "counts": counts,
            "sebelumnya_hadir": len(eligible_by_keg[d["_id"]]) - len(penyebut),
            "dikecualikan": len(dikecualikan_by_keg[d["_id"]]),
            "pengajar_dikecualikan": len(pengajar_keg),
        })

    rows = []
    for pid, p in sorted(peserta_union.items(), key=lambda x: (x[1].get("name") or "").lower()):
        per = []
        for d in docs:
            if pid not in eligible_by_keg[d["_id"]] or pid in dikecualikan_by_keg[d["_id"]]:
                per.append(None)
                continue
            a = abs_by_keg.get(d["_id"], {}).get(pid)
            # Pengajar yang dikecualikan hanya muncul bila punya status.
            if pid in pengajar_by_keg.get(d["_id"], set()) and not a:
                per.append(None)
                continue
            st = a.get("status") if a else None
            cell = {"status": st or "belum_diabsen",
                    "reason": a.get("reason") if a else None,
                    "note": a.get("note") if a else None}
            if tampilkan_jam:
                cell["arrival_time"] = a.get("arrival_time") if a else None
            per.append(cell)
        if not any(c is not None for c in per):
            continue  # tidak dihitung di sesi mana pun (mis. pengajar dikecualikan)
        statuses = [c["status"] for c in per if c]
        if pid in sudah_hadir:
            hari = "hadir"
        elif "izin" in statuses:
            hari = "izin"
        elif "sakit" in statuses:
            hari = "sakit"
        elif "alpha" in statuses:
            hari = "alpha"
        else:
            hari = "belum_diabsen"
        rows.append({
            "user_id": pid, "name": p.get("name"), "gender": _derive_gender(p),
            "account_status": p.get("status", "active"),
            "status_hari": hari,
            "hadir_di": hadir_di.get(pid),
            "sessions": per,
        })

    total_guests = sum(guest_by_keg.values())
    first = docs[0]
    unik = len(rows)
    hadir_hari = sum(1 for r in rows if r["status_hari"] == "hadir")
    return {
        "date": first.get("date"),
        "base_name": first.get("base_name") or first.get("name"),
        "session_group_id": first.get("session_group_id"),
        "type": first.get("type", "rutin"),
        "location": first.get("location"),
        "teacher": first.get("teacher"),
        "filter_labels": kegiatan_filter_labels(first),
        "sessions": sessions_out,
        "total": {
            "hadir": hadir_hari,
            "total": unik,
            "izin": sum(1 for r in rows if r["status_hari"] == "izin"),
            "sakit": sum(1 for r in rows if r["status_hari"] == "sakit"),
            "alpha": sum(1 for r in rows if r["status_hari"] == "alpha"),
            "belum_diabsen": sum(1 for r in rows if r["status_hari"] == "belum_diabsen"),
            "ratio": round(hadir_hari / unik * 100) if unik else 0,
        },
        "tamu": total_guests,
        "tampilkan_jam": tampilkan_jam,
        "rows": rows,
    }


@api_router.get("/admin/kegiatan/{kegiatan_id}/rekap-gabungan")
async def rekap_gabungan_sesi(kegiatan_id: str, admin: dict = Depends(require_staff)):
    """`kegiatan_id` boleh salah satu sesi dari grup tersebut."""
    return await build_rekap_gabungan(await sesi_group_docs(kegiatan_id))


async def ensure_share_gabungan(kegiatan_id: str, request: Optional[Request] = None) -> dict:
    """FASE 12 — tautan publik REKAP GABUNGAN 1 hari (semua sesi), berlaku 7 hari."""
    docs = await sesi_group_docs(kegiatan_id)
    ids = [d["_id"] for d in docs]
    token = next((d.get("group_share_token") for d in docs if d.get("group_share_token")), None)
    exp = next((d.get("group_share_expires_at") for d in docs if d.get("group_share_token")), None)
    if not token or not exp or is_expired_iso(exp):
        token = secrets.token_urlsafe(10)
        exp = (datetime.now(timezone.utc) + timedelta(days=SHARE_EXPIRE_DAYS)).isoformat()
        await db.kegiatans.update_many(
            {"_id": {"$in": ids}},
            {"$set": {"group_share_token": token, "group_share_expires_at": exp}})
    return {"token": token, "expires_at": exp, "docs": docs,
            "link": f"{resolve_base_url(request)}/rekap-gabungan/{token}"}


class GabunganInput(BaseModel):
    kegiatan_ids: List[str] = []


class ShareSettingInput(BaseModel):
    tampilkan_jam: Optional[bool] = None
    aktif: Optional[bool] = None


@api_router.post("/admin/kegiatan/share-gabungan")
async def share_gabungan_pilih(body: GabunganInput, request: Request,
                               admin: dict = Depends(require_staff)):
    """Buat tautan gabungan HANYA untuk kegiatan yang dipilih (hari yang sama)."""
    ids = [i for i in dict.fromkeys(body.kegiatan_ids or []) if i]
    if len(ids) < 2:
        raise HTTPException(status_code=400, detail="Pilih minimal dua kegiatan.")
    docs = await db.kegiatans.find({"_id": {"$in": ids}}).to_list(50)
    if len(docs) != len(ids):
        raise HTTPException(status_code=400, detail="Ada kegiatan yang tidak ditemukan.")
    if len({d.get("date") for d in docs}) != 1:
        raise HTTPException(status_code=400, detail="Kegiatan harus pada hari yang sama.")
    token = secrets.token_urlsafe(10)
    exp = (datetime.now(timezone.utc) + timedelta(days=SHARE_EXPIRE_DAYS)).isoformat()
    await db.kegiatans.update_many(
        {"_id": {"$in": ids}},
        {"$set": {"group_share_token": token, "group_share_expires_at": exp,
                  "group_share_aktif": True, "group_share_tampilkan_jam": False}})
    first = sorted(docs, key=lambda d: (d.get("start_time") or ""))[0]
    judul = f"rekap gabungan {first.get('base_name') or first.get('name')} ({first.get('date')})"
    link = f"{resolve_base_url(request)}/rekap-gabungan/{token}"
    await log_activity(admin, "bagikan_rekap_gabungan", f"Membuat tautan gabungan {judul}")
    return {"token": token, "link": link, "expires_at": exp,
            "wa_text": wa_template_laporan(judul, link)}


@api_router.get("/admin/kegiatan/share-gabungan/{token}")
async def share_gabungan_info(token: str, request: Request,
                              admin: dict = Depends(require_staff)):
    docs = await db.kegiatans.find({"group_share_token": token}).to_list(20)
    if not docs:
        raise HTTPException(status_code=404, detail="Tautan tidak ditemukan")
    first = docs[0]
    return {"token": token, "link": f"{resolve_base_url(request)}/rekap-gabungan/{token}",
            "expires_at": first.get("group_share_expires_at"),
            "tampilkan_jam": bool(first.get("group_share_tampilkan_jam")),
            "aktif": first.get("group_share_aktif") is not False,
            "nama": first.get("base_name") or first.get("name"),
            "tanggal": first.get("date"),
            "kegiatan": [d.get("session_label") or d.get("name") for d in
                         sorted(docs, key=lambda d: (d.get("start_time") or ""))]}


@api_router.patch("/admin/kegiatan/share-gabungan/{token}")
async def share_gabungan_update(token: str, body: ShareSettingInput,
                                admin: dict = Depends(require_staff)):
    docs = await db.kegiatans.find({"group_share_token": token}).to_list(20)
    if not docs:
        raise HTTPException(status_code=404, detail="Tautan tidak ditemukan")
    upd = {}
    if body.tampilkan_jam is not None:
        upd["group_share_tampilkan_jam"] = bool(body.tampilkan_jam)
    if body.aktif is not None:
        upd["group_share_aktif"] = bool(body.aktif)
    if upd:
        await db.kegiatans.update_many({"group_share_token": token}, {"$set": upd})
        await log_activity(admin, "atur_tautan_gabungan", "Mengatur tautan gabungan")
    return {"ok": True, **upd}


@api_router.delete("/admin/kegiatan/share-gabungan/{token}")
async def share_gabungan_delete(token: str, admin: dict = Depends(require_staff)):
    res = await db.kegiatans.update_many(
        {"group_share_token": token},
        {"$set": {"group_share_token": None, "group_share_expires_at": None,
                  "group_share_aktif": True, "group_share_tampilkan_jam": False}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Tautan tidak ditemukan")
    await log_activity(admin, "hapus_tautan_gabungan", "Menghapus tautan gabungan")
    return {"ok": True}


@api_router.post("/admin/kegiatan/{kegiatan_id}/share-gabungan")
async def share_kegiatan_gabungan(kegiatan_id: str, request: Request,
                                  admin: dict = Depends(require_staff)):
    info = await ensure_share_gabungan(kegiatan_id, request)
    first = info["docs"][0]
    judul = f"rekap gabungan {first.get('base_name') or first.get('name')} ({first.get('date')})"
    return {"token": info["token"], "link": info["link"], "expires_at": info["expires_at"],
            "wa_text": wa_template_laporan(judul, info["link"])}


@api_router.get("/rekap-gabungan/{token}")
async def public_rekap_gabungan(token: str):
    docs = await db.kegiatans.find({"group_share_token": token}).to_list(20)
    if not docs:
        raise HTTPException(status_code=404, detail="Tautan rekap gabungan tidak ditemukan")
    if is_expired_iso(docs[0].get("group_share_expires_at")):
        raise HTTPException(status_code=410, detail="Tautan rekap gabungan sudah kadaluarsa")
    if docs[0].get("group_share_aktif") is False:
        raise HTTPException(status_code=410, detail="Tautan rekap gabungan sudah tidak berlaku")
    docs.sort(key=lambda d: (d.get("start_time") or "", d.get("session_index") or 0))
    tampilkan_jam = bool(docs[0].get("group_share_tampilkan_jam"))
    return await build_rekap_gabungan(docs, tampilkan_jam=tampilkan_jam)


class SalinJadwalInput(BaseModel):
    dates: List[str] = []           # daftar tanggal tujuan YYYY-MM-DD (1..12)
    date: Optional[str] = None      # kompatibilitas: 1 tanggal saja


@api_router.post("/admin/kegiatan/{kegiatan_id}/salin")
async def salin_jadwal_kegiatan(kegiatan_id: str, body: SalinJadwalInput,
                                admin: dict = Depends(require_staff)):
    """FASE 10 — Salin POLA JADWAL (semua sesi pagi/sore/malam beserta jam, pengajar,
    lokasi & penyaringan peserta) ke tanggal lain dalam sekali klik.

    Absensi TIDAK ikut disalin — jadwal baru dimulai kosong dengan kode akses &
    barcode baru. Bila kegiatan bukan bersesi, hanya kegiatan itu yang disalin.
    """
    dates = [d.strip() for d in (body.dates or []) if d and d.strip()]
    if body.date and body.date.strip():
        dates.append(body.date.strip())
    dates = list(dict.fromkeys(dates))
    if not dates:
        raise HTTPException(status_code=400, detail="Pilih minimal 1 tanggal tujuan")
    if len(dates) > 12:
        raise HTTPException(status_code=400, detail="Maksimal 12 tanggal tujuan sekaligus")
    for dt in dates:
        try:
            datetime.strptime(dt, "%Y-%m-%d")
        except Exception:
            raise HTTPException(status_code=400, detail=f"Format tanggal harus YYYY-MM-DD ({dt})")

    docs = await sesi_group_docs(kegiatan_id)
    src = docs[0]
    if src.get("date") in dates:
        raise HTTPException(status_code=400, detail="Tanggal tujuan sama dengan tanggal jadwal asal")

    multi = len(docs) > 1
    now_iso = datetime.now(timezone.utc).isoformat()
    base_name = src.get("base_name") or src.get("name")
    new_docs = []
    for dt in dates:
        session_group_id = str(uuid.uuid4()) if multi else None
        for idx, d in enumerate(docs):
            new_docs.append({
                "_id": str(uuid.uuid4()),
                "name": d.get("name"),
                "base_name": base_name,
                "session_label": d.get("session_label"),
                "session_group_id": session_group_id,
                "session_index": d.get("session_index") if multi else None,
                "session_total": len(docs) if multi else 1,
                "session_required": bool(d.get("session_required", True)),
                "type": d.get("type", "rutin"),
                "date": dt,
                "start_time": d.get("start_time"),
                "end_time": d.get("end_time"),
                "teacher": d.get("teacher"),
                "material": d.get("material"),
                "location": d.get("location"),
                "maps_query": d.get("maps_query"),
                "participant_ids": list(d.get("participant_ids") or []),
                "session_participant_ids": list(d.get("session_participant_ids") or [])
                if d.get("session_participant_ids") is not None else None,
                "recurring": False,
                "recurring_group_id": None,
                "audience": d.get("audience", "reguler"),
                "gender_filter": d.get("gender_filter", "semua"),
                "marital_filter": d.get("marital_filter", "semua"),
                "age_filter": normalize_age_filter(d.get("age_filter")),
                "status": "open",
                "closed_at": None,
                "auto_closed": False,
                "share_token": None,
                "share_expires_at": None,
                "akses_token": secrets.token_urlsafe(9),
                "access_code": gen_access_code(),
                "access_code_at": now_iso,
                "absen_token": None,
                "absen_expires_at": None,
                "copied_from": d["_id"],
                "created_at": now_iso,
                "created_by": str(admin["_id"]),
            })
    await db.kegiatans.insert_many(new_docs)
    await log_activity(
        admin, "salin_kegiatan",
        f"Menyalin jadwal '{base_name}' ({len(docs)} sesi) dari {src.get('date')} ke {', '.join(dates)}")
    return {
        "message": f"Jadwal '{base_name}' disalin ke {len(dates)} tanggal ({len(new_docs)} jadwal baru).",
        "created": len(new_docs),
        "dates": dates,
        "items": [serialize_kegiatan(d, {
            "total": 0, "hadir": 0, "izin": 0, "sakit": 0, "alpha": 0,
            "belum_diabsen": 0, "ratio": 0.0,
        }) for d in new_docs],
    }


def serialize_guest(g: dict) -> dict:
    return {"id": g["_id"], "name": g.get("name"), "status": "hadir",
            "arrival_time": g.get("arrival_time"), "added_by": g.get("added_by"),
            "created_at": g.get("created_at"), "is_guest": True}


async def assert_publik(k: dict) -> None:
    if (k.get("audience") or "reguler") != "publik":
        raise HTTPException(
            status_code=400,
            detail="Tamu hanya bisa ditambahkan pada kegiatan bertipe Terbuka/Publik.")


async def add_guest_doc(k: dict, name: str, added_by: str) -> dict:
    await assert_publik(k)
    clean = (name or "").strip()
    if len(clean) < 2:
        raise HTTPException(status_code=400, detail="Nama tamu minimal 2 huruf.")
    now = now_wita().isoformat()
    doc = {"_id": str(uuid.uuid4()), "kegiatan_id": k["_id"], "name": clean,
           "arrival_time": now, "added_by": added_by, "created_at": now}
    await db.guest_absens.insert_one(doc)
    return serialize_guest(doc)


@api_router.post("/admin/kegiatan/{kegiatan_id}/guest")
async def add_guest_staff(kegiatan_id: str, body: GuestInput,
                          staff: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    guest = await add_guest_doc(k, body.name, staff.get("name") or "Pengurus")
    return {**guest, "message": f"Tamu {guest['name']} tercatat hadir."}


@api_router.delete("/admin/kegiatan/{kegiatan_id}/guest/{guest_id}")
async def delete_guest_staff(kegiatan_id: str, guest_id: str,
                             staff: dict = Depends(require_staff)):
    res = await db.guest_absens.delete_one({"_id": guest_id, "kegiatan_id": kegiatan_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Data tamu tidak ditemukan")
    return {"message": "Data tamu dihapus"}


# ------------------------- FASE 8: Tindak lanjut tidak hadir -------------------------
def serialize_followup(f: Optional[dict]) -> dict:
    if not f:
        return {"status": "belum_dihubungi", "note": None, "by": None, "at": None}
    return {"status": f.get("status", "belum_dihubungi"), "note": f.get("note"),
            "by": f.get("by"), "at": f.get("at")}


@api_router.get("/staff/kegiatan/{kegiatan_id}/tindak-lanjut")
async def tindak_lanjut_list(kegiatan_id: str, staff: dict = Depends(require_staff)):
    """Rekap peserta yang TIDAK HADIR pada kegiatan sebelumnya.

    Dipakai pengurus/admin untuk menghubungi mereka dan menandai apakah akan
    hadir pada kegiatan berikutnya (kegiatan yang dibuka saat ini).
    """
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    prev = await db.kegiatans.find({"date": {"$lt": k.get("date")}}) \
        .sort([("date", -1), ("start_time", -1)]).to_list(1)
    if not prev:
        return {"kegiatan": serialize_kegiatan(k), "previous": None, "rows": [],
                "counts": {"total": 0, "akan_hadir": 0, "tidak_bisa": 0, "belum_dihubungi": 0}}
    pk = prev[0]
    peserta = await peserta_for_kegiatan(k)
    absens = await db.absensis.find({"kegiatan_id": pk["_id"]}).to_list(10000)
    amap = {a["user_id"]: a.get("status") for a in absens}
    fups = await db.follow_ups.find({"kegiatan_id": kegiatan_id}).to_list(5000)
    fmap = {f["user_id"]: f for f in fups}
    kmap = {}
    async for km in db.kelompoks.find():
        kmap[km["_id"]] = km.get("name")

    rows = []
    tally = {"akan_hadir": 0, "tidak_bisa": 0, "belum_dihubungi": 0, "sudah_dihubungi": 0}
    for p in peserta:
        pid = str(p["_id"])
        prev_status = amap.get(pid)
        if prev_status == "hadir":
            continue
        fu = serialize_followup(fmap.get(pid))
        tally[fu["status"]] = tally.get(fu["status"], 0) + 1
        rows.append({
            "user_id": pid,
            "name": p.get("name"),
            "gender": _derive_gender(p),
            "phone": p.get("phone"),
            "whatsapp": p.get("whatsapp") or p.get("phone"),
            "kelompok_name": kmap.get(p.get("kelompok_id")) if p.get("kelompok_id") else None,
            "previous_status": prev_status,
            "followup": fu,
        })
    return {
        "kegiatan": serialize_kegiatan(k),
        "previous": {"id": pk["_id"], "name": pk.get("name"), "date": pk.get("date")},
        "rows": rows,
        "counts": {"total": len(rows), **tally},
    }


@api_router.post("/staff/kegiatan/{kegiatan_id}/tindak-lanjut")
async def tindak_lanjut_set(kegiatan_id: str, body: FollowUpInput,
                            staff: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    if body.status not in FOLLOWUP_STATUSES:
        raise HTTPException(status_code=400, detail="Status tindak lanjut tidak valid")
    if not ObjectId.is_valid(body.user_id):
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan")
    u = await db.users.find_one({"_id": ObjectId(body.user_id)})
    if not u:
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan")
    now = now_wita().isoformat()
    await db.follow_ups.update_one(
        {"kegiatan_id": kegiatan_id, "user_id": body.user_id},
        {"$set": {"kegiatan_id": kegiatan_id, "user_id": body.user_id,
                  "status": body.status, "note": (body.note or "").strip() or None,
                  "by": staff.get("name"), "by_id": str(staff["_id"]), "at": now}},
        upsert=True)
    label = {"akan_hadir": "akan hadir", "tidak_bisa": "tidak bisa hadir",
             "sudah_dihubungi": "sudah dihubungi",
             "belum_dihubungi": "belum dihubungi"}[body.status]
    return {"user_id": body.user_id, "status": body.status,
            "message": f"{u.get('name')} ditandai {label}."}


# ------------------------- QR + Share (public rekap) -------------------------
async def ensure_share(kegiatan_id: str, request: Optional[Request] = None) -> dict:
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    now = datetime.now(timezone.utc)
    token = k.get("share_token")
    exp = k.get("share_expires_at")
    need_new = not token or not exp
    if exp:
        try:
            if datetime.fromisoformat(exp) <= now:
                need_new = True
        except Exception:
            need_new = True
    if need_new:
        token = secrets.token_urlsafe(10)
        exp = (now + timedelta(days=SHARE_EXPIRE_DAYS)).isoformat()
        await db.kegiatans.update_one({"_id": kegiatan_id},
                                      {"$set": {"share_token": token, "share_expires_at": exp}})
    link = f"{resolve_base_url(request)}/rekap/{token}"
    return {"token": token, "link": link, "expires_at": exp}


@api_router.post("/admin/kegiatan/{kegiatan_id}/share")
async def share_kegiatan(kegiatan_id: str, request: Request, admin: dict = Depends(require_staff)):
    info = await ensure_share(kegiatan_id, request)
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    info["wa_text"] = wa_template_laporan(k.get("name") or "kegiatan", info["link"])
    return info


@api_router.get("/admin/kegiatan/{kegiatan_id}/share")
async def share_info(kegiatan_id: str, request: Request, admin: dict = Depends(require_staff)):
    """Info tautan rekap yang sudah ada (tanpa membuat baru)."""
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    token = k.get("share_token")
    exp = k.get("share_expires_at")
    valid = bool(token and exp and not is_expired_iso(exp))
    return {
        "token": token if valid else None,
        "link": f"{resolve_base_url(request)}/rekap/{token}" if valid else None,
        "expires_at": exp,
        "tampilkan_jam": bool(k.get("share_tampilkan_jam")),
        "aktif": k.get("share_aktif") is not False,
        "nama": k.get("name"),
        "tanggal": k.get("date"),
    }


@api_router.patch("/admin/kegiatan/{kegiatan_id}/share")
async def share_update(kegiatan_id: str, body: ShareSettingInput,
                       admin: dict = Depends(require_staff)):
    """Atur tampilkan jam / aktif-nonaktif tautan rekap (tautan tidak berubah)."""
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    upd = {}
    if body.tampilkan_jam is not None:
        upd["share_tampilkan_jam"] = bool(body.tampilkan_jam)
    if body.aktif is not None:
        upd["share_aktif"] = bool(body.aktif)
    if upd:
        await db.kegiatans.update_one({"_id": kegiatan_id}, {"$set": upd})
        await log_activity(admin, "atur_tautan_rekap",
                           f"Mengatur tautan rekap '{k.get('name')}'", kegiatan_id)
    return {"ok": True, **upd}


@api_router.delete("/admin/kegiatan/{kegiatan_id}/share")
async def share_delete(kegiatan_id: str, admin: dict = Depends(require_staff)):
    """Hapus tautan rekap (tautan yang sudah dibagikan tidak bisa dibuka lagi)."""
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    await db.kegiatans.update_one(
        {"_id": kegiatan_id},
        {"$set": {"share_token": None, "share_expires_at": None,
                  "share_aktif": True, "share_tampilkan_jam": False}})
    await log_activity(admin, "hapus_tautan_rekap",
                       f"Menghapus tautan rekap '{k.get('name')}'", kegiatan_id)
    return {"ok": True}


@api_router.get("/admin/kegiatan/{kegiatan_id}/qr")
async def qr_kegiatan(kegiatan_id: str, request: Request, admin: dict = Depends(require_staff)):
    info = await ensure_share(kegiatan_id, request)
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    return {"link": info["link"], "expires_at": info["expires_at"],
            "wa_text": wa_template_laporan(k.get("name") or "kegiatan", info["link"]),
            "image": make_qr_data_url(info["link"])}


# ---------------------------------------------------------------------------
# Cache ringan rekap publik per tautan (30 detik, di memori proses).
# Dibuang saat ada absen/izin baru di kegiatan itu. Pos Scan tidak memakai cache.
# ---------------------------------------------------------------------------
REKAP_CACHE_TTL = 30
_rekap_cache: dict = {}


def _rekap_cache_get(token: str):
    row = _rekap_cache.get(token)
    if not row:
        return None
    if time.time() - row[0] > REKAP_CACHE_TTL:
        _rekap_cache.pop(token, None)
        return None
    return row[1]


def _rekap_cache_set(token: str, data, kegiatan_id: Optional[str] = None) -> None:
    if len(_rekap_cache) > 200:
        _rekap_cache.clear()
    _rekap_cache[token] = (time.time(), data, kegiatan_id)


def _rekap_cache_buang(kegiatan_id: Optional[str]) -> None:
    """Buang cache rekap untuk kegiatan ini (dipanggil setelah absen/izin berubah)."""
    if not kegiatan_id:
        return
    for tok in [t for t, row in _rekap_cache.items() if row[2] == kegiatan_id]:
        _rekap_cache.pop(tok, None)


@api_router.get("/rekap/{token}")
async def public_rekap(token: str):
    # Cache ringan 30 detik (dibuang saat ada absen/izin baru di kegiatan itu).
    cached = _rekap_cache_get(token)
    if cached is not None:
        return cached
    data = await _build_public_rekap(token)
    kid = data.pop("_kegiatan_id", None)
    _rekap_cache_set(token, data, kid)
    return data


async def _build_public_rekap(token: str):
    k = await db.kegiatans.find_one({"share_token": token})
    if not k:
        raise HTTPException(status_code=404, detail="Tautan rekap tidak ditemukan")
    exp = k.get("share_expires_at")
    if exp:
        try:
            if datetime.fromisoformat(exp) <= datetime.now(timezone.utc):
                raise HTTPException(status_code=410, detail="Tautan rekap sudah kadaluarsa")
        except HTTPException:
            raise
        except Exception:
            pass
    if k.get("share_aktif") is False:
        raise HTTPException(status_code=410, detail="Tautan rekap sudah tidak berlaku")
    # Hormati tipe peserta & filter jenis kelamin kegiatan (mis. khusus perempuan)
    peserta = await peserta_for_kegiatan(k)
    absens = await db.absensis.find({"kegiatan_id": k["_id"]}).to_list(10000)
    guests = await db.guest_absens.find({"kegiatan_id": k["_id"]}).sort("created_at", 1).to_list(2000)
    amap = {a["user_id"]: a for a in absens}
    # Peserta yang sudah HADIR di kegiatan lain yang mulai lebih awal pada hari &
    # kelompok yang sama tidak dihitung lagi di rekap kegiatan ini.
    sebelumnya = await hadir_di_kegiatan_sebelumnya(k)
    pengajar_excluded = pengajar_dikecualikan(k, peserta)
    tampilkan_jam = bool(k.get("share_tampilkan_jam"))
    rows = []
    gender = {"L": 0, "P": 0}
    for p in peserta:
        pid = str(p["_id"])
        if pid in sebelumnya:
            continue
        a = amap.get(pid)
        status = a.get("status") if a else None
        # Pengajar yang dikecualikan tidak dihitung sebagai peserta wajib,
        # tetapi tetap tampil bila punya status (mis. hadir).
        if pid in pengajar_excluded and status not in ABSEN_STATUS:
            continue
        if status == "hadir":
            g = _derive_gender(p)
            if g in gender:
                gender[g] += 1
        row = {"name": p.get("name"), "status": status,
               "gender": _derive_gender(p),
               "account_status": p.get("status", "active"),
               "required_for_session": session_requires_participant(k, str(p["_id"]))}
        # Jam kehadiran HANYA dikirim bila pengurus menyalakannya.
        if tampilkan_jam:
            row["arrival_time"] = a.get("arrival_time") if a else None
        rows.append(row)
    for g in guests:
        row = {"name": f"{g.get('name')} (tamu)", "status": "hadir",
               "account_status": "tamu"}
        if tampilkan_jam:
            row["arrival_time"] = g.get("arrival_time")
        rows.append(row)
    counts = compute_counts(peserta, absens, len(guests), set(), k,
                            exclude_ids=set(sebelumnya))
    return {
        "_kegiatan_id": k["_id"],
        "name": k.get("name"), "type": k.get("type"), "location": k.get("location"),
        "date": k.get("date"), "start_time": k.get("start_time"), "end_time": k.get("end_time"),
        "teacher": k.get("teacher"), "material": k.get("material"),
        "counts": counts,
        "dikecualikan": len(sebelumnya),
        "pengajar_dikecualikan": len(pengajar_excluded),
        "gender": gender,
        "rows": rows,
        "tampilkan_jam": tampilkan_jam,
        "expires_at": exp,
    }


# ------------------------- QR Absen Mandiri + Kesan & Pesan -------------------------
async def ensure_absen_token(kegiatan_id: str, request: Optional[Request] = None) -> dict:
    """REVISI — QR absen kegiatan: SATU token per HARI, dipakai semua sesi hari itu.

    Token berlaku sampai akhir hari kegiatan (bukan bulanan lagi). Bila kegiatan
    memiliki beberapa sesi (pagi/sore/malam), semua sesi memakai token yang sama
    dan halaman absen otomatis mengarah ke sesi yang sedang berjalan.
    """
    docs = await sesi_group_docs(kegiatan_id)
    k = next((d for d in docs if d["_id"] == kegiatan_id), docs[0])
    ids = [d["_id"] for d in docs]
    exp = end_of_day_iso(k.get("date"))
    token = next((d.get("absen_token") for d in docs
                  if d.get("absen_token") and not is_expired_iso(d.get("absen_expires_at"))), None)
    if not token:
        token = secrets.token_urlsafe(10)
    await db.kegiatans.update_many({"_id": {"$in": ids}},
                                   {"$set": {"absen_token": token, "absen_expires_at": exp}})
    link = f"{resolve_base_url(request)}/absen/{token}"
    return {"token": token, "link": link, "expires_at": exp, "kegiatan": k,
            "sessions": len(docs)}


async def kegiatan_by_absen_token(token: str) -> dict:
    """Kegiatan/sesi yang dituju sebuah token absen harian.

    Bila token dipakai beberapa sesi dalam 1 hari, dipilih sesi yang sedang
    berjalan (jam selesainya belum lewat & masih terbuka).
    """
    docs = await db.kegiatans.find({"absen_token": token}).to_list(20)
    if not docs:
        raise HTTPException(
            status_code=404,
            detail="Mohon maaf, tautan absen ini tidak dikenali. "
                   "Silakan scan ulang QR kegiatan dari pengurus.")
    if len(docs) == 1:
        return docs[0]
    docs.sort(key=lambda d: (d.get("session_index") or 0, d.get("start_time") or ""))
    now = now_wita()
    for d in docs:
        end = kegiatan_end_dt(d.get("date"), d.get("end_time"))
        if (d.get("status") or "open") == "open" and end and now <= end:
            return d
    open_docs = [d for d in docs if (d.get("status") or "open") == "open"]
    return open_docs[-1] if open_docs else docs[-1]


def assert_barcode_valid(k: dict) -> None:
    """REVISI — QR absen kegiatan berlaku 1 hari (habis di akhir hari kegiatan)."""
    if is_expired_iso(k.get("absen_expires_at")):
        raise HTTPException(
            status_code=403,
            detail="Mohon maaf, QR absen kegiatan ini sudah kedaluwarsa "
                   "(berlaku 1 hari sesuai tanggal kegiatan). "
                   "Silakan minta QR baru kepada pengurus.")


@api_router.post("/admin/kegiatan/{kegiatan_id}/absen-qr")
async def absen_qr(kegiatan_id: str, request: Request, admin: dict = Depends(require_staff)):
    info = await ensure_absen_token(kegiatan_id, request)
    return {"token": info["token"], "link": info["link"],
            "expires_at": info["expires_at"],
            "expires_days": 1,
            "sessions": info.get("sessions", 1),
            "image": make_qr_data_url(info["link"])}


@api_router.get("/absen/{token}")
async def public_absen_info(token: str):
    k = await kegiatan_by_absen_token(token)
    if not k:
        raise HTTPException(status_code=404, detail="Tautan absen tidak ditemukan")
    assert_barcode_valid(k)
    peserta = await peserta_for_kegiatan(k)
    kmap = {km["_id"]: km.get("name") async for km in db.kelompoks.find()}
    absens = await db.absensis.find({"kegiatan_id": k["_id"]}).to_list(10000)
    amap = {a["user_id"]: a for a in absens}
    rows = []
    for p in peserta:
        pid = str(p["_id"])
        a = amap.get(pid)
        rows.append({
            "id": pid, "name": p.get("name"),
            "kelompok_name": kmap.get(p.get("kelompok_id")) if p.get("kelompok_id") else None,
            "status": a.get("status") if a else None,
            "account_status": p.get("status", "active"),
            "arrival_time": a.get("arrival_time") if a else None,
        })
    return {
        "kegiatan": {
            "name": k.get("name"), "type": k.get("type"), "location": k.get("location"),
            "date": k.get("date"), "start_time": k.get("start_time"),
            "end_time": k.get("end_time"), "teacher": k.get("teacher"),
            "material": k.get("material"), "status": k.get("status", "open"),
        },
        "peserta": rows,
    }


@api_router.post("/absen/{token}/mark")
async def public_absen_mark(token: str, body: SelfAbsenInput):
    k = await kegiatan_by_absen_token(token)
    if not k:
        raise HTTPException(status_code=404, detail="Tautan absen tidak ditemukan")
    assert_barcode_valid(k)
    if k.get("status", "open") != "open":
        raise HTTPException(status_code=403, detail="Kegiatan sudah ditutup. Absen mandiri dinonaktifkan.")
    u = await db.users.find_one({"_id": ObjectId(body.user_id)}) if ObjectId.is_valid(body.user_id) else None
    if not u or "peserta" not in (u.get("roles") or []):
        raise HTTPException(status_code=404, detail="Nama peserta tidak ditemukan")
    assert_gender_eligible(k, u)
    pid = str(u["_id"])
    await assert_not_attended_other_session(k, pid, u.get("name") or "Peserta")
    existing = await db.absensis.find_one({"kegiatan_id": k["_id"], "user_id": pid})
    if existing and existing.get("status") == "hadir":
        return {"name": u.get("name"), "status": "hadir",
                "arrival_time": existing.get("arrival_time"), "already": True}
    arrival = now_wita().isoformat()
    await db.absensis.update_one(
        {"kegiatan_id": k["_id"], "user_id": pid},
        {"$set": {"kegiatan_id": k["_id"], "user_id": pid, "status": "hadir",
                  "arrival_time": arrival, "marked_by": "Mandiri (QR)",
                  "marked_by_id": None, "updated_at": arrival}},
        upsert=True)
    return {"name": u.get("name"), "status": "hadir", "arrival_time": arrival, "already": False}


# ------------------------- Absen Mandiri TERFOKUS (wajib login, 1 peserta) -------------------------
# Peserta yang scan QR kegiatan hanya bisa mengabsenkan DIRINYA SENDIRI.
# Tidak ada "nitip absen" — daftar nama peserta lain tidak ditampilkan.
@api_router.get("/me/absen/{token}")
async def my_absen_info(token: str, user: dict = Depends(get_current_user)):
    k = await kegiatan_by_absen_token(token)
    if not k:
        raise HTTPException(
            status_code=404,
            detail="Mohon maaf, tautan absen ini tidak dikenali. Silakan scan ulang QR kegiatan dari pengurus.")
    assert_barcode_valid(k)
    uid = str(user["_id"])
    a = await db.absensis.find_one({"kegiatan_id": k["_id"], "user_id": uid})
    return {
        "kegiatan": {
            "id": k["_id"], "name": k.get("name"), "type": k.get("type"),
            "location": k.get("location"), "date": k.get("date"),
            "start_time": k.get("start_time"), "end_time": k.get("end_time"),
            "teacher": k.get("teacher"), "material": k.get("material"),
            "status": k.get("status", "open"),
        },
        "me": {
            "id": uid, "name": user.get("name"),
            "is_peserta": "peserta" in (user.get("roles") or []),
            "status": a.get("status") if a else None,
            "arrival_time": a.get("arrival_time") if a else None,
            "marked_by": a.get("marked_by") if a else None,
            "absence_reason": a.get("reason") if a else None,
            "absence_note": a.get("note") if a else None,
        },
    }


async def ensure_self_attendance_allowed(k: dict, user: dict) -> None:
    assert_barcode_valid(k)
    if k.get("status", "open") != "open":
        raise HTTPException(
            status_code=403,
            detail="Mohon maaf, kegiatan ini sudah ditutup sehingga absen mandiri tidak dapat diproses. "
                   "Silakan menghubungi pengurus untuk absen susulan.")
    if "peserta" not in (user.get("roles") or []):
        raise HTTPException(
            status_code=403,
            detail="Mohon maaf, akun Anda belum terdaftar sebagai peserta pengajian. "
                   "Silakan menghubungi pengurus untuk didaftarkan.")
    if profile_missing_fields(user):
        raise HTTPException(
            status_code=403,
            detail="Mohon lengkapi data profil Anda terlebih dahulu sebelum melakukan absen. "
                   "Jazakumullahu khoiro.")
    if not match_gender_filter(k, user):
        labels = kegiatan_filter_labels(k) or ["khusus kelompok tertentu"]
        raise HTTPException(
            status_code=403,
            detail=f"Mohon maaf, kegiatan ini {' · '.join(labels).lower()} "
                   "sehingga absen Anda tidak dapat diproses.")
    if (k.get("audience") or "reguler") == "reguler" and (user.get("status") or "active") != "active":
        raise HTTPException(
            status_code=403,
            detail="Mohon maaf, kegiatan reguler hanya untuk akun yang sudah diaktivasi. "
                   "Silakan aktivasi akun Anda terlebih dahulu.")


@api_router.post("/me/absen/{token}/mark")
async def my_absen_mark(token: str, user: dict = Depends(get_current_user)):
    k = await kegiatan_by_absen_token(token)
    if not k:
        raise HTTPException(
            status_code=404,
            detail="Mohon maaf, tautan absen ini tidak dikenali. Silakan scan ulang QR kegiatan dari pengurus.")
    await ensure_self_attendance_allowed(k, user)
    uid = str(user["_id"])
    await assert_not_attended_other_session(k, uid, "Kehadiran Anda")
    existing = await db.absensis.find_one({"kegiatan_id": k["_id"], "user_id": uid})
    if existing and existing.get("status") == "hadir":
        return {
            "already": True, "name": user.get("name"), "status": "hadir",
            "arrival_time": existing.get("arrival_time"),
            "message": f"Kehadiran Anda sudah tercatat sebelumnya pada kegiatan {k.get('name')}. "
                       "Terima kasih, jazakumullahu khoiro.",
        }
    arrival = now_wita().isoformat()
    await db.absensis.update_one(
        {"kegiatan_id": k["_id"], "user_id": uid},
        {"$set": {"kegiatan_id": k["_id"], "user_id": uid, "status": "hadir",
                  "arrival_time": arrival, "marked_by": "Mandiri (Scan QR)",
                  "marked_by_id": uid, "updated_at": arrival}},
        upsert=True)
    return {
        "already": False, "name": user.get("name"), "status": "hadir",
        "arrival_time": arrival,
        "message": f"Alhamdulillah, kehadiran Anda pada kegiatan {k.get('name')} berhasil dicatat. "
                   "Jazakumullahu khoiro.",
    }


@api_router.post("/me/absen/{token}/tidak-hadir")
async def my_absen_cannot_attend(token: str, body: TidakHadirInput,
                                 user: dict = Depends(get_current_user)):
    k = await kegiatan_by_absen_token(token)
    if not k:
        raise HTTPException(
            status_code=404,
            detail="Mohon maaf, tautan absen ini tidak dikenali. Silakan scan ulang QR kegiatan dari pengurus.")
    await ensure_self_attendance_allowed(k, user)
    reason = (body.alasan or "").strip()
    note = (body.keterangan or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Alasan tidak boleh kosong.")
    if len(reason) > 300 or len(note) > 500:
        raise HTTPException(status_code=400, detail="Alasan maksimal 300 karakter dan keterangan maksimal 500 karakter.")

    uid = str(user["_id"])
    await assert_not_attended_other_session(k, uid, "Kehadiran Anda")
    existing = await db.absensis.find_one({"kegiatan_id": k["_id"], "user_id": uid})
    if existing and existing.get("status") == "hadir":
        raise HTTPException(status_code=409, detail="Kehadiran Anda sudah tercatat sebagai hadir.")
    now = now_wita().isoformat()
    await db.absensis.update_one(
        {"kegiatan_id": k["_id"], "user_id": uid},
        {"$set": {
            "kegiatan_id": k["_id"], "user_id": uid, "status": "izin",
            "reason": reason, "note": note or None, "arrival_time": None,
            "marked_by": "Mandiri (lapor tidak hadir)", "marked_by_id": uid,
            "updated_at": now,
        }},
        upsert=True,
    )
    return {"name": user.get("name"), "status": "izin", "reason": reason,
            "note": note or None, "message": "Laporan tidak hadir berhasil dikirim."}


@api_router.post("/absen/{token}/feedback")
async def public_absen_feedback(token: str, body: FeedbackInput):
    k = await kegiatan_by_absen_token(token)
    if not k:
        raise HTTPException(
            status_code=404,
            detail="Mohon maaf, tautan absen ini tidak dikenali.")
    msg = (body.message or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong.")
    doc = {"_id": str(uuid.uuid4()), "kegiatan_id": k["_id"],
           "name": (body.name or "").strip() or "Anonim", "message": msg[:1000],
           "created_at": now_wita().isoformat()}
    await db.feedbacks.insert_one(doc)
    return {"message": "Alhamdulillah, jazakumullahu khoiro."}


@api_router.get("/admin/kegiatan/{kegiatan_id}/feedback")
async def admin_kegiatan_feedback(kegiatan_id: str, admin: dict = Depends(require_staff)):
    items = await db.feedbacks.find({"kegiatan_id": kegiatan_id}).sort("created_at", -1).to_list(1000)
    return [{"id": f["_id"], "name": f.get("name"), "message": f.get("message"),
             "created_at": f.get("created_at")} for f in items]


# ===========================================================================
# FASE 7 — Share Kegiatan + Kode Akses Absensi (6 digit)
# ===========================================================================
# Pengurus/admin membagikan TAUTAN + KODE AKSES 6 digit milik sebuah kegiatan.
# Penerima tautan (mis. petugas absen di lokasi) memasukkan kode, lalu langsung
# melihat DAFTAR PESERTA — baik yang sudah aktif maupun yang BELUM aktivasi —
# untuk diabsen MANUAL atau lewat SCAN BARCODE (QR pribadi peserta).
# Kode akses berlaku SAMPAI kegiatan ditutup/selesai.
ABSENSI_SCOPE = "absensi_kegiatan"


class AccessCodeInput(BaseModel):
    code: str


class AbsensiMarkInput(BaseModel):
    access: str
    user_id: str
    status: str  # hadir | izin | alpha


class AbsensiAccessInput(BaseModel):
    access: str


class AbsensiScanInput(BaseModel):
    access: str
    content: str


async def ensure_kegiatan_access(kegiatan_id: str, request: Optional[Request] = None,
                                 regenerate: bool = False) -> dict:
    """Pastikan kegiatan punya token halaman absensi + kode akses 6 digit."""
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    token = k.get("akses_token")
    code = k.get("access_code")
    if regenerate or not token or not code or len(str(code)) != ACCESS_CODE_LEN:
        token = token or secrets.token_urlsafe(9)
        code = gen_access_code()
        await db.kegiatans.update_one(
            {"_id": kegiatan_id},
            {"$set": {"akses_token": token, "access_code": code,
                      "access_code_at": now_wita().isoformat()}})
        k["akses_token"] = token
        k["access_code"] = code
    link = f"{resolve_base_url(request)}/absensi/{token}"
    end = kegiatan_end_dt(k.get("date"), k.get("end_time"))
    return {
        "token": token,
        "code": code,
        "link": link,
        "image": make_qr_data_url(link),
        "kegiatan_name": k.get("name"),
        "kegiatan_status": k.get("status", "open"),
        "valid_until": end.isoformat() if end else None,
        "wa_text": (
            f"Tautan absensi {k.get('name')}: {link}\n"
            f"Kode akses: {code}"
        ),
    }


def make_absensi_access(kegiatan_id: str, token: str, k: dict) -> str:
    end = kegiatan_end_dt(k.get("date"), k.get("end_time")) or now_wita()
    exp = max(end, now_wita()) + timedelta(hours=6)
    payload = {"sub": kegiatan_id, "tok": token, "type": ABSENSI_SCOPE, "exp": exp}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def verify_absensi_access(access: str, kegiatan_id: str, token: str) -> None:
    if not access:
        raise HTTPException(status_code=401, detail="Kode akses belum diverifikasi.")
    try:
        payload = jwt.decode(access, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401,
                            detail="Sesi absensi sudah berakhir. Silakan masukkan kode akses lagi.")
    if (payload.get("type") != ABSENSI_SCOPE or payload.get("sub") != kegiatan_id
            or payload.get("tok") != token):
        raise HTTPException(status_code=401, detail="Kode akses tidak sah untuk kegiatan ini.")


async def kegiatan_by_akses_token(token: str) -> dict:
    k = await db.kegiatans.find_one({"akses_token": token})
    if not k:
        raise HTTPException(
            status_code=404,
            detail="Mohon maaf, tautan absensi ini tidak dikenali. "
                   "Silakan minta tautan baru kepada pengurus.")
    return k


def assert_kegiatan_open(k: dict) -> None:
    if k.get("status", "open") != "open":
        raise HTTPException(
            status_code=403,
            detail="Kegiatan ini sudah selesai/ditutup, sehingga kode akses "
                   "absensi tidak berlaku lagi.")


async def build_absensi_rows(kegiatan) -> dict:
    """Daftar peserta (sesuai tipe & filter kegiatan) beserta status absensinya."""
    k = kegiatan
    if isinstance(kegiatan, str):
        k = await db.kegiatans.find_one({"_id": kegiatan}) or {"_id": kegiatan}
    kegiatan_id = k["_id"]
    peserta = await peserta_for_kegiatan(k)
    kmap = {}
    async for km in db.kelompoks.find():
        kmap[km["_id"]] = km.get("name")
    absens = await db.absensis.find({"kegiatan_id": kegiatan_id}).to_list(10000)
    amap = {a["user_id"]: a for a in absens}
    guests = await db.guest_absens.find({"kegiatan_id": kegiatan_id}).sort("created_at", 1).to_list(2000)
    other = await attended_other_sessions(k)
    rows = []
    for p in peserta:
        pid = str(p["_id"])
        a = amap.get(pid)
        status = a.get("status") if a else None
        required = session_requires_participant(k, pid)
        ot = other.get(pid)
        rows.append({
            "user_id": pid,
            "name": p.get("name"),
            "gender": _derive_gender(p),
            "kelompok_name": kmap.get(p.get("kelompok_id")) if p.get("kelompok_id") else None,
            "account_status": p.get("status", "active"),
            "status": status,
            "required_for_session": required,
            "arrival_time": a.get("arrival_time") if a else (
                (ot or {}).get("arrival_time") if ot and not required else None),
            "marked_by": a.get("marked_by") if a else None,
            "is_guest": False,
            "attended_other": bool(ot and not required),
            "attended_other_label": (ot or {}).get("label") if not required else None,
        })
    counts = compute_counts(peserta, absens, len(guests), set(other), k)
    return {
        "counts": counts,
        "rows": rows,
        "guests": [serialize_guest(g) for g in guests],
    }


def public_kegiatan_info(k: dict) -> dict:
    return {
        "id": k["_id"], "name": k.get("name"), "type": k.get("type"),
        "date": k.get("date"), "start_time": k.get("start_time"),
        "end_time": k.get("end_time"), "location": k.get("location"),
        "teacher": k.get("teacher"), "material": k.get("material"),
        "status": k.get("status", "open"),
        "susulan": bool(k.get("susulan", False)),
        "audience": k.get("audience", "reguler"),
        "gender_filter": k.get("gender_filter", "semua"),
        "gender_label": gender_label(k.get("gender_filter", "semua")),
        # FASE 9 — pengelompokan lanjutan + label sesi (pagi/sore/malam)
        "marital_filter": k.get("marital_filter", "semua"),
        "age_filter": normalize_age_filter(k.get("age_filter")),
        "filter_labels": kegiatan_filter_labels(k),
        "session_label": k.get("session_label"),
    }


@api_router.get("/admin/kegiatan/{kegiatan_id}/access")
async def get_kegiatan_access(kegiatan_id: str, request: Request,
                              staff: dict = Depends(require_staff)):
    """Tautan + kode akses 6 digit untuk absensi kegiatan."""
    return await ensure_kegiatan_access(kegiatan_id, request)


@api_router.post("/admin/kegiatan/{kegiatan_id}/access/regenerate")
async def regenerate_kegiatan_access(kegiatan_id: str, request: Request,
                                     staff: dict = Depends(require_staff)):
    """Perbarui (kadaluarsakan) kode akses lama dan buat kode 6 digit baru."""
    info = await ensure_kegiatan_access(kegiatan_id, request, regenerate=True)
    await log_activity(staff, "perbarui_kode_akses",
                       f"Memperbarui kode akses absensi kegiatan '{info['kegiatan_name']}'")
    return info


@api_router.post("/absensi/{token}/verify")
async def verify_kegiatan_access(token: str, body: AccessCodeInput):
    """Verifikasi kode akses 6 digit → dapat sesi absensi (tanpa perlu login)."""
    k = await kegiatan_by_akses_token(token)
    assert_kegiatan_open(k)
    code = re.sub(r"\D", "", body.code or "")
    if not code or code != str(k.get("access_code") or ""):
        raise HTTPException(status_code=401,
                            detail="Kode akses salah. Mohon periksa kembali 6 digit kodenya.")
    data = await build_absensi_rows(k)
    return {
        "access": make_absensi_access(k["_id"], token, k),
        "kegiatan": public_kegiatan_info(k),
        **data,
    }


@api_router.post("/absensi/verify-code")
async def verify_code_only(body: AccessCodeInput, request: Request):
    """FASE 7 — Absen dengan Kode: cari kegiatan hanya dari 6 digit kode akses.

    Dipakai halaman 'Absen dengan Kode' pada layar masuk, sehingga petugas tidak
    perlu tautan — cukup mengetik kode. Dibatasi 10 percobaan per 15 menit per IP
    untuk mencegah percobaan kode secara acak.
    """
    ip = (request.client.host if request.client else "") or "unknown"
    lock_key = f"absen_code:{ip}"
    since = datetime.now(timezone.utc) - timedelta(minutes=15)
    tries = await db.login_attempts.count_documents(
        {"identifier": lock_key, "at": {"$gte": since.isoformat()}})
    if tries >= 10:
        raise HTTPException(status_code=429,
                            detail="Terlalu banyak percobaan kode. Mohon coba lagi dalam 15 menit.")

    code = re.sub(r"\D", "", body.code or "")
    if len(code) != ACCESS_CODE_LEN:
        raise HTTPException(status_code=400, detail="Kode akses harus 6 digit angka.")

    k = await db.kegiatans.find_one({"access_code": code, "status": "open"})
    if not k:
        await db.login_attempts.insert_one(
            {"identifier": lock_key, "email": lock_key,
             "at": datetime.now(timezone.utc).isoformat()})
        raise HTTPException(
            status_code=404,
            detail="Kode akses tidak ditemukan atau kegiatannya sudah ditutup. "
                   "Mohon periksa kembali kode dari pengurus.")

    await db.login_attempts.delete_many({"identifier": lock_key})
    token = k.get("akses_token")
    if not token:
        info = await ensure_kegiatan_access(k["_id"], request)
        token = info["token"]
        k = await db.kegiatans.find_one({"_id": k["_id"]})
    data = await build_absensi_rows(k)
    return {
        "token": token,
        "access": make_absensi_access(k["_id"], token, k),
        "link": f"{resolve_base_url(request)}/absensi/{token}",
        "kegiatan": public_kegiatan_info(k),
        **data,
    }


@api_router.get("/absensi/{token}")
async def get_absensi_page(token: str, access: str = ""):
    k = await kegiatan_by_akses_token(token)
    verify_absensi_access(access, k["_id"], token)
    data = await build_absensi_rows(k)
    return {"kegiatan": public_kegiatan_info(k), **data}


@api_router.post("/absensi/{token}/share-rekap")
async def share_absensi_rekap(token: str, body: AbsensiAccessInput, request: Request):
    """Share link is available to holders of a verified, time-limited attendance session."""
    k = await kegiatan_by_akses_token(token)
    verify_absensi_access(body.access, k["_id"], token)
    info = await ensure_share(k["_id"], request)
    return {
        "link": info["link"],
        "expires_at": info["expires_at"],
        "wa_text": wa_template_laporan(k.get("name") or "kegiatan", info["link"]),
    }


@api_router.post("/absensi/{token}/close")
async def close_absensi_by_code(token: str, body: AbsensiAccessInput):
    """Tutup absensi dari halaman /absensi/[token]: sisa 'belum diabsen' jadi Alpha."""
    k = await kegiatan_by_akses_token(token)
    verify_absensi_access(body.access, k["_id"], token)
    if (k.get("status") or "open") != "open":
        return {"status": "closed", "already_closed": True,
                "message": "Absensi sudah ditutup sebelumnya."}
    now = now_wita().isoformat()
    result = await db.kegiatans.update_one(
        {"_id": k["_id"], "status": "open"},
        {"$set": {"status": "closed", "closed_at": now, "auto_closed": False}})
    if result.modified_count:
        await mark_missing_alpha(k, now)
        await revoke_delegations_for_kegiatan(k["_id"], "Kegiatan diselesaikan")
    k = await db.kegiatans.find_one({"_id": k["_id"]})
    return {"status": "closed", "already_closed": False,
            "kegiatan": public_kegiatan_info(k),
            "message": "Absensi ditutup. Peserta yang belum diabsen ditandai Alpha."}


@api_router.post("/absensi/{token}/mark")
async def mark_absensi_by_code(token: str, body: AbsensiMarkInput):
    """Absen MANUAL oleh pemegang kode akses. Notifikasi hanya untuk 'hadir'."""
    k = await kegiatan_by_akses_token(token)
    verify_absensi_access(body.access, k["_id"], token)
    assert_kegiatan_open(k)
    validate_absen_status(k, body.status)
    u = await db.users.find_one({"_id": ObjectId(body.user_id)}) if ObjectId.is_valid(body.user_id) else None
    if not u or "peserta" not in (u.get("roles") or []) or u.get("is_system"):
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan")
    if not match_gender_filter(k, u):
        labels = kegiatan_filter_labels(k) or ["khusus kelompok tertentu"]
        raise HTTPException(
            status_code=400,
            detail=f"Kegiatan ini {' · '.join(labels).lower()}, "
                   "peserta ini tidak termasuk dalam daftar.")
    await assert_not_attended_other_session(k, body.user_id, u.get("name") or "Peserta")
    arrival = now_wita().isoformat() if body.status == "hadir" else None
    await db.absensis.update_one(
        {"kegiatan_id": k["_id"], "user_id": body.user_id},
        {"$set": {"kegiatan_id": k["_id"], "user_id": body.user_id, "status": body.status,
                  "arrival_time": arrival, "marked_by": "Petugas (Kode Akses)",
                  "marked_by_id": None, "updated_at": now_wita().isoformat()}},
        upsert=True)
    message = ("Absen berhasil, alhamdulillah jazakumullahu khoiro."
               if body.status == "hadir" else None)
    return {"user_id": body.user_id, "name": u.get("name"), "status": body.status,
            "arrival_time": arrival, "message": message}


@api_router.post("/absensi/{token}/mark-batch")
async def mark_absensi_batch_by_code(token: str, body: AbsensiBatchInput):
    """FASE 8 — Sinkronisasi antrean absen OFFLINE dari halaman kode akses."""
    k = await kegiatan_by_akses_token(token)
    verify_absensi_access(body.access, k["_id"], token)
    assert_kegiatan_open(k)
    applied, failed = 0, []
    for item in body.items[:500]:
        if item.status not in ABSEN_STATUS or not ObjectId.is_valid(item.user_id):
            failed.append(item.user_id)
            continue
        if item.status == "alpha" and not alpha_allowed(k):
            failed.append(item.user_id)
            continue
        u = await db.users.find_one({"_id": ObjectId(item.user_id)})
        if not u or "peserta" not in (u.get("roles") or []) or u.get("is_system"):
            failed.append(item.user_id)
            continue
        if not match_gender_filter(k, u):
            failed.append(item.user_id)
            continue
        arrival = to_wita_iso(item.marked_at) if item.status == "hadir" else None
        await db.absensis.update_one(
            {"kegiatan_id": k["_id"], "user_id": item.user_id},
            {"$set": {"kegiatan_id": k["_id"], "user_id": item.user_id,
                      "status": item.status, "arrival_time": arrival,
                      "marked_by": "Petugas (sinkron offline)", "marked_by_id": None,
                      "updated_at": now_wita().isoformat()}},
            upsert=True)
        applied += 1
    return {"applied": applied, "failed": failed,
            "message": f"{applied} absen offline berhasil disinkronkan."}


@api_router.post("/absensi/{token}/guest")
async def add_guest_by_code(token: str, body: AbsensiGuestInput):
    """FASE 8 — Tambah TAMU (belum aktivasi / tanpa akun) pada kegiatan publik."""
    k = await kegiatan_by_akses_token(token)
    verify_absensi_access(body.access, k["_id"], token)
    assert_kegiatan_open(k)
    guest = await add_guest_doc(k, body.name, "Petugas (Kode Akses)")
    return {**guest, "message": f"Tamu {guest['name']} tercatat hadir. Jazakumullahu khoiro."}


@api_router.delete("/absensi/{token}/guest/{guest_id}")
async def delete_guest_by_code(token: str, guest_id: str, access: str = ""):
    k = await kegiatan_by_akses_token(token)
    verify_absensi_access(access, k["_id"], token)
    res = await db.guest_absens.delete_one({"_id": guest_id, "kegiatan_id": k["_id"]})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Data tamu tidak ditemukan")
    return {"message": "Data tamu dihapus"}


@api_router.post("/absensi/{token}/scan-personal")
async def scan_absensi_by_code(token: str, body: AbsensiScanInput):
    """Absen lewat SCAN BARCODE / QR pribadi peserta oleh pemegang kode akses."""
    k = await kegiatan_by_akses_token(token)
    verify_absensi_access(body.access, k["_id"], token)
    assert_kegiatan_open(k)
    content = (body.content or "").strip()
    if content.startswith("EKP:"):
        content = content[4:]
    target_id = verify_personal_token(content)
    if not target_id:
        raise HTTPException(
            status_code=400,
            detail="Mohon maaf, QR pribadi ini tidak dikenali atau sudah kadaluarsa. "
                   "Mohon peserta menampilkan ulang QR-nya.")
    u = await db.users.find_one({"_id": ObjectId(target_id)}) if ObjectId.is_valid(target_id) else None
    if not u or "peserta" not in (u.get("roles") or []) or u.get("is_system"):
        raise HTTPException(status_code=404,
                            detail="Mohon maaf, data peserta untuk QR ini tidak ditemukan.")
    assert_gender_eligible(k, u)
    await assert_not_attended_other_session(k, target_id, u.get("name") or "Peserta")
    existing = await db.absensis.find_one({"kegiatan_id": k["_id"], "user_id": target_id})
    if existing and existing.get("status") == "hadir":
        return {"user_id": target_id, "name": u.get("name"), "status": "hadir",
                "arrival_time": existing.get("arrival_time"), "already": True,
                "message": f"{u.get('name')} sudah tercatat hadir sebelumnya. Terima kasih."}
    arrival = now_wita().isoformat()
    await db.absensis.update_one(
        {"kegiatan_id": k["_id"], "user_id": target_id},
        {"$set": {"kegiatan_id": k["_id"], "user_id": target_id, "status": "hadir",
                  "arrival_time": arrival, "marked_by": "Petugas (Scan Kode Akses)",
                  "marked_by_id": None, "updated_at": arrival}},
        upsert=True)
    return {"user_id": target_id, "name": u.get("name"), "status": "hadir",
            "arrival_time": arrival, "already": False,
            "message": "Absen berhasil, alhamdulillah jazakumullahu khoiro."}



# ===========================================================================
# REVISI — BARCODE PUBLIK KEGIATAN TERBUKA (tanpa login & tanpa kode akses)
# Peserta yang BELUM aktivasi akun cukup scan barcode ini, mengisi NAMA, lalu
# langsung tercatat hadir. Hanya tersedia untuk kegiatan bertipe Terbuka/Publik.
# ===========================================================================
class PublikHadirInput(BaseModel):
    name: str


async def ensure_publik_token(kegiatan_id: str, request: Optional[Request] = None) -> dict:
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    await assert_publik(k)
    token = k.get("publik_token")
    if not token:
        token = secrets.token_urlsafe(9)
        await db.kegiatans.update_one({"_id": kegiatan_id}, {"$set": {"publik_token": token}})
    link = f"{resolve_base_url(request)}/hadir/{token}"
    return {
        "token": token, "link": link, "image": make_qr_data_url(link),
        "kegiatan_name": k.get("name"),
        "kegiatan_status": k.get("status", "open"),
        "wa_text": (
            f"Absen kehadiran: {k.get('name')}\n"
            f"{link}\n"
            "Isi nama, kehadiran langsung tercatat."
        ),
    }


@api_router.get("/admin/kegiatan/{kegiatan_id}/publik-qr")
async def publik_qr(kegiatan_id: str, request: Request, staff: dict = Depends(require_staff)):
    return await ensure_publik_token(kegiatan_id, request)


async def kegiatan_by_publik_token(token: str) -> dict:
    k = await db.kegiatans.find_one({"publik_token": token})
    if not k:
        raise HTTPException(
            status_code=404,
            detail="Mohon maaf, barcode absen ini tidak dikenali. "
                   "Silakan minta barcode baru kepada pengurus.")
    await assert_publik(k)
    return k


@api_router.get("/hadir/{token}")
async def publik_hadir_info(token: str):
    k = await kegiatan_by_publik_token(token)
    guests = await db.guest_absens.count_documents({"kegiatan_id": k["_id"]})
    return {"kegiatan": public_kegiatan_info(k), "guests": guests}


@api_router.post("/hadir/{token}")
async def publik_hadir_mark(token: str, body: PublikHadirInput):
    k = await kegiatan_by_publik_token(token)
    assert_kegiatan_open(k)
    clean = (body.name or "").strip()
    if len(clean) < 2:
        raise HTTPException(status_code=400, detail="Mohon isi nama Anda (minimal 2 huruf).")
    peserta = await peserta_for_kegiatan(k)
    match = next((p for p in peserta
                  if (p.get("name") or "").strip().lower() == clean.lower()), None)
    if not match:
        # Nama terdaftar tetapi TIDAK memenuhi ketentuan kegiatan (mis. khusus perempuan)
        other = await db.users.find_one({**PESERTA_QUERY,
                                         "name": {"$regex": f"^{re.escape(clean)}$",
                                                  "$options": "i"}})
        if other:
            assert_gender_eligible(k, other)
    if match:
        pid = str(match["_id"])
        existing = await db.absensis.find_one({"kegiatan_id": k["_id"], "user_id": pid})
        if existing and existing.get("status") == "hadir":
            return {"name": match.get("name"), "already": True,
                    "arrival_time": existing.get("arrival_time"),
                    "message": f"{match.get('name')} sudah tercatat hadir sebelumnya. "
                               "Terima kasih, jazakumullahu khoiro."}
        arrival = now_wita().isoformat()
        await db.absensis.update_one(
            {"kegiatan_id": k["_id"], "user_id": pid},
            {"$set": {"kegiatan_id": k["_id"], "user_id": pid, "status": "hadir",
                      "arrival_time": arrival, "marked_by": "Mandiri (Barcode Publik)",
                      "marked_by_id": None, "updated_at": arrival}},
            upsert=True)
        return {"name": match.get("name"), "already": False, "arrival_time": arrival,
                "message": f"Alhamdulillah, kehadiran {match.get('name')} berhasil dicatat. "
                           "Jazakumullahu khoiro."}
    dup = await db.guest_absens.find_one({"kegiatan_id": k["_id"],
                                          "name": {"$regex": f"^{re.escape(clean)}$",
                                                   "$options": "i"}})
    if dup:
        return {"name": dup.get("name"), "already": True,
                "arrival_time": dup.get("arrival_time"),
                "message": f"{dup.get('name')} sudah tercatat hadir sebelumnya. "
                           "Terima kasih, jazakumullahu khoiro."}
    guest = await add_guest_doc(k, clean, "Mandiri (Barcode Publik)")
    return {"name": guest["name"], "already": False, "arrival_time": guest["arrival_time"],
            "message": f"Alhamdulillah, kehadiran {guest['name']} berhasil dicatat. "
                       "Jazakumullahu khoiro."}


# ===========================================================================
# FASE 3 (Pengurus) & FASE 4 (Peserta)
# ===========================================================================
MUSY_CATEGORIES = ["4S", "tim7", "pleno"]
MUSY_LABEL = {"4S": "Musyawarah 4S", "tim7": "Musyawarah Tim 7", "pleno": "Musyawarah Pleno"}
MAX_PINNED = 3
PERSONAL_QR_ROTATE = 60  # detik


def wa_number(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if not digits:
        return None
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("62"):
        pass
    elif digits.startswith("8"):
        digits = "62" + digits
    return digits


# ------------------------- Musyawarah -------------------------
class MusyawarahInput(BaseModel):
    category: str
    date: Optional[str] = None
    content: Optional[str] = ""


class MusyawarahUpdate(BaseModel):
    date: Optional[str] = None
    content: Optional[str] = None


def serialize_musyawarah(m: dict) -> dict:
    return {"id": m["_id"], "category": m.get("category"),
            "category_label": MUSY_LABEL.get(m.get("category"), "Musyawarah"),
            "date": m.get("date"),
            "content": m.get("content", ""), "created_by": m.get("created_by_name"),
            "share_token": m.get("share_token"),
            "created_at": m.get("created_at"), "updated_at": m.get("updated_at")}


@api_router.get("/staff/musyawarah")
async def list_musyawarah(category: str = "", staff: dict = Depends(require_staff)):
    q = {}
    if category in MUSY_CATEGORIES:
        q["category"] = category
    items = await db.musyawarahs.find(q).sort("date", -1).to_list(2000)
    return [serialize_musyawarah(m) for m in items]


@api_router.post("/staff/musyawarah")
async def create_musyawarah(body: MusyawarahInput, staff: dict = Depends(require_staff)):
    if body.category not in MUSY_CATEGORIES:
        raise HTTPException(status_code=400, detail="Kategori tidak valid")
    now = now_wita().isoformat()
    doc = {"_id": str(uuid.uuid4()), "category": body.category,
           "date": body.date or now_wita().strftime("%Y-%m-%d"),
           "content": body.content or "", "created_by_id": str(staff["_id"]),
           "created_by_name": staff.get("name"), "created_at": now, "updated_at": now}
    await db.musyawarahs.insert_one(doc)
    return serialize_musyawarah(doc)


@api_router.patch("/staff/musyawarah/{musy_id}")
async def update_musyawarah(musy_id: str, body: MusyawarahUpdate, staff: dict = Depends(require_staff)):
    m = await db.musyawarahs.find_one({"_id": musy_id})
    if not m:
        raise HTTPException(status_code=404, detail="Catatan tidak ditemukan")
    updates = {"updated_at": now_wita().isoformat()}
    if body.date is not None:
        updates["date"] = body.date
    if body.content is not None:
        updates["content"] = body.content
    await db.musyawarahs.update_one({"_id": musy_id}, {"$set": updates})
    m = await db.musyawarahs.find_one({"_id": musy_id})
    return serialize_musyawarah(m)


@api_router.delete("/staff/musyawarah/{musy_id}")
async def delete_musyawarah(musy_id: str, staff: dict = Depends(require_staff)):
    res = await db.musyawarahs.delete_one({"_id": musy_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Catatan tidak ditemukan")
    return {"ok": True}


@api_router.post("/staff/musyawarah/{musy_id}/share")
async def share_musyawarah(musy_id: str, request: Request, staff: dict = Depends(require_staff)):
    """FASE 12 — tautan publik catatan musyawarah (bisa dibagikan ke WhatsApp)."""
    m = await db.musyawarahs.find_one({"_id": musy_id})
    if not m:
        raise HTTPException(status_code=404, detail="Catatan tidak ditemukan")
    token = m.get("share_token")
    if not token:
        token = secrets.token_urlsafe(10)
        await db.musyawarahs.update_one({"_id": musy_id}, {"$set": {"share_token": token}})
    link = f"{resolve_base_url(request)}/musyawarah/{token}"
    label = MUSY_LABEL.get(m.get("category"), "Musyawarah")
    wa_text = (
        f"Hasil {label} tanggal {m.get('date', '-')}\n"
        f"{link}"
    )
    return {"token": token, "link": link, "wa_text": wa_text, "label": label}


@api_router.get("/musyawarah/{token}")
async def public_musyawarah(token: str):
    m = await db.musyawarahs.find_one({"share_token": token})
    if not m:
        raise HTTPException(status_code=404, detail="Tautan musyawarah tidak ditemukan")
    return {"category": m.get("category"),
            "label": MUSY_LABEL.get(m.get("category"), "Musyawarah"),
            "date": m.get("date"), "content": m.get("content", ""),
            "created_by": m.get("created_by_name"), "updated_at": m.get("updated_at")}


@api_router.get("/staff/musyawarah/{musy_id}/pdf")
async def musyawarah_pdf(musy_id: str, staff: dict = Depends(require_staff)):
    m = await db.musyawarahs.find_one({"_id": musy_id})
    if not m:
        raise HTTPException(status_code=404, detail="Catatan tidak ditemukan")
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm,
                            leftMargin=2 * cm, rightMargin=2 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("t", parent=styles["Title"], textColor="#111114")
    cat_label = MUSY_LABEL.get(m.get("category"), "Musyawarah")
    body_style = ParagraphStyle("b", parent=styles["Normal"], fontSize=11, leading=17)
    elems = [Paragraph("E-KERTALANGU", title_style),
             Paragraph(cat_label, styles["Heading2"]),
             Paragraph(f"Tanggal: {m.get('date', '-')}", styles["Normal"]),
             Spacer(1, 0.4 * cm)]
    content = (m.get("content") or "").replace("\n", "<br/>")
    elems.append(Paragraph(content or "(kosong)", body_style))
    doc.build(elems)
    buf.seek(0)
    fname = f"musyawarah_{m.get('category')}_{m.get('date')}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename={fname}"})


@api_router.get("/staff/musyawarah-export-pdf")
async def musyawarah_export_pdf(category: str = "", date_from: str = "", date_to: str = "",
                                staff: dict = Depends(require_staff)):
    q = {}
    if category in MUSY_CATEGORIES:
        q["category"] = category
    if date_from or date_to:
        dr = {}
        if date_from:
            dr["$gte"] = date_from
        if date_to:
            dr["$lte"] = date_to
        q["date"] = dr
    items = await db.musyawarahs.find(q).sort([("category", 1), ("date", 1)]).to_list(5000)
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm,
                            leftMargin=2 * cm, rightMargin=2 * cm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("t", parent=styles["Title"], textColor="#111114")
    body_style = ParagraphStyle("b", parent=styles["Normal"], fontSize=11, leading=17)
    cat_label = MUSY_LABEL.get(category, "Musyawarah 4S, Tim 7 & Pleno")
    periode = ""
    if date_from or date_to:
        periode = f"Periode: {date_from or '...'} s/d {date_to or '...'}"
    elems = [Paragraph("E-KERTALANGU", title_style),
             Paragraph(f"Rekap {cat_label}", styles["Heading2"])]
    if periode:
        elems.append(Paragraph(periode, styles["Normal"]))
    elems.append(Spacer(1, 0.4 * cm))
    if not items:
        elems.append(Paragraph("Tidak ada catatan pada periode ini.", body_style))
    for m in items:
        lbl = {"4S": "4S", "tim7": "Tim 7", "pleno": "Pleno"}.get(m.get("category"), "-")
        elems.append(Paragraph(f"<b>[{lbl}] {m.get('date', '-')}</b>", styles["Heading3"]))
        content = (m.get("content") or "(kosong)").replace("\n", "<br/>")
        elems.append(Paragraph(content, body_style))
        elems.append(Spacer(1, 0.25 * cm))
        elems.append(HRFlowable(width="100%", thickness=0.5, color="#D1D5DB"))
        elems.append(Spacer(1, 0.25 * cm))
    doc.build(elems)
    buf.seek(0)
    tag = category if category in MUSY_CATEGORIES else "semua"
    fname = f"rekap_musyawarah_{tag}.pdf"
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": f"attachment; filename={fname}"})
class PengumumanInput(BaseModel):
    title: str
    body: str = ""
    kegiatan_id: Optional[str] = None
    pengajar: Optional[str] = None
    important: bool = False
    pinned: bool = False
    pin_roles: List[str] = []


class PengumumanUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    kegiatan_id: Optional[str] = None
    pengajar: Optional[str] = None
    important: Optional[bool] = None
    pinned: Optional[bool] = None
    pin_roles: Optional[List[str]] = None


def serialize_pengumuman(p: dict) -> dict:
    return {"id": p["_id"], "title": p.get("title"), "body": p.get("body", ""),
            "kegiatan_id": p.get("kegiatan_id"), "kegiatan_name": p.get("kegiatan_name"),
            "pengajar": p.get("pengajar"), "important": bool(p.get("important")),
            "pinned": bool(p.get("pinned")), "pin_roles": p.get("pin_roles", []),
            "created_by": p.get("created_by_name"), "created_at": p.get("created_at")}


async def _count_pinned(exclude_id: Optional[str] = None) -> int:
    q = {"pinned": True}
    if exclude_id:
        q["_id"] = {"$ne": exclude_id}
    return await db.pengumumans.count_documents(q)


@api_router.get("/staff/pengumuman")
async def list_pengumuman(staff: dict = Depends(require_staff)):
    items = await db.pengumumans.find().sort([("pinned", -1), ("created_at", -1)]).to_list(2000)
    return [serialize_pengumuman(p) for p in items]


@api_router.post("/staff/pengumuman")
async def create_pengumuman(body: PengumumanInput, staff: dict = Depends(require_staff)):
    title = (body.title or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Judul wajib diisi")
    if body.pinned and await _count_pinned() >= MAX_PINNED:
        raise HTTPException(status_code=400, detail=f"Maksimal {MAX_PINNED} pengumuman yang bisa di-pin")
    pin_roles = [r for r in (body.pin_roles or []) if r in VALID_ROLES]
    keg_name = None
    if body.kegiatan_id:
        k = await db.kegiatans.find_one({"_id": body.kegiatan_id})
        keg_name = k.get("name") if k else None
    doc = {"_id": str(uuid.uuid4()), "title": title, "body": body.body or "",
           "kegiatan_id": body.kegiatan_id, "kegiatan_name": keg_name,
           "pengajar": body.pengajar, "important": bool(body.important),
           "pinned": bool(body.pinned), "pin_roles": pin_roles if body.pinned else [],
           "created_by_id": str(staff["_id"]), "created_by_name": staff.get("name"),
           "created_at": now_wita().isoformat()}
    await db.pengumumans.insert_one(doc)
    await log_activity(staff, "buat_pengumuman", f"Membuat pengumuman '{title}'")
    return serialize_pengumuman(doc)


@api_router.patch("/staff/pengumuman/{peng_id}")
async def update_pengumuman(peng_id: str, body: PengumumanUpdate, staff: dict = Depends(require_staff)):
    p = await db.pengumumans.find_one({"_id": peng_id})
    if not p:
        raise HTTPException(status_code=404, detail="Pengumuman tidak ditemukan")
    updates = {}
    want_pinned = body.pinned if body.pinned is not None else p.get("pinned")
    if body.pinned is True and not p.get("pinned"):
        if await _count_pinned(exclude_id=peng_id) >= MAX_PINNED:
            raise HTTPException(status_code=400, detail=f"Maksimal {MAX_PINNED} pengumuman yang bisa di-pin")
    for field in ["title", "body", "pengajar", "important"]:
        val = getattr(body, field)
        if val is not None:
            updates[field] = val
    if body.kegiatan_id is not None:
        updates["kegiatan_id"] = body.kegiatan_id
        k = await db.kegiatans.find_one({"_id": body.kegiatan_id}) if body.kegiatan_id else None
        updates["kegiatan_name"] = k.get("name") if k else None
    if body.pinned is not None:
        updates["pinned"] = bool(body.pinned)
    if body.pin_roles is not None:
        updates["pin_roles"] = [r for r in body.pin_roles if r in VALID_ROLES]
    if not want_pinned:
        updates["pin_roles"] = []
    await db.pengumumans.update_one({"_id": peng_id}, {"$set": updates})
    p = await db.pengumumans.find_one({"_id": peng_id})
    return serialize_pengumuman(p)


@api_router.delete("/staff/pengumuman/{peng_id}")
async def delete_pengumuman(peng_id: str, staff: dict = Depends(require_staff)):
    res = await db.pengumumans.delete_one({"_id": peng_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pengumuman tidak ditemukan")
    return {"ok": True}


def to_utc_iso(value) -> Optional[str]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


@api_router.get("/me/updates")
async def my_updates(user: dict = Depends(get_current_user)):
    """FASE 12 — bahan lonceng notifikasi peserta: kegiatan baru + pengumuman baru."""
    today = now_wita().strftime("%Y-%m-%d")
    items = []
    kegs = await db.kegiatans.find({"date": {"$gte": today}}).sort("created_at", -1).to_list(80)
    for k in kegs:
        if not match_gender_filter(k, user):
            continue
        items.append({
            "type": "kegiatan", "id": k["_id"],
            "title": k.get("name"),
            "subtitle": f"{k.get('date')} · {k.get('start_time')}–{k.get('end_time')} WITA"
                        + (f" · {k.get('location')}" if k.get("location") else ""),
            "at": to_utc_iso(k.get("created_at")),
        })
    pengs = await db.pengumumans.find().sort("created_at", -1).to_list(30)
    for p in pengs:
        items.append({
            "type": "pengumuman", "id": p["_id"], "title": p.get("title"),
            "subtitle": (p.get("body") or "")[:90],
            "important": bool(p.get("important")),
            "at": to_utc_iso(p.get("created_at")),
        })
    items = [i for i in items if i["at"]]
    items.sort(key=lambda x: x["at"], reverse=True)
    items = items[:30]
    return {"items": items, "now": datetime.now(timezone.utc).isoformat(),
            "latest_at": items[0]["at"] if items else None}


@api_router.get("/me/announcements")
async def my_announcements(role: str = "", user: dict = Depends(get_current_user)):
    roles = user.get("roles", [])
    target = role if role in roles else (roles[0] if roles else "peserta")
    items = await db.pengumumans.find({"pinned": True, "pin_roles": target}) \
        .sort("created_at", -1).to_list(MAX_PINNED)
    return [serialize_pengumuman(p) for p in items[:MAX_PINNED]]


# ------------------------- Pengingat Kegiatan (WA) -------------------------
def build_reminder_text(k: dict) -> str:
    lines = [f"*Undangan Pengajian - {k.get('name', '')}*", ""]
    lines.append(f"Hari/Tanggal : {k.get('date', '-')}")
    lines.append(f"Waktu : {k.get('start_time', '')} - {k.get('end_time', '')} WITA")
    if k.get("location"):
        lines.append(f"Tempat : {k.get('location')}")
    if k.get("teacher"):
        lines.append(f"Pengajar : {k.get('teacher')}")
    if k.get("material"):
        lines.append(f"Materi : {k.get('material')}")
    lines.append("")
    lines.append("Mohon kehadiran dan doa restunya.")
    return "\n".join(lines)


@api_router.get("/staff/kegiatan/{kegiatan_id}/reminder")
async def kegiatan_reminder(kegiatan_id: str, staff: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    peserta = await db.users.find(PESERTA_QUERY).sort("name", 1).to_list(5000)
    recipients = []
    for p in peserta:
        wa = wa_number(p.get("whatsapp") or p.get("phone"))
        if wa:
            recipients.append({"id": str(p["_id"]), "name": p.get("name"),
                               "phone": p.get("whatsapp") or p.get("phone"), "wa": wa})
    return {"text": build_reminder_text(k), "recipients": recipients}


# ------------------------- QR Aktivasi Akun (publik) -------------------------
@api_router.get("/staff/activation-qr")
async def activation_qr(request: Request, staff: dict = Depends(require_staff)):
    url = f"{resolve_base_url(request)}/activate"
    return {"url": url, "image": make_qr_data_url(url)}


# ------------------------- Delegasi Absensi -------------------------
class DelegationInput(BaseModel):
    grantee_id: str
    reason: Optional[str] = ""


def serialize_delegation(d: dict) -> dict:
    return {"id": d["_id"], "kegiatan_id": d.get("kegiatan_id"),
            "kegiatan_name": d.get("kegiatan_name"), "granted_by": d.get("granted_by_name"),
            "grantee_id": d.get("grantee_id"), "grantee_name": d.get("grantee_name"),
            "reason": d.get("reason"), "active": bool(d.get("active")),
            "created_at": d.get("created_at"), "revoked_at": d.get("revoked_at"),
            "revoked_reason": d.get("revoked_reason")}


async def revoke_delegations_for_kegiatan(kegiatan_id: str, reason: str = "Kegiatan ditutup"):
    now = now_wita().isoformat()
    await db.delegations.update_many(
        {"kegiatan_id": kegiatan_id, "active": True},
        {"$set": {"active": False, "revoked_at": now, "revoked_reason": reason}})


@api_router.post("/staff/kegiatan/{kegiatan_id}/delegate")
async def create_delegation(kegiatan_id: str, body: DelegationInput, staff: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    if k.get("status", "open") != "open":
        raise HTTPException(status_code=400, detail="Kegiatan sudah ditutup, tidak bisa delegasi")
    reason = (body.reason or "").strip()
    g = await db.users.find_one({"_id": ObjectId(body.grantee_id)}) if ObjectId.is_valid(body.grantee_id) else None
    if not g:
        raise HTTPException(status_code=404, detail="Penerima delegasi tidak ditemukan")
    # cabut delegasi aktif sebelumnya utk kegiatan+penerima yang sama
    await db.delegations.update_many(
        {"kegiatan_id": kegiatan_id, "grantee_id": body.grantee_id, "active": True},
        {"$set": {"active": False, "revoked_at": now_wita().isoformat(),
                  "revoked_reason": "Diganti delegasi baru"}})
    now = now_wita().isoformat()
    doc = {"_id": str(uuid.uuid4()), "kegiatan_id": kegiatan_id,
           "kegiatan_name": k.get("name"), "granted_by_id": str(staff["_id"]),
           "granted_by_name": staff.get("name"), "grantee_id": body.grantee_id,
           "grantee_name": g.get("name"), "reason": reason, "active": True,
           "created_at": now, "revoked_at": None, "revoked_reason": None}
    await db.delegations.insert_one(doc)
    await log_activity(staff, "delegasi_absen",
                       f"Delegasi absen '{k.get('name')}' kepada {g.get('name')} — alasan: {reason or '(tanpa catatan)'}",
                       body.grantee_id)
    return serialize_delegation(doc)


@api_router.get("/staff/kegiatan/{kegiatan_id}/delegations")
async def list_delegations(kegiatan_id: str, staff: dict = Depends(require_staff)):
    items = await db.delegations.find({"kegiatan_id": kegiatan_id}).sort("created_at", -1).to_list(500)
    return [serialize_delegation(d) for d in items]


@api_router.post("/staff/delegation/{deleg_id}/revoke")
async def revoke_delegation(deleg_id: str, staff: dict = Depends(require_staff)):
    d = await db.delegations.find_one({"_id": deleg_id})
    if not d:
        raise HTTPException(status_code=404, detail="Delegasi tidak ditemukan")
    await db.delegations.update_one({"_id": deleg_id}, {"$set": {
        "active": False, "revoked_at": now_wita().isoformat(),
        "revoked_reason": f"Dicabut oleh {staff.get('name')}"}})
    await log_activity(staff, "cabut_delegasi",
                       f"Mencabut delegasi absen '{d.get('kegiatan_name')}' dari {d.get('grantee_name')}",
                       d.get("grantee_id"))
    d = await db.delegations.find_one({"_id": deleg_id})
    return serialize_delegation(d)


async def _active_delegation(kegiatan_id: str, user_id: str):
    return await db.delegations.find_one(
        {"kegiatan_id": kegiatan_id, "grantee_id": user_id, "active": True})


@api_router.get("/me/delegations")
async def my_delegations(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    items = await db.delegations.find({"grantee_id": uid, "active": True}) \
        .sort("created_at", -1).to_list(200)
    result = []
    for d in items:
        k = await db.kegiatans.find_one({"_id": d.get("kegiatan_id")})
        if not k or k.get("status", "open") != "open":
            continue
        out = serialize_delegation(d)
        out["kegiatan"] = serialize_kegiatan(k)
        result.append(out)
    return result


@api_router.get("/delegate/kegiatan/{kegiatan_id}")
async def delegate_kegiatan_info(kegiatan_id: str, user: dict = Depends(get_current_user)):
    deleg = await _active_delegation(kegiatan_id, str(user["_id"]))
    if not deleg:
        raise HTTPException(status_code=403, detail="Anda tidak memiliki hak delegasi untuk kegiatan ini")
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    peserta = await db.users.find(PESERTA_QUERY).sort("name", 1).to_list(5000)
    kmap = {km["_id"]: km.get("name") async for km in db.kelompoks.find()}
    absens = await db.absensis.find({"kegiatan_id": kegiatan_id}).to_list(10000)
    amap = {a["user_id"]: a for a in absens}
    rows = []
    for p in peserta:
        pid = str(p["_id"])
        a = amap.get(pid)
        rows.append({"id": pid, "name": p.get("name"),
                     "kelompok_name": kmap.get(p.get("kelompok_id")) if p.get("kelompok_id") else None,
                     "status": a.get("status") if a else None,
                     "account_status": p.get("status", "active"),
                     "arrival_time": a.get("arrival_time") if a else None})
    return {"kegiatan": serialize_kegiatan(k), "peserta": rows,
            "delegation": serialize_delegation(deleg)}


@api_router.post("/delegate/kegiatan/{kegiatan_id}/absen")
async def delegate_mark_absen(kegiatan_id: str, body: AbsenInput, user: dict = Depends(get_current_user)):
    deleg = await _active_delegation(kegiatan_id, str(user["_id"]))
    if not deleg:
        raise HTTPException(status_code=403, detail="Anda tidak memiliki hak delegasi untuk kegiatan ini")
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    if k.get("status", "open") != "open":
        raise HTTPException(status_code=403, detail="Kegiatan sudah ditutup")
    validate_absen_status(k, body.status)
    u = await db.users.find_one({"_id": ObjectId(body.user_id)}) if ObjectId.is_valid(body.user_id) else None
    if not u:
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan")
    assert_gender_eligible(k, u)
    arrival = now_wita().isoformat() if body.status == "hadir" else None
    await db.absensis.update_one(
        {"kegiatan_id": kegiatan_id, "user_id": body.user_id},
        {"$set": {"kegiatan_id": kegiatan_id, "user_id": body.user_id, "status": body.status,
                  "arrival_time": arrival, "marked_by": f"Delegasi: {user.get('name')}",
                  "marked_by_id": str(user["_id"]), "updated_at": now_wita().isoformat()}},
        upsert=True)
    return {"user_id": body.user_id, "status": body.status, "arrival_time": arrival}


class ScanPersonalInput(BaseModel):
    # Dibuat opsional agar pemeriksaan hak akses (403) & pesan Bahasa Indonesia
    # yang sopan (400) berjalan lebih dulu daripada error validasi mentah 422.
    content: Optional[str] = ""


@api_router.post("/delegate/kegiatan/{kegiatan_id}/scan-personal")
async def delegate_scan_personal(kegiatan_id: str, body: ScanPersonalInput,
                                 user: dict = Depends(get_current_user)):
    """Penjaga absen (penerima delegasi) menandai hadir via scan QR pribadi peserta."""
    deleg = await _active_delegation(kegiatan_id, str(user["_id"]))
    if not deleg:
        raise HTTPException(
            status_code=403,
            detail="Mohon maaf, Anda tidak memiliki hak penjaga absen untuk kegiatan ini.")
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Mohon maaf, kegiatan tidak ditemukan.")
    if k.get("status", "open") != "open":
        raise HTTPException(
            status_code=403,
            detail="Mohon maaf, kegiatan ini sudah ditutup sehingga absen tidak dapat diproses.")
    content = (body.content or "").strip()
    if content.startswith("EKP:"):
        content = content[4:]
    target_id = verify_personal_token(content)
    if not target_id:
        raise HTTPException(
            status_code=400,
            detail="Mohon maaf, QR pribadi ini tidak dikenali atau sudah kadaluarsa. "
                   "Mohon peserta menampilkan ulang QR-nya.")
    u = await db.users.find_one({"_id": ObjectId(target_id)}) if ObjectId.is_valid(target_id) else None
    if not u or "peserta" not in (u.get("roles") or []):
        raise HTTPException(
            status_code=404,
            detail="Mohon maaf, data peserta untuk QR ini tidak ditemukan.")
    assert_gender_eligible(k, u)
    existing = await db.absensis.find_one({"kegiatan_id": kegiatan_id, "user_id": target_id})
    if existing and existing.get("status") == "hadir":
        return {"name": u.get("name"), "status": "hadir",
                "arrival_time": existing.get("arrival_time"), "already": True,
                "message": f"{u.get('name')} sudah tercatat hadir sebelumnya. Terima kasih."}
    arrival = now_wita().isoformat()
    await db.absensis.update_one(
        {"kegiatan_id": kegiatan_id, "user_id": target_id},
        {"$set": {"kegiatan_id": kegiatan_id, "user_id": target_id, "status": "hadir",
                  "arrival_time": arrival, "marked_by": f"Penjaga Absen: {user.get('name')}",
                  "marked_by_id": str(user["_id"]), "updated_at": arrival}},
        upsert=True)
    return {"name": u.get("name"), "status": "hadir", "arrival_time": arrival, "already": False,
            "message": f"Alhamdulillah, kehadiran {u.get('name')} berhasil dicatat."}
# ------------------------- Peserta: QR pribadi rotating -------------------------
def _current_window() -> int:
    return int(datetime.now(timezone.utc).timestamp() // PERSONAL_QR_ROTATE)


def make_personal_token(user_id: str, window: int) -> str:
    msg = f"{user_id}.{window}"
    sig = hmac.new(get_jwt_secret().encode(), msg.encode(), hashlib.sha256).hexdigest()[:16]
    raw = f"{user_id}.{window}.{sig}"
    return base64.urlsafe_b64encode(raw.encode()).decode()


def verify_personal_token(token: str) -> Optional[str]:
    try:
        raw = base64.urlsafe_b64decode(token.encode()).decode()
        user_id, window_s, sig = raw.split(".")
        window = int(window_s)
    except Exception:
        return None
    now_w = _current_window()
    if window not in (now_w, now_w - 1):
        return None
    expected = hmac.new(get_jwt_secret().encode(), f"{user_id}.{window}".encode(),
                        hashlib.sha256).hexdigest()[:16]
    if not hmac.compare_digest(expected, sig):
        return None
    return user_id


@api_router.get("/me/qr")
async def my_personal_qr(user: dict = Depends(get_current_user)):
    window = _current_window()
    token = make_personal_token(str(user["_id"]), window)
    content = f"EKP:{token}"
    now_ts = datetime.now(timezone.utc).timestamp()
    expires_in = int((window + 1) * PERSONAL_QR_ROTATE - now_ts)
    return {"content": content, "image": make_qr_data_url(content),
            "rotate_seconds": PERSONAL_QR_ROTATE, "expires_in": max(expires_in, 1)}


@api_router.post("/staff/kegiatan/{kegiatan_id}/scan-personal")
async def scan_personal_qr(kegiatan_id: str, body: ScanPersonalInput, staff: dict = Depends(require_staff)):
    """Scan QR peserta: QR berputar (EKP:) atau QR permanen kartu nama (EKT:).

    Setiap penolakan membawa `kode` + `pesan` agar scanner bisa menampilkan
    alasan yang tepat (bukan selalu "Kartu tidak dikenali").
    """
    def tolak(kode: str, pesan: str, nama=None, status_code: int = 400):
        raise HTTPException(status_code=status_code, detail={
            "kode": kode, "pesan": pesan, "nama": nama})

    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    if k.get("status", "open") != "open":
        raise HTTPException(status_code=403, detail="Kegiatan sudah ditutup")
    jam = f"{k.get('start_time') or '-'}-{k.get('end_time') or '-'} WITA"
    # Hanya kegiatan yang sedang berlangsung (WITA).
    now = now_wita()
    if not kegiatan_sudah_berlangsung(k, now):
        tolak("BELUM_MULAI", f"Kegiatan belum dimulai ({jam})")
    end = kegiatan_end_dt(k.get("date"), k.get("end_time"))
    if end and now > end:
        tolak("DI_LUAR_JAM", f"Di luar jam kegiatan ({jam})")
    content = (body.content or "").strip()
    kartu = content.startswith("EKT:")
    if kartu:
        # QR permanen pada kartu nama peserta: EKT:<user_id>
        user_id = content[4:].strip()
        if not ObjectId.is_valid(user_id):
            tolak("KODE_TIDAK_DITEMUKAN", "Kartu tidak dikenali")
    else:
        if content.startswith("EKP:"):
            content = content[4:]
        user_id = verify_personal_token(content)
        if not user_id:
            tolak("KODE_TIDAK_DITEMUKAN", "Kartu tidak dikenali")
    u = await db.users.find_one({"_id": ObjectId(user_id)}) if ObjectId.is_valid(user_id) else None
    if not u or "peserta" not in (u.get("roles") or []):
        tolak("KODE_TIDAK_DITEMUKAN", "Kartu tidak dikenali")
    # Status akun login (pending/active) TIDAK menghalangi scan kartu.
    # Hanya peserta yang ditandai nonaktif/pindah yang ditolak.
    if (u.get("status") or "") in ("nonaktif", "pindah"):
        tolak("PESERTA_NONAKTIF", "Peserta nonaktif", u.get("name"))
    if not match_gender_filter(k, u):
        labels = kegiatan_filter_labels(k) or ["khusus kelompok tertentu"]
        tolak("TIDAK_TERDAFTAR",
              f"Tidak termasuk peserta kegiatan ini ({' · '.join(labels).lower()})",
              u.get("name"))
    existing = await db.absensis.find_one({"kegiatan_id": kegiatan_id, "user_id": user_id})
    if existing and existing.get("status") == "hadir":
        return {"name": u.get("name"), "status": "hadir",
                "arrival_time": existing.get("arrival_time"), "already": True,
                "user_id": user_id, "kategori": golongan_peserta(u),
                "message": f"{u.get('name')} sudah tercatat tadi."}
    arrival = now_wita().isoformat()
    await db.absensis.update_one(
        {"kegiatan_id": kegiatan_id, "user_id": user_id},
        {"$set": {"kegiatan_id": kegiatan_id, "user_id": user_id, "status": "hadir",
                  "arrival_time": arrival,
                  "marked_by": (f"Kartu: {staff.get('name')}" if kartu
                                else f"Dibantu: {staff.get('name')}"),
                  "marked_by_id": str(staff["_id"]), "updated_at": arrival}},
        upsert=True)
    await notif_kehadiran_dari_status(user_id, "hadir", k)
    _rekap_cache_buang(kegiatan_id)
    return {"name": u.get("name"), "status": "hadir", "arrival_time": arrival, "already": False,
            "user_id": user_id, "kategori": golongan_peserta(u),
            "message": f"Alhamdulillah, kehadiran {u.get('name')} berhasil dicatat."}

# ------------------------- Peserta: dashboard / kegiatan / profil -------------------------
async def _my_attendance_ratio(user_id: str) -> dict:
    today = now_wita().strftime("%Y-%m-%d")
    kids = await db.kegiatans.find({"date": {"$lte": today}}).to_list(10000)
    kid_set = [k["_id"] for k in kids]
    total = len(kid_set)
    hadir = 0
    if kid_set:
        hadir = await db.absensis.count_documents(
            {"user_id": user_id, "status": "hadir", "kegiatan_id": {"$in": kid_set}})
    ratio = round((hadir / total) * 100, 1) if total else 0.0
    return {"total": total, "hadir": hadir, "ratio": ratio}


@api_router.get("/me/attendance-history")
async def my_attendance_history(months: int = 6, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    months = max(1, min(months, 12))
    now = now_wita()
    # build list of last N months (oldest -> newest)
    ym_list = []
    y, m = now.year, now.month
    for _ in range(months):
        ym_list.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    ym_list.reverse()
    id_label = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
    today = now.strftime("%Y-%m-%d")
    result = []
    cur = {"hadir": 0, "izin": 0, "sakit": 0, "alpha": 0, "belum_diabsen": 0, "total": 0}
    for ym in ym_list:
        kids = await db.kegiatans.find({"date": {"$regex": f"^{ym}", "$lte": today}}).to_list(5000)
        kid_set = [k["_id"] for k in kids]
        total = len(kid_set)
        hadir = izin = sakit = alpha = 0
        if kid_set:
            hadir = await db.absensis.count_documents({"user_id": uid, "status": "hadir", "kegiatan_id": {"$in": kid_set}})
            izin = await db.absensis.count_documents({"user_id": uid, "status": "izin", "kegiatan_id": {"$in": kid_set}})
            sakit = await db.absensis.count_documents({"user_id": uid, "status": "sakit", "kegiatan_id": {"$in": kid_set}})
            alpha = await db.absensis.count_documents({"user_id": uid, "status": "alpha", "kegiatan_id": {"$in": kid_set}})
        pending = max(total - hadir - izin - sakit - alpha, 0)
        mi = int(ym[5:7]) - 1
        row = {"month": ym, "label": id_label[mi], "hadir": hadir, "izin": izin,
               "sakit": sakit, "alpha": alpha, "belum_diabsen": pending, "total": total}
        result.append(row)
        if ym == ym_list[-1]:
            cur = {"hadir": hadir, "izin": izin, "sakit": sakit, "alpha": alpha,
                   "belum_diabsen": pending, "total": total}
    return {"months": result, "current": cur}


@api_router.get("/me/dashboard")
async def peserta_dashboard(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    today = now_wita().strftime("%Y-%m-%d")
    upcoming_docs = await db.kegiatans.find({"date": {"$gte": today}}) \
        .sort([("date", 1), ("start_time", 1)]).to_list(20)
    # FASE 8 — hanya tampilkan kegiatan yang sesuai untuk peserta ini
    upcoming_docs = [k for k in upcoming_docs if match_gender_filter(k, user)]
    upcoming = [serialize_kegiatan(k) for k in upcoming_docs[:5]]
    ann = await db.pengumumans.find({"pinned": True, "pin_roles": "peserta"}) \
        .sort("created_at", -1).to_list(MAX_PINNED)
    return {"name": user.get("name"), "gender": _derive_gender(user),
            "attendance": await _my_attendance_ratio(uid),
            "upcoming": upcoming,
            "announcements": [serialize_pengumuman(p) for p in ann[:MAX_PINNED]]}


@api_router.get("/me/kegiatan")
async def peserta_kegiatan(month: str = "", user: dict = Depends(get_current_user)):
    q = {}
    if month:
        q["date"] = {"$regex": f"^{month}"}
    docs = await db.kegiatans.find(q).sort([("date", -1), ("start_time", -1)]).to_list(2000)
    # FASE 8 — kegiatan khusus laki-laki/perempuan hanya tampil bagi yang sesuai
    docs = [k for k in docs if match_gender_filter(k, user)]
    uid = str(user["_id"])
    absens = await db.absensis.find({"user_id": uid}).to_list(10000)
    amap = {a["kegiatan_id"]: a for a in absens}
    result = []
    for k in docs:
        item = serialize_kegiatan(k)
        a = amap.get(k["_id"])
        item["my_status"] = a.get("status") if a else None
        item["my_arrival"] = a.get("arrival_time") if a else None
        result.append(item)
    return result


@api_router.get("/me/kegiatan/{kegiatan_id}")
async def peserta_kegiatan_detail(kegiatan_id: str, user: dict = Depends(get_current_user)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    uid = str(user["_id"])
    a = await db.absensis.find_one({"kegiatan_id": kegiatan_id, "user_id": uid})
    item = serialize_kegiatan(k)
    item["my_status"] = a.get("status") if a else None
    item["my_arrival"] = a.get("arrival_time") if a else None
    return item


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    dob: Optional[str] = None
    birthplace: Optional[str] = None
    address: Optional[str] = None
    gender: Optional[str] = None
    education: Optional[str] = None
    marital: Optional[str] = None


class CompleteAccountInput(ProfileUpdate):
    new_password: str


@api_router.get("/me/profile")
async def get_my_profile(user: dict = Depends(get_current_user)):
    """Data profil pengguna yang sedang login (dipakai halaman Profil)."""
    return public_user(user)


@api_router.patch("/me/profile")
async def update_my_profile(body: ProfileUpdate, user: dict = Depends(get_current_user)):
    updates = {}
    for field in ["name", "phone", "whatsapp", "birthplace", "address", "education"]:
        val = getattr(body, field)
        if val is not None:
            updates[field] = val
    if body.dob is not None:
        updates["dob"] = normalize_dob(body.dob)
    if body.gender is not None:
        updates["gender"] = normalize_gender(body.gender)
    if body.marital is not None:
        updates["marital"] = body.marital if body.marital in MARITAL_OPTIONS else None
        kategori = kategori_dari_status(updates["marital"])
        if kategori:
            updates["kategori"] = kategori
    if updates:
        await db.users.update_one({"_id": user["_id"]}, {"$set": updates})
    u = await db.users.find_one({"_id": user["_id"]})
    return public_user(u)


class GantiSandiInput(BaseModel):
    password_lama: str
    password_baru: str


@api_router.post("/me/ganti-sandi")
async def ganti_sandi(body: GantiSandiInput, response: Response,
                      user: dict = Depends(get_current_user)):
    """Ganti kata sandi wajib (login pertama / setelah reset admin)."""
    if not verify_password(body.password_lama or "", user.get("password_hash") or ""):
        raise HTTPException(status_code=400, detail="Kata sandi lama salah.")
    baru = body.password_baru or ""
    if len(baru) < 6 or len(baru.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Kata sandi baru minimal 6 karakter.")
    if baru == body.password_lama:
        raise HTTPException(status_code=400, detail="Kata sandi baru tidak boleh sama dengan yang lama.")
    dob = normalize_dob(user.get("dob"))
    if dob:
        y, m, d = dob.split("-")
        if baru in (f"{d}{m}{y}", f"{d}{m}{y[2:]}"):
            raise HTTPException(status_code=400, detail="Kata sandi baru tidak boleh sama dengan tanggal lahir.")
    await db.users.update_one({"_id": user["_id"]}, {
        "$set": {"password_hash": hash_password(baru), "must_change_password": False},
        "$inc": {"token_version": 1}})
    fresh = await db.users.find_one({"_id": user["_id"]})
    set_auth_cookies(response, str(user["_id"]), fresh.get("token_version", 0), is_demo_ctx())
    await log_activity(fresh, "ganti_sandi_wajib", "Mengganti kata sandi wajib saat login")
    return public_user(fresh)


@api_router.post("/me/complete-account")
async def complete_account(body: CompleteAccountInput, response: Response,
                           user: dict = Depends(get_current_user)):
    if not user.get("must_change_password"):
        raise HTTPException(status_code=400, detail="Akun ini tidak memerlukan penggantian kata sandi sementara.")
    if len(body.new_password) < 6 or len(body.new_password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Kata sandi baru minimal 6 karakter.")
    updates = {}
    for field in ["name", "phone", "whatsapp", "birthplace", "address", "education"]:
        value = getattr(body, field)
        if value is not None:
            updates[field] = value.strip() if isinstance(value, str) else value
    if body.dob is not None:
        updates["dob"] = normalize_dob(body.dob)
        if not updates["dob"]:
            raise HTTPException(status_code=400, detail="Tanggal lahir tidak valid.")
    if body.gender is not None:
        updates["gender"] = normalize_gender(body.gender)
    if body.marital is not None:
        updates["marital"] = body.marital if body.marital in MARITAL_OPTIONS else None
        kategori = kategori_dari_status(updates["marital"])
        if kategori:
            updates["kategori"] = kategori

    candidate = {**user, **updates}
    candidate_dob = normalize_dob(candidate.get("dob"))
    if not candidate_dob:
        raise HTTPException(status_code=400, detail="Tanggal lahir tidak valid.")
    candidate["dob"] = candidate_dob
    updates["dob"] = candidate_dob
    temporary_dobs = {normalize_dob(user.get("dob")), candidate_dob}
    for dob in temporary_dobs:
        if dob:
            year, month, day = dob.split("-")
            if body.new_password == f"{day}{month}{year}":
                raise HTTPException(status_code=400, detail="Kata sandi baru tidak boleh sama dengan tanggal lahir.")
    missing = profile_missing_fields(candidate)
    if missing:
        raise HTTPException(status_code=400, detail=f"Mohon lengkapi data: {', '.join(missing)}.")
    phone = candidate.get("phone")
    if phone and await db.users.find_one({"phone": phone, "_id": {"$ne": user["_id"]}}):
        raise HTTPException(status_code=409, detail="Nomor HP sudah terdaftar.")

    updates.update({
        "password_hash": hash_password(body.new_password),
        "must_change_password": False,
    })
    await db.users.update_one({"_id": user["_id"]}, {
        "$set": updates, "$inc": {"token_version": 1}})
    fresh_user = await db.users.find_one({"_id": user["_id"]})
    set_auth_cookies(response, str(user["_id"]), fresh_user.get("token_version", 0), is_demo_ctx())
    await log_activity(fresh_user, "lengkapi_akun", "Melengkapi data dan mengganti kata sandi sementara")
    return public_user(fresh_user)


# ------------------------- Dashboard -------------------------
@api_router.get("/admin/dashboard")
async def admin_dashboard(admin: dict = Depends(require_staff)):
    """REVISI: dihitung dengan ~6 query saja (sebelumnya 3 query per kegiatan)
    sehingga dashboard tidak lagi gagal memuat / timeout."""
    now = now_wita()
    today = now.strftime("%Y-%m-%d")
    this_month = now.strftime("%Y-%m")

    # 6 bulan terakhir (oldest -> newest)
    months = []
    for i in range(5, -1, -1):
        year, month = now.year, now.month - i
        while month <= 0:
            month += 12
            year -= 1
        months.append(f"{year:04d}-{month:02d}")
    since = f"{months[0]}-01"

    peserta = await db.users.find(
        PESERTA_QUERY,
        {"name": 1, "gender": 1, "avatar_gender": 1, "status": 1}).to_list(10000)
    total_peserta = len(peserta)
    lk = sum(1 for p in peserta if _derive_gender(p) == "L")
    pr = sum(1 for p in peserta if _derive_gender(p) == "P")
    akun_aktif = await db.users.count_documents({"status": "active"})
    akun_nonaktif = await db.users.count_documents({"status": {"$ne": "active"}})

    kegs = await db.kegiatans.find({"date": {"$gte": since}}).to_list(3000)
    upcoming_docs = sorted([k for k in kegs if (k.get("date") or "") >= today],
                           key=lambda k: (k.get("date") or "", k.get("start_time") or ""))[:5]
    recent_docs = sorted([k for k in kegs if (k.get("date") or "") < today],
                         key=lambda k: (k.get("date") or ""), reverse=True)[:5]

    ids = [k["_id"] for k in kegs]
    absens = await db.absensis.find(
        {"kegiatan_id": {"$in": ids}},
        {"kegiatan_id": 1, "user_id": 1, "status": 1}).to_list(200000) if ids else []
    abs_by_keg: dict = {}
    for a in absens:
        abs_by_keg.setdefault(a["kegiatan_id"], []).append(a)
    guest_by_keg: dict = {}
    if ids:
        async for g in db.guest_absens.find({"kegiatan_id": {"$in": ids}}, {"kegiatan_id": 1}):
            guest_by_keg[g["kegiatan_id"]] = guest_by_keg.get(g["kegiatan_id"], 0) + 1

    counts_cache: dict = {}

    def counts_of(k: dict) -> dict:
        kid = k["_id"]
        if kid not in counts_cache:
            counts_cache[kid] = compute_counts(
                filter_peserta_for_kegiatan(k, peserta),
                abs_by_keg.get(kid, []),
                guest_by_keg.get(kid, 0), kegiatan=k)
        return counts_cache[kid]

    by_month: dict = {m: [] for m in months}
    for k in kegs:
        key = (k.get("date") or "")[:7]
        if key in by_month:
            by_month[key].append(k)

    tren = []
    for m in months:
        rs = [counts_of(k)["ratio"] for k in by_month[m] if counts_of(k)["total"]]
        tren.append({"month": m, "ratio": round(sum(rs) / len(rs), 1) if rs else 0.0,
                     "kegiatan": len(by_month[m])})

    keg_this_month = by_month.get(this_month, [])
    ratios = [counts_of(k)["ratio"] for k in keg_this_month if counts_of(k)["total"]]
    rasio_bulan = round(sum(ratios) / len(ratios), 1) if ratios else 0.0
    hadir_bulan_ini = sum(counts_of(k)["hadir"] for k in keg_this_month)

    return {
        "total_peserta": total_peserta, "peserta_L": lk, "peserta_P": pr,
        "akun_aktif": akun_aktif, "akun_nonaktif": akun_nonaktif,
        "kegiatan_bulan_ini": len(keg_this_month),
        "hadir_bulan_ini": hadir_bulan_ini,
        "rasio_kehadiran_bulan": rasio_bulan,
        "donut": {"L": lk, "P": pr},
        "tren": tren,
        "upcoming": [serialize_kegiatan(k, counts_of(k)) for k in upcoming_docs],
        "recent": [serialize_kegiatan(k, counts_of(k)) for k in recent_docs],
    }


# ------------------------- Laporan + Export -------------------------
BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
            "Agustus", "September", "Oktober", "November", "Desember"]


def _tanggal_indo(ymd: str) -> str:
    p = str(ymd or "").split("-")
    if len(p) != 3:
        return ymd or "-"
    return f"{int(p[2])} {BULAN_ID[int(p[1]) - 1]} {p[0]}"


def peserta_report_range(month: str, week: str = "bulanan") -> tuple:
    if not re.fullmatch(r"\d{4}-\d{2}", month or ""):
        raise HTTPException(status_code=400, detail="Format bulan harus YYYY-MM")
    try:
        first = datetime.strptime(f"{month}-01", "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Bulan laporan tidak valid")
    today = now_wita().date()
    if first > today:
        raise HTTPException(status_code=400, detail="Bulan laporan tidak boleh melebihi bulan berjalan")
    next_month = (first.replace(day=28) + timedelta(days=4)).replace(day=1)
    last = next_month - timedelta(days=1)
    if week in ("", "bulanan", "semua"):
        start, end = first, last
    else:
        try:
            week_number = int(week)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Pilihan pekan tidak valid")
        if week_number < 1 or week_number > 5:
            raise HTTPException(status_code=400, detail="Pekan harus antara 1 dan 5")
        start = first + timedelta(days=(week_number - 1) * 7)
        if start > last:
            raise HTTPException(status_code=400, detail="Pekan tersebut tidak tersedia pada bulan ini")
        if start > today:
            raise HTTPException(status_code=400, detail="Pekan tersebut belum dimulai")
        end = min(start + timedelta(days=6), last)
    return start.strftime("%Y-%m-%d"), min(end, today).strftime("%Y-%m-%d")


def kegiatan_sudah_berlangsung(k: dict, now: Optional[datetime] = None) -> bool:
    """True bila waktu mulai kegiatan sudah lewat/berjalan (WITA)."""
    ref = now or now_wita()
    start = kegiatan_end_dt(k.get("date"), k.get("start_time"))
    if start is None:
        # Tanpa jam mulai: anggap berlangsung bila tanggalnya sudah lewat/hari ini.
        return str(k.get("date") or "") <= ref.strftime("%Y-%m-%d")
    return start <= ref


def group_pertemuan(kegiatan_list: list) -> list:
    """Gabungkan sesi dalam satu hari menjadi SATU pertemuan.

    Aturan sama dengan Rekap Bulanan: kunci = session_group_id atau _id kegiatan.
    """
    meetings: dict = {}
    for k in kegiatan_list:
        key = k.get("session_group_id") or k["_id"]
        mt = meetings.setdefault(key, {"date": k.get("date"),
                                       "name": k.get("base_name") or k.get("name"),
                                       "type": k.get("type", "rutin"),
                                       "docs": []})
        mt["docs"].append(k)
    return sorted(meetings.values(), key=lambda x: (x["date"] or "", x["name"] or ""))


def pertemuan_status(mt: dict, user_id: str, status_by: dict,
                     elig_by_doc: dict) -> Optional[str]:
    """Status peserta pada satu pertemuan (sesi digabung). None = tidak wajib."""
    docs_p = [
        d for d in mt["docs"]
        if user_id in elig_by_doc.get(d["_id"], set()) and (
            session_requires_participant(d, user_id)
            or status_by.get((d["_id"], user_id)) in ABSEN_STATUS
        )
    ]
    if not docs_p:
        return None
    sts = [status_by.get((d["_id"], user_id), "belum_diabsen") for d in docs_p]
    for st in ("hadir", "izin", "sakit", "alpha"):
        if st in sts:
            return st
    return "belum_diabsen"


async def build_peserta_attendance_rows(date_from: str, date_to: str,
                                        detail_user_id: Optional[str] = None,
                                        group_by_month: bool = False) -> tuple:
    participants = await db.users.find(PESERTA_QUERY).sort("name", 1).to_list(10000)
    rows = {
        str(p["_id"]): {
            "user_id": str(p["_id"]), "name": p.get("name") or "Peserta",
            "hadir": 0, "izin": 0, "sakit": 0, "alpha": 0,
            "belum_diabsen": 0, "total_pertemuan": 0, "ratio": 0.0,
            **({"by_month": {}} if group_by_month else {}),
        }
        for p in participants
    }
    if date_to < date_from:
        return rows, []
    kegiatan = await db.kegiatans.find(
        {"date": {"$gte": date_from, "$lte": date_to}}
    ).sort([("date", 1), ("start_time", 1)]).to_list(5000)
    kegiatan_ids = [k["_id"] for k in kegiatan]
    absensi = await db.absensis.find(
        {"kegiatan_id": {"$in": kegiatan_ids}}
    ).to_list(100000) if kegiatan_ids else []
    status_by = {(a["kegiatan_id"], a["user_id"]): a.get("status") for a in absensi}
    elig_by_doc = {k["_id"]: {str(p["_id"]) for p in filter_peserta_for_kegiatan(k, participants)}
                   for k in kegiatan}
    now = now_wita()
    activities = []

    for mt in group_pertemuan(kegiatan):
        berlangsung = any(kegiatan_sudah_berlangsung(d, now) for d in mt["docs"])
        month_key = str(mt["date"] or "")[:7]
        for participant in participants:
            user_id = str(participant["_id"])
            status = pertemuan_status(mt, user_id, status_by, elig_by_doc)
            if status is None:
                continue
            if not berlangsung:
                # Belum mulai: tampil di daftar, tidak dihitung sama sekali.
                if detail_user_id == user_id:
                    activities.append({
                        "id": str(mt["docs"][0]["_id"]),
                        "name": mt["name"] or "Kegiatan",
                        "date": mt["date"],
                        "start_time": mt["docs"][0].get("start_time"),
                        "end_time": mt["docs"][0].get("end_time"),
                        "session_label": None,
                        "status": "belum_berlangsung",
                        "type": mt["type"],
                    })
                continue
            row = rows[user_id]
            row[status] += 1
            row["total_pertemuan"] += 1
            if group_by_month:
                month_row = row["by_month"].setdefault(
                    month_key,
                    {"hadir": 0, "izin": 0, "sakit": 0, "alpha": 0,
                     "belum_diabsen": 0, "total_pertemuan": 0},
                )
                month_row[status] += 1
                month_row["total_pertemuan"] += 1
            if detail_user_id == user_id:
                activities.append({
                    "id": str(mt["docs"][0]["_id"]),
                    "name": mt["name"] or "Kegiatan",
                    "date": mt["date"],
                    "start_time": mt["docs"][0].get("start_time"),
                    "end_time": mt["docs"][0].get("end_time"),
                    "session_label": None,
                    "status": status,
                    "type": mt["type"],
                })

    for row in rows.values():
        total = row["total_pertemuan"]
        row["ratio"] = round(row["hadir"] / total * 100, 1) if total else 0.0
        for month_row in row.get("by_month", {}).values():
            month_total = month_row["total_pertemuan"]
            month_row["ratio"] = round(month_row["hadir"] / month_total * 100, 1) if month_total else 0.0
    return rows, activities


@api_router.get("/admin/laporan/peserta")
async def admin_laporan_peserta(admin: dict = Depends(require_staff),
                                month: str = "", week: str = "bulanan", q: str = ""):
    selected_month = month.strip() or now_wita().strftime("%Y-%m")
    selected_week = week.strip() or "bulanan"
    date_from, date_to = peserta_report_range(selected_month, selected_week)
    rows, _ = await build_peserta_attendance_rows(date_from, date_to)
    term = q.strip().casefold()
    result = list(rows.values())
    if term:
        result = [row for row in result if term in row["name"].casefold()]
    now = now_wita()
    periode = await db.kegiatans.find(
        {"date": {"$gte": date_from, "$lte": date_to}}).to_list(5000)
    total_pertemuan = len([mt for mt in group_pertemuan(periode)
                           if any(kegiatan_sudah_berlangsung(d, now) for d in mt["docs"])])
    return {
        "month": selected_month, "week": selected_week,
        "date_from": date_from, "date_to": date_to,
        "total_pertemuan": total_pertemuan,
        "rows": result,
    }


@api_router.get("/admin/laporan/peserta/{user_id}")
async def admin_laporan_peserta_detail(user_id: str, admin: dict = Depends(require_staff),
                                       month: str = "", week: str = "bulanan"):
    return await build_peserta_report_detail(user_id, month, week)


async def build_peserta_report_detail(user_id: str, month: str, week: str) -> dict:
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan")
    participant = await db.users.find_one({"_id": ObjectId(user_id), **PESERTA_QUERY})
    if not participant:
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan")

    selected_month = month.strip() or now_wita().strftime("%Y-%m")
    week_value = week.strip() or "bulanan"
    date_from, date_to = peserta_report_range(selected_month, week_value)
    selected_rows, activities = await build_peserta_attendance_rows(
        date_from, date_to, user_id)
    selected = selected_rows[user_id]

    today = now_wita().date()
    current_month = today.replace(day=1)
    first_history_month = current_month.replace(day=1)
    for _ in range(5):
        first_history_month = (first_history_month.replace(day=1) - timedelta(days=1)).replace(day=1)
    history_from = first_history_month.strftime("%Y-%m-%d")
    history_to = today.strftime("%Y-%m-%d")
    history_rows, _ = await build_peserta_attendance_rows(
        history_from, history_to, group_by_month=True)
    monthly_totals = history_rows[user_id].get("by_month", {})

    monthly_history = []
    month_start = first_history_month
    for offset in range(6):
        month_key = month_start.strftime("%Y-%m")
        month_row = monthly_totals.get(month_key, {
            "hadir": 0, "izin": 0, "sakit": 0, "alpha": 0,
            "belum_diabsen": 0, "total_pertemuan": 0, "ratio": 0.0,
        })
        month_row["month"] = month_key
        month_row["label"] = BULAN_ID[month_start.month - 1]
        # Bulan tanpa pertemuan berlangsung = "Belum ada data" (bukan 0%).
        month_row["ada_data"] = month_row["total_pertemuan"] > 0
        monthly_history.append(month_row)
        month_start = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)

    total_six_months = {
        key: sum(row[key] for row in monthly_history)
        for key in ("hadir", "izin", "sakit", "alpha", "belum_diabsen", "total_pertemuan")
    }
    total_six_months["ratio"] = (
        round(total_six_months["hadir"] / total_six_months["total_pertemuan"] * 100, 1)
        if total_six_months["total_pertemuan"] else 0.0
    )
    total_six_months["bulan_ada_data"] = len([r for r in monthly_history if r["ada_data"]])
    return {
        "participant": {
            "id": user_id, "name": participant.get("name") or "Peserta",
        },
        "month": selected_month, "week": week_value,
        "date_from": date_from, "date_to": date_to,
        "summary": selected,
        "six_months": {"summary": total_six_months, "months": monthly_history},
        "activities": activities,
    }


@api_router.post("/admin/laporan/peserta/{user_id}/share")
async def share_peserta_report(user_id: str, request: Request,
                               month: str = "", week: str = "bulanan",
                               staff: dict = Depends(require_staff)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan")
    participant = await db.users.find_one({"_id": ObjectId(user_id), **PESERTA_QUERY})
    if not participant:
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan")
    selected_month = month.strip() or now_wita().strftime("%Y-%m")
    week_value = week.strip() or "bulanan"
    date_from, date_to = peserta_report_range(selected_month, week_value)
    token = secrets.token_urlsafe(24)
    created_at = datetime.now(timezone.utc)
    expires_at = (created_at + timedelta(days=30)).isoformat()
    await db.peserta_report_links.insert_one({
        "_id": token,
        "user_id": user_id,
        "month": selected_month,
        "week": week_value,
        "created_by": str(staff["_id"]),
        "created_at": created_at.isoformat(),
        "expires_at": expires_at,
    })
    await log_activity(
        staff, "bagikan_laporan_peserta",
        f"Membagikan laporan peserta {participant.get('name') or 'Peserta'} untuk {selected_month}",
    )
    return {
        "link": f"{resolve_base_url(request)}/laporan-peserta/{token}",
        "expires_at": expires_at,
        "name": participant.get("name") or "Peserta",
        "month": selected_month,
        "week": week_value,
        "date_from": date_from,
        "date_to": date_to,
    }


class ShareManyInput(BaseModel):
    user_ids: List[str] = Field(default_factory=list)
    month: str = ""
    week: str = "bulanan"


@api_router.post("/admin/laporan/peserta/share-banyak")
async def share_many_peserta_reports(body: ShareManyInput, request: Request,
                                     staff: dict = Depends(require_staff)):
    """Buat satu tautan laporan untuk setiap peserta terpilih (maks. 200)."""
    ids = [uid for uid in (body.user_ids or []) if ObjectId.is_valid(uid)][:200]
    if not ids:
        raise HTTPException(status_code=400, detail="Pilih minimal satu peserta")
    selected_month = (body.month or "").strip() or now_wita().strftime("%Y-%m")
    week_value = (body.week or "bulanan").strip() or "bulanan"
    created_at = datetime.now(timezone.utc)
    expires_at = (created_at + timedelta(days=30)).isoformat()
    base = resolve_base_url(request)

    users = await db.users.find(
        {"_id": {"$in": [ObjectId(uid) for uid in ids]}, **PESERTA_QUERY},
        {"name": 1},
    ).to_list(len(ids))
    by_id = {str(u["_id"]): (u.get("name") or "Peserta") for u in users}

    links = []
    for uid in ids:
        if uid not in by_id:
            continue
        token = secrets.token_urlsafe(24)
        await db.peserta_report_links.insert_one({
            "_id": token,
            "user_id": uid,
            "month": selected_month,
            "week": week_value,
            "created_by": str(staff["_id"]),
            "created_at": created_at.isoformat(),
            "expires_at": expires_at,
        })
        links.append({
            "user_id": uid,
            "name": by_id[uid],
            "link": f"{base}/laporan-peserta/{token}",
        })

    if not links:
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan")

    await log_activity(
        staff, "bagikan_laporan_peserta_banyak",
        f"Membagikan {len(links)} tautan laporan peserta untuk {selected_month}",
    )
    return {
        "links": links,
        "expires_at": expires_at,
        "month": selected_month,
        "week": week_value,
    }


@api_router.get("/laporan-peserta/{token}")
async def public_peserta_report(token: str):
    share = await db.peserta_report_links.find_one({"_id": token})
    if not share:
        raise HTTPException(status_code=404, detail="Tautan laporan peserta tidak ditemukan")
    if is_expired_iso(share.get("expires_at")):
        raise HTTPException(status_code=410, detail="Tautan laporan peserta sudah kedaluwarsa")
    report = await build_peserta_report_detail(
        share["user_id"], share["month"], share["week"])
    return {
        "participant": {"name": report["participant"]["name"]},
        "month": report["month"],
        "week": report["week"],
        "date_from": report["date_from"],
        "date_to": report["date_to"],
        "summary": {
            key: value for key, value in report["summary"].items()
            if key not in ("user_id", "name")
        },
        "six_months": report["six_months"],
        "activities": [
            {key: value for key, value in activity.items() if key != "id"}
            for activity in report["activities"]
        ],
        "expires_at": share["expires_at"],
    }


@api_router.get("/staff/rekap-harian")
async def rekap_harian(date: Optional[str] = None, staff: dict = Depends(require_staff)):
    return await build_rekap_harian(date)


async def _tanggal_kegiatan_terdekat(d: str) -> Optional[str]:
    """Tanggal kegiatan terdekat dari `d` (dua arah, selisih hari terkecil).

    Bila selisihnya sama, pilih yang sudah lewat.
    """
    try:
        base = datetime.strptime(d, "%Y-%m-%d").date()
    except Exception:
        return None
    dates = await db.kegiatans.distinct("date")
    best = None
    for value in dates:
        try:
            cur = datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
        except Exception:
            continue
        diff = abs((cur - base).days)
        if diff == 0:
            continue
        key = (diff, 0 if cur < base else 1)
        if best is None or key < best[0]:
            best = (key, cur.strftime("%Y-%m-%d"))
    return best[1] if best else None


async def build_rekap_harian(date: Optional[str] = None) -> dict:
    """FASE 17 — Rekap absen HARIAN: rincian tiap sesi + status tiap peserta pada 1 tanggal."""
    d = (date or now_wita().strftime("%Y-%m-%d")).strip()
    docs = await db.kegiatans.find({"date": d}).sort("start_time", 1).to_list(200)
    peserta = await db.users.find(PESERTA_QUERY).sort("name", 1).to_list(10000)
    kelompoks = await db.kelompoks.find().to_list(500)
    kmap = {k["_id"]: k.get("name") for k in kelompoks}

    if not docs:
        return {"date": d, "total_sesi": 0, "sesi": [], "rows": [],
                "terdekat": await _tanggal_kegiatan_terdekat(d),
                "summary": {"peserta": 0, "hadir": 0, "izin": 0, "sakit": 0,
                            "alpha": 0, "belum_diabsen": 0, "ratio": 0.0},
                "gender": {}, "kegiatan": []}

    absens = await db.absensis.find(
        {"kegiatan_id": {"$in": [k["_id"] for k in docs]}}).to_list(100000)
    status_by = {(a["kegiatan_id"], a["user_id"]): a.get("status") for a in absens}
    reason_by = {(a["kegiatan_id"], a["user_id"]): (a.get("reason") or a.get("note"))
                 for a in absens}
    arrival_by = {(a["kegiatan_id"], a["user_id"]): a.get("arrival_time") for a in absens}
    elig = {k["_id"]: {str(p["_id"]) for p in filter_peserta_for_kegiatan(k, peserta)} for k in docs}

    # Urutkan kegiatan hari itu menurut jam mulai (SATU ORANG DIHITUNG SEKALI).
    docs_sorted = sorted(docs, key=lambda x: (x.get("start_time") or "", x.get("session_index") or 0))
    sudah_hadir: set = set()          # peserta yang sudah dihitung hadir di kegiatan sebelumnya
    hadir_di: dict = {}               # peserta_id -> label kegiatan tempat ia dihitung hadir
    sesi_out = []
    _now = now_wita()
    for k in docs_sorted:
        ids = elig[k["_id"]]
        berlangsung = kegiatan_sudah_berlangsung(k, _now)
        # Pengajar yang dikecualikan kegiatan ini tidak dihitung sebagai wajib,
        # tetapi tetap dihitung bila punya status.
        pengajar_keg = pengajar_dikecualikan(k, peserta)
        # Penyebut kartu: kegiatan pertama = semua peserta; berikutnya = yang belum hadir sebelumnya.
        penyebut = {pid for pid in ids
                    if pid not in sudah_hadir
                    and (pid not in pengajar_keg or (k["_id"], pid) in status_by)}
        session_absens = [
            {"user_id": pid, "status": status_by[(k["_id"], pid)]}
            for pid in penyebut if (k["_id"], pid) in status_by
        ]
        counts = compute_counts(
            [p for p in peserta if str(p["_id"]) in penyebut], session_absens, kegiatan=k)
        hadir_ids = {pid for pid in penyebut
                     if status_by.get((k["_id"], pid)) == "hadir"}
        for pid in hadir_ids:
            sudah_hadir.add(pid)
            hadir_di.setdefault(pid, k.get("session_label") or k.get("name"))
        sesi_out.append({
            "id": k["_id"], "label": k.get("session_label") or "Kegiatan",
            "name": k.get("base_name") or k.get("name"),
            "start_time": k.get("start_time"), "end_time": k.get("end_time"),
            "teacher": k.get("teacher"), "material": k.get("material"),
            "location": k.get("location"), "status": k.get("status", "open"),
            "required": bool(k.get("session_required", True)),
            "berlangsung": berlangsung,
            "peserta": counts["total"], "hadir": counts["hadir"], "izin": counts["izin"],
            "sakit": counts["sakit"], "alpha": counts["alpha"],
            "belum_diabsen": counts["belum_diabsen"], "ratio": counts["ratio"],
            "sebelumnya_hadir": len(ids) - len(penyebut) - len(pengajar_keg & ids),
            "pengajar_dikecualikan": len(pengajar_keg & ids),
        })

    # Status per peserta untuk HARI ITU (satu status saja).
    peserta_hari = {}
    for k in docs_sorted:
        pengajar_keg = pengajar_dikecualikan(k, peserta)
        for pid in elig[k["_id"]]:
            # Pengajar yang dikecualikan hanya muncul bila punya status.
            if pid in pengajar_keg and (k["_id"], pid) not in status_by:
                continue
            peserta_hari.setdefault(pid, []).append(
                (k, status_by.get((k["_id"], pid)), arrival_by.get((k["_id"], pid))))

    rows = []
    for p in peserta:
        pid = str(p["_id"])
        catatan = peserta_hari.get(pid)
        if not catatan:
            continue
        statuses = [st for _, st, _ in catatan]
        if pid in sudah_hadir:
            hari_status = "hadir"
        elif "izin" in statuses:
            hari_status = "izin"
        elif "sakit" in statuses:
            hari_status = "sakit"
        elif any(st == "alpha" for st in statuses):
            hari_status = "alpha"
        else:
            hari_status = "belum_diabsen"
        detail = []
        for k, st, arr in catatan:
            detail.append({
                "label": k.get("session_label") or "Kegiatan",
                "start_time": k.get("start_time"), "end_time": k.get("end_time"),
                "required": session_requires_participant(k, pid),
                "status": st or "belum_diabsen",
                "reason": reason_by.get((k["_id"], pid)),
                "arrival_time": arr,
            })
        rows.append({
            "user_id": pid, "name": p.get("name"), "gender": _derive_gender(p),
            "kelompok_name": kmap.get(p.get("kelompok_id")),
            "status_hari": hari_status,
            "hadir_di": hadir_di.get(pid),
            "detail": detail,
        })
    rows.sort(key=lambda x: (x["name"] or "").lower())

    # Ringkasan hari itu: Hadir + Izin + Sakit + Alpha = peserta unik.
    unik = len(rows)
    hadir_hari = sum(1 for r in rows if r["status_hari"] == "hadir")
    izin_hari = sum(1 for r in rows if r["status_hari"] == "izin")
    sakit_hari = sum(1 for r in rows if r["status_hari"] == "sakit")
    alpha_hari = sum(1 for r in rows if r["status_hari"] == "alpha")
    belum_hari = sum(1 for r in rows if r["status_hari"] == "belum_diabsen")
    gender_out = {}
    for g in ("L", "P"):
        grp = [r for r in rows if r["gender"] == g]
        ghadir = sum(1 for r in grp if r["status_hari"] == "hadir")
        gender_out[g] = {
            "peserta": len(grp), "hadir": ghadir,
            "izin": sum(1 for r in grp if r["status_hari"] == "izin"),
            "sakit": sum(1 for r in grp if r["status_hari"] == "sakit"),
            "alpha": sum(1 for r in grp if r["status_hari"] == "alpha"),
            "belum_diabsen": sum(1 for r in grp if r["status_hari"] == "belum_diabsen"),
            "ratio": round((ghadir / len(grp)) * 100, 1) if grp else 0.0,
        }

    return {
        "date": d,
        "label": _tanggal_indo(d),
        "total_sesi": len(sesi_out),
        "kegiatan": sorted({s["name"] for s in sesi_out}),
        "sesi": sesi_out,
        "rows": rows,
        "summary": {
            "peserta": unik, "slot": unik, "hadir": hadir_hari,
            "izin": izin_hari, "sakit": sakit_hari, "alpha": alpha_hari,
            "belum_diabsen": belum_hari,
            "ratio": round((hadir_hari / unik) * 100, 1) if unik else 0.0,
            "hadir_hari": hadir_hari, "izin_hari": izin_hari,
            "sakit_hari": sakit_hari, "alpha_hari": alpha_hari,
            "belum_diabsen_hari": belum_hari,
        },
        "gender": gender_out,
    }


@api_router.get("/staff/rekap-bulanan")
async def rekap_bulanan(month: Optional[str] = None, staff: dict = Depends(require_staff)):
    return await build_rekap_bulanan(month, include_participants=True)


REKAP_LINK_DAYS = 7


def rekap_link_valid(doc: dict) -> bool:
    """Tautan rekap bulanan berlaku 7 hari sejak dibuat (WITA).

    Tautan lama tanpa `expires_at` dianggap kedaluwarsa.
    """
    exp = doc.get("expires_at")
    if not exp:
        return False
    try:
        return datetime.fromisoformat(exp) > now_wita()
    except Exception:
        return False


async def build_rekap_bulanan(month: Optional[str] = None, include_participants: bool = False) -> dict:
    """FASE 13 — Rekap absen BULANAN per peserta.

    1 pertemuan = 1 hari kegiatan (semua sesi hari itu dihitung SEKALI); hadir di
    salah satu sesi wajib = hadir pada pertemuan tersebut. Sesi yang ditandai
    "opsional" tidak menambah kewajiban pertemuan.
    """
    now = now_wita()
    month = month or now.strftime("%Y-%m")
    try:
        y, m = (int(x) for x in month.split("-"))
        start = datetime(y, m, 1, tzinfo=WITA)
    except Exception:
        raise HTTPException(status_code=400, detail="Format bulan harus YYYY-MM")
    nxt = datetime(y + 1, 1, 1, tzinfo=WITA) if m == 12 else datetime(y, m + 1, 1, tzinfo=WITA)
    date_from = start.strftime("%Y-%m-%d")
    date_to = (nxt - timedelta(days=1)).strftime("%Y-%m-%d")

    kegiatans_all = await db.kegiatans.find({"date": {"$gte": date_from, "$lte": date_to}}).sort("date", 1).to_list(3000)
    # Hanya kegiatan yang SUDAH BERLANGSUNG (waktu mulai <= sekarang WITA) yang
    # dihitung sebagai pertemuan/jadwal/persentase. Kegiatan yang mulai nanti
    # hari ini tetap tampil di kalender sebagai "belum berlangsung".
    _now = now_wita()
    kegiatans = [k for k in kegiatans_all if kegiatan_sudah_berlangsung(k, _now)]
    tanggal_info = {}
    for k in kegiatans_all:
        d = k.get("date")
        if not d:
            continue
        slot = tanggal_info.setdefault(d, {"date": d, "berlangsung": False})
        if kegiatan_sudah_berlangsung(k, _now):
            slot["berlangsung"] = True
    peserta = await db.users.find(PESERTA_QUERY).sort("name", 1).to_list(10000)
    kelompoks = await db.kelompoks.find().to_list(500)
    kmap = {k["_id"]: k.get("name") for k in kelompoks}
    keg_ids = [k["_id"] for k in kegiatans]
    absens = await db.absensis.find({"kegiatan_id": {"$in": keg_ids}}).to_list(200000) if keg_ids else []
    status_by = {(a["kegiatan_id"], a["user_id"]): a.get("status") for a in absens}
    reason_by = {(a["kegiatan_id"], a["user_id"]): (a.get("reason") or a.get("note"))
                 for a in absens}
    elig_by_doc = {k["_id"]: {str(p["_id"]) for p in filter_peserta_for_kegiatan(k, peserta)}
                   for k in kegiatans}

    recurring_group_ids = list({k.get("recurring_group_id") for k in kegiatans
                                 if k.get("recurring_group_id")})
    previously_attended: dict[str, set[str]] = {}
    if recurring_group_ids:
        earlier_kegiatans = await db.kegiatans.find({
            "recurring_group_id": {"$in": recurring_group_ids},
            "date": {"$lt": date_from},
        }).to_list(3000)
        earlier_by_id = {k["_id"]: k.get("recurring_group_id") for k in earlier_kegiatans}
        earlier_ids = list(earlier_by_id)
        earlier_absens = await db.absensis.find({
            "kegiatan_id": {"$in": earlier_ids},
            "status": "hadir",
        }).to_list(200000) if earlier_ids else []
        for attendance in earlier_absens:
            group_id = earlier_by_id.get(attendance.get("kegiatan_id"))
            if group_id:
                previously_attended.setdefault(group_id, set()).add(attendance.get("user_id"))

    meetings: dict = {}
    for k in kegiatans:
        key = k.get("session_group_id") or k["_id"]
        mt = meetings.setdefault(key, {"date": k.get("date"),
                                       "name": k.get("base_name") or k.get("name"),
                                       "type": k.get("type", "rutin"),
                                       "recurring_group_id": k.get("recurring_group_id"),
                                       "docs": []})
        mt["docs"].append(k)

    tally = {str(p["_id"]): {"user_id": str(p["_id"]), "name": p.get("name"),
                             "gender": _derive_gender(p),
                             "kelompok_name": kmap.get(p.get("kelompok_id")),
                             "account_status": p.get("status", "active"),
                             "pertemuan": 0, "hadir": 0, "izin": 0, "sakit": 0,
                             "alpha": 0, "belum_diabsen": 0,
                             "last_date": None} for p in peserta}

    meeting_rows = []
    sesi_summary: dict = {}   # label sesi -> ringkasan sebulan
    for mt in sorted(meetings.values(), key=lambda x: x["date"] or ""):
        recurring_group_id = mt.get("recurring_group_id")
        recurrence_skip = set(previously_attended.get(recurring_group_id, set()))
        n_h = n_i = n_s = n_a = n_pending = 0
        meeting_participants = []
        for pid, t in tally.items():
            if pid in recurrence_skip:
                continue
            docs_p = [
                d for d in mt["docs"]
                if pid in elig_by_doc[d["_id"]] and (
                    session_requires_participant(d, pid)
                    or status_by.get((d["_id"], pid)) in ABSEN_STATUS
                )
            ]
            if not docs_p:
                continue
            t["pertemuan"] += 1
            sts = [status_by.get((d["_id"], pid), "belum_diabsen") for d in docs_p]
            if "hadir" in sts:
                attendance_status = "hadir"
                t["hadir"] += 1
                t["last_date"] = mt["date"]
                n_h += 1
                if recurring_group_id:
                    previously_attended.setdefault(recurring_group_id, set()).add(pid)
            elif "izin" in sts:
                attendance_status = "izin"
                t["izin"] += 1
                n_i += 1
            elif "sakit" in sts:
                attendance_status = "sakit"
                t["sakit"] += 1
                n_s += 1
            elif "alpha" in sts:
                attendance_status = "alpha"
                t["alpha"] += 1
                n_a += 1
            else:
                attendance_status = "belum_diabsen"
                t["belum_diabsen"] += 1
                n_pending += 1
            session_labels = list(dict.fromkeys(
                d.get("session_label")
                for d in sorted(
                    docs_p,
                    key=lambda x: (x.get("session_index") or 0, x.get("start_time") or ""),
                )
                if d.get("session_label")
                and status_by.get((d["_id"], pid), "belum_diabsen") == attendance_status
            ))
            meeting_participants.append({
                "name": t["name"],
                "status": attendance_status,
                "session_labels": session_labels,
                "reason": next((reason_by.get((d["_id"], pid)) for d in docs_p
                                if reason_by.get((d["_id"], pid))), None),
            })
        total_p = n_h + n_i + n_s + n_a + n_pending

        # Rincian tiap sesi pada pertemuan ini (mis. Pagi / Sore / Malam)
        sesi_rows = []
        for d in sorted(mt["docs"], key=lambda x: (x.get("session_index") or 0, x.get("start_time") or "")):
            eids = elig_by_doc[d["_id"]] - recurrence_skip
            counted_ids = {
                pid for pid in eids
                if session_requires_participant(d, pid)
                or status_by.get((d["_id"], pid)) in ABSEN_STATUS
            }
            sh = sum(1 for pid in counted_ids if status_by.get((d["_id"], pid)) == "hadir")
            si = sum(1 for pid in counted_ids if status_by.get((d["_id"], pid)) == "izin")
            ss = sum(1 for pid in counted_ids if status_by.get((d["_id"], pid)) == "sakit")
            sa = sum(1 for pid in counted_ids if status_by.get((d["_id"], pid)) == "alpha")
            sp = len(counted_ids) - sh - si - ss - sa
            label = d.get("session_label") or "Sesi tunggal"
            sesi_rows.append({
                "label": label, "start_time": d.get("start_time"), "end_time": d.get("end_time"),
                "required": bool(d.get("session_required", True)),
                "teacher": d.get("teacher"), "material": d.get("material"),
                "peserta": len(counted_ids), "hadir": sh, "izin": si, "sakit": ss,
                "alpha": sa, "belum_diabsen": sp,
                "ratio": round((sh / len(counted_ids)) * 100, 1) if counted_ids else 0.0,
            })
            agg = sesi_summary.setdefault(label, {"label": label, "pertemuan": 0, "hadir": 0,
                                                  "peserta": 0, "izin": 0, "sakit": 0, "alpha": 0,
                                                  "belum_diabsen": 0,
                                                  "required": bool(d.get("session_required", True))})
            agg["pertemuan"] += 1
            agg["hadir"] += sh
            agg["izin"] += si
            agg["sakit"] += ss
            agg["alpha"] += sa
            agg["belum_diabsen"] += sp
            agg["peserta"] += len(counted_ids)

        meeting_row = {"date": mt["date"], "name": mt["name"], "type": mt["type"],
                       "sessions": len(mt["docs"]), "peserta": total_p,
                       "hadir": n_h, "izin": n_i, "sakit": n_s,
                       "alpha": n_a, "belum_diabsen": n_pending,
                       "ratio": round((n_h / total_p) * 100, 1) if total_p else 0.0,
                       "sesi": sesi_rows}
        if include_participants:
            meeting_row["peserta_rows"] = meeting_participants
        meeting_rows.append(meeting_row)

    # Catatan musyawarah: pakai data yang SUDAH ADA (koleksi musyawarahs),
    # dicocokkan lewat tanggal. Tidak ada perubahan skema.
    musy = await db.musyawarahs.find(
        {"date": {"$gte": date_from, "$lte": date_to}}).to_list(500)
    catatan_by_date = {}
    for catatan in musy:
        text = (catatan.get("content") or "").strip()
        if text and catatan.get("date"):
            catatan_by_date.setdefault(catatan["date"], text)
    for row in meeting_rows:
        note = catatan_by_date.get(row["date"])
        if note:
            row["catatan"] = note

    per_sesi = sorted(
        [{**v, "ratio": round((v["hadir"] / v["peserta"]) * 100, 1) if v["peserta"] else 0.0}
         for v in sesi_summary.values()],
        key=lambda x: (-x["pertemuan"], x["label"]))

    rows = []
    for t in tally.values():
        ratio = round((t["hadir"] / t["pertemuan"]) * 100, 1) if t["pertemuan"] else 0.0
        rows.append({**t, "ratio": ratio})
    rows.sort(key=lambda x: (x["ratio"], -x["pertemuan"], (x["name"] or "").lower()))

    aktif = [r for r in rows if r["pertemuan"] > 0]
    rajin = sum(1 for r in aktif if r["ratio"] >= 80)
    cukup = sum(1 for r in aktif if 50 <= r["ratio"] < 80)
    jarang = sum(1 for r in aktif if r["ratio"] < 50)
    belum = sum(1 for r in aktif if r["hadir"] == 0)

    # Pisah Laki-laki / Perempuan — memakai METRIK YANG SAMA dengan rata-rata
    # hadir (rata-rata persen per peserta), sehingga ring gabungan selalu sama
    # dengan rata-rata tertimbang L dan P menurut jumlah peserta yang punya
    # pertemuan. Sebelumnya L/P memakai rasio tertimbang slot sehingga tidak
    # pernah cocok dengan angka gabungan.
    gender_out = {}
    for g in ("L", "P"):
        grp = [r for r in aktif if r["gender"] == g]
        gender_out[g] = {
            # `peserta` = peserta yang punya pertemuan bulan ini; inilah bobot
            # yang dipakai rata-rata gabungan (sama dengan dasar rata-rata hadir).
            "peserta": len(grp),
            "peserta_total": len([r for r in rows if r["gender"] == g]),
            "hadir": sum(r["hadir"] for r in grp),
            "pertemuan": sum(r["pertemuan"] for r in grp),
            "izin": sum(r["izin"] for r in grp),
            "sakit": sum(r["sakit"] for r in grp),
            "alpha": sum(r["alpha"] for r in grp),
            "belum_diabsen": sum(r["belum_diabsen"] for r in grp),
            "rajin": sum(1 for r in grp if r["ratio"] >= 80),
            "jarang": sum(1 for r in grp if r["ratio"] < 50),
            "ratio": round(sum(r["ratio"] for r in grp) / len(grp), 1) if grp else 0.0,
        }

    # Bulan terakhir yang punya kegiatan (untuk tombol "Ke bulan dengan kegiatan").
    last_keg = await db.kegiatans.find_one(
        {"date": {"$lte": date_to}}, sort=[("date", -1)])
    bulan_terakhir = (last_keg or {}).get("date", "")[:7] or None

    return {
        "month": month,
        "label": f"{BULAN_ID[m - 1]} {y}",
        "date_from": date_from, "date_to": date_to,
        "total_pertemuan": len(meetings),
        "total_kegiatan": len(kegiatans),
        "total_peserta": len(rows),
        "total_peserta_aktif": len(aktif),
        "bulan_terakhir": bulan_terakhir,
        "tanggal": sorted(tanggal_info.values(), key=lambda x: x["date"]),
        "summary": {
            "rata_rata": round(sum(r["ratio"] for r in aktif) / len(aktif), 1) if aktif else 0.0,
            "rajin": rajin, "cukup": cukup, "jarang": jarang, "belum_pernah": belum,
            "hadir": sum(r["hadir"] for r in aktif),
            "izin": sum(r["izin"] for r in aktif),
            "sakit": sum(r["sakit"] for r in aktif),
            "alpha": sum(r["alpha"] for r in aktif),
            "belum_diabsen": sum(r["belum_diabsen"] for r in aktif),
        },
        "gender": gender_out,
        "per_sesi": per_sesi,
        "per_pertemuan": meeting_rows,
        "rows": rows,
    }


# ------------------------- Tautan publik Rekap Bulanan -------------------------
@api_router.post("/staff/rekap-bulanan/share")
async def share_rekap_bulanan(request: Request, month: Optional[str] = None,
                              staff: dict = Depends(require_staff)):
    """Tautan publik rekap bulanan — berlaku 7 hari sejak dibuat (WITA)."""
    month = month or now_wita().strftime("%Y-%m")
    # Setiap ketuk "Bagikan"/"Salin tautan" membuat tautan baru yang berlaku 7 hari.
    token = secrets.token_urlsafe(10)
    created = now_wita()
    await db.bulanan_links.insert_one({
        "_id": token, "month": month,
        "created_by": str(staff["_id"]), "created_by_name": staff.get("name"),
        "created_at": created.isoformat(),
        "expires_at": (created + timedelta(days=REKAP_LINK_DAYS)).isoformat()})
    link = f"{resolve_base_url(request)}/rekap-bulanan/{token}"
    data = await build_rekap_bulanan(month)
    wa_text = (
        f"Rekap {data['label']}: {data['total_pertemuan']} pertemuan, "
        f"rata-rata hadir {data['summary']['rata_rata']}%.\n\n{link}"
    )
    return {"token": token, "link": link, "month": month, "label": data["label"],
            "expires_at": (created + timedelta(days=REKAP_LINK_DAYS)).isoformat(),
            "wa_text": wa_text}


@api_router.get("/rekap-bulanan/{token}")
async def public_rekap_bulanan(token: str):
    doc = await db.bulanan_links.find_one({"_id": token})
    if not doc:
        raise HTTPException(status_code=404, detail="Tautan rekap bulanan tidak ditemukan")
    if not rekap_link_valid(doc):
        raise HTTPException(
            status_code=410,
            detail="Tautan sudah kedaluwarsa. Minta tautan baru ke pengurus.")
    return await build_rekap_bulanan(doc.get("month"), include_participants=True)


# ------------------------- Tautan publik Rekap Harian -------------------------
@api_router.post("/staff/rekap-harian/share")
async def share_rekap_harian(request: Request, date: Optional[str] = None,
                             staff: dict = Depends(require_staff)):
    """FASE 17 — tautan publik rekap harian (berlaku 7 hari, tanpa login)."""
    d = (date or now_wita().strftime("%Y-%m-%d")).strip()
    existing = await db.harian_links.find_one({"date": d})
    if existing:
        token = existing["_id"]
        if not existing.get("expires_at"):
            await db.harian_links.update_one(
                {"_id": token},
                {"$set": {"expires_at": (datetime.now(timezone.utc)
                                         + timedelta(days=SHARE_EXPIRE_DAYS)).isoformat()}})
    else:
        token = secrets.token_urlsafe(10)
        await db.harian_links.insert_one({
            "_id": token, "date": d,
            "created_by": str(staff["_id"]), "created_by_name": staff.get("name"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc)
                           + timedelta(days=SHARE_EXPIRE_DAYS)).isoformat(),
            "aktif": True, "tampilkan_jam": False})
    link = f"{resolve_base_url(request)}/rekap-harian/{token}"
    data = await build_rekap_harian(d)
    s = data["summary"]
    wa_text = (
        f"Rekap absen harian {data.get('label') or d}\n"
        f"Kegiatan: {', '.join(data.get('kegiatan') or []) or '-'}\n"
        f"Hadir {s.get('hadir', 0)} dari {s.get('peserta', 0)} orang "
        f"({s.get('ratio', 0)}%)\n"
        f"{link}"
    )
    await log_activity(staff, "bagikan_rekap_harian", f"Membagikan tautan rekap harian {d}")
    return {"token": token, "link": link, "date": d, "label": data.get("label"),
            "wa_text": wa_text}


@api_router.get("/staff/rekap-harian/share")
async def share_rekap_harian_info(request: Request, date: Optional[str] = None,
                                  staff: dict = Depends(require_staff)):
    """Info tautan rekap harian yang sudah ada (tanpa membuat baru)."""
    d = (date or now_wita().strftime("%Y-%m-%d")).strip()
    doc = await db.harian_links.find_one({"date": d})
    if not doc:
        return {"token": None, "link": None, "expires_at": None,
                "tampilkan_jam": False, "aktif": True,
                "nama": None, "tanggal": d, "kegiatan": []}
    valid = bool(doc.get("expires_at") and not is_expired_iso(doc.get("expires_at")))
    kegs = await db.kegiatans.find({"date": d}).sort("start_time", 1).to_list(50)
    return {
        "token": doc["_id"] if valid else None,
        "link": f"{resolve_base_url(request)}/rekap-harian/{doc['_id']}" if valid else None,
        "expires_at": doc.get("expires_at"),
        "tampilkan_jam": bool(doc.get("tampilkan_jam")),
        "aktif": doc.get("aktif") is not False,
        "nama": None,
        "tanggal": d,
        "kegiatan": [k.get("session_label") or k.get("name") for k in kegs],
    }


@api_router.patch("/staff/rekap-harian/share")
async def share_rekap_harian_update(body: ShareSettingInput, date: Optional[str] = None,
                                    staff: dict = Depends(require_staff)):
    d = (date or now_wita().strftime("%Y-%m-%d")).strip()
    doc = await db.harian_links.find_one({"date": d})
    if not doc:
        raise HTTPException(status_code=404, detail="Tautan belum dibuat")
    upd = {}
    if body.tampilkan_jam is not None:
        upd["tampilkan_jam"] = bool(body.tampilkan_jam)
    if body.aktif is not None:
        upd["aktif"] = bool(body.aktif)
    if upd:
        await db.harian_links.update_one({"_id": doc["_id"]}, {"$set": upd})
        await log_activity(staff, "atur_tautan_harian", f"Mengatur tautan rekap harian {d}")
    return {"ok": True, **upd}


@api_router.delete("/staff/rekap-harian/share")
async def share_rekap_harian_delete(date: Optional[str] = None,
                                    staff: dict = Depends(require_staff)):
    d = (date or now_wita().strftime("%Y-%m-%d")).strip()
    res = await db.harian_links.delete_one({"date": d})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Tautan tidak ditemukan")
    await log_activity(staff, "hapus_tautan_harian", f"Menghapus tautan rekap harian {d}")
    return {"ok": True}


@api_router.get("/rekap-harian/{token}")
async def public_rekap_harian(token: str):
    doc = await db.harian_links.find_one({"_id": token})
    if not doc:
        raise HTTPException(status_code=404, detail="Tautan rekap harian tidak ditemukan")
    if is_expired_iso(doc.get("expires_at")):
        raise HTTPException(status_code=410, detail="Tautan sudah tidak berlaku")
    if doc.get("aktif") is False:
        raise HTTPException(status_code=410, detail="Tautan sudah tidak berlaku")
    data = await build_rekap_harian(doc.get("date"))
    if not doc.get("tampilkan_jam"):
        # Server TIDAK mengirim jam sama sekali bila pengaturan mati.
        for r in data.get("rows") or []:
            for cell in r.get("detail") or []:
                cell.pop("arrival_time", None)
    data["tampilkan_jam"] = bool(doc.get("tampilkan_jam"))
    return data


async def build_laporan(date_from: str, date_to: str) -> dict:
    if not date_from or not date_to:
        now = now_wita()
        first = now.replace(day=1).strftime("%Y-%m-%d")
        date_from = date_from or first
        date_to = date_to or now.strftime("%Y-%m-%d")
    query = {"date": {"$gte": date_from, "$lte": date_to}}
    kegiatans = await db.kegiatans.find(query).sort([("date", 1)]).to_list(2000)
    keg_ids = [k["_id"] for k in kegiatans]
    peserta = await db.users.find(PESERTA_QUERY).to_list(10000)
    total_peserta = len(peserta)
    absens = await db.absensis.find({"kegiatan_id": {"$in": keg_ids}}).to_list(100000) if keg_ids else []
    guests = await db.guest_absens.find({"kegiatan_id": {"$in": keg_ids}}).to_list(20000) if keg_ids else []
    guest_by_keg = {}
    for g in guests:
        guest_by_keg[g["kegiatan_id"]] = guest_by_keg.get(g["kegiatan_id"], 0) + 1

    # per-user tally (FASE 8: hanya dihitung untuk kegiatan yang relevan bagi peserta)
    tally = {str(p["_id"]): {"name": p.get("name"), "gender": _derive_gender(p),
                             "account_status": p.get("status", "active"),
                             "hadir": 0, "izin": 0, "sakit": 0, "alpha": 0,
                             "belum_diabsen": 0, "kegiatan": 0} for p in peserta}
    per_keg_status = {}  # kegiatan_id -> {uid: status}
    for a in absens:
        per_keg_status.setdefault(a["kegiatan_id"], {})[a["user_id"]] = a["status"]

    total_hadir = total_izin = total_sakit = total_alpha = total_pending = 0
    total_slot = 0
    gender_hadir = {"L": 0, "P": 0}
    rows = []
    for k in kegiatans:
        statuses = per_keg_status.get(k["_id"], {})
        eligible = filter_peserta_for_kegiatan(k, peserta)
        eligible_ids = {str(p["_id"]) for p in eligible}
        tamu = guest_by_keg.get(k["_id"], 0)
        event_absens = [
            {"user_id": uid, "status": status}
            for uid, status in statuses.items() if uid in eligible_ids
        ]
        counts = compute_counts(eligible, event_absens, tamu, kegiatan=k)
        n_slot = counts["total"]
        h, iz, si = counts["hadir"], counts["izin"], counts["sakit"]
        al, pending = counts["alpha"], counts["belum_diabsen"]
        total_hadir += h
        total_izin += iz
        total_sakit += si
        total_alpha += al
        total_pending += pending
        total_slot += n_slot
        rows.append({"id": k["_id"], "name": k.get("name"), "date": k.get("date"),
                     "type": k.get("type"), "audience": k.get("audience", "reguler"),
                     "gender_filter": k.get("gender_filter", "semua"),
                     "guests": tamu, "peserta": n_slot,
                     "hadir": h, "izin": iz, "sakit": si, "alpha": al,
                     "belum_diabsen": pending,
                     "ratio": round((h / n_slot) * 100, 1) if n_slot else 0.0})
        for p in eligible:
            uid = str(p["_id"])
            st = statuses.get(uid)
            if not session_requires_participant(k, uid) and st not in ABSEN_STATUS:
                continue
            st = st if st in ABSEN_STATUS else "belum_diabsen"
            tally[uid][st] += 1
            tally[uid]["kegiatan"] += 1
            if st == "hadir":
                g = _derive_gender(p)
                if g in gender_hadir:
                    gender_hadir[g] += 1

    tvals = list(tally.values())
    n_keg = len(kegiatans)
    keg_map = {k["_id"]: k for k in kegiatans}
    # Daftar TAMU terpisah supaya mudah dibedakan dari peserta terdaftar
    guest_rows = sorted(
        [{"name": g.get("name"),
          "kegiatan_id": g.get("kegiatan_id"),
          "kegiatan": (keg_map.get(g.get("kegiatan_id")) or {}).get("name"),
          "date": (keg_map.get(g.get("kegiatan_id")) or {}).get("date"),
          "arrival_time": g.get("arrival_time"),
          "added_by": g.get("added_by")} for g in guests],
        key=lambda x: (x["date"] or "", (x["name"] or "").lower()))
    per_peserta = sorted(
        [{**v, "ratio": round((v["hadir"] / v["kegiatan"]) * 100, 1) if v["kegiatan"] else 0.0}
         for v in tvals],
        key=lambda x: (x["name"] or "").lower())
    return {
        "date_from": date_from, "date_to": date_to,
        "total_kegiatan": n_keg, "total_peserta": total_peserta,
        "summary": {
            "hadir": total_hadir, "izin": total_izin, "sakit": total_sakit,
            "alpha": total_alpha, "belum_diabsen": total_pending,
            "ratio": round((total_hadir / total_slot) * 100, 1) if total_slot else 0.0,
        },
        "gender_hadir": gender_hadir,
        "total_tamu": len(guest_rows),
        "tamu": guest_rows,
        "per_kegiatan": rows,
        "per_peserta": per_peserta,
    }


# ------------------------- Tautan Laporan Publik (permanen) -------------------------
class LaporanShareInput(BaseModel):
    date_from: str
    date_to: str
    mode: Optional[str] = "custom"  # harian | bulanan | custom


def _laporan_title(mode: str, date_from: str, date_to: str) -> str:
    if mode == "harian":
        return "Laporan Kehadiran Harian"
    if mode == "bulanan":
        return "Laporan Kehadiran Bulanan"
    return "Laporan Kehadiran"


@api_router.post("/admin/laporan/share")
async def share_laporan(body: LaporanShareInput, request: Request,
                        admin: dict = Depends(require_staff)):
    """Buat tautan laporan PUBLIK (permanen, tanpa login).

    Token dipakai ulang untuk rentang tanggal + mode yang sama, sehingga tautan
    yang sudah dibagikan tetap sah dan tidak menumpuk token baru.
    """
    date_from = (body.date_from or "").strip()
    date_to = (body.date_to or "").strip()
    mode = (body.mode or "custom").strip().lower()
    if mode not in ("harian", "bulanan", "custom"):
        mode = "custom"
    if not date_from or not date_to:
        raise HTTPException(status_code=400, detail="Rentang tanggal laporan wajib diisi.")
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="Tanggal 'Dari' tidak boleh melebihi tanggal 'Sampai'.")

    existing = await db.laporan_links.find_one(
        {"date_from": date_from, "date_to": date_to, "mode": mode})
    if existing:
        token = existing["_id"]
    else:
        token = secrets.token_urlsafe(9)
        await db.laporan_links.insert_one({
            "_id": token, "date_from": date_from, "date_to": date_to, "mode": mode,
            "title": _laporan_title(mode, date_from, date_to),
            "created_by": admin.get("name"), "created_by_id": str(admin["_id"]),
            "created_at": now_wita().isoformat(),
        })
        await log_activity(admin, "share_laporan",
                           f"Membuat tautan laporan publik ({mode}) {date_from} s/d {date_to}")
    link = f"{resolve_base_url(request)}/laporan/{token}"
    title = _laporan_title(mode, date_from, date_to)
    return {"token": token, "link": link, "mode": mode, "title": title,
            # Fase 7 — template WhatsApp BAKU
            "wa_text": wa_template_laporan(title.lower(), link),
            "date_from": date_from, "date_to": date_to}


@api_router.get("/laporan/{token}")
async def public_laporan(token: str):
    """Halaman laporan publik — bisa dibuka siapa pun TANPA login (tautan permanen)."""
    doc = await db.laporan_links.find_one({"_id": token})
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Mohon maaf, tautan laporan ini tidak dikenali.")
    data = await build_laporan(doc.get("date_from", ""), doc.get("date_to", ""))
    data["mode"] = doc.get("mode", "custom")
    data["title"] = doc.get("title") or _laporan_title(
        doc.get("mode", "custom"), data["date_from"], data["date_to"])
    data["created_by"] = doc.get("created_by")
    data["created_at"] = doc.get("created_at")
    return data


@api_router.get("/admin/laporan")
async def admin_laporan(admin: dict = Depends(require_staff), date_from: str = "", date_to: str = ""):
    return await build_laporan(date_from.strip(), date_to.strip())


@api_router.get("/admin/laporan/export")
async def admin_laporan_export(admin: dict = Depends(require_staff),
                               date_from: str = "", date_to: str = "", format: str = "excel"):
    data = await build_laporan(date_from.strip(), date_to.strip())
    fname_base = f"laporan_kehadiran_{data['date_from']}_sd_{data['date_to']}"
    if format == "pdf":
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
        from reportlab.lib.styles import getSampleStyleSheet
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.2 * cm, bottomMargin=1.5 * cm)
        styles = getSampleStyleSheet()
        elems = []
        logo_path = os.path.join(os.path.dirname(__file__), "assets", "logo.png")
        if os.path.exists(logo_path):
            _lw = 3.6 * cm
            logo_img = RLImage(logo_path, width=_lw, height=_lw * 452 / 467)
            logo_img.hAlign = "CENTER"
            elems.append(logo_img)
            elems.append(Spacer(1, 8))
        elems += [Paragraph("Laporan Kehadiran — E-KERTALANGU", styles["Title"]),
                 Paragraph(f"Periode: {data['date_from']} s/d {data['date_to']}", styles["Normal"]),
                 Paragraph(f"Total Kegiatan: {data['total_kegiatan']} · Total Peserta: {data['total_peserta']} · "
                           f"Kehadiran: {data['summary']['ratio']}%", styles["Normal"]),
                 Spacer(1, 12)]
        tdata = [["Tanggal", "Kegiatan", "Hadir", "Izin", "Sakit", "Alpha", "%"]]
        for r in data["per_kegiatan"]:
            tdata.append([r["date"], r["name"], r["hadir"], r["izin"], r["sakit"],
                          r["alpha"], f"{r['ratio']}%"])
        t = Table(tdata, repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111114")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F2F5F2")]),
        ]))
        elems.append(t)

        # Daftar TAMU terpisah (bukan peserta terdaftar)
        elems.append(Spacer(1, 16))
        elems.append(Paragraph(
            f"Daftar Tamu (bukan peserta terdaftar) — {data.get('total_tamu', 0)} orang",
            styles["Heading3"]))
        if data.get("tamu"):
            gdata = [["Tanggal", "Kegiatan", "Nama Tamu", "Jam Hadir"]]
            for g in data["tamu"]:
                gdata.append([g.get("date") or "-", g.get("kegiatan") or "-",
                              g.get("name") or "-",
                              (g.get("arrival_time") or "")[11:16] or "-"])
            gt = Table(gdata, repeatRows=1)
            gt.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D97706")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CCCCCC")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#FEF7EC")]),
            ]))
            elems.append(gt)
        else:
            elems.append(Paragraph("Tidak ada tamu pada periode ini.", styles["Normal"]))
        doc.build(elems)
        buf.seek(0)
        return StreamingResponse(buf, media_type="application/pdf",
                                 headers={"Content-Disposition": f'attachment; filename="{fname_base}.pdf"'})

    # default: Excel
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Per Kegiatan"
    ws.append(["Tanggal", "Kegiatan", "Jenis", "Hadir", "Izin", "Sakit", "Alpha", "Belum Diabsen", "Kehadiran %"])
    for r in data["per_kegiatan"]:
        ws.append([r["date"], r["name"], r["type"], r["hadir"], r["izin"], r["sakit"],
                   r["alpha"], r["belum_diabsen"], r["ratio"]])
    ws2 = wb.create_sheet("Ringkasan")
    ws2.append(["Periode", f"{data['date_from']} s/d {data['date_to']}"])
    ws2.append(["Total Kegiatan", data["total_kegiatan"]])
    ws2.append(["Total Peserta", data["total_peserta"]])
    ws2.append(["Hadir", data["summary"]["hadir"]])
    ws2.append(["Izin", data["summary"]["izin"]])
    ws2.append(["Sakit", data["summary"]["sakit"]])
    ws2.append(["Alpha", data["summary"]["alpha"]])
    ws2.append(["Belum Diabsen", data["summary"]["belum_diabsen"]])
    ws2.append(["Kehadiran %", data["summary"]["ratio"]])
    ws2.append(["Hadir L", data["gender_hadir"]["L"]])
    ws2.append(["Hadir P", data["gender_hadir"]["P"]])
    ws2.append(["Total Tamu", data.get("total_tamu", 0)])
    ws3 = wb.create_sheet("Daftar Tamu")
    ws3.append(["Tanggal", "Kegiatan", "Nama Tamu", "Jam Hadir", "Dicatat Oleh"])
    for g in data.get("tamu", []):
        ws3.append([g.get("date"), g.get("kegiatan"), g.get("name"),
                    (g.get("arrival_time") or "")[11:16], g.get("added_by")])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname_base}.xlsx"'})


@api_router.get("/cron/auto-close")
async def cron_auto_close(request: Request):
    """Dipanggil Vercel Cron (atau cron eksternal) untuk menutup kegiatan yang lewat jam selesai."""
    secret = os.environ.get("CRON_SECRET")
    if secret:
        auth = request.headers.get("authorization", "")
        provided = auth[7:].strip() if auth.lower().startswith("bearer ") else request.headers.get("x-cron-secret", "")
        if provided != secret:
            raise HTTPException(status_code=401, detail="Unauthorized")
    await ensure_init()
    before = await db.kegiatans.count_documents({"status": "open"})
    await auto_close_kegiatan()
    after = await db.kegiatans.count_documents({"status": "open"})
    return {"ok": True, "closed": max(before - after, 0), "open_remaining": after}


# ===========================================================================
# FASE 15 — Halaman Kode Akses, Scan Presensi & Pengaduan/Curhat Peserta
# ===========================================================================
@api_router.get("/staff/kode-akses")
async def staff_kode_akses(request: Request, staff: dict = Depends(require_staff),
                           month: str = ""):
    """Daftar kegiatan + kode akses 6 digit. Kode dibuat OTOMATIS bila belum ada."""
    month = month.strip() or now_wita().strftime("%Y-%m")
    kegiatans = await db.kegiatans.find(
        {"date": {"$regex": f"^{re.escape(month)}"}}
    ).sort([("date", -1), ("start_time", 1)]).to_list(500)
    rows, created = [], 0
    for k in kegiatans:
        punya = len(str(k.get("access_code") or "")) == ACCESS_CODE_LEN and bool(k.get("akses_token"))
        info = await ensure_kegiatan_access(k["_id"], request)
        if not punya:
            created += 1
        rows.append({
            "id": k["_id"], "name": k.get("name"),
            "base_name": k.get("base_name") or k.get("name"),
            "session_label": k.get("session_label"), "date": k.get("date"),
            "start_time": k.get("start_time"), "end_time": k.get("end_time"),
            "status": k.get("status", "open"), "code": info["code"],
            "link": info["link"], "token": info["token"],
            "image": info["image"], "wa_text": info["wa_text"],
            "valid_until": info["valid_until"],
        })
    if created:
        await log_activity(staff, "buat_kode_akses",
                           f"Kode akses dibuat otomatis untuk {created} kegiatan bulan {month}")
    return {"month": month, "total": len(rows), "created": created, "rows": rows}


@api_router.get("/staff/scan-presensi")
async def staff_scan_presensi(request: Request, staff: dict = Depends(require_staff),
                              date: str = ""):
    """Daftar kegiatan pada 1 tanggal beserta QR absen kegiatannya (untuk dipindai peserta)."""
    d = date.strip() or now_wita().strftime("%Y-%m-%d")
    kegiatans = await db.kegiatans.find({"date": d}).sort("start_time", 1).to_list(200)
    rows = []
    for k in kegiatans:
        info = await ensure_absen_token(k["_id"], request)
        rows.append({
            "id": k["_id"], "name": k.get("name"),
            "base_name": k.get("base_name") or k.get("name"),
            "session_label": k.get("session_label"), "date": k.get("date"),
            "start_time": k.get("start_time"), "end_time": k.get("end_time"),
            "teacher": k.get("teacher"), "location": k.get("location"),
            "status": k.get("status", "open"), "phase": kegiatan_phase(k),
            "link": info["link"], "image": make_qr_data_url(info["link"]),
            "expires_at": info["expires_at"], "sessions": info.get("sessions", 1),
            "counts": await kegiatan_counts(k),
        })
    return {"date": d, "total": len(rows), "rows": rows}


PENGADUAN_CATEGORIES = [
    "pertemanan", "keluarga", "sekolah", "perundungan", "kekerasan", "kehadiran",
    "perasaan", "saran", "curhat", "mental", "ekonomi", "lainnya",
]
PENGADUAN_LABEL = {
    "pertemanan": "Pertemanan",
    "keluarga": "Keluarga",
    "sekolah": "Sekolah / Kerja / Kuliah",
    "perundungan": "Perundungan / Bullying",
    "kekerasan": "Kekerasan",
    "kehadiran": "Kehadiran",
    "perasaan": "Perasaan pribadi",
    "saran": "Saran & Masukan",
    "curhat": "Curhat / Konsultasi",
    "mental": "Permasalahan mental",
    "ekonomi": "Ekonomi",
    "lainnya": "Lainnya",
    # Nilai lama tetap dibaca apa adanya pada pesan yang sudah tersimpan.
    "pengaduan": "Pengaduan",
    "kendala": "Kendala Hadir",
    "pertanyaan": "Pertanyaan Keagamaan",
}
PENGADUAN_MAX = 800
PENGADUAN_JUDUL_MAX = 60
# Kategori yang butuh penanganan segera (tag "Perlu segera" di panel pengurus).
PENGADUAN_SEGERA = ("kekerasan", "perundungan", "mental")


def pengaduan_status(p: dict) -> str:
    """Status tiga tahap — satu-satunya sumber kebenaran.

    ditindaklanjuti_at terisi = "ditindaklanjuti"; selain itu read_by tidak
    kosong = "dibaca"; selain itu "baru".
    """
    if p.get("ditindaklanjuti_at"):
        return "ditindaklanjuti"
    if p.get("read_by"):
        return "dibaca"
    return "baru"


def perlu_segera(p: dict) -> bool:
    """Tag "Perlu segera" selama belum ditindaklanjuti."""
    return (p.get("category") in PENGADUAN_SEGERA
            and not p.get("ditindaklanjuti_at"))


class PengaduanInput(BaseModel):
    message: str
    category: str = ""
    anonymous: bool = False
    judul: str = ""


def serialize_pengaduan(p: dict, for_staff: bool = False) -> dict:
    """Serialisasi pesan Ruang Teduh.

    Status diturunkan dari data yang sudah ada (satu-satunya sumber):
    `ditindaklanjuti_at` terisi = ditindaklanjuti; selain itu `read_by` tidak
    kosong = dibaca; selain itu baru.
    """
    status = pengaduan_status(p)
    if for_staff:
        return {
            "id": p["_id"],
            "category": p.get("category", "curhat"),
            "category_label": PENGADUAN_LABEL.get(p.get("category", "curhat"), "Lainnya"),
            "judul": p.get("judul") or "",
            "message": p.get("message"),
            "anonymous": bool(p.get("anonymous")),
            "name": ("Anonim" if p.get("anonymous") else (p.get("name") or "Peserta")),
            "phone": None if p.get("anonymous") else p.get("phone"),
            "at": p.get("at"),
            "status": status,
            "dibaca": status != "baru",
            "dibaca_oleh": (p.get("read_by") or [{}])[-1].get("name") if p.get("read_by") else None,
            "ditindaklanjuti_at": p.get("ditindaklanjuti_at"),
            "catatan_pengurus": p.get("catatan_pengurus") or "",
            "perlu_segera": perlu_segera(p),
        }
    # Peserta: hanya kategori, tanggal, cuplikan, dan status.
    # Tidak pernah mengirim catatan pengurus, nama pengurus, atau waktu baca.
    return {
        "id": p["_id"],
        "category": p.get("category", "curhat"),
        "category_label": PENGADUAN_LABEL.get(p.get("category", "curhat"), "Lainnya"),
        "at": p.get("at"),
        "cuplikan": (p.get("message") or "").strip().replace("\n", " ")[:120],
        "status": status,
        "anonymous": bool(p.get("anonymous")),
    }


@api_router.post("/me/pengaduan")
async def create_pengaduan(body: PengaduanInput, user: dict = Depends(get_current_user)):
    msg = (body.message or "").strip()
    judul = (body.judul or "").strip()
    cat = (body.category or "").strip()
    if cat not in PENGADUAN_CATEGORIES:
        raise HTTPException(status_code=400, detail="Pilih kategori cerita terlebih dahulu.")
    if len(judul) < 3:
        raise HTTPException(status_code=400, detail="Judul masalah minimal 3 huruf.")
    if len(msg) < 10:
        raise HTTPException(status_code=400,
                            detail="Mohon tuliskan cerita minimal 10 huruf agar pengurus dapat memahami keadaan Anda.")
    anonymous = bool(body.anonymous)
    doc = {
        "_id": str(uuid.uuid4()),
        "anonymous": anonymous, "category": cat,
        "judul": judul[:PENGADUAN_JUDUL_MAX], "message": msg[:PENGADUAN_MAX],
        "read_by": [], "at": now_wita().isoformat(),
    }
    # Cerita anonim: tidak menyimpan identitas apa pun (tanpa user_id/nama/telepon).
    if not anonymous:
        doc.update({
            "user_id": str(user["_id"]),
            "name": user.get("name"), "phone": user.get("phone"),
            "kelompok_id": user.get("kelompok_id"),
        })
    await db.pengaduans.insert_one(doc)
    return {"id": doc["_id"], "anonymous": anonymous,
            "message": "Ceritamu sudah sampai ke pengurus."}


@api_router.get("/me/pengaduan")
async def my_pengaduan(user: dict = Depends(get_current_user)):
    # Hanya cerita bernama milik peserta yang login (cerita anonim tidak
    # pernah ditautkan ke peserta). Proyeksi membatasi kolom yang dikirim.
    items = await db.pengaduans.find(
        {"user_id": str(user["_id"]), "anonymous": {"$ne": True}},
        {"category": 1, "at": 1, "message": 1, "read_by": 1, "ditindaklanjuti_at": 1},
    ).sort("at", -1).to_list(100)
    return {"items": [serialize_pengaduan(p) for p in items],
            "categories": [{"value": c, "label": PENGADUAN_LABEL[c]} for c in PENGADUAN_CATEGORIES],
            "max_length": PENGADUAN_MAX, "max_title": PENGADUAN_JUDUL_MAX}


@api_router.delete("/me/pengaduan/{pengaduan_id}")
async def delete_my_pengaduan(pengaduan_id: str, user: dict = Depends(get_current_user)):
    res = await db.pengaduans.delete_one({"_id": pengaduan_id, "user_id": str(user["_id"])})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pesan tidak ditemukan")
    return {"ok": True}


@api_router.delete("/me/pengaduan")
async def clear_my_pengaduan(user: dict = Depends(get_current_user)):
    res = await db.pengaduans.delete_many({"user_id": str(user["_id"])})
    return {"ok": True, "deleted": res.deleted_count}


@api_router.get("/staff/pengaduan")
async def staff_pengaduan(staff: dict = Depends(require_staff), q: str = "", limit: int = 200):
    limit = max(1, min(limit, 500))
    items = await db.pengaduans.find().sort("at", -1).to_list(limit)
    rows = [serialize_pengaduan(p, for_staff=True) for p in items]
    t = q.strip().lower()
    if t:
        rows = [r for r in rows
                if t in (r["message"] or "").lower()
                or t in (r["name"] or "").lower()
                or t in (r.get("judul") or "").lower()]
    return {
        "total": len(rows),
        "belum_dibaca": len([r for r in rows if r["status"] == "baru"]),
        "perlu_segera": len([r for r in rows if r["perlu_segera"]]),
        "rows": rows,
    }


class PengaduanStatusInput(BaseModel):
    status: Optional[str] = None          # baru | dibaca | ditindaklanjuti
    catatan_pengurus: Optional[str] = None


@api_router.patch("/staff/pengaduan/{pengaduan_id}")
async def update_pengaduan(pengaduan_id: str, body: PengaduanStatusInput,
                           staff: dict = Depends(require_staff)):
    """Simpan status tiga tahap dan/atau catatan pengurus (hanya pengurus/admin)."""
    p = await db.pengaduans.find_one({"_id": pengaduan_id})
    if not p:
        raise HTTPException(status_code=404, detail="Pesan tidak ditemukan")
    upd: dict = {}
    if body.status is not None:
        status = (body.status or "").strip()
        if status not in ("baru", "dibaca", "ditindaklanjuti"):
            raise HTTPException(status_code=400, detail="Status tidak valid")
        if status == "ditindaklanjuti":
            upd["ditindaklanjuti_at"] = p.get("ditindaklanjuti_at") or now_wita().isoformat()
        else:
            upd["ditindaklanjuti_at"] = None
        if status == "baru":
            upd["read_by"] = []
        elif not p.get("read_by"):
            upd["read_by"] = [{"id": str(staff["_id"]), "name": staff.get("name"),
                               "at": now_wita().isoformat()}]
    if body.catatan_pengurus is not None:
        upd["catatan_pengurus"] = (body.catatan_pengurus or "").strip()[:2000] or None
    if upd:
        await db.pengaduans.update_one({"_id": pengaduan_id}, {"$set": upd})
    doc = await db.pengaduans.find_one({"_id": pengaduan_id})
    return serialize_pengaduan(doc, for_staff=True)


@api_router.get("/staff/pengaduan/unread-count")
async def pengaduan_unread_count(staff: dict = Depends(require_staff)):
    """FASE 16 — angka lonceng notifikasi Ruang Teduh di panel."""
    total = await db.pengaduans.count_documents({})
    belum = await db.pengaduans.count_documents({"read_by": {"$size": 0}})
    return {"total": total, "belum_dibaca": belum}


@api_router.post("/staff/pengaduan/{pengaduan_id}/baca")
async def baca_pengaduan(pengaduan_id: str, staff: dict = Depends(require_staff)):
    p = await db.pengaduans.find_one({"_id": pengaduan_id})
    if not p:
        raise HTTPException(status_code=404, detail="Pesan tidak ditemukan")
    await db.pengaduans.update_one({"_id": pengaduan_id}, {"$push": {"read_by": {
        "id": str(staff["_id"]), "name": staff.get("name"), "at": now_wita().isoformat()}}})
    return {"ok": True}


@api_router.delete("/staff/pengaduan/{pengaduan_id}")
async def hapus_pengaduan(pengaduan_id: str, staff: dict = Depends(require_staff)):
    res = await db.pengaduans.delete_one({"_id": pengaduan_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pesan tidak ditemukan")
    await log_activity(staff, "hapus_ruang_teduh", "Menghapus satu pesan Ruang Teduh")
    return {"ok": True}


@api_router.delete("/staff/pengaduan")
async def hapus_semua_pengaduan(staff: dict = Depends(require_staff)):
    res = await db.pengaduans.delete_many({})
    await log_activity(staff, "hapus_ruang_teduh",
                       f"Menghapus seluruh riwayat Ruang Teduh ({res.deleted_count} pesan)")
    return {"ok": True, "deleted": res.deleted_count}


class KesanPesanInput(BaseModel):
    kegiatan_id: str
    sentiment: str = "suka"      # suka | tidak_suka
    message: str


@api_router.get("/me/kesan-pesan")
async def my_kesan_pesan(user: dict = Depends(get_current_user)):
    """Kegiatan yang SAYA HADIRI (30 hari terakhir) + status kesan & pesan."""
    uid = str(user["_id"])
    since = (now_wita() - timedelta(days=30)).strftime("%Y-%m-%d")
    absens = await db.absensis.find({"user_id": uid, "status": "hadir"}).to_list(2000)
    ids = [a["kegiatan_id"] for a in absens]
    if not ids:
        return {"items": []}
    kegiatans = await db.kegiatans.find(
        {"_id": {"$in": ids}, "date": {"$gte": since}}
    ).sort([("date", -1), ("start_time", -1)]).to_list(100)
    mine = await db.feedbacks.find({"user_id": uid}).to_list(2000)
    sent = {f["kegiatan_id"]: f for f in mine}
    items = []
    for k in kegiatans:
        f = sent.get(k["_id"])
        items.append({
            "kegiatan_id": k["_id"],
            "name": k.get("base_name") or k.get("name"),
            "session_label": k.get("session_label"),
            "date": k.get("date"),
            "start_time": k.get("start_time"), "end_time": k.get("end_time"),
            "teacher": k.get("teacher"), "location": k.get("location"),
            "sudah_kirim": bool(f),
            "sentiment": (f or {}).get("sentiment"),
            "message": (f or {}).get("message"),
        })
    return {"items": items}


@api_router.post("/me/kesan-pesan")
async def send_kesan_pesan(body: KesanPesanInput, user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    k = await db.kegiatans.find_one({"_id": body.kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    hadir = await db.absensis.find_one({"kegiatan_id": body.kegiatan_id,
                                        "user_id": uid, "status": "hadir"})
    if not hadir:
        raise HTTPException(status_code=403,
                            detail="Kesan & pesan hanya untuk kegiatan yang Anda hadiri.")
    msg = (body.message or "").strip()
    if len(msg) < 5:
        raise HTTPException(status_code=400, detail="Mohon tuliskan kesan & pesan Anda terlebih dahulu.")
    sentiment = body.sentiment if body.sentiment in ("suka", "tidak_suka") else "suka"
    await db.feedbacks.update_one(
        {"kegiatan_id": body.kegiatan_id, "user_id": uid},
        {"$set": {"kegiatan_id": body.kegiatan_id, "user_id": uid,
                  "name": user.get("name") or "Peserta", "sentiment": sentiment,
                  "message": msg[:3000], "created_at": now_wita().isoformat()}},
        upsert=True)
    return {"message": "Alhamdulillah, jazakumullahu khoiro. Kesan & pesan Anda sudah terkirim."}


# ------------------------- FASE 18: Undangan Penting -------------------------
class UndanganInput(BaseModel):
    user_ids: List[str] = []
    message: Optional[str] = None


def serialize_undangan(u: dict, k: Optional[dict] = None) -> dict:
    d = {"kegiatan_id": str(u.get("kegiatan_id") or ""),
         "user_ids": [str(x) for x in (u.get("user_ids") or [])],
         "message": u.get("message") or "", "created_at": u.get("created_at"),
         "created_by_name": u.get("created_by_name")}
    if k:
        d["kegiatan"] = {"id": str(k["_id"]), "name": k.get("name"), "date": k.get("date"),
                         "start_time": k.get("start_time"), "end_time": k.get("end_time"),
                         "location": k.get("location"), "teacher": k.get("teacher"),
                         "material": k.get("material")}
    return d


@api_router.get("/staff/kegiatan/{kegiatan_id}/undangan")
async def get_undangan(kegiatan_id: str, staff: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    doc = await db.undangans.find_one({"_id": kegiatan_id}) or {"kegiatan_id": kegiatan_id}
    peserta = await db.users.find(PESERTA_QUERY).sort("name", 1).to_list(5000)
    rows = [{"user_id": str(p["_id"]), "name": p.get("name"),
             "gender": _derive_gender(p), "status": p.get("status", "active")}
            for p in peserta]
    return {**serialize_undangan(doc, k), "peserta": rows}


@api_router.post("/staff/kegiatan/{kegiatan_id}/undangan")
async def save_undangan(kegiatan_id: str, body: UndanganInput,
                        staff: dict = Depends(require_staff)):
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    ids = []
    for uid in (body.user_ids or []):
        uid = str(uid).strip()
        if uid and uid not in ids:
            ids.append(uid)
    if not ids:
        raise HTTPException(status_code=400, detail="Mohon centang minimal 1 peserta yang diundang.")
    doc = {"_id": kegiatan_id, "kegiatan_id": kegiatan_id, "user_ids": ids,
           "message": (body.message or "").strip()[:1000],
           "created_at": now_wita().isoformat(),
           "created_by_id": str(staff["_id"]), "created_by_name": staff.get("name")}
    await db.undangans.replace_one({"_id": kegiatan_id}, doc, upsert=True)
    await log_activity(staff, "undangan_penting",
                       f"Mengirim undangan penting '{k.get('name')}' ke {len(ids)} peserta")
    return {**serialize_undangan(doc, k),
            "message_ok": f"Undangan penting terkirim ke {len(ids)} peserta."}


@api_router.delete("/staff/kegiatan/{kegiatan_id}/undangan")
async def delete_undangan(kegiatan_id: str, staff: dict = Depends(require_staff)):
    await db.undangans.delete_one({"_id": kegiatan_id})
    await log_activity(staff, "undangan_penting", f"Membatalkan undangan penting kegiatan {kegiatan_id}")
    return {"ok": True}


@api_router.get("/me/undangan")
async def my_undangan(user: dict = Depends(get_current_user)):
    uid = str(user["_id"])
    docs = await db.undangans.find({"user_ids": uid}).sort("created_at", -1).to_list(50)
    out = []
    for d in docs:
        k = await db.kegiatans.find_one({"_id": d.get("kegiatan_id")})
        if not k:
            continue
        out.append(serialize_undangan(d, k))
    return {"items": out}


# ------------------------- FASE 18: Notifikasi semua fitur -------------------------
NOTIF_SOURCE_LABEL = {
    "pengaduan": "Ruang Teduh",
    "kegiatan": "Kegiatan baru",
    "pengumuman": "Pengumuman",
    "musyawarah": "Musyawarah",
    "undangan": "Undangan penting",
    "izin": "Izin guru",
    "kehadiran": "Kehadiran",
}

# Notifikasi kehadiran peserta: satu baris per peserta per kegiatan.
NOTIF_KEHADIRAN_JENIS = ("hadir", "izin", "sakit", "alpha")


def _notif_kehadiran_teks(jenis: str, nama: str, tanggal: str) -> str:
    """Teks notifikasi kehadiran (sentence case, tanggal WITA, tanpa tanda seru)."""
    nama = nama or "kegiatan"
    tgl = _tanggal_indo(tanggal)
    if jenis == "hadir":
        return (f"Alhamdulillah, kehadiran Anda di {nama} ({tgl}) tercatat. "
                "Jazakumullahu khoiro.")
    if jenis == "izin":
        return f"Izin Anda di {nama} ({tgl}) tercatat. Jazakumullahu khoiro."
    if jenis == "sakit":
        return f"Semoga lekas sembuh. Sakit Anda di {nama} ({tgl}) tercatat."
    return (f"Anda belum tercatat hadir di {nama} ({tgl}). "
            "Jika ada kendala, hubungi pengurus.")


async def simpan_notif_kehadiran(user_id: str, jenis: Optional[str], k: dict) -> None:
    """Simpan/perbarui/hapus notifikasi kehadiran peserta untuk satu kegiatan.

    `jenis` None = hapus notifikasi (mis. izin dibatalkan). Hanya peserta yang
    sudah punya akun (punya kata sandi) yang menerima notifikasi.
    """
    try:
        if not user_id or not k:
            return
        oid = _oid(user_id)
        if not oid:
            return
        u = await db.users.find_one({"_id": oid}, {"password_hash": 1, "roles": 1})
        if not u or not u.get("password_hash"):
            return  # belum punya akun → tidak menerima notifikasi
        key = {"peserta_id": user_id, "kegiatan_id": k["_id"]}
        if jenis not in NOTIF_KEHADIRAN_JENIS:
            await db.notifikasi.delete_many(key)
            return
        nama = k.get("base_name") or k.get("name")
        if k.get("session_label"):
            nama = f"{nama} ({k.get('session_label')})"
        await db.notifikasi.update_one(
            key,
            {"$set": {**key, "jenis": jenis, "tanggal": k.get("date"),
                      "teks": _notif_kehadiran_teks(jenis, nama, k.get("date")),
                      "dibaca": False, "dibuat_pada": now_wita().isoformat()}},
            upsert=True)
    except Exception:
        logger.exception("Gagal menyimpan notifikasi kehadiran")


async def notif_kehadiran_dari_status(user_id: str, status: Optional[str], k: dict) -> None:
    """Petakan status absensi → notifikasi kehadiran."""
    await simpan_notif_kehadiran(
        user_id, status if status in NOTIF_KEHADIRAN_JENIS else None, k)


async def _notif_items_for(user: dict, staff: bool) -> list:
    items = []
    today = now_wita().strftime("%Y-%m-%d")
    uid = str(user["_id"])
    roles = user.get("roles") or []

    try:
        kegs = await db.kegiatans.find({"date": {"$gte": today}}).sort("created_at", -1).to_list(60)
        for k in kegs:
            if not staff and not match_gender_filter(k, user):
                continue
            items.append({
                "type": "kegiatan", "id": str(k["_id"]), "title": k.get("name"),
                "subtitle": f"{k.get('date')} · {k.get('start_time')}–{k.get('end_time')} WITA"
                            + (f" · {k.get('location')}" if k.get("location") else ""),
                "at": to_utc_iso(k.get("created_at")), "target": "kegiatan",
            })
    except Exception:
        logger.exception("Notifikasi gagal pada sumber 'kegiatan'")

    try:
        for p in await db.pengumumans.find().sort("created_at", -1).to_list(30):
            items.append({"type": "pengumuman", "id": str(p["_id"]), "title": p.get("title"),
                          "subtitle": (p.get("body") or "")[:90],
                          "important": bool(p.get("important")),
                          "at": to_utc_iso(p.get("created_at")), "target": "pengumuman"})
    except Exception:
        logger.exception("Notifikasi gagal pada sumber 'pengumuman'")

    try:
        for d in await db.undangans.find({} if staff else {"user_ids": uid}) \
                .sort("created_at", -1).to_list(30):
            k = await db.kegiatans.find_one({"_id": d.get("kegiatan_id")}) or {}
            items.append({"type": "undangan", "id": str(d.get("kegiatan_id") or ""),
                          "title": f"Undangan penting: {k.get('name') or 'Kegiatan'}",
                          "subtitle": (d.get("message") or
                                       f"{k.get('date')} · {k.get('start_time')}–{k.get('end_time')} WITA"),
                          "at": to_utc_iso(d.get("created_at")), "target": "kegiatan"})
    except Exception:
        logger.exception("Notifikasi gagal pada sumber 'undangan'")

    if staff:
        try:
            for m in await db.musyawarahs.find().sort("created_at", -1).to_list(20):
                items.append({"type": "musyawarah", "id": str(m["_id"]),
                              "title": MUSY_LABEL.get(m.get("category"), "Musyawarah"),
                              "subtitle": (m.get("content") or "")[:90],
                              "at": to_utc_iso(m.get("created_at")), "target": "musyawarah"})
        except Exception:
            logger.exception("Notifikasi gagal pada sumber 'musyawarah'")
        try:
            for p in await db.pengaduans.find({"read_by": {"$size": 0}}) \
                    .sort("at", -1).to_list(30):
                who = "Anonim" if p.get("anonymous") else (p.get("name") or "Peserta")
                items.append({"type": "pengaduan", "id": str(p["_id"]),
                              "title": f"Cerita Ruang Teduh dari {who}",
                              "subtitle": (p.get("judul") or p.get("message") or "")[:90],
                              "at": to_utc_iso(p.get("at")), "target": "pengaduan"})
        except Exception:
            logger.exception("Notifikasi gagal pada sumber 'pengaduan'")

    # Izin guru: permintaan menggantikan untuk saya + ringkasan untuk pengurus.
    if "guru" in roles:
        try:
            for i in await db.izin_guru.find({"pengganti_id": uid, "status": "menunggu"}) \
                    .sort("dibuat_at", -1).to_list(20):
                k = await db.kegiatans.find_one({"_id": i.get("kegiatan_id")}) or {}
                items.append({
                    "type": "izin", "id": str(i["_id"]),
                    "title": f"{i.get('guru_nama') or 'Guru'} meminta Anda menggantikan {k.get('name') or 'kelas'}",
                    "subtitle": f"{_tanggal_indo(k.get('date'))} · {k.get('start_time')}–{k.get('end_time')} WITA",
                    "at": to_utc_iso(i.get("dibuat_at")), "target": "izin",
                })
        except Exception:
            logger.exception("Notifikasi gagal pada sumber 'izin (pengganti)'")
    if staff:
        try:
            for i in await db.izin_guru.find({"status": {"$in": ["menunggu", "tanpa_pengganti"]}}) \
                    .sort("dibuat_at", -1).to_list(20):
                k = await db.kegiatans.find_one({"_id": i.get("kegiatan_id")}) or {}
                items.append({
                    "type": "izin", "id": str(i["_id"]),
                    "title": f"Izin guru: {i.get('guru_nama') or 'Guru'} · {k.get('name') or 'kelas'}",
                    "subtitle": f"{_tanggal_indo(k.get('date'))} · {i.get('status')}",
                    "at": to_utc_iso(i.get("dibuat_at")), "target": "izin",
                })
        except Exception:
            logger.exception("Notifikasi gagal pada sumber 'izin (pengurus)'")

    # Notifikasi kehadiran peserta (hadir/izin/sakit/alpha) — satu per kegiatan.
    try:
        for n in await db.notifikasi.find({"peserta_id": uid}) \
                .sort("dibuat_pada", -1).to_list(40):
            items.append({
                "type": "kehadiran", "id": str(n.get("_id") or n.get("kegiatan_id") or ""),
                "title": n.get("teks") or "Kehadiran tercatat",
                "subtitle": None,
                "at": to_utc_iso(n.get("dibuat_pada")), "target": "kegiatan",
            })
    except Exception:
        logger.exception("Notifikasi gagal pada sumber 'kehadiran'")

    items = [i for i in items if i.get("at") and i.get("id")]
    items.sort(key=lambda x: x["at"], reverse=True)
    return items[:40]

@api_router.get("/notifications")
async def notifications(user: dict = Depends(get_current_user)):
    """FASE 18 — lonceng notifikasi untuk SEMUA fitur (bukan Ruang Teduh saja)."""
    roles = user.get("roles") or []
    staff = bool({"admin", "pengurus"} & set(roles))
    items = await _notif_items_for(user, staff)
    read = await db.notif_reads.find_one({"_id": str(user["_id"])}) or {}
    seen = read.get("seen_at") or ""
    unread = [i for i in items if not seen or i["at"] > seen]
    return {"items": items, "count": len(unread), "seen_at": seen or None,
            "labels": NOTIF_SOURCE_LABEL}


@api_router.get("/bantuan/kontak")
async def bantuan_kontak(user: dict = Depends(get_current_user)):
    """FASE 19 — kontak pengurus untuk halaman Bantuan (diambil dari database)."""
    staff = await db.users.find({"roles": {"$in": ["admin", "pengurus"]},
                                "status": "active"}).sort("name", 1).to_list(100)
    rows = []
    for s in staff:
        wa = (s.get("whatsapp") or s.get("phone") or "").strip()
        digits = "".join(ch for ch in wa if ch.isdigit())
        if digits.startswith("0"):
            digits = "62" + digits[1:]
        roles = s.get("roles") or []
        rows.append({
            "id": str(s["_id"]), "name": s.get("name"),
            "role": "Administrator" if "admin" in roles else "Pengurus",
            "phone": s.get("phone"), "whatsapp": wa or None,
            "wa_link": f"https://wa.me/{digits}" if digits else None,
            "email": s.get("email"),
        })
    return {"items": rows, "demo": is_demo_ctx()}


# ------------------------- Tutorial video (admin mengisi sendiri) -------------------------
TUTORIAL_ROLES = ("admin", "guru", "pengurus", "peserta")
YOUTUBE_RE = re.compile(
    r"^https?://(www\.|m\.)?(youtube\.com/(watch\?v=|embed/|shorts/)|youtu\.be/)[\w-]{6,}",
    re.IGNORECASE)


class TutorialVideoInput(BaseModel):
    judul: str
    peran: str = "admin"
    durasi: Optional[str] = None
    url: str


def serialize_tutorial(v: dict) -> dict:
    return {"id": v["_id"], "judul": v.get("judul"), "peran": v.get("peran"),
            "durasi": v.get("durasi") or "", "url": v.get("url"),
            "urutan": v.get("urutan", 0), "dibuat": v.get("dibuat")}


def validate_tutorial(body: TutorialVideoInput) -> dict:
    judul = (body.judul or "").strip()
    if not judul:
        raise HTTPException(status_code=400, detail="Judul tutorial wajib diisi")
    if body.peran not in TUTORIAL_ROLES:
        raise HTTPException(status_code=400, detail="Peran tutorial tidak valid")
    url = (body.url or "").strip()
    if not YOUTUBE_RE.match(url):
        raise HTTPException(status_code=400, detail="Tautan harus berupa tautan YouTube")
    return {"judul": judul, "peran": body.peran,
            "durasi": (body.durasi or "").strip() or None, "url": url}


@api_router.get("/tutorial-video")
async def list_tutorial_video(user: dict = Depends(get_current_user)):
    """Daftar tutorial video. Peserta hanya melihat video untuk perannya."""
    roles = user.get("roles") or []
    q = {}
    if not ({"admin", "pengurus", "guru"} & set(roles)):
        q = {"peran": "peserta"}
    elif "guru" in roles and not ({"admin", "pengurus"} & set(roles)):
        q = {"peran": "guru"}
    items = await db.tutorial_video.find(q).sort([("urutan", 1), ("dibuat", 1)]).to_list(500)
    return {"items": [serialize_tutorial(v) for v in items],
            "can_manage": "admin" in roles}


@api_router.post("/admin/tutorial-video")
async def create_tutorial_video(body: TutorialVideoInput, admin: dict = Depends(require_admin)):
    data = validate_tutorial(body)
    last = await db.tutorial_video.find_one({}, sort=[("urutan", -1)])
    doc = {"_id": str(uuid.uuid4()), **data,
           "urutan": (last.get("urutan", 0) + 1) if last else 1,
           "dibuat": now_wita().isoformat(), "created_by": str(admin["_id"])}
    await db.tutorial_video.insert_one(doc)
    await log_activity(admin, "tambah_tutorial", f"Menambah tutorial video '{data['judul']}'")
    return serialize_tutorial(doc)


@api_router.patch("/admin/tutorial-video/{video_id}")
async def update_tutorial_video(video_id: str, body: TutorialVideoInput,
                                admin: dict = Depends(require_admin)):
    existing = await db.tutorial_video.find_one({"_id": video_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Tutorial tidak ditemukan")
    data = validate_tutorial(body)
    await db.tutorial_video.update_one({"_id": video_id}, {"$set": data})
    doc = await db.tutorial_video.find_one({"_id": video_id})
    return serialize_tutorial(doc)


@api_router.delete("/admin/tutorial-video/{video_id}")
async def delete_tutorial_video(video_id: str, admin: dict = Depends(require_admin)):
    res = await db.tutorial_video.delete_one({"_id": video_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Tutorial tidak ditemukan")
    return {"message": "Tutorial dihapus"}


# ------------------------- FASE 20: Program Pembelajaran -------------------------
# Penyimpanan berkas materi memakai MongoDB (tanpa layanan pihak ketiga).
STORAGE_APP = "ekertalangu"

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "webp": "image/webp", "gif": "image/gif", "pdf": "application/pdf",
}


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Simpan berkas ke koleksi `program_blobs` (pengganti object storage)."""
    db.program_blobs.replace_one(
        {"_id": path},
        {"_id": path, "data": data, "content_type": content_type, "size": len(data)},
        upsert=True)
    return {"path": path, "size": len(data)}


def get_object(path: str):
    row = db.program_blobs.find_one({"_id": path})
    if not row:
        raise FileNotFoundError(path)
    return row["data"], row.get("content_type") or "application/octet-stream"


# Jenjang pembelajaran (tetap / tidak diubah lewat UI)
JENJANG = [
    {"id": "paud", "label": "PAUD", "group": "Anak Usia Dini", "age": "3–5 tahun"},
    *[{"id": f"cabe{i}", "label": f"Cabe Rawit {i}", "group": "Cabe Rawit",
       "age": f"kelas {i} SD"} for i in range(1, 7)],
    {"id": "pra_remaja", "label": "Pra Remaja", "group": "Muda-Mudi", "age": "SMP"},
    {"id": "remaja", "label": "Remaja", "group": "Muda-Mudi", "age": "SMA"},
    *[{"id": f"pra_nikah{i}", "label": f"Pra Nikah {i}", "group": "Muda-Mudi",
       "age": "usia kerja / kuliah"} for i in range(1, 5)],
]
JENJANG_BY_ID = {j["id"]: j for j in JENJANG}
HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Ahad"]

# ---------------------------------------------------------------------------
# Jenjang peserta: pemetaan umur → jenjang (SATU konstanta, mudah diubah).
# Umur dihitung per 1 Juli tahun ajaran berjalan (tahun ajaran Juli–Juni).
# ---------------------------------------------------------------------------
JENJANG_UMUR = [
    {"jenjang": "paud", "min": 3, "max": 6},
    *[{"jenjang": f"cabe{i}", "min": 6 + i, "max": 6 + i} for i in range(1, 7)],
    {"jenjang": "pra_remaja", "min": 13, "max": 15},
    {"jenjang": "remaja", "min": 16, "max": 18},
    *[{"jenjang": f"pra_nikah{i}", "min": 18 + i, "max": 200 if i == 4 else 18 + i}
      for i in range(1, 5)],
]


def normalize_wa_wali(value) -> Optional[str]:
    """Nomor WA wali → format 62xxxxxxxxxx (awalan 0 / 8 diganti 62)."""
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    if not digits:
        return None
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("8"):
        digits = "62" + digits
    return digits


def tahun_ajaran_info(ref: Optional[datetime] = None) -> dict:
    """Tahun ajaran berjalan (Juli–Juni) + semester, dihitung dari tanggal."""
    now = ref or now_wita()
    start_year = now.year if now.month >= 7 else now.year - 1
    semester = 1 if now.month >= 7 else 2
    return {"label": f"{start_year}/{start_year + 1}", "semester": semester,
            "mulai": f"{start_year}-07-01"}


def umur_per_juli(dob: Optional[str], ref: Optional[datetime] = None) -> Optional[int]:
    """Umur pada 1 Juli tahun ajaran berjalan."""
    if not dob:
        return None
    try:
        born = datetime.strptime(str(dob)[:10], "%Y-%m-%d")
    except Exception:
        return None
    now = ref or now_wita()
    start_year = now.year if now.month >= 7 else now.year - 1
    ref_date = datetime(start_year, 7, 1)
    age = ref_date.year - born.year - ((ref_date.month, ref_date.day) < (born.month, born.day))
    return age if age >= 0 else None


def saran_jenjang(dob: Optional[str], ref: Optional[datetime] = None) -> Optional[str]:
    """Jenjang yang disarankan dari umur (NILAI AWAL saja, tidak pernah menimpa)."""
    age = umur_per_juli(dob, ref)
    if age is None:
        return None
    for row in JENJANG_UMUR:
        if row["min"] <= age <= row["max"]:
            return row["jenjang"]
    return None


async def require_program_editor(user: dict = Depends(get_current_user)) -> dict:
    """Program Pembelajaran hanya boleh diubah Administrator dan Guru/Pengajar."""
    roles = user.get("roles") or []
    if "admin" not in roles and "guru" not in roles:
        raise HTTPException(status_code=403, detail="Akses khusus Administrator dan Guru/Pengajar")
    return user


class MediaInput(BaseModel):
    kind: str = "link"               # link | file
    label: Optional[str] = None
    url: Optional[str] = None        # untuk kind=link
    file_id: Optional[str] = None    # untuk kind=file


class KurikulumInput(BaseModel):
    tujuan: Optional[str] = None     # kurikulum / capaian pembelajaran
    metode: Optional[str] = None     # metode & media pembelajaran
    catatan: Optional[str] = None


class MateriInput(BaseModel):
    title: str
    description: Optional[str] = None
    pekan: Optional[int] = None      # pekan ke-
    media: List[MediaInput] = []


class JadwalInput(BaseModel):
    day: str
    start_time: str
    end_time: str
    teacher: Optional[str] = None
    location: Optional[str] = None
    note: Optional[str] = None
    guru_id: Optional[str] = None


def _jenjang_or_404(jenjang_id: str) -> dict:
    j = JENJANG_BY_ID.get(jenjang_id)
    if not j:
        raise HTTPException(status_code=404, detail="Jenjang tidak ditemukan")
    return j


async def _media_out(media: list) -> list:
    out = []
    for m in media or []:
        item = {"kind": m.get("kind", "link"), "label": m.get("label"),
                "url": m.get("url"), "file_id": m.get("file_id")}
        if item["kind"] == "file" and item["file_id"]:
            f = await db.program_files.find_one({"_id": item["file_id"], "is_deleted": {"$ne": True}})
            if f:
                item["label"] = item["label"] or f.get("original_filename")
                item["content_type"] = f.get("content_type")
                item["size"] = f.get("size")
                item["url"] = f"/api/program/file/{item['file_id']}"
        out.append(item)
    return out


async def serialize_materi(m: dict) -> dict:
    return {"id": m["_id"], "jenjang_id": m.get("jenjang_id"), "title": m.get("title"),
            "description": m.get("description"), "pekan": m.get("pekan"),
            "media": await _media_out(m.get("media")),
            "updated_at": m.get("updated_at"), "updated_by": m.get("updated_by")}


@api_router.get("/program/jenjang")
async def program_jenjang(user: dict = Depends(get_current_user)):
    roles = user.get("roles") or []
    rows = []
    for j in JENJANG:
        rows.append({**j,
                     "materi_count": await db.program_materis.count_documents({"jenjang_id": j["id"]}),
                     "jadwal_count": await db.program_jadwals.count_documents({"jenjang_id": j["id"]})})
    return {"items": rows, "hari": HARI,
            "can_edit": "admin" in roles or "guru" in roles}


@api_router.get("/program/{jenjang_id}")
async def program_detail(jenjang_id: str, user: dict = Depends(get_current_user)):
    j = _jenjang_or_404(jenjang_id)
    kur = await db.program_kurikulums.find_one({"_id": jenjang_id}) or {}
    materis = await db.program_materis.find({"jenjang_id": jenjang_id}) \
        .sort([("pekan", 1), ("created_at", 1)]).to_list(300)
    jadwals = await db.program_jadwals.find({"jenjang_id": jenjang_id}) \
        .sort("start_time", 1).to_list(100)
    roles = user.get("roles") or []
    return {
        "jenjang": j,
        "kurikulum": {"tujuan": kur.get("tujuan") or "", "metode": kur.get("metode") or "",
                      "catatan": kur.get("catatan") or "",
                      "updated_at": kur.get("updated_at"), "updated_by": kur.get("updated_by")},
        "materi": [await serialize_materi(m) for m in materis],
        "jadwal": [{"id": x["_id"], "day": x.get("day"), "start_time": x.get("start_time"),
                    "end_time": x.get("end_time"), "teacher": x.get("teacher"),
                    "guru_id": x.get("guru_id"),
                    "location": x.get("location"), "note": x.get("note")} for x in jadwals],
        "can_edit": "admin" in roles or "guru" in roles,
    }


@api_router.put("/program/{jenjang_id}/kurikulum")
async def save_kurikulum(jenjang_id: str, body: KurikulumInput,
                         editor: dict = Depends(require_program_editor)):
    _jenjang_or_404(jenjang_id)
    doc = {"tujuan": (body.tujuan or "").strip(), "metode": (body.metode or "").strip(),
           "catatan": (body.catatan or "").strip(),
           "updated_at": now_wita().isoformat(), "updated_by": editor.get("name")}
    await db.program_kurikulums.update_one({"_id": jenjang_id}, {"$set": doc}, upsert=True)
    await log_activity(editor, "program_pembelajaran",
                       f"Memperbarui kurikulum {JENJANG_BY_ID[jenjang_id]['label']}")
    return {"ok": True, **doc}


@api_router.post("/program/{jenjang_id}/materi")
async def add_materi(jenjang_id: str, body: MateriInput,
                     editor: dict = Depends(require_program_editor)):
    _jenjang_or_404(jenjang_id)
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Judul materi wajib diisi")
    doc = {"_id": str(uuid.uuid4()), "jenjang_id": jenjang_id, "title": body.title.strip(),
           "description": (body.description or "").strip(), "pekan": body.pekan,
           "media": [m.model_dump() for m in body.media],
           "created_at": now_wita().isoformat(), "updated_at": now_wita().isoformat(),
           "updated_by": editor.get("name")}
    await db.program_materis.insert_one(doc)
    await log_activity(editor, "program_pembelajaran",
                       f"Menambah materi '{doc['title']}' ({JENJANG_BY_ID[jenjang_id]['label']})")
    return await serialize_materi(doc)


@api_router.patch("/program/materi/{materi_id}")
async def edit_materi(materi_id: str, body: MateriInput,
                      editor: dict = Depends(require_program_editor)):
    m = await db.program_materis.find_one({"_id": materi_id})
    if not m:
        raise HTTPException(status_code=404, detail="Materi tidak ditemukan")
    updates = {"title": body.title.strip(), "description": (body.description or "").strip(),
               "pekan": body.pekan, "media": [x.model_dump() for x in body.media],
               "updated_at": now_wita().isoformat(), "updated_by": editor.get("name")}
    await db.program_materis.update_one({"_id": materi_id}, {"$set": updates})
    await log_activity(editor, "program_pembelajaran", f"Mengubah materi '{updates['title']}'")
    return await serialize_materi({**m, **updates})


@api_router.delete("/program/materi/{materi_id}")
async def delete_materi(materi_id: str, editor: dict = Depends(require_program_editor)):
    m = await db.program_materis.find_one({"_id": materi_id})
    if not m:
        raise HTTPException(status_code=404, detail="Materi tidak ditemukan")
    await db.program_materis.delete_one({"_id": materi_id})
    await log_activity(editor, "program_pembelajaran", f"Menghapus materi '{m.get('title')}'")
    return {"ok": True}


@api_router.post("/program/{jenjang_id}/jadwal")
async def add_jadwal(jenjang_id: str, body: JadwalInput,
                     editor: dict = Depends(require_program_editor)):
    _jenjang_or_404(jenjang_id)
    if body.day not in HARI:
        raise HTTPException(status_code=400, detail="Hari tidak valid")
    doc = {"_id": str(uuid.uuid4()), "jenjang_id": jenjang_id, "day": body.day,
           "start_time": body.start_time, "end_time": body.end_time,
           "teacher": (body.teacher or "").strip(), "location": (body.location or "").strip(),
           "note": (body.note or "").strip(), "created_at": now_wita().isoformat()}
    if body.guru_id:
        guru = await db.users.find_one({"_id": parse_object_id(body.guru_id)})
        if not guru or "guru" not in (guru.get("roles") or []):
            raise HTTPException(status_code=400, detail="Pengajar harus akun berperan Guru/Pengajar")
        doc["guru_id"] = str(guru["_id"])
        doc["teacher"] = doc["teacher"] or guru.get("name") or ""
    await db.program_jadwals.insert_one(doc)
    await log_activity(editor, "program_pembelajaran",
                       f"Menambah jadwal {body.day} {body.start_time} "
                       f"({JENJANG_BY_ID[jenjang_id]['label']})")
    return {"id": doc["_id"], **{k: doc.get(k) for k in
            ("day", "start_time", "end_time", "teacher", "guru_id", "location", "note")}}


@api_router.delete("/program/jadwal/{jadwal_id}")
async def delete_jadwal(jadwal_id: str, editor: dict = Depends(require_program_editor)):
    res = await db.program_jadwals.delete_one({"_id": jadwal_id})
    if not res.deleted_count:
        raise HTTPException(status_code=404, detail="Jadwal tidak ditemukan")
    await log_activity(editor, "program_pembelajaran", "Menghapus jadwal pembelajaran")
    return {"ok": True}


# ---------------------------------------------------------------------------
# GURU — cakupan data + pertemuan otomatis dari jadwal mingguan
# ---------------------------------------------------------------------------
def get_guru_scope(user: dict) -> dict:
    """Cakupan data area Guru.

    Administrator → "semua" (tanpa perlu terdaftar sebagai guru).
    Guru/Pengajar → hanya jadwal & pertemuan miliknya (guru_id).
    """
    roles = user.get("roles") or []
    if "admin" in roles:
        return {"mode": "semua", "guru_id": None, "is_admin": True}
    return {"mode": "guru", "guru_id": str(user["_id"]), "is_admin": False}


async def ensure_pertemuan(jadwal_id: Optional[str] = None, weeks: int = 2) -> int:
    """Buat pertemuan (kegiatan jenis Pembelajaran) 2 pekan ke depan secara LAZY.

    Idempotent: kunci unik (jadwal_id, date) — tidak pernah dobel. Tanpa cron.
    """
    query = {"_id": jadwal_id} if jadwal_id else {}
    jadwals = await db.program_jadwals.find(query).to_list(500)
    if not jadwals:
        return 0
    today = now_wita().date()
    created = 0
    for j in jadwals:
        if j.get("day") not in HARI:
            continue
        target_idx = HARI.index(j["day"])
        for offset in range(weeks * 7 + 1):
            d = today + timedelta(days=offset)
            if d.weekday() != target_idx:
                continue
            date_str = d.strftime("%Y-%m-%d")
            exists = await db.kegiatans.find_one({"jadwal_id": j["_id"], "date": date_str})
            if exists:
                continue
            jenjang = JENJANG_BY_ID.get(j.get("jenjang_id")) or {}
            guru = None
            if j.get("guru_id"):
                guru = await db.users.find_one({"_id": parse_object_id(j["guru_id"])})
            doc = {
                "_id": str(uuid.uuid4()),
                "name": f"Pembelajaran {jenjang.get('label') or 'Kelas'}",
                "base_name": f"Pembelajaran {jenjang.get('label') or 'Kelas'}",
                "type": "pembelajaran",
                "date": date_str,
                "start_time": j.get("start_time"),
                "end_time": j.get("end_time"),
                "teacher": (guru or {}).get("name") or j.get("teacher") or None,
                "location": j.get("location") or None,
                "audience": "reguler",
                "gender_filter": "semua",
                "marital_filter": "semua",
                "age_filter": [],
                "participant_ids": [],
                "status": "open",
                "closed_at": None,
                "auto_closed": False,
                "susulan": False,
                "share_token": None,
                "share_expires_at": None,
                "akses_token": secrets.token_urlsafe(9),
                "access_code": gen_access_code(),
                "access_code_at": datetime.now(timezone.utc).isoformat(),
                "absen_token": None,
                "absen_expires_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_by": "sistem",
                # Guru
                "jadwal_id": j["_id"],
                "materi_id": None,
                "materi_tersampaikan": False,
                "guru_id": j.get("guru_id"),
                "jenjang": j.get("jenjang_id"),
            }
            try:
                await db.kegiatans.insert_one(doc)
                created += 1
            except Exception:  # duplikat (index unik jadwal_id+date) → lewati
                continue
    return created


@api_router.get("/guru/scope")
async def guru_scope(user: dict = Depends(get_current_user)):
    """Cakupan area Guru + daftar pengajar (akun berperan guru)."""
    roles = user.get("roles") or []
    if not ({"admin", "guru"} & set(roles)):
        raise HTTPException(status_code=403, detail="Akses khusus Administrator dan Guru/Pengajar")
    scope = get_guru_scope(user)
    gurus = await db.users.find({"roles": "guru", "is_system": {"$ne": True}}) \
        .sort("name", 1).to_list(500)
    return {
        "scope": scope,
        "pengajar": [{"id": str(g["_id"]), "name": g.get("name")} for g in gurus],
        "tahun_ajaran": tahun_ajaran_info(),
        "jenjang": JENJANG,
    }


@api_router.get("/guru/pertemuan")
async def guru_pertemuan(user: dict = Depends(get_current_user)):
    """Pertemuan 2 pekan ke depan (dibuat lazy) sesuai cakupan pengguna."""
    roles = user.get("roles") or []
    if not ({"admin", "guru"} & set(roles)):
        raise HTTPException(status_code=403, detail="Akses khusus Administrator dan Guru/Pengajar")
    scope = get_guru_scope(user)
    if scope["mode"] == "guru":
        jadwal_ids = [j["_id"] for j in await db.program_jadwals
                      .find({"guru_id": scope["guru_id"]}).to_list(500)]
        for jid in jadwal_ids:
            await ensure_pertemuan(jid)
    else:
        await ensure_pertemuan()
    today = now_wita().date().strftime("%Y-%m-%d")
    query = {"type": "pembelajaran", "date": {"$gte": today}}
    if scope["mode"] == "guru":
        query["guru_id"] = scope["guru_id"]
    docs = await db.kegiatans.find(query).sort([("date", 1), ("start_time", 1)]).to_list(500)
    items = []
    for k in docs:
        row = serialize_kegiatan(k, await kegiatan_counts(k))
        izin = await _izin_aktif(k["_id"])
        if izin:
            row["izin"] = {"status": izin.get("status"),
                           "pengganti_nama": izin.get("pengganti_nama"),
                           "guru_nama": izin.get("guru_nama"),
                           "id": izin["_id"]}
        items.append(row)
    return {"scope": scope, "items": items}


@api_router.get("/guru/pertemuan/{kegiatan_id}/rekap")
async def guru_rekap_pertemuan(kegiatan_id: str, user: dict = Depends(get_current_user)):
    """Rekap absensi pertemuan — memakai ulang logika rekap admin."""
    roles = user.get("roles") or []
    if not ({"admin", "guru"} & set(roles)):
        raise HTTPException(status_code=403, detail="Akses khusus Administrator dan Guru/Pengajar")
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Pertemuan tidak ditemukan")
    scope = get_guru_scope(user)
    if scope["mode"] == "guru" and k.get("guru_id") != scope["guru_id"]:
        raise HTTPException(status_code=403, detail="Pertemuan ini bukan kelas Anda")
    return await rekap_kegiatan(kegiatan_id, user)


@api_router.post("/guru/pertemuan/{kegiatan_id}/absen")
async def guru_absen_pertemuan(kegiatan_id: str, body: AbsenInput,
                               user: dict = Depends(get_current_user)):
    """Tandai absensi peserta — memakai ulang logika absen admin."""
    roles = user.get("roles") or []
    if not ({"admin", "guru"} & set(roles)):
        raise HTTPException(status_code=403, detail="Akses khusus Administrator dan Guru/Pengajar")
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Pertemuan tidak ditemukan")
    scope = get_guru_scope(user)
    if scope["mode"] == "guru" and k.get("guru_id") != scope["guru_id"]:
        raise HTTPException(status_code=403, detail="Pertemuan ini bukan kelas Anda")
    return await mark_absen(kegiatan_id, body, user)


@api_router.get("/guru/kelas")
async def guru_kelas(user: dict = Depends(get_current_user)):
    """Kelas (jenjang) yang diampu + daftar peserta & persentase kehadiran."""
    roles = user.get("roles") or []
    if not ({"admin", "guru"} & set(roles)):
        raise HTTPException(status_code=403, detail="Akses khusus Administrator dan Guru/Pengajar")
    scope = get_guru_scope(user)
    jadwal_query = {} if scope["mode"] == "semua" else {"guru_id": scope["guru_id"]}
    jadwals = await db.program_jadwals.find(jadwal_query).to_list(500)
    jenjang_ids = list(dict.fromkeys(j.get("jenjang_id") for j in jadwals if j.get("jenjang_id")))
    if scope["mode"] == "semua" and not jenjang_ids:
        jenjang_ids = [j["id"] for j in JENJANG]
    out = []
    for jid in jenjang_ids:
        j = JENJANG_BY_ID.get(jid)
        if not j:
            continue
        keg_query = {"type": "pembelajaran", "jenjang": jid}
        if scope["mode"] == "guru":
            keg_query["guru_id"] = scope["guru_id"]
        kegs = await db.kegiatans.find(keg_query).sort([("date", -1)]).to_list(500)
        kid_ids = [k["_id"] for k in kegs]
        peserta = await db.users.find({**PESERTA_QUERY, "jenjang": jid}).sort("name", 1).to_list(2000)
        absens = await db.absensis.find({"kegiatan_id": {"$in": kid_ids}}).to_list(50000) if kid_ids else []
        by_user: dict = {}
        for a in absens:
            by_user.setdefault(a["user_id"], []).append(a)
        # Titik kecil: ada catatan "Perhatian" dalam 30 hari terakhir.
        batas_perhatian = (now_wita() - timedelta(days=30)).isoformat()
        perhatian_ids = set()
        async for c in db.catatan_peserta.find(
                {"jenjang": jid, "jenis": "perhatian",
                 "created_at": {"$gte": batas_perhatian}}, {"peserta_id": 1}):
            perhatian_ids.add(c.get("peserta_id"))
        rows = []
        for p in peserta:
            pid = str(p["_id"])
            mine = by_user.get(pid, [])
            hadir = len([a for a in mine if a.get("status") == "hadir"])
            total = len(kid_ids)
            ratio = round((hadir / total) * 100) if total else 0
            # 3 pertemuan terakhir tidak hadir (alpha / belum diabsen)
            last3 = kegs[:3]
            absent3 = bool(last3) and all(
                next((a.get("status") for a in mine if a.get("kegiatan_id") == k["_id"]), None) != "hadir"
                for k in last3)
            rows.append({"user_id": pid, "name": p.get("name"), "ratio": ratio,
                         "hadir": hadir, "total": total, "tidak_hadir_3x": absent3,
                         "perhatian_30h": pid in perhatian_ids})
        out.append({"jenjang": jid, "label": j.get("label"), "peserta": rows,
                    "total_peserta": len(rows),
                    "pertemuan_terlaksana": len([k for k in kegs
                                                 if (k.get("date") or "") <= now_wita().strftime("%Y-%m-%d")])})
    return {"scope": scope, "items": out}


@api_router.get("/guru/pertemuan/{kegiatan_id}/pokok-bahasan")
async def guru_pokok_bahasan(kegiatan_id: str, user: dict = Depends(get_current_user)):
    """Pokok bahasan pertemuan + sampai 5 pokok bahasan terakhir kelas itu."""
    roles = user.get("roles") or []
    if not ({"admin", "guru"} & set(roles)):
        raise HTTPException(status_code=403, detail="Akses khusus Administrator dan Guru/Pengajar")
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Pertemuan tidak ditemukan")
    scope = get_guru_scope(user)
    if scope["mode"] == "guru" and k.get("guru_id") != scope["guru_id"]:
        raise HTTPException(status_code=403, detail="Pertemuan ini bukan kelas Anda")
    jenjang = k.get("jenjang")
    terakhir = []
    if jenjang:
        q = {"jenjang": jenjang, "pokok_bahasan": {"$nin": [None, ""]}}
        if scope["mode"] == "guru":
            q["guru_id"] = scope["guru_id"]
        async for row in db.kegiatans.find(q).sort([("date", -1), ("start_time", -1)]):
            val = (row.get("pokok_bahasan") or "").strip()
            if val and val not in terakhir:
                terakhir.append(val)
            if len(terakhir) >= 5:
                break
    return {"kegiatan_id": kegiatan_id,
            "pokok_bahasan": k.get("pokok_bahasan") or "",
            "terakhir": terakhir}


class PokokBahasanInput(BaseModel):
    pokok_bahasan: Optional[str] = None


@api_router.post("/guru/pertemuan/{kegiatan_id}/pokok-bahasan")
async def guru_simpan_pokok_bahasan(kegiatan_id: str, body: PokokBahasanInput,
                                    user: dict = Depends(get_current_user)):
    """Simpan pokok bahasan (opsional, maks 120 karakter) pada pertemuan."""
    roles = user.get("roles") or []
    if not ({"admin", "guru"} & set(roles)):
        raise HTTPException(status_code=403, detail="Akses khusus Administrator dan Guru/Pengajar")
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Pertemuan tidak ditemukan")
    scope = get_guru_scope(user)
    if scope["mode"] == "guru" and k.get("guru_id") != scope["guru_id"]:
        raise HTTPException(status_code=403, detail="Pertemuan ini bukan kelas Anda")
    val = (body.pokok_bahasan or "").strip()[:120] or None
    await db.kegiatans.update_one({"_id": kegiatan_id}, {"$set": {"pokok_bahasan": val}})
    return {"ok": True, "pokok_bahasan": val}


@api_router.get("/guru/ringkasan")
async def guru_ringkasan(user: dict = Depends(get_current_user)):
    """Ringkasan: pertemuan terlaksana bulan ini + kehadiran rata-rata."""
    roles = user.get("roles") or []
    if not ({"admin", "guru"} & set(roles)):
        raise HTTPException(status_code=403, detail="Akses khusus Administrator dan Guru/Pengajar")
    scope = get_guru_scope(user)
    jadwal_query = {} if scope["mode"] == "semua" else {"guru_id": scope["guru_id"]}
    jadwals = await db.program_jadwals.find(jadwal_query).to_list(500)
    jenjang_ids = list(dict.fromkeys(j.get("jenjang_id") for j in jadwals if j.get("jenjang_id")))
    if scope["mode"] == "semua" and not jenjang_ids:
        jenjang_ids = [j["id"] for j in JENJANG]
    keg_query = {"type": "pembelajaran", "jenjang": {"$in": jenjang_ids}}
    if scope["mode"] == "guru":
        keg_query["guru_id"] = scope["guru_id"]
    kegs = await db.kegiatans.find(keg_query).to_list(2000) if jenjang_ids else []
    now = now_wita()
    bulan = now.strftime("%Y-%m")
    hari_ini = now.strftime("%Y-%m-%d")
    terlaksana = len([k for k in kegs if (k.get("date") or "")[:7] == bulan
                      and (k.get("date") or "") <= hari_ini])
    kid_ids = [k["_id"] for k in kegs]
    absens = await db.absensis.find({"kegiatan_id": {"$in": kid_ids}}).to_list(50000) if kid_ids else []
    hadir = len([a for a in absens if a.get("status") == "hadir"])
    total_absen = len(absens)
    rata = round((hadir / total_absen) * 100) if total_absen else 0
    return {"scope": scope,
            "pertemuan": {"terlaksana_bulan_ini": terlaksana},
            "kehadiran": {"rata_rata": rata, "hadir": hadir, "tercatat": total_absen}}


# ---------------------------------------------------------------------------
# Catatan Peserta (privat: guru kelas + administrator saja)
# ---------------------------------------------------------------------------
CATATAN_JENIS = ("perhatian", "perkembangan", "catatan")
CATATAN_MAX = 300


class CatatanInput(BaseModel):
    peserta_id: str
    jenis: str = "catatan"
    isi: str


def _guru_jenjang_ids(scope: dict, jadwals: list) -> list:
    ids = list(dict.fromkeys(j.get("jenjang_id") for j in jadwals if j.get("jenjang_id")))
    if scope["mode"] == "semua" and not ids:
        ids = [j["id"] for j in JENJANG]
    return ids


async def _guru_scope_jenjang(user: dict) -> tuple:
    """(scope, daftar jenjang yang boleh diakses guru/admin)."""
    scope = get_guru_scope(user)
    q = {} if scope["mode"] == "semua" else {"guru_id": scope["guru_id"]}
    jadwals = await db.program_jadwals.find(q).to_list(500)
    return scope, _guru_jenjang_ids(scope, jadwals)


def _require_guru(user: dict) -> None:
    roles = user.get("roles") or []
    if not ({"admin", "guru"} & set(roles)):
        raise HTTPException(status_code=403, detail="Akses khusus Administrator dan Guru/Pengajar")


def serialize_catatan(c: dict, nama: Optional[str] = None) -> dict:
    return {"id": c["_id"], "peserta_id": c.get("peserta_id"),
            "peserta_nama": nama, "guru_id": c.get("guru_id"),
            "guru_nama": c.get("guru_nama"), "jenjang": c.get("jenjang"),
            "jenis": c.get("jenis", "catatan"), "isi": c.get("isi"),
            "created_at": c.get("created_at")}


@api_router.get("/guru/catatan")
async def guru_catatan(user: dict = Depends(get_current_user), jenjang: str = "",
                       peserta_id: str = "", limit: int = 100):
    """Riwayat catatan peserta — hanya guru kelas itu dan Administrator."""
    _require_guru(user)
    scope, jenjang_ids = await _guru_scope_jenjang(user)
    q: dict = {}
    if scope["mode"] == "guru":
        q["jenjang"] = {"$in": jenjang_ids}
    if jenjang.strip():
        if scope["mode"] == "guru" and jenjang.strip() not in jenjang_ids:
            raise HTTPException(status_code=403, detail="Kelas ini bukan kelas Anda")
        q["jenjang"] = jenjang.strip()
    if peserta_id.strip():
        q["peserta_id"] = peserta_id.strip()
    limit = max(1, min(limit, 300))
    items = await db.catatan_peserta.find(q).sort("created_at", -1).to_list(limit)
    pids = list({c.get("peserta_id") for c in items if c.get("peserta_id")})
    nama = {}
    if pids:
        async for u in db.users.find({"_id": {"$in": pids}}, {"name": 1}):
            nama[str(u["_id"])] = u.get("name")
    return {"scope": scope, "jenjang": jenjang_ids,
            "rows": [serialize_catatan(c, nama.get(c.get("peserta_id"))) for c in items]}


@api_router.post("/guru/catatan")
async def guru_simpan_catatan(body: CatatanInput, user: dict = Depends(get_current_user)):
    _require_guru(user)
    scope, jenjang_ids = await _guru_scope_jenjang(user)
    jenis = (body.jenis or "catatan").strip()
    if jenis not in CATATAN_JENIS:
        raise HTTPException(status_code=400, detail="Jenis catatan tidak valid")
    isi = (body.isi or "").strip()
    if not isi:
        raise HTTPException(status_code=400, detail="Isi catatan tidak boleh kosong")
    peserta = await db.users.find_one({"_id": body.peserta_id})
    if not peserta:
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan")
    jenjang = peserta.get("jenjang")
    if scope["mode"] == "guru" and jenjang not in jenjang_ids:
        raise HTTPException(status_code=403, detail="Peserta ini bukan dari kelas Anda")
    doc = {"_id": str(uuid.uuid4()), "peserta_id": body.peserta_id,
           "guru_id": str(user["_id"]), "guru_nama": user.get("name"),
           "jenjang": jenjang, "jenis": jenis, "isi": isi[:CATATAN_MAX],
           "created_at": now_wita().isoformat()}
    await db.catatan_peserta.insert_one(doc)
    return serialize_catatan(doc, peserta.get("name"))


@api_router.delete("/guru/catatan/{catatan_id}")
async def guru_hapus_catatan(catatan_id: str, user: dict = Depends(get_current_user)):
    """Guru hanya boleh menghapus catatannya sendiri; Administrator boleh semua."""
    _require_guru(user)
    c = await db.catatan_peserta.find_one({"_id": catatan_id})
    if not c:
        raise HTTPException(status_code=404, detail="Catatan tidak ditemukan")
    if "admin" not in (user.get("roles") or []) and c.get("guru_id") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Hanya catatan Anda sendiri yang bisa dihapus")
    await db.catatan_peserta.delete_one({"_id": catatan_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Tugas ke WhatsApp wali
# ---------------------------------------------------------------------------
TUGAS_JUDUL_MAX = 100
TUGAS_LINK_DAYS = 7


class TugasInput(BaseModel):
    jenjang: str
    judul: str
    keterangan: Optional[str] = None
    batas_kumpul: str


def _nama_depan(nama: Optional[str]) -> str:
    return (str(nama or "").strip().split(" ")[0] or "Ananda")


def _tugas_status(row: dict, ada_nomor: bool) -> str:
    if row.get("dikumpul_at"):
        return "kumpul"
    if row.get("wa_dibuka_at") or row.get("dibuka_at"):
        return "dibuka"
    return "belum" if ada_nomor else "tanpa_nomor"


@api_router.get("/guru/tugas")
async def guru_tugas(user: dict = Depends(get_current_user), jenjang: str = ""):
    """Daftar tugas kelas guru + antrean kirim per peserta."""
    _require_guru(user)
    scope, jenjang_ids = await _guru_scope_jenjang(user)
    q: dict = {}
    if scope["mode"] == "guru":
        q["jenjang"] = {"$in": jenjang_ids}
    if jenjang.strip():
        if scope["mode"] == "guru" and jenjang.strip() not in jenjang_ids:
            raise HTTPException(status_code=403, detail="Kelas ini bukan kelas Anda")
        q["jenjang"] = jenjang.strip()
    tugas_list = await db.tugas.find(q).sort("created_at", -1).to_list(100)
    out = []
    for t in tugas_list:
        rows = await db.tugas_peserta.find({"tugas_id": t["_id"]}).to_list(2000)
        pids = [r.get("peserta_id") for r in rows if r.get("peserta_id")]
        users = {}
        if pids:
            async for u in db.users.find({"_id": {"$in": pids}},
                                         {"name": 1, "nomor_wa_wali": 1}):
                users[str(u["_id"])] = u
        antrean = []
        for r in rows:
            u = users.get(r.get("peserta_id")) or {}
            nomor = normalize_wa_wali(u.get("nomor_wa_wali"))
            antrean.append({
                "peserta_id": r.get("peserta_id"),
                "nama": u.get("name"),
                "nama_depan": _nama_depan(u.get("name")),
                "nomor_wa": nomor,
                "token": r.get("token"),
                "status": _tugas_status(r, bool(nomor)),
                "dikumpul_at": r.get("dikumpul_at"),
            })
        antrean.sort(key=lambda x: (x["nama"] or "").lower())
        kumpul = len([a for a in antrean if a["status"] == "kumpul"])
        out.append({"id": t["_id"], "jenjang": t.get("jenjang"),
                    "judul": t.get("judul"), "keterangan": t.get("keterangan"),
                    "batas_kumpul": t.get("batas_kumpul"),
                    "created_at": t.get("created_at"),
                    "total": len(antrean), "kumpul": kumpul, "antrean": antrean})
    return {"scope": scope, "jenjang": jenjang_ids, "items": out}


@api_router.post("/guru/tugas")
async def guru_simpan_tugas(body: TugasInput, user: dict = Depends(get_current_user)):
    """Simpan tugas + satu baris tugas_peserta (token acak) per peserta kelas."""
    _require_guru(user)
    scope, jenjang_ids = await _guru_scope_jenjang(user)
    jenjang = (body.jenjang or "").strip()
    if scope["mode"] == "guru" and jenjang not in jenjang_ids:
        raise HTTPException(status_code=403, detail="Kelas ini bukan kelas Anda")
    if jenjang not in JENJANG_BY_ID:
        raise HTTPException(status_code=400, detail="Kelas tidak valid")
    judul = (body.judul or "").strip()
    if not judul:
        raise HTTPException(status_code=400, detail="Judul tugas tidak boleh kosong")
    batas = (body.batas_kumpul or "").strip()
    try:
        datetime.strptime(batas, "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=400, detail="Batas kumpul harus tanggal YYYY-MM-DD")
    tugas_id = str(uuid.uuid4())
    await db.tugas.insert_one({
        "_id": tugas_id, "guru_id": str(user["_id"]), "guru_nama": user.get("name"),
        "jenjang": jenjang, "judul": judul[:TUGAS_JUDUL_MAX],
        "keterangan": (body.keterangan or "").strip()[:1000] or None,
        "batas_kumpul": batas, "created_at": now_wita().isoformat()})
    peserta = await db.users.find({**PESERTA_QUERY, "jenjang": jenjang}).to_list(2000)
    rows = [{"_id": str(uuid.uuid4()), "tugas_id": tugas_id,
             "peserta_id": str(p["_id"]), "token": secrets.token_urlsafe(16),
             "dibuka_at": None, "wa_dibuka_at": None, "dikumpul_at": None}
            for p in peserta]
    if rows:
        await db.tugas_peserta.insert_many(rows)
    return {"id": tugas_id, "total": len(rows)}


@api_router.post("/guru/tugas/{tugas_id}/peserta/{peserta_id}/wa-dibuka")
async def guru_tugas_wa_dibuka(tugas_id: str, peserta_id: str,
                               user: dict = Depends(get_current_user)):
    """Catat bahwa guru sudah membuka WhatsApp untuk peserta ini."""
    _require_guru(user)
    scope, jenjang_ids = await _guru_scope_jenjang(user)
    t = await db.tugas.find_one({"_id": tugas_id})
    if not t:
        raise HTTPException(status_code=404, detail="Tugas tidak ditemukan")
    if scope["mode"] == "guru" and t.get("jenjang") not in jenjang_ids:
        raise HTTPException(status_code=403, detail="Tugas ini bukan kelas Anda")
    await db.tugas_peserta.update_one(
        {"tugas_id": tugas_id, "peserta_id": peserta_id},
        {"$set": {"wa_dibuka_at": now_wita().isoformat()}})
    return {"ok": True}


@api_router.get("/tugas/{token}")
async def public_tugas(token: str):
    """Halaman publik tugas (tanpa login). Hanya nama depan + data tugas."""
    row = await db.tugas_peserta.find_one({"token": token})
    if not row:
        raise HTTPException(status_code=404, detail="Tautan tugas tidak ditemukan")
    t = await db.tugas.find_one({"_id": row.get("tugas_id")})
    if not t:
        raise HTTPException(status_code=404, detail="Tautan tugas tidak ditemukan")
    peserta = await db.users.find_one({"_id": row.get("peserta_id")}, {"name": 1})
    if not row.get("dibuka_at"):
        await db.tugas_peserta.update_one({"_id": row["_id"]},
                                          {"$set": {"dibuka_at": now_wita().isoformat()}})
    try:
        batas = datetime.strptime(t.get("batas_kumpul"), "%Y-%m-%d").replace(tzinfo=WITA)
    except Exception:
        batas = None
    berlaku = bool(batas and now_wita() <= batas + timedelta(days=TUGAS_LINK_DAYS))
    body = {
        "nama_depan": _nama_depan((peserta or {}).get("name")),
        "judul": t.get("judul"), "keterangan": t.get("keterangan"),
        "batas_kumpul": t.get("batas_kumpul"),
        "sudah_kumpul": bool(row.get("dikumpul_at")),
        "berlaku": berlaku,
    }
    return JSONResponse(content=body, headers={
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "no-store",
    })


@api_router.post("/tugas/{token}/kumpul")
async def public_tugas_kumpul(token: str):
    row = await db.tugas_peserta.find_one({"token": token})
    if not row:
        raise HTTPException(status_code=404, detail="Tautan tugas tidak ditemukan")
    t = await db.tugas.find_one({"_id": row.get("tugas_id")})
    try:
        batas = datetime.strptime((t or {}).get("batas_kumpul"), "%Y-%m-%d").replace(tzinfo=WITA)
    except Exception:
        batas = None
    if not batas or now_wita() > batas + timedelta(days=TUGAS_LINK_DAYS):
        raise HTTPException(status_code=410, detail="Tautan sudah tidak berlaku.")
    if not row.get("dikumpul_at"):
        await db.tugas_peserta.update_one(
            {"_id": row["_id"]}, {"$set": {"dikumpul_at": now_wita().isoformat()}})
    return {"ok": True, "sudah_kumpul": True}


# ---------------------------------------------------------------------------
# Orang tua / wali ↔ anak (tabel `wali_anak`)
# ---------------------------------------------------------------------------
GENERUS_JENJANG = {"paud", *{f"cabe{i}" for i in range(1, 7)},
                   "pra_remaja", "remaja",
                   *{f"pra_nikah{i}" for i in range(1, 5)}}
HUBUNGAN_WALI = ("ayah", "ibu", "wali")


def is_generus(user: dict) -> bool:
    """Generus = peserta berjenjang PAUD … Pra Nikah 4 (termasuk saran dari umur)."""
    jenjang = user.get("jenjang") or saran_jenjang(user.get("dob"))
    return jenjang in GENERUS_JENJANG


def kategori_dari_status(status) -> Optional[str]:
    """Satu sumber kebenaran kategori peserta.

    Belum menikah = "generus"; Sudah/Pernah menikah = "dewasa".
    Nilai kosong/tidak dikenal = None (jangan diubah).
    """
    s = re.sub(r"\s+", "_", str(status or "").strip().lower())
    if not s:
        return None
    if s in ("belum_menikah", "belum_menikah."):
        return "generus"
    if s in ("sudah_menikah", "pernah_menikah"):
        return "dewasa"
    return None


def _id_varian(value) -> list:
    """Varian ID untuk query: ObjectId dan string-nya (data lama & baru)."""
    if value is None:
        return []
    teks = str(value)
    out = [teks]
    try:
        oid = ObjectId(teks)
        out.append(oid)
    except Exception:
        pass
    return out


def _wali_doc(anak_id: str, wali_id: str, hubungan: str, oleh: dict) -> dict:
    return {"_id": str(uuid.uuid4()), "anak_id": anak_id, "wali_id": wali_id,
            "hubungan": hubungan, "dibuat_oleh": str(oleh["_id"]),
            "dibuat_at": now_wita().isoformat()}


async def _wali_rows(anak_id: str) -> list:
    # `anak_id` bisa tersimpan sebagai ObjectId (impor) atau string (taut manual).
    rows = await db.wali_anak.find({"anak_id": {"$in": _id_varian(anak_id)}}).to_list(10)
    out = []
    for r in rows:
        wali = await db.users.find_one({"_id": {"$in": _id_varian(r.get("wali_id"))}},
                                       {"name": 1, "phone": 1})
        out.append({"id": r["_id"], "hubungan": r.get("hubungan"),
                    "wali_id": r.get("wali_id"),
                    "wali_nama": (wali or {}).get("name"),
                    "wali_phone": (wali or {}).get("phone")})
    return out


@api_router.get("/admin/users/{user_id}/wali")
async def admin_wali_anak(user_id: str, staff: dict = Depends(require_staff)):
    """Tiga baris Ayah/Ibu/Wali + saran dari Nomor WA wali anak."""
    anak = await db.users.find_one({"_id": {"$in": _id_varian(user_id)}})
    if not anak:
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan")
    rows = await _wali_rows(user_id)
    terisi = {r["hubungan"]: r for r in rows}
    saran = None
    nomor = normalize_wa_wali(anak.get("nomor_wa_wali"))
    if nomor:
        kandidat = await db.users.find(
            {"phone": nomor, "_id": {"$nin": _id_varian(user_id)},
             "is_system": {"$ne": True}},
            {"name": 1, "phone": 1}).to_list(5)
        if len(kandidat) == 1:
            saran = {"wali_id": str(kandidat[0]["_id"]), "nama": kandidat[0].get("name")}
    return {"anak_id": user_id, "anak_nama": anak.get("name"),
            "generus": is_generus(anak),
            "rows": [{"hubungan": h, **(terisi.get(h) or {})} for h in HUBUNGAN_WALI],
            "saran": saran}


class WaliAnakInput(BaseModel):
    wali_id: str
    hubungan: str


@api_router.post("/admin/users/{user_id}/wali")
async def admin_tautkan_wali(user_id: str, body: WaliAnakInput,
                             staff: dict = Depends(require_staff)):
    """Tautkan akun peserta sebagai Ayah/Ibu/Wali anak (tanpa kode/persetujuan)."""
    hubungan = (body.hubungan or "").strip()
    if hubungan not in HUBUNGAN_WALI:
        raise HTTPException(status_code=400, detail="Hubungan tidak valid")
    if body.wali_id == user_id:
        raise HTTPException(status_code=400, detail="Anak dan wali tidak boleh akun yang sama")
    anak = await db.users.find_one({"_id": {"$in": _id_varian(user_id)}})
    wali = await db.users.find_one({"_id": {"$in": _id_varian(body.wali_id)}})
    if not anak or not wali:
        raise HTTPException(status_code=404, detail="Akun tidak ditemukan")
    lama = await db.wali_anak.find_one(
        {"anak_id": {"$in": _id_varian(user_id)}, "hubungan": hubungan})
    if lama and lama.get("wali_id") != body.wali_id:
        raise HTTPException(status_code=409,
                            detail="Hubungan ini sudah terisi akun lain. Lepas terlebih dahulu.")
    if not lama:
        await db.wali_anak.insert_one(_wali_doc(user_id, body.wali_id, hubungan, staff))
    await log_activity(staff, "tautkan_wali",
                       f"Menautkan {wali.get('name')} sebagai {hubungan} dari {anak.get('name')}",
                       user_id)
    return {"ok": True, "rows": await _wali_rows(user_id)}


@api_router.delete("/admin/users/{user_id}/wali/{hubungan}")
async def admin_lepas_wali(user_id: str, hubungan: str, staff: dict = Depends(require_staff)):
    if hubungan not in HUBUNGAN_WALI:
        raise HTTPException(status_code=400, detail="Hubungan tidak valid")
    res = await db.wali_anak.delete_one(
        {"anak_id": {"$in": _id_varian(user_id)}, "hubungan": hubungan})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tautan tidak ditemukan")
    await log_activity(staff, "lepas_wali", f"Melepas tautan {hubungan}", user_id)
    return {"ok": True, "rows": await _wali_rows(user_id)}


@api_router.get("/admin/wali-anak")
async def admin_wali_map(staff: dict = Depends(require_staff)):
    """Peta anak → hubungan wali (untuk chip status wali di daftar peserta)."""
    rows = await db.wali_anak.find().to_list(20000)
    return [{"anak_id": r.get("anak_id"), "hubungan": r.get("hubungan"),
             "wali_id": r.get("wali_id")} for r in rows]


@api_router.get("/me/anak")
async def my_anak(user: dict = Depends(get_current_user)):
    """Anak saya — hanya anak yang tertaut ke akun yang login (wali_anak.wali_id)."""
    uid = str(user["_id"])
    links = await db.wali_anak.find({"wali_id": {"$in": _id_varian(uid)}}).to_list(50)
    if not links:
        return {"items": []}
    now = now_wita()
    bulan = now.strftime("%Y-%m")
    items = []
    for link in links:
        anak_id = link.get("anak_id")
        anak = await db.users.find_one({"_id": {"$in": _id_varian(anak_id)}},
                                       {"name": 1, "jenjang": 1})
        if not anak:
            continue
        # Kehadiran bulan ini: hanya kegiatan yang sudah berlangsung, sesi digabung.
        date_from = f"{bulan}-01"
        date_to = now.strftime("%Y-%m-%d")
        rows, _ = await build_peserta_attendance_rows(date_from, date_to)
        ringkas = rows.get(anak_id) or {"hadir": 0, "total_pertemuan": 0, "ratio": 0.0}
        # Lima pertemuan terakhir (yang sudah berlangsung).
        kegs = await db.kegiatans.find(
            {"date": {"$lte": date_to}}).sort([("date", -1), ("start_time", -1)]).to_list(500)
        peserta_all = await db.users.find(PESERTA_QUERY).to_list(10000)
        absens = await db.absensis.find({"user_id": anak_id}).to_list(5000)
        status_by = {(a["kegiatan_id"], a["user_id"]): a.get("status") for a in absens}
        elig_by_doc = {k["_id"]: {str(p["_id"]) for p in filter_peserta_for_kegiatan(k, peserta_all)}
                       for k in kegs}
        terakhir = []
        for mt in group_pertemuan(kegs):
            if not any(kegiatan_sudah_berlangsung(d, now) for d in mt["docs"]):
                continue
            st = pertemuan_status(mt, anak_id, status_by, elig_by_doc)
            if st is None:
                continue
            terakhir.append({"date": mt["date"], "name": mt["name"], "status": st})
            if len(terakhir) >= 5:
                break
        # Tugas dari guru (bila tabel tugas sudah ada) — tanpa token.
        tugas_rows = await db.tugas_peserta.find({"peserta_id": anak_id}).to_list(200)
        tugas = []
        for tr in tugas_rows:
            t = await db.tugas.find_one({"_id": tr.get("tugas_id")})
            if not t:
                continue
            tugas.append({"judul": t.get("judul"), "batas_kumpul": t.get("batas_kumpul"),
                          "sudah": bool(tr.get("dikumpul_at"))})
        tugas.sort(key=lambda x: x.get("batas_kumpul") or "", reverse=True)
        items.append({
            "id": anak_id, "nama": anak.get("name"), "jenjang": anak.get("jenjang"),
            "hubungan": link.get("hubungan"),
            "kehadiran": {"hadir": ringkas["hadir"],
                          "total": ringkas["total_pertemuan"],
                          "ratio": ringkas["ratio"]},
            "terakhir": terakhir,
            "tugas": tugas[:10],
            "pengumuman": await _pengumuman_untuk_jenjang(anak.get("jenjang"), 2),
        })
    return {"items": items}


# ---------------------------------------------------------------------------
# Pengumuman Kelas (guru → peserta jenjang)
# ---------------------------------------------------------------------------
PENGUMUMAN_JUDUL_MAX = 80
PENGUMUMAN_ISI_MAX = 500


def serialize_pengumuman_kelas(p: dict) -> dict:
    return {"id": p["_id"], "guru_id": p.get("guru_id"), "guru_nama": p.get("guru_nama"),
            "jenjang": p.get("jenjang"),
            "jenjang_label": (JENJANG_BY_ID.get(p.get("jenjang")) or {}).get("label"),
            "judul": p.get("judul"), "isi": p.get("isi"),
            "berlaku_sampai": p.get("berlaku_sampai"),
            "dibuat_at": p.get("dibuat_at")}


def _pengumuman_aktif_query(jenjang: str) -> dict:
    today = now_wita().strftime("%Y-%m-%d")
    return {"jenjang": jenjang, "dihapus_at": None,
            "$or": [{"berlaku_sampai": None}, {"berlaku_sampai": {"$gte": today}}]}


async def _pengumuman_untuk_jenjang(jenjang: Optional[str], limit: int = 2) -> list:
    """Pengumuman kelas yang masih berlaku untuk satu jenjang (terbaru dulu)."""
    if not jenjang:
        return []
    docs = await db.pengumuman_kelas.find(_pengumuman_aktif_query(jenjang)) \
        .sort("dibuat_at", -1).to_list(limit)
    return [serialize_pengumuman_kelas(p) for p in docs]


class PengumumanKelasInput(BaseModel):
    jenjang: List[str] = []
    judul: str
    isi: str
    berlaku_sampai: Optional[str] = None


@api_router.get("/guru/pengumuman")
async def guru_pengumuman(user: dict = Depends(get_current_user)):
    """Daftar pengumuman kelas. Guru: miliknya; Administrator/Pengurus: semua."""
    _require_guru(user)
    scope, jenjang_ids = await _guru_scope_jenjang(user)
    q: dict = {"dihapus_at": None}
    if scope["mode"] == "guru":
        q["guru_id"] = scope["guru_id"]
    docs = await db.pengumuman_kelas.find(q).sort("dibuat_at", -1).to_list(300)
    return {"scope": scope, "jenjang": jenjang_ids,
            "items": [serialize_pengumuman_kelas(p) for p in docs]}


@api_router.post("/guru/pengumuman")
async def guru_buat_pengumuman(body: PengumumanKelasInput,
                               user: dict = Depends(get_current_user)):
    """Buat pengumuman untuk satu atau beberapa kelas yang diajar guru itu."""
    _require_guru(user)
    scope, jenjang_ids = await _guru_scope_jenjang(user)
    judul = (body.judul or "").strip()
    isi = (body.isi or "").strip()
    if not judul:
        raise HTTPException(status_code=400, detail="Judul pengumuman wajib diisi")
    if not isi:
        raise HTTPException(status_code=400, detail="Isi pengumuman wajib diisi")
    target = [j for j in dict.fromkeys(body.jenjang or []) if j]
    if not target:
        raise HTTPException(status_code=400, detail="Pilih minimal satu kelas")
    for j in target:
        if j not in JENJANG_BY_ID:
            raise HTTPException(status_code=400, detail="Kelas tidak valid")
        if scope["mode"] == "guru" and j not in jenjang_ids:
            raise HTTPException(status_code=403, detail="Kelas ini bukan kelas Anda")
    berlaku = (body.berlaku_sampai or "").strip() or None
    if berlaku:
        try:
            datetime.strptime(berlaku, "%Y-%m-%d")
        except Exception:
            raise HTTPException(status_code=400, detail="Tanggal berlaku harus YYYY-MM-DD")
    dibuat = now_wita().isoformat()
    ids = []
    for j in target:
        pid = str(uuid.uuid4())
        await db.pengumuman_kelas.insert_one({
            "_id": pid, "guru_id": str(user["_id"]), "guru_nama": user.get("name"),
            "jenjang": j, "judul": judul[:PENGUMUMAN_JUDUL_MAX],
            "isi": isi[:PENGUMUMAN_ISI_MAX], "berlaku_sampai": berlaku,
            "dibuat_at": dibuat, "dihapus_at": None})
        ids.append(pid)
    return {"ok": True, "ids": ids, "count": len(ids)}


@api_router.patch("/guru/pengumuman/{pengumuman_id}")
async def guru_ubah_pengumuman(pengumuman_id: str, body: PengumumanKelasInput,
                               user: dict = Depends(get_current_user)):
    _require_guru(user)
    p = await db.pengumuman_kelas.find_one({"_id": pengumuman_id, "dihapus_at": None})
    if not p:
        raise HTTPException(status_code=404, detail="Pengumuman tidak ditemukan")
    if "admin" not in (user.get("roles") or []) and p.get("guru_id") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Hanya pengumuman Anda sendiri yang bisa diubah")
    judul = (body.judul or "").strip()
    isi = (body.isi or "").strip()
    if not judul or not isi:
        raise HTTPException(status_code=400, detail="Judul dan isi wajib diisi")
    berlaku = (body.berlaku_sampai or "").strip() or None
    if berlaku:
        try:
            datetime.strptime(berlaku, "%Y-%m-%d")
        except Exception:
            raise HTTPException(status_code=400, detail="Tanggal berlaku harus YYYY-MM-DD")
    await db.pengumuman_kelas.update_one({"_id": pengumuman_id}, {"$set": {
        "judul": judul[:PENGUMUMAN_JUDUL_MAX], "isi": isi[:PENGUMUMAN_ISI_MAX],
        "berlaku_sampai": berlaku}})
    doc = await db.pengumuman_kelas.find_one({"_id": pengumuman_id})
    return serialize_pengumuman_kelas(doc)


@api_router.delete("/guru/pengumuman/{pengumuman_id}")
async def guru_hapus_pengumuman(pengumuman_id: str, user: dict = Depends(get_current_user)):
    """Hapus lunak (isi dihapus_at). Administrator/Pengurus boleh semua."""
    roles = user.get("roles") or []
    if not ({"admin", "pengurus", "guru"} & set(roles)):
        raise HTTPException(status_code=403, detail="Akses khusus guru, pengurus, dan administrator")
    p = await db.pengumuman_kelas.find_one({"_id": pengumuman_id, "dihapus_at": None})
    if not p:
        raise HTTPException(status_code=404, detail="Pengumuman tidak ditemukan")
    if not ({"admin", "pengurus"} & set(roles)) and p.get("guru_id") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Hanya pengumuman Anda sendiri yang bisa dihapus")
    await db.pengumuman_kelas.update_one({"_id": pengumuman_id},
                                         {"$set": {"dihapus_at": now_wita().isoformat()}})
    return {"ok": True}


@api_router.get("/me/pengumuman-kelas")
async def my_pengumuman_kelas(user: dict = Depends(get_current_user)):
    """Pengumuman kelas untuk jenjang peserta yang login (hanya baca)."""
    return {"items": await _pengumuman_untuk_jenjang(user.get("jenjang"), 20)}


# ---------------------------------------------------------------------------
# Izin guru + guru pengganti
# ---------------------------------------------------------------------------
IZIN_STATUS = ("menunggu", "diterima", "ditolak", "tanpa_pengganti", "batal")


def serialize_izin(i: dict, k: Optional[dict] = None) -> dict:
    k = k or {}
    return {"id": i["_id"], "kegiatan_id": i.get("kegiatan_id"),
            "guru_id": i.get("guru_id"), "guru_nama": i.get("guru_nama"),
            "alasan": i.get("alasan"), "pengganti_id": i.get("pengganti_id"),
            "pengganti_nama": i.get("pengganti_nama"), "status": i.get("status"),
            "dibuat_at": i.get("dibuat_at"), "diputuskan_at": i.get("diputuskan_at"),
            "kelas": k.get("name"), "jenjang": k.get("jenjang"),
            "date": k.get("date"), "start_time": k.get("start_time"),
            "end_time": k.get("end_time"), "location": k.get("location")}


async def _izin_aktif(kegiatan_id: str) -> Optional[dict]:
    return await db.izin_guru.find_one(
        {"kegiatan_id": kegiatan_id, "status": {"$in": ["menunggu", "diterima", "tanpa_pengganti"]}})


class IzinGuruInput(BaseModel):
    alasan: Optional[str] = None
    pengganti_id: Optional[str] = None


@api_router.post("/guru/pertemuan/{kegiatan_id}/izin")
async def guru_ajukan_izin(kegiatan_id: str, body: IzinGuruInput,
                           user: dict = Depends(get_current_user)):
    """Guru pemilik pertemuan mengajukan izin (dengan atau tanpa pengganti)."""
    _require_guru(user)
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Pertemuan tidak ditemukan")
    if k.get("guru_id") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Hanya guru pemilik pertemuan yang bisa mengajukan izin")
    if kegiatan_sudah_berlangsung(k):
        raise HTTPException(status_code=400, detail="Pertemuan sudah berlangsung")
    if await _izin_aktif(kegiatan_id):
        raise HTTPException(status_code=409, detail="Sudah ada izin aktif untuk pertemuan ini")
    pengganti_id = (body.pengganti_id or "").strip() or None
    pengganti_nama = None
    if pengganti_id:
        if pengganti_id == str(user["_id"]):
            raise HTTPException(status_code=400, detail="Tidak bisa menggantikan diri sendiri")
        g = await db.users.find_one({"_id": pengganti_id, "roles": "guru"})
        if not g:
            raise HTTPException(status_code=404, detail="Guru pengganti tidak ditemukan")
        pengganti_nama = g.get("name")
    doc = {"_id": str(uuid.uuid4()), "kegiatan_id": kegiatan_id,
           "guru_id": str(user["_id"]), "guru_nama": user.get("name"),
           "alasan": (body.alasan or "").strip()[:200] or None,
           "pengganti_id": pengganti_id, "pengganti_nama": pengganti_nama,
           "status": "menunggu" if pengganti_id else "tanpa_pengganti",
           "dibuat_at": now_wita().isoformat(), "diputuskan_at": None}
    await db.izin_guru.insert_one(doc)
    return serialize_izin(doc, k)


@api_router.delete("/guru/pertemuan/{kegiatan_id}/izin")
async def guru_batalkan_izin(kegiatan_id: str, user: dict = Depends(get_current_user)):
    """Batalkan izin selama pertemuan belum berlangsung; kembalikan pengajar semula."""
    _require_guru(user)
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Pertemuan tidak ditemukan")
    izin = await _izin_aktif(kegiatan_id)
    if not izin:
        raise HTTPException(status_code=404, detail="Tidak ada izin aktif")
    if izin.get("guru_id") != str(user["_id"]) and "admin" not in (user.get("roles") or []):
        raise HTTPException(status_code=403, detail="Hanya guru pemilik pertemuan yang bisa membatalkan")
    if kegiatan_sudah_berlangsung(k):
        raise HTTPException(status_code=400, detail="Pertemuan sudah berlangsung")
    if izin.get("status") == "diterima" and izin.get("pengganti_id"):
        await db.kegiatans.update_one({"_id": kegiatan_id}, {"$set": {
            "guru_id": izin.get("guru_id"), "teacher": izin.get("guru_nama")}})
    await db.izin_guru.update_one({"_id": izin["_id"]}, {"$set": {
        "status": "batal", "diputuskan_at": now_wita().isoformat()}})
    return {"ok": True}


@api_router.get("/guru/izin")
async def guru_izin(user: dict = Depends(get_current_user)):
    """Izin untuk saya (pengganti) + izin yang saya ajukan + ringkasan pengurus."""
    _require_guru(user)
    uid = str(user["_id"])
    roles = user.get("roles") or []
    staff = bool({"admin", "pengurus"} & set(roles))
    masuk = await db.izin_guru.find({"pengganti_id": uid, "status": "menunggu"}) \
        .sort("dibuat_at", -1).to_list(50)
    keluar = await db.izin_guru.find({"guru_id": uid,
                                      "status": {"$in": ["menunggu", "diterima", "tanpa_pengganti"]}}) \
        .sort("dibuat_at", -1).to_list(50)
    out_masuk, out_keluar = [], []
    for i in masuk:
        k = await db.kegiatans.find_one({"_id": i.get("kegiatan_id")})
        if k and not kegiatan_sudah_berlangsung(k):
            out_masuk.append(serialize_izin(i, k))
    for i in keluar:
        k = await db.kegiatans.find_one({"_id": i.get("kegiatan_id")})
        if k:
            out_keluar.append(serialize_izin(i, k))
    ringkas = []
    if staff:
        today = now_wita().strftime("%Y-%m-%d")
        batas = (now_wita() + timedelta(days=14)).strftime("%Y-%m-%d")
        docs = await db.izin_guru.find({
            "status": {"$in": ["menunggu", "tanpa_pengganti"]}}).sort("dibuat_at", -1).to_list(200)
        for i in docs:
            k = await db.kegiatans.find_one({"_id": i.get("kegiatan_id")})
            if not k or not (today <= (k.get("date") or "") <= batas):
                continue
            ringkas.append(serialize_izin(i, k))
    return {"masuk": out_masuk, "keluar": out_keluar, "ringkas": ringkas,
            "jumlah_perlu_keputusan": len(ringkas)}


@api_router.post("/guru/izin/{izin_id}/putuskan")
async def guru_putuskan_izin(izin_id: str, body: dict,
                             user: dict = Depends(get_current_user)):
    """Pengganti menerima/menolak. Terima = pengajar pertemuan diganti."""
    _require_guru(user)
    keputusan = str((body or {}).get("keputusan") or "").strip()
    if keputusan not in ("terima", "tolak"):
        raise HTTPException(status_code=400, detail="Keputusan tidak valid")
    izin = await db.izin_guru.find_one({"_id": izin_id})
    if not izin:
        raise HTTPException(status_code=404, detail="Izin tidak ditemukan")
    if izin.get("pengganti_id") != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Hanya guru pengganti yang dituju yang bisa memutuskan")
    if izin.get("status") != "menunggu":
        raise HTTPException(status_code=400, detail="Izin ini sudah diputuskan")
    k = await db.kegiatans.find_one({"_id": izin.get("kegiatan_id")})
    if not k:
        raise HTTPException(status_code=404, detail="Pertemuan tidak ditemukan")
    if kegiatan_sudah_berlangsung(k):
        raise HTTPException(status_code=400, detail="Pertemuan sudah berlangsung")
    now_iso = now_wita().isoformat()
    if keputusan == "terima":
        await db.kegiatans.update_one({"_id": k["_id"]}, {"$set": {
            "guru_id": str(user["_id"]), "teacher": user.get("name")}})
        await db.izin_guru.update_one({"_id": izin_id}, {"$set": {
            "status": "diterima", "diputuskan_at": now_iso}})
    else:
        await db.izin_guru.update_one({"_id": izin_id}, {"$set": {
            "status": "ditolak", "diputuskan_at": now_iso}})
    doc = await db.izin_guru.find_one({"_id": izin_id})
    return serialize_izin(doc, k)


@api_router.get("/guru/pengganti")
async def guru_pengganti_list(user: dict = Depends(get_current_user)):
    """Daftar guru aktif yang bisa dipilih sebagai pengganti."""
    _require_guru(user)
    uid = str(user["_id"])
    gurus = await db.users.find({"roles": "guru", "status": "active",
                                 "is_system": {"$ne": True}}).sort("name", 1).to_list(500)
    return {"items": [{"id": str(g["_id"]), "name": g.get("name")}
                      for g in gurus if str(g["_id"]) != uid]}


@api_router.post("/program/upload")
async def upload_program_file(file: UploadFile = File(...),
                              editor: dict = Depends(require_program_editor)):
    """Unggah berkas materi (PDF / gambar) ke penyimpanan aplikasi."""
    name = file.filename or "berkas"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400,
                            detail="Format berkas harus PDF, JPG, PNG, WEBP, atau GIF")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran berkas maksimal 10 MB")
    file_id = str(uuid.uuid4())
    path = f"{STORAGE_APP}/program/{str(editor['_id'])}/{file_id}.{ext}"
    content_type = file.content_type or MIME_TYPES[ext]
    try:
        result = await asyncio.to_thread(put_object, path, data, content_type)
    except Exception as exc:
        logger.error("Unggah berkas gagal: %s", exc)
        raise HTTPException(status_code=502, detail="Gagal mengunggah berkas. Coba lagi.")
    await db.program_files.insert_one({
        "_id": file_id, "storage_path": result["path"], "original_filename": name,
        "content_type": content_type, "size": result.get("size") or len(data),
        "is_deleted": False, "uploaded_by": editor.get("name"),
        "created_at": now_wita().isoformat()})
    return {"file_id": file_id, "name": name, "content_type": content_type,
            "size": result.get("size") or len(data), "url": f"/api/program/file/{file_id}"}


@api_router.get("/program/file/{file_id}")
async def download_program_file(file_id: str, user: dict = Depends(get_current_user)):
    f = await db.program_files.find_one({"_id": file_id, "is_deleted": {"$ne": True}})
    if not f:
        raise HTTPException(status_code=404, detail="Berkas tidak ditemukan")
    try:
        data, content_type = await asyncio.to_thread(get_object, f["storage_path"])
    except Exception as exc:
        logger.error("Ambil berkas gagal: %s", exc)
        raise HTTPException(status_code=502, detail="Gagal mengambil berkas")
    return FastResponse(content=data, media_type=f.get("content_type") or content_type,
                        headers={"Content-Disposition":
                                 f'inline; filename="{f.get("original_filename")}"'})


@api_router.post("/notifications/read")
async def notifications_read(user: dict = Depends(get_current_user)):
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.notif_reads.update_one({"_id": str(user["_id"])},
                                    {"$set": {"seen_at": now_iso}}, upsert=True)
    return {"ok": True, "seen_at": now_iso}


# ---------------------------------------------------------------------------
# PERIKSA APLIKASI (khusus administrator) — HANYA MEMBACA.
# Setiap pemeriksaan dibungkus try/except + batas waktu sendiri supaya satu
# kegagalan tidak menggagalkan yang lain. Tidak ada penulisan data.
# ---------------------------------------------------------------------------
PERIKSA_TIMEOUT = 5.0


def kenali_qr_kartu(content: str) -> Optional[str]:
    """Kenali QR permanen kartu nama (EKT:<user_id>) → user_id atau None."""
    raw = (content or "").strip()
    if not raw.startswith("EKT:"):
        return None
    user_id = raw[4:].strip()
    return user_id if ObjectId.is_valid(user_id) else None


async def _periksa_jalan(kelompok: str, nama: str, fn) -> dict:
    """Jalankan satu pemeriksaan dengan batas waktu; galat jadi kalimat pendek."""
    mulai = time.perf_counter()
    try:
        hasil = await asyncio.wait_for(fn(), timeout=PERIKSA_TIMEOUT)
    except asyncio.TimeoutError:
        return {"kelompok": kelompok, "nama": nama, "status": "error",
                "keterangan": "Gagal: waktu tunggu habis (batas 5 detik)."}
    except Exception:
        logger.exception("Periksa aplikasi gagal pada '%s'", nama)
        return {"kelompok": kelompok, "nama": nama, "status": "error",
                "keterangan": "Gagal: kesalahan server."}
    ms = int((time.perf_counter() - mulai) * 1000)
    if isinstance(hasil, dict) and hasil.get("status"):
        return {"kelompok": kelompok, "nama": nama,
                "status": hasil["status"],
                "keterangan": hasil.get("keterangan") or "Baik."}
    return {"kelompok": kelompok, "nama": nama, "status": "ok",
            "keterangan": f"Baik ({ms} ms)."}


async def _contoh_akun(role: str) -> Optional[dict]:
    return await db.users.find_one({"roles": role, "status": "active",
                                    "is_system": {"$ne": True}})


@api_router.get("/admin/periksa-aplikasi")
async def periksa_aplikasi(admin: dict = Depends(require_admin)):
    """Pemeriksaan otomatis kondisi aplikasi. Hanya membaca, tidak menulis apa pun."""
    items: list = []

    async def cek_db():
        t0 = time.perf_counter()
        await client.admin.command("ping")
        ms = int((time.perf_counter() - t0) * 1000)
        return {"status": "ok", "keterangan": f"Server dan database menjawab normal ({ms} ms)."}

    async def cek_notifikasi():
        rows = await _notif_items_for(admin, True)
        return {"status": "ok", "keterangan": f"Notifikasi terbentuk ({len(rows)} baris)."}

    async def cek_rekap_harian():
        data = await build_rekap_harian()
        return {"status": "ok",
                "keterangan": f"Rekap harian terbentuk ({data.get('total_sesi', 0)} sesi)."}

    async def cek_rekap_bulanan():
        data = await build_rekap_bulanan()
        return {"status": "ok",
                "keterangan": f"Rekap bulanan terbentuk ({len(data.get('rows') or [])} baris)."}

    async def cek_peserta():
        rows = await db.users.find(PESERTA_QUERY).to_list(10000)
        return {"status": "ok", "keterangan": f"Daftar peserta terbentuk ({len(rows)} peserta)."}

    async def cek_kegiatan():
        rows = await list_kegiatan(admin)
        return {"status": "ok", "keterangan": f"Daftar kegiatan terbentuk ({len(rows)} kegiatan)."}

    async def cek_laporan_masuk():
        data = await staff_pengaduan(admin)
        return {"status": "ok",
                "keterangan": f"Laporan masuk terbentuk ({data.get('total', 0)} laporan)."}

    async def cek_qr_kartu():
        peserta = await db.users.find_one(PESERTA_QUERY)
        if not peserta:
            return {"status": "warn", "keterangan": "Belum ada peserta untuk diuji."}
        uid = str(peserta["_id"])
        if kenali_qr_kartu(f"EKT:{uid}") != uid:
            return {"status": "error", "keterangan": "QR kartu tidak dikenali."}
        ada = await db.users.find_one({"_id": ObjectId(uid)})
        if not ada:
            return {"status": "error", "keterangan": "Peserta pemilik kartu tidak ditemukan."}
        return {"status": "ok", "keterangan": "QR kartu peserta dikenali (tanpa mencatat kehadiran)."}

    async def cek_qr_berputar():
        if not (callable(make_personal_token) and callable(verify_personal_token)):
            return {"status": "error", "keterangan": "Pengenal QR berputar tidak tersedia."}
        return {"status": "ok", "keterangan": "Pengenal QR berputar tersedia."}

    async def cek_peran(role: str, label: str):
        akun = await _contoh_akun(role)
        if not akun:
            return {"status": "warn", "keterangan": f"Belum ada akun contoh {label}."}
        staff = bool({"admin", "pengurus"} & set(akun.get("roles") or []))
        await _notif_items_for(akun, staff)
        if role == "peserta":
            await peserta_dashboard(akun)
        elif role == "guru":
            await guru_ringkasan(akun)
        return {"status": "ok", "keterangan": f"Notifikasi dan beranda {label} terbentuk."}

    async def cek_kualitas_data():
        rows = await db.users.find(PESERTA_QUERY).to_list(10000)
        tanpa_nikah = menikah_tanpa_gender = 0
        nama = {}
        hp_salah = 0
        for u in rows:
            marital = u.get("marital")
            if marital not in MARITAL_OPTIONS:
                tanpa_nikah += 1
            elif marital == "sudah_menikah" and u.get("gender") not in GENDER_OPTIONS:
                menikah_tanpa_gender += 1
            kunci = re.sub(r"\s+", " ", str(u.get("name") or "").strip().lower())
            if kunci:
                nama[kunci] = nama.get(kunci, 0) + 1
            for nilai in (u.get("phone"), u.get("whatsapp")):
                if not nilai:
                    continue
                nomor = normalize_wa_wali(nilai)
                if not nomor or not nomor.startswith("62") or not (10 <= len(nomor) <= 15):
                    hp_salah += 1
                    break
        kembar = len([k for k, n in nama.items() if n > 1])
        masalah = []
        if tanpa_nikah:
            masalah.append(f"{tanpa_nikah} peserta tanpa status pernikahan (lengkapi lewat Bulk Data)")
        if menikah_tanpa_gender:
            masalah.append(f"{menikah_tanpa_gender} peserta menikah tanpa jenis kelamin (lengkapi lewat Bulk Data)")
        if kembar:
            masalah.append(f"{kembar} nama kembar (periksa di Cek Duplikat)")
        if hp_salah:
            masalah.append(f"{hp_salah} nomor HP tidak valid (perbaiki di data peserta)")
        if not masalah:
            return {"status": "ok", "keterangan": "Data peserta rapi."}
        return {"status": "warn", "keterangan": "; ".join(masalah) + "."}

    items.append(await _periksa_jalan("Server", "Server dan database", cek_db))
    items.append(await _periksa_jalan("Halaman utama", "Notifikasi", cek_notifikasi))
    items.append(await _periksa_jalan("Halaman utama", "Rekap harian", cek_rekap_harian))
    items.append(await _periksa_jalan("Halaman utama", "Rekap bulanan", cek_rekap_bulanan))
    items.append(await _periksa_jalan("Halaman utama", "Daftar peserta", cek_peserta))
    items.append(await _periksa_jalan("Halaman utama", "Daftar kegiatan", cek_kegiatan))
    items.append(await _periksa_jalan("Halaman utama", "Laporan masuk", cek_laporan_masuk))
    items.append(await _periksa_jalan("Scan", "QR kartu peserta", cek_qr_kartu))
    items.append(await _periksa_jalan("Scan", "QR berputar", cek_qr_berputar))
    items.append(await _periksa_jalan("Peran", "Pengurus", lambda: cek_peran("pengurus", "pengurus")))
    items.append(await _periksa_jalan("Peran", "Guru", lambda: cek_peran("guru", "guru")))
    items.append(await _periksa_jalan("Peran", "Peserta", lambda: cek_peran("peserta", "peserta")))
    items.append(await _periksa_jalan("Kualitas data", "Kelengkapan data peserta", cek_kualitas_data))

    ringkasan = {
        "ok": len([i for i in items if i["status"] == "ok"]),
        "warn": len([i for i in items if i["status"] == "warn"]),
        "error": len([i for i in items if i["status"] == "error"]),
    }
    return {"items": items, "ringkasan": ringkasan,
            "diperiksa_at": now_wita().isoformat()}



@api_router.get("/health")
async def health():
    """Health check + verifikasi koneksi database (berguna setelah deploy ke Vercel)."""
    out = {"status": "ok", "serverless": IS_SERVERLESS, "db": "unknown",
           "jwt_secret_set": bool(os.environ.get("JWT_SECRET"))}
    try:
        await client.admin.command("ping")
        out["db"] = "connected"
        out["db_name"] = db.name
    except Exception as exc:
        out["status"] = "degraded"
        out["db"] = "error"
        out["db_error"] = str(exc)[:200]
    return out


# ---------------------------------------------------------------------------
# PEMELIHARAAN (Layar 32)
# Satu dokumen di collection `app_settings` dengan _id "maintenance":
#   { enabled, startAt, endAt, message, updated_at, updated_by }
# - Peserta & halaman login boleh MEMBACA (read-only).
# - Hanya admin yang boleh MENGUBAH.
# ---------------------------------------------------------------------------
MAINTENANCE_ID = "maintenance"
MAINTENANCE_DEFAULT_MESSAGE = (
    "Aplikasi sedang dalam perawatan. Silakan tunggu beberapa saat lalu coba kembali. "
    "Terima kasih atas pengertiannya."
)


class MaintenanceInput(BaseModel):
    enabled: Optional[bool] = None
    startAt: Optional[str] = None
    endAt: Optional[str] = None
    message: Optional[str] = None


def _parse_wita(value: Optional[str]) -> Optional[datetime]:
    """Terima ISO 8601 (dengan/tanpa zona) atau 'YYYY-MM-DD HH:MM'. Anggap WITA."""
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(s, fmt)
                break
            except ValueError:
                continue
        else:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=WITA)
    return dt


def maintenance_state(doc: Optional[dict]) -> dict:
    """Hitung keadaan pemeliharaan: none | scheduled | ongoing."""
    doc = doc or {}
    enabled = bool(doc.get("enabled"))
    start = _parse_wita(doc.get("startAt"))
    end = _parse_wita(doc.get("endAt"))
    now = now_wita()

    if enabled:
        state = "ongoing"
    elif start and end and start <= now < end:
        state = "ongoing"
    elif start and now < start:
        state = "scheduled"
    else:
        state = "none"

    return {
        "state": state,
        "enabled": enabled,
        "startAt": start.isoformat() if start else None,
        "endAt": end.isoformat() if end else None,
        "message": doc.get("message") or MAINTENANCE_DEFAULT_MESSAGE,
        "updated_at": doc.get("updated_at"),
        "server_time": now.isoformat(),
    }


async def get_maintenance_doc() -> Optional[dict]:
    try:
        return await db.app_settings.find_one({"_id": MAINTENANCE_ID})
    except Exception as exc:  # pragma: no cover
        logger.warning("Baca pengaturan pemeliharaan gagal: %s", exc)
        return None


async def is_maintenance_ongoing() -> bool:
    try:
        doc = await asyncio.wait_for(get_maintenance_doc(), timeout=5)
        return maintenance_state(doc)["state"] == "ongoing"
    except Exception:  # pragma: no cover
        return False


@api_router.get("/maintenance")
async def maintenance_public():
    """Keadaan pemeliharaan — boleh dibaca tanpa login (dipakai halaman login).

    Fail-open: bila gagal atau lambat, anggap tidak sedang maintenance.
    """
    try:
        doc = await asyncio.wait_for(get_maintenance_doc(), timeout=5)
        return maintenance_state(doc)
    except Exception as exc:  # pragma: no cover
        logger.warning("Baca status pemeliharaan gagal: %s", exc)
        return maintenance_state(None)


@api_router.get("/admin/maintenance")
async def maintenance_admin(user: dict = Depends(require_admin)):
    return maintenance_state(await get_maintenance_doc())


@api_router.put("/admin/maintenance")
async def maintenance_update(body: MaintenanceInput, user: dict = Depends(require_admin)):
    current = await get_maintenance_doc() or {}
    upd = {}
    if body.enabled is not None:
        upd["enabled"] = bool(body.enabled)
    if body.startAt is not None:
        upd["startAt"] = body.startAt.strip() or None
    if body.endAt is not None:
        upd["endAt"] = body.endAt.strip() or None
    if body.message is not None:
        upd["message"] = body.message.strip() or MAINTENANCE_DEFAULT_MESSAGE
    upd["updated_at"] = now_wita().isoformat()
    upd["updated_by"] = user.get("name") or str(user.get("_id"))
    await db.app_settings.update_one({"_id": MAINTENANCE_ID}, {"$set": upd}, upsert=True)
    doc = {**current, **upd}
    return maintenance_state(doc)


# ---------------------------------------------------------------------------
# PENDATAAN — tautan publik untuk melengkapi data peserta lama / pendaftaran baru.
# Semua isian masuk ke `pendataan_isian` dan baru berlaku setelah disetujui.
# Rute publik TIDAK PERNAH menulis ke `users`.
# ---------------------------------------------------------------------------
PENDATAAN_JENIS = ("orang", "baru")
PENDATAAN_MARITAL = {"belum menikah": "belum_menikah", "sudah menikah": "sudah_menikah"}
PENDATAAN_GENDER = {"laki-laki": "L", "perempuan": "P"}
PENDATAAN_MARITAL_LABEL = {"belum_menikah": "Belum menikah", "sudah_menikah": "Sudah menikah"}
PENDATAAN_GENDER_LABEL = {"L": "Laki-laki", "P": "Perempuan"}
PENDATAAN_MAX_MENUNGGU = 100
PENDATAAN_BERLAKU_HARI = {"7": 7, "14": 14, "30": 30}


def _bersih_teks(value, maks: int = 100) -> str:
    """Buang tag HTML dan rapikan spasi ganda."""
    teks = re.sub(r"<[^>]*>", " ", str(value or ""))
    teks = re.sub(r"\s+", " ", teks).strip()
    return teks[:maks]


def _oid(value):
    """String id → ObjectId (None bila tidak valid)."""
    if isinstance(value, ObjectId):
        return value
    return ObjectId(value) if value and ObjectId.is_valid(str(value)) else None


def _pendataan_tidak_berlaku():
    """Pesan SAMA untuk semua penyebab (tidak ada / dimatikan / kedaluwarsa)."""
    return HTTPException(status_code=410, detail="Tautan sudah tidak berlaku")


async def _pendataan_tautan_aktif(token: str) -> dict:
    row = await db.pendataan_tautan.find_one({"token": token})
    if not row or not row.get("aktif"):
        raise _pendataan_tidak_berlaku()
    try:
        batas = datetime.fromisoformat(str(row.get("berlaku_sampai")))
    except Exception:
        raise _pendataan_tidak_berlaku()
    if batas.tzinfo is None:
        batas = batas.replace(tzinfo=WITA)
    if now_wita() > batas:
        raise _pendataan_tidak_berlaku()
    return row


def _nama_valid(nama: str) -> bool:
    """Hanya huruf (termasuk berdiakritik), spasi, titik, koma, apostrof, tanda hubung."""
    if not nama:
        return False
    for ch in nama:
        if ch.isalpha() or ch in " .,'-":
            continue
        return False
    return True


def _nama_sama(a, b) -> bool:
    """Bandingkan nama tanpa huruf besar/kecil dan spasi ganda."""
    rapikan = lambda v: re.sub(r"\s+", " ", str(v or "").strip().lower())
    return rapikan(a) == rapikan(b)


def _validasi_isian(body: dict, jenis: str) -> dict:
    """Daftar putih isian. Mengembalikan data bersih atau melempar HTTPException."""
    data: dict = {}
    marital_raw = str(body.get("status_pernikahan") or "").strip().lower()
    if marital_raw not in PENDATAAN_MARITAL:
        raise HTTPException(status_code=400, detail="Status pernikahan wajib dipilih.")
    data["status_pernikahan"] = PENDATAAN_MARITAL[marital_raw]

    gender_raw = str(body.get("jenis_kelamin") or "").strip().lower()
    if gender_raw not in PENDATAAN_GENDER:
        raise HTTPException(status_code=400, detail="Jenis kelamin wajib dipilih.")
    data["jenis_kelamin"] = PENDATAAN_GENDER[gender_raw]

    nama = _bersih_teks(body.get("nama"), 100)
    if len(nama) < 3:
        raise HTTPException(status_code=400, detail="Nama lengkap minimal 3 huruf.")
    if not _nama_valid(nama):
        raise HTTPException(status_code=400, detail="Nama hanya boleh berisi huruf.")
    data["nama"] = nama

    dob_raw = str(body.get("tanggal_lahir") or "").strip()
    if not dob_raw:
        raise HTTPException(status_code=400, detail="Tanggal lahir wajib diisi.")
    dob = normalize_dob(dob_raw)
    if not dob:
        raise HTTPException(status_code=400, detail="Tanggal lahir tidak valid.")
    try:
        lahir = datetime.strptime(dob, "%Y-%m-%d").replace(tzinfo=WITA)
    except Exception:
        raise HTTPException(status_code=400, detail="Tanggal lahir tidak valid.")
    hari_ini = now_wita()
    if lahir > hari_ini:
        raise HTTPException(status_code=400, detail="Tanggal lahir tidak boleh di masa depan.")
    umur = hari_ini.year - lahir.year - ((hari_ini.month, hari_ini.day) < (lahir.month, lahir.day))
    if umur < 1 or umur > 120:
        raise HTTPException(status_code=400, detail="Tanggal lahir tidak wajar.")
    data["tanggal_lahir"] = dob

    hp_raw = str(body.get("nomor_hp") or "").strip()
    if hp_raw:
        nomor = normalize_wa_wali(hp_raw)
        if not nomor or not nomor.startswith("62") or not (10 <= len(nomor) <= 15):
            raise HTTPException(status_code=400, detail="Nomor HP tidak valid.")
        data["nomor_hp"] = nomor
    return data


@api_router.get("/publik/pendataan/{token}")
async def publik_pendataan(token: str):
    """Info tautan publik. Hanya jenis + nama peserta (tanpa data pribadi lain)."""
    row = await _pendataan_tautan_aktif(token)
    body = {"jenis": row.get("jenis"), "nama": None}
    if row.get("jenis") == "orang" and row.get("peserta_id"):
        peserta = await db.users.find_one({"_id": _oid(row["peserta_id"])}, {"name": 1})
        body["nama"] = (peserta or {}).get("name")
    return JSONResponse(content=body, headers={
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "no-store",
    })


@api_router.post("/publik/pendataan/{token}")
async def publik_pendataan_kirim(token: str, body: dict):
    """Simpan isian ke `pendataan_isian` saja (tidak menyentuh tabel peserta)."""
    row = await _pendataan_tautan_aktif(token)
    jenis = row.get("jenis")
    data = _validasi_isian(body, jenis)
    sekarang = now_wita().isoformat()
    if jenis == "orang":
        peserta_id = row.get("peserta_id")
        if not peserta_id:
            raise _pendataan_tidak_berlaku()
        # Nama hanya disimpan bila berbeda dari nama sekarang.
        peserta = await db.users.find_one({"_id": _oid(peserta_id)}, {"name": 1})
        if _nama_sama(data.get("nama"), (peserta or {}).get("name")):
            data.pop("nama", None)
        ada = await db.pendataan_isian.find_one(
            {"tautan_id": row["_id"], "status": "menunggu"})
        if ada:
            await db.pendataan_isian.update_one(
                {"_id": ada["_id"]},
                {"$set": {"data": data, "dikirim_pada": sekarang}})
            return {"ok": True, "diperbarui": True}
        await db.pendataan_isian.insert_one({
            "_id": str(uuid.uuid4()), "tautan_id": row["_id"], "jenis": "pembaruan",
            "peserta_id": peserta_id, "data": data, "status": "menunggu",
            "dikirim_pada": sekarang, "ditinjau_oleh": None, "ditinjau_pada": None,
        })
        return {"ok": True, "diperbarui": False}
    jumlah = await db.pendataan_isian.count_documents(
        {"tautan_id": row["_id"], "status": "menunggu"})
    if jumlah >= PENDATAAN_MAX_MENUNGGU:
        raise HTTPException(status_code=429,
                            detail="Isian untuk tautan ini sudah penuh. Hubungi pengurus.")
    await db.pendataan_isian.insert_one({
        "_id": str(uuid.uuid4()), "tautan_id": row["_id"], "jenis": "calon",
        "peserta_id": None, "data": data, "status": "menunggu",
        "dikirim_pada": sekarang, "ditinjau_oleh": None, "ditinjau_pada": None,
    })
    return {"ok": True, "diperbarui": False}


class PendataanTautanInput(BaseModel):
    jenis: str = "orang"
    peserta_ids: List[str] = []
    berlaku_hari: int = 7


class PendataanPutusanInput(BaseModel):
    aksi: str = "setujui"          # setujui | tolak | gabungkan
    peserta_id: Optional[str] = None


def _pendataan_url(request: Request, token: str) -> str:
    return f"{resolve_base_url(request)}/data/{token}"


@api_router.post("/staff/pendataan/tautan")
async def pendataan_buat_tautan(body: PendataanTautanInput, request: Request,
                                staff: dict = Depends(require_staff)):
    """Buat tautan pendataan (jenis 'orang' untuk banyak peserta, atau 'baru')."""
    jenis = body.jenis if body.jenis in PENDATAAN_JENIS else "orang"
    hari = body.berlaku_hari if body.berlaku_hari in (7, 14, 30) else 7
    batas = (now_wita() + timedelta(days=hari)).isoformat()
    dibuat = now_wita().isoformat()
    oleh = str(staff["_id"])
    hasil = []
    if jenis == "baru":
        token = secrets.token_urlsafe(24)
        await db.pendataan_tautan.insert_one({
            "_id": str(uuid.uuid4()), "token": token, "jenis": "baru",
            "peserta_id": None, "berlaku_sampai": batas, "aktif": True,
            "dibuat_oleh": oleh, "dibuat_pada": dibuat,
        })
        hasil.append({"token": token, "nama": None, "url": _pendataan_url(request, token)})
    else:
        ids = [i for i in dict.fromkeys(body.peserta_ids or []) if i]
        if not ids:
            raise HTTPException(status_code=400, detail="Pilih minimal satu peserta.")
        oids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
        peserta = await db.users.find({"_id": {"$in": oids}},
                                      {"name": 1, "phone": 1, "whatsapp": 1}).to_list(500)
        nama_by = {str(p["_id"]): p.get("name") for p in peserta}
        hp_by = {str(p["_id"]): (p.get("phone") or p.get("whatsapp")) for p in peserta}
        for pid in ids:
            if pid not in nama_by:
                continue
            token = secrets.token_urlsafe(24)
            await db.pendataan_tautan.insert_one({
                "_id": str(uuid.uuid4()), "token": token, "jenis": "orang",
                "peserta_id": pid, "berlaku_sampai": batas, "aktif": True,
                "dibuat_oleh": oleh, "dibuat_pada": dibuat,
            })
            hasil.append({"token": token, "nama": nama_by[pid],
                          "nomor_hp": hp_by.get(pid),
                          "url": _pendataan_url(request, token)})
    await log_activity(staff, "pendataan_tautan",
                       f"Membuat {len(hasil)} tautan pendataan ({jenis})")
    return {"jenis": jenis, "berlaku_sampai": batas, "items": hasil}


@api_router.get("/staff/pendataan/tautan")
async def pendataan_daftar_tautan(staff: dict = Depends(require_staff)):
    rows = await db.pendataan_tautan.find({"aktif": True}) \
        .sort("dibuat_pada", -1).to_list(200)
    sekarang = now_wita()
    items = []
    for r in rows:
        try:
            batas = datetime.fromisoformat(str(r.get("berlaku_sampai")))
            if batas.tzinfo is None:
                batas = batas.replace(tzinfo=WITA)
        except Exception:
            continue
        if sekarang > batas:
            continue
        nama = None
        nomor = None
        if r.get("peserta_id"):
            p = await db.users.find_one({"_id": _oid(r["peserta_id"])},
                                        {"name": 1, "phone": 1, "whatsapp": 1})
            nama = (p or {}).get("name")
            nomor = (p or {}).get("phone") or (p or {}).get("whatsapp")
        items.append({"id": r["_id"], "jenis": r.get("jenis"), "nama": nama,
                      "token": r.get("token"), "nomor_hp": nomor,
                      "berlaku_sampai": r.get("berlaku_sampai"),
                      "dibuat_pada": r.get("dibuat_pada")})
    return {"items": items}


@api_router.post("/staff/pendataan/tautan/{tautan_id}/matikan")
async def pendataan_matikan_tautan(tautan_id: str, staff: dict = Depends(require_staff)):
    res = await db.pendataan_tautan.update_one({"_id": tautan_id}, {"$set": {"aktif": False}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Tautan tidak ditemukan")
    await log_activity(staff, "pendataan_matikan", "Mematikan tautan pendataan", tautan_id)
    return {"ok": True}


class PendataanMassalInput(BaseModel):
    ids: List[str] = []
    aksi: str = "matikan"          # matikan | hapus


@api_router.post("/staff/pendataan/tautan/massal")
async def pendataan_massal(body: PendataanMassalInput, staff: dict = Depends(require_staff)):
    """Aksi massal tautan pendataan: matikan atau hapus (hapus = lunak + hilang dari daftar).

    Isian di `pendataan_isian` TIDAK diubah/dihapus.
    """
    aksi = body.aksi if body.aksi in ("matikan", "hapus") else "matikan"
    ids = [i for i in dict.fromkeys(body.ids or []) if i]
    if not ids:
        raise HTTPException(status_code=400, detail="Pilih minimal satu tautan.")
    rows = await db.pendataan_tautan.find({"_id": {"$in": ids}}).to_list(500)
    if not rows:
        raise HTTPException(status_code=404, detail="Tautan tidak ditemukan.")
    valid_ids = [r["_id"] for r in rows]
    # Penghapusan lunak memakai kolom yang sudah ada: aktif=false. Daftar hanya
    # menampilkan tautan aktif, jadi tautan langsung hilang dari daftar.
    await db.pendataan_tautan.update_many(
        {"_id": {"$in": valid_ids}}, {"$set": {"aktif": False}})
    await log_activity(staff, f"pendataan_{aksi}",
                       f"{'Menghapus' if aksi == 'hapus' else 'Mematikan'} "
                       f"{len(valid_ids)} tautan pendataan", ",".join(valid_ids)[:500])
    return {"ok": True, "jumlah": len(valid_ids), "aksi": aksi}


async def _pendataan_kemungkinan(data: dict) -> list:
    """Cari peserta yang mungkin sudah terdaftar (nama atau nomor HP)."""
    kandidat: dict = {}
    nama = _bersih_teks(data.get("nama"), 100)
    if nama:
        pola = re.escape(nama)
        pola = pola.replace(r"\ ", r"\s+")
        async for u in db.users.find({"name": {"$regex": f"^{pola}$", "$options": "i"}},
                                     {"name": 1, "phone": 1}):
            kandidat[str(u["_id"])] = {"id": str(u["_id"]), "nama": u.get("name"),
                                       "alasan": "nama sama"}
    nomor = data.get("nomor_hp")
    if nomor:
        async for u in db.users.find({"$or": [{"phone": nomor}, {"whatsapp": nomor}]},
                                     {"name": 1, "phone": 1}):
            kandidat[str(u["_id"])] = {"id": str(u["_id"]), "nama": u.get("name"),
                                       "alasan": "nomor HP sama"}
    return list(kandidat.values())


@api_router.get("/staff/pendataan/isian")
async def pendataan_daftar_isian(staff: dict = Depends(require_staff)):
    rows = await db.pendataan_isian.find({"status": "menunggu"}) \
        .sort("dikirim_pada", 1).to_list(300)
    items = []
    for r in rows:
        peserta = None
        if r.get("peserta_id"):
            p = await db.users.find_one({"_id": _oid(r["peserta_id"])},
                                        {"name": 1, "marital": 1, "gender": 1,
                                         "dob": 1, "phone": 1})
            if p:
                peserta = {"id": str(p["_id"]), "nama": p.get("name"),
                           "status_pernikahan": p.get("marital"),
                           "jenis_kelamin": p.get("gender"),
                           "tanggal_lahir": p.get("dob"), "nomor_hp": p.get("phone")}
        kemungkinan = await _pendataan_kemungkinan(r.get("data") or {}) if r.get("jenis") == "calon" else []
        # Peringatan (tidak menghalangi): nama baru sama dengan peserta LAIN.
        nama_bentrok = []
        nama_baru = _bersih_teks((r.get("data") or {}).get("nama"), 100)
        if r.get("jenis") == "pembaruan" and nama_baru:
            pola = re.escape(nama_baru).replace(r"\ ", r"\s+")
            async for u in db.users.find(
                    {"name": {"$regex": f"^{pola}$", "$options": "i"},
                     "_id": {"$ne": _oid(r.get("peserta_id"))}}, {"name": 1}):
                nama_bentrok.append(u.get("name"))
        items.append({"id": r["_id"], "jenis": r.get("jenis"),
                      "tautan_id": r.get("tautan_id"),
                      "peserta": peserta, "data": r.get("data") or {},
                      "dikirim_pada": r.get("dikirim_pada"),
                      "kemungkinan": kemungkinan, "nama_bentrok": nama_bentrok})
    return {"items": items}


async def _terapkan_pembaruan(peserta_id: str, data: dict) -> None:
    """Terapkan HANYA kolom daftar putih ke peserta (dipakai setujui & gabungkan)."""
    upd: dict = {}
    nama = _bersih_teks(data.get("nama"), 100)
    if len(nama) >= 3 and _nama_valid(nama):
        upd["name"] = nama
    if data.get("status_pernikahan") in MARITAL_OPTIONS:
        upd["marital"] = data["status_pernikahan"]
    if data.get("jenis_kelamin") in GENDER_OPTIONS:
        upd["gender"] = data["jenis_kelamin"]
        upd["avatar_gender"] = "female" if data["jenis_kelamin"] == "P" else "male"
    if data.get("tanggal_lahir"):
        dob = normalize_dob(data["tanggal_lahir"])
        if dob:
            upd["dob"] = dob
    if data.get("nomor_hp"):
        nomor = normalize_wa_wali(data["nomor_hp"])
        if nomor:
            bentrok = await db.users.find_one(
                {"_id": {"$ne": _oid(peserta_id)},
                 "$or": [{"phone": nomor}, {"whatsapp": nomor}]}, {"name": 1})
            if bentrok:
                raise HTTPException(
                    status_code=409,
                    detail=f"Nomor HP sudah dipakai peserta lain ({bentrok.get('name')}).")
            upd["phone"] = nomor
    if upd:
        await db.users.update_one({"_id": _oid(peserta_id)}, {"$set": upd})


@api_router.post("/staff/pendataan/isian/{isian_id}/putuskan")
async def pendataan_putuskan(isian_id: str, body: PendataanPutusanInput,
                             staff: dict = Depends(require_staff)):
    row = await db.pendataan_isian.find_one({"_id": isian_id})
    if not row:
        raise HTTPException(status_code=404, detail="Isian tidak ditemukan")
    if row.get("status") != "menunggu":
        raise HTTPException(status_code=400, detail="Isian ini sudah ditinjau.")
    aksi = body.aksi if body.aksi in ("setujui", "tolak", "gabungkan") else "setujui"
    data = row.get("data") or {}
    sekarang = now_wita().isoformat()
    oleh = str(staff["_id"])

    if aksi == "tolak":
        await db.pendataan_isian.update_one(
            {"_id": isian_id},
            {"$set": {"status": "ditolak", "ditinjau_oleh": oleh, "ditinjau_pada": sekarang}})
        await log_activity(staff, "pendataan_tolak", "Menolak isian pendataan", isian_id)
        return {"ok": True, "status": "ditolak"}

    if aksi == "gabungkan":
        target = body.peserta_id
        if not target or not ObjectId.is_valid(target):
            raise HTTPException(status_code=400, detail="Pilih peserta yang akan digabungkan.")
        await _terapkan_pembaruan(target, data)
        await db.pendataan_isian.update_one(
            {"_id": isian_id},
            {"$set": {"status": "disetujui", "ditinjau_oleh": oleh,
                      "ditinjau_pada": sekarang, "peserta_id": target}})
        await log_activity(staff, "pendataan_gabung",
                           "Menggabungkan isian pendataan ke peserta", target)
        return {"ok": True, "status": "disetujui", "peserta_id": target}

    if row.get("jenis") == "pembaruan":
        target = row.get("peserta_id")
        if not target:
            raise HTTPException(status_code=400, detail="Peserta tidak ditemukan.")
        await _terapkan_pembaruan(target, data)
        await db.pendataan_isian.update_one(
            {"_id": isian_id},
            {"$set": {"status": "disetujui", "ditinjau_oleh": oleh, "ditinjau_pada": sekarang}})
        await log_activity(staff, "pendataan_setujui",
                           "Menyetujui pembaruan data peserta", target)
        return {"ok": True, "status": "disetujui", "peserta_id": target}

    # calon → buat peserta baru (status belum aktivasi) lewat fungsi pembuat peserta.
    nama = _bersih_teks(data.get("nama"), 100)
    if len(nama) < 3:
        raise HTTPException(status_code=400, detail="Nama calon peserta tidak valid.")
    nomor = normalize_wa_wali(data.get("nomor_hp")) if data.get("nomor_hp") else None
    if nomor:
        bentrok = await db.users.find_one({"$or": [{"phone": nomor}, {"whatsapp": nomor}]},
                                          {"name": 1})
        if bentrok:
            raise HTTPException(
                status_code=409,
                detail=f"Nomor HP sudah dipakai peserta lain ({bentrok.get('name')}).")
    doc = build_pending_doc(nama, data.get("tanggal_lahir"))
    doc["username"] = await unique_username_from_name(nama)
    doc["marital"] = data.get("status_pernikahan") if data.get("status_pernikahan") in MARITAL_OPTIONS else None
    gender = data.get("jenis_kelamin") if data.get("jenis_kelamin") in GENDER_OPTIONS else None
    doc["gender"] = gender
    doc["avatar_gender"] = "female" if gender == "P" else "male"
    doc["phone"] = nomor
    doc["source"] = "pendataan"
    saran = saran_jenjang(doc.get("dob"))
    if saran:
        doc["jenjang"] = saran
        doc["jenjang_saran"] = True
    res = await db.users.insert_one(doc)
    baru_id = str(res.inserted_id)
    await db.pendataan_isian.update_one(
        {"_id": isian_id},
        {"$set": {"status": "disetujui", "ditinjau_oleh": oleh,
                  "ditinjau_pada": sekarang, "peserta_id": baru_id}})
    await log_activity(staff, "pendataan_setujui",
                       f"Menyetujui calon peserta '{nama}'", baru_id)
    return {"ok": True, "status": "disetujui", "peserta_id": baru_id}


class PendataanMassalPutusanInput(BaseModel):
    ids: List[str] = []
    aksi: str = "setujui"             # setujui | tolak


@api_router.post("/staff/pendataan/isian/massal")
async def pendataan_putuskan_massal(body: PendataanMassalPutusanInput,
                                    staff: dict = Depends(require_staff)):
    """Setujui/tolak banyak isian sekaligus (maks 50). Satu gagal tidak membatalkan semua."""
    aksi = body.aksi if body.aksi in ("setujui", "tolak") else "setujui"
    ids = [i for i in dict.fromkeys(body.ids or []) if i][:50]
    if not ids:
        raise HTTPException(status_code=400, detail="Pilih minimal satu pengajuan.")
    hasil = []
    for isian_id in ids:
        try:
            await pendataan_putuskan(isian_id, PendataanPutusanInput(aksi=aksi), staff)
            hasil.append({"id": isian_id, "ok": True})
        except HTTPException as exc:
            hasil.append({"id": isian_id, "ok": False, "alasan": str(exc.detail)})
        except Exception as exc:  # pragma: no cover
            logger.exception("Putusan massal gagal (%s): %s", isian_id, exc)
            hasil.append({"id": isian_id, "ok": False,
                          "alasan": "Gagal diproses. Coba lagi."})
    berhasil = sum(1 for h in hasil if h["ok"])
    return {"aksi": aksi, "berhasil": berhasil,
            "gagal": len(hasil) - berhasil, "hasil": hasil}


# ---------------------------------------------------------------------------
# KARTU NAMA — catatan alasan & tanggal cetak kartu fisik.
# Setiap pencetakan menambah satu catatan (tidak menimpa).
# ---------------------------------------------------------------------------
KARTU_CETAK_ALASAN = ("Tidak punya device", "Sudah sepuh", "Lainnya")


class KartuCetakInput(BaseModel):
    peserta_ids: List[str] = []
    alasan: str = ""
    alasan_lain: Optional[str] = None


@api_router.post("/staff/kartu-cetak")
async def kartu_cetak_catat(body: KartuCetakInput, staff: dict = Depends(require_staff)):
    """Catat alasan pencetakan kartu fisik untuk daftar peserta (maks 200)."""
    alasan = (body.alasan or "").strip()
    if alasan not in KARTU_CETAK_ALASAN:
        raise HTTPException(status_code=400, detail="Pilih alasan dulu.")
    alasan_lain = None
    if alasan == "Lainnya":
        alasan_lain = _bersih_teks(body.alasan_lain, 100)
        if len(alasan_lain) < 3:
            raise HTTPException(status_code=400, detail="Tulis alasannya.")
    ids = [i for i in dict.fromkeys(body.peserta_ids or []) if i]
    if not ids:
        raise HTTPException(status_code=400, detail="Pilih peserta dulu.")
    if len(ids) > 200:
        raise HTTPException(status_code=400, detail="Maksimal 200 peserta sekali cetak.")
    oids = [ObjectId(i) for i in ids if ObjectId.is_valid(i)]
    if len(oids) != len(ids):
        raise HTTPException(status_code=400, detail="Ada peserta yang tidak dikenali.")
    ada = await db.users.find({"_id": {"$in": oids}, "roles": "peserta"},
                              {"_id": 1}).to_list(300)
    if len(ada) != len(oids):
        raise HTTPException(status_code=400, detail="Ada peserta yang tidak dikenali.")
    sekarang = now_wita().isoformat()
    oleh = str(staff["_id"])
    docs = [{
        "_id": str(uuid.uuid4()), "peserta_id": str(o["_id"]), "alasan": alasan,
        "alasan_lain": alasan_lain, "dicetak_oleh": oleh, "dicetak_pada": sekarang,
    } for o in ada]
    await db.kartu_cetak.insert_many(docs)
    await log_activity(staff, "kartu_cetak",
                       f"Mencetak {len(docs)} kartu nama ({alasan})")
    return {"ok": True, "jumlah": len(docs), "alasan": alasan,
            "alasan_lain": alasan_lain, "dicetak_pada": sekarang}


@api_router.get("/staff/kartu-cetak")
async def kartu_cetak_terakhir(staff: dict = Depends(require_staff)):
    """Catatan cetak TERAKHIR per peserta (tanggal + alasan)."""
    rows = await db.kartu_cetak.find().sort("dicetak_pada", -1).to_list(5000)
    hasil: dict = {}
    for r in rows:
        pid = r.get("peserta_id")
        if pid and pid not in hasil:
            hasil[pid] = {"dicetak_pada": r.get("dicetak_pada"),
                          "alasan": r.get("alasan"),
                          "alasan_lain": r.get("alasan_lain")}
    return {"items": hasil}


# ---------------------------------------------------------------------------
# IZIN LEWAT HP PESERTA — tautan publik per kegiatan (tanpa login).
# ---------------------------------------------------------------------------
IZIN_ALASAN = ("Sakit", "Bekerja", "Keperluan keluarga", "Lainnya")
IZIN_LAJU_MAKS = 10          # maksimal pengajuan per IP & per token
IZIN_LAJU_JENDELA = 600      # detik (10 menit)


def _izin_tautan_aktif(k: dict) -> bool:
    """Tautan izin berlaku sampai kegiatan selesai (WITA)."""
    end = kegiatan_end_dt(k.get("date"), k.get("end_time"))
    if not end:
        return False
    return now_wita() <= end


async def _izin_laju_ok(ip: Optional[str], token: str) -> bool:
    """Pembatas laju per alamat IP DAN per token (10 pengajuan / 10 menit)."""
    batas = (now_wita() - timedelta(seconds=IZIN_LAJU_JENDELA)).isoformat()
    if ip:
        jumlah = await db.izin_laju.count_documents(
            {"ip": ip, "at": {"$gte": batas}})
        if jumlah >= IZIN_LAJU_MAKS:
            return False
    jumlah_token = await db.izin_laju.count_documents(
        {"token": token, "at": {"$gte": batas}})
    if jumlah_token >= IZIN_LAJU_MAKS:
        return False
    await db.izin_laju.insert_one(
        {"ip": ip, "token": token, "at": now_wita().isoformat()})
    return True


@api_router.post("/staff/kegiatan/{kegiatan_id}/izin-tautan")
async def izin_buat_tautan(kegiatan_id: str, request: Request,
                           staff: dict = Depends(require_staff)):
    """Buat/ganti token tautan izin untuk satu kegiatan."""
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    token = secrets.token_urlsafe(24)
    await db.kegiatans.update_one({"_id": kegiatan_id}, {"$set": {"izin_token": token}})
    await log_activity(staff, "izin_tautan", f"Membuat tautan izin '{k.get('name')}'", kegiatan_id)
    return {"token": token, "link": f"{resolve_base_url(request)}/izin/{token}"}


@api_router.get("/staff/kegiatan/{kegiatan_id}/izin")
async def izin_daftar(kegiatan_id: str, staff: dict = Depends(require_staff)):
    """Daftar izin kegiatan (menunggu lebih dulu)."""
    rows = await db.izin_kegiatan.find({"kegiatan_id": kegiatan_id}) \
        .sort("dibuat_pada", 1).to_list(2000)
    items = []
    for r in rows:
        p = await db.users.find_one({"_id": _oid(r.get("peserta_id"))}, {"name": 1})
        items.append({"id": r["_id"], "peserta_id": r.get("peserta_id"),
                      "nama": (p or {}).get("name"), "alasan": r.get("alasan"),
                      "alasan_lain": r.get("alasan_lain"), "status": r.get("status"),
                      "dibuat_pada": r.get("dibuat_pada")})
    items.sort(key=lambda i: (i["status"] != "menunggu", i.get("dibuat_pada") or ""))
    return {"items": items}


class IzinPutusanInput(BaseModel):
    status: str = "disetujui"      # disetujui | ditolak


@api_router.post("/staff/izin/{izin_id}/putuskan")
async def izin_putuskan(izin_id: str, body: IzinPutusanInput,
                        staff: dict = Depends(require_staff)):
    if body.status not in ("disetujui", "ditolak"):
        raise HTTPException(status_code=400, detail="Status tidak valid")
    row = await db.izin_kegiatan.find_one({"_id": izin_id})
    if not row:
        raise HTTPException(status_code=404, detail="Izin tidak ditemukan")
    sekarang = now_wita().isoformat()
    await db.izin_kegiatan.update_one(
        {"_id": izin_id},
        {"$set": {"status": body.status, "ditinjau_oleh": str(staff["_id"]),
                  "ditinjau_pada": sekarang}})
    # Sinkronkan tanda tinjauan pada absen manual (izin dari tautan).
    if body.status == "disetujui":
        await db.absensis.update_one(
            {"kegiatan_id": row.get("kegiatan_id"), "user_id": row.get("peserta_id"),
             "status": "izin"},
            {"$set": {"tinjauan": "disetujui", "ditinjau_oleh": str(staff["_id"]),
                      "ditinjau_pada": sekarang, "updated_at": sekarang}})
    else:
        # Ditolak: hapus catatan izin yang berasal dari tautan agar tidak
        # terhitung Izin di rekap. Catatan manual pengurus tidak disentuh.
        await db.absensis.delete_one(
            {"kegiatan_id": row.get("kegiatan_id"), "user_id": row.get("peserta_id"),
             "status": "izin", "sumber": "izin_tautan"})
    await log_activity(staff, f"izin_{body.status}", "Meninjau izin kegiatan", izin_id)
    return {"ok": True, "status": body.status}


@api_router.get("/publik/izin/{token}")
async def publik_izin_info(token: str):
    """Info tautan izin: nama kegiatan + daftar alasan.

    Daftar peserta TIDAK dikirim lagi; nama dicari lewat
    `/publik/peserta/cari` agar tidak ada endpoint yang membuka seluruh daftar.
    """
    k = await db.kegiatans.find_one({"izin_token": token})
    if not k or not _izin_tautan_aktif(k):
        raise HTTPException(status_code=410, detail="Tautan sudah tidak berlaku")
    return JSONResponse(content={
        "kegiatan": k.get("name"),
        "tanggal": k.get("date"),
        "alasan": list(IZIN_ALASAN),
    }, headers={"X-Robots-Tag": "noindex, nofollow",
                "Referrer-Policy": "no-referrer", "Cache-Control": "no-store"})


@api_router.post("/publik/izin/{token}")
async def publik_izin_kirim(token: str, body: dict, request: Request):
    """Kirim izin dari HP peserta.

    Pengajuan disimpan di `izin_kegiatan` DAN langsung dicatat sebagai status
    "izin" pada absen manual (sumber `izin_tautan`, tinjauan `belum_ditinjau`),
    sehingga peserta tidak terhitung Alpha.
    """
    k = await db.kegiatans.find_one({"izin_token": token})
    if not k or not _izin_tautan_aktif(k):
        raise HTTPException(status_code=410, detail="Tautan sudah tidak berlaku")
    if not await _izin_laju_ok(client_ip(request), token):
        raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi nanti.")
    peserta_id = str(body.get("peserta_id") or "").strip()
    if not ObjectId.is_valid(peserta_id):
        raise HTTPException(status_code=400, detail="Pilih nama Anda dulu.")
    peserta = await db.users.find_one({"_id": ObjectId(peserta_id)}, {"name": 1, "roles": 1})
    if not peserta or "peserta" not in (peserta.get("roles") or []):
        raise HTTPException(status_code=400, detail="Pilih nama Anda dulu.")
    # Sudah tercatat hadir → tidak boleh mengajukan izin.
    absen = await db.absensis.find_one(
        {"kegiatan_id": k["_id"], "user_id": peserta_id})
    if absen and absen.get("status") == "hadir":
        raise HTTPException(status_code=400, detail="Anda sudah tercatat hadir.")
    alasan = str(body.get("alasan") or "").strip()
    if alasan not in IZIN_ALASAN:
        raise HTTPException(status_code=400, detail="Pilih alasan dulu.")
    alasan_lain = None
    if alasan == "Lainnya":
        alasan_lain = _bersih_teks(body.get("alasan_lain"), 100)
        if len(alasan_lain) < 3:
            raise HTTPException(status_code=400, detail="Tulis alasannya.")
    sekarang = now_wita().isoformat()
    # Satu peserta satu izin per kegiatan: pengajuan ulang menimpa baris yang ada.
    ada = await db.izin_kegiatan.find_one(
        {"kegiatan_id": k["_id"], "peserta_id": peserta_id})
    if ada:
        await db.izin_kegiatan.update_one(
            {"_id": ada["_id"]},
            {"$set": {"alasan": alasan, "alasan_lain": alasan_lain,
                      "status": "menunggu", "dibuat_pada": sekarang,
                      "ditinjau_oleh": None, "ditinjau_pada": None}})
    else:
        await db.izin_kegiatan.insert_one({
            "_id": str(uuid.uuid4()), "kegiatan_id": k["_id"], "peserta_id": peserta_id,
            "alasan": alasan, "alasan_lain": alasan_lain, "status": "menunggu",
            "dibuat_pada": sekarang, "ditinjau_oleh": None, "ditinjau_pada": None,
        })
    # Catat status Izin di absen manual (jalur yang sama dengan pencatatan pengurus).
    await db.absensis.update_one(
        {"kegiatan_id": k["_id"], "user_id": peserta_id},
        {"$set": {"kegiatan_id": k["_id"], "user_id": peserta_id, "status": "izin",
                  "arrival_time": None,
                  "reason": alasan_lain or alasan,
                  "note": None,
                  "sumber": "izin_tautan", "tinjauan": "belum_ditinjau",
                  "marked_by": "Izin lewat tautan", "marked_by_id": None,
                  "updated_at": sekarang}},
        upsert=True)
    await notif_kehadiran_dari_status(peserta_id, "izin", k)
    _rekap_cache_buang(k["_id"])
    return {"ok": True, "diperbarui": bool(ada)}


class IzinTinjauInput(BaseModel):
    aksi: str = "setujui"          # setujui | batalkan


@api_router.post("/staff/kegiatan/{kegiatan_id}/izin/{peserta_id}/tinjau")
async def izin_tinjau_absen(kegiatan_id: str, peserta_id: str, body: IzinTinjauInput,
                            staff: dict = Depends(require_staff)):
    """Setujui (hapus tanda belum ditinjau) atau batalkan izin dari tautan."""
    if body.aksi not in ("setujui", "batalkan"):
        raise HTTPException(status_code=400, detail="Aksi tidak valid")
    absen = await db.absensis.find_one(
        {"kegiatan_id": kegiatan_id, "user_id": peserta_id})
    if not absen or absen.get("status") != "izin":
        raise HTTPException(status_code=404, detail="Izin tidak ditemukan")
    sekarang = now_wita().isoformat()
    if body.aksi == "setujui":
        await db.absensis.update_one(
            {"_id": absen["_id"]},
            {"$set": {"tinjauan": "disetujui", "ditinjau_oleh": str(staff["_id"]),
                      "ditinjau_pada": sekarang, "updated_at": sekarang}})
        await db.izin_kegiatan.update_one(
            {"kegiatan_id": kegiatan_id, "peserta_id": peserta_id},
            {"$set": {"status": "disetujui", "ditinjau_oleh": str(staff["_id"]),
                      "ditinjau_pada": sekarang}})
        await log_activity(staff, "izin_setujui", "Menyetujui izin dari tautan", kegiatan_id)
        return {"ok": True, "aksi": "setujui"}
    # Batalkan: status kembali tanpa catatan, pengajuan ditandai ditolak.
    await db.absensis.delete_one({"_id": absen["_id"]})
    await db.izin_kegiatan.update_one(
        {"kegiatan_id": kegiatan_id, "peserta_id": peserta_id},
        {"$set": {"status": "ditolak", "ditinjau_oleh": str(staff["_id"]),
                  "ditinjau_pada": sekarang}})
    k = await db.kegiatans.find_one({"_id": kegiatan_id})
    await simpan_notif_kehadiran(peserta_id, None, k)
    _rekap_cache_buang(kegiatan_id)
    await log_activity(staff, "izin_batalkan", "Membatalkan izin dari tautan", kegiatan_id)
    return {"ok": True, "aksi": "batalkan"}


# ---------------------------------------------------------------------------
# TAUTAN KARTU TANPA LOGIN — satu token per peserta, bisa diganti/dicabut.
# ---------------------------------------------------------------------------
def golongan_peserta(user: dict) -> Optional[str]:
    """Kategori kartu: Bapak-bapak / Ibu-ibu / Muda-mudi (sama dengan frontend)."""
    marital = user.get("marital")
    if not marital:
        return None
    if marital == "belum_menikah":
        return "Muda-mudi"
    if marital != "sudah_menikah":
        return None
    gender = user.get("gender")
    if gender == "L":
        return "Bapak-bapak"
    if gender == "P":
        return "Ibu-ibu"
    return None


@api_router.post("/staff/kartu-tautan/{peserta_id}")
async def kartu_tautan_buat(peserta_id: str, request: Request,
                            staff: dict = Depends(require_staff)):
    """Buat atau ganti tautan kartu peserta (token lama otomatis mati)."""
    p = await db.users.find_one({"_id": _oid(peserta_id)}, {"name": 1, "roles": 1})
    if not p or "peserta" not in (p.get("roles") or []):
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan")
    token = secrets.token_urlsafe(24)
    await db.tautan_kartu.update_many({"peserta_id": peserta_id},
                                      {"$set": {"dicabut": True}})
    await db.tautan_kartu.insert_one({
        "_id": str(uuid.uuid4()), "peserta_id": peserta_id, "token": token,
        "dibuat_pada": now_wita().isoformat(), "dicabut": False,
    })
    await log_activity(staff, "kartu_tautan", f"Membuat tautan kartu '{p.get('name')}'", peserta_id)
    return {"token": token, "link": f"{resolve_base_url(request)}/kartu/{token}"}


@api_router.get("/staff/kartu-tautan")
async def kartu_tautan_daftar(request: Request, staff: dict = Depends(require_staff)):
    """Tautan kartu aktif per peserta."""
    rows = await db.tautan_kartu.find({"dicabut": False}).sort("dibuat_pada", -1).to_list(5000)
    base = resolve_base_url(request)
    items = {}
    for r in rows:
        pid = r.get("peserta_id")
        if pid and pid not in items:
            items[pid] = {"token": r.get("token"), "link": f"{base}/kartu/{r.get('token')}"}
    return {"items": items}


@api_router.get("/publik/kartu/{token}")
async def publik_kartu(token: str):
    """Kartu peserta tanpa login: nama, kategori, dan QR permanen saja."""
    row = await db.tautan_kartu.find_one({"token": token, "dicabut": False})
    if not row:
        raise HTTPException(status_code=404, detail="Tautan tidak berlaku")
    p = await db.users.find_one({"_id": _oid(row.get("peserta_id"))},
                                {"name": 1, "marital": 1, "gender": 1, "roles": 1})
    if not p or "peserta" not in (p.get("roles") or []):
        raise HTTPException(status_code=404, detail="Tautan tidak berlaku")
    return JSONResponse(content={
        "nama": p.get("name"),
        "kategori": golongan_peserta(p),
        "qr": f"EKT:{p['_id']}",
    }, headers={"X-Robots-Tag": "noindex, nofollow",
                "Referrer-Policy": "no-referrer", "Cache-Control": "no-store"})


# ---------------------------------------------------------------------------
# PENDAFTARAN KEGIATAN — konfirmasi peserta lewat tautan publik WhatsApp.
#
# Modul TERPISAH dari absensi: rute publik di sini TIDAK PERNAH menulis ke
# `users` maupun `absensis`. Peserta yang tidak ditemukan disimpan sebagai
# "calon" di `pendaftaran_konfirmasi`, jadi database peserta utama aman.
# ---------------------------------------------------------------------------
PENDAFTARAN_STATUS = ("aktif", "selesai", "arsip")
PENDAFTARAN_KEHADIRAN = ("hadir", "tidak_hadir")
PENDAFTARAN_ALASAN = ("Kerja", "Sakit", "Keperluan keluarga", "Luar kota", "Lainnya")
PENDAFTARAN_LAJU_MAKS = 20          # maksimal konfirmasi per IP & per token
PENDAFTARAN_LAJU_JENDELA = 600      # detik (10 menit)
# Indeks unik (kegiatan_id, nomor_hp) di produksi BELUM parsial, sehingga
# pendaftar tanpa nomor HP memakai penanda unik agar tidak bentrok. Penanda
# tidak pernah ditampilkan ke pengguna (lihat `_pendaftaran_rows`).
PENDAFTARAN_TANPA_HP = "tanpa-hp:"
PENDAFTARAN_CARI_MIN = 2            # huruf minimal untuk pencarian nama
PENDAFTARAN_CARI_MAKS = 5           # hasil maksimal
PENDAFTARAN_CARI_LAJU = 60          # pencarian per IP per 10 menit
PENDAFTARAN_CARI_JENDELA = 600
PENDAFTARAN_REKAP_LAJU = 120        # buka rekap publik per IP per 10 menit
PENDAFTARAN_REKAP_JENDELA = 600
PENDAFTARAN_AKUN_LABEL = {
    "aktif": "Aktif",
    "belum_aktivasi": "Belum Aktivasi",
    "nonaktif": "Nonaktif",
    "calon": "Calon Peserta",
}


def _pendaftaran_status_tampil(k: dict) -> str:
    """Status yang dilihat pengguna: aktif | berlangsung | selesai | arsip.

    Status tersimpan hanya `aktif`/`selesai`/`arsip`. "Berlangsung" dan
    "selesai" otomatis dihitung dari tanggal kegiatan (WITA) supaya tidak
    perlu ada pekerjaan terjadwal.
    """
    status = str(k.get("status") or "aktif").lower()
    if status == "arsip":
        return "arsip"
    if status == "selesai":
        return "selesai"
    tanggal = str(k.get("tanggal") or "")[:10]
    hari_ini = now_wita().strftime("%Y-%m-%d")
    if tanggal and tanggal == hari_ini:
        return "berlangsung"
    if tanggal and tanggal < hari_ini:
        return "selesai"
    return "aktif"


def _pendaftaran_terbuka(k: dict) -> bool:
    """Tautan publik hanya menerima konfirmasi selama kegiatan belum selesai."""
    return _pendaftaran_status_tampil(k) in ("aktif", "berlangsung")


def _pendaftaran_jadwal(k: dict) -> dict:
    """Jadwal buka/tutup pendaftaran (tanggal WITA, tanpa jam).

    Buka mulai 00.00 WITA, tutup sampai 23.59 WITA. Bila `tutup` kosong,
    bawaan sehari sebelum tanggal acara.
    """
    buka = str(k.get("pendaftaran_buka") or "")[:10] or None
    tutup = str(k.get("pendaftaran_tutup") or "")[:10] or None
    if not tutup:
        tanggal = str(k.get("tanggal") or "")[:10]
        if tanggal:
            try:
                tutup = (datetime.strptime(tanggal, "%Y-%m-%d")
                         - timedelta(days=1)).strftime("%Y-%m-%d")
            except Exception:
                tutup = None
    return {"buka": buka, "tutup": tutup}


def _pendaftaran_jadwal_status(k: dict) -> str:
    """belum | dibuka | ditutup — dihitung dari tanggal (WITA)."""
    j = _pendaftaran_jadwal(k)
    hari_ini = now_wita().strftime("%Y-%m-%d")
    if j["buka"] and hari_ini < j["buka"]:
        return "belum"
    if j["tutup"] and hari_ini > j["tutup"]:
        return "ditutup"
    return "dibuka"


def _pendaftaran_bisa_isi(k: dict) -> bool:
    """Pendaftaran masih menerima jawaban (jadwal + status kegiatan)."""
    return _pendaftaran_terbuka(k) and _pendaftaran_jadwal_status(k) == "dibuka"


async def _pendaftaran_hitung(kegiatan_ids: list) -> dict:
    """Hitung statistik beberapa kegiatan sekaligus (satu query konfirmasi).

    Total = jumlah yang sudah mengisi (mulai dari 0), bukan jumlah peserta
    di data absensi. Total = ikut + tidak_ikut.
    """
    ids = [i for i in dict.fromkeys(kegiatan_ids or []) if i]
    hasil = {i: {"ikut": 0, "tidak_ikut": 0} for i in ids}
    if not ids:
        return hasil
    async for r in db.pendaftaran_konfirmasi.find({"kegiatan_id": {"$in": ids}}):
        row = hasil.get(r.get("kegiatan_id"))
        if row is None:
            continue
        if r.get("kehadiran") == "hadir":
            row["ikut"] += 1
        elif r.get("kehadiran") == "tidak_hadir":
            row["tidak_ikut"] += 1
    for row in hasil.values():
        row["total"] = row["ikut"] + row["tidak_ikut"]
        row["persentase_ikut"] = (
            round(row["ikut"] * 100 / row["total"]) if row["total"] else 0)
    return hasil


def _pendaftaran_serialize(k: dict, counts: Optional[dict] = None,
                           base: str = "") -> dict:
    c = counts or {}
    token = k.get("token")
    jadwal = _pendaftaran_jadwal(k)
    return {
        "id": k["_id"],
        "nama": k.get("nama"),
        "tanggal": k.get("tanggal"),
        "lokasi": k.get("lokasi"),
        "maps_url": k.get("maps_url"),
        "catatan": k.get("catatan"),
        "penyelenggara": k.get("penyelenggara"),
        "wajib_konfirmasi": k.get("wajib_konfirmasi", True),
        "hp_wajib": k.get("hp_wajib", True),
        "kegiatan_umum": k.get("kegiatan_umum", False),
        "tampilkan_logo": k.get("tampilkan_logo", True),
        "status": k.get("status") or "aktif",
        "status_tampil": _pendaftaran_status_tampil(k),
        "pendaftaran_buka": jadwal["buka"],
        "pendaftaran_tutup": jadwal["tutup"],
        "jadwal_status": _pendaftaran_jadwal_status(k),
        "token": token,
        "link": f"{base}/daftar/{token}" if (base and token) else None,
        "rekap_publik": bool(k.get("rekap_publik")),
        "rekap_token": k.get("rekap_token") if k.get("rekap_publik") else None,
        "rekap_link": (f"{base}/rekap-pendaftaran/{k.get('rekap_token')}"
                       if (base and k.get("rekap_publik") and k.get("rekap_token"))
                       else None),
        "kegiatan_id": k.get("kegiatan_id"),
        "kegiatan_dibuat_pada": k.get("kegiatan_dibuat_pada"),
        "total": c.get("total", 0),
        "ikut": c.get("ikut", 0),
        "tidak_ikut": c.get("tidak_ikut", 0),
        "persentase_ikut": c.get("persentase_ikut", 0),
        "dibuat_pada": k.get("dibuat_pada"),
        "diarsipkan_pada": k.get("diarsipkan_pada"),
    }


async def _pendaftaran_rows(kegiatan_id: str) -> list:
    """Daftar konfirmasi satu kegiatan (urut waktu kirim)."""
    rows = await db.pendaftaran_konfirmasi.find({"kegiatan_id": kegiatan_id}) \
        .sort("dibuat_pada", 1).to_list(20000)
    items = []
    for r in rows:
        akun = r.get("status_akun") or "calon"
        nomor = r.get("nomor_hp")
        if isinstance(nomor, str) and nomor.startswith(PENDAFTARAN_TANPA_HP):
            nomor = None
        items.append({
            "id": r["_id"],
            "nama": r.get("nama"),
            "nomor_hp": nomor,
            "kehadiran": r.get("kehadiran"),
            "alasan": r.get("alasan"),
            "alasan_lain": r.get("alasan_lain"),
            "keterangan": r.get("keterangan"),
            "peserta_id": r.get("peserta_id"),
            "status_akun": akun,
            "status_akun_label": PENDAFTARAN_AKUN_LABEL.get(akun, "Calon Peserta"),
            "dibuat_pada": r.get("dibuat_pada"),
            "diperbarui_pada": r.get("diperbarui_pada"),
        })
    return items


def _pendaftaran_ringkas_alasan(rows: list) -> dict:
    """Jumlah alasan tidak ikut per kategori (untuk rekap)."""
    hasil = {a: 0 for a in PENDAFTARAN_ALASAN}
    for r in rows:
        if r.get("kehadiran") != "tidak_hadir":
            continue
        alasan = r.get("alasan")
        if alasan in hasil:
            hasil[alasan] += 1
    return hasil


async def _pendaftaran_cocok(nama: str, nomor: str):
    """Cocokkan Nama + Nomor HP ke database peserta. Tidak pernah menulis.

    Nomor HP di `users` bisa tersimpan dalam beberapa bentuk (0812…, 62812…,
    +62 812…), jadi semua varian dicoba seperti pada alur login.
    """
    varian = {nomor}
    if nomor.startswith("62"):
        varian.add("0" + nomor[2:])
        varian.add("+" + nomor)
    pola = re.escape(nama).replace(r"\ ", r"\s+")
    user = await db.users.find_one(
        {"name": {"$regex": f"^{pola}$", "$options": "i"},
         "$or": [{"phone": {"$in": list(varian)}},
                 {"whatsapp": {"$in": list(varian)}}]},
        {"name": 1, "status": 1, "roles": 1})
    if not user:
        return None, "calon"
    status = str(user.get("status") or "active").lower()
    if status == "active":
        return str(user["_id"]), "aktif"
    if status == "pending":
        return str(user["_id"]), "belum_aktivasi"
    if status == "calon":
        return str(user["_id"]), "calon"
    return str(user["_id"]), "nonaktif"


async def _pendaftaran_laju_ok(ip: Optional[str], token: str) -> bool:
    """Pembatas laju per IP DAN per token (20 konfirmasi / 10 menit)."""
    batas = (now_wita() - timedelta(seconds=PENDAFTARAN_LAJU_JENDELA)).isoformat()
    if ip:
        jumlah = await db.pendaftaran_laju.count_documents(
            {"ip": ip, "at": {"$gte": batas}})
        if jumlah >= PENDAFTARAN_LAJU_MAKS:
            return False
    jumlah_token = await db.pendaftaran_laju.count_documents(
        {"token": token, "at": {"$gte": batas}})
    if jumlah_token >= PENDAFTARAN_LAJU_MAKS:
        return False
    await db.pendaftaran_laju.insert_one(
        {"ip": ip, "token": token, "at": now_wita().isoformat()})
    return True


async def _pendaftaran_cari_laju_ok(ip: Optional[str]) -> bool:
    """Pembatas laju pencarian nama publik (per IP)."""
    if not ip:
        return True
    batas = (now_wita() - timedelta(seconds=PENDAFTARAN_CARI_JENDELA)).isoformat()
    jumlah = await db.pendaftaran_cari_laju.count_documents(
        {"ip": ip, "at": {"$gte": batas}})
    if jumlah >= PENDAFTARAN_CARI_LAJU:
        return False
    await db.pendaftaran_cari_laju.insert_one({"ip": ip, "at": now_wita().isoformat()})
    return True


async def _pendaftaran_rekap_laju_ok(ip: Optional[str]) -> bool:
    """Pembatas laju rekap publik (longgar, per IP)."""
    if not ip:
        return True
    batas = (now_wita() - timedelta(seconds=PENDAFTARAN_REKAP_JENDELA)).isoformat()
    jumlah = await db.pendaftaran_rekap_laju.count_documents(
        {"ip": ip, "at": {"$gte": batas}})
    if jumlah >= PENDAFTARAN_REKAP_LAJU:
        return False
    await db.pendaftaran_rekap_laju.insert_one({"ip": ip, "at": now_wita().isoformat()})
    return True


async def _cari_peserta_publik(q: str) -> list:
    """Cari peserta aktif berdasarkan nama. Hanya id dan nama (whitelist)."""
    teks = _bersih_teks(q, 60)
    if len(teks) < PENDAFTARAN_CARI_MIN:
        return []
    pola = re.escape(teks).replace(r"\ ", r"\s+")
    rows = await db.users.find(
        {"roles": "peserta", "status": "active", "is_system": {"$ne": True},
         "name": {"$regex": pola, "$options": "i"}},
        {"name": 1}).sort("name", 1).to_list(PENDAFTARAN_CARI_MAKS)
    return [{"id": str(r["_id"]), "nama": r.get("name")} for r in rows]


def _pendaftaran_nomor_simpan(nomor: Optional[str], kegiatan_id: str) -> str:
    """Nilai `nomor_hp` yang disimpan.

    Indeks unik (kegiatan_id, nomor_hp) di produksi belum parsial, jadi pendaftar
    tanpa nomor HP diberi penanda unik per baris agar tidak bentrok. Penanda
    tidak pernah dikembalikan ke pengguna.
    """
    if nomor:
        return nomor
    return f"{PENDAFTARAN_TANPA_HP}{uuid.uuid4().hex}"


class PendaftaranInput(BaseModel):
    nama: str
    tanggal: str                       # YYYY-MM-DD (WITA)
    lokasi: Optional[str] = None
    maps_url: Optional[str] = None
    catatan: Optional[str] = None
    penyelenggara: Optional[str] = None
    wajib_konfirmasi: bool = True      # True = Wajib ikut, False = Biasa
    hp_wajib: bool = True              # False = nomor HP opsional di formulir publik
    kegiatan_umum: bool = False        # True = pendaftar luar, tanpa pencocokan peserta
    tampilkan_logo: bool = True        # False = sembunyikan logo E-Kertalangu
    pendaftaran_buka: Optional[str] = None
    pendaftaran_tutup: Optional[str] = None


class PendaftaranUpdate(BaseModel):
    nama: Optional[str] = None
    tanggal: Optional[str] = None
    lokasi: Optional[str] = None
    maps_url: Optional[str] = None
    catatan: Optional[str] = None
    penyelenggara: Optional[str] = None
    wajib_konfirmasi: Optional[bool] = None
    hp_wajib: Optional[bool] = None
    kegiatan_umum: Optional[bool] = None
    tampilkan_logo: Optional[bool] = None
    pendaftaran_buka: Optional[str] = None
    pendaftaran_tutup: Optional[str] = None


class PendaftaranStatusInput(BaseModel):
    status: str = "selesai"            # aktif | selesai | arsip


PENDAFTARAN_MAPS_HOST = ("google.com/maps", "maps.app.goo.gl", "goo.gl/maps")


def _pendaftaran_maps_valid(url: str) -> bool:
    """Tautan hanya diterima dari Google Maps."""
    try:
        p = urlparse(url)
    except Exception:
        return False
    if p.scheme not in ("http", "https"):
        return False
    host = (p.netloc or "").lower()
    path = f"{host}{p.path}".lower()
    return any(h in path for h in PENDAFTARAN_MAPS_HOST)


def _pendaftaran_tanggal(nilai, label: str) -> Optional[str]:
    teks = str(nilai or "").strip()[:10]
    if not teks:
        return None
    try:
        datetime.strptime(teks, "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=400, detail=f"{label} tidak valid.")
    return teks


def _pendaftaran_validasi(body, parsial: bool = False) -> dict:
    """Daftar putih isian kegiatan pendaftaran."""
    data: dict = {}
    if not parsial or body.nama is not None:
        nama = _bersih_teks(body.nama, 120)
        if len(nama) < 3:
            raise HTTPException(status_code=400, detail="Nama kegiatan minimal 3 huruf.")
        data["nama"] = nama
    if not parsial or body.tanggal is not None:
        tanggal = str(body.tanggal or "").strip()[:10]
        try:
            datetime.strptime(tanggal, "%Y-%m-%d")
        except Exception:
            raise HTTPException(status_code=400, detail="Tanggal kegiatan tidak valid.")
        data["tanggal"] = tanggal
    if not parsial or body.lokasi is not None:
        data["lokasi"] = _bersih_teks(body.lokasi, 160) or None
    if not parsial or body.maps_url is not None:
        maps = _bersih_teks(body.maps_url, 400) or None
        if maps and not _pendaftaran_maps_valid(maps):
            raise HTTPException(
                status_code=400,
                detail="Tautan harus dari Google Maps. Kosongkan bila tidak perlu.")
        data["maps_url"] = maps
    if not parsial or body.catatan is not None:
        data["catatan"] = _bersih_teks(body.catatan, 300) or None
    if not parsial or body.penyelenggara is not None:
        data["penyelenggara"] = _bersih_teks(body.penyelenggara, 120) or None
    if not parsial or body.wajib_konfirmasi is not None:
        data["wajib_konfirmasi"] = bool(body.wajib_konfirmasi)
    if not parsial or body.hp_wajib is not None:
        data["hp_wajib"] = bool(body.hp_wajib)
    if not parsial or body.kegiatan_umum is not None:
        data["kegiatan_umum"] = bool(body.kegiatan_umum)
    if not parsial or body.tampilkan_logo is not None:
        data["tampilkan_logo"] = bool(body.tampilkan_logo)
    if not parsial or body.pendaftaran_buka is not None:
        data["pendaftaran_buka"] = _pendaftaran_tanggal(
            body.pendaftaran_buka, "Tanggal buka pendaftaran")
    if not parsial or body.pendaftaran_tutup is not None:
        data["pendaftaran_tutup"] = _pendaftaran_tanggal(
            body.pendaftaran_tutup, "Tanggal tutup pendaftaran")
    return data


def _pendaftaran_cek_jadwal(data: dict, lama: Optional[dict] = None) -> None:
    """Tutup tidak boleh sebelum buka dan tidak melewati tanggal acara."""
    gabung = {**(lama or {}), **data}
    buka = str(gabung.get("pendaftaran_buka") or "")[:10]
    tutup = str(gabung.get("pendaftaran_tutup") or "")[:10]
    tanggal = str(gabung.get("tanggal") or "")[:10]
    if not tutup and tanggal:
        try:
            tutup = (datetime.strptime(tanggal, "%Y-%m-%d")
                     - timedelta(days=1)).strftime("%Y-%m-%d")
        except Exception:
            tutup = ""
    if buka and tutup and tutup < buka:
        raise HTTPException(
            status_code=400,
            detail="Tanggal tutup harus setelah tanggal buka dan tidak melewati tanggal acara.")
    if tutup and tanggal and tutup > tanggal:
        raise HTTPException(
            status_code=400,
            detail="Tanggal tutup harus setelah tanggal buka dan tidak melewati tanggal acara.")


@api_router.get("/staff/pendaftaran")
async def pendaftaran_daftar(request: Request, status: str = "semua",
                             date_from: str = "", date_to: str = "",
                             staff: dict = Depends(require_staff)):
    """Daftar kegiatan pendaftaran + statistik ringkas."""
    rows = await db.pendaftaran_kegiatan.find({}).sort("tanggal", -1).to_list(1000)
    base = resolve_base_url(request)
    counts = await _pendaftaran_hitung([r["_id"] for r in rows])
    items = [_pendaftaran_serialize(r, counts.get(r["_id"]), base) for r in rows]
    if status in ("aktif", "berlangsung", "selesai", "arsip"):
        items = [i for i in items if i["status_tampil"] == status]
    if date_from:
        items = [i for i in items if str(i.get("tanggal") or "") >= date_from]
    if date_to:
        items = [i for i in items if str(i.get("tanggal") or "") <= date_to]
    return {"items": items}


@api_router.post("/staff/pendaftaran")
async def pendaftaran_buat(body: PendaftaranInput, request: Request,
                           staff: dict = Depends(require_staff)):
    """Buat kegiatan pendaftaran baru + tautan publiknya."""
    data = _pendaftaran_validasi(body)
    _pendaftaran_cek_jadwal(data)
    sekarang = now_wita().isoformat()
    doc = {
        "_id": str(uuid.uuid4()),
        **data,
        "status": "aktif",
        "token": secrets.token_urlsafe(24),
        "dibuat_oleh": str(staff["_id"]),
        "dibuat_pada": sekarang,
        "diarsipkan_pada": None,
        "diarsipkan_oleh": None,
    }
    await db.pendaftaran_kegiatan.insert_one(doc)
    await log_activity(staff, "pendaftaran_buat",
                       f"Membuat pendaftaran kegiatan '{data['nama']}'", doc["_id"])
    counts = await _pendaftaran_hitung([doc["_id"]])
    return _pendaftaran_serialize(doc, counts.get(doc["_id"]), resolve_base_url(request))


@api_router.get("/staff/pendaftaran/{kegiatan_id}")
async def pendaftaran_detail(kegiatan_id: str, request: Request,
                             staff: dict = Depends(require_staff)):
    """Detail satu kegiatan: statistik + daftar konfirmasi peserta."""
    k = await db.pendaftaran_kegiatan.find_one({"_id": kegiatan_id})
    if not k:
        # Kegiatan sudah dihapus / tautan lama: 410 agar frontend tidak
        # mengulang permintaan dan tidak muncul sebagai error 404.
        raise HTTPException(status_code=410,
                            detail="Kegiatan pendaftaran sudah tidak tersedia")
    counts = await _pendaftaran_hitung([kegiatan_id])
    rows = await _pendaftaran_rows(kegiatan_id)
    return {
        **_pendaftaran_serialize(k, counts.get(kegiatan_id), resolve_base_url(request)),
        "alasan_ringkas": _pendaftaran_ringkas_alasan(rows),
        "peserta": rows,
    }


@api_router.patch("/staff/pendaftaran/{kegiatan_id}")
async def pendaftaran_ubah(kegiatan_id: str, body: PendaftaranUpdate, request: Request,
                           staff: dict = Depends(require_staff)):
    k = await db.pendaftaran_kegiatan.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan pendaftaran tidak ditemukan")
    data = _pendaftaran_validasi(body, parsial=True)
    if data:
        _pendaftaran_cek_jadwal(data, k)
        await db.pendaftaran_kegiatan.update_one({"_id": kegiatan_id}, {"$set": data})
        k.update(data)
    await log_activity(staff, "pendaftaran_ubah",
                       f"Mengubah pendaftaran kegiatan '{k.get('nama')}'", kegiatan_id)
    counts = await _pendaftaran_hitung([kegiatan_id])
    return _pendaftaran_serialize(k, counts.get(kegiatan_id), resolve_base_url(request))


@api_router.post("/staff/pendaftaran/{kegiatan_id}/status")
async def pendaftaran_status(kegiatan_id: str, body: PendaftaranStatusInput,
                             request: Request, staff: dict = Depends(require_staff)):
    """Ubah status: selesai (tutup konfirmasi) atau arsip (pindah ke arsip)."""
    if body.status not in PENDAFTARAN_STATUS:
        raise HTTPException(status_code=400, detail="Status tidak valid")
    k = await db.pendaftaran_kegiatan.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan pendaftaran tidak ditemukan")
    sekarang = now_wita().isoformat()
    upd = {"status": body.status}
    if body.status == "arsip":
        upd["diarsipkan_pada"] = sekarang
        upd["diarsipkan_oleh"] = str(staff["_id"])
    elif body.status == "aktif":
        upd["diarsipkan_pada"] = None
        upd["diarsipkan_oleh"] = None
    await db.pendaftaran_kegiatan.update_one({"_id": kegiatan_id}, {"$set": upd})
    k.update(upd)
    await log_activity(staff, f"pendaftaran_{body.status}",
                       f"Status pendaftaran '{k.get('nama')}' → {body.status}", kegiatan_id)
    counts = await _pendaftaran_hitung([kegiatan_id])
    return _pendaftaran_serialize(k, counts.get(kegiatan_id), resolve_base_url(request))


@api_router.post("/staff/pendaftaran/{kegiatan_id}/buat-kegiatan")
async def pendaftaran_buat_kegiatan(kegiatan_id: str, request: Request,
                                    staff: dict = Depends(require_staff)):
    """Buat (atau hubungkan) satu kegiatan berabsen dari pendaftar 'Ikut'.

    Idempoten: satu pendaftaran hanya menghasilkan satu kegiatan.
    """
    p = await db.pendaftaran_kegiatan.find_one({"_id": kegiatan_id})
    if not p:
        raise HTTPException(status_code=404, detail="Kegiatan pendaftaran tidak ditemukan")

    # Sudah pernah dibuat → kembalikan yang sama (tanpa duplikat).
    if p.get("kegiatan_id"):
        ada = await db.kegiatans.find_one({"_id": p["kegiatan_id"]})
        if ada:
            return {"kegiatan_id": ada["_id"], "nama": ada.get("name"),
                    "dibuat": False, "peserta": 0, "tamu": 0}

    rows = await _pendaftaran_rows(kegiatan_id)
    ikut = [r for r in rows if r.get("kehadiran") == "hadir"]
    if not ikut:
        raise HTTPException(status_code=400,
                            detail="Belum ada pendaftar yang memilih ikut.")

    jam = p.get("jam") or {}
    kid = str(uuid.uuid4())
    doc = {
        "_id": kid, "name": p.get("nama"), "type": "rutin",
        "date": p.get("tanggal"),
        "start_time": jam.get("mulai") or "08:00",
        "end_time": jam.get("selesai") or "10:00",
        "location": p.get("lokasi"), "audience": "publik",
        "gender_filter": "semua", "status": "open",
        "created_at": now_wita().isoformat(),
        "dari_pendaftaran": kegiatan_id,
    }
    await db.kegiatans.insert_one(doc)

    # Peserta yang nomor HP-nya cocok dipasangkan; sisanya dicatat sebagai tamu.
    # Kegiatan umum: semua yang ikut dicatat sebagai tamu (tanpa pencocokan).
    umum = bool(p.get("kegiatan_umum", False))
    peserta_ids, tamu = [], []
    for r in ikut:
        nomor = r.get("nomor_hp")
        u = None
        if nomor and not umum:
            varian = {nomor}
            if nomor.startswith("62"):
                varian.add("0" + nomor[2:])
                varian.add("+" + nomor)
            u = await db.users.find_one(
                {"$or": [{"phone": {"$in": list(varian)}},
                         {"whatsapp": {"$in": list(varian)}}],
                 "roles": "peserta"}, {"name": 1})
        if u:
            peserta_ids.append(str(u["_id"]))
        else:
            tamu.append(r.get("nama") or "Tamu")

    sekarang = now_wita().isoformat()
    for pid in peserta_ids:
        await db.absensis.update_one(
            {"kegiatan_id": kid, "user_id": pid},
            {"$set": {"kegiatan_id": kid, "user_id": pid, "status": "hadir",
                      "arrival_time": sekarang,
                      "marked_by": f"Dari pendaftaran: {staff.get('name')}",
                      "marked_by_id": str(staff["_id"]), "updated_at": sekarang}},
            upsert=True)
    for nama in tamu:
        await db.guest_absens.insert_one({
            "_id": str(uuid.uuid4()), "kegiatan_id": kid, "name": nama,
            "arrival_time": sekarang,
            "added_by": f"Dari pendaftaran: {staff.get('name')}",
            "created_at": sekarang})

    await db.pendaftaran_kegiatan.update_one(
        {"_id": kegiatan_id},
        {"$set": {"kegiatan_id": kid, "kegiatan_dibuat_pada": sekarang}})
    await log_activity(staff, "pendaftaran_buat_kegiatan",
                       f"Membuat kegiatan berabsen '{p.get('nama')}' dari pendaftaran "
                       f"({len(peserta_ids)} peserta, {len(tamu)} tamu)", kegiatan_id)
    return {"kegiatan_id": kid, "nama": p.get("nama"), "dibuat": True,
            "peserta": len(peserta_ids), "tamu": len(tamu)}


@api_router.post("/staff/pendaftaran/{kegiatan_id}/tautan")
async def pendaftaran_tautan_baru(kegiatan_id: str, request: Request,
                                  staff: dict = Depends(require_staff)):
    """Buat ulang tautan publik (token lama otomatis mati)."""
    k = await db.pendaftaran_kegiatan.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan pendaftaran tidak ditemukan")
    token = secrets.token_urlsafe(24)
    await db.pendaftaran_kegiatan.update_one({"_id": kegiatan_id},
                                             {"$set": {"token": token}})
    await log_activity(staff, "pendaftaran_tautan",
                       f"Membuat ulang tautan pendaftaran '{k.get('nama')}'", kegiatan_id)
    return {"token": token, "link": f"{resolve_base_url(request)}/daftar/{token}"}


@api_router.delete("/staff/pendaftaran/{kegiatan_id}")
async def pendaftaran_hapus(kegiatan_id: str, staff: dict = Depends(require_admin)):
    """Hapus permanen (beserta konfirmasinya). Khusus Administrator."""
    k = await db.pendaftaran_kegiatan.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan pendaftaran tidak ditemukan")
    await db.pendaftaran_konfirmasi.delete_many({"kegiatan_id": kegiatan_id})
    await db.pendaftaran_kegiatan.delete_one({"_id": kegiatan_id})
    await log_activity(staff, "pendaftaran_hapus",
                       f"Menghapus permanen pendaftaran '{k.get('nama')}'", kegiatan_id)
    return {"ok": True}


@api_router.get("/publik/peserta/cari")
async def publik_peserta_cari(q: str = "", request: Request = None):
    """Cari peserta aktif berdasarkan nama (untuk pendaftaran & izin publik).

    Hanya mengembalikan id dan nama. Minimal 2 huruf, maksimal 5 hasil.
    """
    if not await _pendaftaran_cari_laju_ok(client_ip(request)):
        raise HTTPException(status_code=429,
                            detail="Terlalu banyak pencarian. Coba lagi nanti.")
    hasil = await _cari_peserta_publik(q)
    return JSONResponse(content={"items": hasil},
                        headers={"X-Robots-Tag": "noindex, nofollow",
                                 "Cache-Control": "no-store"})


@api_router.get("/publik/daftar/{token}")
async def publik_pendaftaran_info(token: str):
    """Info kegiatan untuk halaman konfirmasi publik (tanpa login)."""
    k = await db.pendaftaran_kegiatan.find_one({"token": token})
    if not k:
        raise HTTPException(status_code=404, detail="Tautan tidak berlaku")
    jadwal = _pendaftaran_jadwal(k)
    jadwal_status = _pendaftaran_jadwal_status(k)
    if not _pendaftaran_terbuka(k):
        jadwal_status = "ditutup"
    return JSONResponse(content={
        "nama": k.get("nama"),
        "tanggal": k.get("tanggal"),
        "lokasi": k.get("lokasi"),
        "maps_url": k.get("maps_url"),
        "catatan": k.get("catatan"),
        "penyelenggara": k.get("penyelenggara"),
        "wajib_konfirmasi": k.get("wajib_konfirmasi", True),
        "hp_wajib": k.get("hp_wajib", True),
        "kegiatan_umum": k.get("kegiatan_umum", False),
        "tampilkan_logo": k.get("tampilkan_logo", True),
        "pendaftaran_buka": jadwal["buka"],
        "pendaftaran_tutup": jadwal["tutup"],
        "jadwal_status": jadwal_status,
        "alasan": list(PENDAFTARAN_ALASAN),
    }, headers={"X-Robots-Tag": "noindex, nofollow",
                "Referrer-Policy": "no-referrer", "Cache-Control": "no-store"})


@api_router.post("/publik/daftar/{token}")
async def publik_pendaftaran_kirim(token: str, body: dict, request: Request):
    """Simpan jawaban peserta. Hanya menulis ke `pendaftaran_konfirmasi`."""
    try:
        return await _pendaftaran_simpan(token, body, request)
    except HTTPException:
        raise
    except DuplicateKeyError:
        raise HTTPException(status_code=409,
                            detail="Anda sudah terdaftar di kegiatan ini.")
    except Exception:
        logger.exception("Gagal menyimpan pendaftaran publik")
        raise HTTPException(
            status_code=400,
            detail="Pendaftaran gagal disimpan. Coba lagi sebentar lagi.")


async def _pendaftaran_simpan(token: str, body: dict, request: Request):
    k = await db.pendaftaran_kegiatan.find_one({"token": token})
    if not k:
        raise HTTPException(status_code=404, detail="Tautan tidak berlaku")
    if not _pendaftaran_bisa_isi(k):
        raise HTTPException(status_code=410, detail="Pendaftaran sudah ditutup")
    if not await _pendaftaran_laju_ok(client_ip(request), token):
        raise HTTPException(status_code=429,
                            detail="Terlalu banyak percobaan. Coba lagi nanti.")

    nama = _bersih_teks(body.get("nama"), 100)
    if len(nama) < 3:
        raise HTTPException(status_code=400, detail="Nama lengkap minimal 3 huruf.")
    if not _nama_valid(nama):
        raise HTTPException(status_code=400, detail="Nama hanya boleh berisi huruf.")

    hp_wajib = bool(k.get("hp_wajib", True))
    nomor = normalize_wa_wali(body.get("nomor_hp"))
    if nomor and (not nomor.startswith("62") or not (10 <= len(nomor) <= 15)):
        raise HTTPException(status_code=400, detail="Nomor HP tidak valid.")
    if not nomor and hp_wajib:
        raise HTTPException(status_code=400, detail="Nomor HP tidak valid.")

    kehadiran = str(body.get("kehadiran") or "").strip()
    if kehadiran not in PENDAFTARAN_KEHADIRAN:
        raise HTTPException(status_code=400, detail="Pilih jawaban dulu.")

    wajib = bool(k.get("wajib_konfirmasi", True))
    alasan = None
    alasan_lain = None
    if kehadiran == "tidak_hadir":
        alasan = str(body.get("alasan") or "").strip() or None
        if alasan and alasan not in PENDAFTARAN_ALASAN:
            raise HTTPException(status_code=400, detail="Alasan tidak valid.")
        if not alasan and wajib:
            raise HTTPException(status_code=400, detail="Pilih alasan tidak ikut.")
        if alasan == "Lainnya":
            alasan_lain = _bersih_teks(body.get("alasan_lain"), 100)
            if len(alasan_lain) < 3:
                raise HTTPException(status_code=400, detail="Tulis alasannya.")

    keterangan = _bersih_teks(body.get("keterangan"), 200) or None

    # Peserta lama yang dipilih lewat pencarian nama (id saja, tanpa ubah data).
    peserta_id = None
    status_akun = "calon"
    pilih_id = str(body.get("peserta_id") or "").strip()
    if pilih_id:
        if not ObjectId.is_valid(pilih_id):
            raise HTTPException(status_code=400, detail="Peserta tidak ditemukan.")
        p = await db.users.find_one(
            {"_id": ObjectId(pilih_id), "roles": "peserta", "status": "active",
             "is_system": {"$ne": True}}, {"name": 1})
        if not p:
            raise HTTPException(status_code=400, detail="Peserta tidak ditemukan.")
        peserta_id, status_akun = pilih_id, "aktif"
        nama = p.get("name") or nama
    elif bool(k.get("kegiatan_umum", False)):
        # Kegiatan umum tanpa pilih nama: pendaftar luar, tidak dicocokkan.
        peserta_id, status_akun = None, "calon"
    elif nomor:
        peserta_id, status_akun = await _pendaftaran_cocok(nama, nomor)
    sekarang = now_wita().isoformat()

    # Satu nomor satu jawaban. Tanpa nomor HP, cegah duplikat berdasarkan nama.
    if nomor:
        ada = await db.pendaftaran_konfirmasi.find_one(
            {"kegiatan_id": k["_id"], "nomor_hp": nomor})
    else:
        kunci = _norm_nama(nama)
        ada = None
        async for r in db.pendaftaran_konfirmasi.find({"kegiatan_id": k["_id"]}):
            if _norm_nama(r.get("nama")) == kunci:
                ada = r
                break
        if ada is not None:
            raise HTTPException(
                status_code=409,
                detail="Nama ini sudah mendaftar. Jika berbeda orang, tambahkan "
                       "nama belakang atau isi nomor HP.")
    data = {
        "nama": nama, "kehadiran": kehadiran,
        "alasan": alasan, "alasan_lain": alasan_lain, "keterangan": keterangan,
        "peserta_id": peserta_id, "status_akun": status_akun,
        "diperbarui_pada": sekarang,
    }
    if ada:
        await db.pendaftaran_konfirmasi.update_one(
            {"_id": ada["_id"]}, {"$set": {**data, "nomor_hp": ada.get("nomor_hp")}})
    else:
        await db.pendaftaran_konfirmasi.insert_one({
            "_id": str(uuid.uuid4()), "kegiatan_id": k["_id"],
            **data, "nomor_hp": _pendaftaran_nomor_simpan(nomor, k["_id"]),
            "dibuat_pada": sekarang,
        })

    return {
        "ok": True,
        "diperbarui": bool(ada),
        "pesan": "Jawaban Anda sudah tersimpan.",
        "kehadiran": kehadiran,
    }


# ---------------------------------------------------------------------------
# REKAP PUBLIK PENDAFTARAN — token terpisah, hanya baca, tanpa data pribadi.
# ---------------------------------------------------------------------------
def _rekap_tidak_tersedia():
    """Pesan SAMA untuk semua penyebab (mati / arsip / dihapus / token salah)."""
    return HTTPException(status_code=404, detail="Tautan tidak tersedia")


async def _pendaftaran_rekap_aktif(token: str) -> dict:
    """Kegiatan yang tautan rekapnya boleh dibuka, atau 404 yang seragam."""
    if not token:
        raise _rekap_tidak_tersedia()
    k = await db.pendaftaran_kegiatan.find_one({"rekap_token": token})
    if not k or not k.get("rekap_publik"):
        raise _rekap_tidak_tersedia()
    if _pendaftaran_status_tampil(k) == "arsip":
        raise _rekap_tidak_tersedia()
    return k


@api_router.get("/publik/rekap-pendaftaran/{token}")
async def publik_rekap_pendaftaran(token: str, request: Request):
    """Rekap publik satu kegiatan pendaftaran (tanpa login, hanya baca)."""
    if not await _pendaftaran_rekap_laju_ok(client_ip(request)):
        raise HTTPException(status_code=429,
                            detail="Terlalu banyak permintaan. Coba lagi nanti.")
    k = await _pendaftaran_rekap_aktif(token)
    rows = await db.pendaftaran_konfirmasi.find(
        {"kegiatan_id": k["_id"]}, {"nama": 1, "kehadiran": 1, "diperbarui_pada": 1,
                                    "dibuat_pada": 1}).to_list(20000)
    ikut, tidak_ikut = [], 0
    terbaru = None
    for r in rows:
        if r.get("kehadiran") == "hadir":
            ikut.append(str(r.get("nama") or ""))
        elif r.get("kehadiran") == "tidak_hadir":
            tidak_ikut += 1
        cap = r.get("diperbarui_pada") or r.get("dibuat_pada")
        if cap and (terbaru is None or str(cap) > str(terbaru)):
            terbaru = cap
    ikut.sort(key=lambda n: n.lower())
    return JSONResponse(content={
        "judul": k.get("nama"),
        "tanggal": k.get("tanggal"),
        "lokasi": k.get("lokasi"),
        "penyelenggara": k.get("penyelenggara"),
        "tampilkan_logo": k.get("tampilkan_logo", True),
        "total": len(ikut) + tidak_ikut,
        "ikut": len(ikut),
        "tidak_ikut": tidak_ikut,
        "nama_ikut": ikut,
        "diperbarui_pada": terbaru,
    }, headers={"X-Robots-Tag": "noindex, nofollow",
                "Referrer-Policy": "no-referrer", "Cache-Control": "no-store"})


class RekapSaklarInput(BaseModel):
    aktif: bool = False


@api_router.post("/staff/pendaftaran/{kegiatan_id}/rekap-publik")
async def pendaftaran_rekap_saklar(kegiatan_id: str, body: RekapSaklarInput,
                                   request: Request,
                                   staff: dict = Depends(require_staff)):
    """Nyalakan/matikan tautan rekap publik. Token dibuat saat pertama dinyalakan."""
    k = await db.pendaftaran_kegiatan.find_one({"_id": kegiatan_id})
    if not k:
        raise HTTPException(status_code=404, detail="Kegiatan pendaftaran tidak ditemukan")
    set_fields: dict = {"rekap_publik": bool(body.aktif)}
    token = k.get("rekap_token")
    if body.aktif and not token:
        token = secrets.token_urlsafe(24)
        set_fields["rekap_token"] = token
    await db.pendaftaran_kegiatan.update_one({"_id": kegiatan_id}, {"$set": set_fields})
    await log_activity(
        staff, "pendaftaran_rekap_publik",
        f"{'Menyalakan' if body.aktif else 'Mematikan'} rekap publik "
        f"pendaftaran '{k.get('nama')}'", kegiatan_id)
    return {
        "rekap_publik": bool(body.aktif),
        "rekap_token": token if body.aktif else None,
        "link": (f"{resolve_base_url(request)}/rekap-pendaftaran/{token}"
                 if body.aktif and token else None),
    }


app.include_router(api_router)

_allowed_origins = {FRONTEND_URL, "http://localhost:3000"}
for _extra in (os.environ.get("EXTRA_CORS_ORIGINS") or "").split(","):
    _extra = _extra.strip().rstrip("/")
    # Domain Emergent tidak lagi dipakai.
    if _extra and "emergent" not in _extra.lower():
        _allowed_origins.add(_extra)

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(o for o in _allowed_origins if o),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# FASE 8 — Kompresi respons JSON (daftar peserta/kegiatan bisa besar) supaya
# halaman absensi tetap cepat dibuka di jaringan lambat & serverless (Vercel).
app.add_middleware(GZipMiddleware, minimum_size=1024)

# ---------------------------------------------------------------------------
# Startup: indexes + seed
# ---------------------------------------------------------------------------
async def seed_users():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "name": "Administrator", "email": admin_email, "username": "admin",
            "phone": "081100000001", "dob": "1990-01-01", "address": "Kantor Pusat",
            "password_hash": hash_password(admin_password),
            "roles": ["admin", "pengurus", "peserta"], "status": "active", "source": "seed",
            "avatar_gender": "male", "token_version": 0,
            "created_at": datetime.now(timezone.utc).isoformat()})
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})

    # Akun contoh (Pak Pengurus / Ibu Peserta) TIDAK dibuat ulang saat startup
    # atau deploy. Seed hanya memastikan ada satu Administrator.
    # Backfill gender for admin seed
    await db.users.update_one({"email": admin_email, "gender": {"$exists": False}},
                              {"$set": {"gender": "L"}})
    # Fase 7: akun admin adalah AKUN SISTEM (untuk memperbaiki/mengelola sistem).
    # Ditandai is_system=True agar TIDAK ikut terdaftar/dihitung sebagai peserta
    # (daftar absensi, rekap, laporan, penerima WA). Peran tetap utuh sehingga
    # admin masih bisa membuka area Pengurus & Peserta untuk pengecekan sistem.
    await db.users.update_one({"email": admin_email}, {"$set": {"is_system": True}})
    await db.users.update_many({"is_system": {"$exists": False}}, {"$set": {"is_system": False}})


async def seed_kelompok():
    """Fase 7: kelompok sambung hanya 'Bali' dan 'Luar Bali'.

    Kelompok default lama (Majelis Pusat / Kelompok Timur / Kelompok Barat)
    dihapus; anggotanya dipindah-sambung ke kelompok 'Bali'.
    """
    defaults = ["Bali", "Luar Bali"]
    ids = {}
    for name in defaults:
        existing = await db.kelompoks.find_one({"name": name})
        if existing:
            ids[name] = existing["_id"]
            continue
        new_id = str(uuid.uuid4())
        await db.kelompoks.insert_one({
            "_id": new_id, "name": name,
            "description": ("Sambung di wilayah Bali" if name == "Bali"
                            else "Sambung di luar wilayah Bali"),
            "created_at": datetime.now(timezone.utc).isoformat()})
        ids[name] = new_id

    legacy_names = ["Majelis Pusat", "Kelompok Timur", "Kelompok Barat",
                    "Kelompok Selatan"]
    legacy = await db.kelompoks.find({"name": {"$in": legacy_names}}).to_list(50)
    for old in legacy:
        await db.users.update_many({"kelompok_id": old["_id"]},
                                   {"$set": {"kelompok_id": ids["Bali"]}})
        await db.kelompoks.delete_one({"_id": old["_id"]})

INIT_VERSION = 5


async def _run_init():
    """Buat index + seed data awal. Idempoten."""
    for idx in ["email_1", "username_1"]:
        try:
            await db.users.drop_index(idx)
        except Exception:
            pass
    await db.users.create_index("email", unique=True,
                                partialFilterExpression={"email": {"$type": "string"}})
    await db.users.create_index("username", unique=True,
                                partialFilterExpression={"username": {"$type": "string"}})
    await db.users.create_index("phone")
    await db.users.create_index("name")
    await db.users.create_index("status")
    await db.users.create_index("kelompok_id")
    await db.login_attempts.create_index("identifier")
    await db.login_attempts.create_index("email")
    await db.activity_logs.create_index("at")
    await db.kelompoks.create_index("name")
    await seed_users()
    await seed_kelompok()
    await get_or_create_public_qr()
    await db.kegiatans.create_index("date")
    await db.kegiatans.create_index("status")
    await db.kegiatans.create_index("share_token")
    await db.kegiatans.create_index("absen_token")
    await db.kegiatans.create_index("akses_token")
    await db.absensis.create_index([("kegiatan_id", 1), ("user_id", 1)], unique=True)
    await db.absensis.create_index("kegiatan_id")
    await db.absensis.create_index("user_id")
    # FASE 8
    await db.guest_absens.create_index("kegiatan_id")
    await db.follow_ups.create_index([("kegiatan_id", 1), ("user_id", 1)], unique=True)
    await db.kegiatans.create_index([("date", -1), ("start_time", -1)])
    await db.kegiatans.create_index("access_code")
    await db.kegiatans.create_index([("jadwal_id", 1), ("date", 1)], unique=True,
                                    partialFilterExpression={"jadwal_id": {"$type": "string"}})
    await db.kegiatans.create_index("guru_id")
    await db.program_jadwals.create_index("guru_id")
    await db.musyawarahs.create_index([("category", 1), ("date", -1)])
    await db.pengumumans.create_index("pinned")
    await db.pengumumans.create_index("pin_roles")
    await db.delegations.create_index([("kegiatan_id", 1), ("grantee_id", 1), ("active", 1)])
    await db.delegations.create_index("grantee_id")
    await db.tutorial_video.create_index([("peran", 1), ("urutan", 1)])
    # Pendataan: tautan publik + isian menunggu tinjauan.
    await db.pendataan_tautan.create_index("token", unique=True)
    await db.pendataan_tautan.create_index([("aktif", 1), ("dibuat_pada", -1)])
    await db.pendataan_isian.create_index([("status", 1), ("dikirim_pada", 1)])
    await db.pendataan_isian.create_index([("tautan_id", 1), ("status", 1)])
    # Kartu Nama: catatan alasan & tanggal cetak kartu fisik.
    await db.kartu_cetak.create_index("peserta_id")
    await db.kartu_cetak.create_index("dicetak_pada")
    # Izin lewat HP peserta + tautan kartu tanpa login.
    await db.izin_kegiatan.create_index([("kegiatan_id", 1), ("peserta_id", 1)], unique=True)
    await db.izin_kegiatan.create_index([("kegiatan_id", 1), ("status", 1)])
    await db.izin_laju.create_index("at")
    await db.tautan_kartu.create_index("token", unique=True)
    await db.tautan_kartu.create_index("peserta_id")
    # Pendaftaran kegiatan — konfirmasi peserta lewat tautan publik WhatsApp.
    await db.pendaftaran_kegiatan.create_index("token", unique=True)
    await db.pendaftaran_kegiatan.create_index([("status", 1), ("tanggal", -1)])
    # Token rekap publik (terpisah dari token pendaftaran). Sparse: hanya untuk
    # kegiatan yang saklarnya pernah dinyalakan.
    await db.pendaftaran_kegiatan.create_index(
        "rekap_token", unique=True, sparse=True, name="pendaftaran_rekap_token")
    # Satu nomor satu jawaban. Indeks parsial: hanya berlaku bila nomor HP ada,
    # karena pendaftar tanpa nomor HP boleh lebih dari satu (dicek lewat nama).
    try:
        await db.pendaftaran_konfirmasi.drop_index("kegiatan_id_1_nomor_hp_1")
    except Exception:
        pass
    await db.pendaftaran_konfirmasi.create_index(
        [("kegiatan_id", 1), ("nomor_hp", 1)], unique=True,
        name="pendaftaran_nomor_unik",
        partialFilterExpression={"nomor_hp": {"$type": "string"}})
    await db.pendaftaran_konfirmasi.create_index([("kegiatan_id", 1), ("kehadiran", 1)])
    await db.pendaftaran_laju.create_index("at")
    await db.pendaftaran_cari_laju.create_index("at")
    await db.pendaftaran_rekap_laju.create_index("at")
    # Penanda pengajar pada peserta (idempoten, tidak menimpa nilai yang sudah ada).
    await db.users.update_many({"pengajar": {"$exists": False}},
                               {"$set": {"pengajar": False}})
    await db.users.create_index("pengajar")
    # Saklar "pengajar tidak wajib absen" pada kegiatan (kegiatan lama = false).
    await db.kegiatans.update_many({"pengajar_tidak_wajib": {"$exists": False}},
                                   {"$set": {"pengajar_tidak_wajib": False}})
    # Notifikasi kehadiran peserta (hadir/izin/sakit/alpha).
    await db.notifikasi.create_index([("peserta_id", 1), ("dibuat_pada", -1)])
    await db.notifikasi.create_index([("peserta_id", 1), ("kegiatan_id", 1)], unique=True)
    # Reset kata sandi mandiri: pembatas laju per IP & per akun.
    await db.reset_laju.create_index("at")
    await db.reset_laju.create_index([("akun", 1), ("ok", 1), ("at", -1)])
    await db.login_attempts.create_index("ip")
    # Indeks tambahan untuk pencarian yang sering dipakai (dibungkus try/except
    # agar kegagalan indeks tidak menghentikan aplikasi).
    for _coll, _keys, _opts in [
        ("absensis", [("kegiatan_id", 1), ("user_id", 1)], {}),
        ("absensis", [("updated_at", -1)], {}),
        ("users", [("phone", 1)], {}),
        ("users", [("email", 1)], {}),
        ("users", [("username", 1)], {}),
        ("users", [("name", 1)], {}),
        ("kegiatans", [("date", 1)], {}),
        ("notifikasi", [("peserta_id", 1), ("dibaca", 1)], {}),
        ("activity_logs", [("at", -1)], {}),
    ]:
        try:
            await db[_coll].create_index(_keys, **_opts)
        except Exception as exc:  # pragma: no cover
            logger.warning("Indeks %s %s dilewati: %s", _coll, _keys, exc)
    # Tautan rekap lama tanpa tanggal berlaku: isi 7 hari sejak perubahan ini
    # dijalankan (idempoten, tidak menimpa yang sudah terisi, tidak menghapus).
    _exp = (datetime.now(timezone.utc) + timedelta(days=SHARE_EXPIRE_DAYS)).isoformat()
    await db.kegiatans.update_many(
        {"share_token": {"$ne": None}, "share_expires_at": None},
        {"$set": {"share_expires_at": _exp}})
    await db.kegiatans.update_many(
        {"group_share_token": {"$ne": None}, "group_share_expires_at": None},
        {"$set": {"group_share_expires_at": _exp}})
    await db.harian_links.update_many(
        {"expires_at": None}, {"$set": {"expires_at": _exp}})


_init_done = False
_init_lock = asyncio.Lock()
_demo_init_done = False
_demo_init_lock = asyncio.Lock()

# FASE 19 — Akun demo (database terpisah `<DB_NAME>_demo`).
DEMO_ACCOUNTS = [
    {"name": "Admin Demo", "username": "demo", "email": "demo@ekertalangu.id",
     "phone": "081000000001", "dob": "1990-01-01", "gender": "L",
     "password": "demo1234", "roles": ["admin", "pengurus", "peserta"]},
    {"name": "Pengurus Demo", "username": "demopengurus", "email": "demopengurus@ekertalangu.id",
     "phone": "081000000002", "dob": "1988-02-02", "gender": "L",
     "password": "demo1234", "roles": ["pengurus", "peserta"]},
    {"name": "Peserta Demo", "username": "demopeserta", "email": "demopeserta@ekertalangu.id",
     "phone": "081000000003", "dob": "1995-03-03", "gender": "P",
     "password": "demo1234", "roles": ["peserta"]},
]


async def ensure_demo_init():
    """Siapkan database demo: index, kelompok, QR publik, dan akun demo."""
    global _demo_init_done
    if _demo_init_done:
        return
    async with _demo_init_lock:
        if _demo_init_done:
            return
        token = _current_db.set(_db_demo)
        try:
            await db.users.create_index("email", unique=True,
                                        partialFilterExpression={"email": {"$type": "string"}})
            await db.users.create_index("username", unique=True,
                                        partialFilterExpression={"username": {"$type": "string"}})
            await db.users.create_index("phone")
            await db.users.create_index("name")
            await db.kegiatans.create_index("date")
            await db.kegiatans.create_index("share_token")
            await db.kegiatans.create_index("absen_token")
            await db.kegiatans.create_index("akses_token")
            await db.absensis.create_index([("kegiatan_id", 1), ("user_id", 1)], unique=True)
            await seed_kelompok()
            await get_or_create_public_qr()
            for acc in DEMO_ACCOUNTS:
                existing = await db.users.find_one({"username": acc["username"]})
                if existing:
                    if not verify_password(acc["password"], existing.get("password_hash") or ""):
                        await db.users.update_one(
                            {"_id": existing["_id"]},
                            {"$set": {"password_hash": hash_password(acc["password"])}})
                    continue
                await db.users.insert_one({
                    "name": acc["name"], "email": acc["email"], "username": acc["username"],
                    "phone": acc["phone"], "dob": acc["dob"], "gender": acc["gender"],
                    "address": "Kertalangu, Denpasar (data demo)",
                    "password_hash": hash_password(acc["password"]), "roles": acc["roles"],
                    "status": "active", "source": "demo", "token_version": 0,
                    "avatar_gender": "male" if acc["gender"] == "L" else "female",
                    "created_at": datetime.now(timezone.utc).isoformat()})
            _demo_init_done = True
            logger.info("Inisialisasi database DEMO selesai (db=%s)", _db_demo.name)
        except Exception as exc:  # pragma: no cover
            logger.error("ensure_demo_init gagal: %s", exc)
        finally:
            _current_db.reset(token)


async def ensure_init():
    """Jalankan inisialisasi satu kali per proses.

    Di serverless setiap cold start proses baru, jadi hasilnya ditandai di MongoDB
    (`app_settings.__init__`) supaya index/seed berat hanya dijalankan sekali saja.
    """
    global _init_done
    if _init_done:
        return
    async with _init_lock:
        if _init_done:
            return
        try:
            marker = await db.app_settings.find_one({"_id": "__init__"})
            if marker and marker.get("version") == INIT_VERSION:
                _init_done = True
                return
            await _run_init()
            await db.app_settings.update_one(
                {"_id": "__init__"},
                {"$set": {"version": INIT_VERSION,
                          "at": datetime.now(timezone.utc).isoformat()}},
                upsert=True)
            _init_done = True
            logger.info("Inisialisasi database selesai (v%s, db=%s)", INIT_VERSION, db.name)
        except Exception as exc:  # pragma: no cover
            logger.error("ensure_init gagal: %s", exc)


@app.middleware("http")
async def bootstrap_middleware(request: Request, call_next):
    """Gantikan background worker: init lazy + auto-close ter-throttle tiap request."""
    use_demo_db(False)
    await ensure_init()
    await ensure_demo_init()
    path = request.url.path
    if path.startswith("/api") and not path.startswith("/api/cron"):
        await maybe_auto_close()
    return await call_next(request)


# ---------------------------------------------------------------------------
# Gerbang pemeliharaan (Layar 32)
# Saat pemeliharaan BERLANGSUNG, operasi tulis (POST/PUT/PATCH/DELETE) ditolak
# untuk peserta dengan 503. Admin & Pengurus tetap boleh menulis. Operasi baca
# selalu boleh. Ini pengaman sisi server, bukan pengganti tombol nonaktif.
# ---------------------------------------------------------------------------
MAINTENANCE_WRITE_EXEMPT = (
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/register",
    "/api/auth/refresh",
    "/api/admin/maintenance",
    "/api/cron",
)


async def _roles_from_request(request: Request) -> list:
    """Baca peran pengguna dari token + database (tanpa melempar error)."""
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        return []
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return []
        use_demo_db(bool(payload.get("demo")))
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        return list((user or {}).get("roles") or [])
    except Exception:
        return []


@app.middleware("http")
async def maintenance_gate(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        path = request.url.path
        if path.startswith("/api") and not any(path.startswith(p) for p in MAINTENANCE_WRITE_EXEMPT):
            try:
                ongoing = await is_maintenance_ongoing()
            except Exception:
                ongoing = False
            if ongoing:
                roles = await _roles_from_request(request)
                if not ({"admin", "pengurus"} & set(roles)):
                    return JSONResponse(
                        status_code=503,
                        content={
                            "detail": "Aplikasi sedang dalam perawatan. "
                                      "Silakan coba lagi setelah perawatan selesai.",
                            "maintenance": True,
                        },
                    )
    return await call_next(request)


@app.on_event("startup")
async def startup():
    await ensure_init()
    await ensure_demo_init()
    # Scheduler loop hanya untuk server persisten (sandbox / VPS / Docker).
    if not IS_SERVERLESS and os.environ.get("RUN_SCHEDULER", "1") != "0":
        asyncio.create_task(auto_close_loop())

@app.on_event("shutdown")
async def shutdown():
    client.close()
