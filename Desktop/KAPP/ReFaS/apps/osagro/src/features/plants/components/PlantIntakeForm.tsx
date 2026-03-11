// VERWIJDERD: duplicaat, zie components/PlantIntakeForm.tsx
import { ArrowLeft, Eye, EyeOff, Save } from "lucide-react";
import React, { useState } from "react";
import { Label, Input, Select, Checkbox, TogglePills } from "@components/ui";
import { CLIMATE_ZONES, SOIL_TYPES, SEASONS, SEC_PRODUCTS } from "../../../features/plants/constants/plantConstants"; // Adjust import path as needed
import { PlantScrapeButton } from "./PlantScrapeButton";
import styles from "./PlantIntakeForm.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type DroughtTolerance = "low" | "medium" | "high";
type SunRequirement = "full_sun" | "partial_shade" | "shade";
type WindTolerance = "low" | "medium" | "high";
type DrainageRequirement = "well_drained" | "moderate" | "poor";
type GrowthRate = "slow" | "medium" | "fast";
type HarvestFrequency = "once" | "multiple" | "continuous";
type PrimaryProduct = "seed" | "fruit" | "leaf" | "root" | "wood" | "fodder" | "biomass";
type EconomicCategory = "food" | "fodder" | "timber" | "medicinal" | "multi_purpose";
type PropagationMethod = "seed" | "cutting" | "grafting" | "division";
type PollinatorValue = "low" | "medium" | "high";
type SourceType = "manual" | "pdf" | "api" | "ai_generated";

interface PlantIntakeFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}
type ReviewStatus = "draft" | "ai_generated" | "reviewed" | "approved";
type PlantType = "annual" | "perennial" | "shrub" | "tree" | "vine" | "grass";
type GrowthForm = "herbaceous" | "woody";

interface PlantFormData {
  // Identity
  plant_code: string;
  scientific_name: string;
  genus: string;
  species: string;
  family: string;
  common_name_nl: string;
  common_name_en: string;
  plant_type: PlantType;
  growth_form: GrowthForm;
  origin_region: string;
  is_native: boolean;
  category: string;
  // Climate
  climate_zones: string[];
  temperature_min_c: string;
  temperature_max_c: string;
  frost_tolerance_c: string;
  rainfall_min_mm_year: string;
  rainfall_max_mm_year: string;
  drought_tolerance: DroughtTolerance;
  sun_requirement: SunRequirement;
  wind_tolerance: WindTolerance;
  elevation_min_m: string;
  elevation_max_m: string;
  // Soil
  soil_type_preference: string[];
  // Add all other fields used in 'form'
  spacing_plant_cm?: string;
  growth_rate?: GrowthRate;
  harvest_frequency?: HarvestFrequency;
  days_to_germination?: string;
  days_to_first_harvest?: string;
  months_to_productive?: string;
  productive_lifespan_years?: string;
  total_lifespan_years?: string;
  yield_min_kg_per_plant?: string;
  yield_max_kg_per_plant?: string;
  yield_min_kg_per_ha?: string;
  yield_max_kg_per_ha?: string;
  primary_product?: PrimaryProduct;
  economic_category?: EconomicCategory;
  market_value_per_kg?: string;
  secondary_products?: string[];
  propagation_method?: PropagationMethod;
  fertilization_need?: DroughtTolerance;
  pest_susceptibility?: DroughtTolerance;
  disease_susceptibility?: DroughtTolerance;
  planting_season?: string[];
  harvest_season?: string[];
  pruning_required?: boolean;
  irrigation_required?: boolean;
  agroforestry_role?: string;
  pollinator_value?: PollinatorValue;
  carbon_sequestration_estimate?: string;
  biodiversity_score?: string;
  erosion_control?: boolean;
  source_type?: SourceType;
  review_status?: ReviewStatus;
  source_reference?: string;
  confidence_score?: string;
}

interface CalculatedData {
  plants_per_m2?: number;
  plants_per_hectare?: number;
  // Add other calculated fields as needed
}

type TabType = "identity" | "growth" | "yield" | "cultivation" | "ecology" | "metadata";

// Dummy initial data for demonstration
const initialForm: PlantFormData = {
  plant_code: "",
  scientific_name: "",
  genus: "",
  species: "",
  family: "",
  common_name_nl: "",
  common_name_en: "",
  plant_type: "annual",
  growth_form: "herbaceous",
  origin_region: "",
  is_native: false,
  category: "",
  climate_zones: [],
  temperature_min_c: "",
  temperature_max_c: "",
  frost_tolerance_c: "",
  rainfall_min_mm_year: "",
  rainfall_max_mm_year: "",
  drought_tolerance: "medium",
  sun_requirement: "full_sun",
  wind_tolerance: "medium",
  elevation_min_m: "",
  elevation_max_m: "",
  soil_type_preference: [],
  // Add other fields as needed
};

const initialCalculated: CalculatedData = {
  plants_per_m2: undefined,
  plants_per_hectare: undefined,
};

// Debug: log enriched data to console for troubleshooting
function mapEnrichedToForm(enriched: Record<string, any>): Partial<PlantFormData> {
  console.log("Enriched data:", enriched);
  return {
    plant_code: enriched.plant_code || enriched.code || "",
    scientific_name: enriched.scientific_name || enriched.latin_name || "",
    genus: enriched.genus || enriched.genus_name || "",
    species: enriched.species || enriched.species_name || "",
    family: enriched.family || enriched.family_name || "",
    common_name_nl: enriched.common_name_nl || enriched.dutch_name || "",
    common_name_en: enriched.common_name_en || enriched.english_name || "",
    plant_type: enriched.plant_type || enriched.life_cycle || "annual",
    growth_form: enriched.growth_form || enriched.growth_type || "herbaceous",
    origin_region: enriched.origin_region || enriched.region || "",
    is_native: enriched.is_native ?? false,
    category: enriched.category || enriched.type || "",
    climate_zones: enriched.climate_zones || [],
    temperature_min_c: enriched.temperature_min_c || "",
    temperature_max_c: enriched.temperature_max_c || "",
    rainfall_min_mm_year: enriched.rainfall_min_mm_year || "",
    rainfall_max_mm_year: enriched.rainfall_max_mm_year || "",
    drought_tolerance: enriched.drought_tolerance || "medium",
    sun_requirement: enriched.sun_requirement || "full_sun",
    wind_tolerance: enriched.wind_tolerance || "medium",
    elevation_min_m: enriched.elevation_min_m || "",
    elevation_max_m: enriched.elevation_max_m || "",
    soil_type_preference: enriched.soil_type_preference || [],
    spacing_plant_cm: enriched.spacing_plant_cm || "",
    growth_rate: enriched.growth_rate || "medium",
    harvest_frequency: enriched.harvest_frequency || "once",
    days_to_germination: enriched.days_to_germination || "",
    days_to_first_harvest: enriched.days_to_first_harvest || "",
    months_to_productive: enriched.months_to_productive || "",
    productive_lifespan_years: enriched.productive_lifespan_years || "",
    total_lifespan_years: enriched.total_lifespan_years || "",
    yield_min_kg_per_plant: enriched.yield_min_kg_per_plant || "",
    yield_max_kg_per_plant: enriched.yield_max_kg_per_plant || "",
    yield_min_kg_per_ha: enriched.yield_min_kg_per_ha || "",
    yield_max_kg_per_ha: enriched.yield_max_kg_per_ha || "",
    primary_product: enriched.primary_product || "seed",
    economic_category: enriched.economic_category || "food",
    market_value_per_kg: enriched.market_value_per_kg || "",
    secondary_products: enriched.secondary_products || [],
    propagation_method: enriched.propagation_method || "seed",
    fertilization_need: enriched.fertilization_need || "medium",
    pest_susceptibility: enriched.pest_susceptibility || "medium",
    disease_susceptibility: enriched.disease_susceptibility || "medium",
    planting_season: enriched.planting_season || [],
    harvest_season: enriched.harvest_season || [],
    pruning_required: enriched.pruning_required ?? false,
    irrigation_required: enriched.irrigation_required ?? false,
    agroforestry_role: enriched.agroforestry_role || "",
    pollinator_value: enriched.pollinator_value || "medium",
    carbon_sequestration_estimate: enriched.carbon_sequestration_estimate || "",
    biodiversity_score: enriched.biodiversity_score || "",
    erosion_control: enriched.erosion_control ?? false,
    source_type: enriched.source_type || "manual",
    review_status: enriched.review_status || "draft",
    source_reference: enriched.source_reference || "",
    confidence_score: enriched.confidence_score || "",
  };
}

export function PlantIntakeForm({ onSuccess, onCancel }: PlantIntakeFormProps) {
  const [form, setForm] = useState<PlantFormData>(initialForm);
  const [calculated, setCalculated] = useState<CalculatedData>(initialCalculated);
  const [activeTab, setActiveTab] = useState<TabType>("identity");
  const [showPreview, setShowPreview] = useState<boolean>(false);

  // Dummy update function
  function upd<K extends keyof PlantFormData>(key: K, value: PlantFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Cancel handler
  function handleCancel() {
    if (onCancel) {
      onCancel();
    }
    // Additional cancel logic if needed
  }

  // Submit handler
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Implement submit logic here
    if (onSuccess) {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.formContainer}>
      <h2 className={styles.heading}>Plant toevoegen</h2>
      {/* Scraper button boven de naamvelden */}
      <PlantScrapeButton
        plantName={form.scientific_name || form.common_name_en}
        onEnriched={data => setForm(prev => ({ ...prev, ...mapEnrichedToForm(data) }))}
      />
      <Label required>Plant Code</Label>
      <Input value={form.plant_code} onChange={e => upd("plant_code", e.target.value)} required placeholder="bijv. COWPEA" />
      <Label required>Wetenschappelijke Naam</Label>
      <Input value={form.scientific_name} onChange={e => upd("scientific_name", e.target.value)} required placeholder="bijv. Vigna unguiculata" />
      <Label>Geslacht (Genus)</Label>
      <Input value={form.genus} onChange={e => upd("genus", e.target.value)} placeholder="bijv. Vigna" />
      <Label>Soort (Species)</Label>
      <Input value={form.species} onChange={e => upd("species", e.target.value)} placeholder="bijv. unguiculata" />
      <Label>Familie</Label>
      <Input value={form.family} onChange={e => upd("family", e.target.value)} placeholder="bijv. Fabaceae" />
      <Label>Categorie</Label>
      <Select value={form.category} onChange={e => upd("category", e.target.value)}>
        <option value="">Selecteer...</option>
        <option value="cereal">Graan</option>
        <option value="legume">Peulvrucht</option>
        <option value="oil_seed">Oliehoudend zaad</option>
        <option value="vegetable">Groente</option>
        <option value="root_crop">Wortelgewas</option>
        <option value="leafy_green">Bladgroente</option>
        <option value="herb">Kruid</option>
        <option value="fruit_tree">Fruitboom</option>
        <option value="multipurpose_tree">Meerdoelsboom</option>
        <option value="protective_tree">Beschermende boom</option>
        <option value="nitrogen_fixer">Stikstofbinder</option>
        <option value="cover_crop">Bodembedekker</option>
        <option value="erosion_control">Erosiebescherming</option>
      </Select>
      <Label>Nederlandse Naam</Label>
      <Input value={form.common_name_nl} onChange={e => upd("common_name_nl", e.target.value)} placeholder="bijv. Koepeul" />
      <Label>Engelse Naam</Label>
      <Input value={form.common_name_en} onChange={e => upd("common_name_en", e.target.value)} placeholder="bijv. Cowpea" />
      <Label>Planttype</Label>
      <Select value={form.plant_type} onChange={e => upd("plant_type", e.target.value as PlantType)}>
        <option value="annual">Eenjarig</option>
        <option value="perennial">Meerjarig</option>
        <option value="shrub">Struik</option>
        <option value="tree">Boom</option>
        <option value="vine">Klimplant</option>
        <option value="grass">Gras</option>
      </Select>
      <Label>Groeivorm</Label>
      <Select value={form.growth_form} onChange={e => upd("growth_form", e.target.value as GrowthForm)}>
        <option value="herbaceous">Kruidachtig</option>
        <option value="woody">Houtig</option>
      </Select>
      <Label>Herkomst Regio</Label>
      <Input value={form.origin_region} onChange={e => upd("origin_region", e.target.value)} placeholder="bijv. West-Afrika" />
      <Checkbox label="Inheems (Native)" checked={form.is_native} onChange={v => upd("is_native", v)} />
      <div className={styles.buttonGroup}>
        <button type="submit" className={styles.saveButton}>Opslaan</button>
        <button type="button" onClick={handleCancel} className={styles.cancelButton}>Annuleer</button>
      </div>
    </form>
  );
}
