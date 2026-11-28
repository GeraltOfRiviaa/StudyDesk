import re
from typing import Literal

from bson import ObjectId
from fastapi import HTTPException

from core.collections import ALLOWED_COLLECTIONS
from core.indexes import SIMPLE_COLLATION, TAG_NAME_COLLATION
from core.pagination import CursorBoundary, cursor_fingerprint, decode_cursor, encode_cursor
from database import db
from models.types import PaginatedItems, PyObjectId, TableItem, Title


ItemSort = Literal["updated_at", "created_at", "title"]
TagMatch = Literal["none", "any", "all", "exact"]


def to_item(doc: dict) -> TableItem:
    return TableItem(
        id=doc["_id"],
        type=doc["type"],
        title=doc["title"],
        tags=doc["tags"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )


def build_cursor_query(boundary: CursorBoundary, sort: ItemSort, direction: int) -> dict:
    operator = "$gt" if direction == 1 else "$lt"
    # Compare the sort tuple lexicographically. Type stays ascending in both directions.
    return {
        "$or": [
            {sort: {operator: boundary.value}},
            {sort: boundary.value, "type": {"$gt": boundary.item_type}},
            {sort: boundary.value, "type": boundary.item_type, "_id": {operator: boundary.item_id}},
        ],
    }


def build_query(
    owner: ObjectId, q: str, ids: list[ObjectId], tags: list[ObjectId], match: TagMatch | None,
) -> dict:
    query = {"user_id": owner}
    if ids:
        query["_id"] = {"$in": ids}

    if match == "none":
        query["tags"] = []
    elif match == "any":
        query["tags"] = {"$in": tags}
    elif match == "all":
        query["tags"] = {"$all": tags}
    elif match == "exact":
        query["tags"] = {"$all": tags, "$size": len(tags)}

    if q:
        query["title"] = {"$regex": re.escape(q), "$options": "i"}
    return query


def _collection_pipeline(collection: str, query: dict, before_projection: list[dict]) -> list[dict]:
    return [
        {"$match": query},
        *before_projection,
        {"$project": {
            "_id": 1, "title": 1, "tags": 1, "created_at": 1, "updated_at": 1,
            "type": {"$literal": ALLOWED_COLLECTIONS[collection]},
        }},
    ]


def _collection_cursor_filter(
    item_type: str, boundary: CursorBoundary, sort: ItemSort, direction: int,
) -> dict:
    operator = "$gt" if direction == 1 else "$lt"
    if item_type == boundary.item_type:
        return {"$or": [
            {sort: {operator: boundary.value}},
            {sort: boundary.value, "_id": {operator: boundary.item_id}},
        ]}
    # At an equal sort value, only types after the cursor's type can follow it.
    assert boundary.item_type is not None
    inclusive = "$gte" if direction == 1 else "$lte"
    return {sort: {inclusive if item_type > boundary.item_type else operator: boundary.value}}


def _library_pipeline(
    collections: list[str], query: dict, boundary: CursorBoundary | None,
    sort: ItemSort, direction: int, count: int, *, limit_branches: bool = False,
) -> list[dict]:
    def branch(collection: str) -> list[dict]:
        if not limit_branches:
            return _collection_pipeline(collection, query, [])
        selector = query.copy()
        if boundary is not None:
            selector.update(_collection_cursor_filter(ALLOWED_COLLECTIONS[collection], boundary, sort, direction))
        # At most count rows per type can reach the global top count. Apply the
        # cursor first so each branch can use its existing owner/date index.
        stages = [{"$sort": {sort: direction, "_id": direction}}, {"$limit": count}]
        return _collection_pipeline(collection, selector, stages)

    pipeline = branch(collections[0])
    for collection in collections[1:]:
        pipeline.append({"$unionWith": {
            "coll": collection,
            "pipeline": branch(collection),
        }})
    if boundary is not None and not limit_branches:
        pipeline.append({"$match": build_cursor_query(boundary, sort, direction)})
    pipeline.extend([{"$sort": {sort: direction, "type": 1, "_id": direction}}, {"$limit": count}])
    return pipeline


async def filtered_list(
    user_id: PyObjectId,
    collections: list[str] | None = None,
    q: Title | None = None,
    ids: list[PyObjectId] | None = None,
    tags: list[PyObjectId] | None = None,
    match: TagMatch | None = None,
    limit: int = 30,
    cursor: str | None = None,
    sort: ItemSort = "updated_at",
    order: Literal["asc", "desc"] = "desc",
) -> PaginatedItems:
    for name in collections or []:
        if name != "all" and name not in ALLOWED_COLLECTIONS:
            raise HTTPException(status_code=400, detail=f"Invalid collection: {name}")
    if collections is None or "all" in collections:
        collections = list(ALLOWED_COLLECTIONS)
    collections = list(dict.fromkeys(collections))

    owner = ObjectId(user_id)
    # Normalize before deduplication so different spellings have one query and cursor context.
    item_ids = sorted({ObjectId(value) for value in ids or []})
    tag_ids = sorted({ObjectId(value) for value in tags or []})
    if match == "none" and tag_ids:
        raise HTTPException(status_code=400, detail="tags not allowed with match=none")
    if match in ("any", "all", "exact") and not tag_ids:
        raise HTTPException(status_code=400, detail="tags required for this match")
    if tag_ids and match is None:
        match = "any"

    q = q or ""
    fingerprint = cursor_fingerprint(
        mode="items", owner=str(owner), collections=sorted(collections), search=q,
        ids=list(map(str, item_ids)), tags=list(map(str, tag_ids)), match=match, sort=sort, order=order,
    )
    boundary = None
    if cursor is not None:
        boundary = decode_cursor(
            cursor, fingerprint, text_limit=150 if sort == "title" else None,
            item_types={ALLOWED_COLLECTIONS[name] for name in collections},
        )
    if not collections:
        return PaginatedItems(items=[], has_more=False)

    query = build_query(owner, q, item_ids, tag_ids, match)
    direction = 1 if order == "asc" else -1
    pipeline = _library_pipeline(
        collections, query, boundary, sort, direction, limit + 1,
        limit_branches=sort == "updated_at" and list(query) == ["user_id"],
    )
    collation = TAG_NAME_COLLATION if sort == "title" else SIMPLE_COLLATION
    db_cursor = await db[collections[0]].aggregate(pipeline, collation=collation)
    docs = await db_cursor.to_list(length=limit + 1)

    has_more = len(docs) > limit
    docs = docs[:limit]
    next_cursor = None
    if has_more:
        last = docs[-1]
        next_cursor = encode_cursor(CursorBoundary(last[sort], last["_id"], last["type"]), fingerprint)
    return PaginatedItems(items=[to_item(doc) for doc in docs], has_more=has_more, next_cursor=next_cursor)
