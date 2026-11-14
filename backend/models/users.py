from pydantic import BaseModel, ConfigDict, EmailStr, AwareDatetime, Field, model_validator
from models.types import Username, Password, PyObjectId, UpdateModel


class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    model_config = ConfigDict(extra="forbid")
    username: Username
    password: Password

class UserUpdate(UpdateModel):
    email: EmailStr | None = None
    username: Username | None = None

class UserChangePassword(UpdateModel):
    old_password: Password
    new_password: Password
class UserDB(UserBase):
    id: PyObjectId = Field(validation_alias="_id")
    password_hash: str
    created_at: AwareDatetime
    updated_at: AwareDatetime

class UserPublic(UserBase):
    id: PyObjectId
    username: Username
    created_at: AwareDatetime
    
class UserLogin(UserBase):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=1, max_length=128)
