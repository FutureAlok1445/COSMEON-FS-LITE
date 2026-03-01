# backend/intelligence/harvest_manager.py
# Responsibility: Opportunistically collect shards from satellite nodes as they come online.
# This solves the "Partial Availability" problem where not all nodes are online at once.

import asyncio
import json
import os
import shutil
from pathlib import Path
from typing import Dict, List, Set, Optional

from backend.config import HARVEST_CACHE_PATH, NODES_BASE_PATH, ALL_NODES, RS_K
from backend.metadata.manager import get_file
from backend.utils.node_manager import get_node_status
from backend.utils.ws_manager import manager

# Path to persistent mission state
MISSIONS_FILE = HARVEST_CACHE_PATH / "missions.json"

class HarvestMission:
    def __init__(self, file_id: str, filename: str, total_chunks: int, collected_shards: List[str] = None):
        self.file_id = file_id
        self.filename = filename
        self.total_chunks = total_chunks
        self.collected_shards = set(collected_shards or [])
        self.status = "active" # active, completed

    def to_dict(self):
        return {
            "file_id": self.file_id,
            "filename": self.filename,
            "total_chunks": self.total_chunks,
            "collected_shards": list(self.collected_shards),
            "status": self.status
        }

class HarvestManager:
    def __init__(self):
        self.missions: Dict[str, HarvestMission] = {}
        self._load_missions()

    def _load_missions(self):
        if MISSIONS_FILE.exists():
            try:
                with open(MISSIONS_FILE, "r") as f:
                    data = json.load(f)
                    for fid, mdata in data.items():
                        self.missions[fid] = HarvestMission(
                            file_id=mdata["file_id"],
                            filename=mdata["filename"],
                            total_chunks=mdata["total_chunks"],
                            collected_shards=mdata["collected_shards"]
                        )
                        self.missions[fid].status = mdata.get("status", "active")
            except Exception as e:
                print(f"[HARVEST] Error loading missions: {e}")

    def _save_missions(self):
        try:
            with open(MISSIONS_FILE, "w") as f:
                json.dump({fid: m.to_dict() for fid, m in self.missions.items()}, f, indent=2)
        except Exception as e:
            print(f"[HARVEST] Error saving missions: {e}")

    def start_mission(self, file_id: str):
        record = get_file(file_id)
        if not record:
            return None
        
        if file_id not in self.missions:
            self.missions[file_id] = HarvestMission(
                file_id=file_id,
                filename=record.filename,
                total_chunks=len(record.chunks)
            )
            # Create file-specific cache dir
            file_dir = HARVEST_CACHE_PATH / file_id
            file_dir.mkdir(parents=True, exist_ok=True)
            self._save_missions()
            
        print(f"[HARVEST] Mission started/resumed for {record.filename} ({file_id})")
        return self.missions[file_id].to_dict()

    def get_status(self, file_id: str):
        mission = self.missions.get(file_id)
        return mission.to_dict() if mission else None

    async def run_worker(self):
        """Background task that hunts for shards from active missions."""
        print("[HARVEST] 🧺 Opportunistic Harvest worker started")
        while True:
            try:
                active_missions = [m for m in self.missions.values() if m.status == "active"]
                if not active_missions:
                    await asyncio.sleep(10)
                    continue

                for mission in active_missions:
                    record = get_file(mission.file_id)
                    if not record:
                        continue

                    new_shards_found = False
                    for chunk in record.chunks:
                        if chunk.chunk_id in mission.collected_shards:
                            continue
                        
                        # Check if node is online
                        if get_node_status(chunk.node_id) == "ONLINE":
                            source_path = Path(NODES_BASE_PATH) / chunk.node_id / f"{chunk.chunk_id}.bin"
                            dest_path = HARVEST_CACHE_PATH / mission.file_id / f"{chunk.chunk_id}.bin"
                            
                            if source_path.exists():
                                shutil.copy2(source_path, dest_path)
                                mission.collected_shards.add(chunk.chunk_id)
                                new_shards_found = True
                                
                                await manager.broadcast("HARVEST_PROGRESS", {
                                    "file_id": mission.file_id,
                                    "chunk_id": chunk.chunk_id,
                                    "node_id": chunk.node_id,
                                    "collected": len(mission.collected_shards),
                                    "total": mission.total_chunks,
                                    "message": f"Harvested shard {chunk.chunk_id[:8]} for {mission.filename}"
                                })

                    if new_shards_found:
                        if len(mission.collected_shards) >= mission.total_chunks:
                            mission.status = "completed"
                        self._save_missions()

            except Exception as e:
                print(f"[HARVEST] Worker error: {e}")
            
            await asyncio.sleep(5)

    def get_shard_path(self, file_id: str, chunk_id: str) -> Optional[Path]:
        """Check if a shard is available in the local harvest cache."""
        path = HARVEST_CACHE_PATH / file_id / f"{chunk_id}.bin"
        return path if path.exists() else None

harvest_manager = HarvestManager()
