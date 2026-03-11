import json
import os

import redis


class GameEventBus:
    def __init__(self) -> None:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6380/0")
        self._redis = redis.Redis.from_url(redis_url)

    def publish(self, event: dict) -> None:
        self._redis.publish("events", json.dumps(event))
