from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, AwareDatetime, Field, SecretStr
from models.types import Username, Password, PyObjectId, UpdateModel


# Apply the same validated identity policy to every password-account email write.
NormalizedEmail = Annotated[EmailStr, AfterValidator(str.lower)]


class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    model_config = ConfigDict(extra="forbid")
    email: NormalizedEmail
    username: Username
    password: Password

class UserUpdate(UpdateModel):
    email: NormalizedEmail = Field(default_factory=lambda: None)
    username: Username = Field(default_factory=lambda: None)

class UserChangePassword(UpdateModel):
    old_password: str = Field(min_length=8)
    new_password: Password

class UserDelete(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: SecretStr = Field(min_length=1)

class UserDB(UserBase):
    id: PyObjectId
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
