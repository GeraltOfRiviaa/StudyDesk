from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from backend.models.types import PyObjectId, RepetitionTypesEnum, Interval, TargetDaysEnum, Title, Tags, Description, Exceptions, Reminders
from pydantic_extra_types.timezone_name import TimeZoneName


class EventRepetition(BaseModel):
    repetition_type: RepetitionTypesEnum
    interval: Interval
    target_day: TargetDaysEnum
    until: datetime | None
    
class EventBase(BaseModel):
    title: Title
    description: Description | None
    start_time: datetime
    end_time: datetime | None
    timezone: TimeZoneName
    repetition: EventRepetition | None
    exceptions: Exceptions
    reminders: Reminders 
    tags: Tags

class EventCreate(EventBase):
    model_config = ConfigDict(extra="forbid")
    
class EventUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Title | None = None
    description: Description | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    timezone: TimeZoneName | None = None
    repetition: EventRepetition | None = None
    exceptions: Exceptions | None = None
    reminders: Reminders | None = None
    tags: Tags | None = None
    
class EventDB(EventBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    created_at: datetime
    updated_at: datetime