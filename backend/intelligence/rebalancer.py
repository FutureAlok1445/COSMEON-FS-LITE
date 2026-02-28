"""
Person 3: Shannon Entropy Rebalancer (rebalancer.py)
Formula: H = -Σ(p_i log₂ p_i)
Responsibilities: Compute entropy based on chunk distribution.
Detect imbalance (H < 0.85). Migrate chunks until H > 0.90.
"""

import math
import asyncio
import shutil
from pathlib import Path
from backend.config import NODES_BASE_PATH, ALL_NODES, ORBITAL_PLANES
from backend.metadata.manager import get_all_files, update_chunk_node, get_node
from backend.utils.ws_manager import manager

async def rebalancer_worker():
    """
    Background worker that periodically checks Shannon Entropy of chunk distribution.
    If H < 0.85, migrates chunks from hot to cold nodes until H > 0.90.
    """
    while True:
        try:
            all_files = get_all_files()
            node_counts = {n: 0 for n in ALL_NODES}
            total_chunks = 0
            
            for file_rec in all_files:
                for chunk in file_rec.chunks:
                    if chunk.node_id in node_counts:
                        node_counts[chunk.node_id] += 1
                        total_chunks += 1
            
            if total_chunks > 1:
                entropy = 0
                for n, count in node_counts.items():
                    if count > 0:
                        p_i = count / total_chunks
                        entropy -= p_i * math.log2(p_i)
                
                if entropy < 0.85:
                    await manager.broadcast("ENTROPY_WARNING", f"Imbalance detected (H={entropy:.2f}). Engaging Rebalancer.", {"entropy": entropy})
                    
                    while entropy <= 0.90:
                        # Find ONLINE nodes
                        online_nodes = []
                        for n in ALL_NODES:
                            node_data = get_node(n)
                            if node_data and node_data.status == "ONLINE":
                                online_nodes.append(n)
                                
                        if len(online_nodes) < 2:
                            break # Cannot rebalance with < 2 nodes
                            
                        hot_node = max(online_nodes, key=lambda n: node_counts[n])
                        cold_node = min(online_nodes, key=lambda n: node_counts[n])
                        
                        if node_counts[hot_node] <= node_counts[cold_node] + 1:
                            break # System is as balanced as it can be
                            
                        # Physical move
                        hot_dir = NODES_BASE_PATH / hot_node
                        bin_files = list(hot_dir.glob("*.bin"))
                        if not bin_files:
                            break
                            
                        file_to_move = bin_files[0]
                        chunk_id = file_to_move.stem
                        
                        # Find which file this chunk belongs to
                        target_file_id = None
                        for file_rec in all_files:
                            for chunk in file_rec.chunks:
                                if chunk.chunk_id == chunk_id:
                                    target_file_id = file_rec.file_id
                                    break
                            if target_file_id: break
                            
                        if target_file_id:
                            dest_path = NODES_BASE_PATH / cold_node / file_to_move.name
                            shutil.move(str(file_to_move), str(dest_path))
                            
                            # Metadata update
                            update_chunk_node(target_file_id, chunk_id, cold_node)
                            
                            node_counts[hot_node] -= 1
                            node_counts[cold_node] += 1
                            
                            # Recalculate entropy
                            entropy = 0
                            for n, count in node_counts.items():
                                if count > 0:
                                    p_i = count / total_chunks
                                    entropy -= p_i * math.log2(p_i)
                                    
                            await manager.broadcast("SHANNON_REBALANCE", f"Moved {chunk_id} from {hot_node} to {cold_node}. New H={entropy:.2f}", {"h": entropy})
                            await asyncio.sleep(0.5)
                        else:
                            # Chunk files exist but not in registry? Clean up.
                            file_to_move.unlink()
                            break
                            
        except Exception as e:
            print(f"[REBALANCER] Error: {e}")
            
        await asyncio.sleep(60) # Only check every minute
