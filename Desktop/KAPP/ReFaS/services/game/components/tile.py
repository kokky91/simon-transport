from game.domain.component import Component


class TileComponent(Component):
    def __init__(self, tile_id: str, fertility: float = 1.0) -> None:
        super().__init__("tile")
        self.tile_id = tile_id
        self.fertility = fertility
