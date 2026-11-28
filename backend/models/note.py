
from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints
from models.types import PyObjectId, TagIdInput, Tags, Title, UpdateModel


NoteContent = Annotated[str, StringConstraints(max_length=10000)]

class NoteBase(BaseModel):
    title: Title
    tags: Tags  = Field(default_factory=list)
    
class NoteCreate(NoteBase):
    model_config = ConfigDict(extra="forbid")
    content: NoteContent
    tags: TagIdInput = Field(default_factory=list)
    
class NoteUpdate(UpdateModel):
    # Defaults allow omission. Supplied values still validate against the non-nullable types.
    title: Title = Field(default_factory=lambda: None)
    content: NoteContent = Field(default_factory=lambda: None)
    tags: TagIdInput = Field(default_factory=lambda: None)

class NotePublic(NoteBase):
    id: PyObjectId
    content: str
    created_at: AwareDatetime
    updated_at: AwareDatetime

class NoteCreated(BaseModel):
    inserted_id: PyObjectId


class NoteListItem(NoteBase):
    id: PyObjectId
    created_at: AwareDatetime
    updated_at: AwareDatetime
