import asyncio
import hashlib
import os
import struct
import subprocess
import sys
import threading
import unittest
import zlib
from dataclasses import replace
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from secrets import token_hex
from tempfile import SpooledTemporaryFile, TemporaryDirectory
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from bson import ObjectId
from fastapi import FastAPI, HTTPException, Request
from httpx import ASGITransport, AsyncClient
from pymongo import AsyncMongoClient
from pymongo.errors import AutoReconnect
from starlette.datastructures import UploadFile

with patch.dict(os.environ, {"MONGO_URL": "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=100"}):
    from main import create_app

from core import files, security
from core.file_config import FileSettings, load_file_settings
from core.file_validation import UploadValidationError, ValidatedUpload, _validate_image, inspect_upload
from models.files import FileCreate, FilePublic
from models.users import UserPublic
from routers.files import router


NOW = datetime.now(timezone.utc)
USER = UserPublic(id=ObjectId(), email="owner@example.org", username="owner", created_at=NOW)
METADATA = FileCreate(title="Lecture")
JSON_METADATA = METADATA.model_dump_json()
BODY_LIMIT = 11 * 1024 * 1024
MONGO_PORT = os.getenv("STUDYDESK_INTEGRITY_MONGO_PORT")


def png_or_jpeg(kind="PNG", *, multi_frame=False) -> bytes:
    from PIL import Image

    with BytesIO() as output, Image.new("RGB", (2, 2), "white") as image:
        if multi_frame:
            with Image.new("RGB", (2, 2), "black") as second:
                image.save(output, kind, save_all=True, append_images=[second], duration=100)
        else:
            image.save(output, kind)
        return output.getvalue()


def pdf(*, encrypted=False) -> bytes:
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    if encrypted:
        writer.encrypt("example")
    with BytesIO() as output:
        writer.write(output)
        return output.getvalue()


def incoming_upload(data: bytes, filename="slides.png") -> UploadFile:
    spool = SpooledTemporaryFile(max_size=1024 * 1024)
    spool.write(data)
    spool.seek(0)
    return UploadFile(spool, filename=filename, size=len(data))


@unittest.skipUnless(sys.platform == "linux", "Validation worker runs in Linux Docker")
class FileValidationTests(unittest.TestCase):
    def validate(self, data, name):
        incoming = incoming_upload(data, name)
        with incoming.file:
            return inspect_upload(incoming.file, name, len(data), timeout=10, memory_bytes=512 * 1024 * 1024)

    def test_preserves_bytes_and_uses_verified_format_and_sanitized_filename(self):
        for data, name, mime in (
            (pdf(), "outline.PDF", "application/pdf"),
            (png_or_jpeg(), "figure.PNG", "image/png"),
            (png_or_jpeg("JPEG"), "příprava (1).JpEg", "image/jpeg"),
        ):
            with self.subTest(name=name):
                result = self.validate(data, "C:\\incoming\\" + "\x01" + name)
                self.assertEqual(result, ValidatedUpload(name, mime, len(data), hashlib.sha256(data).hexdigest()))

    def test_rejects_mismatched_corrupted_encrypted_and_multi_frame_files(self):
        png = png_or_jpeg()
        for data, name, status in (
            (b"", "empty.png", 422),
            (png, "mismatch.pdf", 415),
            (png, "unsupported.gif", 415),
            (png[:-19], "truncated.png", 422),
            (b"%PDF-1.7\nno xref", "broken.pdf", 422),
            (pdf(encrypted=True), "encrypted.pdf", 422),
            (png_or_jpeg(multi_frame=True), "animation.png", 422),
        ):
            with self.subTest(name=name):
                with self.assertRaises(UploadValidationError) as error:
                    self.validate(data, name)
                self.assertEqual(error.exception.status_code, status)

    def test_rejects_images_over_the_pixel_limit_before_decode(self):
        from PIL import Image

        data = bytearray(png_or_jpeg())
        data[16:24] = struct.pack(">II", 10_001, 5_000)
        data[29:33] = struct.pack(">I", zlib.crc32(data[12:29]))
        with self.assertRaises(Image.DecompressionBombWarning):
            _validate_image(BytesIO(data), "PNG")

    def test_worker_receives_configured_memory_and_deadline(self):
        data = png_or_jpeg()
        incoming = incoming_upload(data)
        with incoming.file, patch(
            "core.file_validation.subprocess.run", side_effect=subprocess.TimeoutExpired("worker", 3),
        ) as worker:
            with self.assertRaisesRegex(UploadValidationError, "time limit"):
                inspect_upload(incoming.file, "slide.png", len(data), timeout=3, memory_bytes=201326592)
        self.assertEqual(worker.call_args.args[0][-1], "201326592")
        self.assertEqual(worker.call_args.kwargs["timeout"], 3)


class FileUploadSettingsTests(unittest.TestCase):
    def test_limits_load_from_environment_and_are_positive(self):
        overrides = {
            "FILE_UPLOAD_CONCURRENCY": "3", "FILE_VALIDATION_CONCURRENCY": "1",
            "FILE_UPLOAD_READ_TIMEOUT_SECONDS": "20", "FILE_VALIDATION_TIMEOUT_SECONDS": "5",
            "FILE_VALIDATION_MEMORY_BYTES": "201326592", "FILE_DISK_HEADROOM_BYTES": "1024",
        }
        with patch.dict(os.environ, overrides, clear=True):
            settings = load_file_settings()
        self.assertEqual(settings, FileSettings(
            Path("/data/uploads"), 10485760, 524288000, 4294967296, upload_concurrency=3,
            validation_concurrency=1, upload_read_timeout=20, validation_timeout=5,
            validation_memory=201326592, disk_headroom=1024,
        ))
        with patch.dict(os.environ, {"FILE_VALIDATION_CONCURRENCY": "0"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "FILE_VALIDATION_CONCURRENCY"):
                load_file_settings()


class UploadRequestTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        root = Path(self.enterContext(TemporaryDirectory())).resolve()
        self.service = files.FileUploadService(FileSettings(root, 16, 64, 128, upload_concurrency=1), None)
        app = FastAPI()
        app.include_router(router)
        app.state.file_uploads = self.service
        app.state.jwt_secret = token_hex(32)
        account = {"_id": ObjectId(USER.id), "email": USER.email, "username": USER.username, "created_at": NOW}
        self.enterContext(patch.object(security, "users_collection", SimpleNamespace(find_one=AsyncMock(return_value=account))))
        token = security.generate_token(account, app.state.jwt_secret)
        self.auth = {"cookie": f"access_token={token}"}
        self.client = await self.enterAsyncContext(AsyncClient(transport=ASGITransport(app=app), base_url="http://test"))
        self.public = FilePublic(
            id=ObjectId(), title=METADATA.title, filename="slides.png", mime_type="image/png", size=16,
            created_at=NOW, updated_at=NOW,
        )
        self.upload = self.enterContext(patch.object(self.service, "upload", AsyncMock(return_value=self.public)))

    def multipart(self, content=b"x" * 16, metadata=JSON_METADATA):
        return self.client.build_request(
            "POST", "/files/", files={"file": ("slides.png", content, "text/plain")}, data={"metadata": metadata},
        )

    async def unreadable_body(self):
        self.fail("Request body was read before admission")
        yield b""

    async def test_authentication_and_upload_slots_precede_any_body_read(self):
        headers = {"content-type": "multipart/form-data; boundary=test"}
        anonymous = await self.client.post("/files/", headers=headers, content=self.unreadable_body())
        self.assertEqual(anonymous.status_code, 401)
        async with self.service.upload_slot():
            response = await asyncio.create_task(self.client.post(
                "/files/", headers={**headers, **self.auth}, content=self.unreadable_body(),
            ))
        self.assertEqual(response.status_code, 503)
        self.upload.assert_not_awaited()

    async def test_bounded_file_and_metadata_and_spool_cleanup(self):
        for content, metadata, expected in (
            (b"x" * 16, JSON_METADATA, 201),
            (b"x" * 17, JSON_METADATA, 413),
            (b"x", "{" + " " * (16 * 1024), 413),
            (b"x", '{"title":null}', 422),
        ):
            with self.subTest(expected=expected):
                request = self.multipart(content, metadata)
                request.headers.update(self.auth)
                response = await self.client.send(request)
                self.assertEqual(response.status_code, expected, response.text)
        self.upload.assert_awaited_once()
        self.assertTrue(self.upload.await_args.args[2].file.closed)

    async def test_chunked_body_at_and_above_the_actual_request_limit(self):
        request = self.multipart()
        envelope = request.read()
        headers = {**self.auth, "content-type": request.headers["content-type"]}

        async def padded_body(size):
            yield envelope
            # Multipart permits an epilogue. It still counts toward the wire limit.
            remaining = size - len(envelope)
            while remaining:
                chunk_size = min(remaining, 65536)
                yield b"x" * chunk_size
                remaining -= chunk_size

        for size, expected in ((BODY_LIMIT, 201), (BODY_LIMIT + 1, 413)):
            with self.subTest(size=size):
                response = await self.client.post("/files/", headers=headers, content=padded_body(size))
                self.assertEqual(response.status_code, expected, response.text)
        self.upload.assert_awaited_once()

    async def test_rejects_duplicate_files_and_missing_closing_boundary(self):
        request = self.multipart()
        spools = []

        def track_spool(**options):
            spool = SpooledTemporaryFile(**options)
            spools.append(spool)
            return spool

        with patch("starlette.formparsers.SpooledTemporaryFile", side_effect=track_spool):
            truncated = await self.client.post(
                "/files/", headers={**self.auth, "content-type": request.headers["content-type"]},
                content=request.read()[:-5],
            )
        self.assertEqual(len(spools), 1)
        self.assertTrue(spools[0].closed)
        duplicate = await self.client.post(
            "/files/", headers=self.auth, files=[("file", ("a.png", b"x")), ("file", ("b.png", b"y"))],
            data={"metadata": JSON_METADATA},
        )
        self.assertEqual(truncated.status_code, 422)
        self.assertEqual(duplicate.status_code, 422)
        self.upload.assert_not_awaited()

    def test_active_app_has_no_upload_route(self):
        self.assertNotIn("/files/", create_app().openapi()["paths"])


@unittest.skipUnless(sys.platform == "linux", "Managed publication runs in Linux Docker")
class UploadPublicationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.root = Path(self.enterContext(TemporaryDirectory())).resolve()
        settings = FileSettings(self.root, 16, 64, 128, validation_concurrency=1)
        self.collection = SimpleNamespace(
            write_concern=SimpleNamespace(acknowledged=True),
            aggregate=AsyncMock(return_value=SimpleNamespace(to_list=AsyncMock(return_value=[]))),
            insert_one=AsyncMock(return_value=SimpleNamespace(acknowledged=True)),
            find_one=AsyncMock(return_value=None), delete_one=AsyncMock(),
            find_one_and_update=AsyncMock(side_effect=self.mark_ready),
        )
        self.accounts = SimpleNamespace(find_one=AsyncMock(return_value={"_id": ObjectId(USER.id)}))
        self.enterContext(patch.object(security, "users_collection", self.accounts))
        self.enterContext(patch.object(files, "available_disk_bytes", return_value=settings.disk_headroom + 3))
        self.enterContext(patch.object(files, "logger"))
        self.data = b"abc"
        self.verified = ValidatedUpload("slide.png", "image/png", 3, hashlib.sha256(self.data).hexdigest())
        self.validate = self.enterContext(patch.object(files, "inspect_upload", return_value=self.verified))
        self.service = files.FileUploadService(settings, self.collection)

    async def mark_ready(self, pending, update, *, return_document):
        document = self.collection.insert_one.await_args.args[0]
        self.assertEqual(pending, {"_id": document["_id"], "user_id": document["user_id"], "status": "pending"})
        self.assertEqual((self.root / document["storage_path"]).read_bytes(), self.data)
        return {**document, **update["$set"]}

    async def attempt(self):
        incoming = incoming_upload(self.data)
        with incoming.file:
            return await self.service.upload(USER, METADATA, incoming)

    async def assert_upload_error(self, status):
        with self.assertRaises(HTTPException) as error:
            await self.attempt()
        self.assertEqual(error.exception.status_code, status)

    async def test_rechecks_account_under_lock_before_reserving(self):
        self.accounts.find_one.return_value = None
        await self.assert_upload_error(401)
        self.validate.assert_called_once()
        self.collection.insert_one.assert_not_awaited()
        self.assertEqual(list(self.root.iterdir()), [])

    async def test_disk_headroom_is_checked_before_reserving(self):
        files.available_disk_bytes.return_value -= 1
        await self.assert_upload_error(503)
        self.collection.insert_one.assert_not_awaited()
        self.assertEqual(list(self.root.iterdir()), [])

    async def test_failed_rename_removes_bytes_before_dropping_reservation(self):
        async def check_cleanup(query):
            self.assertEqual(list(self.root.rglob("*.tmp")), [])
            self.assertEqual(query["status"], "pending")

        self.collection.delete_one.side_effect = check_cleanup
        with patch("core.storage.os.rename", side_effect=OSError("rename failed")):
            await self.assert_upload_error(503)
        self.collection.delete_one.assert_awaited_once()
        self.collection.find_one_and_update.assert_not_awaited()

    async def test_failed_cleanup_keeps_pending_metadata(self):
        with (patch("core.storage.os.rename", side_effect=OSError("rename failed")),
              patch("core.storage.os.unlink", side_effect=OSError("cleanup failed")),
              patch("core.storage.logger")):
            await self.assert_upload_error(503)
        self.collection.delete_one.assert_not_awaited()
        self.collection.find_one_and_update.assert_not_awaited()
        self.assertEqual(len(list(self.root.rglob("*.tmp"))), 1)

    async def test_ambiguous_ready_write_keeps_the_published_bytes(self):
        self.collection.find_one_and_update.side_effect = AutoReconnect("ready acknowledgment lost")
        await self.assert_upload_error(503)
        document = self.collection.insert_one.await_args.args[0]
        self.assertEqual((self.root / document["storage_path"]).read_bytes(), self.data)
        self.collection.delete_one.assert_not_awaited()

    async def test_ambiguous_insert_checks_the_reservation_and_pauses_when_unconfirmed(self):
        self.collection.insert_one.side_effect = AutoReconnect("reservation acknowledgment lost")
        self.collection.find_one.side_effect = [{"_id": ObjectId()}, None]
        await self.assert_upload_error(503)
        async with self.service.upload_slot():
            await self.assert_upload_error(503)
        with self.assertRaisesRegex(HTTPException, "paused"):
            async with self.service.upload_slot():
                self.fail("Unconfirmed reservation should pause admission")
        self.assertEqual(self.collection.find_one.await_count, 2)
        self.collection.delete_one.assert_not_awaited()
        self.assertEqual(list(self.root.iterdir()), [])

    async def test_cancellation_waits_for_physical_write_and_keeps_both_locks(self):
        started = asyncio.Event()
        release = threading.Event()
        loop = asyncio.get_running_loop()
        publish = files.publish_file

        def delayed_publish(*args):
            loop.call_soon_threadsafe(started.set)
            if not release.wait(5):
                raise TimeoutError("Test did not release the publication")
            publish(*args)

        with patch.object(files, "publish_file", side_effect=delayed_publish):
            request = asyncio.create_task(self.attempt())
            try:
                await asyncio.wait_for(started.wait(), timeout=3)
                request.cancel()
                await asyncio.sleep(0)
                self.assertFalse(request.done())
                self.assertTrue(security._account_write_locks[USER.id].locked())
                self.assertTrue(self.service._upload_lock.locked())
                self.collection.find_one_and_update.assert_not_awaited()
            finally:
                release.set()
                await asyncio.gather(request, return_exceptions=True)
        self.assertTrue(request.cancelled())
        self.assertFalse(self.service._upload_lock.locked())
        self.collection.find_one_and_update.assert_awaited_once()

    async def test_configured_validation_limit_keeps_second_worker_waiting(self):
        started = asyncio.Event()
        release = threading.Event()
        loop = asyncio.get_running_loop()

        def blocked_validator(*args, **kwargs):
            loop.call_soon_threadsafe(started.set)
            if not release.wait(5):
                raise TimeoutError("Test did not release the validation")
            raise UploadValidationError(422, "Invalid test contents")

        self.validate.side_effect = blocked_validator
        first = asyncio.create_task(self.assert_upload_error(422))
        second = asyncio.create_task(self.assert_upload_error(422))
        try:
            await asyncio.wait_for(started.wait(), timeout=3)
            self.assertEqual(self.validate.call_count, 1)
        finally:
            release.set()
            await asyncio.gather(first, second)
        self.assertEqual(self.validate.call_count, 2)


@unittest.skipUnless(MONGO_PORT and sys.platform == "linux", "Requires Linux and disposable MongoDB")
class UploadQuotaIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_concurrent_uploads_respect_quota_and_publish_original_bytes(self):
        port = int(MONGO_PORT)
        self.assertNotIn(port, (27017, 27018), "Use a disposable MongoDB port")
        mongo = AsyncMongoClient(f"mongodb://127.0.0.1:{port}/?directConnection=true", tz_aware=True)
        self.addAsyncCleanup(mongo.close)
        db = mongo[f"studydesk_upload_{ObjectId()}"]
        self.addAsyncCleanup(mongo.drop_database, db.name)
        root = Path(self.enterContext(TemporaryDirectory())).resolve()
        data = png_or_jpeg()
        size = len(data)
        await db.files.insert_many([
            {"user_id": ObjectId(USER.id), "size": size, "status": "pending"},
            {"user_id": ObjectId(), "size": size, "status": "deleting"},
            {"user_id": ObjectId(), "size": size, "status": "ready"},
        ])

        other = USER.model_copy(update={"id": str(ObjectId())})
        users = {user.id: user for user in (USER, other)}
        accounts = SimpleNamespace(find_one=AsyncMock(return_value={"_id": ObjectId(USER.id)}))
        self.enterContext(patch.object(security, "users_collection", accounts))
        settings = FileSettings(root, size, size * 3, size * 4)
        app = FastAPI()
        app.include_router(router)
        app.state.file_uploads = files.FileUploadService(settings, db.files)

        def get_user(request: Request):
            return users[request.headers["x-test-user"]]

        app.dependency_overrides[security.get_current_user] = get_user
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            async def upload(user):
                return await client.post(
                    "/files/", headers={"x-test-user": user.id}, files={"file": ("slide.PNG", data, "text/plain")},
                    data={"metadata": JSON_METADATA},
                )

            responses = await asyncio.gather(upload(USER), upload(other))
            self.assertEqual(sorted(response.status_code for response in responses), [201, 409])
            app.state.file_uploads = files.FileUploadService(replace(settings, user_quota=size), db.files)
            user_limit = await upload(USER)
            self.assertEqual(user_limit.status_code, 409)
            self.assertIn("Your file storage quota", user_limit.json()["detail"])

        accepted = next(response.json() for response in responses if response.status_code == 201)
        self.assertEqual(accepted["mime_type"], "image/png")
        self.assertTrue({"sha256", "storage_path", "status"}.isdisjoint(accepted))
        document = await db.files.find_one({"_id": ObjectId(accepted["id"])})
        self.assertEqual(document["status"], "ready")
        self.assertEqual(document["sha256"], hashlib.sha256(data).hexdigest())
        self.assertEqual((root / document["storage_path"]).read_bytes(), data)
        self.assertEqual(list(root.rglob("*.tmp")), [])
