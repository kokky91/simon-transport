import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageTitle } from "../../components/ui/PageTitle";
import InfraViewport from "./InfraViewport";
import {
  type Building,
  createInfraField,
  deleteInfraBuilding,
  deleteInfraField,
  type FieldPlot,
  getInfraWorld,
  moveInfraBuilding,
  moveInfraField,
  type InfraMode,
  type InfraWorldResponse,
  updateInfraBuilding,
  updateInfraField,
} from "./infraApi";
import { useSimulationStream } from "./useSimulationStream";

export function LiveSimulationView() {
  const queryClient = useQueryClient();
  const { events, isConnected, connectionIssue } = useSimulationStream();
  const [mode, setMode] = useState<InfraMode>("real");
  const [runId, setRunId] = useState("");
  const [label, setLabel] = useState("Nieuw veld");
  const [cropType, setCropType] = useState("none");
  const [xMeters, setXMeters] = useState(50);
  const [yMeters, setYMeters] = useState(50);
  const [widthMeters, setWidthMeters] = useState(120);
  const [heightMeters, setHeightMeters] = useState(90);
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();
  const [editingField, setEditingField] = useState<FieldPlot | null>(null);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const trimmedRunId = runId.trim();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["infra-world", mode, trimmedRunId || "no-run-id"],
    queryFn: () => getInfraWorld(mode, trimmedRunId || undefined),
  });

  const createFieldMutation = useMutation({
    mutationFn: createInfraField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["infra-world", mode, trimmedRunId || "no-run-id"] });
    },
  });

  const moveFieldMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      x_m: number;
      y_m: number;
      mode: InfraMode;
      runId?: string;
    }) =>
      moveInfraField(payload.id, {
        x_m: payload.x_m,
        y_m: payload.y_m,
        mode: payload.mode,
        runId: payload.runId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["infra-world", mode, trimmedRunId || "no-run-id"] });
    },
  });

  const moveBuildingMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      x_m: number;
      y_m: number;
      mode: InfraMode;
      runId?: string;
    }) =>
      moveInfraBuilding(payload.id, {
        x_m: payload.x_m,
        y_m: payload.y_m,
        mode: payload.mode,
        runId: payload.runId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["infra-world", mode, trimmedRunId || "no-run-id"] });
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      label: string;
      crop_type: string;
      x_m: number;
      y_m: number;
      width_m: number;
      height_m: number;
      mode: InfraMode;
      runId?: string;
    }) =>
      updateInfraField(payload.id, {
        label: payload.label,
        crop_type: payload.crop_type,
        x_m: payload.x_m,
        y_m: payload.y_m,
        width_m: payload.width_m,
        height_m: payload.height_m,
        mode: payload.mode,
        runId: payload.runId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["infra-world", mode, trimmedRunId || "no-run-id"] });
    },
  });

  const updateBuildingMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      type: string;
      x_m: number;
      y_m: number;
      width_m: number;
      height_m: number;
      mode: InfraMode;
      runId?: string;
    }) =>
      updateInfraBuilding(payload.id, {
        type: payload.type,
        x_m: payload.x_m,
        y_m: payload.y_m,
        width_m: payload.width_m,
        height_m: payload.height_m,
        mode: payload.mode,
        runId: payload.runId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["infra-world", mode, trimmedRunId || "no-run-id"] });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: (fieldId: string) =>
      deleteInfraField(fieldId, mode, mode === "sim" ? trimmedRunId : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["infra-world", mode, trimmedRunId || "no-run-id"] });
    },
  });

  const deleteBuildingMutation = useMutation({
    mutationFn: (buildingId: string) =>
      deleteInfraBuilding(buildingId, mode, mode === "sim" ? trimmedRunId : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["infra-world", mode, trimmedRunId || "no-run-id"] });
    },
  });

  const realtimeHighlightId = useMemo(() => {
    const event = events.find((candidate) => candidate.type === "INFRA_ASSET_HIGHLIGHT");
    if (!event || !event.payload || typeof event.payload !== "object") {
      return undefined;
    }
    const assetId = (event.payload as { assetId?: unknown }).assetId;
    return typeof assetId === "string" ? assetId : undefined;
  }, [events]);

  const highlightId = selectedAssetId ?? realtimeHighlightId;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredPlots = useMemo(() => {
    if (!data) {
      return [];
    }
    if (!normalizedSearch) {
      return data.plots;
    }
    return data.plots.filter((plot) =>
      [plot.label, plot.crop_type, plot.id].some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [data, normalizedSearch]);

  const filteredBuildings = useMemo(() => {
    if (!data) {
      return [];
    }
    if (!normalizedSearch) {
      return data.buildings;
    }
    return data.buildings.filter((building) =>
      [building.type, building.id].some((value) => value.toLowerCase().includes(normalizedSearch))
    );
  }, [data, normalizedSearch]);

  return (
    <section>
      <PageTitle
        title="Simulation Live View"
        subtitle="Realtime infrastructuurkaart in meters, met zoom/pan en event-highlights."
      />
      <div className="os-segmented-control">
        <button
          className={`os-segment ${mode === "real" ? "active" : ""}`}
          onClick={() => setMode("real")}
          type="button"
        >
          Real
        </button>
        <button
          className={`os-segment ${mode === "sim" ? "active" : ""}`}
          onClick={() => setMode("sim")}
          type="button"
        >
          Sim
        </button>
      </div>
      {mode === "sim" ? (
        <label className="infra-runid-input">
          Run ID (sim)
          <input
            id="sim-run-id"
            name="runId"
            value={runId}
            onChange={(event) => setRunId(event.target.value)}
            placeholder="uuid"
          />
        </label>
      ) : null}
      <form
        className="infra-field-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (mode !== "real") {
            return;
          }
          createFieldMutation.mutate({
            label,
            crop_type: cropType,
            x_m: xMeters,
            y_m: yMeters,
            width_m: widthMeters,
            height_m: heightMeters,
          });
        }}
      >
        <strong>Add field specs</strong>
        <label>
          Label
          <input
            id="new-field-label"
            name="label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            required
          />
        </label>
        <label>
          Irrigation
          <select
            id="new-field-irrigation"
            name="irrigation"
            value={cropType}
            onChange={(event) => setCropType(event.target.value)}
            required
          >
            <option value="none">none</option>
            <option value="drip">drip</option>
            <option value="fleed">fleed</option>
            <option value="spay">spay</option>
          </select>
        </label>
        <label>
          X (m)
          <input
            id="new-field-x"
            name="x_m"
            type="number"
            value={xMeters}
            onChange={(event) => setXMeters(Number(event.target.value))}
            min={0}
            required
          />
        </label>
        <label>
          Y (m)
          <input
            id="new-field-y"
            name="y_m"
            type="number"
            value={yMeters}
            onChange={(event) => setYMeters(Number(event.target.value))}
            min={0}
            required
          />
        </label>
        <label>
          Width (m)
          <input
            id="new-field-width"
            name="width_m"
            type="number"
            value={widthMeters}
            onChange={(event) => setWidthMeters(Number(event.target.value))}
            min={1}
            required
          />
        </label>
        <label>
          Height (m)
          <input
            id="new-field-height"
            name="height_m"
            type="number"
            value={heightMeters}
            onChange={(event) => setHeightMeters(Number(event.target.value))}
            min={1}
            required
          />
        </label>
        <button type="submit" disabled={createFieldMutation.isPending || mode !== "real"}>
          {createFieldMutation.isPending ? "Adding..." : "Add field"}
        </button>
        {mode !== "real" ? <span className="infra-field-form-note">Field creation is available in real mode.</span> : null}
        {createFieldMutation.isError ? (
          <span className="infra-field-form-error">
            {createFieldMutation.error instanceof Error
              ? createFieldMutation.error.message
              : "Failed to add field"}
          </span>
        ) : null}
      </form>
      <p>Status: {isConnected ? "connected" : "disconnected"}</p>
      {connectionIssue ? <p>Realtime issue: {connectionIssue}</p> : null}
      {isLoading ? <p>Loading infra world...</p> : null}
      {isError ? <p>Failed to load infra world.</p> : null}
      {data ? (
        <div className="infra-live-layout">
          <div className="infra-live-canvas">
            <InfraViewport
              farm={data.farm}
              plots={data.plots}
              buildings={data.buildings}
              highlightId={highlightId}
              onMoveField={async (payload) => {
                const key = ["infra-world", mode, trimmedRunId || "no-run-id"] as const;
                const previous = queryClient.getQueryData<InfraWorldResponse>(key);
                queryClient.setQueryData<InfraWorldResponse>(key, (current) => {
                  if (!current) {
                    return current;
                  }
                  return {
                    ...current,
                    plots: current.plots.map((plot) =>
                      plot.id === payload.id ? { ...plot, x_m: payload.x_m, y_m: payload.y_m } : plot
                    ),
                  };
                });

                try {
                  await moveFieldMutation.mutateAsync({
                    ...payload,
                    mode,
                    runId: mode === "sim" ? trimmedRunId : undefined,
                  });
                } catch (error) {
                  if (previous) {
                    queryClient.setQueryData(key, previous);
                  }
                  throw error;
                }
              }}
              onMoveBuilding={async (payload) => {
                const key = ["infra-world", mode, trimmedRunId || "no-run-id"] as const;
                const previous = queryClient.getQueryData<InfraWorldResponse>(key);
                queryClient.setQueryData<InfraWorldResponse>(key, (current) => {
                  if (!current) {
                    return current;
                  }
                  return {
                    ...current,
                    buildings: current.buildings.map((building) =>
                      building.id === payload.id
                        ? { ...building, x_m: payload.x_m, y_m: payload.y_m }
                        : building
                    ),
                  };
                });

                try {
                  await moveBuildingMutation.mutateAsync({
                    ...payload,
                    mode,
                    runId: mode === "sim" ? trimmedRunId : undefined,
                  });
                } catch (error) {
                  if (previous) {
                    queryClient.setQueryData(key, previous);
                  }
                  throw error;
                }
              }}
            />
          </div>

          <aside className="infra-side-list">
            <h3>Toegevoegd ({data.plots.length + data.buildings.length})</h3>
            <input
              id="asset-search"
              name="assetSearch"
              className="infra-side-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Zoek naam/type/id..."
              title="Zoek assets"
            />
            <div className="infra-side-section">
              <strong>Velden ({filteredPlots.length}/{data.plots.length})</strong>
              {filteredPlots.map((plot) => (
                <div
                  key={plot.id}
                  className={`infra-side-item ${selectedAssetId === plot.id ? "active" : ""}`}
                  onClick={() => setSelectedAssetId(plot.id)}
                >
                  {editingField?.id === plot.id ? (
                    <form
                      className="infra-side-edit-grid"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        await updateFieldMutation.mutateAsync({
                          id: editingField.id,
                          label: editingField.label,
                          crop_type: editingField.crop_type,
                          x_m: editingField.x_m,
                          y_m: editingField.y_m,
                          width_m: editingField.width_m,
                          height_m: editingField.height_m,
                          mode,
                          runId: mode === "sim" ? trimmedRunId : undefined,
                        });
                        setEditingField(null);
                      }}
                    >
                      <input
                        name="label"
                        value={editingField.label}
                        title="Field label"
                        placeholder="Label"
                        onChange={(event) => setEditingField({ ...editingField, label: event.target.value })}
                      />
                      <select
                        name="irrigation"
                        value={editingField.crop_type}
                        title="Irrigation"
                        onChange={(event) => setEditingField({ ...editingField, crop_type: event.target.value })}
                      >
                        <option value="none">none</option>
                        <option value="drip">drip</option>
                        <option value="fleed">fleed</option>
                        <option value="spay">spay</option>
                      </select>
                      <input
                        name="x_m"
                        type="number"
                        value={editingField.x_m}
                        title="X meter"
                        placeholder="X"
                        onChange={(event) => setEditingField({ ...editingField, x_m: Number(event.target.value) })}
                      />
                      <input
                        name="y_m"
                        type="number"
                        value={editingField.y_m}
                        title="Y meter"
                        placeholder="Y"
                        onChange={(event) => setEditingField({ ...editingField, y_m: Number(event.target.value) })}
                      />
                      <input
                        name="width_m"
                        type="number"
                        value={editingField.width_m}
                        title="Width meter"
                        placeholder="Width"
                        onChange={(event) => setEditingField({ ...editingField, width_m: Number(event.target.value) })}
                      />
                      <input
                        name="height_m"
                        type="number"
                        value={editingField.height_m}
                        title="Height meter"
                        placeholder="Height"
                        onChange={(event) => setEditingField({ ...editingField, height_m: Number(event.target.value) })}
                      />
                      <div className="infra-side-actions">
                        <button type="submit" disabled={updateFieldMutation.isPending}>Save</button>
                        <button type="button" onClick={() => setEditingField(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p>{plot.label}</p>
                      <small>
                        irrigation: {plot.crop_type} • x:{plot.x_m.toFixed(1)} y:{plot.y_m.toFixed(1)} • {plot.width_m}×{plot.height_m}m
                      </small>
                      <div className="infra-side-actions">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingBuilding(null);
                            setEditingField(plot);
                          }}
                        >
                          Bewerk
                        </button>
                        <button
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            if (!window.confirm("Veld verwijderen?")) {
                              return;
                            }
                            await deleteFieldMutation.mutateAsync(plot.id);
                            if (selectedAssetId === plot.id) {
                              setSelectedAssetId(undefined);
                            }
                          }}
                        >
                          Verwijder
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {!filteredPlots.length ? <small>Geen velden gevonden voor deze zoekterm.</small> : null}
            </div>

            <div className="infra-side-section">
              <strong>Gebouwen ({filteredBuildings.length}/{data.buildings.length})</strong>
              {filteredBuildings.map((building) => (
                <div
                  key={building.id}
                  className={`infra-side-item ${selectedAssetId === building.id ? "active" : ""}`}
                  onClick={() => setSelectedAssetId(building.id)}
                >
                  {editingBuilding?.id === building.id ? (
                    <form
                      className="infra-side-edit-grid"
                      onSubmit={async (event) => {
                        event.preventDefault();
                        await updateBuildingMutation.mutateAsync({
                          id: editingBuilding.id,
                          type: editingBuilding.type,
                          x_m: editingBuilding.x_m,
                          y_m: editingBuilding.y_m,
                          width_m: editingBuilding.width_m,
                          height_m: editingBuilding.height_m,
                          mode,
                          runId: mode === "sim" ? trimmedRunId : undefined,
                        });
                        setEditingBuilding(null);
                      }}
                    >
                      <input
                        name="type"
                        value={editingBuilding.type}
                        title="Building type"
                        placeholder="Type"
                        onChange={(event) => setEditingBuilding({ ...editingBuilding, type: event.target.value })}
                      />
                      <input
                        name="x_m"
                        type="number"
                        value={editingBuilding.x_m}
                        title="X meter"
                        placeholder="X"
                        onChange={(event) => setEditingBuilding({ ...editingBuilding, x_m: Number(event.target.value) })}
                      />
                      <input
                        name="y_m"
                        type="number"
                        value={editingBuilding.y_m}
                        title="Y meter"
                        placeholder="Y"
                        onChange={(event) => setEditingBuilding({ ...editingBuilding, y_m: Number(event.target.value) })}
                      />
                      <input
                        name="width_m"
                        type="number"
                        value={editingBuilding.width_m}
                        title="Width meter"
                        placeholder="Width"
                        onChange={(event) => setEditingBuilding({ ...editingBuilding, width_m: Number(event.target.value) })}
                      />
                      <input
                        name="height_m"
                        type="number"
                        value={editingBuilding.height_m}
                        title="Height meter"
                        placeholder="Height"
                        onChange={(event) => setEditingBuilding({ ...editingBuilding, height_m: Number(event.target.value) })}
                      />
                      <div className="infra-side-actions">
                        <button type="submit" disabled={updateBuildingMutation.isPending}>Save</button>
                        <button type="button" onClick={() => setEditingBuilding(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <p>{building.type}</p>
                      <small>
                        x:{building.x_m.toFixed(1)} y:{building.y_m.toFixed(1)} • {building.width_m}×{building.height_m}m
                      </small>
                      <div className="infra-side-actions">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingField(null);
                            setEditingBuilding(building);
                          }}
                        >
                          Bewerk
                        </button>
                        <button
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            if (!window.confirm("Gebouw verwijderen?")) {
                              return;
                            }
                            await deleteBuildingMutation.mutateAsync(building.id);
                            if (selectedAssetId === building.id) {
                              setSelectedAssetId(undefined);
                            }
                          }}
                        >
                          Verwijder
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {!filteredBuildings.length ? <small>Geen gebouwen gevonden voor deze zoekterm.</small> : null}
            </div>
          </aside>
        </div>
      ) : null}
      {moveFieldMutation.isError ? (
        <p className="infra-field-form-error">
          {moveFieldMutation.error instanceof Error ? moveFieldMutation.error.message : "Failed to move field"}
        </p>
      ) : null}
      {moveBuildingMutation.isError ? (
        <p className="infra-field-form-error">
          {moveBuildingMutation.error instanceof Error
            ? moveBuildingMutation.error.message
            : "Failed to move building"}
        </p>
      ) : null}
      {updateFieldMutation.isError ? (
        <p className="infra-field-form-error">
          {updateFieldMutation.error instanceof Error
            ? updateFieldMutation.error.message
            : "Failed to update field"}
        </p>
      ) : null}
      {updateBuildingMutation.isError ? (
        <p className="infra-field-form-error">
          {updateBuildingMutation.error instanceof Error
            ? updateBuildingMutation.error.message
            : "Failed to update building"}
        </p>
      ) : null}
      {deleteFieldMutation.isError ? (
        <p className="infra-field-form-error">
          {deleteFieldMutation.error instanceof Error
            ? deleteFieldMutation.error.message
            : "Failed to delete field"}
        </p>
      ) : null}
      {deleteBuildingMutation.isError ? (
        <p className="infra-field-form-error">
          {deleteBuildingMutation.error instanceof Error
            ? deleteBuildingMutation.error.message
            : "Failed to delete building"}
        </p>
      ) : null}
    </section>
  );
}