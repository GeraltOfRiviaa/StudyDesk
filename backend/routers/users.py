from datetime import datetime, timezone
import logging
from bson import ObjectId
from fastapi import HTTPException, Depends, APIRouter, Cookie, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.routing import APIRoute
from fastapi.security import OAuth2PasswordRequestForm
from pymongo.errors import DuplicateKeyError, PyMongoError
from database import db
from core.accounts import delete_account_data
from core.limiter import limit_by_ip
from core.security import SESSION_DURATION, hash_password, generate_token, auth_user, get_account_writer, get_current_user, verify_password
from models.users import UserChangePassword, UserCreate, UserDelete, UserPublic, UserUpdate
from urllib.parse import urlencode
import secrets
import os
import re


class AuthRoute(APIRoute):
    def get_route_handler(self):
        handle = super().get_route_handler()

        async def handle_auth_request(request: Request):
            try:
                return await handle(request)
            except RequestValidationError as error:
                # Pydantic's input and context can include passwords. Return only field diagnostics.
                detail = [
                    {key: issue[key] for key in ("type", "loc", "msg")}
                    for issue in error.errors()
                ]
                return JSONResponse({"detail": detail}, status_code=422)

        return handle_auth_request


router = APIRouter(prefix="/auth", tags=["Users"], route_class=AuthRoute)
# Keep the postponed OAuth handlers available for inspection without registering their routes.
google_router = APIRouter(prefix="/auth", tags=["Users"])
users_collection = db["users"]
logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
REDIRECT_URI = "http://localhost:8000/auth/google/callback" 
FRONTEND_URL = "http://localhost:5173/dashboard"

########################################################


# Logout

def _auth_cookie_attributes(request: Request) -> dict:
    return {
        "key": "access_token",
        "httponly": True,
        "samesite": "lax",
        "secure": request.app.state.auth_cookie_secure,
        "path": "/",
    }


def _set_auth_cookie(request: Request, response: Response, user: dict) -> None:
    response.set_cookie(
        **_auth_cookie_attributes(request),
        value=generate_token(user, request.app.state.jwt_secret),
        max_age=int(SESSION_DURATION.total_seconds()),
    )


@router.post("/logout")
async def logout(request: Request, response: Response):
    response.delete_cookie(**_auth_cookie_attributes(request))
    return {"ok": True}


########################################################


# Register

@router.post("/register", response_model=UserPublic, status_code=201, dependencies=[Depends(limit_by_ip("register"))])
async def register(data: UserCreate):
    '''Register the user with email, username and password'''
    if await users_collection.find_one({"$or": [{"email": data.email}, {"username": data.username}]}):
        raise HTTPException(status_code=409, detail="User already exists")

    now = datetime.now(timezone.utc)
    doc = {
        "username": data.username,
        "email": data.email,
        "password_hash": await hash_password(data.password),
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await users_collection.insert_one(doc)
    except DuplicateKeyError:  # race condition safety net
        raise HTTPException(status_code=409, detail="User already exists")
    response = UserPublic(
        id=str(result.inserted_id),
        username=data.username, 
        email=data.email,
        created_at=now
    )

    return response


########################################################


# Login

@router.post("/login", dependencies=[Depends(limit_by_ip("login"))])
async def login_user(request: Request, response: Response, form: OAuth2PasswordRequestForm = Depends()):
    '''Login the user with username and password and generate a token'''
    user = await auth_user(form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Could not log in the user")
    _set_auth_cookie(request, response, user)
    return {"ok": True}  # no token in the body


########################################################


# Update the user

@router.patch("/me")
async def update_user(data: UserUpdate, user: UserPublic = Depends(get_current_user)):
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to update")
    changes["updated_at"] = datetime.now(timezone.utc)

    try:
        result = await users_collection.update_one(
            {"_id": ObjectId(user.id)}, {"$set": changes}
        )
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Email already in use")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}



########################################################


# Change password

@router.patch("/user/password")
async def change_password(request: Request, data: UserChangePassword, user: UserPublic = Depends(get_account_writer)):
    request.app.state.auth_limiter.check("change_password", user.id)
    user_id = ObjectId(user.id)
    doc = await users_collection.find_one({"_id": user_id}, {"password_hash": 1})
    if not doc or not doc.get("password_hash"):
        raise HTTPException(status_code=404)
    if not await verify_password(data.old_password, doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    # Bcrypt uses a random salt, so comparing two hashes cannot detect a reused password.
    if data.old_password == data.new_password:
        raise HTTPException(status_code=400, detail="New password must be different.")

    new_hash = await hash_password(data.new_password)
    result = await users_collection.update_one(
        {"_id": user_id},
        {"$set": {
            "password_hash": new_hash,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}


@router.delete("/me", status_code=204)
async def delete_account(
    request: Request,
    data: UserDelete,
    response: Response,
    user: UserPublic = Depends(get_account_writer),
) -> None:
    request.app.state.auth_limiter.check("delete_account", user.id)
    user_id = ObjectId(user.id)
    account = await users_collection.find_one({"_id": user_id}, {"password_hash": 1})
    if not account:
        raise HTTPException(status_code=404, detail="User not found")
    password_hash = account.get("password_hash")
    if not password_hash:
        raise HTTPException(
            status_code=409,
            detail="This account has no password. Password confirmation is required to delete it.",
        )

    if not await verify_password(data.password.get_secret_value(), password_hash):
        raise HTTPException(status_code=400, detail="Incorrect password.")

    try:
        await delete_account_data(user_id)
    except PyMongoError:
        logger.exception("Account deletion interrupted for user %s", user_id)
        raise HTTPException(
            status_code=503,
            detail="Account deletion was interrupted. Some data may already be deleted. Try again to finish.",
        )

    response.delete_cookie(**_auth_cookie_attributes(request))


########################################################


# Google callback

# Step 2: Google redirects back here with ?code=...&state=...
@google_router.get("/google/callback")
async def google_callback(
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    oauth_state: str | None = Cookie(default=None),  # name must match the cookie key
):
    from httpx import AsyncClient

    # User clicked "Cancel" or Google returned an error
    if error:
        raise HTTPException(400, f"Google auth failed: {error}")

    # CSRF check: state from Google must equal the one stored in the cookie
    if not state or not oauth_state or not secrets.compare_digest(state, oauth_state):
        raise HTTPException(400, "Invalid state")

    if not code:
        raise HTTPException(400, "Missing code")

    # Step 3: exchange the one-time code for tokens (server-to-server)
    payload = {
        "code": code,
        "client_id": os.environ["CLIENT_ID"],
        "client_secret": os.environ["CLIENT_SECRET"],
        "redirect_uri": REDIRECT_URI,  # must be identical to the one in /login
        "grant_type": "authorization_code",
    }

    async with AsyncClient() as client:
        # data= -> form-encoded body, which is what Google expects
        token_resp = await client.post(TOKEN_URL, data=payload)

        if token_resp.status_code != 200:
            raise HTTPException(400, "Could not exchange code with Google")

        access_token = token_resp.json()["access_token"]

        # Step 4: ask Google who this user is
        info_resp = await client.get(
            USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if info_resp.status_code != 200:
        raise HTTPException(400, "Could not fetch Google profile")

    info = info_resp.json()
    google_id = info["sub"]   # stable unique Google user ID (email can change)
    email = info.get("email")
    name = info.get("name") or (email.split("@")[0] if email else "user")

    if not email or not info.get("email_verified"):
        raise HTTPException(400, "Google email not verified")

    user = await users_collection.find_one({"email": email})

    if not user:
        base = re.sub(r"[^A-Za-z0-9_.-]", "", name) or "user"
        username = base
        if await users_collection.find_one({"username": username}):
            username = f"{base}_{secrets.token_hex(3)}"
        now = datetime.now(timezone.utc)
        doc = {
            "username": username,
            "email": email,
            "password_hash": None,
            "created_at": now,
            "updated_at": now,
        }
        try:
            result = await users_collection.insert_one(doc)
        except DuplicateKeyError:
            raise HTTPException(409, "User already exists")
        doc["_id"] = result.inserted_id
        user = doc

    response = RedirectResponse(FRONTEND_URL)
    _set_auth_cookie(request, response, user)
    response.delete_cookie("oauth_state")  # state is single-use
    return response


########################################################


# Google login

@google_router.get("/google/login")
def google_login():
    state = secrets.token_urlsafe(32)  # random CSRF token

    params = {
        "client_id": os.environ["CLIENT_ID"],
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
    }

    # urlencode escapes spaces/special chars
    response = RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")
    response.set_cookie(
        key="oauth_state",
        value=state,
        max_age=600,
        httponly=True,
        samesite="lax",  # "strict" would block the cookie on Google's redirect back
        secure=False,    # True in production (HTTPS)
    )
    return response



########################################################


# Get user

@router.get("/user", response_model=UserPublic)
async def get_user(user=Depends(get_current_user)):
    return user
