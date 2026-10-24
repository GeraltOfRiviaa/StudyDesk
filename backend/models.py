from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, Object
from pymongo import ObjectId


class UserBase(BaseModel):
    email: EmailStr
    nickname: str = Field(min_length=3, max_length=50, regex=r"^[A-Za-z0-9_.-]{3,50}$")
    class Config:
        validate_by_alias = True

class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)

class UserUpdate(BaseModel):
    email: EmailStr | None = None
    nickname: str | None = Field(default=None, min_length=3, max_length=50, regex=r"^[A-Za-z0-9_.-]{3,50}$")
    password: str | None = Field(default=None)

    class Config:
        extra = "forbid"

class UserInDB(UserBase):
    id: ObjectId = Field(alias="_id")
    password_hash: str
    created_at: datetime
    updated_at: datetime

class UserPublic(UserBase):
    id: ObjectId = Field(alias="_id")
    created_at: datetime

class ContainersBase(BaseModel):
    pass

class ContainersUpdate(ContainersBase):
    pass

class ContainersCreate(ContainersBase):
    pass

class ContainersInDB(ContainersBase):
    pass

class Layout(BaseModel):
    x : int = Field(min_lenght=0)
    y : int = Field(min_lenght=0)
    h : int = Field(min_lenght=1, max_length=900)
    w : int = Field(min_lenght=1, max_length=900)