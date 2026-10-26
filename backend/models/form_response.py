from pydantic import BaseModel, ConfigDict, AwareDatetime, Field
from models.types import PyObjectId, GenericId, Score, TimeToFinish
from typing import Annotated

class Answer(BaseModel):
    question_id: GenericId
    options_id: Annotated[list[GenericId], Field(default_factory=list)]

class FormResponseBase(BaseModel):
    form_id: PyObjectId
    answers: Annotated[list[Answer], Field(default_factory=list)]
    result: str  | None = None
    finish_time: TimeToFinish  | None = None
    
class FormResponseCreate(FormResponseBase):
    model_config = ConfigDict(extra="forbid")

class FormResponseDB(FormResponseBase):
    id: PyObjectId = Field(validation_alias="_id")
    score: Score
    user_id: PyObjectId
    created_at: AwareDatetime