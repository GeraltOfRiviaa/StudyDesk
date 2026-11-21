
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime, model_validator
from models.types import HexColor, PyObjectId, Tag, UpdateModel


class TagBase(BaseModel):
    name: Tag
    color: HexColor
class TagCreate(TagBase):
    model_config = ConfigDict(extra="forbid")

class TagUpdate(UpdateModel):
    name: Tag | None = None
    color: HexColor | None = None

class TagPublic(TagBase):
    id: PyObjectId
    created_at: AwareDatetime
    updated_at: AwareDatetime

class TagUsage(BaseModel):
    total: int
    by_collection: dict[str, int]

class TagDetail(TagPublic):          # modal
    usage: TagUsage