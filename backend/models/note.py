
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime, model_validator
from models.types import PyObjectId, Tags, Title, UpdateModel

class NoteBase(BaseModel):
    title: Title
    content: str = Field(max_length=10000)
    tags: Tags  = Field(default_factory=list)
    
class NoteCreate(NoteBase):
    model_config = ConfigDict(extra="forbid")
    
class NoteUpdate(UpdateModel):
    title: Title | None = None
    content: str | None = None
    tags: Tags | None = None
class NoteDB(NoteBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    created_at: AwareDatetime
    updated_at: AwareDatetime
    