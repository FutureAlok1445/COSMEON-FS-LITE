# backend/core/decoder.py
# Person 1 owns this file completely
# Responsibility: Given ANY 4 of 6 chunks → reconstruct missing data chunks

from typing import List, Optional, Dict

import reedsolo

from backend.core.chunker import Chunk, _compute_hash
from backend.config import RS_K, RS_M, RS_TOTAL


def decode_chunks(
    available_chunks: List[Chunk],
    pad_size: int,
) -> List[Chunk]:
    """
    RS(4,2) decode: reconstruct full set of 4 data chunks from any 4 of 6 available.

    Args:
        available_chunks — any subset of chunks (min 4 required)
        pad_size         — original chunk size used during encoding (for unpadding)

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

    rsc = reedsolo.RSCodec(RS_M)

    # Map sequence_number → chunk data for quick lookup
    chunk_map: Dict[int, bytes] = {
        c.sequence_number: c.data for c in available_chunks
    }

    # Reconstruct byte-by-byte
    recovered_buffers = [bytearray() for _ in range(RS_K)]

    for i in range(pad_size):
        # Build erasure-aware byte row (None = missing position)
        byte_row = []
        erasures = []
        for pos in range(RS_TOTAL):
            if pos in chunk_map:
                byte_row.append(chunk_map[pos][i] if i < len(chunk_map[pos]) else 0)
            else:
                byte_row.append(0)         # placeholder
                erasures.append(pos)

        # reedsolo decode with explicit erasure positions
        try:
            decoded, _, _ = rsc.decode(bytes(byte_row), erase_pos=erasures)
        except reedsolo.ReedSolomonError as e:
            raise ValueError(f"RS decode failed at byte position {i}: {e}")

        # decoded = first RS_K bytes = original data bytes
        for d_idx in range(RS_K):
            recovered_buffers[d_idx].append(decoded[d_idx])

    # Build recovered Chunk objects — unpad last chunk
    recovered_chunks: List[Chunk] = []
    for seq in range(RS_K):
        raw = bytes(recovered_buffers[seq])

        # Strip zero-padding from last data chunk only
        if seq == RS_K - 1:
            raw = raw.rstrip(b'\x00') or raw  # keep at least 1 byte

        # Try to preserve original chunk_id if available
        original = chunk_map.get(seq)
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