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
    with _lock:
        if Path(METADATA_PATH).exists():
            try:
                with open(METADATA_PATH, "r") as f:
                    raw = json.load(f)
                store = StoreModel(**raw)
            except json.JSONDecodeError:
                print("[WARNING] init_store JSONDecodeError, resetting store.")
                store = StoreModel()
            except PermissionError:
                print("[WARNING] init_store PermissionError, skipping reset to avoid wiping data.")
                return
        else:
            store = StoreModel()

        # Hydrate missing nodes
        dirty = False
        print(f"[DEBUG init_store] BEFORE hydration: store.nodes={len(store.nodes)}")
        for plane, nodes in ORBITAL_PLANES.items():
            for node_id in nodes:
                if node_id not in store.nodes:
                    print(f"[DEBUG init_store] Hydrating missing node {node_id}")
                    store.nodes[node_id] = NodeRecord(
                        node_id=node_id,
                        plane=plane,
                        status="ONLINE",
                    )
                    dirty = True

        print(f"[DEBUG init_store] AFTER hydration: store.nodes={len(store.nodes)}, dirty={dirty}")
        if dirty or not Path(METADATA_PATH).exists():
            _write_store(store)
            print("[METADATA] ✅ store.json initialized/hydrated with 6 nodes")


# ─────────────────────────────────────────────
# INTERNAL READ / WRITE
# ─────────────────────────────────────────────

def _read_store() -> StoreModel:
    """Read store.json and return StoreModel. NOT thread-safe alone — always use inside lock."""
    import time
    for _ in range(5):
        try:
            with open(METADATA_PATH, "r") as f:
                raw = json.load(f)
            return StoreModel(**raw)
        except (json.JSONDecodeError, PermissionError):
            time.sleep(0.05) # Wait for write flush
    
    # Fallback if truly corrupted
    print("[WARNING] store.json highly corrupted or locked. Falling back to fresh store.")
    store = StoreModel()
    from backend.config import ORBITAL_PLANES
    from backend.metadata.schemas import NodeRecord
    for plane, nodes in ORBITAL_PLANES.items():
        for node_id in nodes:
            store.nodes[node_id] = NodeRecord(node_id=node_id, plane=plane)
    return store


def _write_store(store: StoreModel) -> None:
    """
    Atomic write to store.json — write to .tmp file first, then rename.
    Prevents corruption from concurrent background task writes.
    """
    path = Path(METADATA_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    # SAFEGUARD: Never wipe nodes
    if len(store.nodes) == 0:
        import traceback
        traceback.print_stack()
        print("[CRITICAL] Attempted to write 0 nodes to store.json! Halting write.")
        return

    # Atomic write: dump to temp file, then rename over original
    tmp_path = path.with_suffix(".tmp")
    try:
        data = json.dumps(store.model_dump(), indent=2, default=str)
        with open(tmp_path, "w") as f:
            f.write(data)
            f.flush()
            import os as _os
            _os.fsync(f.fileno())
        # Atomic rename (on Windows, need to remove target first)
        if path.exists():
            path.unlink()
        tmp_path.rename(path)
    except Exception as e:
        print(f"[ERROR _write_store] Failed atomic write: {e}")
        # Fallback: direct write
        with open(path, "w") as f:
            json.dump(store.model_dump(), f, indent=2, default=str)

    _kademlia_publish_stub(store)


def _kademlia_publish_stub(store: StoreModel) -> None:
    """
    [FUTURE SCOPE: PHASE 2.1 - Kademlia Routing]
    Instead of copying a flat JSON file, this stub represents pushing the 
    updated FileRecord (with its new VectorClock) into the P2P Mesh DHT.
    
    # TODO:
    # dht_node = libp2p.KademliaDHT(app.host)
    # for file_id, record in store.files.items():
    #     dht_node.put(hash(file_id), record.model_dump())
    """
    # Emulate the legacy auto-replicate while containers boot
    for node_id, node_record in store.nodes.items():
        if node_record.status == "ONLINE":
            node_folder = Path(NODES_BASE_PATH) / node_id
            node_folder.mkdir(parents=True, exist_ok=True)
            dest = node_folder / "store.json"
            shutil.copy2(METADATA_PATH, dest)


def replicate_to_node(node_id: str) -> None:
    """
    [DEPRECATED - PHASE 2.2]
    In FS-PRO, nodes synchronize automatically when coming online via the 
    Libp2p gossip networks and DHT polling. We do not push state arbitrarily.
    """
    with _lock:
        if not Path(METADATA_PATH).exists():
            return
        node_folder = Path(NODES_BASE_PATH) / node_id
        node_folder.mkdir(parents=True, exist_ok=True)
        dest = node_folder / "store.json"
        
        try:
            shutil.copy2(METADATA_PATH, dest)
        except FileNotFoundError:
            pass


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
    """Remove a file record from store.json and delete physical chunks."""
    with _lock:
        store = _read_store()
        if file_id not in store.files:
            return False

        file_rec = store.files[file_id]
        
        # Deduct storage and delete physical files
        for chunk in file_rec.chunks:
            node_id = chunk.node_id
            if node_id in store.nodes:
                store.nodes[node_id].storage_used = max(0, store.nodes[node_id].storage_used - chunk.size)
                store.nodes[node_id].chunk_count = max(0, store.nodes[node_id].chunk_count - 1)
                
            # Physically delete the chunk file
            if node_id:
                chunk_path = Path(NODES_BASE_PATH) / node_id / f"{chunk.chunk_id}.bin"
                chunk_path.unlink(missing_ok=True)
                
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