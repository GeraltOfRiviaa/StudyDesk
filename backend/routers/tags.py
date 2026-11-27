from datetime import datetime, timezone
from typing import Annotated, Any

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pymongo import ReturnDocument
from pymongo.collation import Collation
from pymongo.errors import DuplicateKeyError

from core.tags import TAG_REFS, to_tag, count_usage
from models.tag import TagCreate, TagPublic, TagUpdate, TagDetail, TagUsage
from models.users import UserPublic
from models.types import PyObjectId, Tag
from database import db
from core.security import get_current_user

import re

router = APIRouter(prefix="/tags", tags=["Tags"])
tags_collection = db["tags"]

# case-insensitive name matching ("Math" == "math")
CI = Collation(locale="en", strength=2)


# F1 - get all user's tags

@router.get("/", status_code=200, response_model=list[TagPublic])
async def list_tags(
    q: Annotated[Tag | None, Query(max_length=50)] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 30,
    user: UserPublic = Depends(get_current_user),
):
    query: dict[str, Any] = {"user_id": ObjectId(user.id)}
    if q:
        query["name"] = {"$regex": re.escape(q), "$options": "i"}

    docs = await (
        tags_collection.find(query)
        .collation(CI)
        .sort("name", 1)
        .limit(limit)
        .to_list(length=limit)
    )
    return [to_tag(d) for d in docs]


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
async def create_tag(tag: TagCreate, user: UserPublic = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": ObjectId(user.id), 
        "name": tag.name, 
        "color": tag.color,
        "created_at": now, 
        "updated_at": now,
    }
    try:
        result = await tags_collection.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Tag already exists")
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
    try:
        result = await tags_collection.find_one_and_update(
            {"_id": ObjectId(tag_id), "user_id": ObjectId(user.id)},
            {"$set": changes},
            return_document=ReturnDocument.AFTER,
        )
    # if user tries to rename a tag into something already in database it will collide with the index
    # that ensures that when user rename Math to Bio but Bio already exists it stops the user
    # from creating a second tag with identical name
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Tag already exists")
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
    user: UserPublic = Depends(get_current_user),
):
    uid = ObjectId(user.id)
    tids = [ObjectId(i) for i in set(ids)]

    # Check if the tags exist and the user owns them
    owned = await tags_collection.count_documents({"_id": {"$in": tids}, "user_id": uid})
    if owned != len(tids):
        raise HTTPException(status_code=404, detail="Tag not found")

    # Count how many tags are there in the whole DB
    by_collection = await count_usage(uid, tids)
    total = sum(by_collection.values())

    # If the user did not confirm he wants to delete those then error
    if total and not confirm:
        raise HTTPException(
            status_code=409,
            detail={"message": "Tags in use", "total": total, "by_collection": by_collection},
        )

    # If the user did confirm then delete the from tags and every other collection
    result = await tags_collection.delete_many({"_id": {"$in": tids}, "user_id": uid})
    for coll, field in TAG_REFS:
        await db[coll].update_many(
            {"user_id": uid, field: {"$in": tids}},
            {"$pull": {field: {"$in": tids}}},
        )
    return {"deleted": result.deleted_count}