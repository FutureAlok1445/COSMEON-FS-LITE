# backend/intelligence/trajectory.py
# Person 3 owns this file
# Responsibility: 120-second orbit countdown timer per satellite node
# When timer < 30s → broadcast warning → trigger predictive migration
# When timer hits 0 → reset to 120 (orbit cycle complete)

import asyncio
from typing import Dict

from backend.config import ALL_NODES, ORBIT_PERIOD, LOS_THRESHOLD
from backend.utils.ws_manager import manager
from backend.metadata.manager import update_orbit_timer, update_node_status


# ─────────────────────────────────────────────
# Timer State (in-memory, synced to store.json)
# ─────────────────────────────────────────────
_timers: Dict[str, int] = {node: ORBIT_PERIOD for node in ALL_NODES}
_running: bool = False


def get_timer(node_id: str) -> int:
    """Get current seconds remaining for a node's orbit."""
    return _timers.get(node_id, ORBIT_PERIOD)


def reset_timer(node_id: str) -> None:
    """Reset a node's timer to full orbit period (120s)."""
    _timers[node_id] = ORBIT_PERIOD


def get_all_timers() -> Dict[str, int]:
    """Get all node timers as dict."""
    return dict(_timers)


# ─────────────────────────────────────────────
# MAIN TIMER LOOP — runs as asyncio background task
# ─────────────────────────────────────────────

async def _tick_node(node_id: str) -> None:
    """Single tick for one node's orbit countdown."""
    _timers[node_id] -= 1
    seconds = _timers[node_id]

    # Sync to metadata every 10 seconds (reduce I/O)
    if seconds % 10 == 0 or seconds <= LOS_THRESHOLD:
        update_orbit_timer(node_id, seconds)

    # Warning zone: approaching Loss of Signal
    if seconds == LOS_THRESHOLD:
        await manager.broadcast("ORBIT_WARNING", {
            "node_id": node_id,
            "seconds_remaining": seconds,
            "message": f"{node_id} entering LOS window in {seconds}s",
        })

    # Critical: 10 seconds remaining
    if seconds == 10:
        await manager.broadcast("ORBIT_CRITICAL", {
            "node_id": node_id,
            "seconds_remaining": seconds,
            "message": f"{node_id} LOS imminent — {seconds}s remaining",
        })

    # Timer expired → orbit complete → briefly DEGRADED → reset
    if seconds <= 0:
        # Mark DEGRADED briefly (simulates orbital period completion jitter)
        update_node_status(node_id, "DEGRADED")
        await manager.broadcast("NODE_DEGRADED", {
            "node_id": node_id,
            "reason": "orbit_completion",
            "message": f"{node_id} completing orbital cycle — temporarily DEGRADED",
        })
        # Brief degraded window (3 seconds)
        await asyncio.sleep(3)

        # Back to ONLINE
        update_node_status(node_id, "ONLINE")
        await manager.broadcast("ORBIT_RESET", {
            "node_id": node_id,
            "message": f"{node_id} completed orbital cycle — back ONLINE",
        })

        _timers[node_id] = ORBIT_PERIOD
        update_orbit_timer(node_id, ORBIT_PERIOD)


async def start_all_timers() -> None:
    """
    Start the orbit timer background loop.
    Ticks all 6 nodes every 1 second.
    Called from main.py on startup.
    """
    global _running
    _running = True
    print("[TRAJECTORY] 🛰️  Orbit timers started for all nodes")

    while _running:
        try:
            # Tick all 6 nodes concurrently
            tasks = [_tick_node(node_id) for node_id in ALL_NODES]
            await asyncio.gather(*tasks)
        except Exception as e:
            print(f"[TRAJECTORY] Error in timer tick: {e}")

        await asyncio.sleep(1)


def stop_all_timers() -> None:
    """Stop the timer loop (called on shutdown)."""
    global _running
    _running = False
    print("[TRAJECTORY] Orbit timers stopped")
