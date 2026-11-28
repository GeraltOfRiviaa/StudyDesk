from collections.abc import Collection
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException
from pydantic import BaseModel

from core.collections import ITEM_COLLECTIONS
from core.links import delete_item_links
from core.tags import validate_tag_ids
from database import db
from models.types import PyObjectId, Tags, Title, TypesEnum


def owned_items_query(user_id: PyObjectId, ids: Collection[ObjectId]) -> dict:
    return {"user_id": ObjectId(user_id), "_id": {"$in": list(ids)}}


async def get_item(
    user_id: PyObjectId,
    item_type: TypesEnum,
    item_id: PyObjectId,
    *,
    not_found_detail: str = "Item not found",
) -> dict:
    doc = await db[ITEM_COLLECTIONS[item_type]].find_one({
        "_id": ObjectId(item_id),
        "user_id": ObjectId(user_id),
    })
    if doc is None:
        raise HTTPException(status_code=404, detail=not_found_detail)
    return doc


async def _prepare_item_tags(user_id: PyObjectId, tags: Tags) -> list[ObjectId]:
    await validate_tag_ids(user_id, tags)
    # Normalize hex casing and keep the client's tag order.
    return list(dict.fromkeys(ObjectId(tag) for tag in tags))


async def prepare_item_create(user_id: PyObjectId, title: Title, tags: Tags) -> dict:
    tag_ids = await _prepare_item_tags(user_id, tags)
    now = datetime.now(timezone.utc)
    return {
        "user_id": ObjectId(user_id),
        "title": title,
        "tags": tag_ids,
        "created_at": now,
        "updated_at": now,
    }


async def prepare_item_update(user_id: PyObjectId, data: BaseModel) -> dict:
    changes = data.model_dump(
        exclude_unset=True,
        exclude={"_id", "id", "user_id", "created_at", "updated_at"},
    )
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to update")

    # Omitted tags leave the stored array intact. An empty array clears it.
    if "tags" in changes:
        if changes["tags"] is None:
            raise HTTPException(status_code=400, detail="Invalid tag ids")
        changes["tags"] = await _prepare_item_tags(user_id, changes["tags"])

    changes["updated_at"] = datetime.now(timezone.utc)
    return changes


async def prepare_item_deletion(
    user_id: PyObjectId, item_type: TypesEnum, item_ids: Collection[ObjectId]
) -> set[ObjectId]:
    projection = {"_id": 1}
    if item_type == TypesEnum.file:
        projection["storage_path"] = 1

    docs = await db[ITEM_COLLECTIONS[item_type]].find(
        owned_items_query(user_id, item_ids), projection
    ).to_list()
    owned_ids = {doc["_id"] for doc in docs}

    # TODO: Delete the physical file before removing its metadata once storage is implemented.
    if item_type == TypesEnum.file and any(doc.get("storage_path") for doc in docs):
        raise HTTPException(status_code=409, detail="Files with a storage path cannot be deleted yet.")

    if item_type == TypesEnum.form and owned_ids:
        # A response may have its own user_id. Check existence through the owned form IDs.
        # TODO: Remove associated Form responses before deleting their parent Forms.
        response = await db["form_responses"].find_one(
            {"form_id": {"$in": list(owned_ids)}}, {"_id": 1}
        )
        if response is not None:
            raise HTTPException(status_code=409, detail="Forms with responses cannot be deleted yet.")

    return owned_ids


async def delete_items(
    user_id: PyObjectId,
    item_type: TypesEnum,
    item_ids: Collection[PyObjectId | ObjectId],
    *,
    preflighted: bool = False,
) -> int:
    ids = {ObjectId(item_id) for item_id in item_ids}
    # Bulk deletion passes owned IDs after checking every group's dependencies.
    if ids and not preflighted:
        ids = await prepare_item_deletion(user_id, item_type, ids)
    if not ids:
        return 0

    # Delete links first so an interrupted write leaves items available for a retry.
    # Some surviving items may already have lost links if the document write fails.
    await delete_item_links(user_id, item_type, ids)
    result = await db[ITEM_COLLECTIONS[item_type]].delete_many(owned_items_query(user_id, ids))
    return result.deleted_count


async def delete_item(
    user_id: PyObjectId,
    item_type: TypesEnum,
    item_id: PyObjectId,
    *,
    not_found_detail: str = "Item not found",
) -> int:
    deleted = await delete_items(user_id, item_type, [item_id])
    if not deleted:
        raise HTTPException(status_code=404, detail=not_found_detail)
    return deleted
