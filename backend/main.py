import re
from typing import Annotated, Literal

from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware

from core.search import filtered_list
from models.users import UserPublic
from models.types import PyObjectId, Title, PaginatedItems
from routers import users, notes, tags, links
from core.security import get_current_user
from routers import users, notes, tags, links, bulk


app = FastAPI(
    swagger_ui_parameters={"persistAuthorization": True}
)

app.include_router(users.router)
app.include_router(notes.router)
app.include_router(tags.router)
app.include_router(links.router)
app.include_router(bulk.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://fluffy-acorn-pjrx79rpv469hrrw7-5173.app.github.dev"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/library", response_model=PaginatedItems)
async def get_items(
    q: Annotated[Title | None, Query()] = None,
    ids: Annotated[
        list[PyObjectId] | None, Query(max_length=100)
    ] = None,
    tags: Annotated[
        list[PyObjectId] | None, Query(max_length=100)
    ] = None,
    match: Literal["none", "any", "all", "exact"] | None = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 30,
    cursor: str | None = None,
    sort: Literal[
        "updated_at", "created_at", "title", "tags"
    ] = "updated_at",
    order: Literal["asc", "desc"] = "desc",
    collections: Annotated[list[str] | None, Query()] = None,
    user: UserPublic = Depends(get_current_user),
):
    return await filtered_list(
        user_id=user.id,
        collections=collections,
        q=q,
        ids=ids,
        tags=tags,
        match=match,
        limit=limit,
        cursor=cursor,
        sort=sort,
        order=order
    )
