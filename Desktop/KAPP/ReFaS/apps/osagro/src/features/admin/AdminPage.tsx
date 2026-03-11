import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageTitle } from "../../components/ui/PageTitle";
import { useSessionStore } from "../../store/sessionStore";
import {
  getModelPerformance,
  type PerformanceRangePreset,
  type PerformanceSortField,
  type PerformanceSortOrder
} from "./api";

function toPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function decodeRoleFromToken(token: string | null): string | null {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function AdminPage() {
  const accessToken = useSessionStore((state) => state.accessToken);
  const role = decodeRoleFromToken(accessToken);
  const isAdmin = role === "admin";

  const [promptVersion, setPromptVersion] = useState("");
  const [rangePreset, setRangePreset] = useState<PerformanceRangePreset>("30d");
  const [sortField, setSortField] = useState<PerformanceSortField>("win_rate");
  const [sortOrder, setSortOrder] = useState<PerformanceSortOrder>("desc");

  function onSort(field: PerformanceSortField) {
    if (field === sortField) {
      setSortOrder((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }

    setSortField(field);
    setSortOrder("desc");
  }

  function getSortIndicator(field: PerformanceSortField) {
    if (field !== sortField) {
      return "";
    }
    return sortOrder === "desc" ? " ▼" : " ▲";
  }

  const performanceQuery = useQuery({
    queryKey: ["admin-ai-performance", rangePreset, promptVersion, sortField, sortOrder],
    queryFn: () => getModelPerformance(rangePreset, promptVersion || undefined, sortField, sortOrder),
    enabled: isAdmin,
    retry: false
  });

  const rangeLabel = rangePreset === "7d" ? "Last 7 days" : rangePreset === "90d" ? "Last 90 days" : "Last 30 days";

  return (
    <section>
      <PageTitle title="Admin" subtitle={`Model Performance (${rangeLabel})`} />

      {!isAdmin ? <p>Geen toegang. Deze pagina vereist admin-rechten.</p> : null}

      {isAdmin ? <div className="os-efficiency-card">
        <div className="os-segmented-control" role="group" aria-label="Performance range">
          <button
            type="button"
            className={`os-segment ${rangePreset === "7d" ? "active" : ""}`}
            onClick={() => setRangePreset("7d")}
          >
            7D
          </button>
          <button
            type="button"
            className={`os-segment ${rangePreset === "30d" ? "active" : ""}`}
            onClick={() => setRangePreset("30d")}
          >
            30D
          </button>
          <button
            type="button"
            className={`os-segment ${rangePreset === "90d" ? "active" : ""}`}
            onClick={() => setRangePreset("90d")}
          >
            90D
          </button>
        </div>

        <label>
          Prompt version filter
          <input
            type="text"
            value={promptVersion}
            onChange={(event) => setPromptVersion(event.target.value)}
            placeholder="bijv. plants-prefill.nl.txt"
            style={{ marginLeft: "0.5rem" }}
          />
        </label>

        {performanceQuery.isLoading ? <p>Laden...</p> : null}
        {performanceQuery.isError ? <p>Kon performance-data niet laden.</p> : null}

        {!performanceQuery.isLoading && !performanceQuery.isError ? (
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Prompt</th>
                <th>Recommendation</th>
                <th>
                  <button type="button" onClick={() => onSort("avg_score")}>
                    Avg Score{getSortIndicator("avg_score")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => onSort("avg_latency_ms")}>
                    Avg Latency (ms){getSortIndicator("avg_latency_ms")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => onSort("win_rate")}>
                    Win Rate{getSortIndicator("win_rate")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => onSort("total_runs")}>
                    Total Runs{getSortIndicator("total_runs")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {(performanceQuery.data ?? []).map((row) => (
                <tr key={`${row.model_name}-${row.prompt_version}`}>
                  <td>
                    {row.model_name}
                    {row.is_recommended ? (
                      <span title="Based on win rate, score and sample size"> ⭐ Recommended</span>
                    ) : null}
                  </td>
                  <td>{row.prompt_version}</td>
                  <td>{row.recommended_score.toFixed(4)}</td>
                  <td>{row.avg_score.toFixed(4)}</td>
                  <td>{Math.round(row.avg_latency_ms)}</td>
                  <td>{toPercent(row.win_rate)}</td>
                  <td>{row.total_runs}{row.total_runs < 5 ? " (low sample)" : ""}</td>
                </tr>
              ))}
              {(performanceQuery.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7}>Geen data in geselecteerde periode.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        ) : null}
      </div> : null}
    </section>
  );
}
