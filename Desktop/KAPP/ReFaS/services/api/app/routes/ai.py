from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ai.rag_service import rag_service
from app.services.worker.agents.planning_agent import evaluate_strategy

router = APIRouter(prefix="/ai", tags=["ai"])


class AskRequest(BaseModel):
    farm_id: str
    question: str

class PlanningRequest(BaseModel):
    farm_id: str


@router.post("/ask")
def ask_ai(request: AskRequest):
    try:
        result = rag_service.ask(
            farm_id=request.farm_id,
            question=request.question
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/optimize-planning")
def optimize_planning(request: PlanningRequest):
    try:
        results = evaluate_strategy(request.farm_id)
        best = max(results, key=lambda r: r["result"].get("profit_estimate", 0))
        return {"scenarios": results, "best": best}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
