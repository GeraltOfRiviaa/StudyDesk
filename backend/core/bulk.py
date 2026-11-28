import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException
from pymongo.errors import PyMongoError

from core.collections import ITEM_COLLECTIONS
from core.items import delete_items, owned_items_query, prepare_item_deletion
from core.links import item_links_query
from core.tags import validate_tag_ids
from database import db
from models.bulk import BulkDeleteResult, BulkItem, BulkUnlinkResult, BulkUpdateResult
from models.types import MAX_TAGS_PER_ITEM, PyObjectId, TypesEnum


logger = logging.getLogger(__name__)


def group_items(items: list[BulkItem]) -> dict[TypesEnum, set[ObjectId]]:
    grouped: dict[TypesEnum, set[ObjectId]] = {}
    for item in items:
        grouped.setdefault(item.type, set()).add(ObjectId(item.id))
    return grouped


async def validate_items(user_id: str, grouped: dict[TypesEnum, set[ObjectId]]) -> None:
    for item_type, ids in grouped.items():
        collection = db[ITEM_COLLECTIONS[item_type]]
        count = await collection.count_documents(owned_items_query(user_id, ids))
        if count != len(ids):
            raise HTTPException(status_code=404, detail="One or more items not found")


def _completed_targets(item_type: TypesEnum, ids: set[ObjectId]) -> list[dict[str, str]]:
    return [{"type": item_type.value, "id": str(item_id)} for item_id in sorted(ids)]


def _bulk_failure(
    operation: str, user_id: str, completed: list[dict[str, str]], writing: bool, **counts: int
) -> HTTPException:
    logger.exception("Bulk %s interrupted for user %s", operation, user_id)
    message = (
        f"Bulk {operation} was interrupted. The failed write may have applied. Retry the unfinished targets."
        if writing else f"Could not validate bulk {operation}. No changes were made."
    )
    return HTTPException(status_code=503, detail={"message": message, "completed_items": completed, **counts})


async def bulk_delete(user_id: PyObjectId, items: list[BulkItem]) -> BulkDeleteResult:
    grouped = group_items(items)
    deleted = 0
    completed = []
    writing = False
    try:
        # Check all groups before writing so a dependency conflict leaves the batch intact.
        owned_groups = {}
        for item_type, ids in grouped.items():
            owned_groups[item_type] = await prepare_item_deletion(user_id, item_type, ids)

        writing = True
        for item_type, ids in owned_groups.items():
            deleted += await delete_items(user_id, item_type, ids, preflighted=True)
            # Already unavailable IDs are resolved too, but only acknowledged deletions count as changes.
            completed.extend(_completed_targets(item_type, grouped[item_type]))
    except PyMongoError:
        raise _bulk_failure("deletion", user_id, completed, writing, deleted=deleted) from None

    # An unavailable ID looks the same whether it is missing or belongs to another user.
    requested = sum(len(ids) for ids in grouped.values())
    return BulkDeleteResult(deleted=deleted, skipped=requested - deleted)


async def _check_tag_capacity(
    user_id: str, grouped: dict[TypesEnum, set[ObjectId]], tag_ids: list[ObjectId]
) -> None:
    for item_type, ids in grouped.items():
        collection = db[ITEM_COLLECTIONS[item_type]]
        query = owned_items_query(user_id, ids)
        if await collection.count_documents({**query, "$expr": {"$not": [{"$isArray": "$tags"}]}}):
            raise HTTPException(status_code=409, detail="An item has an invalid tag array")

        # $addToSet leaves existing duplicates in place, so count the actual array entries.
        resulting_size = {
            "$add": [{"$size": "$tags"}, {"$size": {"$setDifference": [tag_ids, "$tags"]}}],
        }
        if await collection.count_documents({**query, "$expr": {"$gt": [resulting_size, MAX_TAGS_PER_ITEM]}}):
            raise HTTPException(status_code=400, detail="An item would exceed the tag limit")


async def bulk_add_tags(user_id: PyObjectId, items: list[BulkItem], tags: list[PyObjectId]) -> BulkUpdateResult:
    return await _change_tags(user_id, items, tags)


async def bulk_remove_tags(user_id: PyObjectId, items: list[BulkItem]) -> BulkUpdateResult:
    return await _change_tags(user_id, items, None)


async def _change_tags(
    user_id: PyObjectId, items: list[BulkItem], tags: list[PyObjectId] | None
) -> BulkUpdateResult:
    grouped = group_items(items)
    completed = []
    matched = 0
    modified = 0
    writing = False
    operation = "tag clearing" if tags is None else "tag assignment"

    try:
        # The router holds the account lock across ownership, capacity checks and every write.
        await validate_items(user_id, grouped)
        now = datetime.now(timezone.utc)
        if tags is None:
            condition = {"$ne": []}
            changes = {"$set": {"tags": [], "updated_at": now}}
        else:
            tag_ids = await validate_tag_ids(user_id, tags)
            await _check_tag_capacity(user_id, grouped, tag_ids)
            condition = {"$not": {"$all": tag_ids}}
            changes = {"$addToSet": {"tags": {"$each": tag_ids}}, "$set": {"updated_at": now}}

        writing = True
        for item_type, ids in grouped.items():
            # Skip no-op writes so retries do not advance timestamps or inflate modified counts.
            query = {**owned_items_query(user_id, ids), "tags": condition}
            result = await db[ITEM_COLLECTIONS[item_type]].update_many(query, changes)
            modified += result.modified_count
            matched += len(ids)
            completed.extend(_completed_targets(item_type, ids))
    except PyMongoError:
        raise _bulk_failure(operation, user_id, completed, writing, matched=matched, modified=modified) from None

    return BulkUpdateResult(matched=matched, modified=modified)


async def bulk_remove_links(user_id: PyObjectId, items: list[BulkItem]) -> BulkUnlinkResult:
    grouped = group_items(items)
    writing = False
    try:
        await validate_items(user_id, grouped)
        conditions = [
            condition
            for item_type, ids in grouped.items()
            for condition in item_links_query(user_id, item_type, ids)["$or"]
        ]
        writing = True
        result = await db["links"].delete_many({"user_id": ObjectId(user_id), "$or": conditions})
        return BulkUnlinkResult(deleted=result.deleted_count)
    except PyMongoError:
        # This operation uses one command. A failed response cannot confirm any individual target.
        raise _bulk_failure("link removal", user_id, [], writing, deleted=0) from None
