from game.domain.component import Component


class StorageComponent(Component):
    def __init__(self, capacity: int) -> None:
        super().__init__("storage")
        self.capacity = capacity
        self.resources: dict[str, int] = {}

    @property
    def used_capacity(self) -> int:
        return sum(self.resources.values())

    @property
    def free_capacity(self) -> int:
        return max(0, self.capacity - self.used_capacity)

    def store(self, resource: str, amount: int) -> int:
        stored_amount = max(0, min(amount, self.free_capacity))
        if stored_amount <= 0:
            return 0
        self.resources[resource] = self.resources.get(resource, 0) + stored_amount
        return stored_amount
