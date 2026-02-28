# backend/main.py
# Person 4 Integration — FastAPI Entry Point
# Assembles all modules, defines REST + WebSocket endpoints
# Starts background tasks on startup

import uuid
import asyncio
from functools import partial
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket
from fastapi.responses import Response, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

# ── Config & Init ──
from backend.config import init_node_folders, RS_K, NODES_BASE_PATH

# ── Core Engine (Person 1) ──
from backend.core.chunker import chunk_file, Chunk, _compute_hash
from backend.core.encoder import encode_chunks
from backend.core.distributor import distribute_chunks, verify_topology
from backend.core.reassembler import fetch_and_reassemble

# ── Metadata & Schemas (Person 2) ──
from backend.metadata.manager import (
    init_store, register_file, get_file, get_all_files,
    get_all_nodes, log_event
)
from backend.metadata.schemas import (
    FileRecord, ChunkRecord, UploadResponse
)

# ── Node Manager (Person 2) ──
from backend.utils.node_manager import (
    get_node_status, set_online, set_offline,
    get_all_statuses, restore_all_nodes
)

# ── WebSocket Manager (Person 4) ──
from backend.utils.ws_manager import manager

# ── Intelligence Layer (Person 3) ──
from backend.intelligence.chaos import router as chaos_router
from backend.intelligence.trajectory import start_all_timers, stop_all_timers
from backend.intelligence.predictor import start_predictor, stop_predictor
from backend.intelligence.dtn_queue import start_dtn_worker, stop_dtn_worker, add_to_queue
from backend.intelligence.rebalancer import check_and_rebalance, compute_entropy, get_chunk_distribution

# ── Metrics (Person 1) ──
from backend.metrics.calculator import (
    get_full_metrics_snapshot, integrity_counter,
    calculate_mttdl, format_mttdl, calculate_storage_efficiency
)
from backend.cache.ground_cache import ground_cache


# ─────────────────────────────────────────────
# LIFESPAN — startup + shutdown
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init filesystem, start background tasks."""
    init_node_folders()
    init_store()

    # Start Person 3 background tasks
    orbit_task = asyncio.create_task(start_all_timers())
    predictor_task = asyncio.create_task(start_predictor())
    dtn_task = asyncio.create_task(start_dtn_worker())

    print("[MAIN] 🚀 COSMEON FS-LITE Online — All systems nominal")

    yield

    # Shutdown
    stop_all_timers()
    stop_predictor()
    stop_dtn_worker()
    orbit_task.cancel()
    predictor_task.cancel()
    dtn_task.cancel()
    print("[MAIN] Shutdown complete")


# ─────────────────────────────────────────────
# APP SETUP
# ─────────────────────────────────────────────

app = FastAPI(
    title="COSMEON FS-LITE — Orbital File System API",
    description="Reed-Solomon erasure coded distributed file system for satellite constellations",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register chaos router (Person 3 endpoints)
app.include_router(chaos_router)


# ─────────────────────────────────────────────
# WEBSOCKET — /ws
# ─────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except Exception:
        manager.disconnect(websocket)


# ─────────────────────────────────────────────
# POST /api/upload — Main Upload Pipeline
# ─────────────────────────────────────────────

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    Main orbital uplink pipeline:
    1. Read file → chunk → RS encode → distribute → register metadata
    """
    try:
        content = await file.read()
        file_id = str(uuid.uuid4())

        await manager.broadcast("UPLOAD_START", {
            "file_id": file_id,
            "filename": file.filename,
            "size": len(content),
            "message": f"Ingesting {file.filename} ({len(content)} bytes)",
        })

        # Step 1: Chunk the file (CPU-bound — offload to thread to avoid blocking event loop)
        chunks, file_hash = await asyncio.to_thread(chunk_file, content)

        await manager.broadcast("CHUNKING_COMPLETE", {
            "file_id": file_id,
            "chunk_count": len(chunks),
            "message": f"Split into {len(chunks)} chunks",
        })

        # Step 2: RS encode each group of K chunks (CPU-bound — offload to thread)
        def _encode_all_groups():
            all_enc = []
            for i in range(0, len(chunks), RS_K):
                group = chunks[i:i + RS_K]
                # Pad group to RS_K if needed (last group may be smaller)
                while len(group) < RS_K:
                    pad_chunk = Chunk(
                        chunk_id=str(uuid.uuid4()),
                        sequence_number=i + len(group),
                        size=0,
                        sha256_hash=_compute_hash(b""),
                        data=b"",
                        is_parity=False,
                    )
                    group.append(pad_chunk)
                encoded = encode_chunks(group)
                all_enc.extend(encoded)
            return all_enc

        all_encoded = await asyncio.to_thread(_encode_all_groups)

        await manager.broadcast("ENCODING_COMPLETE", {
            "file_id": file_id,
            "total_shards": len(all_encoded),
            "message": f"RS({RS_K},2) encoded → {len(all_encoded)} total shards",
        })

        # Step 3: Distribute each segment of 6 chunks (disk I/O — offload to thread)
        def _distribute_all_segments():
            _placements = []
            for seg_idx in range(0, len(all_encoded), RS_K + 2):
                segment = all_encoded[seg_idx:seg_idx + RS_K + 2]
                placed = distribute_chunks(file_id, segment)
                _placements.extend(placed)
            return _placements

        all_placements = await asyncio.to_thread(_distribute_all_segments)

        # Broadcast per-chunk placement
        for p in all_placements:
            event = "CHUNK_UPLOADED" if p.get("success") else ("DTN_QUEUED" if p.get("queued") else "CHUNK_FAILED")
            await manager.broadcast(event, {
                "file_id": file_id,
                "chunk_id": p["chunk_id"],
                "node_id": p["node_id"],
                "plane": p.get("plane", ""),
                "is_parity": p["is_parity"],
            })

        # Step 4: Build metadata and register (pad_size per chunk for multi-segment correctness)
        chunk_records = []
        for p in all_placements:
            matching_chunk = next((c for c in all_encoded if c.chunk_id == p["chunk_id"]), None)
            pad_size = (
                getattr(matching_chunk, "_pad_size", len(matching_chunk.data) if matching_chunk else 0)
                if matching_chunk else 512 * 1024
            )
            chunk_records.append(ChunkRecord(
                chunk_id=p["chunk_id"],
                sequence_number=p["sequence_number"],
                size=matching_chunk.size if matching_chunk else 0,
                sha256_hash=matching_chunk.sha256_hash if matching_chunk else "",
                node_id=p["node_id"] or "",
                is_parity=p["is_parity"],
                pad_size=pad_size,
            ))

        file_record = FileRecord(
            file_id=file_id,
            filename=file.filename,
            size=len(content),
            full_sha256=file_hash,
            chunk_count=len(chunks),
            chunks=chunk_records,
        )
        register_file(file_record)

        await manager.broadcast("UPLOAD_COMPLETE", {
            "file_id": file_id,
            "filename": file.filename,
            "message": f"{file.filename} partitioned across orbital mesh",
        })

        # Post-upload: broadcast metrics
        await _broadcast_metrics()

        return {
            "success": True,
            "file_id": file_id,
            "filename": file.filename,
            "chunk_count": len(chunks),
            "total_shards": len(all_encoded),
            "message": f"File uploaded and distributed across orbital mesh",
        }

    except Exception as e:
        # ORPHAN CLEANUP: if distribution wrote .bin files before the error,
        # delete them all to prevent storage leaks. Zero orphans permitted.
        if 'all_placements' in locals():
            for p in all_placements:
                if p.get("success") and p.get("node_id"):
                    orphan_path = Path(NODES_BASE_PATH) / p["node_id"] / f"{p['chunk_id']}.bin"
                    orphan_path.unlink(missing_ok=True)
                    # Roll back storage counters
                    matching = next((c for c in all_encoded if c.chunk_id == p["chunk_id"]), None)
                    if matching:
                        from backend.metadata.manager import update_node_storage
                        update_node_storage(p["node_id"], size_delta=-matching.size, chunk_delta=-1)
        log_event("UPLOAD_ERROR", str(e), {"filename": file.filename})
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# GET /api/download/{file_id} — Download Pipeline
# ─────────────────────────────────────────────

@app.get("/api/download/{file_id}")
async def download_file(file_id: str):
    """Reconstruct file from orbital fragments."""
    record = get_file(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File ID not found")

    try:
        await manager.broadcast("DOWNLOAD_START", {
            "file_id": file_id,
            "filename": record.filename,
            "message": f"Reconstructing {record.filename}",
        })

        # Build chunk_records list for reassembler
        chunk_records = [
            {
                "chunk_id": c.chunk_id,
                "sequence_number": c.sequence_number,
                "sha256_hash": c.sha256_hash,
                "node_id": c.node_id,
                "is_parity": c.is_parity,
                "pad_size": c.pad_size,
            }
            for c in record.chunks
        ]

        # Call reassembler with node_status callable (CPU+I/O bound — offload)
        result = await asyncio.to_thread(
            fetch_and_reassemble,
            chunk_records=chunk_records,
            get_node_status=get_node_status,
            file_hash=record.full_sha256,
            original_file_size=record.size,
        )

        file_bytes = result["data"]
        latency = result["latency"]
        rs_used = result["rs_recovery"]

        await manager.broadcast("DOWNLOAD_COMPLETE", {
            "file_id": file_id,
            "filename": record.filename,
            "size": len(file_bytes),
            "rs_recovery": rs_used,
            "latency": latency,
            "message": f"{record.filename} reconstructed and verified intact",
        })

        # Broadcast latency breakdown for Metric 4 waterfall chart
        await manager.broadcast("METRIC_UPDATE", {
            "reconstruction_latency": latency,
            "rs_recovery": rs_used,
        })

        return Response(
            content=file_bytes,
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{record.filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            },
        )

    except Exception as e:
        await manager.broadcast("DOWNLOAD_FAILED", {
            "file_id": file_id,
            "error": str(e),
        })
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")


# ─────────────────────────────────────────────
# DELETE /api/delete/{file_id} — Delete Pipeline
# ─────────────────────────────────────────────

@app.delete("/api/delete/{file_id}")
async def delete_file_endpoint(file_id: str):
    """Delete a file and its shards from the orbital grid."""
    from backend.metadata.manager import delete_file, get_file
    
    record = get_file(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File ID not found")

    # Evict ALL chunk entries from ground cache before deleting physical files
    for chunk in record.chunks:
        ground_cache.evict(chunk.chunk_id)

    filename = record.filename
    success = delete_file(file_id)
    
    if success:
        await manager.broadcast("FILE_DELETED", {
            "file_id": file_id,
            "filename": filename,
            "message": f"{filename} securely erased from all orbital nodes",
        })
        # Post-delete: broadcast metrics
        await _broadcast_metrics()
        
        return {"success": True, "message": f"{filename} deleted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Internal error during file deletion")

# ─────────────────────────────────────────────
# GET /api/files — List All Files
# ─────────────────────────────────────────────

@app.get("/api/files")
async def list_files():
    files = get_all_files()
    return {
        "files": [
            {
                "file_id": f.file_id,
                "filename": f.filename,
                "size": f.size,
                "chunk_count": f.chunk_count,
                "uploaded_at": f.uploaded_at,
            }
            for f in files
        ]
    }


# ─────────────────────────────────────────────
# GET /api/tle — TLE CORS Proxy
# ─────────────────────────────────────────────

@app.get("/api/tle")
async def get_tle_data():
    """Proxy CelesTrak TLE data through the backend to avoid browser CORS/403 errors."""
    import urllib.request
    from fastapi.responses import PlainTextResponse

    def _fetch_tle():
        url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) COSMEON-FS-LITE'})
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.read().decode('utf-8')

    try:
        # Blocking network I/O — offload to thread so event loop stays free
        text = await asyncio.to_thread(_fetch_tle)
        return PlainTextResponse(content=text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch TLE data: {str(e)}")

# ─────────────────────────────────────────────
# GET /api/nodes — List All Node Statuses
# ─────────────────────────────────────────────

@app.get("/api/nodes")
async def list_nodes():
    nodes = get_all_nodes()
    return {
        "nodes": [
            {
                "node_id": n.node_id,
                "plane": n.plane,
                "status": n.status,
                "health_score": n.health_score,
                "storage_used": n.storage_used,
                "chunk_count": n.chunk_count,
                "orbit_timer": n.orbit_timer,
                "dtn_queue_depth": n.dtn_queue_depth,
            }
            for n in nodes
        ]
    }
# ─────────────────────────────────────────────
# GET /api/fs/state — Full File System State
# ─────────────────────────────────────────────

@app.get("/api/fs/state")
async def get_fs_state():
    """Return complete state for the Frontend Storage Visualization."""
    nodes = get_all_nodes()
    files = get_all_files()
    
    # Format chunks for easy frontend consumption
    formatted_files = []
    for f in files:
        formatted_files.append({
            "file_id": f.file_id,
            "filename": f.filename,
            "size": f.size,
            "chunk_count": f.chunk_count,
            "chunks": [
                {
                    "chunk_id": c.chunk_id,
                    "node_id": c.node_id,
                    "is_parity": c.is_parity,
                    "sequence_number": c.sequence_number
                } for c in f.chunks
            ]
        })
        
    return {
        "nodes": [
            {
                "node_id": n.node_id,
                "plane": n.plane,
                "status": n.status,
                "storage_used": n.storage_used,
            }
            for n in nodes
        ],
        "files": formatted_files,
        "cache": ground_cache.stats()
    }


# ─────────────────────────────────────────────
# POST /api/node/{node_id}/toggle — Toggle Online/Offline

# ─────────────────────────────────────────────

@app.post("/api/node/{node_id}/toggle")
async def toggle_node(node_id: str):
    current = get_node_status(node_id)
    if current == "ONLINE":
        set_offline(node_id)
        new_status = "OFFLINE"
    else:
        set_online(node_id)
        new_status = "ONLINE"

    await manager.broadcast(f"NODE_{new_status}", {
        "node_id": node_id,
        "status": new_status,
        "message": f"{node_id} toggled → {new_status}",
    })

    return {"node_id": node_id, "status": new_status}


# ─────────────────────────────────────────────
# POST /api/restore — delegates to chaos restore
# ─────────────────────────────────────────────

@app.post("/api/restore")
async def restore():
    """Delegates to chaos restore endpoint for consistent behavior."""
    from backend.intelligence.chaos import restore as chaos_restore
    return await chaos_restore()


# ─────────────────────────────────────────────
# GET /api/metrics — Full Metrics Snapshot
# ─────────────────────────────────────────────

@app.get("/api/metrics")
async def get_metrics():
    return await _build_metrics()


async def _build_metrics() -> dict:
    """Build complete metrics snapshot."""
    chunk_counts = get_chunk_distribution()
    online_count = sum(1 for n in get_all_nodes() if n.status == "ONLINE")

    return get_full_metrics_snapshot(
        chunk_counts=chunk_counts,
        integrity_counter=integrity_counter,
        cache_hit_rate=ground_cache.hit_rate,
        online_nodes=online_count,
    )


async def _broadcast_metrics() -> None:
    """Broadcast current metrics to all WebSocket clients."""
    metrics = await _build_metrics()
    await manager.broadcast("METRIC_UPDATE", metrics)


# ─────────────────────────────────────────────
# GET /api/topology/audit — Judge-Proof Topology Verification
# ─────────────────────────────────────────────

@app.get("/api/topology/audit")
async def topology_audit():
    """
    Audits ALL stored files and verifies the hard topology constraint:
    No data chunk and its paired parity chunk share an orbital plane.
    Judges can hit this endpoint to verify correctness.
    """
    files = get_all_files()
    results = []
    for f in files:
        placements = [
            {
                "chunk_id": c.chunk_id,
                "node_id": c.node_id,
                "sequence_number": c.sequence_number,
                "is_parity": c.is_parity,
            }
            for c in f.chunks
        ]
        audit = verify_topology(placements)
        results.append({
            "file_id": f.file_id,
            "filename": f.filename,
            "topology_valid": audit["valid"],
            "violations": audit["violations"],
        })

    all_valid = all(r["topology_valid"] for r in results)
    return {
        "all_valid": all_valid,
        "file_count": len(results),
        "results": results,
    }
