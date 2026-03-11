from uuid import uuid4
from typing import Protocol
import importlib

from bootstrap import ensure_api_import_path

ensure_api_import_path()

_event_bus = importlib.import_module("app.core.event_bus")
_event_factory = importlib.import_module("app.services.event_factory")

publish_event = _event_bus.publish_event
plant_extraction_failed = _event_factory.plant_extraction_failed
plant_extraction_started = _event_factory.plant_extraction_started
plant_extraction_succeeded = _event_factory.plant_extraction_succeeded

from pipelines.animal_pipeline import process_animal_job
from pipelines.infra_pipeline import process_infra_job
from pipelines.plant_pipeline import process_plant_job


class Job(Protocol):
    tenant_id: str
    resource_id: str
    id: str
    resource_type: str


def _publish_started(job: Job) -> None:
    event = plant_extraction_started(
        tenant_id=job.tenant_id,
        document_id=job.resource_id,
        job_id=job.id,
        trace_id=str(uuid4()),
    )
    publish_event(event)


def _publish_succeeded(job: Job) -> None:
    event = plant_extraction_succeeded(
        tenant_id=job.tenant_id,
        document_id=job.resource_id,
        job_id=job.id,
        trace_id=str(uuid4()),
    )
    publish_event(event)


def _publish_failed(job: Job, status: str, retry_count: int, max_retries: int, error: str) -> None:
    event = plant_extraction_failed(
        tenant_id=job.tenant_id,
        document_id=job.resource_id,
        job_id=job.id,
        trace_id=str(uuid4()),
        status=status,
        retry_count=retry_count,
        max_retries=max_retries,
        error=error,
    )
    publish_event(event)


def _process_job_by_type(job: Job, repository: object) -> None:
    if job.resource_type == "plant":
        process_plant_job(job=job, repository=repository)
        return

    if job.resource_type == "animal":
        process_animal_job(job=job, repository=repository)
        return

    if job.resource_type == "infra":
        process_infra_job(job=job, repository=repository)
        return

    raise RuntimeError(f"Unsupported resource_type: {job.resource_type}")


def dispatch_job(job: Job, repository: object) -> None:
    _publish_started(job)
    _process_job_by_type(job=job, repository=repository)
    _publish_succeeded(job)


def publish_failed_state(job: Job, state: dict) -> None:
    _publish_failed(
        job=job,
        status=str(state.get("status") or "failed"),
        retry_count=int(state.get("retry_count") or 0),
        max_retries=int(state.get("max_retries") or 0),
        error=str(state.get("last_error") or "unknown"),
    )
