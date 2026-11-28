from datetime import datetime, timezone
from typing import Annotated, Literal

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pymongo import ReturnDocument

from core.tags import (
    TAG_NAME_COLLATION,
    TagSort,
    build_tag_list_query,
    count_usage,
    delete_tags as delete_owned_tags,
    list_library_tags,
    tags_collection,
    to_tag,
)
from models.tag import PaginatedTags, TagCreate, TagPublic, TagUpdate, TagDetail, TagUsage
from models.users import UserPublic
from models.types import PyObjectId, Tag
from database import db
from core.security import get_account_writer, get_current_user

router = APIRouter(prefix="/tags", tags=["Tags"])


# F1 - get all user's tags

@router.get("/", status_code=200, response_model=list[TagPublic])
async def list_tags(
    q: Annotated[Tag | None, Query(max_length=50)] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 30,
    user: UserPublic = Depends(get_current_user),
):
    docs = await (
        tags_collection.find(build_tag_list_query(user.id, q))
        .collation(TAG_NAME_COLLATION)
        .sort("name", 1)
        .limit(limit)
        .to_list(length=limit)
    )
    return [to_tag(d) for d in docs]


@router.get("/library", response_model=PaginatedTags)
async def get_library_tags(
    q: Annotated[str | None, Query(max_length=150)] = None,
    sort: TagSort = "updated_at",
    order: Literal["asc", "desc"] = "desc",
    limit: Annotated[int, Query(ge=1, le=50)] = 30,
    cursor: str | None = None,
    user: UserPublic = Depends(get_current_user),
):
    return await list_library_tags(user.id, q, sort, order, limit, cursor)


########################################################

# Find all the ids listed of a certain user


@router.post("/lookup", response_model=list[TagPublic])
async def lookup_tags(
    ids: Annotated[list[PyObjectId], Body(embed=True)],
    user: UserPublic = Depends(get_current_user),
):
    object_ids = list({ObjectId(tag_id) for tag_id in ids})

    if not ids:
        return []

    docs = await tags_collection.find({
        "_id": {"$in": object_ids},
        "user_id": ObjectId(user.id),
    }).to_list(length=len(ids))

    return [to_tag(doc) for doc in docs]


########################################################


# Get one tag + usage (modal)
@router.get("/{tag_id}", status_code=200, response_model=TagDetail)
async def get_tag(tag_id: PyObjectId, user: UserPublic = Depends(get_current_user)):
    uid, tid = ObjectId(user.id), ObjectId(tag_id)
    doc = await tags_collection.find_one({"_id": tid, "user_id": uid})
    if not doc:
        raise HTTPException(status_code=404, detail="Tag not found")

    by_collection = await count_usage(uid, [tid])
    return TagDetail(
        **to_tag(doc).model_dump(),
        usage=TagUsage(
            total=sum(by_collection.values()), 
            by_collection=by_collection),
    )


########################################################

# A1 - create tag

@router.post("/", status_code=201, response_model=TagPublic)
async def create_tag(tag: TagCreate, user: UserPublic = Depends(get_account_writer)):
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": ObjectId(user.id), 
        "name": tag.name, 
        "color": tag.color,
        "created_at": now, 
        "updated_at": now,
    }
    result = await tags_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    return to_tag(doc)

########################################################

# C1 - rename / recolor

@router.patch("/{tag_id}", status_code=200, response_model=TagPublic)
async def update_tag(tag_id: PyObjectId, data: TagUpdate, user: UserPublic = Depends(get_current_user)):
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to update")
    changes["updated_at"] = datetime.now(timezone.utc)
    result = await tags_collection.find_one_and_update(
        {"_id": ObjectId(tag_id), "user_id": ObjectId(user.id)},
        {"$set": changes},
        return_document=ReturnDocument.AFTER,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    return to_tag(result)


########################################################

# D1 - delete one or many tags + remove them from every item/container
# 409 with usage counts if in use and confirm is not set

@router.delete("/", status_code=200)
async def delete_tags(
    ids: Annotated[list[PyObjectId], Query(min_length=1, max_length=100)],
    confirm: bool = False,
    user: UserPublic = Depends(get_account_writer),
):
    return {"deleted": await delete_owned_tags(user.id, ids, confirm=confirm)}
