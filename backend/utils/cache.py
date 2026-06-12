import os
import time
import json
from typing import Any, Optional

class SimpleCache:
    def __init__(self, default_ttl: int = 86400):
        self._cache = {}
        self._default_ttl = default_ttl

    async def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            value, timestamp, ttl = self._cache[key]
            effective_ttl = ttl if ttl is not None else self._default_ttl
            if time.time() - timestamp < effective_ttl:
                return value
            else:
                del self._cache[key]
        return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None):
        self._cache[key] = (value, time.time(), ttl)

    async def invalidate(self, key: str):
        if key in self._cache:
            del self._cache[key]
        if key.endswith("*"):
            prefix = key[:-1]
            keys_to_del = [k for k in self._cache.keys() if k.startswith(prefix)]
            for k in keys_to_del:
                del self._cache[k]

    async def clear(self):
        self._cache = {}

class ValkeyCache:
    def __init__(self, default_ttl: int = 86400):
        import redis.asyncio as redis
        redis_url = os.environ.get("VALKEY_URL", os.environ.get("REDIS_URL", "redis://localhost:6379"))
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self._default_ttl = default_ttl

    async def get(self, key: str) -> Optional[Any]:
        try:
            val = await self.redis.get(key)
            if val:
                return json.loads(val)
        except Exception as e:
            print(f"Valkey cache get error: {e}")
        return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None):
        try:
            effective_ttl = ttl if ttl is not None else self._default_ttl
            await self.redis.set(key, json.dumps(value), ex=effective_ttl)
        except Exception as e:
            print(f"Valkey cache set error: {e}")

    async def invalidate(self, key: str):
        try:
            if key.endswith("*"):
                keys = await self.redis.keys(key)
                if keys:
                    await self.redis.delete(*keys)
            else:
                await self.redis.delete(key)
        except Exception as e:
            print(f"Valkey cache invalidate error: {e}")

    async def clear(self):
        try:
            await self.redis.flushdb()
        except Exception as e:
            print(f"Valkey cache clear error: {e}")

CACHE_TYPE = os.environ.get("CACHE_TYPE", "memory").lower()

if CACHE_TYPE in ("valkey", "redis"):
    backend_cache = ValkeyCache(default_ttl=86400)
else:
    backend_cache = SimpleCache(default_ttl=86400)

