import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageTitle } from "../../components/ui/PageTitle";
import InfraViewport from "./InfraViewport";
import {
  getInfraWorld,
  moveInfraBuilding,
  moveInfraField,
  type InfraMode,
  type InfraWorldResponse,
} from "./infraApi";
import { useSimulationStream } from "./useSimulationStream";

export function LiveSimulationView() {
  const queryClient = useQueryClient();
  const { isConnected } = useSimulationStream();
  const [mode, setMode] = useState<InfraMode>("real");
  const [runId, setRunId] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>();

  const trimmedRunId = runId.trim();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["infra-world", mode, trimmedRunId || "no-run-id"],
    queryFn: () => getInfraWorld(mode, trimmedRunId || undefined),
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

  return (
    <section>
      <PageTitle title="Live View - 2D Canvas" subtitle="Real-time field and building visualization" />

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
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
        {mode === "sim" && (
          <input
            type="text"
            value={runId}
            onChange={(e) => setRunId(e.target.value)}
            placeholder="Enter Run ID..."
            style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        )}
        <span style={{ fontSize: "0.9rem", fontWeight: "bold", color: isConnected ? "#0d8900" : "#c90000" }}>
          {isConnected ? "🟢 Live" : "🔴 Offline"}
        </span>
      </div>

      {isLoading && <p style={{ textAlign: "center", padding: "2rem" }}>Loading canvas...</p>}
      {isError && <p style={{ textAlign: "center", padding: "2rem", color: "red" }}>Failed to load canvas.</p>}

      {data && (
        <div style={{ width: "100%", height: "700px", border: "1px solid #999", borderRadius: "8px", overflow: "hidden" }}>
          <InfraViewport
            farm={data.farm}
            plots={data.plots}
            buildings={data.buildings}
            highlightId={selectedAssetId}
            onMoveField={async (payload) => {
              const key = ["infra-world", mode, trimmedRunId || "no-run-id"] as const;
              const previous = queryClient.getQueryData<InfraWorldResponse>(key);
              queryClient.setQueryData<InfraWorldResponse>(key, (current) => {
                if (!current) return current;
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
                if (!current) return current;
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
      )}
    </section>
  );
}
