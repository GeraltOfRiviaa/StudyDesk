from enum import Enum

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from models.types import FileName, MimeTypesEnum, PyObjectId, TagIdInput, Tags, Title, UpdateModel


class FileStatusEnum(str, Enum):
    pending = "pending"
    ready = "ready"
    deleting = "deleting"


class FileBase(BaseModel):
    title: Title
    tags: Tags = Field(default_factory=list)


class FileCreate(FileBase):
    model_config = ConfigDict(extra="forbid")

    # Match Notes' input shape so the shared write helper can normalize tags later.
    tags: TagIdInput = Field(default_factory=list)


class FileUpdate(UpdateModel):
    # Omitted fields stay out of the update. Explicit nulls still fail validation.
    title: Title = Field(default_factory=lambda: None)
    tags: TagIdInput = Field(default_factory=lambda: None)


class FilePublic(FileBase):
    id: PyObjectId
    filename: FileName
    mime_type: MimeTypesEnum
    # Existing files can exceed a limit that was lowered after upload.
    size: int = Field(gt=0, strict=True)
    created_at: AwareDatetime
    updated_at: AwareDatetime
