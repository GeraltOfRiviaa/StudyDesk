from pydantic import  Field, BeforeValidator,  StringConstraints, AwareDatetime, AfterValidator, BaseModel, ConfigDict, model_validator
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

def _no_duplicates(v: list) -> list:
    if len(set(v)) != len(v):
        raise ValueError("duplicate items are not allowed")
    return v

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
FileName = Annotated[str, StringConstraints(min_length=1, max_length=255)]
FileSizeLimit = Annotated[int, Field(ge=1, le=MAX_FILE_SIZE)]
Interval = Annotated[int, Field(ge=1, le=365)]
Description = Annotated[str, StringConstraints(min_length=1, max_length=600)]
QuestionTitle = Annotated[str, StringConstraints(min_length=1,max_length=300)]
GenericId = Annotated[str, StringConstraints(min_length=1, max_length=50)]
TimeToFinish = Annotated[int, Field(ge=1, le=36000)]
Score = Annotated[float, Field(ge=0, le=100)]


Exceptions = Annotated[
    list[AwareDatetime],
    AfterValidator(_no_duplicates),
    Field(default_factory=list, max_length=300),
]
Reminders = Annotated[
    list[Annotated[int, Field(ge=0, le=40320)]],
    AfterValidator(_no_duplicates),
    Field(default_factory=list, max_length=5),
]
TargetDays = Annotated[
    list[WeekdayEnum],
    AfterValidator(_no_duplicates),
    Field(default_factory=list, max_length=7),
]
Tags = Annotated[
    list[PyObjectId],
    AfterValidator(_no_duplicates),
    Field(default_factory=list, max_length=100),
]


class UpdateModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    @model_validator(mode="after")
    def not_empty(self):
        if not self.model_fields_set:
            raise ValueError("at least one field must be provided")
        return self