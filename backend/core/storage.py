import logging
import os
import re
import stat
from contextlib import ExitStack
from pathlib import Path
from shutil import disk_usage
from tempfile import NamedTemporaryFile
from typing import BinaryIO

from bson import ObjectId

from models.types import MimeTypesEnum


logger = logging.getLogger(__name__)
_APP_DIRECTORY = Path(__file__).resolve().parents[1]
_EXTENSIONS = {MimeTypesEnum.pdf: "pdf", MimeTypesEnum.png: "png", MimeTypesEnum.jpeg: "jpg"}
_EXTENSION_CHOICES = "|".join(_EXTENSIONS.values())
_MANAGED_PATH = re.compile(rf"[0-9a-f]{{24}}/[0-9a-f]{{24}}\.(?:{_EXTENSION_CHOICES})(?:\.tmp)?")


class StorageError(RuntimeError):
    pass


class PublicationError(StorageError):
    def __init__(self, *, artifacts_removed: bool):
        super().__init__("Could not publish the managed file.")
        self.artifacts_removed = artifacts_removed


def _entry_mode(path: Path) -> int:
    # lstat inspects the entry itself, including when a link's target is missing.
    entry = path.lstat()
    windows_reparse_point = os.name == "nt" and entry.st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT
    if stat.S_ISLNK(entry.st_mode) or windows_reparse_point:
        raise StorageError(f"Storage paths cannot contain symbolic links or reparse points: {path}")
    return entry.st_mode


def _validate_root(root: Path) -> Path:
    if not root.is_absolute() or ".." in root.parts:
        raise StorageError("FILE_STORAGE_ROOT must be an absolute directory without traversal.")

    # Check ancestors before descending so an existing symlink cannot redirect the next check.
    for directory in (*reversed(root.parents), root):
        if not stat.S_ISDIR(_entry_mode(directory)):
            raise StorageError(f"FILE_STORAGE_ROOT requires a directory at {directory}.")

    root = root.resolve(strict=True)
    if root.is_relative_to(_APP_DIRECTORY) or _APP_DIRECTORY.is_relative_to(root):
        raise StorageError("FILE_STORAGE_ROOT must be separate from the application directory.")
    return root


def verify_storage(root: Path) -> None:
    """Check that the process can use the provisioned root. Run in a worker thread."""
    try:
        _probe_storage(_validate_root(root))
    except OSError as error:
        raise StorageError(f"FILE_STORAGE_ROOT is unusable: {error}") from error


def _probe_storage(root: Path) -> None:
    probe_path = None
    verification_failed = False
    try:
        # Close before unlinking so the same cleanup works on Windows and Linux.
        with NamedTemporaryFile(
            dir=root, prefix=".studydesk-probe-", suffix=".tmp", delete=False, buffering=0,
        ) as probe:
            probe_path = Path(probe.name)
            if probe.write(b"1") != 1:
                raise StorageError("FILE_STORAGE_ROOT probe write was incomplete.")
            probe.seek(0)
            if probe.read(1) != b"1":
                raise StorageError("FILE_STORAGE_ROOT probe could not be read back.")
    except BaseException:
        verification_failed = True
        raise
    finally:
        if probe_path is not None:
            try:
                probe_path.unlink(missing_ok=True)
            except OSError:
                if not verification_failed:
                    raise
                # Preserve the startup error and report the probe that remains.
                logger.exception("Could not remove storage verification probe %s", probe_path)


def generate_storage_path(user_id: ObjectId, file_id: ObjectId, mime_type: MimeTypesEnum) -> str:
    if not isinstance(user_id, ObjectId) or not isinstance(file_id, ObjectId):
        raise StorageError("Managed storage paths require BSON ObjectIds.")
    extension = _EXTENSIONS.get(mime_type)
    if extension is None:
        raise StorageError("Unsupported MIME type for managed storage.")
    return f"{user_id}/{file_id}.{extension}"


def resolve_storage_path(root: Path, relative_path: str) -> Path:
    """Check a managed path without opening it. Run in a worker thread."""
    # Match the whole string before joining. This rejects absolute and traversal paths on either OS.
    if not _MANAGED_PATH.fullmatch(relative_path):
        raise StorageError("Invalid managed storage path.")

    target = _validate_root(root) / relative_path
    try:
        if not stat.S_ISDIR(_entry_mode(target.parent)):
            raise StorageError("Managed storage parent must be a directory.")
        if not stat.S_ISREG(_entry_mode(target)):
            raise StorageError("Managed storage destination must be a regular file.")
    except FileNotFoundError:
        # A valid owner directory or destination may not have been created yet.
        pass
    return target


def available_disk_bytes(root: Path) -> int:
    return disk_usage(_validate_root(root)).free


def publish_file(root: Path, relative_path: str, source: BinaryIO, size: int) -> None:
    """Stage and rename an upload on Linux. Run in a worker thread."""
    if not _MANAGED_PATH.fullmatch(relative_path) or relative_path.endswith(".tmp"):
        raise StorageError("Invalid managed destination.")
    owner_name, filename = relative_path.split("/", 1)

    # Keep directory descriptors open so a renamed path cannot redirect the write or cleanup.
    directory_flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    with ExitStack() as directories:
        root_fd = os.open(_validate_root(root), directory_flags)
        directories.callback(os.close, root_fd)
        try:
            os.mkdir(owner_name, mode=0o700, dir_fd=root_fd)
        except FileExistsError:
            pass
        else:
            os.fsync(root_fd)
        owner_fd = os.open(owner_name, directory_flags, dir_fd=root_fd)
        directories.callback(os.close, owner_fd)
        _write_and_rename(owner_fd, filename, source, size)


def _entry_exists(directory: int, name: str) -> bool:
    try:
        os.stat(name, dir_fd=directory, follow_symlinks=False)
    except FileNotFoundError:
        return False
    return True


def _write_and_rename(directory: int, filename: str, source: BinaryIO, size: int) -> None:
    staging = filename + ".tmp"
    owned_name = None
    try:
        if _entry_exists(directory, filename):
            raise StorageError("Managed file destination already exists.")
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
        fd = os.open(staging, flags, 0o600, dir_fd=directory)
        owned_name = staging
        with os.fdopen(fd, "wb") as destination:
            source.seek(0)
            remaining = size
            while remaining:
                chunk = source.read(min(remaining, 1024 * 1024))
                if not chunk:
                    raise StorageError("Upload ended before its validated size.")
                destination.write(chunk)
                remaining -= len(chunk)
            if source.read(1):
                raise StorageError("Upload exceeds its validated size.")
            destination.flush()
            os.fsync(destination.fileno())

        # Uploads are the sole writers of these generated names under the upload lock.
        if _entry_exists(directory, filename):
            raise StorageError("Managed file destination already exists.")
        os.rename(staging, filename, src_dir_fd=directory, dst_dir_fd=directory)
        owned_name = filename
        os.fsync(directory)
    except (OSError, StorageError) as error:
        try:
            if owned_name is not None:
                os.unlink(owned_name, dir_fd=directory)
                os.fsync(directory)
            artifacts_removed = not (_entry_exists(directory, filename) or _entry_exists(directory, staging))
        except OSError:
            logger.exception("Could not clean up managed upload %s", filename)
            artifacts_removed = False
        raise PublicationError(artifacts_removed=artifacts_removed) from error
