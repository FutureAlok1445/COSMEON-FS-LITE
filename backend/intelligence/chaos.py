import os
import asyncio
from fastapi import APIRouter
from backend.metadata.manager import update_node_status, log_event
from backend.config import NODES_BASE_PATH, ALL_NODES
from backend.utils.ws_manager import manager

router = APIRouter()

@router.post("/api/chaos/{scenario}")
async def trigger_chaos(scenario: str):
    try:
        if scenario == "solar_flare":
            # Kills Plane Beta
            update_node_status("SAT-03", "OFFLINE")
            update_node_status("SAT-04", "OFFLINE")
            await manager.broadcast("CHAOS_EVENT", "Solar Flare Event: Plane Beta Destroyed", {"scenario": scenario})
            return {"status": "Solar Flare activated: SAT-03, SAT-04 Offline."}
            
        elif scenario == "bit_rot":
            # Flips a byte in a random bin file in SAT-01
            sat1_dir = NODES_BASE_PATH / "SAT-01"
            bin_files = list(sat1_dir.glob("*.bin"))
            if bin_files:
                target = bin_files[0]
                with open(target, "r+b") as f:
                    byte = f.read(1)
                    if byte:
                        f.seek(0)
                        f.write(bytes([byte[0] ^ 0xFF]))
                await manager.broadcast("CHAOS_EVENT", f"Cosmic Ray induced Bit-Rot in {target.name}", {"scenario": scenario})
                return {"status": "Bit Rot triggered. Invisible corruption introduced."}
            return {"status": "No files in SAT-01 to corrupt."}
            
        elif scenario == "node_overload":
            # Rapidly generate 20 dummy chunks on SAT-02 to trigger the rebalancer
            target_node = "SAT-02"
            target_dir = NODES_BASE_PATH / target_node
            target_dir.mkdir(parents=True, exist_ok=True)
            
            for i in range(20):
                dummy_path = target_dir / f"dummy_{os.urandom(4).hex()}_{i}.bin"
                with open(dummy_path, "wb") as f:
                    f.write(os.urandom(1024))
            
            await manager.broadcast("CHAOS_EVENT", f"Node Overload: {target_node} capacity spiked.", {"node": target_node})
            return {"status": f"Node Overload activated. {target_node} capacity spiked."}
            
        elif scenario == "restore":
            for n in ALL_NODES:
                update_node_status(n, "ONLINE")
            await manager.broadcast("CHAOS_EVENT", "System Restore: All Networks Active", {"scenario": scenario})
            return {"status": "All nodes restored to ONLINE."}

    except Exception as e:
        return {"status": "error", "message": str(e)}

    return {"status": "Unknown scenario"}
