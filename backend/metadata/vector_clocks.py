# backend/metadata/vector_clocks.py
# Person 2 owns this file
# Responsibility: Handle all mathematical conflict resolution for Split-Brain partitions.
# Replaces centralized store.json timestamps with mathematical ordering.

from typing import Dict, Tuple

VectorClock = Dict[str, int]


def increment_clock(clock: VectorClock, node_id: str) -> VectorClock:
    """Increment the event counter for a specific node in the vector clock."""
    new_clock = clock.copy()
    new_clock[node_id] = new_clock.get(node_id, 0) + 1
    return new_clock


def compare_clocks(clock1: VectorClock, clock2: VectorClock) -> str:
    """
    Compares two vector clocks to determine causality during a network merge.
    Returns:
    - 'LESS_THAN': clock1 happened before clock2
    - 'GREATER_THAN': clock1 happened after clock2
    - 'EQUAL': clocks are identical
    - 'CONCURRENT': independent events (Split-Brain conflict detected)
    """
    all_nodes = set(clock1.keys()).union(set(clock2.keys()))
    
    is_less_than = False
    is_greater_than = False
    
    for node in all_nodes:
        val1 = clock1.get(node, 0)
        val2 = clock2.get(node, 0)
        
        if val1 < val2:
            is_less_than = True
        elif val1 > val2:
            is_greater_than = True
            
    if is_less_than and is_greater_than:
        return 'CONCURRENT'
    elif is_less_than:
        return 'LESS_THAN'
    elif is_greater_than:
        return 'GREATER_THAN'
    else:
        return 'EQUAL'


def merge_clocks(clock1: VectorClock, clock2: VectorClock) -> VectorClock:
    """
    Merge two vector clocks by taking the maximum value for each node.
    Used when resolving a CONCURRENT split-brain state.
    """
    all_nodes = set(clock1.keys()).union(set(clock2.keys()))
    merged_clock = {}
    
    for node in all_nodes:
        merged_clock[node] = max(clock1.get(node, 0), clock2.get(node, 0))
        
    return merged_clock


def resolve_split_brain(state_a: dict, clock_a: VectorClock, state_b: dict, clock_b: VectorClock) -> Tuple[dict, VectorClock]:
    """
    Evaluates two conflicting FileRecords arriving from different orbital planes.
    Returns the chronologically correct state and the merged causal clock.
    """
    relation = compare_clocks(clock_a, clock_b)
    
    if relation == 'LESS_THAN':
        # B is newer, adopt B
        return state_b, clock_b
    elif relation == 'GREATER_THAN':
        # A is newer, adopt A
        return state_a, clock_a
    elif relation == 'EQUAL':
        # Identical states
        return state_a, clock_a
    else:
        # CONCURRENT: Both planes modified the file independently while partitioned.
        # Deterministic fallback: adopt the state with the most chunks (e.g. survival bias)
        # or fall back to lexical ordering of file_id metadata.
        print(f"[VECTOR-CLOCK] ⚠️ SPlIT-BRAIN CONFLICT DETECTED. Merging causality.")
        merged_clock = merge_clocks(clock_a, clock_b)
        
        # Simple resolution policy: largest size wins (e.g. metadata with most chunks appended)
        if state_a.get('size', 0) >= state_b.get('size', 0):
            return state_a, merged_clock
        else:
            return state_b, merged_clock
