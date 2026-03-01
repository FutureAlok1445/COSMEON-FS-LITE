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
from backend.config import NODES_BASE_PATH, RS_K, RS_TOTAL
from backend.intelligence.predictor import record_chunk_access
from backend.cache.ground_cache import ground_cache
from backend.intelligence.harvest_manager import harvest_manager
from backend.intelligence.isl_manager import find_relay_path, isl_fetch
from backend.metrics.calculator import LatencyTracker


def fetch_and_reassemble(
    chunk_records: List[dict],          # from metadata: [{chunk_id, sequence_number, sha256_hash, node_id, pad_size}, ...]
    get_node_status: Callable,          # Person 2 provides: get_node_status(node_id) -> "ONLINE"|"OFFLINE"|...
    file_hash: str,                     # original full-file SHA-256 from metadata
    original_file_size: int,
    file_id: str = "",                  # file_id for harvest cache lookup
) -> dict:
    """
    Main reassembly pipeline:
    1. Check ground cache before fetching from satellite node
    2. Try to fetch each chunk from its assigned satellite node
    3. Verify SHA-256 on every chunk read
    4. If chunk unavailable/corrupted → collect remaining chunks + call RS decoder
    5. Reassemble in sequence order
    6. Verify full-file SHA-256
    7. Track latency across all phases

    Returns: dict with 'data' (bytes), 'latency' (phase breakdown), 'rs_recovery' (bool)

    Raises:
        ValueError if fewer than RS_K=4 chunks available (unrecoverable)
        ValueError if final file hash doesn't match (catastrophic corruption)
    """
    tracker = LatencyTracker()
    tracker.start_total()
    rs_recovery_used = False

    # Phase 1: Metadata lookup (already done by caller, but track timing)
    tracker.start_phase("metadata")
    available_chunks: List[Chunk] = []
    missing_sequences: List[int] = []
    pad_size: int = chunk_records[0].get("pad_size", 512 * 1024)  # fallback to CHUNK_SIZE
    tracker.end_phase("metadata")

    # Phase 2: Fetch chunks (cache → satellite node)
    tracker.start_phase("fetch")

    for record in sorted(chunk_records, key=lambda r: r["sequence_number"]):
        seq     = record["sequence_number"]
        node_id = record["node_id"]
        c_id    = record["chunk_id"]
        c_hash  = record["sha256_hash"]

        # Skip parity chunks — we only need data chunks (0–3)
        if record.get("is_parity", False):
            continue

        # ── Check ground cache FIRST (F13: LRU cache skip node I/O) ──
        cached_data = ground_cache.get(c_id)
        if cached_data is not None:
            # Cache hit — verify integrity and use directly
            if verify_read(cached_data, c_hash):
                record_chunk_access(c_id)
                available_chunks.append(Chunk(
                    chunk_id        = c_id,
                    sequence_number = seq,
                    size            = len(cached_data),
                    sha256_hash     = c_hash,
                    data            = cached_data,
                    is_parity       = False,
                ))
                continue
            else:
                # Cache data corrupted — evict and fall through to node fetch
                ground_cache.evict(c_id)

        # ── Check Harvest Cache (Opportunistic collection) ──
        harvest_path = harvest_manager.get_shard_path(file_id, c_id)
        if harvest_path and harvest_path.exists():
            with open(harvest_path, "rb") as f:
                data = f.read()
            if verify_read(data, c_hash):
                available_chunks.append(Chunk(
                    chunk_id        = c_id,
                    sequence_number = seq,
                    size            = len(data),
                    sha256_hash     = c_hash,
                    data            = data,
                    is_parity       = False,
                ))
                continue

        # ── Fetch from satellite node ──
        status = get_node_status(node_id)

        if status == "ONLINE":
            chunk_path = Path(NODES_BASE_PATH) / node_id / f"{c_id}.bin"
            if chunk_path.exists():
                with open(chunk_path, "rb") as f:
                    data = f.read()

                # Level 2 integrity check
                if verify_read(data, c_hash):
                    record_chunk_access(c_id)

                    # Store in ground cache for future downloads
                    ground_cache.put(c_id, data)

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
            # Node OFFLINE or PARTITIONED — try ISL relay for PARTITIONED
            if status == "PARTITIONED":
                relay_path = find_relay_path(node_id, get_node_status)
                if relay_path:
                    relay_data = isl_fetch(node_id, c_id, relay_path)
                    if relay_data and verify_read(relay_data, c_hash):
                        record_chunk_access(c_id)
                        ground_cache.put(c_id, relay_data)
                        available_chunks.append(Chunk(
                            chunk_id        = c_id,
                            sequence_number = seq,
                            size            = len(relay_data),
                            sha256_hash     = c_hash,
                            data            = relay_data,
                            is_parity       = False,
                        ))
                        continue
            # Truly unavailable
            missing_sequences.append(seq)

    tracker.end_phase("fetch")

    # Phase 3: RS decode if any data chunks missing
    tracker.start_phase("decode")

    if missing_sequences:
        rs_recovery_used = True
        # Process segment-by-segment with correct pad_size per segment
        num_segments = (len(chunk_records) + RS_TOTAL - 1) // RS_TOTAL
        final_chunks = list(available_chunks)
        for seg_idx in range(num_segments):
            seg_start = seg_idx * RS_TOTAL
            seg_end = min(seg_start + RS_TOTAL, len(chunk_records))
            seg_records = chunk_records[seg_start:seg_end]
            seg_data_seqs = {r["sequence_number"] for r in seg_records if not r.get("is_parity", False)}
            seg_missing = seg_data_seqs & set(missing_sequences)
            if not seg_missing:
                continue
            seg_pad_size = seg_records[0].get("pad_size", 512 * 1024) if seg_records else 512 * 1024
            seg_available = _fetch_chunks_for_segment(seg_records, get_node_status)
            if len(seg_available) < RS_K:
                raise ValueError(
                    f"Unrecoverable segment {seg_idx}: only {len(seg_available)} chunks, need {RS_K}"
                )
            base_seq = seg_idx * RS_TOTAL
            # Remap to decoder's expected 0-5 by position in segment
            rec_by_id = {r["chunk_id"]: (i, r) for i, r in enumerate(seg_records)}
            remapped = [
                Chunk(
                    chunk_id=c.chunk_id,
                    sequence_number=rec_by_id[c.chunk_id][0],
                    size=c.size,
                    sha256_hash=c.sha256_hash,
                    data=c.data,
                    is_parity=c.is_parity,
                )
                for c in seg_available if c.chunk_id in rec_by_id
            ]
            recovered = decode_chunks(remapped, seg_pad_size)
            for r in recovered:
                r.sequence_number = 4 * seg_idx + r.sequence_number
            final_chunks = [c for c in final_chunks if c.sequence_number not in seg_data_seqs]
            final_chunks.extend(recovered)
        final_chunks = sorted(final_chunks, key=lambda c: c.sequence_number)
    else:
        final_chunks = sorted(available_chunks, key=lambda c: c.sequence_number)

    tracker.end_phase("decode")

    # Phase 4: Reassemble bytes
    tracker.start_phase("assembly")
    file_bytes = reassemble_chunks(final_chunks)
    if len(file_bytes) > original_file_size:
        file_bytes = file_bytes[:original_file_size]
    tracker.end_phase("assembly")

    # Phase 5: Full file integrity check
    tracker.start_phase("verify")
    if not verify_file(file_bytes, file_hash):
        raise ValueError(
            "CRITICAL: Reassembled file SHA-256 does NOT match original. "
            "Data may be permanently corrupted beyond RS recovery capacity."
        )
    tracker.end_phase("verify")

    return {
        "data": file_bytes,
        "latency": tracker.report(),
        "rs_recovery": rs_recovery_used,
    }


def _fetch_chunks_for_segment(
    seg_records: List[dict],
    get_node_status: Callable,
) -> List[Chunk]:
    """Fetch all available chunks (data + parity) for a single RS segment."""
    available = []
    for record in seg_records:
        node_id = record["node_id"]
        c_id = record["chunk_id"]
        c_hash = record["sha256_hash"]
        seq = record["sequence_number"]
        is_par = record.get("is_parity", False)
        cached = ground_cache.get(c_id)
        if cached is not None and verify_read(cached, c_hash):
            available.append(Chunk(
                chunk_id=c_id,
                sequence_number=seq,
                size=len(cached),
                sha256_hash=c_hash,
                data=cached,
                is_parity=is_par,
            ))
            continue
        
        harvest_path = harvest_manager.get_shard_path(record.get("file_id", ""), c_id)
        if harvest_path and harvest_path.exists():
            with open(harvest_path, "rb") as f:
                data = f.read()
            if verify_read(data, c_hash):
                available.append(Chunk(
                    chunk_id=c_id,
                    sequence_number=seq,
                    size=len(data),
                    sha256_hash=c_hash,
                    data=data,
                    is_parity=is_par,
                ))
                continue

        if get_node_status(node_id) != "ONLINE":
            continue
        chunk_path = Path(NODES_BASE_PATH) / node_id / f"{c_id}.bin"
        if not chunk_path.exists():
            continue
        with open(chunk_path, "rb") as f:
            data = f.read()
        if verify_read(data, c_hash):
            ground_cache.put(c_id, data)
            available.append(Chunk(
                chunk_id=c_id,
                sequence_number=seq,
                size=len(data),
                sha256_hash=c_hash,
                data=data,
                is_parity=is_par,
            ))
    return available


def _fetch_all_chunks_for_recovery(
    chunk_records: List[dict],
    get_node_status: Callable,
) -> List[Chunk]:
    """
    Fetch ALL available chunks (data + parity) for RS recovery.
    Used when some data chunks are missing and we need parity to reconstruct.
    Also checks ground cache before hitting disk.
    """
    available = []

    for record in chunk_records:
        node_id = record["node_id"]
        c_id    = record["chunk_id"]
        c_hash  = record["sha256_hash"]
        seq     = record["sequence_number"]
        is_par  = record.get("is_parity", False)

        # Check ground cache first
        cached = ground_cache.get(c_id)
        if cached is not None and verify_read(cached, c_hash):
            available.append(Chunk(
                chunk_id        = c_id,
                sequence_number = seq,
                size            = len(cached),
                sha256_hash     = c_hash,
                data            = cached,
                is_parity       = is_par,
            ))
            continue

        status = get_node_status(node_id)
        if status != "ONLINE":
            continue

        chunk_path = Path(NODES_BASE_PATH) / node_id / f"{c_id}.bin"
        if not chunk_path.exists():
            continue

        with open(chunk_path, "rb") as f:
            data = f.read()

        if verify_read(data, c_hash):
            # Cache it for future use
            ground_cache.put(c_id, data)

            available.append(Chunk(
                chunk_id        = c_id,
                sequence_number = seq,
                size            = len(data),
                sha256_hash     = c_hash,
                data            = data,
                is_parity       = is_par,
            ))

    return available