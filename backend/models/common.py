
from pydantic import  Field, BeforeValidator,  StringConstraints
from bson import ObjectId
from typing import Annotated
from enum import Enum

MAX_FILE_SIZE = 10458760
#Pydantic doesn't know how to validate Mongos ObjectId 
#so we have to validate it ourselves
def _validate_object_id(v):
    if not ObjectId.is_valid(v):
        raise ValueError("Invalid ObjectId")
    return str(v)

PyObjectId = Annotated[str, BeforeValidator(_validate_object_id)]
Nickname = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_.-]{3,50}$")]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
Title = Annotated[str, StringConstraints(min_length=1, max_length=150)]
Tags = list[PyObjectId]
StoragePath = Annotated[str, StringConstraints(min_length=1, max_length=255)]
FileName = Annotated[str, StringConstraints(
    pattern=r"(?i)^[\w\- ]{1,100}\.(jpe?g|png|pdf)$",
    strip_whitespace=True,
)]
FileSizeLimit = Annotated[int, Field(ge=1, le=MAX_FILE_SIZE)]

class TypesEnum(str, Enum):
    note = "note"
    archive = "archive"
    event = "event"
    form = "form"

class MimeTypesEnum(str, Enum):
    jpeg = "image/jpeg"
    png = "image/png"
    pdf = "application/pdf"
    
class RepetitionTypesEnum(str, Enum):
    daily = "DAILY"
    weekly = "WEEKLY"
    monthly = "MONTHLY"
    yearly = "YEARLY"
    
