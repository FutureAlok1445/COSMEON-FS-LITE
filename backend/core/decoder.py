from reedsolo import RSCodec, ReedSolomonError
from backend.config import RS_K, RS_M

def decode_rs_shards(available_shards_map, max_len: int):
    """
    Uses available shards (data + parity) to mathematically rebuild missing data shards.
    Takes a dictionary mapping sequence index (0-5) to its bytearray.
    """
    rsc = RSCodec(RS_M)
    
    reconstructed_data = []
    
    for i in range(max_len):
        # Build the block with erasures.
        # If a shard is missing from the map, we feed it to the decoder as a byte array with an erasure.
        block = bytearray(RS_K + RS_M)
        erase_pos = []
        for seq in range(RS_K + RS_M):
            if seq in available_shards_map:
                block[seq] = available_shards_map[seq][i]
            else:
                block[seq] = 0  # Dummy zero for missing byte
                erase_pos.append(seq)
                
        # Only decode if there are missing bytes in the data segment
        if any(e < RS_K for e in erase_pos):
            try:
                decoded, _, _ = rsc.decode(block, erase_pos=erase_pos)
            except ReedSolomonError:
                raise Exception("Unrecoverable data loss. Not enough shards available to solve matrix.")
        else:
            decoded = block[:RS_K]
            
        # Reconstruct the original chunks byte-by-byte
        if i == 0:
            reconstructed_data = [bytearray() for _ in range(RS_K)]
            
        for c in range(RS_K):
            reconstructed_data[c].append(decoded[c])
            
    return reconstructed_data
