# backend/intelligence/raft_consensus.py
# Person 3 owns this file
# Responsibility: Leader Election and Write-Ahead Log (WAL) for Byzantine Fault Tolerance

import random
import time
import asyncio
from typing import Dict, List, Optional
from pydantic import BaseModel

class LogEntry(BaseModel):
    term: int
    intent: str
    file_id: str
    timestamp: float

# Global in-memory Raft state for the emulator
# In FS-PRO, this lives inside each isolated container's memory
raft_state = {
    # plane -> { node_id: { role, term, log, last_heartbeat } }
    "Alpha": {},
    "Beta": {},
    "Gamma": {}
}

def init_raft_clusters():
    """Phase 4.1: Statically group containers into 3 Raft Clusters."""
    from backend.config import ORBITAL_PLANES
    for plane, nodes in ORBITAL_PLANES.items():
        for node_id in nodes:
            # Init automatically registers into raft_state
            RaftNode(node_id=node_id, plane=plane)
    print(f"[RAFT] ✅ Initialized 3 consensus clusters: Alpha, Beta, Gamma")

class RaftNode:
    def __init__(self, node_id: str, plane: str):
        self.node_id = node_id
        self.plane = plane
        self.role = "FOLLOWER"
        self.term = 0
        self.voted_for = None
        self.wal: List[LogEntry] = []
        
        # Initialize in global state
        raft_state[self.plane][self.node_id] = self

    def _get_peers(self) -> List["RaftNode"]:
        """Get all other nodes in the same orbital plane."""
        return [
            node for n_id, node in raft_state[self.plane].items() 
            if n_id != self.node_id
        ]
        
    def _get_leader(self) -> Optional["RaftNode"]:
        for node in raft_state[self.plane].values():
            if node.role == "LEADER":
                return node
        return None

    def start_election(self):
        """Phase 4.2: Transition to CANDIDATE and request votes."""
        from backend.utils.node_manager import get_node_status
        if get_node_status(self.node_id) != "ONLINE":
            return

        self.role = "CANDIDATE"
        self.term += 1
        self.voted_for = self.node_id
        votes = 1 # Vote for self
        
        peers = self._get_peers()
        
        for peer in peers:
            if get_node_status(peer.node_id) == "ONLINE":
                # Simplified voting: if peer hasn't voted in this term, they vote YES
                if peer.term < self.term:
                    peer.term = self.term
                    peer.voted_for = self.node_id
                    votes += 1
                    
        # Plurality/Quorum check (N/2 + 1)
        total_nodes = len(peers) + 1
        
        # Phase 4.4: In a 2-node cluster, strict Raft fails if 1 dies.
        # We allow degraded 1-node quorums for this FS-PRO topology.
        peer_online = len([p for p in peers if get_node_status(p.node_id) == "ONLINE"])
        
        if total_nodes == 2:
            quorum_needed = 1 if peer_online == 0 else 2
        else:
            quorum_needed = total_nodes // 2 + 1
            
        print(f"[RAFT-DEBUG] {self.node_id} Election -> Votes: {votes}, Quorum: {quorum_needed}, Total: {total_nodes}")
            
        if votes >= quorum_needed:
            self.role = "LEADER"
            # print(f"[RAFT] 👑 {self.node_id} elected LEADER of Plane {self.plane} (Term {self.term})")
        else:
            self.role = "FOLLOWER" # Failed
            
    def append_entry(self, intent: str, file_id: str) -> bool:
        """
        Phase 4.3: Write-Ahead Log implementation.
        Only the LEADER can accept destructive writes.
        Requires quorum acknowledgment before committing.
        """
        if self.role != "LEADER":
            leader = self._get_leader()
            if leader:
                return leader.append_entry(intent, file_id)
            return False # No leader available
            
        entry = LogEntry(
            term=self.term,
            intent=intent,
            file_id=file_id,
            timestamp=time.time()
        )
        
        # Append locally
        self.wal.append(entry)
        
        # Broadcast to followers (Quorum Check)
        acks = 1
        peers = self._get_peers()
        for peer in peers:
            from backend.utils.node_manager import get_node_status
            if get_node_status(peer.node_id) == "ONLINE":
                # In FS-PRO, this is a gRPC call. Here we emulate success.
                peer.wal.append(entry)
                acks += 1
                
        total_nodes = len(peers) + 1
        if total_nodes == 2:
            quorum_needed = 1 if get_node_status(peers[0].node_id) != "ONLINE" else 2
        else:
            quorum_needed = total_nodes // 2 + 1
            
        if acks >= quorum_needed:
            # print(f"[RAFT-WAL] ✅ Quorum reached for {intent} on {file_id} via {self.node_id}")
            return True
        else:
            # print(f"[RAFT-WAL] ❌ Quorum FAILED for {intent}. Reverting.")
            self.wal.pop()
            return False


# Daemon to run Leader Elections in the background
async def raft_daemon():
    """Background task to ensure planes always have a leader."""
    from backend.utils.node_manager import get_node_status
    
    async def _run_election_for_plane(plane, nodes):
        leader_exists = any(n.role == "LEADER" and get_node_status(n.node_id) == "ONLINE" for n in nodes.values())
        if not leader_exists:
            online_followers = [n for n in nodes.values() if get_node_status(n.node_id) == "ONLINE"]
            if online_followers:
                # Random backoff timer simulation
                await asyncio.sleep(random.uniform(0.1, 0.5))
                # Check again in case another node elected itself while we slept
                if not any(n.role == "LEADER" and get_node_status(n.node_id) == "ONLINE" for n in nodes.values()):
                    candidate = random.choice(online_followers)
                    candidate.start_election()

    while True:
        try:
            tasks = []
            for plane, nodes in raft_state.items():
                tasks.append(asyncio.create_task(_run_election_for_plane(plane, nodes)))
                
            if tasks:
                await asyncio.gather(*tasks)
                
            await asyncio.sleep(1) # Check every second
            
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[RAFT] Error in Daemon: {e}")
            await asyncio.sleep(5)
