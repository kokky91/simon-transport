import psycopg2
import os

def get_production_summary(farm_id, days=7):
    DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/farmplatform")
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    query = """
    SELECT resource, SUM(quantity) as total
    FROM production_events
    WHERE farm_id = %s AND timestamp >= NOW() - INTERVAL '%s days'
    GROUP BY resource
    """
    cursor.execute(query, (farm_id, days))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return {r[0]: r[1] for r in rows}
