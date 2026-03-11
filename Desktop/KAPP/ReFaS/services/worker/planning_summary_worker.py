"""
Planning Summary Worker
Maakt periodiek samenvattingen van planningdata en bereidt deze voor embedding/Qdrant.
"""

import os
import psycopg2
from datetime import datetime
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance
import logging
from prometheus_client import Counter
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("planning_worker")

# Database setup
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/farmplatform")
conn = psycopg2.connect(DB_URL)
cursor = conn.cursor()

# Embedding model & Qdrant client
embedding_model = SentenceTransformer("nomic-ai/nomic-embed-text-v1")
qdrant = QdrantClient(url="http://qdrant:6333")
COLLECTION = "planning_context"

# Ensure collection exists
def ensure_collection():
    qdrant.recreate_collection(
        collection_name=COLLECTION,
        vectors_config=VectorParams(size=768, distance=Distance.COSINE)
    )

def fetch_planning_summaries():
    query = """
    SELECT farm_id, field, MIN(date) as next_harvest, COUNT(*) as harvest_count, MAX(crop) as crop
    FROM planning_events
    WHERE date >= CURRENT_DATE
    GROUP BY farm_id, field
    """
    cursor.execute(query)
    rows = cursor.fetchall()
    summaries = []
    for farm_id, field, next_harvest, harvest_count, crop in rows:
        text = f"Field {field} will be harvested on {next_harvest}. Expected crop: {crop}. Harvest count: {harvest_count}."
        summaries.append({
            "text": text,
            "metadata": {
                "farm_id": farm_id,
                "field": field,
                "next_harvest": str(next_harvest),
                "harvest_count": harvest_count,
                "crop": crop,
                "type": "planning_summary"
            }
        })
    return summaries

embeddings_created = Counter(
    "embeddings_created_total",
    "Embeddings generated"
)

def embed_and_upsert_summaries(summaries):
    with tracer.start_as_current_span("worker.embedding_upsert"):
        points = []
        for summary in summaries:
            with tracer.start_as_current_span("worker.embedding"):
                vector = embedding_model.encode(summary["text"]).tolist()
            meta = summary["metadata"]
            point = PointStruct(
                id=f"planning_{meta['farm_id']}_{meta['field']}_{meta['next_harvest']}",
                vector=vector,
                payload=meta
            )
            points.append(point)
            logger.info("Planning summary embedded", extra={"farm_id": meta["farm_id"], "field": meta["field"]})
            embeddings_created.inc()
        with tracer.start_as_current_span("worker.qdrant_upsert"):
            qdrant.upsert(collection_name=COLLECTION, points=points)

if __name__ == "__main__":
    ensure_collection()
    summaries = fetch_planning_summaries()
    embed_and_upsert_summaries(summaries)
    logger.info(f"Upserted {len(summaries)} planning summaries to Qdrant.")
