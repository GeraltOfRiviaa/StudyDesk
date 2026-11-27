
import re
from typing import Any, Literal

from bson import ObjectId
from fastapi import HTTPException

from models.types import PaginatedItems, PyObjectId, TableItem, Title

from database import db

import base64
from bson import json_util

from core.collections import ALLOWED_COLLECTIONS

# We use cursor based pagination, meaning we load 30 items and after that 
# we wait for the user to scroll. After that we load 30 more items and like that
# basically infinitelly


# To know where we are we store these:
def encode_cursor(doc, sort):
    data = {
        "value": doc[sort], # item we stopped at
        "type": doc["type"], # items type we stopped at
        "id": doc["_id"] # id of the item we stopped at
        # those last two are used for sorting values with the same date
    }

    # We need a string to pass into the URL safely so we 
    # create a json with the MongoDBs specific values,
    # convert it into bytes, 
    # encode them into URL safe format
    # and convert them back to string
    return base64.urlsafe_b64encode(
        json_util.dumps(data).encode()
    ).decode()


def decode_cursor(cursor):
    try:
        # return the string into the dictioary
        return json_util.loads(
            base64.urlsafe_b64decode(cursor).decode()
        )
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid cursor"
        )

def to_item(doc: dict) -> TableItem:
    return TableItem(
        id=doc["_id"],
        type=doc["type"],
        title=doc["title"],
        tags=doc["tags"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"]
    )

def build_cursor_query(cursor, sort, direction):
    '''Query that tells MongoDB which items come after the last returned item. 
    It's telling mongo what to search for and not how to sort it'''
    data = decode_cursor(cursor)

    # determine wheter to sort in ascending or descending way
    operator = "$gt" if direction == 1 else "$lt"

    return {
        "$or": [
            {
                # return items with an older updated_at
                sort: {operator: data["value"]}
            },
            {   
                # return items with the same date but an alphabetically greater type
                sort: data["value"],
                "type": {"$gt": data["type"]}
            },
            {
                # return items with the same date and type but a smaller ID
                sort: data["value"],
                "type": data["type"],
                "_id": {operator: data["id"]}
            }
        ]
    }


def build_query(
    user_id: PyObjectId,
    q: Title | None = None,
    ids: list[PyObjectId] | None = None,
    tags: list[PyObjectId] | None = None,
    match: Literal["none", "any", "all", "exact"] | None = None,
) -> dict[str, Any]:

    query: dict[str, Any] = {
        "user_id": ObjectId(user_id)
    }

    if ids:
        query["_id"] = {
            "$in": [ObjectId(i) for i in set(ids)]
        }

    if match == "none" and tags:
        raise HTTPException(
            status_code=400,
            detail="tags not allowed with match=none"
        )

    if match in ("any", "all", "exact") and not tags:
        raise HTTPException(
            status_code=400,
            detail="tags required for this match"
        )

    if tags and match is None:
        match = "any"

    tag_ids = [ObjectId(t) for t in set(tags)] if tags else []

    if match == "none":
        query["tags"] = []

    elif match == "any":
        query["tags"] = {"$in": tag_ids}

    elif match == "all":
        query["tags"] = {"$all": tag_ids}

    elif match == "exact":
        query["tags"] = {
            "$all": tag_ids,
            "$size": len(tag_ids)
        }

    if q:
        query["title"] = {
            "$regex": re.escape(q),
            "$options": "i"
        }

    return query


async def filtered_list(
    user_id: PyObjectId,
    collections: list[str] | None = None,
    q: Title | None = None,
    ids: list[PyObjectId] | None = None,
    tags: list[PyObjectId] | None = None,
    match: Literal["none", "any", "all", "exact"] | None = None,
    limit: int = 30,
    cursor: str | None = None,
    sort: Literal[
        "updated_at", "created_at", "title", "tags"
    ] = "updated_at",
    order: Literal["asc", "desc"] = "desc",
) -> PaginatedItems:

    # Validate requested collections
    if collections is not None:
        for name in collections:
            if name != "all" and name not in ALLOWED_COLLECTIONS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid collection: {name}"
                )

    # Select all collections if requested
    if collections is None or "all" in collections:
        collections = list(ALLOWED_COLLECTIONS)

    # Remove duplicate collections
    collections = list(dict.fromkeys(collections))

    if not collections:
        return PaginatedItems(
        items=[],
        has_more=False,
        next_cursor=None
    )

    # Build the shared query
    query = build_query(
        user_id=user_id,
        q=q,
        ids=ids,
        tags=tags,
        match=match
    )

    # Define the pipeline for an individual collection
    def collection_pipeline(name: str):
        return [
            {"$match": query},
            {
                "$project": {
                    "_id": 1,
                    "title": 1,
                    "tags": 1,
                    "created_at": 1,
                    "updated_at": 1,
                    "type": {
                        "$literal": ALLOWED_COLLECTIONS[name]
                    }
                }
            }
        ]

    # Initialize the pipeline with the first collection
    pipeline = collection_pipeline(collections[0])

    # Combine the remaining collections
    for name in collections[1:]:
        pipeline.append({
            "$unionWith": {
                "coll": name,
                "pipeline": collection_pipeline(name)
            }
        })

    direction = 1 if order == "asc" else -1
    
    if cursor:
        pipeline.append({
            "$match": build_cursor_query(
                cursor, sort, direction
            )
        })
    
    pipeline.extend([
        {
            "$sort": {
                sort: direction,
                "type": 1,
                "_id": direction
            }
        },
        {"$limit": limit + 1}
    ])
    
    db_cursor = await db[collections[0]].aggregate(
        pipeline,
        collation={"locale": "en"}
    )
    
    docs = await db_cursor.to_list(length=limit + 1)
    
    has_more = len(docs) > limit
    docs = docs[:limit]
    
    return PaginatedItems(
        items=[to_item(doc) for doc in docs],
        has_more=has_more,
        next_cursor=(
            encode_cursor(docs[-1], sort)
            if has_more else None
        )
    )

