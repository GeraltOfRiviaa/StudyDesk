from datetime import datetime, timedelta, timezone
from bson import ObjectId
from fastapi import Cookie, Depends, HTTPException, status
from jose import JWTError, jwt
import os

from db import db
from models.user import UserDB

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