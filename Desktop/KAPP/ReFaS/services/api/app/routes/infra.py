from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

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
    z_height_m: float = 1.0
    bio_border: bool = False
    bio_border_width_m: float | None = None
    bio_border_plants: list[str] = []


class BuildingModel(BaseModel):
    id: str
    field_id: str | None
    type: str
    x_m: float
    y_m: float
    width_m: float
    height_m: float
    z_height_m: float = 2.0


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
    z_height_m: float = 1.0
    bio_border: bool = False
    bio_border_width_m: float | None = None
    bio_border_plants: list[str] = []


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
    z_height_m: float = 1.0
    bio_border: bool = False
    bio_border_width_m: float | None = None
    bio_border_plants: list[str] = []


class UpdateBuildingRequest(BaseModel):
    type: str
    x_m: float
    y_m: float
    width_m: float
    height_m: float
    z_height_m: float = 2.0


class CreateBuildingRequest(BaseModel):
    type: str
    field_id: str | None = None
    x_m: float = 0.0
    y_m: float = 0.0
    width_m: float = Field(gt=0)
    height_m: float = Field(gt=0)
    z_height_m: float = 2.0


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


@router.get("/fields", response_model=list[FieldPlotModel])
def get_fields(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    mode: Literal["real", "sim"] = Query(default="real"),
    runId: str | None = Query(default=None),
) -> list[FieldPlotModel]:
    world = infra_repository.get_world(
        tenant_id=current_user.tenant_id,
        mode=mode,
        run_id=runId,
    )
    if not world:
        return []
    return [FieldPlotModel(**p) for p in world["plots"]]


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
            bio_border=payload.bio_border,
            bio_border_width_m=payload.bio_border_width_m,
            bio_border_plants=payload.bio_border_plants,
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


@router.post("/buildings", response_model=BuildingModel)
def create_building(
    payload: CreateBuildingRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> BuildingModel:
    building = infra_repository.create_real_building(
        tenant_id=current_user.tenant_id,
        building_type=payload.type.strip(),
        field_id=payload.field_id,
        x_m=payload.x_m,
        y_m=payload.y_m,
        width_m=payload.width_m,
        height_m=payload.height_m,
    )
    if not building:
        raise HTTPException(status_code=404, detail="No farm world found for tenant")
    return BuildingModel(**building)


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
            bio_border=payload.bio_border,
            bio_border_width_m=payload.bio_border_width_m,
            bio_border_plants=payload.bio_border_plants,
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


class BedModel(BaseModel):
    id: str
    field_id: str | None
    label: str
    width_m: float
    length_m: float
    depth_cm: float
    path_cm: float
    x_m: float
    y_m: float


class CreateBedRequest(BaseModel):
    label: str
    width_m: float
    length_m: float
    depth_cm: float = 30.0
    path_cm: float = 30.0


@router.get("/beds", response_model=list[BedModel])
def get_beds(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> list[BedModel]:
    beds = infra_repository.get_beds(tenant_id=current_user.tenant_id)
    return [BedModel(**b) for b in beds]


@router.post("/beds", response_model=BedModel)
def create_bed(
    payload: CreateBedRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> BedModel:
    try:
        bed = infra_repository.create_bed(
            tenant_id=current_user.tenant_id,
            label=payload.label.strip(),
            width_m=payload.width_m,
            length_m=payload.length_m,
            depth_cm=payload.depth_cm,
            path_cm=payload.path_cm,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return BedModel(**bed)


@router.delete("/beds/{bed_id}", status_code=204)
def delete_bed(
    bed_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> Response:
    deleted = infra_repository.delete_bed(
        tenant_id=current_user.tenant_id,
        bed_id=bed_id,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Bed not found")
    return Response(status_code=204)


class UpdateBedRequest(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    width_m: float = Field(..., gt=0)
    length_m: float = Field(..., gt=0)
    depth_cm: float = Field(..., gt=0)
    path_cm: float = Field(..., ge=0)


@router.patch("/beds/{bed_id}", response_model=BedModel)
def update_bed(
    bed_id: str,
    payload: UpdateBedRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> BedModel:
    updated = infra_repository.update_bed(
        tenant_id=current_user.tenant_id,
        bed_id=bed_id,
        label=payload.label.strip(),
        width_m=payload.width_m,
        length_m=payload.length_m,
        depth_cm=payload.depth_cm,
        path_cm=payload.path_cm,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Bed not found")
    return BedModel(**updated)


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
