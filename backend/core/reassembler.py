from backend.config import NODES_DIR, RS_K, RS_M
from backend.core.chunker import compute_sha256
from backend.core.decoder import decode_rs_shards
import asyncio
from backend.utils.ws_manager import manager

async def retrieve_file_shards(file_id: str, metadata: dict):
    """
    Downloads shards. Validates SHA256. 
    If nodes are OFFLINE or Bit Rot is detected, routes mathematically through RS Decoder.
    """
    from backend.metadata.manager import _load_db
    db = _load_db()
    node_states = db.get("nodes", {})
    
    shards = metadata.get("shards", {})
    available_shards_map = {}
    missing_data_sequences = []
    
    max_len = 0
    padded_amounts = {}
    
    for seq_str, shard_info in shards.items():
        seq = int(seq_str)
        node = shard_info["node"]
        padded_amounts[seq] = shard_info.get("pad_amount", 0)
        
        # Check node status
        status = node_states.get(node, {}).get("status", "ONLINE")
        file_path = NODES_DIR / node / f"{file_id}_{seq}.bin"
        
        await manager.broadcast("FETCH_ATTEMPT", f"Fetching Shard {seq} from {node}", {"node": node, "seq": seq})
        
        if status == "ONLINE" and file_path.exists():
            with open(file_path, "rb") as f:
                chunk_bytes = f.read()
                
            # Verify Integrity (Bit Rot detection)
            if compute_sha256(chunk_bytes) == shard_info["hash"]:
                available_shards_map[seq] = chunk_bytes
                if len(chunk_bytes) > max_len:
                    max_len = len(chunk_bytes)
                await manager.broadcast("FETCH_SUCCESS", f"Shard {seq} OK", {"seq": seq})
            else:
                await manager.broadcast("CORRUPTION_DETECTED", f"Bit Rot caught in Shard {seq} on {node}", {"node": node})
                if shard_info["type"] == "data":
                    missing_data_sequences.append(seq)
        else:
            if status != "ONLINE":
                await manager.broadcast("NODE_OFFLINE", f"Node {node} offline. Shard {seq} unavailable.", {"node": node})
            if shard_info["type"] == "data":
                missing_data_sequences.append(seq)
                
    # If we have missing data chunks, we MUST decode
    if missing_data_sequences:
        await manager.broadcast("RS_RECOVERY_STARTED", f"Missing {len(missing_data_sequences)} data chunk(s). Engaging Reed-Solomon.", {})
        if len(available_shards_map) < RS_K:
            raise Exception(f"Catastrophic Data Loss. Only {len(available_shards_map)} shards available, {RS_K} required.")
            
        reconstructed_data = decode_rs_shards(available_shards_map, max_len)
        
        # Merge the reconstructed data in
        for i, data_bytes in enumerate(reconstructed_data):
            if i in missing_data_sequences:
                available_shards_map[i] = bytes(data_bytes)
                await manager.broadcast("RS_RECOVERY_SUCCESS", f"Mathematically recovered Shard {i}", {"seq": i})

    # Concatenate sequence 0 through RS_K
    final_bytes = bytearray()
    for seq in range(RS_K):
        # We might have generated dummy chunks during padding, we just slice them off
        if seq in available_shards_map:
            raw_chunk = available_shards_map[seq]
            pad = padded_amounts.get(seq, 0)
            if pad > 0:
                raw_chunk = raw_chunk[:-pad]
            final_bytes.extend(raw_chunk)
            
    return bytes(final_bytes)
