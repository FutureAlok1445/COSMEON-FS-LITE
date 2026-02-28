# 🧭 COSMEON BACKEND — 4 PEOPLE (DETAILED TECHNICAL OWNERSHIP)

To ensure smooth parallel development of the FastAPI backend for the 24-hour hackathon, the 6-layer architecture has been strictly divided into 4 clear roles. Each person owns specific Python files and logic domains.

---

## 🔵 PERSON 1 — ERASURE CODING & DATA PIPELINE ENGINE (The Math Layer)
**Owns the complete mathematical data transformation lifecycle.**
*File Domain:* `backend/core/` (excluding `distributor.py`)

**1️⃣ File Chunking Engine (`chunker.py`)**
*   **Responsibilities:**
    *   Accept binary file stream via FastAPI injection.
    *   Split into `CHUNK_SIZE` (512KB) fixed-size chunks.
    *   Generate for each chunk: `chunk_id` (UUID), `sequence_number`, `size`, `sha256_hash`.
    *   Compute `full_file_sha256` for end-to-end verification.
*   **Must Guarantee:** Deterministic chunk order, no chunk overlap, correct hashing.

**2️⃣ Reed-Solomon Encoding (`encoder.py`)**
*   **Responsibilities:**
    *   Accept chunks. Pad them to identical lengths.
    *   Use `reedsolo` to generate `RS_M` (2) parity chunks from `RS_K` (4) data chunks.
*   **Must Guarantee:** Loss of ANY 2 chunks is mathematically recoverable. Interleaved byte-array compatibility.

**3️⃣ Reed-Solomon Decoder (`decoder.py`)**
*   **Responsibilities:**
    *   Accept available chunks (≥4 of 6) + their positions.
    *   Calculate erasure positions and mathematically reconstruct missing data chunks.
*   **Edge Cases:** Throw explicit error if < 4 chunks exist.

**4️⃣ File Reassembler (`reassembler.py`)**
*   **Responsibilities:**
    *   Fetch shards in sequence order.
    *   If chunk missing or hash fails -> route through `decoder.py` to rebuild.
    *   Concatenate bytes and strip padding.
    *   Validate final full-file SHA-256 against metadata logic.

**5️⃣ Multi-Level Integrity Engine (`integrity.py`)**
*   **Responsibilities:**
    *   Write verification (hash after write attempt).
    *   Read verification (hash before returning read).

**🔒 Hard Boundary (Person 1 does NOT):**
*   Know about node status (ONLINE/OFFLINE).
*   Calculate Shannon Entropy.
*   Manage the DTN queue.
*   Send WebSocket events.

---

## 🟢 PERSON 2 — NODE SIMULATION & METADATA CORE (The Control Layer)
**Owns system state, OS mechanics, and data distribution rules.**
*File Domain:* `backend/metadata/`, `backend/core/distributor.py`, `backend/config.py`

**1️⃣ Node Environment Simulation (`config.py`)**
*   **Responsibilities:**
    *   Initialize the 6 physical OS folders (`SAT-01` → `SAT-06`) on startup.
    *   Map them into strictly enforced planes: Alpha (1–2), Beta (3–4), Gamma (5–6).
    *   Maintain memory state dictionary mapping nodes to constraints (`ONLINE`, `OFFLINE`).

**2️⃣ Metadata Manager (`metadata/manager.py`)**
*   **Responsibilities:**
    *   Maintain `store.json` using Python `threading.Lock()` to prevent race conditions during rapid concurrent uploads.
    *   Manage File Registry, Node-to-Chunk mapping, and Event logging.
    *   Handle dynamic updates (e.g., when a rebalancer moves a chunk, update `store.json`).

**3️⃣ Topology-Aware Distributor (`distributor.py`)**
*   **Responsibilities:**
    *   Receive the 6 mathematical chunks from Person 1.
    *   **Enforce Hard Rule:** Data chunks and Parity chunks *NEVER* land on the same Orbital Plane.
    *   Check if target node is ONLINE -> Write to `.bin`.
    *   If target node is OFFLINE -> Route chunk to Person 3's DTN Queue.

**🔒 Hard Boundary (Person 2 does NOT):**
*   Perform Reed-Solomon math matrices.
*   Trigger Chaos Engine functions.
*   Calculate MTTDL formulas.

---

## 🟣 PERSON 3 — INTELLIGENCE & SELF-HEALING ENGINE (The Adaptive Layer)
**Owns adaptive logic, routing, and resilience behavior.**
*File Domain:* `backend/intelligence/`

**1️⃣ Orbit Timer System (`trajectory.py`)**
*   **Responsibilities:** 120-second countdown loop per node.
*   Reset on orbit completion. Emit WebSocket warning at <30s.

**2️⃣ Predictive Migration (`predictor.py`)**
*   **Responsibilities:**
    *   Detect if a node's Line-Of-Sight is closing (`< 30s`).
    *   Identify most-requested chunks on that specific satellite.
    *   Auto-migrate those `.bin` files to the "healthiest" node (highest remaining orbit timer) before blackout occurs.

**3️⃣ Shannon Entropy Rebalancer (`rebalancer.py`)**
*   **Formula:** `H = -Σ(p_i log₂ p_i)`
*   **Responsibilities:**
    *   Compute entropy based on chunk distribution across the 6 nodes.
    *   Detect imbalance (`H < 0.85`).
    *   Identify overloaded (hot) and underloaded (cold) nodes, migrating chunks systematically until `H > 0.90`.

**4️⃣ DTN Store-and-Forward (`dtn_queue.py`)**
*   **Responsibilities:**
    *   Maintain `/dtn_queue/{node}.json` buffer payloads.
    *   Background `asyncio` worker that polls every 5 seconds.
    *   Flush queues to binary drives specifically when node state returns to `ONLINE`.

**5️⃣ Chaos Engine (`chaos.py`)**
*   **Responsibilities:**
    *   Implement APIs for: Solar Flare (kill Beta plane), Bit Rot (XOR 1 byte payload corruption), Node Overload (rapid dummy chunk generation).

**🔒 Hard Boundary (Person 3 does NOT):**
*   Encode/decode core data files.
*   Process raw FastAPI HTTP upload streams.
*   Calculate overall system storage efficiency.

---

## 🟠 PERSON 4 — METRICS, CACHING & INTEGRATION (The Analytics Layer)
**Owns measurable proof, performance caching, and API/UI unification.**
*File Domain:* `backend/metrics/`, `backend/cache/`, `backend/utils/ws_manager.py`, `backend/main.py`

**1️⃣ Live Accuracy Metrics (`calculator.py`)**
*   **Responsibilities:**
    *   **MTTDL Calculator:** Compute the 10^14 hours fault-tolerance metric based on RS(4,2) vs Replication.
    *   **Storage Efficiency Metric:** Calculate real-time savings (1.5x vs 3.0x).
    *   **Integrity Pass Rate:** `(successful checks / total checks) * 100`.
    *   **Composite Orbital Health Score:** 0-100 rating based on storage, integrity, timer, and DTN depth.

**2️⃣ Ground Station LRU Cache (`ground_cache.py`)**
*   **Responsibilities:**
    *   Memory buffer simulating a ground station.
    *   Store last 10 downloaded chunks. Bypass satellite network (I/O) if chunk is in cache.
    *   Maintain and export Cache Hit Rate.

**3️⃣ WebSocket Broadcaster (`ws_manager.py`)**
*   **Responsibilities:**
    *   Maintain live connection pool with the React dashboard.
    *   Create standardized JSON event envelopes for all other backend engineers to broadcast their actions (e.g., `await manager.broadcast("ERROR", "Node dead")`).

**4️⃣ API Gateway Integration (`main.py`)**
*   **Responsibilities:**
    *   Assemble Person 1, 2, and 3's modules into the main FastAPI endpoints (`/api/upload`, `/api/download`, `/api/chaos`).
    *   Handle CORS middleware, background task lifespans, and HTTP Exception standardizing.

**🔒 Hard Boundary (Person 4 does NOT):**
*   Move `.bin` chunks between OS folders.
*   Calculate Shannon entropy algorithms.
*   Enforce cross-plane topology logic.

---

## 🧩 FINAL CLEAN OWNERSHIP SUMMARY

| Layer | Owner | Nature | Key Files |
| :--- | :---: | :--- | :--- |
| **Data Encoding** | **P1** | Mathematical | `chunker.py`, `encoder.py`, `decoder.py` |
| **System State** | **P2** | Structural | `manager.py`, `distributor.py`, `config.py` |
| **Intelligence** | **P3** | Adaptive | `rebalancer.py`, `dtn_queue.py`, `chaos.py` |
| **Metrics & Edge**| **P4** | Analytical/Gate | `main.py`, `calculator.py`, `ws_manager.py` |

### ⚠️ Risk Level Breakdown
| Person | Difficulty | Why It Matters |
| :--- | :--- | :--- |
| **P1** | 🔴 Highest | If Reed-Solomon polynomial math throws matrix errors, the entire file system corrupts permanently. |
| **P3** | 🔴 High | Asynchronous tasks colliding with synchronous metadata operations can cause total system deadlocks. |
| **P2** | 🟡 Medium | `store.json` thread-locking is critical. If 2 files upload simultaneously, a race condition destroys the registry. |
| **P4** | 🟡 Medium | High visibility. If WebSockets drop out, the judging panel sees a frozen dashboard even if the backend is perfect. |
