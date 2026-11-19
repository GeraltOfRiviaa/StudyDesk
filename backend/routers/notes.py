from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from models.note import NoteCreate, NoteDB, NoteUpdate, NoteListItem, NotePublic
from models.users import  UserPublic
from database import db
from core.security import get_current_user
from typing import Annotated, Any, Literal
from models.types import PyObjectId, Title
from pymongo import ReturnDocument
import re

router = APIRouter(prefix="/notes", tags=["Notes"])
notes_collection = db["notes"]

########################################################


# Transfer note result from queries to NoteDB class

def to_note(doc: dict) -> NotePublic:
    return NotePublic(
        id=str(doc["_id"]),
        title=doc["title"],
        content=str(doc["content"]),
        tags=[str(t) for t in doc["tags"]],
        created_at=doc["created_at"],
        updated_at=doc["updated_at"],
    )
    
def to_note_item(doc: dict) -> NoteListItem:
    return NoteListItem(
            id=str(doc["_id"]),
            title=doc["title"],
            tags=[str(t) for t in doc["tags"]],
            created_at=doc["created_at"],
            updated_at=doc["updated_at"],
        )


########################################################


# Create note

@router.post(path='/', status_code=201)
async def create_note(note: NoteCreate, user: UserPublic = Depends(get_current_user)):
    uid = ObjectId(user.id)
    now = datetime.now(timezone.utc) 
    doc = {
        "user_id": uid, 
        "title": note.title, 
        "content": note.content, 
        "tags": [ObjectId(t) for t in note.tags],
        "created_at": now, 
        "updated_at": now
            }

    result = await notes_collection.insert_one(doc)
    return {"inserted_id": str(result.inserted_id)}


########################################################


# Get one note

@router.get(path='/{note_id}', status_code=200, response_model=NotePublic)
async def get_note(note_id: PyObjectId, user: UserPublic = Depends(get_current_user)):

    result = await notes_collection.find_one({"_id": ObjectId(note_id), "user_id": ObjectId(user.id)})
    
    if not result:
        raise HTTPException(status_code=404, detail="Note not found")
    
    return to_note(result)


########################################################


# Get all notes filtered by tags + specified 
# ids (usefull when pinning a note or for single view) 

@router.get(path='/', status_code=200, response_model=list[NoteListItem])
async def filtered_list_notes(
    q: Annotated[Title | None, Query()] = None,
    ids: Annotated[list[PyObjectId] | None, Query(max_length=100)] = None,
    tags: Annotated[list[PyObjectId] | None, Query(max_length=100)] = None,
    match: Literal["none", "any", "all", "exact"] | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    skip: Annotated[int, Query(ge=0)] = 0,
    sort: Literal["updated_at", "created_at", "title", "tags"] = "updated_at",
    order: Literal["asc", "desc"] = "desc",
    user: UserPublic = Depends(get_current_user),
):
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
    notes_collection.find(query, {"content": 0})
        .collation({"locale": "en"})
        .sort([(sort, direction), ("_id", direction)])
        .skip(skip)
        .limit(limit)
        .to_list(length=limit)
    )
        
    return [to_note_item(d) for d in docs]


########################################################


# Update note
@router.patch(path='/{note_id}', status_code=200, response_model=NoteDB)
async def update_note(note_id: PyObjectId, data: NoteUpdate, user: UserPublic = Depends(get_current_user)):
    #Build the update from only the fields the client sent.
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to update")
    #Convert special fields
    if "tags" in changes:
        changes["tags"] = [ObjectId(t) for t in changes["tags"]]
    
    #Set updated_at
    changes["updated_at"] = datetime.now(timezone.utc)
    #Update with one query
    result = await notes_collection.find_one_and_update(
    {"_id": ObjectId(note_id), "user_id": ObjectId(user.id)},
    {"$set": changes},
    return_document=ReturnDocument.AFTER,
    )   
    
    #If the result is None, raise 404
    if result is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return to_note(result)
########################################################


# Delete a note

@router.delete(path='/{note_id}', status_code=200)
async def delete_note(note_id: PyObjectId, user: UserPublic = Depends(get_current_user)):
    
    result = await notes_collection.delete_one({"_id": ObjectId(note_id), "user_id": ObjectId(user.id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"deleted": result.deleted_count}


########################################################


# Delete listed notes

@router.delete("/", status_code=200)
async def delete_listed_notes(ids: Annotated[list[PyObjectId], Query(min_length=1, max_length=100)], user: UserPublic = Depends(get_current_user)):
    ids = list(set(ids))
    
    result = await notes_collection.delete_many(
        {"_id": {"$in": [ObjectId(i) for i in ids]}, "user_id": ObjectId(user.id)}
    )
    return {"deleted": result.deleted_count}