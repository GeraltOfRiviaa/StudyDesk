
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime, model_validator
from models.types import PyObjectId, Tags, Title, UpdateModel

class NoteBase(BaseModel):
    title: Title
    tags: Tags  = Field(default_factory=list)
    
class NoteCreate(NoteBase):
    model_config = ConfigDict(extra="forbid")
    content: str = Field(max_length=10000)
    
class NoteUpdate(UpdateModel):
    title: Title | None = None
    content: str | None = None
    tags: Tags | None = None
class NoteDB(NoteBase):
    id: PyObjectId
    user_id: PyObjectId
    content: str = Field(max_length=10000)
    created_at: AwareDatetime
    updated_at: AwareDatetime

class NotePublic(NoteBase):
    id: PyObjectId
    content: str
    created_at: AwareDatetime
    updated_at: AwareDatetime

class NoteListItem(NoteBase):
    id: PyObjectId
    created_at: AwareDatetime
    updated_at: AwareDatetime