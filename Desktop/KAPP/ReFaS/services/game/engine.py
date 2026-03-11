import uuid

from game.components.production import ProductionComponent
from game.components.storage import StorageComponent
from game.core.event_bus import GameEventBus
from game.domain.entity import Entity
from game.domain.world import World
from game.systems.tick_system import TickSystem


class GameEngine:
    def __init__(self) -> None:
        self.world = World()
        self.tick_system = TickSystem()
        self.event_bus = GameEventBus()

    def bootstrap_default_world(self) -> None:
        barn = Entity(entity_id="barn-1", entity_type="barn")
        barn.add_component(StorageComponent(capacity=1000))
        barn.add_component(ProductionComponent(output_resource="compost", amount_per_cycle=15, interval_seconds=1.0))
        self.world.add_entity(barn)

    def tick(self, delta: float, tenant_id: str, trace_id: str | None = None) -> list[dict]:
        effective_trace_id = trace_id or f"game-{uuid.uuid4()}"
        events = self.tick_system.run(
            world=self.world,
            tenant_id=tenant_id,
            trace_id=effective_trace_id,
            delta=delta,
        )
        for event in events:
            self.event_bus.publish(event)
        return events

    def handle_command(self, command: dict) -> None:
        command_type = command.get("type")
        payload = command.get("payload") or {}

        if command_type == "BUILD":
            self._handle_build(payload)
            return

        if command_type == "SELL":
            self._handle_sell(payload)
            return

        if command_type == "ASSIGN":
            self._handle_assign(payload)
            return

        raise ValueError(f"Unsupported command type: {command_type}")

    def _handle_build(self, payload: dict) -> None:
        entity_id = str(payload.get("entityId", "")).strip()
        if not entity_id:
            raise ValueError("BUILD command requires entityId")

        if entity_id in self.world.entities:
            return

        capacity = int(payload.get("capacity", 1000))
        amount_per_cycle = int(payload.get("amountPerCycle", 15))
        interval_seconds = float(payload.get("intervalSeconds", 1.0))

        entity = Entity(entity_id=entity_id, entity_type="barn")
        entity.add_component(StorageComponent(capacity=capacity))
        entity.add_component(
            ProductionComponent(
                output_resource="compost",
                amount_per_cycle=amount_per_cycle,
                interval_seconds=interval_seconds,
            )
        )
        self.world.add_entity(entity)

    def _handle_sell(self, payload: dict) -> None:
        entity_id = str(payload.get("entityId", "")).strip()
        resource = str(payload.get("resource", "")).strip()
        amount = int(payload.get("amount", 0))

        if not entity_id or not resource or amount <= 0:
            raise ValueError("SELL command requires entityId, resource and amount > 0")

        entity = self.world.entities.get(entity_id)
        if entity is None:
            raise ValueError(f"SELL command entity not found: {entity_id}")

        storage_component = entity.get_component("storage")
        if not isinstance(storage_component, StorageComponent):
            raise ValueError(f"SELL command requires storage component: {entity_id}")

        current_amount = storage_component.resources.get(resource, 0)
        sold_amount = min(current_amount, amount)
        storage_component.resources[resource] = max(0, current_amount - sold_amount)

    def _handle_assign(self, payload: dict) -> None:
        entity_id = str(payload.get("entityId", "")).strip()
        worker_id = str(payload.get("workerId", "")).strip()
        if not entity_id or not worker_id:
            raise ValueError("ASSIGN command requires entityId and workerId")

        entity = self.world.entities.get(entity_id)
        if entity is None:
            raise ValueError(f"ASSIGN command entity not found: {entity_id}")

        return


engine = GameEngine()
engine.bootstrap_default_world()


if __name__ == "__main__":
    produced = engine.tick(delta=1.0, tenant_id="tenant-game-demo")
    print(f"Tick complete. Events published: {len(produced)}")
