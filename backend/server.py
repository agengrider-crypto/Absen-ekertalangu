from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import logging
import base64
import io
import re
import secrets
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import bcrypt
import jwt
import qrcode
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
# Session lifetime (masa percobaan): sesi bertahan 365 hari agar tetap login saat refresh web
SESSION_DAYS = 365
SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60  # detik
VALID_ROLES = ["admin", "pengurus", "peserta"]
EDUCATION_OPTIONS = ["TK", "SD", "SMP", "SMA", "D1", "D2", "D3", "D4", "S1", "S2", "S3"]
MUBALIGH_OPTIONS = ["belum", "sudah"]
GENDER_OPTIONS = ["L", "P"]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Helpers: password + jwt
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, ver: int = 0) -> str:
    payload = {"sub": user_id, "ver": ver, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str, ver: int = 0) -> str:
    payload = {"sub": user_id, "ver": ver, "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, user_id: str, ver: int):
    response.set_cookie("access_token", create_access_token(user_id, ver), httponly=True,
                        secure=True, samesite="none", max_age=SESSION_MAX_AGE, path="/")
    response.set_cookie("refresh_token", create_refresh_token(user_id, ver), httponly=True,
                        secure=True, samesite="none", max_age=SESSION_MAX_AGE, path="/")

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

def public_user(user: dict, include_photo: bool = False) -> dict:
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
        "kelompok_id": user.get("kelompok_id"),
        "roles": user.get("roles", []),
        "status": user.get("status", "active"),
        "source": user.get("source", "admin"),
        "avatar_gender": user.get("avatar_gender", "male"),
        "needs_completion": bool(user.get("needs_completion", False)),
        "has_photo": bool(user.get("photo")),
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
    email: str
    dob: str
    address: str
    password: str
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
    kelompok_id: Optional[str] = None
    roles: List[str] = ["peserta"]
    password: Optional[str] = None

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
    photo: Optional[str] = None
    roles: Optional[List[str]] = None
    status: Optional[str] = None
    kelompok_id: Optional[str] = None
    needs_completion: Optional[bool] = None

class MoveInput(BaseModel):
    kelompok_id: Optional[str] = None

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
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
        if payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Sesi telah berakhir")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token kadaluarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if "admin" not in user.get("roles", []):
        raise HTTPException(status_code=403, detail="Akses khusus admin")
    return user

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
        "status": "pending", "token_version": 0,
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
    img = qr.make_image(fill_color="#0D5C3A", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

async def get_or_create_public_qr() -> dict:
    doc = await db.app_settings.find_one({"_id": "public_qr"})
    if not doc:
        token = secrets.token_urlsafe(12)
        link = f"{FRONTEND_URL}/register?token={token}"
        doc = {"_id": "public_qr", "token": token, "link": link,
               "image": make_qr_data_url(link), "created_at": datetime.now(timezone.utc).isoformat()}
        await db.app_settings.insert_one(doc)
    return doc

# ---------------------------------------------------------------------------
# Brute force helpers
# ---------------------------------------------------------------------------
async def is_locked(identifier: str) -> bool:
    since = datetime.now(timezone.utc) - timedelta(minutes=15)
    count = await db.login_attempts.count_documents(
        {"identifier": identifier, "at": {"$gte": since.isoformat()}})
    return count >= 5

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "E-KERTALANGU API"}

@api_router.post("/auth/login")
async def login(body: LoginInput, request: Request, response: Response):
    ident = body.identifier.strip().lower()
    user = await db.users.find_one({"$or": [
        {"email": ident}, {"username": ident}, {"phone": body.identifier.strip()}]})
    lock_key = str(user["_id"]) if user else ident
    if await is_locked(lock_key):
        raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi dalam 15 menit.")

    ok = user and user.get("password_hash") and verify_password(body.password, user["password_hash"])
    if not ok:
        await db.login_attempts.insert_one({
            "identifier": lock_key, "email": user["email"] if user else ident,
            "at": datetime.now(timezone.utc).isoformat()})
        raise HTTPException(status_code=401, detail="Akun atau kata sandi salah")
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Akun belum aktif. Silakan aktivasi terlebih dahulu.")

    await db.login_attempts.delete_many({"identifier": lock_key})
    set_auth_cookies(response, str(user["_id"]), user.get("token_version", 0))
    await log_activity(user, "login", f"Login berhasil sebagai {', '.join(user.get('roles', []))}")
    return public_user(user)

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

@api_router.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Tidak ada sesi")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token tidak valid")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user or payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Sesi telah berakhir")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    response.set_cookie("access_token", create_access_token(str(user["_id"]), user.get("token_version", 0)),
                        httponly=True, secure=True, samesite="none", max_age=SESSION_MAX_AGE, path="/")
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

    email = body.email.strip().lower()
    phone = body.phone.strip()
    dup_email = await db.users.find_one({"email": email, "_id": {"$ne": user["_id"]}})
    if dup_email:
        raise HTTPException(status_code=409, detail="Email sudah terdaftar")
    dup_phone = await db.users.find_one({"phone": phone, "_id": {"$ne": user["_id"]}})
    if dup_phone:
        raise HTTPException(status_code=409, detail="Nomor HP sudah terdaftar")

    await db.users.update_one({"_id": user["_id"]}, {"$set": {
        "phone": phone, "email": email, "dob": submitted_dob or body.dob.strip(),
        "address": body.address.strip(), "password_hash": hash_password(body.password),
        "status": "active", "avatar_gender": body.avatar_gender or "male"}})
    user = await db.users.find_one({"_id": user["_id"]})
    set_auth_cookies(response, str(user["_id"]), user.get("token_version", 0))
    await log_activity(user, "aktivasi_akun", "Akun diaktivasi & data dilengkapi")
    return public_user(user)

@api_router.post("/auth/self-reset")
async def self_reset(body: SelfResetInput):
    phone = body.phone.strip()
    dob = normalize_dob(body.dob) or body.dob.strip()
    user = await db.users.find_one({"phone": phone, "dob": dob})
    if not user:
        raise HTTPException(status_code=404, detail="Data tidak cocok. Periksa Nomor HP & tanggal lahir Anda.")
    if set(user.get("roles", [])) != {"peserta"}:
        raise HTTPException(status_code=403, detail="Reset mandiri hanya untuk akun Peserta. Akun dengan peran lain hubungi administrator.")
    await db.users.update_one({"_id": user["_id"]}, {
        "$set": {"password_hash": hash_password(body.new_password), "status": "active"},
        "$inc": {"token_version": 1}})
    await db.login_attempts.delete_many({"email": user["email"]})
    return {"message": "Kata sandi berhasil diperbarui. Silakan login."}

# ---- QR ----
@api_router.get("/qr/public")
async def public_qr():
    doc = await get_or_create_public_qr()
    return {"link": doc["link"], "image": doc["image"], "token": doc["token"]}

# ---- Admin ----
@api_router.get("/admin/users")
async def admin_users(admin: dict = Depends(require_admin)):
    users = await db.users.find().sort("created_at", -1).to_list(1000)
    return [public_user(u) for u in users]

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == str(admin["_id"]):
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    target = await db.users.find_one({"_id": parse_object_id(user_id)})
    res = await db.users.delete_one({"_id": parse_object_id(user_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    await log_activity(admin, "hapus_akun", f"Menghapus akun '{target.get('name') if target else user_id}'", user_id)
    return {"message": "Pengguna dihapus"}

class RoleUpdate(BaseModel):
    roles: List[str]

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
async def admin_create_user(body: AdminCreateUser, admin: dict = Depends(require_admin)):
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

    doc = {
        "name": name, "email": email, "username": None, "phone": phone,
        "whatsapp": body.whatsapp.strip() if body.whatsapp else None,
        "dob": normalize_dob(body.dob),
        "birthplace": body.birthplace.strip() if body.birthplace else None,
        "address": body.address.strip() if body.address else None,
        "gender": normalize_gender(body.gender),
        "education": body.education if body.education in EDUCATION_OPTIONS else None,
        "mubaligh": body.mubaligh if body.mubaligh in MUBALIGH_OPTIONS else None,
        "kelompok_id": body.kelompok_id or None,
        "roles": roles, "source": "admin",
        "avatar_gender": "female" if normalize_gender(body.gender) == "P" else "male",
        "token_version": 0, "created_at": datetime.now(timezone.utc).isoformat(),
    }
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
async def admin_create_pending(body: AdminPendingNames, admin: dict = Depends(require_admin)):
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
        res = await db.users.insert_one(doc)
        doc["_id"] = res.inserted_id
        created.append(public_user(doc))
    return {"created": created, "count": len(created), "skipped": skipped, "invalid_dates": invalid_dates}

@api_router.get("/admin/import-template")
async def import_template(admin: dict = Depends(require_admin)):
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Peserta"
    ws.append(["Nama", "Tanggal Lahir"])
    ws.append(["Budi Santoso", "17-08-1970"])
    ws.append(["Siti Aminah", "02-05-1965"])
    ws.append(["Ahmad Fauzi", ""])
    ws.column_dimensions["A"].width = 32
    ws.column_dimensions["B"].width = 18
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=template_peserta_ekertalangu.xlsx"},
    )

@api_router.post("/admin/users/import")
async def admin_import_users(file: UploadFile = File(...), admin: dict = Depends(require_admin)):
    fname = (file.filename or "").lower()
    data = await file.read()
    rows = []  # list of (name, dob)
    try:
        if fname.endswith(".csv") or fname.endswith(".txt"):
            import csv
            text = data.decode("utf-8-sig", errors="ignore")
            for cols in csv.reader(io.StringIO(text)):
                if cols:
                    rows.append((cols[0], cols[1] if len(cols) > 1 else None))
        elif fname.endswith(".xlsx") or fname.endswith(".xlsm"):
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
            ws = wb.active
            for r in ws.iter_rows(values_only=True):
                if r and r[0] is not None:
                    rows.append((r[0], r[1] if len(r) > 1 else None))
            wb.close()
        else:
            raise HTTPException(status_code=400, detail="Format tidak didukung. Gunakan .xlsx atau .csv")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Gagal membaca file. Pastikan format .xlsx atau .csv benar.")

    created, skipped, invalid_dates, flagged = [], [], [], []
    for name_val, dob_val in rows:
        name = str(name_val).strip()
        if not name or name.lower() in ("nama", "name", "nama lengkap", "nama peserta"):
            continue
        # Nama kembar: tetap dibuat, tandai perlu dilengkapi (jangan dilewati)
        duplicate = await db.users.find_one({"name": name})
        if dob_val is not None and str(dob_val).strip() and normalize_dob(dob_val) is None:
            invalid_dates.append({"name": name, "value": str(dob_val).strip()})
        doc = build_pending_doc(name, dob_val)
        if duplicate:
            doc["needs_completion"] = True
            flagged.append(name)
        res = await db.users.insert_one(doc)
        created.append(name)
    await log_activity(admin, "impor_peserta",
                       f"Impor {len(created)} peserta dari file ({len(flagged)} nama kembar ditandai)")
    return {"count": len(created), "skipped": skipped, "created_names": created,
            "invalid_dates": invalid_dates, "flagged": flagged}

# ---------------------------------------------------------------------------
# Fase 2: Kelompok / Majelis
# ---------------------------------------------------------------------------
@api_router.get("/admin/kelompok")
async def list_kelompok(admin: dict = Depends(require_admin)):
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
async def delete_kelompok(kelompok_id: str, admin: dict = Depends(require_admin)):
    res = await db.kelompoks.delete_one({"_id": kelompok_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kelompok tidak ditemukan")
    await db.users.update_many({"kelompok_id": kelompok_id}, {"$set": {"kelompok_id": None}})
    await log_activity(admin, "hapus_kelompok", f"Menghapus kelompok {kelompok_id}", kelompok_id)
    return {"message": "Kelompok dihapus"}

# ---------------------------------------------------------------------------
# Fase 2: Peserta detail + update + bulk + reset + move
# ---------------------------------------------------------------------------
@api_router.get("/admin/users/{user_id}")
async def admin_user_detail(user_id: str, admin: dict = Depends(require_admin)):
    user = await db.users.find_one({"_id": parse_object_id(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    data = public_user(user, include_photo=True)
    if user.get("kelompok_id"):
        k = await db.kelompoks.find_one({"_id": user["kelompok_id"]})
        data["kelompok_name"] = k.get("name") if k else None
    return data

@api_router.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: PesertaUpdate, admin: dict = Depends(require_admin)):
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
    if body.photo is not None:
        updates["photo"] = body.photo or None
    if body.kelompok_id is not None:
        updates["kelompok_id"] = body.kelompok_id or None
    if body.needs_completion is not None:
        updates["needs_completion"] = bool(body.needs_completion)
    if body.roles is not None:
        roles = [r for r in body.roles if r in VALID_ROLES]
        if not roles:
            raise HTTPException(status_code=400, detail="Minimal satu peran valid")
        updates["roles"] = roles
    if body.status is not None:
        if body.status not in ("active", "nonaktif", "pending"):
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
async def admin_bulk_create(body: BulkCreateInput, admin: dict = Depends(require_admin)):
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
            "name": name, "email": None, "username": None,
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

@api_router.post("/admin/users/bulk-delete")
async def admin_bulk_delete(body: BulkDeleteInput, admin: dict = Depends(require_admin)):
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

@api_router.post("/admin/users/{user_id}/reset-password")
async def admin_reset_password(user_id: str, admin: dict = Depends(require_admin)):
    oid = parse_object_id(user_id)
    user = await db.users.find_one({"_id": oid})
    if not user:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    dob = normalize_dob(user.get("dob"))
    if not dob:
        raise HTTPException(status_code=400, detail="Tanggal lahir belum diisi. Lengkapi dulu untuk membuat sandi ddmmyyyy.")
    y, m, d = dob.split("-")
    new_pw = f"{d}{m}{y}"  # ddmmyyyy
    set_fields = {"password_hash": hash_password(new_pw)}
    if user.get("status") == "pending":
        set_fields["status"] = "active"
    await db.users.update_one({"_id": oid}, {"$set": set_fields, "$inc": {"token_version": 1}})
    await log_activity(admin, "reset_sandi", f"Reset sandi '{user.get('name')}' (format ddmmyyyy)", user_id)
    return {"password": new_pw, "message": "Kata sandi direset ke format tanggal lahir (ddmmyyyy)."}

@api_router.post("/admin/users/{user_id}/move")
async def admin_move_kelompok(user_id: str, body: MoveInput, admin: dict = Depends(require_admin)):
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
    await log_activity(admin, "pindah_sambung", f"Pindah '{user.get('name')}' ke kelompok {kname or '-'}", user_id)
    return {"message": "Pindah sambung berhasil", "kelompok_id": body.kelompok_id or None, "kelompok_name": kname}

# ---------------------------------------------------------------------------
# Fase 2: Log Aktivitas
# ---------------------------------------------------------------------------
@api_router.get("/admin/logs")
async def admin_logs(admin: dict = Depends(require_admin), limit: int = 100, action: str = ""):
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

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

    demos = [
        {"name": "Pak Pengurus", "email": "pengurus@ekertalangu.id", "username": "pengurus",
         "phone": "081200000002", "dob": "1985-05-10", "address": "Jl. Melati No. 2",
         "password": "Pengurus#2026", "roles": ["pengurus", "peserta"]},
        {"name": "Ibu Jamaah", "email": "peserta@ekertalangu.id", "username": "peserta",
         "phone": "081300000003", "dob": "1970-08-17", "address": "Jl. Mawar No. 3",
         "password": "Peserta#2026", "roles": ["peserta"]},
    ]
    for d in demos:
        if not await db.users.find_one({"email": d["email"]}):
            await db.users.insert_one({
                "name": d["name"], "email": d["email"], "username": d["username"],
                "phone": d["phone"], "dob": d["dob"], "address": d["address"],
                "password_hash": hash_password(d["password"]), "roles": d["roles"],
                "status": "active", "source": "seed", "avatar_gender": "female",
                "gender": "P",
                "token_version": 0, "created_at": datetime.now(timezone.utc).isoformat()})
    # Backfill gender for admin seed
    await db.users.update_one({"email": admin_email, "gender": {"$exists": False}},
                              {"$set": {"gender": "L"}})

async def seed_kelompok():
    defaults = ["Majelis Pusat", "Kelompok Timur", "Kelompok Barat"]
    for name in defaults:
        if not await db.kelompoks.find_one({"name": name}):
            await db.kelompoks.insert_one({
                "_id": str(uuid.uuid4()), "name": name, "description": None,
                "created_at": datetime.now(timezone.utc).isoformat()})

@app.on_event("startup")
async def startup():
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

@app.on_event("shutdown")
async def shutdown():
    client.close()
