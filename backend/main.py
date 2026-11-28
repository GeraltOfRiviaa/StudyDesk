from contextlib import asynccontextmanager
from typing import Annotated, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.auth_config import (
    CSRF_REQUEST_HEADER,
    load_frontend_origins,
    load_jwt_secret,
    load_secure_cookie_flag,
    url_origin,
    validate_trusted_proxy_config,
)
from core.limiter import AuthLimiter
from core.search import filtered_list
from models.users import UserPublic
from models.types import PyObjectId, Title, PaginatedItems
from core.security import get_current_user
from routers import users, notes, tags, links, bulk


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.jwt_secret = load_jwt_secret()
    app.state.auth_cookie_secure = load_secure_cookie_flag()
    validate_trusted_proxy_config()
    app.state.auth_limiter = AuthLimiter()
    yield


async def protect_browser_writes(request: Request, call_next):
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return await call_next(request)

    origins = request.headers.getlist("origin")
    referers = request.headers.getlist("referer")
    allowed_origins = request.app.state.frontend_origins
    if origins:
        allowed = len(origins) == 1 and origins[0] in allowed_origins
    elif referers:
        allowed = len(referers) == 1 and url_origin(referers[0]) in allowed_origins
    else:
        # Direct clients can opt in explicitly. A foreign browser cannot send this header without preflight.
        allowed = request.headers.getlist(CSRF_REQUEST_HEADER) == ["1"]
    if not allowed:
        return JSONResponse({"detail": "Request origin is not allowed."}, status_code=403)
    return await call_next(request)


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


def create_app() -> FastAPI:
    origins = load_frontend_origins()
    app = FastAPI(lifespan=lifespan, swagger_ui_parameters={"persistAuthorization": True})
    app.state.frontend_origins = origins
    app.include_router(users.router)
    app.include_router(notes.router)
    app.include_router(tags.router)
    app.include_router(links.router)
    app.include_router(bulk.router)
    app.get("/library", response_model=PaginatedItems)(get_items)

    app.middleware("http")(protect_browser_writes)
    # CORS wraps the CSRF guard and handlers so their 403 and 429 responses carry CORS headers.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["Authorization", "Content-Type", CSRF_REQUEST_HEADER],
        expose_headers=["Retry-After"],
    )
    return app


load_dotenv()
app = create_app()
