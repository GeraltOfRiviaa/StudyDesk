from bson import ObjectId
from fastapi import HTTPException

from core.collections import ITEM_COLLECTIONS
from models.link import LinkBase, LinkPublic
from database import db
from models.types import PyObjectId, TypesEnum

links_collection = db["links"]

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

########################################################


def to_link(doc: dict) -> LinkPublic:
    return LinkPublic(
        id=str(doc["_id"]),
        user_id=str(doc["user_id"]),
        item_a_id=str(doc["item_a_id"]),
        item_a_type=doc["item_a_type"],
        item_b_id=str(doc["item_b_id"]),
        item_b_type=doc["item_b_type"],
        created_at=doc["created_at"],
    )


########################################################


# Helper - check that an item exists and belongs to the user

async def validate_item(
    user_id: str,
    item_type: TypesEnum,
    item_id: PyObjectId,
):
    collection = db[ITEM_COLLECTIONS[item_type]]

    result = await collection.find_one({
        "_id": ObjectId(item_id),
        "user_id": ObjectId(user_id),
    })

    if result is None:
        raise HTTPException(status_code=404, detail="Item not found")

    return result


########################################################


# Helper - normalize link direction so A-B and B-A are identical

def normalize_link(link: LinkBase) -> dict:
    a = (link.item_a_type.value, link.item_a_id)
    b = (link.item_b_type.value, link.item_b_id)

    if a > b:
        a, b = b, a

    return {
        "item_a_type": a[0],
        "item_a_id": ObjectId(a[1]),
        "item_b_type": b[0],
        "item_b_id": ObjectId(b[1]),
    }


########################################################


# F2 - helper: check whether two items are already linked

async def link_exists(user_id: str, link: LinkBase) -> bool:
    pair = normalize_link(link)

    result = await links_collection.find_one({
        "user_id": ObjectId(user_id),
        "$or": [
            pair,
            {
                "item_a_type": pair["item_b_type"],
                "item_a_id": pair["item_b_id"],
                "item_b_type": pair["item_a_type"],
                "item_b_id": pair["item_a_id"],
            },
        ],
    })

    return result is not None



########################################################