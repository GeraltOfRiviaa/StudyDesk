from fastapi import APIRouter, Depends
from backend.core.security import get_current_user
from backend.models.users import UserDB
from database import db
from models.note import NoteDB
from models.types import PyObjectId
from bson import ObjectId

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/all", response_model=list[NoteDB])
async def get_all_notes(current_user: UserDB = Depends(get_current_user)):
    '''Get all notes of a user'''
    return await db.notes.find({"user_id" : ObjectId(id)}).to_list(length=100)