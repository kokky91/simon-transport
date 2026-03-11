import { useEffect, useState } from "react";
import { PageTitle } from "../../components/ui/PageTitle";
import { apiRequest } from "../../lib/api/client";

type StartRunResponse = { run_id: string; status: "queued" | "running" | "completed" | "failed" };
type RunStatusResponse = {
  run_id: string;
  status: "queued" | "running" | "completed" | "failed";
  summary: { projected_cost_delta: number | null; projected_duration_delta: number | null };
};

export function SimulationsPage() {
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<RunStatusResponse["status"] | null>(null);
  const [summary, setSummary] = useState<RunStatusResponse["summary"] | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!runId || (status !== "queued" && status !== "running")) return;
    const interval = window.setInterval(async () => {
      try {
        const data = await apiRequest<RunStatusResponse>(`/sim/runs/${runId}`);
        setStatus(data.status);
        setSummary(data.summary);
      } catch {
        setStatus("failed");
      }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [runId, status]);

  async function runSimulation() {
    setIsStarting(true);
    try {
      const created = await apiRequest<StartRunResponse>("/sim/runs", { method: "POST", body: { days: 30 } });
      setRunId(created.run_id);
      setStatus(created.status);
      setSummary(null);
    } finally {
      setIsStarting(false);
    }
  }

  const isRunning = status === "queued" || status === "running" || isStarting;
  const cost = summary?.projected_cost_delta;
  const duration = summary?.projected_duration_delta;

  return (
    <section>
      <PageTitle title="Simulations" subtitle="Minimal end-to-end simulation validation flow." />
      <button type="button" onClick={runSimulation} disabled={isRunning}>
        {isRunning ? "Running simulation..." : "Run 30d Simulation"}
      </button>
      <p>Status: {status ?? "idle"}</p>
      {runId ? <p>Run ID: {runId}</p> : null}
      <div>
        <p>Projected cost delta: {cost == null ? "-" : `${cost >= 0 ? "+" : ""}€${cost.toFixed(2)}`}</p>
        <p>Projected duration delta: {duration == null ? "-" : `${duration.toFixed(2)}%`}</p>
      </div>
    </section>
  );
}