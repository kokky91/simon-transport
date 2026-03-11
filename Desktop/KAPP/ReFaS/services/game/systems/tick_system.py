from game.domain.world import World
from game.systems.ai_system import AISystem
from game.systems.market_system import MarketSystem
from game.systems.production_system import ProductionSystem


class TickSystem:
    def __init__(self) -> None:
        self._systems = [
            ProductionSystem(),
            MarketSystem(),
            AISystem(),
        ]

    def run(self, world: World, tenant_id: str, trace_id: str, delta: float) -> list[dict]:
        events: list[dict] = []
        for system in self._systems:
            events.extend(system.run(world=world, tenant_id=tenant_id, trace_id=trace_id, delta=delta))
        return events
