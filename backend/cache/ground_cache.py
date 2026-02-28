# backend/cache/ground_cache.py
# Responsibility: LRU cache for recently accessed chunks at Ground Station
# Serves chunks from memory instead of reading satellite node folders

import threading
from collections import OrderedDict
from typing import Optional

from backend.config import CACHE_SIZE


class GroundStationCache:
    """
    LRU (Least Recently Used) cache for chunk data.
    Stores last CACHE_SIZE (10) chunks in memory.
    Thread-safe for concurrent read/write access.

    Key   = chunk_id (str)
    Value = raw chunk bytes
    """

    def __init__(self, max_size: int = CACHE_SIZE):
        self._cache: OrderedDict[str, bytes] = OrderedDict()
        self._max_size = max_size
        self._lock = threading.Lock()

        # ── Metrics Counters ──
        self._hits = 0
        self._misses = 0

    # ─────────────────────────────────────────────
    # GET — cache lookup
    # ─────────────────────────────────────────────

    def get(self, chunk_id: str) -> Optional[bytes]:
        """
        Fetch chunk data from cache.
        Returns None on miss (caller must fetch from satellite node).
        On hit, moves chunk to end (most recently used).
        """
        with self._lock:
            if chunk_id in self._cache:
                self._hits += 1
                # Move to end → most recently used
                self._cache.move_to_end(chunk_id)
                return self._cache[chunk_id]
            else:
                self._misses += 1
                return None

    # ─────────────────────────────────────────────
    # PUT — cache insert
    # ─────────────────────────────────────────────

    def put(self, chunk_id: str, data: bytes) -> None:
        """
        Insert chunk into cache.
        If cache is full, evicts the least recently used chunk.
        If chunk already exists, updates and moves to end.
        """
        with self._lock:
            if chunk_id in self._cache:
                # Update existing entry and move to end
                self._cache.move_to_end(chunk_id)
                self._cache[chunk_id] = data
            else:
                # Evict LRU if at capacity
                if len(self._cache) >= self._max_size:
                    evicted_id, _ = self._cache.popitem(last=False)
                    # last=False → pop from front → oldest/least recently used
                self._cache[chunk_id] = data

    # ─────────────────────────────────────────────
    # EVICT — manual removal
    # ─────────────────────────────────────────────

    def evict(self, chunk_id: str) -> bool:
        """Remove a specific chunk from cache. Returns True if it was cached."""
        with self._lock:
            if chunk_id in self._cache:
                del self._cache[chunk_id]
                return True
            return False

    # ─────────────────────────────────────────────
    # CLEAR — wipe entire cache
    # ─────────────────────────────────────────────

    def clear(self) -> None:
        """Wipe entire cache. Used during chaos restore."""
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0

    # ─────────────────────────────────────────────
    # METRICS
    # ─────────────────────────────────────────────

    @property
    def hit_rate(self) -> float:
        """Cache hit rate as percentage (0.0 - 100.0)."""
        total = self._hits + self._misses
        if total == 0:
            return 0.0
        return (self._hits / total) * 100.0

    @property
    def hits(self) -> int:
        return self._hits

    @property
    def misses(self) -> int:
        return self._misses

    @property
    def size(self) -> int:
        """Current number of cached chunks."""
        return len(self._cache)

    @property
    def max_size(self) -> int:
        return self._max_size

    def stats(self) -> dict:
        """Return cache statistics dict for metrics dashboard."""
        return {
            "size": self.size,
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self.hit_rate, 2),
        }

    def __repr__(self) -> str:
        return (
            f"GroundStationCache(size={self.size}/{self._max_size}, "
            f"hit_rate={self.hit_rate:.1f}%)"
        )


# ─────────────────────────────────────────────
# SINGLETON INSTANCE
# Used across the entire backend — import this directly
# ─────────────────────────────────────────────
ground_cache = GroundStationCache()
