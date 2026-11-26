from bson import ObjectId

from database import db
from models.types import PyObjectId, TypesEnum


def item_links_query(
    user_id: str,
    item_type: TypesEnum,
    item_ids: list[PyObjectId],
) -> dict:

    ids = [ObjectId(i) for i in item_ids]

    return {
        "user_id": ObjectId(user_id),
        "$or": [
            {
                "item_a_id": {"$in": ids},
                "item_a_type": item_type.value,
            },
            {
                "item_b_id": {"$in": ids},
                "item_b_type": item_type.value,
            },
        ],
    }


async def delete_item_links(
    user_id: str,
    item_type: TypesEnum,
    item_ids: list[PyObjectId],
) -> int:

    result = await db["links"].delete_many(
        item_links_query(user_id, item_type, item_ids)
    )

    return result.deleted_count