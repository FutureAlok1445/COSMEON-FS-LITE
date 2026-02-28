import json
import asyncio
from fastapi import APIRouter
from backend.metadata.manager import _load_db, _save_db, _lock
from backend.config import NODES_DIR
from backend.utils.ws_manager import manager

router = APIRouter()

@router.post("/api/chaos/{scenario}")
async def trigger_chaos(scenario: str):
    with _lock:
        db = _load_db()
        nodes = db.get("nodes", {})
        
        if scenario == "solar_flare":
            # Kills Plane Beta
            nodes["SAT-03"]["status"] = "OFFLINE"
            nodes["SAT-04"]["status"] = "OFFLINE"
            _save_db(db)
            await manager.broadcast("CHAOS_EVENT", "Solar Flare Event: Plane Beta Destroyed", {"scenario": scenario})
            return {"status": "Solar Flare activated: SAT-03, SAT-04 Offline."}
            
        elif scenario == "bit_rot":
            # Flips a byte in a random bin file in SAT-01
            sat1_dir = NODES_DIR / "SAT-01"
            bin_files = list(sat1_dir.glob("*.bin"))
            if bin_files:
                target = bin_files[0]
                with open(target, "r+b") as f:
                    # flip 1 byte
                    byte = f.read(1)
                    if byte:
                        f.seek(0)
                        f.write(bytes([byte[0] ^ 0xFF]))
                await manager.broadcast("CHAOS_EVENT", f"Cosmic Ray induced Bit-Rot in {target.name}", {"scenario": scenario})
                return {"status": "Bit Rot triggered. Invisible corruption introduced."}
            return {"status": "No files in SAT-01 to corrupt."}
            
        elif scenario == "restore":
            for n in nodes:
                nodes[n]["status"] = "ONLINE"
            _save_db(db)
            await manager.broadcast("CHAOS_EVENT", "System Restore: All Networks Active", {"scenario": scenario})
            return {"status": "All nodes restored to ONLINE."}

    return {"status": "Unknown scenario"}
