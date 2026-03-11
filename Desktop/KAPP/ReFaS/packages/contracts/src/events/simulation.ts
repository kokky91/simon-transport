import { BaseEvent } from "./base";

export type SimulationRunRequested = BaseEvent<
  "SIMULATION_RUN_REQUESTED",
  {
    runId: string;
    snapshotId: string;
    sourceWorldId: string;
    scenario: Record<string, unknown>;
  }
>;

export type SimulationRunCompleted = BaseEvent<
  "SIMULATION_RUN_COMPLETED",
  {
    runId: string;
    snapshotId: string;
    projectedProfit: number;
    projectedYieldKg: number;
  }
>;
