# backend/utils/logger.py
# Responsibility: Structured event builder for COSMEON FS-LITE
# Creates timestamped event dicts with type, message, metadata
# Integrates with metadata/manager.py and ws_manager.py

import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from backend.metadata.manager import log_event as _meta_log
from backend.utils.ws_manager import manager as _ws


# ─────────────────────────────────────────────
# EVENT BUILDER — pure dict construction
# ─────────────────────────────────────────────

def build_event(
    event_type: str,
    message: str,
    level: str = "INFO",
    **metadata: Any,
) -> Dict:
    """
    Build a structured event dict.

    Returns:
        {
            "event_id": "uuid4",
            "timestamp": "ISO format",
            "type": "CHUNK_UPLOADED",
            "level": "INFO" | "WARNING" | "ERROR",
            "message": "human-readable description",
            "metadata": { ... extra fields }
        }
    """
    return {
        "event_id": str(uuid.uuid4()),
        "timestamp": datetime.utcnow().isoformat(),
        "type": event_type,
        "level": level,
        "message": message,
        "metadata": metadata,
    }


# ─────────────────────────────────────────────
# LOGGING FUNCTIONS — log + broadcast in one call
# ─────────────────────────────────────────────

async def log_info(event_type: str, message: str, **meta: Any) -> Dict:
    """Log INFO-level event → metadata store + WebSocket broadcast."""
    event = build_event(event_type, message, level="INFO", **meta)
    _meta_log(event_type, message, meta)
    await _ws.broadcast(event_type, {
        "level": "INFO",
        "message": message,
        **meta,
    })
    return event


async def log_warning(event_type: str, message: str, **meta: Any) -> Dict:
    """Log WARNING-level event → metadata store + WebSocket broadcast."""
    event = build_event(event_type, message, level="WARNING", **meta)
    _meta_log(event_type, message, meta)
    await _ws.broadcast(event_type, {
        "level": "WARNING",
        "message": message,
        **meta,
    })
    return event


async def log_error(event_type: str, message: str, **meta: Any) -> Dict:
    """Log ERROR-level event → metadata store + WebSocket broadcast."""
    event = build_event(event_type, message, level="ERROR", **meta)
    _meta_log(event_type, message, meta)
    await _ws.broadcast(event_type, {
        "level": "ERROR",
        "message": message,
        **meta,
    })
    return event


# ─────────────────────────────────────────────
# SYNC VERSIONS — for non-async contexts
# ─────────────────────────────────────────────

def log_info_sync(event_type: str, message: str, **meta: Any) -> Dict:
    """Sync version — logs to metadata only (no WebSocket broadcast)."""
    event = build_event(event_type, message, level="INFO", **meta)
    _meta_log(event_type, message, meta)
    print(f"[LOG] ℹ️  {event_type}: {message}")
    return event


def log_warning_sync(event_type: str, message: str, **meta: Any) -> Dict:
    """Sync version — logs to metadata only."""
    event = build_event(event_type, message, level="WARNING", **meta)
    _meta_log(event_type, message, meta)
    print(f"[LOG] ⚠️  {event_type}: {message}")
    return event


def log_error_sync(event_type: str, message: str, **meta: Any) -> Dict:
    """Sync version — logs to metadata only."""
    event = build_event(event_type, message, level="ERROR", **meta)
    _meta_log(event_type, message, meta)
    print(f"[LOG] ❌ {event_type}: {message}")
    return event
