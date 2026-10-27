from pydantic import BaseModel, ConfigDict, AwareDatetime, Field, model_validator
from models.types import PyObjectId, Title, QuestionTitle, QuestionInputTypeEnum, GenericId, Description, Tags, TimeToFinish, UpdateModel
from typing import Annotated


class Option(BaseModel):
    id: GenericId
    title: Title
    description: Description | None = None


class Question(BaseModel):
    id: GenericId
    title: QuestionTitle
    input_type: QuestionInputTypeEnum
    options: Annotated[list[Option], Field(min_length=2, max_length=10)]
    correct_options: Annotated[list[GenericId], Field(min_length=1, max_length=10)]

    # check for all option rules
    @model_validator(mode="after")
    def check_options(self):
        option_ids = [o.id for o in self.options]
        
        #check if options and correct options have no duplicates
        if len(option_ids) != len(set(option_ids)):
            raise ValueError("option ids must be unique")

        if len(self.correct_options) != len(set(self.correct_options)):
            raise ValueError("correct_options must be unique")

        # check if correct_ids are present in the options_ids
        existing = set(option_ids)
        for correct_id in self.correct_options:
            if correct_id not in existing:
                raise ValueError(f"Correct option ID '{correct_id}' does not exist in options.")

        # check if single type question has two options
        if self.input_type == QuestionInputTypeEnum.true_false and len(self.options) != 2:
            raise ValueError("true_false must have exactly two options")

        #check if single and true_false have exactly one correct option
        if self.input_type in {QuestionInputTypeEnum.single, QuestionInputTypeEnum.true_false}:
            if len(self.correct_options) != 1:
                raise ValueError("single and true_false must have exactly one correct option")

        return self


Questions = Annotated[list[Question], Field(min_length=1, max_length=500)]

#check if each question in the list is unique
def _check_unique_question_ids(questions: list[Question]) -> None:
    ids = [q.id for q in questions]
    if len(ids) != len(set(ids)):
        raise ValueError("question ids must be unique")


class FormBase(BaseModel):
    title: Title
    questions: Questions
    tags: Tags
    time_to_finish: TimeToFinish | None = None

    #public questions id unique check
    @model_validator(mode="after")
    def check_unique_question_ids(self):
        _check_unique_question_ids(self.questions)
        return self


class FormCreate(FormBase):
    model_config = ConfigDict(extra="forbid")


class FormUpdate(UpdateModel):
    title: Title | None = None
    questions: Questions | None = None
    tags: Tags | None = None
    time_to_finish: TimeToFinish | None = None

    #public questions id unique check
    @model_validator(mode="after")
    def check_unique_question_ids(self):
        if self.questions is not None:
            _check_unique_question_ids(self.questions)
        return self


class FormDB(FormBase):
    id: PyObjectId = Field(validation_alias="_id")
    user_id: PyObjectId
    created_at: AwareDatetime
    updated_at: AwareDatetime