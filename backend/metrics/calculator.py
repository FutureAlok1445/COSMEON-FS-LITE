# backend/metrics/calculator.py
# Responsibility: Calculate all 6 live accuracy metrics for the dashboard
# MTTDL, Storage Efficiency, Shannon Entropy, Reconstruction Latency,
# Integrity Pass Rate, Cache Hit Rate

import math
import time
from typing import List, Dict, Optional

from backend.config import RS_K, RS_M, RS_TOTAL, ALL_NODES


# ─────────────────────────────────────────────
# METRIC 1 — MTTDL (Mean Time to Data Loss)
# ─────────────────────────────────────────────

def calculate_mttdl(
    num_nodes: int = RS_TOTAL,
    node_failure_rate: float = 2.28e-6,  # 2% annual failure rate → per-hour ≈ 0.02/8760
    recovery_time_hours: float = 1.0,  # time to replace/recover a failed node
    parity_count: int = RS_M,
) -> float:
    """
    MTTDL = (1 / C(n, m+1)) * (1 / (failure_rate^(m+1))) * (recovery_time^m)

    Where:
    - n = total nodes (6)
    - m = parity count (2) → system tolerates m failures
    - System loses data only when m+1 nodes fail simultaneously

    RS(4,2) with 6 nodes:
    - Can tolerate 2 simultaneous failures
    - Data loss requires 3+ simultaneous failures
    - MTTDL ≈ 10^14 hours (astronomical)

    Returns: MTTDL in hours (float)
    """
    m = parity_count
    n = num_nodes
    simultaneous_failures_needed = m + 1  # 3 for RS(4,2)

    # Combination C(n, k) = n! / (k! * (n-k)!)
    combinations = math.comb(n, simultaneous_failures_needed)

    # MTTDL formula
    numerator = 1.0
    denominator = combinations * (node_failure_rate ** simultaneous_failures_needed)

    if denominator == 0:
        return float('inf')

    # Factor in recovery time — faster recovery = higher MTTDL
    recovery_factor = recovery_time_hours ** m

    mttdl = (numerator / denominator) * recovery_factor

    return mttdl


def format_mttdl(mttdl_hours: float) -> str:
    """
    Format MTTDL in scientific notation for dashboard display.
    Example: 1.2 x10^14 hours
    """
    if mttdl_hours == float('inf'):
        return "∞ hours"
    if mttdl_hours <= 0:
        return "0 hours"

    exponent = int(math.log10(mttdl_hours))
    mantissa = mttdl_hours / (10 ** exponent)
    return f"{mantissa:.1f} × 10^{exponent} hours"


# ─────────────────────────────────────────────
# METRIC 2 — Storage Efficiency Ratio
# ─────────────────────────────────────────────

def calculate_storage_efficiency(
    data_chunks: int = RS_K,
    total_chunks: int = RS_TOTAL,
) -> dict:
    """
    Storage Efficiency = total_chunks / data_chunks

    RS(4,2): 6/4 = 1.5x overhead (50% extra storage)
    3x Replication: 3.0x overhead (200% extra storage)
    RS saves: 1 - (1.5/3.0) = 50% savings

    Returns dict with all display values.
    """
    rs_overhead = total_chunks / data_chunks        # 1.5
    replication_overhead = 3.0                       # industry standard comparison
    savings_percent = (1 - (rs_overhead / replication_overhead)) * 100  # 50%

    return {
        "rs_overhead":           round(rs_overhead, 2),          # 1.5
        "replication_overhead":  replication_overhead,            # 3.0
        "savings_percent":       round(savings_percent, 1),      # 50.0
        "rs_label":              f"{rs_overhead:.1f}x",          # "1.5x"
        "replication_label":     f"{replication_overhead:.1f}x", # "3.0x"
    }


# ─────────────────────────────────────────────
# METRIC 3 — Shannon Entropy (Distribution Balance)
# ─────────────────────────────────────────────

def calculate_entropy(chunk_counts: Dict[str, int]) -> float:
    """
    Shannon Entropy measures how evenly chunks are distributed across nodes.

    H = -Σ (p_i * log2(p_i)) / log2(N)

    Where:
    - p_i = fraction of chunks on node i
    - N = number of nodes
    - Result normalized to 0.0–1.0

    1.0 = perfectly balanced (all nodes have equal chunks)
    0.0 = all chunks on one node (worst case)
    < 0.85 = triggers rebalancer (Person 3)

    Args:
        chunk_counts: {node_id: number_of_chunks} e.g. {"SAT-01": 5, "SAT-02": 3, ...}

    Returns: normalized entropy float (0.0 to 1.0)
    """
    total = sum(chunk_counts.values())
    if total == 0:
        return 1.0  # no data = perfectly balanced (vacuously true)

    n = len(chunk_counts)
    if n <= 1:
        return 1.0

    max_entropy = math.log2(n)
    if max_entropy == 0:
        return 1.0

    entropy = 0.0
    for count in chunk_counts.values():
        if count > 0:
            p = count / total
            entropy -= p * math.log2(p)

    # Normalize to 0.0 – 1.0
    normalized = entropy / max_entropy
    return round(normalized, 4)


def entropy_status(entropy: float) -> str:
    """Return color-coded status label for entropy value."""
    if entropy >= 0.85:
        return "BALANCED"       # Green
    elif entropy >= 0.60:
        return "WARNING"        # Yellow — approaching imbalance
    else:
        return "CRITICAL"       # Red — rebalancer should trigger


# ─────────────────────────────────────────────
# METRIC 4 — Reconstruction Latency (Phase-by-Phase)
# ─────────────────────────────────────────────

class LatencyTracker:
    """
    Tracks reconstruction latency broken into phases:
    1. Fetch Phase — reading chunks from satellite nodes
    2. Decode Phase — RS mathematical reconstruction
    3. Assembly Phase — concatenating bytes
    4. Verify Phase — SHA-256 end-to-end check

    Usage:
        tracker = LatencyTracker()
        tracker.start_phase("fetch")
        ... do fetch ...
        tracker.end_phase("fetch")
        tracker.start_phase("decode")
        ... do decode ...
        tracker.end_phase("decode")
        report = tracker.report()
    """

    def __init__(self):
        self._phases: Dict[str, dict] = {}
        self._phase_order: List[str] = []
        self._total_start: Optional[float] = None

    def start_total(self) -> None:
        """Start the total reconstruction timer."""
        self._total_start = time.perf_counter()

    def start_phase(self, phase_name: str) -> None:
        """Start timing a specific phase."""
        self._phases[phase_name] = {"start": time.perf_counter(), "end": None, "ms": 0.0}
        if phase_name not in self._phase_order:
            self._phase_order.append(phase_name)

    def end_phase(self, phase_name: str) -> float:
        """End timing a phase. Returns duration in milliseconds."""
        if phase_name not in self._phases:
            return 0.0
        end = time.perf_counter()
        start = self._phases[phase_name]["start"]
        ms = (end - start) * 1000
        self._phases[phase_name]["end"] = end
        self._phases[phase_name]["ms"] = round(ms, 2)
        return ms

    @property
    def total_ms(self) -> float:
        """Total reconstruction time in milliseconds."""
        if self._total_start is None:
            return sum(p["ms"] for p in self._phases.values())
        return round((time.perf_counter() - self._total_start) * 1000, 2)

    def report(self) -> dict:
        """
        Generate latency report for dashboard.
        Returns dict with phase breakdown + total.
        """
        phases = {}
        for name in self._phase_order:
            if name in self._phases:
                phases[name] = self._phases[name]["ms"]

        total = sum(phases.values())

        return {
            "phases": phases,
            "total_ms": round(total, 2),
            "acceptable": total <= 50.0,  # max acceptable: 50ms
        }


# ─────────────────────────────────────────────
# METRIC 5 — Integrity Pass Rate
# ─────────────────────────────────────────────

class IntegrityCounter:
    """
    Tracks integrity verification attempts and passes.
    Across all 3 levels (write, read, file).
    Thread-safe via threading.Lock — record() is called from worker threads.
    """

    def __init__(self):
        import threading
        self._lock = threading.Lock()
        self._attempts = 0
        self._passes = 0

    def record(self, passed: bool) -> None:
        """Record an integrity check result. Thread-safe."""
        with self._lock:
            self._attempts += 1
            if passed:
                self._passes += 1

    @property
    def pass_rate(self) -> float:
        """Integrity pass rate as percentage (0.0 - 100.0)."""
        if self._attempts == 0:
            return 100.0  # no checks = 100% (vacuously true)
        return round((self._passes / self._attempts) * 100.0, 2)

    @property
    def attempts(self) -> int:
        return self._attempts

    @property
    def passes(self) -> int:
        return self._passes

    def reset(self) -> None:
        """Reset counters (used on chaos restore)."""
        self._attempts = 0
        self._passes = 0

    def stats(self) -> dict:
        return {
            "attempts": self._attempts,
            "passes": self._passes,
            "pass_rate": self.pass_rate,
        }


# ─────────────────────────────────────────────
# FULL METRICS SNAPSHOT
# Combines all metrics into one dict for WebSocket broadcast
# ─────────────────────────────────────────────

def get_full_metrics_snapshot(
    chunk_counts: Dict[str, int],
    integrity_counter: IntegrityCounter,
    cache_hit_rate: float,
    last_reconstruction_ms: float = 0.0,
    online_nodes: int = RS_TOTAL,
) -> dict:
    """
    Generate complete metrics snapshot for dashboard.
    Called by main.py → broadcast via WebSocket.
    """
    mttdl = calculate_mttdl(num_nodes=online_nodes)
    efficiency = calculate_storage_efficiency()
    entropy = calculate_entropy(chunk_counts)

    return {
        "mttdl_hours":              mttdl,
        "mttdl_display":            format_mttdl(mttdl),
        "storage_efficiency":       efficiency,
        "entropy":                  entropy,
        "entropy_status":           entropy_status(entropy),
        "integrity_pass_rate":      integrity_counter.pass_rate,
        "integrity_stats":          integrity_counter.stats(),
        "cache_hit_rate":           cache_hit_rate,
        "reconstruction_latency_ms": last_reconstruction_ms,
        "latency_acceptable":       last_reconstruction_ms <= 50.0,
    }


# ─────────────────────────────────────────────
# SINGLETON INSTANCES
# Import these directly from other modules
# ─────────────────────────────────────────────
integrity_counter = IntegrityCounter()
