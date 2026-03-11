// hooks/usePlantAIFlow.ts
// Orchestrates the full AI plant intake flow:
//   1. uploadDocument  – upload PDF → get documentId
//   2. generate        – AI prefill for one model
//   3. compare         – run multiple models in parallel
//   4. applyGeneration – persist chosen generation as active version
//   5. loadHistory     – fetch version history for a plant

import { useCallback } from "react";
import { usePlantStore } from "../store/plantStore";import {
  uploadPlantDocument,
  comparePlantModels,
  applyGeneration,
  getPlantVersions,
} from "../api/plantsApi";
import type { CompareParams, ApplyParams } from "../api/plantsApi";

// ─── Available models ─────────────────────────────────────────────────────────
export const AVAILABLE_MODELS = [
  "claude-3-5-haiku-20241022",
  "claude-3-5-sonnet-20241022",
  "claude-opus-4",
] as const;

export type ModelName = (typeof AVAILABLE_MODELS)[number];

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePlantAIFlow() {
  const { setState } = usePlantStore();

  // Read state slices we need to expose back
  const store = usePlantStore();

  // ── 1. Upload PDF document ─────────────────────────────────────────────────
  const uploadDocument = useCallback(
    async (file: File) => {
      setState({ selectedFile: file, fileError: null });

      try {
        const result = await uploadPlantDocument(file, (_pct) => {
          // pct available for a progress bar if needed
        });

        setState({
          uploadSuccess: {
            documentId: result.documentId,
            fileName: result.fileName,
            aiSummary: result.aiSummary,
            plantId: result.plantId,
          },
          // Pre-fill plant name from the AI summary if available
          plantName: result.fileName.replace(/\.[^.]+$/, ""),
        });

        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload mislukt";
        setState({ fileError: message, uploadSuccess: null });
        throw err;
      }
    },
    [setState]
  );

  // ── 2. Compare multiple models ─────────────────────────────────────────────
  // Requires documentId from a prior uploadDocument call.
  // RBAC: editor, ai_reviewer, admin
  const compare = useCallback(
    async (documentId: string, params: CompareParams) => {
      setState({ selectedCompareModels: params.model_names });

      try {
        const result = await comparePlantModels(documentId, params);

        setState({ compareResult: result });

        // Auto-apply prefill from the recommended generation
        if (result.recommended_generation_id) {
          const recommended = result.results.find(
            (r) => r.generation_id === result.recommended_generation_id
          );
          if (recommended) {
            setState({
              prefillData: recommended.prefill_data,
              generatedSummary: recommended.generated_summary,
              qualityWarnings: recommended.quality_warnings,
              fieldConfidence: recommended.field_confidence,
              overallConfidenceScore: recommended.overall_confidence_score,
              externalValidation: recommended.external_validation,
              hasPrefill: true,
              modelName: recommended.model_name,
            });
          }
        }

        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Vergelijking mislukt";
        setState({ fileError: message });
        throw err;
      }
    },
    [setState]
  );

  // ── 4. Select a specific generation from compare results ───────────────────
  const selectGeneration = useCallback(
    (generationId: string) => {
      // Read directly from the store singleton (safe outside React render)
      const result = store.compareResult;
      if (!result) return;

      const chosen = result.results.find(
        (r) => r.generation_id === generationId
      );
      if (!chosen) return;

      setState({
        prefillData: chosen.prefill_data,
        generatedSummary: chosen.generated_summary,
        qualityWarnings: chosen.quality_warnings,
        fieldConfidence: chosen.field_confidence,
        overallConfidenceScore: chosen.overall_confidence_score,
        externalValidation: chosen.external_validation,
        hasPrefill: true,
        modelName: chosen.model_name,
        appliedGenerationId: null, // reset applied state
      });
    },
    [setState]
  );

  // ── 4. Apply generation → persist as active version ───────────────────────
  // RBAC: ai_reviewer, admin
  const apply = useCallback(
    async (documentId: string, params: ApplyParams) => {
      try {
        const result = await applyGeneration(documentId, params);
        setState({ appliedGenerationId: params.generation_id });
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Opslaan mislukt";
        setState({ fileError: message });
        throw err;
      }
    },
    [setState]
  );

  // ── 5. Load version history for a plant ───────────────────────────────────
  const loadHistory = useCallback(
    async (plantId: string) => {
      setState({ isHistoryOpen: true });

      try {
        const { versions } = await getPlantVersions({ plantId });
        setState({ versionHistory: versions });
        return versions;
      } catch (err) {
        setState({ isHistoryOpen: false });
        throw err;
      }
    },
    [setState]
  );

  // ── 6. Reset the entire flow ───────────────────────────────────────────────
  const reset = useCallback(() => {
    setState({
      plantName: "",
      selectedFile: null,
      modelName: "",
      fileError: null,
      hasPrefill: false,
      uploadSuccess: null,
      compareResult: null,
      appliedGenerationId: null,
      qualityWarnings: [],
      fieldConfidence: {},
      overallConfidenceScore: 0,
    });
  }, [setState]);

  // ── 7. Copy audit value to clipboard ──────────────────────────────────────
  const copyAuditValue = useCallback(
    async (value: string) => {
      await navigator.clipboard.writeText(value);
      setState({ copiedAuditValue: value });
      setTimeout(() => setState({ copiedAuditValue: null }), 2000);
    },
    [setState]
  );

  return {
    // State (read-only snapshot)
    plantName: store.plantName,
    selectedFile: store.selectedFile,
    modelName: store.modelName,
    fileError: store.fileError,
    prefillData: store.prefillData,
    generatedSummary: store.generatedSummary,
    qualityWarnings: store.qualityWarnings,
    fieldConfidence: store.fieldConfidence,
    overallConfidenceScore: store.overallConfidenceScore,
    externalValidation: store.externalValidation,
    hasPrefill: store.hasPrefill,
    uploadSuccess: store.uploadSuccess,
    isHistoryOpen: store.isHistoryOpen,
    versionHistory: store.versionHistory,
    compareResult: store.compareResult,
    appliedGenerationId: store.appliedGenerationId,
    copiedAuditValue: store.copiedAuditValue,

    // Setters
    setPlantName: (name: string) => setState({ plantName: name }),
    setModelName: (name: string) => setState({ modelName: name }),
    setHistoryOpen: (open: boolean) => setState({ isHistoryOpen: open }),

    // Actions
    uploadDocument,
    compare,
    selectGeneration,
    apply,
    loadHistory,
    reset,
    copyAuditValue,

    // Constants
    AVAILABLE_MODELS,
  };
}
