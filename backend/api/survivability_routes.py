from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from backend.metrics.survivability_cache import cache
from backend.metrics.survivability import SimulationConfig

router = APIRouter()

class RunRequest(BaseModel):
    num_simulations: Optional[int] = None
    mission_hours: Optional[int] = None
    total_chunks: Optional[int] = None
    recovery_threshold: Optional[int] = None
    node_failure_prob_per_hour: Optional[float] = None
    plane_blackout_prob_per_hour: Optional[float] = None
    solar_flare_prob_per_hour: Optional[float] = None
    corruption_prob_per_chunk: Optional[float] = None

@router.post("/api/survivability/run")
async def run_simulation(req: Optional[RunRequest] = None):
    config_updates = req.model_dump(exclude_unset=True) if req else {}
    result = await cache.invalidate_and_rerun("MANUAL", config_updates)
    return result.to_dict()

@router.get("/api/survivability/last")
async def get_last_simulation():
    result = cache.get_or_compute()
    return result.to_dict()

@router.get("/api/survivability/defaults")
async def get_defaults():
    return SimulationConfig().__dict__
