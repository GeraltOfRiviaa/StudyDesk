
from pydantic import BaseModel, ConfigDict, Field, AwareDatetime, model_validator
from models.types import HexColor, PyObjectId, Tag, UpdateModel


class MasterTagsBase(BaseModel):
    name: Tag
    color: HexColor
class MasterTagsCreate(MasterTagsBase):
    model_config = ConfigDict(extra="forbid")
class MasterTagsUpdate(UpdateModel):
    name: Tag | None = None
    color: HexColor | None = None
    
class MasterTagsDB(MasterTagsBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    created_at: AwareDatetime
    updated_at: AwareDatetime
    