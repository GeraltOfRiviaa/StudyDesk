
from datetime import datetime
from mimetypes import MimeTypes
from pydantic import BaseModel, ConfigDict, Field
from models.common import FileName, FileSizeLimit, PyObjectId, StoragePath, Tags, Title


class ArchiveBase(BaseModel):
    title: Title
    tags: Tags = Field(default_factory=list)
    
class ArchiveCreate(ArchiveBase):
    model_config = ConfigDict(extra="forbid")
    
class ArchiveUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Title | None = None
    tags: Tags | None = None

class ArchiveDB(ArchiveBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    filename: FileName
    storage_path: StoragePath
    mime_type: MimeTypes
    size: FileSizeLimit
    created_at: datetime
    updated_at: datetime