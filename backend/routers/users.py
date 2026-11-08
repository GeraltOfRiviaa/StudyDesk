from datetime import datetime, timezone
from fastapi import HTTPException, Depends, APIRouter
from pymongo.errors import DuplicateKeyError
from database import db
from core.security import hash_password, generate_token, auth_user, get_current_user
from models.users import UserCreate, UserPublic
from models.types import Token
from fastapi.security import oauth2, OAuth2PasswordRequestForm, OAuth2PasswordBearer

router = APIRouter()
users = db["users"]


@router.post("/register", response_model=UserPublic, status_code=201)
async def register(data: UserCreate):
    '''Register the user with email, nickname and password'''
    if await users.find_one({"$or": [{"email": data.email}, {"nickname": data.nickname}]}):
        raise HTTPException(status_code=409, detail="User already exists")

    now = datetime.now(timezone.utc)
    doc = {
        "nickname": data.nickname,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await users.insert_one(doc)
    except DuplicateKeyError:  # race condition safety net
        raise HTTPException(status_code=409, detail="User already exists")
    response = UserPublic(
        id=str(result.inserted_id),
        nickname=data.nickname, 
        email=data.email,
        created_at=now
    )

    return response

@router.post("/login", response_model=Token)
async def login_user(form: OAuth2PasswordRequestForm = Depends()):
    '''Login the user with username and password and generate a token'''
    user = await auth_user(form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Could not log in the user")
    return Token(access_token=generate_token(user))