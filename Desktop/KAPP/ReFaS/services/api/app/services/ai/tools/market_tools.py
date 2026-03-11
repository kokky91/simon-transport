import psycopg2
import os

def get_market_prices(product=None):
    DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/farmplatform")
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    if product:
        query = "SELECT product, price, date FROM market_prices WHERE product = %s ORDER BY date DESC LIMIT 10"
        cursor.execute(query, (product,))
    else:
        query = "SELECT product, price, date FROM market_prices ORDER BY date DESC LIMIT 10"
        cursor.execute(query)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [
        {"product": r[0], "price": r[1], "date": str(r[2])}
        for r in rows
    ]
