import os
import re
from ipaddress import ip_network
from urllib.parse import urlsplit


LOCAL_FRONTEND_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
CSRF_REQUEST_HEADER = "X-StudyDesk-Request"


def load_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET", "")
    normalized = secret.lower()
    # These checks catch common placeholders. The documented generator supplies randomness.
    if (
        not re.fullmatch(r"[0-9a-fA-F]{64}", secret)
        or len(set(normalized)) < 8
        or any(normalized == normalized[:size] * (64 // size) for size in (8, 16, 32))
    ):
        raise RuntimeError("JWT_SECRET must be generated using secrets.token_hex(32).")
    return secret


def url_origin(value: str, *, bare: bool = False) -> str | None:
    if any(char.isspace() for char in value) or "\\" in value:
        return None
    try:
        url = urlsplit(value)
        port = url.port
    except ValueError:
        return None
    if (
        url.scheme not in {"http", "https"}
        or not url.hostname
        or "@" in url.netloc
        or "*" in url.netloc
        or (bare and (url.path or "?" in value or "#" in value))
    ):
        return None
    host = f"[{url.hostname}]" if ":" in url.hostname else url.hostname
    default_port = 443 if url.scheme == "https" else 80
    suffix = f":{port}" if port is not None and port != default_port else ""
    return f"{url.scheme}://{host}{suffix}"


def load_frontend_origins() -> tuple[str, ...]:
    entries = os.getenv("FRONTEND_ORIGINS", LOCAL_FRONTEND_ORIGINS).split(",")
    origins = []
    for entry in entries:
        origin = url_origin(entry.strip(), bare=True)
        if origin is None:
            raise RuntimeError("FRONTEND_ORIGINS must contain exact HTTP or HTTPS origins.")
        origins.append(origin)
    return tuple(dict.fromkeys(origins))


def load_secure_cookie_flag() -> bool:
    value = os.getenv("AUTH_COOKIE_SECURE", "false").strip().lower()
    if value not in {"true", "false"}:
        raise RuntimeError("AUTH_COOKIE_SECURE must be true or false.")
    return value == "true"


def validate_trusted_proxy_config() -> None:
    for entry in os.getenv("FORWARDED_ALLOW_IPS", "").split(","):
        if not entry.strip():
            continue
        try:
            net = ip_network(entry, strict=True)
        except ValueError:
            raise RuntimeError("FORWARDED_ALLOW_IPS must contain trusted proxy IPs or networks.") from None
        if net.prefixlen == 0:
            raise RuntimeError("FORWARDED_ALLOW_IPS must not trust every address.")
