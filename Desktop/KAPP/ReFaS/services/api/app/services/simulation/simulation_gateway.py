import requests
from app.core.config import settings
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

SIM_ENGINE_URL = settings.SIM_ENGINE_URL

def simulate_scenario(farm_id: str, scenario: dict):
	with tracer.start_as_current_span("simulation.run"):
		try:
			response = requests.post(
				f"{SIM_ENGINE_URL}/simulate",
				json={
					"farm_id": farm_id,
					"scenario": scenario
				},
				timeout=15
			)
			response.raise_for_status()
			return response.json()
		except requests.RequestException as e:
			# Log error, return fallback
			print(f"Simulation error: {e}")
			return {"error": str(e)}
