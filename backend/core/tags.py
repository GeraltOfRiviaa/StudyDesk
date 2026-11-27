import re
from datetime import datetime
from typing import Any, Literal

from bson import ObjectId
from fastapi import HTTPException
from pymongo.collation import Collation

from models.tag import PaginatedTags, TagPublic
from database import db
from models.types import Tags
from core.collections import ITEM_COLLECTIONS
from core.search import decode_cursor, encode_cursor_payload


tags_collection = db["tags"]
TAG_NAME_COLLATION = Collation(locale="en", strength=2)
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
