from pydantic import BaseModel, ConfigDict, Field
from models.types import PyObjectId, TypesEnum


# Represents one selected item
class BulkItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: PyObjectId
    type: TypesEnum


# Shared request model for bulk operations
class BulkRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[BulkItem] = Field(
        min_length=1,
        max_length=100
    )


# Additional tag IDs for adding tags
class BulkAddTagsRequest(BulkRequest):
    tags: list[PyObjectId] = Field(
        min_length=1,
        max_length=100
    )


# Response for bulk updates
class BulkUpdateResult(BaseModel):
    matched: int
    modified: int


# Response for bulk link removal
class BulkUnlinkResult(BaseModel):
    deleted: int