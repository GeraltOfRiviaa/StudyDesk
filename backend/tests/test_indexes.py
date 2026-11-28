import asyncio
import os
import unittest
from collections import Counter
from datetime import datetime, timezone
from secrets import token_hex
from tempfile import TemporaryDirectory
from unittest.mock import AsyncMock, patch

from bson import ObjectId
from fastapi import Request
from httpx import ASGITransport, AsyncClient
from pymongo import AsyncMongoClient
from pymongo.errors import OperationFailure

with patch.dict(os.environ, {"MONGO_URL": "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=100"}):
    from main import create_app

from core import items, links, security
from core.indexes import IndexSetupError, initialize_indexes
from models.users import UserPublic
from routers import links as link_routes
from routers import tags as tag_routes
from routers import users


ORIGIN = "http://localhost:5173"
NOW = datetime.now(timezone.utc)


@unittest.skipUnless(os.getenv("STUDYDESK_INTEGRITY_MONGO_PORT"), "Requires disposable MongoDB")
class DatabaseIndexTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        port = int(os.environ["STUDYDESK_INTEGRITY_MONGO_PORT"])
        if port in (27017, 27018):
            self.fail("Select the published port of a disposable MongoDB instance")
        self.mongo = AsyncMongoClient(
            f"mongodb://127.0.0.1:{port}/?directConnection=true&serverSelectionTimeoutMS=3000",
            tz_aware=True,
        )
        self.addAsyncCleanup(self.mongo.close)
        self.db = self.mongo[f"studydesk_indexes_{ObjectId()}"]
        self.addAsyncCleanup(self.mongo.drop_database, self.db.name)
        self.enterContext(patch.dict(os.environ, {
            "JWT_SECRET": token_hex(32), "FRONTEND_ORIGINS": ORIGIN,
            "AUTH_COOKIE_SECURE": "false", "FORWARDED_ALLOW_IPS": "",
            "FILE_STORAGE_ROOT": os.path.realpath(self.enterContext(TemporaryDirectory())),
        }))
        self.enterContext(patch("main.db", self.db))
        self.enterContext(patch.object(items, "db", self.db))
        for module, collection in (
            (users, "users"), (security, "users"), (links, "links"),
            (link_routes, "links"), (tag_routes, "tags"),
        ):
            self.enterContext(patch.object(module, f"{collection}_collection", self.db[collection]))
        self.app = create_app()

    def lifespan(self):
        return self.app.router.lifespan_context(self.app)

    async def start_client(self):
        await self.enterAsyncContext(self.lifespan())
        return await self.enterAsyncContext(AsyncClient(
            transport=ASGITransport(app=self.app), base_url="http://test", headers={"Origin": ORIGIN},
        ))

    async def metadata(self):
        return {
            collection: await self.db[collection].index_information()
            for collection in await self.db.list_collection_names()
        }

    async def test_fresh_start_and_repeat(self):
        self.assertEqual(await self.db.list_collection_names(), [])
        async with self.lifespan():
            first = await self.metadata()
        async with self.lifespan():
            self.assertEqual(first, await self.metadata())
        self.assertEqual({name: len(indexes) - 1 for name, indexes in first.items()}, {
            "users": 2, "tags": 2, "notes": 2, "files": 2, "events": 2, "forms": 2,
            "links": 2, "containers": 1, "form_responses": 2,
        })
        unique = {
            index for indexes in first.values() for index, spec in indexes.items() if spec.get("unique")
        }
        self.assertEqual(unique, {"users_email_unique", "users_username_unique", "links_pair_unique"})
        tag_name = first["tags"]["tags_owner_name_id"]
        self.assertEqual(tag_name["key"], [("user_id", 1), ("name", 1), ("_id", 1)])
        self.assertEqual((tag_name["collation"]["locale"], tag_name["collation"]["strength"]), ("en", 2))
        self.assertNotIn("collation", first["users"]["users_username_unique"])

    async def test_startup_rejects_preexisting_identity_conflicts_without_writes(self):
        rows = [
            {"email": "STUDENT@example.com", "username": "student"},
            {"email": "student@example.com", "username": "student"},
        ]
        await self.db.users.insert_many(rows)
        with self.assertRaises(IndexSetupError) as failure:
            async with self.lifespan():
                self.fail("Conflicting records must block startup")
        message = str(failure.exception)
        for label in ("noncanonical_email", "duplicate_email_groups", "duplicate_username_groups"):
            self.assertIn(label, message)
        self.assertNotIn("example.com", message)
        self.assertEqual(await self.db.users.find().to_list(), rows)
        self.assertEqual(set((await self.metadata())["users"]), {"_id_"})

    async def test_startup_rejects_reversed_duplicate_links(self):
        a, b = sorted([ObjectId(), ObjectId()])
        await self.db.links.insert_many([
            {"user_id": a, "item_a_type": "note", "item_a_id": left, "item_b_type": "note", "item_b_id": right}
            for left, right in ((a, b), (b, a))
        ])
        with self.assertRaisesRegex(IndexSetupError, "reversed_links.*duplicate_pair_groups"):
            await initialize_indexes(self.db)
        self.assertEqual(await self.db.links.count_documents({}), 2)

    async def test_startup_preserves_incompatible_and_legacy_indexes(self):
        await self.db.users.create_index("username", name="users_username_unique")
        await self.db.tags.create_index([("user_id", 1), ("name", 1)], unique=True, name="legacy_unique_tag")
        await self.db.notes.create_index([("user_id", 1), ("tags", 1)], name="old_note_tags")
        before = await self.metadata()
        with self.assertRaises(IndexSetupError) as failure:
            await initialize_indexes(self.db)
        for name in ("users_username_unique", "legacy_unique_tag", "old_note_tags"):
            self.assertIn(name, str(failure.exception))
        self.assertEqual(before, await self.metadata())

    async def test_build_error_names_required_index_without_exposing_driver_message(self):
        with patch.object(type(self.db.users), "create_indexes", new=AsyncMock(
            side_effect=OperationFailure("sensitive key value", code=11000),
        )):
            with self.assertRaises(IndexSetupError) as failure:
                await initialize_indexes(self.db)
        self.assertIn("users.users_email_unique", str(failure.exception))
        self.assertNotIn("sensitive key value", str(failure.exception))

    async def test_concurrent_registration_and_case_sensitive_username(self):
        client = await self.start_client()
        password = "fixture-password"

        async def register(username, email):
            return await client.post("/auth/register", json={"email": email, "username": username, "password": password})

        # Force both requests past the optimistic check to exercise the database constraint.
        with patch.object(users, "_find_identity_conflict", new=AsyncMock(return_value=None)):
            for first, second, detail in (
                (("Student", "STUDENT@EXAMPLE.COM"), ("Other", "student@example.com"), "Email already in use"),
                (("classmate", "one@example.com"), ("classmate", "two@example.com"), "Username already in use"),
            ):
                responses = await asyncio.gather(register(*first), register(*second))
                self.assertEqual(Counter(result.status_code for result in responses), {201: 1, 409: 1})
                self.assertEqual(next(r.json()["detail"] for r in responses if r.status_code == 409), detail)

        # Use fresh per-IP budgets for the independent policy checks below.
        self.app.state.auth_limiter = type(self.app.state.auth_limiter)()
        for username, email in (("Name", "UPPER@example.com"), ("name", "lower@example.com")):
            response = await register(username, email)
            self.assertEqual(response.status_code, 201, response.text)
            self.assertEqual(response.json()["email"], email.lower())
        response = await register("othername", "upper@EXAMPLE.COM")
        self.assertEqual(response.json()["detail"], "Email already in use")
        wrong_case = await client.post("/auth/login", data={"username": "NAME", "password": password})
        right_case = await client.post("/auth/login", data={"username": "Name", "password": password})
        self.assertEqual((wrong_case.status_code, right_case.status_code), (401, 200))

    async def test_concurrent_profile_updates_report_correct_field(self):
        a, b = ObjectId(), ObjectId()
        await self.db.users.insert_many([
            {"_id": user_id, "email": f"{name}@example.com", "username": name, "created_at": NOW}
            for user_id, name in ((a, "first"), (b, "second"))
        ])
        client = await self.start_client()

        async def current_user(request: Request):
            row = await self.db.users.find_one({"_id": ObjectId(request.headers["x-test-user"])})
            return UserPublic(id=row["_id"], email=row["email"], username=row["username"], created_at=NOW)

        self.app.dependency_overrides[security.get_current_user] = current_user
        for first, second, field, value, detail in (
            ("NEW@EXAMPLE.COM", "new@example.com", "email", "new@example.com", "Email already in use"),
            ("Shared", "Shared", "username", "Shared", "Username already in use"),
        ):
            responses = await asyncio.gather(*(
                client.patch("/auth/me", headers={"x-test-user": str(user_id)}, json={field: candidate})
                for user_id, candidate in ((a, first), (b, second))
            ))
            self.assertEqual(Counter(result.status_code for result in responses), {200: 1, 409: 1})
            self.assertEqual(next(r.json()["detail"] for r in responses if r.status_code == 409), detail)
            self.assertEqual(await self.db.users.count_documents({field: value}), 1)

    async def test_reversed_link_race_and_repeated_tag_name(self):
        owner, a, b = ObjectId(), ObjectId(), ObjectId()
        await self.db.notes.insert_many([{"_id": item_id, "user_id": owner} for item_id in (a, b)])
        client = await self.start_client()
        self.app.dependency_overrides[security.get_account_writer] = lambda: UserPublic(
            id=owner, email="owner@example.com", username="owner", created_at=NOW,
        )

        # Bypass the in-process fast path to simulate two API workers sharing the database.
        with patch.object(link_routes, "link_exists", new=AsyncMock(return_value=False)):
            responses = await asyncio.gather(*(
                client.post("/links/", json={
                    "item_a_type": "note", "item_a_id": str(left).upper(),
                    "item_b_type": "note", "item_b_id": str(right),
                })
                for left, right in ((a, b), (b, a))
            ))
        self.assertEqual(Counter(result.status_code for result in responses), {201: 1, 409: 1})
        self.assertEqual(next(r.json()["detail"] for r in responses if r.status_code == 409), "Items are already linked")
        stored = await self.db.links.find().to_list()
        self.assertEqual([(row["item_a_id"], row["item_b_id"]) for row in stored], [tuple(sorted([a, b]))])

        tag_ids = set()
        for name in ("Biology", "Biology", "biology"):
            response = await client.post("/tags/", json={"name": name, "color": "#ffffff"})
            self.assertEqual(response.status_code, 201, response.text)
            tag_ids.add(response.json()["id"])
        self.assertEqual(len(tag_ids), 3)
