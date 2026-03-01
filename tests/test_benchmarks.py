# tests/test_benchmarks.py
import requests
import os
import time
import hashlib
import statistics

API_URL = "http://localhost:8000/api"
DUMMY_FILE_PATH = "benchmark_payload.bin"
MB = 1024 * 1024
BENCHMARK_SIZES = [1 * MB, 5 * MB] # 1MB and 5MB tests

def create_payload(size):
    data = os.urandom(size)
    with open(DUMMY_FILE_PATH, "wb") as f:
        f.write(data)
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()

def run_benchmarks():
    print("\n[BENCHMARK] 🚀 Initiating COSMEON FS-PRO Rigorous System Benchmarks...")
    
    upload_times = []
    download_times = []
    
    try:
        for size in BENCHMARK_SIZES:
            print(f"\n--- Testing Payload Size: {size/MB:.1f} MB ---")
            true_hash = create_payload(size)
            
            # 1. Upload Latency
            start_up = time.time()
            with open(DUMMY_FILE_PATH, "rb") as f:
                response = requests.post(f"{API_URL}/upload", files={"file": (DUMMY_FILE_PATH, f, "application/octet-stream")})
            up_time = time.time() - start_up
            
            if response.status_code != 200:
                print(f"❌ Upload Failed: {response.text}")
                return
            
            file_id = response.json().get("file_id")
            
            print(f"✅ Upload + RS Encoding + DHT Routing Latency: {up_time:.2f}s")
            upload_times.append(up_time)
            
            # 2. Download Latency
            start_down = time.time()
            dl_resp = requests.get(f"{API_URL}/download/{file_id}")
            down_time = time.time() - start_down
            
            if dl_resp.status_code != 200:
                print(f"❌ Download Failed!")
                return
            
            dl_hash = hashlib.sha256(dl_resp.content).hexdigest()
            if dl_hash != true_hash:
                print(f"❌ Hash mismatch!")
                return
            
            print(f"✅ Download + RS Reconstruction Latency:     {down_time:.2f}s")
            download_times.append(down_time)
            
            # Cleanup
            requests.delete(f"{API_URL}/delete/{file_id}")
            
        print("\n==================================")
        print("📊 BENCHMARK RESULTS (Live System)")
        print("==================================")
        print(f"Total Tests Run: {len(BENCHMARK_SIZES)}")
        print(f"Average Upload Latency:   {statistics.mean(upload_times):.2f}s")
        print(f"Average Download Latency: {statistics.mean(download_times):.2f}s")
        print("Status: 100% PASS - The mathematical integrity holds over the network.")
        print("Note: If running on legacy reedsolo Python wrappers instead of native PyO3 Rust, latency scales non-linearly with size.")
            
    finally:
        if os.path.exists(DUMMY_FILE_PATH):
            os.remove(DUMMY_FILE_PATH)

if __name__ == "__main__":
    run_benchmarks()
