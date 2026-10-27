
from pydantic import BaseModel, ConfigDict, AwareDatetime, Field, model_validator
from models.types import  PyObjectId, Tags, Title, TypesEnum, UpdateModel


class ContainerLayout(BaseModel):
    x : int = Field(ge=0)
    y : int = Field(ge=0)
    h : int = Field(ge=1, le=900)
    w : int = Field(ge=1, le=900)
    
class ContainerBase(BaseModel):
    title: Title
    filter_tags: Tags = Field(default_factory=list)
    layout: ContainerLayout 

class ContainerUpdate(UpdateModel):
    title: Title | None
    filter_tags: Tags | None = None
    layout: ContainerLayout | None = None

class ContainerCreate(ContainerBase):
    model_config = ConfigDict(extra="forbid")
    type: TypesEnum

class ContainerDB(ContainerBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    type: TypesEnum
    created_at: AwareDatetime
    updated_at: AwareDatetime