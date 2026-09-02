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
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Annotated

import bcrypt
import jwt
import qrcode
from bson import ObjectId
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, ConfigDict

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
VALID_ROLES = ["admin", "pengurus", "peserta"]

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
               "exp": datetime.now(timezone.utc) + timedelta(minutes=15)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str, ver: int = 0) -> str:
    payload = {"sub": user_id, "ver": ver, "type": "refresh",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, user_id: str, ver: int):
    response.set_cookie("access_token", create_access_token(user_id, ver), httponly=True,
                        secure=True, samesite="none", max_age=900, path="/")
    response.set_cookie("refresh_token", create_refresh_token(user_id, ver), httponly=True,
                        secure=True, samesite="none", max_age=604800, path="/")

# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
PyObjectId = Annotated[str, BeforeValidator(str)]

def public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "username": user.get("username"),
        "phone": user.get("phone"),
        "dob": user.get("dob"),
        "address": user.get("address"),
        "roles": user.get("roles", []),
        "status": user.get("status", "active"),
        "source": user.get("source", "admin"),
        "avatar_gender": user.get("avatar_gender", "male"),
        "created_at": user.get("created_at"),
    }

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
    email: Optional[str] = None
    dob: Optional[str] = None
    address: Optional[str] = None
    roles: List[str] = ["peserta"]
    password: Optional[str] = None

class AdminPendingNames(BaseModel):
    names: List[str]

class SelfResetInput(BaseModel):
    phone: str
    dob: str
    new_password: str

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
                        httponly=True, secure=True, samesite="none", max_age=900, path="/")
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
        "dob": body.dob.strip(),
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
    return [{"id": str(u["_id"]), "name": u["name"]} for u in results]

@api_router.post("/activation/complete")
async def activation_complete(body: ActivationComplete, response: Response):
    user = await db.users.find_one({"_id": parse_object_id(body.user_id)})
    if not user or user.get("status") != "pending":
        raise HTTPException(status_code=404, detail="Data peserta tidak ditemukan atau sudah aktif")

    email = body.email.strip().lower()
    phone = body.phone.strip()
    dup_email = await db.users.find_one({"email": email, "_id": {"$ne": user["_id"]}})
    if dup_email:
        raise HTTPException(status_code=409, detail="Email sudah terdaftar")
    dup_phone = await db.users.find_one({"phone": phone, "_id": {"$ne": user["_id"]}})
    if dup_phone:
        raise HTTPException(status_code=409, detail="Nomor HP sudah terdaftar")

    await db.users.update_one({"_id": user["_id"]}, {"$set": {
        "phone": phone, "email": email, "dob": body.dob.strip(),
        "address": body.address.strip(), "password_hash": hash_password(body.password),
        "status": "active", "avatar_gender": body.avatar_gender or "male"}})
    user = await db.users.find_one({"_id": user["_id"]})
    set_auth_cookies(response, str(user["_id"]), user.get("token_version", 0))
    return public_user(user)

@api_router.post("/auth/self-reset")
async def self_reset(body: SelfResetInput):
    phone = body.phone.strip()
    user = await db.users.find_one({"phone": phone, "dob": body.dob.strip()})
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
    res = await db.users.delete_one({"_id": parse_object_id(user_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
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
        "dob": body.dob.strip() if body.dob else None,
        "address": body.address.strip() if body.address else None,
        "roles": roles, "source": "admin", "avatar_gender": "male",
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
    return public_user(doc)

@api_router.post("/admin/users/pending")
async def admin_create_pending(body: AdminPendingNames, admin: dict = Depends(require_admin)):
    created, skipped = [], []
    for raw in body.names:
        name = raw.strip()
        if not name:
            continue
        existing = await db.users.find_one({"name": name, "status": "pending"})
        if existing:
            skipped.append(name)
            continue
        doc = {
            "name": name, "email": None, "username": None, "phone": None,
            "dob": None, "address": None, "roles": ["peserta"], "source": "admin_import",
            "avatar_gender": "male", "password_hash": None, "status": "pending",
            "token_version": 0, "created_at": datetime.now(timezone.utc).isoformat(),
        }
        res = await db.users.insert_one(doc)
        doc["_id"] = res.inserted_id
        created.append(public_user(doc))
    return {"created": created, "count": len(created), "skipped": skipped}

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
                "token_version": 0, "created_at": datetime.now(timezone.utc).isoformat()})

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
    await db.login_attempts.create_index("identifier")
    await db.login_attempts.create_index("email")
    await seed_users()
    await get_or_create_public_qr()

@app.on_event("shutdown")
async def shutdown():
    client.close()
