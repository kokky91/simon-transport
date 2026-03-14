import { useState, type ReactNode } from "react";
import { Trash2, Settings } from "lucide-react";
import { PageTitle } from "../../../components/ui/PageTitle";
import { FieldEditModal } from "../components/FieldEditModal";
import { EditBedModal } from "../components/EditBedModal";
import { useCreateFieldMutation } from "../hooks/useCreateFieldMutation";
import { useCreateBedMutation } from "../hooks/useCreateBedMutation";
import { useDeleteFieldMutation } from "../hooks/useDeleteFieldMutation";
import { useFields } from "../hooks/useFields";
import { useBeds } from "../hooks/useBeds";
import { useDeleteBedMutation } from "../hooks/useDeleteBedMutation";
import { FieldGridView } from "../components/FieldGridView";
import { FieldTypeFilter } from "../components/FieldTypeFilter";
import { GroupedFieldList } from "../components/GroupedFieldList";
import type { FieldPlot } from "../api/fieldsApi";
import type { Bed } from "../api/bedsApi";
import { getFieldTypeColor } from "../constants/fieldTypeColors";
import styles from "./FieldsPage.module.css";

function calcBorderArea(w: number, h: number, bw: number): number {
  return Math.max(0, 2 * bw * (w + h) - 4 * bw * bw);
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard}>
        <button type="button" onClick={onClose} className={styles.closeButton} aria-label="Close">
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

export function FieldsPage() {
  // ── Perceel beheer modal ────────────────────────────────────────────────────
  const [percelOpen, setPercelOpen] = useState(false);

  // ── Edit modals ─────────────────────────────────────────────────────────────
  const [editingField, setEditingField] = useState<FieldPlot | null>(null);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);

  // ── Shared form state ────────────────────────────────────────────────────────
  const [label, setLabel] = useState("");
  const [cropType, setCropType] = useState("none"); // "bed" triggers bed creation
  const [widthMeters, setWidthMeters] = useState(1);
  const [count, setCount] = useState(1);
  const [error, setError] = useState<string | undefined>(undefined);

  // ── Field-specific state ─────────────────────────────────────────────────────
  const [heightMeters, setHeightMeters] = useState(1);
  const [bioBorder, setBioBorder] = useState(false);
  const [bioBorderWidth, setBioBorderWidth] = useState(2);
  const [toegang, setToegang] = useState(false);
  const [toegangBreedte, setToegangBreedte] = useState(4);

  // ── Bed-specific state ───────────────────────────────────────────────────────
  const [bedLength, setBedLength] = useState(3);
  const [bedDepth, setBedDepth] = useState(30);
  const [bedPath, setBedPath] = useState(30);

  // ── View toggle ──────────────────────────────────────────────────────────────
  const [view, setView] = useState<"list" | "grid">("list");

  // ── Filter state ──────────────────────────────────────────────────────────────
  const [selectedFilter, setSelectedFilter] = useState("All");

  // ── Data + mutations ─────────────────────────────────────────────────────────
  const { data: fields = [], isLoading } = useFields();
  const { data: beds = [] } = useBeds();
  const deleteBed = useDeleteBedMutation();
  const deleteField = useDeleteFieldMutation();

  const createField = useCreateFieldMutation();
  const createBed = useCreateBedMutation();

  const isPending = createField.isPending || createBed.isPending;

  function resetForm() {
    setLabel("");
    setCropType("none");
    setWidthMeters(1);
    setHeightMeters(1);
    setBioBorder(false);
    setBioBorderWidth(2);
    setToegang(false);
    setToegangBreedte(4);
    setBedLength(3);
    setBedDepth(30);
    setBedPath(30);
    setCount(1);
    setError(undefined);
  }

  async function handlePercelSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    try {
      for (let i = 1; i <= count; i++) {
        const lbl = count > 1 ? `${label} ${i}` : label;
        if (cropType === "bed") {
          await createBed.mutateAsync({
            label: lbl,
            width_m: widthMeters,
            length_m: bedLength,
            depth_cm: bedDepth,
            path_cm: bedPath,
          });
        } else {
          await createField.mutateAsync({
            label: lbl,
            crop_type: cropType === "none" ? "" : cropType,
            x_m: 0,
            y_m: 0,
            width_m: widthMeters,
            height_m: heightMeters,
            bio_border: bioBorder,
            bio_border_width_m: bioBorder ? bioBorderWidth : null,
            bio_border_plants: [],
          });
        }
      }
      resetForm();
      setPercelOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fout bij opslaan");
    }
  }

  return (
    <section className={styles.fieldsPage}>
      <PageTitle title="Percelen" subtitle="Beheer velden en bedden op één plek." />
      <p className={styles.fieldsIntro}>Velden en bedden aanmaken, bewerken en verwijderen.</p>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.percelButton}
          onClick={() => { resetForm(); setPercelOpen(true); }}
        >
          + Perceel beheer
        </button>
        <div className={styles.viewToggle}>
          <button
            type="button"
            aria-label="Lijstweergave"
            className={`${styles.viewBtn} ${view === "list" ? styles.viewBtnActive : ""}`}
            onClick={() => setView("list")}
          >
            <span role="img" aria-label="Lijst">☰</span>
          </button>
          <button
            type="button"
            aria-label="Blokweergave"
            className={`${styles.viewBtn} ${view === "grid" ? styles.viewBtnActive : ""}`}
            onClick={() => setView("grid")}
          >
            <span role="img" aria-label="Grid">▦</span>
          </button>
        </div>
      </div>

      {/* ── Perceel beheer modal (unified form) ───────────────────────────── */}
      <Modal open={percelOpen} onClose={() => setPercelOpen(false)}>
        <div className={styles.modalBody}>
          <strong className={styles.modalTitle}>Perceel toevoegen</strong>
          <form onSubmit={handlePercelSubmit} className={styles.percelForm}>

            <label className={styles.formField}>
              Label
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                placeholder="bijv. Akker Noord"
              />
            </label>

            <label className={styles.formField}>
              Type
              <select value={cropType} onChange={(e) => setCropType(e.target.value)} className={styles.typeSelect}>
                <option value="none">— geen —</option>
                <option value="teelt">Teelt</option>
                <option value="industrie">Industrie</option>
                <option value="weide">Weide</option>
                <option value="kas">Kas</option>
                <option value="boomgaard">Boomgaard</option>
                <option disabled>──────────</option>
                <option value="bed">Bed</option>
              </select>
            </label>

            {/* Field dimensions */}
            {cropType !== "bed" && (
              <div className={styles.row}>
                <label className={styles.formField}>
                  Breedte (m)
                  <input
                    type="number"
                    min={1}
                    value={widthMeters}
                    onChange={(e) => setWidthMeters(Number(e.target.value))}
                    required
                  />
                </label>
                <label className={styles.formField}>
                  Hoogte (m)
                  <input
                    type="number"
                    min={1}
                    value={heightMeters}
                    onChange={(e) => setHeightMeters(Number(e.target.value))}
                    required
                  />
                </label>
              </div>
            )}

            {/* Bio border (only for fields, not beds) */}
            {cropType !== "bed" && (
              <>
                <label className={styles.inlineCheckboxRow}>
                  <input
                    type="checkbox"
                    checked={bioBorder}
                    onChange={(e) => setBioBorder(e.target.checked)}
                    className={styles.checkbox}
                  />
                  Biodiversiteitsrand
                  {bioBorder && (
                    <>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={bioBorderWidth}
                        onChange={(e) => setBioBorderWidth(Number(e.target.value))}
                        className={styles.inlineInput}
                        required
                      />
                      <span>m</span>
                    </>
                  )}
                </label>

                {bioBorder && (
                  <>
                    <label className={styles.inlineCheckboxRow}>
                      <input
                        type="checkbox"
                        checked={toegang}
                        onChange={(e) => setToegang(e.target.checked)}
                        className={styles.checkbox}
                      />
                      Toegang
                      {toegang && (
                        <>
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={toegangBreedte}
                            onChange={(e) => setToegangBreedte(Number(e.target.value))}
                            className={styles.inlineInput}
                            required
                          />
                          <span>m</span>
                        </>
                      )}
                    </label>

                    <div className={styles.bioBorderInfo}>
                      {(() => {
                        const randBruto = calcBorderArea(widthMeters, heightMeters, bioBorderWidth);
                        const toegangOpp = toegang ? toegangBreedte * bioBorderWidth : 0;
                        const randNetto = Math.max(0, randBruto - toegangOpp);
                        const resterend = Math.max(0, widthMeters * heightMeters - randNetto);
                        return (
                          <>
                            <div>Oppervlakte veld: <strong>{(widthMeters * heightMeters).toFixed(1)} m²</strong></div>
                            <div>Oppervlakte rand: <strong>{randBruto.toFixed(1)} m²</strong></div>
                            {toegang && <div>Toegang: <strong>−{toegangOpp.toFixed(1)} m²</strong></div>}
                            <div>Rand netto: <strong>{randNetto.toFixed(1)} m²</strong></div>
                            <div>Resterend veld: <strong>{resterend.toFixed(1)} m²</strong></div>
                          </>
                        );
                      })()}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Bed dimensions */}
            {cropType === "bed" && (
              <>
                <div className={styles.row}>
                  <label className={styles.formField}>
                    Breedte (m)
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={widthMeters}
                      onChange={(e) => setWidthMeters(Number(e.target.value))}
                      required
                    />
                  </label>
                  <label className={styles.formField}>
                    Lengte (m)
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={bedLength}
                      onChange={(e) => setBedLength(Number(e.target.value))}
                      required
                    />
                  </label>
                </div>
                <div className={styles.row}>
                  <label className={styles.formField}>
                    Diepte bak (cm)
                    <input
                      type="number"
                      min={1}
                      value={bedDepth}
                      onChange={(e) => setBedDepth(Number(e.target.value))}
                      required
                    />
                  </label>
                  <label className={styles.formField}>
                    Pad (cm)
                    <input
                      type="number"
                      min={0}
                      value={bedPath}
                      onChange={(e) => setBedPath(Number(e.target.value))}
                      required
                    />
                  </label>
                </div>
              </>
            )}

            <label className={styles.countLabel}>
              Aantal:
              <input
                type="number"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value))))}
                className={styles.countInput}
              />
            </label>

            <button type="submit" className={styles.submitButton} disabled={isPending}>
              {isPending ? "Bezig..." : cropType === "bed" ? "Bed opslaan" : "Veld opslaan"}
            </button>

            {error && <span className={styles.error}>{error}</span>}
          </form>
        </div>
      </Modal>

      {/* ── Edit modals ────────────────────────────────────────────────────── */}
      <Modal open={editingField !== null} onClose={() => setEditingField(null)}>
        {editingField && (
          <FieldEditModal field={editingField} onClose={() => setEditingField(null)} />
        )}
      </Modal>
      <Modal open={editingBed !== null} onClose={() => setEditingBed(null)}>
        {editingBed && (
          <EditBedModal bed={editingBed} onClose={() => setEditingBed(null)} />
        )}
      </Modal>

      {/* ── Field list/grid ────────────────────────────────────────────────── */}
      <div className={styles.content}>
        {isLoading ? (
          <div>Velden laden...</div>
        ) : view === "list" ? (
          <>
            <div className={styles.filterContainer}>
              <FieldTypeFilter
                value={selectedFilter}
                onChange={setSelectedFilter}
                fields={fields}
                bedCount={beds.length}
              />
            </div>
            <GroupedFieldList
              fields={fields}
              beds={beds}
              filter={selectedFilter}
              onEdit={setEditingField}
              onDelete={(id) => deleteField.mutate({ id, mode: "real" })}
              onBedEdit={setEditingBed}
              onBedDelete={(id) => deleteBed.mutate(id)}
            />
          </>
        ) : (
          <FieldGridView
            fields={fields}
            onEdit={setEditingField}
            onDelete={(id) => deleteField.mutate({ id, mode: "real" })}
          />
        )}
      </div>
    </section>
  );
}
