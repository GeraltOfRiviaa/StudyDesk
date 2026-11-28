import logging
import re
from collections.abc import Sequence
from datetime import datetime, timezone
from typing import Any, Literal

from bson import ObjectId
from fastapi import HTTPException
from pymongo.errors import PyMongoError

from models.tag import PaginatedTags, TagPublic
from database import db
from core.collections import ITEM_COLLECTIONS
from core.indexes import TAG_NAME_COLLATION
from core.search import decode_cursor, encode_cursor_payload


tags_collection = db["tags"]
logger = logging.getLogger(__name__)
TagSort = Literal["name", "created_at", "updated_at"]

def to_tag(doc: dict) -> TagPublic:
    return TagPublic(
        id=str(doc["_id"]),
        name=doc["name"],
        color=doc["color"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def build_tag_list_query(user_id: str, q: str | None) -> dict[str, Any]:
    query: dict[str, Any] = {"user_id": ObjectId(user_id)}
    if q:
        query["name"] = {"$regex": re.escape(q), "$options": "i"}
    return query


def tag_cursor_filter(cursor: str, sort: TagSort, direction: int) -> dict[str, Any]:
    data = decode_cursor(cursor, validate=True)
    value_type = str if sort == "name" else datetime
    if (
        not isinstance(data, dict)
        or data.get("sort") != sort
        or type(data.get("direction")) is not int
        or data["direction"] != direction
        or not isinstance(data.get("value"), value_type)
        or not isinstance(data.get("id"), ObjectId)
    ):
        raise HTTPException(status_code=400, detail="Invalid cursor")

    operator = "$gt" if direction == 1 else "$lt"
    return {"$or": [
        {sort: {operator: data["value"]}},
        {sort: data["value"], "_id": {operator: data["id"]}},
    ]}


async def list_library_tags(
    user_id: str,
    q: str | None,
    sort: TagSort,
    order: Literal["asc", "desc"],
    limit: int,
    cursor: str | None,
) -> PaginatedTags:
    query = build_tag_list_query(user_id, q.strip() if q else None)
    direction = 1 if order == "asc" else -1
    if cursor is not None:
        query.update(tag_cursor_filter(cursor, sort, direction))

    docs = await (
        tags_collection.find(query)
        .collation(TAG_NAME_COLLATION)
        .sort([(sort, direction), ("_id", direction)])
        .limit(limit + 1)
        .to_list(length=limit + 1)
    )
    has_more = len(docs) > limit
    docs = docs[:limit]
    next_cursor = None
    if has_more:
        last = docs[-1]
        next_cursor = encode_cursor_payload({
            "sort": sort,
            "direction": direction,
            "value": last[sort],
            "id": last["_id"],
        })

    return PaginatedTags(
        items=[to_tag(doc) for doc in docs],
        next_cursor=next_cursor,
        has_more=has_more,
    )


# Collections containing tag references
TAG_REFS = [
    (collection, "tags")
    for collection in ITEM_COLLECTIONS.values()
] + [
    ("containers", "filter_tags")
]


def normalize_tag_ids(tag_ids: Sequence[str]) -> list[ObjectId]:
    # Convert before deduplication so hex casing cannot change which IDs are checked or written.
    return list(dict.fromkeys(ObjectId(tag_id) for tag_id in tag_ids))


async def validate_tag_ids(
    user_id: str,
    tag_ids: Sequence[str],
) -> list[ObjectId]:
    ids = normalize_tag_ids(tag_ids)

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

    return ids


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


async def delete_tags(user_id: str, tag_ids: Sequence[str], *, confirm: bool) -> int:
    uid = ObjectId(user_id)
    ids = normalize_tag_ids(tag_ids)
    owned_tags = {"_id": {"$in": ids}, "user_id": uid}
    stage = "inspection"

    try:
        # A retry can see different ownership or usage after the previous attempt released its lock.
        if await tags_collection.count_documents(owned_tags) != len(ids):
            raise HTTPException(status_code=404, detail="Tag not found")
        by_collection = await count_usage(uid, ids)
        total = sum(by_collection.values())
        if total and not confirm:
            raise HTTPException(
                status_code=409,
                detail={"message": "Tags in use", "total": total, "by_collection": by_collection},
            )

        stage = "cleanup"
        now = datetime.now(timezone.utc)
        # Only documents still referencing these tags are touched, including on retry.
        for collection, field in TAG_REFS:
            await db[collection].update_many(
                {"user_id": uid, field: {"$in": ids}},
                {"$pull": {field: {"$in": ids}}, "$set": {"updated_at": now}},
            )

        stage = "deletion"
        result = await tags_collection.delete_many(owned_tags)
        return result.deleted_count
    except PyMongoError:
        logger.exception("Tag deletion interrupted during %s for user %s", stage, uid)
        message = {
            "inspection": "Could not check tag ownership or usage. Try again.",
            "cleanup": "Tag cleanup was interrupted. Some references may have been removed. Try again to finish.",
            "deletion": "Could not confirm tag deletion. Refresh and retry any remaining tags.",
        }[stage]
        raise HTTPException(status_code=503, detail={"message": message}) from None
