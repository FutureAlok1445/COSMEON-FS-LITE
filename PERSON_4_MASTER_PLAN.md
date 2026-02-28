# COSMEON FS-LITE: Person 4 (Integration & Analytics) — 4-Hour Master Execution Plan

As Person 4, you are the **Integration Engineer**. You are the final boss of the backend. You do not write the core math or the space intelligence rules. Your job is to take the isolated modules from Persons 1, 2, and 3, weld them together in `main.py`, calculate the live metrics, and broadcast every system event to the React frontend via WebSockets.

This 4-hour plan guarantees zero integration flaws. Stick strictly to the milestones.

---

## 🕒 HOUR 1: The WebSocket Nervous System
Before any HTTP routes exist, the system must be able to broadcast live telemetry.

### 1️⃣ Build `backend/utils/ws_manager.py` (0:00 - 0:30)
*   **The Mission:** The frontend cannot poll the backend. You must push events.
*   **Implementation:**
    *   Create a `WebSocketManager` class.
    *   Maintain a list of `active_connections: List[WebSocket]`.
    *   Methods: `connect()`, `disconnect()`, `broadcast(event_type: str, message: str, payload: dict)`.
*   **Zero-Flaw Protocol:** Wrap the `connection.send_json()` in a `try/except`. If a frontend client drops, silently catch the exception, disconnect them, and continue broadcasting to the remaining clients. A dropped browser must never crash the backend.

### 2️⃣ Scaffold `main.py` Foundation (0:30 - 1:00)
*   **The Mission:** Set up the FastAPI shell, CORS, and the WebSocket endpoint.
*   **Implementation:**
    *   Initialize `FastAPI(title="COSMEON FS-LITE")`.
    *   Add `CORSMiddleware` (allow all origins `["*"]` so the Vite React app at `:5173` connects without CORS blocks).
    *   Create the `@app.websocket("/ws")` route hooked to your `ws_manager`.
*   **Deliverable:** You can open a generic WebSocket testing tool (like Postman or a simple HTML file) and successfully connect to `ws://localhost:8000/ws`.

---

## 🕒 HOUR 2: Core Gateway Assembly (The Upload/Download Pipe)
You must now integrate Person 1 (Core Math) and Person 2 (Topology).

### 1️⃣ Assemble `/api/upload` (1:00 - 1:40)
*   **The Mission:** Connect the upload stream to the math engine and broadcast it.
*   **Implementation Flow:**
    1.  Receive `UploadFile`. Read raw bytes.
    2.  Call Person 1's `split_file()` and `encode_rs_shards()`.
    3.  Call Person 2's `distribute_shards()`.
    4.  Call Person 2's `save_file_record()`.
*   **The Person 4 Touch (Telemetry):**
    *   `await manager.broadcast("UPLOAD_START", ...)`
    *   `await manager.broadcast("UPLOAD_COMPLETE", ...)`
*   **Zero-Flaw Protocol:** Wrap the entire block in a generic `try/except Exception as e`. If Person 1's math throws an error, catch it, log it via WebSocket (`"ERROR"`), and raise a clean HTTP 500.

### 2️⃣ Assemble `/api/download` (1:40 - 2:00)
*   **The Mission:** Reverse the flow and handle catastrophic integrity losses cleanly.
*   **Implementation:**
    *   Fetch metadata. If missing, return HTTP 404.
    *   Call Person 1's `retrieve_file_shards()`.
    *   Verify the final reconstruction hash matches the metadata ledger.
*   **The Person 4 Touch (Telemetry):**
    *   `await manager.broadcast("DOWNLOAD_START", ...)`
    *   If hash fails: `await manager.broadcast("FILE_CORRUPT", ...)`

---

## 🕒 HOUR 3: The Caching & Scientific Metrics Layer
The Dashboard needs the 6 real-world distributed system metrics to impress the judges. 

### 1️⃣ Build `backend/cache/ground_cache.py` (2:00 - 2:30)
*   **The Mission:** Simulate a Ground Station LRU (Least Recently Used) cache to prevent hammering the simulated satellites on repeated file requests.
*   **Implementation:**
    *   Create a singleton `Dictionary` or `collections.OrderedDict`.
    *   Capacity: `max_len = 10` chunks.
    *   Methods: `get(chunk_id)`, `put(chunk_id, data)`.
    *   Track: `total_requests`, `cache_hits`.
*   **Integration:** Inject this into `/api/download`. Check the cache *before* calling Person 1's `retrieve_file_shards()`.

### 2️⃣ Build `backend/metrics/calculator.py` (2:30 - 3:00)
*   **The Mission:** Code the math formulas exactly as stated in the PDF (Pillar 7).
*   **Implementation:**
    *   **Storage Efficiency:** Return hardcoded `1.5x` (since RS(4,2) is statically 50% cheaper than 3x replication).
    *   **MTTDL:** Code the generic MTTDL formula. If `nodes_offline == 0`, output `10^14`. If `nodes_offline == 2`, output `10^6`.
    *   **Integrity Verification Rate:** Hook into `reassembler.py` attempts (total hashes vs failed hashes).
    *   **Cache Hit Rate:** `(cache_hits / total_requests) * 100`.

---

## 🕒 HOUR 4: Chaos Integration & Final Smoke Test
Person 3 just handed you the Chaos Engine and Adaptive Logic. Wire it up.

### 1️⃣ Mount person 3's APIRouters (3:00 - 3:30)
*   **The Mission:** Person 3 built `/api/chaos/solar_flare` in `chaos.py`. You must wire it into the main app.
*   **Implementation:**
    *   In `main.py`: `app.include_router(chaos_router)`
    *   **Background Tasks:** Mount Person 3's `dtn_flush_worker()` and `predictor_worker()`.
*   **Zero-Flaw Protocol:** FastApi `lifespan` context manager. You MUST start Person 3's `asyncio` loops during the app startup phase, and cleanly `task.cancel()` them on shutdown. If you just run them loosely, the API will freeze or ghost-threads will leak.

### 2️⃣ The "Everything Is On Fire" Integrity Test (3:30 - 4:00)
*   **The Mission:** Ensure the system doesn't crash when all APIs are hit simultaneously.
*   **Action Plan:**
    1.  Open terminal. Execute `POST /api/upload` with a 2MB file.
    2.  While uploading, instantly fire `POST /api/chaos/solar_flare`.
    3.  Assert: The WebSocket terminal shows the Solar Flare wiping out Plane Beta. The upload seamlessly diverts chunks into the DTN queues of the dead nodes.
    4.  Execute `GET /api/download`.
    5.  Assert: Person 1's decoder intercepts the request, mathematically rebuilds the missing chunks from Plane Gamma, hits your LRU cache, and updates the MTTDL metric calculation instantly.
*   **Final Output:** A 100% stable API endpoint ready for the React dashboard to consume without ever rendering an unhandled exception.
