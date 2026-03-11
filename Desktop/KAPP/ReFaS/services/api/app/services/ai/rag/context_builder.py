"""
Context builder voor RAG workflows.
Voegt simulation_results toe aan context.
"""


	# ...existing context logic...
	from app.services.simulation.simulation_gateway import simulate_scenario
	scenarios = [
		{"biomass_to_bsf": 0.2},
		{"biomass_to_bsf": 0.3},
		{"biomass_to_bsf": 0.4},
	]
	simulation_results = [
		{
			"scenario": s,
			"result": simulate_scenario(farm_id, s)
		} for s in scenarios
	]
	context = {}
	context["simulation_results"] = simulation_results
	return context
