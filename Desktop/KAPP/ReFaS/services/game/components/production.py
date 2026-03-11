from game.domain.component import Component


class ProductionComponent(Component):
    def __init__(self, output_resource: str, amount_per_cycle: int, interval_seconds: float) -> None:
        super().__init__("production")
        self.output_resource = output_resource
        self.amount_per_cycle = amount_per_cycle
        self.interval_seconds = interval_seconds
        self.progress_seconds = 0.0
