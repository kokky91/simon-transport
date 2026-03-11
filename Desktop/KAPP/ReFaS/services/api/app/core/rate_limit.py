import threading
import time
from collections import deque


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._events: dict[str, deque[float]] = {}

    def allow(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        now = time.monotonic()
        window_start = now - window_seconds

        with self._lock:
            bucket = self._events.setdefault(key, deque())

            while bucket and bucket[0] < window_start:
                bucket.popleft()

            if len(bucket) >= limit:
                retry_after = max(1, int(window_seconds - (now - bucket[0])))
                return False, retry_after

            bucket.append(now)
            return True, 0


api_write_limiter = SlidingWindowLimiter()
