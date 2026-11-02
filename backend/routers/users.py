from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status 
from fastapi.concurrency import run_in_threadpool
from core.limiter import limiter
from core.security import DUMMY_HASH, EXPIRE_DAYS, create_access_token, hash_password, get_current_user, verify_password
from models.users import UserCreate,UserDB, UserPublic, UserLogin
from database import db
from pymongo.errors import DuplicateKeyError

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
async def register_user(user: UserCreate):
    email = user.email.lower()
    now = datetime.now(timezone.utc)
    hashed = await run_in_threadpool(hash_password, user.password)
    try:
        result = await db.users.insert_one({
            "email": email,
            "nickname": user.nickname,
            "password_hash": hashed,
            "created_at": now,
            "updated_at": now,
        })
    except DuplicateKeyError:
        raise HTTPException(status.HTTP_409_CONFLICT, "User already exists")
    return str(result.inserted_id)

@router.get("/{user_id}", response_model=UserPublic)
async def get_user(user_id: str, current_user: UserDB = Depends(get_current_user)):
    if user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    return current_user

@router.post("/login", response_model=UserPublic)
@limiter.limit("5/minute")
async def login_user(request: Request, response: Response, data: UserLogin):
    invalid = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    doc = await db.users.find_one({"email": data.email.lower()})
    hash_to_check = doc["password_hash"] if doc else DUMMY_HASH

    ok = await run_in_threadpool(verify_password, data.password, hash_to_check)
    if not doc or not ok:
        raise invalid

    token = create_access_token(str(doc["_id"]))
    response.set_cookie(
        "access_token", token,
        httponly=True, secure=True, samesite="lax",
        max_age=EXPIRE_DAYS * 24 * 60 * 60,
    )
    return UserPublic.model_validate(doc)
