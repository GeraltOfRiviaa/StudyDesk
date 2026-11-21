
from datetime import datetime, timezone
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import DuplicateKeyError

from models.link import LinkBase, LinkPublic
from models.users import UserPublic
from models.types import PyObjectId, TypesEnum
from database import db
from core.security import get_current_user

import re


router = APIRouter(prefix="/links", tags=["Links"])
links_collection = db["links"]

# Map TypesEnum values to MongoDB collections
ITEM_COLLECTIONS = {
    TypesEnum.note: "notes",
    TypesEnum.archive: "archive",
    TypesEnum.event: "events",
    TypesEnum.form: "forms",
}

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


# Helper - find links connected to a particular item
# check on both sides 

def item_links_query(
    user_id: str,
    item_type: TypesEnum,
    item_id: PyObjectId,
) -> dict:
    return {
        "user_id": ObjectId(user_id),
        "$or": [
            {
                "item_a_id": ObjectId(item_id),
                "item_a_type": item_type.value,
            },
            {
                "item_b_id": ObjectId(item_id),
                "item_b_type": item_type.value,
            },
        ],
    }


########################################################


# Helper - delete all links associated with an item
# Call this from the item's DELETE route

async def delete_item_links(
    user_id: str,
    item_type: TypesEnum,
    item_id: PyObjectId,
):
    result = await links_collection.delete_many(
        item_links_query(user_id, item_type, item_id)
    )

    return result.deleted_count


########################################################


# Search available items for autocomplete
# Can exclude the source item and already linked items


@router.get("/items", status_code=200)
async def search_link_items(
    q: Annotated[str, Query(min_length=1, max_length=150)],
    item_type: TypesEnum | None = None,
    source_type: TypesEnum | None = None,
    source_id: PyObjectId | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    user: UserPublic = Depends(get_current_user),
):
    uid = ObjectId(user.id)

    # Both source parameters must be provided together
    if (source_type is None) != (source_id is None):
        raise HTTPException(
            status_code=422,
            detail="source_type and source_id must be provided together",
        )

    excluded = set()

    # Exclude the source item and items already linked to it
    if source_type and source_id:
        await validate_item(user.id, source_type, source_id)

        source = (source_type.value, source_id)
        excluded.add(source)

        docs = await links_collection.find(
            item_links_query(user.id, source_type, source_id)
        ).to_list(length=None)

        for link in docs:
            a = (link["item_a_type"], str(link["item_a_id"]))
            b = (link["item_b_type"], str(link["item_b_id"]))

            excluded.add(b if a == source else a)

    # Search one specified type or all types
    selected_types = (
        [item_type] if item_type is not None
        else list(TypesEnum)
    )

    results = []

    for selected_type in selected_types:
        collection = db[ITEM_COLLECTIONS[selected_type]]

        # Exclude linked items directly in MongoDB
        excluded_ids = [
            ObjectId(item_id)
            for excluded_type, item_id in excluded
            if excluded_type == selected_type.value
        ]

        query = {
            "user_id": uid,
            "title": {
                "$regex": re.escape(q),
                "$options": "i",
            },
            "_id": {"$nin": excluded_ids},
        }

        # MongoDB filters, sorts and limits the results
        docs = await (
            collection.find(query, {"title": 1})
            .sort("title", 1)
            .limit(limit)
            .to_list(length=limit)
        )

        for doc in docs:
            results.append({
                "id": str(doc["_id"]),
                "type": selected_type.value,
                "title": doc["title"],
            })

    # Sort results from all collections together
    results.sort(key=lambda item: item["title"].casefold())

    return results[:limit]



########################################################


# F1 - get all links connected to an item
# Returns linked item titles for the frontend

@router.get("/{item_type}/{item_id}", status_code=200)
async def get_item_links(
    item_type: TypesEnum,
    item_id: PyObjectId,
    user: UserPublic = Depends(get_current_user),
):
    await validate_item(user.id, item_type, item_id)

    docs = await links_collection.find(
        item_links_query(user.id, item_type, item_id)
    ).to_list(length=None)

    results = []

    
    for link in docs:
        # identify which side contains the requested item and retrieve the opposite side.
        if (link["item_a_type"] == item_type.value and str(link["item_a_id"]) == item_id):
            linked_type = TypesEnum(link["item_b_type"])
            linked_id = link["item_b_id"]
        else:
            linked_type = TypesEnum(link["item_a_type"])
            linked_id = link["item_a_id"]

        # search the linked items collection
        collection = db[ITEM_COLLECTIONS[linked_type]]

        linked_item = await collection.find_one(
            {
                "_id": linked_id,
                "user_id": ObjectId(user.id),
            },
            {"title": 1},
        )

        # if the itema are not in their collection do not append them to the result
        if linked_item is None:
            continue

        results.append({
            "link_id": str(link["_id"]),
            "item_id": str(linked_id),
            "item_type": linked_type.value,
            "title": linked_item["title"],
        })

    return results


########################################################


# A1 - create a link between two items

@router.post("/", status_code=201, response_model=LinkPublic)
async def create_link(
    link: LinkBase,
    user: UserPublic = Depends(get_current_user),
):
    # Check existence and ownership of both items
    await validate_item(
        user.id, link.item_a_type, link.item_a_id
    )

    await validate_item(
        user.id, link.item_b_type, link.item_b_id
    )

    # Prevent duplicate connections
    if await link_exists(user.id, link):
        raise HTTPException(
            status_code=409,
            detail="Items are already linked",
        )

    now = datetime.now(timezone.utc)

    doc = {
        "user_id": ObjectId(user.id),
        # unpack the dict normalize_link gives back
        **normalize_link(link),
        "created_at": now,
    }

    try:
        result = await links_collection.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail="Items are already linked",
        )

    doc["_id"] = result.inserted_id

    return to_link(doc)


########################################################


# D1 - delete a link by its ID

@router.delete("/{link_id}", status_code=200)
async def delete_link(
    link_id: PyObjectId,
    user: UserPublic = Depends(get_current_user),
):
    result = await links_collection.delete_one({
        "_id": ObjectId(link_id),
        "user_id": ObjectId(user.id),
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=404,
            detail="Link not found",
        )

    return {"deleted": result.deleted_count}


########################################################
