import psycopg2
import os

def get_inventory_levels(farm_id):
    DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/farmplatform")
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    query = """
    SELECT product, quantity
    FROM inventory
    WHERE farm_id = %s
    """
    cursor.execute(query, (farm_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {r[0]: r[1] for r in rows}
