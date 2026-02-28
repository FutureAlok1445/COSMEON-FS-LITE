# backend/intelligence/predictor.py
# Person 3 owns this file
# Responsibility: Proactive chunk migration BEFORE satellite enters LOS blackout
# Watches orbit timers → when node < 30s → migrate hot chunks to healthiest node

import asyncio
import shutil
import time
import threading
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Optional, Set

from backend.config import ALL_NODES, LOS_THRESHOLD, NODES_BASE_PATH, NODE_TO_PLANE
from backend.intelligence.trajectory import get_timer, get_all_timers
from backend.utils.ws_manager import manager
from backend.metadata.manager import (
    get_all_files, update_chunk_node, get_all_nodes
)
from backend.cache.ground_cache import ground_cache


# ─────────────────────────────────────────────
# ACCESS TRACKING — sliding window (60s)
# ─────────────────────────────────────────────
_access_log: Dict[str, List[float]] = defaultdict(list)  # chunk_id → [timestamps]
_access_lock = threading.Lock()  # protect _access_log from concurrent read/write
_WINDOW_SECONDS = 60


def record_chunk_access(chunk_id: str) -> None:
    """Record a chunk access event. Called by reassembler on every chunk fetch."""
    with _access_lock:
        _access_log[chunk_id].append(time.time())


def _prune_old_accesses() -> None:
    """Remove access records older than 60 seconds."""
    cutoff = time.time() - _WINDOW_SECONDS
    with _access_lock:
        for chunk_id in list(_access_log.keys()):
            _access_log[chunk_id] = [t for t in _access_log[chunk_id] if t > cutoff]
            if not _access_log[chunk_id]:
                del _access_log[chunk_id]


def get_hot_chunks(node_id: str, top_n: int = 3) -> List[dict]:
    """
    Return the most-accessed chunks stored on a specific node.
    Scans metadata for chunks on this node, ranks by access count.
    """
    _prune_old_accesses()

    # Find all chunks stored on this node
    node_chunks = []
    for file_rec in get_all_files():
        for chunk in file_rec.chunks:
            if chunk.node_id == node_id:
                access_count = len(_access_log.get(chunk.chunk_id, []))
                node_chunks.append({
                    "file_id": file_rec.file_id,
                    "chunk_id": chunk.chunk_id,
                    "sequence_number": chunk.sequence_number,
                    "is_parity": chunk.is_parity,
                    "access_count": access_count,
                    "sha256_hash": chunk.sha256_hash,
                    "file_chunks": file_rec.chunks,
                })

    # Sort by access count descending
    node_chunks.sort(key=lambda c: c["access_count"], reverse=True)
    return node_chunks[:top_n]


# ─────────────────────────────────────────────
# FIND HEALTHIEST NODE — highest orbit timer + ONLINE
# Respects topology: excludes planes where paired chunk lives
# ─────────────────────────────────────────────

def _get_planes_to_avoid_for_chunk(
    chunk_seq: int, chunk_is_parity: bool, file_chunks: List,
) -> Set[str]:
    """Planes we must NOT migrate this chunk to (topology rule)."""
    planes: Set[str] = set()
    for c in file_chunks:
        plane = NODE_TO_PLANE.get(c.node_id)
        if not plane:
            continue
        if chunk_is_parity:
            if chunk_seq == 4 and not c.is_parity and c.sequence_number in (0, 2):
                planes.add(plane)
            elif chunk_seq == 5 and not c.is_parity and c.sequence_number in (1, 3):
                planes.add(plane)
        else:
            parity_seq = 4 + (chunk_seq % 2)
            if c.sequence_number == parity_seq:
                planes.add(plane)
                break
    return planes


def _find_healthiest_node(
    exclude_node: str, exclude_planes: Optional[Set[str]] = None
) -> Optional[str]:
    """Find the node with the most orbit time remaining (safest target)."""
    timers = get_all_timers()
    nodes = get_all_nodes()
    exclude_planes = exclude_planes or set()
    online_nodes = [
        n for n in nodes
        if n.status == "ONLINE"
        and n.node_id != exclude_node
        and NODE_TO_PLANE.get(n.node_id) not in exclude_planes
    ]

    if not online_nodes:
        return None

    # Sort by orbit_timer descending (most time remaining = healthiest)
    best = max(online_nodes, key=lambda n: timers.get(n.node_id, 0))
    return best.node_id


# ─────────────────────────────────────────────
# MIGRATE CHUNK — copy file + update metadata
# ─────────────────────────────────────────────

async def _migrate_chunk(file_id: str, chunk_id: str, source_node: str, dest_node: str) -> bool:
    """
    Copy .bin file from source to destination node folder.
    Update metadata to reflect new location.
    """
    src_path = Path(NODES_BASE_PATH) / source_node / f"{chunk_id}.bin"
    dst_path = Path(NODES_BASE_PATH) / dest_node / f"{chunk_id}.bin"

    if not src_path.exists():
        return False

    try:
        dst_path.parent.mkdir(parents=True, exist_ok=True)
        # shutil.copy2 is blocking disk I/O → offload to thread
        await asyncio.to_thread(shutil.copy2, str(src_path), str(dst_path))
        # Delete source file — this is a MOVE, not a copy (zero storage leaks)
        src_path.unlink(missing_ok=True)

        # Update metadata
        update_chunk_node(file_id, chunk_id, dest_node)

        # Evict stale cache entry — chunk is now at a new physical location
        ground_cache.evict(chunk_id)

        await manager.broadcast("MIGRATE_COMPLETE", {
            "chunk_id": chunk_id,
            "from": source_node,
            "to": dest_node,
            "message": f"Chunk {chunk_id[:8]}... migrated {source_node} → {dest_node}",
        })
        return True

    except Exception as e:
        print(f"[PREDICTOR] ❌ Migration failed: {e}")
        return False


# ─────────────────────────────────────────────
# MAIN PREDICTOR LOOP — background asyncio task
# ─────────────────────────────────────────────
_running = False

# Circuit breaker: prevent cascading migration storms
_MAX_MIGRATIONS_PER_CYCLE = 6   # max migrations across ALL nodes per tick
_MIN_TARGET_TIMER = 45          # never migrate TO a node with < 45s remaining


async def start_predictor() -> None:
    """
    Background task that watches all orbit timers.
    When any node drops below LOS_THRESHOLD (30s):
    - Find top 3 most-accessed chunks on that node
    - Migrate them to healthiest available node
    - This is PROACTIVE -- node hasn't failed yet

    Circuit breaker:
    - Cap at _MAX_MIGRATIONS_PER_CYCLE per tick (prevents storm)
    - Reject target nodes with < _MIN_TARGET_TIMER seconds (prevents cascade)
    """
    global _running
    _running = True
    print("[PREDICTOR] Predictive migration engine started")

    # Track which nodes we've already predicted for this cycle
    predicted_this_cycle: set = set()

    while _running:
        try:
            timers = get_all_timers()
            migrations_this_tick = 0  # circuit breaker counter

            for node_id, seconds in timers.items():
                # Circuit breaker: global cap per tick
                if migrations_this_tick >= _MAX_MIGRATIONS_PER_CYCLE:
                    break

                # Only trigger once per orbit cycle at threshold
                if seconds <= LOS_THRESHOLD and node_id not in predicted_this_cycle:
                    predicted_this_cycle.add(node_id)

                    hot_chunks = get_hot_chunks(node_id, top_n=3)
                    if not hot_chunks:
                        continue

                    await manager.broadcast("MIGRATE_START", {
                        "node_id": node_id,
                        "seconds_remaining": seconds,
                        "chunks_to_migrate": len(hot_chunks),
                        "message": f"Pre-migrating {len(hot_chunks)} chunks from {node_id} (timer={seconds}s)",
                    })

                    for chunk_info in hot_chunks:
                        if migrations_this_tick >= _MAX_MIGRATIONS_PER_CYCLE:
                            break

                        planes_to_avoid = _get_planes_to_avoid_for_chunk(
                            chunk_info["sequence_number"],
                            chunk_info["is_parity"],
                            chunk_info["file_chunks"],
                        )
                        dest = _find_healthiest_node(
                            exclude_node=node_id,
                            exclude_planes=planes_to_avoid,
                        )
                        if not dest:
                            continue

                        # Circuit breaker: reject target if it's also approaching LOS
                        if timers.get(dest, 0) < _MIN_TARGET_TIMER:
                            continue

                        success = await _migrate_chunk(
                            chunk_info["file_id"],
                            chunk_info["chunk_id"],
                            node_id,
                            dest,
                        )
                        if success:
                            migrations_this_tick += 1

                # Reset tracking when timer resets above threshold
                if seconds > LOS_THRESHOLD and node_id in predicted_this_cycle:
                    predicted_this_cycle.discard(node_id)

        except Exception as e:
            print(f"[PREDICTOR] Error: {e}")

        await asyncio.sleep(2)  # Check every 2 seconds


def stop_predictor() -> None:
    """Stop the predictor loop."""
    global _running
    _running = False
