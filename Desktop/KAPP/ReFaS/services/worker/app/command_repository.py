import json
import os

import psycopg2


class WorkerCommandRepository:
    def __init__(self) -> None:
        self._database_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/farmplatform")

    def fetch_unprocessed(self, tenant_id: str, world_id: str, limit: int = 100) -> list[dict]:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                                        SELECT id, world_id, tenant_id, type, payload, retry_count, max_retries
                    FROM game_commands
                    WHERE processed = FALSE
                      AND tenant_id = %s
                      AND world_id = %s
                                            AND failed_at IS NULL
                                            AND retry_count < max_retries
                                            AND next_attempt_at <= NOW()
                    ORDER BY created_at ASC
                    LIMIT %s
                    """,
                    (tenant_id, world_id, limit),
                )
                rows = cursor.fetchall()

        commands: list[dict] = []
        for command_id, cmd_world_id, cmd_tenant_id, cmd_type, payload, retry_count, max_retries in rows:
            parsed_payload = payload if isinstance(payload, dict) else json.loads(payload)
            commands.append(
                {
                    "id": str(command_id),
                    "worldId": cmd_world_id,
                    "tenantId": cmd_tenant_id,
                    "type": cmd_type,
                    "payload": parsed_payload,
                    "retryCount": retry_count,
                    "maxRetries": max_retries,
                }
            )
        return commands

    def mark_processed(self, command_id: str) -> None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE game_commands
                    SET processed = TRUE,
                        processed_at = NOW(),
                        error = NULL
                    WHERE id = %s
                    """,
                    (command_id,),
                )

    def mark_failed(self, command_id: str, error: str) -> dict:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE game_commands
                    SET retry_count = retry_count + 1,
                        next_attempt_at = NOW() + (LEAST(POWER(2, retry_count + 1)::int, 60) * INTERVAL '1 second'),
                        error = %s,
                        failed_at = CASE
                            WHEN retry_count + 1 >= max_retries THEN NOW()
                            ELSE NULL
                        END
                    WHERE id = %s
                    RETURNING retry_count, max_retries, failed_at IS NOT NULL
                    """,
                    (error[:2000], command_id),
                )
                row = cursor.fetchone()

        if not row:
            return {"retry_count": 0, "max_retries": 0, "is_dead": False}

        retry_count, max_retries, is_dead = row
        return {
            "retry_count": retry_count,
            "max_retries": max_retries,
            "is_dead": bool(is_dead),
        }

    def fetch_pending_sim_commands(self, limit: int = 20) -> list[dict]:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, run_id, tenant_id, command_type, payload
                    FROM sim.commands
                    WHERE processed = FALSE
                    AND available_at <= NOW()
                    ORDER BY created_at ASC
                    LIMIT %s
                    """,
                    (limit,),
                )
                rows = cursor.fetchall()

        commands: list[dict] = []
        for command_id, run_id, command_tenant_id, command_type, payload in rows:
            parsed_payload = payload if isinstance(payload, dict) else json.loads(payload)
            commands.append(
                {
                    "id": str(command_id),
                    "runId": str(run_id),
                    "tenantId": str(command_tenant_id),
                    "commandType": command_type,
                    "payload": parsed_payload,
                }
            )
        return commands

    def mark_sim_processed(self, command_id: str) -> None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE sim.commands
                    SET processed = TRUE,
                        processed_at = NOW(),
                        error = NULL
                    WHERE id = %s
                    """,
                    (command_id,),
                )

    def mark_sim_failed(self, command_id: str, error: str) -> None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE sim.commands
                    SET error = %s
                    WHERE id = %s
                    """,
                    (error[:2000], command_id),
                )

    def insert_sim_result(
        self,
        result_id: str,
        tenant_id: str,
        run_id: str,
        metric_key: str,
        metric_value: float,
        details: dict,
    ) -> None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO sim.results (id, tenant_id, run_id, metric_key, metric_value, details)
                    VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                    """,
                    (
                        result_id,
                        tenant_id,
                        run_id,
                        metric_key,
                        metric_value,
                        json.dumps(details),
                    ),
                )

    def set_sim_run_status(self, run_id: str, status: str) -> None:
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE sim.runs
                    SET status = %s,
                        started_at = CASE WHEN %s = 'running' THEN NOW() ELSE started_at END,
                        completed_at = CASE WHEN %s IN ('completed', 'failed') THEN NOW() ELSE completed_at END
                    WHERE id = %s
                    """,
                    (status, status, status, run_id),
                )
