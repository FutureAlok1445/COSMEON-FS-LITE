# backend/metadata/schemas.py
# Person 2 owns this file
# All Pydantic data models used across the entire backend

from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
import uuid


# ─────────────────────────────────────────────
# Chunk Model
# ─────────────────────────────────────────────
class ChunkRecord(BaseModel):
    chunk_id:        str
    sequence_number: int
    size:            int
    sha256_hash:     str
    node_id:         str   # which satellite holds this chunk
    is_parity:       bool  = False
    pad_size:        int   = 0  # original padding size (for decoder)


# ─────────────────────────────────────────────
# File Model
# ─────────────────────────────────────────────
class FileRecord(BaseModel):
    file_id:         str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename:        str
    size:            int
    full_sha256:     str
    chunk_count:     int
    uploaded_at:     str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    chunks:          List[ChunkRecord] = []


# ─────────────────────────────────────────────
# Node Model
# ─────────────────────────────────────────────
class NodeRecord(BaseModel):
    node_id:         str
    plane:           str                   # Alpha / Beta / Gamma
    status:          str = "ONLINE"        # ONLINE | OFFLINE | DEGRADED | PARTITIONED
    health_score:    int = 100             # 0-100 composite score
    storage_used:    int = 0              # bytes stored
    chunk_count:     int = 0
    orbit_timer:     int = 120            # seconds remaining
    dtn_queue_depth: int = 0              # pending bundles


# ─────────────────────────────────────────────
# Event Log Model
# ─────────────────────────────────────────────
class EventRecord(BaseModel):
    event_id:    str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp:   str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    event_type:  str   # CHUNK_UPLOADED | NODE_OFFLINE | RS_RECOVER | etc.
    message:     str
    metadata:    Dict  = {}


# ─────────────────────────────────────────────
# API Response Models
# ─────────────────────────────────────────────
class UploadResponse(BaseModel):
    success:     bool
    file_id:     str
    filename:    str
    chunk_count: int
    message:     str


class DownloadResponse(BaseModel):
    success:     bool
    file_id:     str
    filename:    str
    size:        int
    message:     str


class NodeStatusResponse(BaseModel):
    nodes: List[NodeRecord]


class MetricsSnapshot(BaseModel):
    mttdl:              float  # hours
    storage_efficiency: float  # ratio (e.g. 2.0 = 50% savings)
    entropy:            float  # 0.0 to 1.0
    integrity_pass_rate:float  # 0-100%
    cache_hit_rate:     float  # 0-100%
    reconstruction_latency_ms: float


# ─────────────────────────────────────────────
# Full Store Model (what store.json looks like)
# ─────────────────────────────────────────────
class StoreModel(BaseModel):
    files:  Dict[str, FileRecord]  = {}   # file_id → FileRecord
    nodes:  Dict[str, NodeRecord]  = {}   # node_id → NodeRecord
    events: List[EventRecord]      = []   # last 200 events