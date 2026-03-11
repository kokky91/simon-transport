import logging
import os
import time

from bootstrap import ensure_api_import_path

ensure_api_import_path()

from dispatcher import dispatch_job, publish_failed_state
from job_repository import ExtractionJobRepository

logger = logging.getLogger("data_extractor")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

POLL_INTERVAL_SECONDS = float(os.getenv("EXTRACTOR_POLL_INTERVAL_SECONDS", "1.0"))
BATCH_SIZE = int(os.getenv("EXTRACTOR_BATCH_SIZE", "10"))


def start_loop() -> None:
    repository = ExtractionJobRepository()

    while True:
        jobs = repository.claim_jobs(limit=BATCH_SIZE)
        if not jobs:
            time.sleep(POLL_INTERVAL_SECONDS)
            continue

        for job in jobs:
            try:
                dispatch_job(job=job, repository=repository)
            except Exception as exc:
                state = repository.mark_job_failed(job_id=job.id, error=str(exc))
                logger.exception(
                    "Extraction job failed",
                    extra={
                        "jobId": job.id,
                        "tenantId": job.tenant_id,
                        "resourceType": job.resource_type,
                        "resourceId": job.resource_id,
                        "status": state.get("status"),
                        "retryCount": state.get("retry_count"),
                    },
                )
                publish_failed_state(job=job, state=state)


def main() -> None:
    logger.info("Starting data-extractor service")
    start_loop()


if __name__ == "__main__":
    main()
