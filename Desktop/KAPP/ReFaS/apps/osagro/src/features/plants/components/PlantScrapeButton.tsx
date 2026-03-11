/**
 * PlantScrapeButton.tsx
 *
 * Drop-in knop voor PlantIntakeForm.
 * Roept POST /api/plants/scrape aan en geeft het resultaat terug
 * via onEnriched zodat het formulier de velden kan prefill-en.
 *
 * Gebruik:
 *   <PlantScrapeButton
 *     plantName={form.scientific_name || form.common_name_en}
 *     onEnriched={(data) => Object.entries(data).forEach(([k, v]) => upd(k as any, v as any))}
 *   />
 */
import { useState } from "react";
import { Sparkles, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { apiRequest } from "../../../lib/api/client";

interface ScrapeResponse {
  plant_name: string;
  enriched: Record<string, unknown>;
  sources: string[];
}

interface PlantScrapeButtonProps {
  /** De naam om op te zoeken — wetenschappelijk of gewone naam */
  plantName: string;
  /** Callback met de verrijkte velden zodra scraping geslaagd is */
  onEnriched: (data: Record<string, unknown>) => void;
}

type Status = "idle" | "loading" | "success" | "error";

export function PlantScrapeButton({ plantName, onEnriched }: PlantScrapeButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [sources, setSources] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function handleScrape() {
    const name = plantName.trim();
    if (!name) return;

    setStatus("loading");
    setErrorMsg("");
    setSources([]);

    try {
      const result = await apiRequest<ScrapeResponse>("/api/plants/scrape", {
        method: "POST",
        body: { plant_name: name },
      });

      onEnriched(result.enriched);
      setSources(result.sources);
      setStatus("success");

      // Reset naar idle na 4 seconden
      setTimeout(() => setStatus("idle"), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Scraping mislukt");
      setStatus("error");
    }
  }

  const disabled = !plantName.trim() || status === "loading";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
      <button
        type="button"
        onClick={handleScrape}
        disabled={disabled}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 18px",
          borderRadius: 8,
          border: "1.5px solid #16a34a",
          background: disabled ? "#f3f4f6" : "#f0fdf4",
          color: disabled ? "#9ca3af" : "#15803d",
          fontWeight: 600,
          fontSize: 14,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: "all 0.15s",
          width: "fit-content",
        }}
      >
        {status === "loading" ? (
          <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
        ) : status === "success" ? (
          <CheckCircle2 size={15} />
        ) : status === "error" ? (
          <AlertCircle size={15} />
        ) : (
          <Sparkles size={15} />
        )}

        {status === "loading"
          ? "Gegevens ophalen…"
          : status === "success"
          ? "Formulier ingevuld!"
          : status === "error"
          ? "Opnieuw proberen"
          : "Auto-invullen via web"}
      </button>

      {/* Bronnen badge */}
      {status === "success" && sources.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Bronnen:</span>
          {sources.map((src) => (
            <span
              key={src}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 10,
                background: "#dcfce7",
                color: "#15803d",
              }}
            >
              {src}
            </span>
          ))}
        </div>
      )}

      {/* Foutmelding */}
      {status === "error" && errorMsg && (
        <p style={{ fontSize: 12, color: "#b91c1c", margin: 0 }}>{errorMsg}</p>
      )}

      {/* Hint als geen naam ingevuld */}
      {!plantName.trim() && status === "idle" && (
        <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
          Vul eerst een plant- of wetenschappelijke naam in.
        </p>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
