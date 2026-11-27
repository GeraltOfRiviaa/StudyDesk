from bson import ObjectId

from core.collections import ITEM_COLLECTIONS
from database import db


async def delete_account_data(user_id: ObjectId) -> None:
    # Archive and master_tags are older names documented in the database schema.
    collections = (
        "links",
        "containers",
        "form_responses",
        *ITEM_COLLECTIONS.values(),
        "archive",
        "tags",
        "master_tags",
    )
    # Future file storage cleanup belongs before deleting its database metadata.
    for collection in collections:
        await db[collection].delete_many({"user_id": user_id})

    # Standalone MongoDB cannot roll back across collections. Delete the account
    # last so a failed cleanup can be retried with the same session and password.
    await db["users"].delete_one({"_id": user_id})
