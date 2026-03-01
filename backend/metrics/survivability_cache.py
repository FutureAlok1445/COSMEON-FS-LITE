import datetime
from typing import Optional
from backend.metrics.survivability import OrbitalReliabilitySimulator, SimulationConfig, SimulationResult
from backend.utils.ws_manager import manager

class SurvivabilityCache:
    def __init__(self):
        self.config = SimulationConfig()
        self.last_result: Optional[SimulationResult] = None
        
    def get_or_compute(self) -> SimulationResult:
        if self.last_result is None:
            simulator = OrbitalReliabilitySimulator(self.config)
            self.last_result = simulator.run()
        return self.last_result
        
    async def invalidate_and_rerun(self, trigger: str = "MANUAL", config_updates: dict = None):
        # We need to maintain state. If it's a restore, we reset bounds.
        if trigger in ["NODE_RESTORE", "FULL_RESTORE"]:
            self.config = SimulationConfig()
        elif trigger == "NODE_FAILURE":
            self.config.node_failure_prob_per_hour += 0.005
        elif trigger == "PLANE_FAILURE":
            self.config.plane_blackout_prob_per_hour += 0.01
        elif trigger == "SOLAR_FLARE":
            self.config.solar_flare_prob_per_hour += 0.02
        elif config_updates:
            for k, v in config_updates.items():
                if hasattr(self.config, k):
                    setattr(self.config, k, v)
                    
        previous_survival = self.last_result.survival_probability if self.last_result else 0.0
        
        simulator = OrbitalReliabilitySimulator(self.config)
        self.last_result = simulator.run()
        
        new_survival = self.last_result.survival_probability
        delta = new_survival - previous_survival
        
        # Format the delta sign
        direction = "NONE"
        if delta > 0.0000001:
            direction = "UP"
        elif delta < -0.0000001:
            direction = "DOWN"

        await manager.broadcast("SURVIVABILITY_UPDATE", {
            "trigger": trigger,
            "previous_survival": previous_survival,
            "new_survival": new_survival,
            "delta": delta,
            "direction": direction,
            "survival_percentage": f"{new_survival * 100:.5f}%",
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
        })
        
        return self.last_result

# Global singleton
cache = SurvivabilityCache()
