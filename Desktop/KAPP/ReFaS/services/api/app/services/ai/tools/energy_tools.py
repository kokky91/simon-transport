import psycopg2
import os

def get_energy_balance(farm_id):
    DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/farmplatform")
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    query = """
    SELECT SUM(produced) - SUM(consumed) AS balance
    FROM energy_events
    WHERE farm_id = %s
    """
    cursor.execute(query, (farm_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return {"energy_balance": row[0] if row else 0}
