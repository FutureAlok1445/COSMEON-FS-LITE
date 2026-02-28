import hashlib
import uuid

def compute_sha256(data: bytes) -> str:
    """Calculates SHA-256 hash for data integrity verification."""
    return hashlib.sha256(data).hexdigest()

def split_file(file_data: bytes, chunk_size: int):
    """
    Splits raw file bytes into discrete chunks, hashing each piece.
    This fulfills the Problem Statement minimum requirement for chunking.
    """
    chunks = []
    for i in range(0, len(file_data), chunk_size):
        chunk_bytes = file_data[i:i + chunk_size]
        chunks.append({
            "chunk_id": str(uuid.uuid4()),
            "sequence": len(chunks),
            "data": chunk_bytes,
            "size": len(chunk_bytes),
            "hash": compute_sha256(chunk_bytes)
        })
    return chunks
