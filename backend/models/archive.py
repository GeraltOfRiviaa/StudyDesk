
from datetime import datetime
from mimetypes import MimeTypes
from pydantic import BaseModel, ConfigDict, Field
from models.types import FileName, FileSizeLimit, PyObjectId, StoragePath, Tags, Title, UpdateModel


class FilesBase(BaseModel):
    title: Title
    tags: Tags = Field(default_factory=list)
    
class FilesCreate(FilesBase):
    model_config = ConfigDict(extra="forbid")
    
class FilesUpdate(UpdateModel):
    title: Title | None = None
    tags: Tags | None = None

class FilesDB(FilesBase):
    id: PyObjectId
    user_id: PyObjectId
    filename: FileName
    storage_path: StoragePath
    mime_type: MimeTypes
    size: FileSizeLimit
    created_at: datetime
    updated_at: datetime
