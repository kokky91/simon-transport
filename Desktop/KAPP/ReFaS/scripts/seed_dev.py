#!/usr/bin/env python3
import argparse
import json
import os
import uuid
from dataclasses import dataclass
from typing import Any

import jwt


@dataclass
class SeedContext:
    tenant_id: str
    farm_id: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed dev data for the tenant encoded in JWT."
    )
    parser.add_argument("--jwt", required=True, help="Bearer token payload source")
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/farmplatform"),
        help="PostgreSQL connection string",
    )
    parser.add_argument(
        "--jwt-secret",
        default=os.getenv("JWT_SECRET", "supersecretkey"),
        help="JWT secret for signature verification",
    )
    parser.add_argument(
        "--jwt-algorithm",
        default=os.getenv("JWT_ALGORITHM", "HS256"),
        help="JWT algorithm",
    )
    parser.add_argument(
        "--skip-verify",
        action="store_true",
        help="Decode token without signature verification (dev-only fallback)",
    )
    return parser.parse_args()


def decode_tenant_id(token: str, secret: str, algorithm: str, skip_verify: bool) -> str:
    if skip_verify:
        payload = jwt.decode(token, options={"verify_signature": False})
    else:
        payload = jwt.decode(token, secret, algorithms=[algorithm])

    tenant_id = payload.get("tenantId") or payload.get("tenant_id")
    if not isinstance(tenant_id, str) or not tenant_id:
        raise ValueError("JWT is missing tenantId/tenant_id claim")

    return tenant_id


def seed_for_tenant(database_url: str, tenant_id: str) -> SeedContext:
    try:
        import psycopg2  # type: ignore[import-not-found]
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "psycopg2 is required to run seed_dev.py. Install backend requirements first."
        ) from exc

    farm_id = str(uuid.uuid4())
    task_a_id = str(uuid.uuid4())
    task_b_id = str(uuid.uuid4())

    connection: Any
    with psycopg2.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO real.farms (id, tenant_id, name, location)
                VALUES (%s::uuid, %s::uuid, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (farm_id, tenant_id, "Seed Farm", "Dev Region"),
            )

            cursor.execute(
                """
                INSERT INTO real.tasks (
                    id,
                    tenant_id,
                    farm_id,
                    task_type,
                    status,
                    cost_amount,
                    estimated_cost
                )
                VALUES
                    (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s),
                    (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    task_a_id,
                    tenant_id,
                    farm_id,
                    "Irrigation check",
                    "planned",
                    0,
                    140.0,
                    task_b_id,
                    tenant_id,
                    farm_id,
                    "Fertilizer planning",
                    "in_progress",
                    25.0,
                    320.0,
                ),
            )

    return SeedContext(tenant_id=tenant_id, farm_id=farm_id)


def main() -> None:
    args = parse_args()
    token = args.jwt.removeprefix("Bearer ").strip()
    tenant_id = decode_tenant_id(
        token=token,
        secret=args.jwt_secret,
        algorithm=args.jwt_algorithm,
        skip_verify=args.skip_verify,
    )
    context = seed_for_tenant(args.database_url, tenant_id)
    print(
        json.dumps(
            {
                "seeded": True,
                "tenantId": context.tenant_id,
                "farmId": context.farm_id,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()