from typing import Annotated

from bson import ObjectId
from pydantic import AfterValidator, BaseModel, ConfigDict, AwareDatetime, model_validator
from models.types import PyObjectId, TypesEnum


# Keep API IDs as strings while making casing irrelevant before link validation.
LinkObjectId = Annotated[PyObjectId, AfterValidator(lambda value: str(ObjectId(value)))]


class LinkBase(BaseModel):
    item_a_id: LinkObjectId
    item_a_type: TypesEnum
    item_b_id: LinkObjectId
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


class LinkSearchItem(BaseModel):
    id: PyObjectId
    type: TypesEnum
    title: str


class LinkedItem(BaseModel):
    link_id: PyObjectId
    item_id: PyObjectId
    item_type: TypesEnum
    title: str


class LinkDeleted(BaseModel):
    deleted: int
