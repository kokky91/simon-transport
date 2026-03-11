import { BaseEvent } from "./base";

export type RealTaskRecorded = BaseEvent<
  "REAL_TASK_RECORDED",
  {
    taskId: string;
    farmId: string;
    taskType: string;
    status: string;
    costAmount: number;
  }
>;

export type PlantExtractionQueued = BaseEvent<
  "PLANT_EXTRACTION_QUEUED",
  {
    documentId: string;
    jobId: string;
  }
>;

export type PlantExtractionStarted = BaseEvent<
  "PLANT_EXTRACTION_STARTED",
  {
    documentId: string;
    jobId: string;
  }
>;

export type PlantExtractionSucceeded = BaseEvent<
  "PLANT_EXTRACTION_SUCCEEDED",
  {
    documentId: string;
    jobId: string;
  }
>;

export type PlantExtractionFailed = BaseEvent<
  "PLANT_EXTRACTION_FAILED",
  {
    documentId: string;
    jobId: string;
    status: "failed" | "deadletter";
    retryCount: number;
    maxRetries: number;
    error: string;
  }
>;
