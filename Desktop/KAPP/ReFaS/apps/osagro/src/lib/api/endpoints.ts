import { apiRequest } from "./client";

export type FarmSummary = {
  id: string;
  name: string;
  region: string;
};

export type SimulationRun = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  scenarioName: string;
};

export async function fetchFarms() {
  return apiRequest<FarmSummary[]>("/api/farms");
}

export async function fetchSimulationRuns() {
  return apiRequest<SimulationRun[]>("/api/sim/runs");
}

export async function startSimulationRun(payload: { scenarioId: string }) {
  return apiRequest<SimulationRun>("/api/sim/runs", {
    method: "POST",
    body: payload
  });
}