import base64
import json
import os
import unittest
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from unittest.mock import patch

from bson import ObjectId
from fastapi import Request
from httpx import ASGITransport, AsyncClient
from pymongo import AsyncMongoClient

with patch.dict(os.environ, {"MONGO_URL": "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=100"}):
    from main import create_app

from core import search, security, tags
from core.pagination import CursorBoundary, InvalidCursor, cursor_fingerprint, decode_cursor, encode_cursor
from models.users import UserPublic


NOW = datetime(2026, 1, 1, tzinfo=timezone.utc)
OWNER, OTHER = ObjectId(), ObjectId()
TAG_A, TAG_B, TAG_C = (ObjectId(f"abcdef123456789abcdef00{i}") for i in range(3))
COLLECTIONS = {"notes": "note", "files": "file", "events": "event"}


def token(payload):
    return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()


class CursorCodecTests(unittest.TestCase):
    def test_round_trips_text_and_dates_before_epoch(self):
        item_id = ObjectId()
        fingerprint = cursor_fingerprint(mode="items", owner=str(OWNER))
        for value, text_limit in (("Česká 🚀", 150), (NOW, None), (datetime(1969, 12, 31, tzinfo=timezone.utc), None)):
            with self.subTest(value=value):
                boundary = CursorBoundary(value, item_id, "note")
                self.assertEqual(decode_cursor(
                    encode_cursor(boundary, fingerprint), fingerprint, text_limit=text_limit, item_types={"note"},
                ), boundary)

    def test_rejects_unusable_text_and_dates(self):
        fingerprint = cursor_fingerprint(mode="tags")
        for value, text_limit in (([], 50), ("", 50), ("\ud800", 50), (True, None), (1.5, None), (10**18, None)):
            with self.subTest(value=value):
                payload = {"value": value, "id": str(OWNER), "context": fingerprint, "v": 1}
                with self.assertRaises(InvalidCursor):
                    decode_cursor(token(payload), fingerprint, text_limit=text_limit)


@unittest.skipUnless(os.getenv("STUDYDESK_INTEGRITY_MONGO_PORT"), "Requires disposable MongoDB")
class PaginationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        port = int(os.environ["STUDYDESK_INTEGRITY_MONGO_PORT"])
        if port in (27017, 27018):
            self.fail("Select the published port of a disposable MongoDB instance")
        mongo = AsyncMongoClient(
            f"mongodb://127.0.0.1:{port}/?directConnection=true&serverSelectionTimeoutMS=3000",
            tz_aware=True,
        )
        self.addAsyncCleanup(mongo.close)
        self.db = mongo[f"studydesk_pagination_{ObjectId()}"]
        self.addAsyncCleanup(mongo.drop_database, self.db.name)
        self.enterContext(patch.dict(os.environ, {
            "JWT_SECRET": token_hex(32), "FRONTEND_ORIGINS": "http://localhost:5173",
            "AUTH_COOKIE_SECURE": "false", "FORWARDED_ALLOW_IPS": "",
        }))
        self.enterContext(patch("main.db", self.db))
        self.enterContext(patch.object(search, "db", self.db))
        self.enterContext(patch.object(tags, "tags_collection", self.db.tags))
        app = create_app()

        def test_user(request: Request):
            owner = OTHER if request.headers.get("x-fixture-owner") == "other" else OWNER
            return UserPublic(id=owner, email="owner@example.com", username="owner", created_at=NOW)

        app.dependency_overrides[security.get_current_user] = test_user
        await self.enterAsyncContext(app.router.lifespan_context(app))
        self.client = await self.enterAsyncContext(AsyncClient(transport=ASGITransport(app=app), base_url="http://test"))

        specs = (
            ("Alpha", []), ("alpha", [TAG_A, TAG_B]), ("BETA", [TAG_A]), ("beta", [TAG_B]),
            ("Bravo", [TAG_A, TAG_B, TAG_C]), ("Z [literal]", []),
        )
        self.items = []
        # Reuse the same IDs and sort values across collections to exercise all tie-breakers.
        for collection, kind in COLLECTIONS.items():
            rows = [{
                "_id": ObjectId(f"{i + 0xFA:024x}"), "user_id": OWNER, "title": title,
                "tags": tag_ids, "created_at": NOW + timedelta(milliseconds=i % 3),
                "updated_at": NOW + timedelta(milliseconds=i % 2),
            } for i, (title, tag_ids) in enumerate(specs)]
            self.items.extend({**row, "type": kind} for row in rows)
            await self.db[collection].insert_many([*rows, {
                **rows[0], "_id": ObjectId(), "user_id": OTHER, "title": "Other owner",
            }])
        self.tag_rows = [{
            "_id": ObjectId(), "user_id": OWNER, "name": name, "color": "#335577",
            "created_at": NOW + timedelta(milliseconds=i % 2), "updated_at": NOW,
        } for i, name in enumerate(("Alpha", "alpha", "BETA", "beta", "Bravo"))]
        await self.db.tags.insert_many([*self.tag_rows, {
            **self.tag_rows[0], "_id": ObjectId(), "user_id": OTHER, "name": "Other owner",
        }])

    async def get_page(self, path, **params):
        response = await self.client.get(path, params=params)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    async def walk(self, path, **params):
        result, seen_cursors = [], set()
        for _ in range(30):
            page = await self.get_page(path, **params)
            result.extend(page["items"])
            cursor = page["next_cursor"]
            if not page["has_more"]:
                self.assertIsNone(cursor)
                return result
            self.assertTrue(cursor)
            self.assertNotIn(cursor, seen_cursors)
            seen_cursors.add(cursor)
            params["cursor"] = cursor
        self.fail("Pagination did not terminate")

    async def test_every_sort_direction_and_cross_collection_ties(self):
        for path, text_sort, source in (
            ("/library", "title", self.items), ("/tags/library", "name", self.tag_rows),
        ):
            for sort in (text_sort, "created_at", "updated_at"):
                for order in ("asc", "desc"):
                    with self.subTest(path=path, sort=sort, order=order):
                        reverse = order == "desc"
                        expected = sorted(source, key=lambda row: row["_id"], reverse=reverse)
                        expected.sort(key=lambda row: row.get("type", "tag"))
                        expected.sort(
                            key=lambda row: row[sort].casefold() if sort == text_sort else row[sort],
                            reverse=reverse,
                        )
                        actual = await self.walk(path, sort=sort, order=order, limit=2)
                        self.assertEqual(
                            [(row.get("type", "tag"), row["id"]) for row in actual],
                            [(row.get("type", "tag"), str(row["_id"])) for row in expected],
                        )

    async def test_cursor_validation_and_compatibility(self):
        for path, sort in (("/library", "title"), ("/tags/library", "name"), ("/notes/", "title")):
            source = "/library" if path == "/notes/" else path
            params = {"sort": sort, "q": "a", "limit": 1}
            if path == "/notes/":
                params["collections"] = "notes"
            cursor = (await self.get_page(source, **params))["next_cursor"]
            decoded = json.loads(base64.urlsafe_b64decode(cursor))
            broken = [
                "", "###", token([]), token({}), "A" * 4097, token({"value": "old"}),
                token({**decoded, "v": True}), token({**decoded, "id": "x" * 24}),
                token({**decoded, "value": {"$gt": "a"}}),
                token({**decoded, "type": "unknown"}),
            ]
            # Invalid boundaries never reach either database collection.
            with patch.object(search, "db", None), patch.object(tags, "tags_collection", None):
                for bad in broken:
                    response = await self.client.get(path, params={**params, "cursor": bad})
                    self.assertEqual((response.status_code, response.json()), (422, {"detail": "Invalid cursor"}))
            incompatible = [{"q": "b"}, {"order": "asc"}, {"sort": "created_at"}]
            if path == "/library":
                incompatible.extend([{"collections": "files"}, {"tags": str(TAG_A)}, {"ids": str(OWNER)}])
            for changes in incompatible:
                response = await self.client.get(path, params={**params, "cursor": cursor, **changes})
                self.assertEqual((response.status_code, response.json()), (422, {"detail": "Invalid cursor"}))
            foreign = await self.client.get(path, params={**params, "cursor": cursor}, headers={"x-fixture-owner": "other"})
            self.assertEqual((foreign.status_code, foreign.json()), (422, {"detail": "Invalid cursor"}))
            if path == "/notes/":
                response = await self.client.get(path, params={**params, "cursor": cursor})
                self.assertEqual(response.status_code, 200, response.text)
                self.assertEqual(len(response.json()), 1)
        for path in ("/library", "/notes/"):
            self.assertEqual((await self.client.get(path, params={"sort": "tags"})).status_code, 422)

    async def test_normalized_filters_and_effective_cursor_context(self):
        alpha_id, beta_id = (str(row["_id"]) for row in self.items[1:3])
        first = await self.get_page(
            "/library", collections=["events", "forms", "notes"], ids=[alpha_id.upper(), beta_id],
            tags=[str(TAG_B), str(TAG_A).upper(), str(TAG_A)], match="exact", limit=1,
        )
        remaining = await self.get_page(
            "/library", collections=["forms", "notes", "events", "notes"], ids=[beta_id.upper(), alpha_id],
            tags=[str(TAG_A), str(TAG_B).upper()], match="exact", limit=3, cursor=first["next_cursor"],
        )
        self.assertEqual([item["type"] for item in first["items"] + remaining["items"]], ["event", "note"])
        self.assertFalse(remaining["has_more"])

        for match, tag_ids, titles in (
            ("none", [], {"Alpha", "Z [literal]"}),
            ("any", [TAG_A, TAG_B], {"alpha", "BETA", "beta", "Bravo"}),
            ("all", [TAG_A, TAG_B], {"alpha", "Bravo"}),
            ("exact", [TAG_A, TAG_B], {"alpha"}),
        ):
            with self.subTest(match=match):
                page = await self.get_page(
                    "/library", collections=["notes", "forms"], match=match, tags=list(map(str, tag_ids)),
                )
                self.assertEqual({item["title"] for item in page["items"]}, titles)
                self.assertTrue(all(item["type"] == "note" for item in page["items"]))
        literal = await self.get_page("/library", q="[LITERAL]", collections="notes")
        self.assertEqual([item["title"] for item in literal["items"]], ["Z [literal]"])
        self.assertEqual((await self.client.get("/library", params={"match": "all"})).status_code, 400)
        self.assertEqual((await self.client.get("/library", params={"match": "none", "tags": str(TAG_A)})).status_code, 400)
        self.assertEqual((await self.client.get("/library", params={"collections": "unknown"})).status_code, 400)
        self.assertEqual((await self.get_page("/library", collections="forms"))["items"], [])
        self.assertEqual(len((await self.get_page("/library", collections="all"))["items"]), len(self.items))

    async def test_collection_local_paging_matches_reference(self):
        pipeline = search._library_pipeline

        def reference(*args, limit_branches):
            self.assertTrue(limit_branches)
            return pipeline(*args, limit_branches=False)

        for collections in (list(COLLECTIONS), ["forms", "files", "notes"], ["notes"]):
            for order in ("asc", "desc"):
                params = {"collections": collections, "sort": "updated_at", "order": order, "limit": 2}
                for _ in range(15):
                    with patch.object(search, "_library_pipeline", reference):
                        expected = await self.get_page("/library", **params)
                    actual = await self.get_page("/library", **params)
                    self.assertEqual(actual, expected)
                    if not actual["has_more"]:
                        break
                    params["cursor"] = actual["next_cursor"]
                else:
                    self.fail("Pagination did not terminate")
