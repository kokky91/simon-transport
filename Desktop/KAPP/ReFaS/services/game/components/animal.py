from game.domain.component import Component


class AnimalComponent(Component):
    def __init__(self, species: str, health: float = 1.0) -> None:
        super().__init__("animal")
        self.species = species
        self.health = health
