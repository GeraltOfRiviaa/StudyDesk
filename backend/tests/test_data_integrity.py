import asyncio
import os
import unittest
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from secrets import token_hex
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError
from pymongo import AsyncMongoClient
from pymongo.errors import AutoReconnect

# Even a missed mock cannot connect to the development database.
with patch.dict(os.environ, {"MONGO_URL": "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=100"}):
    from main import create_app

from core import bulk, items, links, security, tags
from models.bulk import BulkItem
from models.note import NoteCreate, NoteUpdate
from models.tag import TagUpdate
from models.users import UserPublic, UserUpdate
from routers import links as link_routes
from routers import notes as note_routes
from routers import tags as tag_routes
from routers import users as user_routes


OWNER = ObjectId()
FOREIGN = ObjectId()
NOTE = ObjectId()
SECOND = ObjectId()
TAG = ObjectId("abcdefabcdefabcdefabcdef")
OTHER_TAG = ObjectId()
NOW = datetime.now(timezone.utc) - timedelta(days=1)
ORIGIN = "http://localhost:5173"
SECRET = token_hex(32)


class ApiTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self, database=None):
        self.enterContext(patch.dict(os.environ, {
            "JWT_SECRET": SECRET,
            "FRONTEND_ORIGINS": ORIGIN,
            "AUTH_COOKIE_SECURE": "false",
            "FORWARDED_ALLOW_IPS": "",
            "FILE_STORAGE_ROOT": os.path.realpath(self.enterContext(TemporaryDirectory())),
        }))
        self.user = UserPublic(id=OWNER, email="owner@example.com", username="owner", created_at=NOW)
        self.enterContext(patch.object(
            security, "users_collection", SimpleNamespace(find_one=AsyncMock(return_value={"_id": OWNER})),
        ))
        app = create_app()
        app.dependency_overrides[security.get_current_user] = lambda: self.user
        if database is None:
            self.enterContext(patch("main.initialize_indexes", AsyncMock()))
        else:
            self.enterContext(patch("main.db", database))
        await self.enterAsyncContext(app.router.lifespan_context(app))
        self.client = await self.enterAsyncContext(AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test", headers={"Origin": ORIGIN},
        ))


class PatchAndLockTests(ApiTests):
    async def test_all_explicit_null_fields_are_rejected_before_persistence(self):
        for path, module, collection, fields in (
            (f"/notes/{NOTE}", note_routes, "notes_collection", ("title", "content", "tags")),
            (f"/tags/{TAG}", tag_routes, "tags_collection", ("name", "color")),
            ("/auth/me", user_routes, "users_collection", ("email", "username")),
        ):
            with patch.object(module, collection, SimpleNamespace()) as no_writes:
                for field in fields:
                    with self.subTest(path=path, field=field):
                        response = await self.client.patch(path, json={field: None})
                        self.assertEqual(response.status_code, 422, response.text)
                        self.assertEqual(response.json()["detail"][0]["loc"], ["body", field])
                self.assertEqual(vars(no_writes), {})

    async def test_patch_omissions_clear_tags_and_keep_empty_content(self):
        record = {"_id": NOTE, "title": "Unchanged", "content": "", "tags": [], "created_at": NOW, "updated_at": NOW}
        write = AsyncMock(return_value=record)
        with patch.object(note_routes, "notes_collection", SimpleNamespace(find_one_and_update=write)):
            response = await self.client.patch(f"/notes/{NOTE}", json={"tags": [], "content": ""})
        self.assertEqual(response.status_code, 200, response.text)
        query, update = write.await_args.args
        self.assertEqual(query, {"_id": NOTE, "user_id": OWNER})
        self.assertEqual(set(update["$set"]), {"tags", "content", "updated_at"})
        self.assertEqual(update["$set"]["tags"], [])
        self.assertEqual(TagUpdate(color="#abcdef").model_dump(exclude_unset=True), {"color": "#abcdef"})
        self.assertEqual(UserUpdate(email="Owner@example.com").model_dump(exclude_unset=True), {"email": "owner@example.com"})
        for model in (NoteUpdate, TagUpdate, UserUpdate):
            with self.assertRaises(ValidationError):
                model.model_validate({})

    async def test_note_create_and_patch_enforce_same_constraints(self):
        for model in (NoteCreate, NoteUpdate):
            self.assertEqual(model(title="A", content="😀" * 10_000).content, "😀" * 10_000)
            for fields in ({"content": "a" * 10_001}, {"title": "a" * 151}, {"tags": [str(TAG)] * 101}):
                with self.subTest(model=model, fields=tuple(fields)), self.assertRaises(ValidationError):
                    model.model_validate({"title": "A", "content": "", **fields})

    async def test_waiters_hold_same_lock_and_cancellation_and_failure_release_it(self):
        writer = asynccontextmanager(security.get_account_writer)
        holder_entered = asyncio.Event()
        hold = asyncio.Event()
        survivor_entered = asyncio.Event()

        async def holder():
            async with writer(self.user):
                holder_entered.set()
                await hold.wait()

        async def failed_waiter():
            async with writer(self.user):
                survivor_entered.set()
                raise RuntimeError("injected failure")

        async def waiter():
            async with writer(self.user):
                pass

        async with asyncio.TaskGroup() as tasks:
            first = tasks.create_task(holder())
            await holder_entered.wait()
            cancelled = tasks.create_task(waiter())

            async def failing_without_aborting_group():
                with self.assertRaisesRegex(RuntimeError, "injected"):
                    await failed_waiter()
            last = tasks.create_task(failing_without_aborting_group())
            await asyncio.sleep(0)
            self.assertFalse(survivor_entered.is_set())

            # An unrelated account can write while this account's requests are queued.
            other = self.user.model_copy(update={"id": str(FOREIGN)})
            async with writer(other):
                self.assertFalse(survivor_entered.is_set())

            cancelled.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await cancelled
            self.assertTrue(security._account_write_locks[self.user.id].locked())

            first.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await first
            await asyncio.wait_for(last, timeout=2)
            self.assertTrue(survivor_entered.is_set())

        await asyncio.wait_for(waiter(), timeout=2)
        for _ in range(20):
            async with writer(self.user.model_copy(update={"id": str(ObjectId())})):
                pass
        self.assertFalse(security._account_write_locks)


class PartialBulkTests(unittest.IsolatedAsyncioTestCase):
    async def test_both_tag_operations_report_completed_no_op_separately(self):
        targets = [BulkItem(id=NOTE, type="note"), BulkItem(id=SECOND, type="event")]
        for adding in (True, False):
            with self.subTest(adding=adding):
                notes = SimpleNamespace(
                    count_documents=AsyncMock(side_effect=[1, 0, 0]),
                    update_many=AsyncMock(return_value=SimpleNamespace(modified_count=0)),
                )
                events = SimpleNamespace(
                    count_documents=AsyncMock(side_effect=[1, 0, 0]),
                    update_many=AsyncMock(side_effect=[AutoReconnect("result unknown"), SimpleNamespace(modified_count=1)]),
                )
                with (
                    patch.object(bulk, "db", {"notes": notes, "events": events}),
                    patch.object(bulk, "validate_tag_ids", AsyncMock(return_value=[TAG])),
                    patch.object(bulk.logger, "exception"),
                ):
                    args = ([str(TAG)],) if adding else ()
                    operation = bulk.bulk_add_tags if adding else bulk.bulk_remove_tags
                    with self.assertRaises(HTTPException) as failure:
                        await operation(str(OWNER), targets, *args)
                    self.assertEqual(failure.exception.status_code, 503)
                    detail = failure.exception.detail
                    self.assertEqual(detail["matched"], 1)
                    self.assertEqual(detail["modified"], 0)
                    self.assertEqual(detail["completed_items"], [{"type": "note", "id": str(NOTE)}])

                    events.count_documents.reset_mock(side_effect=True)
                    events.count_documents.side_effect = [1, 0, 0]
                    retry = await operation(str(OWNER), [targets[1]], *args)
                    self.assertEqual(retry.model_dump(), {"matched": 1, "modified": 1})
                    notes.update_many.assert_awaited_once()

    async def test_item_delete_reports_only_acknowledged_groups_and_retries_missing_items(self):
        targets = [BulkItem(id=NOTE, type="note"), BulkItem(id=SECOND, type="event")]
        preflight = AsyncMock(side_effect=[set(), {SECOND}, set()])
        delete = AsyncMock(side_effect=[0, AutoReconnect("result unknown"), 0])
        with (
            patch.object(bulk, "prepare_item_deletion", preflight),
            patch.object(bulk, "delete_items", delete),
            patch.object(bulk.logger, "exception"),
        ):
            with self.assertRaises(HTTPException) as failure:
                await bulk.bulk_delete(str(OWNER), targets)
            self.assertEqual(failure.exception.detail["deleted"], 0)
            self.assertEqual(failure.exception.detail["completed_items"], [{"type": "note", "id": str(NOTE)}])
            retry = await bulk.bulk_delete(str(OWNER), [targets[1]])
            self.assertEqual(retry.model_dump(), {"deleted": 0, "skipped": 1})

    async def test_link_removal_reports_no_progress_when_command_is_uncertain(self):
        target = BulkItem(id=NOTE, type="note")
        delete = AsyncMock(side_effect=[AutoReconnect("result unknown"), SimpleNamespace(deleted_count=0)])
        with (
            patch.object(bulk, "validate_items", AsyncMock()),
            patch.object(bulk, "db", {"links": SimpleNamespace(delete_many=delete)}),
            patch.object(bulk.logger, "exception"),
        ):
            with self.assertRaises(HTTPException) as failure:
                await bulk.bulk_remove_links(str(OWNER), [target])
            self.assertEqual(failure.exception.detail["deleted"], 0)
            self.assertEqual(failure.exception.detail["completed_items"], [])
            self.assertEqual((await bulk.bulk_remove_links(str(OWNER), [target])).deleted, 0)

    async def test_preflight_database_failure_confirms_no_changes(self):
        target = BulkItem(id=NOTE, type="note")
        with patch.object(bulk, "validate_items", AsyncMock(side_effect=AutoReconnect())), patch.object(bulk.logger, "exception"):
            with self.assertRaises(HTTPException) as failure:
                await bulk.bulk_remove_tags(str(OWNER), [target])
        self.assertEqual(failure.exception.detail["completed_items"], [])
        self.assertIn("No changes were made", failure.exception.detail["message"])


@unittest.skipUnless(os.getenv("STUDYDESK_INTEGRITY_MONGO_PORT"), "Requires an isolated MongoDB instance")
class MongoIntegrityTests(ApiTests):
    async def asyncSetUp(self):
        port = int(os.environ["STUDYDESK_INTEGRITY_MONGO_PORT"])
        if port in (27017, 27018):
            self.fail("Select the published port of a disposable MongoDB instance")
        mongo = AsyncMongoClient(f"mongodb://127.0.0.1:{port}/?directConnection=true", tz_aware=True)
        self.addAsyncCleanup(mongo.close)
        self.db = mongo[f"studydesk_integrity_{ObjectId()}"]
        self.addAsyncCleanup(mongo.drop_database, self.db.name)
        await super().asyncSetUp(database=self.db)
        for module in (bulk, items, links, tags):
            self.enterContext(patch.object(module, "db", self.db))
        for module, name, collection in (
            (note_routes, "notes_collection", "notes"),
            (tag_routes, "tags_collection", "tags"),
            (tags, "tags_collection", "tags"),
            (link_routes, "links_collection", "links"),
            (links, "links_collection", "links"),
        ):
            self.enterContext(patch.object(module, name, self.db[collection]))

    async def add_note(self, item_id, tag_ids, owner=OWNER):
        await self.db.notes.insert_one({
            "_id": item_id, "user_id": owner, "title": "Fixture", "content": "", "tags": tag_ids,
            "created_at": NOW, "updated_at": NOW,
        })

    async def add_tags(self, *ids):
        await self.db.tags.insert_many([
            {"_id": item_id, "user_id": OWNER, "name": "Same name", "color": "#ffffff"} for item_id in ids
        ])

    async def wait_for_queued_request(self):
        async def queued():
            while True:
                lock = security._account_write_locks.get(self.user.id)
                if lock and lock._waiters:
                    return
                await asyncio.sleep(0)
        await asyncio.wait_for(queued(), 2)

    async def test_tag_cleanup_retries_all_configured_fields_using_current_usage(self):
        await self.add_tags(TAG)
        owner_filter = {"user_id": OWNER}
        for name, field in tags.TAG_REFS:
            await self.db[name].insert_one({**owner_filter, field: [TAG], "updated_at": NOW})
        await self.add_note(SECOND, [TAG], FOREIGN)

        collections = {name: self.db[name] for name, _ in tags.TAG_REFS}
        collections["events"] = SimpleNamespace(
            count_documents=self.db.events.count_documents, update_many=AsyncMock(side_effect=AutoReconnect()),
        )
        with patch.object(tags, "db", collections), patch.object(tags.logger, "exception"):
            response = await self.client.delete(f"/tags/?ids={TAG}&ids={str(TAG).upper()}&confirm=true")
        self.assertEqual(response.status_code, 503, response.text)
        self.assertIsNotNone(await self.db.tags.find_one({"_id": TAG}))
        first_note = await self.db.notes.find_one(owner_filter)
        self.assertEqual(first_note["tags"], [])
        self.assertGreater(first_note["updated_at"], NOW)

        await self.db.tags.update_one({"_id": TAG}, {"$set": {"user_id": FOREIGN}})
        no_longer_owned = await self.client.delete(f"/tags/?ids={TAG}&confirm=true")
        self.assertEqual(no_longer_owned.status_code, 404)
        self.assertEqual((await self.db.events.find_one(owner_filter))["tags"], [TAG])
        await self.db.tags.update_one({"_id": TAG}, {"$set": {"user_id": OWNER}})
        confirmation = await self.client.delete(f"/tags/?ids={TAG}")
        self.assertEqual(confirmation.status_code, 409)
        self.assertEqual(confirmation.json()["detail"]["total"], 3)
        retry = await self.client.delete(f"/tags/?ids={TAG}&confirm=true")
        self.assertEqual(retry.json(), {"deleted": 1})
        self.assertIsNone(await self.db.tags.find_one({"_id": TAG}))
        for name, field in tags.TAG_REFS:
            doc = await self.db[name].find_one(owner_filter)
            self.assertEqual(doc[field], [])
            self.assertGreater(doc["updated_at"], NOW)
        self.assertEqual((await self.db.notes.find_one(owner_filter))["updated_at"], first_note["updated_at"])
        self.assertEqual((await self.db.notes.find_one({"_id": SECOND}))["tags"], [TAG])

    async def test_mixed_case_tags_are_deduplicated_and_foreign_tags_are_rejected(self):
        await self.add_tags(TAG)
        await self.add_note(NOTE, [])
        await self.db.tags.insert_one({"_id": OTHER_TAG, "user_id": FOREIGN, "name": "Foreign"})
        data = {"tags": [str(TAG).upper(), str(TAG), str(TAG)]}
        created = await self.client.post("/notes/", json={"title": "New", "content": "", **data})
        self.assertEqual(set(created.json()), {"inserted_id"})
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual((await self.db.notes.find_one({"_id": ObjectId(created.json()["inserted_id"])}))["tags"], [TAG])
        self.assertEqual((await self.client.patch(f"/notes/{NOTE}", json=data)).status_code, 200)
        invalid = {"tags": [str(OTHER_TAG).upper(), str(OTHER_TAG)], "items": [{"id": str(NOTE), "type": "note"}]}
        self.assertEqual((await self.client.post("/bulk/tags/add", json=invalid)).status_code, 400)
        self.assertEqual((await self.db.notes.find_one({"_id": NOTE}))["tags"], [TAG])

    async def test_tag_deletion_and_assignment_are_serialized(self):
        await self.add_tags(TAG)
        await self.add_note(NOTE, [])
        paused, release = asyncio.Event(), asyncio.Event()
        original = tags.count_usage

        async def pause_after_count(*args):
            counts = await original(*args)
            paused.set()
            await release.wait()
            return counts

        with patch.object(tags, "count_usage", side_effect=pause_after_count):
            async with asyncio.TaskGroup() as tasks:
                deleting = tasks.create_task(self.client.delete(f"/tags/?ids={TAG}&confirm=true"))
                await asyncio.wait_for(paused.wait(), 2)
                assigning = tasks.create_task(self.client.patch(f"/notes/{NOTE}", json={"tags": [str(TAG)]}))
                await self.wait_for_queued_request()
                release.set()
        self.assertEqual(deleting.result().status_code, 200)
        self.assertEqual(assigning.result().status_code, 400)
        self.assertEqual((await self.db.notes.find_one({"_id": NOTE}))["tags"], [])

    async def test_concurrent_adds_at_the_limit_and_no_op_retry(self):
        await self.add_tags(TAG, OTHER_TAG)
        await self.add_note(NOTE, [ObjectId() for _ in range(99)])
        paused, release = asyncio.Event(), asyncio.Event()
        original = bulk._check_tag_capacity

        async def pause_after_capacity_check(*args):
            await original(*args)
            if not paused.is_set():
                paused.set()
                await release.wait()

        async def assign(tag):
            return await self.client.post("/bulk/tags/add", json={
                "items": [{"id": str(NOTE), "type": "note"}], "tags": [str(tag).upper(), str(tag)],
            })

        with patch.object(bulk, "_check_tag_capacity", side_effect=pause_after_capacity_check):
            async with asyncio.TaskGroup() as tasks:
                first = tasks.create_task(assign(TAG))
                await asyncio.wait_for(paused.wait(), 2)
                second = tasks.create_task(assign(OTHER_TAG))
                await self.wait_for_queued_request()
                release.set()
        self.assertEqual(first.result().json(), {"matched": 1, "modified": 1})
        self.assertEqual(second.result().status_code, 400)
        doc = await self.db.notes.find_one({"_id": NOTE})
        self.assertEqual(len(doc["tags"]), 100)
        self.assertEqual((await assign(TAG)).json(), {"matched": 1, "modified": 0})
        self.assertEqual((await self.db.notes.find_one({"_id": NOTE}))["updated_at"], doc["updated_at"])

    async def test_bulk_preflight_counts_existing_entries_and_rejects_non_arrays(self):
        await self.add_tags(TAG, OTHER_TAG)
        await self.add_note(NOTE, [TAG] * 100)
        payload = {"items": [{"id": str(NOTE), "type": "note"}], "tags": [str(OTHER_TAG)]}
        overflow = await self.client.post("/bulk/tags/add", json=payload)
        self.assertEqual(overflow.status_code, 400, overflow.text)
        self.assertEqual((await self.db.notes.find_one({"_id": NOTE}))["tags"], [TAG] * 100)
        await self.db.notes.update_one({"_id": NOTE}, {"$set": {"tags": None}})
        invalid = await self.client.post("/bulk/tags/add", json=payload)
        self.assertEqual(invalid.status_code, 409, invalid.text)
        self.assertIsNone((await self.db.notes.find_one({"_id": NOTE}))["tags"])

    async def test_link_create_prevents_reverse_duplicate_and_races_safely_with_delete(self):
        for item_id in (NOTE, SECOND):
            await self.add_note(item_id, [])
        paused, release = asyncio.Event(), asyncio.Event()
        original = link_routes.link_exists

        async def pause_after_lookup(*args):
            exists = await original(*args)
            if not paused.is_set():
                paused.set()
                await release.wait()
            return exists

        async def link(a, b):
            return await self.client.post("/links/", json={
                "item_a_id": str(a).upper(), "item_a_type": "note", "item_b_id": str(b), "item_b_type": "note",
            })

        self.assertEqual((await link(NOTE, NOTE)).status_code, 422)
        with patch.object(link_routes, "link_exists", side_effect=pause_after_lookup):
            async with asyncio.TaskGroup() as tasks:
                first = tasks.create_task(link(SECOND, NOTE))
                await asyncio.wait_for(paused.wait(), 2)
                reversed_request = tasks.create_task(link(NOTE, SECOND))
                await self.wait_for_queued_request()
                release.set()
        self.assertEqual(first.result().status_code, 201)
        self.assertEqual(reversed_request.result().status_code, 409)
        doc = await self.db.links.find_one({})
        self.assertEqual((doc["item_a_id"], doc["item_b_id"]), tuple(sorted((NOTE, SECOND))))

        with patch.object(link_routes, "db", self.db):
            search = await self.client.get("/links/items", params={"q": "Fixture", "item_type": "note"})
            self.assertEqual(search.status_code, 200)
            self.assertCountEqual(search.json(), [
                {"id": str(item_id), "type": "note", "title": "Fixture"} for item_id in (NOTE, SECOND)
            ])
            adjacent = await self.client.get(f"/links/note/{NOTE}")
            self.assertEqual(adjacent.status_code, 200)
            self.assertEqual(adjacent.json(), [{
                "link_id": str(doc["_id"]), "item_id": str(SECOND), "item_type": "note", "title": "Fixture",
            }])
        deleted_link = await self.client.delete(f"/links/{doc['_id']}")
        self.assertEqual((deleted_link.status_code, deleted_link.json()), (200, {"deleted": 1}))
        reverse = {**doc, "item_a_id": doc["item_b_id"], "item_b_id": doc["item_a_id"]}
        await self.db.links.insert_one(reverse)
        self.assertEqual((await link(NOTE, SECOND)).status_code, 409)
        await self.client.delete(f"/links/{doc['_id']}")
        paused.clear()
        release.clear()
        with patch.object(link_routes, "link_exists", side_effect=pause_after_lookup):
            async with asyncio.TaskGroup() as tasks:
                adding = tasks.create_task(link(NOTE, SECOND))
                await asyncio.wait_for(paused.wait(), 2)
                deleting = tasks.create_task(self.client.delete(f"/notes/{SECOND}"))
                await self.wait_for_queued_request()
                release.set()
        self.assertEqual(adding.result().status_code, 201)
        self.assertEqual(deleting.result().status_code, 200)
        self.assertEqual(await self.db.links.count_documents({}), 0)
