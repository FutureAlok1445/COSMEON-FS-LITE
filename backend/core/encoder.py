# backend/core/encoder.py
# Person 1 owns this file completely
# Responsibility: Take 4 data chunks → generate 2 parity chunks → return 6 total

import uuid
from typing import List

import reedsolo

from backend.core.chunker import Chunk, _compute_hash
from backend.config import RS_K, RS_M

# MODULE-LEVEL RSCodec — avoid re-instantiating GF tables on every encode call
_RSC = reedsolo.RSCodec(RS_M)


def _pad_chunks(chunks: List[Chunk]) -> tuple[List[bytes], int]:
    """
    Pad all chunks to same length (required by reedsolo).
    Returns padded data list + the original max size used.
    """
    max_size = max(len(c.data) for c in chunks)
    padded = [c.data.ljust(max_size, b'\x00') for c in chunks]
    return padded, max_size


def encode_chunks(data_chunks: List[Chunk]) -> List[Chunk]:
    """
    RS(4,2) encode: 4 data chunks → 6 chunks (4 data + 2 parity).

    Encoding is done byte-by-byte across all chunks (interleaved),
    so RS math operates on equal-length byte arrays.

    OPTIMIZATIONS vs. original:
    - Removed deepcopy() — saves copying megabytes of raw chunk bytes
    - Module-level RSCodec — avoids rebuilding GF tables per call
    - Pre-allocated bytearray with known size — avoids dynamic growth
    - Direct indexing instead of list comprehension per byte

    Returns:
        List of 6 Chunk objects — first 4 are data, last 2 are parity.
    """
    if len(data_chunks) != RS_K:
        raise ValueError(f"Encoder expects exactly {RS_K} data chunks, got {len(data_chunks)}")

    padded_data, pad_size = _pad_chunks(data_chunks)

    # Pre-allocate parity buffers with known size (avoids dynamic resizing)
    parity_buffers = [bytearray(pad_size) for _ in range(RS_M)]

    # Local reference to encode method — avoids attribute lookup in hot loop
    _encode = _RSC.encode

    # Encode byte-by-byte across all 4 chunks at each position
    for i in range(pad_size):
        byte_row = bytes([padded_data[0][i], padded_data[1][i],
                          padded_data[2][i], padded_data[3][i]])
        encoded = _encode(byte_row)
        # encoded = original bytes + parity bytes at end
        parity_buffers[0][i] = encoded[RS_K]
        parity_buffers[1][i] = encoded[RS_K + 1]

    # Build parity Chunk objects
    parity_chunks: List[Chunk] = []
    for p_idx, p_buf in enumerate(parity_buffers):
        p_data = bytes(p_buf)
        parity_chunks.append(Chunk(
            chunk_id        = str(uuid.uuid4()),
            sequence_number = RS_K + p_idx,           # sequence 4 and 5
            size            = len(p_data),
            sha256_hash     = _compute_hash(p_data),
            data            = p_data,
            is_parity       = True,
        ))

    # NO deepcopy — original data_chunks are immutable in this pipeline.
    # Store pad_size as internal metadata for decoder.
    result = list(data_chunks) + parity_chunks
    for chunk in result:
        chunk.__dict__['_pad_size'] = pad_size

    return result  # [D0, D1, D2, D3, P0, P1]
