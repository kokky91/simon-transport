from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_user
from app.core.infra_repository import InfraRepository

router = APIRouter(prefix="/infra", tags=["infra"])
infra_repository = InfraRepository()


class FarmWorldModel(BaseModel):
    id: str
    width_m: float
    height_m: float


class FieldPlotModel(BaseModel):
    id: str
    label: str
    crop_type: str
    x_m: float
    y_m: float
    width_m: float
    height_m: float


class BuildingModel(BaseModel):
    id: str
    field_id: str | None
    type: str
    x_m: float
    y_m: float
    width_m: float
    height_m: float


class InfraWorldResponse(BaseModel):
    mode: Literal["real", "sim"]
    farm: FarmWorldModel
    plots: list[FieldPlotModel]
    buildings: list[BuildingModel]


class CreateFieldRequest(BaseModel):
    label: str
    crop_type: str
    x_m: float
    y_m: float
    width_m: float
    height_m: float


class UpdatePositionRequest(BaseModel):
    x_m: float
    y_m: float


class UpdateFieldRequest(BaseModel):
    label: str
    crop_type: str
    x_m: float
    y_m: float
    width_m: float
    height_m: float


class UpdateBuildingRequest(BaseModel):
    type: str
    x_m: float
    y_m: float
    width_m: float
    height_m: float


@router.get("/world", response_model=InfraWorldResponse)
def get_world(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    mode: Literal["real", "sim"] = Query(default="real"),
    runId: str | None = Query(default=None),
) -> InfraWorldResponse:
    world = infra_repository.get_world(
        tenant_id=current_user.tenant_id,
        mode=mode,
        run_id=runId,
    )
    if not world:
        raise HTTPException(status_code=404, detail="No farm world found for tenant")

    return InfraWorldResponse(**world)


@router.post("/fields", response_model=FieldPlotModel)
def create_field(
    payload: CreateFieldRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> FieldPlotModel:
    try:
        field = infra_repository.create_real_field(
            tenant_id=current_user.tenant_id,
            label=payload.label.strip(),
            crop_type=payload.crop_type.strip(),
            x_m=payload.x_m,
            y_m=payload.y_m,
            width_m=payload.width_m,
            height_m=payload.height_m,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not field:
        raise HTTPException(status_code=404, detail="No farm world found for tenant")

    return FieldPlotModel(**field)


@router.patch("/fields/{field_id}/position", response_model=FieldPlotModel)
def update_field_position(
    field_id: str,
    payload: UpdatePositionRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    mode: Literal["real", "sim"] = Query(default="real"),
    runId: str | None = Query(default=None),
) -> FieldPlotModel:
    try:
        field = infra_repository.update_field_position(
            tenant_id=current_user.tenant_id,
            field_id=field_id,
            x_m=payload.x_m,
            y_m=payload.y_m,
            mode=mode,
            run_id=runId,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not field:
        raise HTTPException(status_code=404, detail="Field not found for tenant/mode")

    return FieldPlotModel(**field)


@router.patch("/buildings/{building_id}/position", response_model=BuildingModel)
def update_building_position(
    building_id: str,
    payload: UpdatePositionRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    mode: Literal["real", "sim"] = Query(default="real"),
    runId: str | None = Query(default=None),
) -> BuildingModel:
    try:
        building = infra_repository.update_building_position(
            tenant_id=current_user.tenant_id,
            building_id=building_id,
            x_m=payload.x_m,
            y_m=payload.y_m,
            mode=mode,
            run_id=runId,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not building:
        raise HTTPException(status_code=404, detail="Building not found for tenant/mode")

    return BuildingModel(**building)


@router.patch("/fields/{field_id}", response_model=FieldPlotModel)
def update_field(
    field_id: str,
    payload: UpdateFieldRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    mode: Literal["real", "sim"] = Query(default="real"),
    runId: str | None = Query(default=None),
) -> FieldPlotModel:
    try:
        field = infra_repository.update_field(
            tenant_id=current_user.tenant_id,
            field_id=field_id,
            label=payload.label.strip(),
            crop_type=payload.crop_type.strip(),
            x_m=payload.x_m,
            y_m=payload.y_m,
            width_m=payload.width_m,
            height_m=payload.height_m,
            mode=mode,
            run_id=runId,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not field:
        raise HTTPException(status_code=404, detail="Field not found for tenant/mode")

    return FieldPlotModel(**field)


@router.patch("/buildings/{building_id}", response_model=BuildingModel)
def update_building(
    building_id: str,
    payload: UpdateBuildingRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    mode: Literal["real", "sim"] = Query(default="real"),
    runId: str | None = Query(default=None),
) -> BuildingModel:
    try:
        building = infra_repository.update_building(
            tenant_id=current_user.tenant_id,
            building_id=building_id,
            building_type=payload.type.strip(),
            x_m=payload.x_m,
            y_m=payload.y_m,
            width_m=payload.width_m,
            height_m=payload.height_m,
            mode=mode,
            run_id=runId,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not building:
        raise HTTPException(status_code=404, detail="Building not found for tenant/mode")

    return BuildingModel(**building)


@router.delete("/fields/{field_id}", status_code=204)
def delete_field(
    field_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    mode: Literal["real", "sim"] = Query(default="real"),
    runId: str | None = Query(default=None),
) -> Response:
    try:
        deleted = infra_repository.delete_field(
            tenant_id=current_user.tenant_id,
            field_id=field_id,
            mode=mode,
            run_id=runId,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=404, detail="Field not found for tenant/mode")

    return Response(status_code=204)


@router.delete("/buildings/{building_id}", status_code=204)
def delete_building(
    building_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    mode: Literal["real", "sim"] = Query(default="real"),
    runId: str | None = Query(default=None),
) -> Response:
    try:
        deleted = infra_repository.delete_building(
            tenant_id=current_user.tenant_id,
            building_id=building_id,
            mode=mode,
            run_id=runId,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not deleted:
        raise HTTPException(status_code=404, detail="Building not found for tenant/mode")

    return Response(status_code=204)
