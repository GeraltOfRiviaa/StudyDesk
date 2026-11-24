from typing import Annotated, Any, Literal

from bson import ObjectId
from fastapi import FastAPI, Depends, HTTPException, Query
from models.users import UserPublic
from models.types import PyObjectId, Title
from database import db
from routers import users, notes, tags, links
from core.security import get_current_user
from fastapi.middleware.cors import CORSMiddleware



app = FastAPI(swagger_ui_parameters={"persistAuthorization": True})
app.include_router(users.router)
app.include_router(notes.router)
app.include_router(tags.router)
app.include_router(links.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://fluffy-acorn-pjrx79rpv469hrrw7-5173.app.github.dev"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def filtered_list(
    q: Annotated[Title | None, Query()] = None,
    ids: Annotated[list[PyObjectId] | None, Query(max_length=100)] = None,
    tags: Annotated[list[PyObjectId] | None, Query(max_length=100)] = None,
    match: Literal["none", "any", "all", "exact"] | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 30,
    skip: Annotated[int, Query(ge=0)] = 0,
    sort: Literal["updated_at", "created_at", "title", "tags"] = "updated_at",
    order: Literal["asc", "desc"] = "desc",
    user: UserPublic = Depends(get_current_user),
    collections: Annotated[list, Literal["library", "notes", "tags", "forms", "events", "files", "all"]] = list("library"),
):

    if "all" in collections:
        notes_collection = db["notes"]
        forms_collection = db["forms"]
        files_collection = db["files"]
        events_collection = db["events"]
        tags_collection = db["tags"]

    else:
        for collection in collections:
            # connect to every collection like this
            # notes_collection = db["notes"]
            pass      

    
    query: dict[str, Any] = {"user_id": ObjectId(user.id)}
    # ids handling (unchanged)
    # tag validation + match branching goes here, before the find
    
    if ids:
        query["_id"] = {"$in": [ObjectId(i) for i in set(ids)]}

    if match == "none" and tags:
        raise HTTPException(status_code=400, detail="tags not allowed with match=none")
    if match in ("any", "all", "exact") and not tags:
        raise HTTPException(status_code=400, detail="tags required for this match")
    if tags and match is None:
        match = "any"

    # Convert the ids from str to ObjectId
    # use set(tags) to remove duplicates
    # if there are no tags then keep the tag_ids empty
    tag_ids = [ObjectId(t) for t in set(tags)] if tags else []
    if match == "none":
        query["tags"] = []
    elif match == "any":
        query["tags"] = {"$in": tag_ids}
    elif match == "all":
        query["tags"] = {"$all": tag_ids}
    elif match == "exact":
        query["tags"] = {"$all": tag_ids, "$size": len(tag_ids)}
        
    if q:
        query["title"] = {"$regex": re.escape(q), "$options": "i"}
    
    direction = 1 if order == "asc" else -1
    docs = await (
    .find(query, {"content": 0})
        .collation({"locale": "en"})
        .sort([(sort, direction), ("_id", direction)])
        .skip(skip)
        .limit(limit)
        .to_list(length=limit)
    )
        
    ]

@app.get("/libray")
async def get_items(user: dict = Depends(get_current_user)):
    pass