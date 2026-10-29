from pydantic import BaseModel, ConfigDict, EmailStr, AwareDatetime, Field, model_validator
from models.types import Nickname, Password, PyObjectId, UpdateModel


class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    model_config = ConfigDict(extra="forbid")
    nickname: Nickname
    password: Password

class UserUpdate(UpdateModel):
    email: EmailStr | None = None
    nickname: Nickname | None = None
    password: Password | None = None
    
    
class UserDB(UserBase):
    id: PyObjectId = Field(validation_alias="_id")
    password_hash: str
    created_at: AwareDatetime
    updated_at: AwareDatetime

class UserPublic(UserBase):
    id: PyObjectId = Field(validation_alias="_id")
    created_at: AwareDatetime
    
class UserLogin(UserModel):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=1, max_length=128)
