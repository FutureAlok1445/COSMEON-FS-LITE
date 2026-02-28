# backend/core/distributor.py
# Person 2 owns this file
# Responsibility: Assign each of the 6 chunks to a satellite node
# HARD RULE: Data chunk and its Parity chunk NEVER on same orbital plane

import os
from pathlib import Path
from typing import List, Callable, Optional

from backend.core.chunker import Chunk
from backend.core.integrity import verify_write
from backend.config import (
    ORBITAL_PLANES, NODE_TO_PLANE, ALL_NODES,
    NODES_BASE_PATH, DTN_QUEUE_PATH, RS_K
)
from backend.metadata import manager as meta


# ─────────────────────────────────────────────
# PLANE ASSIGNMENT LOGIC
# ─────────────────────────────────────────────

def _get_other_planes(plane: str) -> List[str]:
    """Return the 2 planes that are NOT the given plane."""
    return [p for p in ORBITAL_PLANES.keys() if p != plane]


def _get_nodes_in_plane(plane: str, online_only: bool = True) -> List[str]:
    """Return nodes in a specific plane, optionally filtered to ONLINE only."""
    nodes = ORBITAL_PLANES[plane]
    if online_only:
        from backend.utils.node_manager import get_node_status
        return [n for n in nodes if get_node_status(n) == "ONLINE"]
    return nodes


def _pick_node_with_least_chunks(node_list: List[str]) -> Optional[str]:
    """Pick the node with the fewest stored chunks (load balancing)."""
    if not node_list:
        return None
    all_nodes = {n.node_id: n.chunk_count for n in meta.get_all_nodes()}
    return min(node_list, key=lambda n: all_nodes.get(n, 0))


# ─────────────────────────────────────────────
# MAIN DISTRIBUTION FUNCTION
# ─────────────────────────────────────────────

def distribute_shards(
    file_id: str,
    chunks: List[Chunk],
    dtn_enqueue: Optional[Callable] = None,
) -> List[dict]:
    """
    Assign all 6 chunks to satellite nodes and write .bin files.

    Topology Rule:
    - Chunk sequences 0,1,2,3 are DATA chunks
    - Chunk sequences 4,5 are PARITY chunks
    - D[i] and P[i%RS_M] must be on DIFFERENT orbital planes

    Args:
        chunks      — 6 Chunk objects from encoder.py (4 data + 2 parity)
        dtn_enqueue — Person 3's DTN function: dtn_enqueue(node_id, chunk)
                      Called when target node is OFFLINE instead of writing

    Returns:
        List of placement dicts: [{chunk_id, node_id, sequence_number, success}, ...]
    """
    if len(chunks) != 6:
        raise ValueError(f"Distributor expects 6 chunks (4+2), got {len(chunks)}")

    data_chunks   = [c for c in chunks if not c.is_parity]   # sequences 0-3
    parity_chunks = [c for c in chunks if c.is_parity]        # sequences 4-5

    # Step 1: Assign data chunks to planes (round-robin across all 3 planes)
    plane_names = list(ORBITAL_PLANES.keys())  # [Alpha, Beta, Gamma, Alpha] for 4 chunks
    data_plane_assignments = {}  # chunk_id → plane

    for idx, chunk in enumerate(data_chunks):
        assigned_plane = plane_names[idx % len(plane_names)]
        data_plane_assignments[chunk.chunk_id] = assigned_plane

    # Step 2: Assign parity chunks to planes — MUST differ from paired data chunk's plane
    # P0 pairs with D0, P1 pairs with D1
    parity_plane_assignments = {}
    for idx, p_chunk in enumerate(parity_chunks):
        paired_data_chunk = data_chunks[idx]
        paired_plane = data_plane_assignments[paired_data_chunk.chunk_id]
        other_planes = _get_other_planes(paired_plane)
        # Pick the other plane with more capacity (alternate between the two)
        parity_plane_assignments[p_chunk.chunk_id] = other_planes[idx % len(other_planes)]

    # Step 3: Within each assigned plane, pick the node with least chunks
    all_assignments = {**data_plane_assignments, **parity_plane_assignments}
    placements = []

    for chunk in data_chunks + parity_chunks:
        target_plane = all_assignments[chunk.chunk_id]
        online_nodes = _get_nodes_in_plane(target_plane, online_only=True)

        if online_nodes:
            target_node = _pick_node_with_least_chunks(online_nodes)
            success = _write_chunk_to_node(chunk, target_node)
            placements.append({
                "chunk_id":        chunk.chunk_id,
                "node_id":         target_node,
                "sequence_number": chunk.sequence_number,
                "size":            chunk.size,
                "sha256_hash":     chunk.sha256_hash,
                "is_parity":       chunk.is_parity,
                "pad_size":        getattr(chunk, 'pad_size', 0),
            })
        else:
            # All nodes in target plane are OFFLINE → try any online node in other planes
            fallback_node = _find_any_online_node(exclude_plane=target_plane)

            if fallback_node:
                _write_chunk_to_node(chunk, fallback_node)
                placements.append({
                    "chunk_id":        chunk.chunk_id,
                    "node_id":         fallback_node,
                    "sequence_number": chunk.sequence_number,
                    "size":            chunk.size,
                    "sha256_hash":     chunk.sha256_hash,
                    "is_parity":       chunk.is_parity,
                    "pad_size":        getattr(chunk, '_pad_size', 0),
                })
            else:
                # All nodes offline → queue via DTN (Person 3)
                queued_node = ORBITAL_PLANES[target_plane][0]
                _enqueue_to_dtn(queued_node, chunk)
                placements.append({
                    "chunk_id":        chunk.chunk_id,
                    "node_id":         queued_node,
                    "sequence_number": chunk.sequence_number,
                    "size":            chunk.size,
                    "sha256_hash":     chunk.sha256_hash,
                    "is_parity":       chunk.is_parity,
                    "pad_size":        getattr(chunk, '_pad_size', 0),
                })

    return placements


# ─────────────────────────────────────────────
# WRITE + VERIFY
# ─────────────────────────────────────────────

def _write_chunk_to_node(chunk: Chunk, node_id: str) -> bool:
    """
    Write chunk .bin file to satellite node folder.
    Runs Level 1 integrity check (write verify) after writing.
    Updates metadata storage counters.
    """
    node_path  = Path(NODES_BASE_PATH) / node_id
    node_path.mkdir(parents=True, exist_ok=True)
    chunk_path = node_path / f"{chunk.chunk_id}.bin"

    try:
        with open(chunk_path, "wb") as f:
            f.write(chunk.data)

        # Level 1 integrity check — read back and verify SHA-256
        write_ok = verify_write(str(chunk_path), chunk.sha256_hash)

        if write_ok:
            # Update metadata storage counters
            meta.update_node_storage(node_id, size_delta=chunk.size, chunk_delta=1)
            return True
        else:
            # Write verification failed — delete corrupted file
            chunk_path.unlink(missing_ok=True)
            print(f"[DISTRIBUTOR] ❌ Write verify FAILED for {chunk.chunk_id} on {node_id}")
            return False

    except Exception as e:
        print(f"[DISTRIBUTOR] ❌ Error writing {chunk.chunk_id} to {node_id}: {e}")
        return False


def _enqueue_to_dtn(node_id: str, chunk: Chunk):
    """Save chunk to the DTN queue directory for Person 3's worker."""
    queue_dir = DTN_QUEUE_PATH / node_id
    queue_dir.mkdir(parents=True, exist_ok=True)
    chunk_path = queue_dir / f"{chunk.chunk_id}.bin"
    with open(chunk_path, "wb") as f:
        f.write(chunk.data)
    # Update depth in metadata
    depth = len(list(queue_dir.glob("*.bin")))
    meta.update_dtn_queue_depth(node_id, depth)


def _find_any_online_node(exclude_plane: str = None) -> Optional[str]:
    """Find any online node, optionally excluding a specific plane."""
    from backend.utils.node_manager import get_node_status
    for node_id in ALL_NODES:
        if exclude_plane and NODE_TO_PLANE.get(node_id) == exclude_plane:
            continue
        if get_node_status(node_id) == "ONLINE":
            return node_id
    return None