import os
import unittest
from contextlib import ExitStack, contextmanager
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import bcrypt
import jwt
from bson import ObjectId
from fastapi import HTTPException
from fastapi.testclient import TestClient
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

# Import the app with a deliberately unreachable database. All fixture writes use in-memory objects.
with patch.dict(os.environ, {"MONGO_URL": "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=100"}):
    from main import create_app

from core import security
from core.limiter import AuthLimiter
from routers import bulk, links, notes, tags, users
from seed import seed_user


SECRET = token_hex(32)
ORIGIN = "http://localhost:5173"
PASSWORD = "fixture-password"
ACCOUNT_ID = ObjectId()
ITEM_ID = ObjectId()
OTHER_ID = ObjectId()


class MemoryUsers:
    def __init__(self):
        password_hash = bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()
        self.rows = {
            ACCOUNT_ID: {
                "_id": ACCOUNT_ID,
                "email": "student@example.com",
                "username": "student",
                "password_hash": password_hash,
                "created_at": datetime.now(timezone.utc),
            },
            OTHER_ID: {
                "_id": OTHER_ID,
                "email": "passwordless@example.com",
                "username": "passwordless",
                "password_hash": None,
                "created_at": datetime.now(timezone.utc),
            },
        }

    async def find_one(self, query, projection=None):
        if "$or" in query:
            for alternative in query["$or"]:
                if match := await self.find_one(alternative):
                    return match
            return None
        return next(
            (row.copy() for row in self.rows.values() if all(row.get(key) == value for key, value in query.items())),
            None,
        )

    async def insert_one(self, row):
        user_id = ObjectId()
        self.rows[user_id] = {**row, "_id": user_id}
        return SimpleNamespace(inserted_id=user_id)

    async def update_one(self, query, changes):
        self.rows[query["_id"]].update(changes["$set"])
        return SimpleNamespace(matched_count=1)

    async def delete_data(self, user_id):
        del self.rows[user_id]


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.settings = self.enterContext(patch.dict(os.environ, {
            "JWT_SECRET": SECRET,
            "FRONTEND_ORIGINS": ORIGIN,
            "AUTH_COOKIE_SECURE": "false",
            "FORWARDED_ALLOW_IPS": "",
        }))
        self.store = MemoryUsers()
        self.enterContext(patch.object(users, "users_collection", self.store))
        self.enterContext(patch.object(security, "users_collection", self.store))
        self.delete_data = self.enterContext(patch.object(users, "delete_account_data", side_effect=self.store.delete_data))

    @contextmanager
    def client(self, *, headers=None, base_url="http://localhost:8000", trusted_hosts=None):
        app = create_app()
        transport = app if trusted_hosts is None else ProxyHeadersMiddleware(app, trusted_hosts=trusted_hosts)
        options = {"client": ("203.0.113.10", 50000)}
        with TestClient(transport, base_url=base_url, headers=headers, **options) as client:
            yield app, client

    def login(self, client, username="student", password=PASSWORD, **kwargs):
        return client.post("/auth/login", data={"username": username, "password": password}, **kwargs)

    def test_startup_rejects_invalid_secrets_without_echoing_them(self):
        for secret in (None, "", "   ", "invalid-secret", "f" * 64, "0123456789abcdef" * 4):
            with self.subTest(secret_present=secret is not None):
                if secret is None:
                    os.environ.pop("JWT_SECRET", None)
                else:
                    os.environ["JWT_SECRET"] = secret
                with self.assertRaisesRegex(RuntimeError, "JWT_SECRET") as failure, self.client():
                    self.fail("The application accepted an invalid JWT secret")
                if secret and secret.strip():
                    self.assertNotIn(secret, str(failure.exception))
        os.environ["JWT_SECRET"] = SECRET
        with self.client() as (_, client):
            self.assertEqual(client.get("/openapi.json").status_code, 200)

    def test_wildcard_origins_and_proxy_trust_are_rejected(self):
        with patch.dict(os.environ, {"FRONTEND_ORIGINS": "*"}), self.assertRaisesRegex(RuntimeError, "FRONTEND_ORIGINS"):
            create_app()
        for proxy in ("*", "0.0.0.0/0", "::/0"):
            with patch.dict(os.environ, {"FORWARDED_ALLOW_IPS": proxy}), self.assertRaisesRegex(RuntimeError, "FORWARDED_ALLOW_IPS"), self.client():
                self.fail("The application trusted every proxy")

    def test_token_claims_algorithm_signature_and_expiration(self):
        now = datetime.now(timezone.utc)
        claims = {"sub": str(ACCOUNT_ID), "exp": now + timedelta(days=7)}
        token = jwt.encode(claims, SECRET, algorithm="HS256")
        invalid_tokens = {
            "malformed": "not-a-jwt",
            "wrong signature": jwt.encode(claims, token_hex(32), algorithm="HS256"),
            "wrong algorithm": jwt.encode(claims, SECRET, algorithm="HS512"),
            "expired": jwt.encode({**claims, "exp": now - timedelta(seconds=1)}, SECRET, algorithm="HS256"),
            "missing expiration": jwt.encode({"sub": str(ACCOUNT_ID)}, SECRET, algorithm="HS256"),
            "invalid expiration": jwt.encode({**claims, "exp": []}, SECRET, algorithm="HS256"),
            "invalid subject": jwt.encode({**claims, "sub": "invalid"}, SECRET, algorithm="HS256"),
        }
        with self.client() as (_, client):
            self.assertEqual(client.get("/auth/user", headers={"Cookie": f"access_token={token}"}).status_code, 200)
            for case, invalid in invalid_tokens.items():
                with self.subTest(case=case):
                    response = client.get("/auth/user", headers={"Cookie": f"access_token={invalid}"})
                    self.assertEqual(response.status_code, 401)
                    self.assertEqual(response.json(), {"detail": "Invalid credentials"})
        with patch.dict(os.environ, {"JWT_SECRET": token_hex(32)}), self.client() as (_, client):
            self.assertEqual(client.get("/auth/user", headers={"Cookie": f"access_token={token}"}).status_code, 401)

    def test_registration_login_and_password_boundaries(self):
        with self.client(headers={"Origin": ORIGIN}) as (_, client):
            for index, password in enumerate(("a" * 72, "é" * 36)):
                with self.subTest(index=index):
                    username = f"boundary{index}"
                    registration = client.post("/auth/register", json={
                        "username": username, "email": f"{username}@example.com", "password": password,
                    })
                    self.assertEqual(registration.status_code, 201)
                    self.assertNotIn("password_hash", registration.json())
                    self.assertEqual(self.login(client, username, password).status_code, 200)
                    self.assertEqual(client.get("/auth/user").json()["username"], username)

            for password in ("a" * 73, "é" * 37):
                response = client.post("/auth/register", json={
                    "username": "oversized", "email": "oversized@example.com", "password": password,
                })
                self.assertEqual(response.status_code, 422)
                self.assertEqual(response.json()["detail"][0]["loc"], ["body", "password"])
                self.assertNotIn("input", response.json()["detail"][0])
                self.assertNotIn(password, response.text)
                self.assertEqual(self.login(client, password=password).status_code, 401)

            self.assertEqual(self.login(client, "passwordless").status_code, 401)

    def test_password_change_logout_and_deletion(self):
        with self.client(headers={"Origin": ORIGIN}) as (_, client):
            login = self.login(client)
            self.assertEqual(login.status_code, 200)
            original_token = client.cookies["access_token"]
            self.assertIn("Max-Age=604800", login.headers["set-cookie"])
            self.assertIn("HttpOnly", login.headers["set-cookie"])
            self.assertIn("SameSite=lax", login.headers["set-cookie"])
            self.assertNotIn("Secure", login.headers["set-cookie"])
            self.assertNotIn("Domain=", login.headers["set-cookie"])

            for old, new, status in (
                ("é" * 37, "different-password", 400),
                (PASSWORD, "é" * 37, 422),
                (PASSWORD, PASSWORD, 400),
                (PASSWORD, "é" * 36, 200),
            ):
                changed = client.patch("/auth/user/password", json={"old_password": old, "new_password": new})
                self.assertEqual(changed.status_code, status)
            self.assertEqual(self.login(client).status_code, 401)
            self.assertEqual(client.post("/auth/logout").status_code, 200)
            self.assertEqual(client.get("/auth/user").status_code, 401)
            self.assertEqual(client.get("/auth/user", headers={"Cookie": f"access_token={original_token}"}).status_code, 200)

            self.assertEqual(self.login(client, password="é" * 36).status_code, 200)
            oversized = client.request("DELETE", "/auth/me", json={"password": "é" * 37})
            self.assertEqual(oversized.status_code, 400)
            self.delete_data.assert_not_awaited()
            deleted = client.request("DELETE", "/auth/me", json={"password": "é" * 36})
            self.assertEqual(deleted.status_code, 204)
            self.assertIn("Max-Age=0", deleted.headers["set-cookie"])
            self.delete_data.assert_awaited_once_with(ACCOUNT_ID)
            self.assertEqual(client.get("/auth/user", headers={"Cookie": f"access_token={original_token}"}).status_code, 401)

    def test_https_cookie_and_disabled_google(self):
        secure = {"FRONTEND_ORIGINS": "https://studio.example.com", "AUTH_COOKIE_SECURE": "true"}
        with patch.dict(os.environ, secure), self.client(
            base_url="https://api.example.com", headers={"Origin": "https://studio.example.com"},
        ) as (_, client):
            login = self.login(client)
            logout = client.post("/auth/logout")
            for response in (login, logout):
                for attribute in ("Path=/", "Secure", "HttpOnly", "SameSite=lax"):
                    self.assertIn(attribute, response.headers["set-cookie"])
                self.assertNotIn("Domain=", response.headers["set-cookie"])
            for path in ("/auth/google/login", "/auth/google/callback"):
                self.assertEqual(client.get(path).status_code, 404)
                self.assertNotIn(path, client.get("/openapi.json").json()["paths"])

    def test_csrf_and_cors_on_login_rejections(self):
        with self.client() as (_, client):
            foreign = "https://foreign.example.test"
            for headers in ({}, {"Origin": "null"}, {"Origin": foreign, "X-StudyDesk-Request": "1"}):
                rejection = self.login(client, headers=headers)
                self.assertEqual(rejection.status_code, 403)
                self.assertNotIn("access-control-allow-origin", rejection.headers)

            # An ambiguous Origin is rejected while the allowed first value still receives CORS headers.
            ambiguous = self.login(client, headers=[("Origin", ORIGIN), ("Origin", ORIGIN)])
            self.assertEqual(ambiguous.status_code, 403)
            self.assertEqual(ambiguous.headers["access-control-allow-origin"], ORIGIN)
            self.assertEqual(ambiguous.headers["access-control-allow-credentials"], "true")
            self.assertEqual(self.login(client, headers={"X-StudyDesk-Request": "1"}).status_code, 200)
            self.assertEqual(self.login(client, headers={"Referer": f"{ORIGIN}/login"}).status_code, 200)

            for origin, status in ((ORIGIN, 200), (foreign, 400)):
                preflight = client.options("/auth/login", headers={
                    "Origin": origin, "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "X-StudyDesk-Request,Content-Type",
                })
                self.assertEqual(preflight.status_code, status)
                self.assertEqual(preflight.headers.get("access-control-allow-origin"), ORIGIN if status == 200 else None)

    def test_rate_limits_for_all_endpoints_and_cors(self):
        clock = [0.0]
        with self.client(headers={"Origin": ORIGIN}) as (app, client):
            app.state.auth_limiter = AuthLimiter(clock=lambda: clock[0])
            self.assertEqual(self.login(client).status_code, 200)
            for _ in range(9):
                self.assertEqual(self.login(client, "unknown").status_code, 401)
            limited = self.login(client, "unknown")
            self.assertEqual(limited.status_code, 429)
            self.assertEqual(limited.headers["retry-after"], "60")
            self.assertEqual(limited.headers["access-control-allow-origin"], ORIGIN)
            self.assertEqual(limited.headers["access-control-allow-credentials"], "true")
            self.assertIn("Retry-After", limited.headers["access-control-expose-headers"])

            for method, path, body, failure, window in (
                ("POST", "/auth/register", {"username": "student", "email": "student@example.com", "password": PASSWORD}, 409, 600),
                ("PATCH", "/auth/user/password", {"old_password": "incorrect-password", "new_password": "different-password"}, 400, 300),
                ("DELETE", "/auth/me", {"password": "incorrect-password"}, 400, 300),
            ):
                for _ in range(5):
                    self.assertEqual(client.request(method, path, json=body).status_code, failure)
                blocked = client.request(method, path, json=body)
                self.assertEqual(blocked.status_code, 429)
                self.assertEqual(blocked.headers["retry-after"], str(window))
            clock[0] = 600
            self.assertEqual(self.login(client).status_code, 200)

    def test_only_a_trusted_forwarding_peer_changes_rate_limit_identity(self):
        for trusted, final_status in (("192.0.2.1", 429), ("203.0.113.10", 401)):
            with self.subTest(trusted=trusted), self.client(headers={"Origin": ORIGIN}, trusted_hosts=trusted) as (_, client):
                for _ in range(10):
                    response = self.login(client, "unknown", headers={"X-Forwarded-For": "198.51.100.5"})
                    self.assertEqual(response.status_code, 401)
                response = self.login(client, "unknown", headers={"X-Forwarded-For": "198.51.100.6"})
                self.assertEqual(response.status_code, final_status)

    def test_existing_write_routes_accept_allowed_browser_origin(self):
        ids = {"id": str(ITEM_ID), "type": "note"}
        now = datetime.now(timezone.utc)
        timestamps = {"_id": ITEM_ID, "created_at": now, "updated_at": now}
        inserted = SimpleNamespace(inserted_id=ITEM_ID)
        deleted = SimpleNamespace(deleted_count=1)
        note_store = SimpleNamespace(
            insert_one=AsyncMock(return_value=inserted),
            find_one_and_update=AsyncMock(return_value={**timestamps, "title": "Edited", "content": "Fixture", "tags": []}),
        )
        tag_store = SimpleNamespace(
            insert_one=AsyncMock(return_value=inserted),
            find_one_and_update=AsyncMock(return_value={**timestamps, "name": "Edited", "color": "#ffffff"}),
            count_documents=AsyncMock(return_value=1),
            delete_many=AsyncMock(return_value=deleted),
        )
        link_store = SimpleNamespace(insert_one=AsyncMock(return_value=inserted), delete_one=AsyncMock(return_value=deleted))
        with ExitStack() as stack, self.client(headers={"Origin": ORIGIN}) as (_, client):
            stack.enter_context(patch.object(notes, "notes_collection", note_store))
            stack.enter_context(patch.object(notes, "delete_item", AsyncMock(return_value=1)))
            stack.enter_context(patch.object(notes, "delete_items", AsyncMock(return_value=1)))
            stack.enter_context(patch.object(tags, "tags_collection", tag_store))
            stack.enter_context(patch.object(tags, "count_usage", AsyncMock(return_value={"notes": 0})))
            stack.enter_context(patch.object(tags, "TAG_REFS", [("notes", "tags")]))
            stack.enter_context(patch.object(tags, "db", {"notes": SimpleNamespace(update_many=AsyncMock())}))
            stack.enter_context(patch.object(links, "links_collection", link_store))
            stack.enter_context(patch.object(links, "get_item", new_callable=AsyncMock))
            stack.enter_context(patch.object(links, "link_exists", AsyncMock(return_value=False)))
            for operation, result in (
                ("bulk_delete", {"deleted": 1, "skipped": 0}),
                ("bulk_add_tags", {"matched": 1, "modified": 1}),
                ("bulk_remove_tags", {"matched": 1, "modified": 1}),
                ("bulk_remove_links", {"deleted": 1}),
            ):
                stack.enter_context(patch.object(bulk, operation, AsyncMock(return_value=result)))

            self.assertEqual(self.login(client).status_code, 200)
            for method, path, body, status in (
                ("POST", "/notes/", {"title": "Test", "content": "Fixture", "tags": []}, 201),
                ("PATCH", f"/notes/{ITEM_ID}", {"title": "Edited"}, 200),
                ("DELETE", f"/notes/{ITEM_ID}", None, 200),
                ("DELETE", f"/notes/?ids={ITEM_ID}", None, 200),
                ("POST", "/tags/", {"name": "Test", "color": "#ffffff"}, 201),
                ("PATCH", f"/tags/{ITEM_ID}", {"name": "Edited"}, 200),
                ("DELETE", f"/tags/?ids={ITEM_ID}&confirm=true", None, 200),
                ("POST", "/links/", {"item_a_type": "note", "item_a_id": str(ITEM_ID), "item_b_type": "note", "item_b_id": str(OTHER_ID)}, 201),
                ("DELETE", f"/links/{ITEM_ID}", None, 200),
                ("POST", "/bulk/delete", {"items": [ids]}, 200),
                ("POST", "/bulk/tags/add", {"items": [ids], "tags": [str(OTHER_ID)]}, 200),
                ("POST", "/bulk/tags/remove", {"items": [ids]}, 200),
                ("POST", "/bulk/links/remove", {"items": [ids]}, 200),
                ("PATCH", "/auth/me", {"username": "new-name"}, 200),
            ):
                with self.subTest(path=path):
                    response = client.request(method, path, json=body)
                    self.assertEqual(response.status_code, status, response.text)
                    self.assertEqual(response.headers["access-control-allow-origin"], ORIGIN)
            forbidden = client.post("/notes/", headers={"Origin": "null"}, json={"title": "Test", "content": "Fixture"})
            self.assertEqual(forbidden.status_code, 403)
            note_store.insert_one.assert_awaited_once()

    def test_limiter_keeps_active_windows_at_capacity(self):
        clock = [0.0]
        limiter = AuthLimiter(capacity=2, clock=lambda: clock[0])
        for _ in range(10):
            limiter.check("login", "first")
        clock[0] = 1
        limiter.check("login", "second")
        for identity in ("new", "first"):
            with self.assertRaises(HTTPException) as failure:
                limiter.check("login", identity)
            self.assertEqual(failure.exception.status_code, 429)
            self.assertEqual(failure.exception.headers["Retry-After"], "59")
        clock[0] = 60
        limiter.check("login", "new")
        self.assertEqual(set(limiter.windows["login"]), {"new", "second"})


class SeedPasswordTests(unittest.IsolatedAsyncioTestCase):
    async def test_seed_awaits_hash_before_writing_fixture(self):
        users_fixture = MemoryUsers()
        hash_password = AsyncMock(return_value="fixture-hash")
        user_id, created = await seed_user(SimpleNamespace(users=users_fixture), hash_password, datetime.now(timezone.utc))
        self.assertTrue(created)
        hash_password.assert_awaited_once()
        self.assertEqual(users_fixture.rows[user_id]["password_hash"], "fixture-hash")
