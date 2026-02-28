"""
Person 3: Predictive Migration (predictor.py)
Responsibilities: Detect if a node's Line-Of-Sight is closing (< 30s).
Identify most-requested chunks on that specific satellite.
Auto-migrate those .bin files to the healthiest node before blackout.
"""

import asyncio
import shutil
from pathlib import Path
from backend.config import NODES_BASE_PATH, LOS_THRESHOLD, ALL_NODES
from backend.metadata.manager import get_all_files, update_chunk_node, get_node
from backend.utils.ws_manager import manager
from backend.intelligence.trajectory import orbit_timers

# Global request tracker: {node_id: {chunk_id: count}}
chunk_requests = {}

def log_chunk_request(node_id: str, chunk_id: str):
    """Called by reassembler whenever a chunk is successfully fetched."""
    if node_id not in chunk_requests:
        chunk_requests[node_id] = {}
    chunk_requests[node_id][chunk_id] = chunk_requests[node_id].get(chunk_id, 0) + 1

async def predictor_worker():
    """
    Detect if a node's Line-Of-Sight is closing (< 30s).
    Auto-migrate top 2 most requested chunks to the healthiest ONLINE node.
    """
    while True:
        try:
            for node_id, timer in orbit_timers.items():
                if 0 < timer < LOS_THRESHOLD:
                    # Node is entering blackout.
                    # Find chunks that live on this node.
                    all_files = get_all_files()
                    target_chunks = [] # List of (file_id, chunk_record)
                    
                    for file_rec in all_files:
                        for chunk in file_rec.chunks:
                            if chunk.node_id == node_id:
                                target_chunks.append((file_rec.file_id, chunk))
                                
                    if not target_chunks:
                        continue
                        
                    # Sort target chunks by request count
                    node_reqs = chunk_requests.get(node_id, {})
                    target_chunks.sort(key=lambda x: node_reqs.get(x[1].chunk_id, 0), reverse=True)
                    
                    # Migrate top 2
                    to_migrate = target_chunks[:2]
                    
                    if to_migrate:
                        # Find healthiest node (max timer) that is ONLINE
                        # We filter out the current node and any node already in LOS warning
                        potential_targets = [
                            n for n in ALL_NODES 
                            if n != node_id and orbit_timers[n] > LOS_THRESHOLD
                        ]
                        
                        # Verify targets are ONLINE in metadata
                        online_targets = []
                        for n in potential_targets:
                            node_data = get_node(n)
                            if node_data and node_data.status == "ONLINE":
                                online_targets.append(n)
                        
                        if not online_targets:
                            continue
                            
                        healthiest_node = max(online_targets, key=lambda n: orbit_timers[n])
                        
                        for file_id, chunk in to_migrate:
                            chunk_id = chunk.chunk_id
                            filename = f"{chunk_id}.bin"
                            
                            src_path = NODES_BASE_PATH / node_id / filename
                            dest_path = NODES_BASE_PATH / healthiest_node / filename
                            
                            if src_path.exists():
                                # Physical move
                                (NODES_BASE_PATH / healthiest_node).mkdir(parents=True, exist_ok=True)
                                shutil.move(str(src_path), str(dest_path))
                                
                                # Metadata update
                                update_chunk_node(file_id, chunk_id, healthiest_node)
                                
                                await manager.broadcast(
                                    "PREDICTIVE_MIGRATION",
                                    f"Preemptively migrated hot chunk {chunk_id} from {node_id} to {healthiest_node}.",
                                    {"chunk": chunk_id, "from": node_id, "to": healthiest_node}
                                )
                                
                                # Reset request count
                                node_reqs[chunk_id] = 0
                                
        except Exception as e:
            print(f"[PREDICTOR] Error: {e}")
            
        await asyncio.sleep(5) # Poll every 5 seconds
