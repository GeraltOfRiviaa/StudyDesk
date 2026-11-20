from datetime import datetime, timezone
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import ReturnDocument
from pymongo.collation import Collation
from pymongo.errors import DuplicateKeyError

from models.tag import TagCreate, TagPublic, TagUpdate
from models.users import UserPublic
from models.types import PyObjectId, Tags, Tag
from database import db
from core.security import get_current_user

router = APIRouter(prefix="/tags", tags=["Tags"])
tags_collection = db["tags"]

# case-insensitive name matching ("Math" == "math")
CI = Collation(locale="en", strength=2)

# Collections holding tag ids: (collection, field)
# Used when later looking through the whole database 
# if those tags exist in those collections
TAG_REFS = [
    ("notes", "tags"), ("archive", "tags"), ("events", "tags"),
    ("forms", "tags"), ("containers", "filter_tags"),
]


########################################################

def to_tag(doc: dict) -> TagPublic:
    return TagPublic(
        id=str(doc["_id"]), 
        name=doc["name"], 
        color=doc["color"],
        created_at=doc["created_at"], 
        updated_at=doc["updated_at"],
    )

########################################################

# F3 - helper (not a route): call before saving an item/container with tags.
# Returns deduplicated ObjectIds, raises 400 if any doesn't exist / isn't the user's.

async def validate_tag_ids(user_id: str, tag_ids: Tags) -> Tags:
    ids = list({ObjectId(t) for t in tag_ids})
    if not ids:
        return []
    count = await tags_collection.count_documents(
        {"_id": {"$in": ids}, "user_id": ObjectId(user_id)}
    )
    if count != len(tag_ids):
        raise HTTPException(status_code=400, detail="Invalid tag ids")
    return tag_ids


########################################################

# Usage count (helper)

async def count_usage(uid: ObjectId, tids: list[ObjectId]) -> dict[str, int]:
    result = {}

    for coll, field in TAG_REFS:
        count = await db[coll].count_documents({"user_id": uid, field: {"$in": tids}})
        result[coll] = count

    return result

########################################################

# F1 - get all user's tags

@router.get("/", status_code=200, response_model=list[TagPublic])
async def list_tags(user: UserPublic = Depends(get_current_user)):
    docs = await (
        tags_collection.find({"user_id": ObjectId(user.id)})
        .collation(CI)
        .sort("name", 1)
        .to_list(length=None)
    )
    return [to_tag(d) for d in docs]

########################################################

# F2 - find tag by name (duplicate check), case-insensitive

@router.get("/{name}", status_code=200, response_model=TagPublic)
async def get_tag_by_name(name: Tag, user: UserPublic = Depends(get_current_user)):
    doc = await tags_collection.find_one(
        {"user_id": ObjectId(user.id), "name": name}, collation=CI
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Tag not found")
    return to_tag(doc)

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