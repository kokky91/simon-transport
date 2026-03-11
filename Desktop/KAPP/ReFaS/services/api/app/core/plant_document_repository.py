from datetime import datetime
from decimal import Decimal
import re
from uuid import UUID, uuid4

import psycopg2
from psycopg2.extras import Json, RealDictCursor

from app.core.config import settings


class PlantDocumentRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self._database_url = database_url or settings.DATABASE_URL

    def create_document(
        self,
        tenant_id: str,
        plant_name: str,
        file_name: str,
        content_type: str,
        file_size_bytes: int,
        file_data: bytes,
        extracted_text: str | None,
        ai_summary: str | None,
        ai_prefill: dict,
        reviewed_data: dict,
    ) -> dict:
        document_id = str(uuid4())

        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    INSERT INTO real.plant_documents (
                        id,
                        tenant_id,
                        plant_name,
                        file_name,
                        content_type,
                        file_size_bytes,
                        file_data,
                        extracted_text,
                        ai_summary,
                        ai_prefill,
                        reviewed_data
                    )
                    VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, plant_name, file_name, content_type, file_size_bytes, ai_summary, ai_prefill, reviewed_data, uploaded_at
                    """,
                    (
                        document_id,
                        tenant_id,
                        plant_name,
                        file_name,
                        content_type,
                        file_size_bytes,
                        psycopg2.Binary(file_data),
                        extracted_text,
                        ai_summary,
                        Json(ai_prefill),
                        Json(reviewed_data),
                    ),
                )
                created = cursor.fetchone()

        if not created:
            raise ValueError("Document creation failed")

        return self._normalize_document_row(dict(created))

    def find_duplicate_document(
        self,
        tenant_id: str,
        plant_name: str,
        scientific_name: str | None = None,
    ) -> dict | None:
        normalized_scientific_name = (scientific_name or "").strip()

        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        plant_name,
                        file_name,
                        uploaded_at,
                        reviewed_data->>'scientific_name' AS scientific_name
                    FROM real.plant_documents
                    WHERE tenant_id = %s::uuid
                      AND (
                          lower(plant_name) = lower(%s)
                          OR (
                              %s <> ''
                              AND lower(coalesce(reviewed_data->>'scientific_name', '')) = lower(%s)
                          )
                      )
                    ORDER BY uploaded_at DESC
                    LIMIT 1
                    """,
                    (
                        tenant_id,
                        plant_name,
                        normalized_scientific_name,
                        normalized_scientific_name,
                    ),
                )
                found = cursor.fetchone()

        if not found:
            return None

        return self._normalize_document_row(dict(found))

    def find_plant_by_scientific_name(
        self,
        tenant_id: str,
        scientific_name_normalized: str,
    ) -> dict | None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT
                        p.id,
                        p.tenant_id,
                        p.scientific_name_normalized,
                        p.active_version_id,
                        p.created_at,
                        p.is_active
                    FROM real.plants p
                    WHERE p.tenant_id = %s::uuid
                      AND p.scientific_name_normalized = %s
                    LIMIT 1
                    """,
                    (tenant_id, scientific_name_normalized),
                )
                found = cursor.fetchone()

        if not found:
            return None

        return self._normalize_plant_row(dict(found))

    def get_active_plant_version_by_scientific_name(
        self,
        tenant_id: str,
        scientific_name_normalized: str,
    ) -> dict | None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT
                        p.id AS plant_id,
                        p.active_version_id,
                        pv.id AS version_id,
                        pv.version_number,
                        pv.snapshot_json,
                        pv.confidence_score,
                        pv.created_at
                    FROM real.plants p
                    LEFT JOIN real.plant_versions pv ON pv.id = p.active_version_id
                    WHERE p.tenant_id = %s::uuid
                      AND p.scientific_name_normalized = %s
                    LIMIT 1
                    """,
                    (tenant_id, scientific_name_normalized),
                )
                found = cursor.fetchone()

        if not found:
            return None

        row = dict(found)
        for key in ("plant_id", "active_version_id", "version_id"):
            if isinstance(row.get(key), UUID):
                row[key] = str(row[key])

        if isinstance(row.get("confidence_score"), Decimal):
            row["confidence_score"] = int(row["confidence_score"])

        return row

    def list_plant_versions(
        self,
        tenant_id: str,
        plant_id: str,
        limit: int = 20,
    ) -> list[dict]:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT
                        pv.id,
                        pv.plant_id,
                        pv.tenant_id,
                        pv.version_number,
                        pv.snapshot_json,
                        pv.confidence_score,
                        pv.created_at,
                        pv.created_by,
                        pv.source_document_id,
                        pv.source_generation_id
                    FROM real.plant_versions pv
                    JOIN real.plants p ON p.id = pv.plant_id
                    WHERE pv.tenant_id = %s::uuid
                      AND p.tenant_id = %s::uuid
                      AND pv.plant_id = %s::uuid
                    ORDER BY pv.version_number DESC
                    LIMIT %s
                    """,
                    (tenant_id, tenant_id, plant_id, limit),
                )
                rows = cursor.fetchall() or []

        return [self._normalize_plant_version_row(dict(row)) for row in rows]

    def create_plant_version(
        self,
        tenant_id: str,
        scientific_name: str,
        snapshot_json: dict,
        confidence_score: int,
        created_by: str,
        climate_zones: list[str] | None = None,
        soil_types: list[str] | None = None,
        ai_model_used: str | None = None,
        prompt_version: str | None = None,
        review_status: str | None = None,
        source_type: str | None = None,
        source_reference: str | None = None,
        source_document_id: str | None = None,
        source_generation_id: str | None = None,
    ) -> dict:
        normalized_name = self.normalize_scientific_name(scientific_name)
        plant_id = str(uuid4())
        version_id = str(uuid4())
        normalized_climate_zones = self._normalize_text_list(climate_zones)
        normalized_soil_types = self._normalize_text_list(soil_types)
        resolved_review_status = (review_status or "reviewed").strip() or "reviewed"
        resolved_source_type = (source_type or "pdf").strip() or "pdf"
        resolved_source_reference = (source_reference or "").strip() or None
        resolved_ai_model_used = (ai_model_used or "").strip() or None
        resolved_prompt_version = (prompt_version or "").strip() or None

        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    INSERT INTO real.plants (
                        id,
                        tenant_id,
                        scientific_name_normalized,
                        created_by
                    )
                    VALUES (%s::uuid, %s::uuid, %s, %s)
                    ON CONFLICT (tenant_id, scientific_name_normalized) DO NOTHING
                    RETURNING id, tenant_id, scientific_name_normalized, active_version_id, created_at, is_active
                    """,
                    (plant_id, tenant_id, normalized_name, created_by),
                )
                plant_row = cursor.fetchone()

                if not plant_row:
                    cursor.execute(
                        """
                        SELECT id, tenant_id, scientific_name_normalized, active_version_id, created_at, is_active
                        FROM real.plants
                        WHERE tenant_id = %s::uuid
                          AND scientific_name_normalized = %s
                        LIMIT 1
                        FOR UPDATE
                        """,
                        (tenant_id, normalized_name),
                    )
                    plant_row = cursor.fetchone()
                else:
                    cursor.execute(
                        """
                        SELECT id
                        FROM real.plants
                        WHERE id = %s::uuid
                        FOR UPDATE
                        """,
                        (plant_row["id"],),
                    )

                if not plant_row:
                    raise ValueError("Unable to resolve plant row")

                resolved_plant_id = str(plant_row["id"])

                cursor.execute(
                    """
                    SELECT version_number
                    FROM real.plant_versions
                    WHERE plant_id = %s::uuid
                    ORDER BY version_number DESC
                    LIMIT 1
                    FOR UPDATE
                    """,
                    (resolved_plant_id,),
                )
                row = cursor.fetchone()
                version_number = int(row["version_number"]) + 1 if row else 1

                cursor.execute(
                    """
                    INSERT INTO real.plant_versions (
                        id,
                        plant_id,
                        tenant_id,
                        version_number,
                        snapshot_json,
                        confidence_score,
                        scientific_name,
                        source_type,
                        source_reference,
                        ai_model_used,
                        prompt_version,
                        review_status,
                        created_by,
                        source_document_id,
                        source_generation_id
                    )
                    VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::uuid, %s::uuid)
                    RETURNING id, plant_id, tenant_id, version_number, snapshot_json, confidence_score, scientific_name, source_type, source_reference, ai_model_used, prompt_version, review_status, created_at, created_by, source_document_id, source_generation_id
                    """,
                    (
                        version_id,
                        resolved_plant_id,
                        tenant_id,
                        version_number,
                        Json(snapshot_json),
                        confidence_score,
                        scientific_name.strip(),
                        resolved_source_type,
                        resolved_source_reference,
                        resolved_ai_model_used,
                        resolved_prompt_version,
                        resolved_review_status,
                        created_by,
                        source_document_id,
                        source_generation_id,
                    ),
                )
                created_version = cursor.fetchone()

                for climate_zone in normalized_climate_zones:
                    cursor.execute(
                        """
                        INSERT INTO real.plant_version_climate_zones (id, plant_version_id, climate_zone)
                        VALUES (%s::uuid, %s::uuid, %s)
                        """,
                        (str(uuid4()), version_id, climate_zone),
                    )

                for soil_type in normalized_soil_types:
                    cursor.execute(
                        """
                        INSERT INTO real.plant_version_soil_types (id, plant_version_id, soil_type)
                        VALUES (%s::uuid, %s::uuid, %s)
                        """,
                        (str(uuid4()), version_id, soil_type),
                    )

                cursor.execute(
                    """
                    UPDATE real.plants
                    SET active_version_id = %s::uuid,
                        is_active = TRUE
                    WHERE id = %s::uuid
                      AND tenant_id = %s::uuid
                    RETURNING id, tenant_id, scientific_name_normalized, active_version_id, created_at, is_active
                    """,
                    (version_id, resolved_plant_id, tenant_id),
                )
                updated_plant = cursor.fetchone()

        if not created_version or not updated_plant:
            raise ValueError("Plant version write failed")

        return {
            "plant": self._normalize_plant_row(dict(updated_plant)),
            "version": self._normalize_plant_version_row(dict(created_version)),
        }

    @staticmethod
    def _normalize_text_list(values: list[str] | None) -> list[str]:
        if not values:
            return []

        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            cleaned = str(value or "").strip()
            if not cleaned:
                continue
            key = cleaned.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(cleaned)

        return normalized

    def get_document_by_id(
        self,
        tenant_id: str,
        document_id: str,
    ) -> dict | None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        tenant_id,
                        plant_name,
                        file_name,
                        extracted_text,
                        uploaded_at
                    FROM real.plant_documents
                    WHERE tenant_id = %s::uuid
                      AND id = %s::uuid
                    LIMIT 1
                    """,
                    (tenant_id, document_id),
                )
                found = cursor.fetchone()

        if not found:
            return None

        return self._normalize_document_row(dict(found))

    def enqueue_extraction_job(
        self,
        tenant_id: str,
        resource_type: str,
        resource_id: str,
        payload: dict | None = None,
    ) -> dict:
        job_id = str(uuid4())
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    INSERT INTO real.extraction_jobs (
                        id,
                        tenant_id,
                        resource_type,
                        resource_id,
                        status,
                        payload
                    )
                    VALUES (%s::uuid, %s::uuid, %s, %s::uuid, 'queued', %s)
                    ON CONFLICT (resource_type, resource_id)
                    DO UPDATE SET
                        tenant_id = EXCLUDED.tenant_id,
                        status = 'queued',
                        retry_count = 0,
                        max_retries = GREATEST(real.extraction_jobs.max_retries, 5),
                        payload = EXCLUDED.payload,
                        last_error = NULL,
                        next_attempt_at = NOW(),
                        updated_at = NOW()
                    RETURNING id, tenant_id, resource_type, resource_id, status, retry_count, max_retries, next_attempt_at, last_error, created_at, updated_at
                    """,
                    (
                        job_id,
                        tenant_id,
                        resource_type,
                        resource_id,
                        Json(payload or {}),
                    ),
                )
                row = cursor.fetchone()

        if not row:
            raise ValueError("Extraction job enqueue failed")

        return self._normalize_extraction_job_row(dict(row))

    def get_extraction_job_for_resource(
        self,
        tenant_id: str,
        resource_type: str,
        resource_id: str,
    ) -> dict | None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT id, tenant_id, resource_type, resource_id, status, retry_count, max_retries, next_attempt_at, last_error, created_at, updated_at
                    FROM real.extraction_jobs
                    WHERE tenant_id = %s::uuid
                      AND resource_type = %s
                      AND resource_id = %s::uuid
                    LIMIT 1
                    """,
                    (tenant_id, resource_type, resource_id),
                )
                row = cursor.fetchone()

        if not row:
            return None

        return self._normalize_extraction_job_row(dict(row))

    def create_ai_generation(
        self,
        tenant_id: str,
        plant_document_id: str,
        model_name: str,
        prompt_version: str,
        prompt_hash_sha256: str,
        ai_status: str,
        raw_response: dict,
        normalized_payload: dict,
        latency_ms: int,
        confidence_score: float,
    ) -> dict:
        generation_id = str(uuid4())

        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    INSERT INTO real.plant_ai_generations (
                        id,
                        tenant_id,
                        plant_document_id,
                        model_name,
                        prompt_version,
                        prompt_hash_sha256,
                        ai_status,
                        raw_response,
                        normalized_payload,
                        latency_ms,
                        confidence_score
                    )
                    VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, tenant_id, plant_document_id, model_name, prompt_version, prompt_hash_sha256, ai_status, raw_response, normalized_payload, latency_ms, confidence_score, created_at
                    """,
                    (
                        generation_id,
                        tenant_id,
                        plant_document_id,
                        model_name,
                        prompt_version,
                        prompt_hash_sha256,
                        ai_status,
                        Json(raw_response),
                        Json(normalized_payload),
                        latency_ms,
                        confidence_score,
                    ),
                )
                created = cursor.fetchone()

        if not created:
            raise ValueError("AI generation creation failed")

        return self._normalize_generation_row(dict(created))

    def apply_generation(
        self,
        tenant_id: str,
        plant_document_id: str,
        generation_id: str,
    ) -> dict | None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT g.id, g.plant_document_id, g.normalized_payload
                    FROM real.plant_ai_generations g
                    JOIN real.plant_documents d ON d.id = g.plant_document_id
                    WHERE d.tenant_id = %s::uuid
                      AND d.id = %s::uuid
                      AND g.id = %s::uuid
                    LIMIT 1
                    """,
                    (tenant_id, plant_document_id, generation_id),
                )
                generation = cursor.fetchone()

                if not generation:
                    return None

                cursor.execute(
                    """
                    UPDATE real.plant_ai_generations
                    SET is_active = FALSE
                                        WHERE plant_document_id = %s::uuid
                                            AND tenant_id = %s::uuid
                    """,
                                        (plant_document_id, tenant_id),
                )

                cursor.execute(
                    """
                    UPDATE real.plant_ai_generations
                    SET is_active = TRUE
                                        WHERE id = %s::uuid
                                            AND tenant_id = %s::uuid
                    """,
                                        (generation_id, tenant_id),
                )

                normalized_payload = generation.get("normalized_payload") if isinstance(generation, dict) else {}
                if not isinstance(normalized_payload, dict):
                    normalized_payload = {}

                cursor.execute(
                    """
                    UPDATE real.plant_documents
                    SET reviewed_data = %s,
                        ai_prefill = %s
                    WHERE id = %s::uuid
                      AND tenant_id = %s::uuid
                    RETURNING id, plant_name, file_name, content_type, file_size_bytes, ai_summary, ai_prefill, reviewed_data, uploaded_at
                    """,
                    (
                        Json(normalized_payload),
                        Json(normalized_payload),
                        plant_document_id,
                        tenant_id,
                    ),
                )
                updated_document = cursor.fetchone()

        if not updated_document:
            return None

        return {
            "document": self._normalize_document_row(dict(updated_document)),
            "applied_generation_id": generation_id,
        }

    def list_ai_model_performance(
        self,
        tenant_id: str,
        from_datetime: datetime,
        to_datetime: datetime,
        prompt_version: str | None = None,
        sort_field: str = "win_rate",
        sort_order: str = "desc",
    ) -> list[dict]:
        allowed_sort_fields = {
            "avg_score": "avg_score",
            "avg_latency_ms": "avg_latency_ms",
            "win_rate": "win_rate",
            "total_runs": "total_runs",
        }
        resolved_sort_field = allowed_sort_fields.get(sort_field, "win_rate")
        resolved_sort_order = "ASC" if sort_order.lower() == "asc" else "DESC"

        secondary_sort = "total_runs DESC"
        if resolved_sort_field == "total_runs":
            order_by_clause = f"{resolved_sort_field} {resolved_sort_order}, avg_score DESC, model_name ASC"
        else:
            order_by_clause = f"{resolved_sort_field} {resolved_sort_order}, {secondary_sort}, model_name ASC"

        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    f"""
                    SELECT
                        g.model_name,
                        g.prompt_version,
                        ROUND(AVG(g.confidence_score)::numeric, 4) AS avg_score,
                        ROUND(AVG(g.latency_ms)::numeric, 0) AS avg_latency_ms,
                        ROUND(
                            (
                                COUNT(*) FILTER (WHERE g.is_active = TRUE)::numeric
                                / NULLIF(COUNT(*), 0)
                            ),
                            4
                        ) AS win_rate,
                        COUNT(*) AS total_runs
                    FROM real.plant_ai_generations g
                    WHERE g.tenant_id = %s::uuid
                      AND g.created_at >= %s
                      AND g.created_at <= %s
                      AND (%s IS NULL OR g.prompt_version = %s)
                    GROUP BY g.model_name, g.prompt_version
                                        ORDER BY {order_by_clause}
                                        """,
                    (tenant_id, from_datetime, to_datetime, prompt_version, prompt_version),
                )
                rows = cursor.fetchall() or []

            normalized_rows = [self._normalize_performance_row(dict(row)) for row in rows]
            return self._apply_recommendation(normalized_rows)

    @staticmethod
    def _normalize_document_row(row: dict) -> dict:
        if isinstance(row.get("id"), UUID):
            row["id"] = str(row["id"])

        if isinstance(row.get("tenant_id"), UUID):
            row["tenant_id"] = str(row["tenant_id"])

        return row

    @staticmethod
    def _normalize_plant_row(row: dict) -> dict:
        for key in ("id", "tenant_id", "active_version_id"):
            if isinstance(row.get(key), UUID):
                row[key] = str(row[key])

        return row

    @staticmethod
    def _normalize_plant_version_row(row: dict) -> dict:
        for key in ("id", "plant_id", "tenant_id", "source_document_id", "source_generation_id"):
            if isinstance(row.get(key), UUID):
                row[key] = str(row[key])

        if isinstance(row.get("confidence_score"), Decimal):
            row["confidence_score"] = int(row["confidence_score"])

        return row

    @staticmethod
    def normalize_scientific_name(scientific_name: str) -> str:
        compact = re.sub(r"\s+", " ", scientific_name.strip())
        return compact.lower()

    @staticmethod
    def _normalize_generation_row(row: dict) -> dict:
        if isinstance(row.get("id"), UUID):
            row["id"] = str(row["id"])

        if isinstance(row.get("tenant_id"), UUID):
            row["tenant_id"] = str(row["tenant_id"])

        if isinstance(row.get("plant_document_id"), UUID):
            row["plant_document_id"] = str(row["plant_document_id"])

        if isinstance(row.get("confidence_score"), Decimal):
            row["confidence_score"] = float(row["confidence_score"])

        return row

    @staticmethod
    def _normalize_extraction_job_row(row: dict) -> dict:
        if isinstance(row.get("id"), UUID):
            row["id"] = str(row["id"])

        if isinstance(row.get("tenant_id"), UUID):
            row["tenant_id"] = str(row["tenant_id"])

        if isinstance(row.get("resource_id"), UUID):
            row["resource_id"] = str(row["resource_id"])

        return row

    @staticmethod
    def _normalize_performance_row(row: dict) -> dict:
        if isinstance(row.get("avg_score"), Decimal):
            row["avg_score"] = float(row["avg_score"])

        if isinstance(row.get("avg_latency_ms"), Decimal):
            row["avg_latency_ms"] = int(row["avg_latency_ms"])

        if isinstance(row.get("win_rate"), Decimal):
            row["win_rate"] = float(row["win_rate"])

        if isinstance(row.get("total_runs"), Decimal):
            row["total_runs"] = int(row["total_runs"])

        return row

    @staticmethod
    def _apply_recommendation(rows: list[dict]) -> list[dict]:
        for row in rows:
            win_rate = float(row.get("win_rate") or 0.0)
            avg_score = float(row.get("avg_score") or 0.0)
            total_runs = int(row.get("total_runs") or 0)
            sample_weight = min(total_runs / 50.0, 1.0)
            weighted_score = (win_rate * 0.5) + (avg_score * 0.3) + (sample_weight * 0.2)

            row["recommended_score"] = round(weighted_score, 4)
            row["is_recommended"] = False

        eligible_rows = [row for row in rows if int(row.get("total_runs") or 0) >= 5]
        if not eligible_rows:
            return rows

        best_row = max(
            eligible_rows,
            key=lambda row: (
                float(row.get("recommended_score") or 0.0),
                int(row.get("total_runs") or 0),
                float(row.get("avg_score") or 0.0),
                str(row.get("model_name") or ""),
                str(row.get("prompt_version") or ""),
            ),
        )
        best_row["is_recommended"] = True
        return rows
