import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from python_multipart.multipart import parse_options_header
from starlette.datastructures import FormData, UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser
from starlette.requests import ClientDisconnect

from core.files import FileUploadService, finish_on_cancel
from core.security import get_current_user
from models.files import FileCreate, FilePublic
from models.users import UserPublic


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/files", tags=["Files"])
_REQUEST_LIMIT = 11 * 1024 * 1024
_METADATA_LIMIT = 16 * 1024


class _UploadParser(MultiPartParser):
    def __init__(self, request: Request, max_file_size: int):
        super().__init__(
            request.headers, self._bounded_body(request), max_files=1, max_fields=1, max_part_size=_METADATA_LIMIT,
        )
        self.max_file_size = max_file_size
        # Keep the bounded spool in memory during receive. It rolls to disk in the worker
        # when validation needs a descriptor, so parser cancellation can close it immediately.
        self.spool_max_size = min(max_file_size, _REQUEST_LIMIT)
        self.part_bytes = 0
        self.complete = False

    def on_part_begin(self) -> None:
        super().on_part_begin()
        self.part_bytes = 0

    def on_headers_finished(self) -> None:
        super().on_headers_finished()
        part = self._current_part
        expected = "file" if part.file is not None else "metadata"
        if part.field_name != expected:
            raise MultiPartException("Expected one binary file and one text metadata field.")

    def on_part_data(self, data: bytes, start: int, end: int) -> None:
        self.part_bytes += end - start
        limit = self.max_file_size if self._current_part.file is not None else _METADATA_LIMIT
        if self.part_bytes > limit:
            raise HTTPException(413, "Upload file or metadata exceeds its size limit.")
        super().on_part_data(data, start, end)

    def on_end(self) -> None:
        self.complete = True

    async def _bounded_body(self, request: Request):
        received = 0
        async for chunk in request.stream():
            received += len(chunk)
            if received > _REQUEST_LIMIT:
                raise HTTPException(413, "Upload request exceeds 11 MiB.")
            yield chunk

        # Raise inside Starlette's parser so it closes even a spool for an unfinished part.
        if not self.complete:
            raise MultiPartException("Multipart upload ended before the closing boundary.")


async def _read_form(request: Request, service: FileUploadService) -> FormData:
    media_type, _ = parse_options_header(request.headers.get("content-type"))
    if media_type != b"multipart/form-data":
        raise HTTPException(415, "Expected multipart/form-data.")
    try:
        async with asyncio.timeout(service.settings.upload_read_timeout):
            return await _UploadParser(request, service.settings.max_size).parse()
    except TimeoutError:
        raise HTTPException(408, "Upload timed out while receiving the request.") from None
    except (MultiPartException, ClientDisconnect):
        raise HTTPException(422, "Invalid or incomplete multipart upload.") from None
    except OSError:
        logger.exception("Could not spool the incoming upload")
        raise HTTPException(503, "Upload storage is temporarily unavailable.") from None


@router.post("/", status_code=201, response_model=FilePublic)
async def upload_file(request: Request, user: UserPublic = Depends(get_current_user)) -> FilePublic:
    # A declarative Form or File parameter would let FastAPI parse before authenticating.
    service: FileUploadService = request.app.state.file_uploads
    async with service.upload_slot():
        form = await _read_form(request, service)
        try:
            incoming = form.get("file")
            raw_metadata = form.get("metadata")
            if not isinstance(incoming, UploadFile) or not isinstance(raw_metadata, str):
                raise HTTPException(422, "Expected one binary file and one text metadata field.")
            try:
                metadata = FileCreate.model_validate_json(raw_metadata)
            except ValidationError as error:
                issues = error.errors(include_context=False, include_input=False, include_url=False)
                for issue in issues:
                    issue["loc"] = ("body", "metadata", *issue["loc"])
                raise RequestValidationError(issues) from None
            return await service.upload(user, metadata, incoming)
        finally:
            await finish_on_cancel(form.close())
