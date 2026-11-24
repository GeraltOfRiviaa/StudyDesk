import re
from typing import Annotated, Any, Literal

from bson import ObjectId
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from models.users import UserPublic
from models.types import PyObjectId, Title, TableItem
from database import db
from routers import users, notes, tags, links
from core.security import get_current_user


app = FastAPI(
    swagger_ui_parameters={"persistAuthorization": True}
)

app.include_router(users.router)
app.include_router(notes.router)
app.include_router(tags.router)
app.include_router(links.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://fluffy-acorn-pjrx79rpv469hrrw7-5173.app.github.dev"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ALLOWED_COLLECTIONS = {
    "notes": "note",
    "forms": "form",
    "events": "event",
    "files": "file",
}


def to_item(doc: dict) -> TableItem:
    return TableItem(
        id=doc["_id"],
        type=doc["type"],
        title=doc["title"],
        tags=doc["tags"],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"]
    )


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
    skip: int = 0,
    sort: Literal[
        "updated_at", "created_at", "title", "tags"
    ] = "updated_at",
    order: Literal["asc", "desc"] = "desc",
) -> list[TableItem]:

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
        return []

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

    # Apply global sorting and pagination
    pipeline.extend([
        {
            "$sort": {
                sort: direction,
                "type": 1,
                "_id": direction
            }
        },
        {"$skip": skip},
        {"$limit": limit}
    ])

    # Execute the aggregation using asynchronous PyMongo
    cursor = await db[collections[0]].aggregate(
        pipeline,
        collation={"locale": "en"}
    )

    docs = await cursor.to_list(length=limit)

    return [to_item(doc) for doc in docs]


@app.get("/library", response_model=list[TableItem])
async def get_items(
    q: Annotated[Title | None, Query()] = None,
    ids: Annotated[
        list[PyObjectId] | None, Query(max_length=100)
    ] = None,
    tags: Annotated[
        list[PyObjectId] | None, Query(max_length=100)
    ] = None,
    match: Literal["none", "any", "all", "exact"] | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 30,
    skip: Annotated[int, Query(ge=0)] = 0,
    sort: Literal[
        "updated_at", "created_at", "title", "tags"
    ] = "updated_at",
    order: Literal["asc", "desc"] = "desc",
    collections: Annotated[list[str] | None, Query()] = None,
    user: UserPublic = Depends(get_current_user),
):
    return await filtered_list(
        user_id=user.id,
        collections=collections,
        q=q,
        ids=ids,
        tags=tags,
        match=match,
        limit=limit,
        skip=skip,
        sort=sort,
        order=order
    )