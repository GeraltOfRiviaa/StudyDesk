import asyncio
import logging
from collections.abc import Coroutine
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
from typing import Any, BinaryIO, TypeVar

from anyio import CancelScope, CapacityLimiter, WouldBlock
from bson import ObjectId
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError, WriteError
from starlette.datastructures import UploadFile

from core.file_config import FileSettings
from core.file_validation import UploadValidationError, ValidatedUpload, inspect_upload
from core.items import prepare_item_create
from core.security import account_writer
from core.storage import PublicationError, StorageError, available_disk_bytes, generate_storage_path, publish_file
from models.files import FileCreate, FilePublic, FileStatusEnum
from models.types import MimeTypesEnum
from models.users import UserPublic


logger = logging.getLogger(__name__)
_PENDING = FileStatusEnum.pending.value
_READY = FileStatusEnum.ready.value
T = TypeVar("T")


async def finish_on_cancel(operation: Coroutine[Any, Any, T]) -> T:
    """Keep locks and input resources alive until dispatched work actually finishes."""
    task = asyncio.create_task(operation)
    try:
        return await asyncio.shield(task)
    except asyncio.CancelledError:
        # AnyIO scopes and repeated asyncio cancellations must both leave time to join the task.
        with CancelScope(shield=True):
            while not task.done():
                with suppress(asyncio.CancelledError, Exception):
                    await asyncio.shield(task)
            with suppress(asyncio.CancelledError, Exception):
                task.result()
        raise


class FileUploadService:
    def __init__(self, settings: FileSettings, collection):
        self.settings = settings
        self._collection = collection
        self._upload_slots = CapacityLimiter(settings.upload_concurrency)
        self._validation_slots = CapacityLimiter(settings.validation_concurrency)
        self._upload_lock = asyncio.Lock()
        self._admission_paused = False

    @asynccontextmanager
    async def upload_slot(self):
        if self._admission_paused:
            raise HTTPException(503, "File uploads are paused pending storage reconciliation.")
        try:
            self._upload_slots.acquire_nowait()
        except WouldBlock:
            raise HTTPException(503, "Too many uploads are in progress.") from None
        try:
            yield
        finally:
            self._upload_slots.release()

    async def upload(self, user: UserPublic, metadata: FileCreate, incoming: UploadFile) -> FilePublic:
        try:
            async with self._validation_slots:
                verified = await finish_on_cancel(run_in_threadpool(
                    inspect_upload, incoming.file, incoming.filename or "", incoming.size or 0,
                    timeout=self.settings.validation_timeout, memory_bytes=self.settings.validation_memory,
                ))
        except UploadValidationError as error:
            raise HTTPException(error.status_code, str(error)) from None
        except OSError:
            logger.exception("Could not read or validate the incoming upload")
            raise HTTPException(503, "File validation is temporarily unavailable.") from None

        try:
            async with account_writer(user):
                try:
                    item = await prepare_item_create(user.id, metadata.title, metadata.tags)
                except HTTPException as error:
                    if error.status_code == 400:
                        raise HTTPException(422, error.detail) from None
                    raise
                async with self._upload_lock:
                    # Once admission starts, cancellation waits for both database and filesystem work.
                    document = await finish_on_cancel(self._publish(item, verified, incoming.file))
        except (PyMongoError, OSError, StorageError):
            logger.exception("Could not complete the file upload")
            raise HTTPException(503, "File storage is temporarily unavailable.") from None
        return FilePublic.model_validate({**document, "id": document["_id"]})

    async def _publish(self, item: dict, verified: ValidatedUpload, source: BinaryIO) -> dict:
        if self._admission_paused:
            raise HTTPException(503, "File uploads are paused pending storage reconciliation.")
        if not self._collection.write_concern.acknowledged:
            raise HTTPException(503, "File uploads require acknowledged storage writes.")
        await self._check_capacity(item["user_id"], verified.size)

        file_id = ObjectId()
        storage_path = generate_storage_path(item["user_id"], file_id, MimeTypesEnum(verified.mime_type))
        document = {
            **item, "_id": file_id, "storage_path": storage_path, "status": _PENDING,
            "filename": verified.filename, "mime_type": verified.mime_type,
            "size": verified.size, "sha256": verified.sha256,
        }
        pending = {"_id": file_id, "user_id": item["user_id"], "status": _PENDING}
        await self._reserve(document, pending)

        try:
            await run_in_threadpool(publish_file, self.settings.root, storage_path, source, verified.size)
        except PublicationError as error:
            if error.artifacts_removed:
                # The reservation can only be removed after its managed bytes are gone.
                await self._collection.delete_one(pending)
            raise

        # Any failure after this dispatch can leave a ready record. Reconciliation owns cleanup.
        ready = await self._collection.find_one_and_update(
            pending, {"$set": {"status": _READY, "updated_at": datetime.now(timezone.utc)}},
            return_document=ReturnDocument.AFTER,
        )
        if ready is None:
            raise StorageError("Could not confirm the file publication.")
        return ready

    async def _reserve(self, document: dict, pending: dict) -> None:
        try:
            result = await self._collection.insert_one(document)
        except (DuplicateKeyError, WriteError):
            raise
        except PyMongoError:
            await self._confirm_reservation_or_pause(pending, document["size"])
            raise
        if not result.acknowledged:
            await self._confirm_reservation_or_pause(pending, document["size"])
            raise StorageError("Could not confirm the file reservation.")

    async def _confirm_reservation_or_pause(self, pending: dict, size: int) -> None:
        # An absent read cannot rule out a late insert on another MongoDB connection.
        try:
            reserved = await self._collection.find_one({**pending, "size": size}, {"_id": 1})
        except PyMongoError:
            reserved = None
        if reserved is None:
            self._admission_paused = True
            logger.error("File admission paused after an unconfirmed reservation for %s", pending["_id"])

    async def _check_capacity(self, user_id: ObjectId, size: int) -> None:
        # Count reservations and deleting records until their metadata has actually been removed.
        cursor = await self._collection.aggregate([
            {"$match": {"status": {"$in": [state.value for state in FileStatusEnum]}}},
            {"$group": {
                "_id": None,
                "global_size": {"$sum": "$size"},
                "user_size": {"$sum": {"$cond": [{"$eq": ["$user_id", user_id]}, "$size", 0]}},
            }},
        ])
        totals = await cursor.to_list(length=1)
        usage = totals[0] if totals else {"global_size": 0, "user_size": 0}
        if usage["user_size"] + size > self.settings.user_quota:
            raise HTTPException(409, "Your file storage quota would be exceeded.")
        if usage["global_size"] + size > self.settings.global_quota:
            raise HTTPException(409, "The global file storage quota would be exceeded.")
        free_space = await run_in_threadpool(available_disk_bytes, self.settings.root)
        if free_space - size < self.settings.disk_headroom:
            raise HTTPException(503, "Insufficient disk space for the upload.")
