"""
Person 3: Orbit Timer System (trajectory.py)
Responsibilities: 120-second countdown loop per node.
Reset on orbit completion. Emit WebSocket warning at <30s.
"""

import asyncio
from backend.config import ORBITAL_PLANES, ORBIT_PERIOD
from backend.metadata.manager import update_orbit_timer
from backend.utils.ws_manager import manager

# Shared state for orbit timers in memory for the worker to avoid repetitive DB reads
# Stagger the initial timers so they don't all reset at once
initial_offsets = {"Alpha": 120, "Beta": 80, "Gamma": 40}
orbit_timers = {
    node: initial_offsets.get(plane, ORBIT_PERIOD)
    for plane, nodes in ORBITAL_PLANES.items()
    for node in nodes
}

async def orbit_timer_worker():
    """
    120-second countdown loop per node.
    Reset on orbit completion. Emit WebSocket warning at <30s.
    Updates metadata store every second for frontend sync.
    """
    while True:
        for node_id, timer in orbit_timers.items():
            if timer > 0:
                orbit_timers[node_id] -= 1
            else:
                orbit_timers[node_id] = ORBIT_PERIOD
                await manager.broadcast("ORBIT_RESET", f"Node {node_id} completed orbit. LOS Restored.", {"node": node_id})
            
            # Update metadata store for Person 4's dashboard
            update_orbit_timer(node_id, orbit_timers[node_id])
            
            # Emit warning at exactly 30s
            if orbit_timers[node_id] == 30:
                await manager.broadcast("ORBIT_WARNING", f"Node {node_id} entering LOS blackout in 30s.", {"node": node_id})
                
        await asyncio.sleep(1)
