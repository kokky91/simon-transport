import json
import os
from dataclasses import dataclass
from typing import Any

import psycopg2
from psycopg2.extras import Json, RealDictCursor


@dataclass
class ExtractionJob:
    id: str
    tenant_id: str
    resource_type: str
    resource_id: str
    payload: dict[str, Any]
    retry_count: int
    max_retries: int


class ExtractionJobRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self._database_url = database_url or os.getenv(
            "DATABASE_URL",
            "postgresql://postgres:postgres@db:5432/farmplatform",
        )

    def claim_jobs(self, limit: int = 10) -> list[ExtractionJob]:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    WITH claimable AS (
                        SELECT id
                        FROM real.extraction_jobs
                        WHERE status IN ('queued', 'failed')
                          AND next_attempt_at <= NOW()
                        ORDER BY next_attempt_at ASC, created_at ASC
                        FOR UPDATE SKIP LOCKED
                        LIMIT %s
                    )
                    UPDATE real.extraction_jobs j
                    SET status = 'processing',
                        updated_at = NOW()
                    FROM claimable
                    WHERE j.id = claimable.id
                    RETURNING j.id, j.tenant_id, j.resource_type, j.resource_id, j.payload, j.retry_count, j.max_retries
                    """,
                    (limit,),
                )
                rows = cursor.fetchall() or []

        jobs: list[ExtractionJob] = []
        for row in rows:
            payload = row.get("payload")
            if isinstance(payload, str):
                try:
                    payload = json.loads(payload)
                except json.JSONDecodeError:
                    payload = {}
            if not isinstance(payload, dict):
                payload = {}

            jobs.append(
                ExtractionJob(
                    id=str(row["id"]),
                    tenant_id=str(row["tenant_id"]),
                    resource_type=str(row["resource_type"]),
                    resource_id=str(row["resource_id"]),
                    payload=payload,
                    retry_count=int(row.get("retry_count") or 0),
                    max_retries=int(row.get("max_retries") or 0),
                )
            )

        return jobs

    def get_plant_document(self, tenant_id: str, document_id: str) -> dict[str, Any] | None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, plant_name, file_name, content_type, file_data, reviewed_data
                    FROM real.plant_documents
                    WHERE id = %s::uuid
                      AND tenant_id = %s::uuid
                    LIMIT 1
                    """,
                    (document_id, tenant_id),
                )
                row = cursor.fetchone()

        if not row:
            return None

        return {
            "id": str(row["id"]),
            "tenant_id": str(row["tenant_id"]),
            "plant_name": str(row.get("plant_name") or "").strip(),
            "file_name": str(row.get("file_name") or ""),
            "content_type": str(row.get("content_type") or ""),
            "file_data": bytes(row.get("file_data") or b""),
            "reviewed_data": row.get("reviewed_data") if isinstance(row.get("reviewed_data"), dict) else {},
        }

    def mark_job_succeeded(
        self,
        job_id: str,
        tenant_id: str,
        document_id: str,
        extracted_text: str,
        ai_summary: str,
        ai_prefill: dict[str, Any],
    ) -> None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE real.plant_documents
                    SET extracted_text = %s,
                        ai_summary = %s,
                        ai_prefill = %s,
                        reviewed_data = CASE
                            WHEN reviewed_data = '{}'::jsonb THEN %s
                            ELSE reviewed_data
                        END
                    WHERE id = %s::uuid
                      AND tenant_id = %s::uuid
                    """,
                    (
                        extracted_text,
                        ai_summary,
                        Json(ai_prefill),
                        Json(ai_prefill),
                        document_id,
                        tenant_id,
                    ),
                )

                cursor.execute(
                    """
                    UPDATE real.extraction_jobs
                    SET status = 'succeeded',
                        updated_at = NOW(),
                        last_error = NULL
                    WHERE id = %s::uuid
                    """,
                    (job_id,),
                )

    def mark_job_failed(self, job_id: str, error: str) -> dict[str, Any]:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    UPDATE real.extraction_jobs
                    SET retry_count = retry_count + 1,
                        status = CASE
                            WHEN retry_count + 1 >= max_retries THEN 'deadletter'
                            ELSE 'failed'
                        END,
                        next_attempt_at = NOW() + (LEAST(POWER(2, retry_count + 1)::int, 300) * INTERVAL '1 second'),
                        last_error = %s,
                        updated_at = NOW()
                    WHERE id = %s::uuid
                    RETURNING id, tenant_id, resource_type, resource_id, status, retry_count, max_retries, last_error
                    """,
                    (error[:2000], job_id),
                )
                row = cursor.fetchone()

        if not row:
            return {"status": "failed", "retry_count": 0, "max_retries": 0, "last_error": error[:2000]}

        return {
            "id": str(row["id"]),
            "tenant_id": str(row["tenant_id"]),
            "resource_type": str(row["resource_type"]),
            "resource_id": str(row["resource_id"]),
            "status": str(row["status"]),
            "retry_count": int(row.get("retry_count") or 0),
            "max_retries": int(row.get("max_retries") or 0),
            "last_error": str(row.get("last_error") or ""),
        }
