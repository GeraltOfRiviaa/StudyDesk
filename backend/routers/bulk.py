from fastapi import APIRouter, Depends

from core.security import get_account_writer
from models.users import UserPublic

from models.bulk import (
    BulkRequest,
    BulkAddTagsRequest,
    BulkDeleteResult,
    BulkUpdateResult,
    BulkUnlinkResult,
)

from core.bulk import (
    bulk_add_tags,
    bulk_delete,
    bulk_remove_tags,
    bulk_remove_links,
)


router = APIRouter(
    prefix="/bulk",
    tags=["Bulk actions"]
)


@router.post("/delete", response_model=BulkDeleteResult)
async def delete_selected_items(
    data: BulkRequest,
    user: UserPublic = Depends(get_account_writer),
):
    return await bulk_delete(user.id, data.items)


@router.post(
    "/tags/add",
    response_model=BulkUpdateResult
)
async def add_tags(
    data: BulkAddTagsRequest,
    user: UserPublic = Depends(get_account_writer),
):
    return await bulk_add_tags(
        user.id,
        data.items,
        data.tags
    )


@router.post(
    "/tags/remove",
    response_model=BulkUpdateResult
)
async def remove_tags(
    data: BulkRequest,
    user: UserPublic = Depends(get_account_writer),
):
    return await bulk_remove_tags(
        user.id,
        data.items
    )


@router.post(
    "/links/remove",
    response_model=BulkUnlinkResult
)
async def remove_links(
    data: BulkRequest,
    user: UserPublic = Depends(get_account_writer),
):
    return await bulk_remove_links(
        user.id,
        data.items
    )
