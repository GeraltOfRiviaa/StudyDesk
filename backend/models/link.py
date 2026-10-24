from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from models.common import PyObjectId, TypesEnum

class LinkBase(BaseModel):
    item_a_id: PyObjectId
    item_a_type: TypesEnum
    item_b_id: PyObjectId
    item_b_type: TypesEnum
    
class LinkCreate(LinkBase):
    model_config = ConfigDict(extra="forbid")
    
class LinkDB(LinkBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    created_at: datetime
    