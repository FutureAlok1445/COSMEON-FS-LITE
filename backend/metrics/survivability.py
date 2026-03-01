import random
import time
from dataclasses import dataclass, field
from typing import List, Dict

@dataclass
class SimulationConfig:
    num_simulations: int = 10_000
    mission_hours: int = 24
    total_chunks: int = 10               # N in RS(K, N)
    recovery_threshold: int = 4          # K — minimum chunks needed
    node_failure_prob_per_hour: float = 0.01     
    plane_blackout_prob_per_hour: float = 0.002  
    solar_flare_prob_per_hour: float = 0.001     
    corruption_prob_per_chunk: float = 0.005     
    nodes_per_plane: int = 3             
    num_planes: int = 4                  

@dataclass
class MissionResult:
    survived: bool
    chunks_surviving: int
    chunks_lost: int
    failure_causes: List[str]

@dataclass
class SimulationResult:
    survival_probability: float
    failure_count: int
    total_simulations: int
    worst_case_chunks_lost: int
    avg_chunks_lost: float
    avg_reconstruction_cost: float
    baseline_replication_survival: float
    baseline_failures: int
    risk_reduction_factor: float
    simulation_duration_ms: float
    config_used: SimulationConfig
    failure_breakdown: Dict[str, int]
    state_distribution: Dict[str, int]

    def to_dict(self):
        return {
            "survival_probability": self.survival_probability,
            "survival_percentage": f"{self.survival_probability * 100:.5f}%",
            "failure_count": self.failure_count,
            "total_simulations": self.total_simulations,
            "worst_case_chunks_lost": self.worst_case_chunks_lost,
            "avg_chunks_lost": round(self.avg_chunks_lost, 2),
            "avg_reconstruction_cost": round(self.avg_reconstruction_cost, 2),
            "baseline_replication_survival": self.baseline_replication_survival,
            "baseline_percentage": f"{self.baseline_replication_survival * 100:.2f}%",
            "risk_reduction_factor": round(self.risk_reduction_factor, 1),
            "simulation_duration_ms": round(self.simulation_duration_ms, 1),
            "failure_breakdown": self.failure_breakdown,
            "state_distribution": self.state_distribution,
            "config": self.config_used.__dict__,
            "status": "complete"
        }

class OrbitalReliabilitySimulator:
    def __init__(self, config: SimulationConfig = None):
        self.config = config or SimulationConfig()
        # Calculate total available nodes in the orbital constellation
        self.total_nodes = self.config.num_planes * self.config.nodes_per_plane

    def run(self) -> SimulationResult:
        start_time = time.time()
        
        failure_count = 0
        worst_case_lost = 0
        total_lost = 0
        
        failure_breakdown = {"node": 0, "plane": 0, "flare": 0, "corrupt": 0}
        state_dist = {"perfect": 0, "degraded": 0, "lost": 0}

        # Instead of 10k simulations in Python loop, we optimize randomly? No, requirement says pure Monte Carlo.
        for _ in range(self.config.num_simulations):
            mission = self._simulate_single_mission()
            
            total_lost += mission.chunks_lost
            if mission.chunks_lost > worst_case_lost:
                worst_case_lost = mission.chunks_lost
                
            if mission.chunks_lost == 0:
                state_dist["perfect"] += 1
            elif mission.survived:
                state_dist["degraded"] += 1
            else:
                state_dist["lost"] += 1

            if not mission.survived:
                failure_count += 1
                for cause in set(mission.failure_causes):
                    # Count each unique cause roughly
                    if cause in failure_breakdown:
                        failure_breakdown[cause] += 1

        baseline_survival, baseline_failures = self._compute_replication_baseline()
        
        survival_probability = 1.0 - (failure_count / self.config.num_simulations)
        
        rs_loss_prob = failure_count / self.config.num_simulations
        base_loss_prob = baseline_failures / self.config.num_simulations
        risk_reduction = (base_loss_prob / rs_loss_prob) if rs_loss_prob > 0 else float('inf')

        duration_ms = (time.time() - start_time) * 1000

        return SimulationResult(
            survival_probability=survival_probability,
            failure_count=failure_count,
            total_simulations=self.config.num_simulations,
            worst_case_chunks_lost=worst_case_lost,
            avg_chunks_lost=total_lost / self.config.num_simulations,
            avg_reconstruction_cost=(total_lost / self.config.num_simulations) * 1.4, # approx
            baseline_replication_survival=baseline_survival,
            baseline_failures=baseline_failures,
            risk_reduction_factor=risk_reduction,
            simulation_duration_ms=duration_ms,
            config_used=self.config,
            failure_breakdown=failure_breakdown,
            state_distribution=state_dist
        )

    def _simulate_single_mission(self) -> MissionResult:
        chunk_states = [True] * self.config.total_chunks
        causes = []
        
        for hour in range(self.config.mission_hours):
            # 1. Apply per-node random failure
            for i in range(len(chunk_states)):
                if chunk_states[i]:
                    if random.random() < self.config.node_failure_prob_per_hour:
                        chunk_states[i] = False
                        causes.append("node")

            # 2. Apply plane-level blackout (kills groups of chunks corresponding to nodes)
            for plane_idx in range(self.config.num_planes):
                if random.random() < self.config.plane_blackout_prob_per_hour:
                    start = plane_idx * self.config.nodes_per_plane
                    end = start + self.config.nodes_per_plane
                    for i in range(start, min(end, len(chunk_states))):
                        if chunk_states[i]:
                            chunk_states[i] = False
                            causes.append("plane")

            # 3. Apply solar flare
            if random.random() < self.config.solar_flare_prob_per_hour:
                affected = random.randint(1, max(1, len(chunk_states) // 3))
                targets = random.sample(range(len(chunk_states)), affected)
                for t in targets:
                    if chunk_states[t]:
                        chunk_states[t] = False
                        causes.append("flare")

            # 4. Apply per-chunk corruption
            for i in range(len(chunk_states)):
                if chunk_states[i]:
                    if random.random() < self.config.corruption_prob_per_chunk:
                        chunk_states[i] = False
                        causes.append("corrupt")

        surviving_chunks = sum(chunk_states)
        recoverable = surviving_chunks >= self.config.recovery_threshold
        
        return MissionResult(
            survived=recoverable,
            chunks_surviving=surviving_chunks,
            chunks_lost=self.config.total_chunks - surviving_chunks,
            failure_causes=causes
        )

    def _compute_replication_baseline(self) -> tuple[float, int]:
        """
        Simulates 3x replication: data lost only if all 3 replicas fail
        """
        failure_count = 0
        single_replica_fail_prob = 1 - (1 - self.config.node_failure_prob_per_hour) ** self.config.mission_hours
        all_replicas_fail_prob = single_replica_fail_prob ** 3
        
        for _ in range(self.config.num_simulations):
            if random.random() < all_replicas_fail_prob:
                failure_count += 1
                
        survival_prob = 1.0 - (failure_count / self.config.num_simulations)
        return survival_prob, failure_count

if __name__ == "__main__":
    simulator = OrbitalReliabilitySimulator()
    result = simulator.run()
    print(f"RS Survival: {result.survival_probability * 100:.5f}%")
    print(f"3x Replication: {result.baseline_replication_survival * 100:.2f}%")
    print(f"Risk Reduction: {result.risk_reduction_factor:.1f}x")
