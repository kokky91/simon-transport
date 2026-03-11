"""
Seed script for creating a demo user for testing.
Usage: 
  Via inline: 
    Get-Content database/seeds/seed_demo_user.py | docker compose -f docker-compose.dev.yml exec -T api python -
"""
import os
import sys
from uuid import uuid4

import bcrypt
import psycopg2
from psycopg2.extras import RealDictCursor

# Demo user credentials
DEMO_EMAIL = "demo@osagro.dev"
DEMO_PASSWORD = "demo12345"  # Must be at least 8 characters
DEMO_TENANT_ID = "11111111-1111-1111-1111-111111111111"  # Dev tenant
DEMO_FARM_ID = "11111111-1111-1111-1111-111111111111"

def get_db_connection():
    """Create database connection using DATABASE_URL environment variable."""
    return psycopg2.connect(
        os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/farmplatform")
    )

def seed_demo_user():
    """Create demo user if it doesn't exist."""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Check if user already exists
        cursor.execute(
            "SELECT id FROM real.users WHERE LOWER(email) = LOWER(%s)",
            (DEMO_EMAIL,)
        )
        existing = cursor.fetchone()

        if existing:
            print(f"✓ Demo user already exists: {DEMO_EMAIL}")
            user_id = existing["id"]
        else:
            password_hash = bcrypt.hashpw(DEMO_PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cursor.execute("""
                INSERT INTO real.users (id, email, password_hash, tenant_id, is_active, created_at)
                VALUES (gen_random_uuid(), %s, %s, %s, %s, NOW())
                RETURNING id
            """, (DEMO_EMAIL, password_hash, DEMO_TENANT_ID, True))
            user = cursor.fetchone()
            user_id = user["id"] if user else "unknown"

        cursor.execute(
            """
            INSERT INTO real.farms (id, tenant_id, name, location, width_m, height_m)
            VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE
            SET width_m = EXCLUDED.width_m,
                height_m = EXCLUDED.height_m
            """,
            (DEMO_FARM_ID, DEMO_TENANT_ID, "Demo Farm", "Dev", 1000, 1000),
        )

        fields = [
            (str(uuid4()), "North Field", "wheat", 50, 60, 280, 220),
            (str(uuid4()), "South Field", "corn", 420, 410, 350, 260),
            (str(uuid4()), "West Field", "potato", 80, 360, 220, 280),
        ]
        for field_id, name, crop_type, x_m, y_m, width_m, height_m in fields:
            cursor.execute(
                """
                INSERT INTO real.fields (id, tenant_id, farm_id, name, crop_type, x_m, y_m, width_m, height_m)
                VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (field_id, DEMO_TENANT_ID, DEMO_FARM_ID, name, crop_type, x_m, y_m, width_m, height_m),
            )

        buildings = [
            (str(uuid4()), "barn", 130, 120, 45, 30),
            (str(uuid4()), "irrigation", 500, 480, 30, 30),
            (str(uuid4()), "storage", 300, 250, 40, 35),
        ]
        for building_id, building_type, x_m, y_m, width_m, height_m in buildings:
            cursor.execute(
                """
                INSERT INTO real.buildings (id, tenant_id, farm_id, field_id, type, x_m, y_m, width_m, height_m)
                VALUES (%s::uuid, %s::uuid, %s::uuid, NULL, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (building_id, DEMO_TENANT_ID, DEMO_FARM_ID, building_type, x_m, y_m, width_m, height_m),
            )

        conn.commit()
        
        print(f"✓ Demo user created successfully!")
        print(f"  Email: {DEMO_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")
        print(f"  Tenant ID: {DEMO_TENANT_ID}")
        print(f"  Farm ID: {DEMO_FARM_ID}")
        print(f"  User ID: {user_id}")
        
    except Exception as e:
        conn.rollback()
        print(f"✗ Error creating demo user: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    seed_demo_user()
