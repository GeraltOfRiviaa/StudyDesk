from asyncio import Lock
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from weakref import WeakValueDictionary

import bcrypt
import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Cookie, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from database import db
from core.indexes import SIMPLE_COLLATION
from models.types import password_fits_bcrypt
from models.users import UserPublic



CREDENTIALS_ERROR = HTTPException(
        status_code=401,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
        )
users_collection = db["users"]

JWT_ALGORITHM = "HS256"
SESSION_DURATION = timedelta(days=7)
_account_write_locks: WeakValueDictionary[str, Lock] = WeakValueDictionary()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


async def hash_password(password: str) -> str:
    return await run_in_threadpool(_hash_password, password)


async def verify_password(password: str, hashed: str | None) -> bool:
    if not isinstance(hashed, str) or not hashed or not password_fits_bcrypt(password):
        return False
    try:
        # Bcrypt work runs off the request event loop. A malformed stored hash cannot authenticate.
        return await run_in_threadpool(bcrypt.checkpw, password.encode("utf-8"), hashed.encode())
    except ValueError:
        return False


async def auth_user(username: str, password: str) -> dict | None:
    user = await users_collection.find_one({"username": username}, collation=SIMPLE_COLLATION)
    if user and await verify_password(password, user.get("password_hash")):
        return user
    return None


def generate_token(user: dict, secret: str) -> str:
    payload = {
        "sub": str(user["_id"]),
        "username": user["username"],
        "exp": datetime.now(timezone.utc) + SESSION_DURATION,
    }
    return jwt.encode(payload, secret, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request, access_token: str | None = Cookie(default=None)) -> UserPublic:
    if not access_token:
        raise CREDENTIALS_ERROR
    try:
        payload = jwt.decode(
            access_token,
            request.app.state.jwt_secret,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        if type(payload["exp"]) is not int or not isinstance(payload["sub"], str):
            raise CREDENTIALS_ERROR
        user_id = ObjectId(payload["sub"])
    except (jwt.InvalidTokenError, InvalidId, TypeError, ValueError, OverflowError):
        raise CREDENTIALS_ERROR from None

    # Account deletion invalidates a token even when its signature and expiration are still valid.
    user = await users_collection.find_one({"_id": user_id})
    if not user:
        raise CREDENTIALS_ERROR

    return UserPublic(
        id=user["_id"],
        email=user["email"],
        username=user["username"],
        created_at=user["created_at"],
    )


async def get_account_writer(user: UserPublic = Depends(get_current_user)):
    """Acquire once at the router boundary. Core helpers must not reacquire this lock."""
    async with account_writer(user):
        yield user


@asynccontextmanager
async def account_writer(user: UserPublic):
    # Waiters and holders keep a strong local reference. The weak entry expires once they all exit.
    lock = _account_write_locks.setdefault(user.id, Lock())
    async with lock:
        # Deletion may have finished while this request waited for the lock.
        if not await users_collection.find_one({"_id": ObjectId(user.id)}, {"_id": 1}):
            raise CREDENTIALS_ERROR
        yield
