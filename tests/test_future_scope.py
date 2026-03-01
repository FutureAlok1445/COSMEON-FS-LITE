# tests/test_future_scope.py
import unittest
import sys
import os

# Add root to python path so we can import backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.metadata.vector_clocks import (
    increment_clock, compare_clocks, merge_clocks, resolve_split_brain
)
from backend.metadata.schemas import FileRecord, ChunkRecord
from backend.core.chunker import Chunk

class TestFutureScopeIntegration(unittest.TestCase):

    def test_vector_clock_causality(self):
        """EXTREME TEST: Verify Vector Clocks can detect Split-Brain network partitions."""
        print("\n--- Testing Vector Clock Causality ---")
        
        # Initial State: Ground Station uploads file
        clock_initial = {"GROUND_STATION": 1}
        
        # Event 1: SAT-01 replicates the file
        clock_sat1 = increment_clock(clock_initial, "SAT-01")
        
        # Event 2: SOLAR FLARE partitions the network!
        # SAT-02 (on Beta plane) modifies the file independently of SAT-01 (Alpha plane)
        clock_sat2 = increment_clock(clock_initial, "SAT-02")
        
        # Prove that SAT-01 happened AFTER GROUND_STATION
        self.assertEqual(compare_clocks(clock_initial, clock_sat1), "LESS_THAN")
        
        # Prove that SAT-01 and SAT-02 are CONCURRENT (Split-Brain Conflict!)
        self.assertEqual(compare_clocks(clock_sat1, clock_sat2), "CONCURRENT")
        
        # Create Dummy Conflicting Records
        state_sat1 = {"size": 500}
        state_sat2 = {"size": 2000} # SAT-02 appended more data during the partition
        
        # The network merges! It must mathematically resolve the conflict
        resolved_state, resolved_clock = resolve_split_brain(state_sat1, clock_sat1, state_sat2, clock_sat2)
        
        # It should adopt the largest state (SAT-02) and merge the clocks natively
        self.assertEqual(resolved_state["size"], 2000)
        self.assertEqual(resolved_clock["GROUND_STATION"], 1)
        self.assertEqual(resolved_clock["SAT-01"], 1)
        self.assertEqual(resolved_clock["SAT-02"], 1)
        print("✅ Split-Brain Conflict successfully merged via Vector Clocks")

    def test_distributor_grpc_stub(self):
        """EXTREME TEST: Ensure distributor does not crash when hitting the new gRPC stubs."""
        print("\n--- Testing gRPC Stream Distrubution Stub ---")
        from backend.core.distributor import _write_chunk_grpc_stub
        
        # Create a dummy chunk
        dummy_chunk = Chunk(
            chunk_id="TEST-CHUNK-X99",
            sequence_number=1,
            size=1024,
            sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", # empty string hash
            data=b""
        )
        
        # Push through the stub. It should fallback to local disk write without crashing
        success = _write_chunk_grpc_stub(dummy_chunk, "SAT-TEST")
        
        # Assert the network gateway handled the payload
        self.assertTrue(success)
        
        # Cleanup the test bin
        node_path = os.path.join("backend", "nodes", "SAT-TEST")
        file_path = os.path.join(node_path, "TEST-CHUNK-X99.bin")
        if os.path.exists(file_path):
            os.remove(file_path)
            
        print("✅ gRPC Network Push mapped perfectly to FS-LITE emulator")


if __name__ == '__main__':
    unittest.main(verbosity=2)
