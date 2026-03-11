from app.services.simulation.simulation_gateway import simulate_scenario

def evaluate_strategy(farm_id):
	scenarios = [
		{"biomass_to_bsf": 0.2},
		{"biomass_to_bsf": 0.3},
		{"biomass_to_bsf": 0.4},
	]
	results = []
	for s in scenarios:
		result = simulate_scenario(farm_id, s)
		results.append({
			"scenario": s,
			"result": result
		})
	return results
