# COSMEON FS-LITE — Complete System Audit & Technical Reference

**Project**: COSMEON FS-LITE (Orbital File System Simulation)
**Context**: HACKX 4.0 Hackathon Project — Problem Statement 5
**Date**: March 2026
**Tech Stack**: Python 3.11 + FastAPI (backend), React 19 + Vite + Three.js (frontend), Docker
**Purpose**: Simulates a distributed, fault-tolerant file system across a 6-satellite Low Earth Orbit (LEO) constellation

---

## TABLE OF CONTENTS

1. System Overview & Architecture
2. Satellite Constellation Topology
3. Backend Module Reference (30+ files)
4. Core Engine — File Processing Pipeline
5. Metadata & Distributed State Management
6. Intelligence Layer — Autonomous Operations
7. Metrics & Observability
8. API Reference — REST & WebSocket Endpoints
9. Frontend Architecture — 36 React Components
10. Chaos Engineering & Fault Injection
11. Algorithms & Data Structures Deep-Dive
12. Problem Statement 5 — Requirements Mapping
13. Optional Enhancements Implemented
14. Future Scope & FS-PRO Transition
15. Glossary of Terms

---

## 1. SYSTEM OVERVIEW & ARCHITECTURE

COSMEON FS-LITE is a distributed file system that simulates storing files across a constellation of 6 satellites in Low Earth Orbit. The system is built around these core principles:

### Design Philosophy
- **Erasure Coding over Replication**: Uses Reed-Solomon RS(4,2) encoding instead of 3x replication, achieving 50% less storage overhead while providing the same fault tolerance.
- **Topology-Aware Placement**: Data chunks and their parity counterparts are never placed on the same orbital plane, ensuring survivability against plane-level failures.
- **Delay-Tolerant Networking**: Inspired by NASA's Bundle Protocol (BPv7), the system queues data for satellites that are temporarily out of line-of-sight.
- **Proactive Intelligence**: Background tasks continuously monitor orbit timers, predict failures, and migrate data before loss occurs.

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GROUND STATION (FastAPI)                      │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Core Engine  │  │ Intelligence │  │  Metadata Manager    │  │
│  │  - Chunker    │  │ - Chaos      │  │  - store.json        │  │
│  │  - Encoder    │  │ - DTN Queue  │  │  - Vector Clocks     │  │
│  │  - Decoder    │  │ - Predictor  │  │  - Event Logging     │  │
│  │  - Distributor│  │ - Raft       │  └──────────────────────┘  │
│  │  - Reassemblr │  │ - Rebalancer │                             │
│  │  - Integrity  │  │ - ZKP Audit  │  ┌──────────────────────┐  │
│  └──────────────┘  │ - ISL Mgr    │  │  Metrics Engine      │  │
│                     │ - Trajectory │  │  - MTTDL Calculator  │  │
│                     │ - Harvest    │  │  - Entropy Tracker   │  │
│                     └──────────────┘  │  - Survivability Sim │  │
│                                        └──────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST API + WebSocket (/ws)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Three.js)                   │
│  36 Components: 3D Orbital Map, Chaos Panel, Metrics Dashboard, │
│  Storage Map, Mission Terminal, File Upload/Download, etc.       │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Upload Pipeline
1. User uploads file via REST API `/api/upload`
2. **Chunker** splits file into 512KB chunks with UUID + SHA-256 hash
3. **Encoder** takes groups of 4 data chunks → generates 2 parity chunks (RS(4,2))
4. **Distributor** assigns each of the 6 shards to a satellite node, respecting topology rules
5. **Metadata Manager** registers the file record in `store.json` with vector clocks
6. **ZKP Auditor** generates cryptographic commitments for each chunk
7. WebSocket broadcasts real-time progress to the frontend

### Data Flow: Download Pipeline
1. User requests file via `/api/download/{file_id}`
2. **Reassembler** checks ground cache → fetches chunks from satellite nodes
3. For offline nodes: tries ISL relay routing (BFS pathfinding)
4. For missing chunks: triggers RS(4,2) decoding to reconstruct from any 4-of-6
5. **Integrity** verifies SHA-256 at chunk level and full file level
6. File bytes returned with original filename via Content-Disposition header

---

## 2. SATELLITE CONSTELLATION TOPOLOGY

### Orbital Planes (3 planes × 2 satellites each)

| Plane | Satellites | Purpose |
|-------|-----------|---------|
| **Alpha** | SAT-01, SAT-02 | Primary storage plane |
| **Beta** | SAT-03, SAT-04 | Secondary storage plane |
| **Gamma** | SAT-05, SAT-06 | Tertiary storage plane |

### Topology Rule (CRITICAL)
**A data chunk and its corresponding parity chunk MUST NEVER reside on the same orbital plane.**
- If data chunk D0 is on Alpha (SAT-01), its parity P0 must be on Beta or Gamma.
- This ensures a full plane failure (e.g., solar flare killing Alpha) doesn't destroy both data and parity.

### Inter-Satellite Link (ISL) Adjacency Map
Each satellite has 3 permanent links (1 intra-plane + 2 inter-plane):

```
SAT-01 ↔ SAT-02 (intra-Alpha), SAT-03 (→Beta), SAT-05 (→Gamma)
SAT-02 ↔ SAT-01 (intra-Alpha), SAT-04 (→Beta), SAT-06 (→Gamma)
SAT-03 ↔ SAT-04 (intra-Beta),  SAT-01 (→Alpha), SAT-05 (→Gamma)
SAT-04 ↔ SAT-03 (intra-Beta),  SAT-02 (→Alpha), SAT-06 (→Gamma)
SAT-05 ↔ SAT-06 (intra-Gamma), SAT-01 (→Alpha), SAT-03 (→Beta)
SAT-06 ↔ SAT-05 (intra-Gamma), SAT-02 (→Alpha), SAT-04 (→Beta)
```

### Node Status States
- **ONLINE**: Fully operational, accepting reads/writes
- **OFFLINE**: Dead satellite, no communication possible (simulates hardware failure)
- **DEGRADED**: Alive but unstable (orbit completion jitter, 3-second window)
- **PARTITIONED**: Alive but no ground station line-of-sight (can still relay via ISL)

---

## 3. BACKEND MODULE REFERENCE

### 3.1 Configuration — `backend/config.py` (84 lines)

Defines all system-wide constants:

| Parameter | Value | Description |
|-----------|-------|-------------|
| `CHUNK_SIZE` | 512 KB | Fixed chunk size for file splitting |
| `RS_K` | 4 | Data chunks per RS group |
| `RS_M` | 2 | Parity chunks per RS group |
| `RS_TOTAL` | 6 | Total shards (4 data + 2 parity) |
| `ORBIT_PERIOD` | 120 seconds | Full orbit countdown cycle |
| `LOS_THRESHOLD` | 30 seconds | Trigger predictive migration threshold |
| `CACHE_SIZE` | 10 | LRU ground cache max chunks |
| `ISL_HOP_LATENCY_MS` | 50 ms | Simulated inter-satellite hop delay |
| `HASH_ALGORITHM` | sha256 | Configurable (sha3_256 for quantum-ready) |

File system paths:
- `NODES_BASE_PATH` = `backend/nodes/` (6 directories, one per satellite)
- `DTN_QUEUE_PATH` = `backend/dtn_queue/`
- `METADATA_PATH` = `backend/metadata/store.json`
- `HARVEST_CACHE_PATH` = `backend/harvest_cache/`

### 3.2 Core Engine — `backend/core/`

#### `chunker.py` (94 lines) — File Splitting
- **`Chunk` dataclass**: `chunk_id` (UUID4), `sequence_number`, `size`, `sha256_hash`, `data` (bytes), `is_parity` (bool)
- **`chunk_file(file_bytes)`**: Splits file into 512KB chunks. Returns `(List[Chunk], file_hash)`.
- **`chunk_stream(file_bytes)`**: Async generator version — yields 1 chunk at a time to reduce memory pressure.
- **`reassemble_chunks(chunks)`**: Concatenates sorted chunks back into original bytes.
- **`_compute_hash(data)`**: SHA-256 (or SHA3-256 if `HASH_ALGORITHM` env var set).

#### `encoder.py` (84 lines) — Reed-Solomon Encoding
- **`encode_chunks(data_chunks: List[Chunk])`**: Takes exactly 4 data chunks → returns 6 chunks (4 data + 2 parity).
- Encoding is done byte-by-byte across all chunks (interleaved). All chunks are padded to equal length first.
- **Hardware acceleration**: Attempts to use a native Rust PyO3 RS engine (`cosmeon_rs_engine`). Falls back to pure-Python `reedsolo` library if Rust binary not found.
- Each chunk gets `_pad_size` metadata attached for the decoder.

#### `decoder.py` (87 lines) — Reed-Solomon Decoding
- **`decode_chunks(available_chunks, pad_size)`**: Reconstructs all 4 data chunks from any 4 of 6 available chunks.
- Uses `reedsolo.RSCodec(RS_M)` with explicit erasure positions for efficient decoding.
- Preserves original `chunk_id` when available for metadata consistency.
- Raises `ValueError` if fewer than 4 chunks available (irrecoverable data loss).

#### `distributor.py` (270 lines) — Shard Placement
- **`distribute_shards(file_id, chunks, dtn_enqueue)`**: Assigns all 6 chunks to satellite nodes.
- **Load balancing**: Picks node with fewest stored chunks (across allowed planes).
- **Plane assignment logic**:
  - First assigns each data chunk to a random plane.
  - Parity chunks go to a DIFFERENT plane than their paired data chunk.
- For offline nodes: chunks are DTN-queued via `_enqueue_to_dtn()`.
- Contains stubs for future gRPC-based writes (`_write_chunk_grpc_stub`).

#### `reassembler.py` (339 lines) — File Reconstruction
- **`fetch_and_reassemble(...)`**: Main pipeline:
  1. Check ground LRU cache before hitting satellite disk
  2. Fetch each chunk from its assigned node
  3. For PARTITIONED nodes: attempt ISL relay via BFS path
  4. For harvest cache: check if chunk pre-fetched by Harvest Manager
  5. Verify SHA-256 on every chunk read
  6. If any data chunks missing → attempt RS decode from parity
  7. Concatenate, truncate to original file size, verify full-file hash
- Returns `{"data": bytes, "latency": {...}, "rs_recovery": bool}`
- Tracks per-phase latency (fetch, decode, assembly) via `LatencyTracker`.

#### `integrity.py` (101 lines) — SHA-256 Verification
- **Level 1 — `verify_write(chunk_path, expected_hash)`**: Read-after-write verification.
- **Level 2 — `verify_read(data, expected_hash)`**: Pre-return corruption check.
- **Level 3 — `verify_file(assembled_bytes, file_hash)`**: End-to-end file integrity.
- **`bit_flip_simulate(chunk_path)`**: Flips a random byte in a .bin file (simulates cosmic ray Single Event Upset).

### 3.3 Metadata Layer — `backend/metadata/`

#### `schemas.py` (102 lines) — Pydantic Data Models
- **`ChunkRecord`**: chunk_id, sequence_number, size, sha256_hash, node_id, is_parity, pad_size, zk_commitment
- **`FileRecord`**: file_id (UUID), filename, size, full_sha256, chunk_count, vector_clock, uploaded_at, chunks[]
- **`NodeRecord`**: node_id, plane, status, health_score (0-100), storage_used, chunk_count, orbit_timer, dtn_queue_depth
- **`EventRecord`**: event_id, timestamp, event_type, message, metadata
- **`StoreModel`**: files{}, nodes{}, events[]
- **`MetricsSnapshot`**: mttdl, storage_efficiency, entropy, integrity_pass_rate, cache_hit_rate, reconstruction_latency_ms

#### `manager.py` (366 lines) — Metadata Operations
- **Thread-safe**: All operations use `threading.Lock()` for concurrent access safety.
- **Atomic writes**: Uses `.tmp` file + `os.replace()` to prevent corruption.
- File operations: `register_file()`, `get_file()`, `get_all_files()`, `delete_file()`
- Node operations: `update_node_status()`, `update_node_storage()`, `update_orbit_timer()`, `update_dtn_queue_depth()`
- Chunk operations: `update_chunk_node()` (for rebalancer/migration)
- Event logging: `log_event()`, `get_recent_events()`
- Contains stubs for Kademlia DHT publishing (future scope).

#### `vector_clocks.py` (93 lines) — Conflict Resolution
- **`increment_clock(clock, node_id)`**: Increment event counter for a node.
- **`compare_clocks(clock1, clock2)`**: Returns 'LESS_THAN', 'GREATER_THAN', 'EQUAL', or 'CONCURRENT'.
- **`merge_clocks(clock1, clock2)`**: Element-wise maximum merge.
- **`resolve_split_brain(state_a, clock_a, state_b, clock_b)`**: Resolves concurrent/conflicting states (CONCURRENT → largest-size-wins tiebreaker).

### 3.4 Intelligence Layer — `backend/intelligence/`

#### `chaos.py` (333 lines) — Chaos Engineering (5 Scenarios)

| # | Scenario | Space Hazard | Action |
|---|----------|-------------|--------|
| 1 | **Solar Flare** 🌞 | Radiation burst | Kill entire Plane Beta (SAT-03 + SAT-04 → OFFLINE) |
| 2 | **Bit Rot** ☢️ | Cosmic ray SEU | Corrupt 2 random .bin files across different nodes |
| 3 | **Network Partition** 🌐 | Behind Earth | Mark SAT-03, SAT-04 as PARTITIONED (alive but unreachable) |
| 4 | **Node Overload** ⚡ | Write hotspot | Flood SAT-01 + SAT-02 with 20 dummy chunks |
| 5 | **Entropy Imbalance** 📉 | Uneven distribution | Dump 37 dummy chunks on 2 nodes, leave others empty |

- **`restore()`**: Brings all nodes back to ONLINE, clears corruption flags.
- All scenarios exposed via a FastAPI router (`/api/chaos/{scenario}`).

#### `dtn_queue.py` (230 lines) — Delay-Tolerant Networking
- Inspired by **NASA Bundle Protocol v7 (BPv7)** used on PACE mission (2024).
- When satellite is OFFLINE → chunks queued as JSON bundles with base64 data + SHA-256 checksums.
- **Bundle format**: `{bundle_id, timestamp, chunk_id, data_b64, sha256, priority, destination, ttl}`
- Priority: parity chunks first (they're more valuable for recovery).
- **Background worker**: Polls every 5 seconds → flushes queue when node comes ONLINE.
- Queue files stored at `backend/dtn_queue/{node_id}.json`.

#### `harvest_manager.py` (143 lines) — Opportunistic Shard Collection
- Solves the **Partial Availability Problem**: Not all nodes are online at once.
- **HarvestMission**: Tracks which shards have been collected for a file.
- Background worker polls every 5 seconds → copies shard .bin files to local `harvest_cache/` when source node comes ONLINE.
- WebSocket broadcasts progress (`HARVEST_PROGRESS` events).
- Persistent mission state saved to `harvest_cache/missions.json`.

#### `isl_manager.py` (129 lines) — Inter-Satellite Link Relay
- **`find_relay_path(target_node, get_node_status)`**: BFS pathfinding from any ONLINE node to a PARTITIONED target.
- ISL only works for PARTITIONED nodes (alive but no ground LOS). OFFLINE = dead = no relay.
- **`isl_fetch(target_node, chunk_id, relay_path)`**: READ-ONLY data access via relay. No files moved.
- **`isl_fetch_async(...)`**: Adds simulated hop latency (50ms per hop).
- **`get_isl_topology(get_node_status)`**: Returns current link state for frontend visualization.

#### `predictor.py` (228 lines) — Proactive LOS Migration
- Monitors all 6 satellite orbit timers.
- When any node drops below `LOS_THRESHOLD` (30 seconds remaining):
  1. Find top 3 most-accessed chunks on that node (access frequency tracking).
  2. Find "healthiest" node (most orbit time remaining + ONLINE).
  3. Migrate hot chunks: copy .bin file + update metadata.
- Respects topology: won't migrate to a plane where paired chunk already lives.
- **`record_chunk_access(chunk_id)`**: Called by reassembler on every fetch.

#### `raft_consensus.py` (181 lines) — Leader Election + WAL
- **Raft Clusters**: 3 clusters, one per orbital plane (Alpha, Beta, Gamma).
- Each cluster has 2 nodes (RaftNode objects with role, term, WAL).
- **Leader Election**: FOLLOWER → CANDIDATE → request votes → LEADER if quorum reached.
- **Write-Ahead Log**: Only LEADER can accept destructive writes (e.g., DELETE).
  - Requires quorum acknowledgment before committing.
  - Entry format: `{term, intent, file_id, timestamp}`.
- **Raft Daemon**: Background task that runs leader elections every 1 second.
- Handles 2-node cluster edge case: degraded 1-node quorums allowed.

#### `rebalancer.py` (234 lines) — Shannon Entropy-Based Redistribution
- **`compute_entropy()`**: H = -Σ(p_i × log₂(p_i)) / log₂(N), normalized to [0.0, 1.0].
- **`check_and_rebalance()`**:
  1. If entropy ≥ 0.85 → no action needed.
  2. Find overloaded nodes (above avg chunks) and underloaded nodes (below avg).
  3. Move one chunk at a time from hot → cold node.
  4. Respect topology: data/parity never on same plane.
  5. Recalculate entropy after each move.
  6. Stop when entropy > 0.90 or no more valid moves.
- Returns detailed result with actions taken, before/after entropy.

#### `trajectory.py` (115 lines) — Orbit Timer System
- Each satellite has a 120-second countdown timer.
- **Timer progression**:
  - At 30s: broadcast `ORBIT_WARNING` via WebSocket.
  - At 10s: broadcast `ORBIT_CRITICAL`.
  - At 0s: node goes `DEGRADED` for 3 seconds → then resets to `ONLINE` with 120s timer.
- Syncs to `store.json` metadata every 10 seconds or when timer < 30s.
- Background task ticks all 6 nodes concurrently every 1 second.

#### `zkp_audit.py` (70 lines) — Zero-Knowledge Proof of Retrievability
- **Phase 5.1 — `generate_commitment(chunk_data)`**: Double-SHA256 hash (simulates Merkle/Polynomial Commitment). Created during upload, stored in metadata.
- **Phase 5.2 — `prove(chunk_data, challenge_nonce)`**: Satellite proves possession by hashing `data || nonce`. Returns `(proof_hash, computation_time_ms)`.
- **Phase 5.3 — `verify(commitment, proof, expected)`**: Ground station verification. O(1) proof size (64 bytes vs 512KB chunk).
- Emulates zk-SNARK/STARK properties without a full proving system.

### 3.5 Metrics & Observability — `backend/metrics/`

#### `calculator.py` (328 lines) — 6 Live Metrics

| # | Metric | Formula | Description |
|---|--------|---------|-------------|
| 1 | **MTTDL** | (1/C(n,m+1)) × (1/λ^(m+1)) × μ^m | Mean Time to Data Loss in hours |
| 2 | **Storage Efficiency** | total/data chunks ratio | RS(4,2)=1.5x vs Replication 3.0x |
| 3 | **Shannon Entropy** | -Σ(p_i × log₂(p_i)) / log₂(N) | Distribution balance [0.0-1.0] |
| 4 | **Reconstruction Latency** | Phase breakdown (ms) | Fetch + Decode + Assembly waterfall |
| 5 | **Integrity Pass Rate** | passes/attempts × 100% | SHA-256 verification success rate |
| 6 | **Cache Hit Rate** | hits/total × 100% | Ground LRU cache effectiveness |

- `LatencyTracker` class: tracks per-phase timing (fetch, decode, assembly).
- `IntegrityCounter` class: thread-safe pass/fail tracking across all 3 integrity levels.

#### `survivability.py` (194 lines) — Monte Carlo Simulation
- **`OrbitalReliabilitySimulator`**: Runs 10,000 simulated 24-hour missions.
- Failure models: node failure, plane blackout, solar flare, chunk corruption.
- Compares RS(4,2) survival probability against 3x replication baseline.
- Returns: survival probability, failure breakdown, risk reduction factor, worst-case chunks lost.

#### `tracker.py` (200 lines) — Running State Tracker
- **Singleton `MetricsTracker`**: Accumulates events across uploads, downloads, chaos events.
- Thread-safe counters for: integrity checks, cache events, reconstruction latency, uploads, downloads, chaos events, migrations, DTN deliveries.
- `snapshot()` method returns full metrics state for WebSocket broadcast.

### 3.6 Utilities — `backend/utils/`

#### `node_manager.py` (~ 60 lines)
- In-memory node status tracking: `get_node_status()`, `set_online()`, `set_offline()`, `get_all_statuses()`, `restore_all_nodes()`.

#### `ws_manager.py` (~ 65 lines)
- WebSocket connection manager: `connect()`, `disconnect()`, `broadcast(event_type, data)`.
- Broadcasts JSON events to all connected frontend clients.

#### `logger.py` (~ 100 lines)
- Structured logging utility for all backend components.

### 3.7 Caching — `backend/cache/`
- **`ground_cache.py`**: LRU ground station cache (max 10 chunks). Checked before fetching from satellite nodes during download.

---

## 4. API REFERENCE — REST ENDPOINTS

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Upload file → chunk → encode → distribute |
| `GET` | `/api/download/{file_id}` | Reconstruct and download file |
| `GET` | `/api/download/{file_id}/{filename}` | Download with filename in URL |
| `DELETE` | `/api/delete/{file_id}` | Delete file (requires Raft quorum) |
| `GET` | `/api/files` | List all uploaded files |
| `GET` | `/api/nodes` | List all node statuses |
| `GET` | `/api/fs/state` | Full filesystem state for frontend |
| `GET` | `/api/metrics` | Live metrics snapshot |
| `POST` | `/api/node/{node_id}/toggle` | Toggle node ONLINE/OFFLINE |
| `POST` | `/api/restore` | Restore all nodes after chaos |
| `POST` | `/api/harvest/start/{file_id}` | Start harvest mission |
| `GET` | `/api/harvest/status/{file_id}` | Get harvest mission status |
| `GET` | `/api/isl/topology` | ISL link states |
| `GET` | `/api/tle` | CelesTrak TLE data proxy |
| `GET` | `/api/dtn/events` | DTN event history |
| `POST` | `/api/chaos/solar_flare` | Trigger solar flare scenario |
| `POST` | `/api/chaos/bit_rot` | Trigger bit rot scenario |
| `POST` | `/api/chaos/partition` | Trigger network partition |
| `POST` | `/api/chaos/overload` | Trigger node overload |
| `POST` | `/api/chaos/imbalance` | Trigger entropy imbalance |
| `WS` | `/ws` | WebSocket for real-time events |
| `GET` | `/api/survivability/run` | Monte Carlo survivability simulation |

### WebSocket Events

| Event Type | Trigger |
|------------|---------|
| `UPLOAD_START` | File upload initiated |
| `CHUNKING_COMPLETE` | File split into chunks |
| `ENCODING_COMPLETE` | RS encoding done |
| `CHUNK_UPLOADED` | Individual chunk placed on node |
| `DTN_QUEUED` | Chunk queued for offline node |
| `UPLOAD_COMPLETE` | Full file distributed |
| `DOWNLOAD_START` | File reconstruction started |
| `DOWNLOAD_COMPLETE` | File assembled and verified |
| `DOWNLOAD_FAILED` | Reconstruction failed |
| `FILE_DELETED` | File erased from mesh |
| `ORBIT_WARNING` | Node approaching LOS (30s) |
| `ORBIT_CRITICAL` | Node LOS imminent (10s) |
| `NODE_DEGRADED` | Node completing orbital cycle |
| `ORBIT_RESET` | Node back online after cycle |
| `NODE_ONLINE` | Node toggled online |
| `NODE_OFFLINE` | Node toggled offline |
| `METRIC_UPDATE` | Metrics refresh |
| `HARVEST_PROGRESS` | Shard harvested for mission |

---

## 5. FRONTEND ARCHITECTURE — 36 REACT COMPONENTS

### Component Directory Structure

```
frontend/src/
├── App.jsx              — Main dashboard layout (tab-based navigation)
├── main.jsx             — React entry point
├── index.css            — Global styles
├── App.css              — App-specific styles
├── hooks/
│   └── useWebSocket.js  — WebSocket connection hook
├── services/
│   └── api.js           — REST API client
├── utils/               — 6 utility files
└── components/
    ├── chaos/           — ChaosOps, ChaosPanel, ScenarioCard
    ├── controls/        — FileList, FileUpload, NodeControls
    ├── demo/            — DataTransferDemo
    ├── layout/          — CinematicBoot, GlobalMetrics, HUDDock, RightSidebar, Sidebar, Topbar
    ├── matrix/          — ChunkMatrix, MatrixCell, MatrixDensity
    ├── metrics/         — EntropyGauge, GsUplinkStatus, IntegrityRate, MTTDLDisplay,
    │                      MetricsPanel, ResilienceChart, StorageGauge, SurvivabilityPanel
    ├── network/         — NetworkMap3D
    ├── orbital/         — DataPacket, OrbitalMap, OrbitalMap3D, SatelliteNode
    ├── p2p/             — OrbitalDrop
    ├── payload/         — PayloadOps
    ├── storage/         — StorageMap
    ├── terminal/        — MissionLog, MissionTerminal
    └── tracking/        — GlobeViewer, TelemetryPanel
```

### Key Component Groups

#### Layout Components
- **`HUDDock`**: Main navigation dock with tab switching
- **`GlobalMetrics`**: Top-level metrics bar showing live system health
- **`Sidebar`/`RightSidebar`**: Side panels for controls and details
- **`CinematicBoot`**: Animated intro/splash screen on app startup

#### Orbital Visualization
- **`OrbitalMap3D`**: Main 3D visualization using React Three Fiber. Shows satellites, orbital paths, inter-satellite links, data packets in transit.
- **`SatelliteNode`**: 3D satellite model with status indicators
- **`DataPacket`**: Animated data transfer visualization between nodes

#### Chaos Engineering UI
- **`ChaosPanel`**: Dashboard for triggering/viewing chaos scenarios
- **`ChaosOps`**: Chaos operation controls
- **`ScenarioCard`**: Individual chaos scenario display with trigger button

#### Metrics Dashboard
- **`MetricsPanel`**: Aggregated metrics view
- **`EntropyGauge`**: Shannon entropy visualization (0-1 scale)
- **`MTTDLDisplay`**: MTTDL in scientific notation
- **`StorageGauge`**: RS vs Replication storage comparison
- **`IntegrityRate`**: SHA-256 pass rate indicator
- **`SurvivabilityPanel`**: Monte Carlo simulation results
- **`ResilienceChart`**: System resilience over time

#### File Operations
- **`FileUpload`**: Drag-and-drop file upload component
- **`FileList`**: Uploaded files table with download/delete actions
- **`NodeControls`**: Toggle individual satellite nodes on/off

#### Mission Control
- **`MissionTerminal`**: Real-time event log (WebSocket events)
- **`MissionLog`**: Scrollable mission event history
- **`ChunkMatrix`**: Visual grid showing chunk placement across nodes
- **`StorageMap`**: Storage mesh visualization

---

## 6. ALGORITHMS & DATA STRUCTURES DEEP-DIVE

### 6.1 Reed-Solomon RS(4,2) Erasure Coding

**Concept**: Instead of storing 3 copies of each file (3x replication), RS encoding creates 2 mathematical parity chunks from 4 data chunks. Any 4 of the 6 total chunks can reconstruct the original data.

**Encoding Algorithm**:
1. Split file into 4 equal-length chunks (pad to equal length with 0x00).
2. For each byte position i across all 4 chunks:
   - Take byte_row = [chunk0[i], chunk1[i], chunk2[i], chunk3[i]]
   - Apply RS(4,2) encoding → produces 2 parity bytes
   - Append parity bytes to parity buffers
3. Result: 6 chunks total (4 data + 2 parity)

**Decoding Algorithm**:
1. Identify which chunks are missing (erasure positions).
2. For each byte position i:
   - Build byte_row with 0 for missing positions
   - Call `reedsolo.decode(byte_row, erase_pos=erasures)`
   - Extract reconstructed data bytes
3. Strip padding, return original 4 data chunks

**Storage Math**:
- RS(4,2): 6/4 = 1.5x overhead (50% extra storage)
- 3x Replication: 3.0x overhead (200% extra storage)
- RS saves: 1 - (1.5/3.0) = **50% less overhead**

### 6.2 Shannon Entropy for Distribution Balance

**Formula**: H = -Σ(p_i × log₂(p_i)) / log₂(N)

Where:
- p_i = fraction of total chunks on node i
- N = number of nodes (6)

**Interpretation**:
- H = 1.0 → perfectly uniform distribution
- H = 0.0 → all chunks on one node (catastrophic)
- H ≥ 0.85 → acceptable, no rebalancing needed
- H < 0.85 → triggers automatic rebalancing

### 6.3 MTTDL (Mean Time to Data Loss)

**Formula**: MTTDL = (1 / C(n, m+1)) × (1 / λ^(m+1)) × μ^m

Where:
- n = total nodes (6)
- m = parity count (2), system tolerates m simultaneous failures
- λ = node failure rate per hour (default: 2.28e-6, from 2% annual rate)
- μ = recovery time (default: 1.0 hours)
- C(n, m+1) = combinations (n choose m+1)

Result: ~1.2 × 10^14 hours (billions of years) for RS(4,2) with 6 nodes.

### 6.4 BFS Relay Pathfinding (ISL)

Used by `isl_manager.py` to find relay paths through the satellite mesh:
1. From every ONLINE node, run BFS through the ISL adjacency graph.
2. Only traverse through ONLINE or DEGRADED nodes.
3. Target must be PARTITIONED (alive but no ground LOS).
4. Return relay path as [start, ..., target] or None.
5. Each hop adds 50ms simulated latency.

### 6.5 Raft Leader Election

Simplified Raft consensus for 2-node clusters:
1. Node transitions: FOLLOWER → CANDIDATE → LEADER
2. Candidate increments term, votes for self, requests votes from peers.
3. Peers vote YES if their term is lower.
4. Quorum = N/2 + 1 (special case: 1-node quorum for 2-node cluster when peer is dead).
5. Leader accepts WAL entries; followers replicate.

### 6.6 Vector Clock Conflict Resolution

For split-brain scenarios when orbital planes are partitioned:
1. Each file has a vector clock `{node_id: event_count}`.
2. Compare clocks: LESS_THAN, GREATER_THAN, EQUAL, or CONCURRENT.
3. CONCURRENT = independent edits on different partitions → conflict!
4. Resolution: merge clocks (element-wise max) + larger-size-wins tiebreaker.

---

## 7. PROBLEM STATEMENT 5 — REQUIREMENTS MAPPING

### Minimum Requirements

| Requirement | Implementation |
|-------------|----------------|
| **File Chunking** | `chunker.py`: 512KB fixed chunks, UUID + SHA-256, async streaming |
| **Distribution across nodes** | `distributor.py`: Topology-aware RS(4,2) placement across 3 orbital planes |
| **Metadata Tracking** | `metadata/manager.py` + `store.json`: Pydantic models, thread-safe, atomic writes |
| **File Reconstruction** | `reassembler.py`: Multi-stage fetch with cache, ISL relay, RS recovery |
| **Node Failure Simulation** | `chaos.py`: 5 chaos scenarios + `trajectory.py` orbit timer degradation |
| **Integrity Checks** | `integrity.py`: 3-level SHA-256 verification (write, read, file) |

### Optional Enhancements Implemented

| Enhancement | Implementation |
|-------------|----------------|
| **Reed-Solomon Error Correction** | RS(4,2) encoding/decoding with Rust acceleration fallback |
| **Visual Dashboard** | 36 React components with 3D orbital visualization (Three.js) |
| **Rebalancing** | Shannon entropy-based auto-redistribution when H < 0.85 |
| **Caching** | LRU ground station cache + Harvest Manager (opportunistic pre-fetch) |
| **Consensus** | Raft leader election + Write-Ahead Log for destructive operations |
| **DTN Store-and-Forward** | NASA BPv7-inspired queuing for offline nodes |
| **ISL Relay Routing** | BFS pathfinding through satellite mesh for partitioned nodes |
| **ZKP Audit** | Zero-knowledge Proof of Retrievability (simulated zk-SNARK) |
| **Predictive Migration** | Proactive data movement before LOS events |
| **Monte Carlo Simulation** | 10K-run survivability analysis comparing RS vs replication |
| **Vector Clocks** | Mathematical conflict resolution for split-brain partitions |
| **Metrics Dashboard** | 6 live metrics: MTTDL, storage efficiency, entropy, latency, integrity, cache |

---

## 8. DOCKER CONFIGURATION

### `docker-compose.yml` Structure
- **Backend service**: Python FastAPI on port 8000/9000
- **Frontend service**: React Vite dev server on port 5173
- Shared volume for node storage directories

### Manual Setup
```bash
# Backend
cd cosmeon-fs-lite
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 9000

# Frontend
cd frontend
npm install
npm run dev
```

---

## 9. BACKGROUND TASKS (Startup)

On FastAPI startup (`lifespan`), 5 background asyncio tasks launch:

1. **Orbit Timers** — `start_all_timers()`: Ticks 6 node countdowns every 1 second
2. **Predictive Migrator** — `start_predictor()`: Watches for LOS events, migrates data
3. **DTN Worker** — `start_dtn_worker()`: Flushes queued bundles when nodes come online
4. **Raft Daemon** — `raft_daemon()`: Ensures every plane has a leader
5. **Harvest Worker** — `harvest_manager.run_worker()`: Collects shards from online nodes

---

## 10. FUTURE SCOPE — FS-PRO TRANSITION

The codebase contains multiple stubs and comments indicating the planned FS-PRO evolution:

- **Kademlia DHT**: Replace centralized `store.json` with P2P distributed hash table
- **Libp2p Gossip**: Automatic state synchronization between nodes
- **gRPC Bidirectional Streams**: Replace filesystem writes with proper satellite communication
- **Containerized Nodes**: Each satellite runs as an isolated Docker container
- **Hardware RS Acceleration**: Native Rust PyO3 engine for >10x encoding speedup
- **Full ZKP Proving System**: Replace simulation with actual zk-SNARK/STARK circuits
- **Quantum-Ready Hashing**: SHA3-256 support via environment variable switch

---

## 11. KEY FILE PATHS

| Path | Purpose |
|------|---------|
| `backend/main.py` | FastAPI entry point (608 lines) |
| `backend/config.py` | System constants (84 lines) |
| `backend/core/chunker.py` | File splitting (94 lines) |
| `backend/core/encoder.py` | RS encoding (84 lines) |
| `backend/core/decoder.py` | RS decoding (87 lines) |
| `backend/core/distributor.py` | Shard placement (270 lines) |
| `backend/core/reassembler.py` | File reconstruction (339 lines) |
| `backend/core/integrity.py` | SHA-256 verification (101 lines) |
| `backend/intelligence/chaos.py` | 5 chaos scenarios (333 lines) |
| `backend/intelligence/dtn_queue.py` | DTN store-and-forward (230 lines) |
| `backend/intelligence/harvest_manager.py` | Shard harvesting (143 lines) |
| `backend/intelligence/isl_manager.py` | ISL relay routing (129 lines) |
| `backend/intelligence/predictor.py` | Proactive migration (228 lines) |
| `backend/intelligence/raft_consensus.py` | Raft + WAL (181 lines) |
| `backend/intelligence/rebalancer.py` | Entropy redistribution (234 lines) |
| `backend/intelligence/trajectory.py` | Orbit timers (115 lines) |
| `backend/intelligence/zkp_audit.py` | ZKP auditing (70 lines) |
| `backend/metadata/manager.py` | Metadata ops (366 lines) |
| `backend/metadata/schemas.py` | Data models (102 lines) |
| `backend/metadata/vector_clocks.py` | Conflict resolution (93 lines) |
| `backend/metrics/calculator.py` | 6 metrics (328 lines) |
| `backend/metrics/survivability.py` | Monte Carlo sim (194 lines) |
| `backend/metrics/tracker.py` | Running state tracker (200 lines) |
| `frontend/src/App.jsx` | Dashboard (225 lines) |
| `frontend/src/components/` | 36 React components (13 directories) |

---

## 12. GLOSSARY

| Term | Definition |
|------|-----------|
| **RS(4,2)** | Reed-Solomon encoding with 4 data chunks and 2 parity chunks |
| **LEO** | Low Earth Orbit (~400-2000 km altitude) |
| **LOS** | Line of Sight — direct communication path between ground station and satellite |
| **DTN** | Delay-Tolerant Networking — store-and-forward communication for disrupted links |
| **BPv7** | Bundle Protocol version 7 — NASA's DTN standard |
| **ISL** | Inter-Satellite Link — laser/RF link between satellites for mesh routing |
| **MTTDL** | Mean Time to Data Loss — expected hours before irrecoverable data loss |
| **Shannon Entropy** | Information theory measure of distribution uniformity |
| **Raft** | Consensus algorithm for leader election and replicated state machines |
| **WAL** | Write-Ahead Log — log of intended mutations before execution |
| **Vector Clock** | Logical clock for determining event causality in distributed systems |
| **ZKP** | Zero-Knowledge Proof — cryptographic proof of data possession without revealing data |
| **PoR** | Proof of Retrievability — ZKP variant for proving data storage |
| **zk-SNARK** | Zero-Knowledge Succinct Non-Interactive Argument of Knowledge |
| **SEU** | Single Event Upset — bit flip from cosmic radiation impact |
| **Kademlia** | P2P distributed hash table protocol (libp2p) |
| **DHT** | Distributed Hash Table |
| **Erasure Coding** | Encoding technique that generates redundancy for data reconstruction |
| **Parity Chunk** | Mathematically derived redundancy chunk from data chunks |
| **Ground Cache** | LRU cache at ground station for recently accessed chunks |
| **Harvest** | Opportunistic background collection of shards from intermittently available nodes |
| **Chaos Engineering** | Practice of intentionally injecting failures to test system resilience |
| **Split-Brain** | Network partition causing independent state evolution on disconnected segments |

---

*This document was generated by auditing every source file in the COSMEON FS-LITE codebase. Total: ~4,500 lines of Python backend code across 23+ files, 36 React frontend components, Docker infrastructure, and 7 test files.*
