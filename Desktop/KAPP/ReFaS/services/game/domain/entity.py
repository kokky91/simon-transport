from typing import TypeVar

from game.domain.component import Component

TComponent = TypeVar("TComponent", bound=Component)


class Entity:
    def __init__(self, entity_id: str, entity_type: str) -> None:
        self.id = entity_id
        self.type = entity_type
        self.components: dict[str, Component] = {}

    def add_component(self, component: Component) -> None:
        self.components[component.name] = component

    def get_component(self, name: str) -> Component | None:
        return self.components.get(name)

    def require_component(self, name: str) -> Component:
        component = self.get_component(name)
        if component is None:
            raise ValueError(f"Entity {self.id} missing component: {name}")
        return component
