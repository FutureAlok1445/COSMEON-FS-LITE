"""
Running metrics state tracker.
Maintains: integrity_attempts, integrity_passes, cache_hits,
           cache_requests, reconstruction_times_ms.
Exposes snapshot() for WebSocket broadcasts.
"""
