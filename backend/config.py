# backend/config.py
# Person 2 will expand this — Person 1 only reads from here

CHUNK_SIZE = 512 * 1024       # 512KB per chunk
RS_K = 4                       # data chunks
RS_M = 2                       # parity chunks
RS_TOTAL = RS_K + RS_M         # 6 total chunks
ORBIT_PERIOD = 120             # seconds per orbit
LOS_THRESHOLD = 30             # seconds — trigger migration
CACHE_SIZE = 10                # LRU cache max chunks
HASH_ALGORITHM = "sha256"      # or "sha3_256" for quantum-ready

# Orbital plane assignments (Person 2 owns this mapping)
ORBITAL_PLANES = {
    "Alpha": ["SAT-01", "SAT-02"],
    "Beta":  ["SAT-03", "SAT-04"],
    "Gamma": ["SAT-05", "SAT-06"],
}

# Flat node list
ALL_NODES = ["SAT-01", "SAT-02", "SAT-03", "SAT-04", "SAT-05", "SAT-06"]

# Node folder base path
NODES_BASE_PATH = "backend/nodes"
DTN_QUEUE_PATH  = "backend/dtn_queue"
METADATA_PATH   = "backend/metadata/store.json"