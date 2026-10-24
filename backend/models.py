from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, BeforeValidator, ConfigDict, StringConstraints
from enum import Enum
from typing import Annotated
from bson import ObjectId

#Pydantic doesn't know how to validate Mongos ObjectId 
#so we have to validate it ourselves
def _validate_object_id(v):
    if not ObjectId.is_valid(v):
        raise ValueError("Invalid ObjectId")
    return str(v)


PyObjectId = Annotated[str, BeforeValidator(_validate_object_id)]
Nickname = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_.-]{3,50}$")]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]
class ContainersLayout(BaseModel):
    x : int = Field(ge=0)
    y : int = Field(ge=0)
    h : int = Field(ge=1, le=900)
    w : int = Field(ge=1, le=900)
    
class ContainersTypesEnum(str, Enum):
    note = "note"
    archive = "archive"
    event = "event"
    form = "form"
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
class UserInDB(UserBase):
    id: PyObjectId = Field(validation_alias="_id")
    password_hash: str
    created_at: datetime
    updated_at: datetime

class UserPublic(UserBase):
    id: PyObjectId = Field(validation_alias="_id")
    created_at: datetime

class ContainersBase(BaseModel):
    title: str = Field(min_length=1 , max_length=100) 
    filter_tags: list[PyObjectId] = Field(default_factory=list)
    layout: ContainersLayout 

class ContainersUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None ,min_length=1 , max_length=100)
    filter_tags: list[PyObjectId] | None = None
    layout: ContainersLayout | None = None

class ContainersCreate(ContainersBase):
    model_config = ConfigDict(extra="forbid")
    type: ContainersTypesEnum

class ContainersInDB(ContainersBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    type: ContainersTypesEnum
    created_at: datetime
    updated_at: datetime

