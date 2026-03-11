from datetime import datetime, timezone

from game.components.production import ProductionComponent
from game.components.storage import StorageComponent
from game.domain.world import World


class ProductionSystem:
    def run(self, world: World, tenant_id: str, trace_id: str, delta: float) -> list[dict]:
        events: list[dict] = []

        for entity in world.all_entities():
            production_component = entity.get_component("production")
            storage_component = entity.get_component("storage")

            if not isinstance(production_component, ProductionComponent):
                continue
            if not isinstance(storage_component, StorageComponent):
                continue

            production_component.progress_seconds += delta
            cycles = 0
            while production_component.progress_seconds >= production_component.interval_seconds:
                production_component.progress_seconds -= production_component.interval_seconds
                cycles += 1

            if cycles <= 0:
                continue

            requested_amount = production_component.amount_per_cycle * cycles

            produced_amount = storage_component.store(
                resource=production_component.output_resource,
                amount=requested_amount,
            )
            if produced_amount <= 0:
                continue

            total_resource = storage_component.resources.get(production_component.output_resource, 0)
            events.append(
                {
                    "type": "COMPOST_PRODUCED",
                    "version": 1,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "traceId": trace_id,
                    "tenantId": tenant_id,
                    "payload": {
                        "entityId": entity.id,
                        "resource": production_component.output_resource,
                        "producedAmount": produced_amount,
                        "totalStored": total_resource,
                    },
                }
            )

        return events
