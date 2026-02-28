import asyncio
import os
import shutil
from backend.config import DTN_QUEUE_PATH, NODES_BASE_PATH, ALL_NODES
from backend.metadata.manager import get_node, update_dtn_queue_depth
from backend.utils.ws_manager import manager

async def dtn_flush_worker():
    """
    Background worker that strictly emulates Delay Tolerant Networking.
    Polls the dtn_queue folders. If a node is ONLINE, it delivers the payload.
    """
    while True:
        try:
            for node_id in ALL_NODES:
                node_data = get_node(node_id)
                if node_data and node_data.status == "ONLINE":
                    node_queue_dir = DTN_QUEUE_PATH / node_id
                    
                    if node_queue_dir.exists():
                        bundles = list(node_queue_dir.glob("*.bin"))
                        update_dtn_queue_depth(node_id, len(bundles))
                        
                        for bundle_path in bundles:
                            dest_path = NODES_BASE_PATH / node_id / bundle_path.name
                            shutil.move(str(bundle_path), str(dest_path))
                            
                            await manager.broadcast("DTN_FLUSH", f"DTN delivered {bundle_path.name} to {node_id}.", {"node": node_id})
                            
                        # Update depth after flush
                        update_dtn_queue_depth(node_id, 0)
        except Exception as e:
            print(f"[DTN] Error: {e}")
            
        await asyncio.sleep(5)
