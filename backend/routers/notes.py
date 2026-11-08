from fastapi import APIRouter
from models.note import NoteCreate
from database import db

router = APIRouter(prefix="notes")
users = db["notes"]

@router.post(path='/create', response_model=NoteCreate)
async def create_note(note: NoteCreate):
    pass