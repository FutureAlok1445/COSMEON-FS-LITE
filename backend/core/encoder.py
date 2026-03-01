# backend/core/encoder.py
# Person 1 owns this file completely
# Responsibility: Take 4 data chunks → generate 2 parity chunks → return 6 total

import uuid
from copy import deepcopy
from typing import List

import reedsolo

from backend.core.chunker import Chunk, _compute_hash
from backend.config import RS_K, RS_M


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

    Returns:
        List of 6 Chunk objects — first 4 are data, last 2 are parity.
    """
    if len(data_chunks) != RS_K:
        raise ValueError(f"Encoder expects exactly {RS_K} data chunks, got {len(data_chunks)}")

    padded_data, pad_size = _pad_chunks(data_chunks)

    parity_buffers = []
    
    # ── PHASE 3.2: HARDWARE ACCELERATION ──
    try:
        from backend.core.rs_engine import cosmeon_rs_engine
        # print("[RS-ENGINE] 🚀 Native Rust PyO3 matrix acceleration initialized.")
        
        # Convert List[bytes] to what Rust expects
        raw_shards = [bytes(pad) for pad in padded_data]
        
        # The Rust engine returns all 6 shards. We just want the last 2 (parity)
        encoded_shards = cosmeon_rs_engine.encode_shards(raw_shards, RS_K, RS_M)
        parity_buffers = encoded_shards[RS_K:]
        
    except ImportError:
        # ── LEGACY FALLBACK ──
        print("[RS-ENGINE] ⚠️ Native Rust binary not found! Falling back to SLOW pure-Python matrix.")
        rsc = reedsolo.RSCodec(RS_M)
        parity_buffers = [bytearray() for _ in range(RS_M)]
        for i in range(pad_size):
            byte_row = bytes([buf[i] for buf in padded_data])
            encoded = rsc.encode(byte_row)
            parity_bytes = encoded[RS_K:] 
            for p_idx, p_byte in enumerate(parity_bytes):
                parity_buffers[p_idx].append(p_byte)

    # Build parity Chunk objects
    parity_chunks: List[Chunk] = []
    for p_idx, p_data in enumerate(parity_buffers):
        p_bytes = bytes(p_data)
        parity_chunks.append(Chunk(
            chunk_id        = str(uuid.uuid4()),
            sequence_number = RS_K + p_idx,
            size            = len(p_bytes),
            sha256_hash     = _compute_hash(p_bytes),
            data            = p_bytes,
            is_parity       = True,
        ))

    # Store pad_size in each chunk for decoder (needed to strip padding)
    result = deepcopy(data_chunks) + parity_chunks
    for chunk in result:
        chunk.__dict__['_pad_size'] = pad_size  # internal metadata for decoder

    return result  # [D0, D1, D2, D3, P0, P1]