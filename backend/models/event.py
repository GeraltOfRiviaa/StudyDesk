from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from models.common import PyObjectId, RepetitionTypesEnum


class EventRepetition(BaseModel):
    repetition_type: RepetitionTypesEnum
    
class EventBase(BaseModel):
    pass
class EventCreate(EventBase):
    model_config = ConfigDict(extra="forbid")
    
class EventUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
class EventDB(EventBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    
    created_at: datetime
    updated_at: datetime