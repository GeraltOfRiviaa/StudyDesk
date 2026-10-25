
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from backend.models.types import PyObjectId, Tags, Title

class NoteBase(BaseModel):
    title: Title
    content: str = Field(max_length=10000)
    tags: Tags  = Field(default_factory=list)
    
class NoteCreate(NoteBase):
    model_config = ConfigDict(extra="forbid")
    
class NoteUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Title | None = None
    content: str | None = None
    tags: Tags | None = None

class NoteDB(NoteBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    created_at: datetime
    updated_at: datetime
    