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
            if len(self.options) > 2:
                raise ValueError('true_false cannot have more than two options')
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
    questions:Annotated[list[Question], Field(default_factory=list, min_length=1)]
    tags: Tags
    time_to_finish: TimeToFinish | None = None

class FormCreate(FormBase):
    model_config = ConfigDict(extra="forbid")
    

class FormUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Title | None = None
    questions: Annotated[list[Question], Field(default_factory=list)] | None = None
    tags: Tags | None = None
    time_to_finish: TimeToFinish | None = None

class FormDB(FormBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    created_at: AwareDatetime
    updated_at: AwareDatetime
