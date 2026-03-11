from game.domain.entity import Entity


class World:
    def __init__(self) -> None:
        self.entities: dict[str, Entity] = {}

    def add_entity(self, entity: Entity) -> None:
        self.entities[entity.id] = entity

    def all_entities(self) -> list[Entity]:
        return list(self.entities.values())
