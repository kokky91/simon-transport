// API logic for plants feature
// Uses apiRequest / apiRequestFormData from src/lib/api/client.ts
import { apiRequest, apiRequestFormData } from "../../../lib/api/client";
import type { PlantRecord } from "../types";
import type {
  PlantGenerateCompareResponse,
  PlantGenerateResult,
  PlantVersion,
  UploadSuccessPayload,
} from "./index";

// ─── GET /api/plants ──────────────────────────────────────────────────────────
export async function getPlants(): Promise<PlantRecord[]> {
  return apiRequest<PlantRecord[]>("/api/plants");
}

// ─── GET /api/plants/:plantId/versions ───────────────────────────────────────
export async function getPlantVersions({
  plantId,
}: {
  plantId: string;
}): Promise<{ versions: PlantVersion[] }> {
  return apiRequest<{ versions: PlantVersion[] }>(
    `/api/plants/${plantId}/versions`
  );
}

// ─── POST /api/plants/documents ───────────────────────────────────────────────
// Multipart PDF upload — RBAC: ai_reviewer, admin
// Returns documentId used in generate-compare and apply-generation.
// Note: fetch doesn't support upload progress natively; onProgress is a no-op
// until this is upgraded to XHR if needed.
export async function uploadPlantDocument(
  file: File,
  _onProgress?: (pct: number) => void
): Promise<UploadSuccessPayload> {
  const form = new FormData();
  form.append("file", file);

  return apiRequestFormData<UploadSuccessPayload>("/api/plants/documents", {
    method: "POST",
    body: form,
  });
}

// ─── POST /api/plants/:documentId/generate-compare ───────────────────────────
// Run multiple models in parallel — RBAC: editor, ai_reviewer, admin
// Returns all results + recommended_generation_id.
export interface CompareParams {
  model_names: string[];
}

export async function comparePlantModels(
  documentId: string,
  params: CompareParams
): Promise<PlantGenerateCompareResponse> {
  return apiRequest<PlantGenerateCompareResponse>(
    `/api/plants/${documentId}/generate-compare`,
    { method: "POST", body: params }
  );
}

// ─── POST /api/plants/:documentId/apply-generation ───────────────────────────
// Persist chosen generation as active version — RBAC: ai_reviewer, admin
export interface ApplyParams {
  generation_id: string;
}

export interface ApplyResponse {
  plant_id: string;
  version_id: string;
  applied_at: string;
}

export async function applyGeneration(
  documentId: string,
  params: ApplyParams
): Promise<ApplyResponse> {
  return apiRequest<ApplyResponse>(
    `/api/plants/${documentId}/apply-generation`,
    { method: "POST", body: params }
  );
}

// ─── POST /plants/scrape ────────────────────────────────────────────────
// Enrich plant data via web scraping (GBIF + Wikidata + PFAF + Kew)
export async function scrapePlant(plant_name: string): Promise<{
  plant_name: string;
  enriched: any;
  sources: string[];
}> {
  return apiRequest<{
    plant_name: string;
    enriched: any;
    sources: string[];
  }>(
    "/plants/scrape",
    {
      method: "POST",
      body: JSON.stringify({ plant_name }),
      headers: { "Content-Type": "application/json" },
    }
  );
}
