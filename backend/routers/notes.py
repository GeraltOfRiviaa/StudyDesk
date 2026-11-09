from fastapi import APIRouter, Depends
from models.note import NoteCreate
from database import db
from core.security import get_current_user

router = APIRouter(prefix="/notes")
users = db["notes"]

@router.post(path='/create')
async def create_note(note: NoteCreate, user: dict = Depends(get_current_user)):
    return {"yeah probably a note"}