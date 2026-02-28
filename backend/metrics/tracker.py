# backend/metrics/tracker.py
# Responsibility: Running metrics state tracker
# Maintains cumulative counters that calculator.py reads for snapshots
# Thread-safe — multiple uploads/downloads can call simultaneously

import threading
import time
from collections import deque
from typing import Dict, List


class MetricsTracker:
    """
    Singleton running-state tracker for all system metrics.
    Accumulates events and exposes snapshot() for WebSocket broadcasts.
    """

    def __init__(self):
        self._lock = threading.RLock()  # RLock: snapshot() calls properties that also acquire lock

        # Integrity verification counters
        self.integrity_attempts: int = 0
        self.integrity_passes: int = 0
        self.integrity_failures: int = 0

        # Cache counters
        self.cache_hits: int = 0
        self.cache_misses: int = 0

        # Reconstruction latency history (last 50 reconstructions)
        self.reconstruction_times_ms: deque = deque(maxlen=50)

        # Upload / download counters
        self.uploads_total: int = 0
        self.downloads_total: int = 0
        self.bytes_uploaded: int = 0
        self.bytes_downloaded: int = 0

        # Chaos event counters
        self.chaos_events_triggered: int = 0
        self.migrations_completed: int = 0
        self.dtn_bundles_delivered: int = 0

    # ─────────────────────────────────────────────
    # INTEGRITY
    # ─────────────────────────────────────────────

    def record_integrity_check(self, passed: bool) -> None:
        """Called by integrity.py on every SHA-256 verify."""
        with self._lock:
            self.integrity_attempts += 1
            if passed:
                self.integrity_passes += 1
            else:
                self.integrity_failures += 1

    @property
    def integrity_pass_rate(self) -> float:
        """Return integrity pass rate as percentage 0-100."""
        with self._lock:
            if self.integrity_attempts == 0:
                return 100.0
            return (self.integrity_passes / self.integrity_attempts) * 100.0

    # ─────────────────────────────────────────────
    # CACHE
    # ─────────────────────────────────────────────

    def record_cache_event(self, hit: bool) -> None:
        """Called by ground_cache.py on every get."""
        with self._lock:
            if hit:
                self.cache_hits += 1
            else:
                self.cache_misses += 1

    @property
    def cache_hit_rate(self) -> float:
        """Return cache hit rate as percentage 0-100."""
        with self._lock:
            total = self.cache_hits + self.cache_misses
            if total == 0:
                return 0.0
            return (self.cache_hits / total) * 100.0

    # ─────────────────────────────────────────────
    # RECONSTRUCTION LATENCY
    # ─────────────────────────────────────────────

    def record_reconstruction(self, latency_ms: float) -> None:
        """Called by reassembler.py after file reconstruction."""
        with self._lock:
            self.reconstruction_times_ms.append(latency_ms)

    @property
    def avg_reconstruction_ms(self) -> float:
        """Average reconstruction latency from last 50 operations."""
        with self._lock:
            if not self.reconstruction_times_ms:
                return 0.0
            return sum(self.reconstruction_times_ms) / len(self.reconstruction_times_ms)

    @property
    def last_reconstruction_ms(self) -> float:
        """Most recent reconstruction latency."""
        with self._lock:
            if not self.reconstruction_times_ms:
                return 0.0
            return self.reconstruction_times_ms[-1]

    # ─────────────────────────────────────────────
    # UPLOAD/DOWNLOAD
    # ─────────────────────────────────────────────

    def record_upload(self, file_size: int) -> None:
        with self._lock:
            self.uploads_total += 1
            self.bytes_uploaded += file_size

    def record_download(self, file_size: int) -> None:
        with self._lock:
            self.downloads_total += 1
            self.bytes_downloaded += file_size

    # ─────────────────────────────────────────────
    # CHAOS / MIGRATION
    # ─────────────────────────────────────────────

    def record_chaos_event(self) -> None:
        with self._lock:
            self.chaos_events_triggered += 1

    def record_migration(self) -> None:
        with self._lock:
            self.migrations_completed += 1

    def record_dtn_delivery(self) -> None:
        with self._lock:
            self.dtn_bundles_delivered += 1

    # ─────────────────────────────────────────────
    # SNAPSHOT — full state for WebSocket broadcast
    # ─────────────────────────────────────────────

    def snapshot(self) -> Dict:
        """Return current metrics state as dict for WebSocket/API."""
        with self._lock:
            return {
                "integrity": {
                    "attempts": self.integrity_attempts,
                    "passes": self.integrity_passes,
                    "failures": self.integrity_failures,
                    "pass_rate": round(self.integrity_pass_rate, 2),
                },
                "cache": {
                    "hits": self.cache_hits,
                    "misses": self.cache_misses,
                    "hit_rate": round(self.cache_hit_rate, 2),
                },
                "reconstruction": {
                    "avg_latency_ms": round(self.avg_reconstruction_ms, 2),
                    "last_latency_ms": round(self.last_reconstruction_ms, 2),
                    "total_operations": len(self.reconstruction_times_ms),
                },
                "operations": {
                    "uploads_total": self.uploads_total,
                    "downloads_total": self.downloads_total,
                    "bytes_uploaded": self.bytes_uploaded,
                    "bytes_downloaded": self.bytes_downloaded,
                },
                "system": {
                    "chaos_events": self.chaos_events_triggered,
                    "migrations": self.migrations_completed,
                    "dtn_deliveries": self.dtn_bundles_delivered,
                },
            }

    def reset(self) -> None:
        """Reset all counters. Used for testing."""
        with self._lock:
            self.integrity_attempts = 0
            self.integrity_passes = 0
            self.integrity_failures = 0
            self.cache_hits = 0
            self.cache_misses = 0
            self.reconstruction_times_ms.clear()
            self.uploads_total = 0
            self.downloads_total = 0
            self.bytes_uploaded = 0
            self.bytes_downloaded = 0
            self.chaos_events_triggered = 0
            self.migrations_completed = 0
            self.dtn_bundles_delivered = 0


# ─────────────────────────────────────────────
# SINGLETON INSTANCE — import this everywhere
# ─────────────────────────────────────────────
metrics_tracker = MetricsTracker()
