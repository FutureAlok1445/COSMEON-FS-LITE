import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
NODES_DIR = BASE_DIR / "nodes"
METADATA_DIR = BASE_DIR / "metadata"
METADATA_FILE = METADATA_DIR / "store.json"

CHUNK_SIZE = 512000  # 512KB
RS_K = 4
RS_M = 2

ORBITAL_PLANES = {
    "Alpha": ["SAT-01", "SAT-02"],
    "Beta":  ["SAT-03", "SAT-04"],
    "Gamma": ["SAT-05", "SAT-06"]
}

def init_fs():
    """Initializes the OS-level storage layer."""
    for plane, nodes in ORBITAL_PLANES.items():
        for node in nodes:
            (NODES_DIR / node).mkdir(parents=True, exist_ok=True)
            # DTN Queue storage per node
            (NODES_DIR / node / "dtn_queue").mkdir(parents=True, exist_ok=True)

    METADATA_DIR.mkdir(parents=True, exist_ok=True)
    if not METADATA_FILE.exists():
        import json
        with open(METADATA_FILE, "w") as f:
            json.dump({
                "files": {}, 
                "nodes": {n: {"status": "ONLINE", "plane": p} for p, ns in ORBITAL_PLANES.items() for n in ns}, 
                "events": []
            }, f)

init_fs()
