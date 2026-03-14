import { Settings, Trash2 } from "lucide-react";
import type { FieldPlot } from "../api/fieldsApi";
import { getFieldTypeColor } from "../constants/fieldTypeColors";
import styles from "./FieldListView.module.css";

type Props = {
  fields: FieldPlot[];
  onEdit: (field: FieldPlot) => void;
  onDelete: (id: string) => void;
};

export function FieldListView({ fields, onEdit, onDelete }: Props) {
  if (!fields.length) return <div>Geen velden gevonden.</div>;
  return (
    <ul className={styles.list}>
      {fields.map((field) => {
        const typeStyle = getFieldTypeColor(field.crop_type);
        return (
          <li key={field.id} className={styles.item}>
            <div style={{ flex: 1 }}>
              <strong>{field.label}</strong>
              <br />
              <span>
                Gewas:{" "}
                <span className={`ml-1 px-2 py-1 rounded text-sm font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                  {field.crop_type || "—"}
                </span>
              </span>
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
        );
      })}
    </ul>
  );
}
