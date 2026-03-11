from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser, get_current_user
from app.core.command_repository import CommandRepository

router = APIRouter(prefix="/game/actions", tags=["game-actions"])
command_repo = CommandRepository()


class BuildRequest(BaseModel):
    entityId: str = Field(min_length=1)
    capacity: int = Field(default=1000, ge=1)
    amountPerCycle: int = Field(default=15, ge=1)
    intervalSeconds: float = Field(default=1.0, gt=0)


class SellRequest(BaseModel):
    entityId: str = Field(min_length=1)
    resource: str = Field(min_length=1)
    amount: int = Field(ge=1)


class AssignRequest(BaseModel):
    entityId: str = Field(min_length=1)
    workerId: str = Field(min_length=1)


@router.post("/build")
def build_action(
    payload: BuildRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    command_id = command_repo.insert_command(
        world_id=current_user.world_id,
        tenant_id=current_user.tenant_id,
        command_type="BUILD",
        payload=payload.model_dump(),
    )
    return {"status": "accepted", "commandId": command_id}


@router.post("/sell")
def sell_action(
    payload: SellRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    command_id = command_repo.insert_command(
        world_id=current_user.world_id,
        tenant_id=current_user.tenant_id,
        command_type="SELL",
        payload=payload.model_dump(),
    )
    return {"status": "accepted", "commandId": command_id}


@router.post("/assign")
def assign_action(
    payload: AssignRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    command_id = command_repo.insert_command(
        world_id=current_user.world_id,
        tenant_id=current_user.tenant_id,
        command_type="ASSIGN",
        payload=payload.model_dump(),
    )
    return {"status": "accepted", "commandId": command_id}
