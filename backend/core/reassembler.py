# backend/core/reassembler.py
# Person 1 owns this file completely
# Responsibility: Fetch chunks in sequence → decode if missing → return original file bytes
# NOTE: get_node_status() is provided by Person 2 via node_manager.py (interface contract)

import os
from pathlib import Path
from typing import List, Callable, Optional

from backend.core.chunker import Chunk, _compute_hash, reassemble_chunks
from backend.core.decoder import decode_chunks
from backend.core.integrity import verify_read, verify_file
from backend.config import NODES_BASE_PATH, RS_K
from backend.intelligence.predictor import log_chunk_request


def fetch_and_reassemble(
    chunk_records: List[dict],          # from metadata: [{chunk_id, sequence_number, sha256_hash, node_id, pad_size}, ...]
    get_node_status: Callable,          # Person 2 provides: get_node_status(node_id) -> "ONLINE"|"OFFLINE"|...
    file_hash: str,                     # original full-file SHA-256 from metadata
) -> bytes:
    """
    Main reassembly pipeline:
    1. Try to fetch each chunk from its assigned satellite node
    2. Verify SHA-256 on every chunk read
    3. If chunk unavailable/corrupted → collect remaining chunks + call RS decoder
    4. Reassemble in sequence order
    5. Verify full-file SHA-256

    Returns: original file bytes

    Raises:
        ValueError if fewer than RS_K=4 chunks available (unrecoverable)
        ValueError if final file hash doesn't match (catastrophic corruption)
    """
    available_chunks: List[Chunk] = []
    missing_sequences: List[int] = []
    pad_size: int = chunk_records[0].get("pad_size", 512 * 1024)  # fallback to CHUNK_SIZE

    for record in sorted(chunk_records, key=lambda r: r["sequence_number"]):
        seq     = record["sequence_number"]
        node_id = record["node_id"]
        c_id    = record["chunk_id"]
        c_hash  = record["sha256_hash"]

        # Skip parity chunks — we only need data chunks (0–3)
        if record.get("is_parity", False):
            continue

        # Check node status via Person 2's interface
        status = get_node_status(node_id)

        if status == "ONLINE":
            chunk_path = Path(NODES_BASE_PATH) / node_id / f"{c_id}.bin"
            if chunk_path.exists():
                with open(chunk_path, "rb") as f:
                    data = f.read()

                # Level 2 integrity check
                if verify_read(data, c_hash):
                    log_chunk_request(node_id, c_id)
                    available_chunks.append(Chunk(
                        chunk_id        = c_id,
                        sequence_number = seq,
                        size            = len(data),
                        sha256_hash     = c_hash,
                        data            = data,
                        is_parity       = False,
                    ))
                else:
                    # Hash mismatch — treat as unavailable (corrupted)
                    missing_sequences.append(seq)
            else:
                missing_sequences.append(seq)
        else:
            # Node OFFLINE or PARTITIONED — chunk unavailable
            missing_sequences.append(seq)

    # If any data chunks missing → attempt RS recovery
    if missing_sequences:
        if len(available_chunks) < RS_K:
            raise ValueError(
                f"Unrecoverable: only {len(available_chunks)} chunks available, "
                f"need {RS_K}. Missing sequences: {missing_sequences}"
            )

        # Include parity chunks for RS recovery
        all_available = _fetch_all_chunks_for_recovery(chunk_records, get_node_status)
        recovered = decode_chunks(all_available, pad_size)
        final_chunks = recovered  # decoder always returns full [D0,D1,D2,D3]
    else:
        final_chunks = available_chunks

    # Reassemble bytes
    file_bytes = reassemble_chunks(final_chunks)

    # Level 3 — full file integrity check
    if not verify_file(file_bytes, file_hash):
        raise ValueError(
            "CRITICAL: Reassembled file SHA-256 does NOT match original. "
            "Data may be permanently corrupted beyond RS recovery capacity."
        )

    return file_bytes


def _fetch_all_chunks_for_recovery(
    chunk_records: List[dict],
    get_node_status: Callable,
) -> List[Chunk]:
    """
    Fetch ALL available chunks (data + parity) for RS recovery.
    Used when some data chunks are missing and we need parity to reconstruct.
    """
    available = []

    for record in chunk_records:
        node_id = record["node_id"]
        c_id    = record["chunk_id"]
        c_hash  = record["sha256_hash"]
        seq     = record["sequence_number"]
        is_par  = record.get("is_parity", False)

        status = get_node_status(node_id)
        if status != "ONLINE":
            continue

        chunk_path = Path(NODES_BASE_PATH) / node_id / f"{c_id}.bin"
        if not chunk_path.exists():
            continue

        with open(chunk_path, "rb") as f:
            data = f.read()

        if verify_read(data, c_hash):
            available.append(Chunk(
                chunk_id        = c_id,
                sequence_number = seq,
                size            = len(data),
                sha256_hash     = c_hash,
                data            = data,
                is_parity       = is_par,
            ))

    return available