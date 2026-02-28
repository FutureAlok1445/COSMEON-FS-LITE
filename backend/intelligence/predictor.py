# backend/intelligence/predictor.py
# Person 3 owns this file
# Responsibility: Proactive chunk migration BEFORE satellite enters LOS blackout
# Watches orbit timers → when node < 30s → migrate hot chunks to healthiest node

import asyncio
import shutil
import time
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Optional

from backend.config import ALL_NODES, LOS_THRESHOLD, NODES_BASE_PATH
from backend.intelligence.trajectory import get_timer, get_all_timers
from backend.utils.ws_manager import manager
from backend.metadata.manager import (
    get_all_files, update_chunk_node, get_all_nodes
)


# ─────────────────────────────────────────────
# ACCESS TRACKING — sliding window (60s)
# ─────────────────────────────────────────────
_access_log: Dict[str, List[float]] = defaultdict(list)  # chunk_id → [timestamps]
_WINDOW_SECONDS = 60


def record_chunk_access(chunk_id: str) -> None:
    """Record a chunk access event. Called by reassembler on every chunk fetch."""
    _access_log[chunk_id].append(time.time())


def _prune_old_accesses() -> None:
    """Remove access records older than 60 seconds."""
    cutoff = time.time() - _WINDOW_SECONDS
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
                    "access_count": access_count,
                    "sha256_hash": chunk.sha256_hash,
                })

    # Sort by access count descending
    node_chunks.sort(key=lambda c: c["access_count"], reverse=True)
    return node_chunks[:top_n]


# ─────────────────────────────────────────────
# FIND HEALTHIEST NODE — highest orbit timer + ONLINE
# ─────────────────────────────────────────────

def _find_healthiest_node(exclude_node: str) -> Optional[str]:
    """Find the node with the most orbit time remaining (safest target)."""
    timers = get_all_timers()
    nodes = get_all_nodes()
    online_nodes = [n for n in nodes if n.status == "ONLINE" and n.node_id != exclude_node]

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
        shutil.copy2(str(src_path), str(dst_path))

        # Update metadata
        update_chunk_node(file_id, chunk_id, dest_node)

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


async def start_predictor() -> None:
    """
    Background task that watches all orbit timers.
    When any node drops below LOS_THRESHOLD (30s):
    - Find top 3 most-accessed chunks on that node
    - Migrate them to healthiest available node
    - This is PROACTIVE — node hasn't failed yet
    """
    global _running
    _running = True
    print("[PREDICTOR] 🧠 Predictive migration engine started")

    # Track which nodes we've already predicted for this cycle
    predicted_this_cycle: set = set()

    while _running:
        try:
            timers = get_all_timers()

            for node_id, seconds in timers.items():
                # Only trigger once per orbit cycle at threshold
                if seconds <= LOS_THRESHOLD and node_id not in predicted_this_cycle:
                    predicted_this_cycle.add(node_id)

                    hot_chunks = get_hot_chunks(node_id, top_n=3)
                    if not hot_chunks:
                        continue

                    dest = _find_healthiest_node(exclude_node=node_id)
                    if not dest:
                        continue

                    await manager.broadcast("MIGRATE_START", {
                        "node_id": node_id,
                        "seconds_remaining": seconds,
                        "chunks_to_migrate": len(hot_chunks),
                        "destination": dest,
                        "message": f"Pre-migrating {len(hot_chunks)} chunks from {node_id} (timer={seconds}s)",
                    })

                    for chunk_info in hot_chunks:
                        await _migrate_chunk(
                            chunk_info["file_id"],
                            chunk_info["chunk_id"],
                            node_id,
                            dest,
                        )

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
