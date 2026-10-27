from pydantic import BaseModel, ConfigDict, AwareDatetime, Field, model_validator
from models.types import PyObjectId, GenericId, Score, TimeToFinish
from typing import Annotated


class Answer(BaseModel):
    question_id: GenericId
    option_ids: Annotated[list[GenericId], Field(min_length=1, max_length=10)]

    #check if the option ids are unique
    @model_validator(mode="after")
    def check_option_ids(self):
        if len(self.option_ids) != len(set(self.option_ids)):
            raise ValueError("option ids must be unique")
        return self

class FormResponseBase(BaseModel):
    answers: Annotated[list[Answer], Field(min_length=1, max_length=500)]
    time_taken: TimeToFinish | None = None

    #check that each question is present only once
    @model_validator(mode="after")
    def check_unique_questions(self):
        ids = [a.question_id for a in self.answers]
        if len(ids) != len(set(ids)):
            raise ValueError("each question can be answered only once")
        return self


class FormResponseCreate(FormResponseBase):
    model_config = ConfigDict(extra="forbid")


class FormResponseDB(FormResponseBase):
    id: PyObjectId = Field(validation_alias="_id")
    form_id: PyObjectId
    user_id: PyObjectId
    score: Score
    result: str | None = None
    created_at: AwareDatetime