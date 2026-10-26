from pydantic import  Field, BeforeValidator,  StringConstraints, AwareDatetime
from bson import ObjectId
from typing import Annotated
from enum import Enum

MAX_FILE_SIZE = 10 * 1024 * 1024
#Pydantic doesn't know how to validate Mongos ObjectId 
#so we have to validate it ourselves
def _validate_object_id(v):
    if not ObjectId.is_valid(v):
        raise ValueError("Invalid ObjectId")
    return str(v)

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
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    yearly = "yearly"
    
class WeekdayEnum(str, Enum):
    monday = "monday" 
    tuesday = "tuesday"
    wednesday = "wednesday"
    thursday = "thursday"
    friday = "friday"
    saturday = "saturday"
    sunday = "sunday"

class QuestionInputTypeEnum(str, Enum):
    single = "single"
    multiple = "multiple"
    true_false = "true_false"

PyObjectId = Annotated[str, BeforeValidator(_validate_object_id)]
Nickname = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_.-]{3,50}$")]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]
HexColor = Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]
Title = Annotated[str, StringConstraints(min_length=1, max_length=150)]
StoragePath = Annotated[str, StringConstraints(min_length=1, max_length=255)]
FileName = Annotated[str, StringConstraints(
    pattern=r"(?i)^[\w\- ]{1,100}\.(jpe?g|png|pdf)$",
    strip_whitespace=True,
)]

FileSizeLimit = Annotated[int, Field(ge=1, le=MAX_FILE_SIZE)]
Interval = Annotated[int, Field(ge=1)]
Description = Annotated[str, StringConstraints(min_length=1, max_length=600)]
Exceptions = Annotated[list[AwareDatetime], Field(default_factory=list, max_length=300)]
Reminders = Annotated[list[int], Field(default_factory=list, min_length=0, max_length=5)]
TargetDays = Annotated[list[WeekdayEnum], Field(default_factory=list, min_length=0, max_length=7)]
Tags = Annotated[list[PyObjectId], Field(default_factory=list, min_length=0, max_length=100)]
QuestionTitle = Annotated[str, StringConstraints(min_length=1,max_length=300)]
GenericId = Annotated[str, StringConstraints(min_length=1, max_length=50)]
TimeToFinish = Annotated[int, Field(ge=1, le=36000)]
Score = Annotated[float, Field(ge=0, le=100)]
