# backend/intelligence/chaos.py
# Person 3 owns this file
# Responsibility: 4 Chaos Engineering scenarios + restore
# Based on Netflix Chaos Engineering discipline
# Each scenario maps to a real space hazard

import os
import random
import uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter

from backend.config import NODES_BASE_PATH, ORBITAL_PLANES, ALL_NODES
from backend.core.integrity import bit_flip_simulate
from backend.core.chunker import Chunk, _compute_hash
from backend.utils.ws_manager import manager
from backend.utils.node_manager import (
    set_offline, set_partitioned, set_online, restore_all_nodes
)
from backend.metadata.manager import (
    get_all_files, update_node_storage, log_event
)

router = APIRouter()


# ─────────────────────────────────────────────
# SCENARIO 1 — Solar Flare ☀️
# Real hazard: Radiation burst wipes entire orbital shell
# Action: Kill Plane Beta (SAT-03 + SAT-04 → OFFLINE)
# ─────────────────────────────────────────────

@router.post("/api/chaos/solar_flare")
async def solar_flare():
    """Kill entire Orbital Plane Beta."""
    beta_nodes = ORBITAL_PLANES["Beta"]  # [SAT-03, SAT-04]

    await manager.broadcast("CHAOS_TRIGGERED", {
        "scenario": "solar_flare",
        "message": "☀️ SOLAR FLARE — Plane Beta hit by radiation burst",
        "affected_nodes": beta_nodes,
    })

    for node_id in beta_nodes:
        set_offline(node_id)
        await manager.broadcast("NODE_OFFLINE", {
            "node_id": node_id,
            "reason": "solar_flare",
            "message": f"{node_id} destroyed by solar radiation",
        })

    log_event("CHAOS_SOLAR_FLARE", "Plane Beta destroyed", {"nodes": beta_nodes})

    return {
        "status": "success",
        "scenario": "solar_flare",
        "affected": beta_nodes,
        "message": "Solar Flare activated: SAT-03, SAT-04 OFFLINE",
    }


# ─────────────────────────────────────────────
# SCENARIO 2 — Radiation Bit Rot ☢️
# Real hazard: Cosmic ray SEU flips memory bits silently
# Action: Corrupt 2 random .bin files across different nodes
# ─────────────────────────────────────────────

@router.post("/api/chaos/bit_rot")
async def bit_rot():
    """Corrupt 2 random chunks across different nodes."""
    corrupted = []

    # Find all .bin files across all nodes
    all_bins = []
    for node_id in ALL_NODES:
        node_dir = NODES_BASE_PATH / node_id
        if node_dir.exists():
            for f in node_dir.glob("*.bin"):
                all_bins.append({"path": str(f), "node": node_id, "file": f.name})

    if len(all_bins) < 2:
        return {"status": "error", "message": "Not enough chunk files to corrupt"}

    # Pick 2 random files from different nodes if possible
    random.shuffle(all_bins)
    targets = []
    used_nodes = set()
    for b in all_bins:
        if b["node"] not in used_nodes:
            targets.append(b)
            used_nodes.add(b["node"])
        if len(targets) == 2:
            break

    # Fallback: if only 1 node has files, pick 2 from same node
    if len(targets) < 2:
        targets = all_bins[:2]

    await manager.broadcast("CHAOS_TRIGGERED", {
        "scenario": "bit_rot",
        "message": "☢️ RADIATION BIT ROT — Cosmic ray SEU detected",
        "targets": len(targets),
    })

    for target in targets:
        result = bit_flip_simulate(target["path"])
        if result["success"]:
            corrupted.append({
                "node": target["node"],
                "file": target["file"],
                "byte_position": result["byte_position"],
                "original": result["original_byte"],
                "flipped": result["flipped_byte"],
            })

            await manager.broadcast("CHUNK_CORRUPTED", {
                "node_id": target["node"],
                "chunk_file": target["file"],
                "byte_position": result["byte_position"],
                "message": f"Bit rot in {target['file']} on {target['node']}",
            })

    log_event("CHAOS_BIT_ROT", f"Corrupted {len(corrupted)} chunks", {"corrupted": corrupted})

    return {
        "status": "success",
        "scenario": "bit_rot",
        "corrupted": corrupted,
        "message": f"Bit Rot: {len(corrupted)} chunks silently corrupted",
    }


# ─────────────────────────────────────────────
# SCENARIO 3 — Network Partition 🌐
# Real hazard: Satellite behind Earth, no ground station LOS
# Action: Mark SAT-03, SAT-04 as PARTITIONED (alive but unreachable)
# ─────────────────────────────────────────────

@router.post("/api/chaos/partition")
async def partition():
    """Mark Plane Beta as PARTITIONED (alive but unreachable)."""
    beta_nodes = ORBITAL_PLANES["Beta"]

    await manager.broadcast("CHAOS_TRIGGERED", {
        "scenario": "partition",
        "message": "🌐 NETWORK PARTITION — Plane Beta lost line-of-sight",
        "affected_nodes": beta_nodes,
    })

    for node_id in beta_nodes:
        set_partitioned(node_id)
        await manager.broadcast("NODE_PARTITIONED", {
            "node_id": node_id,
            "reason": "partition",
            "message": f"{node_id} behind Earth — no ground station LOS",
        })

    log_event("CHAOS_PARTITION", "Plane Beta partitioned", {"nodes": beta_nodes})

    return {
        "status": "success",
        "scenario": "partition",
        "affected": beta_nodes,
        "message": "Network Partition: SAT-03, SAT-04 PARTITIONED (alive but unreachable)",
    }


# ─────────────────────────────────────────────
# SCENARIO 4 — Node Overload ⚡
# Real hazard: Hotspot formation from concentrated writes
# Action: Force 20 small dummy chunks onto SAT-01 + SAT-02 only
# ─────────────────────────────────────────────

@router.post("/api/chaos/overload")
async def overload():
    """Flood SAT-01 and SAT-02 with dummy chunks to crash entropy."""
    target_nodes = ["SAT-01", "SAT-02"]
    chunks_per_node = 10
    chunk_size = 1024  # 1KB dummy chunks

    await manager.broadcast("CHAOS_TRIGGERED", {
        "scenario": "overload",
        "message": "⚡ NODE OVERLOAD — Hotspot formation on Alpha plane",
        "target_nodes": target_nodes,
    })

    total_written = 0
    for node_id in target_nodes:
        node_path = NODES_BASE_PATH / node_id
        node_path.mkdir(parents=True, exist_ok=True)

        for i in range(chunks_per_node):
            dummy_data = os.urandom(chunk_size)
            dummy_id = str(uuid.uuid4())
            chunk_path = node_path / f"{dummy_id}.bin"

            with open(chunk_path, "wb") as f:
                f.write(dummy_data)

            update_node_storage(node_id, size_delta=chunk_size, chunk_delta=1)
            total_written += 1

        await manager.broadcast("NODE_OVERLOADED", {
            "node_id": node_id,
            "dummy_chunks": chunks_per_node,
            "message": f"{node_id} flooded with {chunks_per_node} dummy chunks",
        })

    log_event("CHAOS_OVERLOAD", f"Wrote {total_written} dummy chunks to Alpha",
              {"nodes": target_nodes, "chunks": total_written})

    return {
        "status": "success",
        "scenario": "overload",
        "total_chunks_written": total_written,
        "message": f"Overload: {total_written} dummy chunks forced onto SAT-01, SAT-02",
    }


# ─────────────────────────────────────────────
# RESTORE — bring everything back to normal
# ─────────────────────────────────────────────

@router.post("/api/chaos/restore")
async def restore():
    """Restore all nodes to ONLINE, clear corruption flags."""
    restore_all_nodes()

    await manager.broadcast("CHAOS_RESOLVED", {
        "message": "✅ System restored — all nodes ONLINE, corruption flags cleared",
    })

    log_event("CHAOS_RESOLVED", "All nodes restored to ONLINE", {})

    # Trigger rebalancer after restore
    try:
        from backend.intelligence.rebalancer import check_and_rebalance
        rebalance_result = await check_and_rebalance()
    except Exception as e:
        rebalance_result = {"error": str(e)}

    return {
        "status": "success",
        "message": "All nodes restored to ONLINE",
        "rebalance": rebalance_result,
    }
