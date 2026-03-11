from uuid import UUID

from uuid import UUID, uuid4

import psycopg2
from psycopg2.extras import RealDictCursor

from app.core.config import settings


class UserRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self._database_url = database_url or settings.DATABASE_URL

    def find_active_user_by_email(self, email: str) -> dict | None:
        normalized_email = email.strip().lower()
        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                                        SELECT id, tenant_id, email, password_hash, is_active, role
                    FROM real.users
                    WHERE LOWER(email) = %s
                      AND is_active = TRUE
                    LIMIT 1
                    """,
                    (normalized_email,),
                )
                row = cursor.fetchone()

        if not row:
            return None

        user = dict(row)
        if isinstance(user.get("id"), UUID):
            user["id"] = str(user["id"])
        if isinstance(user.get("tenant_id"), UUID):
            user["tenant_id"] = str(user["tenant_id"])

        return user

    def create_user(self, email: str, password_hash: str, tenant_id: str | None = None) -> dict:
        normalized_email = email.strip().lower()
        user_id = str(uuid4())
        resolved_tenant_id = tenant_id or str(uuid4())

        with psycopg2.connect(self._database_url) as connection:
            with connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    INSERT INTO real.users (id, tenant_id, email, password_hash, is_active, role)
                    VALUES (%s::uuid, %s::uuid, %s, %s, TRUE, 'ai_reviewer')
                    RETURNING id, tenant_id, email, is_active, role
                    """,
                    (user_id, resolved_tenant_id, normalized_email, password_hash),
                )
                row = cursor.fetchone()

        if not row:
            raise ValueError("User creation failed")

        user = dict(row)
        if isinstance(user.get("id"), UUID):
            user["id"] = str(user["id"])
        if isinstance(user.get("tenant_id"), UUID):
            user["tenant_id"] = str(user["tenant_id"])

        return user