# backend/intelligence/rebalancer.py
# Person 3 owns this file
# Responsibility: Shannon entropy-based chunk redistribution
# When entropy < 0.85 → migrate chunks from overloaded to underloaded nodes

import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from backend.config import ALL_NODES, NODES_BASE_PATH
from backend.metadata.manager import (
    get_all_files, get_all_nodes, update_chunk_node
)
from backend.metrics.calculator import calculate_entropy, entropy_status
from backend.utils.ws_manager import manager


# ─────────────────────────────────────────────
# ENTROPY CALCULATION from live metadata
# ─────────────────────────────────────────────

def compute_entropy() -> float:
    """
    Calculate current Shannon entropy across all 6 nodes.
    Reads chunk counts from metadata node records.
    """
    nodes = get_all_nodes()
    chunk_counts = {n.node_id: n.chunk_count for n in nodes}
    return calculate_entropy(chunk_counts)


def get_chunk_distribution() -> Dict[str, int]:
    """Return {node_id: chunk_count} for dashboard display."""
    nodes = get_all_nodes()
    return {n.node_id: n.chunk_count for n in nodes}


# ─────────────────────────────────────────────
# REBALANCE LOGIC
# ─────────────────────────────────────────────

def _find_overloaded_and_underloaded() -> Tuple[List[str], List[str]]:
    """
    Find nodes above and below average chunk count.
    Returns (overloaded_node_ids, underloaded_node_ids)
    """
    nodes = get_all_nodes()
    online_nodes = [n for n in nodes if n.status == "ONLINE"]

    if not online_nodes:
        return [], []

    avg = sum(n.chunk_count for n in online_nodes) / len(online_nodes)

    overloaded = [n.node_id for n in online_nodes if n.chunk_count > avg + 1]
    underloaded = [n.node_id for n in online_nodes if n.chunk_count < avg]

    return overloaded, underloaded


def _find_movable_chunk(node_id: str) -> Optional[dict]:
    """
    Find a chunk on the given node that can be moved.
    Returns {file_id, chunk_id} or None.
    """
    for file_rec in get_all_files():
        for chunk in file_rec.chunks:
            if chunk.node_id == node_id:
                return {
                    "file_id": file_rec.file_id,
                    "chunk_id": chunk.chunk_id,
                    "sha256_hash": chunk.sha256_hash,
                }
    return None


def _move_chunk_file(chunk_id: str, from_node: str, to_node: str) -> bool:
    """Copy .bin file between node folders."""
    src = Path(NODES_BASE_PATH) / from_node / f"{chunk_id}.bin"
    dst = Path(NODES_BASE_PATH) / to_node / f"{chunk_id}.bin"

    if not src.exists():
        return False

    try:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(src), str(dst))
        # Optionally remove from source after copy
        # src.unlink()  # uncomment for move instead of copy
        return True
    except Exception as e:
        print(f"[REBALANCER] ❌ File move failed: {e}")
        return False


# ─────────────────────────────────────────────
# MAIN REBALANCE FUNCTION
# ─────────────────────────────────────────────

async def check_and_rebalance() -> dict:
    """
    Check entropy. If below 0.85, migrate chunks until entropy > 0.90.

    Algorithm:
    1. Compute entropy
    2. If entropy >= 0.85 → no action needed
    3. Find overloaded nodes (above avg) and underloaded nodes (below avg)
    4. Move one chunk at a time from hot → cold
    5. Recalculate entropy after each move
    6. Stop when entropy > 0.90 or no more moves possible

    Returns result dict with actions taken.
    """
    initial_entropy = compute_entropy()
    status = entropy_status(initial_entropy)

    result = {
        "initial_entropy": initial_entropy,
        "initial_status": status,
        "migrations": 0,
        "final_entropy": initial_entropy,
        "final_status": status,
    }

    if initial_entropy >= 0.85:
        return result  # Already balanced

    await manager.broadcast("REBALANCE_START", {
        "entropy": initial_entropy,
        "status": status,
        "message": f"Entropy {initial_entropy:.3f} below threshold — starting rebalance",
    })

    max_iterations = 20  # Safety limit
    for i in range(max_iterations):
        overloaded, underloaded = _find_overloaded_and_underloaded()

        if not overloaded or not underloaded:
            break

        # Pick the most overloaded node and least loaded target
        source = overloaded[0]
        target = underloaded[0]

        chunk_info = _find_movable_chunk(source)
        if not chunk_info:
            break

        # Move the file
        moved = _move_chunk_file(chunk_info["chunk_id"], source, target)
        if not moved:
            break

        # Update metadata
        update_chunk_node(chunk_info["file_id"], chunk_info["chunk_id"], target)
        result["migrations"] += 1

        await manager.broadcast("CHUNK_REBALANCED", {
            "chunk_id": chunk_info["chunk_id"],
            "from": source,
            "to": target,
            "iteration": i + 1,
        })

        # Recalculate entropy
        new_entropy = compute_entropy()
        if new_entropy >= 0.90:
            result["final_entropy"] = new_entropy
            result["final_status"] = entropy_status(new_entropy)
            break

    result["final_entropy"] = compute_entropy()
    result["final_status"] = entropy_status(result["final_entropy"])

    await manager.broadcast("REBALANCE_COMPLETE", {
        "initial_entropy": result["initial_entropy"],
        "final_entropy": result["final_entropy"],
        "migrations": result["migrations"],
        "message": f"Rebalanced: {result['initial_entropy']:.3f} → {result['final_entropy']:.3f} ({result['migrations']} migrations)",
    })

    await manager.broadcast("METRIC_UPDATE", {
        "entropy": result["final_entropy"],
        "entropy_status": result["final_status"],
    })

    return result
