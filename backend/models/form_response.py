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
    
# form_response.py
# 1. **`form_id` in the body:** it's already in the path of `POST /forms/{form_id}/responses`. A body value can disagree with the path, so drop it from Create and set it server-side.
# 2. **`result` is client-settable** (it's in Base, so it's in Create), while `score` is correctly server-only. `result` should be server-computed too.
# 3. **`finish_time`** is client-supplied and unverifiable, so treat it as informational. The name is also unclear (it's a duration, so `time_taken`), and it should be checked against the form's `time_to_finish`.
# 4. `Answer.options_id` holds a list, so it should be `option_ids`.
# 5. `answers` has no `max_length` and no duplicate `question_id` check.
# 6. **Handler-level checks:** the models can't verify that question IDs and option IDs exist in the stored form, or that `single` answers have exactly one option. You'll need to do that in the endpoint.
# 