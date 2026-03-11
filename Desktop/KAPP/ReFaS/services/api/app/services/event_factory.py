from datetime import datetime, timezone


def market_price_updated(tenant_id: str, crop_id: str, new_price: float, trace_id: str) -> dict:
    return {
        "type": "MARKET_PRICE_UPDATED",
        "version": 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "traceId": trace_id,
        "tenantId": tenant_id,
        "payload": {
            "cropId": crop_id,
            "newPrice": new_price,
        },
    }


def plant_extraction_queued(tenant_id: str, document_id: str, job_id: str, trace_id: str) -> dict:
    return {
        "type": "PLANT_EXTRACTION_QUEUED",
        "version": 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "traceId": trace_id,
        "tenantId": tenant_id,
        "payload": {
            "documentId": document_id,
            "jobId": job_id,
        },
    }


def plant_extraction_started(tenant_id: str, document_id: str, job_id: str, trace_id: str) -> dict:
    return {
        "type": "PLANT_EXTRACTION_STARTED",
        "version": 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "traceId": trace_id,
        "tenantId": tenant_id,
        "payload": {
            "documentId": document_id,
            "jobId": job_id,
        },
    }


def plant_extraction_succeeded(tenant_id: str, document_id: str, job_id: str, trace_id: str) -> dict:
    return {
        "type": "PLANT_EXTRACTION_SUCCEEDED",
        "version": 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "traceId": trace_id,
        "tenantId": tenant_id,
        "payload": {
            "documentId": document_id,
            "jobId": job_id,
        },
    }


def plant_extraction_failed(
    tenant_id: str,
    document_id: str,
    job_id: str,
    trace_id: str,
    status: str,
    retry_count: int,
    max_retries: int,
    error: str,
) -> dict:
    return {
        "type": "PLANT_EXTRACTION_FAILED",
        "version": 1,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "traceId": trace_id,
        "tenantId": tenant_id,
        "payload": {
            "documentId": document_id,
            "jobId": job_id,
            "status": status,
            "retryCount": retry_count,
            "maxRetries": max_retries,
            "error": error,
        },
    }
