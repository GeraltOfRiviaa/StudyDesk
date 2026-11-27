from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from database import db
from core.collections import ITEM_COLLECTIONS
from models.types import PyObjectId, TypesEnum
from models.bulk import (
    BulkItem,
    BulkUpdateResult,
    BulkUnlinkResult,
)
from core.tags import validate_tag_ids


# Group selected item IDs by their type
def group_items(items: list[BulkItem]):
    grouped: dict[TypesEnum, set[ObjectId]] = {}

    for item in items:
        grouped.setdefault(item.type, set()).add(
            ObjectId(item.id)
        )

    return grouped


# Build a query for selected items owned by the user
def owned_items_query(user_id, ids):
    return {
        "user_id": ObjectId(user_id),
        "_id": {"$in": list(ids)},
    }


# Check that all selected items belong to the user
async def validate_items(user_id, grouped):
    for item_type, ids in grouped.items():
        collection = db[ITEM_COLLECTIONS[item_type]]

        count = await collection.count_documents(
            owned_items_query(user_id, ids)
        )

        if count != len(ids):
            raise HTTPException(
                status_code=404,
                detail="One or more items not found"
            )


# Add tags to selected items without duplicates
async def bulk_add_tags(
    user_id: PyObjectId,
    items: list[BulkItem],
    tags: list[PyObjectId],
) -> BulkUpdateResult:

    grouped = group_items(items)

    await validate_items(user_id, grouped)
    await validate_tag_ids(user_id, tags)

    tag_ids = list({ObjectId(tag) for tag in tags})
    now = datetime.now(timezone.utc)

    matched = 0
    modified = 0

    # Ensure the resulting tag arrays won't exceed
    # the existing maximum of 100 tags per item
    for item_type, ids in grouped.items():
        collection = db[ITEM_COLLECTIONS[item_type]]

        query = owned_items_query(user_id, ids)

        query["$expr"] = {
            "$gt": [
                {
                    "$size": {
                        "$setUnion": ["$tags", tag_ids]
                    }
                },
                100
            ]
        }

        if await collection.count_documents(query):
            raise HTTPException(
                status_code=400,
                detail="An item would exceed the tag limit"
            )

    for item_type, ids in grouped.items():
        collection = db[ITEM_COLLECTIONS[item_type]]

        result = await collection.update_many(
            owned_items_query(user_id, ids),
            {
                "$addToSet": {
                    "tags": {"$each": tag_ids}
                },
                "$set": {
                    "updated_at": now
                }
            }
        )

        matched += result.matched_count
        modified += result.modified_count

    return BulkUpdateResult(
        matched=matched,
        modified=modified
    )


# Remove all tags from selected items
async def bulk_remove_tags(
    user_id: PyObjectId,
    items: list[BulkItem],
) -> BulkUpdateResult:

    grouped = group_items(items)

    await validate_items(user_id, grouped)

    now = datetime.now(timezone.utc)

    matched = 0
    modified = 0

    for item_type, ids in grouped.items():
        collection = db[ITEM_COLLECTIONS[item_type]]

        result = await collection.update_many(
            owned_items_query(user_id, ids),
            {
                "$set": {
                    "tags": [],
                    "updated_at": now
                }
            }
        )

        matched += result.matched_count
        modified += result.modified_count

    return BulkUpdateResult(
        matched=matched,
        modified=modified
    )


# Remove all links involving selected items
async def bulk_remove_links(
    user_id: PyObjectId,
    items: list[BulkItem],
) -> BulkUnlinkResult:

    grouped = group_items(items)

    await validate_items(user_id, grouped)

    conditions = []

    # Check both sides of every link
    for item_type, ids in grouped.items():
        conditions.extend([
            {
                "item_a_type": item_type.value,
                "item_a_id": {"$in": list(ids)}
            },
            {
                "item_b_type": item_type.value,
                "item_b_id": {"$in": list(ids)}
            }
        ])

    result = await db["links"].delete_many({
        "user_id": ObjectId(user_id),
        "$or": conditions
    })

    return BulkUnlinkResult(
        deleted=result.deleted_count
    )