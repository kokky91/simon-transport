import { apiRequest } from "../../lib/api/client";

export type InfraMode = "real" | "sim";

export type FarmWorld = {
  id: string;
  width_m: number;
  height_m: number;
};

export type FieldPlot = {
  id: string;
  label: string;
  crop_type: string;
  x_m: number;
  y_m: number;
  width_m: number;
  height_m: number;
};

export type Building = {
  id: string;
  field_id: string | null;
  type: string;
  x_m: number;
  y_m: number;
  width_m: number;
  height_m: number;
};

export type InfraWorldResponse = {
  mode: InfraMode;
  farm: FarmWorld;
  plots: FieldPlot[];
  buildings: Building[];
};

export type CreateFieldPayload = {
  label: string;
  crop_type: string;
  x_m: number;
  y_m: number;
  width_m: number;
  height_m: number;
};

export type UpdatePositionPayload = {
  x_m: number;
  y_m: number;
  mode: InfraMode;
  runId?: string;
};

export type UpdateFieldPayload = {
  label: string;
  crop_type: string;
  x_m: number;
  y_m: number;
  width_m: number;
  height_m: number;
  mode: InfraMode;
  runId?: string;
};

export type UpdateBuildingPayload = {
  type: string;
  x_m: number;
  y_m: number;
  width_m: number;
  height_m: number;
  mode: InfraMode;
  runId?: string;
};

function withModeParams(mode: InfraMode, runId?: string) {
  if (mode === "sim" && !runId) {
    throw new Error("runId is required in sim mode.");
  }
  const params = new URLSearchParams({ mode });
  if (runId) {
    params.set("runId", runId);
  }
  return params;
}

export async function getInfraWorld(mode: InfraMode, runId?: string) {
  const params = new URLSearchParams({ mode });
  if (runId) {
    params.set("runId", runId);
  }
  return apiRequest<InfraWorldResponse>(`/infra/world?${params.toString()}`);
}

export async function createInfraField(payload: CreateFieldPayload) {
  return apiRequest<FieldPlot>("/infra/fields", {
    method: "POST",
    body: payload,
  });
}

export async function moveInfraField(fieldId: string, payload: UpdatePositionPayload) {
  const params = withModeParams(payload.mode, payload.runId);
  return apiRequest<FieldPlot>(`/infra/fields/${fieldId}/position?${params.toString()}`, {
    method: "PATCH",
    body: {
      x_m: payload.x_m,
      y_m: payload.y_m,
    },
  });
}

export async function moveInfraBuilding(buildingId: string, payload: UpdatePositionPayload) {
  const params = withModeParams(payload.mode, payload.runId);
  return apiRequest<Building>(`/infra/buildings/${buildingId}/position?${params.toString()}`, {
    method: "PATCH",
    body: {
      x_m: payload.x_m,
      y_m: payload.y_m,
    },
  });
}

export async function updateInfraField(fieldId: string, payload: UpdateFieldPayload) {
  const params = withModeParams(payload.mode, payload.runId);
  return apiRequest<FieldPlot>(`/infra/fields/${fieldId}?${params.toString()}`, {
    method: "PATCH",
    body: {
      label: payload.label,
      crop_type: payload.crop_type,
      x_m: payload.x_m,
      y_m: payload.y_m,
      width_m: payload.width_m,
      height_m: payload.height_m,
    },
  });
}

export async function updateInfraBuilding(buildingId: string, payload: UpdateBuildingPayload) {
  const params = withModeParams(payload.mode, payload.runId);
  return apiRequest<Building>(`/infra/buildings/${buildingId}?${params.toString()}`, {
    method: "PATCH",
    body: {
      type: payload.type,
      x_m: payload.x_m,
      y_m: payload.y_m,
      width_m: payload.width_m,
      height_m: payload.height_m,
    },
  });
}

export async function deleteInfraField(fieldId: string, mode: InfraMode, runId?: string) {
  const params = withModeParams(mode, runId);
  return apiRequest<{}>(`/infra/fields/${fieldId}?${params.toString()}`, {
    method: "DELETE",
  });
}

export async function deleteInfraBuilding(buildingId: string, mode: InfraMode, runId?: string) {
  const params = withModeParams(mode, runId);
  return apiRequest<{}>(`/infra/buildings/${buildingId}?${params.toString()}`, {
    method: "DELETE",
  });
}
