import { AppEvent } from "./index";

export function isAppEvent(obj: unknown): obj is AppEvent {
  if (!obj || typeof obj !== "object") return false;

  const event = obj as any;

  if (typeof event.type !== "string") return false;
  if (event.version !== 1) return false;
  if (typeof event.timestamp !== "string") return false;
  if (typeof event.traceId !== "string") return false;
  if (typeof event.tenantId !== "string") return false;
  if (!event.payload || typeof event.payload !== "object") return false;

  switch (event.type) {
    case "MARKET_PRICE_UPDATED":
      return (
        typeof event.payload.cropId === "string" &&
        typeof event.payload.newPrice === "number"
      );

    case "COMPOST_PRODUCED":
      return (
        typeof event.payload.entityId === "string" &&
        typeof event.payload.resource === "string" &&
        typeof event.payload.producedAmount === "number" &&
        typeof event.payload.totalStored === "number"
      );

    case "REAL_TASK_RECORDED":
      return (
        typeof event.payload.taskId === "string" &&
        typeof event.payload.farmId === "string" &&
        typeof event.payload.taskType === "string" &&
        typeof event.payload.status === "string" &&
        typeof event.payload.costAmount === "number"
      );

    case "PLANT_EXTRACTION_QUEUED":
      return (
        typeof event.payload.documentId === "string" &&
        typeof event.payload.jobId === "string"
      );

    case "PLANT_EXTRACTION_STARTED":
      return (
        typeof event.payload.documentId === "string" &&
        typeof event.payload.jobId === "string"
      );

    case "PLANT_EXTRACTION_SUCCEEDED":
      return (
        typeof event.payload.documentId === "string" &&
        typeof event.payload.jobId === "string"
      );

    case "PLANT_EXTRACTION_FAILED":
      return (
        typeof event.payload.documentId === "string" &&
        typeof event.payload.jobId === "string" &&
        (event.payload.status === "failed" || event.payload.status === "deadletter") &&
        typeof event.payload.retryCount === "number" &&
        typeof event.payload.maxRetries === "number" &&
        typeof event.payload.error === "string"
      );

    case "SIMULATION_RUN_REQUESTED":
      return (
        typeof event.payload.runId === "string" &&
        typeof event.payload.snapshotId === "string" &&
        typeof event.payload.sourceWorldId === "string" &&
        !!event.payload.scenario &&
        typeof event.payload.scenario === "object"
      );

    case "SIMULATION_RUN_COMPLETED":
      return (
        typeof event.payload.runId === "string" &&
        typeof event.payload.snapshotId === "string" &&
        typeof event.payload.projectedProfit === "number" &&
        typeof event.payload.projectedYieldKg === "number"
      );

    default:
      return false;
  }
}

export function assertEventVersion(event: { version: number }) {
  if (event.version !== 1) {
    throw new Error(`Unsupported event version: ${event.version}`);
  }
}
