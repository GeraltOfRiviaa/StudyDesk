import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class FileSettings:
    root: Path
    max_size: int
    user_quota: int
    global_quota: int
    upload_concurrency: int = 4
    validation_concurrency: int = 2
    upload_read_timeout: int = 60
    validation_timeout: int = 10
    validation_memory: int = 512 * 1024 * 1024
    disk_headroom: int = 100 * 1024 * 1024


def _positive_limit(name: str, default: int, *, unit: str = "") -> int:
    raw = os.getenv(name, str(default))
    try:
        value = int(raw) if raw.isascii() and raw.isdecimal() else 0
    except ValueError:
        value = 0
    if value <= 0:
        raise RuntimeError(f"{name} must be a positive integer{unit}.")
    return value


def load_file_settings() -> FileSettings:
    root = os.getenv("FILE_STORAGE_ROOT", "/data/uploads")
    if not root.strip():
        raise RuntimeError("FILE_STORAGE_ROOT must be set to an absolute directory.")

    max_size = _positive_limit("FILE_MAX_SIZE", 10485760, unit=" in bytes")
    user_quota = _positive_limit("FILE_USER_QUOTA", 524288000, unit=" in bytes")
    global_quota = _positive_limit("FILE_GLOBAL_QUOTA", 4294967296, unit=" in bytes")
    if not max_size <= user_quota <= global_quota:
        raise RuntimeError("File limits must satisfy FILE_MAX_SIZE <= FILE_USER_QUOTA <= FILE_GLOBAL_QUOTA.")

    return FileSettings(
        Path(root), max_size, user_quota, global_quota,
        upload_concurrency=_positive_limit("FILE_UPLOAD_CONCURRENCY", FileSettings.upload_concurrency),
        validation_concurrency=_positive_limit("FILE_VALIDATION_CONCURRENCY", FileSettings.validation_concurrency),
        upload_read_timeout=_positive_limit("FILE_UPLOAD_READ_TIMEOUT_SECONDS", FileSettings.upload_read_timeout),
        validation_timeout=_positive_limit("FILE_VALIDATION_TIMEOUT_SECONDS", FileSettings.validation_timeout),
        validation_memory=_positive_limit("FILE_VALIDATION_MEMORY_BYTES", FileSettings.validation_memory, unit=" in bytes"),
        disk_headroom=_positive_limit("FILE_DISK_HEADROOM_BYTES", FileSettings.disk_headroom, unit=" in bytes"),
    )
