import base64
import hashlib
import json
import re
from collections.abc import Collection
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from bson import ObjectId


MAX_CURSOR_LENGTH = 4096
UTC_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)
MILLISECOND = timedelta(milliseconds=1)


class InvalidCursor(ValueError):
    pass


@dataclass(frozen=True)
class CursorBoundary:
    value: str | datetime
    item_id: ObjectId
    item_type: str | None = None


def _json(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode("ascii")


def cursor_fingerprint(**context) -> str:
    # This detects a different effective query. Ownership is enforced by the query itself.
    return hashlib.sha256(_json(context)).hexdigest()


def encode_cursor(boundary: CursorBoundary, fingerprint: str) -> str:
    value = boundary.value
    if isinstance(value, datetime):
        # BSON stores milliseconds. Integer arithmetic keeps the exact boundary.
        value = (value - UTC_EPOCH) // MILLISECOND
    payload = {"v": 1, "context": fingerprint, "value": value, "id": str(boundary.item_id)}
    if boundary.item_type is not None:
        payload["type"] = boundary.item_type
    return base64.urlsafe_b64encode(_json(payload)).decode("ascii")


def _unique_fields(pairs):
    fields = dict(pairs)
    if len(fields) != len(pairs):
        raise InvalidCursor
    return fields


def decode_cursor(
    token: str, fingerprint: str, *, text_limit: int | None,
    item_types: Collection[str] | None = None,
) -> CursorBoundary:
    if len(token) > MAX_CURSOR_LENGTH or not re.fullmatch(r"[A-Za-z0-9_-]+={0,2}", token):
        raise InvalidCursor

    try:
        raw = base64.b64decode(token, altchars=b"-_", validate=True)
        payload = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_fields)
        expected_fields = {"v", "context", "value", "id"}
        if item_types is not None:
            expected_fields.add("type")
        if (
            not isinstance(payload, dict)
            or payload.keys() != expected_fields
            or type(payload["v"]) is not int
            or payload["v"] != 1
            or payload["context"] != fingerprint
        ):
            raise InvalidCursor

        item_id = payload["id"]
        item_type = payload.get("type")
        if not isinstance(item_id, str) or not re.fullmatch(r"[0-9a-fA-F]{24}", item_id):
            raise InvalidCursor
        if item_types is not None and (not isinstance(item_type, str) or item_type not in item_types):
            raise InvalidCursor

        value = payload["value"]
        if text_limit is None:
            if type(value) is not int:
                raise InvalidCursor
            value = UTC_EPOCH + value * MILLISECOND
        elif not isinstance(value, str) or not 1 <= len(value) <= text_limit:
            raise InvalidCursor
        else:
            # Escaped lone surrogates are valid JSON but cannot be written into a BSON query.
            value.encode("utf-8")

        return CursorBoundary(value=value, item_id=ObjectId(item_id), item_type=item_type)
    except (ValueError, OverflowError, RecursionError):
        raise InvalidCursor from None
