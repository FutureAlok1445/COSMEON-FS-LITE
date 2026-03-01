import json
import random
from typing import Dict, List, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

p2p_router = APIRouter(prefix="/ws/p2p", tags=["p2p"])

# Random space-themed adjectives and nouns for peer generation
ADJECTIVES = ["Quantum", "Neon", "Cosmic", "Astral", "Nova", "Stellar", "Lunar", "Solar", "Galactic", "Cyber"]
NOUNS = ["Voyager", "Apollo", "Pioneer", "Cassini", "Hubble", "Webb", "Sputnik", "Gemini", "Orion", "Artemis"]

class SignalingManager:
    def __init__(self):
        # Maps websocket objects to a generated peer profile
        self.active_connections: Dict[WebSocket, dict] = {}

    async def connect(self, websocket: WebSocket) -> dict:
        await websocket.accept()
        profile = {
            "id": f"peer_{random.randint(1000, 9999)}_{random.randint(1000, 9999)}",
            "name": f"{random.choice(ADJECTIVES)} {random.choice(NOUNS)}",
            "deviceType": "desktop" # Default, could be refined based on User-Agent if available
        }
        self.active_connections[websocket] = profile
        
        # Send their own profile back to them immediately
        await websocket.send_text(json.dumps({
            "type": "welcome",
            "profile": profile
        }))
        
        # Broadcast completely updated peer list to ALL clients
        await self.broadcast_peer_list()
        return profile

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]
            # Will be broadcast later in the exception block to avoid async issues here

    async def broadcast_peer_list(self):
        # We don't send the websockets themselves, just the profs
        peers = list(self.active_connections.values())
        message = json.dumps({
            "type": "peer-list-update",
            "peers": peers
        })
        for connection in self.active_connections.keys():
            try:
                await connection.send_text(message)
            except Exception:
                pass # Stale connection

    async def relay_signal(self, sender_ws: WebSocket, target_id: str, signal_data: dict):
        """Find the target websocket and forward the WebRTC signal (SDP or ICE) to them."""
        target_ws = None
        for ws, profile in self.active_connections.items():
            if profile["id"] == target_id:
                target_ws = ws
                break
                
        if target_ws:
            sender_profile = self.active_connections.get(sender_ws)
            if sender_profile:
                payload = json.dumps({
                    "type": "signal",
                    "sender": sender_profile["id"],
                    "data": signal_data
                })
                try:
                    await target_ws.send_text(payload)
                except Exception:
                    pass

manager = SignalingManager()

@p2p_router.websocket("")
async def p2p_signaling_endpoint(websocket: WebSocket):
    profile = await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # The client sends a signal (offer, answer, or ice-candidate) meant for another specific peer
            if message.get("type") == "signal":
                target_id = message.get("target")
                signal_data = message.get("data")
                if target_id and signal_data:
                    await manager.relay_signal(websocket, target_id, signal_data)
                    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_peer_list()
    except Exception as e:
        print(f"P2P Signaling Error: {str(e)}")
        manager.disconnect(websocket)
        await manager.broadcast_peer_list()
