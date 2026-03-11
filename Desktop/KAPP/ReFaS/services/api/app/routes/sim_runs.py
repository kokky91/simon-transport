from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.auth import CurrentUser, get_current_user
from app.core.sim_repository import SimRepository

router = APIRouter(prefix="/sim", tags=["simulation"])
sim_repo = SimRepository()


class StartSimRunRequest(BaseModel):
    days: int = Field(ge=1, le=365)


class StartSimRunResponse(BaseModel):
    run_id: str
    status: str


class SimRunSummary(BaseModel):
    projected_cost_delta: float | None
    projected_duration_delta: float | None


class SimRunStatusResponse(BaseModel):
    run_id: str
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    summary: SimRunSummary


@router.post("/runs", response_model=StartSimRunResponse)
def start_sim_run(
    payload: StartSimRunRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> StartSimRunResponse:
    snapshot = sim_repo.build_domain_snapshot(tenant_id=current_user.tenant_id)
    created = sim_repo.create_run(
        tenant_id=current_user.tenant_id,
        world_id=current_user.world_id,
        days=payload.days,
        snapshot=snapshot,
    )
    return StartSimRunResponse(**created)


@router.get("/runs/{run_id}", response_model=SimRunStatusResponse)
def get_sim_run_status(
    run_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> SimRunStatusResponse:
    run = sim_repo.get_run_status(tenant_id=current_user.tenant_id, run_id=run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Simulation run not found")

    return SimRunStatusResponse(**run)
