# backend/core/encoder.py
# Person 1 owns this file completely
# Responsibility: Take 4 data chunks → generate 2 parity chunks → return 6 total

import uuid
from typing import List

import reedsolo

from backend.core.chunker import Chunk, _compute_hash
from backend.config import RS_K, RS_M

# Module-level singleton — avoid re-creating RSCodec on every call
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
    RS(4,2) encode: 4 data chunks -> 6 chunks (4 data + 2 parity).

    Encoding is done byte-by-byte across all chunks (interleaved),
    so RS math operates on equal-length byte arrays.

    Returns:
        List of 6 Chunk objects -- first 4 are data, last 2 are parity.
    """
    if len(data_chunks) != RS_K:
        raise ValueError(f"Encoder expects exactly {RS_K} data chunks, got {len(data_chunks)}")

    padded_data, pad_size = _pad_chunks(data_chunks)

    # Pre-allocate parity buffers (avoid bytearray.append overhead)
    parity_buffers = [bytearray(pad_size) for _ in range(RS_M)]

    # Use memoryview for zero-copy slicing of padded data
    mv_data = [memoryview(buf) for buf in padded_data]

    # Encode byte-by-byte across all 4 chunks at each position
    for i in range(pad_size):
        byte_row = bytes([mv[i] for mv in mv_data])
        encoded = _RSC.encode(byte_row)
        # encoded = original bytes + parity bytes at end
        # Write directly into pre-allocated buffers
        for p_idx in range(RS_M):
            parity_buffers[p_idx][i] = encoded[RS_K + p_idx]

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

    # Carry original data_chunks forward WITHOUT deepcopy (saves megabytes)
    result = list(data_chunks) + parity_chunks
    for chunk in result:
        chunk.__dict__['_pad_size'] = pad_size  # internal metadata for decoder

    return result  # [D0, D1, D2, D3, P0, P1]
