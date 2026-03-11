import json
import uuid

import psycopg2

from app.core.config import settings


class CommandRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self._database_url = database_url or settings.DATABASE_URL

    def insert_command(self, world_id: str, tenant_id: str, command_type: str, payload: dict) -> str:
        command_id = str(uuid.uuid4())

        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO game_commands (id, world_id, tenant_id, type, payload, processed, error)
                    VALUES (%s, %s, %s, %s, %s::jsonb, FALSE, NULL)
                    """,
                    (command_id, world_id, tenant_id, command_type, json.dumps(payload)),
                )

        return command_id
