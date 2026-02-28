# backend/core/integrity.py
# Person 1 owns this file completely
# Responsibility: SHA-256 verification at write, read, and file level
# Also exposes bit_flip_simulate() for Person 3's chaos engine

import os
import random
from pathlib import Path

from backend.core.chunker import _compute_hash


# ─────────────────────────────────────────────
# LEVEL 1 — Write Verification
# ─────────────────────────────────────────────

def verify_write(chunk_path: str, expected_hash: str) -> bool:
    """
    After writing a chunk .bin file, read it back and verify SHA-256.
    Returns True if hash matches, False if silent write error occurred.
    """
    try:
        with open(chunk_path, "rb") as f:
            written_data = f.read()
        actual_hash = _compute_hash(written_data)
        return actual_hash == expected_hash
    except FileNotFoundError:
        return False


# ─────────────────────────────────────────────
# LEVEL 2 — Read Verification
# ─────────────────────────────────────────────

def verify_read(data: bytes, expected_hash: str) -> bool:
    """
    Before returning chunk data to reassembler, verify it hasn't silently corrupted.
    Returns True if clean, False if corrupted.
    """
    actual_hash = _compute_hash(data)
    return actual_hash == expected_hash


# ─────────────────────────────────────────────
# LEVEL 3 — Full File Verification
# ─────────────────────────────────────────────

def verify_file(assembled_bytes: bytes, original_file_hash: str) -> bool:
    """
    After full file assembly, verify end-to-end integrity.
    Returns True if file matches original SHA-256.
    """
    reconstructed_hash = _compute_hash(assembled_bytes)
    return reconstructed_hash == original_file_hash


# ─────────────────────────────────────────────
# CHAOS SUPPORT — Bit Flip Simulator
# Called by Person 3's chaos.py for Radiation Bit Rot scenario
# ─────────────────────────────────────────────

def bit_flip_simulate(chunk_path: str) -> dict:
    """
    Flip a single random byte in a chunk .bin file.
    Simulates cosmic ray Single Event Upset (SEU).

    Returns dict with:
        - chunk_path: str
        - byte_position: int
        - original_byte: int
        - flipped_byte: int
        - success: bool
    """
    path = Path(chunk_path)
    if not path.exists():
        return {"success": False, "error": f"File not found: {chunk_path}"}

    with open(path, "rb") as f:
        data = bytearray(f.read())

    if len(data) == 0:
        return {"success": False, "error": "Empty file, cannot flip bit"}

    byte_pos = random.randint(0, len(data) - 1)
    original_byte = data[byte_pos]

    # XOR with random non-zero value to guarantee the byte actually changes
    flip_mask = random.randint(1, 255)
    data[byte_pos] ^= flip_mask
    flipped_byte = data[byte_pos]

    with open(path, "wb") as f:
        f.write(bytes(data))

    return {
        "success"       : True,
        "chunk_path"    : str(chunk_path),
        "byte_position" : byte_pos,
        "original_byte" : original_byte,
        "flipped_byte"  : flipped_byte,
    }