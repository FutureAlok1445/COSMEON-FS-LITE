# backend/core/chunker.py
# Person 1 owns this file completely
# Responsibility: Split any file into 512KB chunks with UUID + SHA-256

import hashlib
import uuid
from dataclasses import dataclass, field
from typing import List

from backend.config import CHUNK_SIZE, HASH_ALGORITHM


@dataclass
class Chunk:
    chunk_id: str           # UUID4 — unique identifier
    sequence_number: int    # Order: 0, 1, 2, 3 ...
    size: int               # Actual byte size of this chunk
    sha256_hash: str        # SHA-256 fingerprint of chunk data
    data: bytes             # Raw bytes
    is_parity: bool = False # Person 1 sets False — encoder.py flips to True


def _compute_hash(data: bytes) -> str:
    """Compute SHA-256 (or SHA3-256 if quantum-ready flag set)."""
    if HASH_ALGORITHM == "sha3_256":
        return hashlib.sha3_256(data).hexdigest()
    return hashlib.sha256(data).hexdigest()


def chunk_file(file_bytes: bytes) -> tuple[List[Chunk], str]:
    """
    Split file bytes into fixed 512KB chunks.

    Returns:
        chunks       — ordered list of Chunk objects
        file_hash    — SHA-256 of the FULL original file (for end-to-end verify)
    """
    if not file_bytes:
        raise ValueError("Cannot chunk empty file.")

    # Full file hash — computed BEFORE chunking
    file_hash = _compute_hash(file_bytes)

    chunks: List[Chunk] = []
    total_size = len(file_bytes)
    sequence = 0

    for offset in range(0, total_size, CHUNK_SIZE):
        raw = file_bytes[offset : offset + CHUNK_SIZE]

        chunk = Chunk(
            chunk_id       = str(uuid.uuid4()),
            sequence_number= sequence,
            size           = len(raw),
            sha256_hash    = _compute_hash(raw),
            data           = raw,
            is_parity      = False,
        )
        chunks.append(chunk)
        sequence += 1

    return chunks, file_hash


def reassemble_chunks(chunks: List[Chunk]) -> bytes:
    """
    Reassemble chunks back to original bytes.
    Chunks MUST be sorted by sequence_number before calling.
    """
    sorted_chunks = sorted(chunks, key=lambda c: c.sequence_number)
    return b"".join(c.data for c in sorted_chunks)