
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime
from models.types import HexColor, PyObjectId, Tag, UpdateModel


class TagBase(BaseModel):
    name: Tag
    color: HexColor
class TagCreate(TagBase):
    model_config = ConfigDict(extra="forbid")

class TagUpdate(UpdateModel):
    name: Tag = Field(default_factory=lambda: None)
    color: HexColor = Field(default_factory=lambda: None)

class TagPublic(TagBase):
    id: PyObjectId
    created_at: AwareDatetime
    updated_at: AwareDatetime

class PaginatedTags(BaseModel):
    items: list[TagPublic]
    next_cursor: str | None = None
    has_more: bool

class TagUsage(BaseModel):
    total: int
    by_collection: dict[str, int]

class TagDetail(TagPublic):          # modal
    usage: TagUsage
