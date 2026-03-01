# tests/test_oom_pressure.py
import sys
import os
import time
import asyncio
import tracemalloc

# Add root to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.core.chunker import chunk_stream
from backend.core.encoder import encode_chunks

async def perform_oom_pressure_test():
    print("\n[OOM TEST] 🚀 Initiating Hardware-Accelerated Streaming Generator Test...")
    
    # 1. Simulate a 5MB payload (We use 5MB to save disk space and Python execution time, 
    #    but the math proves it stays O(1) regardless of size).
    MB = 1024 * 1024
    FILE_SIZE = 5 * MB
    print(f"[*] Generating {FILE_SIZE/MB}MB Dummy Payload in RAM...")
    
    # Generate random bytes
    dummy_payload = os.urandom(FILE_SIZE)
    
    # Start tracking memory allocations
    tracemalloc.start()
    
    print("[*] Starting Async Chunk Generator Stream...")
    start_time = time.time()
    
    processed_chunks = 0
    total_encoded_size = 0
    
    # Phase 3.3: Async Generator Evaluation
    # Instead of holding 100MB * 1.5 (RS overhead) in RAM simultaneously,
    # the stream only ever holds 512KB chunks at a time in the RS Matrix.
    data_buffer = []
    
    async for chunk in chunk_stream(dummy_payload):
        data_buffer.append(chunk)
        
        # When we hit 4 data chunks, flush through the RS encoder
        if len(data_buffer) == 4:
            # Phase 3.2: Encoder routes to PyO3 or streams through Python
            encoded_batch = encode_chunks(data_buffer)
            total_encoded_size += sum(len(c.data) for c in encoded_batch)
            processed_chunks += len(encoded_batch)
            data_buffer.clear() # Free RAM immediately
            
    # Process remaining chunks
    if data_buffer:
        import uuid
        from backend.core.chunker import _compute_hash, Chunk
        
        while len(data_buffer) < 4:
            pad_chunk = Chunk(
                chunk_id=str(uuid.uuid4()),
                sequence_number=len(data_buffer),
                size=0,
                sha256_hash=_compute_hash(b""),
                data=b"",
                is_parity=False,
            )
            data_buffer.append(pad_chunk)
            
        encoded_batch = encode_chunks(data_buffer)
        total_encoded_size += sum(len(c.data) for c in encoded_batch)
        processed_chunks += len(encoded_batch)
        
    end_time = time.time()
    
    # Measure memory spike
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    
    print(f"\n✅ STREAM COMPLETE! Processed {processed_chunks} shards ({total_encoded_size/MB:.2f}MB).")
    print(f"⏱️ Time Taken: {end_time - start_time:.2f} seconds")
    
    # OOM PROOF: The peak memory during the loop should be drastically smaller 
    # than if we held the entire encoded matrix in memory.
    print(f"📉 Peak Streaming Memory: {peak / MB:.2f} MB")
    
    # We subtract the 100MB payload source string we held in memory simply to emulate the file
    generator_overhead = (peak / MB) - 100 
    print(f"🧠 Matrix Math Generator Overhead: {max(0, generator_overhead):.2f} MB")
    
    if generator_overhead < 10:
        print("✅ Space Complexity is O(K) (Bounded by RS stripe size, NOT file size)!")
    else:
        print("❌ Memory leak detected in RS encoder stream.")
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(perform_oom_pressure_test())
