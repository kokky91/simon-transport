from datetime import datetime, timedelta, timezone
from typing import Annotated
from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.core.auth import CurrentUser, require_role
from app.core.plant_document_repository import PlantDocumentRepository

router = APIRouter(prefix="/admin", tags=["admin"])
plant_document_repository = PlantDocumentRepository()

ALLOWED_SORT_FIELDS = {
    "avg_score": "avg_score",
    "avg_latency_ms": "avg_latency_ms",
    "win_rate": "win_rate",
    "total_runs": "total_runs",
}
ALLOWED_SORT_ORDERS = {"asc", "desc"}


@router.get("/ai/performance")
def get_model_performance(
    current_user: Annotated[CurrentUser, Depends(require_role("admin"))],
    from_datetime: Annotated[datetime | None, Query(alias="from")] = None,
    to_datetime: datetime | None = None,
    range_key: Annotated[Literal["7d", "30d", "90d"], Query(alias="range")] = "30d",
    prompt_version: str | None = None,
    sort: str = "win_rate",
    order: str = "desc",
) -> list[dict]:
    now = datetime.now(timezone.utc)
    resolved_to = to_datetime or now

    if from_datetime is not None and to_datetime is not None:
        resolved_from = from_datetime
    else:
        range_to_days = {
            "7d": 7,
            "30d": 30,
            "90d": 90,
        }
        resolved_from = from_datetime or (resolved_to - timedelta(days=range_to_days.get(range_key, 30)))

    if resolved_from > resolved_to:
        resolved_from, resolved_to = resolved_to, resolved_from

    resolved_sort = ALLOWED_SORT_FIELDS.get(sort, "win_rate")
    resolved_order = order.lower() if order.lower() in ALLOWED_SORT_ORDERS else "desc"

    return plant_document_repository.list_ai_model_performance(
        tenant_id=current_user.tenant_id,
        from_datetime=resolved_from,
        to_datetime=resolved_to,
        prompt_version=prompt_version,
        sort_field=resolved_sort,
        sort_order=resolved_order,
    )
