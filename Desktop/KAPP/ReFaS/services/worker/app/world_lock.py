import os
import uuid

import redis


class RedisWorldLock:
    _UNLOCK_SCRIPT = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
"""

    def __init__(self) -> None:
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        self._redis = redis.Redis.from_url(redis_url)
        self._ttl_seconds = int(os.getenv("GAME_WORLD_LOCK_TTL_SECONDS", "5"))

    def acquire(self, world_id: str) -> tuple[bool, str]:
        token = str(uuid.uuid4())
        key = self._lock_key(world_id)
        acquired = bool(self._redis.set(key, token, nx=True, ex=self._ttl_seconds))
        return acquired, token

    def release(self, world_id: str, token: str) -> None:
        key = self._lock_key(world_id)
        self._redis.eval(self._UNLOCK_SCRIPT, 1, key, token)

    @staticmethod
    def _lock_key(world_id: str) -> str:
        return f"game:world_lock:{world_id}"
