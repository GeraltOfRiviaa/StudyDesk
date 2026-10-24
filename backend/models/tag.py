
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from models.common import HexColor, PyObjectId, Tag


class MasterTagsBase(BaseModel):
    name: Tag
    color: HexColor
class MasterTagsCreate(MasterTagsBase):
    model_config = ConfigDict(extra="forbid")
class MasterTagsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: Tag | None = None
    color: HexColor | None = None
class MasterTagsDB(MasterTagsBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    created_at: datetime
    updated_at: datetime
    