
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from models.tag import MasterTagsCreate
from database import db
from core.security import get_current_user
from typing import Annotated

router = APIRouter(prefix="/tags")
tags_collection = db["tags"]

@router.post("/", status_code=201)
async def create_tags(tags: list[MasterTagsCreate], user: dict = Depends(get_current_user)):
    uid = ObjectId(user["_id"])
    now = datetime.now(timezone.utc)

    docs = [
        {"user_id": uid, "name": t.name, "color": t.color, "created_at": now, "updated_at": now}
        for t in tags
    ]
    if not docs:
        raise HTTPException(status_code=400, detail="No tags provided")

    result = await tags_collection.insert_many(docs)
    return {"inserted_ids": [str(i) for i in result.inserted_ids]}

@router.delete("/", status_code=201)
async def delete_tags(tags: list[MasterTagsCreate], user: dict = Depends(get_current_user)):
    pass