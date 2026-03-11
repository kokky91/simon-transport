import json
from decimal import Decimal
from uuid import uuid4

import psycopg2
from psycopg2.extras import RealDictCursor

from app.core.config import settings


class SimRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self._database_url = database_url or settings.DATABASE_URL

    def build_domain_snapshot(self, tenant_id: str) -> dict:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT
                        COUNT(*) AS tasks_count,
                        COALESCE(SUM(cost_amount), 0) AS costs_total,
                        COALESCE(
                            AVG(
                                CASE
                                    WHEN started_at IS NOT NULL AND completed_at IS NOT NULL
                                    THEN EXTRACT(EPOCH FROM (completed_at - started_at)) / 60
                                    ELSE NULL
                                END
                            ),
                            0
                        ) AS avg_task_duration_minutes
                    FROM real.tasks
                    WHERE tenant_id::text = %s
                    """,
                    (tenant_id,),
                )
                task_row = cursor.fetchone() or {}

                cursor.execute(
                    """
                    SELECT COUNT(*) AS fields_count
                    FROM real.farms
                    WHERE tenant_id::text = %s
                    """,
                    (tenant_id,),
                )
                farm_row = cursor.fetchone() or {}

        return {
            "tasks": int(task_row.get("tasks_count") or 0),
            "fields": int(farm_row.get("fields_count") or 0),
            "costs": self._as_float(task_row.get("costs_total")) or 0.0,
            "avgTaskDurationMinutes": self._as_float(task_row.get("avg_task_duration_minutes")) or 0.0,
        }

    def create_run(self, tenant_id: str, world_id: str, days: int, snapshot: dict) -> dict:
        run_id = str(uuid4())
        command_id = str(uuid4())
        snapshot_id = str(uuid4())

        command_payload = {
            "days": days,
            "snapshot": snapshot,
            "snapshotId": snapshot_id,
        }

        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO sim.runs (id, tenant_id, snapshot_id, source_world_id, status)
                    VALUES (%s, %s::uuid, %s, %s, 'queued')
                    """,
                    (run_id, tenant_id, snapshot_id, world_id),
                )
                cursor.execute(
                    """
                    INSERT INTO sim.commands (id, tenant_id, run_id, command_type, payload, processed, error)
                    VALUES (%s, %s::uuid, %s, %s, %s::jsonb, FALSE, NULL)
                    """,
                    (command_id, tenant_id, run_id, "RUN_SIMULATION", json.dumps(command_payload)),
                )

        return {"run_id": run_id, "status": "queued"}

    def get_run_status(self, tenant_id: str, run_id: str) -> dict | None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT id, status, started_at, completed_at
                    FROM sim.runs
                    WHERE tenant_id::text = %s
                      AND id = %s::uuid
                    """,
                    (tenant_id, run_id),
                )
                run_row = cursor.fetchone()
                if not run_row:
                    return None

                cursor.execute(
                    """
                    SELECT metric_key, metric_value
                    FROM sim.results
                    WHERE tenant_id::text = %s
                      AND run_id = %s::uuid
                      AND metric_key IN ('projected_cost_delta', 'projected_duration_delta')
                    """,
                    (tenant_id, run_id),
                )
                metrics = cursor.fetchall()

        summary: dict[str, float | None] = {
            "projected_cost_delta": None,
            "projected_duration_delta": None,
        }
        for row in metrics:
            key = row.get("metric_key")
            if key in summary:
                summary[key] = self._as_float(row.get("metric_value"))

        return {
            "run_id": str(run_row["id"]),
            "status": run_row["status"],
            "started_at": run_row["started_at"],
            "completed_at": run_row["completed_at"],
            "summary": summary,
        }

    @staticmethod
    def _as_float(value: object) -> float | None:
        if value is None:
            return None
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, (float, int)):
            return float(value)
        return None
