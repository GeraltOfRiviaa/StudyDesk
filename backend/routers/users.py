from datetime import datetime, timezone
from fastapi import HTTPException, Depends, APIRouter, Request, Cookie, Query
from fastapi.security import OAuth2PasswordRequestForm
from pymongo.errors import DuplicateKeyError
from database import db
from core.security import hash_password, generate_token, auth_user
from models.users import UserCreate, UserPublic
from models.types import Token
from urllib.parse import urlencode
from fastapi.responses import RedirectResponse
import secrets
from httpx import AsyncClient
import os


router = APIRouter(prefix="/auth")
users = db["users"]

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
REDIRECT_URI = "http://localhost:8000/auth/google/callback"  # must match Google Console exactly
FRONTEND_URL = "http://localhost:5173"


@router.post("/register", response_model=UserPublic, status_code=201)
async def register(data: UserCreate):
    '''Register the user with email, nickname and password'''
    if await users.find_one({"$or": [{"email": data.email}, {"nickname": data.nickname}]}):
        raise HTTPException(status_code=409, detail="User already exists")

    now = datetime.now(timezone.utc)
    doc = {
        "nickname": data.nickname,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await users.insert_one(doc)
    except DuplicateKeyError:  # race condition safety net
        raise HTTPException(status_code=409, detail="User already exists")
    response = UserPublic(
        id=str(result.inserted_id),
        nickname=data.nickname, 
        email=data.email,
        created_at=now
    )

    return response

@router.post("/login", response_model=Token)
async def login_user(form: OAuth2PasswordRequestForm = Depends()):
    '''Login the user with username and password and generate a token'''
    user = await auth_user(form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Could not log in the user")
    return Token(access_token=generate_token(user))


# Step 1: send the user to Google's consent screen
@router.get("/google/login")
async def google_login():
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

    # Never trust an unverified email (it could be used to hijack an existing account)
    if not email or not info.get("email_verified"):
        raise HTTPException(400, "Google email not verified")

    # Step 5: find or create the user in our DB
    now = datetime.now(timezone.utc)
    user = users.find_one({"email": email})

    if not user:
        user = await users.find_one({"nickname": name})
        if user:
            nickname = f"{name}_{secrets.token_hex(3)}"

            doc = {
                "nickname": nickname,
                "email": email,
                "password_hash": None,  # Google-only account has no password
                "created_at": now,
                "updated_at": now,
            }
            try:
                result = await users.insert_one(doc)
            except DuplicateKeyError:  # race condition safety net
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