from datetime import datetime, timedelta, timezone
import bcrypt
from bson import ObjectId
from fastapi import Cookie, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from jose import JWTError
import jwt
import os

from database import db
from models.users import UserDB, UserCreate

SECRET_KEY = os.environ["JWT_SECRET"]
ALGORITHM = "HS256"
EXPIRE_DAYS = 7

def create_access_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(access_token: str | None = Cookie(default=None)) -> UserDB:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    if not access_token:
        raise unauthorized
    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except JWTError:
        raise unauthorized
    if not user_id or not ObjectId.is_valid(user_id):
        raise unauthorized

    doc = await db.users.find_one({"_id": ObjectId(user_id)})
    if doc is None:
        raise unauthorized
    return UserDB.model_validate(doc)

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

DUMMY_HASH = hash_password("dummy-password")

