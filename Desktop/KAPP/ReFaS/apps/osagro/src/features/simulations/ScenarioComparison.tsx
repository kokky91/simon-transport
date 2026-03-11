import { useQuery } from "@tanstack/react-query"
import { apiClient } from "../../lib/api/client"
import { useSimulationStore } from "@store/simulationStore"
import { useEffect } from "react"

export default function ScenarioComparison() {
  const setResults = useSimulationStore((s: any) => s.setResults)
  const { data, isLoading } = useQuery({
    queryKey: ["planning-optimization"],
    queryFn: async () => {
      const res = await apiClient.post("/ai/optimize-planning", {
        farm_id: "demo-farm"
      })
      return (res as any).data
    }
  })

  useEffect(() => {
    if (data) setResults(data)
  }, [data, setResults])

  if (isLoading) return <div>AI berekent scenario's...</div>

  const best = (data && data.best && data.best.scenario) ? data.best.scenario : {}

  return (
    <div className="p-4 bg-gray-900 rounded-lg">
      <h2 className="mb-4 text-xl font-bold">
        Scenario Analyse
      </h2>
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Scenario</th>
            <th>BSF %</th>
            <th>Winst</th>
          </tr>
        </thead>
        <tbody>
          {data?.scenarios?.map((s: any, i: number) => {
            const isBest = s.scenario?.biomass_to_bsf === best.biomass_to_bsf
            return (
              <tr
                key={i}
                className={isBest ? "bg-green-800" : ""}
              >
                <td>{i+1}</td>
                <td>{s.scenario?.biomass_to_bsf * 100}%</td>
                <td>€{s.result?.profit_estimate}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="mt-4 text-green-400">
        Beste strategie: {best.biomass_to_bsf ? best.biomass_to_bsf * 100 : 0}% biomassa naar BSF
      </div>
    </div>
  )
}
