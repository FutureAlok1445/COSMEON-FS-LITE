# backend/intelligence/isl_manager.py
# Responsibility: Inter-Satellite Link (ISL) relay routing
# Self-contained module — receives get_node_status as callable to avoid circular imports.
# ISL is READ-ONLY: it reads bytes from a neighbor's disk, never moves files.

import asyncio
from pathlib import Path
from typing import Callable, Optional, List
from collections import deque

from backend.config import ISL_ADJACENCY, ISL_HOP_LATENCY_MS, NODES_BASE_PATH


def find_relay_path(
    target_node: str,
    get_node_status: Callable,
) -> Optional[List[str]]:
    """
    BFS to find a path from any reachable (ONLINE/DEGRADED) node to the target.
    The target itself must be PARTITIONED (alive but no Ground LOS).
    Returns the relay path as [relay_node, ..., target_node] or None.
    """
    target_status = get_node_status(target_node)
    
    # ISL only works for PARTITIONED nodes (alive but can't reach ground)
    # OFFLINE = dead satellite, no relay possible
    if target_status not in ("PARTITIONED", "DEGRADED"):
        return None

    # BFS from every ONLINE node to find the target
    for start_node in ISL_ADJACENCY:
        if get_node_status(start_node) not in ("ONLINE", "DEGRADED"):
            continue
        
        # BFS
        visited = {start_node}
        queue = deque([(start_node, [start_node])])
        
        while queue:
            current, path = queue.popleft()
            
            for neighbor in ISL_ADJACENCY.get(current, []):
                if neighbor in visited:
                    continue
                visited.add(neighbor)
                new_path = path + [neighbor]
                
                if neighbor == target_node:
                    return new_path  # Found relay path
                
                # Can only relay through ONLINE or DEGRADED nodes
                n_status = get_node_status(neighbor)
                if n_status in ("ONLINE", "DEGRADED"):
                    queue.append((neighbor, new_path))
    
    return None  # No path exists


def isl_fetch(
    target_node: str,
    chunk_id: str,
    relay_path: List[str],
) -> Optional[bytes]:
    """
    Read chunk data from the target node's disk via simulated relay.
    This is a READ-ONLY operation — no files are moved or copied.
    Returns raw bytes or None if file doesn't exist.
    """
    chunk_path = Path(NODES_BASE_PATH) / target_node / f"{chunk_id}.bin"
    
    if not chunk_path.exists():
        return None
    
    with open(chunk_path, "rb") as f:
        data = f.read()
    
    return data


async def isl_fetch_async(
    target_node: str,
    chunk_id: str,
    relay_path: List[str],
) -> Optional[bytes]:
    """
    Async version with simulated hop latency.
    Each hop adds ISL_HOP_LATENCY_MS of delay.
    """
    hops = len(relay_path) - 1  # number of links traversed
    if hops > 0:
        latency_s = (hops * ISL_HOP_LATENCY_MS) / 1000.0
        await asyncio.sleep(latency_s)
    
    return isl_fetch(target_node, chunk_id, relay_path)


def get_isl_topology(get_node_status: Callable) -> dict:
    """
    Return the current ISL topology state for the frontend.
    Each link is marked as active (both endpoints reachable) or inactive.
    """
    links = []
    seen = set()
    
    for node, neighbors in ISL_ADJACENCY.items():
        for neighbor in neighbors:
            link_key = tuple(sorted([node, neighbor]))
            if link_key in seen:
                continue
            seen.add(link_key)
            
            node_s = get_node_status(node)
            neighbor_s = get_node_status(neighbor)
            
            # A link is active if at least one endpoint is ONLINE/DEGRADED
            # and the other is not OFFLINE (dead)
            node_reachable = node_s in ("ONLINE", "DEGRADED", "PARTITIONED")
            neighbor_reachable = neighbor_s in ("ONLINE", "DEGRADED", "PARTITIONED")
            
            links.append({
                "from": node,
                "to": neighbor,
                "active": node_reachable and neighbor_reachable,
                "from_status": node_s,
                "to_status": neighbor_s,
            })
    
    return {"links": links}
