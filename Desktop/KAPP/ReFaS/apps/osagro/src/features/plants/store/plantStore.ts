// Zustand store for plant state
import { create } from "zustand";
import type {
  CropDomainWarning,
  ExternalValidationSummary,
  PlantGenerateCompareResponse,
  PlantPrefill,
  PlantVersion
} from "../api";

interface PlantState {
  plantName: string;
  selectedFile: File | null;
  modelName: string;
  fileError: string | null;
  prefillData: PlantPrefill;
  generatedSummary: string;
  qualityWarnings: CropDomainWarning[];
  fieldConfidence: Record<string, "high" | "medium" | "low">;
  overallConfidenceScore: number;
  externalValidation: ExternalValidationSummary;
  hasPrefill: boolean;
  uploadSuccess: {
    documentId: string;
    fileName: string;
    aiSummary: string | null;
    plantId: string | null;
  } | null;
  isHistoryOpen: boolean;
  versionHistory: PlantVersion[];
  selectedCompareModels: string[];
  compareResult: PlantGenerateCompareResponse | null;
  appliedGenerationId: string | null;
  copiedAuditValue: string | null;
  setState: (state: Partial<PlantState>) => void;
}

export const usePlantStore = create<PlantState>((set) => ({
  plantName: "",
  selectedFile: null,
  modelName: "",
  fileError: null,
  prefillData: {
    plant_name: "",
    scientific_name: "",
    category: "",
    growing_days: null,
    growing_days_min: null,
    growing_days_max: null,
    spacing_plant_cm: null,
    spacing_row_cm: null,
    plants_per_m2: null,
    plants_per_m2_min: null,
    plants_per_m2_max: null,
    plants_per_m2_source: null,
    expected_yield: "",
    yield_min_kg_per_m2: null,
    yield_max_kg_per_m2: null,
    yield_unit: null,
    grow_time: "",
    harvest_time: "",
    harvest_method: "",
    water_need: "",
    notes: ""
  },
  generatedSummary: "",
  qualityWarnings: [],
  fieldConfidence: {},
  overallConfidenceScore: 0,
  externalValidation: {
    checks: [],
    confidence_score: 0,
    sources: []
  },
  hasPrefill: false,
  uploadSuccess: null,
  isHistoryOpen: false,
  versionHistory: [],
  selectedCompareModels: [],
  compareResult: null,
  appliedGenerationId: null,
  copiedAuditValue: null,
  setState: (state) => set(state)
}));
