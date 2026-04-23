# 🛰️ COSMEON FS-LITE

**COSMEON FS-LITE** is a distributed, fault-tolerant Orbital File System designed for simulated satellite constellations. It leverages Reed-Solomon erasure coding, Delay-Tolerant Networking (DTN), and Raft consensus to guarantee high availability and data survivability in chaotic environments such as Low Earth Orbit (LEO).

## ✨ Features

- **Erasure-Coded Storage**: Implements Reed-Solomon (RS) encoding to fragment files across the orbital mesh dynamically, ensuring survivability despite localized node failures.
- **Orbital Mesh Simulation**: 3 distinct orbital planes (Alpha, Beta, Gamma) with multi-node replication and topology-aware data placement.
- **Raft Consensus & Distributed Ledger**: Ensures strict consistency during destructive operations and metadata updates across planes.
- **DTN (Delay-Tolerant Networking) Queueing**: Caches transmission operations safely until a node regains connection line-of-sight.
- **ZKP Auditing & Integrity Checks**: Verifies data integrity at rest using cryptographic tethers and zero-knowledge commitments.
- **Predictive Caching & Data Hydration**: Intelligence layer that anticipates cold data requirements and pre-warms the cache for minimum latency.
- **Rich 3D Visualization**: Real-time React Three Fiber dashboard mapping satellites, file segments, and real-time metrics.

## 🛠️ Tech Stack

- **Backend**: Python 3.11, FastAPI, Uvicorn (Async I/O Processing)
- **Frontend**: React 19, Vite, Tailwind CSS, GSAP, React Three Fiber (3D mapping)
- **Infrastructure**: Docker & Docker Compose

## 🚀 Getting Started

You can run the project either using **Docker** (recommended for full simulation) or **Manually** (running backend and frontend separately).

### Option 1: Manual Setup (Local Development)

If you prefer to run the servers manually or if Docker is not working properly, follow these steps:

#### 1. Backend (Ground Station App & Satellites Simulation)
Open a terminal and navigate to the `backend` folder:
```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate
# On Mac/Linux: source venv/bin/activate

pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```
This will start the backend API and the simulation loop at `http://localhost:8000`.

#### 2. Frontend (Dashboard & Visualization)
Open a separate terminal and navigate to the `frontend` folder:
```bash
cd frontend
npm install
npm run dev
```
This will start the React UI on `http://localhost:5173`.

### Option 2: Running the Full Simulation (Docker Compose)

The easiest way to boot the ground station and the 6 interconnected satellites is using Docker Compose.

1. Ensure **Docker Desktop** is running.
2. Build and launch the orbital mesh:

```bash
docker-compose up -d --build
```

3. Access the interfaces:
   - **Frontend UI & Visualizer**: [http://localhost:5173](http://localhost:5173)
   - **Ground Station API**: [http://localhost:8000](http://localhost:8000)

### Graceful Shutdown (Docker)

To spin down the constellation and stop all orbiters:

```bash
docker-compose down
```

## 📁 Project Structure

```text
├── backend/
│   ├── api/             # Specific API endpoints (survivability, metrics)
│   ├── core/            # File Chunks, Encoder, Distributor, Reassembler
│   ├── intelligence/    # Chaos router, DTN worker, Predictor, Raft, ZKP 
│   ├── metadata/        # Centralized metadata tracking
│   ├── metrics/         # Analytic calculators (MTTDL, Cache Efficiency)
│   ├── main.py          # FastAPI server entry point
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/             # React application (UI, 3D Map, WebSockets)
│   ├── public/          # Static assets
│   ├── package.json     
│   └── vite.config.js
└── docker-compose.yml   # Orbital mesh topology configuration
```

## 📜 License

This is a Hackathon project — **HACKX 4.0**
