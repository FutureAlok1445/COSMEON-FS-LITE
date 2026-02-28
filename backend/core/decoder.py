# backend/core/decoder.py
# Person 1 owns this file completely
# Responsibility: Given ANY 4 of 6 chunks → reconstruct missing data chunks

from typing import List, Optional, Dict

import reedsolo

from backend.core.chunker import Chunk, _compute_hash
from backend.config import RS_K, RS_M, RS_TOTAL

# Module-level singleton — avoid re-creating RSCodec on every call
_RSC = reedsolo.RSCodec(RS_M)


def decode_chunks(
    available_chunks: List[Chunk],
    pad_size: int,
) -> List[Chunk]:
    """
    RS(4,2) decode: reconstruct full set of 4 data chunks from any 4 of 6 available.

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

    # Pre-compute erasure positions once (they don't change per byte)
    erasures = [pos for pos in range(RS_TOTAL) if pos not in chunk_map]

    # Pre-allocate recovery buffers (avoid bytearray.append overhead)
    recovered_buffers = [bytearray(pad_size) for _ in range(RS_K)]

    # Use memoryview for zero-copy slicing
    mv_map = {seq: memoryview(data) for seq, data in chunk_map.items()}

    for i in range(pad_size):
        # Build byte row: use memoryview for available, 0 for missing
        byte_row = bytearray(RS_TOTAL)
        for pos in range(RS_TOTAL):
            if pos in mv_map:
                mv = mv_map[pos]
                byte_row[pos] = mv[i] if i < len(mv) else 0
            # else: already 0 (placeholder for erasure)

        # reedsolo decode with explicit erasure positions
        try:
            decoded, _, _ = _RSC.decode(bytes(byte_row), erase_pos=erasures)
        except reedsolo.ReedSolomonError as e:
            raise ValueError(f"RS decode failed at byte position {i}: {e}")

        # Write directly into pre-allocated buffers
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
