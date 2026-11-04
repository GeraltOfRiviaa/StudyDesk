from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Depends
from pymongo.errors import DuplicateKeyError
from database import db
from core.security import hash_password, verify_password, generate_token
from models.users import UserCreate, UserPublic,UserLogin
from models.types import Token
from fastapi.security import oauth2, OAuth2PasswordRequestForm

app = FastAPI()
users = db["users"]

@app.post("/register", response_model=UserPublic, status_code=201)
async def register(data: UserCreate):
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

    return {"id": str(result.inserted_id), "nickname": data.nickname, "email": data.email}

@app.post("/login", response_model=Token)
async def login_user(form: OAuth2PasswordRequestForm = Depends()):
    '''Login the user with nickname and password'''
    user = await users.find_one({"nickname": form.username})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not verify_password(form.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Could not log in the user")
    
    return await generate_token(form)