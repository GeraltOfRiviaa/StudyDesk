from datetime import datetime, timezone
import logging
from bson import ObjectId
from fastapi import HTTPException, Depends, APIRouter, Cookie, Query, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.security import OAuth2PasswordRequestForm
from pymongo.errors import DuplicateKeyError, PyMongoError
from database import db
from core.accounts import delete_account_data
from core.security import hash_password, generate_token, auth_user, get_account_writer, get_current_user, verify_password
from models.users import UserChangePassword, UserCreate, UserDelete, UserPublic, UserUpdate
from urllib.parse import urlencode
from fastapi.responses import RedirectResponse
import secrets
from httpx import AsyncClient
import os
import re


router = APIRouter(prefix="/auth", tags=["Users"])
users_collection = db["users"]
logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
REDIRECT_URI = "http://localhost:8000/auth/google/callback" 
FRONTEND_URL = "http://localhost:5173/dashboard"

########################################################


# Logout

def _clear_auth_cookie(response: Response):
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
        secure=False,  # must match how it was set; True in production
    )


@router.post("/logout")
async def logout(response: Response):
    _clear_auth_cookie(response)
    return {"ok": True}


########################################################


# Register

@router.post("/register", response_model=UserPublic, status_code=201)
async def register(data: UserCreate):
    '''Register the user with email, username and password'''
    if await users_collection.find_one({"$or": [{"email": data.email}, {"username": data.username}]}):
        raise HTTPException(status_code=409, detail="User already exists")

    now = datetime.now(timezone.utc)
    doc = {
        "username": data.username,
        "email": data.email,
        "password_hash": hash_password(data.password),
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

@router.post("/login")
async def login_user(response: Response, form: OAuth2PasswordRequestForm = Depends()):
    '''Login the user with username and password and generate a token'''
    user = await auth_user(form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Could not log in the user")
    token = generate_token(user)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # True in production
        max_age=60 * 60 * 24 * 7,
    )
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

@router.patch("/user/password")   # 1. new path, /user/update is already taken
async def change_password(data: UserChangePassword, user: UserPublic = Depends(get_account_writer)):
    # 1. get the old and new password (from a Pydantic model)
    old = data.old_password
    new = data.new_password
    # 2. load the user's password_hash from the DB
    id = ObjectId(user.id)
    doc = await users_collection.find_one({"_id": id})
    if not doc or not doc.get("password_hash"):
        raise HTTPException(status_code=404)
    # 3. verify the old password, raise error if it doesn't match
    if not verify_password(old, doc["password_hash"]):
        raise HTTPException(status_code=400)
    # 4. hash the new password
    new_hash = hash_password(new)
    
    if new_hash == doc["password_hash"]:
        raise HTTPException(status_code=400)
    # 5. save it in the DB         
    result = await users_collection.update_one(
        {"_id": id},
        {"$set": {
            "password_hash": new_hash,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "User not found")
    # 6. return {"ok": True}
    return {"ok": True}


@router.delete("/me", status_code=204)
async def delete_account(
    data: UserDelete,
    response: Response,
    user: UserPublic = Depends(get_account_writer),
) -> None:
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

    try:
        confirmed = await run_in_threadpool(
            verify_password, data.password.get_secret_value(), password_hash
        )
    except ValueError:
        # bcrypt rejects inputs longer than 72 bytes.
        confirmed = False
    if not confirmed:
        raise HTTPException(status_code=400, detail="Incorrect password.")

    try:
        await delete_account_data(user_id)
    except PyMongoError:
        logger.exception("Account deletion interrupted for user %s", user_id)
        raise HTTPException(
            status_code=503,
            detail="Account deletion was interrupted. Some data may already be deleted. Try again to finish.",
        )

    _clear_auth_cookie(response)


########################################################


# Google callback

# Step 2: Google redirects back here with ?code=...&state=...
@router.get("/google/callback")
async def google_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    oauth_state: str | None = Cookie(default=None),  # name must match the cookie key
):
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
            print("Google token error:", token_resp.text)  # log details server-side only
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

    # Step 6: issue OUR OWN token, same function your normal login uses
    jwt_token = generate_token(user=user)

    response = RedirectResponse(FRONTEND_URL)
    response.set_cookie(
        key="access_token",
        value=jwt_token,
        httponly=True,
        samesite="lax",
        secure=False,  # True in production
        max_age=60 * 60 * 24 * 7,
    )
    response.delete_cookie("oauth_state")  # state is single-use
    return response


########################################################


# Google login

@router.get("/google/login")
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
