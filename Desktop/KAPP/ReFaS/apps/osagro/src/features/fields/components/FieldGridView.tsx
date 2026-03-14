import { Settings, Trash2 } from "lucide-react";
import type { FieldPlot } from "../api/fieldsApi";
import { getFieldTypeColor } from "../constants/fieldTypeColors";
import styles from "./FieldGridView.module.css";

type Props = {
  fields: FieldPlot[];
  onEdit: (field: FieldPlot) => void;
  onDelete: (id: string) => void;
};

export function FieldGridView({ fields, onEdit, onDelete }: Props) {
  if (!fields.length) return <div>Geen velden gevonden.</div>;
  return (
    <div className={styles.grid}>
      {fields.map((field) => {
        const typeStyle = getFieldTypeColor(field.crop_type);
        return (
          <div className={styles.card} key={field.id}>
            <div className={styles.actions}>
              <button
                type="button"
                title="Bewerk veld"
                onClick={() => onEdit(field)}
                className={styles.editBtn}
              >
                <Settings size={15} />
              </button>
              <button
                type="button"
                title="Verwijder veld"
                onClick={() => onDelete(field.id)}
                className={styles.deleteBtn}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <strong>{field.label}</strong>
            <div className={`mt-3 px-2 py-1 rounded text-sm font-medium ${typeStyle.bg} ${typeStyle.text}`}>
              Gewas: {field.crop_type || "—"}
            </div>
            <div>Afmeting: {field.width_m}×{field.height_m}m</div>
          </div>
        );
      })}
    </div>
  );
}
