import json
import threading
from datetime import datetime
from backend.config import METADATA_FILE, NODE_STATES

_lock = threading.Lock()

def _load_db():
    with open(METADATA_FILE, "r") as f:
        return json.load(f)

def _save_db(data):
    with open(METADATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

def register_file(file_id: str, record: dict):
    """
    Saves a file's metadata record thread-safely. (new file entry)
    """
    with _lock:
        data = _load_db()
        data.setdefault("files", {})
        data["files"][file_id] = record
        _save_db(data)

# Alias for backwards compatibility if needed
save_file_record = register_file

def add_chunk_record(file_id: str, chunk_id: str, node: str, plane: str, status: str):
    """chunk kaha gaya - Record individual chunk placement."""
    with _lock:
        data = _load_db()
        file_record = data.get("files", {}).get(file_id, {"chunks": {}})
        file_record.setdefault("chunks", {})
        file_record["chunks"][str(chunk_id)] = {
            "node": node,
            "plane": plane,
            "status": status
        }
        
        data.setdefault("files", {})
        data["files"][file_id] = file_record
        _save_db(data)

def get_file_record(file_id: str):
    """Retrieves metadata for download reconstruction."""
    with _lock:
        data = _load_db()
        return data.get("files", {}).get(file_id)

def log_event(event_type: str, details: dict):
    """Manage Event logging."""
    with _lock:
        data = _load_db()
        data.setdefault("events", [])
        data["events"].append({
            "timestamp": datetime.utcnow().isoformat(),
            "type": event_type,
            "details": details
        })
        _save_db(data)

def update_node_status(node: str, status: str):
    """Update node status in db and memory state dictionary."""
    with _lock:
        data = _load_db()
        if node in data.get("nodes", {}):
            data["nodes"][node]["status"] = status
            NODE_STATES[node] = status
            _save_db(data)
        elif node in NODE_STATES:
            # Fallback if config is weird
            NODE_STATES[node] = status

def move_chunk(file_id: str, sequence: str, new_node: str, new_plane: str):
    """agar chunk shift hua - Handle dynamic updates (e.g., when a rebalancer moves a chunk)."""
    with _lock:
        data = _load_db()
        file_record = data.get("files", {}).get(file_id)
        if file_record and "chunks" in file_record:
            if str(sequence) in file_record["chunks"]:
                file_record["chunks"][str(sequence)]["node"] = new_node
                file_record["chunks"][str(sequence)]["plane"] = new_plane
        _save_db(data)

# Alias for backwards compatibility
update_chunk_location = move_chunk
