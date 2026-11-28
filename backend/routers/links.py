
from datetime import datetime, timezone
from typing import Annotated

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.errors import DuplicateKeyError

from models.link import LinkBase, LinkDeleted, LinkedItem, LinkObjectId, LinkPublic, LinkSearchItem
from models.users import UserPublic
from models.types import TypesEnum
from database import db
from core.security import get_account_writer, get_current_user
from core.items import get_item
from core.indexes import LINK_PAIR_KEYS
from core.links import item_links_query, link_exists, normalize_link, to_link

import re
from core.collections import ITEM_COLLECTIONS


router = APIRouter(prefix="/links", tags=["Links"])
links_collection = db["links"]




# Search available items for autocomplete
# Can exclude the source item and already linked items


@router.get("/items", status_code=200, response_model=list[LinkSearchItem])
async def search_link_items(
    q: Annotated[str, Query(min_length=1, max_length=150)],
    item_type: TypesEnum | None = None,
    source_type: TypesEnum | None = None,
    source_id: LinkObjectId | None = None,
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
        await get_item(user.id, source_type, source_id)

        source = (source_type.value, source_id)
        excluded.add(source)

        docs = await links_collection.find(
            item_links_query(user.id, source_type, [source_id])
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
# to have working LinksSelector

@router.get("/{item_type}/{item_id}", status_code=200, response_model=list[LinkedItem])
async def get_item_links(
    item_type: TypesEnum,
    item_id: LinkObjectId,
    user: UserPublic = Depends(get_current_user),
):
    # validate item we are finding links for
    await get_item(user.id, item_type, item_id)

    # find every link with this item
    docs = await links_collection.find(
        item_links_query(user.id, item_type, [item_id])
    ).to_list(length=None)

    # ids of linked items
    grouped = {}
    
    linked_items = []

    # Identify the opposite side of each link
    for link in docs:
        if (
            link["item_a_type"] == item_type.value
            and link["item_a_id"] == ObjectId(item_id)
        ):
            linked_type = TypesEnum(link["item_b_type"])
            linked_id = link["item_b_id"]
        else:
            linked_type = TypesEnum(link["item_a_type"])
            linked_id = link["item_a_id"]

        # for every type either add linked items if we already
        # created that type in the dict
        # or create a key of that type and an empty set
        grouped.setdefault(linked_type, set()).add(linked_id)

        # add the item object containing link and item id + item type
        linked_items.append({
            "link_id": str(link["_id"]),
            "item_id": str(linked_id),
            "item_type": linked_type.value,
        })

    
    titles = {}

    # fetch all linked items grouped by collection
    for linked_type, ids in grouped.items():
        collection = db[ITEM_COLLECTIONS[linked_type]]

        # make one query containing every item from one collection
        items = await collection.find(
            {
                "_id": {"$in": list(ids)},
                "user_id": ObjectId(user.id),
            },
            {"title": 1},
        ).to_list(length=len(ids))

        # create a title lookup dict
        # ("note", "note2AVDC"): "Mathematics"
        for item in items:
            titles[(linked_type.value, str(item["_id"]))] = item["title"]

    # Combine links with retrieved titles
    results = []

    for item in linked_items:
        key = (item["item_type"], item["item_id"])

        # Skip missing or inaccessible items
        if key not in titles:
            continue

        results.append({
            **item,
            "title": titles[key],
        })

    return results


########################################################


# A1 - create a link between two items

@router.post("/", status_code=201, response_model=LinkPublic)
async def create_link(
    link: LinkBase,
    user: UserPublic = Depends(get_account_writer),
):
    # Check existence and ownership of both items
    await get_item(
        user.id, link.item_a_type, link.item_a_id
    )

    await get_item(
        user.id, link.item_b_type, link.item_b_id
    )

    # Prevent duplicate connections
    pair = normalize_link(link)
    if await link_exists(user.id, pair):
        raise HTTPException(
            status_code=409,
            detail="Items are already linked",
        )

    now = datetime.now(timezone.utc)

    doc = {
        "user_id": ObjectId(user.id),
        **pair,
        "created_at": now,
    }

    try:
        result = await links_collection.insert_one(doc)
    except DuplicateKeyError as error:
        # Only a confirmed pair conflict can be reconciled by the frontend as an existing link.
        pattern = (error.details or {}).get("keyPattern")
        same_pair = pattern == dict(LINK_PAIR_KEYS) or (not pattern and await link_exists(user.id, pair))
        raise HTTPException(
            status_code=409,
            detail="Items are already linked" if same_pair else "Link conflicts with an existing record",
        ) from None

    doc["_id"] = result.inserted_id

    return to_link(doc)


########################################################


# D1 - delete a link by its ID

@router.delete("/{link_id}", status_code=200, response_model=LinkDeleted)
async def delete_link(
    link_id: LinkObjectId,
    user: UserPublic = Depends(get_account_writer),
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
