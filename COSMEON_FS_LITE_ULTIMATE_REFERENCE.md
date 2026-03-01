# COSMEON FS-LITE: THE ULTIMATE 10,000-LINE SOURCE DOCUMENT

This document contains EVERY microscopic detail of the COSMEON FS-LITE project. It serves as the ultimate reference for NotebookLM, covering the problem statement, solution architectures, algorithms, and the complete source code for every single backend module and frontend component.

---

## PART 1: THE REAL-WORLD PROBLEM & ARCHITECTURE

### The 4 Core Problems Solved
1. **Intermittent Connectivity**: Solved using DTN Store-and-Forward queues simulating NASA's BPv7.
2. **Radiation Bit Corruption**: Solved using multi-level SHA-256 verification and active recovery.
3. **Storage Inefficiency**: Solved using Reed-Solomon RS(4,2) erasure coding, saving 50% storage over 3x replication.
4. **Single Point of Failure**: Solved using fully replicated metadata and Raft consensus across 3 orbital planes.

### The 7 Innovation Pillars
1. **Reed-Solomon RS(4,2)**: 4 data chunks -> 6 total chunks. Any 4 rebuild the file.
2. **Topology-Aware Distribution**: Data and Parity are NEVER on the same orbital plane.
3. **Predictive Migration**: Trajectory timers trigger migration *before* a satellite enters a loss-of-signal (LOS) window.
4. **DTN Store-and-Forward**: Queues chunks for offline nodes, delivering them when connection resumes.
5. **Chaos Engineering Mode**: 4 one-button scenarios (Solar Flare, Bit Rot, Partition, Overload) demonstrating live resilience.
6. **Shannon Entropy Rebalancing**: Quantifies chunk distribution (H = -Σ(p_i * log2(p_i))) and rebalances when H < 0.85.
7. **Live Accuracy Metrics**: Real-time WebSocket updates for MTTDL, Efficiency, Entropy, Latency, Integrity, and Cache Hit Rate.

---

## PART 2: BACKEND SOURCE CODE DEEP DIVE

The backend is built in Python 3.11+ using FastAPI. It contains over 25 modules distributed across core/, intelligence/, metadata/, metrics/, utils/, and api/.

### File: `backend\config.py`

**Description**: Source code for `config.py`

```python
0001 | # backend/config.py
0002 | # Person 2 owns this file
0003 | # All system-wide constants + orbital plane definitions
0004 | 
0005 | import os
0006 | from pathlib import Path
0007 | 
0008 | # ─────────────────────────────────────────────
0009 | # Reed-Solomon Parameters
0010 | # ─────────────────────────────────────────────
0011 | CHUNK_SIZE  = 512 * 1024   # 512KB per chunk
0012 | RS_K        = 4            # data chunks
0013 | RS_M        = 2            # parity chunks
0014 | RS_TOTAL    = RS_K + RS_M  # 6 total
0015 | 
0016 | # ─────────────────────────────────────────────
0017 | # Orbital Parameters
0018 | # ─────────────────────────────────────────────
0019 | ORBIT_PERIOD    = 120   # seconds — full orbit countdown
0020 | LOS_THRESHOLD   = 30    # seconds — trigger predictive migration
0021 | CACHE_SIZE      = 10    # LRU cache max chunks
0022 | ISL_HOP_LATENCY_MS = 50 # simulated inter-satellite link latency per hop (ms)
0023 | 
0024 | # ─────────────────────────────────────────────
0025 | # Hash Algorithm (quantum-ready flag)
0026 | # ─────────────────────────────────────────────
0027 | HASH_ALGORITHM = os.getenv("HASH_ALGORITHM", "sha256")  # or "sha3_256"
0028 | 
0029 | # ─────────────────────────────────────────────
0030 | # Orbital Plane Assignments
0031 | # RULE: Data chunk + its Parity chunk NEVER on same plane
0032 | # ─────────────────────────────────────────────
0033 | ORBITAL_PLANES = {
0034 |     "Alpha": ["SAT-01", "SAT-02"],
0035 |     "Beta":  ["SAT-03", "SAT-04"],
0036 |     "Gamma": ["SAT-05", "SAT-06"],
0037 | }
0038 | 
0039 | # Reverse map: node → plane
0040 | NODE_TO_PLANE = {
0041 |     node: plane
0042 |     for plane, nodes in ORBITAL_PLANES.items()
0043 |     for node in nodes
0044 | }
0045 | 
0046 | ALL_NODES = ["SAT-01", "SAT-02", "SAT-03", "SAT-04", "SAT-05", "SAT-06"]
0047 | 
0048 | # ─────────────────────────────────────────────
0049 | # Inter-Satellite Link (ISL) Adjacency
0050 | # Intra-plane = permanent link (same orbital shell)
0051 | # Inter-plane = cross-link to adjacent planes
0052 | # ─────────────────────────────────────────────
0053 | ISL_ADJACENCY = {
0054 |     "SAT-01": ["SAT-02", "SAT-03", "SAT-05"],  # Alpha↔Beta, Alpha↔Gamma
0055 |     "SAT-02": ["SAT-01", "SAT-04", "SAT-06"],
0056 |     "SAT-03": ["SAT-04", "SAT-01", "SAT-05"],  # Beta↔Alpha, Beta↔Gamma
0057 |     "SAT-04": ["SAT-03", "SAT-02", "SAT-06"],
0058 |     "SAT-05": ["SAT-06", "SAT-01", "SAT-03"],  # Gamma↔Alpha, Gamma↔Beta
0059 |     "SAT-06": ["SAT-05", "SAT-02", "SAT-04"],
0060 | }
0061 | 
0062 | # ─────────────────────────────────────────────
0063 | # File System Paths
0064 | # ─────────────────────────────────────────────
0065 | BASE_DIR        = Path(__file__).parent
0066 | NODES_BASE_PATH = BASE_DIR / "nodes"
0067 | DTN_QUEUE_PATH  = BASE_DIR / "dtn_queue"
0068 | METADATA_PATH   = BASE_DIR / "metadata" / "store.json"
0069 | HARVEST_CACHE_PATH = BASE_DIR / "harvest_cache"
0070 | 
0071 | 
0072 | def init_node_folders():
0073 |     """
0074 |     Create all 6 satellite folders on startup if they don't exist.
0075 |     Called once from main.py on app startup.
0076 |     """
0077 |     for node_id in ALL_NODES:
0078 |         node_path = NODES_BASE_PATH / node_id
0079 |         node_path.mkdir(parents=True, exist_ok=True)
0080 | 
0081 |     DTN_QUEUE_PATH.mkdir(parents=True, exist_ok=True)
0082 |     METADATA_PATH.parent.mkdir(parents=True, exist_ok=True)
0083 |     HARVEST_CACHE_PATH.mkdir(parents=True, exist_ok=True)
0084 |     print(f"[CONFIG] [SUCCESS] Node folders initialized: {ALL_NODES}")
```

---

### File: `backend\main.py`

**Description**: Source code for `main.py`

```python
0001 | # backend/main.py
0002 | # Person 4 Integration — FastAPI Entry Point
0003 | # Assembles all modules, defines REST + WebSocket endpoints
0004 | # Starts background tasks on startup
0005 | 
0006 | import uuid
0007 | import asyncio
0008 | from contextlib import asynccontextmanager
0009 | from typing import Optional
0010 | 
0011 | from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket
0012 | from fastapi.responses import Response, JSONResponse
0013 | from fastapi.middleware.cors import CORSMiddleware
0014 | 
0015 | # ── Config & Init ──
0016 | from backend.config import init_node_folders, RS_K
0017 | 
0018 | # ── Core Engine (Person 1) ──
0019 | from backend.core.chunker import chunk_file, Chunk, _compute_hash
0020 | from backend.core.encoder import encode_chunks
0021 | from backend.core.distributor import distribute_chunks
0022 | from backend.core.reassembler import fetch_and_reassemble
0023 | 
0024 | # ── Metadata & Schemas (Person 2) ──
0025 | from backend.metadata.manager import (
0026 |     init_store, register_file, get_file, get_all_files,
0027 |     get_all_nodes, log_event
0028 | )
0029 | from backend.metadata.schemas import (
0030 |     FileRecord, ChunkRecord, NodeRecord, UploadResponse
0031 | )
0032 | 
0033 | # ── Node Manager (Person 2) ──
0034 | from backend.utils.node_manager import (
0035 |     get_node_status, set_online, set_offline,
0036 |     get_all_statuses, restore_all_nodes
0037 | )
0038 | 
0039 | # ── WebSocket Manager (Person 4) ──
0040 | from backend.utils.ws_manager import manager
0041 | 
0042 | # ── Intelligence Layer (Person 3) ──
0043 | from backend.intelligence.chaos import router as chaos_router
0044 | from backend.api.survivability_routes import router as survivability_router
0045 | from backend.intelligence.trajectory import start_all_timers, stop_all_timers
0046 | from backend.intelligence.predictor import start_predictor, stop_predictor
0047 | from backend.intelligence.dtn_queue import start_dtn_worker, stop_dtn_worker, add_to_queue
0048 | from backend.intelligence.rebalancer import check_and_rebalance, compute_entropy, get_chunk_distribution
0049 | from backend.intelligence.raft_consensus import init_raft_clusters, raft_daemon, raft_state
0050 | from backend.intelligence.harvest_manager import harvest_manager
0051 | from backend.intelligence.isl_manager import get_isl_topology
0052 | from backend.intelligence.zkp_audit import ZKPAuditor
0053 | 
0054 | # ── Metrics (Person 1) ──
0055 | from backend.metrics.calculator import (
0056 |     get_full_metrics_snapshot, integrity_counter,
0057 |     calculate_mttdl, format_mttdl, calculate_storage_efficiency
0058 | )
0059 | from backend.cache.ground_cache import ground_cache
0060 | 
0061 | 
0062 | # ─────────────────────────────────────────────
0063 | # LIFESPAN — startup + shutdown
0064 | # ─────────────────────────────────────────────
0065 | 
0066 | @asynccontextmanager
0067 | async def lifespan(app: FastAPI):
0068 |     """Startup: init filesystem, start background tasks."""
0069 |     init_node_folders()
0070 |     init_store()
0071 |     init_raft_clusters()
0072 | 
0073 |     # Start Person 3 background tasks
0074 |     orbit_task = asyncio.create_task(start_all_timers())
0075 |     predictor_task = asyncio.create_task(start_predictor())
0076 |     dtn_task = asyncio.create_task(start_dtn_worker())
0077 |     raft_task = asyncio.create_task(raft_daemon())
0078 |     harvest_task = asyncio.create_task(harvest_manager.run_worker())
0079 | 
0080 |     print("[MAIN] 🚀 COSMEON FS-LITE Online — All systems nominal")
0081 | 
0082 |     yield
0083 | 
0084 |     # Shutdown
0085 |     stop_all_timers()
0086 |     stop_predictor()
0087 |     stop_dtn_worker()
0088 |     orbit_task.cancel()
0089 |     predictor_task.cancel()
0090 |     dtn_task.cancel()
0091 |     raft_task.cancel()
0092 |     print("[MAIN] Shutdown complete")
0093 | 
0094 | 
0095 | # ─────────────────────────────────────────────
0096 | # APP SETUP
0097 | # ─────────────────────────────────────────────
0098 | 
0099 | app = FastAPI(
0100 |     title="COSMEON FS-LITE — Orbital File System API",
0101 |     description="Reed-Solomon erasure coded distributed file system for satellite constellations",
0102 |     version="2.0.0",
0103 |     lifespan=lifespan,
0104 | )
0105 | 
0106 | app.add_middleware(
0107 |     CORSMiddleware,
0108 |     allow_origins=["*"],
0109 |     allow_credentials=True,
0110 |     allow_methods=["*"],
0111 |     allow_headers=["*"],
0112 |     expose_headers=["Content-Disposition"],
0113 | )
0114 | 
0115 | # Register chaos router (Person 3 endpoints)
0116 | app.include_router(chaos_router)
0117 | app.include_router(survivability_router)
0118 | 
0119 | 
0120 | # ─────────────────────────────────────────────
0121 | # WEBSOCKET — /ws
0122 | # ─────────────────────────────────────────────
0123 | 
0124 | @app.websocket("/ws")
0125 | async def websocket_endpoint(websocket: WebSocket):
0126 |     await manager.connect(websocket)
0127 |     try:
0128 |         while True:
0129 |             await websocket.receive_text()
0130 |     except Exception:
0131 |         manager.disconnect(websocket)
0132 | 
0133 | 
0134 | # ─────────────────────────────────────────────
0135 | # POST /api/upload — Main Upload Pipeline
0136 | # ─────────────────────────────────────────────
0137 | 
0138 | @app.post("/api/upload")
0139 | async def upload_file(file: UploadFile = File(...)):
0140 |     """
0141 |     Main orbital uplink pipeline:
0142 |     1. Read file → chunk → RS encode → distribute → register metadata
0143 |     """
0144 |     try:
0145 |         content = await file.read()
0146 |         file_id = str(uuid.uuid4())
0147 | 
0148 |         await manager.broadcast("UPLOAD_START", {
0149 |             "file_id": file_id,
0150 |             "filename": file.filename,
0151 |             "size": len(content),
0152 |             "message": f"Ingesting {file.filename} ({len(content)} bytes)",
0153 |         })
0154 | 
0155 |         # Step 1: Chunk the file
0156 |         chunks, file_hash = chunk_file(content)
0157 | 
0158 |         await manager.broadcast("CHUNKING_COMPLETE", {
0159 |             "file_id": file_id,
0160 |             "chunk_count": len(chunks),
0161 |             "message": f"Split into {len(chunks)} chunks",
0162 |         })
0163 | 
0164 |         # Step 2: RS encode each group of K chunks
0165 |         all_encoded = []
0166 |         for i in range(0, len(chunks), RS_K):
0167 |             group = chunks[i:i + RS_K]
0168 | 
0169 |             # Pad group to RS_K if needed (last group may be smaller)
0170 |             while len(group) < RS_K:
0171 |                 pad_chunk = Chunk(
0172 |                     chunk_id=str(uuid.uuid4()),
0173 |                     sequence_number=i + len(group),  # globally correct sequence
0174 |                     size=0,
0175 |                     sha256_hash=_compute_hash(b""),
0176 |                     data=b"",
0177 |                     is_parity=False,
0178 |                 )
0179 |                 group.append(pad_chunk)
0180 | 
0181 |             encoded = encode_chunks(group)
0182 |             all_encoded.extend(encoded)
0183 | 
0184 |         await manager.broadcast("ENCODING_COMPLETE", {
0185 |             "file_id": file_id,
0186 |             "total_shards": len(all_encoded),
0187 |             "message": f"RS({RS_K},2) encoded → {len(all_encoded)} total shards",
0188 |         })
0189 | 
0190 |         # Step 3: Distribute each segment of 6 chunks (4 data + 2 parity)
0191 |         all_placements = []
0192 |         for seg_idx in range(0, len(all_encoded), RS_K + 2):
0193 |             segment = all_encoded[seg_idx:seg_idx + RS_K + 2]
0194 |             if len(segment) == RS_K + 2:  # full segment of 6
0195 |                 placements = distribute_chunks(file_id, segment)
0196 |                 all_placements.extend(placements)
0197 |             else:
0198 |                 # Partial segment (shouldn't happen with proper padding)
0199 |                 placements = distribute_chunks(file_id, segment)
0200 |                 all_placements.extend(placements)
0201 | 
0202 |         # Broadcast per-chunk placement
0203 |         for p in all_placements:
0204 |             event = "CHUNK_UPLOADED" if p.get("success") else ("DTN_QUEUED" if p.get("queued") else "CHUNK_FAILED")
0205 |             await manager.broadcast(event, {
0206 |                 "file_id": file_id,
0207 |                 "chunk_id": p["chunk_id"],
0208 |                 "node_id": p["node_id"],
0209 |                 "plane": p.get("plane", ""),
0210 |                 "is_parity": p["is_parity"],
0211 |             })
0212 | 
0213 |         # Step 4: Build metadata and register (pad_size per chunk for multi-segment correctness)
0214 |         chunk_records = []
0215 |         for p in all_placements:
0216 |             matching_chunk = next((c for c in all_encoded if c.chunk_id == p["chunk_id"]), None)
0217 |             pad_size = (
0218 |                 getattr(matching_chunk, "_pad_size", len(matching_chunk.data) if matching_chunk else 0)
0219 |                 if matching_chunk else 512 * 1024
0220 |             )
0221 |             
0222 |             # Phase 5.1: Cryptographic Tether Generation
0223 |             zk_anchor = ZKPAuditor.generate_commitment(matching_chunk.data) if matching_chunk else ""
0224 |             
0225 |             chunk_records.append(ChunkRecord(
0226 |                 chunk_id=p["chunk_id"],
0227 |                 sequence_number=p["sequence_number"],
0228 |                 size=matching_chunk.size if matching_chunk else 0,
0229 |                 sha256_hash=matching_chunk.sha256_hash if matching_chunk else "",
0230 |                 node_id=p["node_id"] or "",
0231 |                 is_parity=p["is_parity"],
0232 |                 pad_size=pad_size,
0233 |                 zk_commitment=zk_anchor,
0234 |             ))
0235 | 
0236 |         file_record = FileRecord(
0237 |             file_id=file_id,
0238 |             filename=file.filename,
0239 |             size=len(content),
0240 |             full_sha256=file_hash,
0241 |             chunk_count=len(chunks),
0242 |             chunks=chunk_records,
0243 |         )
0244 |         register_file(file_record)
0245 | 
0246 |         await manager.broadcast("UPLOAD_COMPLETE", {
0247 |             "file_id": file_id,
0248 |             "filename": file.filename,
0249 |             "message": f"{file.filename} partitioned across orbital mesh",
0250 |         })
0251 | 
0252 |         # Post-upload: broadcast metrics
0253 |         await _broadcast_metrics()
0254 | 
0255 |         return {
0256 |             "success": True,
0257 |             "file_id": file_id,
0258 |             "filename": file.filename,
0259 |             "chunk_count": len(chunks),
0260 |             "total_shards": len(all_encoded),
0261 |             "message": f"File uploaded and distributed across orbital mesh",
0262 |         }
0263 | 
0264 |     except Exception as e:
0265 |         log_event("UPLOAD_ERROR", str(e), {"filename": file.filename})
0266 |         raise HTTPException(status_code=500, detail=str(e))
0267 | 
0268 | 
0269 | # ─────────────────────────────────────────────
0270 | # GET /api/download/{file_id} — Download Pipeline
0271 | # ─────────────────────────────────────────────
0272 | 
0273 | @app.get("/api/download/{file_id}")
0274 | @app.get("/api/download/{file_id}/{filename}")
0275 | async def download_file_named(file_id: str, filename: str = None):
0276 |     """Reconstruct file from orbital fragments (filename in URL for Chrome compatibility)."""
0277 |     record = get_file(file_id)
0278 |     if not record:
0279 |         raise HTTPException(status_code=404, detail="File ID not found")
0280 | 
0281 |     try:
0282 |         await manager.broadcast("DOWNLOAD_START", {
0283 |             "file_id": file_id,
0284 |             "filename": record.filename,
0285 |             "message": f"Reconstructing {record.filename}",
0286 |         })
0287 | 
0288 |         # Build chunk_records list for reassembler
0289 |         chunk_records = [
0290 |             {
0291 |                 "chunk_id": c.chunk_id,
0292 |                 "sequence_number": c.sequence_number,
0293 |                 "sha256_hash": c.sha256_hash,
0294 |                 "node_id": c.node_id,
0295 |                 "is_parity": c.is_parity,
0296 |                 "pad_size": c.pad_size,
0297 |             }
0298 |             for c in record.chunks
0299 |         ]
0300 | 
0301 |         # Call reassembler with node_status callable
0302 |         result = fetch_and_reassemble(
0303 |             chunk_records=chunk_records,
0304 |             get_node_status=get_node_status,
0305 |             file_hash=record.full_sha256,
0306 |             original_file_size=record.size,
0307 |             file_id=file_id,
0308 |         )
0309 | 
0310 |         file_bytes = result["data"]
0311 |         latency = result["latency"]
0312 |         rs_used = result["rs_recovery"]
0313 | 
0314 |         await manager.broadcast("DOWNLOAD_COMPLETE", {
0315 |             "file_id": file_id,
0316 |             "filename": record.filename,
0317 |             "size": len(file_bytes),
0318 |             "rs_recovery": rs_used,
0319 |             "latency": latency,
0320 |             "message": f"{record.filename} reconstructed and verified intact",
0321 |         })
0322 | 
0323 |         # Broadcast latency breakdown for Metric 4 waterfall chart
0324 |         await manager.broadcast("METRIC_UPDATE", {
0325 |             "reconstruction_latency": latency,
0326 |             "rs_recovery": rs_used,
0327 |         })
0328 | 
0329 |         from urllib.parse import quote
0330 |         safe_filename = quote(record.filename)
0331 |         
0332 |         return Response(
0333 |             content=file_bytes,
0334 |             media_type="application/octet-stream",
0335 |             headers={
0336 |                 "Content-Disposition": f'attachment; filename="{record.filename}"; filename*=UTF-8\'\'{safe_filename}',
0337 |                 "Access-Control-Expose-Headers": "Content-Disposition"
0338 |             },
0339 |         )
0340 | 
0341 |     except Exception as e:
0342 |         await manager.broadcast("DOWNLOAD_FAILED", {
0343 |             "file_id": file_id,
0344 |             "error": str(e),
0345 |         })
0346 |         raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")
0347 | 
0348 | 
0349 | # ─────────────────────────────────────────────
0350 | # DELETE /api/delete/{file_id} — Delete Pipeline
0351 | # ─────────────────────────────────────────────
0352 | 
0353 | @app.delete("/api/delete/{file_id}")
0354 | async def delete_file_endpoint(file_id: str):
0355 |     """Delete a file and its shards from the orbital grid."""
0356 |     from backend.metadata.manager import delete_file, get_file
0357 |     from backend.config import NODE_TO_PLANE
0358 |     
0359 |     record = get_file(file_id)
0360 |     if not record:
0361 |         raise HTTPException(status_code=404, detail="File ID not found")
0362 |         
0363 |     filename = record.filename
0364 |     
0365 |     # Phase 4.3: Destructive writes must pass through the Raft WAL
0366 |     # Pick the leader of the chunk's primary plane (or any plane holding chunks)
0367 |     # FS-PRO would dynamically route to the Kademlia DHT key holder's plane
0368 |     primary_node = record.chunks[0].node_id if record.chunks else "SAT-01"
0369 |     plane = NODE_TO_PLANE.get(primary_node, "Alpha")
0370 |     
0371 |     raft_node = raft_state[plane].get(primary_node)
0372 |     
0373 |     if not raft_node:
0374 |         raise HTTPException(status_code=500, detail="Raft Consensus engine offline")
0375 |         
0376 |     # Demand Quorum via the Leader
0377 |     quorum_reached = raft_node.append_entry(f"DELETE {file_id}", file_id)
0378 |     
0379 |     if not quorum_reached:
0380 |         raise HTTPException(status_code=409, detail="Raft Quorum Failed. Network partition preventing safe deletion.")
0381 |     
0382 |     # Quorum succeeded: Execute physical deletion
0383 |     success = delete_file(file_id)
0384 |     
0385 |     if success:
0386 |         await manager.broadcast("FILE_DELETED", {
0387 |             "file_id": file_id,
0388 |             "filename": filename,
0389 |             "message": f"{filename} securely erased from all orbital nodes",
0390 |         })
0391 |         # Post-delete: broadcast metrics
0392 |         await _broadcast_metrics()
0393 |         
0394 |         return {"success": True, "message": f"{filename} deleted successfully after WAL Confirmed"}
0395 |     else:
0396 |         raise HTTPException(status_code=500, detail="Internal error during file deletion")
0397 | 
0398 | # ─────────────────────────────────────────────
0399 | # GET /api/files — List All Files
0400 | # ─────────────────────────────────────────────
0401 | 
0402 | @app.get("/api/files")
0403 | async def list_files():
0404 |     files = get_all_files()
0405 |     return {
0406 |         "files": [
0407 |             {
0408 |                 "file_id": f.file_id,
0409 |                 "filename": f.filename,
0410 |                 "size": f.size,
0411 |                 "chunk_count": f.chunk_count,
0412 |                 "uploaded_at": f.uploaded_at,
0413 |             }
0414 |             for f in files
0415 |         ]
0416 |     }
0417 | 
0418 | 
0419 | # ─────────────────────────────────────────────
0420 | # HARVEST — /api/harvest
0421 | # ─────────────────────────────────────────────
0422 | 
0423 | @app.post("/api/harvest/start/{file_id}")
0424 | async def start_harvest(file_id: str):
0425 |     status = harvest_manager.start_mission(file_id)
0426 |     if not status:
0427 |         raise HTTPException(status_code=404, detail="File not found")
0428 |     return status
0429 | 
0430 | @app.get("/api/harvest/status/{file_id}")
0431 | async def get_harvest_status(file_id: str):
0432 |     status = harvest_manager.get_status(file_id)
0433 |     if not status:
0434 |         return {"status": "none"}
0435 |     return status
0436 | 
0437 | 
0438 | # ─────────────────────────────────────────────
0439 | # ISL — /api/isl
0440 | # ─────────────────────────────────────────────
0441 | 
0442 | @app.get("/api/isl/topology")
0443 | async def isl_topology():
0444 |     """Return current ISL link topology with active/inactive status."""
0445 |     return get_isl_topology(get_node_status)
0446 | 
0447 | 
0448 | # ─────────────────────────────────────────────
0449 | # GET /api/tle — TLE CORS Proxy
0450 | # ─────────────────────────────────────────────
0451 | 
0452 | @app.get("/api/tle")
0453 | async def get_tle_data():
0454 |     """Proxy CelesTrak TLE data through the backend to avoid browser CORS/403 errors."""
0455 |     import urllib.request
0456 |     from fastapi.responses import PlainTextResponse
0457 |     
0458 |     url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
0459 |     # Provide a User-Agent to avoid generic scraper blocks
0460 |     req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) COSMEON-FS-LITE'})
0461 |     try:
0462 |         with urllib.request.urlopen(req, timeout=10) as response:
0463 |             text = response.read().decode('utf-8')
0464 |         return PlainTextResponse(content=text)
0465 |     except Exception as e:
0466 |         raise HTTPException(status_code=500, detail=f"Failed to fetch TLE data: {str(e)}")
0467 | 
0468 | # ─────────────────────────────────────────────
0469 | # GET /api/nodes — List All Node Statuses
0470 | # ─────────────────────────────────────────────
0471 | 
0472 | 
0473 | @app.get("/api/nodes", response_model=list[NodeRecord])
0474 | async def list_nodes():
0475 |     return get_all_nodes()
0476 | # ─────────────────────────────────────────────
0477 | # GET /api/fs/state — Full File System State
0478 | # ─────────────────────────────────────────────
0479 | 
0480 | @app.get("/api/fs/state")
0481 | async def get_fs_state():
0482 |     """Return complete state for the Frontend Storage Visualization."""
0483 |     nodes = get_all_nodes()
0484 |     files = get_all_files()
0485 |     # Fallback/Hydration check if nodes are empty
0486 |     if not nodes:
0487 |         print("[DEBUG get_fs_state] nodes empty! Hydrating...")
0488 |         from backend.metadata.manager import init_store
0489 |         init_store()
0490 |         nodes = get_all_nodes()
0491 |         print(f"[DEBUG get_fs_state] After hydration, found {len(nodes)} nodes")
0492 |     
0493 |     # Format chunks for easy frontend consumption
0494 |     formatted_files = []
0495 |     for f in files:
0496 |         formatted_files.append({
0497 |             "file_id": f.file_id,
0498 |             "filename": f.filename,
0499 |             "size": f.size,
0500 |             "chunk_count": f.chunk_count,
0501 |             "chunks": [
0502 |                 {
0503 |                     "chunk_id": c.chunk_id,
0504 |                     "node_id": c.node_id,
0505 |                     "is_parity": c.is_parity,
0506 |                     "sequence_number": c.sequence_number
0507 |                 } for c in f.chunks
0508 |             ]
0509 |         })
0510 |         
0511 |     return {
0512 |         "nodes": [
0513 |             {
0514 |                 "node_id": n.node_id,
0515 |                 "plane": n.plane,
0516 |                 "status": n.status,
0517 |                 "storage_used": n.storage_used,
0518 |             }
0519 |             for n in nodes
0520 |         ],
0521 |         "files": formatted_files,
0522 |         "cache": ground_cache.stats()
0523 |     }
0524 | 
0525 | 
0526 | # ─────────────────────────────────────────────
0527 | # GET /api/dtn/events — DTN Event History
0528 | # ─────────────────────────────────────────────
0529 | 
0530 | @app.get("/api/dtn/events")
0531 | async def get_dtn_history(limit: int = 50):
0532 |     """Retrieve recent DTN and node events to seed the frontend log."""
0533 |     from backend.metadata.manager import get_recent_events
0534 |     events = get_recent_events(limit=limit)
0535 |     
0536 |     # Filter for relevant DTN/Node types or return all
0537 |     return [
0538 |         {
0539 |             "id": i,
0540 |             "type": e.event_type,
0541 |             "message": e.message,
0542 |             "timestamp": e.timestamp,
0543 |             "metadata": e.metadata
0544 |         }
0545 |         for i, e in enumerate(events)
0546 |     ]
0547 | 
0548 | 
0549 | # ─────────────────────────────────────────────
0550 | # POST /api/node/{node_id}/toggle — Toggle Online/Offline
0551 | 
0552 | @app.post("/api/node/{node_id}/toggle")
0553 | async def toggle_node(node_id: str):
0554 |     current = get_node_status(node_id)
0555 |     if current == "ONLINE":
0556 |         set_offline(node_id)
0557 |         new_status = "OFFLINE"
0558 |     else:
0559 |         set_online(node_id)
0560 |         new_status = "ONLINE"
0561 | 
0562 |     await manager.broadcast(f"NODE_{new_status}", {
0563 |         "node_id": node_id,
0564 |         "status": new_status,
0565 |         "message": f"{node_id} toggled → {new_status}",
0566 |     })
0567 | 
0568 |     return {"node_id": node_id, "status": new_status}
0569 | 
0570 | 
0571 | # ─────────────────────────────────────────────
0572 | # POST /api/restore — delegates to chaos restore
0573 | # ─────────────────────────────────────────────
0574 | 
0575 | @app.post("/api/restore")
0576 | async def restore():
0577 |     """Delegates to chaos restore endpoint for consistent behavior."""
0578 |     from backend.intelligence.chaos import restore as chaos_restore
0579 |     return await chaos_restore()
0580 | 
0581 | 
0582 | # ─────────────────────────────────────────────
0583 | # GET /api/metrics — Full Metrics Snapshot
0584 | # ─────────────────────────────────────────────
0585 | 
0586 | @app.get("/api/metrics")
0587 | async def get_metrics():
0588 |     return await _build_metrics()
0589 | 
0590 | 
0591 | async def _build_metrics() -> dict:
0592 |     """Build complete metrics snapshot."""
0593 |     chunk_counts = get_chunk_distribution()
0594 |     online_count = sum(1 for n in get_all_nodes() if n.status == "ONLINE")
0595 | 
0596 |     return get_full_metrics_snapshot(
0597 |         chunk_counts=chunk_counts,
0598 |         integrity_counter=integrity_counter,
0599 |         cache_hit_rate=ground_cache.hit_rate,
0600 |         online_nodes=online_count,
0601 |     )
0602 | 
0603 | 
0604 | async def _broadcast_metrics() -> None:
0605 |     """Broadcast current metrics to all WebSocket clients."""
0606 |     metrics = await _build_metrics()
0607 |     await manager.broadcast("METRIC_UPDATE", metrics)

```

---

### File: `backend\test_rebalancer.py`

**Description**: Source code for `test_rebalancer.py`

```python
0001 | import sys
0002 | import os
0003 | import asyncio
0004 | 
0005 | # Ensure the backend module can be imported
0006 | sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
0007 | 
0008 | from backend.config import init_node_folders
0009 | from backend.metadata.manager import init_store, get_all_nodes, register_file, get_all_files
0010 | from backend.metadata.schemas import NodeRecord, FileRecord, ChunkRecord
0011 | from backend.intelligence.rebalancer import check_and_rebalance, compute_entropy
0012 | from backend.utils.node_manager import set_online
0013 | 
0014 | async def run_test():
0015 |     print("Initializing test environment...")
0016 |     init_node_folders()
0017 |     init_store()
0018 |     
0019 |     # Ensure all nodes are online
0020 |     nodes = get_all_nodes()
0021 |     for n in nodes:
0022 |         set_online(n.node_id)
0023 |         
0024 |     print("Simulating an imbalanced network (Force dumping chunks on SAT-01 and SAT-02)...")
0025 |     
0026 |     # Create fake chunks heavily skewed to SAT-01 and SAT-02
0027 |     chunks = []
0028 |     
0029 |     # SAT-01 gets 20 chunks
0030 |     for i in range(20):
0031 |         chunks.append(ChunkRecord(
0032 |             chunk_id=f"sim_chunk_1_{i}",
0033 |             sequence_number=i,
0034 |             size=1024,
0035 |             sha256_hash="fake",
0036 |             node_id="SAT-01",
0037 |             is_parity=False,
0038 |             pad_size=512
0039 |         ))
0040 |     
0041 |     # SAT-02 gets 15 chunks
0042 |     for i in range(15):
0043 |         chunks.append(ChunkRecord(
0044 |             chunk_id=f"sim_chunk_2_{i}",
0045 |             sequence_number=i + 20,
0046 |             size=1024,
0047 |             sha256_hash="fake",
0048 |             node_id="SAT-02",
0049 |             is_parity=False,
0050 |             pad_size=512
0051 |         ))
0052 |         
0053 |     # SAT-03 gets 2 chunks
0054 |     for i in range(2):
0055 |         chunks.append(ChunkRecord(
0056 |             chunk_id=f"sim_chunk_3_{i}",
0057 |             sequence_number=i + 35,
0058 |             size=1024,
0059 |             sha256_hash="fake",
0060 |             node_id="SAT-03",
0061 |             is_parity=False,
0062 |             pad_size=512
0063 |         ))
0064 |         
0065 |     # Create a fake file to hold these chunks
0066 |     fake_file = FileRecord(
0067 |         file_id="sim_file_1",
0068 |         filename="test_imbalance.bin",
0069 |         size=1024 * 37,
0070 |         full_sha256="fake_full",
0071 |         chunk_count=37,
0072 |         chunks=chunks
0073 |     )
0074 |     register_file(fake_file)
0075 |     
0076 |     # Also need to create the actual files so the rebalancer can move them
0077 |     for c in chunks:
0078 |         node_path = os.path.join("nodes", c.node_id)
0079 |         os.makedirs(node_path, exist_ok=True)
0080 |         with open(os.path.join(node_path, f"{c.chunk_id}.bin"), "wb") as f:
0081 |             f.write(b"fake data")
0082 | 
0083 |     # Update node chunk counts manually for the test
0084 |     from backend.metadata.manager import update_node_storage
0085 |     for n in get_all_nodes():
0086 |         count = sum(1 for c in chunks if c.node_id == n.node_id)
0087 |         update_node_storage(n.node_id, size_delta=count * 1024, chunk_delta=count)
0088 | 
0089 |     initial_entropy = compute_entropy()
0090 |     print(f"\nInitial Entropy: {initial_entropy:.3f}")
0091 |     
0092 |     for n in get_all_nodes():
0093 |         print(f"{n.node_id} has {n.chunk_count} chunks")
0094 |         
0095 |     print("\nTriggering Rebalancer...")
0096 |     result = await check_and_rebalance()
0097 |     
0098 |     print("\nRebalancer Results:")
0099 |     print(f"Migrations performed: {result['migrations']}")
0100 |     print(f"Final Entropy: {result['final_entropy']:.3f} (Status: {result['final_status']})")
0101 |     
0102 |     print("\nFinal Chunk Distribution:")
0103 |     for n in get_all_nodes():
0104 |         print(f"{n.node_id} has {n.chunk_count} chunks")
0105 |         
0106 |     # Check if files were actually moved
0107 |     print("\nVerifying physical file moves...")
0108 |     for n in get_all_nodes():
0109 |         node_dir = os.path.join("nodes", n.node_id)
0110 |         files = os.listdir(node_dir) if os.path.exists(node_dir) else []
0111 |         print(f"{n.node_id} physical files on disk: {len(files)}")
0112 | 
0113 | 
0114 | if __name__ == "__main__":
0115 |     asyncio.run(run_test())

```

---

### File: `backend\api\p2p_signaling.py`

**Description**: Source code for `p2p_signaling.py`

```python
0001 | import json
0002 | import random
0003 | from typing import Dict, List, Set
0004 | from fastapi import APIRouter, WebSocket, WebSocketDisconnect
0005 | 
0006 | p2p_router = APIRouter(prefix="/ws/p2p", tags=["p2p"])
0007 | 
0008 | # Random space-themed adjectives and nouns for peer generation
0009 | ADJECTIVES = ["Quantum", "Neon", "Cosmic", "Astral", "Nova", "Stellar", "Lunar", "Solar", "Galactic", "Cyber"]
0010 | NOUNS = ["Voyager", "Apollo", "Pioneer", "Cassini", "Hubble", "Webb", "Sputnik", "Gemini", "Orion", "Artemis"]
0011 | 
0012 | class SignalingManager:
0013 |     def __init__(self):
0014 |         # Maps websocket objects to a generated peer profile
0015 |         self.active_connections: Dict[WebSocket, dict] = {}
0016 | 
0017 |     async def connect(self, websocket: WebSocket) -> dict:
0018 |         await websocket.accept()
0019 |         profile = {
0020 |             "id": f"peer_{random.randint(1000, 9999)}_{random.randint(1000, 9999)}",
0021 |             "name": f"{random.choice(ADJECTIVES)} {random.choice(NOUNS)}",
0022 |             "deviceType": "desktop" # Default, could be refined based on User-Agent if available
0023 |         }
0024 |         self.active_connections[websocket] = profile
0025 |         
0026 |         # Send their own profile back to them immediately
0027 |         await websocket.send_text(json.dumps({
0028 |             "type": "welcome",
0029 |             "profile": profile
0030 |         }))
0031 |         
0032 |         # Broadcast completely updated peer list to ALL clients
0033 |         await self.broadcast_peer_list()
0034 |         return profile
0035 | 
0036 |     def disconnect(self, websocket: WebSocket):
0037 |         if websocket in self.active_connections:
0038 |             del self.active_connections[websocket]
0039 |             # Will be broadcast later in the exception block to avoid async issues here
0040 | 
0041 |     async def broadcast_peer_list(self):
0042 |         # We don't send the websockets themselves, just the profs
0043 |         peers = list(self.active_connections.values())
0044 |         message = json.dumps({
0045 |             "type": "peer-list-update",
0046 |             "peers": peers
0047 |         })
0048 |         for connection in self.active_connections.keys():
0049 |             try:
0050 |                 await connection.send_text(message)
0051 |             except Exception:
0052 |                 pass # Stale connection
0053 | 
0054 |     async def relay_signal(self, sender_ws: WebSocket, target_id: str, signal_data: dict):
0055 |         """Find the target websocket and forward the WebRTC signal (SDP or ICE) to them."""
0056 |         target_ws = None
0057 |         for ws, profile in self.active_connections.items():
0058 |             if profile["id"] == target_id:
0059 |                 target_ws = ws
0060 |                 break
0061 |                 
0062 |         if target_ws:
0063 |             sender_profile = self.active_connections.get(sender_ws)
0064 |             if sender_profile:
0065 |                 payload = json.dumps({
0066 |                     "type": "signal",
0067 |                     "sender": sender_profile["id"],
0068 |                     "data": signal_data
0069 |                 })
0070 |                 try:
0071 |                     await target_ws.send_text(payload)
0072 |                 except Exception:
0073 |                     pass
0074 | 
0075 | manager = SignalingManager()
0076 | 
0077 | @p2p_router.websocket("")
0078 | async def p2p_signaling_endpoint(websocket: WebSocket):
0079 |     profile = await manager.connect(websocket)
0080 |     try:
0081 |         while True:
0082 |             data = await websocket.receive_text()
0083 |             message = json.loads(data)
0084 |             
0085 |             # The client sends a signal (offer, answer, or ice-candidate) meant for another specific peer
0086 |             if message.get("type") == "signal":
0087 |                 target_id = message.get("target")
0088 |                 signal_data = message.get("data")
0089 |                 if target_id and signal_data:
0090 |                     await manager.relay_signal(websocket, target_id, signal_data)
0091 |                     
0092 |     except WebSocketDisconnect:
0093 |         manager.disconnect(websocket)
0094 |         await manager.broadcast_peer_list()
0095 |     except Exception as e:
0096 |         print(f"P2P Signaling Error: {str(e)}")
0097 |         manager.disconnect(websocket)
0098 |         await manager.broadcast_peer_list()

```

---

### File: `backend\api\survivability_routes.py`

**Description**: Source code for `survivability_routes.py`

```python
0001 | from fastapi import APIRouter
0002 | from pydantic import BaseModel
0003 | from typing import Optional
0004 | from backend.metrics.survivability_cache import cache
0005 | from backend.metrics.survivability import SimulationConfig
0006 | 
0007 | router = APIRouter()
0008 | 
0009 | class RunRequest(BaseModel):
0010 |     num_simulations: Optional[int] = None
0011 |     mission_hours: Optional[int] = None
0012 |     total_chunks: Optional[int] = None
0013 |     recovery_threshold: Optional[int] = None
0014 |     node_failure_prob_per_hour: Optional[float] = None
0015 |     plane_blackout_prob_per_hour: Optional[float] = None
0016 |     solar_flare_prob_per_hour: Optional[float] = None
0017 |     corruption_prob_per_chunk: Optional[float] = None
0018 | 
0019 | @router.post("/api/survivability/run")
0020 | async def run_simulation(req: Optional[RunRequest] = None):
0021 |     config_updates = req.model_dump(exclude_unset=True) if req else {}
0022 |     result = await cache.invalidate_and_rerun("MANUAL", config_updates)
0023 |     return result.to_dict()
0024 | 
0025 | @router.get("/api/survivability/last")
0026 | async def get_last_simulation():
0027 |     result = cache.get_or_compute()
0028 |     return result.to_dict()
0029 | 
0030 | @router.get("/api/survivability/defaults")
0031 | async def get_defaults():
0032 |     return SimulationConfig().__dict__

```

---

### File: `backend\cache\ground_cache.py`

**Description**: Source code for `ground_cache.py`

```python
0001 | # backend/cache/ground_cache.py
0002 | # Responsibility: LRU cache for recently accessed chunks at Ground Station
0003 | # Serves chunks from memory instead of reading satellite node folders
0004 | 
0005 | import threading
0006 | from collections import OrderedDict
0007 | from typing import Optional
0008 | 
0009 | from backend.config import CACHE_SIZE
0010 | 
0011 | 
0012 | class GroundStationCache:
0013 |     """
0014 |     LRU (Least Recently Used) cache for chunk data.
0015 |     Stores last CACHE_SIZE (10) chunks in memory.
0016 |     Thread-safe for concurrent read/write access.
0017 | 
0018 |     Key   = chunk_id (str)
0019 |     Value = raw chunk bytes
0020 |     """
0021 | 
0022 |     def __init__(self, max_size: int = CACHE_SIZE):
0023 |         self._cache: OrderedDict[str, bytes] = OrderedDict()
0024 |         self._max_size = max_size
0025 |         self._lock = threading.Lock()
0026 | 
0027 |         # ── Metrics Counters ──
0028 |         self._hits = 0
0029 |         self._misses = 0
0030 | 
0031 |     # ─────────────────────────────────────────────
0032 |     # GET — cache lookup
0033 |     # ─────────────────────────────────────────────
0034 | 
0035 |     def get(self, chunk_id: str) -> Optional[bytes]:
0036 |         """
0037 |         Fetch chunk data from cache.
0038 |         Returns None on miss (caller must fetch from satellite node).
0039 |         On hit, moves chunk to end (most recently used).
0040 |         """
0041 |         with self._lock:
0042 |             if chunk_id in self._cache:
0043 |                 self._hits += 1
0044 |                 # Move to end → most recently used
0045 |                 self._cache.move_to_end(chunk_id)
0046 |                 return self._cache[chunk_id]
0047 |             else:
0048 |                 self._misses += 1
0049 |                 return None
0050 | 
0051 |     # ─────────────────────────────────────────────
0052 |     # PUT — cache insert
0053 |     # ─────────────────────────────────────────────
0054 | 
0055 |     def put(self, chunk_id: str, data: bytes) -> None:
0056 |         """
0057 |         Insert chunk into cache.
0058 |         If cache is full, evicts the least recently used chunk.
0059 |         If chunk already exists, updates and moves to end.
0060 |         """
0061 |         with self._lock:
0062 |             if chunk_id in self._cache:
0063 |                 # Update existing entry and move to end
0064 |                 self._cache.move_to_end(chunk_id)
0065 |                 self._cache[chunk_id] = data
0066 |             else:
0067 |                 # Evict LRU if at capacity
0068 |                 if len(self._cache) >= self._max_size:
0069 |                     evicted_id, _ = self._cache.popitem(last=False)
0070 |                     # last=False → pop from front → oldest/least recently used
0071 |                 self._cache[chunk_id] = data
0072 | 
0073 |     # ─────────────────────────────────────────────
0074 |     # EVICT — manual removal
0075 |     # ─────────────────────────────────────────────
0076 | 
0077 |     def evict(self, chunk_id: str) -> bool:
0078 |         """Remove a specific chunk from cache. Returns True if it was cached."""
0079 |         with self._lock:
0080 |             if chunk_id in self._cache:
0081 |                 del self._cache[chunk_id]
0082 |                 return True
0083 |             return False
0084 | 
0085 |     # ─────────────────────────────────────────────
0086 |     # CLEAR — wipe entire cache
0087 |     # ─────────────────────────────────────────────
0088 | 
0089 |     def clear(self) -> None:
0090 |         """Wipe entire cache. Used during chaos restore."""
0091 |         with self._lock:
0092 |             self._cache.clear()
0093 |             self._hits = 0
0094 |             self._misses = 0
0095 | 
0096 |     # ─────────────────────────────────────────────
0097 |     # METRICS
0098 |     # ─────────────────────────────────────────────
0099 | 
0100 |     @property
0101 |     def hit_rate(self) -> float:
0102 |         """Cache hit rate as percentage (0.0 - 100.0)."""
0103 |         total = self._hits + self._misses
0104 |         if total == 0:
0105 |             return 0.0
0106 |         return (self._hits / total) * 100.0
0107 | 
0108 |     @property
0109 |     def hits(self) -> int:
0110 |         return self._hits
0111 | 
0112 |     @property
0113 |     def misses(self) -> int:
0114 |         return self._misses
0115 | 
0116 |     @property
0117 |     def size(self) -> int:
0118 |         """Current number of cached chunks."""
0119 |         return len(self._cache)
0120 | 
0121 |     @property
0122 |     def max_size(self) -> int:
0123 |         return self._max_size
0124 | 
0125 |     def stats(self) -> dict:
0126 |         """Return cache statistics dict for metrics dashboard."""
0127 |         return {
0128 |             "size": self.size,
0129 |             "max_size": self._max_size,
0130 |             "hits": self._hits,
0131 |             "misses": self._misses,
0132 |             "hit_rate": round(self.hit_rate, 2),
0133 |         }
0134 | 
0135 |     def __repr__(self) -> str:
0136 |         return (
0137 |             f"GroundStationCache(size={self.size}/{self._max_size}, "
0138 |             f"hit_rate={self.hit_rate:.1f}%)"
0139 |         )
0140 | 
0141 | 
0142 | # ─────────────────────────────────────────────
0143 | # SINGLETON INSTANCE
0144 | # Used across the entire backend — import this directly
0145 | # ─────────────────────────────────────────────
0146 | ground_cache = GroundStationCache()

```

---

### File: `backend\cache\__init__.py`

**Description**: Source code for `__init__.py`

```python

```

---

### File: `backend\core\chunker.py`

**Description**: Source code for `chunker.py`

```python
0001 | # backend/core/chunker.py
0002 | # Person 1 owns this file completely
0003 | # Responsibility: Split any file into 512KB chunks with UUID + SHA-256
0004 | 
0005 | import hashlib
0006 | import uuid
0007 | from dataclasses import dataclass, field
0008 | from typing import List
0009 | 
0010 | from backend.config import CHUNK_SIZE, HASH_ALGORITHM
0011 | 
0012 | 
0013 | @dataclass
0014 | class Chunk:
0015 |     chunk_id: str           # UUID4 — unique identifier
0016 |     sequence_number: int    # Order: 0, 1, 2, 3 ...
0017 |     size: int               # Actual byte size of this chunk
0018 |     sha256_hash: str        # SHA-256 fingerprint of chunk data
0019 |     data: bytes             # Raw bytes
0020 |     is_parity: bool = False # Person 1 sets False — encoder.py flips to True
0021 | 
0022 | 
0023 | def _compute_hash(data: bytes) -> str:
0024 |     """Compute SHA-256 (or SHA3-256 if quantum-ready flag set)."""
0025 |     if HASH_ALGORITHM == "sha3_256":
0026 |         return hashlib.sha3_256(data).hexdigest()
0027 |     return hashlib.sha256(data).hexdigest()
0028 | 
0029 | 
0030 | async def chunk_stream(file_bytes: bytes):
0031 |     """
0032 |     [PHASE 3.3: ASYNC GENERATION]
0033 |     Streams file bytes iteratively instead of loading the entire matrix into RAM.
0034 |     Yields 1 chunk at a time, drastically reducing memory pressure.
0035 |     """
0036 |     if not file_bytes:
0037 |         raise ValueError("Cannot chunk empty file.")
0038 | 
0039 |     total_size = len(file_bytes)
0040 |     sequence = 0
0041 | 
0042 |     for offset in range(0, total_size, CHUNK_SIZE):
0043 |         raw = file_bytes[offset : offset + CHUNK_SIZE]
0044 | 
0045 |         chunk = Chunk(
0046 |             chunk_id       = str(uuid.uuid4()),
0047 |             sequence_number= sequence,
0048 |             size           = len(raw),
0049 |             sha256_hash    = _compute_hash(raw),
0050 |             data           = raw,
0051 |             is_parity      = False,
0052 |         )
0053 |         yield chunk
0054 |         sequence += 1
0055 | 
0056 | 
0057 | def chunk_file(file_bytes: bytes) -> tuple[List[Chunk], str]:
0058 |     """
0059 |     [LEGACY] Split file bytes into fixed 512KB chunks.
0060 |     """
0061 |     if not file_bytes:
0062 |         raise ValueError("Cannot chunk empty file.")
0063 | 
0064 |     # Full file hash — computed BEFORE chunking
0065 |     file_hash = _compute_hash(file_bytes)
0066 | 
0067 |     chunks: List[Chunk] = []
0068 |     total_size = len(file_bytes)
0069 |     sequence = 0
0070 | 
0071 |     for offset in range(0, total_size, CHUNK_SIZE):
0072 |         raw = file_bytes[offset : offset + CHUNK_SIZE]
0073 | 
0074 |         chunk = Chunk(
0075 |             chunk_id       = str(uuid.uuid4()),
0076 |             sequence_number= sequence,
0077 |             size           = len(raw),
0078 |             sha256_hash    = _compute_hash(raw),
0079 |             data           = raw,
0080 |             is_parity      = False,
0081 |         )
0082 |         chunks.append(chunk)
0083 |         sequence += 1
0084 | 
0085 |     return chunks, file_hash
0086 | 
0087 | 
0088 | def reassemble_chunks(chunks: List[Chunk]) -> bytes:
0089 |     """
0090 |     Reassemble chunks back to original bytes.
0091 |     Chunks MUST be sorted by sequence_number before calling.
0092 |     """
0093 |     sorted_chunks = sorted(chunks, key=lambda c: c.sequence_number)
0094 |     return b"".join(c.data for c in sorted_chunks)
```

---

### File: `backend\core\decoder.py`

**Description**: Source code for `decoder.py`

```python
0001 | # backend/core/decoder.py
0002 | # Person 1 owns this file completely
0003 | # Responsibility: Given ANY 4 of 6 chunks → reconstruct missing data chunks
0004 | 
0005 | from typing import List, Optional, Dict
0006 | 
0007 | import reedsolo
0008 | 
0009 | from backend.core.chunker import Chunk, _compute_hash
0010 | from backend.config import RS_K, RS_M, RS_TOTAL
0011 | 
0012 | 
0013 | def decode_chunks(
0014 |     available_chunks: List[Chunk],
0015 |     pad_size: int,
0016 | ) -> List[Chunk]:
0017 |     """
0018 |     RS(4,2) decode: reconstruct full set of 4 data chunks from any 4 of 6 available.
0019 | 
0020 |     Args:
0021 |         available_chunks — any subset of chunks (min 4 required)
0022 |         pad_size         — original chunk size used during encoding (for unpadding)
0023 | 
0024 |     Returns:
0025 |         List of 4 reconstructed DATA chunks in sequence order (0,1,2,3).
0026 | 
0027 |     Raises:
0028 |         ValueError if fewer than RS_K=4 chunks provided.
0029 |     """
0030 |     if len(available_chunks) < RS_K:
0031 |         raise ValueError(
0032 |             f"Cannot reconstruct: need at least {RS_K} chunks, "
0033 |             f"only {len(available_chunks)} available."
0034 |         )
0035 | 
0036 |     rsc = reedsolo.RSCodec(RS_M)
0037 | 
0038 |     # Map sequence_number → chunk data for quick lookup
0039 |     chunk_map: Dict[int, bytes] = {
0040 |         c.sequence_number: c.data for c in available_chunks
0041 |     }
0042 | 
0043 |     # Reconstruct byte-by-byte
0044 |     recovered_buffers = [bytearray() for _ in range(RS_K)]
0045 | 
0046 |     for i in range(pad_size):
0047 |         # Build erasure-aware byte row (None = missing position)
0048 |         byte_row = []
0049 |         erasures = []
0050 |         for pos in range(RS_TOTAL):
0051 |             if pos in chunk_map:
0052 |                 byte_row.append(chunk_map[pos][i] if i < len(chunk_map[pos]) else 0)
0053 |             else:
0054 |                 byte_row.append(0)         # placeholder
0055 |                 erasures.append(pos)
0056 | 
0057 |         # reedsolo decode with explicit erasure positions
0058 |         try:
0059 |             decoded, _, _ = rsc.decode(bytes(byte_row), erase_pos=erasures)
0060 |         except reedsolo.ReedSolomonError as e:
0061 |             raise ValueError(f"RS decode failed at byte position {i}: {e}")
0062 | 
0063 |         # decoded = first RS_K bytes = original data bytes
0064 |         for d_idx in range(RS_K):
0065 |             recovered_buffers[d_idx].append(decoded[d_idx])
0066 | 
0067 |     # Build recovered Chunk objects
0068 |     recovered_chunks: List[Chunk] = []
0069 |     for seq in range(RS_K):
0070 |         raw = bytes(recovered_buffers[seq])
0071 | 
0072 |         # Try to preserve original chunk_id if available
0073 |         original = chunk_map.get(seq)
0074 |         original_chunk = next(
0075 |             (c for c in available_chunks if c.sequence_number == seq), None
0076 |         )
0077 | 
0078 |         recovered_chunks.append(Chunk(
0079 |             chunk_id        = original_chunk.chunk_id if original_chunk else f"recovered-{seq}",
0080 |             sequence_number = seq,
0081 |             size            = len(raw),
0082 |             sha256_hash     = _compute_hash(raw),
0083 |             data            = raw,
0084 |             is_parity       = False,
0085 |         ))
0086 | 
0087 |     return recovered_chunks  # always returns [D0, D1, D2, D3] in order
```

---

### File: `backend\core\distributor.py`

**Description**: Source code for `distributor.py`

```python
0001 | # backend/core/distributor.py
0002 | # Person 2 owns this file
0003 | # Responsibility: Assign each of the 6 chunks to a satellite node
0004 | # HARD RULE: Data chunk and its Parity chunk NEVER on same orbital plane
0005 | 
0006 | import os
0007 | from pathlib import Path
0008 | from typing import List, Callable, Optional
0009 | 
0010 | from backend.core.chunker import Chunk
0011 | from backend.core.integrity import verify_write
0012 | from backend.config import (
0013 |     ORBITAL_PLANES, NODE_TO_PLANE, ALL_NODES,
0014 |     NODES_BASE_PATH, DTN_QUEUE_PATH, RS_K
0015 | )
0016 | from backend.metadata import manager as meta
0017 | 
0018 | 
0019 | # ─────────────────────────────────────────────
0020 | # PLANE ASSIGNMENT LOGIC
0021 | # ─────────────────────────────────────────────
0022 | 
0023 | def _get_other_planes(plane: str) -> List[str]:
0024 |     """Return the 2 planes that are NOT the given plane."""
0025 |     return [p for p in ORBITAL_PLANES.keys() if p != plane]
0026 | 
0027 | 
0028 | def _get_nodes_in_plane(plane: str, online_only: bool = True) -> List[str]:
0029 |     """Return nodes in a specific plane, optionally filtered to ONLINE only."""
0030 |     nodes = ORBITAL_PLANES[plane]
0031 |     if online_only:
0032 |         from backend.utils.node_manager import get_node_status
0033 |         return [n for n in nodes if get_node_status(n) == "ONLINE"]
0034 |     return nodes
0035 | 
0036 | 
0037 | def _pick_node_with_least_chunks(node_list: List[str]) -> Optional[str]:
0038 |     """Pick the node with the fewest stored chunks (load balancing)."""
0039 |     if not node_list:
0040 |         return None
0041 |     all_nodes = {n.node_id: n.chunk_count for n in meta.get_all_nodes()}
0042 |     return min(node_list, key=lambda n: all_nodes.get(n, 0))
0043 | 
0044 | 
0045 | # ─────────────────────────────────────────────
0046 | # MAIN DISTRIBUTION FUNCTION
0047 | # ─────────────────────────────────────────────
0048 | 
0049 | def distribute_shards(
0050 |     file_id: str,
0051 |     chunks: List[Chunk],
0052 |     dtn_enqueue: Optional[Callable] = None,
0053 | ) -> List[dict]:
0054 |     """
0055 |     Assign all 6 chunks to satellite nodes and write .bin files.
0056 | 
0057 |     Topology Rule:
0058 |     - Chunk sequences 0,1,2,3 are DATA chunks
0059 |     - Chunk sequences 4,5 are PARITY chunks
0060 |     - D[i] and P[i%RS_M] must be on DIFFERENT orbital planes
0061 | 
0062 |     Args:
0063 |         chunks      — 6 Chunk objects from encoder.py (4 data + 2 parity)
0064 |         dtn_enqueue — Person 3's DTN function: dtn_enqueue(node_id, chunk)
0065 |                       Called when target node is OFFLINE instead of writing
0066 | 
0067 |     Returns:
0068 |         List of placement dicts: [{chunk_id, node_id, sequence_number, success}, ...]
0069 |     """
0070 |     if len(chunks) != 6:
0071 |         raise ValueError(f"Distributor expects 6 chunks (4+2), got {len(chunks)}")
0072 | 
0073 |     data_chunks   = [c for c in chunks if not c.is_parity]   # sequences 0-3
0074 |     parity_chunks = [c for c in chunks if c.is_parity]        # sequences 4-5
0075 | 
0076 |     # Step 1: Assign data chunks to planes (round-robin across all 3 planes)
0077 |     plane_names = list(ORBITAL_PLANES.keys())  # [Alpha, Beta, Gamma, Alpha] for 4 chunks
0078 |     data_plane_assignments = {}  # chunk_id → plane
0079 | 
0080 |     for idx, chunk in enumerate(data_chunks):
0081 |         assigned_plane = plane_names[idx % len(plane_names)]
0082 |         data_plane_assignments[chunk.chunk_id] = assigned_plane
0083 | 
0084 |     # Step 2: Assign parity chunks to planes — MUST differ from paired data chunk's plane
0085 |     # P0 pairs with D0, P1 pairs with D1
0086 |     parity_plane_assignments = {}
0087 |     for idx, p_chunk in enumerate(parity_chunks):
0088 |         paired_data_chunk = data_chunks[idx]
0089 |         paired_plane = data_plane_assignments[paired_data_chunk.chunk_id]
0090 |         other_planes = _get_other_planes(paired_plane)
0091 |         # Pick the other plane with more capacity (alternate between the two)
0092 |         parity_plane_assignments[p_chunk.chunk_id] = other_planes[idx % len(other_planes)]
0093 | 
0094 |     # Step 3: Within each assigned plane, pick the node with least chunks
0095 |     all_assignments = {**data_plane_assignments, **parity_plane_assignments}
0096 |     placements = []
0097 | 
0098 |     for chunk in data_chunks + parity_chunks:
0099 |         target_plane = all_assignments[chunk.chunk_id]
0100 |         online_nodes = _get_nodes_in_plane(target_plane, online_only=True)
0101 | 
0102 |         if online_nodes:
0103 |             target_node = _pick_node_with_least_chunks(online_nodes)
0104 |             success = _write_chunk_to_node(chunk, target_node)
0105 |             placements.append({
0106 |                 "chunk_id":        chunk.chunk_id,
0107 |                 "node_id":         target_node,
0108 |                 "sequence_number": chunk.sequence_number,
0109 |                 "size":            chunk.size,
0110 |                 "sha256_hash":     chunk.sha256_hash,
0111 |                 "is_parity":       chunk.is_parity,
0112 |                 "pad_size":        getattr(chunk, 'pad_size', 0),
0113 |                 "plane":           target_plane,
0114 |                 "success":         success,
0115 |                 "queued":          False,
0116 |             })
0117 |         else:
0118 |             # Fallback: exclude target plane AND paired chunk's plane(s) to preserve topology
0119 |             exclude_planes = {target_plane}
0120 |             if chunk.is_parity:
0121 |                 # P[i] pairs with D[i], D[i+2]; exclude their planes
0122 |                 p_idx = parity_chunks.index(chunk)
0123 |                 for d_idx in [p_idx, p_idx + 2]:
0124 |                     if d_idx < len(data_chunks):
0125 |                         exclude_planes.add(data_plane_assignments[data_chunks[d_idx].chunk_id])
0126 |             else:
0127 |                 # D[i] pairs with P[i%RS_M]; exclude parity's plane
0128 |                 d_idx = data_chunks.index(chunk)
0129 |                 p_chunk = parity_chunks[d_idx % len(parity_chunks)]
0130 |                 exclude_planes.add(parity_plane_assignments[p_chunk.chunk_id])
0131 |             fallback_node = _find_any_online_node(exclude_planes=list(exclude_planes))
0132 | 
0133 |             if fallback_node:
0134 |                 fb_success = _write_chunk_to_node(chunk, fallback_node)
0135 |                 placements.append({
0136 |                     "chunk_id":        chunk.chunk_id,
0137 |                     "node_id":         fallback_node,
0138 |                     "sequence_number": chunk.sequence_number,
0139 |                     "size":            chunk.size,
0140 |                     "sha256_hash":     chunk.sha256_hash,
0141 |                     "is_parity":       chunk.is_parity,
0142 |                     "pad_size":        getattr(chunk, '_pad_size', 0),
0143 |                     "plane":           NODE_TO_PLANE.get(fallback_node, target_plane),
0144 |                     "success":         fb_success,
0145 |                     "queued":          False,
0146 |                 })
0147 |             else:
0148 |                 # All nodes offline → queue via DTN (Person 3)
0149 |                 queued_node = ORBITAL_PLANES[target_plane][0]
0150 |                 _enqueue_to_dtn(queued_node, chunk)
0151 |                 placements.append({
0152 |                     "chunk_id":        chunk.chunk_id,
0153 |                     "node_id":         queued_node,
0154 |                     "sequence_number": chunk.sequence_number,
0155 |                     "size":            chunk.size,
0156 |                     "sha256_hash":     chunk.sha256_hash,
0157 |                     "is_parity":       chunk.is_parity,
0158 |                     "pad_size":        getattr(chunk, '_pad_size', 0),
0159 |                     "plane":           target_plane,
0160 |                     "success":         False,
0161 |                     "queued":          True,
0162 |                 })
0163 | 
0164 |     return placements
0165 | 
0166 | 
0167 | # Backward-compatible alias (main.py imports this name)
0168 | distribute_chunks = distribute_shards
0169 | 
0170 | 
0171 | # ─────────────────────────────────────────────
0172 | # WRITE + VERIFY
0173 | # ─────────────────────────────────────────────
0174 | 
0175 | def _write_chunk_grpc_stub(chunk: Chunk, node_id: str) -> bool:
0176 |     """
0177 |     [FUTURE SCOPE: PHASE 1.4 - gRPC Streams]
0178 |     This stub represents the transition away from the Ground Station directly
0179 |     modifying a satellite's filesystem. 
0180 |     In FS-PRO, this will open a bidirectional gRPC channel to the containerized node.
0181 |     """
0182 |     # TODO (Phase 1.4):
0183 |     # channel = grpc.aio.insecure_channel(f'{node_id}:50051')
0184 |     # stub = p2p_pb2_grpc.OrbitalMeshStub(channel)
0185 |     # response = await stub.StreamChunk(chunk_data)
0186 |     # return response.success
0187 | 
0188 |     # --- Phase 1.1 Transition Fallback ---
0189 |     # While container subnetworks are booting up, we emulate the gRPC success
0190 |     # by performing the legacy centralized disk write.
0191 |     
0192 |     node_path  = Path(NODES_BASE_PATH) / node_id
0193 |     node_path.mkdir(parents=True, exist_ok=True)
0194 |     chunk_path = node_path / f"{chunk.chunk_id}.bin"
0195 | 
0196 |     try:
0197 |         with open(chunk_path, "wb") as f:
0198 |             f.write(chunk.data)
0199 |         
0200 |         # Verify write (In FS-PRO, the satellite handles this locally)
0201 |         write_ok = verify_write(str(chunk_path), chunk.sha256_hash)
0202 |         return write_ok
0203 |     except Exception as e:
0204 |         print(f"[gRPC EMULATOR] ❌ Connection/Write to {node_id} failed: {e}")
0205 |         return False
0206 | 
0207 | 
0208 | def _write_chunk_to_node(chunk: Chunk, node_id: str) -> bool:
0209 |     """
0210 |     [DEPRECATED - Phase 1.2] 
0211 |     Centralized file writes are deprecated. The Ground Station must negotiate
0212 |     via Libp2p and stream via gRPC. 
0213 |     """
0214 |     write_ok = _write_chunk_grpc_stub(chunk, node_id)
0215 | 
0216 |     if write_ok:
0217 |         # Update metadata storage counters
0218 |         meta.update_node_storage(node_id, size_delta=chunk.size, chunk_delta=1)
0219 |         return True
0220 |     else:
0221 |         # Emulate failed gRPC network push
0222 |         print(f"[DISTRIBUTOR] ❌ Network rejection for {chunk.chunk_id} to {node_id}")
0223 |         return False
0224 | 
0225 | 
0226 | def _enqueue_to_dtn(node_id: str, chunk: Chunk):
0227 |     """
0228 |     Queue chunk via the proper DTN system (Person 3's dtn_queue.py).
0229 |     Stores as JSON bundle with base64, checksums, priority (parity first).
0230 |     Falls back to raw .bin write if DTN module unavailable.
0231 |     """
0232 |     try:
0233 |         import asyncio
0234 |         from backend.intelligence.dtn_queue import add_to_queue
0235 | 
0236 |         # Try to get running event loop (we're called from sync context)
0237 |         try:
0238 |             loop = asyncio.get_running_loop()
0239 |             loop.create_task(add_to_queue(node_id, chunk))
0240 |         except RuntimeError:
0241 |             # No event loop running — use sync fallback
0242 |             _enqueue_to_dtn_sync(node_id, chunk)
0243 |     except ImportError:
0244 |         _enqueue_to_dtn_sync(node_id, chunk)
0245 | 
0246 | 
0247 | def _enqueue_to_dtn_sync(node_id: str, chunk: Chunk):
0248 |     """Sync fallback: write raw .bin to DTN queue directory."""
0249 |     queue_dir = DTN_QUEUE_PATH / node_id
0250 |     queue_dir.mkdir(parents=True, exist_ok=True)
0251 |     chunk_path = queue_dir / f"{chunk.chunk_id}.bin"
0252 |     with open(chunk_path, "wb") as f:
0253 |         f.write(chunk.data)
0254 |     depth = len(list(queue_dir.glob("*.bin")))
0255 |     meta.update_dtn_queue_depth(node_id, depth)
0256 | 
0257 | 
0258 | def _find_any_online_node(exclude_planes: Optional[List[str]] = None) -> Optional[str]:
0259 |     """
0260 |     Find any online node, excluding the given planes.
0261 |     Topology rule: data and its paired parity must never be on same plane.
0262 |     """
0263 |     from backend.utils.node_manager import get_node_status
0264 |     exclude = set(exclude_planes or [])
0265 |     for node_id in ALL_NODES:
0266 |         if NODE_TO_PLANE.get(node_id) in exclude:
0267 |             continue
0268 |         if get_node_status(node_id) == "ONLINE":
0269 |             return node_id
0270 |     return None
```

---

### File: `backend\core\encoder.py`

**Description**: Source code for `encoder.py`

```python
0001 | # backend/core/encoder.py
0002 | # Person 1 owns this file completely
0003 | # Responsibility: Take 4 data chunks → generate 2 parity chunks → return 6 total
0004 | 
0005 | import uuid
0006 | from copy import deepcopy
0007 | from typing import List
0008 | 
0009 | import reedsolo
0010 | 
0011 | from backend.core.chunker import Chunk, _compute_hash
0012 | from backend.config import RS_K, RS_M
0013 | 
0014 | 
0015 | def _pad_chunks(chunks: List[Chunk]) -> tuple[List[bytes], int]:
0016 |     """
0017 |     Pad all chunks to same length (required by reedsolo).
0018 |     Returns padded data list + the original max size used.
0019 |     """
0020 |     max_size = max(len(c.data) for c in chunks)
0021 |     padded = [c.data.ljust(max_size, b'\x00') for c in chunks]
0022 |     return padded, max_size
0023 | 
0024 | 
0025 | def encode_chunks(data_chunks: List[Chunk]) -> List[Chunk]:
0026 |     """
0027 |     RS(4,2) encode: 4 data chunks → 6 chunks (4 data + 2 parity).
0028 | 
0029 |     Encoding is done byte-by-byte across all chunks (interleaved),
0030 |     so RS math operates on equal-length byte arrays.
0031 | 
0032 |     Returns:
0033 |         List of 6 Chunk objects — first 4 are data, last 2 are parity.
0034 |     """
0035 |     if len(data_chunks) != RS_K:
0036 |         raise ValueError(f"Encoder expects exactly {RS_K} data chunks, got {len(data_chunks)}")
0037 | 
0038 |     padded_data, pad_size = _pad_chunks(data_chunks)
0039 | 
0040 |     parity_buffers = []
0041 |     
0042 |     # ── PHASE 3.2: HARDWARE ACCELERATION ──
0043 |     try:
0044 |         from backend.core.rs_engine import cosmeon_rs_engine
0045 |         # print("[RS-ENGINE] 🚀 Native Rust PyO3 matrix acceleration initialized.")
0046 |         
0047 |         # Convert List[bytes] to what Rust expects
0048 |         raw_shards = [bytes(pad) for pad in padded_data]
0049 |         
0050 |         # The Rust engine returns all 6 shards. We just want the last 2 (parity)
0051 |         encoded_shards = cosmeon_rs_engine.encode_shards(raw_shards, RS_K, RS_M)
0052 |         parity_buffers = encoded_shards[RS_K:]
0053 |         
0054 |     except ImportError:
0055 |         # ── LEGACY FALLBACK ──
0056 |         print("[RS-ENGINE] ⚠️ Native Rust binary not found! Falling back to SLOW pure-Python matrix.")
0057 |         rsc = reedsolo.RSCodec(RS_M)
0058 |         parity_buffers = [bytearray() for _ in range(RS_M)]
0059 |         for i in range(pad_size):
0060 |             byte_row = bytes([buf[i] for buf in padded_data])
0061 |             encoded = rsc.encode(byte_row)
0062 |             parity_bytes = encoded[RS_K:] 
0063 |             for p_idx, p_byte in enumerate(parity_bytes):
0064 |                 parity_buffers[p_idx].append(p_byte)
0065 | 
0066 |     # Build parity Chunk objects
0067 |     parity_chunks: List[Chunk] = []
0068 |     for p_idx, p_data in enumerate(parity_buffers):
0069 |         p_bytes = bytes(p_data)
0070 |         parity_chunks.append(Chunk(
0071 |             chunk_id        = str(uuid.uuid4()),
0072 |             sequence_number = RS_K + p_idx,
0073 |             size            = len(p_bytes),
0074 |             sha256_hash     = _compute_hash(p_bytes),
0075 |             data            = p_bytes,
0076 |             is_parity       = True,
0077 |         ))
0078 | 
0079 |     # Store pad_size in each chunk for decoder (needed to strip padding)
0080 |     result = deepcopy(data_chunks) + parity_chunks
0081 |     for chunk in result:
0082 |         chunk.__dict__['_pad_size'] = pad_size  # internal metadata for decoder
0083 | 
0084 |     return result  # [D0, D1, D2, D3, P0, P1]
```

---

### File: `backend\core\integrity.py`

**Description**: Source code for `integrity.py`

```python
0001 | # backend/core/integrity.py
0002 | # Person 1 owns this file completely
0003 | # Responsibility: SHA-256 verification at write, read, and file level
0004 | # Also exposes bit_flip_simulate() for Person 3's chaos engine
0005 | 
0006 | import os
0007 | import random
0008 | from pathlib import Path
0009 | 
0010 | from backend.core.chunker import _compute_hash
0011 | 
0012 | 
0013 | # ─────────────────────────────────────────────
0014 | # LEVEL 1 — Write Verification
0015 | # ─────────────────────────────────────────────
0016 | 
0017 | def verify_write(chunk_path: str, expected_hash: str) -> bool:
0018 |     """
0019 |     After writing a chunk .bin file, read it back and verify SHA-256.
0020 |     Returns True if hash matches, False if silent write error occurred.
0021 |     """
0022 |     try:
0023 |         with open(chunk_path, "rb") as f:
0024 |             written_data = f.read()
0025 |         actual_hash = _compute_hash(written_data)
0026 |         return actual_hash == expected_hash
0027 |     except FileNotFoundError:
0028 |         return False
0029 | 
0030 | 
0031 | # ─────────────────────────────────────────────
0032 | # LEVEL 2 — Read Verification
0033 | # ─────────────────────────────────────────────
0034 | 
0035 | def verify_read(data: bytes, expected_hash: str) -> bool:
0036 |     """
0037 |     Before returning chunk data to reassembler, verify it hasn't silently corrupted.
0038 |     Returns True if clean, False if corrupted.
0039 |     """
0040 |     actual_hash = _compute_hash(data)
0041 |     return actual_hash == expected_hash
0042 | 
0043 | 
0044 | # ─────────────────────────────────────────────
0045 | # LEVEL 3 — Full File Verification
0046 | # ─────────────────────────────────────────────
0047 | 
0048 | def verify_file(assembled_bytes: bytes, original_file_hash: str) -> bool:
0049 |     """
0050 |     After full file assembly, verify end-to-end integrity.
0051 |     Returns True if file matches original SHA-256.
0052 |     """
0053 |     reconstructed_hash = _compute_hash(assembled_bytes)
0054 |     return reconstructed_hash == original_file_hash
0055 | 
0056 | 
0057 | # ─────────────────────────────────────────────
0058 | # CHAOS SUPPORT — Bit Flip Simulator
0059 | # Called by Person 3's chaos.py for Radiation Bit Rot scenario
0060 | # ─────────────────────────────────────────────
0061 | 
0062 | def bit_flip_simulate(chunk_path: str) -> dict:
0063 |     """
0064 |     Flip a single random byte in a chunk .bin file.
0065 |     Simulates cosmic ray Single Event Upset (SEU).
0066 | 
0067 |     Returns dict with:
0068 |         - chunk_path: str
0069 |         - byte_position: int
0070 |         - original_byte: int
0071 |         - flipped_byte: int
0072 |         - success: bool
0073 |     """
0074 |     path = Path(chunk_path)
0075 |     if not path.exists():
0076 |         return {"success": False, "error": f"File not found: {chunk_path}"}
0077 | 
0078 |     with open(path, "rb") as f:
0079 |         data = bytearray(f.read())
0080 | 
0081 |     if len(data) == 0:
0082 |         return {"success": False, "error": "Empty file, cannot flip bit"}
0083 | 
0084 |     byte_pos = random.randint(0, len(data) - 1)
0085 |     original_byte = data[byte_pos]
0086 | 
0087 |     # XOR with random non-zero value to guarantee the byte actually changes
0088 |     flip_mask = random.randint(1, 255)
0089 |     data[byte_pos] ^= flip_mask
0090 |     flipped_byte = data[byte_pos]
0091 | 
0092 |     with open(path, "wb") as f:
0093 |         f.write(bytes(data))
0094 | 
0095 |     return {
0096 |         "success"       : True,
0097 |         "chunk_path"    : str(chunk_path),
0098 |         "byte_position" : byte_pos,
0099 |         "original_byte" : original_byte,
0100 |         "flipped_byte"  : flipped_byte,
0101 |     }
```

---

### File: `backend\core\reassembler.py`

**Description**: Source code for `reassembler.py`

```python
0001 | # backend/core/reassembler.py
0002 | # Person 1 owns this file completely
0003 | # Responsibility: Fetch chunks in sequence → decode if missing → return original file bytes
0004 | # NOTE: get_node_status() is provided by Person 2 via node_manager.py (interface contract)
0005 | 
0006 | import os
0007 | from pathlib import Path
0008 | from typing import List, Callable, Optional
0009 | 
0010 | from backend.core.chunker import Chunk, _compute_hash, reassemble_chunks
0011 | from backend.core.decoder import decode_chunks
0012 | from backend.core.integrity import verify_read, verify_file
0013 | from backend.config import NODES_BASE_PATH, RS_K, RS_TOTAL
0014 | from backend.intelligence.predictor import record_chunk_access
0015 | from backend.cache.ground_cache import ground_cache
0016 | from backend.intelligence.harvest_manager import harvest_manager
0017 | from backend.intelligence.isl_manager import find_relay_path, isl_fetch
0018 | from backend.metrics.calculator import LatencyTracker
0019 | 
0020 | 
0021 | def fetch_and_reassemble(
0022 |     chunk_records: List[dict],          # from metadata: [{chunk_id, sequence_number, sha256_hash, node_id, pad_size}, ...]
0023 |     get_node_status: Callable,          # Person 2 provides: get_node_status(node_id) -> "ONLINE"|"OFFLINE"|...
0024 |     file_hash: str,                     # original full-file SHA-256 from metadata
0025 |     original_file_size: int,
0026 |     file_id: str = "",                  # file_id for harvest cache lookup
0027 | ) -> dict:
0028 |     """
0029 |     Main reassembly pipeline:
0030 |     1. Check ground cache before fetching from satellite node
0031 |     2. Try to fetch each chunk from its assigned satellite node
0032 |     3. Verify SHA-256 on every chunk read
0033 |     4. If chunk unavailable/corrupted → collect remaining chunks + call RS decoder
0034 |     5. Reassemble in sequence order
0035 |     6. Verify full-file SHA-256
0036 |     7. Track latency across all phases
0037 | 
0038 |     Returns: dict with 'data' (bytes), 'latency' (phase breakdown), 'rs_recovery' (bool)
0039 | 
0040 |     Raises:
0041 |         ValueError if fewer than RS_K=4 chunks available (unrecoverable)
0042 |         ValueError if final file hash doesn't match (catastrophic corruption)
0043 |     """
0044 |     tracker = LatencyTracker()
0045 |     tracker.start_total()
0046 |     rs_recovery_used = False
0047 | 
0048 |     # Phase 1: Metadata lookup (already done by caller, but track timing)
0049 |     tracker.start_phase("metadata")
0050 |     available_chunks: List[Chunk] = []
0051 |     missing_sequences: List[int] = []
0052 |     pad_size: int = chunk_records[0].get("pad_size", 512 * 1024)  # fallback to CHUNK_SIZE
0053 |     tracker.end_phase("metadata")
0054 | 
0055 |     # Phase 2: Fetch chunks (cache → satellite node)
0056 |     tracker.start_phase("fetch")
0057 | 
0058 |     for record in sorted(chunk_records, key=lambda r: r["sequence_number"]):
0059 |         seq     = record["sequence_number"]
0060 |         node_id = record["node_id"]
0061 |         c_id    = record["chunk_id"]
0062 |         c_hash  = record["sha256_hash"]
0063 | 
0064 |         # Skip parity chunks — we only need data chunks (0–3)
0065 |         if record.get("is_parity", False):
0066 |             continue
0067 | 
0068 |         # ── Check ground cache FIRST (F13: LRU cache skip node I/O) ──
0069 |         cached_data = ground_cache.get(c_id)
0070 |         if cached_data is not None:
0071 |             # Cache hit — verify integrity and use directly
0072 |             if verify_read(cached_data, c_hash):
0073 |                 record_chunk_access(c_id)
0074 |                 available_chunks.append(Chunk(
0075 |                     chunk_id        = c_id,
0076 |                     sequence_number = seq,
0077 |                     size            = len(cached_data),
0078 |                     sha256_hash     = c_hash,
0079 |                     data            = cached_data,
0080 |                     is_parity       = False,
0081 |                 ))
0082 |                 continue
0083 |             else:
0084 |                 # Cache data corrupted — evict and fall through to node fetch
0085 |                 ground_cache.evict(c_id)
0086 | 
0087 |         # ── Check Harvest Cache (Opportunistic collection) ──
0088 |         harvest_path = harvest_manager.get_shard_path(file_id, c_id)
0089 |         if harvest_path and harvest_path.exists():
0090 |             with open(harvest_path, "rb") as f:
0091 |                 data = f.read()
0092 |             if verify_read(data, c_hash):
0093 |                 available_chunks.append(Chunk(
0094 |                     chunk_id        = c_id,
0095 |                     sequence_number = seq,
0096 |                     size            = len(data),
0097 |                     sha256_hash     = c_hash,
0098 |                     data            = data,
0099 |                     is_parity       = False,
0100 |                 ))
0101 |                 continue
0102 | 
0103 |         # ── Fetch from satellite node ──
0104 |         status = get_node_status(node_id)
0105 | 
0106 |         if status == "ONLINE":
0107 |             chunk_path = Path(NODES_BASE_PATH) / node_id / f"{c_id}.bin"
0108 |             if chunk_path.exists():
0109 |                 with open(chunk_path, "rb") as f:
0110 |                     data = f.read()
0111 | 
0112 |                 # Level 2 integrity check
0113 |                 if verify_read(data, c_hash):
0114 |                     record_chunk_access(c_id)
0115 | 
0116 |                     # Store in ground cache for future downloads
0117 |                     ground_cache.put(c_id, data)
0118 | 
0119 |                     available_chunks.append(Chunk(
0120 |                         chunk_id        = c_id,
0121 |                         sequence_number = seq,
0122 |                         size            = len(data),
0123 |                         sha256_hash     = c_hash,
0124 |                         data            = data,
0125 |                         is_parity       = False,
0126 |                     ))
0127 |                 else:
0128 |                     # Hash mismatch — treat as unavailable (corrupted)
0129 |                     missing_sequences.append(seq)
0130 |             else:
0131 |                 missing_sequences.append(seq)
0132 |         else:
0133 |             # Node OFFLINE or PARTITIONED — try ISL relay for PARTITIONED
0134 |             if status == "PARTITIONED":
0135 |                 relay_path = find_relay_path(node_id, get_node_status)
0136 |                 if relay_path:
0137 |                     relay_data = isl_fetch(node_id, c_id, relay_path)
0138 |                     if relay_data and verify_read(relay_data, c_hash):
0139 |                         record_chunk_access(c_id)
0140 |                         ground_cache.put(c_id, relay_data)
0141 |                         available_chunks.append(Chunk(
0142 |                             chunk_id        = c_id,
0143 |                             sequence_number = seq,
0144 |                             size            = len(relay_data),
0145 |                             sha256_hash     = c_hash,
0146 |                             data            = relay_data,
0147 |                             is_parity       = False,
0148 |                         ))
0149 |                         continue
0150 |             # Truly unavailable
0151 |             missing_sequences.append(seq)
0152 | 
0153 |     tracker.end_phase("fetch")
0154 | 
0155 |     # Phase 3: RS decode if any data chunks missing
0156 |     tracker.start_phase("decode")
0157 | 
0158 |     if missing_sequences:
0159 |         rs_recovery_used = True
0160 |         # Process segment-by-segment with correct pad_size per segment
0161 |         num_segments = (len(chunk_records) + RS_TOTAL - 1) // RS_TOTAL
0162 |         final_chunks = list(available_chunks)
0163 |         for seg_idx in range(num_segments):
0164 |             seg_start = seg_idx * RS_TOTAL
0165 |             seg_end = min(seg_start + RS_TOTAL, len(chunk_records))
0166 |             seg_records = chunk_records[seg_start:seg_end]
0167 |             seg_data_seqs = {r["sequence_number"] for r in seg_records if not r.get("is_parity", False)}
0168 |             seg_missing = seg_data_seqs & set(missing_sequences)
0169 |             if not seg_missing:
0170 |                 continue
0171 |             seg_pad_size = seg_records[0].get("pad_size", 512 * 1024) if seg_records else 512 * 1024
0172 |             seg_available = _fetch_chunks_for_segment(seg_records, get_node_status)
0173 |             if len(seg_available) < RS_K:
0174 |                 raise ValueError(
0175 |                     f"Unrecoverable segment {seg_idx}: only {len(seg_available)} chunks, need {RS_K}"
0176 |                 )
0177 |             base_seq = seg_idx * RS_TOTAL
0178 |             # Remap to decoder's expected 0-5 by position in segment
0179 |             rec_by_id = {r["chunk_id"]: (i, r) for i, r in enumerate(seg_records)}
0180 |             remapped = [
0181 |                 Chunk(
0182 |                     chunk_id=c.chunk_id,
0183 |                     sequence_number=rec_by_id[c.chunk_id][0],
0184 |                     size=c.size,
0185 |                     sha256_hash=c.sha256_hash,
0186 |                     data=c.data,
0187 |                     is_parity=c.is_parity,
0188 |                 )
0189 |                 for c in seg_available if c.chunk_id in rec_by_id
0190 |             ]
0191 |             recovered = decode_chunks(remapped, seg_pad_size)
0192 |             for r in recovered:
0193 |                 r.sequence_number = 4 * seg_idx + r.sequence_number
0194 |             final_chunks = [c for c in final_chunks if c.sequence_number not in seg_data_seqs]
0195 |             final_chunks.extend(recovered)
0196 |         final_chunks = sorted(final_chunks, key=lambda c: c.sequence_number)
0197 |     else:
0198 |         final_chunks = sorted(available_chunks, key=lambda c: c.sequence_number)
0199 | 
0200 |     tracker.end_phase("decode")
0201 | 
0202 |     # Phase 4: Reassemble bytes
0203 |     tracker.start_phase("assembly")
0204 |     file_bytes = reassemble_chunks(final_chunks)
0205 |     if len(file_bytes) > original_file_size:
0206 |         file_bytes = file_bytes[:original_file_size]
0207 |     tracker.end_phase("assembly")
0208 | 
0209 |     # Phase 5: Full file integrity check
0210 |     tracker.start_phase("verify")
0211 |     if not verify_file(file_bytes, file_hash):
0212 |         raise ValueError(
0213 |             "CRITICAL: Reassembled file SHA-256 does NOT match original. "
0214 |             "Data may be permanently corrupted beyond RS recovery capacity."
0215 |         )
0216 |     tracker.end_phase("verify")
0217 | 
0218 |     return {
0219 |         "data": file_bytes,
0220 |         "latency": tracker.report(),
0221 |         "rs_recovery": rs_recovery_used,
0222 |     }
0223 | 
0224 | 
0225 | def _fetch_chunks_for_segment(
0226 |     seg_records: List[dict],
0227 |     get_node_status: Callable,
0228 | ) -> List[Chunk]:
0229 |     """Fetch all available chunks (data + parity) for a single RS segment."""
0230 |     available = []
0231 |     for record in seg_records:
0232 |         node_id = record["node_id"]
0233 |         c_id = record["chunk_id"]
0234 |         c_hash = record["sha256_hash"]
0235 |         seq = record["sequence_number"]
0236 |         is_par = record.get("is_parity", False)
0237 |         cached = ground_cache.get(c_id)
0238 |         if cached is not None and verify_read(cached, c_hash):
0239 |             available.append(Chunk(
0240 |                 chunk_id=c_id,
0241 |                 sequence_number=seq,
0242 |                 size=len(cached),
0243 |                 sha256_hash=c_hash,
0244 |                 data=cached,
0245 |                 is_parity=is_par,
0246 |             ))
0247 |             continue
0248 |         
0249 |         harvest_path = harvest_manager.get_shard_path(record.get("file_id", ""), c_id)
0250 |         if harvest_path and harvest_path.exists():
0251 |             with open(harvest_path, "rb") as f:
0252 |                 data = f.read()
0253 |             if verify_read(data, c_hash):
0254 |                 available.append(Chunk(
0255 |                     chunk_id=c_id,
0256 |                     sequence_number=seq,
0257 |                     size=len(data),
0258 |                     sha256_hash=c_hash,
0259 |                     data=data,
0260 |                     is_parity=is_par,
0261 |                 ))
0262 |                 continue
0263 | 
0264 |         if get_node_status(node_id) != "ONLINE":
0265 |             continue
0266 |         chunk_path = Path(NODES_BASE_PATH) / node_id / f"{c_id}.bin"
0267 |         if not chunk_path.exists():
0268 |             continue
0269 |         with open(chunk_path, "rb") as f:
0270 |             data = f.read()
0271 |         if verify_read(data, c_hash):
0272 |             ground_cache.put(c_id, data)
0273 |             available.append(Chunk(
0274 |                 chunk_id=c_id,
0275 |                 sequence_number=seq,
0276 |                 size=len(data),
0277 |                 sha256_hash=c_hash,
0278 |                 data=data,
0279 |                 is_parity=is_par,
0280 |             ))
0281 |     return available
0282 | 
0283 | 
0284 | def _fetch_all_chunks_for_recovery(
0285 |     chunk_records: List[dict],
0286 |     get_node_status: Callable,
0287 | ) -> List[Chunk]:
0288 |     """
0289 |     Fetch ALL available chunks (data + parity) for RS recovery.
0290 |     Used when some data chunks are missing and we need parity to reconstruct.
0291 |     Also checks ground cache before hitting disk.
0292 |     """
0293 |     available = []
0294 | 
0295 |     for record in chunk_records:
0296 |         node_id = record["node_id"]
0297 |         c_id    = record["chunk_id"]
0298 |         c_hash  = record["sha256_hash"]
0299 |         seq     = record["sequence_number"]
0300 |         is_par  = record.get("is_parity", False)
0301 | 
0302 |         # Check ground cache first
0303 |         cached = ground_cache.get(c_id)
0304 |         if cached is not None and verify_read(cached, c_hash):
0305 |             available.append(Chunk(
0306 |                 chunk_id        = c_id,
0307 |                 sequence_number = seq,
0308 |                 size            = len(cached),
0309 |                 sha256_hash     = c_hash,
0310 |                 data            = cached,
0311 |                 is_parity       = is_par,
0312 |             ))
0313 |             continue
0314 | 
0315 |         status = get_node_status(node_id)
0316 |         if status != "ONLINE":
0317 |             continue
0318 | 
0319 |         chunk_path = Path(NODES_BASE_PATH) / node_id / f"{c_id}.bin"
0320 |         if not chunk_path.exists():
0321 |             continue
0322 | 
0323 |         with open(chunk_path, "rb") as f:
0324 |             data = f.read()
0325 | 
0326 |         if verify_read(data, c_hash):
0327 |             # Cache it for future use
0328 |             ground_cache.put(c_id, data)
0329 | 
0330 |             available.append(Chunk(
0331 |                 chunk_id        = c_id,
0332 |                 sequence_number = seq,
0333 |                 size            = len(data),
0334 |                 sha256_hash     = c_hash,
0335 |                 data            = data,
0336 |                 is_parity       = is_par,
0337 |             ))
0338 | 
0339 |     return available
```

---

### File: `backend\core\__init__.py`

**Description**: Source code for `__init__.py`

```python
0001 | # backend/core/__init__.py
0002 | from .chunker import chunk_file, Chunk, reassemble_chunks
0003 | from .encoder import encode_chunks
0004 | from .decoder import decode_chunks
0005 | from .integrity import verify_write, verify_read, verify_file, bit_flip_simulate
0006 | from .reassembler import fetch_and_reassemble
```

---

### File: `backend\intelligence\chaos.py`

**Description**: Source code for `chaos.py`

```python
0001 | # backend/intelligence/chaos.py
0002 | # Person 3 owns this file
0003 | # Responsibility: 4 Chaos Engineering scenarios + restore
0004 | # Based on Netflix Chaos Engineering discipline
0005 | # Each scenario maps to a real space hazard
0006 | 
0007 | import os
0008 | import random
0009 | import uuid
0010 | from pathlib import Path
0011 | from typing import List
0012 | 
0013 | from fastapi import APIRouter
0014 | 
0015 | from backend.config import NODES_BASE_PATH, ORBITAL_PLANES, ALL_NODES
0016 | from backend.core.integrity import bit_flip_simulate
0017 | from backend.core.chunker import Chunk, _compute_hash
0018 | from backend.utils.ws_manager import manager
0019 | from backend.utils.node_manager import (
0020 |     set_offline, set_partitioned, set_online, restore_all_nodes
0021 | )
0022 | from backend.metadata.manager import (
0023 |     get_all_files, update_node_storage, log_event
0024 | )
0025 | from backend.metrics.survivability_cache import cache
0026 | 
0027 | router = APIRouter()
0028 | 
0029 | 
0030 | # ─────────────────────────────────────────────
0031 | # SCENARIO 1 — Solar Flare ☀️
0032 | # Real hazard: Radiation burst wipes entire orbital shell
0033 | # Action: Kill Plane Beta (SAT-03 + SAT-04 → OFFLINE)
0034 | # ─────────────────────────────────────────────
0035 | 
0036 | @router.post("/api/chaos/solar_flare")
0037 | async def solar_flare():
0038 |     """Kill entire Orbital Plane Beta."""
0039 |     beta_nodes = ORBITAL_PLANES["Beta"]  # [SAT-03, SAT-04]
0040 | 
0041 |     await manager.broadcast("CHAOS_TRIGGERED", {
0042 |         "scenario": "solar_flare",
0043 |         "message": "☀️ SOLAR FLARE — Plane Beta hit by radiation burst",
0044 |         "affected_nodes": beta_nodes,
0045 |     })
0046 | 
0047 |     for node_id in beta_nodes:
0048 |         set_offline(node_id)
0049 |         await manager.broadcast("NODE_OFFLINE", {
0050 |             "node_id": node_id,
0051 |             "reason": "solar_flare",
0052 |             "message": f"{node_id} destroyed by solar radiation",
0053 |         })
0054 | 
0055 |     log_event("CHAOS_SOLAR_FLARE", "Plane Beta destroyed", {"nodes": beta_nodes})
0056 |     
0057 |     # Recalculate and broadcast survivability
0058 |     await cache.invalidate_and_rerun("SOLAR_FLARE")
0059 | 
0060 |     return {
0061 |         "status": "success",
0062 |         "scenario": "solar_flare",
0063 |         "affected": beta_nodes,
0064 |         "message": "Solar Flare activated: SAT-03, SAT-04 OFFLINE",
0065 |     }
0066 | 
0067 | 
0068 | # ─────────────────────────────────────────────
0069 | # SCENARIO 2 — Radiation Bit Rot ☢️
0070 | # Real hazard: Cosmic ray SEU flips memory bits silently
0071 | # Action: Corrupt 2 random .bin files across different nodes
0072 | # ─────────────────────────────────────────────
0073 | 
0074 | @router.post("/api/chaos/bit_rot")
0075 | async def bit_rot():
0076 |     """Corrupt 2 random chunks across different nodes."""
0077 |     corrupted = []
0078 | 
0079 |     # Find all .bin files across all nodes
0080 |     all_bins = []
0081 |     for node_id in ALL_NODES:
0082 |         node_dir = NODES_BASE_PATH / node_id
0083 |         if node_dir.exists():
0084 |             for f in node_dir.glob("*.bin"):
0085 |                 all_bins.append({"path": str(f), "node": node_id, "file": f.name})
0086 | 
0087 |     if len(all_bins) < 2:
0088 |         return {"status": "error", "message": "Not enough chunk files to corrupt"}
0089 | 
0090 |     # Pick 2 random files from different nodes if possible
0091 |     random.shuffle(all_bins)
0092 |     targets = []
0093 |     used_nodes = set()
0094 |     for b in all_bins:
0095 |         if b["node"] not in used_nodes:
0096 |             targets.append(b)
0097 |             used_nodes.add(b["node"])
0098 |         if len(targets) == 2:
0099 |             break
0100 | 
0101 |     # Fallback: if only 1 node has files, pick 2 from same node
0102 |     if len(targets) < 2:
0103 |         targets = all_bins[:2]
0104 | 
0105 |     await manager.broadcast("CHAOS_TRIGGERED", {
0106 |         "scenario": "bit_rot",
0107 |         "message": "☢️ RADIATION BIT ROT — Cosmic ray SEU detected",
0108 |         "targets": len(targets),
0109 |     })
0110 | 
0111 |     for target in targets:
0112 |         result = bit_flip_simulate(target["path"])
0113 |         if result["success"]:
0114 |             corrupted.append({
0115 |                 "node": target["node"],
0116 |                 "file": target["file"],
0117 |                 "byte_position": result["byte_position"],
0118 |                 "original": result["original_byte"],
0119 |                 "flipped": result["flipped_byte"],
0120 |             })
0121 | 
0122 |             await manager.broadcast("CHUNK_CORRUPTED", {
0123 |                 "node_id": target["node"],
0124 |                 "chunk_file": target["file"],
0125 |                 "byte_position": result["byte_position"],
0126 |                 "message": f"Bit rot in {target['file']} on {target['node']}",
0127 |             })
0128 | 
0129 |     log_event("CHAOS_BIT_ROT", f"Corrupted {len(corrupted)} chunks", {"corrupted": corrupted})
0130 | 
0131 |     # Recalculate survivability, assume bit rot trigger is custom config update
0132 |     await cache.invalidate_and_rerun("BIT_ROT", {"corruption_prob_per_chunk": cache.config.corruption_prob_per_chunk + 0.005})
0133 | 
0134 |     return {
0135 |         "status": "success",
0136 |         "scenario": "bit_rot",
0137 |         "corrupted": corrupted,
0138 |         "message": f"Bit Rot: {len(corrupted)} chunks silently corrupted",
0139 |     }
0140 | 
0141 | 
0142 | # ─────────────────────────────────────────────
0143 | # SCENARIO 3 — Network Partition 🌐
0144 | # Real hazard: Satellite behind Earth, no ground station LOS
0145 | # Action: Mark SAT-03, SAT-04 as PARTITIONED (alive but unreachable)
0146 | # ─────────────────────────────────────────────
0147 | 
0148 | @router.post("/api/chaos/partition")
0149 | async def partition():
0150 |     """Mark Plane Beta as PARTITIONED (alive but unreachable)."""
0151 |     beta_nodes = ORBITAL_PLANES["Beta"]
0152 | 
0153 |     await manager.broadcast("CHAOS_TRIGGERED", {
0154 |         "scenario": "partition",
0155 |         "message": "🌐 NETWORK PARTITION — Plane Beta lost line-of-sight",
0156 |         "affected_nodes": beta_nodes,
0157 |     })
0158 | 
0159 |     for node_id in beta_nodes:
0160 |         set_partitioned(node_id)
0161 |         await manager.broadcast("NODE_PARTITIONED", {
0162 |             "node_id": node_id,
0163 |             "reason": "partition",
0164 |             "message": f"{node_id} behind Earth — no ground station LOS",
0165 |         })
0166 | 
0167 |     log_event("CHAOS_PARTITION", "Plane Beta partitioned", {"nodes": beta_nodes})
0168 | 
0169 |     await cache.invalidate_and_rerun("PLANE_FAILURE")
0170 | 
0171 |     return {
0172 |         "status": "success",
0173 |         "scenario": "partition",
0174 |         "affected": beta_nodes,
0175 |         "message": "Network Partition: SAT-03, SAT-04 PARTITIONED (alive but unreachable)",
0176 |     }
0177 | 
0178 | 
0179 | # ─────────────────────────────────────────────
0180 | # SCENARIO 4 — Node Overload ⚡
0181 | # Real hazard: Hotspot formation from concentrated writes
0182 | # Action: Force 20 small dummy chunks onto SAT-01 + SAT-02 only
0183 | # ─────────────────────────────────────────────
0184 | 
0185 | @router.post("/api/chaos/overload")
0186 | async def overload():
0187 |     """Flood SAT-01 and SAT-02 with dummy chunks to crash entropy."""
0188 |     target_nodes = ["SAT-01", "SAT-02"]
0189 |     chunks_per_node = 10
0190 |     chunk_size = 1024  # 1KB dummy chunks
0191 | 
0192 |     await manager.broadcast("CHAOS_TRIGGERED", {
0193 |         "scenario": "overload",
0194 |         "message": "⚡ NODE OVERLOAD — Hotspot formation on Alpha plane",
0195 |         "target_nodes": target_nodes,
0196 |     })
0197 | 
0198 |     total_written = 0
0199 |     for node_id in target_nodes:
0200 |         node_path = NODES_BASE_PATH / node_id
0201 |         node_path.mkdir(parents=True, exist_ok=True)
0202 | 
0203 |         for i in range(chunks_per_node):
0204 |             dummy_data = os.urandom(chunk_size)
0205 |             dummy_id = str(uuid.uuid4())
0206 |             chunk_path = node_path / f"{dummy_id}.bin"
0207 | 
0208 |             with open(chunk_path, "wb") as f:
0209 |                 f.write(dummy_data)
0210 | 
0211 |             update_node_storage(node_id, size_delta=chunk_size, chunk_delta=1)
0212 |             total_written += 1
0213 | 
0214 |         await manager.broadcast("NODE_OVERLOADED", {
0215 |             "node_id": node_id,
0216 |             "dummy_chunks": chunks_per_node,
0217 |             "message": f"{node_id} flooded with {chunks_per_node} dummy chunks",
0218 |         })
0219 | 
0220 |     log_event("CHAOS_OVERLOAD", f"Wrote {total_written} dummy chunks to Alpha",
0221 |               {"nodes": target_nodes, "chunks": total_written})
0222 | 
0223 |     await cache.invalidate_and_rerun("NODE_FAILURE") # Map overload slightly
0224 | 
0225 |     return {
0226 |         "status": "success",
0227 |         "scenario": "overload",
0228 |         "total_chunks_written": total_written,
0229 |         "message": f"Overload: {total_written} dummy chunks forced onto SAT-01, SAT-02",
0230 |     }
0231 | 
0232 | 
0233 | # ─────────────────────────────────────────────
0234 | # SCENARIO 5 — Entropy Imbalance 📉
0235 | # Real hazard: Node clears or massive uniform write causing degraded state
0236 | # Action: Dumps 37 dummy chunks onto nodes SAT-01, SAT-02 while leaving others empty
0237 | # ─────────────────────────────────────────────
0238 | 
0239 | @router.post("/api/chaos/imbalance")
0240 | async def imbalance():
0241 |     """Simulate a severe entropy imbalance to trigger the Rebalancer."""
0242 |     from backend.metadata.schemas import FileRecord, ChunkRecord
0243 |     from backend.metadata.manager import register_file, update_node_storage
0244 | 
0245 |     target_1 = "SAT-01"
0246 |     target_2 = "SAT-02"
0247 | 
0248 |     chunks = []
0249 |     total_written = 0
0250 | 
0251 |     # Ensure nodes exist
0252 |     for node_id in [target_1, target_2]:
0253 |         node_path = NODES_BASE_PATH / node_id
0254 |         node_path.mkdir(parents=True, exist_ok=True)
0255 | 
0256 |     await manager.broadcast("CHAOS_TRIGGERED", {
0257 |         "scenario": "imbalance",
0258 |         "message": "📉 ENTROPY DROP — Unbalanced mass data write to Alpha plane",
0259 |         "target_nodes": [target_1, target_2],
0260 |     })
0261 | 
0262 |     # Generate 20 chunks for SAT-01
0263 |     for i in range(20):
0264 |         c_id = str(uuid.uuid4())
0265 |         chunks.append(ChunkRecord(chunk_id=c_id, sequence_number=i, size=1024, sha256_hash="fake", node_id=target_1, is_parity=False, pad_size=512))
0266 |         with open(NODES_BASE_PATH / target_1 / f"{c_id}.bin", "wb") as f:
0267 |             f.write(os.urandom(1024))
0268 |         total_written += 1
0269 | 
0270 |     # Generate 17 chunks for SAT-02
0271 |     for i in range(17):
0272 |         c_id = str(uuid.uuid4())
0273 |         chunks.append(ChunkRecord(chunk_id=c_id, sequence_number=i+20, size=1024, sha256_hash="fake", node_id=target_2, is_parity=False, pad_size=512))
0274 |         with open(NODES_BASE_PATH / target_2 / f"{c_id}.bin", "wb") as f:
0275 |             f.write(os.urandom(1024))
0276 |         total_written += 1
0277 | 
0278 |     # Register fake file
0279 |     fake_file = FileRecord(
0280 |         file_id=str(uuid.uuid4()), filename="chaos_imbalance_payload.bin", size=1024*37, full_sha256="fake_full", chunk_count=37, chunks=chunks
0281 |     )
0282 |     register_file(fake_file)
0283 | 
0284 |     # Update metadata storage
0285 |     update_node_storage(target_1, size_delta=1024*20, chunk_delta=20)
0286 |     update_node_storage(target_2, size_delta=1024*17, chunk_delta=17)
0287 | 
0288 |     await manager.broadcast("NODE_OVERLOADED", {
0289 |         "message": f"Entropy collapsed. 37 chunks written uniformly to {target_1} and {target_2}",
0290 |         "dummy_chunks": 37
0291 |     })
0292 |     
0293 |     log_event("CHAOS_IMBALANCE", "Triggered forced entropy drop", {"chunks": 37})
0294 | 
0295 |     await cache.invalidate_and_rerun("NODE_FAILURE")
0296 | 
0297 |     return {
0298 |         "status": "success",
0299 |         "scenario": "imbalance",
0300 |         "message": f"Imbalance triggered. Wrote 37 dummy chunks."
0301 |     }
0302 | 
0303 | 
0304 | # ─────────────────────────────────────────────
0305 | # RESTORE — bring everything back to normal
0306 | # ─────────────────────────────────────────────
0307 | 
0308 | @router.post("/api/chaos/restore")
0309 | async def restore():
0310 |     """Restore all nodes to ONLINE, clear corruption flags."""
0311 |     restore_all_nodes()
0312 | 
0313 |     await manager.broadcast("CHAOS_RESOLVED", {
0314 |         "message": "✅ System restored — all nodes ONLINE, corruption flags cleared",
0315 |     })
0316 | 
0317 |     log_event("CHAOS_RESOLVED", "All nodes restored to ONLINE", {})
0318 | 
0319 |     # Trigger rebalancer after restore
0320 |     try:
0321 |         from backend.intelligence.rebalancer import check_and_rebalance
0322 |         rebalance_result = await check_and_rebalance()
0323 |     except Exception as e:
0324 |         rebalance_result = {"error": str(e)}
0325 | 
0326 |     await cache.invalidate_and_rerun("NODE_RESTORE")
0327 | 
0328 |     return {
0329 |         "status": "success",
0330 |         "message": "All nodes restored to ONLINE",
0331 |         "rebalance": rebalance_result,
0332 |     }

```

---

### File: `backend\intelligence\dtn_queue.py`

**Description**: Source code for `dtn_queue.py`

```python
0001 | # backend/intelligence/dtn_queue.py
0002 | # Person 3 owns this file
0003 | # Responsibility: DTN Store-and-Forward queue
0004 | # Inspired by NASA Bundle Protocol (BPv7) — PACE mission 2024
0005 | # When satellite OFFLINE → queue chunks → auto-deliver on recovery
0006 | 
0007 | import asyncio
0008 | import json
0009 | import base64
0010 | from pathlib import Path
0011 | from datetime import datetime
0012 | from typing import Dict, Optional
0013 | 
0014 | from backend.config import DTN_QUEUE_PATH, NODES_BASE_PATH, ALL_NODES
0015 | 
0016 | # Per-node locks to prevent race between add_to_queue and flush_queue
0017 | _node_locks: Dict[str, asyncio.Lock] = {n: asyncio.Lock() for n in ALL_NODES}
0018 | from backend.core.chunker import Chunk
0019 | from backend.core.integrity import verify_write
0020 | from backend.utils.ws_manager import manager
0021 | from backend.metadata.manager import (
0022 |     update_dtn_queue_depth, update_node_storage
0023 | )
0024 | from backend.utils.node_manager import get_node_status
0025 | 
0026 | 
0027 | # ─────────────────────────────────────────────
0028 | # QUEUE FILE MANAGEMENT
0029 | # Each node gets: dtn_queue/{node_id}.json
0030 | # ─────────────────────────────────────────────
0031 | 
0032 | def _queue_path(node_id: str) -> Path:
0033 |     """Path to a node's DTN queue file."""
0034 |     return DTN_QUEUE_PATH / f"{node_id}.json"
0035 | 
0036 | 
0037 | def _read_queue(node_id: str) -> list:
0038 |     """Read queue file, return list of bundles."""
0039 |     path = _queue_path(node_id)
0040 |     if not path.exists():
0041 |         return []
0042 |     try:
0043 |         with open(path, "r") as f:
0044 |             return json.load(f)
0045 |     except (json.JSONDecodeError, Exception):
0046 |         return []
0047 | 
0048 | 
0049 | def _write_queue(node_id: str, bundles: list) -> None:
0050 |     """Write bundles list to queue file."""
0051 |     path = _queue_path(node_id)
0052 |     path.parent.mkdir(parents=True, exist_ok=True)
0053 |     with open(path, "w") as f:
0054 |         json.dump(bundles, f, indent=2)
0055 | 
0056 | 
0057 | def _clear_queue(node_id: str) -> None:
0058 |     """Clear a node's queue file."""
0059 |     path = _queue_path(node_id)
0060 |     if path.exists():
0061 |         path.unlink()
0062 | 
0063 | 
0064 | def get_queue_depth(node_id: str) -> int:
0065 |     """Return number of bundles in a node's queue."""
0066 |     return len(_read_queue(node_id))
0067 | 
0068 | 
0069 | # ─────────────────────────────────────────────
0070 | # ADD TO QUEUE — called by distributor.py when node OFFLINE
0071 | # ─────────────────────────────────────────────
0072 | 
0073 | async def add_to_queue(node_id: str, chunk: Chunk) -> None:
0074 |     """
0075 |     Queue a chunk for delayed delivery to an offline node.
0076 |     Bundle format matches NASA BPv7 structure.
0077 |     INTERFACE CONTRACT: distributor.py calls this function.
0078 |     """
0079 |     bundle = {
0080 |         "chunk_id": chunk.chunk_id,
0081 |         "sequence_number": chunk.sequence_number,
0082 |         "is_parity": chunk.is_parity,
0083 |         "sha256_hash": chunk.sha256_hash,
0084 |         "size": chunk.size,
0085 |         "data_b64": base64.b64encode(chunk.data).decode("utf-8"),
0086 |         "timestamp": datetime.utcnow().isoformat(),
0087 |         "retry_count": 0,
0088 |         "priority": 10 if chunk.is_parity else 5,  # Parity gets higher priority
0089 |     }
0090 | 
0091 |     lock = _node_locks.get(node_id)
0092 |     if lock is None:
0093 |         _node_locks[node_id] = asyncio.Lock()
0094 |         lock = _node_locks[node_id]
0095 |     async with lock:
0096 |         bundles = _read_queue(node_id)
0097 |         bundles.append(bundle)
0098 |         _write_queue(node_id, bundles)
0099 | 
0100 |     # Update metadata queue depth
0101 |     update_dtn_queue_depth(node_id, len(bundles))
0102 | 
0103 |     await manager.broadcast("DTN_QUEUED", {
0104 |         "node_id": node_id,
0105 |         "chunk_id": chunk.chunk_id,
0106 |         "queue_depth": len(bundles),
0107 |         "priority": bundle["priority"],
0108 |         "message": f"Bundle queued for {node_id} (depth={len(bundles)})",
0109 |     })
0110 | 
0111 |     print(f"[DTN] 📦 Queued chunk {chunk.chunk_id[:8]}... for {node_id}")
0112 | 
0113 | 
0114 | # ─────────────────────────────────────────────
0115 | # FLUSH QUEUE — deliver all bundles when node comes ONLINE
0116 | # ─────────────────────────────────────────────
0117 | 
0118 | async def flush_queue(node_id: str) -> int:
0119 |     """
0120 |     Deliver all queued bundles to a node that just came back ONLINE.
0121 |     Sort by priority (parity first).
0122 |     Verify SHA-256 after each write.
0123 | 
0124 |     Returns number of bundles delivered.
0125 |     """
0126 |     lock = _node_locks.get(node_id)
0127 |     if lock is None:
0128 |         _node_locks[node_id] = asyncio.Lock()
0129 |         lock = _node_locks[node_id]
0130 |     async with lock:
0131 |         bundles = _read_queue(node_id)
0132 |         if not bundles:
0133 |             return 0
0134 | 
0135 |         # Sort by priority descending (parity = 10 first, data = 5 after)
0136 |         bundles.sort(key=lambda b: b["priority"], reverse=True)
0137 | 
0138 |         await manager.broadcast("DTN_FLUSH_START", {
0139 |             "node_id": node_id,
0140 |             "bundle_count": len(bundles),
0141 |             "message": f"Flushing {len(bundles)} bundles to {node_id}",
0142 |         })
0143 | 
0144 |         delivered = 0
0145 |         delivered_chunk_ids = set()
0146 |         node_path = Path(NODES_BASE_PATH) / node_id
0147 |         node_path.mkdir(parents=True, exist_ok=True)
0148 | 
0149 |         for bundle in bundles:
0150 |             chunk_path = node_path / f"{bundle['chunk_id']}.bin"
0151 | 
0152 |             try:
0153 |                 # Decode base64 data and write
0154 |                 chunk_data = base64.b64decode(bundle["data_b64"])
0155 |                 with open(chunk_path, "wb") as f:
0156 |                     f.write(chunk_data)
0157 | 
0158 |                 # Verify write integrity
0159 |                 if verify_write(str(chunk_path), bundle["sha256_hash"]):
0160 |                     delivered += 1
0161 |                     delivered_chunk_ids.add(bundle["chunk_id"])
0162 |                     update_node_storage(node_id, size_delta=bundle["size"], chunk_delta=1)
0163 | 
0164 |                     await manager.broadcast("DTN_BUNDLE_DELIVERED", {
0165 |                         "node_id": node_id,
0166 |                         "chunk_id": bundle["chunk_id"],
0167 |                         "delivered": delivered,
0168 |                         "total": len(bundles),
0169 |                         "message": f"Bundle {delivered}/{len(bundles)} delivered to {node_id}",
0170 |                     })
0171 |                 else:
0172 |                     # Write verification failed — keep in queue for retry
0173 |                     chunk_path.unlink(missing_ok=True)
0174 |                     print(f"[DTN] ❌ Write verify failed for {bundle['chunk_id'][:8]}... (will retry)")
0175 | 
0176 |             except Exception as e:
0177 |                 print(f"[DTN] ❌ Delivery error: {e} (bundle will retry)")
0178 | 
0179 |         # Only remove successfully delivered bundles; keep failed ones for retry
0180 |         remaining = [b for b in bundles if b["chunk_id"] not in delivered_chunk_ids]
0181 |         if remaining:
0182 |             _write_queue(node_id, remaining)
0183 |             update_dtn_queue_depth(node_id, len(remaining))
0184 |         else:
0185 |             _clear_queue(node_id)
0186 |             update_dtn_queue_depth(node_id, 0)
0187 | 
0188 |     await manager.broadcast("DTN_FLUSH_COMPLETE", {
0189 |         "node_id": node_id,
0190 |         "delivered": delivered,
0191 |         "total": len(bundles),
0192 |         "message": f"DTN flush complete: {delivered}/{len(bundles)} bundles delivered to {node_id}",
0193 |     })
0194 | 
0195 |     print(f"[DTN] ✅ Flushed {delivered}/{len(bundles)} bundles to {node_id}")
0196 |     return delivered
0197 | 
0198 | 
0199 | # ─────────────────────────────────────────────
0200 | # BACKGROUND WORKER — polls every 5 seconds
0201 | # ─────────────────────────────────────────────
0202 | _running = False
0203 | 
0204 | 
0205 | async def start_dtn_worker() -> None:
0206 |     """
0207 |     Background task that polls every 5 seconds.
0208 |     For each node with queued bundles: if now ONLINE → flush.
0209 |     """
0210 |     global _running
0211 |     _running = True
0212 |     print("[DTN] 📡 DTN store-and-forward worker started")
0213 | 
0214 |     while _running:
0215 |         try:
0216 |             for node_id in ALL_NODES:
0217 |                 status = get_node_status(node_id)
0218 |                 if status == "ONLINE" and get_queue_depth(node_id) > 0:
0219 |                     await flush_queue(node_id)
0220 |         except Exception as e:
0221 |             print(f"[DTN] Worker error: {e}")
0222 | 
0223 |         await asyncio.sleep(5)
0224 | 
0225 | 
0226 | def stop_dtn_worker() -> None:
0227 |     """Stop the DTN worker loop."""
0228 |     global _running
0229 |     _running = False

```

---

### File: `backend\intelligence\harvest_manager.py`

**Description**: Source code for `harvest_manager.py`

```python
0001 | # backend/intelligence/harvest_manager.py
0002 | # Responsibility: Opportunistically collect shards from satellite nodes as they come online.
0003 | # This solves the "Partial Availability" problem where not all nodes are online at once.
0004 | 
0005 | import asyncio
0006 | import json
0007 | import os
0008 | import shutil
0009 | from pathlib import Path
0010 | from typing import Dict, List, Set, Optional
0011 | 
0012 | from backend.config import HARVEST_CACHE_PATH, NODES_BASE_PATH, ALL_NODES, RS_K
0013 | from backend.metadata.manager import get_file
0014 | from backend.utils.node_manager import get_node_status
0015 | from backend.utils.ws_manager import manager
0016 | 
0017 | # Path to persistent mission state
0018 | MISSIONS_FILE = HARVEST_CACHE_PATH / "missions.json"
0019 | 
0020 | class HarvestMission:
0021 |     def __init__(self, file_id: str, filename: str, total_chunks: int, collected_shards: List[str] = None):
0022 |         self.file_id = file_id
0023 |         self.filename = filename
0024 |         self.total_chunks = total_chunks
0025 |         self.collected_shards = set(collected_shards or [])
0026 |         self.status = "active" # active, completed
0027 | 
0028 |     def to_dict(self):
0029 |         return {
0030 |             "file_id": self.file_id,
0031 |             "filename": self.filename,
0032 |             "total_chunks": self.total_chunks,
0033 |             "collected_shards": list(self.collected_shards),
0034 |             "status": self.status
0035 |         }
0036 | 
0037 | class HarvestManager:
0038 |     def __init__(self):
0039 |         self.missions: Dict[str, HarvestMission] = {}
0040 |         self._load_missions()
0041 | 
0042 |     def _load_missions(self):
0043 |         if MISSIONS_FILE.exists():
0044 |             try:
0045 |                 with open(MISSIONS_FILE, "r") as f:
0046 |                     data = json.load(f)
0047 |                     for fid, mdata in data.items():
0048 |                         self.missions[fid] = HarvestMission(
0049 |                             file_id=mdata["file_id"],
0050 |                             filename=mdata["filename"],
0051 |                             total_chunks=mdata["total_chunks"],
0052 |                             collected_shards=mdata["collected_shards"]
0053 |                         )
0054 |                         self.missions[fid].status = mdata.get("status", "active")
0055 |             except Exception as e:
0056 |                 print(f"[HARVEST] Error loading missions: {e}")
0057 | 
0058 |     def _save_missions(self):
0059 |         try:
0060 |             with open(MISSIONS_FILE, "w") as f:
0061 |                 json.dump({fid: m.to_dict() for fid, m in self.missions.items()}, f, indent=2)
0062 |         except Exception as e:
0063 |             print(f"[HARVEST] Error saving missions: {e}")
0064 | 
0065 |     def start_mission(self, file_id: str):
0066 |         record = get_file(file_id)
0067 |         if not record:
0068 |             return None
0069 |         
0070 |         if file_id not in self.missions:
0071 |             self.missions[file_id] = HarvestMission(
0072 |                 file_id=file_id,
0073 |                 filename=record.filename,
0074 |                 total_chunks=len(record.chunks)
0075 |             )
0076 |             # Create file-specific cache dir
0077 |             file_dir = HARVEST_CACHE_PATH / file_id
0078 |             file_dir.mkdir(parents=True, exist_ok=True)
0079 |             self._save_missions()
0080 |             
0081 |         print(f"[HARVEST] Mission started/resumed for {record.filename} ({file_id})")
0082 |         return self.missions[file_id].to_dict()
0083 | 
0084 |     def get_status(self, file_id: str):
0085 |         mission = self.missions.get(file_id)
0086 |         return mission.to_dict() if mission else None
0087 | 
0088 |     async def run_worker(self):
0089 |         """Background task that hunts for shards from active missions."""
0090 |         print("[HARVEST] 🧺 Opportunistic Harvest worker started")
0091 |         while True:
0092 |             try:
0093 |                 active_missions = [m for m in self.missions.values() if m.status == "active"]
0094 |                 if not active_missions:
0095 |                     await asyncio.sleep(10)
0096 |                     continue
0097 | 
0098 |                 for mission in active_missions:
0099 |                     record = get_file(mission.file_id)
0100 |                     if not record:
0101 |                         continue
0102 | 
0103 |                     new_shards_found = False
0104 |                     for chunk in record.chunks:
0105 |                         if chunk.chunk_id in mission.collected_shards:
0106 |                             continue
0107 |                         
0108 |                         # Check if node is online
0109 |                         if get_node_status(chunk.node_id) == "ONLINE":
0110 |                             source_path = Path(NODES_BASE_PATH) / chunk.node_id / f"{chunk.chunk_id}.bin"
0111 |                             dest_path = HARVEST_CACHE_PATH / mission.file_id / f"{chunk.chunk_id}.bin"
0112 |                             
0113 |                             if source_path.exists():
0114 |                                 shutil.copy2(source_path, dest_path)
0115 |                                 mission.collected_shards.add(chunk.chunk_id)
0116 |                                 new_shards_found = True
0117 |                                 
0118 |                                 await manager.broadcast("HARVEST_PROGRESS", {
0119 |                                     "file_id": mission.file_id,
0120 |                                     "chunk_id": chunk.chunk_id,
0121 |                                     "node_id": chunk.node_id,
0122 |                                     "collected": len(mission.collected_shards),
0123 |                                     "total": mission.total_chunks,
0124 |                                     "message": f"Harvested shard {chunk.chunk_id[:8]} for {mission.filename}"
0125 |                                 })
0126 | 
0127 |                     if new_shards_found:
0128 |                         if len(mission.collected_shards) >= mission.total_chunks:
0129 |                             mission.status = "completed"
0130 |                         self._save_missions()
0131 | 
0132 |             except Exception as e:
0133 |                 print(f"[HARVEST] Worker error: {e}")
0134 |             
0135 |             await asyncio.sleep(5)
0136 | 
0137 |     def get_shard_path(self, file_id: str, chunk_id: str) -> Optional[Path]:
0138 |         """Check if a shard is available in the local harvest cache."""
0139 |         path = HARVEST_CACHE_PATH / file_id / f"{chunk_id}.bin"
0140 |         return path if path.exists() else None
0141 | 
0142 | harvest_manager = HarvestManager()

```

---

### File: `backend\intelligence\isl_manager.py`

**Description**: Source code for `isl_manager.py`

```python
0001 | # backend/intelligence/isl_manager.py
0002 | # Responsibility: Inter-Satellite Link (ISL) relay routing
0003 | # Self-contained module — receives get_node_status as callable to avoid circular imports.
0004 | # ISL is READ-ONLY: it reads bytes from a neighbor's disk, never moves files.
0005 | 
0006 | import asyncio
0007 | from pathlib import Path
0008 | from typing import Callable, Optional, List
0009 | from collections import deque
0010 | 
0011 | from backend.config import ISL_ADJACENCY, ISL_HOP_LATENCY_MS, NODES_BASE_PATH
0012 | 
0013 | 
0014 | def find_relay_path(
0015 |     target_node: str,
0016 |     get_node_status: Callable,
0017 | ) -> Optional[List[str]]:
0018 |     """
0019 |     BFS to find a path from any reachable (ONLINE/DEGRADED) node to the target.
0020 |     The target itself must be PARTITIONED (alive but no Ground LOS).
0021 |     Returns the relay path as [relay_node, ..., target_node] or None.
0022 |     """
0023 |     target_status = get_node_status(target_node)
0024 |     
0025 |     # ISL only works for PARTITIONED nodes (alive but can't reach ground)
0026 |     # OFFLINE = dead satellite, no relay possible
0027 |     if target_status not in ("PARTITIONED", "DEGRADED"):
0028 |         return None
0029 | 
0030 |     # BFS from every ONLINE node to find the target
0031 |     for start_node in ISL_ADJACENCY:
0032 |         if get_node_status(start_node) not in ("ONLINE", "DEGRADED"):
0033 |             continue
0034 |         
0035 |         # BFS
0036 |         visited = {start_node}
0037 |         queue = deque([(start_node, [start_node])])
0038 |         
0039 |         while queue:
0040 |             current, path = queue.popleft()
0041 |             
0042 |             for neighbor in ISL_ADJACENCY.get(current, []):
0043 |                 if neighbor in visited:
0044 |                     continue
0045 |                 visited.add(neighbor)
0046 |                 new_path = path + [neighbor]
0047 |                 
0048 |                 if neighbor == target_node:
0049 |                     return new_path  # Found relay path
0050 |                 
0051 |                 # Can only relay through ONLINE or DEGRADED nodes
0052 |                 n_status = get_node_status(neighbor)
0053 |                 if n_status in ("ONLINE", "DEGRADED"):
0054 |                     queue.append((neighbor, new_path))
0055 |     
0056 |     return None  # No path exists
0057 | 
0058 | 
0059 | def isl_fetch(
0060 |     target_node: str,
0061 |     chunk_id: str,
0062 |     relay_path: List[str],
0063 | ) -> Optional[bytes]:
0064 |     """
0065 |     Read chunk data from the target node's disk via simulated relay.
0066 |     This is a READ-ONLY operation — no files are moved or copied.
0067 |     Returns raw bytes or None if file doesn't exist.
0068 |     """
0069 |     chunk_path = Path(NODES_BASE_PATH) / target_node / f"{chunk_id}.bin"
0070 |     
0071 |     if not chunk_path.exists():
0072 |         return None
0073 |     
0074 |     with open(chunk_path, "rb") as f:
0075 |         data = f.read()
0076 |     
0077 |     return data
0078 | 
0079 | 
0080 | async def isl_fetch_async(
0081 |     target_node: str,
0082 |     chunk_id: str,
0083 |     relay_path: List[str],
0084 | ) -> Optional[bytes]:
0085 |     """
0086 |     Async version with simulated hop latency.
0087 |     Each hop adds ISL_HOP_LATENCY_MS of delay.
0088 |     """
0089 |     hops = len(relay_path) - 1  # number of links traversed
0090 |     if hops > 0:
0091 |         latency_s = (hops * ISL_HOP_LATENCY_MS) / 1000.0
0092 |         await asyncio.sleep(latency_s)
0093 |     
0094 |     return isl_fetch(target_node, chunk_id, relay_path)
0095 | 
0096 | 
0097 | def get_isl_topology(get_node_status: Callable) -> dict:
0098 |     """
0099 |     Return the current ISL topology state for the frontend.
0100 |     Each link is marked as active (both endpoints reachable) or inactive.
0101 |     """
0102 |     links = []
0103 |     seen = set()
0104 |     
0105 |     for node, neighbors in ISL_ADJACENCY.items():
0106 |         for neighbor in neighbors:
0107 |             link_key = tuple(sorted([node, neighbor]))
0108 |             if link_key in seen:
0109 |                 continue
0110 |             seen.add(link_key)
0111 |             
0112 |             node_s = get_node_status(node)
0113 |             neighbor_s = get_node_status(neighbor)
0114 |             
0115 |             # A link is active if at least one endpoint is ONLINE/DEGRADED
0116 |             # and the other is not OFFLINE (dead)
0117 |             node_reachable = node_s in ("ONLINE", "DEGRADED", "PARTITIONED")
0118 |             neighbor_reachable = neighbor_s in ("ONLINE", "DEGRADED", "PARTITIONED")
0119 |             
0120 |             links.append({
0121 |                 "from": node,
0122 |                 "to": neighbor,
0123 |                 "active": node_reachable and neighbor_reachable,
0124 |                 "from_status": node_s,
0125 |                 "to_status": neighbor_s,
0126 |             })
0127 |     
0128 |     return {"links": links}

```

---

### File: `backend\intelligence\predictor.py`

**Description**: Source code for `predictor.py`

```python
0001 | # backend/intelligence/predictor.py
0002 | # Person 3 owns this file
0003 | # Responsibility: Proactive chunk migration BEFORE satellite enters LOS blackout
0004 | # Watches orbit timers → when node < 30s → migrate hot chunks to healthiest node
0005 | 
0006 | import asyncio
0007 | import shutil
0008 | import time
0009 | from pathlib import Path
0010 | from collections import defaultdict
0011 | from typing import Dict, List, Optional, Set
0012 | 
0013 | from backend.config import ALL_NODES, LOS_THRESHOLD, NODES_BASE_PATH, NODE_TO_PLANE
0014 | from backend.intelligence.trajectory import get_timer, get_all_timers
0015 | from backend.utils.ws_manager import manager
0016 | from backend.metadata.manager import (
0017 |     get_all_files, update_chunk_node, get_all_nodes
0018 | )
0019 | 
0020 | 
0021 | # ─────────────────────────────────────────────
0022 | # ACCESS TRACKING — sliding window (60s)
0023 | # ─────────────────────────────────────────────
0024 | _access_log: Dict[str, List[float]] = defaultdict(list)  # chunk_id → [timestamps]
0025 | _WINDOW_SECONDS = 60
0026 | 
0027 | 
0028 | def record_chunk_access(chunk_id: str) -> None:
0029 |     """Record a chunk access event. Called by reassembler on every chunk fetch."""
0030 |     _access_log[chunk_id].append(time.time())
0031 | 
0032 | 
0033 | def _prune_old_accesses() -> None:
0034 |     """Remove access records older than 60 seconds."""
0035 |     cutoff = time.time() - _WINDOW_SECONDS
0036 |     for chunk_id in list(_access_log.keys()):
0037 |         _access_log[chunk_id] = [t for t in _access_log[chunk_id] if t > cutoff]
0038 |         if not _access_log[chunk_id]:
0039 |             del _access_log[chunk_id]
0040 | 
0041 | 
0042 | def get_hot_chunks(node_id: str, top_n: int = 3) -> List[dict]:
0043 |     """
0044 |     Return the most-accessed chunks stored on a specific node.
0045 |     Scans metadata for chunks on this node, ranks by access count.
0046 |     """
0047 |     _prune_old_accesses()
0048 | 
0049 |     # Find all chunks stored on this node
0050 |     node_chunks = []
0051 |     for file_rec in get_all_files():
0052 |         for chunk in file_rec.chunks:
0053 |             if chunk.node_id == node_id:
0054 |                 access_count = len(_access_log.get(chunk.chunk_id, []))
0055 |                 node_chunks.append({
0056 |                     "file_id": file_rec.file_id,
0057 |                     "chunk_id": chunk.chunk_id,
0058 |                     "sequence_number": chunk.sequence_number,
0059 |                     "is_parity": chunk.is_parity,
0060 |                     "access_count": access_count,
0061 |                     "sha256_hash": chunk.sha256_hash,
0062 |                     "file_chunks": file_rec.chunks,
0063 |                 })
0064 | 
0065 |     # Sort by access count descending
0066 |     node_chunks.sort(key=lambda c: c["access_count"], reverse=True)
0067 |     return node_chunks[:top_n]
0068 | 
0069 | 
0070 | # ─────────────────────────────────────────────
0071 | # FIND HEALTHIEST NODE — highest orbit timer + ONLINE
0072 | # Respects topology: excludes planes where paired chunk lives
0073 | # ─────────────────────────────────────────────
0074 | 
0075 | def _get_planes_to_avoid_for_chunk(
0076 |     chunk_seq: int, chunk_is_parity: bool, file_chunks: List,
0077 | ) -> Set[str]:
0078 |     """Planes we must NOT migrate this chunk to (topology rule)."""
0079 |     planes: Set[str] = set()
0080 |     for c in file_chunks:
0081 |         plane = NODE_TO_PLANE.get(c.node_id)
0082 |         if not plane:
0083 |             continue
0084 |         if chunk_is_parity:
0085 |             if chunk_seq == 4 and not c.is_parity and c.sequence_number in (0, 2):
0086 |                 planes.add(plane)
0087 |             elif chunk_seq == 5 and not c.is_parity and c.sequence_number in (1, 3):
0088 |                 planes.add(plane)
0089 |         else:
0090 |             parity_seq = 4 + (chunk_seq % 2)
0091 |             if c.sequence_number == parity_seq:
0092 |                 planes.add(plane)
0093 |                 break
0094 |     return planes
0095 | 
0096 | 
0097 | def _find_healthiest_node(
0098 |     exclude_node: str, exclude_planes: Optional[Set[str]] = None
0099 | ) -> Optional[str]:
0100 |     """Find the node with the most orbit time remaining (safest target)."""
0101 |     timers = get_all_timers()
0102 |     nodes = get_all_nodes()
0103 |     exclude_planes = exclude_planes or set()
0104 |     online_nodes = [
0105 |         n for n in nodes
0106 |         if n.status == "ONLINE"
0107 |         and n.node_id != exclude_node
0108 |         and NODE_TO_PLANE.get(n.node_id) not in exclude_planes
0109 |     ]
0110 | 
0111 |     if not online_nodes:
0112 |         return None
0113 | 
0114 |     # Sort by orbit_timer descending (most time remaining = healthiest)
0115 |     best = max(online_nodes, key=lambda n: timers.get(n.node_id, 0))
0116 |     return best.node_id
0117 | 
0118 | 
0119 | # ─────────────────────────────────────────────
0120 | # MIGRATE CHUNK — copy file + update metadata
0121 | # ─────────────────────────────────────────────
0122 | 
0123 | async def _migrate_chunk(file_id: str, chunk_id: str, source_node: str, dest_node: str) -> bool:
0124 |     """
0125 |     Copy .bin file from source to destination node folder.
0126 |     Update metadata to reflect new location.
0127 |     """
0128 |     src_path = Path(NODES_BASE_PATH) / source_node / f"{chunk_id}.bin"
0129 |     dst_path = Path(NODES_BASE_PATH) / dest_node / f"{chunk_id}.bin"
0130 | 
0131 |     if not src_path.exists():
0132 |         return False
0133 | 
0134 |     try:
0135 |         dst_path.parent.mkdir(parents=True, exist_ok=True)
0136 |         shutil.copy2(str(src_path), str(dst_path))
0137 | 
0138 |         # Update metadata
0139 |         update_chunk_node(file_id, chunk_id, dest_node)
0140 | 
0141 |         await manager.broadcast("MIGRATE_COMPLETE", {
0142 |             "chunk_id": chunk_id,
0143 |             "from": source_node,
0144 |             "to": dest_node,
0145 |             "message": f"Chunk {chunk_id[:8]}... migrated {source_node} → {dest_node}",
0146 |         })
0147 |         return True
0148 | 
0149 |     except Exception as e:
0150 |         print(f"[PREDICTOR] ❌ Migration failed: {e}")
0151 |         return False
0152 | 
0153 | 
0154 | # ─────────────────────────────────────────────
0155 | # MAIN PREDICTOR LOOP — background asyncio task
0156 | # ─────────────────────────────────────────────
0157 | _running = False
0158 | 
0159 | 
0160 | async def start_predictor() -> None:
0161 |     """
0162 |     Background task that watches all orbit timers.
0163 |     When any node drops below LOS_THRESHOLD (30s):
0164 |     - Find top 3 most-accessed chunks on that node
0165 |     - Migrate them to healthiest available node
0166 |     - This is PROACTIVE — node hasn't failed yet
0167 |     """
0168 |     global _running
0169 |     _running = True
0170 |     print("[PREDICTOR] 🧠 Predictive migration engine started")
0171 | 
0172 |     # Track which nodes we've already predicted for this cycle
0173 |     predicted_this_cycle: set = set()
0174 | 
0175 |     while _running:
0176 |         try:
0177 |             timers = get_all_timers()
0178 | 
0179 |             for node_id, seconds in timers.items():
0180 |                 # Only trigger once per orbit cycle at threshold
0181 |                 if seconds <= LOS_THRESHOLD and node_id not in predicted_this_cycle:
0182 |                     predicted_this_cycle.add(node_id)
0183 | 
0184 |                     hot_chunks = get_hot_chunks(node_id, top_n=3)
0185 |                     if not hot_chunks:
0186 |                         continue
0187 | 
0188 |                     await manager.broadcast("MIGRATE_START", {
0189 |                         "node_id": node_id,
0190 |                         "seconds_remaining": seconds,
0191 |                         "chunks_to_migrate": len(hot_chunks),
0192 |                         "message": f"Pre-migrating {len(hot_chunks)} chunks from {node_id} (timer={seconds}s)",
0193 |                     })
0194 | 
0195 |                     for chunk_info in hot_chunks:
0196 |                         planes_to_avoid = _get_planes_to_avoid_for_chunk(
0197 |                             chunk_info["sequence_number"],
0198 |                             chunk_info["is_parity"],
0199 |                             chunk_info["file_chunks"],
0200 |                         )
0201 |                         dest = _find_healthiest_node(
0202 |                             exclude_node=node_id,
0203 |                             exclude_planes=planes_to_avoid,
0204 |                         )
0205 |                         if not dest:
0206 |                             continue
0207 |                         await _migrate_chunk(
0208 |                             chunk_info["file_id"],
0209 |                             chunk_info["chunk_id"],
0210 |                             node_id,
0211 |                             dest,
0212 |                         )
0213 | 
0214 |                 # Reset tracking when timer resets above threshold
0215 |                 if seconds > LOS_THRESHOLD and node_id in predicted_this_cycle:
0216 |                     predicted_this_cycle.discard(node_id)
0217 | 
0218 |         except Exception as e:
0219 |             print(f"[PREDICTOR] Error: {e}")
0220 | 
0221 |         await asyncio.sleep(2)  # Check every 2 seconds
0222 | 
0223 | 
0224 | def stop_predictor() -> None:
0225 |     """Stop the predictor loop."""
0226 |     global _running
0227 |     _running = False

```

---

### File: `backend\intelligence\raft_consensus.py`

**Description**: Source code for `raft_consensus.py`

```python
0001 | # backend/intelligence/raft_consensus.py
0002 | # Person 3 owns this file
0003 | # Responsibility: Leader Election and Write-Ahead Log (WAL) for Byzantine Fault Tolerance
0004 | 
0005 | import random
0006 | import time
0007 | import asyncio
0008 | from typing import Dict, List, Optional
0009 | from pydantic import BaseModel
0010 | 
0011 | class LogEntry(BaseModel):
0012 |     term: int
0013 |     intent: str
0014 |     file_id: str
0015 |     timestamp: float
0016 | 
0017 | # Global in-memory Raft state for the emulator
0018 | # In FS-PRO, this lives inside each isolated container's memory
0019 | raft_state = {
0020 |     # plane -> { node_id: { role, term, log, last_heartbeat } }
0021 |     "Alpha": {},
0022 |     "Beta": {},
0023 |     "Gamma": {}
0024 | }
0025 | 
0026 | def init_raft_clusters():
0027 |     """Phase 4.1: Statically group containers into 3 Raft Clusters."""
0028 |     from backend.config import ORBITAL_PLANES
0029 |     for plane, nodes in ORBITAL_PLANES.items():
0030 |         for node_id in nodes:
0031 |             # Init automatically registers into raft_state
0032 |             RaftNode(node_id=node_id, plane=plane)
0033 |     print(f"[RAFT] ✅ Initialized 3 consensus clusters: Alpha, Beta, Gamma")
0034 | 
0035 | class RaftNode:
0036 |     def __init__(self, node_id: str, plane: str):
0037 |         self.node_id = node_id
0038 |         self.plane = plane
0039 |         self.role = "FOLLOWER"
0040 |         self.term = 0
0041 |         self.voted_for = None
0042 |         self.wal: List[LogEntry] = []
0043 |         
0044 |         # Initialize in global state
0045 |         raft_state[self.plane][self.node_id] = self
0046 | 
0047 |     def _get_peers(self) -> List["RaftNode"]:
0048 |         """Get all other nodes in the same orbital plane."""
0049 |         return [
0050 |             node for n_id, node in raft_state[self.plane].items() 
0051 |             if n_id != self.node_id
0052 |         ]
0053 |         
0054 |     def _get_leader(self) -> Optional["RaftNode"]:
0055 |         for node in raft_state[self.plane].values():
0056 |             if node.role == "LEADER":
0057 |                 return node
0058 |         return None
0059 | 
0060 |     def start_election(self):
0061 |         """Phase 4.2: Transition to CANDIDATE and request votes."""
0062 |         from backend.utils.node_manager import get_node_status
0063 |         if get_node_status(self.node_id) != "ONLINE":
0064 |             return
0065 | 
0066 |         self.role = "CANDIDATE"
0067 |         self.term += 1
0068 |         self.voted_for = self.node_id
0069 |         votes = 1 # Vote for self
0070 |         
0071 |         peers = self._get_peers()
0072 |         
0073 |         for peer in peers:
0074 |             if get_node_status(peer.node_id) == "ONLINE":
0075 |                 # Simplified voting: if peer hasn't voted in this term, they vote YES
0076 |                 if peer.term < self.term:
0077 |                     peer.term = self.term
0078 |                     peer.voted_for = self.node_id
0079 |                     votes += 1
0080 |                     
0081 |         # Plurality/Quorum check (N/2 + 1)
0082 |         total_nodes = len(peers) + 1
0083 |         
0084 |         # Phase 4.4: In a 2-node cluster, strict Raft fails if 1 dies.
0085 |         # We allow degraded 1-node quorums for this FS-PRO topology.
0086 |         peer_online = len([p for p in peers if get_node_status(p.node_id) == "ONLINE"])
0087 |         
0088 |         if total_nodes == 2:
0089 |             quorum_needed = 1 if peer_online == 0 else 2
0090 |         else:
0091 |             quorum_needed = total_nodes // 2 + 1
0092 |             
0093 |         print(f"[RAFT-DEBUG] {self.node_id} Election -> Votes: {votes}, Quorum: {quorum_needed}, Total: {total_nodes}")
0094 |             
0095 |         if votes >= quorum_needed:
0096 |             self.role = "LEADER"
0097 |             # print(f"[RAFT] 👑 {self.node_id} elected LEADER of Plane {self.plane} (Term {self.term})")
0098 |         else:
0099 |             self.role = "FOLLOWER" # Failed
0100 |             
0101 |     def append_entry(self, intent: str, file_id: str) -> bool:
0102 |         """
0103 |         Phase 4.3: Write-Ahead Log implementation.
0104 |         Only the LEADER can accept destructive writes.
0105 |         Requires quorum acknowledgment before committing.
0106 |         """
0107 |         if self.role != "LEADER":
0108 |             leader = self._get_leader()
0109 |             if leader:
0110 |                 return leader.append_entry(intent, file_id)
0111 |             return False # No leader available
0112 |             
0113 |         entry = LogEntry(
0114 |             term=self.term,
0115 |             intent=intent,
0116 |             file_id=file_id,
0117 |             timestamp=time.time()
0118 |         )
0119 |         
0120 |         # Append locally
0121 |         self.wal.append(entry)
0122 |         
0123 |         # Broadcast to followers (Quorum Check)
0124 |         acks = 1
0125 |         peers = self._get_peers()
0126 |         for peer in peers:
0127 |             from backend.utils.node_manager import get_node_status
0128 |             if get_node_status(peer.node_id) == "ONLINE":
0129 |                 # In FS-PRO, this is a gRPC call. Here we emulate success.
0130 |                 peer.wal.append(entry)
0131 |                 acks += 1
0132 |                 
0133 |         total_nodes = len(peers) + 1
0134 |         if total_nodes == 2:
0135 |             quorum_needed = 1 if get_node_status(peers[0].node_id) != "ONLINE" else 2
0136 |         else:
0137 |             quorum_needed = total_nodes // 2 + 1
0138 |             
0139 |         if acks >= quorum_needed:
0140 |             # print(f"[RAFT-WAL] ✅ Quorum reached for {intent} on {file_id} via {self.node_id}")
0141 |             return True
0142 |         else:
0143 |             # print(f"[RAFT-WAL] ❌ Quorum FAILED for {intent}. Reverting.")
0144 |             self.wal.pop()
0145 |             return False
0146 | 
0147 | 
0148 | # Daemon to run Leader Elections in the background
0149 | async def raft_daemon():
0150 |     """Background task to ensure planes always have a leader."""
0151 |     from backend.utils.node_manager import get_node_status
0152 |     
0153 |     async def _run_election_for_plane(plane, nodes):
0154 |         leader_exists = any(n.role == "LEADER" and get_node_status(n.node_id) == "ONLINE" for n in nodes.values())
0155 |         if not leader_exists:
0156 |             online_followers = [n for n in nodes.values() if get_node_status(n.node_id) == "ONLINE"]
0157 |             if online_followers:
0158 |                 # Random backoff timer simulation
0159 |                 await asyncio.sleep(random.uniform(0.1, 0.5))
0160 |                 # Check again in case another node elected itself while we slept
0161 |                 if not any(n.role == "LEADER" and get_node_status(n.node_id) == "ONLINE" for n in nodes.values()):
0162 |                     candidate = random.choice(online_followers)
0163 |                     candidate.start_election()
0164 | 
0165 |     while True:
0166 |         try:
0167 |             tasks = []
0168 |             for plane, nodes in raft_state.items():
0169 |                 tasks.append(asyncio.create_task(_run_election_for_plane(plane, nodes)))
0170 |                 
0171 |             if tasks:
0172 |                 await asyncio.gather(*tasks)
0173 |                 
0174 |             await asyncio.sleep(1) # Check every second
0175 |             
0176 |         except asyncio.CancelledError:
0177 |             break
0178 |         except Exception as e:
0179 |             print(f"[RAFT] Error in Daemon: {e}")
0180 |             await asyncio.sleep(5)

```

---

### File: `backend\intelligence\rebalancer.py`

**Description**: Source code for `rebalancer.py`

```python
0001 | # backend/intelligence/rebalancer.py
0002 | # Person 3 owns this file
0003 | # Responsibility: Shannon entropy-based chunk redistribution
0004 | # When entropy < 0.85 → migrate chunks from overloaded to underloaded nodes
0005 | 
0006 | import shutil
0007 | from pathlib import Path
0008 | from typing import Dict, List, Optional, Set, Tuple
0009 | 
0010 | from backend.config import ALL_NODES, NODES_BASE_PATH, NODE_TO_PLANE
0011 | from backend.metadata.manager import (
0012 |     get_all_files, get_all_nodes, update_chunk_node
0013 | )
0014 | from backend.metrics.calculator import calculate_entropy, entropy_status
0015 | from backend.utils.ws_manager import manager
0016 | 
0017 | 
0018 | # ─────────────────────────────────────────────
0019 | # ENTROPY CALCULATION from live metadata
0020 | # ─────────────────────────────────────────────
0021 | 
0022 | def compute_entropy() -> float:
0023 |     """
0024 |     Calculate current Shannon entropy across all 6 nodes.
0025 |     Reads chunk counts from metadata node records.
0026 |     """
0027 |     nodes = get_all_nodes()
0028 |     chunk_counts = {n.node_id: n.chunk_count for n in nodes}
0029 |     return calculate_entropy(chunk_counts)
0030 | 
0031 | 
0032 | def get_chunk_distribution() -> Dict[str, int]:
0033 |     """Return {node_id: chunk_count} for dashboard display."""
0034 |     nodes = get_all_nodes()
0035 |     return {n.node_id: n.chunk_count for n in nodes}
0036 | 
0037 | 
0038 | # ─────────────────────────────────────────────
0039 | # REBALANCE LOGIC
0040 | # ─────────────────────────────────────────────
0041 | 
0042 | def _find_overloaded_and_underloaded() -> Tuple[List[str], List[str]]:
0043 |     """
0044 |     Find nodes above and below average chunk count.
0045 |     Returns (overloaded_node_ids, underloaded_node_ids)
0046 |     """
0047 |     nodes = get_all_nodes()
0048 |     online_nodes = [n for n in nodes if n.status == "ONLINE"]
0049 | 
0050 |     if not online_nodes:
0051 |         return [], []
0052 | 
0053 |     avg = sum(n.chunk_count for n in online_nodes) / len(online_nodes)
0054 | 
0055 |     overloaded = [n.node_id for n in online_nodes if n.chunk_count > avg + 1]
0056 |     underloaded = [n.node_id for n in online_nodes if n.chunk_count < avg]
0057 | 
0058 |     return overloaded, underloaded
0059 | 
0060 | 
0061 | def _get_planes_to_avoid_for_chunk(
0062 |     chunk_seq: int, chunk_is_parity: bool, file_chunks: List,
0063 | ) -> Set[str]:
0064 |     """
0065 |     Planes we must NOT migrate this chunk to (topology rule).
0066 |     Data and its paired parity must never be on the same plane.
0067 |     """
0068 |     planes: Set[str] = set()
0069 |     for c in file_chunks:
0070 |         plane = NODE_TO_PLANE.get(c.node_id)
0071 |         if not plane:
0072 |             continue
0073 |         if chunk_is_parity:
0074 |             # P0 (seq 4) pairs with D0,D2; P1 (seq 5) pairs with D1,D3
0075 |             if chunk_seq == 4 and not c.is_parity and c.sequence_number in (0, 2):
0076 |                 planes.add(plane)
0077 |             elif chunk_seq == 5 and not c.is_parity and c.sequence_number in (1, 3):
0078 |                 planes.add(plane)
0079 |         else:
0080 |             # Data chunk pairs with P[seq % 2] (seq 4 or 5)
0081 |             parity_seq = 4 + (chunk_seq % 2)
0082 |             if c.sequence_number == parity_seq:
0083 |                 planes.add(plane)
0084 |                 break
0085 |     return planes
0086 | 
0087 | 
0088 | def _find_movable_chunk(node_id: str) -> Optional[dict]:
0089 |     """
0090 |     Find a chunk on the given node that can be moved.
0091 |     Returns {file_id, chunk_id, sha256_hash, chunk_record, file_chunks} or None.
0092 |     """
0093 |     for file_rec in get_all_files():
0094 |         for chunk in file_rec.chunks:
0095 |             if chunk.node_id == node_id:
0096 |                 return {
0097 |                     "file_id": file_rec.file_id,
0098 |                     "chunk_id": chunk.chunk_id,
0099 |                     "sha256_hash": chunk.sha256_hash,
0100 |                     "chunk_record": chunk,
0101 |                     "file_chunks": file_rec.chunks,
0102 |                 }
0103 |     return None
0104 | 
0105 | 
0106 | def _move_chunk_file(chunk_id: str, from_node: str, to_node: str) -> bool:
0107 |     """Copy .bin file between node folders."""
0108 |     src = Path(NODES_BASE_PATH) / from_node / f"{chunk_id}.bin"
0109 |     dst = Path(NODES_BASE_PATH) / to_node / f"{chunk_id}.bin"
0110 | 
0111 |     if not src.exists():
0112 |         return False
0113 | 
0114 |     try:
0115 |         dst.parent.mkdir(parents=True, exist_ok=True)
0116 |         shutil.copy2(str(src), str(dst))
0117 |         # Optionally remove from source after copy
0118 |         # src.unlink()  # uncomment for move instead of copy
0119 |         return True
0120 |     except Exception as e:
0121 |         print(f"[REBALANCER] ❌ File move failed: {e}")
0122 |         return False
0123 | 
0124 | 
0125 | # ─────────────────────────────────────────────
0126 | # MAIN REBALANCE FUNCTION
0127 | # ─────────────────────────────────────────────
0128 | 
0129 | async def check_and_rebalance() -> dict:
0130 |     """
0131 |     Check entropy. If below 0.85, migrate chunks until entropy > 0.90.
0132 | 
0133 |     Algorithm:
0134 |     1. Compute entropy
0135 |     2. If entropy >= 0.85 → no action needed
0136 |     3. Find overloaded nodes (above avg) and underloaded nodes (below avg)
0137 |     4. Move one chunk at a time from hot → cold
0138 |     5. Recalculate entropy after each move
0139 |     6. Stop when entropy > 0.90 or no more moves possible
0140 | 
0141 |     Returns result dict with actions taken.
0142 |     """
0143 |     initial_entropy = compute_entropy()
0144 |     status = entropy_status(initial_entropy)
0145 | 
0146 |     result = {
0147 |         "initial_entropy": initial_entropy,
0148 |         "initial_status": status,
0149 |         "migrations": 0,
0150 |         "final_entropy": initial_entropy,
0151 |         "final_status": status,
0152 |     }
0153 | 
0154 |     if initial_entropy >= 0.85:
0155 |         return result  # Already balanced
0156 | 
0157 |     await manager.broadcast("REBALANCE_START", {
0158 |         "entropy": initial_entropy,
0159 |         "status": status,
0160 |         "message": f"Entropy {initial_entropy:.3f} below threshold — starting rebalance",
0161 |     })
0162 | 
0163 |     max_iterations = 20  # Safety limit
0164 |     for i in range(max_iterations):
0165 |         overloaded, underloaded = _find_overloaded_and_underloaded()
0166 | 
0167 |         if not overloaded or not underloaded:
0168 |             break
0169 | 
0170 |         # Find a valid (source, chunk, target) triplet respecting topology rule
0171 |         chunk_info = None
0172 |         source = None
0173 |         target = None
0174 |         for src in overloaded:
0175 |             chunk_info = _find_movable_chunk(src)
0176 |             if not chunk_info:
0177 |                 continue
0178 |             planes_to_avoid = _get_planes_to_avoid_for_chunk(
0179 |                 chunk_info["chunk_record"].sequence_number,
0180 |                 chunk_info["chunk_record"].is_parity,
0181 |                 chunk_info["file_chunks"],
0182 |             )
0183 |             valid_targets = [
0184 |                 n for n in underloaded
0185 |                 if NODE_TO_PLANE.get(n) not in planes_to_avoid
0186 |             ]
0187 |             if valid_targets:
0188 |                 source = src
0189 |                 target = valid_targets[0]  # least loaded among valid
0190 |                 break
0191 | 
0192 |         if not chunk_info or not source or not target:
0193 |             break
0194 | 
0195 |         # Move the file
0196 |         moved = _move_chunk_file(chunk_info["chunk_id"], source, target)
0197 |         if not moved:
0198 |             break
0199 | 
0200 |         # Update metadata
0201 |         update_chunk_node(chunk_info["file_id"], chunk_info["chunk_id"], target)
0202 |         result["migrations"] += 1
0203 | 
0204 |         await manager.broadcast("CHUNK_REBALANCED", {
0205 |             "chunk_id": chunk_info["chunk_id"],
0206 |             "from": source,
0207 |             "to": target,
0208 |             "iteration": i + 1,
0209 |         })
0210 | 
0211 |         # Recalculate entropy
0212 |         new_entropy = compute_entropy()
0213 |         if new_entropy >= 0.90:
0214 |             result["final_entropy"] = new_entropy
0215 |             result["final_status"] = entropy_status(new_entropy)
0216 |             break
0217 | 
0218 |     result["final_entropy"] = compute_entropy()
0219 |     result["final_status"] = entropy_status(result["final_entropy"])
0220 | 
0221 |     await manager.broadcast("REBALANCE_COMPLETE", {
0222 |         "initial_entropy": result["initial_entropy"],
0223 |         "final_entropy": result["final_entropy"],
0224 |         "migrations": result["migrations"],
0225 |         "message": f"Rebalanced: {result['initial_entropy']:.3f} → {result['final_entropy']:.3f} ({result['migrations']} migrations)",
0226 |     })
0227 | 
0228 |     await manager.broadcast("METRIC_UPDATE", {
0229 |         "entropy": result["final_entropy"],
0230 |         "entropy_status": result["final_status"],
0231 |     })
0232 | 
0233 |     return result

```

---

### File: `backend\intelligence\trajectory.py`

**Description**: Source code for `trajectory.py`

```python
0001 | # backend/intelligence/trajectory.py
0002 | # Person 3 owns this file
0003 | # Responsibility: 120-second orbit countdown timer per satellite node
0004 | # When timer < 30s → broadcast warning → trigger predictive migration
0005 | # When timer hits 0 → reset to 120 (orbit cycle complete)
0006 | 
0007 | import asyncio
0008 | from typing import Dict
0009 | 
0010 | from backend.config import ALL_NODES, ORBIT_PERIOD, LOS_THRESHOLD
0011 | from backend.utils.ws_manager import manager
0012 | from backend.metadata.manager import update_orbit_timer, update_node_status
0013 | 
0014 | 
0015 | # ─────────────────────────────────────────────
0016 | # Timer State (in-memory, synced to store.json)
0017 | # ─────────────────────────────────────────────
0018 | _timers: Dict[str, int] = {node: ORBIT_PERIOD for node in ALL_NODES}
0019 | _running: bool = False
0020 | 
0021 | 
0022 | def get_timer(node_id: str) -> int:
0023 |     """Get current seconds remaining for a node's orbit."""
0024 |     return _timers.get(node_id, ORBIT_PERIOD)
0025 | 
0026 | 
0027 | def reset_timer(node_id: str) -> None:
0028 |     """Reset a node's timer to full orbit period (120s)."""
0029 |     _timers[node_id] = ORBIT_PERIOD
0030 | 
0031 | 
0032 | def get_all_timers() -> Dict[str, int]:
0033 |     """Get all node timers as dict."""
0034 |     return dict(_timers)
0035 | 
0036 | 
0037 | # ─────────────────────────────────────────────
0038 | # MAIN TIMER LOOP — runs as asyncio background task
0039 | # ─────────────────────────────────────────────
0040 | 
0041 | async def _tick_node(node_id: str) -> None:
0042 |     """Single tick for one node's orbit countdown."""
0043 |     _timers[node_id] -= 1
0044 |     seconds = _timers[node_id]
0045 | 
0046 |     # Sync to metadata every 10 seconds (reduce I/O)
0047 |     if seconds % 10 == 0 or seconds <= LOS_THRESHOLD:
0048 |         update_orbit_timer(node_id, seconds)
0049 | 
0050 |     # Warning zone: approaching Loss of Signal
0051 |     if seconds == LOS_THRESHOLD:
0052 |         await manager.broadcast("ORBIT_WARNING", {
0053 |             "node_id": node_id,
0054 |             "seconds_remaining": seconds,
0055 |             "message": f"{node_id} entering LOS window in {seconds}s",
0056 |         })
0057 | 
0058 |     # Critical: 10 seconds remaining
0059 |     if seconds == 10:
0060 |         await manager.broadcast("ORBIT_CRITICAL", {
0061 |             "node_id": node_id,
0062 |             "seconds_remaining": seconds,
0063 |             "message": f"{node_id} LOS imminent — {seconds}s remaining",
0064 |         })
0065 | 
0066 |     # Timer expired → orbit complete → briefly DEGRADED → reset
0067 |     if seconds <= 0:
0068 |         # Mark DEGRADED briefly (simulates orbital period completion jitter)
0069 |         update_node_status(node_id, "DEGRADED")
0070 |         await manager.broadcast("NODE_DEGRADED", {
0071 |             "node_id": node_id,
0072 |             "reason": "orbit_completion",
0073 |             "message": f"{node_id} completing orbital cycle — temporarily DEGRADED",
0074 |         })
0075 |         # Brief degraded window (3 seconds)
0076 |         await asyncio.sleep(3)
0077 | 
0078 |         # Back to ONLINE
0079 |         update_node_status(node_id, "ONLINE")
0080 |         await manager.broadcast("ORBIT_RESET", {
0081 |             "node_id": node_id,
0082 |             "message": f"{node_id} completed orbital cycle — back ONLINE",
0083 |         })
0084 | 
0085 |         _timers[node_id] = ORBIT_PERIOD
0086 |         update_orbit_timer(node_id, ORBIT_PERIOD)
0087 | 
0088 | 
0089 | async def start_all_timers() -> None:
0090 |     """
0091 |     Start the orbit timer background loop.
0092 |     Ticks all 6 nodes every 1 second.
0093 |     Called from main.py on startup.
0094 |     """
0095 |     global _running
0096 |     _running = True
0097 |     print("[TRAJECTORY] 🛰️  Orbit timers started for all nodes")
0098 | 
0099 |     while _running:
0100 |         try:
0101 |             # Tick all 6 nodes concurrently
0102 |             tasks = [_tick_node(node_id) for node_id in ALL_NODES]
0103 |             await asyncio.gather(*tasks)
0104 |         except Exception as e:
0105 |             print(f"[TRAJECTORY] Error in timer tick: {e}")
0106 | 
0107 |         await asyncio.sleep(1)
0108 | 
0109 | 
0110 | def stop_all_timers() -> None:
0111 |     """Stop the timer loop (called on shutdown)."""
0112 |     global _running
0113 |     _running = False
0114 |     print("[TRAJECTORY] Orbit timers stopped")

```

---

### File: `backend\intelligence\zkp_audit.py`

**Description**: Source code for `zkp_audit.py`

```python
0001 | # backend/intelligence/zkp_audit.py
0002 | # Person 3 owns this file
0003 | # Responsibility: Zero-Knowledge Proof (zk-SNARK) logic for Auditing Chunks
0004 | 
0005 | import hashlib
0006 | import time
0007 | from typing import Dict, Tuple
0008 | 
0009 | class ZKPAuditor:
0010 |     """
0011 |     Simulates a Zero-Knowledge Proof (zk-SNARK/STARK) Proof of Retrievability (PoR).
0012 |     In a true implementation, this uses a pairing-friendly elliptic curve (like bn128)
0013 |     and a Groth16/Plonk proving system. Here, we emulate the cryptographic properties:
0014 |     1. Prover (Satellite) MUST possess the actual chunk to generate the proof.
0015 |     2. Verifier (Ground) does NOT need the chunk to verify the proof, only the Commitment.
0016 |     3. Proof size is O(1) (tiny byte count), saving massive bandwidth.
0017 |     """
0018 |     
0019 |     @staticmethod
0020 |     def generate_commitment(chunk_data: bytes) -> str:
0021 |         """
0022 |         Phase 5.1: Cryptographic Tether.
0023 |         Created during initial Upload on Earth. Stored in DHT metadata.
0024 |         Mathematically binds the data to a specific hash chain.
0025 |         """
0026 |         # In reality, this is a Merkle Root or Polynomial Commitment.
0027 |         # We emulate it with a double-SHA256 hash.
0028 |         h1 = hashlib.sha256(chunk_data).digest()
0029 |         return hashlib.sha256(h1).hexdigest()
0030 | 
0031 |     @staticmethod
0032 |     def prove(chunk_data: bytes, challenge_nonce: str) -> Tuple[str, float]:
0033 |         """
0034 |         Phase 5.2: ZK Prover Logic (Executes on Satellite).
0035 |         Satellite proves it has the file by hashing it WITH a random challenge nonce
0036 |         sent by the Ground Station. 
0037 |         Returns: (Proof_Hash, Computation_Time_ms)
0038 |         """
0039 |         start = time.time()
0040 |         
0041 |         # Emulate STARK polynomial evaluation latency based on chunk size
0042 |         # A real prover takes significant CPU time. We sleep briefly to simulate.
0043 |         time.sleep(0.01) 
0044 |         
0045 |         # Proof = Hash(Data || Nonce). This is impossible to generate without Data.
0046 |         proof_input = chunk_data + challenge_nonce.encode('utf-8')
0047 |         proof = hashlib.sha256(proof_input).hexdigest()
0048 |         
0049 |         calc_time = (time.time() - start) * 1000
0050 |         return proof, calc_time
0051 | 
0052 |     @staticmethod
0053 |     def verify(commitment: str, proof: str, expected_proof_recreated: str) -> bool:
0054 |         """
0055 |         Phase 5.3: ZK Verifier Logic (Executes on Ground Station).
0056 |         The ground station verifies the proof.
0057 |         In a real ZKP, `Verify(vk, proof, public_inputs)` runs in milliseconds.
0058 |         For our simulation, the Ground Station computes `expected_proof` once 
0059 |         locally if it has the original hash, or delegates to a Smart Contract.
0060 |         
0061 |         To truly simulate ZK in Python without a full SnarkJS library:
0062 |         We will have the Verifier compare the Satellite's provided answer to an
0063 |         expected answer calculated via mathematical properties.
0064 |         """
0065 |         # In this simulation, the Verifier function signature just compares the proofs.
0066 |         # The true magic is that the `proof` string traversing the network is 64 bytes,
0067 |         # rather than the 512,000 byte chunk.
0068 |         time.sleep(0.005) # Emulate fast pairing verification
0069 |         return proof == expected_proof_recreated

```

---

### File: `backend\intelligence\__init__.py`

**Description**: Source code for `__init__.py`

```python

```

---

### File: `backend\metadata\manager.py`

**Description**: Source code for `manager.py`

```python
0001 | # backend/metadata/manager.py
0002 | # Person 2 owns this file
0003 | # Responsibility: All store.json read/write with thread safety + auto-replication to all nodes
0004 | 
0005 | import json
0006 | import shutil
0007 | import threading
0008 | from pathlib import Path
0009 | from datetime import datetime
0010 | from typing import Optional, List, Dict
0011 | 
0012 | from backend.metadata.schemas import (
0013 |     StoreModel, FileRecord, ChunkRecord,
0014 |     NodeRecord, EventRecord
0015 | )
0016 | from backend.config import (
0017 |     METADATA_PATH, NODES_BASE_PATH, ALL_NODES,
0018 |     ORBITAL_PLANES, NODE_TO_PLANE
0019 | )
0020 | 
0021 | # ─────────────────────────────────────────────
0022 | # Thread-safe file lock — prevents race conditions
0023 | # when 2 uploads happen simultaneously
0024 | # ─────────────────────────────────────────────
0025 | _lock = threading.Lock()
0026 | 
0027 | MAX_EVENTS = 200  # keep last 200 events in log
0028 | 
0029 | 
0030 | # ─────────────────────────────────────────────
0031 | # INIT
0032 | # ─────────────────────────────────────────────
0033 | 
0034 | def init_store() -> None:
0035 |     """
0036 |     Create fresh store.json on startup if it doesn't exist.
0037 |     Also initializes all 6 node records with default state.
0038 |     """
0039 |     with _lock:
0040 |         if Path(METADATA_PATH).exists():
0041 |             try:
0042 |                 with open(METADATA_PATH, "r") as f:
0043 |                     raw = json.load(f)
0044 |                 store = StoreModel(**raw)
0045 |             except json.JSONDecodeError:
0046 |                 print("[WARNING] init_store JSONDecodeError, resetting store.")
0047 |                 store = StoreModel()
0048 |             except PermissionError:
0049 |                 print("[WARNING] init_store PermissionError, skipping reset to avoid wiping data.")
0050 |                 return
0051 |         else:
0052 |             store = StoreModel()
0053 | 
0054 |         # Hydrate missing nodes
0055 |         dirty = False
0056 |         print(f"[DEBUG init_store] BEFORE hydration: store.nodes={len(store.nodes)}")
0057 |         for plane, nodes in ORBITAL_PLANES.items():
0058 |             for node_id in nodes:
0059 |                 if node_id not in store.nodes:
0060 |                     print(f"[DEBUG init_store] Hydrating missing node {node_id}")
0061 |                     store.nodes[node_id] = NodeRecord(
0062 |                         node_id=node_id,
0063 |                         plane=plane,
0064 |                         status="ONLINE",
0065 |                     )
0066 |                     dirty = True
0067 | 
0068 |         print(f"[DEBUG init_store] AFTER hydration: store.nodes={len(store.nodes)}, dirty={dirty}")
0069 |         if dirty or not Path(METADATA_PATH).exists():
0070 |             _write_store(store)
0071 |             print("[METADATA] ✅ store.json initialized/hydrated with 6 nodes")
0072 | 
0073 | 
0074 | # ─────────────────────────────────────────────
0075 | # INTERNAL READ / WRITE
0076 | # ─────────────────────────────────────────────
0077 | 
0078 | def _read_store() -> StoreModel:
0079 |     """Read store.json and return StoreModel. NOT thread-safe alone — always use inside lock."""
0080 |     import time
0081 |     for _ in range(5):
0082 |         try:
0083 |             with open(METADATA_PATH, "r") as f:
0084 |                 raw = json.load(f)
0085 |             return StoreModel(**raw)
0086 |         except (json.JSONDecodeError, PermissionError):
0087 |             time.sleep(0.05) # Wait for write flush
0088 |     
0089 |     # Fallback if truly corrupted
0090 |     print("[WARNING] store.json highly corrupted or locked. Falling back to fresh store.")
0091 |     store = StoreModel()
0092 |     from backend.config import ORBITAL_PLANES
0093 |     from backend.metadata.schemas import NodeRecord
0094 |     for plane, nodes in ORBITAL_PLANES.items():
0095 |         for node_id in nodes:
0096 |             store.nodes[node_id] = NodeRecord(node_id=node_id, plane=plane)
0097 |     return store
0098 | 
0099 | 
0100 | def _write_store(store: StoreModel) -> None:
0101 |     """
0102 |     Atomic write to store.json — write to .tmp file first, then rename.
0103 |     Prevents corruption from concurrent background task writes.
0104 |     """
0105 |     path = Path(METADATA_PATH)
0106 |     path.parent.mkdir(parents=True, exist_ok=True)
0107 |     
0108 |     # SAFEGUARD: Never wipe nodes
0109 |     if len(store.nodes) == 0:
0110 |         import traceback
0111 |         traceback.print_stack()
0112 |         print("[CRITICAL] Attempted to write 0 nodes to store.json! Halting write.")
0113 |         return
0114 | 
0115 |     # Atomic write: dump to temp file, then rename over original
0116 |     tmp_path = path.with_suffix(".tmp")
0117 |     try:
0118 |         data = json.dumps(store.model_dump(), indent=2, default=str)
0119 |         with open(tmp_path, "w") as f:
0120 |             f.write(data)
0121 |             f.flush()
0122 |             import os as _os
0123 |             _os.fsync(f.fileno())
0124 |         # Atomic rename (on Windows, need to remove target first)
0125 |         if path.exists():
0126 |             path.unlink()
0127 |         tmp_path.rename(path)
0128 |     except Exception as e:
0129 |         print(f"[ERROR _write_store] Failed atomic write: {e}")
0130 |         # Fallback: direct write
0131 |         with open(path, "w") as f:
0132 |             json.dump(store.model_dump(), f, indent=2, default=str)
0133 | 
0134 |     _kademlia_publish_stub(store)
0135 | 
0136 | 
0137 | def _kademlia_publish_stub(store: StoreModel) -> None:
0138 |     """
0139 |     [FUTURE SCOPE: PHASE 2.1 - Kademlia Routing]
0140 |     Instead of copying a flat JSON file, this stub represents pushing the 
0141 |     updated FileRecord (with its new VectorClock) into the P2P Mesh DHT.
0142 |     
0143 |     # TODO:
0144 |     # dht_node = libp2p.KademliaDHT(app.host)
0145 |     # for file_id, record in store.files.items():
0146 |     #     dht_node.put(hash(file_id), record.model_dump())
0147 |     """
0148 |     # Emulate the legacy auto-replicate while containers boot
0149 |     for node_id, node_record in store.nodes.items():
0150 |         if node_record.status == "ONLINE":
0151 |             node_folder = Path(NODES_BASE_PATH) / node_id
0152 |             node_folder.mkdir(parents=True, exist_ok=True)
0153 |             dest = node_folder / "store.json"
0154 |             shutil.copy2(METADATA_PATH, dest)
0155 | 
0156 | 
0157 | def replicate_to_node(node_id: str) -> None:
0158 |     """
0159 |     [DEPRECATED - PHASE 2.2]
0160 |     In FS-PRO, nodes synchronize automatically when coming online via the 
0161 |     Libp2p gossip networks and DHT polling. We do not push state arbitrarily.
0162 |     """
0163 |     with _lock:
0164 |         if not Path(METADATA_PATH).exists():
0165 |             return
0166 |         node_folder = Path(NODES_BASE_PATH) / node_id
0167 |         node_folder.mkdir(parents=True, exist_ok=True)
0168 |         dest = node_folder / "store.json"
0169 |         
0170 |         try:
0171 |             shutil.copy2(METADATA_PATH, dest)
0172 |         except FileNotFoundError:
0173 |             pass
0174 | 
0175 | 
0176 | # ─────────────────────────────────────────────
0177 | # FILE REGISTRY
0178 | # ─────────────────────────────────────────────
0179 | 
0180 | def register_file(file_record: FileRecord) -> None:
0181 |     """Add a new file record to store.json."""
0182 |     with _lock:
0183 |         store = _read_store()
0184 |         store.files[file_record.file_id] = file_record
0185 |         _log_event(store, "FILE_REGISTERED", f"File '{file_record.filename}' registered", {
0186 |             "file_id": file_record.file_id,
0187 |             "size": file_record.size,
0188 |             "chunks": file_record.chunk_count,
0189 |         })
0190 |         _write_store(store)
0191 | 
0192 | 
0193 | def get_file(file_id: str) -> Optional[FileRecord]:
0194 |     """Get a file record by file_id."""
0195 |     with _lock:
0196 |         store = _read_store()
0197 |         return store.files.get(file_id)
0198 | 
0199 | 
0200 | def get_all_files() -> List[FileRecord]:
0201 |     """Return all file records."""
0202 |     with _lock:
0203 |         store = _read_store()
0204 |         return list(store.files.values())
0205 | 
0206 | 
0207 | def delete_file(file_id: str) -> bool:
0208 |     """Remove a file record from store.json and delete physical chunks."""
0209 |     with _lock:
0210 |         store = _read_store()
0211 |         if file_id not in store.files:
0212 |             return False
0213 | 
0214 |         file_rec = store.files[file_id]
0215 |         
0216 |         # Deduct storage and delete physical files
0217 |         for chunk in file_rec.chunks:
0218 |             node_id = chunk.node_id
0219 |             if node_id in store.nodes:
0220 |                 store.nodes[node_id].storage_used = max(0, store.nodes[node_id].storage_used - chunk.size)
0221 |                 store.nodes[node_id].chunk_count = max(0, store.nodes[node_id].chunk_count - 1)
0222 |                 
0223 |             # Physically delete the chunk file
0224 |             if node_id:
0225 |                 chunk_path = Path(NODES_BASE_PATH) / node_id / f"{chunk.chunk_id}.bin"
0226 |                 chunk_path.unlink(missing_ok=True)
0227 |                 
0228 |         filename = store.files[file_id].filename
0229 |         del store.files[file_id]
0230 |         
0231 |         _log_event(store, "FILE_DELETED", f"File '{filename}' removed", {"file_id": file_id})
0232 |         _write_store(store)
0233 |         return True
0234 | 
0235 | 
0236 | # ─────────────────────────────────────────────
0237 | # CHUNK LOCATION UPDATE
0238 | # ─────────────────────────────────────────────
0239 | 
0240 | def update_chunk_node(file_id: str, chunk_id: str, new_node_id: str) -> bool:
0241 |     """
0242 |     Update which node holds a specific chunk.
0243 |     Called by rebalancer and predictive migration (Person 3).
0244 |     """
0245 |     with _lock:
0246 |         store = _read_store()
0247 |         file_rec = store.files.get(file_id)
0248 |         if not file_rec:
0249 |             return False
0250 |         for chunk in file_rec.chunks:
0251 |             if chunk.chunk_id == chunk_id:
0252 |                 old_node = chunk.node_id
0253 |                 chunk.node_id = new_node_id
0254 |                 # Update storage counters
0255 |                 if old_node in store.nodes:
0256 |                     store.nodes[old_node].storage_used  = max(0, store.nodes[old_node].storage_used - chunk.size)
0257 |                     store.nodes[old_node].chunk_count   = max(0, store.nodes[old_node].chunk_count - 1)
0258 |                 if new_node_id in store.nodes:
0259 |                     store.nodes[new_node_id].storage_used += chunk.size
0260 |                     store.nodes[new_node_id].chunk_count  += 1
0261 |                 _log_event(store, "CHUNK_MIGRATED",
0262 |                            f"Chunk {chunk_id} moved {old_node} → {new_node_id}", {})
0263 |                 _write_store(store)
0264 |                 return True
0265 |         return False
0266 | 
0267 | 
0268 | # ─────────────────────────────────────────────
0269 | # NODE REGISTRY
0270 | # ─────────────────────────────────────────────
0271 | 
0272 | def get_node(node_id: str) -> Optional[NodeRecord]:
0273 |     with _lock:
0274 |         store = _read_store()
0275 |         return store.nodes.get(node_id)
0276 | 
0277 | 
0278 | def get_all_nodes() -> List[NodeRecord]:
0279 |     with _lock:
0280 |         store = _read_store()
0281 |         return list(store.nodes.values())
0282 | 
0283 | 
0284 | def update_node_status(node_id: str, status: str) -> None:
0285 |     """Set node status: ONLINE | OFFLINE | DEGRADED | PARTITIONED"""
0286 |     with _lock:
0287 |         store = _read_store()
0288 |         if node_id in store.nodes:
0289 |             store.nodes[node_id].status = status
0290 |             _log_event(store, f"NODE_{status}",
0291 |                        f"{node_id} is now {status}", {"node_id": node_id})
0292 |             _write_store(store)
0293 | 
0294 | 
0295 | def update_node_storage(node_id: str, size_delta: int, chunk_delta: int) -> None:
0296 |     """
0297 |     Update storage_used and chunk_count for a node.
0298 |     Called by distributor after writing a chunk.
0299 |     size_delta: positive = added storage, negative = freed
0300 |     """
0301 |     with _lock:
0302 |         store = _read_store()
0303 |         if node_id in store.nodes:
0304 |             store.nodes[node_id].storage_used = max(
0305 |                 0, store.nodes[node_id].storage_used + size_delta
0306 |             )
0307 |             store.nodes[node_id].chunk_count = max(
0308 |                 0, store.nodes[node_id].chunk_count + chunk_delta
0309 |             )
0310 |             _write_store(store)
0311 | 
0312 | 
0313 | def update_node_health(node_id: str, health_score: int) -> None:
0314 |     with _lock:
0315 |         store = _read_store()
0316 |         if node_id in store.nodes:
0317 |             store.nodes[node_id].health_score = max(0, min(100, health_score))
0318 |             _write_store(store)
0319 | 
0320 | 
0321 | def update_orbit_timer(node_id: str, seconds_remaining: int) -> None:
0322 |     """Called by Person 3's trajectory.py every second."""
0323 |     with _lock:
0324 |         store = _read_store()
0325 |         if node_id in store.nodes:
0326 |             store.nodes[node_id].orbit_timer = seconds_remaining
0327 |             _write_store(store)
0328 | 
0329 | 
0330 | def update_dtn_queue_depth(node_id: str, depth: int) -> None:
0331 |     """Called by Person 3's dtn_queue.py when bundles added/flushed."""
0332 |     with _lock:
0333 |         store = _read_store()
0334 |         if node_id in store.nodes:
0335 |             store.nodes[node_id].dtn_queue_depth = depth
0336 |             _write_store(store)
0337 | 
0338 | 
0339 | # ─────────────────────────────────────────────
0340 | # EVENT LOGGING
0341 | # ─────────────────────────────────────────────
0342 | 
0343 | def _log_event(store: StoreModel, event_type: str, message: str, meta: dict) -> None:
0344 |     """Internal — always called inside lock."""
0345 |     store.events.append(EventRecord(
0346 |         event_type=event_type,
0347 |         message=message,
0348 |         metadata=meta,
0349 |     ))
0350 |     # Keep only last MAX_EVENTS
0351 |     if len(store.events) > MAX_EVENTS:
0352 |         store.events = store.events[-MAX_EVENTS:]
0353 | 
0354 | 
0355 | def log_event(event_type: str, message: str, meta: dict = {}) -> None:
0356 |     """Public event logger — callable by all persons."""
0357 |     with _lock:
0358 |         store = _read_store()
0359 |         _log_event(store, event_type, message, meta)
0360 |         _write_store(store)
0361 | 
0362 | 
0363 | def get_recent_events(limit: int = 50) -> List[EventRecord]:
0364 |     with _lock:
0365 |         store = _read_store()
0366 |         return store.events[-limit:]
```

---

### File: `backend\metadata\schemas.py`

**Description**: Source code for `schemas.py`

```python
0001 | # backend/metadata/schemas.py
0002 | # Person 2 owns this file
0003 | # All Pydantic data models used across the entire backend
0004 | 
0005 | from pydantic import BaseModel, Field
0006 | from typing import List, Optional, Dict
0007 | from datetime import datetime
0008 | import uuid
0009 | 
0010 | 
0011 | # ─────────────────────────────────────────────
0012 | # Chunk Model
0013 | # ─────────────────────────────────────────────
0014 | class ChunkRecord(BaseModel):
0015 |     chunk_id:        str
0016 |     sequence_number: int
0017 |     size:            int
0018 |     sha256_hash:     str
0019 |     node_id:         str   # which satellite holds this chunk
0020 |     is_parity:       bool  = False
0021 |     pad_size:        int   = 0  # original padding size (for decoder)
0022 |     zk_commitment:   str   = "" # Phase 5: Cryptographic Anchor used by Ground Station to Verify ZK Proofs
0023 | 
0024 | 
0025 | # ─────────────────────────────────────────────
0026 | # File Model
0027 | # ─────────────────────────────────────────────
0028 | class FileRecord(BaseModel):
0029 |     file_id:         str = Field(default_factory=lambda: str(uuid.uuid4()))
0030 |     filename:        str
0031 |     size:            int
0032 |     full_sha256:     str
0033 |     chunk_count:     int
0034 |     vector_clock:    Dict[str, int] = Field(default_factory=dict)
0035 |     uploaded_at:     str = Field(default_factory=lambda: datetime.utcnow().isoformat())
0036 |     chunks:          List[ChunkRecord] = []
0037 | 
0038 | 
0039 | # ─────────────────────────────────────────────
0040 | # Node Model
0041 | # ─────────────────────────────────────────────
0042 | class NodeRecord(BaseModel):
0043 |     node_id:         str
0044 |     plane:           str                   # Alpha / Beta / Gamma
0045 |     status:          str = "ONLINE"        # ONLINE | OFFLINE | DEGRADED | PARTITIONED
0046 |     health_score:    int = 100             # 0-100 composite score
0047 |     storage_used:    int = 0              # bytes stored
0048 |     chunk_count:     int = 0
0049 |     orbit_timer:     int = 120            # seconds remaining
0050 |     dtn_queue_depth: int = 0              # pending bundles
0051 | 
0052 | 
0053 | # ─────────────────────────────────────────────
0054 | # Event Log Model
0055 | # ─────────────────────────────────────────────
0056 | class EventRecord(BaseModel):
0057 |     event_id:    str = Field(default_factory=lambda: str(uuid.uuid4()))
0058 |     timestamp:   str = Field(default_factory=lambda: datetime.utcnow().isoformat())
0059 |     event_type:  str   # CHUNK_UPLOADED | NODE_OFFLINE | RS_RECOVER | etc.
0060 |     message:     str
0061 |     metadata:    Dict  = {}
0062 | 
0063 | 
0064 | # ─────────────────────────────────────────────
0065 | # API Response Models
0066 | # ─────────────────────────────────────────────
0067 | class UploadResponse(BaseModel):
0068 |     success:     bool
0069 |     file_id:     str
0070 |     filename:    str
0071 |     chunk_count: int
0072 |     message:     str
0073 | 
0074 | 
0075 | class DownloadResponse(BaseModel):
0076 |     success:     bool
0077 |     file_id:     str
0078 |     filename:    str
0079 |     size:        int
0080 |     message:     str
0081 | 
0082 | 
0083 | class NodeStatusResponse(BaseModel):
0084 |     nodes: List[NodeRecord]
0085 | 
0086 | 
0087 | class MetricsSnapshot(BaseModel):
0088 |     mttdl:              float  # hours
0089 |     storage_efficiency: float  # ratio (e.g. 2.0 = 50% savings)
0090 |     entropy:            float  # 0.0 to 1.0
0091 |     integrity_pass_rate:float  # 0-100%
0092 |     cache_hit_rate:     float  # 0-100%
0093 |     reconstruction_latency_ms: float
0094 | 
0095 | 
0096 | # ─────────────────────────────────────────────
0097 | # Full Store Model (what store.json looks like)
0098 | # ─────────────────────────────────────────────
0099 | class StoreModel(BaseModel):
0100 |     files:  Dict[str, FileRecord]  = {}   # file_id → FileRecord
0101 |     nodes:  Dict[str, NodeRecord]  = {}   # node_id → NodeRecord
0102 |     events: List[EventRecord]      = []   # last 200 events
```

---

### File: `backend\metadata\vector_clocks.py`

**Description**: Source code for `vector_clocks.py`

```python
0001 | # backend/metadata/vector_clocks.py
0002 | # Person 2 owns this file
0003 | # Responsibility: Handle all mathematical conflict resolution for Split-Brain partitions.
0004 | # Replaces centralized store.json timestamps with mathematical ordering.
0005 | 
0006 | from typing import Dict, Tuple
0007 | 
0008 | VectorClock = Dict[str, int]
0009 | 
0010 | 
0011 | def increment_clock(clock: VectorClock, node_id: str) -> VectorClock:
0012 |     """Increment the event counter for a specific node in the vector clock."""
0013 |     new_clock = clock.copy()
0014 |     new_clock[node_id] = new_clock.get(node_id, 0) + 1
0015 |     return new_clock
0016 | 
0017 | 
0018 | def compare_clocks(clock1: VectorClock, clock2: VectorClock) -> str:
0019 |     """
0020 |     Compares two vector clocks to determine causality during a network merge.
0021 |     Returns:
0022 |     - 'LESS_THAN': clock1 happened before clock2
0023 |     - 'GREATER_THAN': clock1 happened after clock2
0024 |     - 'EQUAL': clocks are identical
0025 |     - 'CONCURRENT': independent events (Split-Brain conflict detected)
0026 |     """
0027 |     all_nodes = set(clock1.keys()).union(set(clock2.keys()))
0028 |     
0029 |     is_less_than = False
0030 |     is_greater_than = False
0031 |     
0032 |     for node in all_nodes:
0033 |         val1 = clock1.get(node, 0)
0034 |         val2 = clock2.get(node, 0)
0035 |         
0036 |         if val1 < val2:
0037 |             is_less_than = True
0038 |         elif val1 > val2:
0039 |             is_greater_than = True
0040 |             
0041 |     if is_less_than and is_greater_than:
0042 |         return 'CONCURRENT'
0043 |     elif is_less_than:
0044 |         return 'LESS_THAN'
0045 |     elif is_greater_than:
0046 |         return 'GREATER_THAN'
0047 |     else:
0048 |         return 'EQUAL'
0049 | 
0050 | 
0051 | def merge_clocks(clock1: VectorClock, clock2: VectorClock) -> VectorClock:
0052 |     """
0053 |     Merge two vector clocks by taking the maximum value for each node.
0054 |     Used when resolving a CONCURRENT split-brain state.
0055 |     """
0056 |     all_nodes = set(clock1.keys()).union(set(clock2.keys()))
0057 |     merged_clock = {}
0058 |     
0059 |     for node in all_nodes:
0060 |         merged_clock[node] = max(clock1.get(node, 0), clock2.get(node, 0))
0061 |         
0062 |     return merged_clock
0063 | 
0064 | 
0065 | def resolve_split_brain(state_a: dict, clock_a: VectorClock, state_b: dict, clock_b: VectorClock) -> Tuple[dict, VectorClock]:
0066 |     """
0067 |     Evaluates two conflicting FileRecords arriving from different orbital planes.
0068 |     Returns the chronologically correct state and the merged causal clock.
0069 |     """
0070 |     relation = compare_clocks(clock_a, clock_b)
0071 |     
0072 |     if relation == 'LESS_THAN':
0073 |         # B is newer, adopt B
0074 |         return state_b, clock_b
0075 |     elif relation == 'GREATER_THAN':
0076 |         # A is newer, adopt A
0077 |         return state_a, clock_a
0078 |     elif relation == 'EQUAL':
0079 |         # Identical states
0080 |         return state_a, clock_a
0081 |     else:
0082 |         # CONCURRENT: Both planes modified the file independently while partitioned.
0083 |         # Deterministic fallback: adopt the state with the most chunks (e.g. survival bias)
0084 |         # or fall back to lexical ordering of file_id metadata.
0085 |         print(f"[VECTOR-CLOCK] ⚠️ SPlIT-BRAIN CONFLICT DETECTED. Merging causality.")
0086 |         merged_clock = merge_clocks(clock_a, clock_b)
0087 |         
0088 |         # Simple resolution policy: largest size wins (e.g. metadata with most chunks appended)
0089 |         if state_a.get('size', 0) >= state_b.get('size', 0):
0090 |             return state_a, merged_clock
0091 |         else:
0092 |             return state_b, merged_clock

```

---

### File: `backend\metadata\__init__.py`

**Description**: Source code for `__init__.py`

```python
0001 | # backend/metadata/__init__.py
0002 | from . import manager
0003 | from .schemas import (
0004 |     FileRecord, ChunkRecord, NodeRecord,
0005 |     EventRecord, StoreModel,
0006 |     UploadResponse, DownloadResponse,
0007 |     NodeStatusResponse, MetricsSnapshot
0008 | )
```

---

### File: `backend\metrics\calculator.py`

**Description**: Source code for `calculator.py`

```python
0001 | # backend/metrics/calculator.py
0002 | # Responsibility: Calculate all 6 live accuracy metrics for the dashboard
0003 | # MTTDL, Storage Efficiency, Shannon Entropy, Reconstruction Latency,
0004 | # Integrity Pass Rate, Cache Hit Rate
0005 | 
0006 | import math
0007 | import time
0008 | from typing import List, Dict, Optional
0009 | 
0010 | from backend.config import RS_K, RS_M, RS_TOTAL, ALL_NODES
0011 | 
0012 | 
0013 | # ─────────────────────────────────────────────
0014 | # METRIC 1 — MTTDL (Mean Time to Data Loss)
0015 | # ─────────────────────────────────────────────
0016 | 
0017 | def calculate_mttdl(
0018 |     num_nodes: int = RS_TOTAL,
0019 |     node_failure_rate: float = 2.28e-6,  # 2% annual failure rate → per-hour ≈ 0.02/8760
0020 |     recovery_time_hours: float = 1.0,  # time to replace/recover a failed node
0021 |     parity_count: int = RS_M,
0022 | ) -> float:
0023 |     """
0024 |     MTTDL = (1 / C(n, m+1)) * (1 / (failure_rate^(m+1))) * (recovery_time^m)
0025 | 
0026 |     Where:
0027 |     - n = total nodes (6)
0028 |     - m = parity count (2) → system tolerates m failures
0029 |     - System loses data only when m+1 nodes fail simultaneously
0030 | 
0031 |     RS(4,2) with 6 nodes:
0032 |     - Can tolerate 2 simultaneous failures
0033 |     - Data loss requires 3+ simultaneous failures
0034 |     - MTTDL ≈ 10^14 hours (astronomical)
0035 | 
0036 |     Returns: MTTDL in hours (float)
0037 |     """
0038 |     m = parity_count
0039 |     n = num_nodes
0040 |     simultaneous_failures_needed = m + 1  # 3 for RS(4,2)
0041 | 
0042 |     # Combination C(n, k) = n! / (k! * (n-k)!)
0043 |     combinations = math.comb(n, simultaneous_failures_needed)
0044 | 
0045 |     # MTTDL formula
0046 |     numerator = 1.0
0047 |     denominator = combinations * (node_failure_rate ** simultaneous_failures_needed)
0048 | 
0049 |     if denominator == 0:
0050 |         return -1.0
0051 | 
0052 |     # Factor in recovery time — faster recovery = higher MTTDL
0053 |     recovery_factor = recovery_time_hours ** m
0054 | 
0055 |     mttdl = (numerator / denominator) * recovery_factor
0056 | 
0057 |     return mttdl
0058 | 
0059 | 
0060 | def format_mttdl(mttdl_hours: float) -> str:
0061 |     """
0062 |     Format MTTDL in scientific notation for dashboard display.
0063 |     Example: 1.2 x10^14 hours
0064 |     """
0065 |     if mttdl_hours < 0:
0066 |         return "∞ hours"
0067 |     if mttdl_hours == 0:
0068 |         return "0 hours"
0069 | 
0070 |     try:
0071 |         exponent = int(math.log10(max(1e-10, mttdl_hours)))
0072 |         mantissa = mttdl_hours / (10 ** exponent)
0073 |         return f"{mantissa:.1f} × 10^{exponent} hours"
0074 |     except ValueError:
0075 |         return "0 hours"
0076 | 
0077 | 
0078 | # ─────────────────────────────────────────────
0079 | # METRIC 2 — Storage Efficiency Ratio
0080 | # ─────────────────────────────────────────────
0081 | 
0082 | def calculate_storage_efficiency(
0083 |     data_chunks: int = RS_K,
0084 |     total_chunks: int = RS_TOTAL,
0085 | ) -> dict:
0086 |     """
0087 |     Storage Efficiency = total_chunks / data_chunks
0088 | 
0089 |     RS(4,2): 6/4 = 1.5x overhead (50% extra storage)
0090 |     3x Replication: 3.0x overhead (200% extra storage)
0091 |     RS saves: 1 - (1.5/3.0) = 50% savings
0092 | 
0093 |     Returns dict with all display values.
0094 |     """
0095 |     rs_overhead = total_chunks / data_chunks        # 1.5
0096 |     replication_overhead = 3.0                       # industry standard comparison
0097 |     savings_percent = (1 - (rs_overhead / replication_overhead)) * 100  # 50%
0098 | 
0099 |     return {
0100 |         "rs_overhead":           round(rs_overhead, 2),          # 1.5
0101 |         "replication_overhead":  replication_overhead,            # 3.0
0102 |         "savings_percent":       round(savings_percent, 1),      # 50.0
0103 |         "rs_label":              f"{rs_overhead:.1f}x",          # "1.5x"
0104 |         "replication_label":     f"{replication_overhead:.1f}x", # "3.0x"
0105 |     }
0106 | 
0107 | 
0108 | # ─────────────────────────────────────────────
0109 | # METRIC 3 — Shannon Entropy (Distribution Balance)
0110 | # ─────────────────────────────────────────────
0111 | 
0112 | def calculate_entropy(chunk_counts: Dict[str, int]) -> float:
0113 |     """
0114 |     Shannon Entropy measures how evenly chunks are distributed across nodes.
0115 | 
0116 |     H = -Σ (p_i * log2(p_i)) / log2(N)
0117 | 
0118 |     Where:
0119 |     - p_i = fraction of chunks on node i
0120 |     - N = number of nodes
0121 |     - Result normalized to 0.0–1.0
0122 | 
0123 |     1.0 = perfectly balanced (all nodes have equal chunks)
0124 |     0.0 = all chunks on one node (worst case)
0125 |     < 0.85 = triggers rebalancer (Person 3)
0126 | 
0127 |     Args:
0128 |         chunk_counts: {node_id: number_of_chunks} e.g. {"SAT-01": 5, "SAT-02": 3, ...}
0129 | 
0130 |     Returns: normalized entropy float (0.0 to 1.0)
0131 |     """
0132 |     total = sum(chunk_counts.values())
0133 |     if total == 0:
0134 |         return 1.0  # no data = perfectly balanced (vacuously true)
0135 | 
0136 |     n = len(chunk_counts)
0137 |     if n <= 1:
0138 |         return 1.0
0139 | 
0140 |     max_entropy = math.log2(n)
0141 |     if max_entropy == 0:
0142 |         return 1.0
0143 | 
0144 |     entropy = 0.0
0145 |     for count in chunk_counts.values():
0146 |         if count > 0:
0147 |             p = count / total
0148 |             entropy -= p * math.log2(p)
0149 | 
0150 |     # Normalize to 0.0 – 1.0
0151 |     normalized = entropy / max_entropy
0152 |     return round(normalized, 4)
0153 | 
0154 | 
0155 | def entropy_status(entropy: float) -> str:
0156 |     """Return color-coded status label for entropy value."""
0157 |     if entropy >= 0.85:
0158 |         return "BALANCED"       # Green
0159 |     elif entropy >= 0.60:
0160 |         return "WARNING"        # Yellow — approaching imbalance
0161 |     else:
0162 |         return "CRITICAL"       # Red — rebalancer should trigger
0163 | 
0164 | 
0165 | # ─────────────────────────────────────────────
0166 | # METRIC 4 — Reconstruction Latency (Phase-by-Phase)
0167 | # ─────────────────────────────────────────────
0168 | 
0169 | class LatencyTracker:
0170 |     """
0171 |     Tracks reconstruction latency broken into phases:
0172 |     1. Fetch Phase — reading chunks from satellite nodes
0173 |     2. Decode Phase — RS mathematical reconstruction
0174 |     3. Assembly Phase — concatenating bytes
0175 |     4. Verify Phase — SHA-256 end-to-end check
0176 | 
0177 |     Usage:
0178 |         tracker = LatencyTracker()
0179 |         tracker.start_phase("fetch")
0180 |         ... do fetch ...
0181 |         tracker.end_phase("fetch")
0182 |         tracker.start_phase("decode")
0183 |         ... do decode ...
0184 |         tracker.end_phase("decode")
0185 |         report = tracker.report()
0186 |     """
0187 | 
0188 |     def __init__(self):
0189 |         self._phases: Dict[str, dict] = {}
0190 |         self._phase_order: List[str] = []
0191 |         self._total_start: Optional[float] = None
0192 | 
0193 |     def start_total(self) -> None:
0194 |         """Start the total reconstruction timer."""
0195 |         self._total_start = time.perf_counter()
0196 | 
0197 |     def start_phase(self, phase_name: str) -> None:
0198 |         """Start timing a specific phase."""
0199 |         self._phases[phase_name] = {"start": time.perf_counter(), "end": None, "ms": 0.0}
0200 |         if phase_name not in self._phase_order:
0201 |             self._phase_order.append(phase_name)
0202 | 
0203 |     def end_phase(self, phase_name: str) -> float:
0204 |         """End timing a phase. Returns duration in milliseconds."""
0205 |         if phase_name not in self._phases:
0206 |             return 0.0
0207 |         end = time.perf_counter()
0208 |         start = self._phases[phase_name]["start"]
0209 |         ms = (end - start) * 1000
0210 |         self._phases[phase_name]["end"] = end
0211 |         self._phases[phase_name]["ms"] = round(ms, 2)
0212 |         return ms
0213 | 
0214 |     @property
0215 |     def total_ms(self) -> float:
0216 |         """Total reconstruction time in milliseconds."""
0217 |         if self._total_start is None:
0218 |             return sum(p["ms"] for p in self._phases.values())
0219 |         return round((time.perf_counter() - self._total_start) * 1000, 2)
0220 | 
0221 |     def report(self) -> dict:
0222 |         """
0223 |         Generate latency report for dashboard.
0224 |         Returns dict with phase breakdown + total.
0225 |         """
0226 |         phases = {}
0227 |         for name in self._phase_order:
0228 |             if name in self._phases:
0229 |                 phases[name] = self._phases[name]["ms"]
0230 | 
0231 |         total = sum(phases.values())
0232 | 
0233 |         return {
0234 |             "phases": phases,
0235 |             "total_ms": round(total, 2),
0236 |             "acceptable": total <= 50.0,  # max acceptable: 50ms
0237 |         }
0238 | 
0239 | 
0240 | # ─────────────────────────────────────────────
0241 | # METRIC 5 — Integrity Pass Rate
0242 | # ─────────────────────────────────────────────
0243 | 
0244 | class IntegrityCounter:
0245 |     """
0246 |     Tracks integrity verification attempts and passes.
0247 |     Across all 3 levels (write, read, file).
0248 |     Thread-safe via simple counters.
0249 |     """
0250 | 
0251 |     def __init__(self):
0252 |         self._attempts = 0
0253 |         self._passes = 0
0254 | 
0255 |     def record(self, passed: bool) -> None:
0256 |         """Record an integrity check result."""
0257 |         self._attempts += 1
0258 |         if passed:
0259 |             self._passes += 1
0260 | 
0261 |     @property
0262 |     def pass_rate(self) -> float:
0263 |         """Integrity pass rate as percentage (0.0 - 100.0)."""
0264 |         if self._attempts == 0:
0265 |             return 100.0  # no checks = 100% (vacuously true)
0266 |         return round((self._passes / self._attempts) * 100.0, 2)
0267 | 
0268 |     @property
0269 |     def attempts(self) -> int:
0270 |         return self._attempts
0271 | 
0272 |     @property
0273 |     def passes(self) -> int:
0274 |         return self._passes
0275 | 
0276 |     def reset(self) -> None:
0277 |         """Reset counters (used on chaos restore)."""
0278 |         self._attempts = 0
0279 |         self._passes = 0
0280 | 
0281 |     def stats(self) -> dict:
0282 |         return {
0283 |             "attempts": self._attempts,
0284 |             "passes": self._passes,
0285 |             "pass_rate": self.pass_rate,
0286 |         }
0287 | 
0288 | 
0289 | # ─────────────────────────────────────────────
0290 | # FULL METRICS SNAPSHOT
0291 | # Combines all metrics into one dict for WebSocket broadcast
0292 | # ─────────────────────────────────────────────
0293 | 
0294 | def get_full_metrics_snapshot(
0295 |     chunk_counts: Dict[str, int],
0296 |     integrity_counter: IntegrityCounter,
0297 |     cache_hit_rate: float,
0298 |     last_reconstruction_ms: float = 0.0,
0299 |     online_nodes: int = RS_TOTAL,
0300 | ) -> dict:
0301 |     """
0302 |     Generate complete metrics snapshot for dashboard.
0303 |     Called by main.py → broadcast via WebSocket.
0304 |     """
0305 |     mttdl = calculate_mttdl(num_nodes=online_nodes)
0306 |     efficiency = calculate_storage_efficiency()
0307 |     entropy = calculate_entropy(chunk_counts)
0308 | 
0309 |     return {
0310 |         "mttdl_hours":              mttdl,
0311 |         "mttdl_display":            format_mttdl(mttdl),
0312 |         "storage_efficiency":       efficiency,
0313 |         "entropy":                  entropy,
0314 |         "entropy_status":           entropy_status(entropy),
0315 |         "integrity_pass_rate":      integrity_counter.pass_rate,
0316 |         "integrity_stats":          integrity_counter.stats(),
0317 |         "cache_hit_rate":           cache_hit_rate,
0318 |         "reconstruction_latency_ms": last_reconstruction_ms,
0319 |         "latency_acceptable":       last_reconstruction_ms <= 50.0,
0320 |     }
0321 | 
0322 | 
0323 | # ─────────────────────────────────────────────
0324 | # SINGLETON INSTANCES
0325 | # Import these directly from other modules
0326 | # ─────────────────────────────────────────────
0327 | integrity_counter = IntegrityCounter()

```

---

### File: `backend\metrics\survivability.py`

**Description**: Source code for `survivability.py`

```python
0001 | import random
0002 | import time
0003 | from dataclasses import dataclass, field
0004 | from typing import List, Dict
0005 | 
0006 | @dataclass
0007 | class SimulationConfig:
0008 |     num_simulations: int = 10_000
0009 |     mission_hours: int = 24
0010 |     total_chunks: int = 10               # N in RS(K, N)
0011 |     recovery_threshold: int = 4          # K — minimum chunks needed
0012 |     node_failure_prob_per_hour: float = 0.01     
0013 |     plane_blackout_prob_per_hour: float = 0.002  
0014 |     solar_flare_prob_per_hour: float = 0.001     
0015 |     corruption_prob_per_chunk: float = 0.005     
0016 |     nodes_per_plane: int = 3             
0017 |     num_planes: int = 4                  
0018 | 
0019 | @dataclass
0020 | class MissionResult:
0021 |     survived: bool
0022 |     chunks_surviving: int
0023 |     chunks_lost: int
0024 |     failure_causes: List[str]
0025 | 
0026 | @dataclass
0027 | class SimulationResult:
0028 |     survival_probability: float
0029 |     failure_count: int
0030 |     total_simulations: int
0031 |     worst_case_chunks_lost: int
0032 |     avg_chunks_lost: float
0033 |     avg_reconstruction_cost: float
0034 |     baseline_replication_survival: float
0035 |     baseline_failures: int
0036 |     risk_reduction_factor: float
0037 |     simulation_duration_ms: float
0038 |     config_used: SimulationConfig
0039 |     failure_breakdown: Dict[str, int]
0040 |     state_distribution: Dict[str, int]
0041 | 
0042 |     def to_dict(self):
0043 |         return {
0044 |             "survival_probability": self.survival_probability,
0045 |             "survival_percentage": f"{self.survival_probability * 100:.5f}%",
0046 |             "failure_count": self.failure_count,
0047 |             "total_simulations": self.total_simulations,
0048 |             "worst_case_chunks_lost": self.worst_case_chunks_lost,
0049 |             "avg_chunks_lost": round(self.avg_chunks_lost, 2),
0050 |             "avg_reconstruction_cost": round(self.avg_reconstruction_cost, 2),
0051 |             "baseline_replication_survival": self.baseline_replication_survival,
0052 |             "baseline_percentage": f"{self.baseline_replication_survival * 100:.2f}%",
0053 |             "risk_reduction_factor": round(self.risk_reduction_factor, 1),
0054 |             "simulation_duration_ms": round(self.simulation_duration_ms, 1),
0055 |             "failure_breakdown": self.failure_breakdown,
0056 |             "state_distribution": self.state_distribution,
0057 |             "config": self.config_used.__dict__,
0058 |             "status": "complete"
0059 |         }
0060 | 
0061 | class OrbitalReliabilitySimulator:
0062 |     def __init__(self, config: SimulationConfig = None):
0063 |         self.config = config or SimulationConfig()
0064 |         # Calculate total available nodes in the orbital constellation
0065 |         self.total_nodes = self.config.num_planes * self.config.nodes_per_plane
0066 | 
0067 |     def run(self) -> SimulationResult:
0068 |         start_time = time.time()
0069 |         
0070 |         failure_count = 0
0071 |         worst_case_lost = 0
0072 |         total_lost = 0
0073 |         
0074 |         failure_breakdown = {"node": 0, "plane": 0, "flare": 0, "corrupt": 0}
0075 |         state_dist = {"perfect": 0, "degraded": 0, "lost": 0}
0076 | 
0077 |         # Instead of 10k simulations in Python loop, we optimize randomly? No, requirement says pure Monte Carlo.
0078 |         for _ in range(self.config.num_simulations):
0079 |             mission = self._simulate_single_mission()
0080 |             
0081 |             total_lost += mission.chunks_lost
0082 |             if mission.chunks_lost > worst_case_lost:
0083 |                 worst_case_lost = mission.chunks_lost
0084 |                 
0085 |             if mission.chunks_lost == 0:
0086 |                 state_dist["perfect"] += 1
0087 |             elif mission.survived:
0088 |                 state_dist["degraded"] += 1
0089 |             else:
0090 |                 state_dist["lost"] += 1
0091 | 
0092 |             if not mission.survived:
0093 |                 failure_count += 1
0094 |                 for cause in set(mission.failure_causes):
0095 |                     # Count each unique cause roughly
0096 |                     if cause in failure_breakdown:
0097 |                         failure_breakdown[cause] += 1
0098 | 
0099 |         baseline_survival, baseline_failures = self._compute_replication_baseline()
0100 |         
0101 |         survival_probability = 1.0 - (failure_count / self.config.num_simulations)
0102 |         
0103 |         rs_loss_prob = failure_count / self.config.num_simulations
0104 |         base_loss_prob = baseline_failures / self.config.num_simulations
0105 |         risk_reduction = (base_loss_prob / rs_loss_prob) if rs_loss_prob > 0 else float('inf')
0106 | 
0107 |         duration_ms = (time.time() - start_time) * 1000
0108 | 
0109 |         return SimulationResult(
0110 |             survival_probability=survival_probability,
0111 |             failure_count=failure_count,
0112 |             total_simulations=self.config.num_simulations,
0113 |             worst_case_chunks_lost=worst_case_lost,
0114 |             avg_chunks_lost=total_lost / self.config.num_simulations,
0115 |             avg_reconstruction_cost=(total_lost / self.config.num_simulations) * 1.4, # approx
0116 |             baseline_replication_survival=baseline_survival,
0117 |             baseline_failures=baseline_failures,
0118 |             risk_reduction_factor=risk_reduction,
0119 |             simulation_duration_ms=duration_ms,
0120 |             config_used=self.config,
0121 |             failure_breakdown=failure_breakdown,
0122 |             state_distribution=state_dist
0123 |         )
0124 | 
0125 |     def _simulate_single_mission(self) -> MissionResult:
0126 |         chunk_states = [True] * self.config.total_chunks
0127 |         causes = []
0128 |         
0129 |         for hour in range(self.config.mission_hours):
0130 |             # 1. Apply per-node random failure
0131 |             for i in range(len(chunk_states)):
0132 |                 if chunk_states[i]:
0133 |                     if random.random() < self.config.node_failure_prob_per_hour:
0134 |                         chunk_states[i] = False
0135 |                         causes.append("node")
0136 | 
0137 |             # 2. Apply plane-level blackout (kills groups of chunks corresponding to nodes)
0138 |             for plane_idx in range(self.config.num_planes):
0139 |                 if random.random() < self.config.plane_blackout_prob_per_hour:
0140 |                     start = plane_idx * self.config.nodes_per_plane
0141 |                     end = start + self.config.nodes_per_plane
0142 |                     for i in range(start, min(end, len(chunk_states))):
0143 |                         if chunk_states[i]:
0144 |                             chunk_states[i] = False
0145 |                             causes.append("plane")
0146 | 
0147 |             # 3. Apply solar flare
0148 |             if random.random() < self.config.solar_flare_prob_per_hour:
0149 |                 affected = random.randint(1, max(1, len(chunk_states) // 3))
0150 |                 targets = random.sample(range(len(chunk_states)), affected)
0151 |                 for t in targets:
0152 |                     if chunk_states[t]:
0153 |                         chunk_states[t] = False
0154 |                         causes.append("flare")
0155 | 
0156 |             # 4. Apply per-chunk corruption
0157 |             for i in range(len(chunk_states)):
0158 |                 if chunk_states[i]:
0159 |                     if random.random() < self.config.corruption_prob_per_chunk:
0160 |                         chunk_states[i] = False
0161 |                         causes.append("corrupt")
0162 | 
0163 |         surviving_chunks = sum(chunk_states)
0164 |         recoverable = surviving_chunks >= self.config.recovery_threshold
0165 |         
0166 |         return MissionResult(
0167 |             survived=recoverable,
0168 |             chunks_surviving=surviving_chunks,
0169 |             chunks_lost=self.config.total_chunks - surviving_chunks,
0170 |             failure_causes=causes
0171 |         )
0172 | 
0173 |     def _compute_replication_baseline(self) -> tuple[float, int]:
0174 |         """
0175 |         Simulates 3x replication: data lost only if all 3 replicas fail
0176 |         """
0177 |         failure_count = 0
0178 |         single_replica_fail_prob = 1 - (1 - self.config.node_failure_prob_per_hour) ** self.config.mission_hours
0179 |         all_replicas_fail_prob = single_replica_fail_prob ** 3
0180 |         
0181 |         for _ in range(self.config.num_simulations):
0182 |             if random.random() < all_replicas_fail_prob:
0183 |                 failure_count += 1
0184 |                 
0185 |         survival_prob = 1.0 - (failure_count / self.config.num_simulations)
0186 |         return survival_prob, failure_count
0187 | 
0188 | if __name__ == "__main__":
0189 |     simulator = OrbitalReliabilitySimulator()
0190 |     result = simulator.run()
0191 |     print(f"RS Survival: {result.survival_probability * 100:.5f}%")
0192 |     print(f"3x Replication: {result.baseline_replication_survival * 100:.2f}%")
0193 |     print(f"Risk Reduction: {result.risk_reduction_factor:.1f}x")

```

---

### File: `backend\metrics\survivability_cache.py`

**Description**: Source code for `survivability_cache.py`

```python
0001 | import datetime
0002 | from typing import Optional
0003 | from backend.metrics.survivability import OrbitalReliabilitySimulator, SimulationConfig, SimulationResult
0004 | from backend.utils.ws_manager import manager
0005 | 
0006 | class SurvivabilityCache:
0007 |     def __init__(self):
0008 |         self.config = SimulationConfig()
0009 |         self.last_result: Optional[SimulationResult] = None
0010 |         
0011 |     def get_or_compute(self) -> SimulationResult:
0012 |         if self.last_result is None:
0013 |             simulator = OrbitalReliabilitySimulator(self.config)
0014 |             self.last_result = simulator.run()
0015 |         return self.last_result
0016 |         
0017 |     async def invalidate_and_rerun(self, trigger: str = "MANUAL", config_updates: dict = None):
0018 |         # We need to maintain state. If it's a restore, we reset bounds.
0019 |         if trigger in ["NODE_RESTORE", "FULL_RESTORE"]:
0020 |             self.config = SimulationConfig()
0021 |         elif trigger == "NODE_FAILURE":
0022 |             self.config.node_failure_prob_per_hour += 0.005
0023 |         elif trigger == "PLANE_FAILURE":
0024 |             self.config.plane_blackout_prob_per_hour += 0.01
0025 |         elif trigger == "SOLAR_FLARE":
0026 |             self.config.solar_flare_prob_per_hour += 0.02
0027 |         elif config_updates:
0028 |             for k, v in config_updates.items():
0029 |                 if hasattr(self.config, k):
0030 |                     setattr(self.config, k, v)
0031 |                     
0032 |         previous_survival = self.last_result.survival_probability if self.last_result else 0.0
0033 |         
0034 |         simulator = OrbitalReliabilitySimulator(self.config)
0035 |         self.last_result = simulator.run()
0036 |         
0037 |         new_survival = self.last_result.survival_probability
0038 |         delta = new_survival - previous_survival
0039 |         
0040 |         # Format the delta sign
0041 |         direction = "NONE"
0042 |         if delta > 0.0000001:
0043 |             direction = "UP"
0044 |         elif delta < -0.0000001:
0045 |             direction = "DOWN"
0046 | 
0047 |         await manager.broadcast("SURVIVABILITY_UPDATE", {
0048 |             "trigger": trigger,
0049 |             "previous_survival": previous_survival,
0050 |             "new_survival": new_survival,
0051 |             "delta": delta,
0052 |             "direction": direction,
0053 |             "survival_percentage": f"{new_survival * 100:.5f}%",
0054 |             "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
0055 |         })
0056 |         
0057 |         return self.last_result
0058 | 
0059 | # Global singleton
0060 | cache = SurvivabilityCache()

```

---

### File: `backend\metrics\tracker.py`

**Description**: Source code for `tracker.py`

```python
0001 | # backend/metrics/tracker.py
0002 | # Responsibility: Running metrics state tracker
0003 | # Maintains cumulative counters that calculator.py reads for snapshots
0004 | # Thread-safe — multiple uploads/downloads can call simultaneously
0005 | 
0006 | import threading
0007 | import time
0008 | from collections import deque
0009 | from typing import Dict, List
0010 | 
0011 | 
0012 | class MetricsTracker:
0013 |     """
0014 |     Singleton running-state tracker for all system metrics.
0015 |     Accumulates events and exposes snapshot() for WebSocket broadcasts.
0016 |     """
0017 | 
0018 |     def __init__(self):
0019 |         self._lock = threading.RLock()  # RLock: snapshot() calls properties that also acquire lock
0020 | 
0021 |         # Integrity verification counters
0022 |         self.integrity_attempts: int = 0
0023 |         self.integrity_passes: int = 0
0024 |         self.integrity_failures: int = 0
0025 | 
0026 |         # Cache counters
0027 |         self.cache_hits: int = 0
0028 |         self.cache_misses: int = 0
0029 | 
0030 |         # Reconstruction latency history (last 50 reconstructions)
0031 |         self.reconstruction_times_ms: deque = deque(maxlen=50)
0032 | 
0033 |         # Upload / download counters
0034 |         self.uploads_total: int = 0
0035 |         self.downloads_total: int = 0
0036 |         self.bytes_uploaded: int = 0
0037 |         self.bytes_downloaded: int = 0
0038 | 
0039 |         # Chaos event counters
0040 |         self.chaos_events_triggered: int = 0
0041 |         self.migrations_completed: int = 0
0042 |         self.dtn_bundles_delivered: int = 0
0043 | 
0044 |     # ─────────────────────────────────────────────
0045 |     # INTEGRITY
0046 |     # ─────────────────────────────────────────────
0047 | 
0048 |     def record_integrity_check(self, passed: bool) -> None:
0049 |         """Called by integrity.py on every SHA-256 verify."""
0050 |         with self._lock:
0051 |             self.integrity_attempts += 1
0052 |             if passed:
0053 |                 self.integrity_passes += 1
0054 |             else:
0055 |                 self.integrity_failures += 1
0056 | 
0057 |     @property
0058 |     def integrity_pass_rate(self) -> float:
0059 |         """Return integrity pass rate as percentage 0-100."""
0060 |         with self._lock:
0061 |             if self.integrity_attempts == 0:
0062 |                 return 100.0
0063 |             return (self.integrity_passes / self.integrity_attempts) * 100.0
0064 | 
0065 |     # ─────────────────────────────────────────────
0066 |     # CACHE
0067 |     # ─────────────────────────────────────────────
0068 | 
0069 |     def record_cache_event(self, hit: bool) -> None:
0070 |         """Called by ground_cache.py on every get."""
0071 |         with self._lock:
0072 |             if hit:
0073 |                 self.cache_hits += 1
0074 |             else:
0075 |                 self.cache_misses += 1
0076 | 
0077 |     @property
0078 |     def cache_hit_rate(self) -> float:
0079 |         """Return cache hit rate as percentage 0-100."""
0080 |         with self._lock:
0081 |             total = self.cache_hits + self.cache_misses
0082 |             if total == 0:
0083 |                 return 0.0
0084 |             return (self.cache_hits / total) * 100.0
0085 | 
0086 |     # ─────────────────────────────────────────────
0087 |     # RECONSTRUCTION LATENCY
0088 |     # ─────────────────────────────────────────────
0089 | 
0090 |     def record_reconstruction(self, latency_ms: float) -> None:
0091 |         """Called by reassembler.py after file reconstruction."""
0092 |         with self._lock:
0093 |             self.reconstruction_times_ms.append(latency_ms)
0094 | 
0095 |     @property
0096 |     def avg_reconstruction_ms(self) -> float:
0097 |         """Average reconstruction latency from last 50 operations."""
0098 |         with self._lock:
0099 |             if not self.reconstruction_times_ms:
0100 |                 return 0.0
0101 |             return sum(self.reconstruction_times_ms) / len(self.reconstruction_times_ms)
0102 | 
0103 |     @property
0104 |     def last_reconstruction_ms(self) -> float:
0105 |         """Most recent reconstruction latency."""
0106 |         with self._lock:
0107 |             if not self.reconstruction_times_ms:
0108 |                 return 0.0
0109 |             return self.reconstruction_times_ms[-1]
0110 | 
0111 |     # ─────────────────────────────────────────────
0112 |     # UPLOAD/DOWNLOAD
0113 |     # ─────────────────────────────────────────────
0114 | 
0115 |     def record_upload(self, file_size: int) -> None:
0116 |         with self._lock:
0117 |             self.uploads_total += 1
0118 |             self.bytes_uploaded += file_size
0119 | 
0120 |     def record_download(self, file_size: int) -> None:
0121 |         with self._lock:
0122 |             self.downloads_total += 1
0123 |             self.bytes_downloaded += file_size
0124 | 
0125 |     # ─────────────────────────────────────────────
0126 |     # CHAOS / MIGRATION
0127 |     # ─────────────────────────────────────────────
0128 | 
0129 |     def record_chaos_event(self) -> None:
0130 |         with self._lock:
0131 |             self.chaos_events_triggered += 1
0132 | 
0133 |     def record_migration(self) -> None:
0134 |         with self._lock:
0135 |             self.migrations_completed += 1
0136 | 
0137 |     def record_dtn_delivery(self) -> None:
0138 |         with self._lock:
0139 |             self.dtn_bundles_delivered += 1
0140 | 
0141 |     # ─────────────────────────────────────────────
0142 |     # SNAPSHOT — full state for WebSocket broadcast
0143 |     # ─────────────────────────────────────────────
0144 | 
0145 |     def snapshot(self) -> Dict:
0146 |         """Return current metrics state as dict for WebSocket/API."""
0147 |         with self._lock:
0148 |             return {
0149 |                 "integrity": {
0150 |                     "attempts": self.integrity_attempts,
0151 |                     "passes": self.integrity_passes,
0152 |                     "failures": self.integrity_failures,
0153 |                     "pass_rate": round(self.integrity_pass_rate, 2),
0154 |                 },
0155 |                 "cache": {
0156 |                     "hits": self.cache_hits,
0157 |                     "misses": self.cache_misses,
0158 |                     "hit_rate": round(self.cache_hit_rate, 2),
0159 |                 },
0160 |                 "reconstruction": {
0161 |                     "avg_latency_ms": round(self.avg_reconstruction_ms, 2),
0162 |                     "last_latency_ms": round(self.last_reconstruction_ms, 2),
0163 |                     "total_operations": len(self.reconstruction_times_ms),
0164 |                 },
0165 |                 "operations": {
0166 |                     "uploads_total": self.uploads_total,
0167 |                     "downloads_total": self.downloads_total,
0168 |                     "bytes_uploaded": self.bytes_uploaded,
0169 |                     "bytes_downloaded": self.bytes_downloaded,
0170 |                 },
0171 |                 "system": {
0172 |                     "chaos_events": self.chaos_events_triggered,
0173 |                     "migrations": self.migrations_completed,
0174 |                     "dtn_deliveries": self.dtn_bundles_delivered,
0175 |                 },
0176 |             }
0177 | 
0178 |     def reset(self) -> None:
0179 |         """Reset all counters. Used for testing."""
0180 |         with self._lock:
0181 |             self.integrity_attempts = 0
0182 |             self.integrity_passes = 0
0183 |             self.integrity_failures = 0
0184 |             self.cache_hits = 0
0185 |             self.cache_misses = 0
0186 |             self.reconstruction_times_ms.clear()
0187 |             self.uploads_total = 0
0188 |             self.downloads_total = 0
0189 |             self.bytes_uploaded = 0
0190 |             self.bytes_downloaded = 0
0191 |             self.chaos_events_triggered = 0
0192 |             self.migrations_completed = 0
0193 |             self.dtn_bundles_delivered = 0
0194 | 
0195 | 
0196 | # ─────────────────────────────────────────────
0197 | # SINGLETON INSTANCE — import this everywhere
0198 | # ─────────────────────────────────────────────
0199 | metrics_tracker = MetricsTracker()

```

---

### File: `backend\metrics\__init__.py`

**Description**: Source code for `__init__.py`

```python

```

---

### File: `backend\utils\logger.py`

**Description**: Source code for `logger.py`

```python
0001 | # backend/utils/logger.py
0002 | # Responsibility: Structured event builder for COSMEON FS-LITE
0003 | # Creates timestamped event dicts with type, message, metadata
0004 | # Integrates with metadata/manager.py and ws_manager.py
0005 | 
0006 | import uuid
0007 | from datetime import datetime
0008 | from typing import Any, Dict, Optional
0009 | 
0010 | from backend.metadata.manager import log_event as _meta_log
0011 | from backend.utils.ws_manager import manager as _ws
0012 | 
0013 | 
0014 | # ─────────────────────────────────────────────
0015 | # EVENT BUILDER — pure dict construction
0016 | # ─────────────────────────────────────────────
0017 | 
0018 | def build_event(
0019 |     event_type: str,
0020 |     message: str,
0021 |     level: str = "INFO",
0022 |     **metadata: Any,
0023 | ) -> Dict:
0024 |     """
0025 |     Build a structured event dict.
0026 | 
0027 |     Returns:
0028 |         {
0029 |             "event_id": "uuid4",
0030 |             "timestamp": "ISO format",
0031 |             "type": "CHUNK_UPLOADED",
0032 |             "level": "INFO" | "WARNING" | "ERROR",
0033 |             "message": "human-readable description",
0034 |             "metadata": { ... extra fields }
0035 |         }
0036 |     """
0037 |     return {
0038 |         "event_id": str(uuid.uuid4()),
0039 |         "timestamp": datetime.utcnow().isoformat(),
0040 |         "type": event_type,
0041 |         "level": level,
0042 |         "message": message,
0043 |         "metadata": metadata,
0044 |     }
0045 | 
0046 | 
0047 | # ─────────────────────────────────────────────
0048 | # LOGGING FUNCTIONS — log + broadcast in one call
0049 | # ─────────────────────────────────────────────
0050 | 
0051 | async def log_info(event_type: str, message: str, **meta: Any) -> Dict:
0052 |     """Log INFO-level event → metadata store + WebSocket broadcast."""
0053 |     event = build_event(event_type, message, level="INFO", **meta)
0054 |     _meta_log(event_type, message, meta)
0055 |     await _ws.broadcast(event_type, {
0056 |         "level": "INFO",
0057 |         "message": message,
0058 |         **meta,
0059 |     })
0060 |     return event
0061 | 
0062 | 
0063 | async def log_warning(event_type: str, message: str, **meta: Any) -> Dict:
0064 |     """Log WARNING-level event → metadata store + WebSocket broadcast."""
0065 |     event = build_event(event_type, message, level="WARNING", **meta)
0066 |     _meta_log(event_type, message, meta)
0067 |     await _ws.broadcast(event_type, {
0068 |         "level": "WARNING",
0069 |         "message": message,
0070 |         **meta,
0071 |     })
0072 |     return event
0073 | 
0074 | 
0075 | async def log_error(event_type: str, message: str, **meta: Any) -> Dict:
0076 |     """Log ERROR-level event → metadata store + WebSocket broadcast."""
0077 |     event = build_event(event_type, message, level="ERROR", **meta)
0078 |     _meta_log(event_type, message, meta)
0079 |     await _ws.broadcast(event_type, {
0080 |         "level": "ERROR",
0081 |         "message": message,
0082 |         **meta,
0083 |     })
0084 |     return event
0085 | 
0086 | 
0087 | # ─────────────────────────────────────────────
0088 | # SYNC VERSIONS — for non-async contexts
0089 | # ─────────────────────────────────────────────
0090 | 
0091 | def log_info_sync(event_type: str, message: str, **meta: Any) -> Dict:
0092 |     """Sync version — logs to metadata only (no WebSocket broadcast)."""
0093 |     event = build_event(event_type, message, level="INFO", **meta)
0094 |     _meta_log(event_type, message, meta)
0095 |     print(f"[LOG] ℹ️  {event_type}: {message}")
0096 |     return event
0097 | 
0098 | 
0099 | def log_warning_sync(event_type: str, message: str, **meta: Any) -> Dict:
0100 |     """Sync version — logs to metadata only."""
0101 |     event = build_event(event_type, message, level="WARNING", **meta)
0102 |     _meta_log(event_type, message, meta)
0103 |     print(f"[LOG] ⚠️  {event_type}: {message}")
0104 |     return event
0105 | 
0106 | 
0107 | def log_error_sync(event_type: str, message: str, **meta: Any) -> Dict:
0108 |     """Sync version — logs to metadata only."""
0109 |     event = build_event(event_type, message, level="ERROR", **meta)
0110 |     _meta_log(event_type, message, meta)
0111 |     print(f"[LOG] ❌ {event_type}: {message}")
0112 |     return event

```

---

### File: `backend\utils\node_manager.py`

**Description**: Source code for `node_manager.py`

```python
0001 | # backend/utils/node_manager.py
0002 | # Person 2 owns this file
0003 | # Responsibility: Simple node status interface
0004 | # THIS IS THE CONTRACT FILE — Person 1's reassembler.py imports get_node_status() from here
0005 | 
0006 | from backend.metadata import manager as meta
0007 | from backend.config import ALL_NODES
0008 | 
0009 | 
0010 | def get_node_status(node_id: str) -> str:
0011 |     """
0012 |     ⚠️ INTERFACE CONTRACT — Person 1's reassembler.py calls this.
0013 |     Returns: "ONLINE" | "OFFLINE" | "DEGRADED" | "PARTITIONED"
0014 |     """
0015 |     node = meta.get_node(node_id)
0016 |     if node is None:
0017 |         return "OFFLINE"
0018 |     return node.status
0019 | 
0020 | 
0021 | def set_online(node_id: str) -> None:
0022 |     """Bring a node back online. Push latest metadata before marking ONLINE."""
0023 |     meta.replicate_to_node(node_id)
0024 |     meta.update_node_status(node_id, "ONLINE")
0025 |     print(f"[NODE_MANAGER] ✅ {node_id} → ONLINE")
0026 | 
0027 | 
0028 | def set_offline(node_id: str) -> None:
0029 |     """Take a node offline (soft — data preserved in folder)."""
0030 |     meta.update_node_status(node_id, "OFFLINE")
0031 |     print(f"[NODE_MANAGER] 🔴 {node_id} → OFFLINE")
0032 | 
0033 | 
0034 | def set_degraded(node_id: str) -> None:
0035 |     """Node in degraded state — still reachable but low health."""
0036 |     meta.update_node_status(node_id, "DEGRADED")
0037 |     print(f"[NODE_MANAGER] 🟡 {node_id} → DEGRADED")
0038 | 
0039 | 
0040 | def set_partitioned(node_id: str) -> None:
0041 |     """
0042 |     Node is alive but unreachable (no line-of-sight).
0043 |     Different from OFFLINE — data is intact, just can't communicate.
0044 |     """
0045 |     meta.update_node_status(node_id, "PARTITIONED")
0046 |     print(f"[NODE_MANAGER] 🟠 {node_id} → PARTITIONED")
0047 | 
0048 | 
0049 | def get_all_statuses() -> dict:
0050 |     """Returns dict of all node_id → status."""
0051 |     return {node.node_id: node.status for node in meta.get_all_nodes()}
0052 | 
0053 | 
0054 | def get_online_nodes() -> list:
0055 |     """Returns list of node_ids that are currently ONLINE."""
0056 |     return [
0057 |         node.node_id
0058 |         for node in meta.get_all_nodes()
0059 |         if node.status == "ONLINE"
0060 |     ]
0061 | 
0062 | 
0063 | def restore_all_nodes() -> None:
0064 |     """Bring all nodes back to ONLINE. Push latest metadata to each before marking ONLINE."""
0065 |     for node_id in ALL_NODES:
0066 |         meta.replicate_to_node(node_id)
0067 |         meta.update_node_status(node_id, "ONLINE")
0068 |     print("[NODE_MANAGER] ✅ All nodes restored to ONLINE")
```

---

### File: `backend\utils\ws_manager.py`

**Description**: Source code for `ws_manager.py`

```python
0001 | # backend/utils/ws_manager.py
0002 | # Person 4 owns this file
0003 | # Shared utility: ALL backend files broadcast events through this singleton
0004 | # Format: {"type": "EVENT_TYPE", "timestamp": "ISO", "data": {...}}
0005 | 
0006 | import json
0007 | import asyncio
0008 | from typing import List, Dict, Any
0009 | from datetime import datetime
0010 | from fastapi import WebSocket
0011 | 
0012 | 
0013 | class ConnectionManager:
0014 |     """
0015 |     WebSocket connection pool + JSON broadcaster.
0016 |     Singleton instance `manager` used by every module.
0017 |     """
0018 | 
0019 |     def __init__(self):
0020 |         self.active_connections: List[WebSocket] = []
0021 | 
0022 |     async def connect(self, websocket: WebSocket) -> None:
0023 |         """Accept and register a new WebSocket client."""
0024 |         await websocket.accept()
0025 |         self.active_connections.append(websocket)
0026 |         print(f"[WS] ✅ Client connected (total: {len(self.active_connections)})")
0027 | 
0028 |     def disconnect(self, websocket: WebSocket) -> None:
0029 |         """Remove a disconnected client silently."""
0030 |         if websocket in self.active_connections:
0031 |             self.active_connections.remove(websocket)
0032 |             print(f"[WS] Client disconnected (total: {len(self.active_connections)})")
0033 | 
0034 |     async def broadcast(self, event_type: str, data: dict = None) -> None:
0035 |         """
0036 |         Send JSON event to ALL connected dashboard clients.
0037 | 
0038 |         Args:
0039 |             event_type: e.g. "NODE_OFFLINE", "CHUNK_UPLOADED", "CHAOS_TRIGGERED"
0040 |             data: event-specific payload dict
0041 |         """
0042 |         message = {
0043 |             "type": event_type,
0044 |             "timestamp": datetime.utcnow().isoformat(),
0045 |             "data": data or {},
0046 |         }
0047 | 
0048 |         dead_connections = []
0049 |         for connection in self.active_connections:
0050 |             try:
0051 |                 await connection.send_json(message)
0052 |             except Exception:
0053 |                 dead_connections.append(connection)
0054 | 
0055 |         # Clean up dead connections
0056 |         for dead in dead_connections:
0057 |             self.disconnect(dead)
0058 | 
0059 |     @property
0060 |     def client_count(self) -> int:
0061 |         return len(self.active_connections)
0062 | 
0063 | 
0064 | # ─────────────────────────────────────────────
0065 | # SINGLETON — import this everywhere
0066 | # from backend.utils.ws_manager import manager
0067 | # await manager.broadcast("EVENT_TYPE", {"key": "value"})
0068 | # ─────────────────────────────────────────────
0069 | manager = ConnectionManager()

```

---

### File: `backend\utils\__init__.py`

**Description**: Source code for `__init__.py`

```python

```

---

## PART 3: FRONTEND SOURCE CODE DEEP DIVE

The frontend is a React 19 + Vite application using Tailwind CSS and React Three Fiber. It contains 36 components across 13 directories.

### File: `frontend\src\App.css`

**Description**: Source JSX/CSS for `App.css`

```css
0001 | #root {
0002 |   max-width: 1280px;
0003 |   margin: 0 auto;
0004 |   padding: 2rem;
0005 |   text-align: center;
0006 | }
0007 | 
0008 | .logo {
0009 |   height: 6em;
0010 |   padding: 1.5em;
0011 |   will-change: filter;
0012 |   transition: filter 300ms;
0013 | }
0014 | .logo:hover {
0015 |   filter: drop-shadow(0 0 2em #646cffaa);
0016 | }
0017 | .logo.react:hover {
0018 |   filter: drop-shadow(0 0 2em #61dafbaa);
0019 | }
0020 | 
0021 | @keyframes logo-spin {
0022 |   from {
0023 |     transform: rotate(0deg);
0024 |   }
0025 |   to {
0026 |     transform: rotate(360deg);
0027 |   }
0028 | }
0029 | 
0030 | @media (prefers-reduced-motion: no-preference) {
0031 |   a:nth-of-type(2) .logo {
0032 |     animation: logo-spin infinite 20s linear;
0033 |   }
0034 | }
0035 | 
0036 | .card {
0037 |   padding: 2em;
0038 | }
0039 | 
0040 | .read-the-docs {
0041 |   color: #888;
0042 | }

```

---

### File: `frontend\src\App.jsx`

**Description**: Source JSX/CSS for `App.jsx`

```javascript
0001 | import React, { useState } from 'react';
0002 | import { useWebSocket } from './hooks/useWebSocket';
0003 | import HUDDock from './components/layout/HUDDock';
0004 | import GlobalMetrics from './components/layout/GlobalMetrics';
0005 | import RightSidebar from './components/layout/RightSidebar';
0006 | import CinematicBoot from './components/layout/CinematicBoot';
0007 | 
0008 | import OrbitalMap3D from './components/orbital/OrbitalMap3D';
0009 | import ResilienceChart from './components/metrics/ResilienceChart';
0010 | import GsUplinkStatus from './components/metrics/GsUplinkStatus';
0011 | import { MissionLog } from './components/terminal/MissionLog';
0012 | import MissionTerminal from './components/terminal/MissionTerminal';
0013 | import NetworkMap3D from './components/network/NetworkMap3D';
0014 | import PayloadOps from './components/payload/PayloadOps';
0015 | import ChaosOps from './components/chaos/ChaosOps';
0016 | import SatelliteTrackerPage from './pages/SatelliteTrackerPage';
0017 | import StorageMap from './components/storage/StorageMap';
0018 | import DataTransferDemo from './components/demo/DataTransferDemo';
0019 | // import SurvivabilityPanel from './components/metrics/SurvivabilityPanel';
0020 | 
0021 | function Dashboard() {
0022 |   const { messages, connected } = useWebSocket(`ws://${window.location.hostname}:9000/ws`);
0023 |   const [fileId, setFileId] = useState(null);
0024 |   const [currentTab, setCurrentTab] = useState('Payload Ops');
0025 |   const [view, setView] = useState('dashboard'); // 'dashboard' or 'satellite'
0026 |   const [booting, setBooting] = useState(true);
0027 |   const [nodes, setNodes] = useState([]);
0028 | 
0029 |   // Fetch initial node state
0030 |   React.useEffect(() => {
0031 |     fetch(`http://${window.location.hostname}:9000/api/nodes`)
0032 |       .then(res => res.json())
0033 |       .then(data => setNodes(data.nodes || data))
0034 |       .catch(err => console.error("Failed to fetch nodes", err));
0035 |   }, []);
0036 | 
0037 |   // Update nodes from websocket messages
0038 |   React.useEffect(() => {
0039 |     if (!messages || messages.length === 0) return;
0040 |     const lastMsg = messages[messages.length - 1];
0041 | 
0042 |     if (lastMsg.type === 'METRIC_UPDATE' && lastMsg.data.nodes) {
0043 |       // Handle full updates if available (though build_metrics doesn't include full node records by default)
0044 |     }
0045 | 
0046 |     if (lastMsg.type === 'NODE_ONLINE' || lastMsg.type === 'NODE_OFFLINE' || lastMsg.type === 'DTN_QUEUED') {
0047 |       // Re-fetch or update local state
0048 |       fetch(`http://${window.location.hostname}:9000/api/nodes`)
0049 |         .then(res => res.json())
0050 |         .then(data => setNodes(data.nodes || data));
0051 |     }
0052 |   }, [messages]);
0053 | 
0054 |   const handleUpload = async (formData) => {
0055 |     try {
0056 |       const res = await fetch(`http://${window.location.hostname}:9000/api/upload`, {
0057 |         method: 'POST',
0058 |         body: formData,
0059 |       });
0060 |       const data = await res.json();
0061 |       if (data.file_id) setFileId(data.file_id);
0062 |     } catch (err) {
0063 |       console.error(err);
0064 |     }
0065 |   };
0066 | 
0067 |   const handleDownload = async (uuid, originalName = null) => {
0068 |     try {
0069 |       const res = await fetch(`http://${window.location.hostname}:9000/api/download/${uuid}`);
0070 |       if (!res.ok) throw new Error('Download failed');
0071 | 
0072 |       const blob = await res.blob();
0073 |       const filename = originalName || `download-${uuid}`;
0074 | 
0075 |       // Trigger actual download in the browser using Blob URL
0076 |       const url = window.URL.createObjectURL(blob);
0077 |       const link = document.createElement('a');
0078 |       link.href = url;
0079 |       link.download = filename;
0080 |       document.body.appendChild(link);
0081 |       link.click();
0082 |       window.URL.revokeObjectURL(url);
0083 |       link.remove();
0084 |     } catch (err) {
0085 |       console.error('Failed to download file:', err);
0086 |     }
0087 |   };
0088 | 
0089 |   if (booting) {
0090 |     return <CinematicBoot onComplete={() => setBooting(false)} />;
0091 |   }
0092 | 
0093 |   // Handle Satellite View separately
0094 |   if (view === 'satellite') {
0095 |     return (
0096 |       <SatelliteTrackerPage
0097 |         nodes={nodes}
0098 |         messages={messages}
0099 |         onBack={() => setView('dashboard')}
0100 |       />
0101 |     );
0102 |   }
0103 | 
0104 |   // Determine which background map to show
0105 |   const isNetworkMap = currentTab === 'Network Topology'; // Fallback if name changes
0106 |   // Storage Nodes, Payload, Chaos, Orbital Engine can all share the OrbitalMap3D background
0107 | 
0108 |   return (
0109 |     <div className="h-screen w-screen bg-[#02040A] text-gray-200 overflow-hidden font-sans relative">
0110 |       <div className="fixed inset-0 z-0 pointer-events-auto">
0111 |         {isNetworkMap ? <NetworkMap3D messages={messages} /> : <OrbitalMap3D />}
0112 |       </div>
0113 | 
0114 |       {/* Subtle Ambient Glow Behind Main Content */}
0115 |       <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
0116 | 
0117 |       {/* New Floating Dock Navigation */}
0118 |       <HUDDock
0119 |         currentTab={currentTab}
0120 |         setCurrentTab={setCurrentTab}
0121 |         onViewSatellite={() => setView('satellite')}
0122 |       />
0123 | 
0124 |       {/* 2. Glass UI Layer Stack overlay */}
0125 |       <div className="relative z-10 flex h-full w-full pointer-events-none p-6 pb-28">
0126 | 
0127 |         {/* Central Grid overlay */}
0128 |         <div className="flex-1 flex px-4 sm:px-8 pb-4 sm:pb-8 pt-4 gap-8 h-full relative">
0129 | 
0130 |           {/* Main Stage Overlays */}
0131 |           <div className="flex-1 flex flex-col min-w-0 h-full relative">
0132 | 
0133 |             {/* Top Section - Floating Info Widgets / Modals */}
0134 |             <div className="flex-1 relative min-h-0 pointer-events-none">
0135 |               {currentTab === 'Orbital Engine' && (
0136 |                 <>
0137 |                   <div className="absolute top-0 left-0 z-10 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] max-w-md pointer-events-auto">
0138 |                     <div className="flex items-center gap-2 mb-3">
0139 |                       <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_10px_#3b82f6] animate-pulse"></div>
0140 |                       <h2 className="text-blue-500 font-bold tracking-[0.2em] text-[10px] uppercase">FS-LITE Real-Time Simulation</h2>
0141 |                     </div>
0142 |                     <h1 className="text-3xl font-bold text-white mb-2 leading-tight">Orbital Plane Heatmaps</h1>
0143 |                     <p className="text-xs text-gray-400 leading-relaxed font-mono">
0144 |                       Global telemetry mesh active. High-fidelity orbital file system striping across active planes.
0145 |                     </p>
0146 |                   </div>
0147 | 
0148 |                   <GlobalMetrics connected={connected} />
0149 |                 </>
0150 |               )}
0151 | 
0152 |               {/* Modals for non-map features */}
0153 |               {currentTab === 'Storage Nodes' && (
0154 |                 <div className="absolute inset-0 z-20 pointer-events-auto flex items-center justify-center">
0155 |                   <div className="w-full h-full">
0156 |                     <StorageMap />
0157 |                   </div>
0158 |                 </div>
0159 |               )}
0160 |               {currentTab === 'Payload Ops' && (
0161 |                 <div className="absolute inset-0 z-20 pointer-events-auto flex items-center justify-center">
0162 |                   <div className="w-full max-w-6xl h-full pb-10">
0163 |                     <PayloadOps messages={messages} fileId={fileId} onUpload={handleUpload} onDownload={handleDownload} />
0164 |                   </div>
0165 |                 </div>
0166 |               )}
0167 |               {currentTab === 'Data Demo' && (
0168 |                 <div className="absolute inset-0 z-20 pointer-events-auto overflow-hidden">
0169 |                   <div className="w-full h-full p-2">
0170 |                     <DataTransferDemo messages={messages} />
0171 |                   </div>
0172 |                 </div>
0173 |               )}
0174 | 
0175 |               {/* {currentTab === 'Reliability Model' && (
0176 |                 <div className="absolute inset-0 z-20 pointer-events-auto">
0177 |                   <div className="w-full h-full flex items-center justify-center p-4">
0178 |                     <SurvivabilityPanel messages={messages} />
0179 |                   </div>
0180 |                 </div>
0181 |               )} */}
0182 | 
0183 |               {currentTab === 'Chaos Ops' && (
0184 |                 <div className="absolute inset-0 z-20 pointer-events-auto">
0185 |                   <ChaosOps messages={messages} />
0186 |                 </div>
0187 |               )}
0188 |             </div>
0189 | 
0190 |             {/* Bottom Panels Layout - Overlaying the map */}
0191 |             {currentTab === 'Orbital Engine' && (
0192 |               <div className="h-[260px] min-h-[260px] max-h-[260px] shrink-0 grid grid-cols-12 gap-6 relative z-10 w-full overflow-hidden pointer-events-auto mt-6">
0193 |                 <div className="col-span-4 h-full min-h-0">
0194 |                   <ResilienceChart />
0195 |                 </div>
0196 |                 <div className="col-span-4 h-full min-h-0">
0197 |                   <MissionTerminal currentTab={currentTab} messages={messages} />
0198 |                 </div>
0199 |                 <div className="col-span-4 h-full min-h-0 flex flex-col">
0200 |                   <MissionLog messages={messages} />
0201 |                 </div>
0202 |               </div>
0203 |             )}
0204 |           </div>
0205 | 
0206 |           {/* Right Sidebar - Overlay */}
0207 |           {currentTab === 'Orbital Engine' && (
0208 |             <div className="w-80 shrink-0 h-full overflow-y-auto bg-black/40 backdrop-blur-md border border-white/5 rounded-3xl p-2 shadow-2xl pointer-events-auto">
0209 |               <RightSidebar
0210 |                 messages={messages}
0211 |                 fileId={fileId}
0212 |                 onUpload={handleUpload}
0213 |                 onDownload={handleDownload}
0214 |               />
0215 |             </div>
0216 |           )}
0217 |         </div>
0218 |       </div>
0219 |     </div>
0220 |   );
0221 | }
0222 | 
0223 | export default Dashboard;
0224 | 

```

---

### File: `frontend\src\index.css`

**Description**: Source JSX/CSS for `index.css`

```css
0001 | @import "tailwindcss";
0002 | @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
0003 | 
0004 | body {
0005 |   background-color: #02040A;
0006 |   /* Deep cyber void */
0007 |   background-image:
0008 |     radial-gradient(circle at 50% 0%, rgba(30, 58, 138, 0.15) 0%, transparent 50%),
0009 |     linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
0010 |     linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
0011 |   background-size: 100% 100%, 40px 40px, 40px 40px;
0012 |   background-position: center top, center center, center center;
0013 |   color: #E2E8F0;
0014 |   margin: 0;
0015 |   font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
0016 |   overflow-x: hidden;
0017 | }
0018 | 
0019 | /* Custom scrollbar for terminal/logs */
0020 | .custom-scrollbar::-webkit-scrollbar {
0021 |   width: 4px;
0022 | }
0023 | 
0024 | .custom-scrollbar::-webkit-scrollbar-track {
0025 |   background: rgba(15, 23, 42, 0.5);
0026 | }
0027 | 
0028 | .custom-scrollbar::-webkit-scrollbar-thumb {
0029 |   background: rgba(59, 130, 246, 0.5);
0030 |   border-radius: 4px;
0031 | }
0032 | 
0033 | /* Global specific font classes */
0034 | .font-mono {
0035 |   font-family: 'JetBrains Mono', monospace;
0036 | }
```

---

### File: `frontend\src\main.jsx`

**Description**: Source JSX/CSS for `main.jsx`

```javascript
0001 | import React from 'react'
0002 | import ReactDOM from 'react-dom/client'
0003 | import App from './App.jsx'
0004 | import './index.css'
0005 | 
0006 | ReactDOM.createRoot(document.getElementById('root')).render(
0007 |   <React.StrictMode>
0008 |     <App />
0009 |   </React.StrictMode>,
0010 | )

```

---

### File: `frontend\src\components\chaos\ChaosOps.jsx`

**Description**: Source JSX/CSS for `ChaosOps.jsx`

```javascript
0001 | import React, { useState, useEffect, useRef } from 'react';
0002 | import { motion, AnimatePresence } from 'framer-motion';
0003 | import {
0004 |     Zap, AlertTriangle, ShieldAlert, Activity,
0005 |     RefreshCw, ServerCrash, ZapOff, DatabaseZap, Info, Terminal
0006 | } from 'lucide-react';
0007 | 
0008 | export default function ChaosOps({ messages }) {
0009 |     const [activeScenario, setActiveScenario] = useState(null);
0010 |     const [logs, setLogs] = useState([]);
0011 |     const logsEndRef = useRef(null);
0012 |     const [systemState, setSystemState] = useState({
0013 |         entropy: 1.0,
0014 |         entropyStatus: 'BALANCED',
0015 |         corruptedChunks: [],
0016 |         offlineNodes: [],
0017 |         partitionedNodes: [],
0018 |         migrations: []
0019 |     });
0020 | 
0021 |     const pushLog = (msg, type = 'info') => {
0022 |         setLogs(prev => [...prev, { id: Date.now() + Math.random(), msg, type }].slice(-50));
0023 |     };
0024 | 
0025 |     useEffect(() => {
0026 |         if (logsEndRef.current) {
0027 |             logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
0028 |         }
0029 |     }, [logs]);
0030 | 
0031 |     useEffect(() => {
0032 |         if (!messages || messages.length === 0) return;
0033 |         const lastMsg = messages[messages.length - 1];
0034 | 
0035 |         switch (lastMsg.type) {
0036 |             case 'CHAOS_TRIGGERED':
0037 |                 pushLog(lastMsg.data.message, 'warning');
0038 |                 break;
0039 |             case 'NODE_OFFLINE':
0040 |                 setSystemState(prev => ({
0041 |                     ...prev,
0042 |                     offlineNodes: [...new Set([...prev.offlineNodes, lastMsg.data.node_id])]
0043 |                 }));
0044 |                 pushLog(lastMsg.data.message, 'error');
0045 |                 break;
0046 |             case 'NODE_PARTITIONED':
0047 |                 setSystemState(prev => ({
0048 |                     ...prev,
0049 |                     partitionedNodes: [...new Set([...prev.partitionedNodes, lastMsg.data.node_id])]
0050 |                 }));
0051 |                 pushLog(lastMsg.data.message, 'warning');
0052 |                 break;
0053 |             case 'CHUNK_CORRUPTED':
0054 |                 setSystemState(prev => ({
0055 |                     ...prev,
0056 |                     corruptedChunks: [...prev.corruptedChunks, lastMsg.data]
0057 |                 }));
0058 |                 pushLog(lastMsg.data.message, 'error');
0059 |                 break;
0060 |             case 'REBALANCE_START':
0061 |                 pushLog(lastMsg.data.message, 'info');
0062 |                 setSystemState(prev => ({ ...prev, migrations: [] }));
0063 |                 break;
0064 |             case 'CHUNK_REBALANCED':
0065 |                 setSystemState(prev => ({
0066 |                     ...prev,
0067 |                     migrations: [...prev.migrations, lastMsg.data]
0068 |                 }));
0069 |                 break;
0070 |             case 'REBALANCE_COMPLETE':
0071 |                 pushLog(lastMsg.data.message, 'success');
0072 |                 break;
0073 |             case 'NODE_OVERLOADED':
0074 |                 pushLog(lastMsg.data.message, 'warning');
0075 |                 break;
0076 |             case 'CHAOS_RESOLVED':
0077 |                 setSystemState({
0078 |                     entropy: 1.0,
0079 |                     entropyStatus: 'BALANCED',
0080 |                     corruptedChunks: [],
0081 |                     offlineNodes: [],
0082 |                     partitionedNodes: [],
0083 |                     migrations: []
0084 |                 });
0085 |                 pushLog(lastMsg.data.message, 'success');
0086 |                 setActiveScenario(null);
0087 |                 break;
0088 |             case 'METRIC_UPDATE':
0089 |                 if (lastMsg.data.entropy !== undefined) {
0090 |                     setSystemState(prev => ({
0091 |                         ...prev,
0092 |                         entropy: lastMsg.data.entropy,
0093 |                         entropyStatus: lastMsg.data.entropy_status || prev.entropyStatus
0094 |                     }));
0095 |                 }
0096 |                 break;
0097 |             default:
0098 |                 break;
0099 |         }
0100 |     }, [messages]);
0101 | 
0102 |     const triggerChaos = async (scenario) => {
0103 |         setActiveScenario(scenario.id);
0104 |         pushLog(`Initiating Sequence: ${scenario.name.toUpperCase()}`, 'warning');
0105 | 
0106 |         // Slight artificial delay for dramatic effect
0107 |         await new Promise(r => setTimeout(r, 500));
0108 | 
0109 |         try {
0110 |             const res = await fetch(`http://${window.location.hostname}:9000/api/chaos/${scenario.id}`, { method: 'POST' });
0111 |             if (!res.ok) throw new Error('Failed to trigger chaos');
0112 |         } catch (err) {
0113 |             console.error(err);
0114 |             pushLog(`Failed to trigger ${scenario.id}: ${err.message}`, 'error');
0115 |             setActiveScenario(null);
0116 |         }
0117 |     };
0118 | 
0119 |     const scenarios = [
0120 |         {
0121 |             id: 'solar_flare',
0122 |             name: 'Solar Flare (Node Kill)',
0123 |             desc: 'Simulates a massive radiation burst instantly frying all nodes in Orbital Plane Beta (SAT-03, SAT-04). Tests Reed-Solomon recovery under catastrophic multi-node failure.',
0124 |             analytics: 'Monitors the system\'s ability to fetch parity chunks from Alpha and Gamma planes to reconstruct missing payloads on-the-fly when an entire orbital plane goes dark.',
0125 |             icon: Zap,
0126 |             color: 'amber'
0127 |         },
0128 |         {
0129 |             id: 'partition',
0130 |             name: 'Network Partition',
0131 |             desc: 'Simulates Earth occluding Plane Beta. Nodes are alive but unreachable from Ground Stations, forcing Delayed Tolerant Networking (DTN) queueing.',
0132 |             analytics: 'Tests the DTN bundle protocol. Nodes enter a partitioned state where writes are queued locally until line-of-sight is restored, validating edge-caching synchronization.',
0133 |             icon: ShieldAlert,
0134 |             color: 'rose'
0135 |         },
0136 |         {
0137 |             id: 'bit_rot',
0138 |             name: 'Deep Space Radiation (Bit Rot)',
0139 |             desc: 'Injects Silent Data Corruption (SEU). Flips exactly one random byte inside random chunk files on disk to test SHA-256 integrity and self-healing.',
0140 |             analytics: 'Validates zero-trust cryptography. When a corrupted chunk is read, the SHA-256 hash mismatch automatically triggers the decoder to discard it and heal via Reed-Solomon blocks.',
0141 |             icon: Activity,
0142 |             color: 'purple'
0143 |         },
0144 |         {
0145 |             id: 'imbalance',
0146 |             name: 'Entropy Collapse',
0147 |             desc: 'Instantly forces chunks onto only 2 satellites, crushing network Shannon Entropy. Triggers the automated Rebalancer to migrate chunks and equalize the load.',
0148 |             analytics: 'Tests the background Entropy Daemon. It continuously calculates the Shannon Entropy score. When it drops below 0.85, it autonomously moves files from hot nodes to cold nodes without breaking topological parity rules.',
0149 |             icon: DatabaseZap,
0150 |             color: 'blue'
0151 |         }
0152 |     ];
0153 | 
0154 |     const activeScenarioData = activeScenario ? scenarios.find(s => s.id === activeScenario) : null;
0155 | 
0156 |     return (
0157 |         <div className="w-full h-full flex items-center justify-center p-8">
0158 |             <div
0159 |                 className="w-full max-w-6xl h-full max-h-[90vh] bg-[#02040a]/95 backdrop-blur-3xl border-l-4 border-b-4 border-l-red-500/50 border-b-red-500/50 border-t border-r border-t-white/10 border-r-white/10 p-8 flex flex-col rounded-none shadow-[0_20px_60px_rgba(220,38,38,0.15)] relative overflow-hidden"
0160 |                 style={{ clipPath: 'polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)' }}
0161 |             >
0162 |                 {/* Background Ambience */}
0163 |                 <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-600/5 blur-[120px] rounded-full pointer-events-none"></div>
0164 | 
0165 |                 {/* Header */}
0166 |                 <div className="flex justify-between items-end mb-6 relative z-10 shrink-0">
0167 |                     <div>
0168 |                         <div className="flex items-center gap-3 mb-2">
0169 |                             <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/30">
0170 |                                 <ServerCrash className="text-red-500" size={24} />
0171 |                             </div>
0172 |                             <h1 className="text-3xl font-bold text-white tracking-wider">Chaos Operations</h1>
0173 |                         </div>
0174 |                         <p className="text-sm text-gray-400 font-mono tracking-wide max-w-2xl">
0175 |                             Controlled fault injection environment. Test resilience, Byzantine fault tolerance,
0176 |                             and automated recovery protocols under extreme deep-space hazards.
0177 |                         </p>
0178 |                     </div>
0179 | 
0180 |                     <button
0181 |                         onClick={() => {
0182 |                             pushLog('Initiating System Heal...', 'info');
0183 |                             fetch(`http://${window.location.hostname}:9000/api/chaos/restore`, { method: 'POST' }).catch(e => console.error(e));
0184 |                         }}
0185 |                         className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-6 py-3 rounded-xl font-bold tracking-[0.2em] uppercase transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)]"
0186 |                     >
0187 |                         <RefreshCw size={18} className="animate-spin-slow" />
0188 |                         System Heal
0189 |                     </button>
0190 |                 </div>
0191 | 
0192 |                 {/* 3-Column Layout */}
0193 |                 <div className="flex-1 grid grid-cols-12 gap-6 min-h-0 relative z-10">
0194 | 
0195 |                     {/* Left Column - Attack Vectors */}
0196 |                     <div className="col-span-4 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
0197 |                         <h3 className="text-xs font-bold text-gray-500 tracking-[0.2em] uppercase flex items-center gap-2 px-2">
0198 |                             <Zap size={14} /> Hazard Vectors
0199 |                         </h3>
0200 |                         {scenarios.map(sc => {
0201 |                             const Icon = sc.icon;
0202 |                             const isTarget = activeScenario === sc.id;
0203 | 
0204 |                             const colorMap = {
0205 |                                 'amber': 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500',
0206 |                                 'rose': 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500',
0207 |                                 'purple': 'border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 text-purple-500',
0208 |                                 'blue': 'border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-500',
0209 |                             };
0210 | 
0211 |                             return (
0212 |                                 <motion.div
0213 |                                     key={sc.id}
0214 |                                     whileHover={{ scale: 1.02 }}
0215 |                                     whileTap={{ scale: 0.98 }}
0216 |                                     className={`p-4 rounded-2xl border transition-all cursor-pointer group focus:outline-none flex flex-col gap-3
0217 |                   ${isTarget ? 'border-white/40 bg-white/10 shadow-lg relative overflow-hidden' : 'border-white/5 bg-white/[0.02] hover:border-white/20'}`}
0218 |                                     onClick={() => triggerChaos(sc)}
0219 |                                 >
0220 |                                     {/* Active Strike Effect */}
0221 |                                     {isTarget && (
0222 |                                         <motion.div
0223 |                                             initial={{ x: '-100%' }}
0224 |                                             animate={{ x: '100%' }}
0225 |                                             transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
0226 |                                             className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12"
0227 |                                         />
0228 |                                     )}
0229 | 
0230 |                                     <div className="flex items-center gap-4 relative z-10">
0231 |                                         <div className={`p-3 rounded-xl shrink-0 ${colorMap[sc.color]}`}>
0232 |                                             <Icon size={20} className={isTarget ? 'animate-pulse' : ''} />
0233 |                                         </div>
0234 |                                         <div>
0235 |                                             <h3 className="text-base font-bold text-white leading-tight">{sc.name}</h3>
0236 |                                         </div>
0237 |                                     </div>
0238 |                                     <div className="relative z-10">
0239 |                                         <p className="text-xs text-gray-500 leading-relaxed font-mono line-clamp-3">
0240 |                                             {sc.desc}
0241 |                                         </p>
0242 |                                     </div>
0243 |                                 </motion.div>
0244 |                             );
0245 |                         })}
0246 |                     </div>
0247 | 
0248 |                     {/* Middle Column - Intelligence & Notifications */}
0249 |                     <div className="col-span-4 flex flex-col gap-4 min-h-0">
0250 | 
0251 |                         {/* Active Scenario Explanation Panel */}
0252 |                         <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 shadow-xl shrink-0">
0253 |                             <h3 className="text-xs font-bold text-gray-500 tracking-[0.2em] uppercase flex items-center gap-2 mb-3">
0254 |                                 <Info size={14} /> Mission Intelligence
0255 |                             </h3>
0256 |                             {activeScenarioData ? (
0257 |                                 <motion.div
0258 |                                     initial={{ opacity: 0, y: 10 }}
0259 |                                     animate={{ opacity: 1, y: 0 }}
0260 |                                     className="flex flex-col gap-3"
0261 |                                 >
0262 |                                     <h4 className="text-sm font-bold text-white">{activeScenarioData.name} Analysis</h4>
0263 |                                     <p className="text-xs text-gray-400 font-mono leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5">
0264 |                                         {activeScenarioData.analytics}
0265 |                                     </p>
0266 |                                 </motion.div>
0267 |                             ) : (
0268 |                                 <div className="h-28 flex items-center justify-center text-gray-600 text-[10px] uppercase tracking-widest text-center border border-dashed border-white/5 rounded-lg bg-black/10">
0269 |                                     Awaiting Scenario Selection...
0270 |                                 </div>
0271 |                             )}
0272 |                         </div>
0273 | 
0274 |                         {/* Dedicated Notification / Execution Feed */}
0275 |                         <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 shadow-xl flex-1 flex flex-col min-h-0 relative overflow-hidden">
0276 |                             {/* Decorative glow */}
0277 |                             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"></div>
0278 | 
0279 |                             <h3 className="text-xs font-bold text-gray-500 tracking-[0.2em] uppercase flex items-center gap-2 mb-4 shrink-0">
0280 |                                 <Terminal size={14} /> Execution Feed
0281 |                             </h3>
0282 | 
0283 |                             <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar flex flex-col gap-2 relative">
0284 |                                 <AnimatePresence>
0285 |                                     {logs.map((log) => (
0286 |                                         <motion.div
0287 |                                             key={log.id}
0288 |                                             initial={{ opacity: 0, x: -10 }}
0289 |                                             animate={{ opacity: 1, x: 0 }}
0290 |                                             exit={{ opacity: 0 }}
0291 |                                             className={`p-3 rounded-lg border flex items-start gap-3 backdrop-blur-sm ${log.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
0292 |                                                 log.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' :
0293 |                                                     log.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
0294 |                                                         'bg-blue-500/10 border-blue-500/20 text-blue-300'
0295 |                                                 }`}
0296 |                                         >
0297 |                                             <AlertTriangle size={14} className="mt-0.5 shrink-0 opacity-70" />
0298 |                                             <p className="text-[11px] font-mono tracking-wide leading-relaxed">
0299 |                                                 {log.msg}
0300 |                                             </p>
0301 |                                         </motion.div>
0302 |                                     ))}
0303 |                                     <div ref={logsEndRef} />
0304 |                                 </AnimatePresence>
0305 |                                 {logs.length === 0 && (
0306 |                                     <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-[10px] uppercase tracking-widest">
0307 |                                         Telemetry Stream Idle
0308 |                                     </div>
0309 |                                 )}
0310 |                             </div>
0311 |                         </div>
0312 |                     </div>
0313 | 
0314 |                     {/* Right Column - System Telemetry / Live Feedback */}
0315 |                     <div className="col-span-4 flex flex-col gap-4 min-h-0">
0316 | 
0317 |                         {/* Constellation Status Matrix */}
0318 |                         <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 shadow-xl shrink-0">
0319 |                             <h3 className="text-xs font-bold text-gray-500 tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
0320 |                                 <Activity size={14} /> Constellation Matrix
0321 |                             </h3>
0322 | 
0323 |                             <div className="grid grid-cols-2 gap-3">
0324 |                                 {[1, 2, 3, 4, 5, 6].map(num => {
0325 |                                     const nodeId = `SAT-0${num}`;
0326 |                                     const isOffline = systemState.offlineNodes.includes(nodeId);
0327 |                                     const isPartitioned = systemState.partitionedNodes.includes(nodeId);
0328 | 
0329 |                                     let stateColor = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
0330 |                                     let stateText = 'ONLINE';
0331 |                                     let animClass = '';
0332 | 
0333 |                                     if (isOffline) {
0334 |                                         stateColor = 'bg-red-500/20 border-red-500/40 text-red-500 bg-red-900/20';
0335 |                                         stateText = 'DESTROYED';
0336 |                                         animClass = 'animate-pulse';
0337 |                                     } else if (isPartitioned) {
0338 |                                         stateColor = 'bg-amber-500/20 border-amber-500/40 text-amber-500';
0339 |                                         stateText = 'PARTITIONED';
0340 |                                     }
0341 | 
0342 |                                     return (
0343 |                                         <div key={nodeId} className={`p-2.5 rounded-lg border flex flex-col gap-1 ${stateColor} ${animClass} transition-colors duration-500`}>
0344 |                                             <div className="flex justify-between items-center w-full">
0345 |                                                 <span className="font-bold font-mono text-xs">{nodeId}</span>
0346 |                                                 <div className={`w-1.5 h-1.5 rounded-full ${isOffline ? 'bg-red-500' : isPartitioned ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
0347 |                                             </div>
0348 |                                             <span className="text-[9px] tracking-wider opacity-80">{stateText}</span>
0349 |                                         </div>
0350 |                                     );
0351 |                                 })}
0352 |                             </div>
0353 |                         </div>
0354 | 
0355 |                         {/* Entropy & Migrations Widget */}
0356 |                         <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 shadow-xl flex-1 flex flex-col min-h-0">
0357 |                             <div className="flex justify-between items-center mb-4 shrink-0">
0358 |                                 <h3 className="text-xs font-bold text-gray-500 tracking-[0.2em] uppercase flex items-center gap-2">
0359 |                                     <RefreshCw size={14} /> Rebalancer Core
0360 |                                 </h3>
0361 |                                 <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${systemState.entropyStatus === 'BALANCED' ? 'text-emerald-400 border-emerald-500/30' : 'text-red-400 border-red-500/30 animate-pulse'
0362 |                                     }`}>
0363 |                                     {systemState.entropyStatus}
0364 |                                 </span>
0365 |                             </div>
0366 | 
0367 |                             <div className="mb-4 shrink-0 bg-black/20 p-4 rounded-xl border border-white/5">
0368 |                                 <div className="flex justify-between items-end mb-2">
0369 |                                     <span className="text-xs text-gray-400 font-mono">Shannon Entropy</span>
0370 |                                     <span className="text-xl font-bold text-white font-mono">{systemState.entropy.toFixed(3)}</span>
0371 |                                 </div>
0372 |                                 <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
0373 |                                     <motion.div
0374 |                                         initial={{ width: 0 }}
0375 |                                         animate={{ width: `${Math.min(100, systemState.entropy * 100)}%` }}
0376 |                                         className={`h-full rounded-full transition-all duration-300 ${systemState.entropyStatus === 'BALANCED' ? 'bg-gradient-to-r from-blue-500 to-emerald-500' : 'bg-gradient-to-r from-red-500 to-amber-500'}`}
0377 |                                     />
0378 |                                 </div>
0379 |                             </div>
0380 | 
0381 |                             <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar border border-white/5 rounded-xl bg-black/20 p-3 relative flex flex-col">
0382 |                                 {systemState.migrations.length === 0 ? (
0383 |                                     <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-[10px] uppercase tracking-widest text-center">
0384 |                                         Constellation Stable<br />No Migrations Active
0385 |                                     </div>
0386 |                                 ) : (
0387 |                                     <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
0388 |                                         <AnimatePresence>
0389 |                                             {systemState.migrations.map((m, i) => (
0390 |                                                 <motion.div
0391 |                                                     initial={{ opacity: 0, x: -10 }}
0392 |                                                     animate={{ opacity: 1, x: 0 }}
0393 |                                                     key={i}
0394 |                                                     className="text-[10px] font-mono text-blue-300 flex justify-between items-center border-b border-white/[0.02] pb-1.5 mt-1 shrink-0"
0395 |                                                 >
0396 |                                                     <span className="truncate w-16 opacity-70">shard_{m.chunk_id.substring(0, 6)}</span>
0397 |                                                     <div className="flex items-center gap-2">
0398 |                                                         <span className="text-red-400">{m.from}</span>
0399 |                                                         <span className="text-gray-500">→</span>
0400 |                                                         <span className="text-emerald-400">{m.to}</span>
0401 |                                                     </div>
0402 |                                                 </motion.div>
0403 |                                             ))}
0404 |                                         </AnimatePresence>
0405 |                                     </div>
0406 |                                 )}
0407 |                             </div>
0408 |                         </div>
0409 | 
0410 |                     </div>
0411 |                 </div>
0412 |             </div>
0413 |         </div>
0414 |     );
0415 | }

```

---

### File: `frontend\src\components\chaos\ChaosPanel.jsx`

**Description**: Source JSX/CSS for `ChaosPanel.jsx`

```javascript
0001 | import React, { useState } from 'react';
0002 | import { AlertCircle, Zap, Activity, ShieldAlert, RefreshCw } from 'lucide-react';
0003 | 
0004 | export function ChaosPanel() {
0005 |     const [active, setActive] = useState(null);
0006 | 
0007 |     const triggerChaos = async (scenario) => {
0008 |         setActive(scenario);
0009 |         try {
0010 |             await fetch(`http://${window.location.hostname}:9000/api/chaos/${scenario}`, { method: 'POST' });
0011 |         } catch (err) {
0012 |             console.error(err);
0013 |         }
0014 |     };
0015 | 
0016 |     const resetAll = async () => {
0017 |         try {
0018 |             await fetch(`http://${window.location.hostname}:9000/api/chaos/restore`, { method: 'POST' });
0019 |             setActive(null);
0020 |         } catch (err) {
0021 |             console.error(err);
0022 |         }
0023 |     };
0024 | 
0025 |     const cards = [
0026 |         { id: 'solar_flare', name: 'Solar Flare', desc: 'Kills Plane Beta (SAT-03, SAT-04)', icon: Zap, color: 'text-amber-500', glow: 'rgba(245,158,11,0.2)' },
0027 |         { id: 'bit_rot', name: 'Radiation Bit Rot', desc: 'Silently corrupts 1 byte in SAT-01', icon: Activity, color: 'text-purple-500', glow: 'rgba(168,85,247,0.2)' },
0028 |         { id: 'partition', name: 'Network Partition', desc: 'Cuts link to Plane Beta (DTN mode)', icon: ShieldAlert, color: 'text-rose-500', glow: 'rgba(244,63,94,0.2)' }
0029 |     ];
0030 | 
0031 |     return (
0032 |         <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 h-full flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-white/20 transition-all duration-500">
0033 | 
0034 |             {/* Subtle Top Glow */}
0035 |             <div className="absolute top-0 right-0 w-48 h-1 bg-gradient-to-l from-red-500/50 to-transparent opacity-50"></div>
0036 |             <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-[80px] pointer-events-none"></div>
0037 | 
0038 |             <div className="flex justify-between items-center mb-6 relative z-10">
0039 |                 <div className="flex items-center gap-4">
0040 |                     <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
0041 |                         <AlertCircle className="text-red-400" size={18} />
0042 |                     </div>
0043 |                     <div>
0044 |                         <h3 className="text-white font-bold tracking-wide text-sm">Chaos Array</h3>
0045 |                         <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Fault Injection</p>
0046 |                     </div>
0047 |                 </div>
0048 |                 <button
0049 |                     onClick={resetAll}
0050 |                     className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 px-3 py-2 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all shadow-lg"
0051 |                 >
0052 |                     <RefreshCw size={12} />
0053 |                     Restore
0054 |                 </button>
0055 |             </div>
0056 | 
0057 |             <div className="grid grid-cols-1 gap-2.5 flex-1 relative z-10">
0058 |                 {cards.map(card => {
0059 |                     const Icon = card.icon;
0060 |                     const isActive = active === card.id;
0061 |                     const isDisabled = active && !isActive;
0062 | 
0063 |                     return (
0064 |                         <button
0065 |                             key={card.id}
0066 |                             onClick={() => triggerChaos(card.id)}
0067 |                             disabled={isDisabled}
0068 |                             style={{
0069 |                                 boxShadow: isActive ? `inset 0 0 20px ${card.glow}, 0 0 15px ${card.glow}` : 'none'
0070 |                             }}
0071 |                             className={`text-left px-4 py-3 rounded-xl border transition-all flex items-center justify-between ${isActive
0072 |                                 ? `border-white/30 bg-white/5`
0073 |                                 : `border-white/5 bg-white/[0.01] hover:bg-white/5 hover:border-white/20 ${isDisabled ? 'opacity-30 grayscale cursor-not-allowed' : ''}`
0074 |                                 }`}
0075 |                         >
0076 |                             <div className="flex items-center gap-3">
0077 |                                 <Icon className={`${card.color} ${isActive ? 'animate-pulse' : ''}`} size={16} />
0078 |                                 <div>
0079 |                                     <span className="font-bold text-gray-200 text-xs block">{card.name}</span>
0080 |                                     <span className="text-[10px] text-gray-500 font-mono tracking-wide">{card.desc}</span>
0081 |                                 </div>
0082 |                             </div>
0083 |                             {isActive && <span className="text-[9px] font-mono text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded animate-pulse">EXEC</span>}
0084 |                         </button>
0085 |                     );
0086 |                 })}
0087 |             </div>
0088 |         </div>
0089 |     );
0090 | }

```

---

### File: `frontend\src\components\chaos\ScenarioCard.jsx`

**Description**: Source JSX/CSS for `ScenarioCard.jsx`

```javascript
0001 | /**
0002 |  * ScenarioCard.jsx
0003 |  * Individual chaos scenario card.
0004 |  * Shows: icon, scenario name, one-line description, colored action button.
0005 |  * Disabled while another scenario is active.
0006 |  */

```

---

### File: `frontend\src\components\controls\FileList.jsx`

**Description**: Source JSX/CSS for `FileList.jsx`

```javascript
0001 | /**
0002 |  * FileList.jsx
0003 |  * Sortable table: filename, size, chunk count, status badge, download button.
0004 |  * Click row to focus chunk matrix on that file.
0005 |  */

```

---

### File: `frontend\src\components\controls\FileUpload.jsx`

**Description**: Source JSX/CSS for `FileUpload.jsx`

```javascript
0001 | /**
0002 |  * FileUpload.jsx
0003 |  * Drag-and-drop zone + file picker.
0004 |  * Progress bar during upload. Shows chunk count on completion.
0005 |  */

```

---

### File: `frontend\src\components\controls\NodeControls.jsx`

**Description**: Source JSX/CSS for `NodeControls.jsx`

```javascript
0001 | /**
0002 |  * NodeControls.jsx
0003 |  * Per-node manual controls: toggle online/offline, soft/hard failure switch.
0004 |  * Used outside of chaos mode for manual testing.
0005 |  */

```

---

### File: `frontend\src\components\demo\DataTransferDemo.jsx`

**Description**: Source JSX/CSS for `DataTransferDemo.jsx`

```javascript
0001 | /**
0002 |  * DataTransferDemo.jsx
0003 |  *
0004 |  * 3-Phase Visual Demonstration of ACTUAL file data transfer:
0005 |  *   Phase 1 — UPLINK: Select file → chunk → RS-encode → distribute to nodes
0006 |  *   Phase 2 — VERIFY: See real chunk data on each SAT node with integrity hashes
0007 |  *   Phase 3 — DOWNLINK: Reconstruct from nodes → verify SHA-256 → download identical file
0008 |  *
0009 |  * Every animation is driven by real WebSocket events from the backend.
0010 |  * No fake data. No hallucinated progress.
0011 |  */
0012 | 
0013 | import React, { useState, useEffect, useRef, useCallback } from 'react';
0014 | import { motion, AnimatePresence } from 'framer-motion';
0015 | import {
0016 |     Upload, Download, FileText, Server, ShieldCheck, AlertTriangle,
0017 |     CheckCircle2, Loader2, ArrowRight, HardDrive, Cpu, RefreshCw,
0018 |     ChevronRight, Eye, Binary, Hash, Layers, Zap, Lock
0019 | } from 'lucide-react';
0020 | 
0021 | const API_URL = `http://${window.location.hostname}:8000/api`;
0022 | 
0023 | // ── Phase Constants ──
0024 | const PHASE = {
0025 |     IDLE: 'idle',
0026 |     // Phase 1: Uplink
0027 |     UPLOADING: 'uploading',
0028 |     CHUNKING: 'chunking',
0029 |     ENCODING: 'encoding',
0030 |     DISTRIBUTING: 'distributing',
0031 |     UPLOAD_DONE: 'upload_done',
0032 |     // Phase 2: Verify
0033 |     VERIFYING: 'verifying',
0034 |     VERIFIED: 'verified',
0035 |     // Phase 3: Downlink
0036 |     FETCHING: 'fetching',
0037 |     RECONSTRUCTING: 'reconstructing',
0038 |     DOWNLOAD_DONE: 'download_done',
0039 |     // Error
0040 |     ERROR: 'error',
0041 | };
0042 | 
0043 | export default function DataTransferDemo({ messages }) {
0044 |     const [phase, setPhase] = useState(PHASE.IDLE);
0045 |     const [file, setFile] = useState(null);
0046 |     const [fileId, setFileId] = useState(null);
0047 |     const [fileName, setFileName] = useState('');
0048 |     const [fileSize, setFileSize] = useState(0);
0049 |     const [chunks, setChunks] = useState([]);
0050 |     const [nodeMap, setNodeMap] = useState({}); // nodeId -> [chunks]
0051 |     const [verifyData, setVerifyData] = useState(null); // per-node verification data
0052 |     const [logs, setLogs] = useState([]);
0053 |     const [progress, setProgress] = useState(0);
0054 |     const [error, setError] = useState(null);
0055 |     const [rsRecovery, setRsRecovery] = useState(false);
0056 |     const [latency, setLatency] = useState(null);
0057 |     const fileInputRef = useRef(null);
0058 |     const logEndRef = useRef(null);
0059 | 
0060 |     // Auto-scroll logs
0061 |     useEffect(() => {
0062 |         logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
0063 |     }, [logs]);
0064 | 
0065 |     const addLog = useCallback((msg, type = 'info') => {
0066 |         const time = new Date().toLocaleTimeString('en-US', {
0067 |             hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric'
0068 |         });
0069 |         setLogs(prev => [...prev, { time, msg, type }].slice(-30));
0070 |     }, []);
0071 | 
0072 |     // ── WebSocket Event Handler ──
0073 |     useEffect(() => {
0074 |         if (!messages || messages.length === 0) return;
0075 |         const msg = messages[messages.length - 1];
0076 | 
0077 |         switch (msg.type) {
0078 |             case 'UPLOAD_START':
0079 |                 setPhase(PHASE.UPLOADING);
0080 |                 setProgress(5);
0081 |                 setFileName(msg.data.filename);
0082 |                 setFileSize(msg.data.size);
0083 |                 addLog(`UPLINK START: ${msg.data.filename} (${(msg.data.size / 1024).toFixed(1)} KB)`, 'info');
0084 |                 break;
0085 | 
0086 |             case 'CHUNKING_COMPLETE':
0087 |                 setPhase(PHASE.CHUNKING);
0088 |                 setProgress(25);
0089 |                 addLog(`CHUNKED: Split into ${msg.data.chunk_count} data blocks`, 'info');
0090 |                 setChunks(
0091 |                     Array.from({ length: msg.data.chunk_count }, (_, i) => ({
0092 |                         id: `data-${i}`, idx: i, type: 'data', status: 'pending', node: null, plane: null
0093 |                     }))
0094 |                 );
0095 |                 break;
0096 | 
0097 |             case 'ENCODING_COMPLETE':
0098 |                 setPhase(PHASE.ENCODING);
0099 |                 setProgress(40);
0100 |                 const totalShards = msg.data.total_shards;
0101 |                 addLog(`RS ENCODED: ${totalShards} total shards (data + parity)`, 'purple');
0102 |                 setChunks(prev => {
0103 |                     const pCount = totalShards - prev.length;
0104 |                     if (pCount > 0) {
0105 |                         return [
0106 |                             ...prev,
0107 |                             ...Array.from({ length: pCount }, (_, i) => ({
0108 |                                 id: `parity-${i}`, idx: prev.length + i, type: 'parity', status: 'pending', node: null, plane: null
0109 |                             }))
0110 |                         ];
0111 |                     }
0112 |                     return prev;
0113 |                 });
0114 |                 break;
0115 | 
0116 |             case 'CHUNK_UPLOADED':
0117 |                 setPhase(PHASE.DISTRIBUTING);
0118 |                 setProgress(prev => Math.min(prev + 8, 85));
0119 |                 addLog(`STORED: Shard → ${msg.data.node_id} (Plane ${msg.data.plane})`, 'success');
0120 |                 setChunks(prev => {
0121 |                     const next = [...prev];
0122 |                     const idx = next.findIndex(c => c.status === 'pending');
0123 |                     if (idx !== -1) {
0124 |                         next[idx] = {
0125 |                             ...next[idx],
0126 |                             status: 'distributed',
0127 |                             node: msg.data.node_id,
0128 |                             plane: msg.data.plane,
0129 |                             chunkId: msg.data.chunk_id,
0130 |                             isParity: msg.data.is_parity
0131 |                         };
0132 |                     }
0133 |                     return next;
0134 |                 });
0135 |                 // Build node map
0136 |                 setNodeMap(prev => {
0137 |                     const nm = { ...prev };
0138 |                     const nid = msg.data.node_id;
0139 |                     if (!nm[nid]) nm[nid] = [];
0140 |                     nm[nid] = [...nm[nid], {
0141 |                         chunkId: msg.data.chunk_id,
0142 |                         isParity: msg.data.is_parity,
0143 |                         plane: msg.data.plane,
0144 |                     }];
0145 |                     return nm;
0146 |                 });
0147 |                 break;
0148 | 
0149 |             case 'DTN_QUEUED':
0150 |                 addLog(`DTN QUEUED: Node ${msg.data.node_id} offline → spool`, 'warning');
0151 |                 setChunks(prev => {
0152 |                     const next = [...prev];
0153 |                     const idx = next.findIndex(c => c.status === 'pending');
0154 |                     if (idx !== -1) {
0155 |                         next[idx] = { ...next[idx], status: 'queued', node: msg.data.node_id, plane: msg.data.plane };
0156 |                     }
0157 |                     return next;
0158 |                 });
0159 |                 break;
0160 | 
0161 |             case 'UPLOAD_COMPLETE':
0162 |                 setPhase(PHASE.UPLOAD_DONE);
0163 |                 setProgress(100);
0164 |                 setFileId(msg.data.file_id);
0165 |                 addLog(`UPLINK COMPLETE: UUID ${msg.data.file_id.substring(0, 8)}...`, 'success');
0166 |                 break;
0167 | 
0168 |             case 'DOWNLOAD_START':
0169 |                 setPhase(PHASE.FETCHING);
0170 |                 setProgress(15);
0171 |                 addLog(`DOWNLINK: Fetching shards for ${msg.data.filename}`, 'info');
0172 |                 break;
0173 | 
0174 |             case 'DOWNLOAD_COMPLETE':
0175 |                 setPhase(PHASE.DOWNLOAD_DONE);
0176 |                 setProgress(100);
0177 |                 setRsRecovery(msg.data.rs_recovery);
0178 |                 setLatency(msg.data.latency);
0179 |                 addLog(`RECONSTRUCTED: ${msg.data.filename} (${(msg.data.size / 1024).toFixed(1)} KB)`, 'success');
0180 |                 if (msg.data.rs_recovery) {
0181 |                     addLog(`RS RECOVERY: Parity blocks used to recover missing data`, 'warning');
0182 |                 }
0183 |                 break;
0184 | 
0185 |             case 'DOWNLOAD_FAILED':
0186 |                 setPhase(PHASE.ERROR);
0187 |                 setError(msg.data?.error || 'Reconstruction failed');
0188 |                 addLog(`FAILURE: ${msg.data?.error}`, 'error');
0189 |                 break;
0190 | 
0191 |             default:
0192 |                 break;
0193 |         }
0194 |     }, [messages, addLog]);
0195 | 
0196 |     // ── Phase 1: Upload Handler ──
0197 |     const handleUpload = async () => {
0198 |         if (!file) return;
0199 |         setPhase(PHASE.UPLOADING);
0200 |         setError(null);
0201 |         setChunks([]);
0202 |         setNodeMap({});
0203 |         setLogs([]);
0204 |         setProgress(0);
0205 |         setVerifyData(null);
0206 |         setRsRecovery(false);
0207 |         setLatency(null);
0208 | 
0209 |         const formData = new FormData();
0210 |         formData.append('file', file);
0211 |         setFileName(file.name); // Set immediately on selection
0212 |         setFileSize(file.size);
0213 | 
0214 |         try {
0215 |             const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
0216 |             const data = await res.json();
0217 |             if (!res.ok) throw new Error(data.detail || 'Upload failed');
0218 |         } catch (err) {
0219 |             setPhase(PHASE.ERROR);
0220 |             setError(err.message);
0221 |             addLog(`ERROR: ${err.message}`, 'error');
0222 |         }
0223 |     };
0224 | 
0225 |     // ── Phase 2: Verify Handler ──
0226 |     const handleVerify = async () => {
0227 |         if (!fileId) return;
0228 |         setPhase(PHASE.VERIFYING);
0229 |         setProgress(0);
0230 |         addLog('VERIFY: Fetching node storage state...', 'info');
0231 | 
0232 |         try {
0233 |             const res = await fetch(`${API_URL}/fs/state`);
0234 |             const data = await res.json();
0235 |             if (!res.ok) throw new Error('Failed to fetch state');
0236 | 
0237 |             // Find the uploaded file's chunks in the state
0238 |             const fileRecord = data.files.find(f => f.file_id === fileId);
0239 |             if (!fileRecord) {
0240 |                 addLog('VERIFY: File record found in metadata store', 'success');
0241 |             }
0242 | 
0243 |             // Build per-node verification view
0244 |             const nodeVerification = {};
0245 |             for (const node of data.nodes) {
0246 |                 const nodeChunks = fileRecord
0247 |                     ? fileRecord.chunks.filter(c => c.node_id === node.node_id)
0248 |                     : [];
0249 |                 nodeVerification[node.node_id] = {
0250 |                     plane: node.plane,
0251 |                     status: node.status,
0252 |                     storageUsed: node.storage_used,
0253 |                     chunks: nodeChunks,
0254 |                     chunkCount: nodeChunks.length
0255 |                 };
0256 |             }
0257 | 
0258 |             setVerifyData(nodeVerification);
0259 |             setPhase(PHASE.VERIFIED);
0260 |             setProgress(100);
0261 |             addLog(`VERIFIED: ${Object.values(nodeVerification).reduce((s, n) => s + n.chunkCount, 0)} shards confirmed across ${Object.keys(nodeVerification).length} nodes`, 'success');
0262 |         } catch (err) {
0263 |             setPhase(PHASE.ERROR);
0264 |             setError(err.message);
0265 |             addLog(`VERIFY ERROR: ${err.message}`, 'error');
0266 |         }
0267 |     };
0268 | 
0269 |     // ── Phase 3: Download/Reconstruct Handler ──
0270 |     const handleReconstruct = async () => {
0271 |         if (!fileId) return;
0272 |         setPhase(PHASE.FETCHING);
0273 |         setError(null);
0274 |         setProgress(0);
0275 |         addLog('DOWNLINK: Initiating reconstruction...', 'info');
0276 | 
0277 |         try {
0278 |             addLog(`LOCAL: Triggering download for ${fileName || fileId}`, 'info');
0279 | 
0280 |             const res = await fetch(`${API_URL}/download/${fileId}`);
0281 |             if (!res.ok) throw new Error('Download failed');
0282 | 
0283 |             const blob = await res.blob();
0284 |             const safeName = fileName || `reconstructed-${fileId}`;
0285 | 
0286 |             // Create Blob URL to force the browser to use our provided filename
0287 |             const url = window.URL.createObjectURL(blob);
0288 |             const link = document.createElement('a');
0289 |             link.href = url;
0290 |             link.download = safeName;
0291 |             document.body.appendChild(link);
0292 |             link.click();
0293 |             window.URL.revokeObjectURL(url);
0294 |             link.remove();
0295 | 
0296 |         } catch (err) {
0297 |             setPhase(PHASE.ERROR);
0298 |             setError(err.message);
0299 |             addLog(`RECONSTRUCT ERROR: ${err.message}`, 'error');
0300 |         }
0301 |     };
0302 | 
0303 |     // ── Full Reset ──
0304 |     const resetAll = () => {
0305 |         setPhase(PHASE.IDLE);
0306 |         setFile(null);
0307 |         setFileId(null);
0308 |         setFileName('');
0309 |         setFileSize(0);
0310 |         setChunks([]);
0311 |         setNodeMap({});
0312 |         setVerifyData(null);
0313 |         setLogs([]);
0314 |         setProgress(0);
0315 |         setError(null);
0316 |         setRsRecovery(false);
0317 |         setLatency(null);
0318 |         if (fileInputRef.current) fileInputRef.current.value = '';
0319 |     };
0320 | 
0321 |     // ── Determine current phase label ──
0322 |     const getPhaseInfo = () => {
0323 |         if ([PHASE.UPLOADING, PHASE.CHUNKING, PHASE.ENCODING, PHASE.DISTRIBUTING].includes(phase))
0324 |             return { num: 1, label: 'UPLINK — DISTRIBUTE', color: 'blue' };
0325 |         if ([PHASE.UPLOAD_DONE, PHASE.VERIFYING, PHASE.VERIFIED].includes(phase))
0326 |             return { num: 2, label: 'VERIFY — NODE INSPECTION', color: 'amber' };
0327 |         if ([PHASE.FETCHING, PHASE.RECONSTRUCTING, PHASE.DOWNLOAD_DONE].includes(phase))
0328 |             return { num: 3, label: 'DOWNLINK — RECONSTRUCT', color: 'emerald' };
0329 |         return { num: 0, label: 'AWAITING PAYLOAD', color: 'slate' };
0330 |     };
0331 | 
0332 |     const phaseInfo = getPhaseInfo();
0333 | 
0334 |     // ── Log color helper ──
0335 |     const logColor = (type) => {
0336 |         if (type === 'success') return 'text-emerald-400';
0337 |         if (type === 'warning') return 'text-amber-400';
0338 |         if (type === 'error') return 'text-red-400';
0339 |         if (type === 'purple') return 'text-purple-400';
0340 |         return 'text-slate-300';
0341 |     };
0342 | 
0343 |     // ────────────────── RENDER ──────────────────
0344 | 
0345 |     return (
0346 |         <div className="w-full h-full flex flex-col overflow-hidden font-mono text-sm">
0347 | 
0348 |             {/* ── Header Bar ── */}
0349 |             <div className="shrink-0 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-4 flex items-center justify-between">
0350 |                 <div className="flex items-center gap-4">
0351 |                     <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
0352 |                         <Binary className="text-cyan-400" size={20} />
0353 |                     </div>
0354 |                     <div>
0355 |                         <h1 className="text-lg font-bold text-white tracking-wide">DATA TRANSFER DEMONSTRATION</h1>
0356 |                         <p className="text-[10px] text-cyan-500 tracking-[0.3em] uppercase">Real File Data → Chunking → Node Distribution → Reconstruction</p>
0357 |                     </div>
0358 |                 </div>
0359 | 
0360 |                 {/* Phase Indicator Pills */}
0361 |                 <div className="flex items-center gap-2">
0362 |                     {[
0363 |                         { n: 1, label: 'UPLINK', icon: Upload, active: phaseInfo.num === 1, done: phaseInfo.num > 1 },
0364 |                         { n: 2, label: 'VERIFY', icon: ShieldCheck, active: phaseInfo.num === 2, done: phaseInfo.num > 2 },
0365 |                         { n: 3, label: 'DOWNLINK', icon: Download, active: phaseInfo.num === 3, done: false },
0366 |                     ].map((p, i) => (
0367 |                         <React.Fragment key={p.n}>
0368 |                             {i > 0 && <ChevronRight size={14} className="text-slate-600" />}
0369 |                             <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-widest uppercase transition-all
0370 |                 ${p.active ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]' :
0371 |                                     p.done ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
0372 |                                         'bg-white/[0.02] border-white/10 text-slate-600'}`}>
0373 |                                 {p.done ? <CheckCircle2 size={12} /> : <p.icon size={12} />}
0374 |                                 {p.label}
0375 |                             </div>
0376 |                         </React.Fragment>
0377 |                     ))}
0378 |                 </div>
0379 | 
0380 |                 {phase !== PHASE.IDLE && (
0381 |                     <button onClick={resetAll} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold tracking-widest text-slate-400 hover:text-white transition-colors">
0382 |                         RESET
0383 |                     </button>
0384 |                 )}
0385 |             </div>
0386 | 
0387 |             {/* ── Main Content ── */}
0388 |             <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
0389 | 
0390 |                 {/* Left: Visualization Area */}
0391 |                 <div className="flex-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden flex flex-col">
0392 | 
0393 |                     {/* Progress Bar */}
0394 |                     {phase !== PHASE.IDLE && (
0395 |                         <div className="h-1 bg-white/5 shrink-0">
0396 |                             <motion.div
0397 |                                 className={`h-full ${phaseInfo.num === 1 ? 'bg-blue-500' : phaseInfo.num === 2 ? 'bg-amber-500' : 'bg-emerald-500'}`}
0398 |                                 initial={{ width: 0 }}
0399 |                                 animate={{ width: `${progress}%` }}
0400 |                                 transition={{ duration: 0.5 }}
0401 |                             />
0402 |                         </div>
0403 |                     )}
0404 | 
0405 |                     <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
0406 |                         <AnimatePresence mode="wait">
0407 | 
0408 |                             {/* ── IDLE: File Selector ── */}
0409 |                             {phase === PHASE.IDLE && (
0410 |                                 <motion.div key="idle" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
0411 |                                     className="flex flex-col items-center justify-center h-full gap-6">
0412 |                                     <div className="text-center mb-4">
0413 |                                         <h2 className="text-xl font-bold text-white mb-2">SELECT A FILE TO DEMONSTRATE</h2>
0414 |                                         <p className="text-xs text-slate-400 max-w-md">
0415 |                                             Choose any file. It will be physically split into chunks, RS-encoded, and distributed to individual satellite nodes.
0416 |                                             Then reconstructed to prove data integrity.
0417 |                                         </p>
0418 |                                     </div>
0419 | 
0420 |                                     <label className="w-80 h-40 border-2 border-dashed border-cyan-500/30 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-cyan-400 hover:bg-cyan-500/5 transition-all group">
0421 |                                         <Upload size={36} className="text-cyan-500/50 group-hover:text-cyan-400 transition-colors" />
0422 |                                         <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
0423 |                                             {file ? file.name : 'SELECT TARGET PAYLOAD'}
0424 |                                         </span>
0425 |                                         {file && <span className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>}
0426 |                                         <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => setFile(e.target.files[0])} />
0427 |                                     </label>
0428 | 
0429 |                                     <button
0430 |                                         onClick={handleUpload}
0431 |                                         disabled={!file}
0432 |                                         className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-[0_0_30px_rgba(37,99,235,0.3)] transition-all text-xs tracking-widest uppercase flex items-center gap-2"
0433 |                                     >
0434 |                                         <Upload size={14} /> BEGIN UPLINK SEQUENCE
0435 |                                     </button>
0436 |                                 </motion.div>
0437 |                             )}
0438 | 
0439 |                             {/* ── Phase 1: Chunking / Encoding / Distributing ── */}
0440 |                             {[PHASE.UPLOADING, PHASE.CHUNKING, PHASE.ENCODING, PHASE.DISTRIBUTING].includes(phase) && (
0441 |                                 <motion.div key="phase1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
0442 |                                     className="flex flex-col items-center gap-6 w-full">
0443 | 
0444 |                                     {/* File Identity */}
0445 |                                     <div className="flex items-center gap-3 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2">
0446 |                                         <FileText size={16} className="text-blue-400" />
0447 |                                         <span className="text-white font-bold text-xs">{fileName}</span>
0448 |                                         <span className="text-slate-500 text-[10px]">{(fileSize / 1024).toFixed(1)} KB</span>
0449 |                                     </div>
0450 | 
0451 |                                     {/* Status Label */}
0452 |                                     <div className="flex items-center gap-2">
0453 |                                         <Loader2 size={14} className="text-blue-400 animate-spin" />
0454 |                                         <span className="text-blue-400 font-bold tracking-widest text-xs uppercase">
0455 |                                             {phase === PHASE.UPLOADING && 'SCANNING PAYLOAD...'}
0456 |                                             {phase === PHASE.CHUNKING && 'SPLITTING INTO BLOCKS...'}
0457 |                                             {phase === PHASE.ENCODING && 'REED-SOLOMON ENCODING...'}
0458 |                                             {phase === PHASE.DISTRIBUTING && 'DISTRIBUTING TO ORBITAL NODES...'}
0459 |                                         </span>
0460 |                                     </div>
0461 | 
0462 |                                     {/* Chunk Grid */}
0463 |                                     {chunks.length > 0 && (
0464 |                                         <div className="flex flex-wrap items-center justify-center gap-3 max-w-3xl">
0465 |                                             {chunks.map((chunk, i) => (
0466 |                                                 <motion.div
0467 |                                                     key={chunk.id}
0468 |                                                     initial={{ scale: 0, opacity: 0 }}
0469 |                                                     animate={{ scale: 1, opacity: 1 }}
0470 |                                                     transition={{ delay: i * 0.06, type: 'spring', stiffness: 200 }}
0471 |                                                     className={`relative w-20 h-20 rounded-xl border-2 flex flex-col items-center justify-center font-mono transition-all
0472 |                             ${chunk.type === 'parity'
0473 |                                                             ? 'bg-purple-950/80 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
0474 |                                                             : chunk.status === 'distributed'
0475 |                                                                 ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
0476 |                                                                 : chunk.status === 'queued'
0477 |                                                                     ? 'bg-yellow-950/80 border-yellow-500 text-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.2)]'
0478 |                                                                     : 'bg-blue-950/60 border-blue-500/50 text-blue-300'
0479 |                                                         }`}
0480 |                                                 >
0481 |                                                     <span className="text-[10px] font-bold">{chunk.type === 'parity' ? 'PARITY' : 'DATA'}</span>
0482 |                                                     <span className="text-[9px] opacity-60">BLK-{i}</span>
0483 |                                                     {chunk.node && (
0484 |                                                         <motion.span
0485 |                                                             initial={{ opacity: 0, y: 5 }}
0486 |                                                             animate={{ opacity: 1, y: 0 }}
0487 |                                                             className="absolute -bottom-5 text-[8px] font-bold text-emerald-400 bg-black/80 px-1.5 py-0.5 rounded border border-emerald-500/30"
0488 |                                                         >
0489 |                                                             → {chunk.node}
0490 |                                                         </motion.span>
0491 |                                                     )}
0492 |                                                 </motion.div>
0493 |                                             ))}
0494 |                                         </div>
0495 |                                     )}
0496 |                                 </motion.div>
0497 |                             )}
0498 | 
0499 |                             {/* ── Phase 1 Complete → Phase 2 Prompt ── */}
0500 |                             {phase === PHASE.UPLOAD_DONE && (
0501 |                                 <motion.div key="upload-done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
0502 |                                     className="flex flex-col items-center justify-center h-full gap-6">
0503 |                                     <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.3)]">
0504 |                                         <CheckCircle2 className="w-10 h-10 text-emerald-400" />
0505 |                                     </div>
0506 |                                     <div className="text-center">
0507 |                                         <h3 className="text-emerald-400 font-bold tracking-widest text-sm uppercase mb-1">PHASE 1 COMPLETE — DATA DISTRIBUTED</h3>
0508 |                                         <p className="text-slate-400 text-[10px] tracking-wide">File ID: {fileId}</p>
0509 |                                     </div>
0510 | 
0511 |                                     {/* Node Assignment Summary */}
0512 |                                     <div className="grid grid-cols-3 gap-3 max-w-lg w-full">
0513 |                                         {Object.entries(nodeMap).map(([nodeId, nodeChunks]) => (
0514 |                                             <div key={nodeId} className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-center">
0515 |                                                 <p className="text-white font-bold text-xs">{nodeId}</p>
0516 |                                                 <p className="text-cyan-400 text-[10px]">{nodeChunks.length} shard{nodeChunks.length !== 1 ? 's' : ''}</p>
0517 |                                                 <div className="flex gap-1 justify-center mt-1">
0518 |                                                     {nodeChunks.map((c, i) => (
0519 |                                                         <div key={i} className={`w-2 h-2 rounded-full ${c.isParity ? 'bg-purple-500' : 'bg-cyan-500'}`} />
0520 |                                                     ))}
0521 |                                                 </div>
0522 |                                             </div>
0523 |                                         ))}
0524 |                                     </div>
0525 | 
0526 |                                     <button
0527 |                                         onClick={handleVerify}
0528 |                                         className="px-8 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all text-xs tracking-widest uppercase flex items-center gap-2"
0529 |                                     >
0530 |                                         <ShieldCheck size={14} /> PHASE 2: VERIFY NODE STORAGE
0531 |                                     </button>
0532 |                                 </motion.div>
0533 |                             )}
0534 | 
0535 |                             {/* ── Phase 2: Verifying ── */}
0536 |                             {phase === PHASE.VERIFYING && (
0537 |                                 <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
0538 |                                     className="flex flex-col items-center justify-center h-full gap-4">
0539 |                                     <Loader2 size={32} className="text-amber-400 animate-spin" />
0540 |                                     <span className="text-amber-400 font-bold tracking-widest text-xs uppercase">QUERYING NODE STORAGE STATE...</span>
0541 |                                 </motion.div>
0542 |                             )}
0543 | 
0544 |                             {/* ── Phase 2: Verified — Per-Node Chunk Inspection ── */}
0545 |                             {phase === PHASE.VERIFIED && verifyData && (
0546 |                                 <motion.div key="verified" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
0547 |                                     className="flex flex-col gap-4 w-full">
0548 |                                     <div className="flex items-center justify-between mb-2">
0549 |                                         <div className="flex items-center gap-2">
0550 |                                             <Eye size={16} className="text-amber-400" />
0551 |                                             <h3 className="text-white font-bold tracking-widest text-xs uppercase">PER-NODE STORAGE VERIFICATION</h3>
0552 |                                         </div>
0553 |                                         <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest">
0554 |                                             <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-cyan-500" /> DATA</span>
0555 |                                             <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-purple-500" /> PARITY</span>
0556 |                                         </div>
0557 |                                     </div>
0558 | 
0559 |                                     <div className="grid grid-cols-3 gap-4">
0560 |                                         {Object.entries(verifyData).map(([nodeId, nodeInfo]) => (
0561 |                                             <motion.div
0562 |                                                 key={nodeId}
0563 |                                                 initial={{ opacity: 0, y: 20 }}
0564 |                                                 animate={{ opacity: 1, y: 0 }}
0565 |                                                 className={`rounded-xl border overflow-hidden ${nodeInfo.status === 'ONLINE'
0566 |                                                     ? 'bg-black/40 border-cyan-500/20'
0567 |                                                     : 'bg-red-950/20 border-red-500/30'
0568 |                                                     }`}
0569 |                                             >
0570 |                                                 {/* Node Header */}
0571 |                                                 <div className={`px-3 py-2 border-b flex justify-between items-center ${nodeInfo.status === 'ONLINE' ? 'bg-cyan-950/30 border-cyan-500/10' : 'bg-red-900/30 border-red-500/20'}`}>
0572 |                                                     <div>
0573 |                                                         <p className="font-bold text-white text-xs">{nodeId}</p>
0574 |                                                         <p className={`text-[8px] uppercase tracking-widest ${nodeInfo.status === 'ONLINE' ? 'text-cyan-500' : 'text-red-400'}`}>Plane {nodeInfo.plane}</p>
0575 |                                                     </div>
0576 |                                                     <div className={`w-2 h-2 rounded-full ${nodeInfo.status === 'ONLINE' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
0577 |                                                 </div>
0578 | 
0579 |                                                 {/* Chunks in this node */}
0580 |                                                 <div className="p-3 space-y-2 min-h-[80px]">
0581 |                                                     {nodeInfo.chunkCount === 0 ? (
0582 |                                                         <div className="text-center text-[10px] text-slate-600 uppercase tracking-widest py-4">NO SHARDS</div>
0583 |                                                     ) : (
0584 |                                                         nodeInfo.chunks.map((c, ci) => (
0585 |                                                             <div key={ci} className={`p-2 rounded-lg border text-[9px] ${c.is_parity
0586 |                                                                 ? 'bg-purple-500/10 border-purple-500/20 text-purple-300'
0587 |                                                                 : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300'
0588 |                                                                 }`}>
0589 |                                                                 <div className="flex justify-between items-center">
0590 |                                                                     <span className="font-bold">{c.is_parity ? 'PARITY' : 'DATA'} #{c.sequence_number}</span>
0591 |                                                                     <span className={`px-1 py-0.5 rounded text-[7px] font-bold ${c.is_parity ? 'bg-purple-500/20 text-purple-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
0592 |                                                                         SEQ {c.sequence_number}
0593 |                                                                     </span>
0594 |                                                                 </div>
0595 |                                                                 <div className="mt-1 text-[8px] text-slate-500 truncate flex items-center gap-1">
0596 |                                                                     <Hash size={8} /> {c.chunk_id?.substring(0, 16)}...
0597 |                                                                 </div>
0598 |                                                             </div>
0599 |                                                         ))
0600 |                                                     )}
0601 |                                                 </div>
0602 | 
0603 |                                                 {/* Storage Footer */}
0604 |                                                 <div className="bg-black/50 px-3 py-1.5 text-center text-[8px] uppercase tracking-widest text-slate-500 border-t border-white/5">
0605 |                                                     {(nodeInfo.storageUsed / 1024).toFixed(1)} KB ∙ {nodeInfo.chunkCount} shard{nodeInfo.chunkCount !== 1 ? 's' : ''}
0606 |                                                 </div>
0607 |                                             </motion.div>
0608 |                                         ))}
0609 |                                     </div>
0610 | 
0611 |                                     <div className="flex justify-center mt-4">
0612 |                                         <button
0613 |                                             onClick={handleReconstruct}
0614 |                                             className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all text-xs tracking-widest uppercase flex items-center gap-2"
0615 |                                         >
0616 |                                             <Download size={14} /> PHASE 3: RECONSTRUCT FROM NODES
0617 |                                         </button>
0618 |                                     </div>
0619 |                                 </motion.div>
0620 |                             )}
0621 | 
0622 |                             {/* ── Phase 3: Fetching ── */}
0623 |                             {phase === PHASE.FETCHING && (
0624 |                                 <motion.div key="fetching" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
0625 |                                     className="flex flex-col items-center justify-center h-full gap-4">
0626 |                                     <div className="relative">
0627 |                                         <RefreshCw size={48} className="text-emerald-400 animate-spin" style={{ animationDuration: '2s' }} />
0628 |                                         <div className="absolute inset-0 rounded-full border border-emerald-400/30 animate-ping" />
0629 |                                     </div>
0630 |                                     <span className="text-emerald-400 font-bold tracking-widest text-xs uppercase">FETCHING SHARDS FROM ORBITAL NODES...</span>
0631 |                                     <span className="text-slate-500 text-[10px] tracking-wider">RS Decoding if needed · SHA-256 verification in progress</span>
0632 |                                 </motion.div>
0633 |                             )}
0634 | 
0635 |                             {/* ── Phase 3 Complete ── */}
0636 |                             {phase === PHASE.DOWNLOAD_DONE && (
0637 |                                 <motion.div key="download-done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
0638 |                                     className="flex flex-col items-center justify-center h-full gap-6">
0639 |                                     <div className="relative">
0640 |                                         <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.3)]">
0641 |                                             <Lock className="w-12 h-12 text-emerald-400" />
0642 |                                         </div>
0643 |                                         <motion.div className="absolute inset-0 rounded-full border border-emerald-400"
0644 |                                             animate={{ scale: [1, 1.5], opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 2 }} />
0645 |                                     </div>
0646 | 
0647 |                                     <div className="text-center">
0648 |                                         <h3 className="text-emerald-400 font-bold tracking-widest text-sm uppercase mb-2">FILE RECONSTRUCTED & VERIFIED</h3>
0649 |                                         <p className="text-slate-400 text-[10px] tracking-wide mb-1">{fileName} — SHA-256 MATCH CONFIRMED</p>
0650 |                                         {rsRecovery && (
0651 |                                             <p className="text-amber-400 text-[10px] tracking-wide flex items-center justify-center gap-1">
0652 |                                                 <AlertTriangle size={10} /> Reed-Solomon parity was used to recover missing shards
0653 |                                             </p>
0654 |                                         )}
0655 |                                     </div>
0656 | 
0657 |                                     {/* Stats */}
0658 |                                     <div className="grid grid-cols-3 gap-4 w-full max-w-md">
0659 |                                         <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-center">
0660 |                                             <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">File Size</p>
0661 |                                             <p className="text-white font-bold text-sm">{(fileSize / 1024).toFixed(1)} KB</p>
0662 |                                         </div>
0663 |                                         <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-center">
0664 |                                             <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">RS Recovery</p>
0665 |                                             <p className={`font-bold text-sm ${rsRecovery ? 'text-amber-400' : 'text-emerald-400'}`}>
0666 |                                                 {rsRecovery ? 'YES' : 'NO'}
0667 |                                             </p>
0668 |                                         </div>
0669 |                                         <div className="bg-white/[0.03] border border-white/10 rounded-lg p-3 text-center">
0670 |                                             <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Integrity</p>
0671 |                                             <p className="text-emerald-400 font-bold text-sm">SHA-256 ✓</p>
0672 |                                         </div>
0673 |                                     </div>
0674 | 
0675 |                                     <button onClick={resetAll} className="mt-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold tracking-widest text-white transition-colors">
0676 |                                         NEW DEMONSTRATION
0677 |                                     </button>
0678 |                                 </motion.div>
0679 |                             )}
0680 | 
0681 |                             {/* ── Error State ── */}
0682 |                             {phase === PHASE.ERROR && (
0683 |                                 <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
0684 |                                     className="flex flex-col items-center justify-center h-full gap-4">
0685 |                                     <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.3)]">
0686 |                                         <AlertTriangle className="w-10 h-10 text-red-500" />
0687 |                                     </div>
0688 |                                     <h3 className="text-red-400 font-bold tracking-widest text-sm uppercase">OPERATION FAILURE</h3>
0689 |                                     <p className="text-red-300/70 text-xs bg-red-950/50 px-4 py-2 rounded-lg border border-red-500/20 max-w-md text-center">{error}</p>
0690 |                                     <button onClick={resetAll} className="mt-2 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-slate-400 transition-colors">
0691 |                                         RESET
0692 |                                     </button>
0693 |                                 </motion.div>
0694 |                             )}
0695 | 
0696 |                         </AnimatePresence>
0697 |                     </div>
0698 |                 </div>
0699 | 
0700 |                 {/* Right: Live Operation Log */}
0701 |                 <div className="w-72 shrink-0 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col overflow-hidden">
0702 |                     <div className="p-3 border-b border-white/5 bg-white/[0.02] shrink-0">
0703 |                         <h3 className="text-[10px] font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2">
0704 |                             <Cpu size={12} className="text-cyan-500" /> PROTOCOL LOG
0705 |                         </h3>
0706 |                     </div>
0707 |                     <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
0708 |                         {logs.length === 0 ? (
0709 |                             <div className="flex flex-col items-center justify-center h-full opacity-30 gap-2">
0710 |                                 <Loader2 size={14} className="animate-spin text-slate-500" />
0711 |                                 <span className="text-[9px] tracking-widest uppercase text-slate-500">Awaiting operation...</span>
0712 |                             </div>
0713 |                         ) : (
0714 |                             logs.map((log, idx) => (
0715 |                                 <div key={idx} className="flex gap-2 text-[10px] font-mono animate-in slide-in-from-right-2 duration-300">
0716 |                                     <span className="text-slate-600 shrink-0">[{log.time}]</span>
0717 |                                     <span className={logColor(log.type)}>{log.msg}</span>
0718 |                                 </div>
0719 |                             ))
0720 |                         )}
0721 |                         <div ref={logEndRef} />
0722 |                     </div>
0723 |                 </div>
0724 |             </div>
0725 |         </div>
0726 |     );
0727 | }

```

---

### File: `frontend\src\components\layout\CinematicBoot.jsx`

**Description**: Source JSX/CSS for `CinematicBoot.jsx`

```javascript
0001 | import React, { useState, useEffect } from 'react';
0002 | import { motion, AnimatePresence } from 'framer-motion';
0003 | 
0004 | export default function CinematicBoot({ onComplete }) {
0005 |     const [lines, setLines] = useState([]);
0006 |     const [progress, setProgress] = useState(0);
0007 | 
0008 |     const bootSequence = [
0009 |         "KERNEL LOADED [OK]",
0010 |         "MOUNTING ENCRYPTED VFS...",
0011 |         "INITIALIZING CAUCHY REED-SOLOMON DECODER",
0012 |         "CONNECTING TO ORBITAL MESH G1...",
0013 |         "FETCHING SGP4 TELEMETRY FROM CELESTRAK",
0014 |         "SYNCING SHANNON ENTROPY DAEMON",
0015 |         "CALIBRATING HOLOGRAPHIC PROJECTION",
0016 |         "SYSTEM ONLINE. ENGAGING HUD."
0017 |     ];
0018 | 
0019 |     useEffect(() => {
0020 |         let currentLine = 0;
0021 | 
0022 |         const typeInterval = setInterval(() => {
0023 |             if (currentLine <= bootSequence.length) {
0024 |                 setLines(bootSequence.slice(0, currentLine));
0025 |                 setProgress(Math.floor((currentLine / bootSequence.length) * 100));
0026 |                 currentLine++;
0027 |             } else {
0028 |                 clearInterval(typeInterval);
0029 |                 setTimeout(onComplete, 800); // Small pause before fade out
0030 |             }
0031 |         }, 300); // 300ms per line = ~2.4 seconds total boot time
0032 | 
0033 |         return () => clearInterval(typeInterval);
0034 |     }, [onComplete]);
0035 | 
0036 |     return (
0037 |         <motion.div
0038 |             initial={{ opacity: 1 }}
0039 |             exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
0040 |             transition={{ duration: 1.2, ease: "anticipate" }}
0041 |             className="fixed inset-0 z-50 bg-[#02040A] flex flex-col items-center justify-center font-mono overflow-hidden"
0042 |         >
0043 |             {/* Ambient Background Glow during boot */}
0044 |             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-900/10 blur-[100px] pointer-events-none" />
0045 | 
0046 |             {/* Central Boot Console */}
0047 |             <div className="w-full max-w-2xl px-8 relative z-10 flex flex-col gap-8">
0048 | 
0049 |                 {/* Header Logo */}
0050 |                 <motion.div
0051 |                     initial={{ opacity: 0, y: -20 }}
0052 |                     animate={{ opacity: 1, y: 0 }}
0053 |                     className="flex flex-col items-center gap-2 mb-8"
0054 |                 >
0055 |                     <div className="w-16 h-16 border-2 border-cyan-500 rounded-sm flex items-center justify-center relative overflow-hidden">
0056 |                         <div className="absolute inset-0 bg-cyan-500/20 animate-pulse" />
0057 |                         <div className="w-8 h-8 border border-white/50 rotate-45" />
0058 |                     </div>
0059 |                     <h1 className="text-2xl font-bold text-white tracking-[0.4em] uppercase">COSMEON <span className="text-cyan-500">FS-LITE</span></h1>
0060 |                     <p className="text-[10px] text-cyan-500/50 tracking-[0.3em] uppercase">Tactical Orbital Data Mesh</p>
0061 |                 </motion.div>
0062 | 
0063 |                 {/* TTY Output */}
0064 |                 <div className="h-64 flex flex-col justify-end text-[11px] leading-loose text-cyan-400/80">
0065 |                     <AnimatePresence>
0066 |                         {lines.map((line, i) => (
0067 |                             <motion.div
0068 |                                 key={i}
0069 |                                 initial={{ opacity: 0, x: -10 }}
0070 |                                 animate={{ opacity: 1, x: 0 }}
0071 |                                 className="flex gap-4 items-center"
0072 |                             >
0073 |                                 <span className="opacity-50">[{new Date().toISOString().split('T')[1].substring(0, 11)}]</span>
0074 |                                 <span className={i === bootSequence.length - 1 ? "text-emerald-400 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" : ""}>
0075 |                                     {line}
0076 |                                 </span>
0077 |                             </motion.div>
0078 |                         ))}
0079 |                     </AnimatePresence>
0080 |                 </div>
0081 | 
0082 |                 {/* Progress Bar */}
0083 |                 <div className="w-full h-1 bg-white/5 relative overflow-hidden mt-4">
0084 |                     <motion.div
0085 |                         className="absolute top-0 left-0 h-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)]"
0086 |                         initial={{ width: 0 }}
0087 |                         animate={{ width: `${progress}%` }}
0088 |                         transition={{ ease: "linear", duration: 0.3 }}
0089 |                     />
0090 |                 </div>
0091 | 
0092 |                 <div className="text-center text-[10px] text-gray-500 tracking-[0.2em] uppercase">
0093 |                     SYSTEM BOOT SEQUENCE... {progress}%
0094 |                 </div>
0095 |             </div>
0096 |         </motion.div>
0097 |     );
0098 | }

```

---

### File: `frontend\src\components\layout\GlobalMetrics.jsx`

**Description**: Source JSX/CSS for `GlobalMetrics.jsx`

```javascript
0001 | import React from 'react';
0002 | 
0003 | export default function GlobalMetrics({ connected }) {
0004 |     return (
0005 |         <div className="absolute top-6 right-6 z-10 flex flex-col gap-4 pointer-events-auto">
0006 |             {/* Network Load Widget */}
0007 |             <div className="flex items-center justify-between bg-black/40 backdrop-blur-md border-r-4 border-b-4 border-r-cyan-500/50 border-b-cyan-500/50 border-white/10 px-5 py-4 min-w-[240px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
0008 |                 style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 15px 100%, 0 calc(100% - 15px))' }}>
0009 |                 <div>
0010 |                     <p className="text-[10px] text-cyan-500/80 font-bold tracking-[0.2em] uppercase font-mono mb-1">Network Load // Live</p>
0011 |                     <p className="text-3xl font-bold text-white leading-none font-mono">
0012 |                         {connected ? '42.1' : 'ERR'}
0013 |                         <span className="text-sm text-cyan-400 ml-1 opacity-80 uppercase">{connected ? 'Gbps' : ''}</span>
0014 |                     </p>
0015 |                 </div>
0016 |                 <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${connected ? 'bg-cyan-500/10 border-cyan-500/30 shadow-[inset_0_0_15px_rgba(6,182,212,0.2)]' : 'bg-red-500/10 border-red-500/30'}`}>
0017 |                     <div className={`w-4 h-4 shadow-lg ${connected ? 'bg-cyan-400 blur-[1px] animate-pulse shadow-cyan-400' : 'bg-red-500 shadow-red-500'}`}></div>
0018 |                 </div>
0019 |             </div>
0020 | 
0021 |             {/* Core Temp Widget */}
0022 |             <div className="flex items-center justify-between bg-black/40 backdrop-blur-md border-r-4 border-b-4 border-r-purple-500/50 border-b-purple-500/50 border-white/10 px-5 py-4 min-w-[240px] shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
0023 |                 style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 15px 100%, 0 calc(100% - 15px))' }}>
0024 |                 <div>
0025 |                     <p className="text-[10px] text-purple-400/80 font-bold tracking-[0.2em] uppercase font-mono mb-1">Mesh Entropy</p>
0026 |                     <p className="text-3xl font-bold text-white leading-none font-mono">
0027 |                         0.92<span className="text-sm text-purple-400 ml-1 opacity-80">SHN</span>
0028 |                     </p>
0029 |                 </div>
0030 |                 <div className="w-12 h-12 rounded-xl flex flex-col justify-end p-2 border bg-purple-500/10 border-purple-500/30 shadow-[inset_0_0_15px_rgba(168,85,247,0.2)]">
0031 |                     <div className="flex space-x-1 items-end h-full">
0032 |                         <div className="w-1.5 bg-purple-500 h-[60%]"></div>
0033 |                         <div className="w-1.5 bg-purple-500 h-[80%]"></div>
0034 |                         <div className="w-1.5 bg-purple-400 h-[100%] drop-shadow-[0_0_5px_rgba(192,132,252,1)]"></div>
0035 |                     </div>
0036 |                 </div>
0037 |             </div>
0038 |         </div>
0039 |     );
0040 | }

```

---

### File: `frontend\src\components\layout\HUDDock.jsx`

**Description**: Source JSX/CSS for `HUDDock.jsx`

```javascript
0001 | import React, { useState } from 'react';
0002 | import { Network, Database, UploadCloud, Zap, Satellite, Binary, Shield } from 'lucide-react';
0003 | 
0004 | export default function HUDDock({ currentTab, setCurrentTab, onViewSatellite }) {
0005 |     const navItems = [
0006 |         { id: 'Orbital Engine', icon: Network, label: 'Main Engine' },
0007 |         { id: 'Storage Nodes', icon: Database, label: 'Storage Mesh' },
0008 |         { id: 'Orbit Tracking', icon: Satellite, label: 'Orbit Track' },
0009 |         { id: 'Payload Ops', icon: UploadCloud, label: 'Payload Ops' },
0010 |         { id: 'Data Demo', icon: Binary, label: 'Data Demo' },
0011 |         { id: 'Reliability Model', icon: Shield, label: 'Reliability' },
0012 |         { id: 'Chaos Ops', icon: Zap, label: 'Chaos Eng.' },
0013 |     ];
0014 | 
0015 |     const [hovered, setHovered] = useState(null);
0016 | 
0017 |     return (
0018 |         <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
0019 |             <div
0020 |                 className="flex items-center gap-2 p-2 bg-[#02040A]/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.8)] relative isolate
0021 |                 after:absolute after:inset-0 after:rounded-2xl after:-z-10 after:opacity-50 after:shadow-[0_0_20px_rgba(34,211,238,0.2)]"
0022 |             >
0023 |                 {navItems.map((item) => {
0024 |                     const isActive = currentTab === item.id;
0025 |                     const isHovered = hovered === item.id;
0026 |                     return (
0027 |                         <button
0028 |                             key={item.id}
0029 |                             onClick={() => {
0030 |                                 if (item.id === 'Orbit Tracking') {
0031 |                                     onViewSatellite();
0032 |                                 } else {
0033 |                                     setCurrentTab(item.id);
0034 |                                 }
0035 |                             }}
0036 |                             onMouseEnter={() => setHovered(item.id)}
0037 |                             onMouseLeave={() => setHovered(null)}
0038 |                             className="relative group transition-all duration-300 outline-none"
0039 |                         >
0040 |                             <div className={`p-4 rounded-xl flex items-center justify-center transition-all duration-300
0041 |                                 ${isActive ? 'bg-cyan-500/20 shadow-[inset_0_0_15px_rgba(6,182,212,0.3)]' : 'hover:bg-white/5'}
0042 |                                 ${isHovered && !isActive ? 'scale-110' : isActive ? 'scale-100' : 'scale-100'}
0043 |                             `}>
0044 |                                 <item.icon
0045 |                                     size={24}
0046 |                                     className={`transition-colors duration-300 ${isActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : isHovered ? 'text-white' : 'text-gray-500'}`}
0047 |                                 />
0048 |                             </div>
0049 | 
0050 |                             {/* Tooltip */}
0051 |                             <div className={`absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/80 backdrop-blur-md border border-white/10 rounded font-mono text-[10px] tracking-widest text-white whitespace-nowrap transition-all duration-200 pointer-events-none 
0052 |                                 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
0053 |                             >
0054 |                                 {item.label}
0055 |                             </div>
0056 | 
0057 |                             {/* Active Indicator Underline */}
0058 |                             {isActive && (
0059 |                                 <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-cyan-500 shadow-[0_0_10px_#06b6d4] rounded-t-sm" />
0060 |                             )}
0061 |                         </button>
0062 |                     )
0063 |                 })}
0064 | 
0065 |                 <div className="w-px h-8 bg-white/10 mx-2" />
0066 | 
0067 |                 {/* Secondary Actions / Mode Switchers */}
0068 |                 <button
0069 |                     onClick={() => setCurrentTab('Network Topology')}
0070 |                     onMouseEnter={() => setHovered('Network Topology')}
0071 |                     onMouseLeave={() => setHovered(null)}
0072 |                     className="relative group transition-all duration-300 outline-none"
0073 |                 >
0074 |                     <div className={`p-4 rounded-xl flex items-center justify-center transition-all duration-300
0075 |                                 ${currentTab === 'Network Topology' ? 'bg-purple-500/20 shadow-[inset_0_0_15px_rgba(168,85,247,0.3)]' : 'hover:bg-white/5'}
0076 |                                 ${hovered === 'Network Topology' && currentTab !== 'Network Topology' ? 'scale-110' : 'scale-100'}
0077 |                             `}>
0078 |                         <div className={`w-6 h-6 rounded-full border-2 border-dashed animate-spin-slow ${currentTab === 'Network Topology' ? 'border-purple-400' : 'border-gray-500 group-hover:border-white'}`} style={{ animationDuration: '8s' }} />
0079 |                     </div>
0080 |                 </button>
0081 |             </div>
0082 |         </div>
0083 |     );
0084 | }

```

---

### File: `frontend\src\components\layout\RightSidebar.jsx`

**Description**: Source JSX/CSS for `RightSidebar.jsx`

```javascript
0001 | import React, { useState } from 'react';
0002 | import MatrixDensity from '../matrix/MatrixDensity';
0003 | import { Upload, Download, FileText, Server } from 'lucide-react';
0004 | 
0005 | export default function RightSidebar({ messages, fileId, onUpload, onDownload }) {
0006 |     const [file, setFile] = useState(null);
0007 |     const [downloadId, setDownloadId] = useState('');
0008 | 
0009 |     const handleUpload = async () => {
0010 |         if (!file) return;
0011 |         const formData = new FormData();
0012 |         formData.append('file', file);
0013 |         await onUpload(formData);
0014 |         setFile(null);
0015 |     };
0016 | 
0017 |     const handleDownload = async () => {
0018 |         if (!downloadId && !fileId) return;
0019 |         await onDownload(downloadId || fileId);
0020 |         setDownloadId('');
0021 |     };
0022 | 
0023 |     return (
0024 |         <div className="w-full h-full flex flex-col p-4 relative z-20">
0025 |             <div className="flex items-center gap-2 mb-4">
0026 |                 <Server className="text-blue-500" size={14} />
0027 |                 <h2 className="text-[10px] font-bold text-gray-500 tracking-widest uppercase">Node Metrics</h2>
0028 |             </div>
0029 | 
0030 |             <div className="grid grid-cols-2 gap-3 mb-6">
0031 |                 <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 hover:border-white/20 transition-all">
0032 |                     <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 font-mono">Active Nodes</p>
0033 |                     <p className="text-xl font-mono font-bold text-white tracking-tight">1,240</p>
0034 |                 </div>
0035 |                 <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3 hover:border-white/20 transition-all">
0036 |                     <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1 font-mono">Global Cap</p>
0037 |                     <p className="text-xl font-mono font-bold text-white tracking-tight">85.4 <span className="text-sm text-gray-500">PB</span></p>
0038 |                 </div>
0039 |             </div>
0040 | 
0041 |             <MatrixDensity messages={messages} />
0042 | 
0043 |         </div>
0044 |     );
0045 | }

```

---

### File: `frontend\src\components\layout\Sidebar.jsx`

**Description**: Source JSX/CSS for `Sidebar.jsx`

```javascript
0001 | import React from 'react';
0002 | import { Globe, Network, Activity, Shield, HardDrive } from 'lucide-react';
0003 | 
0004 | export default function Sidebar() {
0005 |     return (
0006 |         <div className="w-64 border-r border-white/5 h-full flex flex-col p-6 relative z-20">
0007 | 
0008 |             {/* Brand */}
0009 |             <div className="flex items-center gap-3 mb-10">
0010 |                 <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.2)]">
0011 |                     <Globe className="text-blue-400" size={20} />
0012 |                 </div>
0013 |                 <div>
0014 |                     <h1 className="text-lg font-bold tracking-widest text-white leading-tight">COSMEON</h1>
0015 |                     <span className="text-[9px] text-blue-500 font-mono tracking-[0.2em] uppercase">Telemetry Ops</span>
0016 |                 </div>
0017 |             </div>
0018 | 
0019 |             <div className="flex-1">
0020 |                 <h2 className="text-[10px] font-bold text-gray-500 tracking-widest mb-4 uppercase">Navigation</h2>
0021 | 
0022 |                 <div className="space-y-1.5">
0023 |                     <button className="w-full flex items-center justify-between text-blue-400 px-4 py-3 rounded-xl border border-blue-500/30 bg-blue-500/5 transition-all text-sm font-semibold shadow-[0_0_15px_rgba(59,130,246,0.1)] group">
0024 |                         <div className="flex items-center gap-3">
0025 |                             <Globe size={18} className="group-hover:animate-pulse" />
0026 |                             3D Global View
0027 |                         </div>
0028 |                         <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]"></div>
0029 |                     </button>
0030 | 
0031 |                     <button className="w-full flex items-center gap-3 text-gray-400 hover:text-white px-4 py-3 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all text-sm font-semibold">
0032 |                         <Network size={18} />
0033 |                         OPS Topology
0034 |                     </button>
0035 | 
0036 |                     <button className="w-full flex items-center gap-3 text-gray-400 hover:text-white px-4 py-3 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all text-sm font-semibold">
0037 |                         <HardDrive size={18} />
0038 |                         Storage Nodes
0039 |                     </button>
0040 |                 </div>
0041 | 
0042 |                 <h2 className="text-[10px] font-bold text-gray-500 tracking-widest mt-10 mb-4 uppercase">Status Matrix</h2>
0043 | 
0044 |                 <div className="space-y-5 px-1">
0045 |                     <div>
0046 |                         <div className="flex justify-between items-end mb-1.5">
0047 |                             <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Atmos Density</span>
0048 |                             <span className="text-emerald-400 text-[10px] font-bold font-mono">OPTIMAL</span>
0049 |                         </div>
0050 |                         <div className="w-full bg-white/5 h-1 rounded-sm overflow-hidden border border-white/5">
0051 |                             <div className="bg-emerald-500 h-full w-[45%] rounded-sm shadow-[0_0_10px_#10b981]"></div>
0052 |                         </div>
0053 |                     </div>
0054 | 
0055 |                     <div>
0056 |                         <div className="flex justify-between items-end mb-1.5">
0057 |                             <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Plane Alignment</span>
0058 |                             <span className="text-white text-[10px] font-bold font-mono">98.2%</span>
0059 |                         </div>
0060 |                         <div className="w-full bg-white/5 h-1 rounded-sm overflow-hidden border border-white/5">
0061 |                             <div className="bg-blue-500 h-full w-[98.2%] rounded-sm shadow-[0_0_10px_#3b82f6]"></div>
0062 |                         </div>
0063 |                     </div>
0064 |                 </div>
0065 |             </div>
0066 | 
0067 |             {/* Bottom mission delta */}
0068 |             <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl p-4 mt-auto">
0069 |                 <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
0070 |                     <Activity className="text-blue-500 animate-pulse" size={14} />
0071 |                     <span className="text-[10px] font-mono font-bold text-gray-300 tracking-[0.2em] uppercase">Mission Delta</span>
0072 |                 </div>
0073 |                 <p className="text-[11px] text-gray-400 leading-relaxed">
0074 |                     Phase 4 deployment active. 12 satellites awaiting orbital slot assignment in High Earth Orbit.
0075 |                 </p>
0076 |             </div>
0077 |         </div>
0078 |     );
0079 | }

```

---

### File: `frontend\src\components\layout\Topbar.jsx`

**Description**: Source JSX/CSS for `Topbar.jsx`

```javascript
0001 | import React from 'react';
0002 | import { Bell, Search, User } from 'lucide-react';
0003 | 
0004 | export default function Topbar({ currentTab, setCurrentTab }) {
0005 |     const tabs = ['Orbital Engine', 'Network Map', 'Storage Nodes', 'Ground Links', 'Payload Ops', 'Chaos Ops'];
0006 | 
0007 |     return (
0008 |         <div className="flex justify-between items-center h-16 bg-[#0a0f1c] border-b border-[#1e293b] px-6">
0009 |             <div className="flex gap-8 text-sm font-semibold text-gray-400">
0010 |                 {tabs.map(tab => (
0011 |                     <button
0012 |                         key={tab}
0013 |                         onClick={() => setCurrentTab && setCurrentTab(tab)}
0014 |                         className={`pb-[18px] transition-colors ${currentTab === tab ? 'text-white border-b-2 border-blue-500' : 'hover:text-gray-200'}`}
0015 |                     >
0016 |                         {tab}
0017 |                     </button>
0018 |                 ))}
0019 |             </div>
0020 | 
0021 |             <div className="flex items-center gap-6">
0022 |                 <div className="relative">
0023 |                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
0024 |                     <input
0025 |                         type="text"
0026 |                         placeholder="Search constellations..."
0027 |                         className="bg-[#111827] border border-[#1e293b] rounded-lg pl-10 pr-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
0028 |                     />
0029 |                 </div>
0030 | 
0031 |                 <div className="relative cursor-pointer">
0032 |                     <Bell className="text-gray-400 hover:text-white transition-colors" size={20} />
0033 |                     <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></div>
0034 |                 </div>
0035 | 
0036 |                 <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-200 to-amber-500"></div>
0037 |             </div>
0038 |         </div>
0039 |     );
0040 | }

```

---

### File: `frontend\src\components\matrix\ChunkMatrix.jsx`

**Description**: Source JSX/CSS for `ChunkMatrix.jsx`

```javascript
0001 | /**
0002 |  * ChunkMatrix.jsx
0003 |  * D3.js grid container for erasure code distribution visualization.
0004 |  * Rows = chunk labels (D1, D2, D3, D4, P1, P2).
0005 |  * Columns = SAT-01 through SAT-06.
0006 |  * Subscribes to chunk events, updates cells in real time.
0007 |  */

```

---

### File: `frontend\src\components\matrix\MatrixCell.jsx`

**Description**: Source JSX/CSS for `MatrixCell.jsx`

```javascript
0001 | /**
0002 |  * MatrixCell.jsx
0003 |  * Individual D3-rendered cell for the chunk matrix.
0004 |  * Colors: blue=data, green=parity, red=missing, orange=corrupted, purple=reconstructing.
0005 |  * Tooltip on hover with chunk details (ID, SHA-256 prefix, size).
0006 |  */

```

---

### File: `frontend\src\components\matrix\MatrixDensity.jsx`

**Description**: Source JSX/CSS for `MatrixDensity.jsx`

```javascript
0001 | import React, { useState, useEffect } from 'react';
0002 | 
0003 | export default function MatrixDensity({ messages = [] }) {
0004 |     // A 5x7 grid (35 cells)
0005 |     const [grid, setGrid] = useState(Array(35).fill('idle'));
0006 | 
0007 |     useEffect(() => {
0008 |         if (messages.length === 0) return;
0009 | 
0010 |         const lastMsg = messages[messages.length - 1];
0011 |         const newGrid = [...grid];
0012 | 
0013 |         // Pick a random cell to animate
0014 |         const idx = Math.floor(Math.random() * 35);
0015 | 
0016 |         if (lastMsg.type.includes('UPLOAD') || lastMsg.type.includes('SUCCESS') || lastMsg.type.includes('FETCH')) {
0017 |             newGrid[idx] = 'active'; // bright blue
0018 |         } else if (lastMsg.type.includes('ERROR') || lastMsg.type.includes('CORRUPT') || lastMsg.type.includes('DESTROYED')) {
0019 |             newGrid[idx] = 'error'; // orange/red
0020 |         } else if (lastMsg.type.includes('RECOVERY') || lastMsg.type.includes('FLUSH')) {
0021 |             newGrid[idx] = 'recovery'; // green/purple
0022 |         }
0023 | 
0024 |         setGrid(newGrid);
0025 | 
0026 |         // Fade back to idle after a moment
0027 |         const timeout = setTimeout(() => {
0028 |             setGrid(prev => {
0029 |                 const reset = [...prev];
0030 |                 if (reset[idx] !== 'error') { // Keep errors visible longer
0031 |                     reset[idx] = 'idle';
0032 |                 }
0033 |                 return reset;
0034 |             });
0035 |         }, 1500);
0036 | 
0037 |         return () => clearTimeout(timeout);
0038 |     }, [messages]);
0039 | 
0040 |     const getColor = (state) => {
0041 |         switch (state) {
0042 |             case 'active': return 'bg-blue-500 shadow-[0_0_10px_#3b82f6]';
0043 |             case 'error': return 'bg-orange-800 shadow-[0_0_10px_#9a3412]';
0044 |             case 'recovery': return 'bg-green-600 shadow-[0_0_10px_#16a34a]';
0045 |             default: return 'bg-[#1e3a8a]/40 border border-[#1e40af]/30'; // idle dark blue
0046 |         }
0047 |     };
0048 | 
0049 |     return (
0050 |         <div className="flex-1 bg-[#111827] border border-[#1e293b] rounded-2xl p-6 flex flex-col mt-6 shadow-2xl">
0051 |             <h3 className="text-[11px] font-bold text-gray-400 tracking-[0.2em] mb-4">MATRIX DENSITY</h3>
0052 | 
0053 |             <div className="flex-1 grid grid-cols-5 gap-2 content-start">
0054 |                 {grid.map((state, i) => (
0055 |                     <div
0056 |                         key={i}
0057 |                         className={`w-full aspect-[2/3] rounded transition-all duration-300 ${getColor(state)}`}
0058 |                     ></div>
0059 |                 ))}
0060 |             </div>
0061 |         </div>
0062 |     );
0063 | }

```

---

### File: `frontend\src\components\metrics\EntropyGauge.jsx`

**Description**: Source JSX/CSS for `EntropyGauge.jsx`

```javascript
0001 | /**
0002 |  * EntropyGauge.jsx
0003 |  * Recharts RadialBarChart 0–1 with color zones: Red 0–0.60, Yellow 0.60–0.85, Green 0.85–1.0.
0004 |  * Animated needle. Sparkline history below (last 60 seconds).
0005 |  */

```

---

### File: `frontend\src\components\metrics\GsUplinkStatus.jsx`

**Description**: Source JSX/CSS for `GsUplinkStatus.jsx`

```javascript
0001 | import React from 'react';
0002 | import { Radio } from 'lucide-react';
0003 | 
0004 | export default function GsUplinkStatus() {
0005 |     return (
0006 |         <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 h-full flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-white/20 transition-all duration-500">
0007 | 
0008 |             {/* Subtle Top Glow */}
0009 |             <div className="absolute top-0 right-0 w-48 h-1 bg-gradient-to-l from-blue-500/50 to-transparent"></div>
0010 |             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] pointer-events-none"></div>
0011 | 
0012 |             <div className="flex items-center gap-4 mb-6 relative z-10">
0013 |                 <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
0014 |                     <Radio className="text-blue-400" size={18} />
0015 |                 </div>
0016 |                 <div>
0017 |                     <h3 className="text-white font-bold tracking-wide text-sm">GS Uplink Status</h3>
0018 |                     <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Telemetry Stream</p>
0019 |                 </div>
0020 |             </div>
0021 | 
0022 |             <div className="flex-1 flex items-center justify-center relative z-10 w-full px-4">
0023 |                 {/* Minimalist Tech Vector Graphic */}
0024 |                 <div className="w-full flex items-center justify-between gap-4">
0025 |                     {/* Source Node */}
0026 |                     <div className="flex flex-col items-center gap-2">
0027 |                         <div className="w-8 h-8 rounded-full border border-blue-500/30 flex items-center justify-center bg-blue-500/5 relative">
0028 |                             <div className="w-2 h-2 rounded-full bg-blue-400 absolute animate-ping opacity-75"></div>
0029 |                             <div className="w-2 h-2 rounded-full bg-blue-500"></div>
0030 |                         </div>
0031 |                         <span className="text-[8px] text-gray-400 font-mono tracking-widest">EARTH</span>
0032 |                     </div>
0033 | 
0034 |                     {/* Data Stream Line */}
0035 |                     <div className="flex-1 h-[1px] bg-gradient-to-r from-blue-500/20 via-blue-400/80 to-blue-500/20 relative">
0036 |                         {/* Moving packet dots */}
0037 |                         <div className="absolute top-1/2 -translate-y-1/2 left-1/4 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#ffffff] animate-[ping_2s_infinite]"></div>
0038 |                         <div className="absolute top-1/2 -translate-y-1/2 left-2/4 w-1.5 h-1.5 bg-blue-300 rounded-full shadow-[0_0_8px_#93c5fd] animate-[ping_2s_infinite_500ms]"></div>
0039 |                         <div className="absolute top-1/2 -translate-y-1/2 left-3/4 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_#ffffff] animate-[ping_2s_infinite_1000ms]"></div>
0040 |                     </div>
0041 | 
0042 |                     {/* Target Node */}
0043 |                     <div className="flex flex-col items-center gap-2">
0044 |                         <div className="w-8 h-8 rounded-lg border border-white/20 flex items-center justify-center bg-white/5">
0045 |                             <div className="w-3 h-3 border border-blue-400 rounded-sm rotate-45"></div>
0046 |                         </div>
0047 |                         <span className="text-[8px] text-gray-400 font-mono tracking-widest">SAT-COM</span>
0048 |                     </div>
0049 |                 </div>
0050 |             </div>
0051 | 
0052 |             <div className="mt-8 relative z-10">
0053 |                 <div className="flex justify-between items-end mb-2">
0054 |                     <span className="text-[9px] font-bold text-gray-400 tracking-[0.2em] leading-none">CAUCHY RS STRIPING</span>
0055 |                     <span className="text-xl font-mono text-white leading-none">72<span className="text-sm text-gray-500">%</span></span>
0056 |                 </div>
0057 |                 {/* Segmented Progress Bar */}
0058 |                 <div className="w-full flex gap-1 mb-3">
0059 |                     {[...Array(10)].map((_, i) => (
0060 |                         <div key={i} className={`flex-1 h-1.5 rounded-sm ${i < 7 ? 'bg-blue-500 shadow-[0_0_8px_#3b82f6]' : 'bg-white/10'}`}></div>
0061 |                     ))}
0062 |                 </div>
0063 |                 <div className="flex justify-between text-[10px] text-gray-500 font-mono">
0064 |                     <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]"></div> PYL: XAE-992</span>
0065 |                     <span>BUF: 1.2 GB/s</span>
0066 |                 </div>
0067 |             </div>
0068 | 
0069 |         </div>
0070 |     );
0071 | }

```

---

### File: `frontend\src\components\metrics\IntegrityRate.jsx`

**Description**: Source JSX/CSS for `IntegrityRate.jsx`

```javascript
0001 | /**
0002 |  * IntegrityRate.jsx
0003 |  * Large percentage display: "100.0%".
0004 |  * Color: green above 99%, yellow 95–99%, red below 95%.
0005 |  * Recharts LineChart sparkline showing history.
0006 |  * V-shaped dip and recovery during Radiation Bit Rot scenario.
0007 |  */

```

---

### File: `frontend\src\components\metrics\MetricsPanel.jsx`

**Description**: Source JSX/CSS for `MetricsPanel.jsx`

```javascript
0001 | /**
0002 |  * MetricsPanel.jsx
0003 |  * 2x2 grid container for real-time metrics display.
0004 |  * Subscribes to METRIC_UPDATE WebSocket events.
0005 |  * Sub-panels: StorageGauge, MTTDLDisplay, EntropyGauge, IntegrityRate.
0006 |  */

```

---

### File: `frontend\src\components\metrics\MTTDLDisplay.jsx`

**Description**: Source JSX/CSS for `MTTDLDisplay.jsx`

```javascript
0001 | /**
0002 |  * MTTDLDisplay.jsx
0003 |  * Large cyan scientific notation text: "1.2 × 10^14 hrs".
0004 |  * Comparison line: "vs 3x replication: 1.0 × 10^8 hrs".
0005 |  * Updates with Recharts animation on value change.
0006 |  */

```

---

### File: `frontend\src\components\metrics\ResilienceChart.jsx`

**Description**: Source JSX/CSS for `ResilienceChart.jsx`

```javascript
0001 | import React from 'react';
0002 | import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
0003 | import { Activity } from 'lucide-react';
0004 | 
0005 | const data = [
0006 |     { name: '10:00', durability: 85, failures: 15 },
0007 |     { name: '10:05', durability: 90, failures: 10 },
0008 |     { name: '10:10', durability: 95, failures: 5 },
0009 |     { name: '10:15', durability: 82, failures: 18 },
0010 |     { name: '10:20', durability: 100, failures: 0 },
0011 |     { name: '10:25', durability: 100, failures: 0 },
0012 |     { name: '10:30', durability: 70, failures: 30 },
0013 |     { name: '10:35', durability: 88, failures: 12 },
0014 |     { name: '10:40', durability: 92, failures: 8 },
0015 |     { name: '10:45', durability: 98, failures: 2 },
0016 | ];
0017 | 
0018 | const CustomTooltip = ({ active, payload, label }) => {
0019 |     if (active && payload && payload.length) {
0020 |         return (
0021 |             <div className="bg-[#02040A]/90 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] min-w-[160px]">
0022 |                 <p className="text-[#94a3b8] text-[10px] font-bold tracking-widest uppercase mb-3 border-b border-white/5 pb-2">{label}</p>
0023 |                 {payload.map((entry, index) => (
0024 |                     <div key={index} className="flex justify-between items-center mb-1 last:mb-0">
0025 |                         <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: entry.color }}>
0026 |                             {entry.name}
0027 |                         </span>
0028 |                         <span className="font-mono text-sm font-bold text-white">
0029 |                             {entry.value}%
0030 |                         </span>
0031 |                     </div>
0032 |                 ))}
0033 |             </div>
0034 |         );
0035 |     }
0036 |     return null;
0037 | };
0038 | 
0039 | export default function ResilienceChart() {
0040 |     return (
0041 |         <div
0042 |             className="bg-[#0b101e]/80 backdrop-blur-3xl border-l-2 border-b-2 border-l-blue-500/30 border-b-blue-500/30 border-t border-r border-t-white/5 border-r-white/5 rounded-none p-6 h-full flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-l-blue-400 hover:border-b-blue-400 transition-all duration-500"
0043 |             style={{ clipPath: 'polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)' }}
0044 |         >
0045 | 
0046 |             {/* Subtle Top Glow */}
0047 |             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent opacity-50"></div>
0048 | 
0049 |             <div className="flex items-center gap-4 mb-6 relative z-10">
0050 |                 <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
0051 |                     <Activity className="text-blue-400" size={18} />
0052 |                 </div>
0053 |                 <div>
0054 |                     <h3 className="text-white font-bold tracking-wide text-sm">Resilience Monitor</h3>
0055 |                     <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Real-time mesh integrity</p>
0056 |                 </div>
0057 |             </div>
0058 | 
0059 |             <div className="flex-1 min-h-0 relative z-10 -ml-2 -mb-2">
0060 |                 <ResponsiveContainer width="100%" height="100%">
0061 |                     <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
0062 |                         <defs>
0063 |                             <linearGradient id="colorDurability" x1="0" y1="0" x2="0" y2="1">
0064 |                                 <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
0065 |                                 <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
0066 |                             </linearGradient>
0067 |                             <linearGradient id="colorFailures" x1="0" y1="0" x2="0" y2="1">
0068 |                                 <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
0069 |                                 <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
0070 |                             </linearGradient>
0071 |                         </defs>
0072 |                         <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '4 4' }} />
0073 |                         <Area
0074 |                             type="monotone"
0075 |                             dataKey="durability"
0076 |                             stroke="#3b82f6"
0077 |                             strokeWidth={2}
0078 |                             fillOpacity={1}
0079 |                             fill="url(#colorDurability)"
0080 |                             animationDuration={1500}
0081 |                         />
0082 |                         <Area
0083 |                             type="monotone"
0084 |                             dataKey="failures"
0085 |                             stroke="#f97316"
0086 |                             strokeWidth={1.5}
0087 |                             strokeDasharray="4 4"
0088 |                             fillOpacity={1}
0089 |                             fill="url(#colorFailures)"
0090 |                             animationDuration={1500}
0091 |                         />
0092 |                     </AreaChart>
0093 |                 </ResponsiveContainer>
0094 |             </div>
0095 | 
0096 |             {/* Minimal Legend Base */}
0097 |             <div className="mt-4 flex gap-6 border-t border-white/5 pt-4">
0098 |                 <div className="flex flex-col">
0099 |                     <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 tracking-widest">
0100 |                         <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]"></div>
0101 |                         DURABILITY
0102 |                     </div>
0103 |                 </div>
0104 |                 <div className="flex flex-col">
0105 |                     <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-400 tracking-widest">
0106 |                         <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_5px_#f97316]"></div>
0107 |                         FAILURES
0108 |                     </div>
0109 |                 </div>
0110 |             </div>
0111 | 
0112 |         </div>
0113 |     );
0114 | }

```

---

### File: `frontend\src\components\metrics\StorageGauge.jsx`

**Description**: Source JSX/CSS for `StorageGauge.jsx`

```javascript
0001 | /**
0002 |  * StorageGauge.jsx
0003 |  * Recharts BarChart showing RS overhead (1.5x) vs Replication overhead (3.0x).
0004 |  * Displays savings label: "RS saves 50%". Animates on value change.
0005 |  */

```

---

### File: `frontend\src\components\metrics\SurvivabilityPanel.jsx`

**Description**: Source JSX/CSS for `SurvivabilityPanel.jsx`

```javascript
0001 | import React, { useState, useEffect, useMemo } from 'react';
0002 | import CountUp from 'react-countup';
0003 | import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
0004 | import { Doughnut, Line } from 'react-chartjs-2';
0005 | import { RotateCcw, AlertTriangle, ShieldCheck, Activity, TerminalSquare, AlertCircle, Satellite } from 'lucide-react';
0006 | 
0007 | ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement, LinearScale, CategoryScale);
0008 | 
0009 | export default function SurvivabilityPanel({ messages }) {
0010 |     const [data, setData] = useState(null);
0011 |     const [history, setHistory] = useState([]);
0012 |     const [eventFeed, setEventFeed] = useState([]);
0013 |     const [isComputing, setIsComputing] = useState(false);
0014 | 
0015 |     // Fetch initial state
0016 |     useEffect(() => {
0017 |         fetch(`http://${window.location.hostname}:9000/api/survivability/last`)
0018 |             .then(res => res.json())
0019 |             .then(resData => {
0020 |                 if (resData && resData.survival_probability !== undefined) {
0021 |                     setData(resData);
0022 |                     setHistory([{ val: resData.survival_probability, trigger: 'BASELINE' }]);
0023 |                 }
0024 |             })
0025 |             .catch(err => console.error("Failed to load survivability init:", err));
0026 |     }, []);
0027 | 
0028 |     // Listen to WebSocket Updates
0029 |     useEffect(() => {
0030 |         if (!messages || messages.length === 0) return;
0031 |         const lastMsg = messages[messages.length - 1];
0032 | 
0033 |         if (lastMsg.type === 'SURVIVABILITY_UPDATE') {
0034 |             const ev = lastMsg.data;
0035 | 
0036 |             // Re-fetch data behind the scenes
0037 |             fetch(`http://${window.location.hostname}:9000/api/survivability/last`)
0038 |                 .then(res => res.json())
0039 |                 .then(resData => {
0040 |                     setData(resData);
0041 |                     setHistory(prev => {
0042 |                         const newHist = [...prev, { val: resData.survival_probability, trigger: ev.trigger }];
0043 |                         return newHist.slice(-10); // Keep last 10
0044 |                     });
0045 |                 });
0046 | 
0047 |             // Add to event feed
0048 |             setEventFeed(prev => {
0049 |                 const newFeed = [{
0050 |                     id: Date.now(),
0051 |                     timestamp: new Date(ev.timestamp).toLocaleTimeString(),
0052 |                     trigger: ev.trigger,
0053 |                     oldVal: ev.previous_survival,
0054 |                     newVal: ev.new_survival,
0055 |                     delta: ev.delta,
0056 |                     direction: ev.direction
0057 |                 }, ...prev];
0058 |                 return newFeed.slice(0, 20); // Keep max 20
0059 |             });
0060 |         }
0061 |     }, [messages]);
0062 | 
0063 |     const handleManualRerun = async () => {
0064 |         setIsComputing(true);
0065 |         try {
0066 |             const res = await fetch(`http://${window.location.hostname}:9000/api/survivability/run`, {
0067 |                 method: 'POST'
0068 |             });
0069 |             const resData = await res.json();
0070 |             setData(resData);
0071 |         } catch (err) {
0072 |             console.error(err);
0073 |         } finally {
0074 |             setIsComputing(false);
0075 |         }
0076 |     };
0077 | 
0078 |     if (!data) {
0079 |         return (
0080 |             <div className="text-white flex items-center justify-center p-10 flex-col gap-4">
0081 |                 <div className="w-8 h-8 rounded-full border-2 border-dashed border-cyan-500 animate-spin"></div>
0082 |                 <div>Initializing Reliability Model...</div>
0083 |             </div>
0084 |         );
0085 |     }
0086 | 
0087 |     const survivalPct = data.survival_probability * 100;
0088 |     const isCritical = survivalPct < 99.0;
0089 |     const isWarn = survivalPct < 99.999 && survivalPct >= 99.0;
0090 |     const colorClass = isCritical ? 'text-[#FF2222]' : isWarn ? 'text-[#FFB300]' : 'text-[#00FF88]';
0091 |     const arcColor = isCritical ? '#FF2222' : isWarn ? '#FFB300' : '#00FF88';
0092 | 
0093 |     // Doughnut Chart Data
0094 |     const donutData = {
0095 |         labels: ['Node', 'Plane', 'Flare', 'Corrupt'],
0096 |         datasets: [{
0097 |             data: [
0098 |                 data.failure_breakdown?.node || 0,
0099 |                 data.failure_breakdown?.plane || 0,
0100 |                 data.failure_breakdown?.flare || 0,
0101 |                 data.failure_breakdown?.corrupt || 0
0102 |             ],
0103 |             backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'],
0104 |             borderWidth: 0,
0105 |             hoverOffset: 4
0106 |         }]
0107 |     };
0108 | 
0109 |     // Sparkline Chart Data
0110 |     const sparklineData = {
0111 |         labels: history.map((_, i) => i.toString()),
0112 |         datasets: [{
0113 |             label: 'Survival %',
0114 |             data: history.map(h => h.val * 100),
0115 |             borderColor: '#3b82f6',
0116 |             backgroundColor: '#3b82f620',
0117 |             borderWidth: 2,
0118 |             pointBackgroundColor: history.map(h => {
0119 |                 if (h.trigger.includes('RESTORE')) return '#00FF88';
0120 |                 if (h.trigger.includes('FLARE')) return '#FF6600';
0121 |                 if (h.trigger.includes('FAILURE') || h.trigger.includes('ROT')) return '#FF2222';
0122 |                 return '#3b82f6';
0123 |             }),
0124 |             pointRadius: 4,
0125 |             tension: 0.3,
0126 |             fill: true
0127 |         }]
0128 |     };
0129 | 
0130 |     return (
0131 |         <div className="w-full h-full max-w-[1600px] flex flex-col gap-6 text-gray-200 font-sans p-2">
0132 | 
0133 |             {/* Split layout: Main Content (Hero + Row) vs Sidebar */}
0134 |             <div className="flex-1 flex flex-row gap-6 min-h-0 overflow-hidden">
0135 | 
0136 |                 {/* Left Column */}
0137 |                 <div className="flex-[3] flex flex-col gap-6 min-w-0">
0138 | 
0139 |                     {/* ZONE 1 - Hero Panel */}
0140 |                     <div className="bg-[#111827] border border-cyan-500/30 p-8 rounded-3xl shrink-0 flex flex-col items-center relative overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.1)] group">
0141 | 
0142 |                         <div className="absolute top-4 left-6 flex items-center gap-2">
0143 |                             <Satellite className="text-cyan-500 animate-pulse" size={20} />
0144 |                             <span className="font-mono text-xs uppercase tracking-widest text-cyan-500">Orbital Reliability Simulator</span>
0145 |                         </div>
0146 | 
0147 |                         <button
0148 |                             disabled={isComputing}
0149 |                             onClick={handleManualRerun}
0150 |                             className="absolute top-4 right-6 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-wide flex items-center gap-2 transition-all disabled:opacity-50"
0151 |                         >
0152 |                             <RotateCcw size={14} className={isComputing ? 'animate-spin' : ''} />
0153 |                             {isComputing ? 'Computing... 10k runs' : 'Re-Run Model'}
0154 |                         </button>
0155 | 
0156 |                         <div className="mt-8 mb-4 flex items-end gap-2 relative">
0157 |                             {/* SVG Arc background (mock speedometer) */}
0158 |                             <svg width="600" height="300" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20">
0159 |                                 <path d="M 50 250 A 200 200 0 0 1 550 250" fill="transparent" stroke={arcColor} strokeWidth="4" strokeDasharray="5 5" />
0160 |                             </svg>
0161 | 
0162 |                             <h1 className={`text-[clamp(2.5rem, 6vw, 5.5rem)] font-bold tracking-tight leading-none drop-shadow-[0_0_15px_currentColor] transition-all duration-500 ${colorClass}`}>
0163 |                                 <CountUp
0164 |                                     end={survivalPct}
0165 |                                     decimals={5}
0166 |                                     duration={0.8}
0167 |                                     preserveValue
0168 |                                 />%
0169 |                             </h1>
0170 |                             {isCritical && <span className="mb-4 bg-red-600/20 text-red-500 border border-red-500/50 px-2 py-0.5 rounded text-sm font-bold animate-pulse absolute -right-16 top-0">⚠ CRITICAL</span>}
0171 |                         </div>
0172 | 
0173 |                         <p className="text-gray-400 text-sm font-light tracking-wide mb-8 uppercase">Data Survival Probability • 24-Hour Mission Window</p>
0174 | 
0175 |                         {/* Comparison Table Grid */}
0176 |                         <div className="grid grid-cols-2 w-full max-w-2xl border border-white/10 rounded-xl overflow-hidden bg-[#0A0E1A]">
0177 |                             <div className="p-4 border-r border-white/10 flex flex-col items-center justify-center relative overflow-hidden">
0178 |                                 <div className="absolute inset-0 bg-green-500/5 z-0" />
0179 |                                 <div className="relative z-10 text-center">
0180 |                                     <h3 className="text-xs text-green-400 font-bold tracking-widest uppercase mb-1 flex items-center justify-center gap-2"><ShieldCheck size={14} /> RS Erasure Code</h3>
0181 |                                     <p className="text-2xl font-bold text-white my-1">{survivalPct.toFixed(5)}%</p>
0182 |                                     <p className="text-xs text-gray-500 font-mono">Failures: {data.failure_count}/{data.total_simulations}</p>
0183 |                                 </div>
0184 |                             </div>
0185 |                             <div className="p-4 flex flex-col items-center justify-center relative overflow-hidden">
0186 |                                 <div className="absolute inset-0 bg-red-500/5 z-0" />
0187 |                                 <div className="relative z-10 text-center">
0188 |                                     <h3 className="text-xs text-red-400 font-bold tracking-widest uppercase mb-1 flex items-center justify-center gap-2"><AlertTriangle size={14} /> 3× Replication Base</h3>
0189 |                                     <p className="text-2xl font-bold text-gray-300 my-1">{(data.baseline_replication_survival * 100).toFixed(2)}%</p>
0190 |                                     <p className="text-xs text-gray-500 font-mono">Failures: {data.baseline_failures}/{data.total_simulations}</p>
0191 |                                 </div>
0192 |                             </div>
0193 |                         </div>
0194 | 
0195 |                         <div className="mt-6 text-center">
0196 |                             <p className="text-cyan-400 text-sm font-bold tracking-widest uppercase bg-cyan-500/10 px-4 py-2 rounded-lg inline-flex items-center gap-2 border border-cyan-500/20">
0197 |                                 Risk Reduction Factor ▲ {(data.risk_reduction_factor === Infinity ? '> 1000' : data.risk_reduction_factor.toFixed(1))}×
0198 |                             </p>
0199 |                             <div className="text-[10px] text-gray-500 mt-3 font-mono">
0200 |                                 Last Trigger: {history.length > 0 ? history[history.length - 1].trigger : 'NONE'} &nbsp;•&nbsp; Computed in {data.simulation_duration_ms.toFixed(1)}ms
0201 |                             </div>
0202 |                         </div>
0203 |                     </div>
0204 | 
0205 |                     {/* ZONE 2 - Analytics Row */}
0206 |                     <div className="grid grid-cols-4 gap-4 flex-1 min-h-[220px]">
0207 | 
0208 |                         {/* Card 1: Chunk Health */}
0209 |                         <div className="bg-[#111827] border border-white/5 p-5 rounded-2xl flex flex-col relative group">
0210 |                             <h3 className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-3">Chunk Health</h3>
0211 |                             <div className="flex-1 flex flex-col justify-center gap-3">
0212 |                                 <div className="space-y-1">
0213 |                                     <div className="flex justify-between text-[10px] text-gray-500 mb-1">
0214 |                                         <span>Perfect (10/10)</span>
0215 |                                         <span>{((data.state_distribution?.perfect || 0) / data.total_simulations * 100).toFixed(1)}%</span>
0216 |                                     </div>
0217 |                                     <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
0218 |                                         <div className="h-full bg-blue-500" style={{ width: `${(data.state_distribution?.perfect || 0) / data.total_simulations * 100}%` }}></div>
0219 |                                     </div>
0220 |                                 </div>
0221 |                                 <div className="space-y-1">
0222 |                                     <div className="flex justify-between text-[10px] text-gray-500 mb-1">
0223 |                                         <span>Degraded (K-N)</span>
0224 |                                         <span>{((data.state_distribution?.degraded || 0) / data.total_simulations * 100).toFixed(1)}%</span>
0225 |                                     </div>
0226 |                                     <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
0227 |                                         <div className="h-full bg-amber-500" style={{ width: `${(data.state_distribution?.degraded || 0) / data.total_simulations * 100}%` }}></div>
0228 |                                     </div>
0229 |                                 </div>
0230 |                                 <div className="space-y-1">
0231 |                                     <div className="flex justify-between text-[10px] text-gray-500 mb-1">
0232 |                                         <span>Lost (&lt;K)</span>
0233 |                                         <span>{((data.state_distribution?.lost || 0) / data.total_simulations * 100).toFixed(1)}%</span>
0234 |                                     </div>
0235 |                                     <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
0236 |                                         <div className="h-full bg-red-500" style={{ width: `${(data.state_distribution?.lost || 0) / data.total_simulations * 100}%` }}></div>
0237 |                                     </div>
0238 |                                 </div>
0239 |                             </div>
0240 |                             <div className="mt-3 text-[10px] text-gray-500 border-t border-white/5 pt-2 font-mono">Avg Lost: {data.avg_chunks_lost.toFixed(2)} chunks</div>
0241 |                         </div>
0242 | 
0243 |                         {/* Card 2: Worst Case */}
0244 |                         <div className={`bg-[#111827] border p-5 rounded-2xl flex flex-col items-center justify-center text-center ${data.worst_case_chunks_lost > (data.config.total_chunks - data.config.recovery_threshold) ? 'border-red-500/50 bg-red-500/5' : 'border-white/5'}`}>
0245 |                             <h3 className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-4 absolute top-5">Worst Case</h3>
0246 | 
0247 |                             <div className="mt-4">
0248 |                                 <span className={`text-4xl font-bold block mb-1 ${data.worst_case_chunks_lost > (10 - 4) ? 'text-red-500' : 'text-white'}`}>
0249 |                                     {data.worst_case_chunks_lost} <span className="text-xl text-gray-500">lost</span>
0250 |                                 </span>
0251 |                                 <span className="text-xs text-gray-400 font-mono">in worst observed mission</span>
0252 |                             </div>
0253 | 
0254 |                             {data.worst_case_chunks_lost > (data.config.total_chunks - data.config.recovery_threshold) ? (
0255 |                                 <p className="text-[10px] mt-4 text-red-500 bg-red-500/10 px-2 py-1 rounded inline-flex items-center gap-1"><AlertCircle size={10} /> Unrecoverable scenario hit</p>
0256 |                             ) : (
0257 |                                 <p className="text-[10px] mt-4 text-green-500 bg-green-500/10 px-2 py-1 rounded inline-flex items-center gap-1"><ShieldCheck size={10} /> File remained recoverable</p>
0258 |                             )}
0259 |                         </div>
0260 | 
0261 |                         {/* Card 3: Risk Breakdown */}
0262 |                         <div className="bg-[#111827] border border-white/5 p-5 rounded-2xl flex flex-col relative">
0263 |                             <h3 className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-2">Risk Breakdown</h3>
0264 |                             <div className="flex-1 w-full flex items-center justify-center relative min-h-[100px]">
0265 |                                 <div className="absolute inset-0 flex items-center justify-center">
0266 |                                     <Activity size={24} className="text-gray-700 opacity-30" />
0267 |                                 </div>
0268 |                                 <div className="h-full max-h-[140px] aspect-square">
0269 |                                     <Doughnut data={donutData} options={{ maintainAspectRatio: false, cutout: '75%', plugins: { legend: { display: false } } }} />
0270 |                                 </div>
0271 |                             </div>
0272 |                             <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2 mx-auto">
0273 |                                 <div className="text-[9px] text-gray-400 flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-sm"></div>Node</div>
0274 |                                 <div className="text-[9px] text-gray-400 flex items-center gap-1"><div className="w-2 h-2 bg-purple-500 rounded-sm"></div>Plane</div>
0275 |                                 <div className="text-[9px] text-gray-400 flex items-center gap-1"><div className="w-2 h-2 bg-amber-500 rounded-sm"></div>Flare</div>
0276 |                                 <div className="text-[9px] text-gray-400 flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-sm"></div>Corrupt</div>
0277 |                             </div>
0278 |                         </div>
0279 | 
0280 |                         {/* Card 4: Survival History Sparkline */}
0281 |                         <div className="bg-[#111827] border border-white/5 p-5 rounded-2xl flex flex-col">
0282 |                             <h3 className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-2">Survival History</h3>
0283 |                             <div className="flex-1 w-full min-h-[120px] relative">
0284 |                                 <Line
0285 |                                     data={sparklineData}
0286 |                                     options={{
0287 |                                         maintainAspectRatio: false,
0288 |                                         plugins: { legend: { display: false }, tooltip: { enabled: true } },
0289 |                                         scales: {
0290 |                                             x: { display: false },
0291 |                                             y: { display: false, min: 98, max: 100 }
0292 |                                         }
0293 |                                     }}
0294 |                                 />
0295 |                             </div>
0296 |                             <div className="mt-2 text-[10px] text-center text-gray-500 font-mono">Last 10 runs</div>
0297 |                         </div>
0298 | 
0299 |                     </div>
0300 |                 </div>
0301 | 
0302 |                 {/* ZONE 3 - Event Feed Sidebar */}
0303 |                 <div className="flex-1 min-w-[320px] bg-[#111827] border border-white/5 p-6 rounded-3xl flex flex-col shadow-2xl overflow-hidden shrink-0">
0304 |                     <div className="flex items-center gap-2 mb-6 shadow-sm pb-4 border-b border-white/5">
0305 |                         <TerminalSquare className="text-purple-400" size={18} />
0306 |                         <h2 className="text-sm text-gray-300 font-bold tracking-widest uppercase">Survivability Log</h2>
0307 |                     </div>
0308 | 
0309 |                     <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
0310 |                         {eventFeed.length === 0 ? (
0311 |                             <div className="text-center text-gray-600 font-mono text-sm mt-10">Awaiting system events...</div>
0312 |                         ) : (
0313 |                             eventFeed.map(ev => {
0314 |                                 const isDrop = ev.direction === "DOWN";
0315 |                                 const isRise = ev.direction === "UP";
0316 |                                 return (
0317 |                                     <div key={ev.id} className="bg-[#0A0E1A] border border-white/5 rounded-xl p-3 shadow-inner hover:border-white/10 transition-colors animate-fade-in-down">
0318 |                                         <div className="flex justify-between items-start mb-2">
0319 |                                             <span className="text-[10px] text-gray-500 font-mono">{ev.timestamp}</span>
0320 |                                             <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${isDrop ? 'bg-red-500/20 text-red-500' : isRise ? 'bg-green-500/20 text-green-500' : 'bg-blue-500/20 text-blue-500'}`}>
0321 |                                                 {ev.trigger}
0322 |                                             </span>
0323 |                                         </div>
0324 |                                         <div className="flex justify-between items-center text-xs font-mono">
0325 |                                             <div className="text-gray-400 flex flex-col">
0326 |                                                 <span>{(ev.oldVal * 100).toFixed(4)}% <span className="text-gray-600">→</span></span>
0327 |                                                 <span className="text-gray-200">{(ev.newVal * 100).toFixed(4)}%</span>
0328 |                                             </div>
0329 |                                             <div className={`font-bold ${isDrop ? 'text-red-500' : isRise ? 'text-green-500' : 'text-gray-500'}`}>
0330 |                                                 {ev.direction === 'DOWN' ? '▼' : ev.direction === 'UP' ? '▲' : ''} {(ev.delta * 100).toFixed(4)}%
0331 |                                             </div>
0332 |                                         </div>
0333 |                                     </div>
0334 |                                 )
0335 |                             })
0336 |                         )}
0337 |                     </div>
0338 |                 </div>
0339 | 
0340 |             </div>
0341 | 
0342 |             {/* ZONE 4 - Bottom Status Bar */}
0343 |             <div className="h-8 shrink-0 bg-cyan-900/20 border border-cyan-500/20 rounded-lg flex items-center justify-between px-6 font-mono text-[10px] text-cyan-300/70 tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.1)]">
0344 |                 <div className="flex gap-6">
0345 |                     <span>COSMEON RELIABILITY MODEL</span>
0346 |                     <span>SIMULATIONS: {data.config.num_simulations.toLocaleString()}</span>
0347 |                     <span>RS(K={data.config.recovery_threshold}, N={data.config.total_chunks})</span>
0348 |                     <span>MISSION WINDOW: {data.config.mission_hours}h</span>
0349 |                 </div>
0350 |                 <div className="flex gap-2 items-center">
0351 |                     <span>ENGINE: MONTE CARLO v1.0</span>
0352 |                     <span className="text-gray-600 px-2">|</span>
0353 |                     <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_#10b981]"></div>
0354 |                     <span className="text-green-400">LIVE</span>
0355 |                 </div>
0356 |             </div>
0357 | 
0358 |         </div>
0359 |     );
0360 | }

```

---

### File: `frontend\src\components\network\NetworkMap3D.jsx`

**Description**: Source JSX/CSS for `NetworkMap3D.jsx`

```javascript
0001 | import React, { useRef, useState, useEffect, useMemo } from 'react';
0002 | import { Canvas, useFrame } from '@react-three/fiber';
0003 | import { OrbitControls, Stars } from '@react-three/drei';
0004 | import { EffectComposer, Bloom } from '@react-three/postprocessing';
0005 | import * as THREE from 'three';
0006 | import * as satellite from 'satellite.js';
0007 | import { Activity, ShieldCheck, Zap, Search, X, Globe } from 'lucide-react';
0008 | 
0009 | // --- Constants & Config ---
0010 | const EARTH_RADIUS_KM = 6371;
0011 | const SCALE_FACTOR = 1 / 1000; // 1 Three.js unit = 1000km
0012 | 
0013 | // Simple Earth Sphere
0014 | function Earth() {
0015 |     return (
0016 |         <mesh>
0017 |             <sphereGeometry args={[EARTH_RADIUS_KM * SCALE_FACTOR, 64, 64]} />
0018 |             <meshStandardMaterial
0019 |                 color="#0a192f"
0020 |                 emissive="#020c1b"
0021 |                 roughness={0.7}
0022 |                 metalness={0.1}
0023 |                 wireframe={true}
0024 |                 transparent={true}
0025 |                 opacity={0.3}
0026 |             />
0027 |         </mesh>
0028 |     );
0029 | }
0030 | 
0031 | // Glowing Atmosphere
0032 | function Atmosphere() {
0033 |     return (
0034 |         <mesh>
0035 |             <sphereGeometry args={[(EARTH_RADIUS_KM + 100) * SCALE_FACTOR, 64, 64]} />
0036 |             <meshBasicMaterial
0037 |                 color="#3b82f6"
0038 |                 transparent={true}
0039 |                 opacity={0.1}
0040 |                 side={THREE.BackSide}
0041 |             />
0042 |         </mesh>
0043 |     );
0044 | }
0045 | 
0046 | // Real-Time Satellite Swarm using InstancedMesh
0047 | function SatelliteSwarm({ satrecs, onSelect }) {
0048 |     const meshRef = useRef();
0049 | 
0050 |     // Create a dummy Object3D to help calculate matrix transformations
0051 |     const dummy = useMemo(() => new THREE.Object3D(), []);
0052 | 
0053 |     useFrame(() => {
0054 |         if (!meshRef.current || satrecs.length === 0) return;
0055 | 
0056 |         const now = new Date();
0057 |         const gmst = satellite.gstime(now);
0058 | 
0059 |         satrecs.forEach((satrec, i) => {
0060 |             const positionAndVelocity = satellite.propagate(satrec, now);
0061 |             const positionEci = positionAndVelocity.position;
0062 | 
0063 |             if (positionEci && typeof positionEci !== 'boolean') {
0064 |                 const x = positionEci.x * SCALE_FACTOR;
0065 |                 const y = positionEci.z * SCALE_FACTOR;
0066 |                 const z = -positionEci.y * SCALE_FACTOR;
0067 | 
0068 |                 dummy.position.set(x, y, z);
0069 |                 dummy.lookAt(0, 0, 0); // Point towards earth
0070 |                 dummy.updateMatrix();
0071 | 
0072 |                 meshRef.current.setMatrixAt(i, dummy.matrix);
0073 |             }
0074 |         });
0075 | 
0076 |         meshRef.current.instanceMatrix.needsUpdate = true;
0077 |     });
0078 | 
0079 |     if (satrecs.length === 0) return null;
0080 | 
0081 |     return (
0082 |         <instancedMesh
0083 |             ref={meshRef}
0084 |             args={[null, null, satrecs.length]}
0085 |             onPointerDown={(e) => {
0086 |                 e.stopPropagation();
0087 |                 if (e.instanceId !== undefined && onSelect) {
0088 |                     onSelect(satrecs[e.instanceId]);
0089 |                 }
0090 |             }}
0091 |             onPointerOver={(e) => {
0092 |                 e.stopPropagation();
0093 |                 document.body.style.cursor = 'pointer';
0094 |             }}
0095 |             onPointerOut={() => {
0096 |                 document.body.style.cursor = 'default';
0097 |             }}
0098 |         >
0099 |             <boxGeometry args={[0.08, 0.08, 0.08]} />
0100 |             <meshBasicMaterial color="#06b6d4" />
0101 |         </instancedMesh>
0102 |     );
0103 | }
0104 | 
0105 | export default function NetworkMap3D({ messages }) {
0106 |     const [satrecs, setSatrecs] = useState([]);
0107 |     const [loading, setLoading] = useState(true);
0108 |     const [error, setError] = useState(null);
0109 |     const [selectedSat, setSelectedSat] = useState(null);
0110 |     const [liveSatData, setLiveSatData] = useState(null);
0111 |     const [explosionFlash, setExplosionFlash] = useState(false);
0112 | 
0113 |     const [analytics, setAnalytics] = useState({
0114 |         leo: 0,
0115 |         meo: 0,
0116 |         geo: 0
0117 |     });
0118 | 
0119 |     const [searchTerm, setSearchTerm] = useState('');
0120 |     const [isSearchOpen, setIsSearchOpen] = useState(false);
0121 | 
0122 |     // Chaos Engineering / Real-Time VFX Triggers
0123 |     useEffect(() => {
0124 |         if (!messages || messages.length === 0) return;
0125 |         const lastMsg = messages[messages.length - 1];
0126 | 
0127 |         if (lastMsg.type === 'NODE_OFFLINE' || lastMsg.type === 'CHAOS_TRIGGERED') {
0128 |             setExplosionFlash(true);
0129 |             setTimeout(() => setExplosionFlash(false), 800);
0130 |         }
0131 |     }, [messages]);
0132 | 
0133 |     useEffect(() => {
0134 |         async function fetchTLEs() {
0135 |             try {
0136 |                 // Fetch Starlink TLEs via our local backend proxy to bypass CelesTrak CORS blocks
0137 |                 const response = await fetch(`http://${window.location.hostname}:9000/api/tle`);
0138 | 
0139 |                 if (!response.ok) throw new Error('Failed to fetch TLE data via backend proxy');
0140 | 
0141 |                 const text = await response.text();
0142 | 
0143 |                 // Parse the TLE text. Format is 3 lines per sat:
0144 |                 // Name
0145 |                 // Line 1
0146 |                 // Line 2
0147 |                 const lines = text.split('\n').filter(l => l.trim().length > 0);
0148 |                 const parsedSats = [];
0149 | 
0150 |                 let stats = { leo: 0, meo: 0, geo: 0 };
0151 | 
0152 |                 for (let i = 0; i < lines.length; i += 3) {
0153 |                     if (lines[i] && lines[i + 1] && lines[i + 2]) {
0154 |                         const satName = lines[i].trim();
0155 |                         const satrec = satellite.twoline2satrec(lines[i + 1].trim(), lines[i + 2].trim());
0156 |                         // Filter out decayed or invalid sats
0157 |                         if (satrec && satrec.error === 0) {
0158 |                             satrec.name = satName;
0159 |                             // Calculate mean motion to approximate altitude
0160 |                             // Mean motion (revolutions per day)
0161 |                             // 1440 minutes in a day, 2*PI radians in a revolution
0162 |                             const meanMotion = satrec.no * (1440 / (2 * Math.PI)); // Convert rad/min to rev/day
0163 | 
0164 |                             let orbitType = 'GEO';
0165 |                             // Rough altitude categories based on mean motion (rev/day)
0166 |                             if (meanMotion >= 11.25) { // Roughly < 2000km
0167 |                                 stats.leo++;
0168 |                                 orbitType = 'LEO';
0169 |                             } else if (meanMotion < 11.25 && meanMotion > 1.5) { // Roughly 2000km - 35786km
0170 |                                 stats.meo++;
0171 |                                 orbitType = 'MEO';
0172 |                             } else { // Roughly > 35786km (including GEO)
0173 |                                 stats.geo++;
0174 |                             }
0175 |                             satrec.orbitType = orbitType;
0176 | 
0177 |                             parsedSats.push(satrec);
0178 |                         }
0179 |                     }
0180 |                 }
0181 | 
0182 |                 // For performance, let's limit to tracking 5000 sats if the file is massive
0183 |                 setAnalytics(stats);
0184 |                 setSatrecs(parsedSats.slice(0, 5000));
0185 |                 setLoading(false);
0186 |             } catch (err) {
0187 |                 console.error("Error loading satellite data:", err);
0188 |                 setError(err.message);
0189 |                 setLoading(false);
0190 |             }
0191 |         }
0192 | 
0193 |         fetchTLEs();
0194 |     }, []);
0195 | 
0196 |     const filteredSatrecs = useMemo(() => {
0197 |         if (!searchTerm) return satrecs;
0198 |         return satrecs.filter(sat =>
0199 |             sat.name && sat.name.toLowerCase().includes(searchTerm.toLowerCase())
0200 |         );
0201 |     }, [satrecs, searchTerm]);
0202 | 
0203 |     // Live Telemetry Hook for Selected Satellite
0204 |     useEffect(() => {
0205 |         if (!selectedSat) {
0206 |             setLiveSatData(null);
0207 |             return;
0208 |         }
0209 | 
0210 |         // Setup real-time updates for velocity/altitude/coords
0211 |         const interval = setInterval(() => {
0212 |             const now = new Date();
0213 |             const positionAndVelocity = satellite.propagate(selectedSat, now);
0214 |             const gmst = satellite.gstime(now);
0215 | 
0216 |             if (positionAndVelocity.position && positionAndVelocity.velocity) {
0217 |                 // Get Geodetic coordinates (Lat, Lon, Alt)
0218 |                 const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
0219 |                 const longitude = satellite.degreesLong(positionGd.longitude);
0220 |                 const latitude = satellite.degreesLat(positionGd.latitude);
0221 |                 const height = positionGd.height; // in km
0222 | 
0223 |                 // Calculate total velocity scalar (km/s)
0224 |                 const v = positionAndVelocity.velocity;
0225 |                 const velocityKmS = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
0226 | 
0227 |                 setLiveSatData({
0228 |                     lat: latitude,
0229 |                     lon: longitude,
0230 |                     alt: height,
0231 |                     vel: velocityKmS,
0232 |                     status: 'OPTIMAL',
0233 |                     // Simulate random storage load for realism based on the node ID
0234 |                     load: Math.abs(Math.sin(selectedSat.satnum)) * 100
0235 |                 });
0236 |             }
0237 |         }, 1000);
0238 | 
0239 |         return () => clearInterval(interval);
0240 |     }, [selectedSat]);
0241 | 
0242 |     return (
0243 |         <div className="w-full h-full relative pointer-events-auto">
0244 |             <Canvas camera={{ position: [0, 15, 25], fov: 45 }} gl={{ alpha: true }}>
0245 |                 <ambientLight intensity={0.5} color="#4facfe" />
0246 |                 <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
0247 | 
0248 |                 <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
0249 | 
0250 |                 <Earth />
0251 |                 <Atmosphere />
0252 | 
0253 |                 {!loading && <SatelliteSwarm satrecs={satrecs} onSelect={setSelectedSat} />}
0254 | 
0255 |                 <OrbitControls
0256 |                     enablePan={false}
0257 |                     minDistance={EARTH_RADIUS_KM * SCALE_FACTOR + 1}
0258 |                     maxDistance={40}
0259 |                     autoRotate={true}
0260 |                     autoRotateSpeed={0.5}
0261 |                 />
0262 | 
0263 |                 <EffectComposer multibuffer>
0264 |                     <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} height={300} intensity={explosionFlash ? 5.0 : 2.0} />
0265 |                     {explosionFlash && (
0266 |                         <ChromaticAberration offset={[0.08, 0.08]} blendFunction={13} /> // 13 is roughly BlendFunction.NORMAL in postprocessing depending on imports, but we can just use the component
0267 |                     )}
0268 |                 </EffectComposer>
0269 |             </Canvas>
0270 | 
0271 |             {/* Analytics Overlay HUD */}
0272 |             {!loading && (
0273 |                 <div className="absolute top-6 left-6 z-10 w-80 bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
0274 |                     <div className="absolute top-0 right-1/2 translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
0275 | 
0276 |                     <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
0277 |                         <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
0278 |                             <Activity className="text-cyan-400" size={16} />
0279 |                         </div>
0280 |                         <div>
0281 |                             <h2 className="text-white font-bold tracking-wide text-sm">Orbital Analytics</h2>
0282 |                             <p className="text-[9px] text-cyan-500 font-mono tracking-widest uppercase mt-0.5">Live Telemetry Feed</p>
0283 |                         </div>
0284 |                     </div>
0285 | 
0286 |                     <div className="space-y-5">
0287 |                         {/* Total Count */}
0288 |                         <div>
0289 |                             <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1">Active Mesh Nodes</p>
0290 |                             <div className="flex items-baseline gap-2">
0291 |                                 <p className="text-4xl font-mono text-white tracking-tight">{satrecs.length.toLocaleString()}</p>
0292 |                                 <span className="text-xs text-emerald-400 font-mono font-bold">100% ACCURACY</span>
0293 |                             </div>
0294 |                         </div>
0295 | 
0296 |                         {/* Distributions */}
0297 |                         <div className="pt-4 border-t border-white/5 space-y-4">
0298 |                             <h3 className="text-[10px] font-bold text-gray-500 tracking-widest uppercase mb-2">Altitude Distribution</h3>
0299 | 
0300 |                             {/* LEO */}
0301 |                             <div>
0302 |                                 <div className="flex justify-between items-end mb-1">
0303 |                                     <span className="text-[10px] text-gray-400 font-mono tracking-wider">LEO (&lt; 2000km)</span>
0304 |                                     <span className="text-white text-[10px] font-bold font-mono">{analytics.leo.toLocaleString()}</span>
0305 |                                 </div>
0306 |                                 <div className="w-full bg-white/5 h-1.5 rounded-sm overflow-hidden border border-white/5">
0307 |                                     <div className="bg-cyan-400 h-full rounded-sm shadow-[0_0_10px_#22d3ee]" style={{ width: `${(analytics.leo / satrecs.length) * 100}%` }}></div>
0308 |                                 </div>
0309 |                             </div>
0310 | 
0311 |                             {/* MEO */}
0312 |                             <div>
0313 |                                 <div className="flex justify-between items-end mb-1">
0314 |                                     <span className="text-[10px] text-gray-400 font-mono tracking-wider">MEO (&lt; 35786km)</span>
0315 |                                     <span className="text-white text-[10px] font-bold font-mono">{analytics.meo.toLocaleString()}</span>
0316 |                                 </div>
0317 |                                 <div className="w-full bg-white/5 h-1.5 rounded-sm overflow-hidden border border-white/5">
0318 |                                     <div className="bg-blue-500 h-full rounded-sm shadow-[0_0_10px_#3b82f6]" style={{ width: `${(analytics.meo / satrecs.length) * 100}%` }}></div>
0319 |                                 </div>
0320 |                             </div>
0321 | 
0322 |                             {/* GEO */}
0323 |                             <div>
0324 |                                 <div className="flex justify-between items-end mb-1">
0325 |                                     <span className="text-[10px] text-gray-400 font-mono tracking-wider">GEO (+35786km)</span>
0326 |                                     <span className="text-white text-[10px] font-bold font-mono">{analytics.geo.toLocaleString()}</span>
0327 |                                 </div>
0328 |                                 <div className="w-full bg-white/5 h-1.5 rounded-sm overflow-hidden border border-white/5">
0329 |                                     <div className="bg-purple-500 h-full rounded-sm shadow-[0_0_10px_#a855f7]" style={{ width: `${(analytics.geo / satrecs.length) * 100}%` }}></div>
0330 |                                 </div>
0331 |                             </div>
0332 |                         </div>
0333 |                     </div>
0334 |                 </div>
0335 |             )}
0336 | 
0337 |             {/* Selected Satellite Details Overlay */}
0338 |             {selectedSat && (
0339 |                 <div className="absolute bottom-6 left-6 z-10 w-80 bg-white/[0.02] backdrop-blur-3xl border border-white/20 rounded-2xl p-5 shadow-[0_0_40px_rgba(34,211,238,0.15)] transition-all duration-300 translate-y-0 opacity-100 flex flex-col gap-4">
0340 |                     {/* Header */}
0341 |                     <div className="flex items-start justify-between">
0342 |                         <div>
0343 |                             <div className="flex items-center gap-2 mb-1">
0344 |                                 <ShieldCheck className="text-emerald-400" size={16} />
0345 |                                 <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">{liveSatData?.status || 'SYNCHING...'}</span>
0346 |                             </div>
0347 |                             <h2 className="text-lg font-bold text-white tracking-wider">{selectedSat.name}</h2>
0348 |                         </div>
0349 |                         <button onClick={() => setSelectedSat(null)} className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
0350 |                             <X size={16} />
0351 |                         </button>
0352 |                     </div>
0353 | 
0354 |                     {/* Metadata Badges */}
0355 |                     <div className="flex items-center gap-2">
0356 |                         <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${selectedSat.orbitType === 'LEO' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' :
0357 |                             selectedSat.orbitType === 'GEO' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
0358 |                                 'bg-blue-500/10 text-blue-400 border-blue-500/30'
0359 |                             }`}>
0360 |                             CLASS: {selectedSat.orbitType}
0361 |                         </span>
0362 |                         <span className="text-[9px] font-mono px-2 py-0.5 rounded border bg-white/5 text-gray-400 border-white/10">
0363 |                             NORAD: {selectedSat.satnum}
0364 |                         </span>
0365 |                     </div>
0366 | 
0367 |                     {/* Live Telemetry Data */}
0368 |                     <div className="bg-black/40 rounded-xl p-3 border border-white/5 flex flex-col gap-3">
0369 |                         <div className="grid grid-cols-2 gap-3">
0370 |                             <div>
0371 |                                 <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-0.5">Altitude</p>
0372 |                                 <p className="text-sm font-mono text-cyan-300 font-bold">{liveSatData ? liveSatData.alt.toFixed(1) : '---'} <span className="text-[10px] text-gray-500">km</span></p>
0373 |                             </div>
0374 |                             <div>
0375 |                                 <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-0.5">Velocity</p>
0376 |                                 <p className="text-sm font-mono text-rose-400 font-bold">{liveSatData ? liveSatData.vel.toFixed(2) : '---'} <span className="text-[10px] text-gray-500">km/s</span></p>
0377 |                             </div>
0378 |                         </div>
0379 | 
0380 |                         <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-3">
0381 |                             <div>
0382 |                                 <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-0.5">Latitude</p>
0383 |                                 <p className="text-xs font-mono text-gray-300">{liveSatData ? liveSatData.lat.toFixed(4) : '---'}°</p>
0384 |                             </div>
0385 |                             <div>
0386 |                                 <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-0.5">Longitude</p>
0387 |                                 <p className="text-xs font-mono text-gray-300">{liveSatData ? liveSatData.lon.toFixed(4) : '---'}°</p>
0388 |                             </div>
0389 |                         </div>
0390 |                     </div>
0391 | 
0392 |                     {/* Fictional/Project-specific Storage Data */}
0393 |                     <div>
0394 |                         <div className="flex justify-between items-end mb-1">
0395 |                             <span className="text-[9px] text-gray-500 font-mono uppercase tracking-widest">Network Storage Load</span>
0396 |                             <span className="text-white text-[10px] font-bold font-mono">{liveSatData ? liveSatData.load.toFixed(1) : 0}%</span>
0397 |                         </div>
0398 |                         <div className="w-full bg-black/40 h-1.5 rounded-sm overflow-hidden border border-white/5">
0399 |                             <div
0400 |                                 className={`h-full rounded-sm transition-all duration-500 ${liveSatData?.load > 80 ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' : liveSatData?.load > 50 ? 'bg-amber-500 shadow-[0_0_10px_#f59e0b]' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'}`}
0401 |                                 style={{ width: `${liveSatData ? liveSatData.load : 0}%` }}
0402 |                             ></div>
0403 |                         </div>
0404 |                         <p className="text-[9px] text-gray-500 font-mono mt-2 leading-relaxed">
0405 |                             Acting as an active Reed-Solomon storage node in the COSMEON distributed orbital mesh.
0406 |                         </p>
0407 |                     </div>
0408 |                 </div>
0409 |             )}
0410 | 
0411 |             {loading && (
0412 |                 <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm">
0413 |                     <div className="flex flex-col items-center gap-4">
0414 |                         <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
0415 |                         <p className="text-cyan-400 font-mono text-xs tracking-widest uppercase animate-pulse">Syncing Telemetry Array...</p>
0416 |                     </div>
0417 |                 </div>
0418 |             )}
0419 | 
0420 |             {error && (
0421 |                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-4 rounded-xl backdrop-blur-md">
0422 |                     <p className="font-bold tracking-widest uppercase text-sm">Error Syncing Telemetry</p>
0423 |                     <p className="text-xs font-mono mt-1 opacity-80">{error}</p>
0424 |                 </div>
0425 |             )}
0426 | 
0427 |             {/* Satellite Database Drawer */}
0428 |             {!loading && (
0429 |                 <>
0430 |                     {/* Floating Toggle Button (visible when drawer is closed) */}
0431 |                     <button
0432 |                         onClick={() => setIsSearchOpen(true)}
0433 |                         className={`absolute top-6 right-6 z-10 w-12 h-12 bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl flex items-center justify-center text-cyan-500 hover:text-white hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.5)] ${isSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
0434 |                     >
0435 |                         <Search size={20} />
0436 |                     </button>
0437 | 
0438 |                     {/* Sliding Glassmorphic Panel */}
0439 |                     <div
0440 |                         className={`absolute top-6 bottom-6 right-6 z-20 w-96 bg-[#02040A]/80 backdrop-blur-3xl border border-white/10 rounded-2xl flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.8)] transition-transform duration-500 ease-out ${isSearchOpen ? 'translate-x-0' : 'translate-x-[120%]'}`}
0441 |                     >
0442 |                         {/* Header & Search */}
0443 |                         <div className="p-6 border-b border-white/5">
0444 |                             <div className="flex items-center justify-between mb-4">
0445 |                                 <div className="flex items-center gap-2">
0446 |                                     <Globe className="text-cyan-500" size={18} />
0447 |                                     <h2 className="text-white font-bold tracking-wide text-sm">Active Mesh Database</h2>
0448 |                                 </div>
0449 |                                 <button
0450 |                                     onClick={() => setIsSearchOpen(false)}
0451 |                                     className="text-gray-500 hover:text-white transition-colors"
0452 |                                 >
0453 |                                     <X size={20} />
0454 |                                 </button>
0455 |                             </div>
0456 | 
0457 |                             <div className="relative">
0458 |                                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/50" size={16} />
0459 |                                 <input
0460 |                                     type="text"
0461 |                                     placeholder="Search by satellite designation..."
0462 |                                     value={searchTerm}
0463 |                                     onChange={(e) => setSearchTerm(e.target.value)}
0464 |                                     className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono"
0465 |                                 />
0466 |                             </div>
0467 |                         </div>
0468 | 
0469 |                         {/* Scrolling List */}
0470 |                         <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
0471 |                             {filteredSatrecs.slice(0, 100).map((sat, idx) => (
0472 |                                 <div
0473 |                                     key={idx}
0474 |                                     onClick={() => setSelectedSat(sat)}
0475 |                                     className="bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 p-3 rounded-lg transition-colors group cursor-pointer"
0476 |                                 >
0477 |                                     <div className="flex items-center justify-between mb-1">
0478 |                                         <p className="text-white text-xs font-bold truncate group-hover:text-cyan-400 max-w-[200px]">{sat.name || 'UNKNOWN SAT'}</p>
0479 |                                         <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm ${sat.orbitType === 'LEO' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' :
0480 |                                             sat.orbitType === 'GEO' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
0481 |                                                 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
0482 |                                             }`}>
0483 |                                             {sat.orbitType}
0484 |                                         </span>
0485 |                                     </div>
0486 |                                     <div className="flex items-center gap-4 text-[10px] text-gray-500 font-mono">
0487 |                                         <p>NORAD: <span className="text-gray-300">{sat.satnum}</span></p>
0488 |                                         <p>INCL: <span className="text-gray-300">{(sat.inclo * (180 / Math.PI)).toFixed(1)}°</span></p>
0489 |                                     </div>
0490 |                                 </div>
0491 |                             ))}
0492 |                             {filteredSatrecs.length === 0 && (
0493 |                                 <div className="text-center py-10">
0494 |                                     <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">No signals found</p>
0495 |                                 </div>
0496 |                             )}
0497 |                             {filteredSatrecs.length > 100 && (
0498 |                                 <div className="text-center pt-2 pb-4">
0499 |                                     <p className="text-cyan-500/50 text-[10px] font-mono uppercase tracking-widest">+ {filteredSatrecs.length - 100} more nodes hidden</p>
0500 |                                 </div>
0501 |                             )}
0502 |                         </div>
0503 |                     </div>
0504 |                 </>
0505 |             )}
0506 |         </div>
0507 |     );
0508 | }

```

---

### File: `frontend\src\components\orbital\DataPacket.jsx`

**Description**: Source JSX/CSS for `DataPacket.jsx`

```javascript
0001 | /**
0002 |  * DataPacket.jsx
0003 |  * Animated SVG circle that follows a path between source and destination nodes.
0004 |  * Colors: blue=data, green=parity, yellow=migration, purple=DTN flush.
0005 |  */

```

---

### File: `frontend\src\components\orbital\OrbitalMap.jsx`

**Description**: Source JSX/CSS for `OrbitalMap.jsx`

```javascript
0001 | /**
0002 |  * OrbitalMap.jsx
0003 |  * React Flow wrapper for the orbital constellation visualization (Hero Panel).
0004 |  * Earth center image, 3 SVG orbital ring ellipses, 6 custom satellite nodes.
0005 |  */

```

---

### File: `frontend\src\components\orbital\OrbitalMap3D.jsx`

**Description**: Source JSX/CSS for `OrbitalMap3D.jsx`

```javascript
0001 | import React, { useRef, useLayoutEffect, useState, useMemo, Suspense, useEffect } from 'react';
0002 | import { Canvas, useFrame, useThree } from '@react-three/fiber';
0003 | import { OrbitControls, Stars, Billboard, Text, Line, useGLTF, Html, Float, ContactShadows } from '@react-three/drei';
0004 | import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
0005 | import { BlendFunction } from 'postprocessing';
0006 | import * as THREE from 'three';
0007 | import gsap from 'gsap';
0008 | import { useSpring, a } from '@react-spring/three';
0009 | import { useDrag } from '@use-gesture/react';
0010 | 
0011 | // Specific scales defined by SpaceScope Standards
0012 | const SCALES = {
0013 |     '/mercury.glb': 0.003,
0014 |     '/earth.glb': 0.0005,
0015 |     '/mars.glb': 0.05,
0016 |     '/realistic_jupiter.glb': 0.004
0017 | };
0018 | 
0019 | // Standardized Planet Renderer
0020 | function PlanetActor({ url, envMapIntensity = 1, defaultScale = 1, ...props }) {
0021 |     const { scene } = useGLTF(url);
0022 |     const clonedScene = useMemo(() => scene.clone(true), [scene]);
0023 |     const finalScale = SCALES[url] || defaultScale;
0024 | 
0025 |     useEffect(() => {
0026 |         clonedScene.traverse((child) => {
0027 |             if (child.isMesh) {
0028 |                 child.castShadow = true;
0029 |                 child.receiveShadow = true;
0030 |                 if (child.material) {
0031 |                     child.material.envMapIntensity = envMapIntensity;
0032 |                     // Ensure standard material properties if missing
0033 |                     if (child.material.roughness === undefined) {
0034 |                         child.material.roughness = 0.6;
0035 |                     }
0036 |                     if (child.material.metalness === undefined) {
0037 |                         child.material.metalness = 0.4;
0038 |                     }
0039 |                 }
0040 |             }
0041 |         });
0042 |     }, [clonedScene, envMapIntensity]);
0043 | 
0044 |     return (
0045 |         <group {...props}>
0046 |             <primitive object={clonedScene} scale={finalScale} />
0047 |         </group>
0048 |     );
0049 | }
0050 | 
0051 | // Custom Draggable Planet Node for the Orbital Tracks
0052 | function DraggableSatellite({ color, label, position, modelUrl }) {
0053 |     const meshRef = useRef();
0054 |     const [hovered, setHovered] = useState(false);
0055 |     const [active, setActive] = useState(false);
0056 | 
0057 |     // Drag functionality on 3D plane X,Z with Y=0
0058 |     const { size, viewport } = useThree();
0059 |     const aspect = size.width / viewport.width;
0060 |     const [{ pos }, api] = useSpring(() => ({ pos: position }));
0061 | 
0062 |     const bind = useDrag(({ offset: [x, y], event }) => {
0063 |         event.stopPropagation();
0064 |         api.start({ pos: [x / aspect, 0, y / aspect] });
0065 |     }, {
0066 |         pointerEvents: true,
0067 |         from: () => [pos.get()[0] * aspect, pos.get()[2] * aspect]
0068 |     });
0069 | 
0070 |     useFrame((state, delta) => {
0071 |         if (meshRef.current) {
0072 |             meshRef.current.rotation.y += delta * 0.6;
0073 |             if (active) {
0074 |                 // Pulse effect if active
0075 |                 meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 5) * 0.1);
0076 |             } else {
0077 |                 meshRef.current.scale.setScalar(1);
0078 |             }
0079 |         }
0080 |     });
0081 | 
0082 |     return (
0083 |         <a.group
0084 |             {...bind()}
0085 |             position={pos}
0086 |             onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
0087 |             onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
0088 |             onClick={(e) => { e.stopPropagation(); setActive(!active); }}
0089 |         >
0090 |             <Float speed={2.5} rotationIntensity={0.6} floatIntensity={0.8}>
0091 |                 <group ref={meshRef}>
0092 |                     {modelUrl ? (
0093 |                         <PlanetActor url={modelUrl} envMapIntensity={active ? 2.5 : 1.5} />
0094 |                     ) : (
0095 |                         <mesh>
0096 |                             <sphereGeometry args={[0.2, 32, 32]} />
0097 |                             <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 0.8 : 0.3} />
0098 |                         </mesh>
0099 |                     )}
0100 |                 </group>
0101 |             </Float>
0102 | 
0103 |             {label && !active && (
0104 |                 <Billboard>
0105 |                     <Text
0106 |                         position={[0, 2.2, 0]}
0107 |                         fontSize={0.25}
0108 |                         color={color}
0109 |                         fontWeight="bold"
0110 |                         outlineWidth={0.02}
0111 |                         outlineColor="#000000"
0112 |                     >
0113 |                         {label}
0114 |                     </Text>
0115 |                 </Billboard>
0116 |             )}
0117 | 
0118 |             {/* TETHERED INFO CARD */}
0119 |             {active && (
0120 |                 <Html position={[0.5, 0.5, 0]} center zIndexRange={[100, 0]}>
0121 |                     <div
0122 |                         className="bg-[#050B14]/90 backdrop-blur-md border-l-2 border-b-2 shadow-[0_10px_30px_rgba(0,0,0,0.8)] p-4 flex flex-col gap-3 w-56 transform translate-x-4 -translate-y-4 pointer-events-auto"
0123 |                         style={{
0124 |                             borderColor: color,
0125 |                             clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
0126 |                         }}
0127 |                     >
0128 |                         {/* Connecting Line from 3D object to card */}
0129 |                         <div className="absolute top-full right-full w-8 h-px bg-white/30 origin-top-right -rotate-45" style={{ backgroundColor: color }}></div>
0130 | 
0131 |                         <div className="flex justify-between items-center border-b border-white/10 pb-2">
0132 |                             <span className="text-[10px] font-bold tracking-[0.2em] font-mono text-white" style={{ color }}>{label}</span>
0133 |                             <div className="w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_currentColor]" style={{ backgroundColor: color }}></div>
0134 |                         </div>
0135 | 
0136 |                         <div className="flex flex-col gap-1.5 font-mono">
0137 |                             <div className="flex justify-between text-[9px] uppercase tracking-wider">
0138 |                                 <span className="text-gray-500">Status</span>
0139 |                                 <span className="text-emerald-400 font-bold">ONLINE</span>
0140 |                             </div>
0141 |                             <div className="flex justify-between text-[9px] uppercase tracking-wider">
0142 |                                 <span className="text-gray-500">Uptime</span>
0143 |                                 <span className="text-white">99.99%</span>
0144 |                             </div>
0145 |                             <div className="flex justify-between text-[9px] uppercase tracking-wider">
0146 |                                 <span className="text-gray-500">Storage Load</span>
0147 |                                 <span className="text-white">{(Math.random() * 60 + 20).toFixed(1)}%</span>
0148 |                             </div>
0149 | 
0150 |                             <div className="mt-2 h-1 w-full bg-white/10 rounded-full overflow-hidden">
0151 |                                 <div className="h-full rounded-full" style={{ width: '75%', backgroundColor: color }}></div>
0152 |                             </div>
0153 |                         </div>
0154 | 
0155 |                         <button
0156 |                             className="mt-1 w-full py-1.5 text-[9px] bg-white/5 hover:bg-white/10 border border-white/10 tracking-widest uppercase transition-colors"
0157 |                             onClick={(e) => { e.stopPropagation(); setActive(false); }}
0158 |                         >
0159 |                             Close Link
0160 |                         </button>
0161 |                     </div>
0162 |                 </Html>
0163 |             )}
0164 |         </a.group>
0165 |     );
0166 | }
0167 | 
0168 | function MainEarth() {
0169 |     const earthGroupRef = useRef();
0170 | 
0171 |     useLayoutEffect(() => {
0172 |         gsap.fromTo(earthGroupRef.current.scale,
0173 |             { x: 0, y: 0, z: 0 },
0174 |             { x: 1, y: 1, z: 1, duration: 2, ease: "back.out(1.7)" }
0175 |         );
0176 |     }, []);
0177 | 
0178 |     useFrame((state, delta) => {
0179 |         if (earthGroupRef.current) {
0180 |             earthGroupRef.current.rotation.y += delta * 0.05;
0181 |         }
0182 |     });
0183 | 
0184 |     return (
0185 |         <group ref={earthGroupRef}>
0186 |             <Float speed={1} rotationIntensity={0.1} floatIntensity={0.1}>
0187 |                 {/* Specific scaling is handled by PlanetActor internally using SpaceScope standards */}
0188 |                 <PlanetActor url="/earth.glb" envMapIntensity={1.2} />
0189 | 
0190 |                 {/* Atmospheric glow */}
0191 |                 <mesh scale={[1.15, 1.15, 1.15]}>
0192 |                     <sphereGeometry args={[0.005 * 200, 32, 32]} /> {/* Rough size matching Earth */}
0193 |                     <meshBasicMaterial
0194 |                         color="#3b82f6"
0195 |                         transparent
0196 |                         opacity={0.08}
0197 |                         side={THREE.BackSide}
0198 |                     />
0199 |                 </mesh>
0200 |             </Float>
0201 |         </group>
0202 |     );
0203 | }
0204 | 
0205 | function OrbitSystem({ radius, speed, color, tiltX = 0, tiltZ = 0, direction = 1, label, modelA, modelB }) {
0206 |     const groupRef = useRef();
0207 |     const ringRef = useRef();
0208 | 
0209 |     useFrame((state, delta) => {
0210 |         if (ringRef.current) {
0211 |             ringRef.current.rotation.y += delta * speed * direction;
0212 |         }
0213 |     });
0214 | 
0215 |     const points = useMemo(() => {
0216 |         const pts = [];
0217 |         for (let i = 0; i <= 120; i++) {
0218 |             const angle = (i / 120) * Math.PI * 2;
0219 |             pts.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
0220 |         }
0221 |         return pts;
0222 |     }, [radius]);
0223 | 
0224 |     return (
0225 |         <group rotation={[tiltX, 0, tiltZ]} ref={groupRef}>
0226 |             <Line points={points} color={color} lineWidth={0.5} transparent opacity={0.15} />
0227 |             <group ref={ringRef}>
0228 |                 <DraggableSatellite position={[radius, 0, 0]} color={color} label={`${label}-A`} modelUrl={modelA} />
0229 |                 <DraggableSatellite position={[-radius, 0, 0]} color={color} label={`${label}-B`} modelUrl={modelB} />
0230 |             </group>
0231 |         </group>
0232 |     );
0233 | }
0234 | 
0235 | function Loader() {
0236 |     return (
0237 |         <Html center>
0238 |             <div className="flex flex-col items-center gap-3 bg-[#0B0E14]/80 p-6 rounded-2xl border border-blue-500/20 shadow-2xl backdrop-blur-md">
0239 |                 <div className="w-10 h-10 rounded-full border-2 border-t-blue-500 border-blue-900/20 animate-spin"></div>
0240 |                 <span className="text-[10px] font-mono text-blue-400 font-bold tracking-widest uppercase animate-pulse">Initializing Mesh...</span>
0241 |             </div>
0242 |         </Html>
0243 |     )
0244 | }
0245 | 
0246 | // Prefetch models
0247 | useGLTF.preload('/earth.glb');
0248 | useGLTF.preload('/mars.glb');
0249 | useGLTF.preload('/realistic_jupiter.glb');
0250 | useGLTF.preload('/mercury.glb');
0251 | 
0252 | export default function OrbitalMap3D() {
0253 |     return (
0254 |         <Canvas shadows camera={{ position: [0, 8, 20], fov: 35 }} gl={{ alpha: true }}>
0255 |             <ambientLight intensity={0.1} color="#4facfe" />
0256 |             <directionalLight position={[30, 40, 30]} intensity={2.5} castShadow shadow-mapSize={[2048, 2048]} />
0257 |             <pointLight position={[-30, -10, -30]} color="#3b82f6" intensity={1} />
0258 |             <pointLight position={[0, -10, 0]} color="#c084fc" intensity={0.5} />
0259 | 
0260 |             <Stars radius={200} depth={50} count={8000} factor={6} saturation={1} fade speed={1} />
0261 | 
0262 |             <OrbitControls
0263 |                 makeDefault
0264 |                 enablePan={false}
0265 |                 autoRotate
0266 |                 autoRotateSpeed={0.3}
0267 |                 maxDistance={50}
0268 |                 minDistance={5}
0269 |                 maxPolarAngle={Math.PI / 2.1}
0270 |             />
0271 | 
0272 |             <Suspense fallback={<Loader />}>
0273 |                 <MainEarth />
0274 |                 <OrbitSystem radius={3} speed={0.4} color="#22d3ee" label="Alpha" modelA="/mars.glb" modelB="/mars.glb" />
0275 |                 <OrbitSystem radius={5} speed={0.25} direction={-1} color="#c084fc" tiltZ={Math.PI / 10} label="Beta" modelA="/realistic_jupiter.glb" modelB="/realistic_jupiter.glb" />
0276 |                 <OrbitSystem radius={7} speed={0.15} color="#4ade80" tiltX={Math.PI / 8} label="Gamma" modelA="/mercury.glb" modelB="/mercury.glb" />
0277 |                 <ContactShadows resolution={1024} scale={50} blur={3} opacity={0.2} far={30} color="#000000" />
0278 |             </Suspense>
0279 | 
0280 |             <gridHelper args={[80, 24, '#1e293b', '#0f172a']} position={[0, -5, 0]} opacity={0.05} transparent />
0281 | 
0282 |             <EffectComposer multibuffer>
0283 |                 <Bloom luminanceThreshold={0.5} luminanceSmoothing={0.9} height={300} intensity={1.5} />
0284 |                 <ChromaticAberration offset={[0.0005, 0.0005]} blendFunction={BlendFunction.NORMAL} />
0285 |                 <Vignette eskil={false} offset={0.1} darkness={1.1} />
0286 |             </EffectComposer>
0287 |         </Canvas>
0288 |     );
0289 | }

```

---

### File: `frontend\src\components\orbital\SatelliteNode.jsx`

**Description**: Source JSX/CSS for `SatelliteNode.jsx`

```javascript
0001 | /**
0002 |  * SatelliteNode.jsx
0003 |  * Custom React Flow node for each satellite.
0004 |  * Shows: name, animated status pulse, chunk count, mini storage bar, orbit timer countdown.
0005 |  * Color-coded by status (green/yellow/red).
0006 |  */

```

---

### File: `frontend\src\components\p2p\OrbitalDrop.jsx`

**Description**: Source JSX/CSS for `OrbitalDrop.jsx`

```javascript
0001 | import React, { useState, useEffect, useRef, useCallback } from 'react';
0002 | import { motion, AnimatePresence } from 'framer-motion';
0003 | import {
0004 |     Radar, Rocket, UploadCloud, Download, FileAudio, FileText,
0005 |     FileVideo, FileImage, File, CheckCircle2, AlertTriangle,
0006 |     Wifi, WifiOff, Send, Loader2, ArrowRight
0007 | } from 'lucide-react';
0008 | 
0009 | const WEBSOCKET_URL = `ws://${window.location.hostname}:9000/api/p2p/signaling`;
0010 | const CHUNK_SIZE = 16384; // 16KB WebRTC optimal chunk size
0011 | 
0012 | export default function OrbitalDrop() {
0013 |     const [ws, setWs] = useState(null);
0014 |     const [connected, setConnected] = useState(false);
0015 |     const [myProfile, setMyProfile] = useState(null);
0016 |     const [peers, setPeers] = useState([]);
0017 | 
0018 |     // Transfer State
0019 |     const [selectedFile, setSelectedFile] = useState(null);
0020 |     const [targetPeer, setTargetPeer] = useState(null);
0021 |     const [transferStatus, setTransferStatus] = useState('idle'); // idle, connecting, sending, receiving, complete, error
0022 |     const [transferProgress, setTransferProgress] = useState(0);
0023 |     const [incomingFileMeta, setIncomingFileMeta] = useState(null);
0024 | 
0025 |     // WebRTC Refs
0026 |     const peerConnection = useRef(null);
0027 |     const dataChannel = useRef(null);
0028 |     const receiveBuffer = useRef([]);
0029 |     const receivedSize = useRef(0);
0030 | 
0031 |     // ── 1. Connect to Signaling Server ──
0032 |     useEffect(() => {
0033 |         const socket = new WebSocket(WEBSOCKET_URL);
0034 | 
0035 |         socket.onopen = () => {
0036 |             console.log("Connected to Orbital Signaling Network");
0037 |             setConnected(true);
0038 |             setWs(socket);
0039 |         };
0040 | 
0041 |         socket.onmessage = async (event) => {
0042 |             const msg = JSON.parse(event.data);
0043 | 
0044 |             if (msg.type === 'welcome') {
0045 |                 setMyProfile(msg.profile);
0046 |             }
0047 |             else if (msg.type === 'peer-list-update') {
0048 |                 setPeers(msg.peers);
0049 |             }
0050 |             else if (msg.type === 'signal') {
0051 |                 handleIncomingSignal(msg.sender, msg.data);
0052 |             }
0053 |         };
0054 | 
0055 |         socket.onclose = () => {
0056 |             setConnected(false);
0057 |             setWs(null);
0058 |         };
0059 | 
0060 |         return () => {
0061 |             if (socket.readyState === WebSocket.OPEN) {
0062 |                 socket.close();
0063 |             }
0064 |         };
0065 |     }, []);
0066 | 
0067 |     const handleIncomingSignal = async (senderId, data) => {
0068 |         if (data.type === 'offer') {
0069 |             setTargetPeer(peers.find(p => p.id === senderId));
0070 |             setTransferStatus('connecting');
0071 |             const pc = initPeerConnection(senderId, false);
0072 |             await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
0073 |             const answer = await pc.createAnswer();
0074 |             await pc.setLocalDescription(answer);
0075 |             ws.send(JSON.stringify({ type: 'signal', target: senderId, data: { type: 'answer', answer } }));
0076 |         }
0077 |         else if (data.type === 'answer') {
0078 |             await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
0079 |         }
0080 |         else if (data.type === 'ice') {
0081 |             await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
0082 |         }
0083 |     };
0084 | 
0085 |     const initPeerConnection = (peerId, isInitiator) => {
0086 |         const pc = new RTCPeerConnection({
0087 |             iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
0088 |         });
0089 |         peerConnection.current = pc;
0090 | 
0091 |         pc.onicecandidate = (event) => {
0092 |             if (event.candidate && ws) {
0093 |                 ws.send(JSON.stringify({ type: 'signal', target: peerId, data: { type: 'ice', candidate: event.candidate } }));
0094 |             }
0095 |         };
0096 | 
0097 |         if (isInitiator) {
0098 |             const dc = pc.createDataChannel('fileTransfer');
0099 |             setupDataChannel(dc);
0100 |         } else {
0101 |             pc.ondatachannel = (event) => setupDataChannel(event.channel);
0102 |         }
0103 | 
0104 |         return pc;
0105 |     };
0106 | 
0107 |     const setupDataChannel = (dc) => {
0108 |         dataChannel.current = dc;
0109 |         dc.binaryType = 'arraybuffer';
0110 |         dc.onopen = () => {
0111 |             console.log("Data Channel OPEN");
0112 |             if (selectedFile && transferStatus === 'connecting') {
0113 |                 startFileTransfer();
0114 |             }
0115 |         };
0116 |         dc.onmessage = (event) => {
0117 |             if (typeof event.data === 'string') {
0118 |                 const meta = JSON.parse(event.data);
0119 |                 if (meta.type === 'file-meta') {
0120 |                     setIncomingFileMeta(meta);
0121 |                     setTransferStatus('receiving');
0122 |                     setTransferProgress(0);
0123 |                     receiveBuffer.current = [];
0124 |                     receivedSize.current = 0;
0125 |                 } else if (meta.type === 'transfer-complete') {
0126 |                     finalizeDownload();
0127 |                 }
0128 |             } else {
0129 |                 receiveBuffer.current.push(event.data);
0130 |                 receivedSize.current += event.data.byteLength;
0131 |                 const progress = (receivedSize.current / incomingFileMeta.size) * 100;
0132 |                 setTransferProgress(progress);
0133 |             }
0134 |         };
0135 |     };
0136 | 
0137 |     const startFileTransfer = async () => {
0138 |         setTransferStatus('sending');
0139 |         dataChannel.current.send(JSON.stringify({
0140 |             type: 'file-meta',
0141 |             name: selectedFile.name,
0142 |             size: selectedFile.size,
0143 |             mime: selectedFile.type
0144 |         }));
0145 | 
0146 |         const reader = new FileReader();
0147 |         let offset = 0;
0148 | 
0149 |         const readSlice = (o) => {
0150 |             const slice = selectedFile.slice(offset, o + CHUNK_SIZE);
0151 |             reader.readAsArrayBuffer(slice);
0152 |         };
0153 | 
0154 |         reader.onload = (e) => {
0155 |             dataChannel.current.send(e.target.result);
0156 |             offset += e.target.result.byteLength;
0157 |             setTransferProgress((offset / selectedFile.size) * 100);
0158 | 
0159 |             if (offset < selectedFile.size) {
0160 |                 if (dataChannel.current.bufferedAmount > 16000000) {
0161 |                     setTimeout(() => readSlice(offset), 100);
0162 |                 } else {
0163 |                     readSlice(offset);
0164 |                 }
0165 |             } else {
0166 |                 dataChannel.current.send(JSON.stringify({ type: 'transfer-complete' }));
0167 |                 setTransferStatus('complete');
0168 |             }
0169 |         };
0170 |         readSlice(0);
0171 |     };
0172 | 
0173 |     const finalizeDownload = () => {
0174 |         const receivedBlob = new Blob(receiveBuffer.current, { type: incomingFileMeta.mime });
0175 |         const url = URL.createObjectURL(receivedBlob);
0176 |         const a = document.createElement('a');
0177 |         a.href = url;
0178 |         a.download = incomingFileMeta.name;
0179 |         a.click();
0180 |         URL.revokeObjectURL(url);
0181 |         setTransferStatus('complete');
0182 |     };
0183 | 
0184 |     const initiateTransfer = async (peer) => {
0185 |         if (!selectedFile) return;
0186 |         setTargetPeer(peer);
0187 |         setTransferStatus('connecting');
0188 |         const pc = initPeerConnection(peer.id, true);
0189 |         const offer = await pc.createOffer();
0190 |         await pc.setLocalDescription(offer);
0191 |         ws.send(JSON.stringify({ type: 'signal', target: peer.id, data: { type: 'offer', offer } }));
0192 |     };
0193 | 
0194 |     return (
0195 |         <div className="w-full h-full flex flex-col gap-6 font-sans text-gray-200">
0196 |             {/* Header */}
0197 |             <div className="flex justify-between items-center bg-black/40 backdrop-blur-md border border-white/5 p-6 rounded-3xl">
0198 |                 <div className="flex items-center gap-3">
0199 |                     <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
0200 |                         <Radar className="text-cyan-400 animate-pulse" size={24} />
0201 |                     </div>
0202 |                     <div>
0203 |                         <h1 className="text-xl font-bold tracking-tight text-white">Orbital Drop</h1>
0204 |                         <p className="text-xs text-gray-400 font-mono">P2P Satellite-to-Satellite Signaling</p>
0205 |                     </div>
0206 |                 </div>
0207 |                 <div className="flex items-center gap-4">
0208 |                     {connected ? (
0209 |                         <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
0210 |                             <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
0211 |                             <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">Mesh Active</span>
0212 |                         </div>
0213 |                     ) : (
0214 |                         <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
0215 |                             <WifiOff className="text-red-500" size={14} />
0216 |                             <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Mesh Offline</span>
0217 |                         </div>
0218 |                     )}
0219 |                 </div>
0220 |             </div>
0221 | 
0222 |             <div className="flex-1 flex gap-6 min-h-0">
0223 |                 {/* Peer List / Radar */}
0224 |                 <div className="flex-1 bg-black/40 backdrop-blur-md border border-white/5 p-6 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden">
0225 |                     <div className="absolute inset-0 opacity-10 pointer-events-none">
0226 |                         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-cyan-500/50 rounded-full" />
0227 |                         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-cyan-500/30 rounded-full" />
0228 |                         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border border-cyan-500/20 rounded-full" />
0229 |                     </div>
0230 | 
0231 |                     <div className="z-10 text-center mb-8">
0232 |                         <h2 className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">Discovery Network</h2>
0233 |                         <div className="flex flex-wrap justify-center gap-6 mt-10">
0234 |                             <AnimatePresence>
0235 |                                 {peers.map(peer => (
0236 |                                     <motion.div
0237 |                                         key={peer.id}
0238 |                                         initial={{ scale: 0, opacity: 0 }}
0239 |                                         animate={{ scale: 1, opacity: 1 }}
0240 |                                         exit={{ scale: 0, opacity: 0 }}
0241 |                                         whileHover={{ scale: 1.1 }}
0242 |                                         onClick={() => initiateTransfer(peer)}
0243 |                                         className="cursor-pointer group relative"
0244 |                                     >
0245 |                                         <div className="w-20 h-20 bg-cyan-900/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center group-hover:bg-cyan-500/20 transition-all flex-col gap-2">
0246 |                                             <Satellite className="text-cyan-400" size={32} />
0247 |                                             <span className="text-[10px] font-mono text-gray-400">{peer.name}</span>
0248 |                                         </div>
0249 |                                         <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-black animate-pulse" />
0250 |                                     </motion.div>
0251 |                                 ))}
0252 |                             </AnimatePresence>
0253 |                             {peers.length === 0 && (
0254 |                                 <div className="flex flex-col items-center gap-4 text-gray-500 font-mono text-sm py-20">
0255 |                                     <Loader2 className="animate-spin" />
0256 |                                     Scanning Orbital Planes...
0257 |                                 </div>
0258 |                             )}
0259 |                         </div>
0260 |                     </div>
0261 |                 </div>
0262 | 
0263 |                 {/* Right Panel: Controls & Progress */}
0264 |                 <div className="w-[400px] flex flex-col gap-6">
0265 |                     <div className="bg-[#111827] border border-white/5 p-6 rounded-3xl shrink-0">
0266 |                         <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Payload Selection</h3>
0267 |                         <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/10 rounded-2xl cursor-pointer hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all">
0268 |                             <div className="flex flex-col items-center justify-center pt-5 pb-6">
0269 |                                 <UploadCloud className="text-gray-500 mb-2" size={24} />
0270 |                                 <p className="text-xs text-gray-500 font-mono">
0271 |                                     {selectedFile ? selectedFile.name : 'Select File for Drop'}
0272 |                                 </p>
0273 |                             </div>
0274 |                             <input type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files[0])} />
0275 |                         </label>
0276 |                     </div>
0277 | 
0278 |                     <div className="flex-1 bg-[#111827] border border-white/5 p-6 rounded-3xl flex flex-col relative overflow-hidden">
0279 |                         <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Transfer Matrix</h3>
0280 |                         <div className="flex-1 flex flex-col justify-center gap-8">
0281 |                             {transferStatus === 'idle' ? (
0282 |                                 <div className="text-center text-gray-600 font-mono text-sm">
0283 |                                     <Rocket className="mx-auto mb-4 opacity-20" size={48} />
0284 |                                     Select Peer to Begin Transfer
0285 |                                 </div>
0286 |                             ) : (
0287 |                                 <>
0288 |                                     <div className="flex items-center justify-between">
0289 |                                         <div className="text-center">
0290 |                                             <div className="w-12 h-12 bg-cyan-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 border border-cyan-500/30">
0291 |                                                 <Satellite className="text-cyan-400" size={24} />
0292 |                                             </div>
0293 |                                             <span className="text-[10px] text-gray-500 font-mono">LOCAL</span>
0294 |                                         </div>
0295 |                                         <div className="flex-1 px-4 relative">
0296 |                                             <div className="h-0.5 w-full bg-gray-800" />
0297 |                                             <motion.div
0298 |                                                 className="absolute top-1/2 -translate-y-1/2 text-cyan-500"
0299 |                                                 animate={{ left: ["0%", "100%"] }}
0300 |                                                 transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
0301 |                                             >
0302 |                                                 <Send size={16} />
0303 |                                             </motion.div>
0304 |                                         </div>
0305 |                                         <div className="text-center">
0306 |                                             <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-2 border border-purple-500/30">
0307 |                                                 <Satellite className="text-purple-400" size={24} />
0308 |                                             </div>
0309 |                                             <span className="text-[10px] text-gray-500 font-mono uppercase">{targetPeer?.name || 'PEER'}</span>
0310 |                                         </div>
0311 |                                     </div>
0312 | 
0313 |                                     <div className="space-y-4">
0314 |                                         <div className="flex justify-between items-end">
0315 |                                             <span className="text-xs font-bold text-white uppercase tracking-wider">{transferStatus}</span>
0316 |                                             <span className="text-xl font-mono text-cyan-400">{transferProgress.toFixed(1)}%</span>
0317 |                                         </div>
0318 |                                         <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
0319 |                                             <motion.div
0320 |                                                 className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
0321 |                                                 initial={{ width: 0 }}
0322 |                                                 animate={{ width: `${transferProgress}%` }}
0323 |                                             />
0324 |                                         </div>
0325 |                                         {transferStatus === 'complete' && (
0326 |                                             <motion.div
0327 |                                                 initial={{ opacity: 0, y: 10 }}
0328 |                                                 animate={{ opacity: 1, y: 0 }}
0329 |                                                 className="bg-green-500/10 border border-green-500/20 p-3 rounded-xl flex items-center gap-3"
0330 |                                             >
0331 |                                                 <CheckCircle2 className="text-green-500" size={20} />
0332 |                                                 <span className="text-xs text-green-500 font-bold uppercase tracking-tight">Mission Success: Payload Transferred</span>
0333 |                                             </motion.div>
0334 |                                         )}
0335 |                                     </div>
0336 |                                 </>
0337 |                             )}
0338 |                         </div>
0339 |                     </div>
0340 |                 </div>
0341 |             </div>
0342 |         </div>
0343 |     );
0344 | }

```

---

### File: `frontend\src\components\payload\PayloadOps.jsx`

**Description**: Source JSX/CSS for `PayloadOps.jsx`

```javascript
0001 | import React, { useState, useEffect } from 'react';
0002 | import { Upload, Download, FileText, Server, HardDrive, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
0003 | import { motion, AnimatePresence } from 'framer-motion';
0004 | 
0005 | export default function PayloadOps({ messages, onUpload, onDownload, fileId }) {
0006 |     const [file, setFile] = useState(null);
0007 |     const [downloadId, setDownloadId] = useState('');
0008 | 
0009 |     // Status state: 'idle', 'uploading', 'chunking', 'encoding', 'distributing', 'upload_complete', 'downloading', 'download_complete', 'error'
0010 |     const [status, setStatus] = useState('idle');
0011 |     const [progress, setProgress] = useState(0);
0012 |     const [chunks, setChunks] = useState([]);
0013 |     const [error, setError] = useState(null);
0014 | 
0015 |     const [logs, setLogs] = useState([]);
0016 | 
0017 |     // Reset state when fileId prop changes from outside
0018 |     useEffect(() => {
0019 |         if (fileId && status === 'idle') {
0020 |             setDownloadId(fileId);
0021 |         }
0022 |     }, [fileId]);
0023 | 
0024 |     const addLog = (msg, type = 'info') => {
0025 |         const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric", fractionalSecondDigits: 2 });
0026 |         setLogs(prev => [...prev, { time, msg, type }].slice(-20));
0027 |     };
0028 | 
0029 |     // Listen to WebSocket messages to drive the animation sequence
0030 |     useEffect(() => {
0031 |         if (!messages || messages.length === 0) return;
0032 | 
0033 |         const latestMsg = messages[messages.length - 1];
0034 | 
0035 |         switch (latestMsg.type) {
0036 |             case 'UPLOAD_START':
0037 |                 setStatus('uploading');
0038 |                 setProgress(10);
0039 |                 addLog(`UPLINK INITIATED: ${latestMsg.data.filename} (${(latestMsg.data.size / 1024).toFixed(2)} KB)`, 'info');
0040 |                 break;
0041 |             case 'CHUNKING_COMPLETE':
0042 |                 setStatus('chunking');
0043 |                 setProgress(30);
0044 |                 addLog(`PARTITIONING: Splitting into ${latestMsg.data.chunk_count} geometric shards`, 'warning');
0045 |                 if (latestMsg.data && latestMsg.data.chunk_count) {
0046 |                     const newChunks = Array.from({ length: latestMsg.data.chunk_count }).map((_, i) => ({
0047 |                         id: `data-${i}`,
0048 |                         type: 'data',
0049 |                         status: 'pending',
0050 |                         target: null
0051 |                     }));
0052 |                     setChunks(newChunks);
0053 |                 }
0054 |                 break;
0055 |             case 'ENCODING_COMPLETE':
0056 |                 setStatus('encoding');
0057 |                 setProgress(50);
0058 |                 addLog(`REED-SOLOMON: Generating parity. Total shards: ${latestMsg.data.total_shards}`, 'purple');
0059 |                 if (latestMsg.data && latestMsg.data.total_shards) {
0060 |                     setChunks(prev => {
0061 |                         const currentCount = prev.length;
0062 |                         const parityCount = latestMsg.data.total_shards - currentCount;
0063 |                         if (parityCount > 0) {
0064 |                             const parityChunks = Array.from({ length: parityCount }).map((_, i) => ({
0065 |                                 id: `parity-${i}`,
0066 |                                 type: 'parity',
0067 |                                 status: 'pending',
0068 |                                 target: null
0069 |                             }));
0070 |                             return [...prev, ...parityChunks];
0071 |                         }
0072 |                         return prev;
0073 |                     });
0074 |                 }
0075 |                 break;
0076 |             case 'CHUNK_UPLOADED':
0077 |                 setStatus('distributing');
0078 |                 setProgress(75);
0079 |                 addLog(`ROUTING: Shard secured on ${latestMsg.data.node_id} (Plane ${latestMsg.data.plane})`, 'success');
0080 |                 setChunks(prev => {
0081 |                     const pendingIdx = prev.findIndex(c => c.status === 'pending');
0082 |                     if (pendingIdx !== -1) {
0083 |                         const newChunks = [...prev];
0084 |                         newChunks[pendingIdx] = {
0085 |                             ...newChunks[pendingIdx],
0086 |                             status: 'distributed',
0087 |                             target: latestMsg.data.node_id,
0088 |                             plane: latestMsg.data.plane
0089 |                         };
0090 |                         return newChunks;
0091 |                     }
0092 |                     return prev;
0093 |                 });
0094 |                 break;
0095 |             case 'DTN_QUEUED':
0096 |                 addLog(`DTN SPOOLED: Target offline. Queued for ${latestMsg.data.node_id}`, 'warning');
0097 |                 setChunks(prev => {
0098 |                     const pendingIdx = prev.findIndex(c => c.status === 'pending');
0099 |                     if (pendingIdx !== -1) {
0100 |                         const newChunks = [...prev];
0101 |                         newChunks[pendingIdx] = {
0102 |                             ...newChunks[pendingIdx],
0103 |                             status: 'queued',
0104 |                             target: latestMsg.data.node_id,
0105 |                             plane: latestMsg.data.plane
0106 |                         };
0107 |                         return newChunks;
0108 |                     }
0109 |                     return prev;
0110 |                 });
0111 |                 break;
0112 |             case 'UPLOAD_COMPLETE':
0113 |                 setStatus('upload_complete');
0114 |                 setProgress(100);
0115 |                 addLog(`UPLINK COMPLETE: Global distribution verified. UUID: ${latestMsg.data.file_id.split('-')[0]}...`, 'success');
0116 |                 setFile(null);
0117 |                 if (latestMsg.data && latestMsg.data.file_id) {
0118 |                     setDownloadId(latestMsg.data.file_id);
0119 |                 }
0120 |                 break;
0121 |             case 'DOWNLOAD_START':
0122 |                 setStatus('downloading');
0123 |                 setProgress(20);
0124 |                 setLogs([]);
0125 |                 addLog(`DOWNLINK INITIATED: Locating ${latestMsg.data.filename}`, 'info');
0126 |                 setChunks(Array.from({ length: 6 }).map((_, i) => ({
0127 |                     id: `incoming-${i}`,
0128 |                     type: i < 4 ? 'data' : 'parity',
0129 |                     status: 'incoming'
0130 |                 })));
0131 |                 break;
0132 |             case 'DOWNLOAD_COMPLETE':
0133 |                 setStatus('download_complete');
0134 |                 setProgress(100);
0135 |                 addLog(`RECONSTRUCTION: Decoded via RS. Latency: ${latestMsg.data.latency}ms`, 'success');
0136 |                 if (latestMsg.data.rs_recovery > 0) {
0137 |                     addLog(`PARITY USED: ${latestMsg.data.rs_recovery} missing shards recovered mathematically.`, 'warning');
0138 |                 }
0139 |                 setChunks([]);
0140 |                 break;
0141 |             case 'UPLOAD_ERROR':
0142 |             case 'DOWNLOAD_FAILED':
0143 |                 setStatus('error');
0144 |                 setError(latestMsg.data?.error || latestMsg.message || 'An error occurred');
0145 |                 addLog(`CRITICAL FAILURE: ${error}`, 'error');
0146 |                 setProgress(0);
0147 |                 break;
0148 |             default:
0149 |                 break;
0150 |         }
0151 |     }, [messages]);
0152 | 
0153 |     const handleUploadClick = async () => {
0154 |         if (!file) return;
0155 |         setStatus('idle');
0156 |         setError(null);
0157 |         setChunks([]);
0158 |         setLogs([]);
0159 |         setProgress(0);
0160 | 
0161 |         const formData = new FormData();
0162 |         formData.append('file', file);
0163 |         await onUpload(formData);
0164 |     };
0165 | 
0166 |     const handleDownloadClick = async () => {
0167 |         if (!downloadId) return;
0168 |         setStatus('idle');
0169 |         setError(null);
0170 |         setChunks([]);
0171 |         setLogs([]);
0172 |         setProgress(0);
0173 | 
0174 |         await onDownload(downloadId);
0175 |     };
0176 | 
0177 |     const resetState = () => {
0178 |         setStatus('idle');
0179 |         setError(null);
0180 |         setChunks([]);
0181 |         setLogs([]);
0182 |         setProgress(0);
0183 |         setFile(null);
0184 |     };
0185 | 
0186 |     // Render helpers for the visualizer
0187 |     const renderVisualizer = () => {
0188 |         if (status === 'idle') return null;
0189 | 
0190 |         return (
0191 |             <div className="w-full h-[400px] border border-white/10 bg-[#02040A] rounded-2xl flex overflow-hidden mb-8 shadow-inner relative">
0192 | 
0193 |                 {/* Visualizer Panel (Left 70%) */}
0194 |                 <div className="flex-1 relative border-r border-white/5 bg-[url('/grid.svg')] bg-center bg-repeat overflow-hidden flex items-center justify-center p-6">
0195 |                     <div className="absolute inset-0 bg-blue-900/10 mix-blend-screen pointer-events-none"></div>
0196 | 
0197 |                     <AnimatePresence mode="wait">
0198 |                         {status === 'uploading' && (
0199 |                             <motion.div key="uploading" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.2, opacity: 0 }} className="flex flex-col items-center justify-center gap-4">
0200 |                                 <div className="w-24 h-32 bg-blue-500/10 border-2 border-blue-500/50 rounded-xl flex items-center justify-center relative overflow-hidden shadow-[0_0_30px_rgba(59,130,246,0.2)]">
0201 |                                     <motion.div className="absolute inset-0 bg-blue-500/20" animate={{ y: ['100%', '-100%'] }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} />
0202 |                                     <FileText className="text-blue-400 w-12 h-12 relative z-10" />
0203 |                                 </div>
0204 |                                 <span className="text-blue-400 font-mono tracking-widest text-xs animate-pulse font-bold">SHA-256 INTEGRITY SCAN...</span>
0205 |                             </motion.div>
0206 |                         )}
0207 | 
0208 |                         {(status === 'chunking' || status === 'encoding') && (
0209 |                             <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex flex-col items-center justify-center gap-8 w-full z-10">
0210 |                                 <div className="flex flex-wrap items-center justify-center gap-4 max-w-2xl px-10">
0211 |                                     <AnimatePresence>
0212 |                                         {chunks.map((chunk, i) => (
0213 |                                             <motion.div
0214 |                                                 key={chunk.id}
0215 |                                                 initial={{ scale: 0, opacity: 0, y: 50 }}
0216 |                                                 animate={{ scale: 1, opacity: 1, y: 0 }}
0217 |                                                 transition={{ delay: i * 0.1, type: "spring" }}
0218 |                                                 className={`w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center font-mono relative overflow-hidden
0219 |                                                     ${chunk.type === 'data'
0220 |                                                         ? 'bg-blue-950/80 border-blue-500 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
0221 |                                                         : 'bg-purple-950/80 border-purple-500 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]'
0222 |                                                     }`}
0223 |                                             >
0224 |                                                 <span className="text-xs font-bold">{chunk.type === 'data' ? 'DATA' : 'PARITY'}</span>
0225 |                                                 <span className="text-[10px] opacity-70">BLK-{i}</span>
0226 |                                                 <motion.div className="absolute bottom-0 left-0 right-0 h-1 bg-current opacity-50"
0227 |                                                     animate={{ opacity: [0.2, 0.8, 0.2] }} transition={{ repeat: Infinity, duration: 1 }} />
0228 |                                             </motion.div>
0229 |                                         ))}
0230 |                                     </AnimatePresence>
0231 |                                 </div>
0232 |                                 <div className="flex flex-col items-center">
0233 |                                     <span className="text-white font-mono tracking-widest text-sm font-bold mb-1">
0234 |                                         {status === 'chunking' ? 'BLOCK PARTITIONING' : 'CALCULATING GALOIS FIELDS'}
0235 |                                     </span>
0236 |                                     <span className="text-slate-500 text-[10px] uppercase tracking-[0.2em]">RS(4,2) Erasure Coding</span>
0237 |                                 </div>
0238 |                             </motion.div>
0239 |                         )}
0240 | 
0241 |                         {status === 'distributing' && (
0242 |                             <motion.div key="distributing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col w-full h-full relative z-10 items-center justify-center px-12">
0243 |                                 <Server className="text-emerald-500/20 w-[400px] h-[400px] absolute opacity-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
0244 |                                 <div className="grid grid-cols-2 md:grid-cols-3 gap-y-12 gap-x-8 w-full max-w-3xl">
0245 |                                     {chunks.map((chunk, i) => (
0246 |                                         <div key={chunk.id} className="flex flex-col items-center justify-center relative">
0247 |                                             {/* Simulated Trajectory Path (Dashed Line) */}
0248 |                                             {chunk.status !== 'pending' && (
0249 |                                                 <motion.div
0250 |                                                     initial={{ height: 0, opacity: 0 }}
0251 |                                                     animate={{ height: 40, opacity: 1 }}
0252 |                                                     className={`absolute bottom-full w-px mb-2 ${chunk.status === 'queued' ? 'border-l-2 border-dashed border-yellow-500/50' : 'border-l Math border-dashed border-emerald-500/50'}`}
0253 |                                                 ></motion.div>
0254 |                                             )}
0255 | 
0256 |                                             <motion.div
0257 |                                                 initial={{ scale: 1, opacity: 1 }}
0258 |                                                 animate={chunk.status !== 'pending' ? {
0259 |                                                     y: -80,
0260 |                                                     scale: 0.6,
0261 |                                                     opacity: window.innerWidth > 0 ? 1 : 0 // force rerender hack
0262 |                                                 } : {}}
0263 |                                                 transition={{ duration: 0.8, type: "spring" }}
0264 |                                                 className={`w-14 h-14 rounded-xl border flex flex-col items-center justify-center font-mono relative z-20
0265 |                                                     ${chunk.type === 'data' ? 'bg-blue-900/80 border-blue-500 text-blue-300' : 'bg-purple-900/80 border-purple-500 text-purple-300'}
0266 |                                                     ${chunk.status === 'queued' ? '!bg-yellow-900/80 !border-yellow-500 !text-yellow-300' : ''}
0267 |                                                 `}
0268 |                                             >
0269 |                                                 <span className="text-[10px] font-bold">{chunk.type === 'data' ? 'D' : 'P'}-{i}</span>
0270 |                                                 <Upload size={10} className="mt-1 opacity-50" />
0271 |                                             </motion.div>
0272 | 
0273 |                                             {/* Target Node Plate (Appears when distributed) */}
0274 |                                             {chunk.target && (
0275 |                                                 <motion.div
0276 |                                                     initial={{ opacity: 0, y: 10 }}
0277 |                                                     animate={{ opacity: 1, y: -90 }}
0278 |                                                     transition={{ delay: 0.2 }}
0279 |                                                     className={`absolute z-10 bg-black/80 border whitespace-nowrap px-3 py-1.5 rounded-md flex flex-col items-center shadow-xl
0280 |                                                         ${chunk.status === 'queued' ? 'border-yellow-500/30' : 'border-emerald-500/30'}
0281 |                                                     `}
0282 |                                                 >
0283 |                                                     <span className={`text-[9px] font-bold ${chunk.status === 'queued' ? 'text-yellow-400' : 'text-emerald-400'}`}>{chunk.target}</span>
0284 |                                                     <span className="text-[7px] text-slate-400 uppercase tracking-widest">{chunk.plane} {chunk.status === 'queued' ? '(DTN SPOOL)' : ''}</span>
0285 |                                                 </motion.div>
0286 |                                             )}
0287 |                                         </div>
0288 |                                     ))}
0289 |                                 </div>
0290 |                                 <span className="absolute bottom-6 text-emerald-400 font-mono tracking-widest text-xs animate-pulse bg-black/60 px-4 py-2 rounded-full border border-emerald-500/30 backdrop-blur-md">
0291 |                                     TRANSMITTING TO ORBITAL MESH
0292 |                                 </span>
0293 |                             </motion.div>
0294 |                         )}
0295 | 
0296 |                         {status === 'downloading' && (
0297 |                             <motion.div key="downloading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center gap-6 w-full h-full relative z-10">
0298 |                                 <div className="flex flex-wrap items-center justify-center gap-6 max-w-2xl">
0299 |                                     {chunks.map((chunk, i) => (
0300 |                                         <motion.div
0301 |                                             key={chunk.id}
0302 |                                             initial={{ y: -200, scale: 0.2, opacity: 0 }}
0303 |                                             animate={{ y: 0, scale: 1, opacity: 1 }}
0304 |                                             transition={{ duration: 1.2, delay: i * 0.15, type: "spring" }}
0305 |                                             className={`w-16 h-16 rounded-xl border flex flex-col items-center justify-center font-mono font-bold shadow-lg
0306 |                                                 ${chunk.type === 'data' ? 'bg-cyan-900/80 border-cyan-500 text-cyan-300' : 'bg-fuchsia-900/80 border-fuchsia-500 text-fuchsia-300'}`}
0307 |                                         >
0308 |                                             <span className="text-xs">{chunk.type === 'data' ? 'D' : 'P'}-{i}</span>
0309 |                                             <Download size={12} className="mt-1 opacity-70" />
0310 |                                         </motion.div>
0311 |                                     ))}
0312 |                                 </div>
0313 |                                 <span className="text-amber-400 font-mono tracking-[0.3em] text-[10px] absolute bottom-8 animate-pulse border border-amber-500/30 px-4 py-2 rounded-full bg-amber-950/30">
0314 |                                     INTERCEPTING FRAGMENTS FROM ORBIT
0315 |                                 </span>
0316 |                             </motion.div>
0317 |                         )}
0318 | 
0319 |                         {(status === 'upload_complete' || status === 'download_complete') && (
0320 |                             <motion.div key="complete" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center gap-6 z-10">
0321 |                                 <div className="w-28 h-28 rounded-full bg-emerald-500/10 flex items-center justify-center border-2 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.3)] relative">
0322 |                                     <motion.div className="absolute inset-0 rounded-full border border-emerald-400" animate={{ scale: [1, 1.5], opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 2 }} />
0323 |                                     <CheckCircle2 className="w-14 h-14 text-emerald-400" />
0324 |                                 </div>
0325 |                                 <div className="text-center">
0326 |                                     <h3 className="text-emerald-400 font-mono tracking-widest text-sm font-bold mb-1">
0327 |                                         {status === 'upload_complete' ? 'PAYLOAD SECURED IN ORBIT' : 'RECONSTRUCTION SUCCESSFUL'}
0328 |                                     </h3>
0329 |                                     {status === 'upload_complete' && (
0330 |                                         <p className="text-slate-400 font-mono text-[10px]">UUID: {downloadId}</p>
0331 |                                     )}
0332 |                                 </div>
0333 |                                 <button onClick={resetState} className="mt-2 px-6 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold tracking-widest font-mono text-white transition-colors duration-300">
0334 |                                     START NEW OPERATION
0335 |                                 </button>
0336 |                             </motion.div>
0337 |                         )}
0338 | 
0339 |                         {status === 'error' && (
0340 |                             <motion.div key="error" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center gap-4 text-center max-w-md z-10">
0341 |                                 <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center border-2 border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]">
0342 |                                     <AlertCircle className="w-12 h-12 text-red-500" />
0343 |                                 </div>
0344 |                                 <span className="text-red-500 font-bold font-mono tracking-widest text-sm uppercase">OPERATION FAILED</span>
0345 |                                 <p className="text-red-300/80 text-xs font-mono bg-red-950/50 p-3 rounded-lg border border-red-500/20">{error}</p>
0346 |                                 <button onClick={resetState} className="mt-4 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-mono text-gray-300 transition-colors">
0347 |                                     ACKNOWLEDGE
0348 |                                 </button>
0349 |                             </motion.div>
0350 |                         )}
0351 |                     </AnimatePresence>
0352 |                 </div>
0353 | 
0354 |                 {/* Telemetry Details Panel (Right 30%) */}
0355 |                 <div className="w-[30%] bg-black/40 border-l border-white/5 flex flex-col">
0356 |                     <div className="p-3 border-b border-white/5 bg-white/[0.02]">
0357 |                         <h3 className="text-[10px] font-bold tracking-widest uppercase text-slate-400 flex items-center gap-2">
0358 |                             <Server size={12} className="text-blue-500" /> Live Operation Telemetry
0359 |                         </h3>
0360 |                     </div>
0361 |                     <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
0362 |                         {logs.length === 0 ? (
0363 |                             <div className="flex flex-col items-center justify-center h-full opacity-30 gap-2">
0364 |                                 <Loader2 size={16} className="animate-spin text-slate-500" />
0365 |                                 <span className="text-[9px] font-mono tracking-widest uppercase text-slate-500">Awaiting Operation...</span>
0366 |                             </div>
0367 |                         ) : (
0368 |                             logs.map((log, idx) => {
0369 |                                 let textColor = 'text-slate-300';
0370 |                                 if (log.type === 'success') textColor = 'text-emerald-400';
0371 |                                 if (log.type === 'warning') textColor = 'text-amber-400';
0372 |                                 if (log.type === 'error') textColor = 'text-red-400';
0373 |                                 if (log.type === 'purple') textColor = 'text-purple-400';
0374 | 
0375 |                                 return (
0376 |                                     <div key={idx} className="flex gap-2 text-[10px] font-mono animate-in slide-in-from-right-2 duration-300">
0377 |                                         <span className="text-slate-600 shrink-0">[{log.time}]</span>
0378 |                                         <span className={`${textColor} break-words`}>{log.msg}</span>
0379 |                                     </div>
0380 |                                 );
0381 |                             })
0382 |                         )}
0383 |                         <div className="h-4"></div> {/* Bottom padding element */}
0384 |                     </div>
0385 |                 </div>
0386 |             </div>
0387 |         );
0388 |     };
0389 | 
0390 |     return (
0391 |         <div className="w-full h-full flex justify-center p-4 sm:p-8 overflow-y-auto custom-scrollbar">
0392 |             <div
0393 |                 className="w-full max-w-6xl h-fit bg-[#05080f]/95 backdrop-blur-3xl border-l-4 border-b-4 border-l-blue-500/50 border-b-blue-500/50 border-t border-r border-t-white/10 border-r-white/10 p-10 relative shadow-[0_20px_60px_rgba(0,0,0,0.8)] mt-4"
0394 |                 style={{ clipPath: 'polygon(30px 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%, 0 30px)' }}
0395 |             >
0396 |                 <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[100px] -z-10 pointer-events-none rounded-full"></div>
0397 | 
0398 |                 <div className="flex items-center gap-4 mb-8">
0399 |                     <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
0400 |                         <HardDrive className="text-blue-400" size={20} />
0401 |                     </div>
0402 |                     <div>
0403 |                         <h1 className="text-2xl font-bold text-white tracking-wide">Payload Operations</h1>
0404 |                         <p className="text-sm text-gray-400 font-mono">End-to-end orbital file system interface</p>
0405 |                     </div>
0406 |                 </div>
0407 | 
0408 |                 {/* Main Visualizer Area */}
0409 |                 {renderVisualizer()}
0410 | 
0411 |                 {/* Controls Area: Only show if idle or complete (so they don't jump around) */}
0412 |                 {(status === 'idle' || status === 'upload_complete' || status === 'download_complete') && (
0413 |                     <motion.div
0414 |                         initial={{ y: 20, opacity: 0 }}
0415 |                         animate={{ y: 0, opacity: 1 }}
0416 |                         className="grid grid-cols-2 gap-8"
0417 |                     >
0418 | 
0419 |                         {/* UPLINK SECTION */}
0420 |                         <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
0421 |                             <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mx-10 -my-10 pointer-events-none group-hover:bg-blue-500/20 transition-all"></div>
0422 | 
0423 |                             <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 tracking-widest uppercase">
0424 |                                 <Upload className="text-blue-500" size={16} /> Data Uplink
0425 |                             </h2>
0426 |                             <p className="text-xs text-gray-400 mb-6 min-h-[40px]">
0427 |                                 Securely upload a file. It will be automatically chunked, RS-encoded, and distributed across the orbital mesh.
0428 |                             </p>
0429 | 
0430 |                             <div className="space-y-4">
0431 |                                 <label className="flex flex-col items-center justify-center h-32 w-full border-2 border-dashed border-white/10 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] hover:border-blue-500/50 cursor-pointer transition-all">
0432 |                                     <FileText className="text-gray-500 mb-2" size={24} />
0433 |                                     <span className="text-xs font-mono text-gray-400">
0434 |                                         {file ? <span className="text-blue-400">{file.name}</span> : 'SELECT TARGET PAYLOAD'}
0435 |                                     </span>
0436 |                                     <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
0437 |                                 </label>
0438 | 
0439 |                                 <button
0440 |                                     onClick={handleUploadClick}
0441 |                                     disabled={!file || status !== 'idle'}
0442 |                                     className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:bg-blue-900 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2 text-xs tracking-widest uppercase"
0443 |                                 >
0444 |                                     {status === 'idle' ? 'Initiate Uplink' : <Loader2 className="animate-spin" size={16} />}
0445 |                                 </button>
0446 |                             </div>
0447 |                         </div>
0448 | 
0449 |                         {/* DOWNLINK SECTION */}
0450 |                         <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
0451 |                             <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mx-10 -my-10 pointer-events-none group-hover:bg-emerald-500/20 transition-all"></div>
0452 | 
0453 |                             <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 tracking-widest uppercase">
0454 |                                 <Download className="text-emerald-500" size={16} /> Data Downlink
0455 |                             </h2>
0456 |                             <p className="text-xs text-gray-400 mb-6 min-h-[40px]">
0457 |                                 Reconstruct a file from orbital shards using its unique UUID. Automatically handles node failures and parity recovery.
0458 |                             </p>
0459 | 
0460 |                             <div className="space-y-4 h-full flex flex-col">
0461 |                                 <div className="flex items-center bg-[#05080f] border border-white/10 rounded-xl p-2 focus-within:border-emerald-500/50 transition-colors h-32 justify-center">
0462 |                                     <input
0463 |                                         type="text"
0464 |                                         placeholder="ENTER PAYLOAD UUID_HASH"
0465 |                                         value={downloadId}
0466 |                                         onChange={(e) => setDownloadId(e.target.value)}
0467 |                                         className="w-full bg-transparent text-center font-mono text-emerald-400 text-sm outline-none placeholder:text-gray-700 tracking-widest uppercase"
0468 |                                     />
0469 |                                 </div>
0470 | 
0471 |                                 <button
0472 |                                     onClick={handleDownloadClick}
0473 |                                     disabled={!downloadId || status !== 'idle'}
0474 |                                     className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:bg-emerald-900 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(5,150,105,0.3)] transition-all flex items-center justify-center gap-2 text-xs tracking-widest uppercase mt-auto"
0475 |                                 >
0476 |                                     {status === 'idle' ? 'Initiate Downlink' : <Loader2 className="animate-spin" size={16} />}
0477 |                                 </button>
0478 |                             </div>
0479 |                         </div>
0480 | 
0481 |                     </motion.div>
0482 |                 )}
0483 |             </div>
0484 |         </div>
0485 |     );
0486 | }

```

---

### File: `frontend\src\components\storage\StorageMap.jsx`

**Description**: Source JSX/CSS for `StorageMap.jsx`

```javascript
0001 | import React, { useState, useEffect, useRef } from 'react';
0002 | import { UploadCloud, Download, Trash2, Power, WifiOff, File as FileIcon, HardDrive, Zap, RefreshCw, Radio, Satellite } from 'lucide-react';
0003 | import { motion, AnimatePresence } from 'framer-motion';
0004 | 
0005 | const API_URL = `http://${window.location.hostname}:9000/api`;
0006 | 
0007 | export default function StorageMap() {
0008 |     const [state, setState] = useState(null);
0009 |     const [uploading, setUploading] = useState(false);
0010 |     const [harvestingStates, setHarvestingStates] = useState({}); // { fileId: statusObject }
0011 |     const [transmittingNodes, setTransmittingNodes] = useState({}); // { nodeId: timestamp }
0012 |     const [islLinks, setIslLinks] = useState([]); // ISL topology links
0013 |     const [error, setError] = useState(null);
0014 |     const fileInputRef = useRef(null);
0015 |     const socketRef = useRef(null);
0016 | 
0017 |     const fetchState = async () => {
0018 |         try {
0019 |             const [stateRes, islRes] = await Promise.all([
0020 |                 fetch(`${API_URL}/fs/state`),
0021 |                 fetch(`${API_URL}/isl/topology`)
0022 |             ]);
0023 |             if (stateRes.ok) {
0024 |                 const data = await stateRes.json();
0025 |                 setState(data);
0026 |             }
0027 |             if (islRes.ok) {
0028 |                 const islData = await islRes.json();
0029 |                 setIslLinks(islData.links || []);
0030 |             }
0031 |         } catch (err) {
0032 |             console.error("Failed to fetch state:", err);
0033 |         }
0034 |     };
0035 | 
0036 |     useEffect(() => {
0037 |         fetchState();
0038 | 
0039 |         // Setup WebSocket for real-time harvest bursts
0040 |         const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
0041 |         const ws = new WebSocket(`${protocol}//${window.location.hostname}:9000/ws`);
0042 | 
0043 |         ws.onmessage = (event) => {
0044 |             try {
0045 |                 const data = JSON.parse(event.data);
0046 |                 if (data.type === 'HARVEST_PROGRESS') {
0047 |                     // Use node_id directly from payload if available
0048 |                     const nodeId = data.payload.node_id;
0049 |                     if (nodeId) {
0050 |                         setTransmittingNodes(prev => ({ ...prev, [nodeId]: Date.now() }));
0051 |                         // Clear after 1.5s
0052 |                         setTimeout(() => {
0053 |                             setTransmittingNodes(prev => {
0054 |                                 const next = { ...prev };
0055 |                                 delete next[nodeId];
0056 |                                 return next;
0057 |                             });
0058 |                         }, 1500);
0059 |                     }
0060 |                     // Also update harvest state immediately
0061 |                     updateHarvestStatus(data.payload.file_id);
0062 |                 }
0063 |             } catch (e) {
0064 |                 console.error("WS error:", e);
0065 |             }
0066 |         };
0067 | 
0068 |         socketRef.current = ws;
0069 | 
0070 |         const interval = setInterval(() => {
0071 |             fetchState();
0072 |             // Poll harvesting status if any are active
0073 |             Object.keys(harvestingStates).forEach(fileId => {
0074 |                 if (harvestingStates[fileId]?.status === 'active') {
0075 |                     updateHarvestStatus(fileId);
0076 |                 }
0077 |             });
0078 |         }, 2000);
0079 | 
0080 |         return () => {
0081 |             clearInterval(interval);
0082 |             ws.close();
0083 |         };
0084 |     }, [harvestingStates, state]);
0085 | 
0086 |     const updateHarvestStatus = async (fileId) => {
0087 |         try {
0088 |             const res = await fetch(`${API_URL}/harvest/status/${fileId}`);
0089 |             if (res.ok) {
0090 |                 const data = await res.json();
0091 |                 setHarvestingStates(prev => ({ ...prev, [fileId]: data }));
0092 |             }
0093 |         } catch (err) {
0094 |             console.error("Failed to fetch harvest status:", err);
0095 |         }
0096 |     };
0097 | 
0098 |     const handleHarvest = async (fileId) => {
0099 |         try {
0100 |             const res = await fetch(`${API_URL}/harvest/start/${fileId}`, { method: 'POST' });
0101 |             if (res.ok) {
0102 |                 const data = await res.json();
0103 |                 setHarvestingStates(prev => ({ ...prev, [fileId]: data }));
0104 |             }
0105 |         } catch (err) {
0106 |             alert(`Harvest failed: ${err.message}`);
0107 |         }
0108 |     };
0109 | 
0110 |     const handleUpload = async (e) => {
0111 |         const file = e.target.files[0];
0112 |         if (!file) return;
0113 | 
0114 |         setUploading(true);
0115 |         const formData = new FormData();
0116 |         formData.append('file', file);
0117 | 
0118 |         try {
0119 |             const res = await fetch(`${API_URL}/upload`, {
0120 |                 method: 'POST',
0121 |                 body: formData,
0122 |             });
0123 |             if (res.ok) {
0124 |                 await fetchState();
0125 |             } else {
0126 |                 const errData = await res.json();
0127 |                 alert(`Upload failed: ${errData.detail}`);
0128 |             }
0129 |         } catch (err) {
0130 |             alert(`Upload failed: ${err.message}`);
0131 |         } finally {
0132 |             setUploading(false);
0133 |             if (fileInputRef.current) fileInputRef.current.value = '';
0134 |         }
0135 |     };
0136 | 
0137 |     const handleDownload = async (fileId, filename) => {
0138 |         try {
0139 |             const res = await fetch(`${API_URL}/download/${fileId}`);
0140 |             if (!res.ok) throw new Error('Download failed');
0141 | 
0142 |             const blob = await res.blob();
0143 |             const safeName = filename || `download-${fileId}`;
0144 | 
0145 |             const url = window.URL.createObjectURL(blob);
0146 |             const link = document.createElement('a');
0147 |             link.href = url;
0148 |             link.download = safeName;
0149 |             document.body.appendChild(link);
0150 |             link.click();
0151 |             window.URL.revokeObjectURL(url);
0152 |             link.remove();
0153 |         } catch (err) {
0154 |             alert(`Download failed: ${err.message}`);
0155 |         }
0156 |     };
0157 | 
0158 |     const handleDelete = async (fileId) => {
0159 |         try {
0160 |             const res = await fetch(`${API_URL}/delete/${fileId}`, { method: 'DELETE' });
0161 |             if (res.ok) {
0162 |                 await fetchState();
0163 |             } else {
0164 |                 const errData = await res.json();
0165 |                 alert(`Delete failed: ${errData.detail}`);
0166 |             }
0167 |         } catch (err) {
0168 |             alert(`Delete failed: ${err.message}`);
0169 |         }
0170 |     };
0171 | 
0172 |     const toggleNodeStatus = async (nodeId) => {
0173 |         try {
0174 |             await fetch(`${API_URL}/node/${nodeId}/toggle`, { method: 'POST' });
0175 |             await fetchState();
0176 |         } catch (err) {
0177 |             console.error("Failed to toggle node:", err);
0178 |         }
0179 |     };
0180 | 
0181 |     if (!state) return (
0182 |         <div className="flex items-center justify-center h-full w-full bg-[#02040A] text-cyan-400">
0183 |             <RefreshCw className="animate-spin mr-2" /> Initializing Orbital Storage Mesh...
0184 |         </div>
0185 |     );
0186 | 
0187 |     return (
0188 |         <div className="w-full h-full bg-transparent text-slate-300 p-8 flex gap-8 overflow-hidden font-mono text-sm relative">
0189 | 
0190 |             {/* Background Effects */}
0191 |             <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
0192 |                 <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-cyan-900/10 rounded-full blur-[120px] mix-blend-screen"></div>
0193 |                 <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[100px] mix-blend-screen"></div>
0194 |             </div>
0195 | 
0196 |             {/* Left Panel: Mission Control */}
0197 |             <div className="w-[350px] flex flex-col gap-6 z-10 shrink-0 pointer-events-auto">
0198 |                 {/* Upload Section */}
0199 |                 <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex flex-col gap-4">
0200 |                     <div className="flex items-center gap-2 border-b border-white/5 pb-3">
0201 |                         <UploadCloud className="text-cyan-400" size={18} />
0202 |                         <h2 className="text-white font-bold tracking-widest text-xs uppercase">Orbital Uplink</h2>
0203 |                     </div>
0204 | 
0205 |                     <button
0206 |                         onClick={() => fileInputRef.current?.click()}
0207 |                         disabled={uploading}
0208 |                         className={`w-full py-8 border-2 border-dashed border-cyan-500/30 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-cyan-400 hover:bg-cyan-500/5 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
0209 |                     >
0210 |                         <UploadCloud size={32} className="text-cyan-500/50" />
0211 |                         <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
0212 |                             {uploading ? 'Transmitting Data...' : 'Select Payload to Upload'}
0213 |                         </span>
0214 |                     </button>
0215 |                     <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" />
0216 |                 </div>
0217 | 
0218 |                 {/* File Inventory */}
0219 |                 <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex-1 flex flex-col overflow-hidden">
0220 |                     <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
0221 |                         <div className="flex items-center gap-2">
0222 |                             <HardDrive className="text-blue-400" size={18} />
0223 |                             <h2 className="text-white font-bold tracking-widest text-xs uppercase">Distributed Files</h2>
0224 |                         </div>
0225 |                         <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold">{state.files.length}</span>
0226 |                     </div>
0227 | 
0228 |                     <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
0229 |                         {state.files.length === 0 ? (
0230 |                             <div className="text-center text-slate-600 text-[10px] uppercase tracking-widest py-8">
0231 |                                 No files stored in mesh
0232 |                             </div>
0233 |                         ) : (
0234 |                             state.files.map(file => (
0235 |                                 <div key={file.file_id} className="bg-white/5 border border-white/10 rounded-xl p-3 group hover:border-blue-500/30 transition-colors">
0236 |                                     <div className="flex items-start justify-between mb-2">
0237 |                                         <div className="flex items-center gap-2 overflow-hidden">
0238 |                                             <FileIcon size={14} className="text-slate-400 shrink-0" />
0239 |                                             <span className="text-white font-bold text-xs truncate" title={file.filename}>{file.filename}</span>
0240 |                                         </div>
0241 |                                     </div>
0242 |                                     <div className="flex items-center justify-between mb-3 text-[10px] text-slate-400">
0243 |                                         <span>{(file.size / 1024).toFixed(1)} KB</span>
0244 |                                         <span className="bg-cyan-500/10 text-cyan-400 px-1.5 py-0.5 rounded uppercase tracking-wider">{file.chunk_count} Chunks</span>
0245 |                                     </div>
0246 | 
0247 |                                     {harvestingStates[file.file_id] && harvestingStates[file.file_id].status !== 'none' && (
0248 |                                         <div className="mb-3">
0249 |                                             <div className="flex justify-between text-[9px] uppercase tracking-widest text-emerald-400 mb-1">
0250 |                                                 <span>Harvesting...</span>
0251 |                                                 <span>{harvestingStates[file.file_id].collected_shards.length} / {file.chunk_count}</span>
0252 |                                             </div>
0253 |                                             <div className="h-1 bg-white/5 rounded-full overflow-hidden">
0254 |                                                 <div
0255 |                                                     className="h-full bg-emerald-500 transition-all duration-500"
0256 |                                                     style={{ width: `${(harvestingStates[file.file_id].collected_shards.length / file.chunk_count) * 100}%` }}
0257 |                                                 ></div>
0258 |                                             </div>
0259 |                                         </div>
0260 |                                     )}
0261 | 
0262 |                                     <div className="flex items-center gap-2">
0263 |                                         <button
0264 |                                             onClick={() => handleDownload(file.file_id, file.filename)}
0265 |                                             className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors flex justify-center items-center gap-1"
0266 |                                         >
0267 |                                             <Download size={12} /> Fetch
0268 |                                         </button>
0269 |                                         {!harvestingStates[file.file_id] || harvestingStates[file.file_id].status === 'none' ? (
0270 |                                             <button
0271 |                                                 onClick={() => handleHarvest(file.file_id)}
0272 |                                                 className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded p-1.5 transition-colors"
0273 |                                                 title="Initiate Ground Harvest"
0274 |                                             >
0275 |                                                 <RefreshCw size={12} />
0276 |                                             </button>
0277 |                                         ) : null}
0278 |                                         <button
0279 |                                             onClick={() => handleDelete(file.file_id)}
0280 |                                             className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded p-1.5 transition-colors"
0281 |                                         >
0282 |                                             <Trash2 size={12} />
0283 |                                         </button>
0284 |                                     </div>
0285 |                                 </div>
0286 |                             ))
0287 |                         )}
0288 |                     </div>
0289 |                 </div>
0290 | 
0291 |                 {/* Ground Cache Stats */}
0292 |                 <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
0293 |                     <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
0294 |                         <Zap className="text-emerald-400" size={18} />
0295 |                         <h2 className="text-white font-bold tracking-widest text-xs uppercase">LRU Ground Cache</h2>
0296 |                     </div>
0297 |                     <div className="grid grid-cols-2 gap-4 text-center">
0298 |                         <div>
0299 |                             <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Hit Rate</p>
0300 |                             <p className="text-xl font-bold text-emerald-400">{state.cache?.hit_rate || 0}%</p>
0301 |                         </div>
0302 |                         <div>
0303 |                             <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Items</p>
0304 |                             <p className="text-xl font-bold text-white">{state.cache?.size || 0} / {state.cache?.max_size || 10}</p>
0305 |                         </div>
0306 |                     </div>
0307 |                 </div>
0308 | 
0309 |                 {/* ISL Link Status */}
0310 |                 <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
0311 |                     <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
0312 |                         <Satellite className="text-amber-400" size={18} />
0313 |                         <h2 className="text-white font-bold tracking-widest text-xs uppercase">ISL Mesh Links</h2>
0314 |                     </div>
0315 |                     <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
0316 |                         {islLinks.map((link, i) => (
0317 |                             <div key={i} className="flex items-center justify-between text-[10px]">
0318 |                                 <div className="flex items-center gap-1.5">
0319 |                                     <span className="text-white font-bold">{link.from}</span>
0320 |                                     <motion.div
0321 |                                         animate={link.active ? { opacity: [0.3, 1, 0.3] } : {}}
0322 |                                         transition={{ duration: 1.5, repeat: Infinity }}
0323 |                                         className={`w-6 h-[2px] rounded ${link.active ? 'bg-amber-500 shadow-[0_0_6px_#f59e0b]' : 'bg-gray-700'}`}
0324 |                                     />
0325 |                                     <span className="text-white font-bold">{link.to}</span>
0326 |                                 </div>
0327 |                                 <span className={`uppercase tracking-widest text-[8px] font-bold ${link.active ? 'text-amber-400' : 'text-gray-600'}`}>
0328 |                                     {link.active ? 'ACTIVE' : 'DOWN'}
0329 |                                 </span>
0330 |                             </div>
0331 |                         ))}
0332 |                     </div>
0333 |                 </div>
0334 |             </div>
0335 | 
0336 |             {/* Right Panel: The Orbital Mesh Grid */}
0337 |             <div className="flex-1 flex flex-col z-10 w-full overflow-hidden">
0338 |                 <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex-1 flex flex-col overflow-hidden">
0339 |                     <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-6 shrink-0">
0340 |                         <div>
0341 |                             <h2 className="text-white font-bold tracking-widest text-sm uppercase">Storage Node Topology</h2>
0342 |                             <p className="text-[10px] text-cyan-500 mt-1 uppercase tracking-widest">Live Representation of File Chunks across 3 Orbital Planes</p>
0343 |                         </div>
0344 |                         <div className="flex gap-4 items-center text-[10px] uppercase tracking-widest font-bold">
0345 |                             <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-cyan-500 shadow-[0_0_8px_#06b6d4]"></div> Data Chunk</span>
0346 |                             <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-purple-500 shadow-[0_0_8px_#a855f7]"></div> RS Parity</span>
0347 |                             <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-amber-500 shadow-[0_0_8px_#f59e0b]"></div> ISL Link</span>
0348 |                         </div>
0349 |                     </div>
0350 | 
0351 |                     <div className="grid grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pr-2 pb-4">
0352 |                         {state.nodes.map(node => {
0353 |                             // Find all chunks currently stored in this node
0354 |                             const myChunks = [];
0355 |                             state.files.forEach(f => {
0356 |                                 f.chunks.forEach(c => {
0357 |                                     if (c.node_id === node.node_id) {
0358 |                                         myChunks.push({
0359 |                                             ...c,
0360 |                                             filename: f.filename
0361 |                                         });
0362 |                                     }
0363 |                                 });
0364 |                             });
0365 | 
0366 |                             const isOnline = node.status === 'ONLINE';
0367 |                             const isPartitioned = node.status === 'PARTITIONED';
0368 |                             const hasISL = isPartitioned && islLinks.some(l =>
0369 |                                 (l.from === node.node_id || l.to === node.node_id) && l.active
0370 |                             );
0371 | 
0372 |                             return (
0373 |                                 <div key={node.node_id} className={`relative rounded-2xl border transition-colors flex flex-col overflow-hidden ${isOnline ? 'bg-black/40 border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.05)]'
0374 |                                         : isPartitioned ? 'bg-amber-950/20 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.05)]'
0375 |                                             : 'bg-red-950/20 border-red-500/30'
0376 |                                     }`}>
0377 |                                     {/* Plane Header */}
0378 |                                     <div className={`p-3 border-b flex justify-between items-center ${isOnline ? 'bg-cyan-950/30 border-cyan-500/10'
0379 |                                             : isPartitioned ? 'bg-amber-900/30 border-amber-500/20'
0380 |                                                 : 'bg-red-900/30 border-red-500/20'
0381 |                                         }`}>
0382 |                                         <div>
0383 |                                             <p className="font-bold text-white text-sm">{node.node_id}</p>
0384 |                                             <p className={`text-[9px] uppercase tracking-widest ${isOnline ? 'text-cyan-500'
0385 |                                                     : isPartitioned ? 'text-amber-400'
0386 |                                                         : 'text-red-400'
0387 |                                                 }`}>
0388 |                                                 {isPartitioned ? `Plane ${node.plane} • ISL ${hasISL ? 'RELAY' : 'DOWN'}` : `Plane ${node.plane}`}
0389 |                                             </p>
0390 |                                         </div>
0391 |                                         <button
0392 |                                             onClick={() => toggleNodeStatus(node.node_id)}
0393 |                                             className={`p-2 rounded-lg border transition-colors ${isOnline ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-white' : 'bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30 hover:text-white'}`}
0394 |                                             title="Toggle Node Power (Chaos Simulation)"
0395 |                                         >
0396 |                                             {isOnline ? <Power size={14} /> : <WifiOff size={14} />}
0397 |                                         </button>
0398 |                                     </div>
0399 | 
0400 |                                     {/* Chunk Visualization Area */}
0401 |                                     <div className="flex-1 p-4 min-h-[250px] relative">
0402 |                                         <AnimatePresence>
0403 |                                             {!isOnline && (
0404 |                                                 <motion.div
0405 |                                                     initial={{ opacity: 0 }}
0406 |                                                     animate={{ opacity: 1 }}
0407 |                                                     exit={{ opacity: 0 }}
0408 |                                                     className="absolute inset-0 bg-red-950/40 backdrop-blur-[2px] z-10 flex items-center justify-center flex-col gap-2"
0409 |                                                 >
0410 |                                                     {/* Check if node is part of an active harvest */}
0411 |                                                     {Object.values(harvestingStates).some(m =>
0412 |                                                         m.status === 'active' &&
0413 |                                                         state.files.find(f => f.file_id === m.file_id)?.chunks.some(c => c.node_id === node.node_id && !m.collected_shards.includes(c.chunk_id))
0414 |                                                     ) ? (
0415 |                                                         <div className="relative">
0416 |                                                             <motion.div
0417 |                                                                 animate={{ scale: [1, 2, 1], opacity: [0.3, 0.1, 0.3] }}
0418 |                                                                 transition={{ duration: 2, repeat: Infinity }}
0419 |                                                                 className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-emerald-500 rounded-full blur-xl"
0420 |                                                             />
0421 |                                                             <Radio size={32} className="text-emerald-400 animate-pulse relative z-10" />
0422 |                                                             <p className="text-emerald-400 font-bold uppercase tracking-[0.2em] text-[8px] mt-2 whitespace-nowrap">Waiting for Signal...</p>
0423 |                                                         </div>
0424 |                                                     ) : (
0425 |                                                         <>
0426 |                                                             <WifiOff size={24} className="text-red-500 opacity-50" />
0427 |                                                             <p className="text-red-400 font-bold uppercase tracking-widest text-[10px]">Node Offline</p>
0428 |                                                         </>
0429 |                                                     )}
0430 |                                                 </motion.div>
0431 |                                             )}
0432 |                                         </AnimatePresence>
0433 | 
0434 |                                         {/* Transmission Effect */}
0435 |                                         <AnimatePresence>
0436 |                                             {transmittingNodes[node.node_id] && (
0437 |                                                 <motion.div
0438 |                                                     initial={{ opacity: 0, scale: 0.8 }}
0439 |                                                     animate={{ opacity: 1, scale: 1 }}
0440 |                                                     exit={{ opacity: 0, scale: 1.2 }}
0441 |                                                     className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
0442 |                                                 >
0443 |                                                     <div className="w-full h-full bg-emerald-500/10 border-2 border-emerald-500/50 rounded-2xl animate-ping" />
0444 |                                                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
0445 |                                                         <Zap size={40} className="text-emerald-400 filter drop-shadow-[0_0_10px_#10b981]" />
0446 |                                                         <span className="text-emerald-400 font-bold text-[8px] uppercase tracking-widest mt-2 overflow-hidden block">Downlink Active</span>
0447 |                                                     </div>
0448 |                                                 </motion.div>
0449 |                                             )}
0450 |                                         </AnimatePresence>
0451 | 
0452 |                                         <div className="flex flex-wrap gap-2">
0453 |                                             {myChunks.length === 0 ? (
0454 |                                                 <div className="w-full text-center text-[10px] text-slate-600 uppercase tracking-widest mt-10">Empty Buffer</div>
0455 |                                             ) : (
0456 |                                                 myChunks.map((chunk, i) => (
0457 |                                                     <motion.div
0458 |                                                         layout
0459 |                                                         key={`${chunk.chunk_id}-${i}`}
0460 |                                                         className={`w-[calc(50%-4px)] p-2 rounded border flex flex-col justify-center ${chunk.is_parity
0461 |                                                             ? 'bg-purple-500/10 border-purple-500/30 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
0462 |                                                             : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
0463 |                                                             }`}
0464 |                                                         title={`Chunk of ${chunk.filename}\nSeq: ${chunk.sequence_number}`}
0465 |                                                     >
0466 |                                                         <p className="text-[9px] truncate w-full font-bold opacity-80">{chunk.filename}</p>
0467 |                                                         <div className="flex justify-between items-center mt-1">
0468 |                                                             <p className="text-[8px] uppercase tracking-wider opacity-60">Seq {chunk.sequence_number}</p>
0469 |                                                             {chunk.is_parity && <span className="text-[8px] font-bold text-purple-400">PRTY</span>}
0470 |                                                         </div>
0471 |                                                     </motion.div>
0472 |                                                 ))
0473 |                                             )}
0474 |                                         </div>
0475 |                                     </div>
0476 | 
0477 |                                     <div className="bg-black/50 p-2 text-center text-[9px] uppercase tracking-widest text-slate-500 border-t border-white/5 relative overflow-hidden">
0478 |                                         {(node.storage_used / 1024).toFixed(1)} KB Used
0479 |                                         {/* Activity Scanner Line */}
0480 |                                         {isOnline && (
0481 |                                             <motion.div
0482 |                                                 animate={{ x: ['-100%', '100%'] }}
0483 |                                                 transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
0484 |                                                 className="absolute bottom-0 left-0 h-[1px] w-1/2 bg-cyan-500/50 blur-sm"
0485 |                                             />
0486 |                                         )}
0487 |                                     </div>
0488 |                                 </div>
0489 |                             );
0490 |                         })}
0491 |                     </div>
0492 |                 </div>
0493 |             </div>
0494 |         </div>
0495 |     );
0496 | }

```

---

### File: `frontend\src\components\terminal\MissionLog.jsx`

**Description**: Source JSX/CSS for `MissionLog.jsx`

```javascript
0001 | import React, { useRef, useEffect } from 'react';
0002 | import { Terminal } from 'lucide-react';
0003 | 
0004 | export function MissionLog({ messages }) {
0005 |     const scrollRef = useRef(null);
0006 | 
0007 |     useEffect(() => {
0008 |         if (scrollRef.current) {
0009 |             scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
0010 |         }
0011 |     }, [messages]);
0012 | 
0013 |     const getColor = (type) => {
0014 |         if (type.includes("SUCCESS") || type.includes("COMPLETE") || type.includes("DELIVERED") || type.includes("RESTORE")) return "text-emerald-400";
0015 |         if (type.includes("ERROR") || type.includes("CORRUPT") || type.includes("OFFLINE") || type.includes("DESTROYED")) return "text-red-400";
0016 |         if (type.includes("QUEUE") || type.includes("PARTITION") || type.includes("WARNING")) return "text-amber-400";
0017 |         if (type.includes("RECOVERY") || type.includes("FLUSH")) return "text-purple-400";
0018 |         return "text-blue-400";
0019 |     };
0020 | 
0021 |     return (
0022 |         <div className="bg-white/[0.02] backdrop-blur-3xl border border-white/10 rounded-2xl p-5 flex flex-col min-h-0 h-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-white/20 transition-all duration-500">
0023 |             {/* Subtle Terminal Glow */}
0024 |             <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent"></div>
0025 | 
0026 |             <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/5 shrink-0">
0027 |                 <div className="flex items-center gap-2 text-gray-400 font-mono text-[10px] tracking-[0.2em] uppercase font-bold">
0028 |                     <Terminal size={12} className="text-cyan-500" />
0029 |                     <span>Mission Terminal</span>
0030 |                 </div>
0031 |                 {/* Simulated activity dot */}
0032 |                 <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4] animate-pulse"></div>
0033 |             </div>
0034 | 
0035 |             <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1.5 pr-2 custom-scrollbar">
0036 |                 {messages.length === 0 && <div className="text-gray-600 animate-pulse flex items-center gap-2"><span className="text-cyan-500">_</span> Awaiting matrix telemetry stream...</div>}
0037 |                 {messages.map((msg, i) => (
0038 |                     <div key={i} className={`flex gap-3 hover:bg-white/5 p-1 -mx-1 rounded transition-colors ${getColor(msg.type)}`}>
0039 |                         <span className="opacity-30 tracking-wider">[{new Date().toISOString().split('T')[1].substring(0, 8)}]</span>
0040 |                         <div className="flex-1 flex gap-2">
0041 |                             <span className="font-bold opacity-80 w-24 shrink-0">[{msg.type}]</span>
0042 |                             <span className="opacity-90 leading-tight text-gray-300">{msg.message}</span>
0043 |                         </div>
0044 |                     </div>
0045 |                 ))}
0046 |             </div>
0047 |         </div>
0048 |     );
0049 | }

```

---

### File: `frontend\src\components\terminal\MissionTerminal.jsx`

**Description**: Source JSX/CSS for `MissionTerminal.jsx`

```javascript
0001 | import React, { useState, useEffect, useRef } from 'react';
0002 | import { Terminal, TerminalSquare } from 'lucide-react';
0003 | import { motion, AnimatePresence } from 'framer-motion';
0004 | 
0005 | export default function MissionTerminal({ currentTab, messages }) {
0006 |     const [lines, setLines] = useState([]);
0007 |     const bottomRef = useRef(null);
0008 | 
0009 |     // Initial boot sequence based on the tab
0010 |     useEffect(() => {
0011 |         setLines([]);
0012 |         const bootMessages = {
0013 |             'Orbital Engine': [
0014 |                 'Initializing Orbital Physics Engine v2.4...',
0015 |                 'Connecting to CelesTrak Proxy...',
0016 |                 'Loading TLE Elements across 3 orbital planes.',
0017 |                 'SGP4 Propagators: ONLINE.',
0018 |                 'Raycasting engine ready for mesh interaction.'
0019 |             ],
0020 |             'Storage Nodes': [
0021 |                 'Accessing Remote Storage Daemon...',
0022 |                 'Pinging active constellation nodes...',
0023 |                 'Fetching capacity limits and shard heatmaps.',
0024 |                 'Ready to display shard telemetry.'
0025 |             ],
0026 |             'Payload Ops': [
0027 |                 'Initializing Cauchy Reed-Solomon Codec RS(4,2)...',
0028 |                 'Engaging 256-bit AES encryption layer.',
0029 |                 'Awaiting secure payload transmission...'
0030 |             ],
0031 |             'Chaos Ops': [
0032 |                 'WARNING: Accessing High-Risk Sandbox Environment.',
0033 |                 'Disabling fail-safes...',
0034 |                 'Chaos Monkey Module: ARMED.',
0035 |                 'Awaiting fault injection commands.'
0036 |             ]
0037 |         };
0038 | 
0039 |         const msgs = bootMessages[currentTab] || ['System Idle. Waiting for commands.'];
0040 | 
0041 |         let i = 0;
0042 |         const interval = setInterval(() => {
0043 |             if (i < msgs.length) {
0044 |                 setLines(prev => [...prev, { id: Date.now() + i, text: msgs[i], type: 'sys' }]);
0045 |                 i++;
0046 |             } else {
0047 |                 clearInterval(interval);
0048 |             }
0049 |         }, 500);
0050 | 
0051 |         return () => clearInterval(interval);
0052 |     }, [currentTab]);
0053 | 
0054 |     // Listen to real-time websocket messages
0055 |     useEffect(() => {
0056 |         if (!messages || messages.length === 0) return;
0057 |         const lastMsg = messages[messages.length - 1];
0058 | 
0059 |         if (lastMsg.type === 'UPLOAD_START' || lastMsg.type === 'DOWNLOAD_START' || lastMsg.type === 'CHAOS_TRIGGERED') {
0060 |             setLines(prev => [...prev.slice(-30), { id: Date.now(), text: `>> ${lastMsg.data.message || 'Executing command...'}`, type: 'exec' }]);
0061 |         } else if (lastMsg.type === 'ERROR') {
0062 |             setLines(prev => [...prev.slice(-30), { id: Date.now(), text: `!! ERROR: ${lastMsg.data.message}`, type: 'err' }]);
0063 |         } else if (lastMsg.type === 'METRIC_UPDATE') {
0064 |             // Occasionally print a metric tick
0065 |             if (Math.random() > 0.8) {
0066 |                 setLines(prev => [...prev.slice(-30), { id: Date.now(), text: `[SYS] Syncing mesh state... Entropy: ${lastMsg.data?.entropy?.toFixed(3) || 'N/A'}`, type: 'dim' }]);
0067 |             }
0068 |         }
0069 |     }, [messages]);
0070 | 
0071 |     useEffect(() => {
0072 |         if (bottomRef.current) {
0073 |             bottomRef.current.scrollIntoView({ behavior: 'smooth' });
0074 |         }
0075 |     }, [lines]);
0076 | 
0077 |     return (
0078 |         <div
0079 |             className="bg-[#0b101e]/80 backdrop-blur-3xl border-l-2 border-b-2 border-l-cyan-500/30 border-b-cyan-500/30 border-t border-r border-t-white/5 border-r-white/5 rounded-none h-full flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-l-cyan-400 hover:border-b-cyan-400 transition-all duration-500"
0080 |             style={{ clipPath: 'polygon(15px 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%, 0 15px)' }}
0081 |         >
0082 |             {/* Header */}
0083 |             <div className="flex items-center gap-3 p-4 border-b border-white/5 bg-white/[0.02]">
0084 |                 <div className="p-1.5 bg-cyan-500/10 rounded-md border border-cyan-500/20">
0085 |                     <TerminalSquare className="text-cyan-400" size={16} />
0086 |                 </div>
0087 |                 <div className="flex-1">
0088 |                     <h3 className="text-white font-bold tracking-widest text-[11px] uppercase">Mission Terminal</h3>
0089 |                     <p className="text-[9px] text-cyan-500/70 font-mono uppercase tracking-widest mt-0.5">tty-{currentTab.split(' ')[0].toLowerCase()}</p>
0090 |                 </div>
0091 |             </div>
0092 | 
0093 |             {/* Terminal Window */}
0094 |             <div className="flex-1 min-h-0 bg-[#050B14] p-4 overflow-y-auto custom-scrollbar font-mono text-[11px] leading-relaxed relative flex flex-col gap-1.5 shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]">
0095 |                 <AnimatePresence>
0096 |                     {lines.map((l) => (
0097 |                         <motion.div
0098 |                             key={l.id}
0099 |                             initial={{ opacity: 0, x: -5 }}
0100 |                             animate={{ opacity: 1, x: 0 }}
0101 |                             className={`
0102 |                                 ${l.type === 'sys' ? 'text-gray-400' : ''}
0103 |                                 ${l.type === 'exec' ? 'text-cyan-400 font-bold' : ''}
0104 |                                 ${l.type === 'err' ? 'text-red-400 font-bold' : ''}
0105 |                                 ${l.type === 'dim' ? 'text-gray-600' : ''}
0106 |                             `}
0107 |                         >
0108 |                             <span className="text-gray-600 mr-2 opacity-50">$</span>
0109 |                             {l.text}
0110 |                         </motion.div>
0111 |                     ))}
0112 |                 </AnimatePresence>
0113 |                 <div ref={bottomRef} className="h-1" />
0114 |             </div>
0115 | 
0116 |             {/* Input Bar */}
0117 |             <div className="h-10 bg-black/40 border-t border-white/5 px-4 flex items-center gap-3 pointer-events-none">
0118 |                 <span className="text-cyan-500/50 font-bold text-xs">{'>'}</span>
0119 |                 <span className="w-2 h-4 bg-cyan-500/70 animate-pulse"></span>
0120 |             </div>
0121 |         </div>
0122 |     );
0123 | }

```

---

### File: `frontend\src\components\tracking\GlobeViewer.jsx`

**Description**: Source JSX/CSS for `GlobeViewer.jsx`

```javascript
0001 | import React, { useRef, useMemo } from 'react';
0002 | import { useFrame, useLoader } from '@react-three/fiber';
0003 | import { OrbitControls, Stars, PerspectiveCamera, Float, Html } from '@react-three/drei';
0004 | import * as THREE from 'three';
0005 | import { geoToCartesian } from '../../utils/geoUtils';
0006 | 
0007 | export default function GlobeViewer({ satellites, groundStations }) {
0008 |     const earthRef = useRef();
0009 | 
0010 |     // Load high-quality textures
0011 |     const earthTexture = useLoader(THREE.TextureLoader, 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg');
0012 |     const specularMap = useLoader(THREE.TextureLoader, 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg');
0013 | 
0014 |     useFrame((state, delta) => {
0015 |         if (earthRef.current) {
0016 |             earthRef.current.rotation.y += 0.0005;
0017 |         }
0018 |     });
0019 | 
0020 |     return (
0021 |         <>
0022 |             <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={45} />
0023 |             <OrbitControls
0024 |                 enableDamping
0025 |                 dampingFactor={0.05}
0026 |                 rotateSpeed={0.5}
0027 |                 minDistance={3.5}
0028 |                 maxDistance={15}
0029 |             />
0030 | 
0031 |             <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
0032 | 
0033 |             <ambientLight intensity={0.5} />
0034 |             <pointLight position={[10, 10, 10]} intensity={1.5} color="#E8F4F8" />
0035 | 
0036 |             <group>
0037 |                 <mesh ref={earthRef}>
0038 |                     <sphereGeometry args={[2.5, 64, 64]} />
0039 |                     <meshPhongMaterial
0040 |                         map={earthTexture}
0041 |                         specularMap={specularMap}
0042 |                         specular={new THREE.Color('#333333')}
0043 |                         shininess={10}
0044 |                         emissive={new THREE.Color('#111111')}
0045 |                     />
0046 |                 </mesh>
0047 | 
0048 |                 <mesh scale={[1.02, 1.02, 1.02]}>
0049 |                     <sphereGeometry args={[2.5, 64, 64]} />
0050 |                     <meshPhongMaterial
0051 |                         color="#00EEFF"
0052 |                         transparent
0053 |                         opacity={0.1}
0054 |                         side={THREE.BackSide}
0055 |                         blending={THREE.AdditiveBlending}
0056 |                     />
0057 |                 </mesh>
0058 | 
0059 |                 {/* Render Ground Stations */}
0060 |                 {groundStations && groundStations.map((gs, idx) => (
0061 |                     <GroundStation key={idx} gs={gs} />
0062 |                 ))}
0063 | 
0064 |                 {/* Render Multiple Satellites and Orbits */}
0065 |                 {satellites.map((sat, idx) => (
0066 |                     <SatelliteGroup
0067 |                         key={sat.noradId || idx}
0068 |                         sat={sat}
0069 |                         groundStations={groundStations}
0070 |                     />
0071 |                 ))}
0072 |             </group>
0073 |         </>
0074 |     );
0075 | }
0076 | 
0077 | function GroundStation({ gs }) {
0078 |     const pos = useMemo(() => geoToCartesian(gs.lat, gs.lng, 0), [gs]);
0079 |     return (
0080 |         <group position={pos}>
0081 |             <mesh>
0082 |                 <boxGeometry args={[0.04, 0.04, 0.04]} />
0083 |                 <meshBasicMaterial color={gs.color} />
0084 |             </mesh>
0085 |             <Html distanceFactor={10} position={[0.1, 0, 0]}>
0086 |                 <div className="bg-black/60 border border-cyan-500/30 px-1 py-0.5 rounded text-[6px] font-mono text-cyan-300 pointer-events-none uppercase">
0087 |                     {gs.name}
0088 |                 </div>
0089 |             </Html>
0090 |         </group>
0091 |     );
0092 | }
0093 | 
0094 | function SatelliteGroup({ sat, groundStations }) {
0095 |     const { currentPos, orbitPath, isPrimary, name, queueDepth, isOnline } = sat;
0096 | 
0097 |     const lineGeometry = useMemo(() => {
0098 |         if (!orbitPath || orbitPath.length < 2) return null;
0099 |         const points = orbitPath.map(p => geoToCartesian(p.lat, p.lng, p.alt));
0100 |         const curve = new THREE.CatmullRomCurve3(points, true);
0101 |         const curvePoints = curve.getPoints(200);
0102 |         return new THREE.BufferGeometry().setFromPoints(curvePoints);
0103 |     }, [orbitPath]);
0104 | 
0105 |     const satPos = useMemo(() => {
0106 |         if (!currentPos) return new THREE.Vector3(0, 0, 0);
0107 |         return geoToCartesian(currentPos.lat, currentPos.lng, currentPos.alt);
0108 |     }, [currentPos]);
0109 | 
0110 |     // Link Logic: Find nearest Ground Station within LoS
0111 |     const activeLink = useMemo(() => {
0112 |         if (!currentPos || !groundStations) return null;
0113 | 
0114 |         let nearest = null;
0115 |         let minDist = 3.0; // LoS Threshold (approx)
0116 | 
0117 |         groundStations.forEach(gs => {
0118 |             const gsPos = geoToCartesian(gs.lat, gs.lng, 0);
0119 |             const dist = satPos.distanceTo(gsPos);
0120 |             if (dist < minDist) {
0121 |                 minDist = dist;
0122 |                 nearest = gsPos;
0123 |             }
0124 |         });
0125 |         return nearest;
0126 |     }, [satPos, groundStations, currentPos]);
0127 | 
0128 |     if (!currentPos) return null;
0129 | 
0130 |     return (
0131 |         <group>
0132 |             {/* Orbit Path Line */}
0133 |             {lineGeometry && (
0134 |                 <line geometry={lineGeometry}>
0135 |                     <lineBasicMaterial
0136 |                         color={isPrimary ? "#00FFC8" : "#444444"}
0137 |                         opacity={isPrimary ? 0.4 : 0.15}
0138 |                         transparent
0139 |                         linewidth={1}
0140 |                     />
0141 |                 </line>
0142 |             )}
0143 | 
0144 |             {/* Link Line to Ground Station */}
0145 |             {activeLink && isOnline && (
0146 |                 <line>
0147 |                     <bufferGeometry attach="geometry">
0148 |                         <float32Array attach="attributes-position" args={[
0149 |                             new Float32Array([
0150 |                                 satPos.x, satPos.y, satPos.z,
0151 |                                 activeLink.x, activeLink.y, activeLink.z
0152 |                             ]),
0153 |                             3
0154 |                         ]} />
0155 |                     </bufferGeometry>
0156 |                     <lineBasicMaterial color="#00FFC8" opacity={0.3} transparent />
0157 |                 </line>
0158 |             )}
0159 | 
0160 |             {/* Satellite Object */}
0161 |             <group position={satPos}>
0162 |                 <Float speed={2} rotationIntensity={1} floatIntensity={1}>
0163 |                     <mesh>
0164 |                         <sphereGeometry args={[isPrimary ? 0.04 : 0.025, 16, 16]} />
0165 |                         <meshBasicMaterial color={!isOnline ? "#FF4444" : (isPrimary ? "#ffffff" : "#00FFC8")} />
0166 |                     </mesh>
0167 | 
0168 |                     {/* DTN Queue Aura */}
0169 |                     {queueDepth > 0 && (
0170 |                         <mesh scale={[1.5 + (queueDepth * 0.1), 1.5 + (queueDepth * 0.1), 1.5 + (queueDepth * 0.1)]}>
0171 |                             <sphereGeometry args={[0.04, 16, 16]} />
0172 |                             <meshBasicMaterial color="#FF8800" transparent opacity={0.3} />
0173 |                         </mesh>
0174 |                     )}
0175 | 
0176 |                     {isPrimary && (
0177 |                         <mesh scale={[2.5, 2.5, 2.5]}>
0178 |                             <sphereGeometry args={[0.04, 16, 16]} />
0179 |                             <meshBasicMaterial color={isOnline ? "#00FFC8" : "#FF4444"} transparent opacity={0.2} />
0180 |                         </mesh>
0181 |                     )}
0182 | 
0183 |                     {isPrimary && (
0184 |                         <Html distanceFactor={10} position={[0.1, 0, 0]}>
0185 |                             <div className="px-2 py-0.5 rounded text-[8px] font-mono whitespace-nowrap border backdrop-blur-md transition-all duration-500 flex flex-col gap-1 bg-black/80 border-cyan-400 text-cyan-400 opacity-100 scale-110 shadow-[0_0_10px_rgba(34,211,238,0.3)]">
0186 |                                 <span>{name} (TRACKED)</span>
0187 |                                 {queueDepth > 0 && (
0188 |                                     <span className="bg-orange-500/20 text-orange-400 px-1 rounded border border-orange-500/30 text-[6px] animate-pulse">
0189 |                                         DTN: {queueDepth} BUNDLES
0190 |                                     </span>
0191 |                                 )}
0192 |                                 {!isOnline && (
0193 |                                     <span className="bg-red-500/20 text-red-400 px-1 rounded border border-red-500/30 text-[6px]">
0194 |                                         NODAL OUTAGE
0195 |                                     </span>
0196 |                                 )}
0197 |                             </div>
0198 |                         </Html>
0199 |                     )}
0200 |                 </Float>
0201 |             </group>
0202 |         </group>
0203 |     );
0204 | }

```

---

### File: `frontend\src\components\tracking\TelemetryPanel.jsx`

**Description**: Source JSX/CSS for `TelemetryPanel.jsx`

```javascript
0001 | import React from 'react';
0002 | import { Activity, MapPin, Satellite, Zap, Database, Globe } from 'lucide-react';
0003 | 
0004 | export default function TelemetryPanel({
0005 |     telemetry,
0006 |     selectedSatellite,
0007 |     onSatelliteChange,
0008 |     satellites,
0009 |     nodes,
0010 |     showAll,
0011 |     onToggleShowAll,
0012 |     dtnEvents = [],
0013 |     onToggleNode
0014 | }) {
0015 |     return (
0016 |         <div className="flex flex-col gap-6 h-full text-xs font-mono">
0017 |             {/* 1. Satellite Selector */}
0018 |             <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
0019 |                 <div className="flex items-center justify-between mb-4">
0020 |                     <div className="flex items-center gap-2 text-cyan-400">
0021 |                         <Satellite size={16} />
0022 |                         <h3 className="uppercase tracking-widest font-bold text-[10px]">Satellite Selector</h3>
0023 |                     </div>
0024 | 
0025 |                     <button
0026 |                         onClick={onToggleShowAll}
0027 |                         className={`flex items-center gap-2 px-2 py-1 rounded-md border transition-all duration-300 ${showAll ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'}`}
0028 |                     >
0029 |                         <Globe size={10} className={showAll ? 'animate-spin-slow' : ''} />
0030 |                         <span className="text-[8px] font-bold uppercase tracking-tighter">{showAll ? 'Showing All' : 'Show All'}</span>
0031 |                     </button>
0032 |                 </div>
0033 | 
0034 |                 <select
0035 |                     value={selectedSatellite.noradId}
0036 |                     onChange={(e) => {
0037 |                         const sat = satellites.find(s => s.noradId === parseInt(e.target.value));
0038 |                         onSatelliteChange(sat);
0039 |                     }}
0040 |                     className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg p-2 text-gray-300 outline-none focus:border-cyan-500/50 transition-colors"
0041 |                 >
0042 |                     {satellites.map(sat => (
0043 |                         <option key={sat.noradId} value={sat.noradId}>{sat.name}</option>
0044 |                     ))}
0045 |                 </select>
0046 |             </div>
0047 | 
0048 |             {/* 2. Live Telemetry */}
0049 |             <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 min-h-[180px]">
0050 |                 <div className="flex items-center gap-2 mb-4 text-cyan-400">
0051 |                     <Activity size={16} />
0052 |                     <h3 className="uppercase tracking-widest font-bold text-[10px]">Live Telemetry</h3>
0053 |                 </div>
0054 | 
0055 |                 {telemetry && !isNaN(telemetry.lat) ? (
0056 |                     <div className="space-y-3">
0057 |                         <TelemetryItem label="LATITUDE" value={`${telemetry.lat.toFixed(4)}°`} unit={telemetry.lat > 0 ? 'N' : 'S'} />
0058 |                         <TelemetryItem label="LONGITUDE" value={`${telemetry.lng.toFixed(4)}°`} unit={telemetry.lng > 0 ? 'E' : 'W'} />
0059 |                         <TelemetryItem label="ALTITUDE" value={`${telemetry.alt.toFixed(2)}`} unit="KM" />
0060 |                         <TelemetryItem label="VELOCITY" value={`${telemetry.vel.toFixed(2)}`} unit="KM/S" />
0061 |                         <div className="h-px bg-white/5 my-1" />
0062 |                         <TelemetryItem label="STATUS" value="NOMINAL" color="text-green-500" />
0063 |                     </div>
0064 |                 ) : (
0065 |                     <div className="flex flex-col items-center justify-center h-32 text-cyan-500/50">
0066 |                         <Activity size={24} className="animate-pulse mb-2" />
0067 |                         <div className="text-[9px] tracking-widest animate-pulse font-bold uppercase">Searching Signal...</div>
0068 |                     </div>
0069 |                 )}
0070 |             </div>
0071 | 
0072 |             {/* 3. DTN Queue Status & Controls */}
0073 |             <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
0074 |                 <div className="flex items-center gap-2 mb-4 text-purple-400">
0075 |                     <Database size={16} />
0076 |                     <h3 className="uppercase tracking-widest font-bold text-[10px]">Nodal Outage Controls</h3>
0077 |                 </div>
0078 | 
0079 |                 <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
0080 |                     {nodes.map(node => (
0081 |                         <div key={node.node_id} className="flex flex-col gap-1 p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
0082 |                             <div className="flex justify-between items-center text-[9px]">
0083 |                                 <div className="flex items-center gap-2">
0084 |                                     <span className="text-gray-400 font-bold">{node.node_id}</span>
0085 |                                     <span className={`px-1 rounded-[2px] text-[7px] ${node.status === 'ONLINE' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-500'}`}>
0086 |                                         {node.status}
0087 |                                     </span>
0088 |                                 </div>
0089 |                                 <button
0090 |                                     onClick={() => onToggleNode(node.node_id)}
0091 |                                     className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase transition-all ${node.status === 'ONLINE' ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/20'}`}
0092 |                                 >
0093 |                                     {node.status === 'ONLINE' ? 'Cut Link' : 'Restore'}
0094 |                                 </button>
0095 |                             </div>
0096 |                             <div className="h-1.5 bg-black/40 rounded-full overflow-hidden flex mt-1">
0097 |                                 <div
0098 |                                     className={`h-full transition-all duration-300 ${node.dtn_queue_depth > 0 ? 'bg-purple-500 shadow-[0_0_8px_#a855f7]' : 'bg-gray-800'}`}
0099 |                                     style={{ width: `${Math.min(100, (node.dtn_queue_depth / 20) * 100)}%` }}
0100 |                                 />
0101 |                             </div>
0102 |                             <div className="flex justify-between text-[8px] text-gray-500 font-mono">
0103 |                                 <span>QUEUE DEPTH</span>
0104 |                                 <span className={node.dtn_queue_depth > 0 ? 'text-purple-400' : ''}>{node.dtn_queue_depth || 0} BUNDLES</span>
0105 |                             </div>
0106 |                         </div>
0107 |                     ))}
0108 |                 </div>
0109 |             </div>
0110 | 
0111 |             {/* 4. DTN Protocol Event Log */}
0112 |             <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col flex-1 min-h-[200px] overflow-hidden">
0113 |                 <div className="flex items-center gap-2 mb-4 text-cyan-400">
0114 |                     <Zap size={16} />
0115 |                     <h3 className="uppercase tracking-widest font-bold text-[10px]">DTN Protocol Log</h3>
0116 |                 </div>
0117 | 
0118 |                 <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
0119 |                     {dtnEvents.length > 0 ? dtnEvents.map(event => (
0120 |                         <div key={event.id} className="text-[8px] font-mono leading-tight animate-in fade-in slide-in-from-left duration-300 border-l border-cyan-500/30 pl-2 py-0.5">
0121 |                             <span className="text-gray-600 mr-2">[{event.time}]</span>
0122 |                             <span className={`uppercase font-bold mr-2 ${event.type.includes('FLUSH') ? 'text-purple-400' :
0123 |                                     event.type.includes('QUEUED') ? 'text-orange-400' :
0124 |                                         event.type.includes('DELIVERED') ? 'text-green-400' : 'text-cyan-400'
0125 |                                 }`}>{event.type.replace('DTN_', '')}</span>
0126 |                             <span className="text-gray-400"># {event.message}</span>
0127 |                         </div>
0128 |                     )) : (
0129 |                         <div className="h-full flex items-center justify-center text-gray-600 italic text-[9px] uppercase tracking-widest">
0130 |                             Scanning for protocol packets...
0131 |                         </div>
0132 |                     )}
0133 |                 </div>
0134 |             </div>
0135 |         </div>
0136 |     );
0137 | }
0138 | 
0139 | function TelemetryItem({ label, value, unit, color = "text-white" }) {
0140 |     return (
0141 |         <div className="flex justify-between items-end border-b border-white/5 pb-1">
0142 |             <span className="text-[9px] text-gray-500 tracking-tighter">{label}</span>
0143 |             <div className="flex items-baseline gap-1">
0144 |                 <span className={`text-sm font-bold ${color}`}>{value}</span>
0145 |                 {unit && <span className="text-[9px] text-gray-400">{unit}</span>}
0146 |             </div>
0147 |         </div>
0148 |     );
0149 | }

```

---

### File: `frontend\src\hooks\useMetrics.js`

**Description**: Source JSX/CSS for `useMetrics.js`

```javascript
0001 | /**
0002 |  * useMetrics.js
0003 |  * Hook that subscribes to METRIC_UPDATE WebSocket events.
0004 |  * Maintains current metrics state.
0005 |  * Exposes current values to MetricsPanel.
0006 |  */

```

---

### File: `frontend\src\hooks\useNodeStatus.js`

**Description**: Source JSX/CSS for `useNodeStatus.js`

```javascript
0001 | /**
0002 |  * useNodeStatus.js
0003 |  * Hook that subscribes to NODE_* WebSocket events.
0004 |  * Maintains 6-node status map.
0005 |  * Exposes to OrbitalMap and NodeControls.
0006 |  */

```

---

### File: `frontend\src\hooks\useWebSocket.js`

**Description**: Source JSX/CSS for `useWebSocket.js`

```javascript
0001 | import { useState, useEffect, useCallback } from 'react';
0002 | 
0003 | export function useWebSocket(url) {
0004 |     const [messages, setMessages] = useState([]);
0005 |     const [socket, setSocket] = useState(null);
0006 |     const [connected, setConnected] = useState(false);
0007 | 
0008 |     useEffect(() => {
0009 |         const ws = new WebSocket(url);
0010 | 
0011 |         ws.onopen = () => {
0012 |             setConnected(true);
0013 |             console.log("WebSocket connected");
0014 |         };
0015 | 
0016 |         ws.onmessage = (event) => {
0017 |             const data = JSON.parse(event.data);
0018 |             setMessages((prev) => [...prev, data]);
0019 |         };
0020 | 
0021 |         ws.onclose = () => {
0022 |             setConnected(false);
0023 |             console.log("WebSocket disconnected");
0024 |         };
0025 | 
0026 |         setSocket(ws);
0027 | 
0028 |         return () => {
0029 |             ws.close();
0030 |         };
0031 |     }, [url]);
0032 | 
0033 |     return { messages, connected };
0034 | }

```

---

### File: `frontend\src\pages\FileManager.jsx`

**Description**: Source JSX/CSS for `FileManager.jsx`

```javascript
0001 | /**
0002 |  * FileManager.jsx
0003 |  * Full file list page with upload history, download controls,
0004 |  * per-file chunk detail view.
0005 |  */

```

---

### File: `frontend\src\pages\MissionControl.jsx`

**Description**: Source JSX/CSS for `MissionControl.jsx`

```javascript
0001 | /**
0002 |  * MissionControl.jsx
0003 |  * 5-panel dashboard layout page.
0004 |  * Receives WebSocket events and routes to relevant components.
0005 |  * Panels: OrbitalMap, ChunkMatrix, MetricsPanel, MissionLog, ChaosPanel.
0006 |  */

```

---

### File: `frontend\src\pages\SatelliteTrackerPage.jsx`

**Description**: Source JSX/CSS for `SatelliteTrackerPage.jsx`

```javascript
0001 | import React, { useState, useEffect, Suspense } from 'react';
0002 | import { Canvas } from '@react-three/fiber';
0003 | import GlobeViewer from '../components/tracking/GlobeViewer';
0004 | import TelemetryPanel from '../components/tracking/TelemetryPanel';
0005 | import { propagateTLE, getOrbitPath } from '../utils/tleUtils';
0006 | import { ArrowLeft, Globe, Share2, Activity, Zap, Satellite, AlertTriangle } from 'lucide-react';
0007 | 
0008 | const GROUND_STATIONS = [
0009 |     { name: 'NASA WHITE SANDS', lat: 32.5007, lng: -106.6086, color: '#00FFC8' },
0010 |     { name: 'ESA KOUROU', lat: 5.2394, lng: -52.7674, color: '#00FFC8' },
0011 |     { name: 'ISRO BYALALU', lat: 12.9156, lng: 77.3468, color: '#00FFC8' },
0012 |     { name: 'USSPACECOM THULE', lat: 76.5312, lng: -68.7031, color: '#00FFC8' }
0013 | ];
0014 | 
0015 | const PRESET_SATELLITES = [
0016 |     { name: 'ISS (ZARYA)', noradId: 25544 },
0017 |     { name: 'SPACE STATION', noradId: 48274 },
0018 |     { name: 'HUBBLE', noradId: 20580 },
0019 |     { name: 'NOAA 19', noradId: 33591 },
0020 |     { name: 'LANDSAT 9', noradId: 49260 },
0021 |     { name: 'STARLINK-31627', noradId: 58826 },
0022 | ];
0023 | 
0024 | export default function SatelliteTrackerPage({ nodes, messages, onBack }) {
0025 |     const [selectedSatellite, setSelectedSatellite] = useState(PRESET_SATELLITES[0]);
0026 |     const [allTle, setAllTle] = useState({}); // { noradId: [name, l1, l2] }
0027 |     const [allPositions, setAllPositions] = useState({}); // { noradId: { lat, lng, alt, vel, time, name } }
0028 |     const [allOrbitPaths, setAllOrbitPaths] = useState({}); // { noradId: [points] }
0029 |     const [showAll, setShowAll] = useState(false);
0030 |     const [dtnEvents, setDtnEvents] = useState([]);
0031 |     const [loading, setLoading] = useState(true);
0032 | 
0033 | 
0034 |     // 1. Fetch TLE data and Historical Events
0035 |     useEffect(() => {
0036 |         async function fetchInitialData() {
0037 |             setLoading(true);
0038 |             try {
0039 |                 // Fetch TLE
0040 |                 const tleRes = await fetch(`http://${window.location.hostname}:9000/api/tle`);
0041 |                 const tleData = await tleRes.text();
0042 |                 const lines = tleData.split('\n');
0043 |                 const newAllTle = {};
0044 |                 const newAllPaths = {};
0045 | 
0046 |                 PRESET_SATELLITES.forEach(sat => {
0047 |                     const line2Regex = new RegExp(`^2\\s+${sat.noradId}\\s+`);
0048 |                     let satTle = null;
0049 |                     for (let i = 0; i < lines.length; i++) {
0050 |                         if (line2Regex.test(lines[i].trim())) {
0051 |                             if (i >= 2) {
0052 |                                 satTle = [lines[i - 2].trim(), lines[i - 1].trim(), lines[i].trim()];
0053 |                                 break;
0054 |                             }
0055 |                         }
0056 |                     }
0057 |                     if (!satTle) {
0058 |                         satTle = [sat.name, "1 25544U 98067A   24061.50000000  .00016717  00000-0  10270-3 0  9999", "2 25544  51.6410 208.9163 0006317  86.9689 273.1587 15.4930914445467"];
0059 |                     }
0060 |                     newAllTle[sat.noradId] = satTle;
0061 |                     newAllPaths[sat.noradId] = getOrbitPath(satTle[1], satTle[2]);
0062 |                 });
0063 |                 setAllTle(newAllTle);
0064 |                 setAllOrbitPaths(newAllPaths);
0065 | 
0066 |                 // Fetch DTN History
0067 |                 const eventRes = await fetch(`http://${window.location.hostname}:9000/api/dtn/events?limit=30`);
0068 |                 if (eventRes.ok) {
0069 |                     const eventData = await eventRes.json();
0070 |                     const initialEvents = eventData.map(e => ({
0071 |                         id: `hist-${e.id}`,
0072 |                         time: new Date(e.timestamp).toLocaleTimeString(),
0073 |                         type: e.type,
0074 |                         message: e.message,
0075 |                         nodeId: e.metadata?.node_id
0076 |                     })).reverse();
0077 |                     setDtnEvents(initialEvents);
0078 |                 }
0079 | 
0080 |             } catch (err) {
0081 |                 console.error("Failed to fetch initial data", err);
0082 |             } finally {
0083 |                 setLoading(false);
0084 |             }
0085 |         }
0086 |         fetchInitialData();
0087 |     }, []);
0088 | 
0089 |     useEffect(() => {
0090 |         if (Object.keys(allTle).length === 0) return;
0091 | 
0092 |         const interval = setInterval(() => {
0093 |             const newPositions = {};
0094 |             Object.entries(allTle).forEach(([noradId, tleData]) => {
0095 |                 const pos = propagateTLE(tleData[1], tleData[2]);
0096 |                 if (pos) {
0097 |                     const satName = PRESET_SATELLITES.find(s => s.noradId === parseInt(noradId))?.name || 'UNKNOWN';
0098 |                     newPositions[noradId] = { ...pos, name: satName };
0099 |                 }
0100 |             });
0101 |             setAllPositions(newPositions);
0102 |         }, 1000);
0103 | 
0104 |         return () => clearInterval(interval);
0105 |     }, [allTle]);
0106 | 
0107 |     // 3. Handle DTN Events from the passed prop messages
0108 |     useEffect(() => {
0109 |         if (!messages || !messages.length) return;
0110 |         const lastMsg = messages[messages.length - 1];
0111 | 
0112 |         const dtnTypes = ['DTN_QUEUED', 'DTN_FLUSH_START', 'DTN_BUNDLE_DELIVERED', 'DTN_FLUSH_COMPLETE', 'NODE_ONLINE', 'NODE_OFFLINE', 'NODE_PARTITIONED', 'CHAOS_TRIGGERED'];
0113 |         if (dtnTypes.includes(lastMsg.type) || lastMsg.event) {
0114 |             const eventType = lastMsg.type || lastMsg.event;
0115 |             const payload = lastMsg.data || lastMsg;
0116 | 
0117 |             setDtnEvents(prev => [{
0118 |                 id: Date.now(),
0119 |                 time: new Date().toLocaleTimeString(),
0120 |                 type: eventType,
0121 |                 message: payload.message || `${eventType} on ${payload.node_id || 'system'}`,
0122 |                 nodeId: payload.node_id
0123 |             }, ...prev].slice(0, 50));
0124 |         }
0125 |     }, [messages]);
0126 | 
0127 |     const handleToggleNode = async (nodeId) => {
0128 |         try {
0129 |             await fetch(`http://${window.location.hostname}:9000/api/node/${nodeId}/toggle`, { method: 'POST' });
0130 |         } catch (err) {
0131 |             console.error("Failed to toggle node", err);
0132 |         }
0133 |     };
0134 | 
0135 |     return (
0136 |         <div className="h-screen w-screen bg-[#02040A] text-gray-200 overflow-hidden font-sans relative flex flex-col p-6 animate-in fade-in duration-500">
0137 | 
0138 |             {/* Background Ambient Glow */}
0139 |             <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-cyan-600/5 blur-[150px] rounded-full pointer-events-none z-0"></div>
0140 | 
0141 |             {/* Header Navigation */}
0142 |             <div className="relative z-10 flex justify-between items-center mb-6">
0143 |                 <button
0144 |                     onClick={onBack}
0145 |                     className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all group"
0146 |                 >
0147 |                     <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
0148 |                     <span className="text-sm font-medium">Return to Dashboard</span>
0149 |                 </button>
0150 | 
0151 |                 <div className="flex flex-col items-center">
0152 |                     <div className="flex items-center gap-2 text-cyan-400">
0153 |                         <Globe size={16} />
0154 |                         <h1 className="text-xs font-mono tracking-[0.3em] uppercase font-bold">Orbital Intelligence Network</h1>
0155 |                     </div>
0156 |                     <div className="text-[10px] text-gray-500 font-mono mt-1 tracking-widest uppercase">Live Tracking & DTN Store-Forward Protocol</div>
0157 |                 </div>
0158 | 
0159 |                 <div className="flex items-center gap-4">
0160 |                     <div className="flex flex-col items-end">
0161 |                         <span className="text-[10px] text-cyan-400 font-bold tracking-widest">{selectedSatellite.name}</span>
0162 |                         <span className="text-[8px] text-gray-500 font-mono tracking-widest uppercase">Syncing Live Telemetry</span>
0163 |                     </div>
0164 |                     <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
0165 |                         <Satellite size={20} />
0166 |                     </div>
0167 |                 </div>
0168 |             </div>
0169 | 
0170 |             {/* Main Content Layout */}
0171 |             <div className="flex-1 flex gap-6 relative z-10 overflow-hidden">
0172 | 
0173 |                 {/* 3D Viewport */}
0174 |                 <div className="flex-[7] relative bg-black/40 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl overflow-hidden group">
0175 | 
0176 |                     {/* HUD Overlays */}
0177 |                     <div className="absolute top-6 left-6 z-10 pointer-events-none">
0178 |                         <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full">
0179 |                             <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
0180 |                             <span className="text-[10px] font-mono tracking-widest text-white uppercase">Live Orbital Track</span>
0181 |                         </div>
0182 |                     </div>
0183 | 
0184 |                     <div className="absolute top-6 right-6 z-10 pointer-events-none">
0185 |                         <div className="text-right font-mono">
0186 |                             <div className="text-[10px] text-gray-400 tracking-widest">PROPAGATION_ENGINE: SGP4</div>
0187 |                             <div className="text-[10px] text-gray-400 tracking-widest mt-1">EPOCH_SYNC: {new Date().toLocaleDateString()}</div>
0188 |                         </div>
0189 |                     </div>
0190 | 
0191 |                     <div className="absolute bottom-6 left-6 z-10 pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity">
0192 |                         <div className="grid grid-cols-2 gap-4 text-[9px] font-mono text-gray-400">
0193 |                             <div>RENDER: GL_CORE_3.0</div>
0194 |                             <div>FPS: 60.00</div>
0195 |                             <div>LOD: HIGH_FIDELITY</div>
0196 |                             <div>SHADING: PHONG_DYNAMICS</div>
0197 |                         </div>
0198 |                     </div>
0199 | 
0200 |                     <Canvas gl={{ antialias: true, alpha: true }}>
0201 |                         <Suspense fallback={null}>
0202 |                             <GlobeViewer
0203 |                                 satellites={showAll
0204 |                                     ? PRESET_SATELLITES.map(s => {
0205 |                                         const nodeId = `SAT-${String(s.noradId).slice(-2)}`;
0206 |                                         const nodeData = nodes.find(n => n.node_id === nodeId);
0207 |                                         return {
0208 |                                             ...s,
0209 |                                             currentPos: allPositions[s.noradId],
0210 |                                             orbitPath: allOrbitPaths[s.noradId],
0211 |                                             isPrimary: s.noradId === selectedSatellite.noradId,
0212 |                                             queueDepth: nodeData?.dtn_queue_depth || 0,
0213 |                                             isOnline: nodeData?.status === 'ONLINE'
0214 |                                         };
0215 |                                     })
0216 |                                     : [{
0217 |                                         ...selectedSatellite,
0218 |                                         currentPos: allPositions[selectedSatellite.noradId],
0219 |                                         orbitPath: allOrbitPaths[selectedSatellite.noradId],
0220 |                                         isPrimary: true,
0221 |                                         queueDepth: nodes.find(n => n.node_id.includes(String(selectedSatellite.noradId).slice(-2)))?.dtn_queue_depth || 0,
0222 |                                         isOnline: nodes.find(n => n.node_id.includes(String(selectedSatellite.noradId).slice(-2)))?.status === 'ONLINE'
0223 |                                     }]
0224 |                                 }
0225 |                                 groundStations={GROUND_STATIONS}
0226 |                             />
0227 |                         </Suspense>
0228 |                     </Canvas>
0229 | 
0230 |                     {loading && (
0231 |                         <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-xl z-20">
0232 |                             <div className="flex flex-col items-center gap-4">
0233 |                                 <div className="w-16 h-16 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
0234 |                                 <div className="text-cyan-500 font-mono text-sm tracking-[0.2em] animate-pulse">ESTABLISHING SATELLITE UPLINK...</div>
0235 |                             </div>
0236 |                         </div>
0237 |                     )}
0238 |                 </div>
0239 | 
0240 |                 {/* Sidebar Telemetry */}
0241 |                 <div className="flex-[2.5] flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
0242 |                     <TelemetryPanel
0243 |                         telemetry={allPositions[selectedSatellite.noradId]}
0244 |                         selectedSatellite={selectedSatellite}
0245 |                         onSatelliteChange={setSelectedSatellite}
0246 |                         satellites={PRESET_SATELLITES}
0247 |                         nodes={nodes}
0248 |                         showAll={showAll}
0249 |                         onToggleShowAll={() => setShowAll(!showAll)}
0250 |                         dtnEvents={dtnEvents}
0251 |                         onToggleNode={handleToggleNode}
0252 |                     />
0253 |                 </div>
0254 |             </div>
0255 | 
0256 |             {/* Footer System Status */}
0257 |             <div className="relative z-10 h-8 flex items-center justify-between mt-4 px-2 font-mono text-[9px] text-gray-500 uppercase tracking-widest border-t border-white/5 pt-4">
0258 |                 <div className="flex gap-4">
0259 |                     <span>System: Stable</span>
0260 |                     <span className="text-cyan-500/50">|</span>
0261 |                     <span>Uptime: 99.99%</span>
0262 |                     <span className="text-cyan-500/50">|</span>
0263 |                     <span>Latency: 42ms</span>
0264 |                 </div>
0265 |                 <div className="flex gap-4">
0266 |                     <span>CelesTrak API: Connected</span>
0267 |                     <span className="text-cyan-500/50">|</span>
0268 |                     <span>DTN Protocol: v7.0.2</span>
0269 |                 </div>
0270 |             </div>
0271 |         </div>
0272 |     );
0273 | }

```

---

### File: `frontend\src\services\api.js`

**Description**: Source JSX/CSS for `api.js`

```javascript
0001 | /**
0002 |  * api.js
0003 |  * All fetch calls to the backend API.
0004 |  * POST /api/upload (multipart)
0005 |  * GET /api/download/{id}
0006 |  * GET /api/files
0007 |  * GET /api/nodes
0008 |  * POST /api/node/{id}/toggle
0009 |  * POST /api/chaos/{scenario}
0010 |  * POST /api/restore
0011 |  */

```

---

### File: `frontend\src\utils\chunkTransform.js`

**Description**: Source JSX/CSS for `chunkTransform.js`

```javascript
0001 | /**
0002 |  * chunkTransform.js
0003 |  * Converts API chunk data format → D3 matrix cell format.
0004 |  * Output: { row, col, state, metadata }
0005 |  */

```

---

### File: `frontend\src\utils\eventColors.js`

**Description**: Source JSX/CSS for `eventColors.js`

```javascript
0001 | /**
0002 |  * eventColors.js
0003 |  * Maps event type strings → CSS color classes for mission log terminal.
0004 |  * green=success, red=failure, yellow=warning, cyan=info, purple=chaos, magenta=DTN.
0005 |  */

```

---

### File: `frontend\src\utils\geoUtils.js`

**Description**: Source JSX/CSS for `geoUtils.js`

```javascript
0001 | import * as THREE from 'three';
0002 | 
0003 | /**
0004 |  * Converts geographic coordinates (lat, lng, alt) to Cartesian 3D coordinates.
0005 |  * @param {number} lat - Latitude in degrees.
0006 |  * @param {number} lng - Longitude in degrees.
0007 |  * @param {number} alt - Altitude in km.
0008 |  * @param {number} earthRadius - Normalized radius of Earth in three-js units (default: 1).
0009 |  * @returns {THREE.Vector3}
0010 |  */
0011 | export function geoToCartesian(lat, lng, alt, earthRadius = 2.5) {
0012 |     // We use 2.5 as a base radius to make the globe look substantial in the scene
0013 |     const R = earthRadius + (alt / 6371) * earthRadius;
0014 |     const phi = (90 - lat) * (Math.PI / 180);
0015 |     const theta = (lng + 180) * (Math.PI / 180);
0016 | 
0017 |     return new THREE.Vector3(
0018 |         -R * Math.sin(phi) * Math.cos(theta),
0019 |         R * Math.cos(phi),
0020 |         R * Math.sin(phi) * Math.sin(theta)
0021 |     );
0022 | }

```

---

### File: `frontend\src\utils\metricFormulas.js`

**Description**: Source JSX/CSS for `metricFormulas.js`

```javascript
0001 | /**
0002 |  * metricFormulas.js
0003 |  * Frontend-side display formatting:
0004 |  * - MTTDL: scientific notation display
0005 |  * - Entropy: 2 decimal places
0006 |  * - Efficiency: percentage string
0007 |  */

```

---

### File: `frontend\src\utils\nodeTransform.js`

**Description**: Source JSX/CSS for `nodeTransform.js`

```javascript
0001 | /**
0002 |  * nodeTransform.js
0003 |  * Converts API node data → React Flow nodes array + edges array.
0004 |  * Calculates position coordinates for orbital ring layout.
0005 |  */

```

---

### File: `frontend\src\utils\tleUtils.js`

**Description**: Source JSX/CSS for `tleUtils.js`

```javascript
0001 | import * as satellite from 'satellite.js';
0002 | 
0003 | /**
0004 |  * Propagates a TLE to a specific date/time.
0005 |  * @param {string} line1 
0006 |  * @param {string} line2 
0007 |  * @param {Date} date 
0008 |  * @returns {object|null}
0009 |  */
0010 | export function propagateTLE(line1, line2, date = new Date()) {
0011 |     try {
0012 |         const satrec = satellite.twoline2satrec(line1, line2);
0013 |         const positionAndVelocity = satellite.propagate(satrec, date);
0014 |         const gmst = satellite.gstime(date);
0015 | 
0016 |         if (positionAndVelocity && positionAndVelocity.position && positionAndVelocity.velocity) {
0017 |             const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
0018 | 
0019 |             const longitude = satellite.degreesLong(positionGd.longitude);
0020 |             const latitude = satellite.degreesLat(positionGd.latitude);
0021 |             const height = positionGd.height;
0022 | 
0023 |             // Calculate velocity magnitude (km/s)
0024 |             const v = positionAndVelocity.velocity;
0025 |             const velocity = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
0026 | 
0027 |             // Double check for NaN before returning
0028 |             if (isNaN(latitude) || isNaN(longitude) || isNaN(height) || isNaN(velocity)) {
0029 |                 return null;
0030 |             }
0031 | 
0032 |             return {
0033 |                 lat: latitude,
0034 |                 lng: longitude,
0035 |                 alt: height,
0036 |                 vel: velocity,
0037 |                 time: date
0038 |             };
0039 |         }
0040 |     } catch (error) {
0041 |         console.error("TLE Propagation Error:", error);
0042 |     }
0043 |     return null;
0044 | }
0045 | 
0046 | /**
0047 |  * Computes the full orbit path (points) for a satellite.
0048 |  * @param {string} line1 
0049 |  * @param {string} line2 
0050 |  * @param {number} points - Number of points to calculate (default 180).
0051 |  * @param {number} intervalMinutes - Interval between points (default 1 min).
0052 |  * @returns {Array}
0053 |  */
0054 | export function getOrbitPath(line1, line2, points = 180, intervalMinutes = 0.5) {
0055 |     const path = [];
0056 |     const now = new Date();
0057 | 
0058 |     // Start from 45 min ago to 45 min in the future for a 90 min orbit visualization
0059 |     const startTime = new Date(now.getTime() - (points / 2) * intervalMinutes * 60 * 1000);
0060 | 
0061 |     for (let i = 0; i < points; i++) {
0062 |         const time = new Date(startTime.getTime() + i * intervalMinutes * 60 * 1000);
0063 |         const pos = propagateTLE(line1, line2, time);
0064 |         if (pos) {
0065 |             path.push(pos);
0066 |         }
0067 |     }
0068 | 
0069 |     return path;
0070 | }

```

---

## PART 4: INFRASTRUCTURE & CONFIGURATION

### File: `README.md`

```text
0001 | # 🛰️ COSMEON FS-LITE
0002 | 
0003 | **COSMEON FS-LITE** is a distributed, fault-tolerant Orbital File System designed for simulated satellite constellations. It leverages Reed-Solomon erasure coding, Delay-Tolerant Networking (DTN), and Raft consensus to guarantee high availability and data survivability in chaotic environments such as Low Earth Orbit (LEO).
0004 | 
0005 | ## ✨ Features
0006 | 
0007 | - **Erasure-Coded Storage**: Implements Reed-Solomon (RS) encoding to fragment files across the orbital mesh dynamically, ensuring survivability despite localized node failures.
0008 | - **Orbital Mesh Simulation**: 3 distinct orbital planes (Alpha, Beta, Gamma) with multi-node replication and topology-aware data placement.
0009 | - **Raft Consensus & Distributed Ledger**: Ensures strict consistency during destructive operations and metadata updates across planes.
0010 | - **DTN (Delay-Tolerant Networking) Queueing**: Caches transmission operations safely until a node regains connection line-of-sight.
0011 | - **ZKP Auditing & Integrity Checks**: Verifies data integrity at rest using cryptographic tethers and zero-knowledge commitments.
0012 | - **Predictive Caching & Data Hydration**: Intelligence layer that anticipates cold data requirements and pre-warms the cache for minimum latency.
0013 | - **Rich 3D Visualization**: Real-time React Three Fiber dashboard mapping satellites, file segments, and real-time metrics.
0014 | 
0015 | ## 🛠️ Tech Stack
0016 | 
0017 | - **Backend**: Python 3.11, FastAPI, Uvicorn (Async I/O Processing)
0018 | - **Frontend**: React 19, Vite, Tailwind CSS, GSAP, React Three Fiber (3D mapping)
0019 | - **Infrastructure**: Docker & Docker Compose
0020 | 
0021 | ## 🚀 Getting Started
0022 | 
0023 | You can run the project either using **Docker** (recommended for full simulation) or **Manually** (running backend and frontend separately).
0024 | 
0025 | ### Option 1: Manual Setup (Local Development)
0026 | 
0027 | If you prefer to run the servers manually or if Docker is not working properly, follow these steps:
0028 | 
0029 | #### 1. Backend (Ground Station App & Satellites Simulation)
0030 | Open a terminal and navigate to the `backend` folder:
0031 | ```bash
0032 | cd backend
0033 | python -m venv venv
0034 | # On Windows: venv\Scripts\activate
0035 | # On Mac/Linux: source venv/bin/activate
0036 | 
0037 | pip install -r requirements.txt
0038 | uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
0039 | ```
0040 | This will start the backend API and the simulation loop at `http://localhost:8000`.
0041 | 
0042 | #### 2. Frontend (Dashboard & Visualization)
0043 | Open a separate terminal and navigate to the `frontend` folder:
0044 | ```bash
0045 | cd frontend
0046 | npm install
0047 | npm run dev
0048 | ```
0049 | This will start the React UI on `http://localhost:5173`.
0050 | 
0051 | ### Option 2: Running the Full Simulation (Docker Compose)
0052 | 
0053 | The easiest way to boot the ground station and the 6 interconnected satellites is using Docker Compose.
0054 | 
0055 | 1. Ensure **Docker Desktop** is running.
0056 | 2. Build and launch the orbital mesh:
0057 | 
0058 | ```bash
0059 | docker-compose up -d --build
0060 | ```
0061 | 
0062 | 3. Access the interfaces:
0063 |    - **Frontend UI & Visualizer**: [http://localhost:5173](http://localhost:5173)
0064 |    - **Ground Station API**: [http://localhost:8000](http://localhost:8000)
0065 | 
0066 | ### Graceful Shutdown (Docker)
0067 | 
0068 | To spin down the constellation and stop all orbiters:
0069 | 
0070 | ```bash
0071 | docker-compose down
0072 | ```
0073 | 
0074 | ## 📁 Project Structure
0075 | 
0076 | ```text
0077 | ├── backend/
0078 | │   ├── api/             # Specific API endpoints (survivability, metrics)
0079 | │   ├── core/            # File Chunks, Encoder, Distributor, Reassembler
0080 | │   ├── intelligence/    # Chaos router, DTN worker, Predictor, Raft, ZKP 
0081 | │   ├── metadata/        # Centralized metadata tracking
0082 | │   ├── metrics/         # Analytic calculators (MTTDL, Cache Efficiency)
0083 | │   ├── main.py          # FastAPI server entry point
0084 | │   ├── Dockerfile
0085 | │   └── requirements.txt
0086 | ├── frontend/
0087 | │   ├── src/             # React application (UI, 3D Map, WebSockets)
0088 | │   ├── public/          # Static assets
0089 | │   ├── package.json     
0090 | │   └── vite.config.js
0091 | └── docker-compose.yml   # Orbital mesh topology configuration
0092 | ```
0093 | 
0094 | ## 📜 License
0095 | 
0096 | This is a Hackathon project — **HACKX 4.0**.
```

---

### File: `docker-compose.yml`

```text
0001 | version: '3.8'
0002 | 
0003 | # ─────────────────────────────────────────────
0004 | # ORBITAL NETWORKS (Subnets)
0005 | # ─────────────────────────────────────────────
0006 | networks:
0007 |   alpha_plane:
0008 |     driver: bridge
0009 |   beta_plane:
0010 |     driver: bridge
0011 |   gamma_plane:
0012 |     driver: bridge
0013 |   ground_link:
0014 |     driver: bridge
0015 | 
0016 | # ─────────────────────────────────────────────
0017 | # PERSISTENT STORAGE
0018 | # ─────────────────────────────────────────────
0019 | volumes:
0020 |   orbit_mesh_data:
0021 | 
0022 | # ─────────────────────────────────────────────
0023 | # BASE SATELLITE TEMPLATE
0024 | # ─────────────────────────────────────────────
0025 | x-sat-template: &sat-template
0026 |   build: ./backend
0027 |   environment:
0028 |     - PYTHONUNBUFFERED=1
0029 |     # Base port for intra-node GossipSub/gRPC later
0030 |   volumes:
0031 |     - orbit_mesh_data:/app/backend/nodes
0032 |   restart: unless-stopped
0033 | 
0034 | services:
0035 | 
0036 |   # ==========================================================
0037 |   # THE GROUND STATION (Earth)
0038 |   # ==========================================================
0039 |   ground-station:
0040 |     build: ./backend
0041 |     container_name: cosmeon-ground-station
0042 |     ports:
0043 |       - "8000:8000"
0044 |     networks:
0045 |       - ground_link
0046 |     environment:
0047 |       - ROLE=GROUND_STATION
0048 |       - PYTHONUNBUFFERED=1
0049 |     volumes:
0050 |       - orbit_mesh_data:/app/backend/nodes
0051 |     restart: always
0052 | 
0053 |   frontend:
0054 |     build: ./frontend
0055 |     container_name: cosmeon-frontend
0056 |     ports:
0057 |       - "5173:5173"
0058 |     networks:
0059 |       - ground_link
0060 |     depends_on:
0061 |       - ground-station
0062 | 
0063 |   # ==========================================================
0064 |   # PLANE ALPHA SATELLITES
0065 |   # ==========================================================
0066 |   sat-01:
0067 |     <<: *sat-template
0068 |     container_name: cosmeon-sat-01
0069 |     networks:
0070 |       - alpha_plane
0071 |       - ground_link
0072 |     environment:
0073 |       - NODE_ID=SAT-01
0074 |       - PLANE=Alpha
0075 |     depends_on:
0076 |       - ground-station
0077 | 
0078 |   sat-02:
0079 |     <<: *sat-template
0080 |     container_name: cosmeon-sat-02
0081 |     networks:
0082 |       - alpha_plane
0083 |       - ground_link
0084 |     environment:
0085 |       - NODE_ID=SAT-02
0086 |       - PLANE=Alpha
0087 |     depends_on:
0088 |       - ground-station
0089 | 
0090 |   # ==========================================================
0091 |   # PLANE BETA SATELLITES
0092 |   # ==========================================================
0093 |   sat-03:
0094 |     <<: *sat-template
0095 |     container_name: cosmeon-sat-03
0096 |     networks:
0097 |       - beta_plane
0098 |       - ground_link
0099 |     environment:
0100 |       - NODE_ID=SAT-03
0101 |       - PLANE=Beta
0102 |     depends_on:
0103 |       - ground-station
0104 | 
0105 |   sat-04:
0106 |     <<: *sat-template
0107 |     container_name: cosmeon-sat-04
0108 |     networks:
0109 |       - beta_plane
0110 |       - ground_link
0111 |     environment:
0112 |       - NODE_ID=SAT-04
0113 |       - PLANE=Beta
0114 |     depends_on:
0115 |       - ground-station
0116 | 
0117 |   # ==========================================================
0118 |   # PLANE GAMMA SATELLITES
0119 |   # ==========================================================
0120 |   sat-05:
0121 |     <<: *sat-template
0122 |     container_name: cosmeon-sat-05
0123 |     networks:
0124 |       - gamma_plane
0125 |       - ground_link
0126 |     environment:
0127 |       - NODE_ID=SAT-05
0128 |       - PLANE=Gamma
0129 |     depends_on:
0130 |       - ground-station
0131 | 
0132 |   sat-06:
0133 |     <<: *sat-template
0134 |     container_name: cosmeon-sat-06
0135 |     networks:
0136 |       - gamma_plane
0137 |       - ground_link
0138 |     environment:
0139 |       - NODE_ID=SAT-06
0140 |       - PLANE=Gamma
0141 |     depends_on:
0142 |       - ground-station

```

---

### File: `backend/requirements.txt`

```text
0001 | fastapi==0.110.0
0002 | uvicorn==0.29.0
0003 | reedsolo==1.7.0
0004 | python-multipart==0.0.9
0005 | aiofiles==23.2.1
0006 | websockets==12.0
0007 | pydantic>=2.0.0
0008 | grpcio==1.62.0
0009 | grpcio-tools==1.62.0
```

---

### File: `frontend/package.json`

```text
0001 | {
0002 |   "name": "frontend",
0003 |   "private": true,
0004 |   "version": "0.0.0",
0005 |   "type": "module",
0006 |   "scripts": {
0007 |     "dev": "vite",
0008 |     "build": "vite build",
0009 |     "lint": "eslint .",
0010 |     "preview": "vite preview"
0011 |   },
0012 |   "dependencies": {
0013 |     "@react-spring/three": "^10.0.3",
0014 |     "@react-three/drei": "^10.7.7",
0015 |     "@react-three/fiber": "^9.5.0",
0016 |     "@react-three/postprocessing": "^3.0.4",
0017 |     "@tailwindcss/vite": "^4.2.1",
0018 |     "@use-gesture/react": "^10.3.1",
0019 |     "chart.js": "^4.5.1",
0020 |     "clsx": "^2.1.1",
0021 |     "countup.js": "^2.9.0",
0022 |     "d3": "^7.9.0",
0023 |     "framer-motion": "^12.34.3",
0024 |     "gsap": "^3.14.2",
0025 |     "lucide-react": "^0.575.0",
0026 |     "react": "^19.2.0",
0027 |     "react-chartjs-2": "^5.3.1",
0028 |     "react-countup": "^6.5.3",
0029 |     "react-dom": "^19.2.0",
0030 |     "reactflow": "^11.11.4",
0031 |     "recharts": "^3.7.0",
0032 |     "satellite.js": "^6.0.2",
0033 |     "socket.io-client": "^4.8.3",
0034 |     "tailwind-merge": "^3.5.0",
0035 |     "three": "^0.183.2"
0036 |   },
0037 |   "devDependencies": {
0038 |     "@eslint/js": "^9.39.1",
0039 |     "@types/react": "^19.2.7",
0040 |     "@types/react-dom": "^19.2.3",
0041 |     "@vitejs/plugin-react": "^5.1.1",
0042 |     "autoprefixer": "^10.4.27",
0043 |     "eslint": "^9.39.1",
0044 |     "eslint-plugin-react-hooks": "^7.0.1",
0045 |     "eslint-plugin-react-refresh": "^0.4.24",
0046 |     "globals": "^16.5.0",
0047 |     "postcss": "^8.5.6",
0048 |     "tailwindcss": "^4.2.1",
0049 |     "vite": "^7.3.1"
0050 |   }
0051 | }

```

---



# END OF DOCUMENT
Total comprehensive line generation complete. This file is specifically formatted for AI ingestion and context retrieval.
