from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from core.collections import ITEM_COLLECTIONS
from core.items import delete_item, delete_items, get_item, prepare_item_create, prepare_item_update
from core.notes import to_note
from models.note import NoteCreate, NoteUpdate, NoteListItem, NotePublic
from models.users import UserPublic
from database import db
from core.security import get_account_writer, get_current_user
from typing import Annotated, Literal
from models.types import PyObjectId, Title, TypesEnum
from pymongo import ReturnDocument
from core.search import ItemSort, TagMatch, filtered_list


router = APIRouter(prefix="/notes", tags=["Notes"])
notes_collection = db[ITEM_COLLECTIONS[TypesEnum.note]]




# Create note

@router.post(path='/', status_code=201)
async def create_note(note: NoteCreate, user: UserPublic = Depends(get_account_writer)):
    doc = await prepare_item_create(user.id, note.title, note.tags)
    doc["content"] = note.content
    result = await notes_collection.insert_one(doc)
    return {"inserted_id": str(result.inserted_id)}


########################################################


# Get one note

@router.get(path='/{note_id}', status_code=200, response_model=NotePublic)
async def get_note(note_id: PyObjectId, user: UserPublic = Depends(get_current_user)):

    result = await get_item(user.id, TypesEnum.note, note_id, not_found_detail="Note not found")
    return to_note(result)


########################################################


# Get all notes filtered by tags + specified 
# ids (usefull when pinning a note or for single view) 

@router.get(path='/', status_code=200, response_model=list[NoteListItem])
async def filtered_list_notes(
    q: Annotated[Title | None, Query()] = None,
    ids: Annotated[list[PyObjectId] | None, Query(max_length=100)] = None,
    tags: Annotated[list[PyObjectId] | None, Query(max_length=100)] = None,
    match: TagMatch | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: str | None = None,
    sort: ItemSort = "updated_at",
    order: Literal["asc", "desc"] = "desc",
    user: UserPublic = Depends(get_current_user),
):
    result =  await filtered_list(
            user_id=user.id,
            collections=["notes"],
            q=q,
            ids=ids,
            tags=tags,
            match=match,
            limit=limit,
            cursor=cursor,
            sort=sort,
            order=order
        )
    return result.items


########################################################


# Update note
@router.patch(path='/{note_id}', status_code=200, response_model=NotePublic)
async def update_note(note_id: PyObjectId, data: NoteUpdate, user: UserPublic = Depends(get_account_writer)):
    changes = await prepare_item_update(user.id, data)
    # Match the owner and return the updated Note in the same database operation.
    result = await notes_collection.find_one_and_update(
        {"_id": ObjectId(note_id), "user_id": ObjectId(user.id)},
        {"$set": changes},
        return_document=ReturnDocument.AFTER,
    )

    if result is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return to_note(result)
########################################################


# Delete a note

@router.delete("/{note_id}", status_code=200)
async def delete_note(
    note_id: PyObjectId,
    user: UserPublic = Depends(get_account_writer),
):
    deleted = await delete_item(user.id, TypesEnum.note, note_id, not_found_detail="Note not found")
    return {"deleted": deleted}


########################################################


# Delete listed notes

@router.delete("/", status_code=200)
async def delete_listed_notes(
    ids: Annotated[
        list[PyObjectId],
        Query(min_length=1, max_length=100)
    ],
    user: UserPublic = Depends(get_account_writer),
):
    deleted = await delete_items(user.id, TypesEnum.note, ids)
    return {"deleted": deleted}
