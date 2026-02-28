import json
import threading
from backend.config import METADATA_FILE

_lock = threading.Lock()

def _load_db():
    with open(METADATA_FILE, "r") as f:
        return json.load(f)

def _save_db(data):
    with open(METADATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

def save_file_record(file_id: str, record: dict):
    """
    Saves a file's metadata record thread-safely.
    This fulfills the requirement of tracking chunks across nodes.
    """
    with _lock:
        data = _load_db()
        data.setdefault("files", {})
        data["files"][file_id] = record
        _save_db(data)

def get_file_record(file_id: str):
    """Retrieves metadata for download reconstruction."""
    with _lock:
        data = _load_db()
        return data.get("files", {}).get(file_id)
