from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from psycopg2 import Error as Psycopg2Error

from app.core.auth import CurrentUser, get_current_user
from app.core.task_repository import TaskRepository

router = APIRouter(prefix="/tasks", tags=["tasks"])
task_repository = TaskRepository()


class CreateTaskRequest(BaseModel):
    farmId: str = Field(min_length=1)
    taskType: str = Field(min_length=1)
    status: Literal["open", "planned", "in_progress", "done", "cancelled"] = "open"
    costAmount: float = Field(default=0, ge=0)
    estimatedCost: float = Field(default=0, ge=0)
    actualCost: float | None = Field(default=None, ge=0)
    startedAt: datetime | None = None
    completedAt: datetime | None = None


class CompleteTaskRequest(BaseModel):
    actualCost: float = Field(ge=0)
    completedAt: datetime | None = None
    notes: str | None = Field(default=None, max_length=1000)


def _normalize_status(status: str) -> str:
    if status == "planned":
        return "open"
    return status


def _allowed_transition(current_status: str, target_status: str) -> bool:
    transitions = {
        "open": {"in_progress", "cancelled"},
        "in_progress": {"done", "cancelled"},
        "done": set(),
        "cancelled": set(),
    }
    return target_status in transitions.get(current_status, set())


@router.get("")
def list_tasks(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    limit: int = Query(default=100, ge=1, le=500),
) -> dict:
    tasks = task_repository.list_tasks(tenant_id=current_user.tenant_id, limit=limit)
    return {"tasks": tasks, "count": len(tasks)}


@router.get("/efficiency")
def task_efficiency(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    days: int = Query(default=30, ge=1, le=365),
) -> dict:
    efficiency = task_repository.get_efficiency(tenant_id=current_user.tenant_id, days=days)
    return {"efficiency": efficiency}


@router.post("")
def create_task(
    payload: CreateTaskRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    status = _normalize_status(payload.status)

    if status == "done" and payload.completedAt is None:
        raise HTTPException(status_code=400, detail="completedAt is required when status is done")

    if status == "done" and payload.actualCost is None:
        raise HTTPException(status_code=400, detail="actualCost is required when status is done")

    if status == "cancelled" and payload.completedAt is not None:
        raise HTTPException(status_code=400, detail="completedAt must be null when status is cancelled")

    try:
        task = task_repository.create_task(
            tenant_id=current_user.tenant_id,
            farm_id=payload.farmId,
            task_type=payload.taskType,
            status=status,
            cost_amount=payload.costAmount,
            estimated_cost=payload.estimatedCost,
            actual_cost=payload.actualCost,
            started_at=payload.startedAt,
            completed_at=payload.completedAt,
        )
    except Psycopg2Error as exc:
        if exc.pgcode == "22P02":
            raise HTTPException(status_code=400, detail="farmId must be a valid UUID") from exc
        if exc.pgcode == "23503":
            raise HTTPException(status_code=400, detail="farmId not found for this tenant") from exc
        raise HTTPException(status_code=400, detail="Unable to create task") from exc

    return {"task": task}


@router.post("/{task_id}/start")
def start_task(
    task_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    current = task_repository.get_task(tenant_id=current_user.tenant_id, task_id=task_id)
    if current is None:
        raise HTTPException(status_code=404, detail="Task not found")

    current_status = _normalize_status(current["status"])
    if not _allowed_transition(current_status, "in_progress"):
        raise HTTPException(status_code=409, detail="Invalid transition to in_progress")

    task = task_repository.transition_task_status(
        tenant_id=current_user.tenant_id,
        task_id=task_id,
        to_status="in_progress",
        from_statuses=("open", "planned"),
        started_at=datetime.utcnow(),
    )
    if task is None:
        raise HTTPException(status_code=409, detail="Task transition conflict")

    return {"task": task}


@router.post("/{task_id}/complete")
def complete_task(
    task_id: str,
    payload: CompleteTaskRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    current = task_repository.get_task(tenant_id=current_user.tenant_id, task_id=task_id)
    if current is None:
        raise HTTPException(status_code=404, detail="Task not found")

    current_status = _normalize_status(current["status"])
    if not _allowed_transition(current_status, "done"):
        raise HTTPException(status_code=409, detail="Invalid transition to done")

    completed_at = payload.completedAt or datetime.utcnow()
    started_at = current.get("started_at") or completed_at
    task = task_repository.transition_task_status(
        tenant_id=current_user.tenant_id,
        task_id=task_id,
        to_status="done",
        from_statuses=("in_progress",),
        actual_cost=payload.actualCost,
        completion_note=payload.notes.strip() if payload.notes else None,
        completed_at=completed_at,
        started_at=started_at,
    )
    if task is None:
        raise HTTPException(status_code=409, detail="Task transition conflict")

    return {"task": task}


@router.post("/{task_id}/cancel")
def cancel_task(
    task_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> dict:
    current = task_repository.get_task(tenant_id=current_user.tenant_id, task_id=task_id)
    if current is None:
        raise HTTPException(status_code=404, detail="Task not found")

    current_status = _normalize_status(current["status"])
    if not _allowed_transition(current_status, "cancelled"):
        raise HTTPException(status_code=409, detail="Invalid transition to cancelled")

    task = task_repository.transition_task_status(
        tenant_id=current_user.tenant_id,
        task_id=task_id,
        to_status="cancelled",
        from_statuses=("open", "planned", "in_progress"),
        completed_at=None,
    )
    if task is None:
        raise HTTPException(status_code=409, detail="Task transition conflict")

    return {"task": task}