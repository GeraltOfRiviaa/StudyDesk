from pydantic import BaseModel, ConfigDict, AwareDatetime, Field, model_validator
from models.types import PyObjectId, Title, QuestionTitle, QuestionInputTypeEnum, GenericId, Description, Tags, TimeToFinish
from typing import Annotated

class Option(BaseModel):
    id: GenericId
    title: Title
    description: Description | None = None

class Question(BaseModel):
    id: GenericId
    title: QuestionTitle
    input_type: QuestionInputTypeEnum
    options: Annotated[list[Option], Field(default_factory=list)]
    correct_options: Annotated[list[GenericId], Field(min_length=1)]
    
    @model_validator(mode="after")
    def check_true_false(self):
        if self.input_type == QuestionInputTypeEnum.true_false:
            if len(self.options) != 2 :
                raise ValueError('true_false has to have two options')
        return self
    
    @model_validator(mode="after")
    def check_single(self):
        if self.input_type == QuestionInputTypeEnum.single:
            if len(self.options) < 2 :
                raise ValueError('single cannot have less than two options')
        return self
    
    @model_validator(mode="after")
    def check_correct_options(self):
        if self.input_type in {QuestionInputTypeEnum.true_false, QuestionInputTypeEnum.single}:
            if len(self.correct_options) > 1:
                raise ValueError('true_false and single cannot have more than one correct option')
        return self
    
    @model_validator(mode="after") 
    def validate_correct_option_ids(self): 
        """Ensures all correct option IDs exist within the options array."""
        existing_ids = {option.id for option in self.options} 
        for correct_id in self.correct_options: 
            if correct_id not in existing_ids: 
                raise ValueError(f"Correct option ID '{correct_id}' does not exist in options.") 
        return self

class FormBase(BaseModel):
    title: Title
    questions:Annotated[list[Question], Field(min_length=1)]
    tags: Tags
    time_to_finish: TimeToFinish | None = None

class FormCreate(FormBase):
    model_config = ConfigDict(extra="forbid")
    

class FormUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Title | None = None
    questions: Annotated[list[Question], Field(default_factory=list)]
    tags: Tags | None = None
    time_to_finish: TimeToFinish | None = None

class FormDB(FormBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    created_at: AwareDatetime
    updated_at: AwareDatetime

# form.py
# 1. **`questions` bypasses `min_length=1`:** the `default_factory=list` makes an omitted field `[]`, and defaults aren't validated. A form with no questions gets through. It should be required.
# 2. **`FormUpdate.questions`:** the nested `Annotated[... default_factory ...] | None` is messy, and it has no `min_length`, so a PATCH can set `[]`, which Create forbids.
# 3. **`true_false` check is too weak:** it only rejects more than 2 options, so 0 or 1 option passes. `single` and `multiple` also have no minimum of 2 options.
# 4. **Missing uniqueness checks:** duplicate option IDs in one question (the `set` hides them), duplicate question IDs in a form, and duplicate entries in `correct_options`.
# 5. **No `max_length`** on `options` or `questions`.
# 6. **Design conflict:** `correct_options` is required (`min_length=1`), but your README says forms also cover data collection with no correct answers. Decide whether that's supported.
# 7. **Editing questions after responses exist** leaves stored responses pointing at IDs that may no longer exist. Decide whether to block this or version the form.