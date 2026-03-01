# tests/test_raft_chaos.py
import sys
import os
import time
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.intelligence.raft_consensus import raft_state, init_raft_clusters, raft_daemon
from backend.utils.node_manager import set_offline, set_online, restore_all_nodes
from backend.metadata.manager import init_store

async def test_raft_chaos_recovery():
    print("\n[RAFT CHAOS TEST] 🚀 Initiating Byzantine Fault Tolerance Recovery Test...")
    
    # 1. Initialize clusters
    init_store()
    restore_all_nodes()
    init_raft_clusters()
    
    # 2. Start Daemon to elect initial leaders
    daemon_task = asyncio.create_task(raft_daemon())
    
    print("[*] Waiting 1000ms for initial Leader Elections...")
    await asyncio.sleep(1)
    
    # Verify a leader was elected in Plane Alpha
    alpha_nodes = raft_state["Alpha"]
    initial_leader = None
    for n in alpha_nodes.values():
        if n.role == "LEADER":
            initial_leader = n
            break
            
    if not initial_leader:
        print("❌ FAILED: No leader elected initially.")
        daemon_task.cancel()
        return
        
    print(f"✅ Initial Leader of Plane Alpha elected: {initial_leader.node_id} (Term {initial_leader.term})")
    
    # 3. Trigger Chaos: Solar Flare kills the leader!
    print(f"\n[CHAOS] ⚠️ SOLAR FLARE DETECTED! {initial_leader.node_id} has gone OFFLINE.")
    set_offline(initial_leader.node_id)
    
    # Wait for Daemon to detect failure and initiate new election (should be < 1500ms)
    print("[*] Waiting up to 1500ms for a Follower to promote itself...")
    await asyncio.sleep(1.5)
    
    new_leader = None
    for n in alpha_nodes.values():
        if n.role == "LEADER" and n.node_id != initial_leader.node_id:
            new_leader = n
            break
            
    if not new_leader:
        print("❌ FAILED: The Raft Cluster failed to recover. NO LEADER ELECTED.")
        daemon_task.cancel()
        return
        
    print(f"✅ CHAOS RECOVERY SUCCESS! Follower {new_leader.node_id} promoted to LEADER (Term {new_leader.term}) within SLA.")
    
    # 4. Verify WAL Integrity routing
    print("\n[*] Testing Write-Ahead Log Quorum routing on the new Leader...")
    success = new_leader.append_entry("DELETE dummy_file.bin", "dummy_file.bin")
    
    if success:
        print("✅ WAL Quorum Success. The new leader successfully distributed the Write Intent.")
    else:
        print("❌ WAL Quorum Failed! Split-brain may have occurred.")
        
    daemon_task.cancel()
    
if __name__ == '__main__':
    asyncio.run(test_raft_chaos_recovery())
