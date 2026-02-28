# backend/metadata/manager.py
# Person 2 owns this file
# Responsibility: All store.json read/write with thread safety + auto-replication to all nodes

import json
import shutil
import threading
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict

from backend.metadata.schemas import (
    StoreModel, FileRecord, ChunkRecord,
    NodeRecord, EventRecord
)
from backend.config import (
    METADATA_PATH, NODES_BASE_PATH, ALL_NODES,
    ORBITAL_PLANES, NODE_TO_PLANE
)

# ─────────────────────────────────────────────
# Thread-safe file lock — prevents race conditions
# when 2 uploads happen simultaneously
# ─────────────────────────────────────────────
_lock = threading.Lock()

MAX_EVENTS = 200  # keep last 200 events in log


# ─────────────────────────────────────────────
# INIT
# ─────────────────────────────────────────────

def init_store() -> None:
    """
    Create fresh store.json on startup if it doesn't exist.
    Also initializes all 6 node records with default state.
    """
    if Path(METADATA_PATH).exists():
        return  # already exists, don't overwrite

    store = StoreModel()

    # Initialize all 6 nodes
    for plane, nodes in ORBITAL_PLANES.items():
        for node_id in nodes:
            store.nodes[node_id] = NodeRecord(
                node_id=node_id,
                plane=plane,
                status="ONLINE",
            )

    _write_store(store)
    print("[METADATA] ✅ store.json initialized with 6 nodes")


# ─────────────────────────────────────────────
# INTERNAL READ / WRITE
# ─────────────────────────────────────────────

def _read_store() -> StoreModel:
    """Read store.json and return StoreModel. NOT thread-safe alone — always use inside lock."""
    with open(METADATA_PATH, "r") as f:
        raw = json.load(f)
    return StoreModel(**raw)


def _write_store(store: StoreModel) -> None:
    """
    Write StoreModel to store.json.
    Then auto-replicate to all ONLINE node folders.
    NOT thread-safe alone — always use inside lock.
    """
    path = Path(METADATA_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)

    with open(path, "w") as f:
        json.dump(store.model_dump(), f, indent=2, default=str)

    # Auto-replicate to every online node folder
    _replicate_to_nodes(store)


def _replicate_to_nodes(store: StoreModel) -> None:
    """Copy store.json to each online satellite node folder."""
    for node_id, node_record in store.nodes.items():
        if node_record.status == "ONLINE":
            node_folder = Path(NODES_BASE_PATH) / node_id
            node_folder.mkdir(parents=True, exist_ok=True)
            dest = node_folder / "store.json"
            shutil.copy2(METADATA_PATH, dest)


# ─────────────────────────────────────────────
# FILE REGISTRY
# ─────────────────────────────────────────────

def register_file(file_record: FileRecord) -> None:
    """Add a new file record to store.json."""
    with _lock:
        store = _read_store()
        store.files[file_record.file_id] = file_record
        _log_event(store, "FILE_REGISTERED", f"File '{file_record.filename}' registered", {
            "file_id": file_record.file_id,
            "size": file_record.size,
            "chunks": file_record.chunk_count,
        })
        _write_store(store)


def get_file(file_id: str) -> Optional[FileRecord]:
    """Get a file record by file_id."""
    with _lock:
        store = _read_store()
        return store.files.get(file_id)


def get_all_files() -> List[FileRecord]:
    """Return all file records."""
    with _lock:
        store = _read_store()
        return list(store.files.values())


def delete_file(file_id: str) -> bool:
    """Remove a file record from store.json."""
    with _lock:
        store = _read_store()
        if file_id not in store.files:
            return False
        filename = store.files[file_id].filename
        del store.files[file_id]
        _log_event(store, "FILE_DELETED", f"File '{filename}' removed", {"file_id": file_id})
        _write_store(store)
        return True


# ─────────────────────────────────────────────
# CHUNK LOCATION UPDATE
# ─────────────────────────────────────────────

def update_chunk_node(file_id: str, chunk_id: str, new_node_id: str) -> bool:
    """
    Update which node holds a specific chunk.
    Called by rebalancer and predictive migration (Person 3).
    """
    with _lock:
        store = _read_store()
        file_rec = store.files.get(file_id)
        if not file_rec:
            return False
        for chunk in file_rec.chunks:
            if chunk.chunk_id == chunk_id:
                old_node = chunk.node_id
                chunk.node_id = new_node_id
                # Update storage counters
                if old_node in store.nodes:
                    store.nodes[old_node].storage_used  = max(0, store.nodes[old_node].storage_used - chunk.size)
                    store.nodes[old_node].chunk_count   = max(0, store.nodes[old_node].chunk_count - 1)
                if new_node_id in store.nodes:
                    store.nodes[new_node_id].storage_used += chunk.size
                    store.nodes[new_node_id].chunk_count  += 1
                _log_event(store, "CHUNK_MIGRATED",
                           f"Chunk {chunk_id} moved {old_node} → {new_node_id}", {})
                _write_store(store)
                return True
        return False


# ─────────────────────────────────────────────
# NODE REGISTRY
# ─────────────────────────────────────────────

def get_node(node_id: str) -> Optional[NodeRecord]:
    with _lock:
        store = _read_store()
        return store.nodes.get(node_id)


def get_all_nodes() -> List[NodeRecord]:
    with _lock:
        store = _read_store()
        return list(store.nodes.values())


def update_node_status(node_id: str, status: str) -> None:
    """Set node status: ONLINE | OFFLINE | DEGRADED | PARTITIONED"""
    with _lock:
        store = _read_store()
        if node_id in store.nodes:
            store.nodes[node_id].status = status
            _log_event(store, f"NODE_{status}",
                       f"{node_id} is now {status}", {"node_id": node_id})
            _write_store(store)


def update_node_storage(node_id: str, size_delta: int, chunk_delta: int) -> None:
    """
    Update storage_used and chunk_count for a node.
    Called by distributor after writing a chunk.
    size_delta: positive = added storage, negative = freed
    """
    with _lock:
        store = _read_store()
        if node_id in store.nodes:
            store.nodes[node_id].storage_used = max(
                0, store.nodes[node_id].storage_used + size_delta
            )
            store.nodes[node_id].chunk_count = max(
                0, store.nodes[node_id].chunk_count + chunk_delta
            )
            _write_store(store)


def update_node_health(node_id: str, health_score: int) -> None:
    with _lock:
        store = _read_store()
        if node_id in store.nodes:
            store.nodes[node_id].health_score = max(0, min(100, health_score))
            _write_store(store)


def update_orbit_timer(node_id: str, seconds_remaining: int) -> None:
    """Called by Person 3's trajectory.py every second."""
    with _lock:
        store = _read_store()
        if node_id in store.nodes:
            store.nodes[node_id].orbit_timer = seconds_remaining
            _write_store(store)


def update_dtn_queue_depth(node_id: str, depth: int) -> None:
    """Called by Person 3's dtn_queue.py when bundles added/flushed."""
    with _lock:
        store = _read_store()
        if node_id in store.nodes:
            store.nodes[node_id].dtn_queue_depth = depth
            _write_store(store)


# ─────────────────────────────────────────────
# EVENT LOGGING
# ─────────────────────────────────────────────

def _log_event(store: StoreModel, event_type: str, message: str, meta: dict) -> None:
    """Internal — always called inside lock."""
    store.events.append(EventRecord(
        event_type=event_type,
        message=message,
        metadata=meta,
    ))
    # Keep only last MAX_EVENTS
    if len(store.events) > MAX_EVENTS:
        store.events = store.events[-MAX_EVENTS:]


def log_event(event_type: str, message: str, meta: dict = {}) -> None:
    """Public event logger — callable by all persons."""
    with _lock:
        store = _read_store()
        _log_event(store, event_type, message, meta)
        _write_store(store)


def get_recent_events(limit: int = 50) -> List[EventRecord]:
    with _lock:
        store = _read_store()
        return store.events[-limit:]