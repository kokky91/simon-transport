from datetime import datetime
from decimal import Decimal
from uuid import uuid4

import psycopg2
from psycopg2.extras import RealDictCursor

from app.core.config import settings


class TaskRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self._database_url = database_url or settings.DATABASE_URL

    def list_tasks(self, tenant_id: str, limit: int = 100) -> list[dict]:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        farm_id,
                        task_type,
                        status,
                        cost_amount,
                        estimated_cost,
                        actual_cost,
                        completion_note,
                        started_at,
                        completed_at,
                        created_at,
                        CASE
                            WHEN status = 'done'
                              AND started_at IS NOT NULL
                              AND completed_at IS NOT NULL
                            THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
                            ELSE NULL
                        END AS duration_minutes
                    FROM real.tasks
                    WHERE tenant_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s
                    """,
                    (tenant_id, limit),
                )
                rows = cursor.fetchall()

        return [self._normalize_task_row(dict(row)) for row in rows]

    def create_task(
        self,
        tenant_id: str,
        farm_id: str,
        task_type: str,
        status: str,
        cost_amount: float,
        estimated_cost: float,
        actual_cost: float | None,
        started_at: datetime | None,
        completed_at: datetime | None,
    ) -> dict:
        task_id = str(uuid4())

        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    INSERT INTO real.tasks (
                        id,
                        tenant_id,
                        farm_id,
                        task_type,
                        status,
                        cost_amount,
                        estimated_cost,
                        actual_cost,
                        completion_note,
                        started_at,
                        completed_at
                    )
                    VALUES (%s, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, NULL, %s, %s)
                    RETURNING
                        id,
                        farm_id,
                        task_type,
                        status,
                        cost_amount,
                        estimated_cost,
                        actual_cost,
                        completion_note,
                        started_at,
                        completed_at,
                        created_at,
                        CASE
                            WHEN status = 'done'
                              AND started_at IS NOT NULL
                              AND completed_at IS NOT NULL
                            THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
                            ELSE NULL
                        END AS duration_minutes
                    """,
                    (
                        task_id,
                        tenant_id,
                        farm_id,
                        task_type,
                        status,
                        cost_amount,
                        estimated_cost,
                        actual_cost,
                        started_at,
                        completed_at,
                    ),
                )
                created = cursor.fetchone()

        if not created:
            raise ValueError("Task creation failed")

        return self._normalize_task_row(dict(created))

    def get_task(self, tenant_id: str, task_id: str) -> dict | None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT
                        id,
                        farm_id,
                        task_type,
                        status,
                        cost_amount,
                        estimated_cost,
                        actual_cost,
                        completion_note,
                        started_at,
                        completed_at,
                                                created_at,
                                                CASE
                                                        WHEN status = 'done'
                                                            AND started_at IS NOT NULL
                                                            AND completed_at IS NOT NULL
                                                        THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
                                                        ELSE NULL
                                                END AS duration_minutes
                    FROM real.tasks
                    WHERE tenant_id = %s::uuid
                      AND id = %s::uuid
                    """,
                    (tenant_id, task_id),
                )
                row = cursor.fetchone()

        if not row:
            return None

        return self._normalize_task_row(dict(row))

    def transition_task_status(
        self,
        tenant_id: str,
        task_id: str,
        to_status: str,
        from_statuses: tuple[str, ...],
        actual_cost: float | None = None,
        completion_note: str | None = None,
        completed_at: datetime | None = None,
        started_at: datetime | None = None,
    ) -> dict | None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    UPDATE real.tasks
                    SET
                        status = %s,
                        actual_cost = CASE WHEN %s IS NULL THEN actual_cost ELSE %s END,
                        completion_note = CASE WHEN %s IS NULL THEN completion_note ELSE %s END,
                        completed_at = CASE WHEN %s IS NULL THEN completed_at ELSE %s END,
                        started_at = CASE WHEN %s IS NULL THEN started_at ELSE %s END
                    WHERE tenant_id = %s::uuid
                      AND id = %s::uuid
                      AND status = ANY(%s)
                    RETURNING
                        id,
                        farm_id,
                        task_type,
                        status,
                        cost_amount,
                        estimated_cost,
                        actual_cost,
                        completion_note,
                        started_at,
                        completed_at,
                        created_at,
                        CASE
                            WHEN status = 'done'
                              AND started_at IS NOT NULL
                              AND completed_at IS NOT NULL
                            THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
                            ELSE NULL
                        END AS duration_minutes
                    """,
                    (
                        to_status,
                        actual_cost,
                        actual_cost,
                        completion_note,
                        completion_note,
                        completed_at,
                        completed_at,
                        started_at,
                        started_at,
                        tenant_id,
                        task_id,
                        list(from_statuses),
                    ),
                )
                updated = cursor.fetchone()

        if not updated:
            return None

        return self._normalize_task_row(dict(updated))

    def get_efficiency(self, tenant_id: str, days: int) -> dict:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT
                        COUNT(*) AS completed_task_count,
                        COALESCE(
                            AVG(
                                CASE
                                    WHEN started_at IS NOT NULL AND completed_at IS NOT NULL
                                    THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
                                    ELSE NULL
                                END
                            ),
                            0
                        ) AS avg_duration_minutes,
                        COALESCE(
                            AVG(
                                CASE
                                    WHEN estimated_cost > 0 AND actual_cost IS NOT NULL
                                    THEN ((actual_cost - estimated_cost) / estimated_cost) * 100
                                    ELSE NULL
                                END
                            ),
                            0
                        ) AS avg_cost_variance_pct,
                        COALESCE(
                            SUM(
                                CASE
                                    WHEN actual_cost IS NOT NULL AND actual_cost > estimated_cost
                                    THEN actual_cost - estimated_cost
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS total_cost_overrun_eur
                    FROM real.tasks
                    WHERE tenant_id = %s::uuid
                      AND status = 'done'
                      AND completed_at >= (NOW() - make_interval(days => %s))
                    """,
                    (tenant_id, days),
                )
                row = cursor.fetchone()

        if not row:
            return {
                "completed_task_count": 0,
                "avg_duration_minutes": 0.0,
                "avg_cost_variance_pct": 0.0,
                "total_cost_overrun_eur": 0.0,
                "window_days": days,
            }

        normalized = self._normalize_efficiency_row(dict(row))
        normalized["window_days"] = days
        return normalized

    @staticmethod
    def _normalize_task_row(row: dict) -> dict:
        if row.get("status") == "planned":
            row["status"] = "open"

        for key in ("id", "farm_id"):
            if row.get(key) is not None:
                row[key] = str(row[key])

        for key in ("cost_amount", "estimated_cost", "actual_cost", "duration_minutes"):
            if isinstance(row.get(key), Decimal):
                row[key] = float(row[key])

        return row

    @staticmethod
    def _normalize_efficiency_row(row: dict) -> dict:
        if row.get("completed_task_count") is None:
            row["completed_task_count"] = 0
        else:
            row["completed_task_count"] = int(row["completed_task_count"])

        for key in ("avg_duration_minutes", "avg_cost_variance_pct", "total_cost_overrun_eur"):
            if isinstance(row.get(key), Decimal):
                row[key] = float(row[key])

        return row