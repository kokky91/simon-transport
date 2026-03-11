// Shared types for plants
export interface PlantRecord {
  id: string;
  plant_code: string;
  scientific_name: string;
  genus?: string;
  species?: string;
  family?: string;
  common_name_nl?: string;
  common_name_en?: string;
  plant_type: string;
  category: string;
  climate_zones: string[];
  temperature_min_c?: number;
  temperature_max_c?: number;
  drought_tolerance: "low" | "medium" | "high";
  nitrogen_fixing: boolean;
  yield_min_kg_per_ha?: number;
  yield_max_kg_per_ha?: number;
  days_to_first_harvest?: number;
  review_status: "draft" | "ai_generated" | "reviewed" | "approved";
  created_at: string;
}
