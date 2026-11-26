from fastapi import APIRouter, Depends

from core.security import get_current_user
from models.users import UserPublic

from models.bulk import (
    BulkRequest,
    BulkAddTagsRequest,
    BulkUpdateResult,
    BulkUnlinkResult,
)

from core.bulk import (
    bulk_add_tags,
    bulk_remove_tags,
    bulk_remove_links,
)


router = APIRouter(
    prefix="/bulk",
    tags=["Bulk actions"]
)


@router.post(
    "/tags/add",
    response_model=BulkUpdateResult
)
async def add_tags(
    data: BulkAddTagsRequest,
    user: UserPublic = Depends(get_current_user),
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
    user: UserPublic = Depends(get_current_user),
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
    user: UserPublic = Depends(get_current_user),
):
    return await bulk_remove_links(
        user.id,
        data.items
    )