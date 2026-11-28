from collections.abc import Callable
from dataclasses import dataclass
from math import ceil
from time import monotonic

from fastapi import HTTPException, Request


LIMITS = {
    "login": (10, 60),
    "register": (5, 600),
    "change_password": (5, 300),
    "delete_account": (5, 300),
}


@dataclass
class AttemptWindow:
    expires_at: float
    attempts: int = 1


class AuthLimiter:
    def __init__(self, *, capacity: int = 4096, clock: Callable[[], float] = monotonic):
        self.capacity = capacity
        self.clock = clock
        self.windows: dict[str, dict[str, AttemptWindow]] = {operation: {} for operation in LIMITS}

    def check(self, operation: str, identity: str) -> None:
        limit, duration = LIMITS[operation]
        windows = self.windows[operation]
        now = self.clock()
        window = windows.get(identity)
        if window is not None and window.expires_at > now:
            if window.attempts >= limit:
                self._reject(window.expires_at - now)
            window.attempts += 1
            return

        if window is None and len(windows) >= self.capacity:
            for key in [key for key, entry in windows.items() if entry.expires_at <= now]:
                del windows[key]
            # Keep active counters at capacity so a flood of new identities cannot reset a limit.
            if len(windows) >= self.capacity:
                self._reject(min(entry.expires_at for entry in windows.values()) - now)

        windows[identity] = AttemptWindow(expires_at=now + duration)

    @staticmethod
    def _reject(seconds: float) -> None:
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Try again later.",
            headers={"Retry-After": str(max(1, ceil(seconds)))},
        )


def limit_by_ip(operation: str):
    async def check(request: Request) -> None:
        # Uvicorn resolves the client address using its configured proxy trust boundary.
        identity = request.client.host if request.client else "unknown"
        request.app.state.auth_limiter.check(operation, identity)

    return check
