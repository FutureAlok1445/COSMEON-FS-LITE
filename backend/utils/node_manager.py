# backend/utils/node_manager.py
# Person 2 owns this file
# Responsibility: Simple node status interface
# THIS IS THE CONTRACT FILE — Person 1's reassembler.py imports get_node_status() from here

from backend.metadata import manager as meta
from backend.config import ALL_NODES


def get_node_status(node_id: str) -> str:
    """
    ⚠️ INTERFACE CONTRACT — Person 1's reassembler.py calls this.
    Returns: "ONLINE" | "OFFLINE" | "DEGRADED" | "PARTITIONED"
    """
    node = meta.get_node(node_id)
    if node is None:
        return "OFFLINE"
    return node.status


def set_online(node_id: str) -> None:
    """Bring a node back online. Push latest metadata before marking ONLINE."""
    meta.replicate_to_node(node_id)
    meta.update_node_status(node_id, "ONLINE")
    print(f"[NODE_MANAGER] ✅ {node_id} → ONLINE")


def set_offline(node_id: str) -> None:
    """Take a node offline (soft — data preserved in folder)."""
    meta.update_node_status(node_id, "OFFLINE")
    print(f"[NODE_MANAGER] 🔴 {node_id} → OFFLINE")


def set_degraded(node_id: str) -> None:
    """Node in degraded state — still reachable but low health."""
    meta.update_node_status(node_id, "DEGRADED")
    print(f"[NODE_MANAGER] 🟡 {node_id} → DEGRADED")


def set_partitioned(node_id: str) -> None:
    """
    Node is alive but unreachable (no line-of-sight).
    Different from OFFLINE — data is intact, just can't communicate.
    """
    meta.update_node_status(node_id, "PARTITIONED")
    print(f"[NODE_MANAGER] 🟠 {node_id} → PARTITIONED")


def get_all_statuses() -> dict:
    """Returns dict of all node_id → status."""
    return {node.node_id: node.status for node in meta.get_all_nodes()}


def get_online_nodes() -> list:
    """Returns list of node_ids that are currently ONLINE."""
    return [
        node.node_id
        for node in meta.get_all_nodes()
        if node.status == "ONLINE"
    ]


def restore_all_nodes() -> None:
    """Bring all nodes back to ONLINE. Push latest metadata to each before marking ONLINE."""
    for node_id in ALL_NODES:
        meta.replicate_to_node(node_id)
        meta.update_node_status(node_id, "ONLINE")
    print("[NODE_MANAGER] ✅ All nodes restored to ONLINE")