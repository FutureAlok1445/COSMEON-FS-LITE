# backend/utils/ws_manager.py
# Person 4 owns this file
# Shared utility: ALL backend files broadcast events through this singleton
# Format: {"type": "EVENT_TYPE", "timestamp": "ISO", "data": {...}}

import json
import asyncio
from typing import List, Dict, Any
from datetime import datetime
from fastapi import WebSocket


class ConnectionManager:
    """
    WebSocket connection pool + JSON broadcaster.
    Singleton instance `manager` used by every module.
    """

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket client."""
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"[WS] ✅ Client connected (total: {len(self.active_connections)})")

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a disconnected client silently."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"[WS] Client disconnected (total: {len(self.active_connections)})")

    async def broadcast(self, event_type: str, data: dict = None) -> None:
        """
        Send JSON event to ALL connected dashboard clients.

        Args:
            event_type: e.g. "NODE_OFFLINE", "CHUNK_UPLOADED", "CHAOS_TRIGGERED"
            data: event-specific payload dict
        """
        message = {
            "type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data or {},
        }

        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead_connections.append(connection)

        # Clean up dead connections
        for dead in dead_connections:
            self.disconnect(dead)

    @property
    def client_count(self) -> int:
        return len(self.active_connections)


# ─────────────────────────────────────────────
# SINGLETON — import this everywhere
# from backend.utils.ws_manager import manager
# await manager.broadcast("EVENT_TYPE", {"key": "value"})
# ─────────────────────────────────────────────
manager = ConnectionManager()
