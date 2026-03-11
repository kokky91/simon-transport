from dataclasses import dataclass


@dataclass(frozen=True)
class DomainSnapshot:
    tenant_id: str
    world_id: str
    tasks: float
    fields: float
    costs: float
    avg_task_duration_minutes: float


class FarmSimEngine:
    def run(self, snapshot: DomainSnapshot, days: int) -> dict:
        horizon_factor = max(days, 1) / 30.0
        complexity_factor = 1.0 + (snapshot.fields * 0.01)

        projected_cost_delta = snapshot.costs * 0.03 * horizon_factor * complexity_factor
        projected_duration_delta = -(snapshot.avg_task_duration_minutes * 0.05 * horizon_factor)

        return {
            "projected_cost_delta": projected_cost_delta,
            "projected_duration_delta": projected_duration_delta,
        }
