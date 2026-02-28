import sys
import os
import asyncio

# Ensure the backend module can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.config import init_node_folders
from backend.metadata.manager import init_store, get_all_nodes, register_file, get_all_files
from backend.metadata.schemas import NodeRecord, FileRecord, ChunkRecord
from backend.intelligence.rebalancer import check_and_rebalance, compute_entropy
from backend.utils.node_manager import set_online

async def run_test():
    print("Initializing test environment...")
    init_node_folders()
    init_store()
    
    # Ensure all nodes are online
    nodes = get_all_nodes()
    for n in nodes:
        set_online(n.node_id)
        
    print("Simulating an imbalanced network (Force dumping chunks on SAT-01 and SAT-02)...")
    
    # Create fake chunks heavily skewed to SAT-01 and SAT-02
    chunks = []
    
    # SAT-01 gets 20 chunks
    for i in range(20):
        chunks.append(ChunkRecord(
            chunk_id=f"sim_chunk_1_{i}",
            sequence_number=i,
            size=1024,
            sha256_hash="fake",
            node_id="SAT-01",
            is_parity=False,
            pad_size=512
        ))
    
    # SAT-02 gets 15 chunks
    for i in range(15):
        chunks.append(ChunkRecord(
            chunk_id=f"sim_chunk_2_{i}",
            sequence_number=i + 20,
            size=1024,
            sha256_hash="fake",
            node_id="SAT-02",
            is_parity=False,
            pad_size=512
        ))
        
    # SAT-03 gets 2 chunks
    for i in range(2):
        chunks.append(ChunkRecord(
            chunk_id=f"sim_chunk_3_{i}",
            sequence_number=i + 35,
            size=1024,
            sha256_hash="fake",
            node_id="SAT-03",
            is_parity=False,
            pad_size=512
        ))
        
    # Create a fake file to hold these chunks
    fake_file = FileRecord(
        file_id="sim_file_1",
        filename="test_imbalance.bin",
        size=1024 * 37,
        full_sha256="fake_full",
        chunk_count=37,
        chunks=chunks
    )
    register_file(fake_file)
    
    # Also need to create the actual files so the rebalancer can move them
    for c in chunks:
        node_path = os.path.join("nodes", c.node_id)
        os.makedirs(node_path, exist_ok=True)
        with open(os.path.join(node_path, f"{c.chunk_id}.bin"), "wb") as f:
            f.write(b"fake data")

    # Update node chunk counts manually for the test
    from backend.metadata.manager import update_node_storage
    for n in get_all_nodes():
        count = sum(1 for c in chunks if c.node_id == n.node_id)
        update_node_storage(n.node_id, size_delta=count * 1024, chunk_delta=count)

    initial_entropy = compute_entropy()
    print(f"\nInitial Entropy: {initial_entropy:.3f}")
    
    for n in get_all_nodes():
        print(f"{n.node_id} has {n.chunk_count} chunks")
        
    print("\nTriggering Rebalancer...")
    result = await check_and_rebalance()
    
    print("\nRebalancer Results:")
    print(f"Migrations performed: {result['migrations']}")
    print(f"Final Entropy: {result['final_entropy']:.3f} (Status: {result['final_status']})")
    
    print("\nFinal Chunk Distribution:")
    for n in get_all_nodes():
        print(f"{n.node_id} has {n.chunk_count} chunks")
        
    # Check if files were actually moved
    print("\nVerifying physical file moves...")
    for n in get_all_nodes():
        node_dir = os.path.join("nodes", n.node_id)
        files = os.listdir(node_dir) if os.path.exists(node_dir) else []
        print(f"{n.node_id} physical files on disk: {len(files)}")


if __name__ == "__main__":
    asyncio.run(run_test())
