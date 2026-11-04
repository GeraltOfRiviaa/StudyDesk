import bcrypt
from backend.models.types import Password
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
from models.types import Token

from models.types import Password, Nickname



users_collection = db["users"]
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='token')


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


async def generate_token(form_data: OAuth2PasswordRequestForm = Depends()):
    '''Generate OAuth2 token with username and password'''
    try:
        user = await auth_user(form_data.username, form_data.password)
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid username or password: ")
        
        payload = {
            "sub": str(user["_id"]),
            "nickname": user["nickname"],
        }
        
        token = jwt.encode(payload, JWT_SECRET)
        
        return Token(access_token=token)
        
    except Exception as e:
        raise HTTPException(status_code=401, detail="Could not generate a token:" + str(e))
    
async def create_user(user: UserCreate):
    """Create a new user."""
    try:
        user_dict = user.model_dump(by_alias=True, exclude_none=True)
        user_dict["passwordHash"] = hash_password(user_dict["passwordHash"])
        result = await users_collection.insert_one(user_dict)
        user_dict["_id"] = str(result.inserted_id)
        return user_dict
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not create user: " + str(e))
    

