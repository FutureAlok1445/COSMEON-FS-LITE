import random
import json
from backend.config import ORBITAL_PLANES, NODES_DIR, NODE_STATES
from backend.metadata.manager import log_event, add_chunk_record

def write_to_node_or_queue(node: str, file_id: str, shard: dict):
    """
    Checks if a node is ONLINE. If yes, writes normally. 
    If OFFLINE, places it in the DTN Store-and-Forward Queue.
    """
    # Maintain memory state dictionary mapping nodes to constraints
    status = NODE_STATES.get(node, "ONLINE")
    
    filename = f"{file_id}_{shard['sequence']}.bin"
    file_path = NODES_DIR / node / filename
    
    if status == "ONLINE":
        # Direct Uplink
        with open(file_path, "wb") as f:
            f.write(shard["data"])
        return "DELIVERED"
    else:
        # DTN Queueing
        queue_path = NODES_DIR / node / "dtn_queue" / f"{filename}.json"
        with open(queue_path, "w") as f:
            # We encode data to hex for JSON serialization in the queue payload
            json.dump({
                "file_id": file_id,
                "shard": {
                    "shard_id": shard.get("shard_id", f"{file_id}_{shard['sequence']}"),
                    "type": shard["type"],
                    "sequence": shard["sequence"],
                    "data": shard["data"].hex(),
                    "hash": shard.get("hash", ""),
                    "pad_amount": shard.get("pad_amount", 0)
                }
            }, f)
        return "QUEUED"

def distribute_shards(file_id: str, shards: list):
    """
    Topology-aware RS Distribution. 
    Hard Rule: Data chunk and matching Parity chunk NEVER on the same orbital plane.
    """
    distribution_ledger = {}
    
    # We assign data chunks to Plane Alpha and Beta
    # We assign parity chunks to Plane Gamma
    # This guarantees a full plane blackout does not wipe out data AND parity.
    
    planes_cycle = ["Alpha", "Beta", "Gamma"]
    
    for i, shard in enumerate(shards):
        if shard["type"] == "data":
            # Round robin between Alpha and Beta
            assigned_plane = planes_cycle[i % 2]
        else:
            # Parity always on Gamma (or a plane not holding its corresponding data)
            assigned_plane = "Gamma"
            
        nodes_in_plane = ORBITAL_PLANES[assigned_plane]
        # Choose a specific satellite in that plane
        assigned_node = random.choice(nodes_in_plane)
        
        # Write via DTN handler
        delivery_status = write_to_node_or_queue(assigned_node, file_id, shard)
        
        ledger_entry = {
            "node": assigned_node,
            "plane": assigned_plane,
            "type": shard["type"],
            "hash": shard.get("hash", ""),
            "pad_amount": shard.get("pad_amount", 0),
            "status": delivery_status
        }
        
        distribution_ledger[str(shard['sequence'])] = ledger_entry
        
        # Metadata update - Har action ke baad
        add_chunk_record(file_id, shard['sequence'], assigned_node, assigned_plane, delivery_status)
        
        # Log event in metadata manager
        log_event("CHUNK_DISTRIBUTION", {
            "file_id": file_id,
            "sequence": shard["sequence"],
            "node": assigned_node,
            "status": delivery_status
        })
        
    log_event("FILE_DISTRIBUTION_COMPLETE", {"file_id": file_id})
    return distribution_ledger
