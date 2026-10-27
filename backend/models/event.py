from pydantic import BaseModel, ConfigDict, Field, AwareDatetime, model_validator
from models.types import PyObjectId, RepetitionTypesEnum, Interval, TargetDays, Title, Tags, Description, Exceptions, Reminders, UpdateModel
from pydantic_extra_types.timezone_name import TimeZoneName
from datetime import datetime, timezone, timedelta



# check for bugs
class EventRepetition(BaseModel):
    repetition_type: RepetitionTypesEnum
    interval: Interval = 1
    target_days: TargetDays
    until: AwareDatetime| None = None
    
    #check if weekly repetition has a target day
    @model_validator(mode="after")
    def validate_target_days(self):
        if self.repetition_type == RepetitionTypesEnum.weekly:
            if not self.target_days:
                raise ValueError("target_days is required for weekly repetition")
        elif self.target_days:
            raise ValueError("target_days can only be set for weekly repetition")
        return self
class EventBase(BaseModel):
    title: Title
    description: Description| None = None
    start_time: AwareDatetime
    end_time: AwareDatetime| None = None
    event_timezone: TimeZoneName
    repetition: EventRepetition| None = None
    exceptions: Exceptions
    reminders: Reminders 
    tags: Tags
    
    
    #check if start_time is before end_time 
    @model_validator(mode="after")
    def validate_end_time(self):
        if self.end_time and (self.start_time >= self.end_time):
            raise ValueError("end_time must be after start_time")
        return self
    
    #check if the end of repetition date is after start_time
    @model_validator(mode="after")
    def validate_until(self):
        if self.repetition and self.repetition.until and self.repetition.until <= self.start_time:
            raise ValueError("repetition.until must be after start_time")
        return self

class EventCreate(EventBase):
    model_config = ConfigDict(extra="forbid")
    
    #check if start_time is not in the past
    @model_validator(mode="after")
    def validate_start_time(self):
        if self.start_time < datetime.now(timezone.utc) - timedelta(seconds=10) :
            raise ValueError("start_time cannot be in the past")
        return self

class EventUpdate(UpdateModel):
    
    # use model_dump(exclude_unset=True)
    title: Title | None = None
    description: Description | None = None
    start_time: AwareDatetime | None = None
    end_time: AwareDatetime | None = None
    event_timezone: TimeZoneName | None = None
    repetition: EventRepetition | None = None
    exceptions: Exceptions | None = None
    reminders: Reminders | None = None
    tags: Tags | None = None
    
    #check if start_time is before end_time 
    @model_validator(mode="after")
    def validate_end_time(self):
        if self.end_time and self.start_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self
    
    #check if the end of repetition date is after start_time
    @model_validator(mode="after")
    def validate_until(self):
        if self.repetition and self.repetition.until and self.start_time:
            if self.repetition.until <= self.start_time:
                raise ValueError("repetition.until must be after start_time")
        return self
class EventDB(EventBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    created_at: AwareDatetime
    updated_at: AwareDatetime
    

