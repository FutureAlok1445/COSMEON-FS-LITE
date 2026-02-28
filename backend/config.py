# backend/config.py
# Person 2 owns this file
# All system-wide constants + orbital plane definitions

import os
from pathlib import Path

# ─────────────────────────────────────────────
# Reed-Solomon Parameters
# ─────────────────────────────────────────────
CHUNK_SIZE  = 512 * 1024   # 512KB per chunk
RS_K        = 4            # data chunks
RS_M        = 2            # parity chunks
RS_TOTAL    = RS_K + RS_M  # 6 total

# ─────────────────────────────────────────────
# Orbital Parameters
# ─────────────────────────────────────────────
ORBIT_PERIOD    = 120   # seconds — full orbit countdown
LOS_THRESHOLD   = 30    # seconds — trigger predictive migration
CACHE_SIZE      = 10    # LRU cache max chunks

# ─────────────────────────────────────────────
# Hash Algorithm (quantum-ready flag)
# ─────────────────────────────────────────────
HASH_ALGORITHM = os.getenv("HASH_ALGORITHM", "sha256")  # or "sha3_256"

# ─────────────────────────────────────────────
# Orbital Plane Assignments
# RULE: Data chunk + its Parity chunk NEVER on same plane
# ─────────────────────────────────────────────
ORBITAL_PLANES = {
    "Alpha": ["SAT-01", "SAT-02"],
    "Beta":  ["SAT-03", "SAT-04"],
    "Gamma": ["SAT-05", "SAT-06"],
}

# Reverse map: node → plane
NODE_TO_PLANE = {
    node: plane
    for plane, nodes in ORBITAL_PLANES.items()
    for node in nodes
}

ALL_NODES = ["SAT-01", "SAT-02", "SAT-03", "SAT-04", "SAT-05", "SAT-06"]

# ─────────────────────────────────────────────
# File System Paths
# ─────────────────────────────────────────────
BASE_DIR        = Path(__file__).parent
NODES_BASE_PATH = BASE_DIR / "nodes"
DTN_QUEUE_PATH  = BASE_DIR / "dtn_queue"
METADATA_PATH   = BASE_DIR / "metadata" / "store.json"


def init_node_folders():
    """
    Create all 6 satellite folders on startup if they don't exist.
    Called once from main.py on app startup.
    """
    for node_id in ALL_NODES:
        node_path = NODES_BASE_PATH / node_id
        node_path.mkdir(parents=True, exist_ok=True)

    DTN_QUEUE_PATH.mkdir(parents=True, exist_ok=True)
    METADATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"[CONFIG] [SUCCESS] Node folders initialized: {ALL_NODES}")