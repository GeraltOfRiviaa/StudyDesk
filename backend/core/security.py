from datetime import datetime, timedelta, timezone

import bcrypt
from models.types import Password
from database import db
from models.users import UserDB, UserCreate, UserLogin, UserUpdate
from bson import ObjectId
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import jwt
from dotenv import load_dotenv
from os import getenv
from database import db
import bcrypt
from models.types import Password, Nickname
from bson.errors import InvalidId

CREDENTIALS_ERROR = HTTPException(
        status_code=401,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
        )

users_collection = db["users"]
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='login')


load_dotenv()
JWT_SECRET = getenv('JWT_SECRET')
EXPIRE_DAYS = 7


def hash_password(password: Password) -> str:
    '''Hash the password with bcrypt'''
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: Password, hashed: str) -> bool:
    '''Verify if the str password provided matches with the hashed password'''
    return bcrypt.checkpw(password.encode(), hashed.encode())

async def auth_user(nickname: Nickname, password: Password):
    '''Authenticate users based on email and password'''
    user = await users_collection.find_one({"nickname" : nickname})
    
    if not user:
        return False
    if not verify_password(password=password, hashed=user["password_hash"]):
        return False
    
    return user


def generate_token(user: dict) -> str:
    '''Generate OAuth2 token with username and password'''

    payload = {
        "sub": str(user["_id"]),
        "nickname": user["nickname"],
        "exp": datetime.now(timezone.utc)+ timedelta(minutes=EXPIRE_DAYS * 1440),
    }
    
    token = jwt.encode(payload, JWT_SECRET,algorithm="HS256")
    
    return token
        
        
async def get_current_user(token: str = Depends(oauth2_scheme)):
    '''Get current user from the token'''
    
    try:
        
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        sub = payload.get("sub")
        
        if not sub:
            raise CREDENTIALS_ERROR
        
        user = await users_collection.find_one({"_id": ObjectId(sub)})
        
    except (jwt.InvalidTokenError, InvalidId):
        raise CREDENTIALS_ERROR
    
    if not user:
        raise CREDENTIALS_ERROR
            
    user.pop("password_hash", None)
    return user