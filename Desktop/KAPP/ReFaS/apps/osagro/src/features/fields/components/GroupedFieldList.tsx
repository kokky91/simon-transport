import { useMemo } from "react";
import { Settings, Trash2 } from "lucide-react";
import type { FieldPlot } from "../api/fieldsApi";
import type { Bed } from "../api/bedsApi";
import { getFieldTypeColor, getFieldTypeLabel } from "../constants/fieldTypeColors";
import styles from "./GroupedFieldList.module.css";

type Props = {
  fields: FieldPlot[];
  beds: Bed[];
  filter: string;
  onEdit: (field: FieldPlot) => void;
  onDelete: (id: string) => void;
  onBedEdit: (bed: Bed) => void;
  onBedDelete: (id: string) => void;
};

export function GroupedFieldList({
  fields,
  beds,
  filter,
  onEdit,
  onDelete,
  onBedEdit,
  onBedDelete,
}: Props) {
  // Group fields by crop_type
  const groupedFields = useMemo(() => {
    const groups: Record<string, FieldPlot[]> = {};
    fields.forEach((field) => {
      const key = field.crop_type || "none";
      if (!groups[key]) groups[key] = [];
      groups[key].push(field);
    });
    return groups;
  }, [fields]);

  // Filter by selected type
  const visibleGroups = useMemo(() => {
    if (filter === "All") return groupedFields;
    if (filter === "Bedden") return {};
    return { [filter]: groupedFields[filter] || [] };
  }, [groupedFields, filter]);

  const showBeds = filter === "All" || filter === "Bedden";

  // Empty state check
  const isEmpty =
    Object.keys(visibleGroups).length === 0 && (!showBeds || beds.length === 0);

  if (isEmpty) {
    return <div className={styles.emptyState}>Geen velden gevonden.</div>;
  }

  return (
    <div className={styles.listContainer}>
      {/* Render field groups */}
      {Object.entries(visibleGroups).map(([groupId, groupFields]) => {
        if (groupFields.length === 0) return null;
        const typeStyle = getFieldTypeColor(groupId);
        return (
          <div key={groupId} className={styles.group}>
            <div className={styles.groupHeader}>
              <span
                className={`px-2 py-1 rounded text-sm font-medium ${typeStyle.bg} ${typeStyle.text}`}
              >
                {getFieldTypeLabel(groupId)} ({groupFields.length})
              </span>
            </div>
            <ul className={styles.fieldsList}>
              {groupFields.map((field) => (
                <li key={field.id} className={styles.fieldItem}>
                  <div style={{ flex: 1 }}>
                    <strong>{field.label}</strong>
                    <br />
                    <span>Afmeting: {field.width_m}×{field.height_m}m</span>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      title="Bewerk veld"
                      onClick={() => onEdit(field)}
                      className={styles.editBtn}
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      type="button"
                      title="Verwijder veld"
                      onClick={() => onDelete(field.id)}
                      className={styles.deleteBtn}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {/* Render bedden group */}
      {showBeds && beds.length > 0 && (
        <div className={styles.group}>
          <div className={styles.groupHeader}>
            <span
              className={`px-2 py-1 rounded text-sm font-medium ${getFieldTypeColor("bed").bg} ${getFieldTypeColor("bed").text}`}
            >
              Bedden ({beds.length})
            </span>
          </div>
          <ul className={styles.fieldsList}>
            {beds.map((bed) => (
              <li key={bed.id} className={styles.bedItem}>
                <div style={{ flex: 1 }}>
                  <strong>{bed.label}</strong>
                  <br />
                  <span>
                    {bed.width_m}m × {bed.length_m}m · diepte {bed.depth_cm}cm ·
                    pad {bed.path_cm}cm
                  </span>
                </div>
                <div className={styles.actions}>
                  <button
                    type="button"
                    title="Bewerk bed"
                    onClick={() => onBedEdit(bed)}
                    className={styles.editBtn}
                  >
                    <Settings size={16} />
                  </button>
                  <button
                    type="button"
                    title="Verwijder bed"
                    onClick={() => onBedDelete(bed.id)}
                    className={styles.deleteBtn}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
