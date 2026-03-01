# tests/test_zkp_audit.py
import sys
import os
import time
import asyncio
import uuid
import hashlib

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.intelligence.zkp_audit import ZKPAuditor
from backend.core.chunker import _compute_hash

async def test_zkp_audit_matrix():
    print("\n[ZKP AUDIT TEST] 🚀 Initiating Zero-Knowledge Proofs of Retrievability...")
    
    # 1. Simulate a 512KB Chunk creation on Ground Station (Phase 5.1)
    chunk_data = os.urandom(512 * 1024)
    chunk_id = str(uuid.uuid4())
    
    start_anchor = time.time()
    # Ground station computes the initial anchor
    commitment = ZKPAuditor.generate_commitment(chunk_data)
    tether_time = time.time() - start_anchor
    
    print(f"[*] Phase 5.1: Ground Station extracted ZK Tether: {commitment[:16]}... ({tether_time*1000:.2f}ms)")
    
    # Simulating uploading to Satellite (Ignoring bandwidth here)
    satellite_storage = {chunk_id: chunk_data}
    
    # 2. Challenge Loop (Phase 5.4)
    print("\n[CHALLENGE] 📡 Ground Station demands Proof of Retrievability from SAT-01...")
    challenge_nonce = str(uuid.uuid4()) # Random one-time nonce
    print(f"[*] Ground Station sends Nonce: {challenge_nonce}")
    
    # 3. Satellite Prover (Phase 5.2)
    print("\n[PROVER] 🛰️ SAT-01 executing ZK-SNARK Prover circuit...")
    # The Satellite uses its stored raw bytes AND the ground station nonce
    proof, calc_time = ZKPAuditor.prove(satellite_storage[chunk_id], challenge_nonce)
    
    print(f"✅ SAT-01 Generated Proof: {proof[:16]}... ({calc_time:.2f}ms computation)")
    
    # Proof transferred over network... Size is minimal
    proof_size_kb = len(proof.encode('utf-8')) / 1024
    print(f"📡 Transmitting ZK Proof back to Earth. Bandwidth consumed: {proof_size_kb:.3f} KB")
    
    # 4. Ground Station Verifier (Phase 5.3)
    print("\n[VERIFIER] 🌍 Ground Station verifying Proof mathematically...")
    
    # To mathematically verify the STARK proof without holding the file,
    # the Verifier essentially checks `Verify(Commitment, Proof, Public_Nonce)`
    # Since we simulate Groth16 with hashing, the Ground Station expects:
    expected_proof_derivation = hashlib.sha256(chunk_data + challenge_nonce.encode('utf-8')).hexdigest()
    
    start_verify = time.time()
    is_valid = ZKPAuditor.verify(commitment, proof, expected_proof_derivation)
    verify_time = time.time() - start_verify
    
    if is_valid:
        print(f"✅ VERIFIED: SAT-01 legally possesses the chunk! ({verify_time*1000:.2f}ms)")
        if proof_size_kb < 1.0:
            print("🚀 PASS: Bandwidth utilization < 1KB per audit loop!")
    else:
        print("❌ INTEGRITY FAILURE: Proof is invalid. SAT-01 may have dropped the chunk.")
        sys.exit(1)
        
    # Negative Test: Test if Satellite tries to fake a proof
    print("\n[NEGATIVE TEST] ⚠️ What if SAT-01 tries to send a fake proof without having the file?")
    fake_proof = hashlib.sha256(b"fake data" + challenge_nonce.encode('utf-8')).hexdigest()
    
    is_valid_fake = ZKPAuditor.verify(commitment, fake_proof, expected_proof_derivation)
    if not is_valid_fake:
        print("✅ VERIFIED: Ground Station successfully rejected the fraudulent proof.")
    else:
        print("❌ CRITICAL BUG: Verifier accepted fraudulent proof!")
        sys.exit(1)


if __name__ == '__main__':
    asyncio.run(test_zkp_audit_matrix())
