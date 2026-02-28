from reedsolo import RSCodec
from backend.config import RS_K, RS_M
from backend.core.chunker import compute_sha256

def encode_rs_shards(data_chunks):
    """
    Implements true Reed-Solomon RS(4,2) Erasure Coding block-wise.
    Transforms K data chunks into K+M shards.
    """
    # Pad all chunks to exactly the same length for math matrix operations
    max_len = max(len(dc["data"]) for dc in data_chunks)
    padded_data = []
    for dc in data_chunks:
        pad_amount = max_len - len(dc["data"])
        padded = dc["data"] + (b"\x00" * pad_amount)
        padded_data.append(padded)
        dc["pad_amount"] = pad_amount  # Store padding info to strip later
        
    # We need exactly K chunks. If the file was smaller than K chunks, add empty dummy chunks
    while len(padded_data) < RS_K:
        padded_data.append(b"\x00" * max_len)
        data_chunks.append({
            "chunk_id": f"dummy-{len(data_chunks)}",
            "sequence": len(data_chunks),
            "data": b"",
            "hash": "",
            "pad_amount": max_len,
            "dummy": True
        })

    # RS Math
    rsc = RSCodec(RS_M)
    
    parity_1_bytes = bytearray(max_len)
    parity_2_bytes = bytearray(max_len)
    
    # Interleave encode block by block (O(N) operation over the chunk size)
    for i in range(max_len):
        block = bytearray([padded_data[0][i], padded_data[1][i], padded_data[2][i], padded_data[3][i]])
        encoded = rsc.encode(block)
        parity_1_bytes[i] = encoded[4]
        parity_2_bytes[i] = encoded[5]
        
    shards = []
    # 1. Append formatted Data Shards
    for dc in data_chunks:
        if not dc.get("dummy"):
            shards.append({
                "shard_id": dc["chunk_id"],
                "type": "data",
                "sequence": dc["sequence"],
                "data": dc["data"],
                "hash": dc["hash"],
                "pad_amount": dc["pad_amount"]
            })
            
    # 2. Append the calculated Parity Shards
    base_seq = RS_K
    for i, parity_bytes in enumerate([parity_1_bytes, parity_2_bytes]):
        shards.append({
            "shard_id": f"parity-{base_seq + i}",
            "type": "parity",
            "sequence": base_seq + i,
            "data": bytes(parity_bytes),
            "hash": compute_sha256(bytes(parity_bytes)),
            "pad_amount": 0
        })
        
    return shards
