from pydantic import BaseModel, ConfigDict, EmailStr, AwareDatetime, Field
from models.types import Nickname, Password, PyObjectId


class UserBase(BaseModel):
    email: EmailStr
    nickname: Nickname
    

class UserCreate(UserBase):
    model_config = ConfigDict(extra="forbid")
    password: Password

class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
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
