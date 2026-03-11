import { apiRequest } from "../../lib/api/client";

export type ModelPerformanceRow = {
  model_name: string;
  prompt_version: string;
  avg_score: number;
  avg_latency_ms: number;
  win_rate: number;
  total_runs: number;
  recommended_score: number;
  is_recommended: boolean;
};

export type PerformanceRangePreset = "7d" | "30d" | "90d";
export type PerformanceSortField = "avg_score" | "avg_latency_ms" | "win_rate" | "total_runs";
export type PerformanceSortOrder = "asc" | "desc";

export async function getModelPerformance(
  range: PerformanceRangePreset = "30d",
  promptVersion?: string,
  sort: PerformanceSortField = "win_rate",
  order: PerformanceSortOrder = "desc"
) {
  const params = new URLSearchParams({
    range,
    sort,
    order
  });

  if (promptVersion?.trim()) {
    params.set("prompt_version", promptVersion.trim());
  }

  return apiRequest<ModelPerformanceRow[]>(`/admin/ai/performance?${params.toString()}`);
}
