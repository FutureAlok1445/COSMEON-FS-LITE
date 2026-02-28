# backend/core/decoder.py
# Person 1 owns this file completely
# Responsibility: Given ANY 4 of 6 chunks → reconstruct missing data chunks

from typing import List, Optional, Dict

import reedsolo

from backend.core.chunker import Chunk, _compute_hash
from backend.config import RS_K, RS_M, RS_TOTAL

# MODULE-LEVEL RSCodec — avoid re-instantiating GF tables on every decode call
_RSC = reedsolo.RSCodec(RS_M)


def decode_chunks(
    available_chunks: List[Chunk],
    pad_size: int,
) -> List[Chunk]:
    """
    RS(4,2) decode: reconstruct full set of 4 data chunks from any 4 of 6 available.

    OPTIMIZATIONS:
    - Module-level RSCodec (GF tables built once)
    - Pre-allocated bytearray buffers
    - Pre-computed erasure positions (constant across all byte positions)
    - Local method reference for hot-loop decode

    Args:
        available_chunks -- any subset of chunks (min 4 required)
        pad_size         -- original chunk size used during encoding (for unpadding)

    Returns:
        List of 4 reconstructed DATA chunks in sequence order (0,1,2,3).

    Raises:
        ValueError if fewer than RS_K=4 chunks provided.
    """
    if len(available_chunks) < RS_K:
        raise ValueError(
            f"Cannot reconstruct: need at least {RS_K} chunks, "
            f"only {len(available_chunks)} available."
        )

    # Map sequence_number -> chunk data for quick lookup
    chunk_map: Dict[int, bytes] = {
        c.sequence_number: c.data for c in available_chunks
    }

    # Pre-compute erasure positions ONCE — they are the same for every byte position
    erasures = [pos for pos in range(RS_TOTAL) if pos not in chunk_map]

    # Pre-allocate output buffers with known size
    recovered_buffers = [bytearray(pad_size) for _ in range(RS_K)]

    # Local reference to decode method — avoids attribute lookup in hot loop
    _decode = _RSC.decode

    # Reconstruct byte-by-byte
    for i in range(pad_size):
        # Build byte row — direct indexing with fallback
        byte_row = bytes(
            chunk_map[pos][i] if pos in chunk_map and i < len(chunk_map[pos]) else 0
            for pos in range(RS_TOTAL)
        )

        # reedsolo decode with explicit erasure positions
        try:
            decoded, _, _ = _decode(byte_row, erase_pos=erasures)
        except reedsolo.ReedSolomonError as e:
            raise ValueError(f"RS decode failed at byte position {i}: {e}")

        # decoded = first RS_K bytes = original data bytes
        for d_idx in range(RS_K):
            recovered_buffers[d_idx][i] = decoded[d_idx]

    # Build recovered Chunk objects
    recovered_chunks: List[Chunk] = []
    for seq in range(RS_K):
        raw = bytes(recovered_buffers[seq])

        # Try to preserve original chunk_id if available
        original_chunk = next(
            (c for c in available_chunks if c.sequence_number == seq), None
        )

        recovered_chunks.append(Chunk(
            chunk_id        = original_chunk.chunk_id if original_chunk else f"recovered-{seq}",
            sequence_number = seq,
            size            = len(raw),
            sha256_hash     = _compute_hash(raw),
            data            = raw,
            is_parity       = False,
        ))

    return recovered_chunks  # always returns [D0, D1, D2, D3] in order
