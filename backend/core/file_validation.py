import hashlib
import re
import subprocess
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO


_EXTENSIONS = {".pdf": "PDF", ".png": "PNG", ".jpg": "JPEG", ".jpeg": "JPEG"}
_SIGNATURES = {"PDF": b"%PDF-", "PNG": b"\x89PNG\r\n\x1a\n", "JPEG": b"\xff\xd8\xff"}
_MIME_TYPES = {"PDF": "application/pdf", "PNG": "image/png", "JPEG": "image/jpeg"}
_BIDI_CONTROLS = "\u061c\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069"
_IMAGE_PIXELS = 50_000_000
_INVALID_CONTENT = 2
_WORKER_FAILURE = 3
_FORMAT_MISMATCH = 4


class UploadValidationError(ValueError):
    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class ValidatedUpload:
    filename: str
    mime_type: str
    size: int
    sha256: str


def inspect_upload(
    source: BinaryIO, filename: str, size: int, *, timeout: int, memory_bytes: int,
) -> ValidatedUpload:
    """Validate a seekable upload and hash its original bytes. Run in a worker thread."""
    if size <= 0:
        raise UploadValidationError(422, "The file is empty.")

    filename = _sanitize_filename(filename)
    kind = _EXTENSIONS.get(Path(filename).suffix.lower())
    if kind is None:
        raise UploadValidationError(415, "Supported formats are PDF, PNG and JPEG.")

    source.seek(0)
    if not source.read(8).startswith(_SIGNATURES[kind]):
        raise UploadValidationError(415, "The file content does not match its extension.")
    source.seek(0)
    _validate_in_worker(source, kind, timeout, memory_bytes)

    # The subprocess reads an inherited file descriptor. Rewind before hashing and publishing.
    source.seek(0)
    sha256 = hashlib.file_digest(source, "sha256").hexdigest()
    source.seek(0)
    return ValidatedUpload(filename, _MIME_TYPES[kind], size, sha256)


def _sanitize_filename(filename: str) -> str:
    filename = filename.replace("\\", "/").rsplit("/", 1)[-1]
    filename = "".join(
        char for char in filename if unicodedata.category(char) != "Cc" and char not in _BIDI_CONTROLS
    ).strip()
    if not filename or filename in {".", ".."} or len(filename) > 255:
        raise UploadValidationError(422, "The file name is invalid.")
    return filename


def _validate_in_worker(source: BinaryIO, kind: str, timeout: int, memory_bytes: int) -> None:
    if sys.platform != "linux":
        raise UploadValidationError(503, "File validation requires the Linux runtime.")
    try:
        # A seekable stdin avoids copying the upload into a pipe or passing a writable file path.
        result = subprocess.run(
            [sys.executable, "-m", "core.file_validation", kind, str(memory_bytes)],
            stdin=source, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            cwd=Path(__file__).resolve().parents[1], env={}, timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        # subprocess.run kills and reaps the child before raising.
        raise UploadValidationError(422, "The file exceeded the validation time limit.") from None
    if result.returncode == _FORMAT_MISMATCH:
        raise UploadValidationError(415, "The file content does not match its extension.")
    if result.returncode == _INVALID_CONTENT:
        raise UploadValidationError(422, "The file is corrupted or exceeds the validation limits.")
    if result.returncode:
        raise UploadValidationError(503, "File validation is temporarily unavailable.")


class _FormatMismatch(ValueError):
    pass


def _validate_image(source: BinaryIO, kind: str) -> None:
    import warnings

    from PIL import Image

    Image.MAX_IMAGE_PIXELS = _IMAGE_PIXELS
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(source, formats=[kind]) as image:
            if getattr(image, "n_frames", 1) != 1:
                raise ValueError("Multiple image frames")
            if image.format != kind:
                raise _FormatMismatch
            image.verify()
        # verify() checks the container. Reopen to require a successful pixel decode too.
        source.seek(0)
        with Image.open(source, formats=[kind]) as image:
            image.load()


def _validate_pdf(source: BinaryIO) -> None:
    from pypdf import PdfReader

    if not re.fullmatch(rb"%PDF-[0-9]\.[0-9][\r\n]", source.read(9)):
        raise ValueError("Invalid PDF header")
    source.seek(0)
    with PdfReader(source, strict=True) as reader:
        if reader.is_encrypted:
            raise ValueError("Encrypted PDF")
        # Resolve the page tree and parse page instructions without rendering pages.
        for page in reader.pages:
            contents = page.get_contents()
            if contents is not None:
                _ = contents.operations


def _worker(kind: str, memory_bytes: int) -> int:
    try:
        import resource

        _, inherited_hard_limit = resource.getrlimit(resource.RLIMIT_AS)
        if inherited_hard_limit != resource.RLIM_INFINITY:
            memory_bytes = min(memory_bytes, inherited_hard_limit)
        resource.setrlimit(resource.RLIMIT_AS, (memory_bytes, memory_bytes))
    except (ImportError, OSError, ValueError, OverflowError):
        return _WORKER_FAILURE

    try:
        if kind == "PDF":
            _validate_pdf(sys.stdin.buffer)
        else:
            _validate_image(sys.stdin.buffer, kind)
    except _FormatMismatch:
        return _FORMAT_MISMATCH
    except ImportError:
        return _WORKER_FAILURE
    except Exception:
        # Parser errors vary by format. Keep details and untrusted metadata out of responses.
        return _INVALID_CONTENT
    return 0


if __name__ == "__main__":
    raise SystemExit(_worker(sys.argv[1], int(sys.argv[2])))
