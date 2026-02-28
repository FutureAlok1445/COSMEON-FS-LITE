# backend/intelligence/dtn_queue.py
# Person 3 owns this file
# Responsibility: DTN Store-and-Forward queue
# Inspired by NASA Bundle Protocol (BPv7) — PACE mission 2024
# When satellite OFFLINE → queue chunks → auto-deliver on recovery

import asyncio
import json
import base64
from pathlib import Path
from datetime import datetime
from typing import Dict, Optional

from backend.config import DTN_QUEUE_PATH, NODES_BASE_PATH, ALL_NODES

# Per-node locks to prevent race between add_to_queue and flush_queue
_node_locks: Dict[str, asyncio.Lock] = {n: asyncio.Lock() for n in ALL_NODES}
from backend.core.chunker import Chunk
from backend.core.integrity import verify_write
from backend.utils.ws_manager import manager
from backend.metadata.manager import (
    update_dtn_queue_depth, update_node_storage
)
from backend.utils.node_manager import get_node_status


# ─────────────────────────────────────────────
# QUEUE FILE MANAGEMENT
# Each node gets: dtn_queue/{node_id}.json
# ─────────────────────────────────────────────

def _queue_path(node_id: str) -> Path:
    """Path to a node's DTN queue file."""
    return DTN_QUEUE_PATH / f"{node_id}.json"


def _read_queue(node_id: str) -> list:
    """Read queue file, return list of bundles."""
    path = _queue_path(node_id)
    if not path.exists():
        return []
    try:
        with open(path, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, Exception):
        return []


def _write_queue(node_id: str, bundles: list) -> None:
    """Write bundles list to queue file."""
    path = _queue_path(node_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(bundles, f, indent=2)


def _clear_queue(node_id: str) -> None:
    """Clear a node's queue file."""
    path = _queue_path(node_id)
    if path.exists():
        path.unlink()


def get_queue_depth(node_id: str) -> int:
    """Return number of bundles in a node's queue."""
    return len(_read_queue(node_id))


# ─────────────────────────────────────────────
# ADD TO QUEUE — called by distributor.py when node OFFLINE
# ─────────────────────────────────────────────

async def add_to_queue(node_id: str, chunk: Chunk) -> None:
    """
    Queue a chunk for delayed delivery to an offline node.
    Bundle format matches NASA BPv7 structure.
    INTERFACE CONTRACT: distributor.py calls this function.
    """
    bundle = {
        "chunk_id": chunk.chunk_id,
        "sequence_number": chunk.sequence_number,
        "is_parity": chunk.is_parity,
        "sha256_hash": chunk.sha256_hash,
        "size": chunk.size,
        "data_b64": base64.b64encode(chunk.data).decode("utf-8"),
        "timestamp": datetime.utcnow().isoformat(),
        "retry_count": 0,
        "priority": 10 if chunk.is_parity else 5,  # Parity gets higher priority
    }

    lock = _node_locks.get(node_id)
    if lock is None:
        _node_locks[node_id] = asyncio.Lock()
        lock = _node_locks[node_id]
    async with lock:
        bundles = _read_queue(node_id)
        bundles.append(bundle)
        _write_queue(node_id, bundles)

    # Update metadata queue depth
    update_dtn_queue_depth(node_id, len(bundles))

    await manager.broadcast("DTN_QUEUED", {
        "node_id": node_id,
        "chunk_id": chunk.chunk_id,
        "queue_depth": len(bundles),
        "priority": bundle["priority"],
        "message": f"Bundle queued for {node_id} (depth={len(bundles)})",
    })

    print(f"[DTN] 📦 Queued chunk {chunk.chunk_id[:8]}... for {node_id}")


# ─────────────────────────────────────────────
# FLUSH QUEUE — deliver all bundles when node comes ONLINE
# ─────────────────────────────────────────────

async def flush_queue(node_id: str) -> int:
    """
    Deliver all queued bundles to a node that just came back ONLINE.
    Sort by priority (parity first).
    Verify SHA-256 after each write.

    Returns number of bundles delivered.
    """
    lock = _node_locks.get(node_id)
    if lock is None:
        _node_locks[node_id] = asyncio.Lock()
        lock = _node_locks[node_id]
    async with lock:
        bundles = _read_queue(node_id)
        if not bundles:
            return 0

        # Sort by priority descending (parity = 10 first, data = 5 after)
        bundles.sort(key=lambda b: b["priority"], reverse=True)

        await manager.broadcast("DTN_FLUSH_START", {
            "node_id": node_id,
            "bundle_count": len(bundles),
            "message": f"Flushing {len(bundles)} bundles to {node_id}",
        })

        delivered = 0
        delivered_chunk_ids = set()
        node_path = Path(NODES_BASE_PATH) / node_id
        node_path.mkdir(parents=True, exist_ok=True)

        for bundle in bundles:
            chunk_path = node_path / f"{bundle['chunk_id']}.bin"

            try:
                # Decode base64 data and write
                chunk_data = base64.b64decode(bundle["data_b64"])
                with open(chunk_path, "wb") as f:
                    f.write(chunk_data)

                # Verify write integrity
                if verify_write(str(chunk_path), bundle["sha256_hash"]):
                    delivered += 1
                    delivered_chunk_ids.add(bundle["chunk_id"])
                    update_node_storage(node_id, size_delta=bundle["size"], chunk_delta=1)

                    await manager.broadcast("DTN_BUNDLE_DELIVERED", {
                        "node_id": node_id,
                        "chunk_id": bundle["chunk_id"],
                        "delivered": delivered,
                        "total": len(bundles),
                        "message": f"Bundle {delivered}/{len(bundles)} delivered to {node_id}",
                    })
                else:
                    # Write verification failed — keep in queue for retry
                    chunk_path.unlink(missing_ok=True)
                    print(f"[DTN] ❌ Write verify failed for {bundle['chunk_id'][:8]}... (will retry)")

            except Exception as e:
                print(f"[DTN] ❌ Delivery error: {e} (bundle will retry)")

        # Only remove successfully delivered bundles; keep failed ones for retry
        remaining = [b for b in bundles if b["chunk_id"] not in delivered_chunk_ids]
        if remaining:
            _write_queue(node_id, remaining)
            update_dtn_queue_depth(node_id, len(remaining))
        else:
            _clear_queue(node_id)
            update_dtn_queue_depth(node_id, 0)

    await manager.broadcast("DTN_FLUSH_COMPLETE", {
        "node_id": node_id,
        "delivered": delivered,
        "total": len(bundles),
        "message": f"DTN flush complete: {delivered}/{len(bundles)} bundles delivered to {node_id}",
    })

    print(f"[DTN] ✅ Flushed {delivered}/{len(bundles)} bundles to {node_id}")
    return delivered


# ─────────────────────────────────────────────
# BACKGROUND WORKER — polls every 5 seconds
# ─────────────────────────────────────────────
_running = False


async def start_dtn_worker() -> None:
    """
    Background task that polls every 5 seconds.
    For each node with queued bundles: if now ONLINE → flush.
    """
    global _running
    _running = True
    print("[DTN] 📡 DTN store-and-forward worker started")

    while _running:
        try:
            for node_id in ALL_NODES:
                status = get_node_status(node_id)
                if status == "ONLINE" and get_queue_depth(node_id) > 0:
                    await flush_queue(node_id)
        except Exception as e:
            print(f"[DTN] Worker error: {e}")

        await asyncio.sleep(5)


def stop_dtn_worker() -> None:
    """Stop the DTN worker loop."""
    global _running
    _running = False
