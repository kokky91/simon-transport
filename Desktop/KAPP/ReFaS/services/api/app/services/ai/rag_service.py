"""
Centrale RAG Service voor AI-calls
Gateway voor Qdrant, tools en Flowise
"""

import requests
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
import logging
import uuid
from app.core.metrics import ai_requests_total, ai_latency_seconds, rag_context_items
from app.services.ai.tools.production_tools import get_production_summary
from app.services.ai.tools.inventory_tools import get_inventory_levels
from app.services.ai.tools.planning_tools import get_upcoming_harvests
from app.services.ai.tools.energy_tools import get_energy_balance
from app.services.ai.tools.market_tools import get_market_prices
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

FLOWISE_URL = "http://flowise:3000/api/v1/prediction"
QDRANT_URL = "http://qdrant:6333"
EMBED_MODEL = "nomic-ai/nomic-embed-text-v1"

embedding_model = SentenceTransformer(EMBED_MODEL)
qdrant = QdrantClient(QDRANT_URL)
logger = logging.getLogger("ai.rag")

class RagService:
    def ask(self, farm_id: str, question: str):
        request_id = uuid.uuid4().hex
        ai_requests_total.inc()
        logger.info("AI question received", extra={"farm_id": farm_id, "question": question, "request_id": request_id})
        with tracer.start_as_current_span("rag.ask"):
            with ai_latency_seconds.time():
                context = self.search_context(farm_id, question, request_id)
                logger.info("RAG context retrieved", extra={"context_items": len(context), "request_id": request_id})
                tool_data = self.get_tools_context(farm_id, request_id)
                response = self.call_flowise(
                    question=question,
                    context=context,
                    tools=tool_data,
                    request_id=request_id
                )
                logger.info("AI response generated", extra={"request_id": request_id})
                return response

    def search_context(self, farm_id, question, request_id):
        with tracer.start_as_current_span("rag.qdrant_search"):
            embedding = embedding_model.encode(question).tolist()
            filter = Filter(must=[FieldCondition(key="farm_id", match=MatchValue(value=farm_id))])
            results = qdrant.search(
                collection_name="planning_context",
                query_vector=embedding,
                filter=filter,
                limit=5
            )
            rag_context_items.observe(len(results))
            logger.info("Qdrant search completed", extra={"results": len(results), "request_id": request_id})
            return [r.payload for r in results]

    def get_tools_context(self, farm_id, request_id):
        with tracer.start_as_current_span("rag.tools_context"):
            production = get_production_summary(farm_id)
            inventory = get_inventory_levels(farm_id)
            planning = get_upcoming_harvests(farm_id)
            energy = get_energy_balance(farm_id)
            market = get_market_prices()
            logger.info("Tools context fetched", extra={"request_id": request_id})
            return {
                "production": production,
                "inventory": inventory,
                "planning": planning,
                "energy": energy,
                "market": market
            }

    def call_flowise(self, question, context, tools, request_id):
        with tracer.start_as_current_span("flowise.call"):
            payload = {
                "question": question,
                "context": context,
                "tools": tools,
                "request_id": request_id
            }
            r = requests.post(
                f"{FLOWISE_URL}/farm_chat",
                json=payload,
                timeout=20
            )
            logger.info("Flowise call completed", extra={"status_code": r.status_code, "request_id": request_id})
            return r.json()

rag_service = RagService()
