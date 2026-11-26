from bson import ObjectId
from fastapi import HTTPException

from database import db
from models.types import Tags
from core.collections import ITEM_COLLECTIONS


tags_collection = db["tags"]


# Collections containing tag references
TAG_REFS = [
    (collection, "tags")
    for collection in ITEM_COLLECTIONS.values()
] + [
    ("containers", "filter_tags")
]


# Validate tag existence and ownership
async def validate_tag_ids(
    user_id: str,
    tag_ids: Tags
) -> Tags:

    ids = list({ObjectId(t) for t in tag_ids})

    if not ids:
        return []

    count = await tags_collection.count_documents({
        "_id": {"$in": ids},
        "user_id": ObjectId(user_id)
    })

    if count != len(ids):
        raise HTTPException(
            status_code=400,
            detail="Invalid tag ids"
        )

    return [str(t) for t in ids]


# Count tag usage across collections
async def count_usage(
    uid: ObjectId,
    tids: list[ObjectId]
) -> dict[str, int]:

    result = {}

    for collection, field in TAG_REFS:
        count = await db[collection].count_documents({
            "user_id": uid,
            field: {"$in": tids}
        })

        result[collection] = count

    return result