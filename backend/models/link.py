from pydantic import BaseModel, ConfigDict, AwareDatetime, model_validator
from models.types import PyObjectId, TypesEnum

class LinkBase(BaseModel):
    item_a_id: PyObjectId
    item_a_type: TypesEnum
    item_b_id: PyObjectId
    item_b_type: TypesEnum
    model_config = ConfigDict(extra="forbid")
    
    @model_validator(mode="after")
    def no_self_link(self):
        if self.item_a_id == self.item_b_id and self.item_a_type == self.item_b_type:
            raise ValueError("cannot link an item to itself")
        return self
    
class LinkPublic(LinkBase):
    id: PyObjectId
    user_id: PyObjectId
    created_at: AwareDatetime
    