import asyncio
import json
from backend.config import NODES_DIR, ORBITAL_PLANES
from backend.metadata.manager import _load_db
from backend.utils.ws_manager import manager

async def dtn_flush_worker():
    """
    Background worker that strictly emulates Delay Tolerant Networking.
    Polls the dtn_queue folders. If a node is ONLINE, it unwraps the bundled metadata
    and delivers the binary payload, clearing the queue.
    """
    while True:
        try:
            db = _load_db()
            node_states = db.get("nodes", {})
            
            for plane, nodes in ORBITAL_PLANES.items():
                for node in nodes:
                    if node_states.get(node, {}).get("status") == "ONLINE":
                        queue_dir = NODES_DIR / node / "dtn_queue"
                        
                        # Process bundles if queue dir exists
                        if queue_dir.exists():
                            for bundle_file in queue_dir.glob("*.json"):
                                with open(bundle_file, "r") as f:
                                    bundle = json.load(f)
                                
                                # Unpack DTN bundle
                                bin_filename = bundle_file.name.replace(".json", "")
                                bin_path = NODES_DIR / node / bin_filename
                                
                                # Write payload using hex decode
                                with open(bin_path, "wb") as bf:
                                    bf.write(bytes.fromhex(bundle["shard"]["data"]))
                                
                                await manager.broadcast("DTN_FLUSH", f"DTN Queue delivered {bin_filename} to {node} upon horizon acquisition.", {"node": node})
                                
                                # Remove delivered bundle
                                bundle_file.unlink()
        except Exception as e:
            print(f"DTN Worker Error: {e}")
            
        await asyncio.sleep(5)  # Poll every 5 seconds
