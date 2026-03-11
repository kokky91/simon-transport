import psycopg2
import os

def get_upcoming_harvests(farm_id):
    DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/farmplatform")
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    query = """
    SELECT field, crop, harvest_date
    FROM planning
    WHERE farm_id = %s AND harvest_date >= NOW()
    ORDER BY harvest_date
    LIMIT 10
    """
    cursor.execute(query, (farm_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
        {"field": r[0], "crop": r[1], "harvest_date": str(r[2])}
        for r in rows
    ]
