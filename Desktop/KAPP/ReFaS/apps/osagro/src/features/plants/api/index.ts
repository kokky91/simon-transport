// ─── Shared API types for plants feature ─────────────────────────────────────
// plantStore imports these from "../api"

export interface PlantPrefill {
  plant_name: string;
  scientific_name: string;
  category: string;
  growing_days: number | null;
  growing_days_min: number | null;
  growing_days_max: number | null;
  spacing_plant_cm: number | null;
  spacing_row_cm: number | null;
  plants_per_m2: number | null;
  plants_per_m2_min: number | null;
  plants_per_m2_max: number | null;
  plants_per_m2_source: string | null;
  expected_yield: string;
  yield_min_kg_per_m2: number | null;
  yield_max_kg_per_m2: number | null;
  yield_unit: string | null;
  grow_time: string;
  harvest_time: string;
  harvest_method: string;
  water_need: string;
  notes: string;
}

export interface PlantVersion {
  id: string;
  generation_id: string;
  model_name: string;
  plant_name: string;
  scientific_name: string;
  created_at: string;
  is_active: boolean;
  confidence_score: number;
  prefill_data: PlantPrefill;
}

export interface CropDomainWarning {
  field: string;
  message: string;
  severity: "low" | "medium" | "high";
}

export interface ExternalValidationCheck {
  source: string;
  field: string;
  status: "ok" | "mismatch" | "not_found";
  detail: string | null;
}

export interface ExternalValidationSummary {
  checks: ExternalValidationCheck[];
  confidence_score: number;
  sources: string[];
}

export interface PlantGenerateResult {
  generation_id: string;
  model_name: string;
  prefill_data: PlantPrefill;
  generated_summary: string;
  quality_warnings: CropDomainWarning[];
  field_confidence: Record<string, "high" | "medium" | "low">;
  overall_confidence_score: number;
  external_validation: ExternalValidationSummary;
}

export interface PlantGenerateCompareResponse {
  results: PlantGenerateResult[];
  recommended_generation_id: string | null;
}

export interface UploadSuccessPayload {
  documentId: string;
  fileName: string;
  aiSummary: string | null;
  plantId: string | null;
}
